// 订单和任务数据存储模块
import { apiListOrders, apiSaveOrder } from './api/orders';

// 后端同步：fire-and-forget，不阻塞前端操作
function syncToBackend(fn: () => Promise<any>) {
  fn().catch(err => console.warn('[DB Sync]', err?.message || err));
}

// 子任务类型
export type TaskType = 'viral_learn' | 'script' | 'clip' | 'video' | 'original_script' | 'original_clip';
export type TaskStatus = 'pending' | 'running' | 'done' | 'error' | 'wait_confirm';
export type DeliveryMode = 'oneStop' | 'staged';
export type OrderStatus = 'pending' | 'viral_learn' | 'script' | 'clip' | 'video' | 'original_script' | 'original_clip' | 'done' | 'error';

// 子任务
export interface ITask {
  type: TaskType;
  taskId: string;
  orderNum: string;
  status: TaskStatus;
  pollCount: number;
  elapsedTime: number;
  result: any;
  errorMessage: string;
  createdAt: number;
  completedAt: number | null;
}

// 解说订单
export interface IOrder {
  id: string;
  appKey: string;
  movieId: number;
  movieName: string;
  movieSource: 'existing' | 'custom';
  templateId: string;
  templateName: string;
  templateSource: 'existing' | 'generate';
  bgmId: string;
  bgmName: string;
  dubbingId: string;
  dubbingName: string;
  targetPlatform: string;
  targetCharacterName: string;
  vendorRequirements: string;
  storyInfo: string;
  deliveryMode: DeliveryMode;
  videoPath: string;
  videoSrtPath: string;
  viralSrtPath: string;
  narratorType: string;
  modelVersion: string;
  learningModelId: string;
  episodesData: Array<{ num: number; srt_oss_key: string; video_oss_key: string; negative_oss_key: string }>;
  copywritingType: 'secondary' | 'original';
  originalMode: '2' | '3' | '';
  originalLanguage: string;
  originalModel: 'flash' | 'standard';
  confirmedMovieJson: import('./types').IMovieSearchResult | null;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  tasks: ITask[];
  videoUrl: string;
  errorMessage: string;
}

// 生成唯一ID
export function generateOrderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 存储键
const STORAGE_KEY = 'narration_orders';
const USER_KEY = 'narration_user';

// 获取当前用户
export function getCurrentUser(): string | null {
  return localStorage.getItem(USER_KEY);
}

// 设置当前用户
export function setCurrentUser(appKey: string): void {
  localStorage.setItem(USER_KEY, appKey);
}

// 登出
export function logout(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

// 获取所有订单
export function getAllOrders(): IOrder[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// 获取当前用户的订单
export function getUserOrders(appKey: string): IOrder[] {
  return getAllOrders().filter(order => order.appKey === appKey);
}

// 获取单个订单
export function getOrder(orderId: string): IOrder | null {
  const orders = getAllOrders();
  return orders.find(o => o.id === orderId) || null;
}

// 保存订单
export function saveOrder(order: IOrder): void {
  const orders = getAllOrders();
  const index = orders.findIndex(o => o.id === order.id);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.unshift(order); // 新订单放在最前面
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  syncToBackend(() => apiSaveOrder(order));
}

// 更新订单状态
export function updateOrderStatus(orderId: string, status: OrderStatus, errorMessage?: string): void {
  const order = getOrder(orderId);
  if (order) {
    order.status = status;
    order.updatedAt = Date.now();
    if (errorMessage !== undefined) {
      order.errorMessage = errorMessage;
    }
    const orders = getAllOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index >= 0) orders[index] = order; else orders.unshift(order);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    syncToBackend(() => apiSaveOrder(order));
  }
}

// 更新订单中的任务
export function updateOrderTask(orderId: string, task: ITask): void {
  const order = getOrder(orderId);
  if (order) {
    const taskIndex = order.tasks.findIndex(t => t.type === task.type);
    if (taskIndex >= 0) {
      order.tasks[taskIndex] = task;
    } else {
      order.tasks.push(task);
    }
    order.updatedAt = Date.now();
    const orders = getAllOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index >= 0) orders[index] = order; else orders.unshift(order);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    syncToBackend(() => apiSaveOrder(order));
  }
}

// 设置订单视频URL
export function setOrderVideoUrl(orderId: string, videoUrl: string): void {
  const order = getOrder(orderId);
  if (order) {
    order.videoUrl = videoUrl;
    order.status = 'done';
    order.updatedAt = Date.now();
    const orders = getAllOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index >= 0) orders[index] = order; else orders.unshift(order);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    syncToBackend(() => apiSaveOrder(order));
  }
}

