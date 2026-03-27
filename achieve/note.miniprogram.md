# 整体流程

## 页面流程
1. **登录页** - 输入 `app_key`（格式: `grid_` 开头），验证后进入订单列表。登录的 appKey 用于 localStorage 过滤订单和所有 API 调用
2. **订单列表页** - 显示当前用户所有订单（按创建时间排序），支持创建新订单
3. **创建订单页** - 4步向导：
    - Step 1: 选择爆款电影（API获取电影列表，选中后获得 video_file_id、srt_file_id）
    - Step 2 (普通电影): 选择解说模板（API获取模板列表，选中后获得 learning_model_id）
    - Step 2 (自定义电影): 配置爆款模型（从云盘选SRT文件/视频文件 + 解说类型 + 模型版本）
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


## 任务流程
以下为完整任务链（分段式交付时文案和剪辑完成后暂停等待确认，一站式则全自动）：

1. 材料上传（配置了爆款电影则可以跳过这步）
    - 目的是拿到文件id file_id，比如视频文件id、字幕文件id等
2. 生成爆款模型（已实现，选择“自定义”电影时触发，选了现有模板则跳过）
    - 目的是拿到学习模型id learning_model_id，如 narrator-20260305202540-ZyxROW
    - 入参: app_key, video_srt_path(必需), video_path(可选), narrator_type(必需), model_version(必需)
    - 出参: task_id → 轮询完成后从 `results.order_info.learning_model_id` 提取模型ID
    - narrator_type 可选值: 电影/短剧/第一人称电影/多语种电影/第一人称多语种
    - model_version 可选值: advanced(高级版)/standard(标准版)/strict(结构严格版)
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
[自定义电影] 生成爆款模型 → learning_model_id → 作为生成文案的 learning_model_id
                                                    ↓
生成文案 → task_order_num → 作为剪辑脚本的 order_num
                              ↓
                        剪辑脚本 → task_order_num → 作为合成视频的 order_num
                                                      ↓
                                                合成视频 → video_url（最终产物）
```

关键数据流:
- 每个任务创建后返回 `task_id`
- 通过 `task_id` + `app_key` 轮询任务状态（10秒/次，最长1小时）
- 任务完成时（`data.status === 2`）从响应中提取 `task_order_num`
- 该 `task_order_num` 作为下一步任务的 `order_num` 入参
- 视频任务完成后从 `data.results.tasks[0].video_url` 提取视频链接

## 任务状态判定
- `data.status === 1` → 进行中
- `data.status === 2` → 已完成
- `data.failed_at` 非空 → 失败

## 订单持久化（localStorage）
- 订单数据存储在 `localStorage`，key: `narration_orders`
- 用户登录信息存储在 `localStorage`，key: `narration_user`
- 订单结构 `IOrder`: id, appKey, movieId/Name, templateId/Name, bgmId/Name, dubbingId/Name, targetPlatform, **deliveryMode**(oneStop/staged), **templateSource**(existing/generate), videoPath, videoSrtPath, narratorType, modelVersion, **learningModelId**, status, tasks[], videoUrl, errorMessage
- 任务结构 `ITask`: type(viral_learn/script/clip/video), taskId, orderNum, status, pollCount, elapsedTime, result, createdAt, completedAt
- 订单状态: pending → [viral_learn →] script → clip → video → done / error
- 任务状态: pending | running | **wait_confirm** | done | error

## 工作流恢复机制
- 进入订单详情页时，自动检测未完成订单
- **有 wait_confirm 任务时不自动恢复**，保持暂停状态等待用户确认
- `resumeOrderWorkflow` 使用 while 循环处理完整链路：
  0. 有 wait_confirm 任务 → 暂停（break）
  1. 有 running 任务 → 继续轮询
  2. 轮询完成后，分段式且为 script/clip → 设为 wait_confirm 并暂停
  3. 无 running 任务但有已完成的前置任务 → 自动创建下一步任务
     - viral_learn done → 提取 learning_model_id → 创建 script
     - script done → 创建 clip
     - clip done → 创建 video
  4. 所有任务完成 → 提取 videoUrl，标记订单完成
- 用户点击“确认并继续下一步”按钮 → `confirmTask` 将 wait_confirm 改为 done，再调 resumeOrderWorkflow
- 页面离开时通过 `abortRef` 中断轮询，返回后可重新恢复
- 网络错误自动重试3次（指数退避）

## 技术架构
- **框架**: React + TypeScript + Vite
- **UI库**: Ant Design
- **HTTP**: Axios
- **数据持久化**: localStorage

## API 接口、数据来源、响应数据参考
1. 获取爆款电影素材（查询SQL数据库）
传入video_file_id以查找指定记录，否则返回所有记录

```
table_name = "movie_coze_sucai"

