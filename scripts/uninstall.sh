#!/bin/bash
# =============================================================
# Claude Code Notifier Plus — 完全卸载（模拟全新用户状态）
# =============================================================
set -e

echo "🧹 ============================================"
echo "🧹  Step 1: 卸载 VS Code 插件"
echo "🧹 ============================================"
code --uninstall-extension tutuge.claude-code-notifier-plus 2>/dev/null && echo "  ✅ 插件已卸载" || echo "  ⚠️  插件未安装，跳过"

echo ""
echo "🧹 ============================================"
echo "🧹  Step 2: 卸载 terminal-notifier"
echo "🧹 ============================================"
if command -v terminal-notifier &>/dev/null; then
  brew uninstall terminal-notifier 2>/dev/null && echo "  ✅ terminal-notifier 已卸载" || echo "  ⚠️  卸载失败"
else
  echo "  ⚠️  terminal-notifier 未安装，跳过"
fi

echo ""
echo "🧹 ============================================"
echo "🧹  Step 3: 清理 hook 配置 (~/.claude/settings.json)"
echo "🧹 ============================================"
SETTINGS_FILE="$HOME/.claude/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
  node -e '
    var fs = require("fs");
    var settings = JSON.parse(fs.readFileSync("'"$SETTINGS_FILE"'", "utf8"));
    if (settings.hooks) {
      for (var key of Object.keys(settings.hooks)) {
        settings.hooks[key] = settings.hooks[key].filter(function(e) {
          return !(e.hooks && e.hooks.some(function(h) { return h.command && h.command.includes("claude-code-notifier-plus"); }));
        });
        if (settings.hooks[key].length === 0) delete settings.hooks[key];
      }
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    }
    fs.writeFileSync("'"$SETTINGS_FILE"'", JSON.stringify(settings, null, 2) + "\n");
  '
  echo "  ✅ Hook 配置已清理"
else
  echo "  ⚠️  settings.json 不存在"
fi

echo ""
echo "🧹 ============================================"
echo "🧹  Step 4: 清理安装的文件"
echo "🧹 ============================================"
rm -f "$HOME/.claude/notify-plus.js" && echo "  ✅ ~/.claude/notify-plus.js 已删除" || true
rm -f "$HOME/.claude/notify-plus-icon.png" && echo "  ✅ ~/.claude/notify-plus-icon.png 已删除" || true

TMPDIR=$(node -e "console.log(require('os').tmpdir())")
rm -f "$TMPDIR/claude-notify-plus" && echo "  ✅ temp file 已删除" || true
rm -f "$TMPDIR/claude-notify-plus.active" && echo "  ✅ marker file 已删除" || true
rm -f "$TMPDIR/claude-notify-plus.lock" && echo "  ✅ lock file 已删除" || true

echo ""
echo "🧹 ============================================"
echo "🧹  Step 5: 清理 VS Code globalState (引导提示标记)"
echo "🧹 ============================================"
VSCODE_STATE_DB="$HOME/Library/Application Support/Code/User/globalStorage/state.vscdb"
if [ -f "$VSCODE_STATE_DB" ]; then
  node -e '
    try {
      var execSync = require("child_process").execSync;
      var db = "'"$VSCODE_STATE_DB"'";
      execSync("sqlite3 \"" + db + "\" \"DELETE FROM ItemTable WHERE key LIKE '"'"'%claude-code-notifier-plus%'"'"'\"", {stdio:"pipe"});
      console.log("  ✅ globalState 已清理");
    } catch(e) {
      console.log("  ⚠️  globalState 清理失败 (非致命):", e.message);
    }
  '
else
  echo "  ⚠️  state.vscdb 未找到，跳过"
fi

echo ""
echo "🧹 ============================================"
echo "🧹  Step 6: 清理 VS Code 插件残留目录"
echo "🧹 ============================================"
rm -rf "$HOME/.vscode/extensions/tutuge.claude-code-notifier-plus-"* && echo "  ✅ 插件目录已删除" || true

echo ""
echo "🧹 ============================================"
echo "🧹  Step 7: 辅助功能权限提示"
echo "🧹 ============================================"
echo "  ℹ️  如需完全模拟新用户，手动前往:"
echo "     系统设置 → 隐私与安全性 → 辅助功能"
echo "     移除 terminal-notifier 条目"

echo ""
echo "============================================"
echo "✅  完全卸载完成！当前状态如同全新用户"
echo "============================================"
echo ""
