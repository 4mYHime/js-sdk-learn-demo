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
  IDeleteFileResponse,
  IUpdatePreFileRequest,
  IUpdatePreFileResponse,
  IEstimatePointsRequest,
  IEstimatePointsResponse,
  ITaskConsumCalcRequest,
  ITaskConsumCalcResponse,
  IOriginalScriptRequest,
  IOriginalClipRequest,
  IMovieSearchResult
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
export const TOKENS = {
  script: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImJLbzZDMlhyZUVVaHV2MlJjZUFjeVdCRVVpRmNTOXZkIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NjkyLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg2NTE0NzA3MzgyMzE4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MjkxNTQ2OTUxNzM0In0.epCcMf-RdTqZ8r4jW281AkDr_dpqtIHfXn68q3XmZ2r4s8zlCSiB5t-JZDwNTvO4Ao-vGb7nIHFsusxR6o_Qf_c1a0ficIydnRoE9zZk4CIg89UiVPHk-k4PtcCQDp9c_hUT6QUW2Zanx7ZDWf_IZ9-C50O0IlASi4lo53I7flOFpQxHcwCrQy4ikamVk5Hhs4uvqcOzbynNmlGSwlOIi9nYAJ_59y_kywWI8jT1guflrrtv-oCsG91QpslBSMNZY1KSG5Q5Wly4HSJnIirPboc25giAFY0mF37yXwiW1pLvNEQTGdQwD9sZY2NDzXC-CUiDJcEZdbVZE_HJKFeRYw',
  clip: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInpLNGNRTnFGSGhNZXNMc25HcnU0enBMVWp3MTdwanBxIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NzA2LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg3MjMwMjgwODEwNTIzIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MzQ5MTAxMTkxMjIyIn0.IFRfn3Q1FZhIhDpwmVtW9whN_s3_96vUsdsi_EopR1eU9Ef-9LLBFZC_gnp1IZF65l9TYnFNoZnHVzItlJOsiX5eT6rSnUjOo_481tvqWCD7wp2CULrwvt_cCld0K1B0ye4vGFOZrHkOFUuYXXHDf80onStoJVLJqnqrSgHWwu3ODbbVoSb8tKBag6nHSgftlpo67jiTuqICQGM0oH7xuw0oFjXAWeddpBzp74KWaADlAOTZjeMVWd6OqCbBS6mb4dlH5BJcXxHSMwyK1rXxm7tNeqmYxKx60bfFHWGX1iie-3e9Se3MBmZnIHPPmGcXgSwsCGWooECtrN3KqJpGzQ',
  video: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIll4dTVoNlFpNGJVSHlXb3FVNHpBSWxRQmdLSkVmOFhQIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NzIwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg3NDk1NjYyODEzMjM1Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3NDExMzQ0NjYyNTYyIn0.S3ZV9ii3RlYtmepzYLcEl6yKtxlu1b3FcRW3Ov2fwCbAKuz48W_SCv0nLE9VDi0xiuzZPmNc8S0Ly0_kRi_YQ-G2zQszQgXwMoNRdqjvZ-Y9oWzG2r3vSwHfn1bA4rwnOjo_EkLlSTpPw7Xva8VLwCTiyCMNjR3EOqPhSTgsES0FnO5q-4piukc21U5Q6rnWPAbDirpYnmLehkdOGSX3p8VQBsdjwyv-fd5f5EvGD_4vDf-5qEJ3rtSM8mO7ENjcli9u3Astk9c6muAIgx7s6gb4ftcuGHSkY8vlTRKHyGr48OKVZbUbLnp6XpzXpvq31Jz9sYhuhZ6mvhNZzTonKQ',
  status: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ4NGRmNDgwLTEyOTItNGFjZS1iYzc5LTVmNjU1NDU0NmY0NyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIldvVGVJNmg2d3hDeWppMnlXdkFNTFVTa25EWTBEbE9mIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyNTMwNTY0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjEyNTY4MzA5MTExNzE3OTM5Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjEyOTYwODAzOTM0Njk5NTU0In0.ZwdBVVxEK6stReZs75TgCwDYfOvajB-OrsFL7gNUZbdTkkPZEEA707tcCMB2T1O08ExmkRkE5cafLsU99HdZGunyjNYsqm_BCX43csA1rF3jjhznHz9aHfjMIQJBUuHchrkVajcTATBFk77ifm2OJ7hnjkiAKKPJ_UzZNhTfOnylmINsXCJoLbBX3SXIUKv4CqA1kX4SbXuEVt21u9e1vbncB4qRyIVWbJVkQt9xduvXLG2odwWlTDLhoSBGrSq_Z_Y5lOymkCWJ9wKNP0IQZr9JTXiLfTyet6FQyjQTU_pedSGUW3rIW5kGEPrnHff1Nt8mpQPboMjBicrHPGS__Q',
  cloud_files: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInJiR2lLcEhCTTBTeWNwZlRqbHBzWGg4YzN1M1dINXM0Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1MzkwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjIyODMwMTc2MTQxMzU4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM1OTk0NTkyNjU3NDU4In0.mgwZokIpTjN0RD5bgOdj_ukH8YfL3XXjokzbqqPpQOE3RgjfUICHscSQQ0ArTWHsLxckrwU31E9_e0ECL_CCD71zpLFY32wHyP3oVJs_0RCbQSsLqf0Zk0jSPbPzcV9-JAFHWbKgUIjdJLwuMDpwPd6ji1BNRBeFglYpa5Rm5CZTqsM7MKxaS0rm-dZFfutdEweoPjJKDodbqVKBoTKXH5HJxpoUVdUwlNZsyEQkGkGV8nu6Uh4-GMLSeo_CYFIp1os2Nrdzi9Kbx8Cs3KtDDPUIcDzF4W0CoI37cbd_U0FxhaTMIQEjsris0c_nW4xdn2xdXvouULiBnV-kv1hkBg',
  viral_learn: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImRRTlhCeHltMEFLc3ZCYTdRV3NORm1GZ2xzcXVMbm5DIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1Njc1LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA2MTg1Njc0MjgyMTA2OTMxIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM3MjE1MDA5MjkyMzMwIn0.mM4Lw-e3_I1YDq88V8klG_pkDuJMJWHEj9gnM4ixiEwOaHlUlOvfXKIEPqkb6GGkkDm2xBgmq81vEJiIkUMlOZkAgShsYuAtWFZOGUV875jDcvPgGYozmzegampR4XzNqg841tx0FcKle6IfUbu80q9qw9-Yqy136Ct-Fk7gZHhPJUwYPLxPiWpIRbk-_NwgFsIRigOb-pkWQgry-rqOOCX6dfU_33bisT5kAHwQJyNUJtJdQjgQGyZ-VWNxGeathyw4MvQcDqAAVEYu0SfMuk5SBA5cVPnIj6FqjfL1ncs7CP215n_WkTPeDVf0Z9IsNJX4JUJ9YoZpdVUAuZdqeQ',
  pre_upload: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIlQ3TzNZaUUwaDF0NTM1MGc4U0ZubGo5aXBKTU9Dc2lIIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NDQyLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjI1Mzc4NzUyNjkyMjcwIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2MjE3NTA3MzMyMTMyIn0.JNs6stiJ7gSGaPF02REVxFVY1gKO5B2RQiywC_7-6uIY7h8fKoR3s8_2hYi1G86Cy94PvPZrO6rLhlwGeA9i_3YHA5bveT59yf39BZcY-dbcS62MRoKdqrWM2X068jgUl2URo-cjr2hlzIZOKqt9HNWjGi078IIfYUR_ARS5fXOTklH92mE_Hcs4EijCc2IODKhSrhY8YFEhiyK_im6gRpJlFK2FMGvt_3j45vo3tGSw1AXbr_9nOb0JRd63gUBhwcD1XV-MF3OUycYxlK4Oy0b-xWXllif5wpKT404DVBzrC3vSxRhImw28rSw79BYNJojPKYaMkkuspxlsYVqVig',
  upload_task: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIlpqTW9FckNKYjY4a0NnWXR4OW9kc3dJb3E4VENmbVdaIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NDY4LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjM1NjAwMjU0NzYzMDM0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2MzI4MzM5MjU5Mzk4In0.D38xZHjFS_wQEfyJxcGQi4z4EOlwYdF8JmUBvYOfrCUb2oRLroO0GkBBYtjLKPynVrgPgCLywhuEhpKVB1xBdMEhPDUC2QHafYAf9DlkzVeOQWTtrydS9gFV_ayU4947_2ixgf5igZ9bcLllWRpjEStv0ch32ddZo8oWaIuUded_jVYhR85G6C1ihRZkAT3zogH0eOBpVo5gfWUQy2C9Iem_VVU85BTEmIWu-pJ-GOa5JOI0t18w4oiHIIveVXYVKoxGbKoh0OUB1bqbwxiCifQtfFgX6ZTw4lX8HvXmSKUuOKB26mvzcgTGgg_gPqLtPPUalSpbdeNRrpn_JP6zWA',
  transfer_list: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImd6Y1FYcVowd0p6UkdEb01nUDZaRlozQVMza0VZQnhyIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NTAwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjQ0OTA5MTM5MTk3OTkwIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2NDYzNjA4MTE5MzMyIn0.P2Kd8kKLLQzmMTUCSP_FTMRDon6j1tasX43I6e8KFKe6fGnBGoXjy7W-jBJbeyyzOY7lqv1f732gs1miSGjQ2RhUxxfE8gzRNYMFszPigEjIj40dacb8Grg71GpRxTJu0AL__exv1sLa94bYg5sULC7FlbfjElG_WmXWwe1EKFTboL5pb_-MKviMTkgew7sexGYOZGSNtEHYPzc0U9llq0bAx7okP9VmHMU2QVuWWyqf6Zs-8VASH8ucv7c6cs4NOFofJ4tAJbw8n7dzctDmmiCZzAHhuNM8X5zuyUOA3etV_ysm5eXdQYRQOgfHvUXmbzK5VSef7UTCXqMWlySV9w',
  update_pre_file: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIm5ENDFzdHFtdWZiTmRBakdYMnd4ZkFRWHA3WW9GNE1WIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NTEzLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjI5NjM3OTg4NzEyNDg2Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2NTIwMTM0NzU0MzEzIn0.aOaQt_KoN6T3PoR2MVz21L8mBK7cHgYeIsriGG3TAkxHxFLDL5Izc1i3y_BsOTiNjh7GSMBGbDZkg3LoEu1L6t4AzLYr1FdBWUFzU029l8ZdDmNJRiD61hBShGbZ7NVqYeyLTHzAbrsG6EpeEXIXwpbRiq82shm_kx-rmj3dh5P25s-iGn_Ez2dua99nh14t4DQO9qKMEfcP74poR7CUBIfp4Yv7kZVxhkV2IsA1DfyEWRW51JGzZ74_5zT2UiSbXtbaDUZSW37pm8gVnHDjhce77kffCTA8I0Xlqyelbyg01zLc0s0Gja4HSvmGJh93yFOXzJJULcZHOKzoH5oSWA',
  delete_file: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIkRhSjNKN2RIVVNFc3piTENXam50dHd0Zm12UVlWczE0Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NDg0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjQ1NDI1ODI3MTE5MTUwIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2Mzk2NjgzODA0Njc4In0.Xq486dBpLcCM1gWYyB3a0yg1zoSXxJJqBxxnlW9Scqkdr0XRLYYI1rg4kLIhvBmCbBN-iHpPnAO4sV68jww29fy33wKceg99nTcEUiCsbmqHTGGp7elFhvBNojXWcy-gIaUz_TO45KryB8RGOfUzMe3TKXeb0EaVgsryOsWzrJED4zgzyqNrTJYXWHVDeHTgea_mQkh3FV4mBCHM2t84_FpBsaLSQ6_ov0CdkKCL5UZRuayDmKHw3d8t1L0TJp5ssDiSgYNjeybrC9p9gfoleROlqR0EEV7TsdpgCZngOiv5mi-gBc6IsxK7w1rojVivW9YkBsJePwlnZWx8WApUjQ',
  user_balance: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInZvQkd3azZCcmdHY2hDZnBNYklLRlNkQ0lnUUsxMHp6Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyNzg5LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjIwMDgyODM5OTEyNDk0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI0ODIyMjYyODQxMzgwIn0.uxyJe8q0V_o0t163ALtp_411ZQfSzb4_P9PQglLwzk8Av5goAjEWUSa8DhHzSeOroijNzHL8FL5JBHa2Ft9Px5Gs8IWKv2R2dYeVDQ0S7Ll6T8f3vEC5n3EWvp_ciiLRab3vvbAPcNo3M_ObJEkOAy392Zp9lOvC3G3i80DPpzD41fdyhhPGJGB_bxhrSswANyq_N_E4La18ScS-bO3VCAK8EUtHaQurKwILIZXwET9tK-1cC_kUqMF2sZ4JT0qoH_T0C-6uPJo1oFxPxpq61YHt0GAXmZvh1dcgG_XYaOXKRpoaG-cz4zn6brNWhQ2ZVLUGsfk9eGZiXcamdZp-pQ',
  estimate_points: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3ZjhiZGYzLWM0YTQtNDU3Zi04YmFjLTE2OWFmZTZiOTAyNCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIlgzblo3bjlvU1o4WURES1E5cnU5YTd3aGZvRm1NNE03Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczNjgyODAxLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE3OTA1NTkxMDkxOTg2NDg0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE3OTA5NjI2MDc5NTQzMzA2In0.W_EpBPXdkuh4PPdZmoRX9Fyui0N_CMTB5vuX8i9GcRek5HNzPiXsW43JOE9CGzcycVmRIjsiPK7qJgo-ufzLrr3holoS9aD5ifq2PS_UlYXPaCUADwZ5IZqHvHeFP7FDvXe3UYVQ_16lZalWKpwSWXUtnVTigWHc8zLsnQBC8s2QCuO87fY-EealhPp9Luo-WsY4VWZ1ajKY7D0tuJmi7OREx-dienk-dgT-QppqrT3JI8WxMRk-QcXV6AgLvPIgewEU3CP86CgqJkT41PXy0s45c-_M0GPWTtCkLsOueQps6vKMMk2IcnEt0M3wUxM-QzfTXqTqvPaYpR4-L9ACCA',
  cloud_drive_usage: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3ZjhiZGYzLWM0YTQtNDU3Zi04YmFjLTE2OWFmZTZiOTAyNCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIjc1bnJFNFBaSmVMckZoOG1aS2QwTFFuWjNEaldXVkVtIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczNjY2MDI3LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE3ODM0Njg0NjI5NjQ3MzYwIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE3ODM3NTgxOTAzODU1NjUwIn0.ftvGUr_VMfE5Fxr3VTmMcakWD1N_omYaryk69Gf2EYu-G9Z4bdCcLe5sqkvmEXd8qZUuujU0Cf5cfI7gFvJLRr5yldhBy79CQaagwOIZJgugVuhv7n-YRN2TT-sqOXcRZjerntdTQMbRVQTMZKsAnKT-iVbB24ID53NFCDi_rH9PExbgig_a3L40pT3yQQ0u6ZkKGXn5O6LSvYNXgZSNe4nJIYDxEUNz-4_-ZhSs9TKlUQ9c-h_SXcXD-DxFGFdFar5cqswxkw5uo_vsTycI4Or99ImB_Rre6x3E4e7SLK1_MhdApYnApnMr840Moulff1_8CDX9z5CaLY0Zk9G2Kw',
  order_api: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjIwOGMwNTVhLWI2OTUtNGZiMi04OTY2LTMzNTFkNmQ4OWE5MyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIld0eGZvajRqRExnQzExc3h6QTllSWw0QWRHWVE5Q1pCIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczNjkxODU3LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE3OTM0MDgzMjAwMzg1MDY0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE3OTQ4NTE5ODk0MDg5NzgyIn0.EYbkszKUJ3DblQSryNFogsESCSKSkV_dWIlKr30FYcaGwR_8pRXpA7xg7vyA1eUJbUojeX77UR5c5LHO-nWv7gsyjOr22HBWlEtAiWu1wta_YXY7YuW5vdZ9IZZeHPK5IF6UU_8tUrt4nEwi9Bzl0-CL2lNnQQWTYRw2a6TYJDHiLMhigt53TN7wdz5sHKZ2xlhlcOhFUOT_JQS_rCYKZnA4WlZ_4ruhmkpaNudawJJiLRJCtp0xpK1_gki64CbPfar4IFY_R4lCy0h8xSH_JMXwTIZo2xn1JFcQ7pU_1FBPPCJIDk2Qy9gXZTrKg42ZfE3yxB8b6MiOLyffaSJdHQ',
  file_download: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInpDZ21MUW5mUVBya04wSXRMZFF0U0UxeDBFSDlpdml5Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1NDU1LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjI1MTUxOTcwODY5Mjg2Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM2MjczNTM0ODQ0OTI4In0.xJTLxFgQpPk-t4pNaefMpXClH822cLR6ygmHrxmzItAsDjuW04djeTkJsIUcZFDTXAoomrm6bVAN1ZG-slHeGn5Nn0h0fFDxqW-rJGg4vRd5XPlMwNyJxiojtopeTXTksOTbJmK_zf1a3fOnBKL4mjpnyF153KaQIzoXBBnC4RW7VjvIC9cINgNn_VMHu432YyckiqqbYP18oapjwUVQvIdiACKoCXGRZxMKvltKzQlhURQuDLtPRLHYMWOH4YvfFTU8QgwDuUFXTxtjrSBGOFLKJkL8tyl8xCFtRzRq1XB8pEKG_oy_84fAY-mUC7h0mq56WV9kgp3Cb14vse8hjw',
  movie_search: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjYwODNiZjA2LTljNmMtNDFhOS04MmI2LWZmNzY5NzM1NjM0MiJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIm5NRUNDbUt2Yjk5aUdTakc4VDJQQ1BpMVo0b1hJUjhyIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczOTEyNDk5LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE4ODg5NTk2NDY5NzcyMzAzIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE4ODk2MTcxMjM0MjMwMzA2In0.sP3Nk5OspIaVBzBDbINJqqBFNvEYP8wRws8z93eZUMSbxr7lr_nI4Br8Sn9ngyz_-NhP4-vupkBLzyKKOpKE6IxfgmtIFRruC2tk8-u2WmPBZbTqQbT6jjNAMW8Lx1GhncPIsOmqVprXw3QjeVILhRSWBDRul9Ni8LPUkjLpNaooAg6GIehixoeBisMP0Redhr7h8ukgeJOTdnzhEsfz5wgyCPymGjm6voRz6A88C-zIvuq4DaGBPEom_r9DloS-cABnxBIT4P8tykRLEqoFDd0cTv_9NJROwAZUUfYO7NlFxdRHMM6Yxu7FRGO19ncDN3YVe59cIX5gbQnGGC4LtA',
  original_script: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjYwODNiZjA2LTljNmMtNDFhOS04MmI2LWZmNzY5NzM1NjM0MiJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIkcxT210VUIyOTNkaWxnbHZKTGZaQ3VsbTZrdEIwM2tkIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczOTI5NTk3LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE4ODkxMjY5MDM2NTcyNjcyIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE4OTY5NjA4MzAyMTY2MDUxIn0.FSZgYIPY9dsSN9HNnMGKpGPipreO_Bho9nrXX2gyPHgLng_l6Hfl0DFjsYT6JJyeJE0VuRo2nR3uratIbg2JIvKTwK0iuLvTVWWRtbmIRkepZdczOgKZql5Mk_K-Th1-qWxsUvtnhBlZ52UOU6-Ep3oa2Jp7w3CeZwRdP280xgzr3chBOMev1yULybOVmPOwd71HsQdFSgZihSW_AfuhP8auKvdsSWKPZIHc2MaoB4m1et5fMSZWqcyR6Kk6C8XXNfm1VlTg9LOPMqkwsanTWXU6fTrogMuDpFXw7CCSs5emhpPWqqKE-AwS6BuwuwbkgMkAn-z6lmCIEY2NlFrlaQ',
  original_clip: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjYwODNiZjA2LTljNmMtNDFhOS04MmI2LWZmNzY5NzM1NjM0MiJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInRjVmgxUEVUMDdKOU9PQ2k4cWJQakxxb1BUM1pNSjZoIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczOTMxNDUzLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE4OTc0NjI4Nzk0MzM1MjMyIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE4OTc3NTc2ODYyMjIwMzI4In0.Z1rhe4AfJ4vUtFSWLSOsR18E-KePv83EQo-gsf-QlFfNt1OJ6OoOLQSUlb1Fo0YG1HNSTV_7EAczvo45yhdvQ8IgoJgJ_jM7ft-u43Rj3yJBFEegGJYj7MgQSpi-ekAmybZsN1SpYg5caEsfXkKWPR2xQdpEEPc6Yfz2mOFPdlTAm9F0C-vGmtT1Hj7WnzAm5cnUlvYAcLVYRK8psEcyjGv7ktw8PvzL5kiT2qyyh8CBwrNfcfpd_YwTMuK3fxDWJmBX3dKfngFe0JXDLWxmQt1ARllQgnaVMm692S-mT738bGmfZZFShuA4QMoND0lSOvdGO9MVwNIiNyMvpJbehw',
  task_consum_calc: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3ZjhiZGYzLWM0YTQtNDU3Zi04YmFjLTE2OWFmZTZiOTAyNCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImd4bXNERjJnZDduU0RNblBMa3NWanE1MUNzNkNMVWtqIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczNjc2NjUyLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE3ODc3MDQ4NzkwMzUxOTI0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE3ODgzMjE1MTM4NjUyMjAzIn0.nuVJ6F0lVrQlUC_vDiHS75ggOKAnWUg3jpyPby3nb7lcjRLUc-631JPPuv7FfNh0y6vFpFrToP7JtRTDHDFagWM8Yhxy-rHzo5kA93SsPqdzjCkdgZ4r4uIQy5EHEXdEaKn4VLSaXMhpCJ7w_AsM5hxtn4Arx38SqmgEzW1yUeguIrWipOQDsnL21YyX37iLHqpnkFXPOOMrpT_wA-yqrNMNFKyQWNaLkp6Y1eg7DYz4mJt5ocfvu1E4Q1EY2MDDKt4H2-R-hLiH7G6PRbddXFR0OqRjWJ71qVY-oBy3AyqzdR7Iond6oMK_QtDpm_umTZMkQ2c1AG34d5RSbbjaCA'
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

// 获取云盘文件列表（通过 Coze 工作流）
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
  const response = await axios.post('/api/cloud_files/run', {
    app_key: appKey,
    page: String(page),
    page_size: String(pageSize),
    order_by: orderBy,
    order: order,
    search: search
  }, {
    headers: {
      'Authorization': `Bearer ${TOKENS.cloud_files}`,
      'Content-Type': 'application/json'
    }
  });
  // Coze 返回 { api_response: { code, message, data: { items, total_pages, page, ... } } }
  // 兼容 api_response 为 JSON 字符串的情况
  let apiResponse = response.data.api_response;
  if (typeof apiResponse === 'string') {
    try { apiResponse = JSON.parse(apiResponse); } catch (e) { /* ignore */ }
  }
  return apiResponse;
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
  const abortSignal = options?.abortSignal;
  
  while (true) {
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
    
    // 兼容 Coze 返回 api_response 为 JSON 字符串的情况
    if (typeof status!.api_response === 'string') {
      try {
        status!.api_response = JSON.parse(status!.api_response);
      } catch (e) {
        console.warn('api_response 解析失败:', e);
      }
    }
    
    if (onProgress) {
      onProgress(status!);
    }
    
    // 任务状态: 0=初始化, 1=进行中, 2=已完成, 3=已失败, 4=已取消
    const taskStatus = Number(status!.api_response?.data?.status);
    if (taskStatus === 2) {
      return status!;
    }
    if (taskStatus === 3) {
      throw new Error('任务执行失败');
    }
    if (taskStatus === 4) {
      throw new Error('任务已取消');
    }
    if (isNaN(taskStatus)) {
      console.warn('任务状态异常，原始值:', status!.api_response?.data?.status, '完整响应:', JSON.stringify(status!).slice(0, 500));
    }
    
    // 等待间隔，期间检查abort
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      if (abortSignal?.aborted) {
        clearTimeout(timer);
        resolve();
      }
    });
  }
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

