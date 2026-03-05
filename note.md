# 整体流程

## 页面流程
1. **登录页** - 输入 `app_key`（格式: `grid_` 开头），验证后进入订单列表。登录的 appKey 用于 localStorage 过滤订单和所有 API 调用
2. **订单列表页** - 显示当前用户所有订单（按创建时间排序），支持创建新订单
3. **创建订单页** - 4步向导：
    - Step 1: 选择爆款电影（API获取电影列表，选中后获得 video_file_id、srt_file_id）
    - Step 2: 选择解说模板（API获取模板列表，自动过滤掉 `learning_model_id=="else"` 的自定义模板，选中后获得 learning_model_id）
    - Step 3: 配置参数
        - 目标平台（抖音/快手/YouTube/TikTok）
        - 主角名称（可选）
        - 选择BGM（API获取BGM列表，获得 bgm_file_id）
        - 选择配音（API获取配音列表，获得 dubbing_id）
        - 厂商要求（可选）
        - 交付模式（分段式交付（默认）/ 一站式交付）
    - Step 4: 确认配置 → 点击开始 → 创建订单+启动任务 → 自动跳转订单详情页
4. **订单详情页** - 显示订单信息和所有子任务进度；分段式交付时在文案/剪辑完成后暂停，展示产物并等待用户确认

## 交付模式
用户在创建订单时可选择交付模式（Step 3 配置页），默认为分段式交付：

- **分段式交付**（默认）：文案和剪辑脚本生成完成后暂停，展示产物文件路径，用户确认后继续下一步
- **一站式交付**：用户只做选择和配置，任务链由系统全自动推进，无需用户干预

分段式交付流程：
```
文案生成 → 完成后暂停（wait_confirm） → 用户查看文案文件路径并确认
     → 剪辑脚本生成 → 完成后暂停（wait_confirm） → 用户查看剪辑文件路径并确认
     → 视频合成 → 完成后自动提取 video_url
```

## 配置流程（完整产品规划）
1. 选择爆款电影
2. 选择解说模板
3. 确认模板与配置
    - 配置解说与视觉模板
        - 配置解说模板（重新选择其他解说模板）
        - 配置视觉模板（暂不做）
    - 自定义封面图、字幕样式、BGM/配音
        - 配置自定义封面、字幕样式（如果前面配置了视觉模板后就不能配置该项）（暂不做）
        - 配置BGM/配音
    - 交付模式与AI高级功能
        - 配置交付模式（分段式交付：已实现（默认）、一站式交付：已实现）
        - 配置AI 智能场景洞察（暂不做）

## 任务流程
以下为完整任务链（分段式交付时文案和剪辑完成后暂停等待确认，一站式则全自动）：

1. 材料上传（配置了爆款电影则可以跳过这步）
    - 目的是拿到文件id file_id，比如视频文件id、字幕文件id等
2. 学习爆款（配置了解说模板则可以跳过这步）
    - 目的是拿到学习模型id learning_model_id，如 narrator-20250924170024-uzgpov6
3. 生成解说文案（已实现）
    - 入参: app_key, learning_model_id, episodes_data(video_file_id, srt_file_id), playlet_name 等
    - 出参: task_id → 轮询完成后获得 task_order_num（如 `generate_writing_xxx`）
    - 分段式：完成后暂停（wait_confirm），展示文案文件路径（task_result），用户确认后继续
    - 一站式：自动发起下一步
4. 生成剪辑脚本（已实现）
    - 入参: app_key, order_num(=上一步的task_order_num), bgm, dubbing 等
    - 出参: task_id → 轮询完成后获得 task_order_num（如 `generate_clip_data_xxx`）
    - 分段式：完成后暂停（wait_confirm），展示剪辑脚本文件路径（clip_data_file），用户确认后继续
    - 一站式：自动发起下一步
5. 合成视频（已实现）
    - 入参: app_key, order_num(=上一步的task_order_num)
    - 出参: task_id → 轮询完成后获得 video_url → 交付完成

## 任务链式衔接逻辑
```
生成文案 → task_order_num → 作为剪辑脚本的 order_num
                              ↓
                        剪辑脚本 → task_order_num → 作为合成视频的 order_num
                                                      ↓
                                                合成视频 → video_url（最终产物）
```

关键数据流:
- 每个任务创建后返回 `task_id`
- 通过 `task_id` + `app_key` 轮询任务状态（10秒/次，最长1小时）
- 任务完成时（`api_response.data.status === 2`）从响应中提取 `task_order_num`
- 该 `task_order_num` 作为下一步任务的 `order_num` 入参
- 视频任务完成后从 `api_response.data.results.tasks[0].video_url` 提取视频链接

## 任务状态判定
- `api_response.data.status === 1` → 进行中
- `api_response.data.status === 2` → 已完成
- `api_response.data.failed_at` 非空 → 失败

## 订单持久化（localStorage）
- 订单数据存储在 `localStorage`，key: `narration_orders`
- 用户登录信息存储在 `localStorage`，key: `narration_user`
- 订单结构 `IOrder`: id, appKey, movieId/Name, templateId/Name, bgmId/Name, dubbingId/Name, targetPlatform, **deliveryMode**(oneStop/staged), status, tasks[], videoUrl, errorMessage
- 任务结构 `ITask`: type(script/clip/video), taskId, orderNum, status, pollCount, elapsedTime, result, createdAt, completedAt
- 订单状态: pending → script → clip → video → done / error
- 任务状态: pending | running | **wait_confirm** | done | error

