const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { parsePayload, isAllowedEvent } = require('./lib/payload');
const { install: installHooks } = require('./lib/hook-installer');
const { sendSystemNotification, findTerminalNotifier } = require('./lib/system-notification');

const NOTIFY_FILE = path.join(os.tmpdir(), 'claude-notify-plus');
const MARKER_FILE = path.join(os.tmpdir(), 'claude-notify-plus.active');
const NOTIFY_SCRIPT_DEST = path.join(os.homedir(), '.claude', 'notify-plus.js');

let fileWatcher = null;
let lastNotifKey = '';
let lastNotifTime = 0;
let extensionIconPath = '';
const DEDUP_MS = 2000;

function activate(context) {
  console.log('Claude Code Notifier Plus is now active');
  extensionIconPath = path.join(context.extensionPath, 'icon.png');

  try { fs.writeFileSync(MARKER_FILE, String(process.pid), 'utf8'); } catch (_) {}

  try {
    installHooks({
      settingsPath: path.join(os.homedir(), '.claude', 'settings.json'),
      notifyScriptSrc: path.join(context.extensionPath, 'hooks', 'notify.js'),
      notifyScriptDest: NOTIFY_SCRIPT_DEST,
      iconSrc: extensionIconPath,
    });
  } catch (err) {
    vscode.window.showErrorMessage(
      `Claude Code Notifier Plus: ${vscode.l10n.t('Hook installation failed — {0}.', err.message)}`
    );
  }

  const testCommand = vscode.commands.registerCommand('claude-notifier-plus.notify', () => {
    const payload = JSON.stringify({
      event: 'permission_prompt',
      text: '🔐 Requesting permission: Bash',
      project: 'my-project',
      taskTitle: 'Fix the login bug',
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
      ts: Date.now(),
    });
    try {
      fs.writeFileSync(NOTIFY_FILE, payload, 'utf8');
    } catch (err) {
      vscode.window.showErrorMessage(vscode.l10n.t('Could not write test notification: {0}', err.message));
    }
  });

  context.subscriptions.push(testCommand);

  startFileWatcher();

  context.subscriptions.push({
    dispose: () => stopFileWatcher(),
  });

  promptTerminalNotifierInstall(context);
}

function promptTerminalNotifierInstall(context) {
  if (os.platform() !== 'darwin') return;

  const cfg = getConfig();
  if (cfg.get('clickToFocus', 'window') === 'off') return;

  if (!findTerminalNotifier()) {
    if (context.globalState.get('dismissTerminalNotifierPrompt')) return;
    const laterUntil = context.globalState.get('terminalNotifierLaterUntil');
    if (laterUntil && Date.now() < laterUntil) return;

    const btnInstall = vscode.l10n.t('Install (brew)');
    const btnLater = vscode.l10n.t('Later');
    const btnDismiss = vscode.l10n.t("Don't show again");
    vscode.window.showInformationMessage(
      vscode.l10n.t('🔔 Install terminal-notifier to enable click-to-focus! Click a notification to jump directly to the project window.'),
      btnInstall,
      btnLater,
      btnDismiss
    ).then((selection) => {
      if (selection === btnInstall) {
        const terminal = vscode.window.createTerminal('Claude Code Notifier Plus');
        terminal.show();
        terminal.sendText('brew install terminal-notifier');
        vscode.window.showInformationMessage(
          vscode.l10n.t('✅ After installation completes, reload VS Code (Cmd+Shift+P → "Reload Window") to activate click-to-focus.')
        );
      } else if (selection === btnLater) {
        context.globalState.update('terminalNotifierLaterUntil', Date.now() + 3 * 24 * 60 * 60 * 1000);
      } else if (selection === btnDismiss) {
        context.globalState.update('dismissTerminalNotifierPrompt', true);
      }
    });
    return;
  }

  if (cfg.get('clickToFocus', 'window') !== 'window') return;
  if (context.globalState.get('dismissAccessibilityPrompt')) return;

  const btnOpen = vscode.l10n.t('Open Settings');
  const btnGotIt = vscode.l10n.t('Got it');
  const btnDismissA11y = vscode.l10n.t("Don't show again");
  vscode.window.showWarningMessage(
    vscode.l10n.t('⚡ Click-to-focus requires Accessibility permission! Go to: System Settings → Privacy & Security → Accessibility → Enable "terminal-notifier". This allows clicking a notification to jump to the exact project window.'),
    btnOpen,
    btnGotIt,
    btnDismissA11y
  ).then((selection) => {
    if (selection === btnOpen) {
      execFile('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'], () => {});
      context.globalState.update('dismissAccessibilityPrompt', true);
    } else if (selection === btnGotIt || selection === btnDismissA11y) {
      context.globalState.update('dismissAccessibilityPrompt', true);
    }
  });
}