// 更新预转存文件关联（直接调 jieshuo API）
export async function updatePreFile(request: IUpdatePreFileRequest): Promise<IUpdatePreFileResponse> {
  const { app_key, ...body } = request;
  const response = await axios.post('/api/v2/files/upload/pre-transfer/edit', body, {
    headers: {
      'app-key': app_key,
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

// 获取用户余额
export async function fetchUserBalance(appKey: string): Promise<any> {
  const response = await axios.post('/api/user_balance/run', {
    app_key: appKey
  }, {
    headers: {
      'Authorization': `Bearer ${TOKENS.user_balance}`,
      'Content-Type': 'application/json'
    }
  });
  // 兼容 balance_data 为 JSON 字符串
  let balanceData = response.data.balance_data;
  if (typeof balanceData === 'string') {
    try { balanceData = JSON.parse(balanceData); } catch (e) { /* ignore */ }
  }
  return balanceData;
}

// 获取云盘用量
export async function fetchCloudDriveUsage(appKey: string): Promise<any> {
  const response = await axios.post('/api/cloud_drive_usage/run', {
    app_key: appKey
  }, {
    headers: {
      'Authorization': `Bearer ${TOKENS.cloud_drive_usage}`,
      'Content-Type': 'application/json'
    }
  });
  // 优先用顶层字段，否则从 api_response.data 取
  const data = response.data;
  return {
    used_size: data.used_size ?? data.api_response?.data?.used_size ?? 0,
    max_size: data.max_size ?? data.api_response?.data?.max_size ?? 0,
    file_count: data.file_count ?? data.api_response?.data?.file_count ?? 0,
    usage_percentage: data.usage_percentage ?? data.api_response?.data?.usage_percentage ?? 0
  };
}

// 获取文件下载地址
export async function fetchFileDownloadUrl(appKey: string, fileId: string): Promise<string> {
  const response = await axios.post('/api/file_download/run', {
    app_key: appKey,
    file_id: fileId
  }, {
    headers: {
      'Authorization': `Bearer ${TOKENS.file_download}`,
      'Content-Type': 'application/json'
    }
  });
  const data = response.data;
  const url = data?.response_data?.data?.download_url || data?.download_url || '';
  if (!url) throw new Error('获取下载地址失败');
  return url;
}

// 预估点数
export async function estimatePoints(request: IEstimatePointsRequest): Promise<IEstimatePointsResponse> {
  const response = await axios.post('/api/estimate_points/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.estimate_points}`,
      'Content-Type': 'application/json'
    }
  });
  let apiResponse = response.data?.api_response;
  if (typeof apiResponse === 'string') {
    try { apiResponse = JSON.parse(apiResponse); } catch (e) { /* ignore */ }
  }
  return apiResponse || response.data;
}

// 单任务点数计算（分段交付确认时预估下一步点数）
export async function taskConsumCalcPoints(request: ITaskConsumCalcRequest): Promise<ITaskConsumCalcResponse> {
  const response = await axios.post('/api/task_consum_calc_points/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.task_consum_calc}`,
      'Content-Type': 'application/json'
    }
  });
  let apiResponse = response.data?.api_response;
  if (typeof apiResponse === 'string') {
    try { apiResponse = JSON.parse(apiResponse); } catch (e) { /* ignore */ }
  }
  return apiResponse || response.data;
}

// 创建原创文案任务
export async function generateOriginalScript(request: IOriginalScriptRequest): Promise<ITaskResponse> {
  const response = await axios.post('/api/original_script/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.original_script}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 创建原创文案剪辑任务
export async function generateOriginalClip(request: IOriginalClipRequest): Promise<ITaskResponse> {
  const response = await axios.post('/api/original_clip/run', request, {
    headers: {
      'Authorization': `Bearer ${TOKENS.original_clip}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
}

// 搜索电影信息（用于原创文案 confirmed_movie_json）
export async function searchMovies(appKey: string, query: string): Promise<IMovieSearchResult[]> {
  const response = await axios.post('/api/movie_search/run', {
    app_key: appKey,
    query: query
  }, {
    headers: {
      'Authorization': `Bearer ${TOKENS.movie_search}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data?.movie_list || [];
}
