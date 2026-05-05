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
- 将宠物窗口尺寸改为精灵尺寸加云朵安全区，设置中的 petPosition 继续表示宠物精灵位置；渲染层新增 pet-anchor，相对宠物布局云朵并允许在更大透明窗口中显示，避免文字超出后被原窗口裁切。验证通过 typecheck、smoke、package。
- 拖动宠物时根据拖动方向切换奔跑动作：往右拖动播放 running-right，往左拖动播放 running-left。验证通过 typecheck、package。
- 为支持未来多宠物，将 UI 中绑定单一宠物名的通用文案改为更通用的品牌名“桌边小伴 / Desk Buddy”，并同步更新 Tray tooltip、设置窗口标题与相关说明文案。验证通过 typecheck、package。
- 修复云朵气泡在宠物缩放变大时与头部距离越来越远的问题：云朵安全区不再随 sizeScale 放大，保持与头部相对位置恒定；同时调整箭头菱形位置，使其更贴近宠物头部方向。验证通过 typecheck、package。
- 云朵气泡与宠物的距离调整为更贴近头部且不遮挡：收紧气泡 top/right 偏移，并微调箭头位置。验证通过 typecheck、package。
- 云朵气泡距离再次收近：进一步增大气泡 top/right 偏移常量，使气泡更贴近宠物头部且保持不遮挡。验证通过 typecheck、package。
- 云朵气泡宽度改为随文案自适应：使用 fit-content 收缩短文本气泡宽度，并以 max-width 限制长文本自动换行。验证通过 typecheck、package。
- 修复云朵气泡在短文案时因 right 锚定导致整体漂远的问题：将气泡定位锚点改为以宠物头部为基准的 left 锚定，并同步调整箭头定位。验证通过 typecheck、package。
- 修复从 Mission Control/切换器返回时设置窗口闪现后无法聚焦的问题：打开设置窗口时短暂提升 always-on-top 级别以可靠 bring-to-front，随后自动撤销。验证通过 typecheck、package。
- 应用侧新增 PetManifest.actionLabels 支持，设置页动作下拉可按当前宠物显示自定义动作文案，并将宠物预览底色改为浅色。验证通过 typecheck、package。
- 新增自定义宠物管理能力：宠物库中自定义宠物显示删除按钮，删除前二次确认；主进程新增 pet:delete IPC，仅允许删除 imported 宠物，删除当前宠物时自动切回可用内置宠物。验证通过 typecheck、package。
- 新增 PetManifest.actionFrameCounts 支持，自定义宠物可声明每个动作实际播放帧数，未声明时继续使用内置默认帧数。验证通过 typecheck、package。
- 桌面宠物窗口新增透明区域鼠标穿透：主进程轮询鼠标位置，鼠标在宠物精灵区域内可点击/拖动，窗口扩展出的云朵和空白安全区可穿透到下一层。验证通过 typecheck、package。
