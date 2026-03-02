import axios from 'axios';

export interface IFileItem {
  file_id: string;
  file_name: string;
  file_size: number;
  suffix: string;
  category: number;
  completed_time: string;
  created_at: string;
  srt_line: string | null;
}

export interface IFilesApiResponse {
  api_response: {
    code: number;
    message: string;
    data: {
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
      items: IFileItem[];
    };
  };
  run_id: string;
}

const API_URL = '/api/files/run';
const API_TOKEN = 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInJiR2lLcEhCTTBTeWNwZlRqbHBzWGg4YzN1M1dINXM0Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQ1MzkwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NjIyODMwMTc2MTQxMzU4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzM1OTk0NTkyNjU3NDU4In0.mgwZokIpTjN0RD5bgOdj_ukH8YfL3XXjokzbqqPpQOE3RgjfUICHscSQQ0ArTWHsLxckrwU31E9_e0ECL_CCD71zpLFY32wHyP3oVJs_0RCbQSsLqf0Zk0jSPbPzcV9-JAFHWbKgUIjdJLwuMDpwPd6ji1BNRBeFglYpa5Rm5CZTqsM7MKxaS0rm-dZFfutdEweoPjJKDodbqVKBoTKXH5HJxpoUVdUwlNZsyEQkGkGV8nu6Uh4-GMLSeo_CYFIp1os2Nrdzi9Kbx8Cs3KtDDPUIcDzF4W0CoI37cbd_U0FxhaTMIQEjsris0c_nW4xdn2xdXvouULiBnV-kv1hkBg';

export interface IEpisodeConfig {
  num: number;
  srt_oss_key: string;
  video_oss_key: string;
  negative_oss_key: string;
}

export async function fetchFileList(appKey: string, page: number = 1, pageSize: number = 100): Promise<IFileItem[]> {
  try {
    const response = await axios.post<IFilesApiResponse>(
      API_URL,
      {
        app_key: appKey,
        page: String(page),
        page_size: String(pageSize),
      },
      {
        headers: {
          'Authorization': API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.api_response?.code === 10000) {
      return response.data.api_response.data.items || [];
    }
    
    console.error('API返回错误:', response.data.api_response?.message);
    return [];
  } catch (error) {
    console.error('获取文件列表失败:', error);
    throw error;
  }
}

// 根据suffix过滤文件
export function filterSrtFiles(files: IFileItem[]): IFileItem[] {
  return files.filter(f => f.suffix === 'srt');
}

export function filterVideoFiles(files: IFileItem[]): IFileItem[] {
  return files.filter(f => ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(f.suffix.toLowerCase()));
}

// 生成episodes_data JSON
export function generateEpisodesJson(episodes: { srtFileId: string; videoFileId: string }[]): IEpisodeConfig[] {
  return episodes.map((ep, index) => ({
    num: index + 1,
    srt_oss_key: ep.srtFileId,
    video_oss_key: ep.videoFileId,
    negative_oss_key: ep.videoFileId,
  }));
}