## 工作流恢复机制
- 进入订单详情页时，自动检测未完成订单
- **有 wait_confirm 任务时不自动恢复**，保持暂停状态等待用户确认
- `resumeOrderWorkflow` 使用 while 循环处理完整链路：
  0. 有 wait_confirm 任务 → 暂停（break）
  1. 有 running 任务 → 继续轮询
  2. 轮询完成后，分段式且为 script/clip → 设为 wait_confirm 并暂停
  3. 无 running 任务但有已完成的前置任务 → 自动创建下一步任务
  4. 所有任务完成 → 提取 videoUrl，标记订单完成
- 用户点击“确认并继续下一步”按钮 → `confirmTask` 将 wait_confirm 改为 done，再调 resumeOrderWorkflow
- 页面离开时通过 `abortRef` 中断轮询，返回后可重新恢复
- 网络错误自动重试3次（指数退避）

## 技术架构
- **框架**: React + TypeScript + Vite
- **UI库**: Ant Design
- **HTTP**: Axios
- **数据持久化**: localStorage
- **API代理**: Vite proxy → coze.site

### 关键文件
- `src/index.tsx` - 主应用组件（页面路由、状态管理、工作流引擎）
- `src/store.ts` - 订单持久化模块（IOrder/ITask定义、CRUD操作）
- `src/types.ts` - 类型定义（IMovie、INarratorTemplate、IBGM、IDubbing等）
- `src/api/tasks.ts` - 任务API（生成文案/剪辑/视频、轮询状态）
- `src/api/movies.ts` - 电影列表API
- `src/api/templates.ts` - 模板列表API
- `src/api/bgm.ts` - BGM列表API
- `src/api/dubbing.ts` - 配音列表API
- `vite.config.js` - Vite配置（API代理规则）

## API 接口
1. 获取爆款电影素材
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419507773e0.md

curl
curl --location --request POST 'https://rt6xvm5qvr.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInJJSFJDY0VHdGJLMzh4ZTBhRUdXSW5ldTZzMHVsdDFSIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyNzM3LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1OTg3NjA0MjA2NzgwNDQyIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI0NTk2MTM5NTI0MTA2In0.kea_PBL5obu6dsWwJSgvJ6V7TIIGRNbcfbieblHXv-HbC0ZItYijcFMH4a5H4ODco0ovgR8v7i714b6Vcu-C1FDvBenosUeVyJlbhee9x_sgJ_0COVRD7Kt_MWZmqPJ1M1eRQiyEeeJCl8aPPgFpP0ky1e_VkEWW8nIeTpCH0VF40E0KIJG1lqnfTnrix1BTQnDRXEUVDkxQHb2i_dgM2PehBpMfSKzS7JC-Ark9GJCC-NIwCsjb1TiXRw7UQ3U6OIWQc-tQAzGnzO8rfGg6ECpDaSKysBCfioxCYyJxuJMGhkyniUPkcDpiuu1O8gI_pTmE-TCxjudUmNv1tnU5cA' \
--header 'Content-Type: application/json' \
--data-raw '{"api_key":"grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe"}'

响应
{"found":true,"query_result":[{"id":9,"name":"西虹市首富(已下架)","video_file_id":"ce478a49-4aed-4ab6-a655-b4e28453c1a6","srt_file_id":"9597f519-5ed7-4280-a398-c91ce79ada2bsss","type":"喜剧片","status":"1","story_info":"西虹市丙级球队大翔队的守门员王多鱼（沈腾 饰）因比赛失利被教练开除，一筹莫展之际王多鱼突然收到神秘人士金老板（张晨光 饰）的邀请，被告知自己竟然是保险大亨王老太爷（李立群 饰）的唯一继承人，遗产高达百亿！但是王老太爷给出了一个非常奇葩的条件，那就是要求王多鱼在一个月内花光十亿，还不能告诉身边人，否则失去继承权。王多鱼毫不犹豫签下了“军令状”，与好友庄强（张一鸣 饰）以及财务夏竹（宋芸桦 饰）一起开启了“挥金之旅”，即将成为西虹市首富的王多鱼，第一次感受到了做富人的快乐，同时也发现想要挥金如土实在没有那么简单！","cover":"https://preview.jufenqian.top/coze/movie_cover/西虹市首富.png","character_name":null,"remark":"中国"},{"id":143,"name":"这个杀手不太冷","video_file_id":"37d5331b-d772-4bdf-b394-df8e8102205c","srt_file_id":"23bdfa4b-0ab3-4d90-8977-076286f5f681","type":"剧情片","status":null,"story_info":"里昂（让·雷诺饰）是名孤独的职业杀手，受人雇佣。一天，邻居家小姑娘马蒂尔达（纳塔丽·波特曼饰)敲开他的房门，要求在他那里暂避杀身之祸。原来邻居家的主人是警方缉毒组的眼线，只因贪污了一小包毒品而遭恶警（加里·奥德曼饰）杀害全家的惩罚。马蒂尔达得到里昂的留救，幸免于难，并留在里昂那里。里昂教小女孩使枪，她教里昂法文，两人关系日趋亲密，相处融洽。\n女孩想着去报仇，反倒被抓，里昂及时赶到，将女孩救回。混杂着哀怨情仇的正邪之战渐次升级，更大的冲突在所难免……","cover":"https://preview.jufenqian.top/coze/movie_cover/这个杀手不太冷.png","character_name":null,"remark":null},{"id":152,"name":"人生一世","video_file_id":"3dfc2aee-141e-4e47-bec0-536802985dda","srt_file_id":"62a9bc8a-346e-4ae1-98d2-02e4a23b10c0","type":"剧情片","status":null,"story_info":"本片根据罗伯特·塞瑟勒的全球畅销小说改编。20世纪初，幼孤安德烈亚斯被送至偏远山谷中的农场，与冷酷无情的叔叔同住。在18岁那年，他鼓足勇气逃离，成为了一名樵夫。安德烈亚斯用积攒的钱租赁了一间山中小屋，并遇见了玛丽，他的生命之光。然而，安德烈亚斯无奈地被征召入伍，加入了德国国防军，在几乎没有胜算的情况下奔赴前苏联前线。当安德烈亚斯历经战火洗礼归来时，世界已面目全非。","cover":"https://preview.jufenqian.top/coze/movie_cover/人生一世.png","character_name":null,"remark":null}],"run_id":"c81dcc1a-ca0a-492e-a9c2-78c96c9b1d3b"}


