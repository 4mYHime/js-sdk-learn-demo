# 视频解说生成工作流重构

## 任务描述
去掉现有功能，重构为向导式视频解说生成工作流。

## 完成状态
- [✅] 清除现有代码，重构项目结构
- [✅] 配置Vite代理（8个API端点）
- [✅] 创建API模块：电影/模板/BGM/配音/任务
- [✅] 创建TypeScript类型定义
- [✅] 实现Step1：选择爆款电影UI
- [✅] 实现Step2：选择解说模板UI
- [✅] 实现Step3：配置BGM/配音确认UI
- [✅] 实现任务执行流程：文案->剪辑->视频
- [✅] 实现任务状态轮询与结果展示
- [ ] 用户测试验证

## 技术架构
```
src/
├── types.ts              # 类型定义
├── api/
│   ├── movies.ts         # 爆款电影API (rt6xvm5qvr.coze.site)
│   ├── templates.ts      # 解说模板API (y2jtqf58bf.coze.site)
│   ├── bgm.ts            # BGM API (2b7tgw8s7h.coze.site)
│   ├── dubbing.ts        # 配音API (4cnpfpw2q7.coze.site)
│   └── tasks.ts          # 任务执行与状态查询API
└── index.tsx             # 主组件（4步向导UI）
```

## API端点
1. 爆款电影: `/api/movies` → `rt6xvm5qvr.coze.site`
2. 解说模板: `/api/templates` → `y2jtqf58bf.coze.site`
3. BGM数据: `/api/bgm` → `2b7tgw8s7h.coze.site`
4. 配音数据: `/api/dubbing` → `4cnpfpw2q7.coze.site`
5. 生成文案: `/api/script` → `fhwpnktkcp.coze.site`
6. 生成剪辑: `/api/clip` → `wsk44rd4dv.coze.site`
7. 合成视频: `/api/video` → `q77shf4jhf.coze.site`
8. 查询状态: `/api/status` → `fnd4r5gvww.coze.site`

## 工作流程
1. 配置流程（3步）
   - 选择爆款电影
   - 选择解说模板
   - 配置BGM/配音/目标平台

2. 任务执行（串行）
   - 生成解说文案 → 轮询等待完成
   - 生成剪辑脚本 → 轮询等待完成
   - 合成视频 → 轮询等待完成 → 返回视频URL

## 暂不实现
- 视觉模板配置
- 自定义封面/字幕样式
- 阶段式交付
- AI智能场景洞察

## 日期
2026-03-03
