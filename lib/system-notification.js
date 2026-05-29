const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');

let terminalNotifierPath = null;
let terminalNotifierChecked = false;

function findTerminalNotifier() {
  if (terminalNotifierChecked) return terminalNotifierPath;
  terminalNotifierChecked = true;

  const candidates = [
    '/opt/homebrew/bin/terminal-notifier',
    '/usr/local/bin/terminal-notifier',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) { terminalNotifierPath = p; return p; }
  }

  try {
    const { execSync } = require('child_process');
    const result = execSync('which terminal-notifier', { encoding: 'utf8', timeout: 3000 }).trim();
    if (result) { terminalNotifierPath = result; return result; }
  } catch (_) {}

  return null;
}

function playSound() {
  const platform = os.platform();
  if (platform === 'darwin') {
    execFile('afplay', ['/System/Library/Sounds/Glass.aiff'], () => {});
  } else if (platform === 'win32') {
    execFile('powershell', ['-NoProfile', '-c',
      '(New-Object Media.SoundPlayer "C:\\Windows\\Media\\notify.wav").PlaySync()',
    ], () => {});
  } else if (platform === 'linux') {
    execFile('paplay', ['/usr/share/sounds/freedesktop/stereo/complete.oga'], (err) => {
      if (err) execFile('aplay', ['/usr/share/sounds/alsa/Front_Center.wav'], () => {});
    });
  }
}

function sanitize(text) {
  return text.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildActivateScript(project) {
  const safe = (project || '').replace(/[\\'"]/g, '');
  if (!safe) {
    return `osascript -e 'tell application "Visual Studio Code" to activate'`;
  }
  return `osascript -e 'tell application "Visual Studio Code" to activate' -e 'delay 0.1' -e 'tell application "System Events" to tell process "Code"' -e 'set wins to every window whose title contains "${safe}"' -e 'if (count of wins) > 0 then' -e 'perform action "AXRaise" of item 1 of wins' -e 'end if' -e 'end tell'`;
}

function showOsNotification(text, { clickToFocus = 'window', project = '', cwd = '', iconPath = '' } = {}) {
  const safe = sanitize(text);
  const platform = os.platform();

  if (platform === 'darwin') {
    const useTerminalNotifier = clickToFocus !== 'off';
    const tnPath = useTerminalNotifier ? findTerminalNotifier() : null;

    if (tnPath) {
      const args = [
        '-title', '✨ Claude Code',
        '-message', safe,
        '-activate', 'com.microsoft.VSCode',
      ];
      if (clickToFocus === 'window') {
        args.push('-execute', buildActivateScript(project));
      }
      if (iconPath && fs.existsSync(iconPath)) {
        args.push('-contentImage', iconPath);
      }
      execFile(tnPath, args, () => {});
    } else {
      const escaped = safe.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      execFile('osascript', ['-e', `display notification "${escaped}" with title "✨ Claude Code"`], () => {});
    }
  } else if (platform === 'win32') {
    const xmlSafe = safe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const xml = `<toast><visual><binding template="ToastText02"><text id="1">✨ Claude Code</text><text id="2">${xmlSafe}</text></binding></visual></toast>`;
    const psSafe = xml.replace(/'/g, "''");
    const ps = `[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null;` +
      `$xml=New-Object Windows.Data.Xml.Dom.XmlDocument;$xml.LoadXml('${psSafe}');` +
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code').Show((New-Object Windows.UI.Notifications.ToastNotification $xml))`;
    execFile('powershell', ['-NoProfile', '-Command', ps], () => {});
  } else if (platform === 'linux') {
    execFile('notify-send', ['✨ Claude Code', safe], () => {});
  }
}

function sendSystemNotification(text, { notification = true, sound = true, clickToFocus = 'window', project = '', cwd = '', iconPath = '' } = {}) {
  if (sound) playSound();
  if (notification) showOsNotification(text, { clickToFocus, project, cwd, iconPath });
}

module.exports = { sendSystemNotification, playSound, showOsNotification, findTerminalNotifier };