# 判断 video_file_id 是否有值
if video_file_id and video_file_id.strip():
    # 指定了 video_file_id，查询指定记录
    sql = f"SELECT * FROM {table_name} WHERE video_file_id=:video_file_id"
    result = db.execute(text(sql), {"video_file_id": video_file_id})
```

响应
{"found":true,"query_result":[{"id":9,"name":"西虹市首富(已下架)","video_file_id":"ce478a49-4aed-4ab6-a655-b4e28453c1a6","srt_file_id":"9597f519-5ed7-4280-a398-c91ce79ada2bsss","type":"喜剧片","status":"1","story_info":"西虹市丙级球队大翔队的守门员王多鱼（沈腾 饰）因比赛失利被教练开除，一筹莫展之际王多鱼突然收到神秘人士金老板（张晨光 饰）的邀请，被告知自己竟然是保险大亨王老太爷（李立群 饰）的唯一继承人，遗产高达百亿！但是王老太爷给出了一个非常奇葩的条件，那就是要求王多鱼在一个月内花光十亿，还不能告诉身边人，否则失去继承权。王多鱼毫不犹豫签下了“军令状”，与好友庄强（张一鸣 饰）以及财务夏竹（宋芸桦 饰）一起开启了“挥金之旅”，即将成为西虹市首富的王多鱼，第一次感受到了做富人的快乐，同时也发现想要挥金如土实在没有那么简单！","cover":"https://preview.jufenqian.top/coze/movie_cover/西虹市首富.png","character_name":null,"remark":"中国"},{"id":143,"name":"这个杀手不太冷","video_file_id":"37d5331b-d772-4bdf-b394-df8e8102205c","srt_file_id":"23bdfa4b-0ab3-4d90-8977-076286f5f681","type":"剧情片","status":null,"story_info":"里昂（让·雷诺饰）是名孤独的职业杀手，受人雇佣。一天，邻居家小姑娘马蒂尔达（纳塔丽·波特曼饰)敲开他的房门，要求在他那里暂避杀身之祸。原来邻居家的主人是警方缉毒组的眼线，只因贪污了一小包毒品而遭恶警（加里·奥德曼饰）杀害全家的惩罚。马蒂尔达得到里昂的留救，幸免于难，并留在里昂那里。里昂教小女孩使枪，她教里昂法文，两人关系日趋亲密，相处融洽。\n女孩想着去报仇，反倒被抓，里昂及时赶到，将女孩救回。混杂着哀怨情仇的正邪之战渐次升级，更大的冲突在所难免……","cover":"https://preview.jufenqian.top/coze/movie_cover/这个杀手不太冷.png","character_name":null,"remark":null},{"id":152,"name":"人生一世","video_file_id":"3dfc2aee-141e-4e47-bec0-536802985dda","srt_file_id":"62a9bc8a-346e-4ae1-98d2-02e4a23b10c0","type":"剧情片","status":null,"story_info":"本片根据罗伯特·塞瑟勒的全球畅销小说改编。20世纪初，幼孤安德烈亚斯被送至偏远山谷中的农场，与冷酷无情的叔叔同住。在18岁那年，他鼓足勇气逃离，成为了一名樵夫。安德烈亚斯用积攒的钱租赁了一间山中小屋，并遇见了玛丽，他的生命之光。然而，安德烈亚斯无奈地被征召入伍，加入了德国国防军，在几乎没有胜算的情况下奔赴前苏联前线。当安德烈亚斯历经战火洗礼归来时，世界已面目全非。","cover":"https://preview.jufenqian.top/coze/movie_cover/人生一世.png","character_name":null,"remark":null}],"run_id":"c81dcc1a-ca0a-492e-a9c2-78c96c9b1d3b"}


2. 获取解说模板
根据类型或解说类型+模型版本从数据库查询爆款信息。
支持三种查询模式：1）提供type时直接查询；2）提供narrator_type和model_version时通过映射查询；3）都不提供时查询所有数据

```
# 参数互斥校验
has_type = state.type is not None and state.type != ""
has_narrator_params = (state.narrator_type is not None and state.narrator_type != "" and 
                        state.model_version is not None and state.model_version != "")

if has_type and has_narrator_params:
    raise ValueError("type 参数与 narrator_type+model_version 参数互斥，不能同时传入")

