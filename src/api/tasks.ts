import axios from 'axios';
import { 
  IGenerateScriptRequest, 
  IGenerateClipRequest, 
  ISynthesizeVideoRequest,
  ITaskResponse
} from '../types';

// 任务状态响应类型
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
      status: number;
      results: any;
      consumed_points: number;
      started_at: string;
      completed_at: string | null;
      failed_at: string | null;
    };
  };
}

// API Tokens
const TOKENS = {
  script: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImJLbzZDMlhyZUVVaHV2MlJjZUFjeVdCRVVpRmNTOXZkIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NjkyLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg2NTE0NzA3MzgyMzE4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MjkxNTQ2OTUxNzM0In0.epCcMf-RdTqZ8r4jW281AkDr_dpqtIHfXn68q3XmZ2r4s8zlCSiB5t-JZDwNTvO4Ao-vGb7nIHFsusxR6o_Qf_c1a0ficIydnRoE9zZk4CIg89UiVPHk-k4PtcCQDp9c_hUT6QUW2Zanx7ZDWf_IZ9-C50O0IlASi4lo53I7flOFpQxHcwCrQy4ikamVk5Hhs4uvqcOzbynNmlGSwlOIi9nYAJ_59y_kywWI8jT1guflrrtv-oCsG91QpslBSMNZY1KSG5Q5Wly4HSJnIirPboc25giAFY0mF37yXwiW1pLvNEQTGdQwD9sZY2NDzXC-CUiDJcEZdbVZE_HJKFeRYw',
  clip: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInpLNGNRTnFGSGhNZXNMc25HcnU0enBMVWp3MTdwanBxIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NzA2LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg3MjMwMjgwODEwNTIzIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MzQ5MTAxMTkxMjIyIn0.IFRfn3Q1FZhIhDpwmVtW9whN_s3_96vUsdsi_EopR1eU9Ef-9LLBFZC_gnp1IZF65l9TYnFNoZnHVzItlJOsiX5eT6rSnUjOo_481tvqWCD7wp2CULrwvt_cCld0K1B0ye4vGFOZrHkOFUuYXXHDf80onStoJVLJqnqrSgHWwu3ODbbVoSb8tKBag6nHSgftlpo67jiTuqICQGM0oH7xuw0oFjXAWeddpBzp74KWaADlAOTZjeMVWd6OqCbBS6mb4dlH5BJcXxHSMwyK1rXxm7tNeqmYxKx60bfFHWGX1iie-3e9Se3MBmZnIHPPmGcXgSwsCGWooECtrN3KqJpGzQ',
  video: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIll4dTVoNlFpNGJVSHlXb3FVNHpBSWxRQmdLSkVmOFhQIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NzIwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg3NDk1NjYyODEzMjM1Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3NDExMzQ0NjYyNTYyIn0.S3ZV9ii3RlYtmepzYLcEl6yKtxlu1b3FcRW3Ov2fwCbAKuz48W_SCv0nLE9VDi0xiuzZPmNc8S0Ly0_kRi_YQ-G2zQszQgXwMoNRdqjvZ-Y9oWzG2r3vSwHfn1bA4rwnOjo_EkLlSTpPw7Xva8VLwCTiyCMNjR3EOqPhSTgsES0FnO5q-4piukc21U5Q6rnWPAbDirpYnmLehkdOGSX3p8VQBsdjwyv-fd5f5EvGD_4vDf-5qEJ3rtSM8mO7ENjcli9u3Astk9c6muAIgx7s6gb4ftcuGHSkY8vlTRKHyGr48OKVZbUbLnp6XpzXpvq31Jz9sYhuhZ6mvhNZzTonKQ',
  status: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ4NGRmNDgwLTEyOTItNGFjZS1iYzc5LTVmNjU1NDU0NmY0NyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIldvVGVJNmg2d3hDeWppMnlXdkFNTFVTa25EWTBEbE9mIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyNTMwNTY0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjEyNTY4MzA5MTExNzE3OTM5Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjEyOTYwODAzOTM0Njk5NTU0In0.ZwdBVVxEK6stReZs75TgCwDYfOvajB-OrsFL7gNUZbdTkkPZEEA707tcCMB2T1O08ExmkRkE5cafLsU99HdZGunyjNYsqm_BCX43csA1rF3jjhznHz9aHfjMIQJBUuHchrkVajcTATBFk77ifm2OJ7hnjkiAKKPJ_UzZNhTfOnylmINsXCJoLbBX3SXIUKv4CqA1kX4SbXuEVt21u9e1vbncB4qRyIVWbJVkQt9xduvXLG2odwWlTDLhoSBGrSq_Z_Y5lOymkCWJ9wKNP0IQZr9JTXiLfTyet6FQyjQTU_pedSGUW3rIW5kGEPrnHff1Nt8mpQPboMjBicrHPGS__Q'
};

// 生成解说文案
export async function generateScript(request: IGenerateScriptRequest): Promise<ITaskResponse> {
  const response = await axios.post('/api/script/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.script}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 生成剪辑脚本
export async function generateClip(request: IGenerateClipRequest): Promise<ITaskResponse> {
  const response = await axios.post('/api/clip/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.clip}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 合成视频
export async function synthesizeVideo(request: ISynthesizeVideoRequest): Promise<ITaskResponse> {
  const response = await axios.post('/api/video/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.video}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 查询任务状态
export async function queryTaskStatus(taskId: string, appKey: string): Promise<ITaskStatusResponse> {
  const response = await axios.post('/api/status/run', {
    task_id: taskId,
    app_key: appKey
  }, {
    headers: {
      'Authorization': `Bearer ${TOKENS.status}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 轮询任务直到完成
export async function pollTaskUntilComplete(
  taskId: string, 
  onProgress?: (status: ITaskStatusResponse) => void,
  options?: {
    intervalMs?: number;
    maxAttempts?: number;
    abortSignal?: { aborted: boolean };
    appKey?: string;
  }
): Promise<ITaskStatusResponse> {
  const intervalMs = options?.intervalMs ?? 10000;
  const maxAttempts = options?.maxAttempts ?? 360;
  const abortSignal = options?.abortSignal;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // 检查是否被中断
    if (abortSignal?.aborted) {
      throw new Error('轮询已取消');
    }
    
    // 查询任务状态（带网络重试）
    let status: ITaskStatusResponse;
    let retries = 0;
    const maxRetries = 3;
    while (true) {
      try {
        status = await queryTaskStatus(taskId, options?.appKey || '');
        break;
      } catch (err: any) {
        retries++;
        if (retries >= maxRetries) throw err;
        const isNetworkError = err.code === 'ERR_NETWORK' || err.code === 'ERR_NETWORK_CHANGED' || err.message === 'Network Error';
        if (!isNetworkError) throw err;
        console.warn(`网络错误，${retries}/${maxRetries}次重试...`, err.message);
        await new Promise(resolve => setTimeout(resolve, 3000 * retries));
      }
    }
    
    if (onProgress) {
      onProgress(status!);
    }
    
    // status: 1=进行中, 2=已完成
    if (status!.api_response?.data?.status === 2) {
      return status!;
    }
    
    // 检查是否失败
    if (status!.api_response?.data?.failed_at) {
      throw new Error('任务执行失败');
    }
    
    attempts++;
    
    // 等待间隔，期间检查abort
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      // 简单的abort检查
      if (abortSignal?.aborted) {
        clearTimeout(timer);
        resolve();
      }
    });
  }
  
  throw new Error('任务超时');
}
