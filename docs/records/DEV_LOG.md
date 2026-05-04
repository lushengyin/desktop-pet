# Development Log

Use `project-data/dev-log.json` as the source of truth.

## 2026-05-04

- 根据用户给出的桌面宠物需求和参考设置面板图片，初始化项目执行计划、需求、任务拆解与自治规则。
- 用户确认保持 macOS + Electron + React + TypeScript 技术方案；记录轻量方案评估结论，并补充素材来源与开发前置准备项。
- 检查本机 Node/npm/pnpm/git 环境，初始化 git 仓库并添加基础 .gitignore。
- 用户确认使用本机包管理器、从 Codex-Pets 现成素材接入“噜噜”、设置面板优先深色，并将范围提升为完整可用产品；配置 GitHub origin。
- 完成完整可用产品第一版实现。验证通过：pnpm run typecheck、pnpm run build、pnpm run smoke、pnpm run package、打包产物 smoke test。Electron 安装使用 npmmirror 镜像源完成 rebuild。
- 移除自绘 traffic lights，待机动画改为 6 个有效帧，互动/拖动使用对应行有效帧；从噜噜首帧生成 tray.png 和应用 icon，并通过 extraResources 确保打包后菜单栏图标可读。验证通过 typecheck、smoke、package、打包产物 smoke test。
- 宠物窗口尺寸随 sizeScale 改变时，渲染层仍使用固定 192x208 精灵尺寸导致缩小时裁切。已改为 pet-sprite 100% 填满窗口，保留精灵表背景定位，实现整体缩放。验证通过 typecheck、smoke、package、打包产物 smoke test。
- 重置位置无效原因是 applySettings 使用窗口当前坐标重新计算位置，覆盖了 resetPetPosition 写入的新默认坐标。已让 applySettings 优先使用 settings.petPosition，并让 resetPetPosition 保存坐标后直接 setBounds。验证通过 typecheck、smoke、package、打包产物 smoke test。
- 设置窗口使用 hiddenInset 标题栏时，内容区顶部 padding 过小导致页面标题被系统标题栏压住，底部留白不足导致页面内容看起来不完整。已将 settings-content 顶部 padding 调整到 92px，底部 padding 调整到 72px，并设置 scroll-padding。验证通过 typecheck、smoke、package、打包产物 smoke test。
- hiddenInset 设置窗口缺少可拖动区域，导致窗口无法移动。已添加 window-drag-region，侧边栏和标题区域支持拖动，交互控件设置 -webkit-app-region: no-drag。验证通过 typecheck、smoke、package、打包产物 smoke test。
- 左侧导航原本随侧栏固定布局，窗口高度不足时底部选项不可达。已将 nav-list 设置为独立 overflow-y auto 区域，并添加底部留白和细滚动条。验证通过 typecheck、smoke、package、打包产物 smoke test。

## 2026-05-05

- 从 /Users/lusheng/Documents/MyProjects/Codex-Pets/pets/lulu/lulu.png 生成透明背景 public/pets/lulu/spritesheet.png，更新 pet.json 指向 PNG 并记录 8x9、142x154 网格；删除旧 WebP 资源，重做 build/tray.png 和 build/icon.icns。验证通过 typecheck、smoke、package、打包产物 smoke test，dist 已包含新 PNG。
- 从历史提交 3c670df 恢复 public/pets/lulu/pet.json 与 spritesheet.webp，移除高清 spritesheet.png，使用旧 WebP 首帧重做 build/tray.png 和 build/icon.icns。验证通过 typecheck、smoke、package、打包产物 smoke test，dist 已恢复 WebP 像素风资源。
- Tray 同时设置 context menu 和 click=createSettingsWindow，导致点击菜单栏图标时菜单弹出后立即打开设置窗口。已将 click 改为 popUpContextMenu，打开设置仅由菜单项触发。验证通过 typecheck、smoke、package、打包产物 smoke test。
- 原 notice 在内容流内渲染，会把页面卡片向下挤，并且需要滚动到顶部才能看到。已改为 fixed toast，居中浮在窗口上方，不参与布局，1.6 秒自动消失。验证通过 typecheck、smoke、package、打包产物 smoke test。
- 新增 AppSettings.currentAction 和动作映射：待机、向右/向左奔跑、挥手、跳跃、沮丧、等待、思考、复盘。宠物页增加“当前动作”下拉；拖拽和双击互动动作仍可临时覆盖。验证通过 typecheck、smoke、package。
- 接入 /Users/lusheng/.codex/pets/gugugaga 到 public/pets/gugugaga；主进程由单宠物 hardcode 改为扫描 bundled pets 目录，统一通过 normalizedPet 组装。验证通过 typecheck、smoke、package，且 dist/pets/gugugaga 存在。
- 新增 AppSettings.cloudEnabled/cloudMessages 持久化；宠物窗口渲染 pet-rig + pet-cloud，文案按 2.6 秒循环；设置页新增云朵提示开关和文案编辑器（每行一条，失焦或点击保存即生效）。验证通过 typecheck、smoke、package。
- 云朵循环定时器依赖 cloudMessages 数组引用导致重复重置，现改为 useMemo 稳定引用后正常循环。设置页文案输入改为独立弹窗：大文本框、文案预览标签、保存/取消操作。验证通过 typecheck、smoke、package。
- 为云朵提示新增 AppSettings.cloudOffsetX/cloudOffsetY 持久化设置；宠物窗口在开启云朵时为精灵预留右上安全区，云朵改为可换行且支持偏移 CSS 变量；设置页新增左右/上下偏移滑杆。验证通过 typecheck、smoke、package。
