# Autonomy Policy

Use `project-data/autonomy-policy.json` as the source of truth.

## Start Phrase

开始自动执行

## Stop Phrase

暂停自动执行

## Rules

- 未收到开始短语前，只做规划、澄清和文件准备。
- 收到开始短语后，按 `project-data/tasks.json` 的优先级和里程碑顺序执行。
- 每个任务最多尝试 3 次。
- 普通项目文件修改、依赖安装、本地测试、构建、bug 修复可以自动处理。
- 遇到系统安全权限、账号/付款/验证码、不可逆破坏性操作、MVP 范围扩张、单任务超过尝试次数时停止并询问。
- 每个任务完成后更新任务状态、bug/changelog/dev-log，并报告验证结果。
