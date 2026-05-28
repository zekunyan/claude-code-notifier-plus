const os = require('os');
const { execFile } = require('child_process');

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

function showOsNotification(text) {
  const safe = sanitize(text);
  const platform = os.platform();
  if (platform === 'darwin') {
    const escaped = safe.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    execFile('osascript', ['-e', `display notification "${escaped}" with title "✨ Claude Code"`], () => {});
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

function sendSystemNotification(text, { notification = true, sound = true } = {}) {
  if (sound) playSound();
  if (notification) showOsNotification(text);
}

module.exports = { sendSystemNotification, playSound, showOsNotification };
