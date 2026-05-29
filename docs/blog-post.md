# 🔔 在 VS Code 里用 Claude Code？你需要这个通知插件

> 用 Claude Code 写代码，最浪费时间的不是 AI 写错了，而是你不知道它写完了。

## 😩 你是不是也在反复切窗口？

在 VS Code 里让 Claude Code 跑个任务，切到浏览器看文档。过一会儿切回来——还在跑 ⏳。再切回去。再切回来——发现它等你确认权限已经三分钟了 😱。

多开几个项目更痛苦：5 个 VS Code 窗口，哪个完成了？哪个在等权限？只能一个一个点过去看 🤯。

**核心问题就一个：VS Code 里的 Claude Code 没有系统级通知 ❌**

## 🤔 现有的通知插件为什么不好用？

Claude Code 有 Hook 机制，社区也有人做过通知插件。但有个坑 ⚠️：

**VS Code 扩展模式下，`Notification` hook 不会触发！**

官方 Claude Code 在 VS Code 内部自己处理了通知，不走外部 `Notification` hook。所以所有依赖这个 hook 的插件，在 VS Code 里都是**静默失效**的 🫠。

## ✨ Claude Code Notifier Plus — 专为 VS Code 用户打造

![Claude Code Notifier Plus](https://img.alicdn.com/imgextra/i4/O1CN01gwb5Qw1mo3TM0DH8N_!!6000000005000-2-tps-2042-1206.png)

**Claude Code Notifier Plus** 不只依赖 `Notification` hook，而是同时注册了 `PermissionRequest`、`Elicitation`、`Stop`、`SubagentStop` 等 VS Code 专属事件 hook，**确保在 VS Code 扩展模式下每一条通知都不会漏掉** 💪。同时兼容 CLI 模式。

### 🚀 核心功能

🖱️ **点击通知跳转窗口** — 开了多个 VS Code 窗口？点击通知直接跳到对应项目窗口

📂 **通知带上下文** — 项目名 + 任务摘要，多项目并行一眼分清

🔐 **全事件覆盖** — 权限请求、提问确认、任务完成、子代理完成，一个不漏

🌐 **中英文自动切换** — 跟随系统语言

⚡ **零配置** — 安装即用，hook 自动注册，支持 CLI 回退

## 🔧 原理

![How It Works](https://img.alicdn.com/imgextra/i2/O1CN01SWHcHM1GWafIEO1Ie_!!6000000000630-2-tps-1760-1350.png)

插件安装时自动注册 hook 脚本到 `~/.claude/settings.json`。Claude Code 触发事件时：

- ✅ **VS Code 在运行** → 扩展监听事件并发送系统通知（支持点击跳转、延迟、去重等）
- ✅ **纯 CLI 模式** → 自动回退，直接调用 `terminal-notifier` 或 `osascript` 发送通知

整个流程毫秒级完成 ⚡。

## 📦 三步安装

**1️⃣ 安装插件** — VS Code 扩展商店搜索 **"Claude Code Notifier Plus"**

**2️⃣ 安装 terminal-notifier（推荐 👍，macOS）**

```bash
brew install terminal-notifier
```

装了才有"点击跳转"和自定义图标。首次启动时插件也会引导你安装。

**3️⃣ 授权辅助功能** — 系统设置 → 隐私与安全性 → 辅助功能 → 开启 terminal-notifier（一次性 ✌️）

重新加载 VS Code，开箱即用 🎉

---

🔗 **GitHub**: https://github.com/zekunyan/claude-code-notifier-plus

🔗 **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=tutuge.claude-code-notifier-plus

不用再盯着屏幕等了。装上它，放心去做别的事 ☕。Claude Code 需要你的时候，它会叫你 🔔。
