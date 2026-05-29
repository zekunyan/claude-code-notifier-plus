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
  │                  Write temp file             Direct notification
  │                          │                   (terminal-notifier
  │                          ▼                    or osascript)
  │                  VS Code Extension
  │                  (watches temp file)
  │                          │
  │             ┌────────────┼────────────┐
  │             ▼            ▼            ▼
  │       VS Code       OS System      Sound
  │       Popup        Notification    Alert
  │                    + Click-to-focus
```

## Key Files

| File | Role |
|---|---|
| `extension.js` | VS Code extension entry, file watcher, setup guides |
| `hooks/notify.js` | Claude Code hook script, runs on every event |
| `lib/system-notification.js` | OS notification + terminal-notifier + click-to-focus |
| `lib/hook-installer.js` | Auto-register hooks in `~/.claude/settings.json` |
| `lib/payload.js` | Payload parsing and event filtering |

## IPC Mechanism

- **Temp file**: `$TMPDIR/claude-notify-plus` — hook writes JSON, extension watches
- **Marker file**: `$TMPDIR/claude-notify-plus.active` — contains VS Code PID, hook checks to decide direct vs delegated notification
- **Lock file**: `$TMPDIR/claude-notify-plus.lock` — prevents race conditions across multiple VS Code windows
