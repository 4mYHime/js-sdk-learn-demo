# Fix36: 任务创建API响应校验

## 问题
外部API创建任务时，如果入参正常但实际资源已失效（如BGM文件被删除），API返回HTTP 200但响应体包含error字段且task_id为空。前端未校验响应，直接用空task_id构造running任务，导致僵尸占位任务（pending, taskId=''）卡在数据库中无法恢复。

## 修复
添加统一校验函数 `validateTaskCreation`：检查响应的 task_id 是否存在，不存在时提取 error/message/error_message 字段抛异常。异常由现有 catch 块统一处理（更新占位任务为error + 设置订单error状态）。

覆盖所有任务创建调用点：
- [✅] resumeOrderWorkflow: 5处（script, clip, video, original_clip, original_clip→video）
- [✅] retryTask: 6处（viral_learn, script, original_script, original_clip, clip, video）
- [✅] resumeErrorOrder: 3处（original_script, viral_learn, script）
- [✅] executeWorkflow: 3处（original_script, viral_learn, script）

## 修改文件
- [✅] `src/index.tsx` - 添加 validateTaskCreation + 17处调用
