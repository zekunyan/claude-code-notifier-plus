const EVENT_TYPES = [
  'permission_prompt',
  'elicitation_dialog',
  'idle_prompt',
  'subagent_stop',
];

function parsePayload(raw) {
  if (typeof raw !== 'string') return { event: 'notification', text: '', ts: 0 };
  const trimmed = raw.trim();
  if (!trimmed) return { event: 'notification', text: '', ts: 0 };
  try {
    const data = JSON.parse(trimmed);
    return {
      event: typeof data.event === 'string' ? data.event : 'notification',
      text: typeof data.text === 'string' ? data.text : trimmed,
      project: typeof data.project === 'string' ? data.project : '',
      taskTitle: typeof data.taskTitle === 'string' ? data.taskTitle : '',
      cwd: typeof data.cwd === 'string' ? data.cwd : '',
      ts: typeof data.ts === 'number' ? data.ts : 0,
    };
  } catch (_) {
    return { event: 'notification', text: trimmed, ts: 0 };
  }
}

function isAllowedEvent(event, allowedList) {
  const list = Array.isArray(allowedList) ? allowedList : EVENT_TYPES;
  return list.includes(event);
}

module.exports = { parsePayload, isAllowedEvent, EVENT_TYPES };