2. 获取解说模板
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419471551e0.md

curl
curl --location --request POST 'https://y2jtqf58bf.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInhvOEFnWll6OXNwU2xEWjFTZ0owNnJDNXdTQWpudVNuIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyODIxLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1ODEzODExMTQ0MzU5OTYzIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI0OTYwNjgzMjYxOTY3In0.WunAsGHKWQCYqpRzvjQxoy5ETV1u2aEsSrL7xtVb54H7bgv7UktPJCf8BPta-XCKLHA5uqxpR7xo0B0JQgDyjEDFNkzfFeU3XshokqWmWAIp91T6wlhBX-_j0xkAe2bUZTjaRN3KS4q9oT0aJzHOe0MiO_KJ8Vcq2MyKvo0r786x5uauIoasg_8bPiHDVIoJHcsfT7x3XwysUCnVQRNd5aO-ofPYultEZ_odUQ5oi2JBEtbAHEVoPwIT-SKt2Y75VaXknD7_-Yq5V25kwKyot9wYCWKzXFccsuJDiAgeDnLKf0sNOWRMU36kMGa8-eAPrKjE1RXys1SRf4R70KA0XA' \
--header 'Content-Type: application/json' \
--data-raw '{
    "narrator_type": "movie"
}'

响应
{"found":true,"query_result":[{"id":65,"code":null,"name":"自定义","learning_model_id":"else","info":"else","remark":"else","type":"11","narrator_type":null,"name_time":"自定义","time":null,"model_version":null,"language":null,"tags":null,"img":null,"like":null,"share":null,"messages":null,"stars":null,"profit":null,"slug_img":null,"link":null,"collection_time":null},{"id":66,"code":null,"name":"自定义","learning_model_id":"else","info":"else","remark":"else","type":"22","narrator_type":null,"name_time":"自定义","time":null,"model_version":null,"language":null,"tags":null,"img":null,"like":null,"share":null,"messages":null,"stars":null,"profit":null,"slug_img":null,"link":null,"collection_time":null},{"id":67,"code":null,"name":"自定义","learning_model_id":"else","info":"else","remark":"else","type":"33","narrator_type":null,"name_time":"自定义","time":null,"model_version":null,"language":null,"tags":null,"img":null,"like":null,"share":null,"messages":null,"stars":null,"profit":null,"slug_img":null,"link":null,"collection_time":null},{"id":88,"code":"xy0046","name":"热血动作-困兽之斗解说","learning_model_id":"narrator-20250916152104-DYsban","info":"动作、生存、智斗、暴力、困境","remark":"动作片 ,外语解说","type":"33","narrator_type":"多语种电影解说","name_time":"热血动作-困兽之斗解说(英语,时长2:10)","time":"2:10","model_version":null,"language":"英语","tags":"TikTok,动作科幻","img":"https://preview.jufenqian.top/coze/narrator_template_images/热血动作-困兽之斗解说_img.jpeg","like":"8212","share":"1876","messages":"539","stars":"2211","profit":"439.06","slug_img":"https://preview.jufenqian.top/coze/narrator_template_images/热血动作-困兽之斗解说_slug.jpeg","link":"链接: https://pan.baidu.com/s/1wShibx6Uf3untmtrMKVYTQ?pwd=hj1f 提取码: hj1f","collection_time":"2025-10-27"},{"id":89,"code":"xy0063","name":"烧脑悬疑-栽赃陷害解说","learning_model_id":"narrator-20250916152053-nBcHXC","info":"阴谋、悬疑、背叛、逃亡、博弈","remark":"动作片 ,外语解说","type":"33","narrator_type":"多语种电影解说","name_time":"烧脑悬疑-栽赃陷害解说(英语,时长1:11)","time":"1:11","model_version":null,"language":"英语","tags":"TikTok,悬疑惊悚","img":"https://preview.jufenqian.top/coze/narrator_template_images/烧脑悬疑-栽赃陷害解说_img.jpeg","like":"52000","share":"273","messages":"324","stars":"217","profit":"818.12","slug_img":"https://preview.jufenqian.top/coze/narrator_template_images/烧脑悬疑-栽赃陷害解说_slug.jpeg","link":"链接: https://pan.baidu.com/s/132GZquSzjSstBnJXdLQOEg?pwd=uv7a 提取码: uv7a","collection_time":"2025-11-10"},{"id":90,"code":"xy0033","name":"励志成长-师生情谊解说","learning_model_id":"narrator-20250918141539-NnpZlD","info":"励志、成长、教育、师生情、救赎","remark":"励志,第三人称","type":"11","narrator_type":"第三人称电影","name_time":"励志成长-师生情谊解说(时长5:01)","time":"5:01","model_version":null,"language":"中文","tags":"抖音,剧情情感","img":"https://preview.jufenqian.top/coze/narrator_template_images/励志成长-师生情谊解说_img.jpeg","like":"5736","share":"511","messages":"637","stars":"841","profit":"200.4","slug_img":"https://preview.jufenqian.top/coze/narrator_template_images/励志成长-师生情谊解说_slug.jpeg","link":"链接: https://pan.baidu.com/s/1aQgg-mwqmCkhWgVaUB968g?pwd=e4di 提取码: e4di","collection_time":"2025-10-13"}],"run_id":"7090075c-9343-4906-81fc-580db3cd3f32"}

