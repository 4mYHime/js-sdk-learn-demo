# Fix33: 创建订单时空 tasks 导致误判异常状态

## 问题
创建订单时，第一个任务已创建成功并在执行中，但订单 status 被设为 error，提示"订单状态异常，无法继续执行"。

## 根因
`executeWorkflow` 创建订单后、API 返回前，订单在 localStorage 中为 `{status:'script', tasks:[]}`。  
如果 `loadOrdersFromBackend`（登录时发起的异步请求）在此窗口期返回，会用后端旧数据覆盖 localStorage，导致 `resumeOrderWorkflow` 读到空 tasks 的订单 → 所有条件不匹配 → else 兜底分支 → error。

## 修复
在 `resumeOrderWorkflow` 的 else 兜底分支前，增加 `order.tasks.length === 0` 判断：空 tasks 时静默退出，不标记 error，等待后续自然触发。有 tasks 但状态不匹配仍按原逻辑报错。

## 修改文件
- [✅] `src/index.tsx` - resumeOrderWorkflow else 分支前增加空 tasks 防护
