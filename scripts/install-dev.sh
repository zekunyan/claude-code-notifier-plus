#!/bin/bash
# =============================================================
# Claude Code Notifier Plus — 安装本地开发版本
# =============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VSIX_FILE=$(ls -t "$SCRIPT_DIR"/claude-code-notifier-plus-*.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
  echo "📦 未找到 .vsix 文件，开始打包..."
  cd "$SCRIPT_DIR"
  npx --yes @vscode/vsce package --allow-missing-repository
  VSIX_FILE=$(ls -t "$SCRIPT_DIR"/claude-code-notifier-plus-*.vsix 2>/dev/null | head -1)
fi

echo ""
echo "📦 ============================================"
echo "📦  安装插件: $(basename "$VSIX_FILE")"
echo "📦 ============================================"
code --install-extension "$VSIX_FILE" --force
echo "  ✅ 插件已安装"

echo ""
echo "============================================"
echo "🎉  安装完成！"
echo "============================================"
echo ""
echo "👉 下一步："
echo "   Cmd+Shift+P → 'Developer: Reload Window'"
echo ""
