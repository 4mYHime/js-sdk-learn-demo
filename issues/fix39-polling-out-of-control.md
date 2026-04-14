# Fix39: 轮询/定时器失控导致网页崩溃

## 问题描述
GitHub Issue #39: 工单任务失败时，登录账号时必现触发轮询/定时器失控导致网页崩溃。

App Key: `grid_n6haaDCMKqG6vIOdsu1Q`

## 根因分析
轮询/工作流循环缺乏多层防护机制，4 个缺陷叠加导致崩溃：

1. **`processNextActiveOrder` 死循环**（主因）：`pollingRef.current=true` 时 `resumeOrderWorkflow` 立即 return，while 循环反复找到同一活跃订单形成 CPU 空转
2. **`pollTaskUntilComplete` 无轮询上限**：任务状态异常(NaN)时无限轮询
3. **pending 占位任务无超时**：任务创建崩溃导致 pending 永久卡死，1 秒循环不退出
4. **缺少 error 任务早期检测**：任务已 error 但订单未标记 error，进入无效推进逻辑

## 修复方案

### Fix 1: `src/api/tasks.ts` - pollTaskUntilComplete 增加 maxAttempts 上限
- 增加 `maxAttempts` 参数（默认 360 次 ≈ 1 小时 @10s 间隔）
- 增加 `consecutiveNaN` 计数器，连续 30 次 NaN 状态直接抛错

### Fix 2: `src/index.tsx` - processNextActiveOrder 死循环防护
- while 循环顶部增加 `pollingRef.current` 检查
- 工作流进行中直接 break，避免 `resumeOrderWorkflow` 立即 return 导致无限循环

### Fix 3: `src/index.tsx` - resumeOrderWorkflow 增加 error 任务早期检测
- 在 wait_confirm 检查之后、running 任务查找之前检测已 error 的任务
- 发现 error 任务立即标记订单为 error 并退出

### Fix 4: `src/index.tsx` - pending 占位任务超时机制
- 超过 60 秒的 pending 任务视为创建失败
- 标记任务和订单为 error，退出循环

## 修改文件
- `src/api/tasks.ts`: pollTaskUntilComplete 函数
- `src/index.tsx`: processNextActiveOrder、resumeOrderWorkflow

## 任务状态
- [✅] pollTaskUntilComplete 增加 maxAttempts 上限
- [✅] processNextActiveOrder 增加 pollingRef 死循环防护
- [✅] resumeOrderWorkflow 增加 error 任务早期检测
- [✅] pending 占位任务增加超时机制
- [ ] 本地测试验证
- [ ] 部署
