import axios from 'axios';
import { IBGM } from '../types';

const API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIlRwSk9ENDdvUzNpVzh2VjBtS1Vhbjl0WWRRSDdxRlZ2Il0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyODU1LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1ODAzNzI2MzY3ODgzMjc0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI1MTA0MzM0MzA3Mzc4In0.G60E-5lJUIEw65hCCvw1woNCTAakvn82fv0untgQYxBYGDVNO4VivYoZTaEBuiZCo14JsjS1pAsjhM17HuELqDsHzvg0najLGs8SD3LbjeflAEJcNVgYlZ1GltXujgyYjPD5QxsmjDn4tUWHAFdUC7ldWFoVuNAJqpwWKd_5VKEfKJacW2OfOhKI4nfO7gZ96qk4damkmjly1d8Hnj5JCS_0AysufCbXXeNys2uc_iNyhEqxhiUXJQIZhWGAOrbZmN3GoaJZGH8xykFC2yVdLFvvngXmisruLTKKvL7Iag1rnAHVL18FSwYE5P_ykU7CuL7AQge-L29aTs15BV7ziQ';

export async function fetchBGMList(): Promise<IBGM[]> {
  const response = await axios.post('/api/bgm/run', {}, {
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
