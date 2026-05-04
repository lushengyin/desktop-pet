# Test Plan

Status: draft
Updated: 2026-05-04

## Automated Checks

在实现阶段优先配置并运行：

- `npm run typecheck`
- `npm run lint` 如果项目配置了 lint
- `npm run build`

## Manual MVP Checks

- 启动应用后桌面出现透明背景宠物窗口。
- 宠物可拖动，拖动结束后重启应用能恢复位置。
- 设置中调整大小后，桌面宠物即时变化并持久化。
- 菜单栏能打开设置、显示/隐藏宠物、重置位置、退出应用。
- 设置窗口优先为深色风格，文字不重叠、不溢出，侧边栏和控件符合参考图风格。
- “噜噜”待机动画循环自然，拖动时有基础反馈。
- 可导入、预览、切换自定义宠物资源。
- 配置损坏或素材缺失时可恢复默认状态。
- 打包产物包含“噜噜”素材，不依赖开发机外部资源目录。

## Visual QA

- 桌面宠物窗口背景不能出现白底或黑底。
- 设置窗口在常见宽度下保持可读。
- 控件类型应符合预期：大小用滑块，开关项用 toggle，选项集用下拉或分段控件。
- 深色面板需要有足够对比度，控件 hover/active/disabled 状态清晰。

## Verification Results

2026-05-04:

- `pnpm run typecheck`: passed
- `pnpm run build`: passed
- `pnpm run smoke`: passed
- `pnpm run package`: passed
- Packaged app smoke test: passed with `LULU_SMOKE_TEST=1 release/mac-arm64/Lulu Desktop Pet.app/Contents/MacOS/Lulu Desktop Pet`
- Feedback fix verification: passed after removing duplicate window buttons, limiting idle animation to non-empty frames, and packaging visible tray icon resource.
- Size scaling fix verification: passed after changing desktop sprite rendering to fill the resized pet window.
- Reset position fix verification: passed after changing settings application to respect saved `petPosition`.
- Settings content layout fix verification: passed after increasing top and bottom content padding for the hidden titlebar window.
- Window drag fix verification: passed after adding Electron app-region drag/no-drag zones.
- Sidebar scroll fix verification: passed after making the left navigation list independently scrollable.

Known release note: macOS package uses ad-hoc signing and is not notarized.
