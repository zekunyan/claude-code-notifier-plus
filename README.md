# Claude Code Notifier Plus

![Claude Code Notifier Plus](https://img.alicdn.com/imgextra/i4/O1CN01gwb5Qw1mo3TM0DH8N_!!6000000005000-2-tps-2042-1206.png)

Get notified when Claude Code needs your attention — works in **both CLI and VS Code extension mode**.

> 🌐 [中文说明](#中文说明)

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
- **Pure CLI support** — notifications work even without VS Code running (direct `terminal-notifier` / `osascript` fallback)
- **Click-to-focus** — click a notification to jump directly to the corresponding VS Code project window (macOS, requires `terminal-notifier`)
- **OS-level notifications** — native system notifications on macOS, Windows, and Linux (zero dependencies for basic mode)
- **Task context** — notifications include project name 📂 and task title 💬 so you know which tab needs attention
- **Sound alerts** — audible notification when Claude needs attention
- **Focus-aware** — optionally suppress notifications when VS Code is already focused
- **Configurable delay** — set a delay before the system notification fires; dismiss the VS Code popup within that window to cancel it
- **Multi-instance safe** — dedup prevents duplicate notifications across multiple VS Code windows
- **Auto-install** — hooks are automatically registered in `~/.claude/settings.json` on activation
- **i18n** — supports English and Chinese, auto-detected from system locale

## Installation

### From VS Code Marketplace

Search for **"Claude Code Notifier Plus"** in the Extensions panel, or:

```bash
code --install-extension tutuge.claude-code-notifier-plus
```

### From VSIX

```bash
code --install-extension claude-code-notifier-plus-1.0.0.vsix
```

After installation, **reload VS Code** (Cmd+Shift+P → "Developer: Reload Window").

### Optional: Click-to-Focus (macOS)

For the best experience on macOS, install `terminal-notifier`:

```bash
brew install terminal-notifier
```

This enables:
- Clicking a notification to jump to the exact VS Code project window
- Custom notification icon

The extension will guide you through this on first launch.

> **⚡ Important (macOS):** To enable click-to-focus on the exact project window, you need to grant **Accessibility permission**:
>
> **System Settings → Privacy & Security → Accessibility** → Enable **terminal-notifier**
>
> This permission allows the extension to raise the correct VS Code window when you click a notification. You only need to do this once. Without it, clicking a notification will activate VS Code but won't switch to the specific project window.

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
| `showVSCodePopup` | `false` | Show VS Code warning popup |
| `notificationDelay` | `0` | Seconds to wait before system notification (0–60) |
| `clickToFocus` | `"window"` | Click behavior: `window` / `app` / `off` (see below) |
| `suppressWhenFocused` | `false` | Skip system notification & sound when VS Code is focused |

### `clickToFocus` Options

| Value | Behavior | Requires |
|---|---|---|
| `"window"` ⭐ | Click notification → jump to the exact project window | `terminal-notifier` + Accessibility permission |
| `"app"` | Click notification → activate VS Code (no specific window) | `terminal-notifier` |
| `"off"` | Click does nothing, uses basic `osascript` notification | Nothing |

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

## Test

Open the Command Palette (Cmd+Shift+P) and run:

> **Claude Code Notifier Plus: Send Test Notification**

## License

MIT

---

## 中文说明

当 Claude Code 需要你的注意时发送系统通知 — 同时支持 **CLI 模式**和 **VS Code 扩展模式**。

### 特性

- **双模式支持** — 终端 CLI 和 VS Code 扩展内都能触发通知
- **纯 CLI 支持** — 无需打开 VS Code 也能收到系统通知
- **点击跳转** — 点击通知直接跳转到对应项目的 VS Code 窗口（macOS，需安装 `terminal-notifier`）
- **系统级通知** — macOS / Windows / Linux 原生系统通知
- **任务上下文** — 通知包含项目名 📂 和任务摘要 💬
- **提示音** — 可选声音提醒
- **焦点感知** — VS Code 为活动窗口时可跳过通知
- **多语言** — 支持中文和英文，跟随系统语言自动切换
- **零配置** — 安装即用，hook 自动注册

### 安装

VS Code 扩展商店搜索 **"Claude Code Notifier Plus"** 直接安装。

推荐额外安装（macOS 点击跳转功能）：

```bash
brew install terminal-notifier
```

安装后重新加载 VS Code 即可使用。

> **⚡ 重要提示（macOS）：** 要启用点击通知精确跳转到对应项目窗口，需要授予**辅助功能权限**：
>
> **系统设置 → 隐私与安全性 → 辅助功能** → 开启 **terminal-notifier**
>
> 该权限允许插件在你点击通知时定位并激活正确的 VS Code 窗口，只需授权一次。未授权时点击通知仍可激活 VS Code，但不会切换到具体项目窗口。