if has_narrator_params:
    # 使用 narrator_type 和 model_version 映射到 type
    type_value = get_type_from_mapping(state.narrator_type, state.model_version)
elif has_type:
    # 直接使用传入的 type
    type_value = state.type
else:
    # 都不传，查询所有数据
    type_value = None

# 获取数据库会话
db = get_session()
try:
    # 构造SQL查询
    table_name = "movie_coze_baokuan"
    
    # 如果 type_value 为空，查询所有数据
    if type_value is None:
        sql = f"SELECT * FROM {table_name}"
        result = db.execute(text(sql))
    else:
        # 指定了 type，查询指定类型的数据
        sql = f"SELECT * FROM {table_name} WHERE type=:type"
        result = db.execute(text(sql), {"type": type_value})
```


响应
{"found":true,"query_result":[{"id":65,"code":null,"name":"自定义","learning_model_id":"else","info":"else","remark":"else","type":"11","narrator_type":null,"name_time":"自定义","time":null,"model_version":null,"language":null,"tags":null,"img":null,"like":null,"share":null,"messages":null,"stars":null,"profit":null,"slug_img":null,"link":null,"collection_time":null},{"id":66,"code":null,"name":"自定义","learning_model_id":"else","info":"else","remark":"else","type":"22","narrator_type":null,"name_time":"自定义","time":null,"model_version":null,"language":null,"tags":null,"img":null,"like":null,"share":null,"messages":null,"stars":null,"profit":null,"slug_img":null,"link":null,"collection_time":null},{"id":67,"code":null,"name":"自定义","learning_model_id":"else","info":"else","remark":"else","type":"33","narrator_type":null,"name_time":"自定义","time":null,"model_version":null,"language":null,"tags":null,"img":null,"like":null,"share":null,"messages":null,"stars":null,"profit":null,"slug_img":null,"link":null,"collection_time":null},{"id":88,"code":"xy0046","name":"热血动作-困兽之斗解说","learning_model_id":"narrator-20250916152104-DYsban","info":"动作、生存、智斗、暴力、困境","remark":"动作片 ,外语解说","type":"33","narrator_type":"多语种电影解说","name_time":"热血动作-困兽之斗解说(英语,时长2:10)","time":"2:10","model_version":null,"language":"英语","tags":"TikTok,动作科幻","img":"https://preview.jufenqian.top/coze/narrator_template_images/热血动作-困兽之斗解说_img.jpeg","like":"8212","share":"1876","messages":"539","stars":"2211","profit":"439.06","slug_img":"https://preview.jufenqian.top/coze/narrator_template_images/热血动作-困兽之斗解说_slug.jpeg","link":"链接: https://pan.baidu.com/s/1wShibx6Uf3untmtrMKVYTQ?pwd=hj1f 提取码: hj1f","collection_time":"2025-10-27"},{"id":89,"code":"xy0063","name":"烧脑悬疑-栽赃陷害解说","learning_model_id":"narrator-20250916152053-nBcHXC","info":"阴谋、悬疑、背叛、逃亡、博弈","remark":"动作片 ,外语解说","type":"33","narrator_type":"多语种电影解说","name_time":"烧脑悬疑-栽赃陷害解说(英语,时长1:11)","time":"1:11","model_version":null,"language":"英语","tags":"TikTok,悬疑惊悚","img":"https://preview.jufenqian.top/coze/narrator_template_images/烧脑悬疑-栽赃陷害解说_img.jpeg","like":"52000","share":"273","messages":"324","stars":"217","profit":"818.12","slug_img":"https://preview.jufenqian.top/coze/narrator_template_images/烧脑悬疑-栽赃陷害解说_slug.jpeg","link":"链接: https://pan.baidu.com/s/132GZquSzjSstBnJXdLQOEg?pwd=uv7a 提取码: uv7a","collection_time":"2025-11-10"},{"id":90,"code":"xy0033","name":"励志成长-师生情谊解说","learning_model_id":"narrator-20250918141539-NnpZlD","info":"励志、成长、教育、师生情、救赎","remark":"励志,第三人称","type":"11","narrator_type":"第三人称电影","name_time":"励志成长-师生情谊解说(时长5:01)","time":"5:01","model_version":null,"language":"中文","tags":"抖音,剧情情感","img":"https://preview.jufenqian.top/coze/narrator_template_images/励志成长-师生情谊解说_img.jpeg","like":"5736","share":"511","messages":"637","stars":"841","profit":"200.4","slug_img":"https://preview.jufenqian.top/coze/narrator_template_images/励志成长-师生情谊解说_slug.jpeg","link":"链接: https://pan.baidu.com/s/1aQgg-mwqmCkhWgVaUB968g?pwd=e4di 提取码: e4di","collection_time":"2025-10-13"}],"run_id":"7090075c-9343-4906-81fc-580db3cd3f32"}



3. 获取BGM数据
根据BGM文件ID从数据库查询BGM信息，如果ID为空则返回所有数据

```
ctx = runtime.context

