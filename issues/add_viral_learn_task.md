# 新增"生成爆款模型"任务

## 背景
用户选择"自定义"电影时，需要先生成爆款学习模型（viral_learn），获取 learning_model_id 后才能创建文案任务。

## 任务链
- **自定义电影**: viral_learn → script → clip → video
- **普通电影**: script → clip → video（不变）

## 完成项
- [✅] P1: store.ts — TaskType/OrderStatus 加 viral_learn，IOrder 加 templateSource/videoPath/videoSrtPath/narratorType/modelVersion/learningModelId
- [✅] P2: api/tasks.ts — 新增 fetchCloudFiles() 和 generateViralModel()
- [✅] P3: vite.config.js + nginx.conf — 加 /api/cloud_files 和 /api/viral_learn 代理
- [✅] P4: index.tsx UI — Step 2 自定义电影时渲染云盘文件选择器 + narrator_type/model_version 下拉
- [✅] P5: index.tsx executeWorkflow — 自定义电影创建 viral_learn 任务，普通电影创建 script 任务
- [✅] P6: index.tsx resumeOrderWorkflow — viral_learn 完成后提取 learning_model_id 并创建 script
- [✅] P6b: UI 收尾 — resetWorkflow/确认页/详情页/步骤标题适配 viral_learn
- [✅] P7: note.md 文档更新
- [✅] P8: tsc 编译通过

## 涉及文件
- `src/store.ts` — 类型定义 + 数据模型
- `src/types.ts` — ICloudFile, ICloudFilesResponse, IGenerateViralModelRequest
- `src/api/tasks.ts` — fetchCloudFiles, generateViralModel + tokens
- `src/index.tsx` — UI + 工作流引擎
- `vite.config.js` — 开发代理
- `nginx.conf` — 生产代理
- `note.md` — 文档
