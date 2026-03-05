// 爆款电影
export interface IMovie {
  id: number;
  name: string;
  video_file_id: string;
  srt_file_id: string;
  type: string;
  status: string | null;
  story_info: string;
  cover: string;
  character_name: string | null;
  remark: string | null;
}

// 解说模板
export interface INarratorTemplate {
  id: number;
  code: string | null;
  name: string;
  learning_model_id: string;
  info: string;
  remark: string | null;
  type: string;
  narrator_type: string | null;
  name_time: string;
  time: string | null;
  language: string | null;
  tags: string | null;
  img: string | null;
  like: string | null;
  share: string | null;
  messages: string | null;
  stars: string | null;
  profit: string | null;
  slug_img: string | null;
  link: string | null;
}

// BGM
export interface IBGM {
  id: number;
  name: string;
  bgm_file_id: string;
  status: string | null;
  remark: string | null;
  bgm_demo_url: string;
  type: string | null;
  tag: string | null;
  description: string | null;
}

// 配音
export interface IDubbing {
  id: number;
  name: string;
  dubbing_id: string;
  role: string;
  status: string | null;
  language: string;
  info: string | null;
  dubbing_demo_url: string | null;
}

// 剧集数据
export interface IEpisodeData {
  num: number;
  srt_oss_key: string;
  video_oss_key: string;
  negative_oss_key: string;
}

// 生成文案请求
export interface IGenerateScriptRequest {
  app_key: string;
  learning_model_id: string;
  episodes_data: IEpisodeData[];
  playlet_name: string;
  playlet_num: string;
  target_platform: string;
  task_count: number;
  target_character_name: string;
  refine_srt_gaps: string;
  vendor_requirements: string;
  story_info: string;
}

// 生成剪辑脚本请求
export interface IGenerateClipRequest {
  app_key: string;
  bgm: string;
  dubbing: string;
  dubbing_type: string;
  order_num: string;
  subtitle_style: ISubtitleStyle;
  custom_cover: string;
}

// 字幕样式
export interface ISubtitleStyle {
  shadow: string | null;
  outline: string | null;
  fontname: string | null;
  fontsize: string | null;
  margin_l: string | null;
  margin_r: string | null;
  margin_v: string | null;
  alignment: string | null;
  back_colour: string | null;
  border_style: string | null;
  outline_colour: string | null;
  primary_colour: string | null;
}

// 合成视频请求
export interface ISynthesizeVideoRequest {
  order_num: string;
  app_key: string;
}

// 任务响应
export interface ITaskResponse {
  task_id: string;
  run_id: string;
}

// 任务状态查询
export interface ITaskStatusResponse {
  is_success: boolean;
  response_message: string;
  api_response: {
    code: number;
    message: string;
    data: {
      task_id: string;
      task_order_num: string;
      category: string;
      type: number;
      type_name: string;
      status: number; // 1=进行中, 2=已完成
      results: any;
      consumed_points: number;
      started_at: string;
      completed_at: string | null;
      failed_at: string | null;
    };
  };
}

// 工作流状态
export interface IWorkflowState {
  step: number;
  // Step 1: 选择电影
  selectedMovie: IMovie | null;
  // Step 2: 选择模板
  selectedTemplate: INarratorTemplate | null;
  // Step 3: 配置
  selectedBGM: IBGM | null;
  selectedDubbing: IDubbing | null;
  targetPlatform: string;
  targetCharacterName: string;
  vendorRequirements: string;
  // 任务执行
  scriptTaskId: string | null;
  scriptOrderNum: string | null;
  clipTaskId: string | null;
  clipOrderNum: string | null;
  videoTaskId: string | null;
  videoUrl: string | null;
}
