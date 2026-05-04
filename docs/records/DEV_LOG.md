# Development Log

Use `project-data/dev-log.json` as the source of truth.

## 2026-05-04

- 根据用户给出的桌面宠物需求和参考设置面板图片，初始化项目执行计划。
- 用户确认保持 macOS + Electron + React + TypeScript 技术方案。
- 已检查本机开发环境：Node v25.2.1、npm 11.6.2、pnpm 10.28.1、git 2.52.0。
- 已初始化 git 仓库，主分支为 `main`，并添加基础 `.gitignore`。
- 用户确认使用本机包管理器，默认 pnpm。
- 用户确认“噜噜”素材从 Codex 自定义宠物现成素材中获取，路径为 `/Users/lusheng/Documents/MyProjects/Codex-Pets/pets/lulu`。
- 用户确认设置面板优先深色。
- 用户确认直接按完整可用产品开发。
- 已设置 GitHub origin：`git@github.com:lushengyin/desktop-pet.git`。
- 已完成完整可用产品第一版实现。
- 验证通过：`pnpm run typecheck`、`pnpm run build`、`pnpm run smoke`、`pnpm run package`、打包产物 smoke test。
- Electron 安装曾因默认下载源卡住，已通过 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm rebuild electron` 解决。
- 当前状态：本地 release ready，macOS 包为 ad-hoc signing，未公证。
