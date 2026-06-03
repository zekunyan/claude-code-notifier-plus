# Architecture

## How It Works

```
Claude Code Process
  │
  ├─ CLI mode: fires Notification hook ──┐
  │                                       │
  ├─ VS Code mode: fires                 │
  │   PermissionRequest hook ─────────────┤
  │   Elicitation hook ───────────────────┤
  │   Stop hook ──────────────────────────┤
  │   SubagentStop hook ──────────────────┤
  │                                       ▼
  │                              notify-plus.js
  │                                       │
  │                          ┌────────────┴────────────┐
  │                          ▼                         ▼
  │                  VS Code running?            No VS Code?
  │                  (marker file exists)        (CLI-only mode)
  │                          │                         │
  │                          ▼                         ▼
  │                  Write pipe file             Direct notification
  │                  + detect terminal           + detect terminal
  │                  (process tree walk)         (terminal-notifier
  │                          │                    or osascript)
  │                          ▼                         │
  │                  VS Code Extension                 ▼
  │                  (watches pipe file)         Click → focus terminal
  │                          │
  │             ┌────────────┼────────────┐
  │             ▼            ▼            ▼
  │       VS Code       OS System      Sound
  │       Popup        Notification    Alert
  │                    + Click-to-focus
  │                    (VS Code window
  │                     or CLI terminal)
```

## Add Selection to Claude Code

```
User selects code in editor
        │
        ├─ Right-click → "Add Selection to Claude Code"
        │   or Cmd+Shift+I
        │
        ▼
claude-notifier-plus.addSelectionToClaude command
        │
        ▼
Delegates to claude-vscode.insertAtMention
        │
        ▼
Claude Code webview receives insert_at_mention event
        │
        ▼
@file#line-range reference inserted in chat input
```

This feature piggybacks on Claude Code's built-in `insertAtMention` command, which sends a file reference (e.g., `@extension.js#10-15`) to the chat input via webview messaging. Our extension simply exposes this as a context menu item and keyboard shortcut.

## Key Files

| File | Role |
|---|---|
| `extension.js` | VS Code extension entry, file watcher, setup guides, add-selection command |
| `hooks/notify.js` | Claude Code hook script, runs on every event |
| `lib/system-notification.js` | OS notification + terminal-notifier + click-to-focus |
| `lib/hook-installer.js` | Auto-register hooks in `~/.claude/settings.json` |
| `lib/payload.js` | Payload parsing and event filtering |

## IPC Mechanism

- **Pipe file**: `~/.claude/notify-plus.pipe` — hook writes JSON payload (including `termBundleId`), extension watches
- **Marker file**: `~/.claude/notify-plus.active` — contains VS Code PID, hook checks to decide direct vs delegated notification
- **Lock file**: `~/.claude/notify-plus.pipe.lock` — prevents race conditions across multiple VS Code windows

> Files use `~/.claude/` (fixed path) instead of `$TMPDIR` to ensure the hook and extension always reference the same location regardless of how `$TMPDIR` is set.

## Terminal Detection (macOS)

When Claude Code runs in a CLI terminal, the hook detects which terminal app it's running in:

1. Check `$TERM_PROGRAM` / `$LC_TERMINAL` environment variables
2. Fallback: walk the process tree via `ps` to find the terminal ancestor

Supported terminals: Terminal.app, iTerm2, Warp, Alacritty, Kitty, Hyper, VS Code integrated terminal.

The detected terminal bundle ID (`termBundleId`) is included in the payload so the extension can focus the correct app when the user clicks the notification.
