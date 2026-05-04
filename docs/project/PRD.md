# Lulu Desktop Pet PRD

Status: development_complete_local_release_ready
Updated: 2026-05-04

## Goal

做一款 macOS 优先的完整可用桌面宠物应用。宠物“噜噜”可以在桌面上陪伴用户，支持任意拖动位置、调整大小、菜单栏控制、设置界面、自定义宠物导入/切换和可安装交付。产品面板参考用户提供的 CodeIsland/Island 风格设置图，优先采用深色 macOS 原生感：侧边栏导航、分组控件、半透明面板、清晰图标与可扩展结构。

## Product Scope

产品第一阶段直接按完整可用版本推进：

- 桌面透明悬浮宠物窗口
- 宠物任意拖动与位置记忆
- 宠物大小调整与持久化
- 默认复刻用户自定义宠物“噜噜”的形象和动画
- macOS 菜单栏入口：打开设置、显示/隐藏、重置位置、退出
- 设置窗口：通用、显示、宠物、行为、声音、集成、关于等分区
- 自定义宠物导入、校验、预览、切换
- 设置持久化、重置、异常回退
- 本地构建、打包和交付说明

## Product Requirements

### Desktop Pet

- 透明、无边框、置顶显示。
- 用户可直接拖动宠物到桌面任意位置。
- 应用重启后恢复最近位置。
- 支持基础动画状态：待机、被拖动、轻微互动反馈。
- 使用“噜噜”作为默认宠物形象。
- “噜噜”素材来源：`/Users/lusheng/Documents/MyProjects/Codex-Pets/pets/lulu/pet.json` 与 `spritesheet.webp`。
- 已确认精灵表尺寸：1536 x 1872。

### Customization

- 设置中可调整宠物缩放比例。
- 配置需要持久化。
- 宠物资源需要通过 manifest 或等效结构描述，包含名称、缩略图、动画状态、帧资源和默认缩放。
- 支持导入、校验、预览和切换自定义宠物形象。
- 导入失败、资源缺失或配置损坏时需要有清晰错误提示和默认回退。

### Menu Bar

- 菜单栏常驻图标。
- 菜单项至少包含：
  - 打开设置
  - 显示/隐藏宠物
  - 重置宠物位置
  - 退出应用

### Settings Panel

- 使用独立设置窗口。
- 风格参考用户图片：优先深色 macOS 设置面板、侧边栏、分组区域、柔和边框/半透明背景、图标导航。
- 控件使用符合场景的形式：开关、滑块、下拉菜单、分段控件、列表项。
- 不做营销页，打开设置就是可操作的产品界面。

## Proposed Technical Direction

已确认：Electron + React + TypeScript。

理由：

- Electron 对透明无边框窗口、置顶窗口、Tray 菜单栏、窗口间 IPC 支持成熟。
- React 适合快速搭建可扩展设置面板。
- TypeScript 能让配置、宠物资源、IPC 合约更稳。
- 后续仍可视情况迁移或重做为 Tauri/Swift 原生版本。当前策略是先验证产品体验，再做轻量化取舍。

## Confirmed Inputs

- 技术栈：macOS + Electron + React + TypeScript。
- 包管理器：使用本机已有工具，默认 pnpm。
- 面板主题：优先深色。
- 默认宠物素材：Codex 自定义宠物“噜噜”现成素材。
- 远程仓库：`git@github.com:lushengyin/desktop-pet.git`。

## Out Of Scope For First Complete Version

- 多宠物同时上桌
- AI 对话/记忆/提醒系统
- 应用商店签名、公证、自动更新
- Windows/Linux 适配