function startFileWatcher() {
  if (!fs.existsSync(NOTIFY_FILE)) {
    try {
      fs.writeFileSync(NOTIFY_FILE, '', 'utf8');
    } catch (err) {
      console.error('Failed to create notification file:', err);
    }
  }

  try {
    fileWatcher = fs.watch(NOTIFY_FILE, () => {
      handleNotification();
    });
    console.log(`Watching for notifications at: ${NOTIFY_FILE}`);
  } catch (err) {
    console.error('fs.watch failed, falling back to fs.watchFile:', err);
    fs.watchFile(NOTIFY_FILE, { interval: 500 }, (curr, prev) => {
      if (curr.mtimeMs > prev.mtimeMs) handleNotification();
    });
  }
}

function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  fs.unwatchFile(NOTIFY_FILE);
}

function getConfig() {
  return vscode.workspace.getConfiguration('claudeCodeNotifierPlus');
}

function getAllowedList() {
  const cfg = getConfig();
  const events = [];
  if (cfg.get('notifyOnPermissionRequest', true)) events.push('permission_prompt');
  if (cfg.get('notifyOnQuestion', true)) events.push('elicitation_dialog');
  if (cfg.get('notifyOnTaskComplete', true)) events.push('idle_prompt');
  if (cfg.get('notifyOnSubagentStop', false)) events.push('subagent_stop');
  return events;
}

function isDuplicate(event, text) {
  const key = `${event}:${text}`;
  const now = Date.now();
  if (key === lastNotifKey && now - lastNotifTime < DEDUP_MS) return true;
  lastNotifKey = key;
  lastNotifTime = now;
  return false;
}

function acquireLock() {
  const lockFile = NOTIFY_FILE + '.lock';
  try {
    const stat = fs.statSync(lockFile);
    if (Date.now() - stat.mtimeMs > 10000) fs.unlinkSync(lockFile);
  } catch (_) {}
  try {
    const fd = fs.openSync(lockFile, 'wx');
    fs.closeSync(fd);
    return true;
  } catch (_) {
    return false;
  }
}

function releaseLock() {
  try { fs.unlinkSync(NOTIFY_FILE + '.lock'); } catch (_) {}
}

function handleNotification() {
  if (!acquireLock()) return;

  let raw;
  try {
    raw = fs.readFileSync(NOTIFY_FILE, 'utf8').trim();
    if (raw) fs.writeFileSync(NOTIFY_FILE, '', 'utf8');
  } catch (_) {
    releaseLock();
    return;
  }
  releaseLock();
  if (!raw) return;

  try {
    const { event, text, project, taskTitle, cwd } = parsePayload(raw);

    if (!isAllowedEvent(event, getAllowedList())) {
      console.log(`Skipped notification for event type: ${event}`);
      return;
    }

    if (isDuplicate(event, text)) {
      console.log(`Duplicate notification skipped [${event}]`);
      return;
    }

    const cfg = getConfig();
    const delayMs = (cfg.get('notificationDelay', 0) || 0) * 1000;

    const label = project ? `📂 ${project}` : '';
    const title = taskTitle ? `💬 ${taskTitle}` : '';
    const prefix = label && title ? `${label} · ${title}` : label || title;
    const displayText = prefix ? `${prefix}\n${text}` : text;
    const sysNotifText = prefix ? `${prefix}\n${text}` : text;

    function fireSysNotif() {
      const suppress = cfg.get('suppressWhenFocused', false) && vscode.window.state.focused;
      sendSystemNotification(sysNotifText, {
        notification: cfg.get('systemNotification', true) && !suppress,
        sound: cfg.get('sound', false) && !suppress,
        clickToFocus: cfg.get('clickToFocus', 'window'),
        project,
        cwd,
        iconPath: extensionIconPath,
      });
    }

    let sysNotifTimer = null;
    if (delayMs > 0) {
      sysNotifTimer = setTimeout(fireSysNotif, delayMs);
    } else {
      fireSysNotif();
    }

    if (cfg.get('showVSCodePopup', false)) {
      const btnDismissNotif = vscode.l10n.t('Dismiss');
      vscode.window.showWarningMessage(`Claude Code: ${displayText}`, btnDismissNotif).then((selection) => {
        if (selection === btnDismissNotif && sysNotifTimer) clearTimeout(sysNotifTimer);
      });
    }

    console.log(`Notification shown [${event}]:`, text);
  } catch (err) {
    console.error('Failed to handle notification:', err);
  }
}

function deactivate() {
  stopFileWatcher();
  try { fs.unlinkSync(MARKER_FILE); } catch (_) {}
}

module.exports = { activate, deactivate };
