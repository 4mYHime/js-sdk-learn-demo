import axios from 'axios';

export interface IEpisodeData {
  num: number;
  srt_oss_key: string;
  video_oss_key: string;
  negative_oss_key: string;
}

export interface INarrateRequest {
  app_key: string;
  learning_model_id: string;
  episodes_data: IEpisodeData[];
  playlet_name: string;
  playlet_num: string;
  target_platform: string;
  task_count: number;
  target_character_name: string;
  vendor_requirements: string;
  story_info: string;
}

export interface INarrateResponse {
  task_id: string;
  run_id: string;
}

const AUTH_TOKEN = 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImJLbzZDMlhyZUVVaHV2MlJjZUFjeVdCRVVpRmNTOXZkIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NjkyLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg2NTE0NzA3MzgyMzE4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MjkxNTQ2OTUxNzM0In0.epCcMf-RdTqZ8r4jW281AkDr_dpqtIHfXn68q3XmZ2r4s8zlCSiB5t-JZDwNTvO4Ao-vGb7nIHFsusxR6o_Qf_c1a0ficIydnRoE9zZk4CIg89UiVPHk-k4PtcCQDp9c_hUT6QUW2Zanx7ZDWf_IZ9-C50O0IlASi4lo53I7flOFpQxHcwCrQy4ikamVk5Hhs4uvqcOzbynNmlGSwlOIi9nYAJ_59y_kywWI8jT1guflrrtv-oCsG91QpslBSMNZY1KSG5Q5Wly4HSJnIirPboc25giAFY0mF37yXwiW1pLvNEQTGdQwD9sZY2NDzXC-CUiDJcEZdbVZE_HJKFeRYw';

export async function submitNarrateTask(request: INarrateRequest): Promise<INarrateResponse> {
  const response = await axios.post<INarrateResponse>('/api/narrate/run', request, {
    headers: {
      'Authorization': AUTH_TOKEN,
      'Content-Type': 'application/json',
    },
  });
  return response.data;
}

export function buildNarrateRequest(
  appKey: string,
  learningModelId: string,
  episodesData: IEpisodeData[],
  playletName: string,
  targetPlatform: string,
  targetCharacterName: string,
  vendorRequirements: string,
  storyInfo: string
): INarrateRequest {
  const playletNum = episodesData.map(ep => ep.num).join(',');
  const taskCount = episodesData.length;

  return {
    app_key: appKey,
    learning_model_id: learningModelId,
    episodes_data: episodesData,
    playlet_name: playletName,
    playlet_num: playletNum,
    target_platform: targetPlatform,
    task_count: taskCount,
    target_character_name: targetCharacterName,
    vendor_requirements: vendorRequirements,
    story_info: storyInfo,
  };
}
