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

// 云盘文件
export interface ICloudFile {
  file_id: string;
  file_name: string;
  file_size: number;
  suffix: string;
  category: number;
  completed_time: string;
  created_at: string;
  srt_line: number | null;
}

// 云盘文件列表响应
export interface ICloudFilesResponse {
  api_response: {
    code: number;
    message: string;
    data: {
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
      items: ICloudFile[];
    };
  };
  run_id: string;
}

// 云盘文件列表直接 API 响应
export interface ICloudFilesDirectResponse {
  code: number;
  message: string;
  data: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    items: ICloudFile[];
  };
}

// 生成爆款模型请求
export interface IGenerateViralModelRequest {
  app_key: string;
  video_path?: string;
  video_srt_path: string;
  narrator_type: string;
  model_version: string;
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

// 预转存文件
export interface IPreUploadFile {
  id: number;
  upload_id: string;
  pre_file_id: string;
  file_name: string;
  file_category: number; // 1=视频, 2=音频, 3=图片, 4=文档, 5=种子, 6=其他
  file_size: number;
  name_tag: string | null;
  category_tag: string | null;
  type_tag: string;
  index: number;
  related_record_id: string | null;
  related_record_name: string | null;
  invalid_message: string | null;
}

// 预转存请求
export interface IPreUploadRequest {
  link: string;
  tag: string;
  type_tag: string;
  app_key: string;
}

// 预转存响应
export interface IPreUploadResponse {
  code: number;
  message: string;
  data: {
    video: IPreUploadFile[];
    subtitle: IPreUploadFile[];
    image: IPreUploadFile[];
    other: IPreUploadFile[];
  };
}

// 上传转存任务请求
export interface IUploadTaskRequest {
  link?: string;
  upload_id?: string;
  app_key: string;
}

// 上传转存任务响应
export interface IUploadTaskResponse {
  response_data: any;
}

// 文件传输列表请求
export interface ITransferListRequest {
  page: number;
  limit: number;
  status: string;
  order?: string;
  order_by?: string;
  app_key: string;
}

// 文件传输列表响应
export interface ITransferListResponse {
  api_response: any;
  total: number;
  file_list: any;
}

// 删除文件请求
export interface IDeleteFileRequest {
  file_id: string;
  app_key: string;
}

// 删除文件响应
export interface IDeleteFileResponse {
  success: boolean;
  error_message: string;
}

// 预转存文件更新请求
export interface IUpdatePreFileRequest {
  app_key: string;
  pre_file_id: string;
  index?: number;
  related_record_id?: string;
}

// 预转存文件更新响应
export interface IUpdatePreFileResponse {
  code: number;
  message: string;
  data: Record<string, any>;
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

// 电影搜索结果
export interface IMovieSearchResult {
  year: string;
  genre: string;
  stars: string[];
  title: string;
  summary: string;
  director: string;
  local_title: string;
  original_title?: string;
  poster_url?: string;
  is_partial?: boolean;
}

// 原创文案请求
export interface IOriginalScriptRequest {
  app_key: string;
  model: 'flash' | 'standard';
  language: string;
  perspective: string;
  target_mode: string;
  learning_srt: string;
  playlet_name: string;
  episodes_data: Array<{ num: number; srt_oss_key: string }>;
  learning_model_id: string | null;
  confirmed_movie_json: IMovieSearchResult | null;
  target_character_name: string;
}

// 原创文案剪辑请求
export interface IOriginalClipRequest {
  app_key: string;
  bgm: string;
  dubbing: string;
  file_id: string;
  task_id: string;
  font_path: string | null;
  custom_cover: string;
  dubbing_type: string;
  episodes_data: Array<{
    num: number;
    srt_oss_key: string;
    video_oss_key: string;
    negative_oss_key: string;
  }>;
  subtitle_style: {
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
  };
}

// 预估点数请求
export interface IEstimatePointsRequest {
  app_key: string;
  request_params: {
    learning_srt?: string;
    model_version?: string;
    learning_model_id?: string;
    episodes_data: IEpisodeData[];
  };
}

// 预估点数响应
export interface IEstimatePointsResponse {
  viral_learning_points: number | null;
  commentary_generation_points: number | null;
  video_synthesis_points: number | null;
  refine_srt_gaps_points: number | null;
  total_consume_points: number;
  visual_template_points: number | null;
  template_points: number | null;
  text_model_points: number | null;
}