# 获取数据库会话
db = get_session()
try:
    # 获取参数
    bgm_file_id = state.bgm_file_id or ""
    table_name = "movie_coze_bgm"

    # 根据参数构造SQL查询
    if bgm_file_id:
        # 有ID时，按ID查询
        sql = f"SELECT * FROM {table_name} WHERE bgm_file_id=:bgm_file_id"
        result = db.execute(text(sql), {"bgm_file_id": bgm_file_id})
        rows = result.fetchall()

```

响应
{"found":true,"query_result":[{"id":4,"name":"Call of Silence","bgm_file_id":"5527b36b-3f96-47ee-a819-ada7b2298907","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/Call of Silence.mp3","type":null,"tag":"抒情,弦乐,史诗","description":"这是一首情绪沉静深沉、节奏舒缓却暗含力量的弦乐抒情配乐，旋律中带着压抑的厚重感。适合战争片、科幻灾难片、人性刻画类剧情片，尤其适合主角在绝境中直面内心抉择、经历残酷洗礼后陷入沉默反思的场景，如末世求生后的喘息、战争结束后的废墟凝望、角色背负沉重宿命的独处时刻。适配悲壮感人、史诗震撼、沉郁反思的解说文案情绪，参考案例为《进击的巨人》，适配理由是该曲贴合作品中角色在残酷生存环境下的挣扎与沉默的宿命感。"},{"id":5,"name":"Anacreon","bgm_file_id":"0597d458-ae36-44b5-9906-2241af888754","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/Anacreon.mp3","type":null,"tag":"nan","description":"nan"},{"id":6,"name":"Sold Out","bgm_file_id":"e3c21731-e786-4fe7-8e23-72bcdb31d428","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/Sold Out.mp3","type":null,"tag":"nan","description":"nan"},{"id":7,"name":"Time Back","bgm_file_id":"d710d6ee-e261-4091-a8e0-6235912cd222","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/Time Back.mp3","type":null,"tag":"励志,钢琴,电子","description":"这是一首融合钢琴与电子元素的纯音乐，情绪温暖励志，节奏由舒缓渐至激昂。适合励志片、动作片、成长类电影，尤其适合主角历经挫折后逆袭、为目标全力冲刺、突破自我极限的剧情场景，适配热血激昂、温暖治愈、充满力量的解说文案情绪。参考案例：《当幸福来敲门》，适配主角在绝境中坚持最终迎来转机的核心剧情与情绪。"},{"id":8,"name":"丧尽","bgm_file_id":"addabcc5-e148-404a-80d5-ee062b7b1b96","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/丧尽.mp3","type":null,"tag":"暗黑,电子,悬疑","description":"这是一首情绪压抑暗沉的慢节奏暗黑电子器乐作品，节奏紧绷，充满悬疑感。适合悬疑片、恐怖片、犯罪片，尤其适合处理主角陷入危机、真相即将揭开前的铺垫、反派暗中布局的剧情场景，营造紧张压抑、诡谲惊悚的情绪氛围。适配悬疑烧脑、紧张凝重、暗黑诡异的解说文案情绪，参考案例为《七宗罪》，适配理由是其暗黑压抑的调性与影片中连环凶杀案的诡谲氛围高度契合。"},{"id":9,"name":"River Flows in You","bgm_file_id":"065b0fbb-16f3-4b5e-a326-e05279eb7fc3","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/River Flows in You.mp3","type":null,"tag":"治愈,钢琴,抒情","description":"这是一首温暖治愈的纯钢琴BGM，节奏舒缓柔和，旋律流畅细腻。适合爱情片、青春片、治愈系文艺片，尤其适合主角独处沉思、旧物触发回忆、久别重逢的温情场景，或是展现细腻内心活动、平淡日常里的小美好、爱情里的懵懂悸动的剧情。适配温馨治愈、浪漫唯美、平静舒缓的解说文案情绪，参考案例《情书》，适配理由：契合影片中通过书信唤起青涩回忆、细腻含蓄的温情氛围。"},{"id":10,"name":"城南花已开","bgm_file_id":"57f28e03-5a17-4994-b283-1edd8ea5ff6a","status":"1","remark":null,"bgm_demo_url":"https://preview.jufenqian.top/coze/bgm/城南花已开.mp3","type":null,"tag":"治愈,纯音,温暖","description":"这是一首节奏舒缓轻柔的治愈系纯音乐，核心情绪温暖平静，旋律带着淡淡的慰藉感。适合治愈系剧情片、家庭温情片、青春文艺片，尤其适合主角经历低谷后获得慰藉、亲人朋友间的温情陪伴、少年人面对离别与成长的剧情场景，适配温暖治愈、温柔慰藉、平静释然的解说文案情绪，参考案例《海蒂和爷爷》，适配理由：贴合影片中山间治愈的氛围与祖孙间温暖的情感互动"}],"run_id":"5adf5781-ae04-4305-8106-49e21b85b4c2"}

4. 获取配音数据
根据配音ID从数据库查询配音信息。如果dubbing_id为空或未提供，则查询所有配音数据；如果提供了dubbing_id，则查询指定配音信息
```
ctx = runtime.context

