# 视频解说生成系统 - 项目完整总结

## 1. 项目概述

一个基于 React + TypeScript 的视频解说生成工作流应用，用户可以选择电影素材、解说模板、BGM/配音，系统自动生成解说文案、剪辑脚本并合成最终视频。

### 核心功能
- **用户认证**: 基于 app_key 的登录系统
- **订单管理**: 创建、查看、恢复订单
- **任务工作流**: 支持分段式交付（手动确认）和一站式交付（全自动）
- **自定义模型**: 支持从云盘选择素材自动生成爆款学习模型

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 3 |
| UI | Ant Design 5 |
| HTTP | Axios |
| 持久化 | localStorage |
| 部署 | Fly.io (Docker + Nginx) |

### 依赖 (package.json)
```json
{
  "dependencies": {
    "antd": "^5.8.5",
    "axios": "^1.5.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^2.0.0",
    "typescript": "^4.7.4",
    "vite": "^3.0.4"
  }
}
```

---

## 3. 目录结构

```
js-sdk-learn-demo/
├── src/
│   ├── index.tsx          # 主应用（页面路由、状态管理、工作流引擎）
│   ├── store.ts           # 订单持久化（IOrder/ITask定义、CRUD）
│   ├── types.ts           # 类型定义（API请求/响应）
│   └── api/
│       ├── tasks.ts       # 任务API（生成文案/剪辑/视频/爆款模型、轮询）
│       ├── movies.ts      # 电影列表API
│       ├── templates.ts   # 模板列表API
│       ├── bgm.ts         # BGM列表API
│       └── dubbing.ts     # 配音列表API
├── vite.config.js         # Vite配置 + API代理（开发环境）
├── nginx.conf             # Nginx配置 + API反向代理（生产环境）
├── Dockerfile             # 两阶段构建镜像
├── fly.toml               # Fly.io部署配置
└── note.md                # 详细流程文档
```

---

## 4. 数据模型

### 4.1 订单 (IOrder)
```typescript
interface IOrder {
  id: string;                    // 订单ID: order_{timestamp}_{random}
  appKey: string;                // 用户app_key
  movieId: number;               // 电影ID
  movieName: string;             // 电影名称
  templateId: string;            // 模板ID (learning_model_id)
  templateName: string;          // 模板名称
  bgmId: string;                 // BGM文件ID
  bgmName: string;
  dubbingId: string;             // 配音ID
  dubbingName: string;
  targetPlatform: string;        // 目标平台: 抖音/快手/YouTube/TikTok
  deliveryMode: 'oneStop' | 'staged';  // 交付模式
  templateSource: 'existing' | 'generate';  // 模板来源
  videoPath: string;             // 自定义视频文件ID（可选）
  videoSrtPath: string;          // 自定义SRT文件ID
  narratorType: string;          // 解说类型
  modelVersion: string;          // 模型版本
  learningModelId: string;       // 生成的学习模型ID
  status: OrderStatus;           // 订单状态
  tasks: ITask[];                // 子任务列表
  videoUrl: string;              // 最终视频URL
  errorMessage: string;
  createdAt: number;
  updatedAt: number;
}

type OrderStatus = 'pending' | 'viral_learn' | 'script' | 'clip' | 'video' | 'done' | 'error';
```

### 4.2 任务 (ITask)
```typescript
interface ITask {
  type: 'viral_learn' | 'script' | 'clip' | 'video';
  taskId: string;                // API返回的task_id
  orderNum: string;              // 任务完成后的task_order_num（用于链式调用）
  status: 'pending' | 'running' | 'wait_confirm' | 'done' | 'error';
  pollCount: number;             // 轮询次数
  elapsedTime: number;           // 耗时（秒）
  result: any;                   // 任务结果
  errorMessage: string;
  createdAt: number;
  completedAt: number | null;
}
```

---

## 5. API 接口

### 5.1 API 端点映射

| 功能 | 本地路径 | 目标服务 |
|------|----------|----------|
| 电影列表 | /api/movies/run | https://rt6xvm5qvr.coze.site |
| 模板列表 | /api/templates/run | https://y2jtqf58bf.coze.site |
| BGM列表 | /api/bgm/run | https://2b7tgw8s7h.coze.site |
| 配音列表 | /api/dubbing/run | https://4cnpfpw2q7.coze.site |
| 生成文案 | /api/script/run | https://fhwpnktkcp.coze.site |
| 生成剪辑 | /api/clip/run | https://wsk44rd4dv.coze.site |
| 合成视频 | /api/video/run | https://q77shf4jhf.coze.site |
| 任务状态 | /api/status/run | https://fnd4r5gvww.coze.site |
| 云盘文件 | /api/cloud_files/run | https://m83sqwjvdv.coze.site |
| 爆款模型 | /api/viral_learn/run | https://s6zrzf9gxs.coze.site |

### 5.2 关键API请求格式

