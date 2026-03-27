import axios from 'axios';
import { IMovie } from '../types';

const API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInJJSFJDY0VHdGJLMzh4ZTBhRUdXSW5ldTZzMHVsdDFSIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyNzM3LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1OTg3NjA0MjA2NzgwNDQyIiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI0NTk2MTM5NTI0MTA2In0.kea_PBL5obu6dsWwJSgvJ6V7TIIGRNbcfbieblHXv-HbC0ZItYijcFMH4a5H4ODco0ovgR8v7i714b6Vcu-C1FDvBenosUeVyJlbhee9x_sgJ_0COVRD7Kt_MWZmqPJ1M1eRQiyEeeJCl8aPPgFpP0ky1e_VkEWW8nIeTpCH0VF40E0KIJG1lqnfTnrix1BTQnDRXEUVDkxQHb2i_dgM2PehBpMfSKzS7JC-Ark9GJCC-NIwCsjb1TiXRw7UQ3U6OIWQc-tQAzGnzO8rfGg6ECpDaSKysBCfioxCYyJxuJMGhkyniUPkcDpiuu1O8gI_pTmE-TCxjudUmNv1tnU5cA';

export async function fetchMovies(appKey: string): Promise<IMovie[]> {
  const response = await axios.post('/api/movies/run', {
    api_key: appKey
  }, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.data.found && response.data.query_result) {
    return response.data.query_result;
  }
  return [];
}