# 获取数据库会话
db = get_session()
try:
    # 构造SQL查询
    table_name = "movie_coze_dubbing"
    
    # 如果 dubbing_id 为空，查询所有数据
    if state.dubbing_id is None or state.dubbing_id == "":
        sql = f"SELECT * FROM {table_name}"
        result = db.execute(text(sql))
    else:
        # 指定了 dubbing_id，查询指定数据
        sql = f"SELECT * FROM {table_name} WHERE dubbing_id=:dubbing_id"
        result = db.execute(text(sql), {"dubbing_id": state.dubbing_id})
    
    # 获取所有结果
    rows = result.fetchall()
```

响应
{"found":true,"query_result":[{"id":4,"name":"人生大事-莫三妹","dubbing_id":"MiniMaxVoiceId17","role":"朱一龙","status":null,"language":"普通话","info":null,"dubbing_demo_url":"https://preview.jufenqian.top/coze/dubbing_demo/朱一龙2.mp3","sort":null},{"id":5,"name":"霸王别姬-程蝶衣","dubbing_id":"MiniMaxVoiceId02586","role":"张国荣","status":"是","language":"普通话","info":null,"dubbing_demo_url":"https://preview.jufenqian.top/coze/dubbing_demo/程蝶衣.mp3","sort":null},{"id":6,"name":"夏洛特烦恼-夏洛","dubbing_id":"MiniMaxVoiceId06082","role":"沈腾","status":null,"language":"普通话","info":null,"dubbing_demo_url":null,"sort":null},{"id":7,"name":"无人生还","dubbing_id":"MiniMaxVoiceId07366","role":"克莱索恩配音","status":null,"language":"普通话","info":null,"dubbing_demo_url":null,"sort":null},{"id":8,"name":"酱园弄-詹周氏","dubbing_id":"MiniMaxVoiceId10985","role":"章子怡","status":"是","language":"普通话","info":null,"dubbing_demo_url":"https://preview.jufenqian.top/coze/dubbing_demo/章子怡配音.mp3","sort":null}],"run_id":"dfc4602b-6fb5-4356-9bda-d86118412650"}


5. 生成爆款学习模型
入参出参说明
https://s.apifox.cn/33f3a154-cccf-4a1e-b921-704cd32694b2/387946449e0.md

curl --location --request POST 'https://openapi.jieshuo.cn/v2/task/commentary/create_popular_learning' \
--header 'app-key: grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe' \
--header 'Content-Type: application/json' \
--data-raw '{
    "video_path": "c25b7d1c4b4a46c6bb767d3b67ed48a8",
    "video_srt_path": "74ac3216607744a8985101fe622b4471",
    "model_version": "standard",
    "narrator_type": "短剧"
}'

响应
{
    "code": 10000,
    "message": "success",
    "data": {
        "task_id": "7aaecfc31f7342f5a320296ca519a560",
        "webhook_data": null
    }
}


6. 生成文案
入参出参说明
https://s.apifox.cn/33f3a154-cccf-4a1e-b921-704cd32694b2/387946450e0.md

curl --location --request POST 'https://openapi.jieshuo.cn/v2/task/commentary/create_generate_writing' \
--header 'app-key: grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe' \
--header 'Content-Type: application/json' \
--data-raw '{
  "learning_model_id": "narrator-20250916152104-DYsban",
  "episodes_data": [
        {
            "num": 1,
            "srt_oss_key": "23bdfa4b-0ab3-4d90-8977-076286f5f681",
            "video_oss_key": "37d5331b-d772-4bdf-b394-df8e8102205c",
            "negative_oss_key": "37d5331b-d772-4bdf-b394-df8e8102205c"
        }
  ],
  "playlet_name": "这个杀手不太冷",
  "playlet_num": " 1",
  "target_platform": "抖音短视频平台",
  "vendor_requirements": "投放在抖音短视频平台，吸引18-35岁的年轻用户观看。",
  "task_count": 1,
  "target_character_name": "主角",
  "story_info": "里昂（让·雷诺饰）是名孤独的职业杀手，受人雇佣。一天，邻居家小姑娘马蒂尔达（纳塔丽·波特曼饰)敲开他的房门，要求在他那里暂避杀身之祸。原来邻居家的主人是警方缉毒组的眼线，只因贪污了一小包毒品而遭恶警（加里·奥德曼饰）杀害全家的惩罚。马蒂尔达得到里昂的留救，幸免于难，并留在里昂那里。里昂教小女孩使枪，她教里昂法文，两人关系日趋亲密，相处融洽。\n女孩想着去报仇，反倒被抓，里昂及时赶到，将女孩救回。混杂着哀怨情仇的正邪之战渐次升级，更大的冲突在所难免……"
}'

响应
{
    "code": 10000,
    "message": "success",
    "data": {
        "task_id": "9e0bee0ee61448069fba0ee9b3a88b5e"
    }
}


7. 生成剪辑脚本
入参出参说明
https://s.apifox.cn/47ff5210-847d-4ab9-9e6b-a4fe5f6f0ff1/419336410e0.md

curl
curl --location --request POST 'https://openapi.jieshuo.cn/v2/task/commentary/create_generate_clip_data' \
--header 'app-key: grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe' \
--header 'Content-Type: application/json' \
--data-raw '{
    "order_num": "generate_writing_27b68b74_b205ba",
    "generate_task_id": "",
    "bgm": "379883b2-4717-4393-a83e-e3524f9f7415",
    "dubbing": "MiniMaxVoiceId17",
    "dubbing_type": "default"
}'

响应
{
    "code": 10000,
    "message": "success",
    "data": {
        "task_id": "b9136c00f5314be5b0e3c3041fd245c8"
    }
}


8. 合成视频
入参出参说明
https://s.apifox.cn/33f3a154-cccf-4a1e-b921-704cd32694b2/387946451e0.md

curl
curl --location --request POST 'https://openapi.jieshuo.cn/v2/task/commentary/create_video_composing' \
--header 'app-key: grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe' \
--header 'Content-Type: application/json' \
--data-raw '{
    "order_num": "generate_clip_data_9fc4916a_405680"
}'


响应
{
    "code": 10000,
    "message": "success",
    "data": {
        "task_id": "fcbcdd5ad03941db9f42ff4adc41ea42"
    }
}

9. 查询任务状态
入参出参说明
https://s.apifox.cn/33f3a154-cccf-4a1e-b921-704cd32694b2/387946452e0.md

curl
curl --location --request GET 'https://openapi.jieshuo.cn/v2/task/commentary/query/b9136c00f5314be5b0e3c3041fd245c8' \
--header 'app-key: grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe' \
--header 'Content-Type: application/json' \
--data-raw ''

响应-生成爆款模型-data.status=1
{"code":10000,"message":"success","data":{"task_id":"7aaecfc31f7342f5a320296ca519a560","task_order_num":"viral_learn_7aaecfc3_503d58","category":"commentary","type":1,"type_name":"popluar_learning","status":1,"results":{"code":"None","data":{"task_id":155319,"order_num":"learn_69aa96b4_H9oPtt","created_task_ids":[155319]},"status":"success","details":null,"message":"成功创建 1 个爆款学习任务","timestamp":1772787381,"error_code":null,"failed_count":null,"error_details":null},"consumed_points":65.0,"duration_consumed_points":65.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-06T16:56:22","completed_at":null,"failed_at":null,"created_at":"2026-03-06T16:56:22","updated_at":"2026-03-06T16:56:22"}}

响应-生成爆款模型-data.status=2
{"code":10000,"message":"success","data":{"task_id":"367a9d0b61034af7a0a7beadd584196e","task_order_num":"viral_learn_367a9d0b_d7aa63","category":"commentary","type":1,"type_name":"popluar_learning","status":2,"results":{"tasks":[{"id":154957,"status":9,"video_url":"","project_zip":"","task_result":"{\"agent_unique_code\": \"narrator-20260306102631-HNoXpN\"}","result_oss_key":""}],"order_info":{"step":"viral_learning","result":"narrator-20260306102631-HNoXpN","status":10000,"order_num":"learn_69aa3a9c_VOAsQ2","task_type":1,"timestamp":1772763992,"created_at":"2026-03-06 10:26:32","learning_model_id":"narrator-20260306102631-HNoXpN"},"callback_data":{"step":"viral_learning","tasks":[{"id":154957,"status":9,"video_url":"","project_zip":"","task_result":"{\"agent_unique_code\": \"narrator-20260306102631-HNoXpN\"}","result_oss_key":""}],"order_num":"learn_69aa3a9c_VOAsQ2","task_type":1,"timestamp":1772763992,"webhook_data":"{'webhook_data': None, 'task_id': '367a9d0b61034af7a0a7beadd584196e', 'task_order_num': 'viral_learn_367a9d0b_d7aa63', 'webhook_url': '', 'webhook_token': ''}"}},"consumed_points":89.4,"duration_consumed_points":89.4,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-06T10:23:25","completed_at":"2026-03-06T10:26:32","failed_at":null,"created_at":"2026-03-06T10:23:25","updated_at":"2026-03-06T10:26:32"}}


响应-生成文案-data.status=1
{"code":10000,"message":"success","data":{"task_id":"9e0bee0ee61448069fba0ee9b3a88b5e","task_order_num":"generate_writing_9e0bee0e_b2aeec","category":"commentary","type":2,"type_name":"generate_writing","status":1,"results":{"code":"None","data":{"order_num":"script_69aa90d2_thel74","task_count":1,"created_task_ids":[155307]},"status":"success","details":null,"message":"成功创建 1 个解说生成任务","timestamp":1772785876,"error_code":null,"failed_count":null,"error_details":null},"consumed_points":75.0,"duration_consumed_points":0.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-06T16:31:17","completed_at":null,"failed_at":null,"created_at":"2026-03-06T16:31:17","updated_at":"2026-03-06T16:31:17"}}

响应-生成文案-已完成-data.status=2
{"code":10000,"message":"success","data":{"task_id":"a30ee46e15354bbaa5742e273b3bb32a","task_order_num":"generate_writing_a30ee46e_eba91b","category":"commentary","type":2,"type_name":"generate_writing","status":2,"results":{"tasks":[{"id":154958,"status":9,"video_url":"","project_zip":"","task_result":"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260306/script_t_154958_aCGuyA/人生一世解说文案.txt","result_oss_key":""}],"order_info":{"step":"commentary_generation","status":10000,"order_num":"script_69aa3b66_QVScNK","task_type":1,"timestamp":1772764232},"callback_data":{"step":"commentary_generation","tasks":[{"id":154958,"status":9,"video_url":"","project_zip":"","task_result":"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260306/script_t_154958_aCGuyA/人生一世解说文案.txt","result_oss_key":""}],"order_num":"script_69aa3b66_QVScNK","task_type":1,"timestamp":1772764232,"webhook_data":"{'webhook_data': None, 'task_id': 'a30ee46e15354bbaa5742e273b3bb32a', 'task_order_num': 'generate_writing_a30ee46e_eba91b', 'webhook_url': '', 'webhook_token': ''}"}},"consumed_points":75.0,"duration_consumed_points":0.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-06T10:26:56","completed_at":"2026-03-06T10:30:32","failed_at":null,"created_at":"2026-03-06T10:26:56","updated_at":"2026-03-06T10:30:32"}}


响应-生成剪辑脚本-未完成，data.status=1
{"code":10000,"message":"success","data":{"task_id":"79355cb4b341472482c925aab5f14e85","task_order_num":"generate_clip_data_79355cb4_974a3f","category":"commentary","type":6,"type_name":"generate_clip_data","status":1,"results":{"code":"None","data":{"task_id":null,"order_num":"2a54f4f5caa0992462c621de8d132f01","total_tasks":1,"synthesis_results":[{"status":"started","message":"视频合成任务创建成功","task_id":155329,"commentary_task_id":154959}]},"status":"success","details":null,"message":"已创建 1 个新的视频合成任务，新订单号: 2a54f4f5caa0992462c621de8d132f01","timestamp":1772790404,"error_code":null,"failed_count":null,"error_details":null},"consumed_points":90.3,"duration_consumed_points":90.3,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-06T17:46:45","completed_at":null,"failed_at":null,"created_at":"2026-03-06T17:46:45","updated_at":"2026-03-06T17:46:45"}}


响应-生成剪辑脚本-已完成，data.status=2
{"code":10000,"message":"success","data":{"task_id":"9fc4916a864d4bae8db1780aa9325a18","task_order_num":"generate_clip_data_9fc4916a_405680","category":"commentary","type":6,"type_name":"generate_clip_data","status":2,"results":{"tasks":[{"id":154960,"status":9,"video_url":"","project_zip":"","task_result":"{\"clip_data_file\": \"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260306/script_69aa3b66-90561e25596846cb/t_154960_103122_NrWs/clipsData.json\"}","result_oss_key":"","clip_data_file_id":"81015d3874f846b1aafb8b3f436124f4"}],"file_ids":["81015d3874f846b1aafb8b3f436124f4"],"order_info":{"status":10000,"order_num":"2a0a656e6f709d3dc384dd676463100a"}},"consumed_points":35.0,"duration_consumed_points":35.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-06T10:31:22","completed_at":"2026-03-06T10:39:52","failed_at":null,"created_at":"2026-03-06T10:31:22","updated_at":"2026-03-06T10:39:52"}}


响应-生成视频-未完成，data.status=1
{"code":10000,"message":"success","data":{"task_id":"497dd1087c1b4c3c955cac802167d1cd","task_order_num":"video_composing_497dd108_bf39f5","category":"commentary","type":3,"type_name":"video_composing","status":1,"results":{"code":"None","data":{"task_id":null,"order_num":"clip_1772790447_59232608","synthesis_results":null},"status":"success","details":null,"message":"已创建并发起 1 个视频剪辑任务","timestamp":1772790450,"error_code":null,"failed_count":null,"error_details":null},"consumed_points":25.0,"duration_consumed_points":25.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-06T17:47:30","completed_at":null,"failed_at":null,"created_at":"2026-03-06T17:47:30","updated_at":"2026-03-06T17:47:30"}}


响应-生成视频-已完成，data.status=2
{"code":10000,"message":"success","data":{"task_id":"90eaf113d0fd46feb85b574851e89860","task_order_num":"video_composing_90eaf113_f6f95d","category":"commentary","type":3,"type_name":"video_composing","status":2,"results":{"tasks":[{"id":155050,"status":9,"video_url":"https://oss.jufenqian.top/video-clips-data/20260306/t_155050_104722_ZYQv/output.mp4","project_zip":"video-clips-data/20260306/t_155050_104722_ZYQv/tracks.zip","task_result":"{\"clip_data_file\": \"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260306/script_69aa3b66-90561e25596846cb/t_154960_103122_NrWs/clipsData.json\"}","result_oss_key":"video-clips-data/20260306/t_155050_104722_ZYQv/output.mp4","video_url_file_id":"2d6e8f058011455c86582822a52d0465","project_zip_file_id":"7879f79032c94476836f054e32f9c735"}],"order_info":{"step":"clip_stage2_timeline","status":10000,"order_num":"clip_1772765179_d3b01397","task_type":1,"timestamp":1772765359},"callback_data":{"step":"clip_stage2_timeline","tasks":[{"id":155050,"status":9,"video_url":"https://oss.jufenqian.top/video-clips-data/20260306/t_155050_104722_ZYQv/output.mp4","project_zip":"video-clips-data/20260306/t_155050_104722_ZYQv/tracks.zip","task_result":"{\"clip_data_file\": \"user_data/grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe/20260306/script_69aa3b66-90561e25596846cb/t_154960_103122_NrWs/clipsData.json\"}","result_oss_key":"video-clips-data/20260306/t_155050_104722_ZYQv/output.mp4","video_url_file_id":"2d6e8f058011455c86582822a52d0465","project_zip_file_id":"7879f79032c94476836f054e32f9c735"}],"order_num":"clip_1772765179_d3b01397","task_type":1,"timestamp":1772765359,"webhook_data":"{'webhook_data': None, 'task_id': '90eaf113d0fd46feb85b574851e89860', 'task_order_num': 'video_composing_90eaf113_f6f95d', 'webhook_url': '', 'webhook_token': ''}"}},"consumed_points":25.0,"duration_consumed_points":25.0,"process_consumed_points":0.0,"error_message_slug":null,"started_at":"2026-03-06T10:46:22","completed_at":"2026-03-06T10:49:19","failed_at":null,"created_at":"2026-03-06T10:46:22","updated_at":"2026-03-06T10:49:19"}}
