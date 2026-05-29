const fs = require('fs');
const path = require('path');

const SENTINEL = '# claude-code-notifier-plus';
const CLI_MATCHER = 'permission_prompt|elicitation_dialog|idle_prompt|subagent_stop';

const VSCODE_HOOK_EVENTS = ['PermissionRequest', 'Elicitation', 'Stop', 'SubagentStop'];

function isManaged(hookEntry) {
  return Array.isArray(hookEntry.hooks) &&
    hookEntry.hooks.some((h) => typeof h.command === 'string' && h.command.includes(SENTINEL));
}

function buildHookEntry(notifyScriptPath, options) {
  return {
    type: 'command',
    command: `node "${notifyScriptPath}" ${SENTINEL}`,
    ...options,
  };
}

function buildSettings(settings, notifyScriptPath) {
  const result = JSON.parse(JSON.stringify(settings));
  if (!result.hooks) result.hooks = {};

  let changed = false;

  const expectedCommand = buildHookEntry(notifyScriptPath).command;

  if (!result.hooks.Notification) result.hooks.Notification = [];
  const cliIdx = result.hooks.Notification.findIndex(isManaged);
  if (cliIdx === -1) {
    result.hooks.Notification.push({
      matcher: CLI_MATCHER,
      hooks: [buildHookEntry(notifyScriptPath)],
    });
    changed = true;
  } else {
    const entry = result.hooks.Notification[cliIdx];
    if (entry.matcher !== CLI_MATCHER) { entry.matcher = CLI_MATCHER; changed = true; }
    if (entry.hooks[0].command !== expectedCommand) { entry.hooks[0].command = expectedCommand; changed = true; }
  }

  for (const eventName of VSCODE_HOOK_EVENTS) {
    if (!result.hooks[eventName]) result.hooks[eventName] = [];
    const idx = result.hooks[eventName].findIndex(isManaged);
    if (idx === -1) {
      result.hooks[eventName].push({
        hooks: [buildHookEntry(notifyScriptPath, { async: true, timeout: 10 })],
      });
      changed = true;
    } else {
      const hook = result.hooks[eventName][idx].hooks[0];
      if (hook.command !== expectedCommand) { hook.command = expectedCommand; changed = true; }
    }
  }

  return { settings: result, installed: changed };
}

function removeManaged(settings) {
  const result = JSON.parse(JSON.stringify(settings));
  if (!result.hooks) return { settings: result, removed: 0 };

  let removed = 0;
  for (const section of Object.keys(result.hooks)) {
    const before = result.hooks[section].length;
    result.hooks[section] = result.hooks[section].filter((e) => !isManaged(e));
    removed += before - result.hooks[section].length;
    if (result.hooks[section].length === 0) delete result.hooks[section];
  }
  if (Object.keys(result.hooks).length === 0) delete result.hooks;

  return { settings: result, removed };
}

function readSettings(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function writeSettings(filePath, settings) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
}

function install({ settingsPath, notifyScriptSrc, notifyScriptDest, iconSrc }) {
  const settings = readSettings(settingsPath);
  const { settings: cleaned } = removeManaged(settings);
  const { settings: newSettings, installed } = buildSettings(cleaned, notifyScriptDest);
  writeSettings(settingsPath, newSettings);

  fs.mkdirSync(path.dirname(notifyScriptDest), { recursive: true });
  fs.copyFileSync(notifyScriptSrc, notifyScriptDest);

  if (iconSrc) {
    const iconDest = path.join(path.dirname(notifyScriptDest), 'notify-plus-icon.png');
    try { fs.copyFileSync(iconSrc, iconDest); } catch (_) {}
  }

  return { installed, scriptCopied: true };
}

function uninstall({ settingsPath }) {
  const settings = readSettings(settingsPath);
  const { settings: newSettings, removed } = removeManaged(settings);
  if (removed > 0) writeSettings(settingsPath, newSettings);
  return { removed };
}

module.exports = { install, uninstall, isManaged, buildSettings, removeManaged, SENTINEL, CLI_MATCHER, VSCODE_HOOK_EVENTS };
