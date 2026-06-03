# CLAUDE.md

## Project

Claude Code Notifier Plus — VS Code extension that sends OS-level notifications when Claude Code needs attention. Works in both CLI and VS Code extension mode.

## Git

- **Git user**: `tutuge.zekunyan`
- **Git email**: `zekun.yzk@alibaba-inc.com` (GitLab requires Alibaba email)
- **Remotes**:
  - `origin` → `git@github.com:zekunyan/claude-code-notifier-plus.git`
  - `gitlab` → `git@gitlab.alibaba-inc.com:icbu-ai-search-tools/claude-code-notifier-plus.git`
- **Push**: always push to BOTH remotes (`git push origin main && git push gitlab main`)

## Publishing

When publishing a new version, update ALL channels:

1. **Bump version** in `package.json`
2. **Package**: `npx --yes @vscode/vsce package --allow-missing-repository`
3. **VS Code Marketplace**: `npx --yes @vscode/vsce publish --pat "<PAT>" --allow-missing-repository`
4. **Open VSX**: `npx --yes ovsx publish <vsix-file> -p "<TOKEN>"`
5. **Git push** to both remotes

- VS Code Marketplace publisher: `tutuge`
- Open VSX namespace: `tutuge`
- Marketplace URL: https://marketplace.visualstudio.com/items?itemName=tutuge.claude-code-notifier-plus
- Open VSX URL: https://open-vsx.org/extension/tutuge/claude-code-notifier-plus

## Dev Scripts

- `./scripts/uninstall.sh` — Full cleanup (simulate fresh user)
- `./scripts/install-dev.sh` — Install local .vsix (auto-packages if needed)

## Build Notes

- No build step, pure JavaScript
- `.vscodeignore` excludes: `scripts/`, `docs/`, `*.html`, `icon.svg`, `*.vsix`
- i18n: `package.nls.json` (EN) + `package.nls.zh-cn.json` (ZH) + `l10n/bundle.l10n.zh-cn.json` (runtime)
