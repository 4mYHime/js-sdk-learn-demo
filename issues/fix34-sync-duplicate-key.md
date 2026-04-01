# Fix34: 后端同步 Duplicate Key / 订单不存在 错误

## 问题
每次创建订单后，控制台持续输出 `[DB Sync] Failed to create/update order: Duplicate entry ... for key 'orders.PRIMARY'`。

## 根因
`store.ts` 中 `updateOrderStatus`、`updateOrderTask`、`setOrderVideoUrl` 全部调用 `apiSaveOrder`，而 `apiSaveOrder` 调用后端 `create_order`（纯 INSERT）。订单首次创建后，后续所有更新都用 INSERT → 主键冲突。后端数据永远只有初始快照。

## 修复
将三个更新函数的 syncToBackend 改为使用细粒度 API + fallback：
- `updateOrderStatus` → 先尝试 `apiUpdateStatus`，失败则回退 `apiSaveOrder`
- `updateOrderTask` → 先尝试 `apiUpdateTask`，失败则回退 `apiSaveOrder`
- `setOrderVideoUrl` → 先尝试 `apiUpdateStatus`，失败则回退 `apiSaveOrder`

fallback 解决了 UPDATE 先于 INSERT 到达后端时“订单不存在”的问题。

`saveOrder` 保持 `apiSaveOrder`（仅用于新建订单的首次 INSERT）。

## 修改文件
- [✅] `src/store.ts` - import 补充 + 三个函数 syncToBackend 调用改为细粒度 API
