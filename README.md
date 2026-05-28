# Claude Code Notifier Plus

Get notified when Claude Code needs your attention — works in **both CLI and VS Code extension mode**.

## Why This Extension?

The official Claude Code VS Code extension handles notifications internally through its webview and **does not trigger** the `Notification` hook that CLI-based notifier extensions rely on. This means existing notifier extensions silently fail when you use Claude Code inside VS Code.

**Claude Code Notifier Plus** solves this by registering hooks for multiple event types that fire in both environments:

| Event | CLI Mode | VS Code Mode |
|---|---|---|
| Permission Request | `Notification` hook | `PermissionRequest` hook |
| Question / Elicitation | `Notification` hook | `Elicitation` hook |
| Task Complete | `Notification` hook | `Stop` hook |
| Subagent Finished | `Notification` hook | `SubagentStop` hook |

## Features

- **Dual-mode support** — works whether you run Claude Code in the terminal or the VS Code extension
- **OS-level notifications** — native system notifications on macOS, Windows, and Linux (zero dependencies)
- **Task context** — notifications include project name and task title so you know which tab needs attention
- **Sound alerts** — audible notification when Claude needs attention
- **Focus-aware** — optionally suppress notifications when VS Code is already focused
- **Configurable delay** — set a delay before the system notification fires; dismiss the VS Code popup within that window to cancel it
- **Multi-instance safe** — dedup prevents duplicate notifications across multiple VS Code windows
- **Auto-install** — hooks are automatically registered in `~/.claude/settings.json` on activation

## Installation

### From VSIX

```bash
code --install-extension claude-code-notifier-plus-1.0.0.vsix
```

### From Source

```bash
cd claude-code-notifier-plus
npx @vscode/vsce package --allow-missing-repository
code --install-extension claude-code-notifier-plus-1.0.0.vsix
```

After installation, **reload VS Code** (Cmd+Shift+P → "Developer: Reload Window").

## Configuration

All settings are under `claudeCodeNotifierPlus.*` in VS Code settings:

| Setting | Default | Description |
|---|---|---|
| `notifyOnPermissionRequest` | `true` | Notify when Claude asks for permission |
| `notifyOnQuestion` | `true` | Notify when Claude has a question |
| `notifyOnTaskComplete` | `true` | Notify when Claude finishes a task |
| `notifyOnSubagentStop` | `false` | Notify when a subagent finishes |
| `systemNotification` | `true` | Show OS-level notification popup |
| `sound` | `false` | Play a sound alert |
| `showVSCodePopup` | `false` | Show VS Code warning popup. Set `false` to only use system notifications |
| `notificationDelay` | `0` | Seconds to wait before system notification (0–60) |
| `suppressWhenFocused` | `false` | Skip system notification & sound when VS Code is focused |

### `suppressWhenFocused` Explained

This is the key setting that addresses the `onlyIfNotVisible` behavior in the official Claude Code extension:

- **`false`** (default): Notifications are **always** sent — system popup + sound fire regardless of whether VS Code is in the foreground. You'll never miss a prompt.
- **`true`**: System notification and sound are suppressed when VS Code is the active window. The VS Code warning popup still appears.

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
  │                              (writes to temp file)
  │                                       │
  │                                       ▼
  │                              VS Code Extension
  │                              (watches temp file)
  │                                       │
  │                          ┌────────────┼────────────┐
  │                          ▼            ▼            ▼
  │                    VS Code       OS System      Sound
  │                    Popup        Notification    Alert
```

## Test

Open the Command Palette (Cmd+Shift+P) and run:

> **Claude Code Notifier Plus: Send Test Notification**

## License

MIT