3. 获取视觉模板
出餐入参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419383591e0.md

curl
curl --location --request POST 'https://p4tkdt2r4d.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImRzcFF0VXNZa2o5bUxQQ09Kc2lRa3dOZkFtN3hyTkRLIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQzMTY1LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjQ2MTQ1NTEwOTY1Mjc0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI2NDM1NDA0NzQyNzA3In0.ZfSbe43dAo8PvXLVAORtZYIjjXvoxPeN6cNSkfFIi35Dj6EC5kqiyPF16QwV22lxwXh4YCRDwMiBkXiO0UzZBedJMx1uKyRIyR6oLTZQRE3kx2LgYR1TF4oUFHOs5e0fvAigLiUdrJiyuSsmJlMHZbmlDMWj8bymu460CvMPYN54NFSkVXnsOeREzs1kqIt1NlcatrKIW2DtAQU4wiQHKHEMbnWFcdZXV9CjwD14oD6x-A8u3x3lb1P4gTcRFR2SULdb_To-QCUoBQVoau5KVaYnulUw85DWVQZIrwqrhLJAbQmHRM2aGHBazoM7JgcIjQ4u4qfnTJFIjYOH8e8j9A' \
--header 'Content-Type: application/json' \
--data-raw '{"app_key":"grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe"}'

响应
{"tags_data":{"code":10000,"message":"success","data":{"data":{"油管":{"9:16 垂直":["竖屏·合规剧集","竖屏·柔光剧集","竖屏·模糊剧集","竖屏·简约剧集","竖屏·黑金剧集"],"16:9 水平":["横屏·沉浸剧集","横屏·电影剧集","横屏·简约剧集"]},"抖音":{"1:1 矩形":["方屏·简约剧集","方屏·雅致剧集"],"16:9 水平":["横屏·手绘剧集"],"9:16 垂直":["竖屏·流光剧集"],"3:2 水平":["横屏·黑条剧集"]},"油管短视频":{"9:16 垂直":["竖屏·精准剧集","竖屏·重磅剧集"]}}}},"run_id":"c596f9a6-12c5-4107-b910-fea179cef75b"}

4. 获取BGM数据
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419448089e0.md

curl
curl --location --request POST 'https://2b7tgw8s7h.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIlRwSk9ENDdvUzNpVzh2VjBtS1Vhbjl0WWRRSDdxRlZ2Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyODU1LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1ODAzNzI2MzY3ODgzMjc0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI1MTA0MzM0MzA3Mzc4In0.G60E-5lJUIEw65hCCvw1woNCTAakvn82fv0untgQYxBYGDVNO4VivYoZTaEBuiZCo14JsjS1pAsjhM17HuELqDsHzvg0najLGs8SD3LbjeflAEJcNVgYlZ1GltXujgyYjPD5QxsmjDn4tUWHAFdUC7ldWFoVuNAJqpwWKd_5VKEfKJacW2OfOhKI4nfO7gZ96qk4damkmjly1d8Hnj5JCS_0AysufCbXXeNys2uc_iNyhEqxhiUXJQIZhWGAOrbZmN3GoaJZGH8xykFC2yVdLFvvngXmisruLTKKvL7Iag1rnAHVL18FSwYE5P_ykU7CuL7AQge-L29aTs15BV7ziQ' \
--header 'Content-Type: application/json' \
--data-raw '{}'

