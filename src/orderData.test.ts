// @ts-nocheck
import assert from 'node:assert/strict';
import { normalizeOrderFromBackend, serializeOrderForBackend } from './orderData.ts';

const backendOrder = {
  id: 'order_1',
  appKey: 'app_1',
  status: 'script',
  tasks: [],
  episodes_data: [
    {
      num: 1,
      srt_oss_key: 'srt-1',
      video_oss_key: 'video-1',
      negative_oss_key: 'video-1'
    },
    {
      num: 2,
      srt_oss_key: 'srt-2',
      video_oss_key: 'video-2',
      negative_oss_key: 'video-2'
    }
  ],
  confirmed_movie_json: {
    title: 'Demo'
  }
};

const normalized = normalizeOrderFromBackend(backendOrder);

assert.equal(normalized.episodesData.length, 2);
assert.equal(normalized.episodesData[1].srt_oss_key, 'srt-2');
assert.deepEqual(normalized.confirmedMovieJson, { title: 'Demo' });

const order = {
  id: 'order_2',
  appKey: 'app_2',
  targetPlatform: '抖音',
  confirmedMovieJson: { title: 'Demo' },
  episodesData: [
    {
      num: 1,
      srt_oss_key: 'srt-1',
      video_oss_key: 'video-1',
      negative_oss_key: 'video-1'
    }
  ],
  createdAt: 1,
  updatedAt: 2
};

const serialized = serializeOrderForBackend(order);

assert.equal(serialized.createdAt, undefined);
assert.equal(serialized.updatedAt, undefined);
assert.deepEqual(serialized.episodesData, order.episodesData);
assert.equal(serialized.episodes_data, undefined);
assert.deepEqual(serialized.confirmedMovieJson, order.confirmedMovieJson);
assert.equal(serialized.confirmed_movie_json, undefined);
assert.equal(serialized.target_platform, '抖音');

console.log('orderData tests passed');