// 创建新订单
export function createOrder(params: {
  appKey: string;
  movieId: number;
  movieName: string;
  movieSource?: 'existing' | 'custom';
  templateId: string;
  templateName: string;
  templateSource?: 'existing' | 'generate';
  bgmId: string;
  bgmName: string;
  dubbingId: string;
  dubbingName: string;
  targetPlatform: string;
  targetCharacterName?: string;
  vendorRequirements?: string;
  storyInfo?: string;
  deliveryMode: DeliveryMode;
  videoPath?: string;
  videoSrtPath?: string;
  viralSrtPath?: string;
  narratorType?: string;
  modelVersion?: string;
  episodesData?: Array<{ num: number; srt_oss_key: string; video_oss_key: string; negative_oss_key: string }>;
  copywritingType?: 'secondary' | 'original';
  originalMode?: '2' | '3' | '';
  originalLanguage?: string;
  originalModel?: 'flash' | 'standard';
  confirmedMovieJson?: import('./types').IMovieSearchResult | null;
}): IOrder {
  const order: IOrder = {
    id: generateOrderId(),
    appKey: params.appKey,
    movieId: params.movieId,
    movieName: params.movieName,
    movieSource: params.movieSource || 'existing',
    templateId: params.templateId,
    templateName: params.templateName,
    templateSource: params.templateSource || 'existing',
    bgmId: params.bgmId,
    bgmName: params.bgmName,
    dubbingId: params.dubbingId,
    dubbingName: params.dubbingName,
    targetPlatform: params.targetPlatform,
    targetCharacterName: params.targetCharacterName || '',
    vendorRequirements: params.vendorRequirements || '',
    storyInfo: params.storyInfo || '',
    deliveryMode: params.deliveryMode,
    videoPath: params.videoPath || '',
    videoSrtPath: params.videoSrtPath || '',
    viralSrtPath: params.viralSrtPath || '',
    narratorType: params.narratorType || '',
    modelVersion: params.modelVersion || '',
    learningModelId: '',
    episodesData: params.episodesData || [],
    copywritingType: params.copywritingType || 'secondary',
    originalMode: params.originalMode || '',
    originalLanguage: params.originalLanguage || '',
    originalModel: params.originalModel || 'flash',
    confirmedMovieJson: params.confirmedMovieJson || null,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tasks: [],
    videoUrl: '',
    errorMessage: ''
  };
  saveOrder(order);
  return order;
}

// 删除订单（仅删除本地）
export function deleteOrder(orderId: string): void {
  const orders = getAllOrders().filter(o => o.id !== orderId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

// 从后端加载订单到localStorage（以后端数据为准）
export async function loadOrdersFromBackend(appKey: string): Promise<IOrder[]> {
  try {
    const backendOrders = await apiListOrders(appKey);
    if (Array.isArray(backendOrders) && backendOrders.length > 0) {
      // 以后端数据为准，直接覆盖本地
      const sorted = (backendOrders as IOrder[]).sort((a, b) => b.createdAt - a.createdAt);
      // 写入localStorage（替换该用户的所有订单）
      const otherOrders = getAllOrders().filter(o => o.appKey !== appKey);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...sorted, ...otherOrders]));
      return sorted;
    }
    // 后端无数据时清空本地该用户订单
    const otherOrders = getAllOrders().filter(o => o.appKey !== appKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(otherOrders));
    return [];
  } catch (err) {
    console.warn('[DB Load]', err);
    return getUserOrders(appKey);
  }
}

// 格式化时间
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 格式化耗时
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}分${secs}秒`;
}

// 获取状态文字
export function getStatusText(status: OrderStatus | TaskStatus): string {
  const map: Record<string, string> = {
    pending: '待处理',
    viral_learn: '生成爆款模型中',
    script: '生成文案中',
    clip: '生成剪辑中',
    video: '合成视频中',
    original_script: '原创文案生成中',
    original_clip: '原创文案剪辑中',
    running: '执行中',
    wait_confirm: '待确认',
    done: '已完成',
    error: '失败'
  };
  return map[status] || status;
}

// 获取状态颜色
export function getStatusColor(status: OrderStatus | TaskStatus): string {
  const map: Record<string, string> = {
    pending: '#999',
    viral_learn: '#eb2f96',
    script: '#1890ff',
    clip: '#52c41a',
    video: '#722ed1',
    original_script: '#13c2c2',
    original_clip: '#2f54eb',
    running: '#1890ff',
    wait_confirm: '#fa8c16',
    done: '#52c41a',
    error: '#ff4d4f'
  };
  return map[status] || '#999';
}
