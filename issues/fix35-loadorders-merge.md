# Fix35: loadOrdersFromBackend 智能合并保护

## 问题
创建订单后，订单状态显示"待处理"（pending），但子任务已在执行中。原因是 `loadOrdersFromBackend`（登录时发起的异步请求）返回后，用后端旧数据（status='pending', tasks=[]）直接覆盖了本地 localStorage 中已更新的订单数据。

## 根因
`loadOrdersFromBackend` 原逻辑是"以后端数据为准，直接覆盖本地"。但后端数据存在延迟（syncToBackend 是 fire-and-forget），导致本地已更新的状态和任务数据被旧后端数据覆盖。

## 修复
将 `loadOrdersFromBackend` 从"直接覆盖"改为"智能合并"：
- 本地有活跃任务（running/pending/wait_confirm）或任务数更多时，无条件保留本地版本
- 其他情况兼容 `updatedAt`/`updated_at` 两种命名对比时间戳
- 保留后端不存在但本地存在的订单（刚创建尚未同步到后端）
- 后端无数据时不再清空本地有效订单

## 修改文件
- [✅] `src/store.ts` - loadOrdersFromBackend 合并逻辑重写