响应
{"found":true,"query_result":[{"id":4,"name":"Call of Silence","bgm_file_id":"5527b36b-3f96-47ee-a819-ada7b2298907","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/Call of Silence.mp3","type":null,"tag":"抒情,弦乐,史诗","description":"这是一首情绪沉静深沉、节奏舒缓却暗含力量的弦乐抒情配乐，旋律中带着压抑的厚重感。适合战争片、科幻灾难片、人性刻画类剧情片，尤其适合主角在绝境中直面内心抉择、经历残酷洗礼后陷入沉默反思的场景，如末世求生后的喘息、战争结束后的废墟凝望、角色背负沉重宿命的独处时刻。适配悲壮感人、史诗震撼、沉郁反思的解说文案情绪，参考案例为《进击的巨人》，适配理由是该曲贴合作品中角色在残酷生存环境下的挣扎与沉默的宿命感。"},{"id":5,"name":"Anacreon","bgm_file_id":"0597d458-ae36-44b5-9906-2241af888754","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/Anacreon.mp3","type":null,"tag":"nan","description":"nan"},{"id":6,"name":"Sold Out","bgm_file_id":"e3c21731-e786-4fe7-8e23-72bcdb31d428","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/Sold Out.mp3","type":null,"tag":"nan","description":"nan"},{"id":7,"name":"Time Back","bgm_file_id":"d710d6ee-e261-4091-a8e0-6235912cd222","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/Time Back.mp3","type":null,"tag":"励志,钢琴,电子","description":"这是一首融合钢琴与电子元素的纯音乐，情绪温暖励志，节奏由舒缓渐至激昂。适合励志片、动作片、成长类电影，尤其适合主角历经挫折后逆袭、为目标全力冲刺、突破自我极限的剧情场景，适配热血激昂、温暖治愈、充满力量的解说文案情绪。参考案例：《当幸福来敲门》，适配主角在绝境中坚持最终迎来转机的核心剧情与情绪。"},{"id":8,"name":"丧尽","bgm_file_id":"addabcc5-e148-404a-80d5-ee062b7b1b96","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/丧尽.mp3","type":null,"tag":"暗黑,电子,悬疑","description":"这是一首情绪压抑暗沉的慢节奏暗黑电子器乐作品，节奏紧绷，充满悬疑感。适合悬疑片、恐怖片、犯罪片，尤其适合处理主角陷入危机、真相即将揭开前的铺垫、反派暗中布局的剧情场景，营造紧张压抑、诡谲惊悚的情绪氛围。适配悬疑烧脑、紧张凝重、暗黑诡异的解说文案情绪，参考案例为《七宗罪》，适配理由是其暗黑压抑的调性与影片中连环凶杀案的诡谲氛围高度契合。"},{"id":9,"name":"River Flows in You","bgm_file_id":"065b0fbb-16f3-4b5e-a326-e05279eb7fc3","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/River Flows in You.mp3","type":null,"tag":"治愈,钢琴,抒情","description":"这是一首温暖治愈的纯钢琴BGM，节奏舒缓柔和，旋律流畅细腻。适合爱情片、青春片、治愈系文艺片，尤其适合主角独处沉思、旧物触发回忆、久别重逢的温情场景，或是展现细腻内心活动、平淡日常里的小美好、爱情里的懵懂悸动的剧情。适配温馨治愈、浪漫唯美、平静舒缓的解说文案情绪，参考案例《情书》，适配理由：契合影片中通过书信唤起青涩回忆、细腻含蓄的温情氛围。"},{"id":10,"name":"城南花已开","bgm_file_id":"57f28e03-5a17-4994-b283-1edd8ea5ff6a","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/城南花已开.mp3","type":null,"tag":"治愈,纯音,温暖","description":"这是一首节奏舒缓轻柔的治愈系纯音乐，核心情绪温暖平静，旋律带着淡淡的慰藉感。适合治愈系剧情片、家庭温情片、青春文艺片，尤其适合主角经历低谷后获得慰藉、亲人朋友间的温情陪伴、少年人面对离别与成长的剧情场景，适配温暖治愈、温柔慰藉、平静释然的解说文案情绪，参考案例《海蒂和爷爷》，适配理由：贴合影片中山间治愈的氛围与祖孙间温暖的情感互动"}],"run_id":"5adf5781-ae04-4305-8106-49e21b85b4c2"}

5. 获取配音数据
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419447512e0.md

curl
curl --location --request POST 'https://4cnpfpw2q7.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImN1SnY2RzU4OXJWWVB6R0hmYUlQWG01RmtObDdEcU9QIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyODc0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NzgzNjMwOTQ5OTA4NTE4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI1MTg0OTAyMzY1MjM1In0.YRbBa1opvvE8iWPjd_ApI8XqBRxQZ3mDpgh4hoH8ef4s4QOrp-R2Wh5Sez4T7X209_4nS8RxyBbTvcaA8mJ9shyKxK6Ix85os9wyY440MvviOHt8CQsoE4ymqDKYcNLHXZiYpWL-GU480Wi08nvNlq95T587dHMvIYN-62ttvNnvD36SdBEjojxAy578hpxmTlNwnWvJHd6cFXf1F8XqTIjJpGy_AU2q3gIbjiJ4mcjhofd0FZETEfWGc2iG7eQiZtPua7EGbO8hItM2fWLT45py9HrdqCfCPAZpm_Tfj0IIhP77RyEvFSojjC48qqKIus9QcemvU7UZ2eL1seLceg' \
--header 'Content-Type: application/json' \
--data-raw '{}'

