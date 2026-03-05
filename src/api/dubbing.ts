import axios from 'axios';
import { IDubbing } from '../types';

const API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjcwMTQyY2UwLWFiZGQtNDFhMy04Yzk0LWM3NGU5ZGNmNWJiNyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImN1SnY2RzU4OXJWWVB6R0hmYUlQWG01RmtObDdEcU9QIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzcyMjQyODc0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjA1NzgzNjMwOTQ5OTA4NTE4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjExNzI1MTg0OTAyMzY1MjM1In0.YRbBa1opvvE8iWPjd_ApI8XqBRxQZ3mDpgh4hoH8ef4s4QOrp-R2Wh5Sez4T7X209_4nS8RxyBbTvcaA8mJ9shyKxK6Ix85os9wyY440MvviOHt8CQsoE4ymqDKYcNLHXZiYpWL-GU480Wi08nvNlq95T587dHMvIYN-62ttvNnvD36SdBEjojxAy578hpxmTlNwnWvJHd6cFXf1F8XqTIjJpGy_AU2q3gIbjiJ4mcjhofd0FZETEfWGc2iG7eQiZtPua7EGbO8hItM2fWLT45py9HrdqCfCPAZpm_Tfj0IIhP77RyEvFSojjC48qqKIus9QcemvU7UZ2eL1seLceg';

export async function fetchDubbingList(): Promise<IDubbing[]> {
  const response = await axios.post('/api/dubbing/run', {}, {
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
