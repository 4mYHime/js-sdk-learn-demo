# Fix32: staged 模式任务被自动确认

## 问题描述
创建多个 staged 模式订单，第一步任务（二创文案）完成后，部分订单的 wait_confirm 任务被自动确认并推进到下一步（剪辑数据）。

## 根因
`resumeOrderWorkflow` 中任务完成后的处理顺序不合理：
1. task → done（写 localStorage + syncToBackend）
2. order → clip（写 localStorage + syncToBackend）
3. 如果 staged → task → wait_confirm（写 localStorage + syncToBackend）

产生 3 次异步 sync，中间态 `{task: done, order: clip}` 被持久化。当 `loadOrdersFromBackend`（登录/恢复会话时异步拉取后端数据并覆盖 localStorage）在竞态窗口内返回时，可能用后端的中间态覆盖本地的 wait_confirm，导致 `processNextActiveOrder` 误判为已完成任务并自动推进。

## 修复方案
将 staged 判断提前到 done 写入之前。staged 模式下任务完成后直接设为 `wait_confirm`，不经过 `done` 中间态，不推进订单状态。仅一次 localStorage 写入和一次 backend sync，消除竞态窗口。

## 修改文件
- `src/index.tsx` resumeOrderWorkflow 函数（约 632-674 行）

## 任务状态
- [✅] 定位根因
- [✅] 修复代码
- [✅] 编译验证通过
