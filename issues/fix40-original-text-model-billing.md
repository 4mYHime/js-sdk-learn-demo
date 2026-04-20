# Fix40 — 原创文案点数预估新计费编码

## 背景

原创文案计费规则细化，按"解说类型 × 模型档位"划分为 6 档，调用点数接口时需要以编码参数区分：

| 解说类型（`originalMode`） | Flash | Pro (`standard`) |
|---|---|---|
| 纯解说（`热门影视`） | `flash_1` | `pro_1` |
| 原片混剪（`原声混剪`） | `flash_2` | `pro_2` |
| 短剧/新剧（`冷门/新剧`） | `flash_3` | `pro_3` |

原来代码直接将 `originalModel`（`'flash' | 'standard'`）作为 `text_model` 传给总预估接口，不包含解说类型信息，需要升级。

## 需求要点

- [✅] 总预估接口（`estimate_points` / `estimatePoints`）：原创流程下 `text_model` 使用上述 6 档编码
- [✅] 分段确认接口（`task_consum_calc_points` / `taskConsumCalcPoints`）：原创两步（`original_script → original_clip`、`original_clip → video`）在对应 `*_params` 内嵌套字段 **`model`**（不是 text_model），值同 6 档编码
- [✅] 二创流程不受影响

## 变更

### 1. 新增辅助函数 `getOriginalTextModel`

位置：[src/index.tsx:40](src/index.tsx#L40)

```ts
function getOriginalTextModel(originalMode: string, originalModel: 'flash' | 'standard'): string {
  const tierMap: Record<string, string> = {
    '热门影视': '1',
    '原声混剪': '2',
    '冷门/新剧': '3'
  };
  const prefix = originalModel === 'standard' ? 'pro' : 'flash';
  const tier = tierMap[originalMode] || '1';
  return `${prefix}_${tier}`;
}
```

### 2. 总预估 `handleEstimatePoints`

[src/index.tsx:1780](src/index.tsx#L1780)

```diff
- ...(_isOriginal ? { text_model: originalModel } : {}),
+ ...(_isOriginal ? { text_model: getOriginalTextModel(originalMode, originalModel) } : {}),
```

### 3. 分段确认 `handleEstimateForConfirm`

[src/index.tsx:1243-1254](src/index.tsx#L1243-L1254)

在原创两步的 `*_params` 中注入 `model` 字段：

```ts
// original_script 完成 → fast_generate_writing_clip_data_params
requestParams.fast_generate_writing_clip_data_params = {
  task_id: completedTask?.taskId || '',
  model: getOriginalTextModel(order.originalMode, order.originalModel)
};

// original_clip 完成 → video_composing_params
requestParams.video_composing_params = {
  order_num: completedTask?.orderNum || '',
  model: getOriginalTextModel(order.originalMode, order.originalModel)
};
```

## 影响范围

- 仅影响点数预估两个接口的入参，不改变 `IOrder` 持久化字段（`originalMode` / `originalModel` 继续保留原值）
- 不影响真实任务调用（`generateOriginalScript` 仍按原结构传 `model: originalModel`）
- 不涉及 `vite.config.js` / `nginx.conf` 修改（接口路径未变）

## 验证

- [✅] `npx tsc --noEmit` 类型检查通过
- [ ] 功能回归（由用户在本地/线上触发点数预估确认映射值正确）