#### 生成文案
```typescript
{
  app_key: string;
  learning_model_id: string;     // 模板的learning_model_id
  episodes_data: [{
    num: 1,
    srt_oss_key: string,         // 字幕文件ID
    video_oss_key: string,       // 视频文件ID
    negative_oss_key: string
  }];
  playlet_name: string;
  playlet_num: string;
  target_platform: string;
  task_count: number;
  target_character_name: string;
  refine_srt_gaps: string;
  vendor_requirements: string;
  story_info: string;
}
```

#### 生成剪辑
```typescript
{
  app_key: string;
  order_num: string;             // 上一步的task_order_num
  bgm: string;                   // BGM文件ID
  dubbing: string;               // 配音ID
  dubbing_type: string;
  subtitle_style: ISubtitleStyle;
  custom_cover: string;
}
```

#### 合成视频
```typescript
{
  app_key: string;
  order_num: string;             // 上一步的task_order_num
}
```

#### 生成爆款模型
```typescript
{
  app_key: string;
  video_srt_path: string;        // SRT文件ID（必需）
  video_path?: string;           // 视频文件ID（可选）
  narrator_type: string;         // 电影/短剧/第一人称电影/多语种电影/第一人称多语种
  model_version: string;         // advanced/standard/strict
}
```

### 5.3 任务状态响应
```typescript
{
  api_response: {
    data: {
      task_id: string;
      task_order_num: string;    // 关键！用于链式调用下一步
      status: number;            // 1=进行中, 2=已完成
      results: {
        // 文案任务: task_result (文案文件路径)
        // 剪辑任务: clip_data_file (剪辑脚本路径)
        // 视频任务: tasks[0].video_url (视频链接)
        // 爆款模型: order_info.learning_model_id
      };
      failed_at: string | null;
    }
  }
}
```

---

## 6. 工作流逻辑

### 6.1 任务链

```
[自定义电影] viral_learn → learning_model_id
                              ↓
[所有订单] script → task_order_num → clip → task_order_num → video → video_url
```

### 6.2 工作流状态机 (resumeOrderWorkflow)

```
while (true) {
  1. 检查 wait_confirm 任务 → 暂停
  2. 检查 running 任务 → 轮询直到完成
  3. 分段式交付且为 script/clip → 设为 wait_confirm 并暂停
  4. 无 running 任务：
     - viral_learn done && !script → 提取 learning_model_id → 创建 script
     - script done && !clip → 创建 clip
     - clip done && !video → 创建 video
     - video done → 提取 video_url → 标记完成
}
```

### 6.3 防重复机制
- `pollingRef.current` 互斥锁
- 被中断的工作流 `finally` 块不重置锁
- 调用API前先写入 `pending` 占位任务

---

## 7. 页面流程

1. **登录页** - 输入 `app_key`（格式: `grid_*`）
2. **订单列表页** - 显示用户订单，支持创建新订单
3. **创建订单页** - 4步向导：
   - Step 1: 选择电影（"自定义"触发自动生成模型流程）
   - Step 2: 
     - 普通电影: 选择解说模板
     - 自定义电影: 从云盘选SRT/视频 + 配置解说类型/模型版本
   - Step 3: 选择BGM、配音、目标平台、交付模式
   - Step 4: 确认并执行
4. **订单详情页** - 显示任务进度，分段式交付时展示产物并等待确认

---

## 8. 部署

### 8.1 Dockerfile (两阶段构建)
```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

### 8.2 部署命令
```bash
# 本地开发
npm run dev

# 构建
npm run build

# 部署到 Fly.io
flyctl deploy
```

---

## 9. localStorage 存储

| Key | 内容 |
|-----|------|
| `narration_orders` | 所有订单数组 JSON |
| `narration_user` | 当前登录的 app_key |

---

## 10. 关键代码位置

| 功能 | 文件 | 行号/函数 |
|------|------|-----------|
| 工作流引擎 | src/index.tsx | `resumeOrderWorkflow` |
| 订单创建 | src/index.tsx | `executeWorkflow` |
| 任务轮询 | src/api/tasks.ts | `pollTaskUntilComplete` |
| 订单CRUD | src/store.ts | `createOrder`, `saveOrder`, `updateOrderTask` |
| API调用 | src/api/tasks.ts | `generateScript`, `generateClip`, `synthesizeVideo`, `generateViralModel` |

---

## 11. 已知Bug修复记录

### 竞态条件导致重复创建任务 (2026-03-06)
- **问题**: 自定义电影订单的 viral_learn 完成时创建了3个相同的 script 任务
- **根因**: 
  1. 被中断的工作流 `finally` 块重置 `pollingRef`
  2. API调用期间没有占位任务防止并发
- **修复**: 
  1. `finally` 块仅在 `!signal.aborted` 时重置
  2. 调用API前先写入 `pending` 占位任务

---

## 12. 复刻步骤

1. 克隆项目并安装依赖
   ```bash
   git clone <repo>
   cd js-sdk-learn-demo
   npm install
   ```

2. 配置 API Tokens (src/api/tasks.ts)
   - 替换 `TOKENS` 对象中的各个 Bearer Token

3. 本地开发
   ```bash
   npm run dev
   ```

4. 部署
   ```bash
   flyctl launch  # 首次
   flyctl deploy  # 更新
   ```

---

*文档生成时间: 2026-03-06*
