#!/bin/bash
# =============================================================
# Claude Code Notifier Plus — 完全卸载 + 模拟新用户安装脚本
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
  # 使用 node 删除所有包含 sentinel 的 hook 条目
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
    if (settings.hooks) {
      for (const key of Object.keys(settings.hooks)) {
        settings.hooks[key] = settings.hooks[key].filter(
          e => !(e.hooks && e.hooks.some(h => h.command && h.command.includes('claude-code-notifier-plus')))
        );
        if (settings.hooks[key].length === 0) delete settings.hooks[key];
      }
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    }
    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
  "
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
# VS Code globalState 存在 SQLite 中，用 node 通过 sqlite3 清理
VSCODE_STATE_DB="$HOME/Library/Application Support/Code/User/globalStorage/state.vscdb"
if [ -f "$VSCODE_STATE_DB" ]; then
  node -e "
    try {
      const { execSync } = require('child_process');
      const db = '$VSCODE_STATE_DB';
      // 删除插件相关的 globalState keys
      execSync('sqlite3 \"' + db + '\" \"DELETE FROM ItemTable WHERE key LIKE \\'%claude-code-notifier-plus%\\'\"', {stdio:'pipe'});
      console.log('  ✅ globalState 已清理');
    } catch(e) {
      console.log('  ⚠️  globalState 清理失败 (非致命):', e.message);
    }
  "
else
  echo "  ⚠️  state.vscdb 未找到，跳过"
fi

echo ""
echo "🧹 ============================================"
echo "🧹  Step 6: 清理 VS Code 插件残留目录"
echo "🧹 ============================================"
rm -rf "$HOME/.vscode/extensions/tutuge.claude-code-notifier-plus-"* && echo "  ✅ 插件目录已删除" || true

echo ""
echo "============================================"
echo "✅  清理完成！当前状态如同全新用户"
echo "============================================"
echo ""
echo "📦 ============================================"
echo "📦  Step 7: 重新安装插件"
echo "📦 ============================================"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VSIX_FILE="$SCRIPT_DIR/claude-code-notifier-plus-1.0.0.vsix"

if [ -f "$VSIX_FILE" ]; then
  code --install-extension "$VSIX_FILE" --force
  echo "  ✅ 插件已安装"
else
  echo "  ❌ 未找到 .vsix 文件: $VSIX_FILE"
  exit 1
fi

echo ""
echo "============================================"
echo "🎉  模拟新用户安装完成！"
echo "============================================"
echo ""
echo "👉 下一步："
echo "   1. Cmd+Shift+P → 'Developer: Reload Window'"
echo "   2. 观察是否弹出 terminal-notifier 安装引导"
echo "   3. 检查 ~/.claude/settings.json 是否有 hook 配置"
echo "   4. 检查 ~/.claude/notify-plus.js 是否存在"
echo "   5. 测试: Cmd+Shift+P → 'Claude Code Notifier Plus: Send Test Notification'"
echo ""