响应
{"found":true,"query_result":[{"id":4,"name":"人生大事-莫三妹","dubbing_id":"MiniMaxVoiceId17","role":"朱一龙","status":null,"language":"普通话","info":null,"dubbing_demo_url":"https://preview.jufenqian.top/coze/dubbing_demo/朱一龙2.mp3","sort":null},{"id":5,"name":"霸王别姬-程蝶衣","dubbing_id":"MiniMaxVoiceId02586","role":"张国荣","status":"是","language":"普通话","info":null,"dubbing_demo_url":"https://preview.jufenqian.top/coze/dubbing_demo/程蝶衣.mp3","sort":null},{"id":6,"name":"夏洛特烦恼-夏洛","dubbing_id":"MiniMaxVoiceId06082","role":"沈腾","status":null,"language":"普通话","info":null,"dubbing_demo_url":null,"sort":null},{"id":7,"name":"无人生还","dubbing_id":"MiniMaxVoiceId07366","role":"克莱索恩配音","status":null,"language":"普通话","info":null,"dubbing_demo_url":null,"sort":null},{"id":8,"name":"酱园弄-詹周氏","dubbing_id":"MiniMaxVoiceId10985","role":"章子怡","status":"是","language":"普通话","info":null,"dubbing_demo_url":"https://preview.jufenqian.top/coze/dubbing_demo/章子怡配音.mp3","sort":null}],"run_id":"dfc4602b-6fb5-4356-9bda-d86118412650"}


6. 生成文案
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419336269e0.md

curl
curl --location --request POST 'https://fhwpnktkcp.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImJLbzZDMlhyZUVVaHV2MlJjZUFjeVdCRVVpRmNTOXZkIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NjkyLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg2NTE0NzA3MzgyMzE4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MjkxNTQ2OTUxNzM0In0.epCcMf-RdTqZ8r4jW281AkDr_dpqtIHfXn68q3XmZ2r4s8zlCSiB5t-JZDwNTvO4Ao-vGb7nIHFsusxR6o_Qf_c1a0ficIydnRoE9zZk4CIg89UiVPHk-k4PtcCQDp9c_hUT6QUW2Zanx7ZDWf_IZ9-C50O0IlASi4lo53I7flOFpQxHcwCrQy4ikamVk5Hhs4uvqcOzbynNmlGSwlOIi9nYAJ_59y_kywWI8jT1guflrrtv-oCsG91QpslBSMNZY1KSG5Q5Wly4HSJnIirPboc25giAFY0mF37yXwiW1pLvNEQTGdQwD9sZY2NDzXC-CUiDJcEZdbVZE_HJKFeRYw' \
--header 'Content-Type: application/json' \
--data-raw '{
    "app_key": "grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe",
    "learning_model_id": "narrator-20250918141539-NnpZlD",
    "episodes_data": [
        {
            "num": 1,
            "srt_oss_key": "4c2d2a58-0050-4841-9cce-7beb2f6db981",
            "video_oss_key": "2baebc50-527c-4bd6-88fe-58a8830d1644",
            "negative_oss_key": "2baebc50-527c-4bd6-88fe-58a8830d1644"
        }
    ],
    "playlet_name": "师父",
    "playlet_num": "1",
    "target_platform": "抖音短视频平台",
    "task_count": 1,
    "target_character_name": "主角名",
    "refine_srt_gaps": 0,
    "vendor_requirements": "投放在抖音短视频平台，吸引 18 - 35 岁的年轻用户观看。",
    "story_info": ""
}'

响应
{
    "task_id": "9d3248a7a64241f5901d35bb3041b40b",
    "run_id": "216676af-c7e7-48f1-b1e3-96c18e847f48"
}


7. 生成剪辑脚本
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419336410e0.md

curl
curl --location --request POST 'https://wsk44rd4dv.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInpLNGNRTnFGSGhNZXNMc25HcnU0enBMVWp3MTdwanBxIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NzA2LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg3MjMwMjgwODEwNTIzIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MzQ5MTAxMTkxMjIyIn0.IFRfn3Q1FZhIhDpwmVtW9whN_s3_96vUsdsi_EopR1eU9Ef-9LLBFZC_gnp1IZF65l9TYnFNoZnHVzItlJOsiX5eT6rSnUjOo_481tvqWCD7wp2CULrwvt_cCld0K1B0ye4vGFOZrHkOFUuYXXHDf80onStoJVLJqnqrSgHWwu3ODbbVoSb8tKBag6nHSgftlpo67jiTuqICQGM0oH7xuw0oFjXAWeddpBzp74KWaADlAOTZjeMVWd6OqCbBS6mb4dlH5BJcXxHSMwyK1rXxm7tNeqmYxKx60bfFHWGX1iie-3e9Se3MBmZnIHPPmGcXgSwsCGWooECtrN3KqJpGzQ' \
--header 'Content-Type: application/json' \
--data-raw '{
    "app_key": "grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe",
    "bgm": "71d56c6e-e713-429d-93f7-15a6329c4b44",
    "dubbing": "MiniMaxVoiceId15553",
    "dubbing_type": "default",
    "order_num": "generate_writing_814fbe52_b375ee",
    "subtitle_style": {
        "shadow": null,
        "outline": null,
        "fontname": null,
        "fontsize": null,
        "margin_l": null,
        "margin_r": null,
        "margin_v": null,
        "alignment": null,
        "back_colour": null,
        "border_style": null,
        "outline_colour": null,
        "primary_colour": null
    },
    "custom_cover": ""
}'

响应
{
    "task_id": "31af7e9332b84dd293a9c7e7c8c9e47f",
    "run_id": "d0364794-8d57-4b54-85a3-e874b0cd4098"
}


8. 合成视频
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419334803e0.md

