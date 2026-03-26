# CLAUDE.md — 视频解说生成系统

> 本文件为 AI 编程助手提供项目全局上下文。修改代码前请通读本文件。

---

## 1. 项目定位

基于 React + TypeScript 的 **AI 视频解说生成工作流应用**。用户选择电影素材、解说模板、BGM/配音后，系统通过多步异步任务链自动生成解说文案、剪辑脚本并合成最终视频。后端 API 全部由 [Coze](https://www.coze.cn/) 工作流托管，前端通过 Vite 代理（开发）和 Nginx 反向代理（生产）转发请求。

**线上地址**: https://narration-video-demo.fly.dev/

---

## 2. 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript 4.7 |
| 构建 | Vite 3 |
| UI 库 | Ant Design 5 |
| HTTP | Axios |
| 持久化 | localStorage + 后端同步 (fire-and-forget) |
| 部署 | Fly.io — Docker 两阶段构建 (node:18-alpine build → nginx:alpine serve) |

> 注：`package.json` 名称为 `react-typescript`（源自 Replit 模板）。`i18next`、`react-i18next`、`@lark-base-open/js-sdk` 仅存在于 package.json，代码中未实际使用（历史遗留依赖）。

---

## 3. 目录结构

```
js-sdk-learn-demo/
├── src/
│   ├── index.tsx          # 主组件 LoadApp (~4100行)
│   │                      #   页面路由、全部状态管理、工作流引擎、UI渲染
│   ├── store.ts           # 数据层：IOrder/ITask 定义、CRUD、localStorage 读写、后端同步
│   ├── types.ts           # API 请求/响应类型定义
│   ├── styles.css         # 全局样式
│   └── api/
│       ├── tasks.ts       # 核心任务API + TOKENS + pollTaskUntilComplete
│       ├── orders.ts      # 订单 CRUD API (通过统一 order_api endpoint)
│       ├── movies.ts      # 电影列表 API
│       ├── templates.ts   # 解说模板 API
│       ├── bgm.ts         # BGM 列表 API
│       └── dubbing.ts     # 配音列表 API
├── vite.config.js         # 开发环境 API 代理 (25 个 proxy 规则)
├── nginx.conf             # 生产环境反向代理 (对应 vite proxy)
├── Dockerfile             # 两阶段构建
├── fly.toml               # Fly.io 部署配置 (app: narration-video-demo, region: sin)
├── issues/                # 任务实施记录 (markdown)
└── achieve/               # 归档文档和项目总结
```

### 关键文件规模

- `src/index.tsx` — **~4120 行**，单文件包含全部业务逻辑（105 个 useState、5 个 useRef、9 个 useEffect）
- `src/api/tasks.ts` — **~440 行**，24 个 API token + 22 个导出函数
- `src/store.ts` — **~335 行**，数据模型（IOrder 36 字段、ITask 10 字段）和持久化（18 个导出函数）
- `src/types.ts` — **~450 行**，34 个 TypeScript 接口定义
- `src/styles.css` — **~1320 行**，全局样式（含 fadeIn 动画）

---

## 4. 数据模型

### 4.1 订单 (IOrder) — `store.ts`

核心字段：

| 字段 | 说明 |
|------|------|
| `id` | `order_{timestamp}_{random}` |
| `appKey` | 用户凭证 |
| `copywritingType` | `'secondary'`（二创）/ `'original'`（原创）|
| `deliveryMode` | `'oneStop'`（全自动）/ `'staged'`（分段确认）|
| `templateSource` | `'existing'`（已有模板）/ `'generate'`（自定义生成）|
| `movieSource` | `'existing'`（系统电影）/ `'custom'`（自定义电影）|
| `status` | `OrderStatus` — 标识当前所处阶段 |
| `tasks` | `ITask[]` — 子任务列表 |

### 4.2 任务 (ITask) — `store.ts`

| 字段 | 说明 |
|------|------|
| `type` | `TaskType`: `viral_learn` / `script` / `clip` / `video` / `original_script` / `original_clip` |
| `taskId` | Coze API 返回的 task_id |
| `orderNum` | 任务完成后的 `task_order_num`，用于链式调用下一步 |
| `status` | `TaskStatus`: `pending` / `running` / `done` / `error` / `wait_confirm` |

### 4.3 状态枚举

```
TaskType:    viral_learn | script | clip | video | original_script | original_clip
TaskStatus:  pending | running | done | error | wait_confirm
OrderStatus: pending | viral_learn | script | clip | video | original_script | original_clip | done | error
DeliveryMode: oneStop | staged
```

### 4.4 localStorage

| Key | 内容 |
|-----|------|
| `narration_orders` | 所有订单数组 JSON |
| `narration_user` | 当前登录的 app_key |

---

## 5. 业务流程

### 5.1 两种文案流程

**二创文案流程**（`copywritingType === 'secondary'`）：
```
[自定义模板] viral_learn → learning_model_id
                              ↓
             script → clip → video → 完成
```

**原创文案流程**（`copywritingType === 'original'`）：
```
original_script → original_clip → video → 完成
```

### 5.2 交付模式

- **一站式 (`oneStop`)**: 任务链全自动推进，无需人工干预
- **分段式 (`staged`)**: 每个中间任务完成后暂停（`wait_confirm`），弹出预估点数弹窗，用户确认后继续

### 5.3 任务链式调用

任务间通过 `task_order_num` 串联：
1. `script` 完成 → 获得 `orderNum` → 传给 `clip` 的 `order_num`
2. `clip` 完成 → 获得 `orderNum` → 传给 `video` 的 `order_num`
3. `viral_learn` 完成 → 提取 `learning_model_id` → 传给 `script`

### 5.4 点数预估 — 两个 API

| 场景 | API | 函数 | 说明 |
|------|-----|------|------|
| 创建订单前 | `consume_budget` | `estimatePoints()` | 总点数预估，显示所有阶段明细 |
| 分段交付确认 | `task_consum_calc_points` | `taskConsumCalcPoints()` | 单任务预估，只显示下一步消耗 |

**分段确认的参数映射**（`handleEstimateForConfirm`）：

| 完成的任务 | 下一步 | request_params key |
|-----------|--------|-------------------|
| `viral_learn` | 生成文案 | `generate_writing_params` |
| `script` | 生成剪辑脚本 | `generate_clip_data_params` |
| `clip` | 合成视频 | `video_composing_params` |
| `original_script` | 原创剪辑 | `fast_generate_writing_clip_data_params` |
| `original_clip` | 合成视频 | `video_composing_params` |

---

## 6. 核心函数索引 — `src/index.tsx`

| 函数 | 作用 |
|------|------|
| `resumeOrderWorkflow(orderId)` | **工作流引擎** — while 循环驱动任务链推进、轮询、分段暂停 |
| `stopWorkflow()` | 中断当前工作流（设置 abortRef） |
| `confirmTask(orderId, taskType)` | 用户确认 wait_confirm 任务后恢复工作流 |
| `handleEstimateForConfirm(orderId, taskType)` | 分段确认前调用 `taskConsumCalcPoints` 预估下一步点数 |
| `handleEstimatePoints()` | 创建订单前调用 `estimatePoints` 预估总点数 |
| `retryFailedTask(orderId, taskType)` | 重试失败任务（重新调用 API，恢复工作流） |
| `resumeErrorOrder(orderId)` | 通用错误恢复（推断阶段、清理无效占位、重启工作流） |
| `viewOrderDetail(orderId)` | 进入详情页（停止旧工作流、清理状态） |

### 关键 Ref

| Ref | 作用 |
|-----|------|
| `pollingRef` | 工作流互斥锁，防止并发执行 |
| `abortRef` | 工作流取消信号 |
| `viewingOrderIdRef` | 当前查看的订单ID，防止跨订单 UI 污染 |
| `transferPollingRef` | 上传传输列表轮询控制 |
| `audioRef` | 音频播放器引用（BGM/配音试听） |

---

## 7. API 端点映射

所有 API 通过 Coze 工作流托管，本地开发走 Vite proxy，生产走 Nginx 反向代理。

| 功能 | 本地路径 | Coze 站点 | Token key |
|------|----------|-----------|-----------|
| 电影列表 | `/api/movies/run` | rt6xvm5qvr.coze.site | (movies.ts 内置) |
| 模板列表 | `/api/templates/run` | y2jtqf58bf.coze.site | (templates.ts 内置) |
| BGM列表 | `/api/bgm/run` | 2b7tgw8s7h.coze.site | (bgm.ts 内置) |
| 配音列表 | `/api/dubbing/run` | 4cnpfpw2q7.coze.site | (dubbing.ts 内置) |
| 生成文案 | `/api/script/run` | fhwpnktkcp.coze.site | `script` |
| 生成剪辑 | `/api/clip/run` | wsk44rd4dv.coze.site | `clip` |
| 合成视频 | `/api/video/run` | q77shf4jhf.coze.site | `video` |
| 任务状态 | `/api/status/run` | fnd4r5gvww.coze.site | `status` |
| 云盘文件 | `/api/cloud_files/run` | m83sqwjvdv.coze.site | `cloud_files` |
| 爆款模型 | `/api/viral_learn/run` | s6zrzf9gxs.coze.site | `viral_learn` |
| 预转存 | `/api/pre_upload/run` | zzz7f2thfq.coze.site | `pre_upload` |
| 上传任务 | `/api/upload_task/run` | 3mby87347p.coze.site | `upload_task` |
| 传输列表 | `/api/transfer_list/run` | v6ztd4tn4r.coze.site | `transfer_list` |
| 删除文件 | `/api/delete_file/run` | hptt42558m.coze.site | `delete_file` |
| 更新预转存(Coze) | `/api/update_pre_file/run` | mj2dzv4fkn.coze.site | `update_pre_file` |
| 更新预转存(直连) | `/api/v2/files/upload/pre-transfer/edit` | openapi.jieshuo.cn | (app-key header) |
| 用户余额 | `/api/user_balance/run` | f9cmyyvhjx.coze.site | `user_balance` |
| 云盘用量 | `/api/cloud_drive_usage/run` | ybm8p77ydh.coze.site | `cloud_drive_usage` |
| 总点数预估 | `/api/estimate_points/run` | 3y69rshy4q.coze.site | `estimate_points` |
| 单任务点数 | `/api/task_consum_calc_points/run` | p3bvh2ss7f.coze.site | `task_consum_calc` |
| 订单API | `/api/order_api/run` | 9jx9k4wgkx.coze.site | `order_api` |
| 文件下载 | `/api/file_download/run` | rkf588fr4n.coze.site | `file_download` |
| 电影搜索 | `/api/movie_search/run` | bkvwdm8fpf.coze.site | `movie_search` |
| 原创文案 | `/api/original_script/run` | knh3yghcjg.coze.site | `original_script` |
| 原创剪辑 | `/api/original_clip/run` | b3k9vphmc4.coze.site | `original_clip` |

### Nginx 超时分层

生产环境 `nginx.conf` 按任务耗时分三档超时：

| 超时档位 | 适用端点 | 说明 |
|---------|---------|------|
| 默认 | movies, templates, bgm, dubbing, cloud_files, order_api 等 | 快速查询类 |
| 60-120s | status, task_consum_calc_points, movie_search | 中等耗时查询 |
| 300s | script, clip, video, viral_learn, pre_upload, upload_task, original_script, original_clip | 长耗时任务 |

### 新增 API 端点检查清单

添加新 API 时必须同时修改 **3 个文件**：
1. `src/api/tasks.ts` — 函数 + Token
2. `vite.config.js` — 开发代理
3. `nginx.conf` — 生产代理（注意选择合适的超时档位）

---

## 8. 并发控制与已修复的关键 Bug

### 8.1 竞态条件 — 重复创建任务

**问题**: viral_learn 完成时创建了 3 个相同的 script 任务
**根因**: 被中断的旧工作流 `finally` 块重置 `pollingRef`；API 调用期间无占位防并发
**修复**:
- `finally` 块仅在 `!signal.aborted` 时重置 `pollingRef`
- 调用 API 前先写入 `pending` 占位任务

### 8.2 跨订单 UI 污染

**问题**: 重试 Order A 的失败任务后切换到 Order B，Order B 的 wait_confirm 任务被自动推进
**根因**: `resumeOrderWorkflow` 内的 `setCurrentOrder` 更新了错误订单的 UI，`useEffect` 触发了错误订单的工作流
**修复**:
- 引入 `viewingOrderIdRef` 跟踪当前查看的订单
- `resumeOrderWorkflow` 内用 `safeSetCurrentOrder()` 守卫，仅当用户仍在查看该订单时更新 UI
- `retryFailedTask` 中的 `setCurrentOrder` 也加守卫
- 详情页 `useEffect` 增加 `viewingOrderIdRef` 匹配检查
- 关闭预估弹窗时清除 `pendingConfirmInfo`

### 8.3 关键设计决策

- **工作流互斥**: `pollingRef.current` 确保同一时刻只有一个工作流实例运行
- **中断机制**: `abortRef.current.aborted` 允许安全取消正在进行的轮询
- **后端同步**: `syncToBackend` 采用 fire-and-forget 模式，不阻塞前端操作
- **防重复占位**: 每次创建任务前先写入 `pending` 状态的占位任务到 store
- **Coze 响应兼容**: `api_response` 可能是 JSON 字符串，所有 API 函数都做了 `typeof === 'string'` 解析兼容

---

## 9. 页面路由

单页应用，通过 `page` state 切换：

| page | 页面 | 说明 |
|------|------|------|
| `login` | 登录页 | 输入 app_key（格式 `grid_*`） |
| `orders` | 订单列表 | 显示用户订单，后台自动推进活跃订单 |
| `create` | 创建订单 | 4步向导：选电影 → 选模板 → 配置 → 确认执行 |
| `detail` | 订单详情 | 任务进度、产物预览、分段确认、失败重试 |

---

## 10. 开发与部署

```bash
# 安装依赖
npm install

# 本地开发 (端口 3100, host: 0.0.0.0)
npm run dev

# TypeScript 检查
npx tsc --noEmit

# 构建 (tsc && vite build → dist/)
npm run build

# 部署到 Fly.io
fly deploy
```

### Fly.io 部署配置

- VM: `shared-cpu-2x`，1 CPU / 2048MB 内存
- 容器内部端口: 8080（Nginx）
- 自动休眠: 空闲 300s 后停机，请求时自动唤醒（min_machines_running: 0）
- 健康检查: GET `/`，间隔 30s

### 开发规约

- **改完代码先本地测试，确认无误后再部署到 Fly.io**
- 新增 API 必须同时更新 `vite.config.js` 和 `nginx.conf`
- Token 全部硬编码在 `src/api/tasks.ts` 的 `TOKENS` 对象中
- `index.tsx` 是单组件架构（`LoadApp`），所有状态用 `useState`/`useRef` 管理

---

## 11. 修复历史摘要

| 编号 | 内容 |
|------|------|
| Fix1-12 | 基础功能迭代（工作流重构、自定义电影、云盘上传、爆款模型等） |
| Fix13-16 | 原创文案流程（original_script/original_clip）、电影搜索功能 |
| Fix17 | 状态机 pending 任务安全网 |
| Fix18 | 所有任务创建前补齐 pending 占位 |
| Fix19 | 通用工作流恢复机制 (`resumeErrorOrder`) |
| Fix20 | 合并文案类型 + 原创模式（4选项 Radio） |
| Fix21-27 | 各种 UI/逻辑修正 |
| Fix28 | 跨订单 UI 污染修复 (`viewingOrderIdRef`) |
| Fix29 | 点数预估重构：分段确认改用 `task_consum_calc_points` 接口 |

详细记录见 `issues/` 目录下各 `.md` 文件。
