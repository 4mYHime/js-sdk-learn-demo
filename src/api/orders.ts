// 订单管理 API - 通过统一 endpoint 调用后端
import axios from 'axios';
import { TOKENS } from './tasks';
import { normalizeOrderFromBackend, serializeOrderForBackend } from '../orderData';

const ORDER_API_URL = '/api/order_api/run';

// 清理订单数据：去掉后端自动管理的字段，避免冲突
function cleanOrderData(order: any): any {
  return serializeOrderForBackend(order);
}

function cleanTaskData(task: any): any {
  const { createdAt, completedAt, ...rest } = task;
  return rest;
}

async function callOrderApi(operation: string, params: any): Promise<any> {
  const response = await axios.post(ORDER_API_URL, { operation, params }, {
    headers: {
      'Authorization': `Bearer ${TOKENS.order_api}`,
      'Content-Type': 'application/json'
    }
  });
  const data = response.data;
  // 处理 response_data 可能是字符串的情况
  let responseData = data?.response_data;
  if (typeof responseData === 'string') {
    try { responseData = JSON.parse(responseData); } catch (e) { /* ignore */ }
  }
  if (data?.is_success === false) {
    throw new Error(data?.error_message || '操作失败');
  }
  return responseData;
}

// 1. 获取用户订单列表
export async function apiListOrders(appKey: string): Promise<any[]> {
  const res = await callOrderApi('list_orders', { app_key: appKey });
  return Array.isArray(res?.data) ? res.data.map(normalizeOrderFromBackend) : [];
}

// 2. 获取单个订单
export async function apiGetOrder(orderId: string): Promise<any | null> {
  try {
    const res = await callOrderApi('get_order', { order_id: orderId });
    return res?.data ? normalizeOrderFromBackend(res.data) : null;
  } catch {
    return null;
  }
}

// 3. 创建/保存订单 (upsert)
export async function apiSaveOrder(orderData: any): Promise<void> {
  const cleaned = cleanOrderData(orderData);
  await callOrderApi('create_order', { order_data: cleaned });
}

// 4. 更新订单状态
export async function apiUpdateStatus(orderId: string, status: string, errorMessage?: string): Promise<void> {
  await callOrderApi('update_status', {
    order_id: orderId,
    status,
    error_message: errorMessage || ''
  });
}

// 5. 更新子任务
export async function apiUpdateTask(orderId: string, taskData: any): Promise<void> {
  const cleaned = cleanTaskData(taskData);
  await callOrderApi('update_task', {
    order_id: orderId,
    task_data: cleaned
  });
}

// 6. 删除订单
export async function apiDeleteOrder(orderId: string): Promise<void> {
  await callOrderApi('delete_order', { order_id: orderId });
}
