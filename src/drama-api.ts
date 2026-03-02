import axios from 'axios';

export interface IDramaItem {
  id: number;
  code: string | null;
  name: string;
  learning_model_id: string;
  info: string | null;
  remark: string | null;
  type: string;
  narrator_type: string | null;
  name_time: string;
  time: string | null;
  model_version: string | null;
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
  collection_time: string | null;
}

export interface IDramaApiResponse {
  found: boolean;
  query_result: IDramaItem[];
  run_id: string;
}

const API_URL = '/api/drama/run';
const API_TOKEN = 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInhvOEFnWll6OXNwU2xEWjFTZ0owNnJDNXdTQWpudVNuIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyODIxLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1ODEzODExMTQ0MzU5OTYzIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI0OTYwNjgzMjYxOTY3In0.WunAsGHKWQCYqpRzvjQxoy5ETV1u2aEsSrL7xtVb54H7bgv7UktPJCf8BPta-XCKLHA5uqxpR7xo0B0JQgDyjEDFNkzfFeU3XshokqWmWAIp91T6wlhBX-_j0xkAe2bUZTjaRN3KS4q9oT0aJzHOe0MiO_KJ8Vcq2MyKvo0r786x5uauIoasg_8bPiHDVIoJHcsfT7x3XwysUCnVQRNd5aO-ofPYultEZ_odUQ5oi2JBEtbAHEVoPwIT-SKt2Y75VaXknD7_-Yq5V25kwKyot9wYCWKzXFccsuJDiAgeDnLKf0sNOWRMU36kMGa8-eAPrKjE1RXys1SRf4R70KA0XA';

export async function fetchDramaOptions(): Promise<IDramaItem[]> {
  try {
    const response = await axios.post<IDramaApiResponse>(
      API_URL,
      {
        type: null,
        narrator_type: 'movie',
        model_version: 'standard',
      },
      {
        headers: {
          Authorization: API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.found && response.data.query_result) {
      return response.data.query_result;
    }
    return [];
  } catch (error) {
    console.error('Error fetching drama options:', (error as any).message);
    throw error;
  }
}
