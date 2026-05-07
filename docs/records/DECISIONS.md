# Decisions

Use `project-data/decisions.json` as the source of truth.

## Proposed

- D1: 先建立项目执行计划、PRD、任务清单、验证计划和自治规则；确认前不进入自动实现。

## Confirmed

- D2: MVP 采用 Electron + React + TypeScript，面向 macOS 优先交付。
- D3: Tauri、SwiftUI、Flutter、Qt 已作为备选评估；当前保持 Electron 技术方案，先验证桌面宠物 MVP 体验。
- D4: 直接按完整可用产品推进，包括自定义宠物导入/切换、设置持久化和可安装交付。
- D5: 默认宠物“噜噜”使用 Codex 自定义宠物现成素材，来源目录为 `/Users/lusheng/Documents/MyProjects/Codex-Pets/pets/lulu`。
- D6: 设置面板优先采用深色 macOS 风格。
- D7: 项目远程仓库为 `git@github.com:lushengyin/desktop-pet.git`。
- D8: 新增智能陪伴能力按独立里程碑 M7 规划：先设计可替换回复服务、每角色独立本地记忆、专门设置模块和桌面聊天入口，同时保留现有手动气泡展示。
