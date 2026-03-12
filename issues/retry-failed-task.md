# 失败任务重试功能

## 背景
当订单中某个节点任务出现失败的情况，需要增加按钮让用户进行重试（逻辑是重新提交当前节点任务）。

## 方案
直接重试：在 `retryFailedTask` 函数中根据 `taskType` 重新调用对应 API。

## 改动清单

### `src/index.tsx`
- [✅] 补充 `TaskType` 到 store import
- [✅] 添加 `retryingTaskType` 状态变量（控制重试按钮 loading）
- [✅] 实现 `retryFailedTask(orderId, taskType)` 函数，支持 4 种任务类型：
  - `viral_learn` → `generateViralModel()`
  - `script` → `generateScript()`（区分自定义电影/普通电影）
  - `clip` → `generateClip()`
  - `video` → `synthesizeVideo()`
- [✅] 详情页任务卡片增加重试按钮 UI（`task.status === 'error'` 时显示）
- [✅] 修复 `resumeOrderWorkflow` catch 块，`pending` 状态任务也标记为 `error`

## 重试逻辑
1. 重置订单错误状态，将订单 status 设回对应任务阶段
2. 根据任务类型重新调用对应 API
3. 用新 task_id 更新任务为 running 状态
4. 调用 `resumeOrderWorkflow` 恢复工作流轮询
5. 若重试 API 调用失败，任务标记回 error 并记录错误信息
