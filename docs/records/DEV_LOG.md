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

## 2026-05-06

- 按用户新需求拆分智能陪伴与角色记忆功能，仅更新规划文档和 project-data：新增 R13-R18 与 M7/T7.1-T7.8，等待用户确认后再进入开发。
- 实现智能陪伴第一版：AppSettings 新增 companion 配置；主进程按 petId 存储独立聊天记录和记忆摘要，提供 OpenAI-compatible 回复服务抽象与本地回退；设置页新增陪伴配置、记忆管理和模型配置；宠物窗口新增快捷聊天框、主动说话调度和手动/AI/混合气泡模式。验证通过 typecheck、package、打包产物 smoke test。
- 扩展智能陪伴模型供应商配置：新增 deepseek 和 glm provider，设置页切换供应商时自动应用 DeepSeek/GLM 推荐 Base URL 与默认模型，主进程配置判断从单一 OpenAI-compatible 扩展为任意已配置 provider。验证通过 typecheck、package、打包产物 smoke test。
- 将智能陪伴主动频率控件从 3-120 分钟滑杆改为秒级数字输入框，并把主进程设置校验和桌面主动说话调度最低值调整为 5 秒，便于短间隔测试。验证通过 typecheck、package、打包产物 smoke test。
- 精简智能陪伴模型服务配置 UI，将长说明改为短 caption 与底部状态；新增 companion:testProvider IPC，使用当前配置发起 Chat Completions 测试请求并返回明确成功/失败提示。验证通过 typecheck、package、打包产物 smoke test。
- 根据用户反馈优化智能陪伴设置：主动频率输入框移除 5 秒 UI 下限，调度按用户输入值计算；角色记忆更新不再追加角色主动说话和助手回复流水账，仅保留最多 8 条用户事实标签，设置页只显示数量摘要和最近标签。验证通过 typecheck、package、打包产物 smoke test。
- 修复主动频率数字输入框清空后被受控值立即回填旧秒数的问题：IntervalInput 改为本地 draft 状态，空值时不提交设置，用户输入有效数字或失焦时再同步。验证通过 typecheck、package、打包产物 smoke test。
- 新增 CompanionPersona 数据模型和每角色 persona.json 存储；设置页陪伴模块新增角色设定面板，可配置称呼、性格、语气、关系感和说话风格，并将这些配置写入 companion system prompt。验证通过 typecheck、package、打包产物 smoke test。
- 优化陪伴设置交互：角色设定表单改为本地 personaDraft 和手动保存，避免每次输入触发 IPC/snapshot 回刷导致光标乱跳；将“主动回复”文案改为“聊天功能”，并新增设置页快捷聊天区用于直接测试当前角色对话。验证通过 typecheck、package、打包产物 smoke test。
- 优化桌面宠物快捷聊天入口：按钮从宠物身体下方移到右上侧，改为“聊”标识，并同步调整 pet:setInteractiveRegions 坐标，避免透明区域穿透导致点击无效。验证通过 typecheck、package、打包产物 smoke test。
- 根据用户反馈移除桌面宠物旁的蓝色聊天入口和对应 pet-chat 样式，保留设置页陪伴模块中的快捷聊天。验证通过 typecheck、package、打包产物 smoke test。
- 将云朵气泡尾巴菱形改为可点击快捷聊天入口：保留气泡尾巴视觉，hover 轻微反馈，点击后打开桌面聊天框，并按气泡/聊天框状态动态设置 pet interactive regions 以兼容透明穿透。验证通过 typecheck、package、打包产物 smoke test。
- 修复 macOS 菜单栏图标不可见问题：将 tray icon 加载收敛到 loadTrayIcon，并对资源图标/系统兜底图标调用 setTemplateImage(true)，让 macOS 按菜单栏主题渲染可见图标。验证通过 typecheck、package、打包产物 smoke test。
- 继续修复菜单栏图标不可见：历史代码未在智能陪伴功能中改动 tray，初步判断是原彩色透明宠物截图图标在当前菜单栏渲染不可见；已将 build/tray.png 替换为确定可见的 36x36 黑白 alpha template 图标，并确认打包后的 Resources/tray.png 与源文件一致。验证通过 typecheck、package、打包产物 smoke test。
- 重构设置页宠物模块：移除左侧独立“陪伴”和“行为”导航，将形象动画、互动行为、智能陪伴作为宠物页内部分段标签；陪伴配置改为网格卡片、角色设定表单和记忆/模型双列布局，减少大段说明和臃肿行高。验证通过 typecheck、package、打包产物 smoke test。
- 修复智能陪伴页布局问题：persona-grid 第一项独占一行，输入控件宽度跟随列宽；记忆与模型配置改为单列自适应，subsection-card 防止内容横向溢出，避免 API 配置显示不全。验证通过 typecheck、package、打包产物 smoke test。
- 修复宠物页云朵偏移卡片布局：为包含 range-control 的 mini-setting 增加单列自适应样式，滑杆宽度使用 minmax(0, 1fr) 和 100%，避免标题被固定滑杆宽度挤成竖排。验证通过 typecheck、package、打包产物 smoke test。
- 优化主动频率数字输入框外观：隐藏 WebKit 原生 number spinner，上下箭头不再显示，使控件更贴合深色卡片风格。验证通过 typecheck、package、打包产物 smoke test。
- 将宠物库从大卡片网格改为可搜索、可按来源筛选的紧凑列表：保留小缩略图、名称、来源、atlas 信息、当前标识和自定义宠物删除操作，并限制列表高度独立滚动，适配未来大量宠物。验证通过 typecheck、package、打包产物 smoke test。
- 优化桌面聊天气泡交互：云朵气泡常态只显示气泡和尾巴，hover 时在右下角显示“回复”按钮，点击打开桌面聊天框；同时将每个角色 messages.json 上限从 80 条收紧为 40 条，长期记忆仍只保留最多 8 条用户事实标签。验证通过 typecheck、package、打包产物 smoke test。
- 桌面聊天框新增右上角收起按钮，并为聊天记录顶部补充按钮安全间距，用户可以随时关闭聊天面板恢复普通气泡显示。验证通过 typecheck、package、打包产物 smoke test。
- 模型服务配置从单一表单升级为多配置管理：用户可以新增、删除、命名并切换模型配置，当前选中的配置用于聊天、主动说话和测试连接；主进程保留旧字段兼容并自动迁移历史单模型设置。验证通过 typecheck、package、打包产物 smoke test。

## 2026-05-07

- 修复桌面气泡透明安全区拦截点击的问题：renderer 不再上报硬编码大矩形，而是测量气泡/聊天框真实 DOM 边界；主进程交互区域支持圆角命中，气泡圆角外侧和周围透明区会继续穿透。验证通过 typecheck、package、打包产物 smoke test。
- 新增菜单栏图标开关：AppSettings 增加 showMenuBarIcon，关闭时主进程销毁 Tray，重新打开时恢复 Tray；同时增加宠物右键打开设置、Dock 激活打开设置和应用菜单 Cmd+, 设置入口，避免菜单栏空间不足时失去管理入口。验证通过 typecheck、package、打包产物 smoke test。
- 重排模型服务配置卡片：将配置选择、新增/删除操作和当前配置详情拆成独立区域，为服务类型、Base URL、模型名和 API Key 增加明确标签，并在未选择模型服务时给出本地回退说明。验证通过 typecheck、package、打包产物 smoke test。
- 模型服务配置改为本地草稿编辑加手动保存：输入不会立即写入设置，点击保存配置后才同步；测试连接会先保存未提交改动。应用菜单补回标准编辑角色，恢复 Cmd+V 粘贴 API Key。验证通过 typecheck、package、打包产物 smoke test。
