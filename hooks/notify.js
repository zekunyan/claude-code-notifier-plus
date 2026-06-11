#!/usr/bin/env node
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const NOTIFY_FILE = path.join(CLAUDE_DIR, 'notify-plus.pipe');
const MARKER_FILE = path.join(CLAUDE_DIR, 'notify-plus.active');
const MAX_TITLE_LEN = 50;

const TERM_BUNDLE_MAP = {
  'Apple_Terminal': 'com.apple.Terminal',
  'iTerm.app': 'com.googlecode.iterm2',
  'iTerm2': 'com.googlecode.iterm2',
  'WarpTerminal': 'dev.warp.Warp-Stable',
  'Alacritty': 'org.alacritty',
  'kitty': 'net.kovidgoyal.kitty',
  'Hyper': 'co.zeit.hyper',
  'vscode': 'com.microsoft.VSCode',
};

const TERM_SCRIPT_INFO = {
  'com.googlecode.iterm2': { app: 'iTerm', process: 'iTerm2' },
  'com.apple.Terminal': { app: 'Terminal', process: 'Terminal' },
  'dev.warp.Warp-Stable': { app: 'Warp', process: 'Warp' },
  'com.microsoft.VSCode': { app: 'Visual Studio Code', process: 'Code' },
};

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
    const content = fs.readFileSync(MARKER_FILE, 'utf8').trim();
    if (!content) return false;
    const pids = content.split('\n').filter(Boolean).map(Number);
    return pids.some(pid => {
      if (isNaN(pid)) return false;
      try { process.kill(pid, 0); return true; } catch (_) { return false; }
    });
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

function detectTerminalFromProcessTree() {
  if (os.platform() !== 'darwin') return null;
  try {
    const { execSync } = require('child_process');
    let pid = process.ppid;
    for (let i = 0; i < 15 && pid > 1; i++) {
      const line = execSync(`ps -o ppid=,comm= -p ${pid}`, { encoding: 'utf8', timeout: 3000 }).trim();
      const m = line.match(/^\s*(\d+)\s+(.+)$/);
      if (!m) break;
      const comm = m[2].trim();
      if (/^Terminal$/.test(comm)) return 'com.apple.Terminal';
      if (/iTerm/i.test(comm)) return 'com.googlecode.iterm2';
      if (/[Ww]arp/.test(comm)) return 'dev.warp.Warp-Stable';
      if (/[Aa]lacritty/.test(comm)) return 'org.alacritty';
      if (/kitty/i.test(comm)) return 'net.kovidgoyal.kitty';
      if (/Hyper/i.test(comm)) return 'co.zeit.hyper';
      if (/^(Code|Electron)$/.test(comm)) return 'com.microsoft.VSCode';
      pid = parseInt(m[1], 10);
    }
  } catch (_) {}
  return null;
}

function getTerminalBundleId() {
  const tp = process.env.TERM_PROGRAM || process.env.LC_TERMINAL;
  if (tp && TERM_BUNDLE_MAP[tp]) return TERM_BUNDLE_MAP[tp];
  return detectTerminalFromProcessTree();
}

function buildTerminalActivateScript(bundleId, project) {
  const info = TERM_SCRIPT_INFO[bundleId];
  if (!info) return null;
  const safe = (project || '').replace(/[\\'"]/g, '');
  if (!safe) {
    return `osascript -e 'tell application "${info.app}" to activate'`;
  }
  return `osascript -e 'tell application "${info.app}" to activate' -e 'delay 0.1' -e 'tell application "System Events" to tell process "${info.process}"' -e 'set wins to every window whose title contains "${safe}"' -e 'if (count of wins) > 0 then' -e 'perform action "AXRaise" of item 1 of wins' -e 'end if' -e 'end tell'`;
}

function showDirectNotification(message, { project = '', termBundleId = '' } = {}) {
  const safe = message.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  const platform = os.platform();

  if (platform === 'darwin') {
    const tnPath = findTerminalNotifier();
    if (tnPath) {
      const iconPath = path.join(os.homedir(), '.claude', 'notify-plus-icon.png');
      const args = ['-title', '✨ Claude Code', '-message', safe];
      const bundleId = termBundleId || null;
      if (bundleId) {
        args.push('-activate', bundleId);
        const script = buildTerminalActivateScript(bundleId, project);
        if (script) args.push('-execute', script);
      }
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

  const termBundleId = getTerminalBundleId() || '';
  try { fs.mkdirSync(path.dirname(NOTIFY_FILE), { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(NOTIFY_FILE, JSON.stringify({ event, text, project, taskTitle, cwd: data.cwd || '', termBundleId, ts: Date.now() })); } catch (_) {}

  if (!isExtensionActive()) {
    const message = formatNotificationText(project, taskTitle, text);
    showDirectNotification(message, { project, termBundleId });
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
