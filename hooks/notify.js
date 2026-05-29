#!/usr/bin/env node
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const NOTIFY_FILE = path.join(os.tmpdir(), 'claude-notify-plus');
const MARKER_FILE = path.join(os.tmpdir(), 'claude-notify-plus.active');
const MAX_TITLE_LEN = 50;

const isZh = /^zh/i.test(process.env.LANG || process.env.LC_ALL || process.env.LANGUAGE || '');

const TEXTS = {
  permission: isZh ? '🔐 请求权限: ' : '🔐 Requesting permission: ',
  permissionFallback: isZh ? '一个工具' : 'a tool',
  elicitation: isZh ? '❓ Claude 有问题需要你确认' : '❓ Claude has a question for you',
  stop: isZh ? '✅ 任务完成' : '✅ Task completed',
  subagentStop: isZh ? '🤖 子代理已完成' : '🤖 Subagent finished',
};

const EVENT_MAP = {
  PermissionRequest: (data) => ({
    event: 'permission_prompt',
    text: `${TEXTS.permission}${data.tool_name || TEXTS.permissionFallback}`,
  }),
  Elicitation: () => ({
    event: 'elicitation_dialog',
    text: TEXTS.elicitation,
  }),
  Stop: () => ({
    event: 'idle_prompt',
    text: TEXTS.stop,
  }),
  SubagentStop: () => ({
    event: 'subagent_stop',
    text: TEXTS.subagentStop,
  }),
};

function extractTaskTitle(transcriptPath) {
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    const chunk = buf.toString('utf8', 0, bytesRead);
    for (const line of chunk.split('\n')) {
      if (!line.trim()) continue;
      let entry;
      try { entry = JSON.parse(line); } catch (_) { continue; }
      if (entry.type !== 'user') continue;
      const content = entry.message?.content;
      let userText = '';
      if (typeof content === 'string') {
        userText = content;
      } else if (Array.isArray(content)) {
        const textBlock = content.find((c) => c.type === 'text');
        if (textBlock) userText = textBlock.text;
      }
      userText = userText.replace(/<([\w-]+)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g, '').replace(/\s+/g, ' ').trim();
      if (!userText) continue;
      if (userText.length > MAX_TITLE_LEN) return userText.slice(0, MAX_TITLE_LEN) + '...';
      return userText;
    }
  } catch (_) {}
  return '';
}

function getProjectName(cwd) {
  if (!cwd) return '';
  return path.basename(cwd);
}

function isExtensionActive() {
  try {
    const pid = parseInt(fs.readFileSync(MARKER_FILE, 'utf8').trim(), 10);
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function findTerminalNotifier() {
  const candidates = [
    '/opt/homebrew/bin/terminal-notifier',
    '/usr/local/bin/terminal-notifier',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const { execSync } = require('child_process');
    const result = execSync('which terminal-notifier', { encoding: 'utf8', timeout: 3000 }).trim();
    if (result) return result;
  } catch (_) {}
  return null;
}

function formatNotificationText(project, taskTitle, text) {
  const label = project ? `📂 ${project}` : '';
  const title = taskTitle ? `💬 ${taskTitle}` : '';
  const prefix = label && title ? `${label} · ${title}` : label || title;
  return prefix ? `${prefix}\n${text}` : text;
}

function showDirectNotification(message) {
  const safe = message.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  const platform = os.platform();

  if (platform === 'darwin') {
    const tnPath = findTerminalNotifier();
    if (tnPath) {
      const iconPath = path.join(os.homedir(), '.claude', 'notify-plus-icon.png');
      const args = ['-title', '✨ Claude Code', '-message', safe];
      if (fs.existsSync(iconPath)) args.push('-contentImage', iconPath);
      execFile(tnPath, args, () => {});
    } else {
      const escaped = safe.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      execFile('osascript', ['-e', `display notification "${escaped}" with title "✨ Claude Code"`], () => {});
    }
  } else if (platform === 'linux') {
    execFile('notify-send', ['✨ Claude Code', safe], () => {});
  }
}

function processData(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return;
  }

  let event, text;
  if (data.notification_type) {
    event = data.notification_type;
    text = data.message || event;
  } else if (data.hook_event_name && EVENT_MAP[data.hook_event_name]) {
    ({ event, text } = EVENT_MAP[data.hook_event_name](data));
  } else {
    event = data.hook_event_name || 'notification';
    text = data.message || event;
  }

  const project = getProjectName(data.cwd);
  const taskTitle = data.transcript_path ? extractTaskTitle(data.transcript_path) : '';

  fs.writeFileSync(NOTIFY_FILE, JSON.stringify({ event, text, project, taskTitle, cwd: data.cwd || '', ts: Date.now() }));

  if (!isExtensionActive()) {
    const message = formatNotificationText(project, taskTitle, text);
    showDirectNotification(message);
  }
}

let raw = '';
let done = false;

function finish() {
  if (done) return;
  done = true;
  if (raw.trim()) processData(raw);
  process.exit(0);
}

setTimeout(finish, 5000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', finish);
process.stdin.on('error', finish);
process.stdin.resume();
