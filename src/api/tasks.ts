import axios from 'axios';
import { 
  IGenerateScriptRequest, 
  IGenerateClipRequest, 
  ISynthesizeVideoRequest,
  IGenerateViralModelRequest,
  ICloudFilesResponse,
  ICloudFilesDirectResponse,
  ITaskResponse,
  IPreUploadRequest,
  IPreUploadResponse,
  IUploadTaskRequest,
  IUploadTaskResponse,
  ITransferListRequest,
  ITransferListResponse,
  IDeleteFileRequest,
  IDeleteFileResponse
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
  status: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ4NGRmNDgwLTEyOTItNGFjZS1iYzc5LTVmNjU1NDU0NmY0NyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIldvVGVJNmg2d3hDeWppMnlXdkFNTFVTa25EWTBEbE9mIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyNTMwNTY0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjEyNTY4MzA5MTExNzE3OTM5Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjEyOTYwODAzOTM0Njk5NTU0In0.ZwdBVVxEK6stReZs75TgCwDYfOvajB-OrsFL7gNUZbdTkkPZEEA707tcCMB2T1O08ExmkRkE5cafLsU99HdZGunyjNYsqm_BCX43csA1rF3jjhznHz9aHfjMIQJBUuHchrkVajcTATBFk77ifm2OJ7hnjkiAKKPJ_UzZNhTfOnylmINsXCJoLbBX3SXIUKv4CqA1kX4SbXuEVt21u9e1vbncB4qRyIVWbJVkQt9xduvXLG2odwWlTDLhoSBGrSq_Z_Y5lOymkCWJ9wKNP0IQZr9JTXiLfTyet6FQyjQTU_pedSGUW3rIW5kGEPrnHff1Nt8mpQPboMjBicrHPGS__Q',
  cloud_files: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInJiR2lLcEhCTTBTeWNwZlRqbHBzWGg4YzN1M1dINXM0Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1MzkwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjIyODMwMTc2MTQxMzU4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM1OTk0NTkyNjU3NDU4In0.mgwZokIpTjN0RD5bgOdj_ukH8YfL3XXjokzbqqPpQOE3RgjfUICHscSQQ0ArTWHsLxckrwU31E9_e0ECL_CCD71zpLFY32wHyP3oVJs_0RCbQSsLqf0Zk0jSPbPzcV9-JAFHWbKgUIjdJLwuMDpwPd6ji1BNRBeFglYpa5Rm5CZTqsM7MKxaS0rm-dZFfutdEweoPjJKDodbqVKBoTKXH5HJxpoUVdUwlNZsyEQkGkGV8nu6Uh4-GMLSeo_CYFIp1os2Nrdzi9Kbx8Cs3KtDDPUIcDzF4W0CoI37cbd_U0FxhaTMIQEjsris0c_nW4xdn2xdXvouULiBnV-kv1hkBg',
  viral_learn: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImRRTlhCeHltMEFLc3ZCYTdRV3NORm1GZ2xzcXVMbm5DIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1Njc1LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg1Njc0MjgyMTA2OTMxIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MjE1MDA5MjkyMzMwIn0.mM4Lw-e3_I1YDq88V8klG_pkDuJMJWHEj9gnM4ixiEwOaHlUlOvfXKIEPqkb6GGkkDm2xBgmq81vEJiIkUMlOZkAgShsYuAtWFZOGUV875jDcvPgGYozmzegampR4XzNqg841tx0FcKle6IfUbu80q9qw9-Yqy136Ct-Fk7gZHhPJUwYPLxPiWpIRbk-_NwgFsIRigOb-pkWQgry-rqOOCX6dfU_33bisT5kAHwQJyNUJtJdQjgQGyZ-VWNxGeathyw4MvQcDqAAVEYu0SfMuk5SBA5cVPnIj6FqjfL1ncs7CP215n_WkTPeDVf0Z9IsNJX4JUJ9YoZpdVUAuZdqeQ',
  pre_upload: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIlQ3TzNZaUUwaDF0NTM1MGc4U0ZubGo5aXBKTU9Dc2lIIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NDQyLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjI1Mzc4NzUyNjkyMjcwIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2MjE3NTA3MzMyMTMyIn0.JNs6stiJ7gSGaPF02REVxFVY1gKO5B2RQiywC_7-6uIY7h8fKoR3s8_2hYi1G86Cy94PvPZrO6rLhlwGeA9i_3YHA5bveT59yf39BZcY-dbcS62MRoKdqrWM2X068jgUl2URo-cjr2hlzIZOKqt9HNWjGi078IIfYUR_ARS5fXOTklH92mE_Hcs4EijCc2IODKhSrhY8YFEhiyK_im6gRpJlFK2FMGvt_3j45vo3tGSw1AXbr_9nOb0JRd63gUBhwcD1XV-MF3OUycYxlK4Oy0b-xWXllif5wpKT404DVBzrC3vSxRhImw28rSw79BYNJojPKYaMkkuspxlsYVqVig',
  upload_task: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIlpqTW9FckNKYjY4a0NnWXR4OW9kc3dJb3E4VENmbVdaIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NDY4LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjM1NjAwMjU0NzYzMDM0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2MzI4MzM5MjU5Mzk4In0.D38xZHjFS_wQEfyJxcGQi4z4EOlwYdF8JmUBvYOfrCUb2oRLroO0GkBBYtjLKPynVrgPgCLywhuEhpKVB1xBdMEhPDUC2QHafYAf9DlkzVeOQWTtrydS9gFV_ayU4947_2ixgf5igZ9bcLllWRpjEStv0ch32ddZo8oWaIuUded_jVYhR85G6C1ihRZkAT3zogH0eOBpVo5gfWUQy2C9Iem_VVU85BTEmIWu-pJ-GOa5JOI0t18w4oiHIIveVXYVKoxGbKoh0OUB1bqbwxiCifQtfFgX6ZTw4lX8HvXmSKUuOKB26mvzcgTGgg_gPqLtPPUalSpbdeNRrpn_JP6zWA',
  transfer_list: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImd6Y1FYcVowd0p6UkdEb01nUDZaRlozQVMza0VZQnhyIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NTAwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjQ0OTA5MTM5MTk3OTkwIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2NDYzNjA4MTE5MzMyIn0.P2Kd8kKLLQzmMTUCSP_FTMRDon6j1tasX43I6e8KFKe6fGnBGoXjy7W-jBJbeyyzOY7lqv1f732gs1miSGjQ2RhUxxfE8gzRNYMFszPigEjIj40dacb8Grg71GpRxTJu0AL__exv1sLa94bYg5sULC7FlbfjElG_WmXWwe1EKFTboL5pb_-MKviMTkgew7sexGYOZGSNtEHYPzc0U9llq0bAx7okP9VmHMU2QVuWWyqf6Zs-8VASH8ucv7c6cs4NOFofJ4tAJbw8n7dzctDmmiCZzAHhuNM8X5zuyUOA3etV_ysm5eXdQYRQOgfHvUXmbzK5VSef7UTCXqMWlySV9w',
  delete_file: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIkRhSjNKN2RIVVNFc3piTENXam50dHd0Zm12UVlWczE0Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NDg0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjQ1NDI1ODI3MTE5MTUwIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2Mzk2NjgzODA0Njc4In0.Xq486dBpLcCM1gWYyB3a0yg1zoSXxJJqBxxnlW9Scqkdr0XRLYYI1rg4kLIhvBmCbBN-iHpPnAO4sV68jww29fy33wKceg99nTcEUiCsbmqHTGGp7elFhvBNojXWcy-gIaUz_TO45KryB8RGOfUzMe3TKXeb0EaVgsryOsWzrJED4zgzyqNrTJYXWHVDeHTgea_mQkh3FV4mBCHM2t84_FpBsaLSQ6_ov0CdkKCL5UZRuayDmKHw3d8t1L0TJp5ssDiSgYNjeybrC9p9gfoleROlqR0EEV7TsdpgCZngOiv5mi-gBc6IsxK7w1rojVivW9YkBsJePwlnZWx8WApUjQ'
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

// 获取云盘文件列表
export async function fetchCloudFiles(appKey: string, page: number = 1, pageSize: number = 20): Promise<ICloudFilesResponse> {
  const response = await axios.post('/api/cloud_files/run', {
    app_key: appKey,
    page: String(page),
    page_size: String(pageSize)
  }, {
    headers: {
      'Authorization': `Bearer ${TOKENS.cloud_files}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 获取云盘文件列表（直接 API）
export async function fetchCloudFilesDirect(
  appKey: string,
  options: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    order?: string;
    search?: string;
  } = {}
): Promise<ICloudFilesDirectResponse> {
  const { page = 1, pageSize = 20, orderBy = '', order = 'desc', search = '' } = options;
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    order_by: orderBy,
    order: order,
    search: search
  });
  const response = await axios.get(`/api/v2/files/list?${params.toString()}`, {
    headers: {
      'app-key': appKey
    }
  });
  return response.data;
}

// 生成爆款学习模型
export async function generateViralModel(request: IGenerateViralModelRequest): Promise<ITaskResponse> {
  const response = await axios.post('/api/viral_learn/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.viral_learn}`,
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
        const isTransientError =
          err.code === 'ERR_NETWORK' || err.code === 'ERR_NETWORK_CHANGED' || err.message === 'Network Error' ||
          err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' ||
          (err.response && [502, 503, 504].includes(err.response.status));
        if (!isTransientError) throw err;
        console.warn(`临时错误(${err.code || err.response?.status})，${retries}/${maxRetries}次重试...`, err.message);
        await new Promise(resolve => setTimeout(resolve, 3000 * retries));
      }
    }
    
    if (onProgress) {
      onProgress(status!);
    }
    
    // 任务状态: 0=初始化, 1=进行中, 2=已完成, 3=已失败, 4=已取消
    const taskStatus = status!.api_response?.data?.status;
    if (taskStatus === 2) {
      return status!;
    }
    if (taskStatus === 3) {
      throw new Error('任务执行失败');
    }
    if (taskStatus === 4) {
      throw new Error('任务已取消');
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

// 预转存文件
export async function preUpload(request: IPreUploadRequest): Promise<IPreUploadResponse> {
  const response = await axios.post('/api/pre_upload/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.pre_upload}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 上传转存任务
export async function uploadTask(request: IUploadTaskRequest): Promise<IUploadTaskResponse> {
  const response = await axios.post('/api/upload_task/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.upload_task}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 文件传输列表
export async function fetchTransferList(request: ITransferListRequest): Promise<ITransferListResponse> {
  const response = await axios.post('/api/transfer_list/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.transfer_list}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 删除文件
export async function deleteFile(request: IDeleteFileRequest): Promise<IDeleteFileResponse> {
  const response = await axios.post('/api/delete_file/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.delete_file}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}