curl
curl --location --request POST 'https://q77shf4jhf.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIll4dTVoNlFpNGJVSHlXb3FVNHpBSWxRQmdLSkVmOFhQIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NzIwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg3NDk1NjYyODEzMjM1Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3NDExMzQ0NjYyNTYyIn0.S3ZV9ii3RlYtmepzYLcEl6yKtxlu1b3FcRW3Ov2fwCbAKuz48W_SCv0nLE9VDi0xiuzZPmNc8S0Ly0_kRi_YQ-G2zQszQgXwMoNRdqjvZ-Y9oWzG2r3vSwHfn1bA4rwnOjo_EkLlSTpPw7Xva8VLwCTiyCMNjR3EOqPhSTgsES0FnO5q-4piukc21U5Q6rnWPAbDirpYnmLehkdOGSX3p8VQBsdjwyv-fd5f5EvGD_4vDf-5qEJ3rtSM8mO7ENjcli9u3Astk9c6muAIgx7s6gb4ftcuGHSkY8vlTRKHyGr48OKVZbUbLnp6XpzXpvq31Jz9sYhuhZ6mvhNZzTonKQ' \
--header 'Content-Type: application/json' \
--data-raw '{
    "order_num": "generate_clip_data_6cc38a08_a7ab3b",
    "app_key": "grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe"
}'


响应
{
    "task_id": "0c70c537ebe048b98597a63065b36b6f",
    "run_id": "1690612d-c1ae-4f3c-8faa-c07ad985df52"
}

9. 查询任务状态
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/422271719e0.md

curl
curl --location --request POST 'https://fnd4r5gvww.coze.site/run' \
--header 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ4NGRmNDgwLTEyOTItNGFjZS1iYzc5LTVmNjU1NDU0NmY0NyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIldvVGVJNmg2d3hDeWppMnlXdkFNTFVTa25EWTBEbE9mIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyNTMwNTY0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjEyNTY4MzA5MTExNzE3OTM5Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjEyOTYwODAzOTM0Njk5NTU0In0.ZwdBVVxEK6stReZs75TgCwDYfOvajB-OrsFL7gNUZbdTkkPZEEA707tcCMB2T1O08ExmkRkE5cafLsU99HdZGunyjNYsqm_BCX43csA1rF3jjhznHz9aHfjMIQJBUuHchrkVajcTATBFk77ifm2OJ7hnjkiAKKPJ_UzZNhTfOnylmINsXCJoLbBX3SXIUKv4CqA1kX4SbXuEVt21u9e1vbncB4qRyIVWbJVkQt9xduvXLG2odwWlTDLhoSBGrSq_Z_Y5lOymkCWJ9wKNP0IQZr9JTXiLfTyet6FQyjQTU_pedSGUW3rIW5kGEPrnHff1Nt8mpQPboMjBicrHPGS__Q' \
--header 'Content-Type: application/json' \
--data-raw '{
    "task_id": "9d3248a7a64241f5901d35bb3041b40b",
    "app_key": "grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe"
}'

