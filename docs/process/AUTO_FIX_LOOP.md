# Auto Fix Loop

在自动执行阶段，每个任务按以下循环推进：

1. 读取 `project-data/tasks.json`，选择下一个未完成任务。
2. 将任务设为 `doing` 并增加 attempts。
3. 实现当前任务的最小可验证改动。
4. 运行对应验证。
5. 如果失败，记录或更新 `project-data/bugs.json`。
6. 修复失败原因并补充回归验证。
7. 验证通过后将任务设为 `done`。
8. 更新 changelog 和 dev-log。
9. 继续下一个任务，直到完成或触发停止条件。
