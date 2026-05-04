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
- 修复反馈问题：移除自绘 traffic lights，只保留系统标题栏按钮；待机动画只轮播 6 个有效帧，避免经过透明空帧；从噜噜首帧生成菜单栏 `tray.png` 和应用 `icon.icns`。
- 重新验证通过：`pnpm run typecheck`、`pnpm run smoke`、`pnpm run package`、打包产物 smoke test。
- 修复宠物大小调整裁切问题：窗口尺寸随 `sizeScale` 改变时，`.pet-sprite` 改为 100% 填满窗口，从而整体缩放而不是被裁切。
- 修复“重置位置”无效问题：`applySettings` 现在优先使用 `settings.petPosition`，`resetPetPosition` 保存默认坐标后直接 `setBounds` 移动窗口。
- 修复设置内容显示不完整问题：`hiddenInset` 标题栏会覆盖顶部内容，已增加 `.settings-content` 顶部安全间距、底部留白和滚动 padding。
- 修复设置窗口不能拖动问题：添加 `.window-drag-region`，侧边栏和标题区域设为 `-webkit-app-region: drag`，控件设为 `no-drag`。
- 为左侧导航添加独立滚动：`.nav-list` 使用 `overflow-y: auto`、底部留白和细滚动条，避免小窗口下底部选项不可达。

## 2026-05-05

- 从 `/Users/lusheng/Documents/MyProjects/Codex-Pets/pets/lulu/lulu.png` 生成透明背景 `public/pets/lulu/spritesheet.png`。
- 更新 `pet.json` 指向 PNG，并记录 8x9、142x154 网格。
- 删除旧 WebP 资源，重做 `build/tray.png` 和 `build/icon.icns`。
- 验证通过：`pnpm run typecheck`、`pnpm run smoke`、`pnpm run package`、打包产物 smoke test。