响应-生成文案-未完成，api_response.data.status=1
{"is_success":true,"response_message":"success","api_response":{"code":10000,"message":"success","data":{"task_id":"349e548ebb06489a9694acaeb5c8ccbc","task_order_num":"generate_writing_349e548e_7b8147","category":"commentary","type":2,"type_name":"generate_writing","status":1,"results":{"code":"None","data":{"order_num":"script_69a6a7fa_waCKiv","task_count":1,"created_task_ids":[148782]},"status":"success","details":null,"message":"成功创建 1 个解说生成任务","timestamp":1772529660,"error_code":null,"failed_count":null,"error_details":null},"consumed_points":120.0,"duration_consumed_points":0.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-03T17:21:01","completed_at":null,"failed_at":null,"created_at":"2026-03-03T17:21:01","updated_at":"2026-03-03T17:21:01"}},"run_id":"b6419e2a-3e2e-468e-a009-f1b1fae3866c"}

响应-生成文案-已完成，api_response.data.status=2
{"is_success":true,"response_message":"success","api_response":{"code":10000,"message":"success","data":{"task_id":"814fbe52e1b84fef94ecdf5053221e9f","task_order_num":"generate_writing_814fbe52_b375ee","category":"commentary","type":2,"type_name":"generate_writing","status":2,"results":{"tasks":[{"id":136673,"status":9,"video_url":"","project_zip":"","task_result":"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260302/script_t_136673_avEdph/师父解说文案.txt","result_oss_key":""}],"order_info":{"step":"commentary_generation","status":10000,"order_num":"script_69a55638_VutEUc","task_type":1,"timestamp":1772443696}},"consumed_points":120.0,"duration_consumed_points":0.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-02T17:19:55","completed_at":"2026-03-02T17:28:17","failed_at":null,"created_at":"2026-03-02T17:19:55","updated_at":"2026-03-02T17:28:17"}},"run_id":"83b8ea7d-e95a-4893-901f-3e46facff2c4"}

响应-生成剪辑脚本-未完成，api_response.data.status=1
{"is_success":true,"response_message":"success","api_response":{"code":10000,"message":"success","data":{"task_id":"31af7e9332b84dd293a9c7e7c8c9e47f","task_order_num":"generate_clip_data_31af7e93_bc88e4","category":"commentary","type":6,"type_name":"generate_clip_data","status":1,"results":{"code":"None","data":{"task_id":null,"order_num":"39c5c43eb38c0a33c17c5651c23427f6","total_tasks":1,"synthesis_results":[{"status":"started","message":"视频合成任务创建成功","task_id":148784,"commentary_task_id":136673}]},"status":"success","details":null,"message":"已创建 1 个新的视频合成任务，新订单号: 39c5c43eb38c0a33c17c5651c23427f6","timestamp":1772529999,"error_code":null,"failed_count":null,"error_details":null},"consumed_points":56.0,"duration_consumed_points":56.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-03T17:26:40","completed_at":null,"failed_at":null,"created_at":"2026-03-03T17:26:40","updated_at":"2026-03-03T17:26:40"}},"run_id":"e7bb9bf9-eb3b-4903-9086-405d69440285"}


响应-生成剪辑脚本-已完成，api_response.data.status=2
{"is_success":true,"response_message":"success","api_response":{"code":10000,"message":"success","data":{"task_id":"6cc38a08dfac47e59f034e10504c52b0","task_order_num":"generate_clip_data_6cc38a08_a7ab3b","category":"commentary","type":6,"type_name":"generate_clip_data","status":2,"results":{"tasks":[{"id":136676,"status":9,"video_url":"","project_zip":"","task_result":"{\"clip_data_file\": \"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260302/script_69a55638-70c99893843248d2/t_136676_172928_6xRK/clipsData.json\"}","result_oss_key":"","clip_data_file_id":"b5f1cea88e7f426c8e80c96468f45b0d"}],"file_ids":["b5f1cea88e7f426c8e80c96468f45b0d"],"order_info":{"status":10000,"order_num":"022ba96e2d15b676877f054bbbaef170"}},"consumed_points":56.0,"duration_consumed_points":56.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-02T17:29:29","completed_at":"2026-03-02T17:53:07","failed_at":null,"created_at":"2026-03-02T17:29:29","updated_at":"2026-03-02T17:53:07"}},"run_id":"64590f76-a571-4715-a5de-5fcc978ea735"}

响应-生成视频-已完成，api_response.data.status=2
{"is_success":true,"response_message":"success","api_response":{"code":10000,"message":"success","data":{"task_id":"0c70c537ebe048b98597a63065b36b6f","task_order_num":"video_composing_0c70c537_c157e0","category":"commentary","type":3,"type_name":"video_composing","status":2,"results":{"tasks":[{"id":148787,"status":9,"video_url":"https://oss.jufenqian.top/video-clips-data/20260303/t_148787_174045_8Ppg/output.mp4","project_zip":"video-clips-data/20260303/t_148787_174045_8Ppg/tracks.zip","task_result":"{\"clip_data_file\": \"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260302/script_69a55638-70c99893843248d2/t_136676_172928_6xRK/clipsData.json\"}","result_oss_key":"video-clips-data/20260303/t_148787_174045_8Ppg/output.mp4","video_url_file_id":"9bde113634ca4780ae0379232fe92129","project_zip_file_id":"d0520cfe64544bd39f008e5b50d727cc"}],"order_info":{"step":"clip_stage2_timeline","status":10000,"order_num":"clip_1772530293_b70aafb5","task_type":1,"timestamp":1772531183},"callback_data":{"step":"clip_stage2_timeline","tasks":[{"id":148787,"status":9,"video_url":"https://oss.jufenqian.top/video-clips-data/20260303/t_148787_174045_8Ppg/output.mp4","project_zip":"video-clips-data/20260303/t_148787_174045_8Ppg/tracks.zip","task_result":"{\"clip_data_file\": \"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260302/script_69a55638-70c99893843248d2/t_136676_172928_6xRK/clipsData.json\"}","result_oss_key":"video-clips-data/20260303/t_148787_174045_8Ppg/output.mp4","video_url_file_id":"9bde113634ca4780ae0379232fe92129","project_zip_file_id":"d0520cfe64544bd39f008e5b50d727cc"}],"order_num":"clip_1772530293_b70aafb5","task_type":1,"timestamp":1772531183,"webhook_data":"{'webhook_data': None, 'task_id': '0c70c537ebe048b98597a63065b36b6f', 'task_order_num': 'video_composing_0c70c537_c157e0', 'webhook_url': '', 'webhook_token': ''}"}},"consumed_points":40.0,"duration_consumed_points":40.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-03T17:31:36","completed_at":"2026-03-03T17:46:23","failed_at":null,"created_at":"2026-03-03T17:31:36","updated_at":"2026-03-03T17:46:23"}},"run_id":"71dc76e2-818a-448f-a028-3094784959c0"}

响应-生成视频-未完成，api_response.data.status=1
{"is_success":true,"response_message":"success","api_response":{"code":10000,"message":"success","data":{"task_id":"82cd5493b2c34a60b6fdc2dfc2891982","task_order_num":"video_composing_82cd5493_b27e72","category":"commentary","type":3,"type_name":"video_composing","status":1,"results":{"code":"None","data":{"task_id":null,"order_num":"clip_1772532324_e7d2b589","synthesis_results":null},"status":"success","details":null,"message":"已创建并发起 1 个视频剪辑任务","timestamp":1772532326,"error_code":null,"failed_count":null,"error_details":null},"consumed_points":40.0,"duration_consumed_points":40.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-03T18:05:27","completed_at":null,"failed_at":null,"created_at":"2026-03-03T18:05:27","updated_at":"2026-03-03T18:05:27"}},"run_id":"fbb1d413-889e-4872-91d2-dfa05fee55af"}


