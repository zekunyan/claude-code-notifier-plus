#!/usr/bin/env node
const os = require('os');
const path = require('path');
const fs = require('fs');

const NOTIFY_FILE = path.join(os.tmpdir(), 'claude-notify-plus');
const MAX_TITLE_LEN = 50;

const EVENT_MAP = {
  PermissionRequest: (data) => ({
    event: 'permission_prompt',
    text: `🔐 Requesting permission: ${data.tool_name || 'a tool'}`,
  }),
  Elicitation: () => ({
    event: 'elicitation_dialog',
    text: '❓ Claude has a question for you',
  }),
  Stop: () => ({
    event: 'idle_prompt',
    text: '✅ Task completed',
  }),
  SubagentStop: () => ({
    event: 'subagent_stop',
    text: '🤖 Subagent finished',
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

  fs.writeFileSync(NOTIFY_FILE, JSON.stringify({ event, text, project, taskTitle, ts: Date.now() }));
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
