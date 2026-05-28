const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parsePayload, isAllowedEvent } = require('./lib/payload');
const { install: installHooks } = require('./lib/hook-installer');
const { sendSystemNotification } = require('./lib/system-notification');

const NOTIFY_FILE = path.join(os.tmpdir(), 'claude-notify-plus');
const NOTIFY_SCRIPT_DEST = path.join(os.homedir(), '.claude', 'notify-plus.js');

let fileWatcher = null;
let lastNotifKey = '';
let lastNotifTime = 0;
const DEDUP_MS = 2000;

function activate(context) {
  console.log('Claude Code Notifier Plus is now active');

  try {
    installHooks({
      settingsPath: path.join(os.homedir(), '.claude', 'settings.json'),
      notifyScriptSrc: path.join(context.extensionPath, 'hooks', 'notify.js'),
      notifyScriptDest: NOTIFY_SCRIPT_DEST,
    });
  } catch (err) {
    vscode.window.showErrorMessage(
      `Claude Code Notifier Plus: Hook installation failed — ${err.message}.`
    );
  }

  const testCommand = vscode.commands.registerCommand('claude-notifier-plus.notify', () => {
    const payload = JSON.stringify({
      event: 'permission_prompt',
      text: '🔐 Requesting permission: Bash',
      project: 'my-project',
      taskTitle: 'Fix the login bug',
      ts: Date.now(),
    });
    try {
      fs.writeFileSync(NOTIFY_FILE, payload, 'utf8');
    } catch (err) {
      vscode.window.showErrorMessage('Could not write test notification: ' + err.message);
    }
  });

  context.subscriptions.push(testCommand);

  startFileWatcher();

  context.subscriptions.push({
    dispose: () => stopFileWatcher(),
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
    const { event, text, project, taskTitle } = parsePayload(raw);

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
      });
    }

    let sysNotifTimer = null;
    if (delayMs > 0) {
      sysNotifTimer = setTimeout(fireSysNotif, delayMs);
    } else {
      fireSysNotif();
    }

    if (cfg.get('showVSCodePopup', false)) {
      vscode.window.showWarningMessage(`Claude Code: ${displayText}`, 'Dismiss').then((selection) => {
        if (selection === 'Dismiss' && sysNotifTimer) clearTimeout(sysNotifTimer);
      });
    }

    console.log(`Notification shown [${event}]:`, text);
  } catch (err) {
    console.error('Failed to handle notification:', err);
  }
}

function deactivate() {
  stopFileWatcher();
}

module.exports = { activate, deactivate };
