# 增加原创文案任务节点

## 需求概述
增加两个新的任务节点：**创建原创文案任务**（original_script）和 **创建原创文案剪辑任务**（original_clip），独立于现有二创文案流程，跳过爆款学习步骤。

## 任务清单

- [✅] P1: `types.ts` — 新增 `IOriginalScriptRequest`、`IOriginalClipRequest`、`IMovieSearchResult` 接口
- [✅] P2: `store.ts` — 扩展 `TaskType`、`OrderStatus`、`IOrder` 接口，新增 `getStatusText`/`getStatusColor`
- [✅] P3: `api/tasks.ts` — 新增 `generateOriginalScript`/`generateOriginalClip` API 函数 + tokens
- [✅] P4: `vite.config.js` + `nginx.conf` — 新增代理规则
- [✅] P5: `index.tsx` — UI 修改
  - [✅] Step 0: 文案类型选择器（二创/原创）+ 原创模式选择（纯解说/原声混剪）
  - [✅] Step 1: 原创文案配置（语言、模型、爆款SRT选择、电影信息）
  - [✅] Step 3: 确认页展示原创参数
  - [✅] Steps 标题动态变化
  - [✅] `canGoNext` 适配原创流程
  - [✅] `startCreateOrder` + `resetWorkflow` 重置新状态变量
  - [✅] `handleEstimatePoints` 原创文案点数估算
- [✅] P6: `index.tsx` — 工作流引擎修改
  - [✅] `executeWorkflow`: 原创流程创建 `original_script` 任务
  - [✅] `resumeOrderWorkflow`: `original_script` → `original_clip` 自动流转
  - [✅] `retryFailedTask`: 支持新任务类型重试
  - [✅] `retryOrderCreation`: 支持原创流程订单重建
- [✅] P7: `index.tsx` — 展示层修改
  - [✅] 详情页 `getTaskIcon`/`getTaskName` 新增图标和名称
  - [✅] 订单列表 `stageMap` 新增阶段名称
  - [✅] 订单卡片显示"原创文案"标签
  - [✅] 文件提取逻辑兼容新任务类型
- [✅] P8: TypeScript 编译通过

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/types.ts` | 新增 3 个接口 |
| `src/store.ts` | 扩展类型定义 + createOrder + 状态文字/颜色 |
| `src/api/tasks.ts` | 新增 2 个 API 函数 + 2 个 token |
| `vite.config.js` | 新增 2 个代理规则 |
| `nginx.conf` | 新增 2 个代理规则 |
| `src/index.tsx` | UI + 工作流引擎 + 展示层全面集成 |

## 流程说明

### 原创文案流程（无爆款学习）
```
选择电影 → 原创配置(语言/模型/SRT) → BGM/配音 → 执行
                                                    ↓
                                          original_script → original_clip → 完成
```

### 二创文案流程（保持不变）
```
选择电影 → 选择模板/自定义模板 → BGM/配音 → 执行
                                              ↓
                              [viral_learn →] script → clip → video → 完成
```

## API 端点
- 原创文案: `POST /api/original_script` → `https://knh3yghcjg.coze.site/run`
- 原创剪辑: `POST /api/original_clip` → `https://b3k9vphmc4.coze.site/run`

## Fix 轮次修改 (用户反馈)

### Fix1: 电影搜索功能
- [✅] 新增 `searchMovies` API (`POST /api/movie_search/run` → `https://bkvwdm8fpf.coze.site/run`)
- [✅] 新增 `movie_search` token + proxy (vite + nginx)
- [✅] Step 0 自定义电影 + 原创文案时：填写名称 → 搜索按钮 → 展示搜索结果卡片（海报+信息）→ 用户选择确认 `confirmed_movie_json`
- [✅] `IMovieSearchResult` 新增 `original_title`, `poster_url`, `is_partial` 可选字段

### Fix2: 原创文案也要选解说模板
- [✅] Step 1 保留原有模板选择器，原创文案时在模板上方增加"原创文案配置"区域（语言、模型选择）
- [✅] `executeWorkflow` 传递 `learning_model_id` 从 `selectedTemplate`
- [✅] `retryFailedTask` / `retryOrderCreation` 传递 `learning_model_id` 从 `order.templateId`
- [✅] `handleEstimatePoints` 恢复原有模板校验逻辑
- [✅] Step 3 确认页同时展示原创参数和模板信息
- [✅] `canGoNext` 恢复统一的模板校验

## 待验证
- [ ] 浏览器中创建原创文案订单 UI 流程
- [ ] 电影搜索功能（自定义电影+原创文案时）
- [ ] 原创文案任务 API 调用是否正常
- [ ] original_script → original_clip 自动流转
- [ ] 失败重试功能
- [ ] 分段式交付确认功能
