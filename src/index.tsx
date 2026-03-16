import React, { useEffect, useState, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { Steps, Button, Card, List, Avatar, Alert, Select, Input, Spin, Result, Tag, Empty, Radio, message, Tooltip } from 'antd';
import { IMovie, INarratorTemplate, IBGM, IDubbing, IEpisodeData, ICloudFile, IPreUploadFile, IPreUploadResponse } from './types';
import { fetchMovies } from './api/movies';
import { fetchTemplates } from './api/templates';
import { fetchBGMList } from './api/bgm';
import { fetchDubbingList } from './api/dubbing';
import { generateScript, generateClip, synthesizeVideo, generateViralModel, fetchCloudFiles, fetchCloudFilesDirect, pollTaskUntilComplete, preUpload, uploadTask, fetchTransferList, deleteFile } from './api/tasks';
import {
  IOrder, ITask, TaskType, OrderStatus, DeliveryMode,
  getCurrentUser, setCurrentUser, logout,
  getUserOrders, getOrder, createOrder, saveOrder,
  updateOrderStatus, updateOrderTask, setOrderVideoUrl,
  formatTime, formatDuration, getStatusText, getStatusColor
} from './store';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LoadApp/>
  </React.StrictMode>
)

// 页面类型
type PageType = 'login' | 'orders' | 'detail' | 'create';
// 任务阶段
type TaskPhase = 'idle' | 'script' | 'clip' | 'video' | 'done' | 'error';

function LoadApp() {
  // 页面和用户状态
  const [page, setPage] = useState<PageType>('login');
  const [appKey, setAppKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [currentOrder, setCurrentOrder] = useState<IOrder | null>(null);
  const pollingRef = useRef<boolean>(false);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  
  // 步骤状态
  const [currentStep, setCurrentStep] = useState(0);
  
  // Step 1: 电影数据
  const [movies, setMovies] = useState<IMovie[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<IMovie | null>(null);
  
  // Step 2: 模板数据
  const [templates, setTemplates] = useState<INarratorTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<INarratorTemplate | null>(null);
  
  // Step 0 (自定义电影): episode 文件选择
  const [episodeFileStep, setEpisodeFileStep] = useState<'srt' | 'video'>('srt');
  const [episodeSrtFiles, setEpisodeSrtFiles] = useState<ICloudFile[]>([]);
  const [episodeSrtFilesLoading, setEpisodeSrtFilesLoading] = useState(false);
  const [episodeSrtFilesPage, setEpisodeSrtFilesPage] = useState(1);
  const [episodeSrtFilesTotalPages, setEpisodeSrtFilesTotalPages] = useState(1);
  const [episodeVideoFiles, setEpisodeVideoFiles] = useState<ICloudFile[]>([]);
  const [episodeVideoFilesLoading, setEpisodeVideoFilesLoading] = useState(false);
  const [episodeVideoFilesPage, setEpisodeVideoFilesPage] = useState(1);
  const [episodeVideoFilesTotalPages, setEpisodeVideoFilesTotalPages] = useState(1);
  const [selectedEpisodeSrtFile, setSelectedEpisodeSrtFile] = useState<ICloudFile | null>(null);
  const [selectedEpisodeVideoFile, setSelectedEpisodeVideoFile] = useState<ICloudFile | null>(null);
  const [customMovieName, setCustomMovieName] = useState('');

  // Step 1 (自定义模板): 爆款SRT文件选择 + 爆款模型配置
  const [viralSrtFiles, setViralSrtFiles] = useState<ICloudFile[]>([]);
  const [viralSrtFilesLoading, setViralSrtFilesLoading] = useState(false);
  const [viralSrtFilesPage, setViralSrtFilesPage] = useState(1);
  const [viralSrtFilesTotalPages, setViralSrtFilesTotalPages] = useState(1);
  const [selectedViralSrtFile, setSelectedViralSrtFile] = useState<ICloudFile | null>(null);
  const [narratorType, setNarratorType] = useState('movie');
  const [modelVersion, setModelVersion] = useState('standard');
  
  // Step 2: BGM和配音数据
  const [bgmList, setBgmList] = useState<IBGM[]>([]);
  const [dubbingList, setDubbingList] = useState<IDubbing[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [selectedBGM, setSelectedBGM] = useState<IBGM | null>(null);
  const [selectedDubbing, setSelectedDubbing] = useState<IDubbing | null>(null);

  // Step 2 (自定义BGM): 云盘文件选择
  const [customBgmFiles, setCustomBgmFiles] = useState<ICloudFile[]>([]);
  const [customBgmFilesLoading, setCustomBgmFilesLoading] = useState(false);
  const [customBgmFilesPage, setCustomBgmFilesPage] = useState(1);
  const [customBgmFilesTotalPages, setCustomBgmFilesTotalPages] = useState(1);
  const [selectedCustomBgmFile, setSelectedCustomBgmFile] = useState<ICloudFile | null>(null);

  // Step 2 (自定义配音): 云盘文件选择
  const [customDubbingFiles, setCustomDubbingFiles] = useState<ICloudFile[]>([]);
  const [customDubbingFilesLoading, setCustomDubbingFilesLoading] = useState(false);
  const [customDubbingFilesPage, setCustomDubbingFilesPage] = useState(1);
  const [customDubbingFilesTotalPages, setCustomDubbingFilesTotalPages] = useState(1);
  const [selectedCustomDubbingFile, setSelectedCustomDubbingFile] = useState<ICloudFile | null>(null);
  const [targetPlatform, setTargetPlatform] = useState('抖音短视频平台');
  const [targetCharacterName, setTargetCharacterName] = useState('');
  const [vendorRequirements, setVendorRequirements] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('staged');
  const [bgmListExpanded, setBgmListExpanded] = useState(true);
  const [dubbingListExpanded, setDubbingListExpanded] = useState(true);
  
  // 上传文件相关状态
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadLink, setUploadLink] = useState('');
  const [uploadTag, setUploadTag] = useState('');
  const [uploadTypeTag, setUploadTypeTag] = useState('电影');
  const [uploadStep, setUploadStep] = useState<'input' | 'preview' | 'uploading' | 'transfers'>('input');
  const [preUploadLoading, setPreUploadLoading] = useState(false);
  const [preUploadResult, setPreUploadResult] = useState<IPreUploadResponse | null>(null);
  const [preUploadUploadId, setPreUploadUploadId] = useState('');
  const [uploadTaskLoading, setUploadTaskLoading] = useState(false);
  const [transferList, setTransferList] = useState<any[]>([]);
  const [transferListLoading, setTransferListLoading] = useState(false);
  const [transferListTotal, setTransferListTotal] = useState(0);
  const [transferListPage, setTransferListPage] = useState(1);
  const transferPollingRef = useRef<NodeJS.Timeout | null>(null);

  // 音频试听状态
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  
  // 播放/暂停试听音频
  const toggleAudio = useCallback((url: string | null) => {
    if (!url) return;
    
    if (playingAudioUrl === url) {
      // 正在播放同一个，暂停
      audioRef.current?.pause();
      setPlayingAudioUrl(null);
    } else {
      // 播放新的
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudioUrl(null);
      audio.onerror = () => {
        message.error('音频加载失败');
        setPlayingAudioUrl(null);
      };
      audio.play();
      audioRef.current = audio;
      setPlayingAudioUrl(url);
    }
  }, [playingAudioUrl]);
  
  // 组件卸载时停止音频
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);
  
  // 任务执行状态（仅用于创建页）
  const [taskPhase, setTaskPhase] = useState<TaskPhase>('idle');
  const [taskMessage, setTaskMessage] = useState('');
  const [retryingTaskType, setRetryingTaskType] = useState<TaskType | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // 加载电影列表
  const loadMovies = useCallback(async () => {
    setMoviesLoading(true);
    try {
      const data = await fetchMovies(appKey);
      setMovies(data);
    } catch (error) {
      console.error('加载电影失败:', error);
    } finally {
      setMoviesLoading(false);
    }
  }, [appKey]);
  
  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('加载模板失败:', error);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);
  
  // 加载 episode SRT 文件列表（search=srt）
  const loadEpisodeSrtFiles = useCallback(async (page: number = 1) => {
    setEpisodeSrtFilesLoading(true);
    try {
      const res = await fetchCloudFilesDirect(appKey, { page, pageSize: 20, search: 'srt' });
      setEpisodeSrtFiles(res.data.items);
      setEpisodeSrtFilesTotalPages(res.data.total_pages);
      setEpisodeSrtFilesPage(res.data.page);
    } catch (error) {
      console.error('加载SRT文件失败:', error);
    } finally {
      setEpisodeSrtFilesLoading(false);
    }
  }, [appKey]);

  // 加载 episode 视频文件列表（order_by=file_size, desc）
  const loadEpisodeVideoFiles = useCallback(async (page: number = 1) => {
    setEpisodeVideoFilesLoading(true);
    try {
      const res = await fetchCloudFilesDirect(appKey, { page, pageSize: 20, orderBy: 'file_size', order: 'desc' });
      setEpisodeVideoFiles(res.data.items);
      setEpisodeVideoFilesTotalPages(res.data.total_pages);
      setEpisodeVideoFilesPage(res.data.page);
    } catch (error) {
      console.error('加载视频文件失败:', error);
    } finally {
      setEpisodeVideoFilesLoading(false);
    }
  }, [appKey]);

  // 加载爆款 SRT 文件列表（search=srt，用于自定义模板）
  const loadViralSrtFiles = useCallback(async (page: number = 1) => {
    setViralSrtFilesLoading(true);
    try {
      const res = await fetchCloudFilesDirect(appKey, { page, pageSize: 20, search: 'srt' });
      setViralSrtFiles(res.data.items);
      setViralSrtFilesTotalPages(res.data.total_pages);
      setViralSrtFilesPage(res.data.page);
    } catch (error) {
      console.error('加载爆款SRT文件失败:', error);
    } finally {
      setViralSrtFilesLoading(false);
    }
  }, [appKey]);

  // 加载自定义 BGM 云盘文件列表
  const loadCustomBgmFiles = useCallback(async (page: number = 1) => {
    setCustomBgmFilesLoading(true);
    try {
      const res = await fetchCloudFilesDirect(appKey, { page, pageSize: 20 });
      setCustomBgmFiles(res.data.items);
      setCustomBgmFilesTotalPages(res.data.total_pages);
      setCustomBgmFilesPage(res.data.page);
    } catch (error) {
      console.error('加载自定义BGM文件失败:', error);
    } finally {
      setCustomBgmFilesLoading(false);
    }
  }, [appKey]);

  // 加载自定义配音云盘文件列表
  const loadCustomDubbingFiles = useCallback(async (page: number = 1) => {
    setCustomDubbingFilesLoading(true);
    try {
      const res = await fetchCloudFilesDirect(appKey, { page, pageSize: 20 });
      setCustomDubbingFiles(res.data.items);
      setCustomDubbingFilesTotalPages(res.data.total_pages);
      setCustomDubbingFilesPage(res.data.page);
    } catch (error) {
      console.error('加载自定义配音文件失败:', error);
    } finally {
      setCustomDubbingFilesLoading(false);
    }
  }, [appKey]);
  
  // 加载BGM和配音
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const [bgms, dubbings] = await Promise.all([
        fetchBGMList(),
        fetchDubbingList()
      ]);
      setBgmList(bgms);
      setDubbingList(dubbings);
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setConfigLoading(false);
    }
  }, []);
  
  // 初始化：检查登录状态
  useEffect(() => {
    const savedUser = getCurrentUser();
    if (savedUser) {
      setAppKey(savedUser);
      setOrders(getUserOrders(savedUser));
      setPage('orders');
    }
  }, []);
  
  // 登录
  const handleLogin = () => {
    if (!appKey.trim()) {
      setLoginError('请输入App Key');
      return;
    }
    if (!appKey.startsWith('grid_')) {
      setLoginError('App Key格式不正确，应以grid_开头');
      return;
    }
    setCurrentUser(appKey);
    setOrders(getUserOrders(appKey));
    setPage('orders');
    setLoginError('');
  };
  
  // 登出
  const handleLogout = () => {
    logout();
    setAppKey('');
    setOrders([]);
    setPage('login');
  };
  
  // 刷新订单列表
  const refreshOrders = () => {
    setOrders(getUserOrders(appKey));
  };
  
  // 查看订单详情
  const viewOrderDetail = (orderId: string) => {
    const order = getOrder(orderId);
    if (order) {
      setCurrentOrder(order);
      setPage('detail');
    }
  };
  
  // 恢复/继续订单工作流（while循环，无递归）
  const resumeOrderWorkflow = useCallback(async (orderId: string) => {
    if (pollingRef.current) {
      console.log('工作流进行中，跳过');
      return;
    }
    
    pollingRef.current = true;
    abortRef.current = { aborted: false };
    const signal = abortRef.current;
    
    try {
      while (true) {
        if (signal.aborted) break;
        
        const order = getOrder(orderId);
        if (!order || order.status === 'done' || order.status === 'error') break;
        
        // 0. 检查是否有待确认的任务（分段式交付暂停点）
        const waitConfirmTask = order.tasks.find(t => t.status === 'wait_confirm');
        if (waitConfirmTask) {
          console.log('有待确认任务，暂停工作流:', waitConfirmTask.type);
          break;
        }
        
        // 1. 查找running的任务 → 轮询
        const runningTask = order.tasks.find(t => t.status === 'running');
        if (runningTask) {
          console.log('轮询任务:', runningTask.taskId, runningTask.type);
          
          const result = await pollTaskUntilComplete(
            runningTask.taskId,
            (status) => {
              if (signal.aborted) return;
              const latestOrder = getOrder(orderId);
              if (!latestOrder) return;
              const task = latestOrder.tasks.find(t => t.taskId === runningTask.taskId);
              if (task) {
                task.pollCount++;
                task.elapsedTime = Math.floor((Date.now() - (task.createdAt || Date.now())) / 1000);
                updateOrderTask(orderId, task);
                setCurrentOrder(getOrder(orderId));
              }
            },
            { abortSignal: signal, appKey: order.appKey }
          );
          
          if (signal.aborted) break;
          
          // 任务完成，从store获取最新task数据（保留轮询期间累积的pollCount和elapsedTime）
          const latestTask = getOrder(orderId)?.tasks.find(t => t.taskId === runningTask.taskId) || runningTask;
          const orderNum = result.api_response?.data?.task_order_num || '';
          updateOrderTask(orderId, {
            ...latestTask,
            orderNum: orderNum,
            status: 'done',
            result: result,
            completedAt: Date.now()
          });
          
          // 如果是video任务完成，提取URL标记订单完成
          if (runningTask.type === 'video') {
            const videoUrl = result.api_response?.data?.results?.tasks?.[0]?.video_url || '';
            setOrderVideoUrl(orderId, videoUrl);
            setCurrentOrder(getOrder(orderId));
            break;
          }
          
          // 分段式交付：script/clip 完成后暂停，等待用户确认
          if (order.deliveryMode === 'staged' && (runningTask.type === 'script' || runningTask.type === 'clip')) {
            updateOrderTask(orderId, {
              ...latestTask,
              orderNum: orderNum,
              status: 'wait_confirm',
              result: result,
              completedAt: Date.now()
            });
            console.log('分段式交付，任务待确认:', runningTask.type);
            setCurrentOrder(getOrder(orderId));
            break;
          }
          
          setCurrentOrder(getOrder(orderId));
          continue; // 回到循环顶部，处理下一步
        }
        
        // 2. 无running任务 → 根据已完成任务推断并创建下一步
        const viralLearnTask = order.tasks.find(t => t.type === 'viral_learn');
        const scriptTask = order.tasks.find(t => t.type === 'script');
        const clipTask = order.tasks.find(t => t.type === 'clip');
        const videoTask = order.tasks.find(t => t.type === 'video');
        
        if (viralLearnTask?.status === 'done' && !scriptTask) {
          // viral_learn完成，script未创建 → 提取learning_model_id，创建script
          const learningModelId = viralLearnTask.result?.api_response?.data?.results?.order_info?.learning_model_id || '';
          if (!learningModelId) {
            console.error('viral_learn任务未返回learning_model_id');
            updateOrderStatus(orderId, 'error', '爆款模型任务未返回模型ID，请重新创建订单');
            setCurrentOrder(getOrder(orderId));
            break;
          }
          
          // 存储learning_model_id到订单
          const latestOrder = getOrder(orderId);
          if (latestOrder) {
            latestOrder.learningModelId = learningModelId;
            latestOrder.templateId = learningModelId;
            saveOrder(latestOrder);
          }
          
          console.log('创建文案任务，模型ID:', learningModelId);
          updateOrderStatus(orderId, 'script');
          
          // 【防重复】先写入 pending 占位任务，再调用 API
          const placeholderScriptTask: ITask = {
            type: 'script', taskId: '', orderNum: '',
            status: 'pending', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, placeholderScriptTask);
          setCurrentOrder(getOrder(orderId));
          
          const episodesData: IEpisodeData[] = [{
            num: 1,
            srt_oss_key: order.videoSrtPath,
            video_oss_key: order.videoPath || order.videoSrtPath,
            negative_oss_key: order.videoPath || order.videoSrtPath
          }];
          
          const scriptResponse = await generateScript({
            app_key: order.appKey,
            learning_model_id: learningModelId,
            episodes_data: episodesData,
            playlet_name: order.movieName,
            playlet_num: '1',
            target_platform: order.targetPlatform,
            task_count: 1,
            target_character_name: order.targetCharacterName || '主角',
            refine_srt_gaps: "0",
            vendor_requirements: order.vendorRequirements || `投放在${order.targetPlatform}，吸引18-35岁的年轻用户观看。`,
            story_info: order.storyInfo || ''
          });
          
          // API 返回后更新为 running 状态
          const newScriptTask: ITask = {
            type: 'script', taskId: scriptResponse.task_id, orderNum: '',
            status: 'running', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, newScriptTask);
          setCurrentOrder(getOrder(orderId));
          continue;
          
        } else if (scriptTask?.status === 'done' && !clipTask) {
          // script完成，clip未创建 → 创建clip
          if (!scriptTask.orderNum) {
            console.error('script任务缺少orderNum，无法创建clip');
            updateOrderStatus(orderId, 'error', '文案任务缺少订单号(orderNum)，请重新创建订单');
            setCurrentOrder(getOrder(orderId));
            break;
          }
          console.log('创建剪辑任务，订单号:', scriptTask.orderNum);
          updateOrderStatus(orderId, 'clip');
          setCurrentOrder(getOrder(orderId));
          
          const clipResponse = await generateClip({
            app_key: order.appKey,
            bgm: order.bgmId,
            dubbing: order.dubbingId,
            dubbing_type: 'default',
            order_num: scriptTask.orderNum,
            subtitle_style: {
              shadow: null, outline: null, fontname: null, fontsize: null,
              margin_l: null, margin_r: null, margin_v: null, alignment: null,
              back_colour: null, border_style: null, outline_colour: null, primary_colour: null
            },
            custom_cover: ''
          });
          
          const newClipTask: ITask = {
            type: 'clip', taskId: clipResponse.task_id, orderNum: '',
            status: 'running', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, newClipTask);
          setCurrentOrder(getOrder(orderId));
          continue; // 回到循环顶部轮询clip
          
        } else if (clipTask?.status === 'done' && !videoTask) {
          // clip完成，video未创建 → 创建video
          if (!clipTask.orderNum) {
            console.error('clip任务缺少orderNum，无法创建video');
            updateOrderStatus(orderId, 'error', '剪辑任务缺少订单号(orderNum)，请重新创建订单');
            setCurrentOrder(getOrder(orderId));
            break;
          }
          console.log('创建视频任务，订单号:', clipTask.orderNum);
          updateOrderStatus(orderId, 'video');
          setCurrentOrder(getOrder(orderId));
          
          const videoResponse = await synthesizeVideo({
            order_num: clipTask.orderNum,
            app_key: order.appKey
          });
          
          const newVideoTask: ITask = {
            type: 'video', taskId: videoResponse.task_id, orderNum: '',
            status: 'running', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, newVideoTask);
          setCurrentOrder(getOrder(orderId));
          continue; // 回到循环顶部轮询video
          
        } else if (videoTask?.status === 'done') {
          // 所有任务完成
          const videoUrl = videoTask.result?.api_response?.data?.results?.tasks?.[0]?.video_url || '';
          setOrderVideoUrl(orderId, videoUrl);
          setCurrentOrder(getOrder(orderId));
          break;
          
        } else {
          // 未知状态，标记为error并退出，防止无限重试
          console.warn('订单状态异常，无法继续:', order.status, order.tasks.map(t => `${t.type}:${t.status}`));
          updateOrderStatus(orderId, 'error', '订单状态异常，无法继续执行。请检查任务数据或重新创建订单。');
          setCurrentOrder(getOrder(orderId));
          break;
        }
      }
    } catch (error: any) {
      if (signal.aborted) {
        console.log('工作流已取消');
        return;
      }
      console.error('工作流执行失败:', error);
      const order = getOrder(orderId);
      if (order) {
        const failableTask = order.tasks.find(t => t.status === 'running' || t.status === 'pending');
        if (failableTask) {
          updateOrderTask(orderId, { ...failableTask, status: 'error', errorMessage: error.message });
        }
        updateOrderStatus(orderId, 'error', error.message);
        setCurrentOrder(getOrder(orderId));
      }
    } finally {
      // 只有非中断退出才重置 pollingRef，避免被中断的旧工作流覆盖新工作流的锁
      if (!signal.aborted) {
        pollingRef.current = false;
      }
    }
  }, []);
  
  // 停止当前工作流
  const stopWorkflow = useCallback(() => {
    abortRef.current.aborted = true;
    pollingRef.current = false;
  }, []);
  
  // 订单列表页：复用 resumeOrderWorkflow 处理活跃订单（完整工作流推进）
  useEffect(() => {
    if (page === 'orders' && appKey) {
      let cancelled = false;

      const processNextActiveOrder = async () => {
        while (!cancelled) {
          const allOrders = getUserOrders(appKey);
          const activeOrder = allOrders.find(o =>
            o.status !== 'done' && o.status !== 'error' &&
            !o.tasks.some(t => t.status === 'wait_confirm')
          );

          if (!activeOrder) {
            console.log('[列表页] 无活跃订单需要处理');
            break;
          }

          console.log('[列表页] 开始处理订单:', activeOrder.movieName, activeOrder.id);
          await resumeOrderWorkflow(activeOrder.id);
          if (!cancelled) {
            setOrders(getUserOrders(appKey));
          }
        }
      };

      processNextActiveOrder();

      // 定时从 localStorage 刷新列表（resumeOrderWorkflow 写 localStorage，这里读取刷新 UI）
      const refreshTimer = setInterval(() => {
        if (!cancelled) {
          setOrders(getUserOrders(appKey));
          // 如果当前无工作流在运行，尝试处理下一个活跃订单
          if (!pollingRef.current) {
            processNextActiveOrder();
          }
        }
      }, 10000);

      return () => {
        cancelled = true;
        clearInterval(refreshTimer);
        stopWorkflow();
      };
    }
  }, [page, appKey]);

  // 进入订单详情页时，检查并恢复轮询
  useEffect(() => {
    if (page === 'detail' && currentOrder) {
      const status = currentOrder.status;
      if (status !== 'done' && status !== 'error') {
        // 有待确认任务时不自动恢复
        const hasWaitConfirm = currentOrder.tasks.some(t => t.status === 'wait_confirm');
        if (!hasWaitConfirm) {
          resumeOrderWorkflow(currentOrder.id);
        }
      }
    }
    // 离开详情页时取消轮询
    return () => {
      if (page === 'detail') {
        stopWorkflow();
      }
    };
  }, [page, currentOrder?.id]);
  
  // 确认任务（分段式交付：用户确认后继续下一步）
  const confirmTask = (orderId: string, taskType: string) => {
    const order = getOrder(orderId);
    if (!order) return;
    const task = order.tasks.find(t => t.type === taskType && t.status === 'wait_confirm');
    if (!task) return;
    updateOrderTask(orderId, { ...task, status: 'done' });
    setCurrentOrder(getOrder(orderId));
    // 确认后自动恢复工作流
    resumeOrderWorkflow(orderId);
  };
  
  // 重试失败的任务（重新提交当前节点任务）
  const retryFailedTask = useCallback(async (orderId: string, taskType: TaskType) => {
    const order = getOrder(orderId);
    if (!order) return;
    
    const failedTask = order.tasks.find(t => t.type === taskType && (t.status === 'error' || t.status === 'pending'));
    if (!failedTask) return;
    
    setRetryingTaskType(taskType);
    
    // 重置订单错误状态
    const statusMap: Record<TaskType, OrderStatus> = {
      viral_learn: 'viral_learn',
      script: 'script',
      clip: 'clip',
      video: 'video'
    };
    order.errorMessage = '';
    order.status = statusMap[taskType];
    order.updatedAt = Date.now();
    saveOrder(order);
    setCurrentOrder(getOrder(orderId));
    
    try {
      let newTaskId = '';
      
      switch (taskType) {
        case 'viral_learn': {
          const response = await generateViralModel({
            app_key: order.appKey,
            video_path: order.videoPath,
            video_srt_path: order.videoSrtPath,
            narrator_type: order.narratorType,
            model_version: order.modelVersion
          });
          newTaskId = response.task_id;
          break;
        }
        case 'script': {
          let episodesData: IEpisodeData[];
          if (order.templateSource === 'generate') {
            // 自定义电影：从订单数据构建
            episodesData = [{
              num: 1,
              srt_oss_key: order.videoSrtPath,
              video_oss_key: order.videoPath || order.videoSrtPath,
              negative_oss_key: order.videoPath || order.videoSrtPath
            }];
          } else {
            // 普通电影：需要重新获取电影文件ID
            const movies = await fetchMovies(order.appKey);
            const movie = movies.find(m => m.id === order.movieId);
            if (!movie) throw new Error('无法找到电影数据，请重新创建订单');
            episodesData = [{
              num: 1,
              srt_oss_key: movie.srt_file_id,
              video_oss_key: movie.video_file_id,
              negative_oss_key: movie.video_file_id
            }];
          }
          const learningModelId = order.learningModelId || order.templateId;
          if (!learningModelId) throw new Error('缺少模型ID，无法重试文案任务');
          const scriptResponse = await generateScript({
            app_key: order.appKey,
            learning_model_id: learningModelId,
            episodes_data: episodesData,
            playlet_name: order.movieName,
            playlet_num: '1',
            target_platform: order.targetPlatform,
            task_count: 1,
            target_character_name: '主角',
            refine_srt_gaps: "0",
            vendor_requirements: `投放在${order.targetPlatform}，吸引18-35岁的年轻用户观看。`,
            story_info: ''
          });
          newTaskId = scriptResponse.task_id;
          break;
        }
        case 'clip': {
          const scriptTask = order.tasks.find(t => t.type === 'script' && t.status === 'done');
          if (!scriptTask?.orderNum) throw new Error('缺少文案任务订单号，无法重试剪辑');
          const clipResponse = await generateClip({
            app_key: order.appKey,
            bgm: order.bgmId,
            dubbing: order.dubbingId,
            dubbing_type: 'default',
            order_num: scriptTask.orderNum,
            subtitle_style: {
              shadow: null, outline: null, fontname: null, fontsize: null,
              margin_l: null, margin_r: null, margin_v: null, alignment: null,
              back_colour: null, border_style: null, outline_colour: null, primary_colour: null
            },
            custom_cover: ''
          });
          newTaskId = clipResponse.task_id;
          break;
        }
        case 'video': {
          const clipTask = order.tasks.find(t => t.type === 'clip' && t.status === 'done');
          if (!clipTask?.orderNum) throw new Error('缺少剪辑任务订单号，无法重试视频合成');
          const videoResponse = await synthesizeVideo({
            order_num: clipTask.orderNum,
            app_key: order.appKey
          });
          newTaskId = videoResponse.task_id;
          break;
        }
      }
      
      // 更新任务为 running 状态
      updateOrderTask(orderId, {
        ...failedTask,
        taskId: newTaskId,
        status: 'running',
        pollCount: 0,
        elapsedTime: 0,
        errorMessage: '',
        createdAt: Date.now(),
        completedAt: null,
        result: null
      });
      setCurrentOrder(getOrder(orderId));
      
      // 恢复工作流轮询
      resumeOrderWorkflow(orderId);
      
    } catch (error: any) {
      console.error('重试失败:', error);
      updateOrderTask(orderId, { ...failedTask, status: 'error', errorMessage: error.message });
      updateOrderStatus(orderId, 'error', `重试失败: ${error.message}`);
      setCurrentOrder(getOrder(orderId));
    } finally {
      setRetryingTaskType(null);
    }
  }, [resumeOrderWorkflow, appKey]);
  
  // 开始创建新订单
  const startCreateOrder = () => {
    setCurrentStep(0);
    setSelectedMovie(null);
    setSelectedTemplate(null);
    setSelectedBGM(null);
    setSelectedDubbing(null);
    setSelectedEpisodeSrtFile(null);
    setSelectedEpisodeVideoFile(null);
    setCustomMovieName('');
    setSelectedViralSrtFile(null);
    setSelectedCustomBgmFile(null);
    setSelectedCustomDubbingFile(null);
    setNarratorType('movie');
    setModelVersion('standard');
    setTaskPhase('idle');
    setPage('create');
    loadMovies();
  };
  
  // 初始加载电影（创建订单时）
  useEffect(() => {
    if (page === 'create' && movies.length === 0) {
      loadMovies();
    }
  }, [page, movies.length, loadMovies]);
  
  // 是否为自定义电影
  const isCustomMovie = selectedMovie?.name === '自定义';
  
  // 步骤变化时加载数据
  useEffect(() => {
    if (currentStep === 0 && isCustomMovie) {
      if (episodeSrtFiles.length === 0) loadEpisodeSrtFiles();
    }
    if (currentStep === 1) {
      if (templates.length === 0) loadTemplates();
    }
    if (currentStep === 2 && bgmList.length === 0) {
      loadConfig();
    }
  }, [currentStep, isCustomMovie, templates.length, episodeSrtFiles.length, bgmList.length, loadTemplates, loadEpisodeSrtFiles, loadConfig]);
  
  // 执行完整任务流程：创建订单+第一个任务，然后跳转到详情页由resumeOrderWorkflow接管
  const executeWorkflow = async () => {
    if (!selectedMovie || !selectedBGM || !selectedDubbing || !selectedTemplate) {
      setErrorMessage('请完成所有配置');
      return;
    }
    const _isCustomMovie = selectedMovie.name === '自定义';
    const _isCustomTemplate = selectedTemplate.name === '自定义';
    if (_isCustomMovie && !selectedEpisodeSrtFile) {
      setErrorMessage('请选择视频SRT文件（用于构建剧集数据）');
      return;
    }
    if (_isCustomTemplate && !selectedViralSrtFile) {
      setErrorMessage('请选择爆款SRT文件（用于生成学习模型）');
      return;
    }
    if (selectedBGM.name === '自定义' && !selectedCustomBgmFile) {
      setErrorMessage('请选择自定义BGM文件');
      return;
    }
    if (selectedDubbing.name === '自定义' && !selectedCustomDubbingFile) {
      setErrorMessage('请选择自定义配音文件');
      return;
    }
    
    setTaskPhase('script');
    setTaskMessage('正在创建订单...');
    setErrorMessage('');
    
    // 构建 episode_data 所需的文件ID
    const srtOssKey = _isCustomMovie ? (selectedEpisodeSrtFile!.file_id) : selectedMovie.srt_file_id;
    const videoOssKey = _isCustomMovie ? (selectedEpisodeVideoFile?.file_id || selectedEpisodeSrtFile!.file_id) : selectedMovie.video_file_id;
    
    let order: IOrder | null = null;
    try {
      // 创建订单记录
      order = createOrder({
        appKey: appKey,
        movieId: selectedMovie.id,
        movieName: _isCustomMovie ? (customMovieName.trim() || selectedEpisodeVideoFile?.file_name?.replace(/\.[^.]+$/, '') || selectedEpisodeSrtFile?.file_name?.replace(/\.[^.]+$/, '') || '自定义') : selectedMovie.name,
        movieSource: _isCustomMovie ? 'custom' : 'existing',
        templateId: _isCustomTemplate ? '' : selectedTemplate.learning_model_id,
        templateName: _isCustomTemplate ? '自动生成' : selectedTemplate.name,
        templateSource: _isCustomTemplate ? 'generate' : 'existing',
        bgmId: selectedBGM.name === '自定义' ? (selectedCustomBgmFile?.file_id || '') : selectedBGM.bgm_file_id,
        bgmName: selectedBGM.name === '自定义' ? (selectedCustomBgmFile?.file_name || '自定义') : selectedBGM.name,
        dubbingId: selectedDubbing.name === '自定义' ? (selectedCustomDubbingFile?.file_id || '') : selectedDubbing.dubbing_id,
        dubbingName: selectedDubbing.name === '自定义' ? (selectedCustomDubbingFile?.file_name || '自定义') : selectedDubbing.name,
        targetPlatform: targetPlatform,
        targetCharacterName: targetCharacterName || selectedMovie.character_name || '主角',
        vendorRequirements: vendorRequirements || `投放在${targetPlatform}，吸引18-35岁的年轻用户观看。`,
        storyInfo: selectedMovie.story_info || '',
        deliveryMode: deliveryMode,
        videoPath: videoOssKey,
        videoSrtPath: srtOssKey,
        viralSrtPath: _isCustomTemplate ? selectedViralSrtFile!.file_id : '',
        narratorType: _isCustomTemplate ? narratorType : '',
        modelVersion: _isCustomTemplate ? modelVersion : ''
      });
      
      if (_isCustomTemplate) {
        // 自定义模板：先创建爆款模型任务
        updateOrderStatus(order.id, 'viral_learn');
        setTaskMessage('正在创建爆款模型任务...');
        
        const viralResponse = await generateViralModel({
          app_key: appKey,
          video_srt_path: selectedViralSrtFile!.file_id,
          narrator_type: narratorType,
          model_version: modelVersion
        });
        
        const viralTask: ITask = {
          type: 'viral_learn',
          taskId: viralResponse.task_id,
          orderNum: '',
          status: 'running',
          pollCount: 0,
          elapsedTime: 0,
          result: null,
          errorMessage: '',
          createdAt: Date.now(),
          completedAt: null
        };
        updateOrderTask(order.id, viralTask);
      } else {
        // 使用现成模板：直接创建文案任务
        updateOrderStatus(order.id, 'script');
        setTaskMessage('正在创建文案任务...');
        
        const episodesData: IEpisodeData[] = [{
          num: 1,
          srt_oss_key: srtOssKey,
          video_oss_key: videoOssKey,
          negative_oss_key: videoOssKey
        }];
        
        const scriptResponse = await generateScript({
          app_key: appKey,
          learning_model_id: selectedTemplate.learning_model_id,
          episodes_data: episodesData,
          playlet_name: _isCustomMovie ? (customMovieName.trim() || selectedEpisodeVideoFile?.file_name?.replace(/\.[^.]+$/, '') || selectedEpisodeSrtFile?.file_name?.replace(/\.[^.]+$/, '') || '自定义解说') : selectedMovie.name,
          playlet_num: '1',
          target_platform: targetPlatform,
          task_count: 1,
          target_character_name: targetCharacterName || selectedMovie.character_name || '主角',
          refine_srt_gaps: "0",
          vendor_requirements: vendorRequirements || `投放在${targetPlatform}，吸引18-35岁的年轻用户观看。`,
          story_info: selectedMovie.story_info || ''
        });
        
        const scriptTask: ITask = {
          type: 'script',
          taskId: scriptResponse.task_id,
          orderNum: '',
          status: 'running',
          pollCount: 0,
          elapsedTime: 0,
          result: null,
          errorMessage: '',
          createdAt: Date.now(),
          completedAt: null
        };
        updateOrderTask(order.id, scriptTask);
      }
      
      // 跳转到订单详情页，由resumeOrderWorkflow接管后续流程
      setCurrentOrder(getOrder(order.id));
      refreshOrders();
      setPage('detail');
      
    } catch (error: any) {
      setTaskPhase('error');
      let errMsg = '创建任务失败';
      if (error.response) {
        errMsg = `${error.message}\n状态码: ${error.response.status}\n响应: ${JSON.stringify(error.response.data || {}).slice(0, 200)}`;
      } else if (error.message) {
        errMsg = error.message;
      }
      console.error('创建任务错误:', error);
      setErrorMessage(errMsg);
      // 同步更新 store 中的订单状态为 error，避免产生"幽灵订单"（无任务节点但状态卡在执行中）
      if (order?.id) {
        updateOrderStatus(order.id, 'error', errMsg);
      }
    }
  };
  
  // 重置流程
  const resetWorkflow = () => {
    setCurrentStep(0);
    setSelectedMovie(null);
    setSelectedTemplate(null);
    setSelectedBGM(null);
    setSelectedDubbing(null);
    setSelectedEpisodeSrtFile(null);
    setSelectedEpisodeVideoFile(null);
    setCustomMovieName('');
    setSelectedViralSrtFile(null);
    setSelectedCustomBgmFile(null);
    setSelectedCustomDubbingFile(null);
    setNarratorType('movie');
    setModelVersion('standard');
    setTaskPhase('idle');
    setTaskMessage('');
    setErrorMessage('');
  };
  
  // 上传文件：打开弹窗
  const openUploadModal = () => {
    setUploadLink('');
    setUploadTag('');
    setUploadTypeTag('电影');
    setUploadStep('input');
    setPreUploadResult(null);
    setPreUploadUploadId('');
    setUploadModalVisible(true);
  };

  // 上传文件：关闭弹窗
  const closeUploadModal = () => {
    setUploadModalVisible(false);
  };

  // 上传文件：预转存解析
  const handlePreUpload = async () => {
    if (!uploadLink.trim()) { message.error('请输入资源链接'); return; }
    if (!uploadTag.trim()) { message.error('请输入转存任务名'); return; }
    setPreUploadLoading(true);
    try {
      const res = await preUpload({ link: uploadLink.trim(), tag: uploadTag.trim(), type_tag: uploadTypeTag, app_key: appKey });
      setPreUploadResult(res);
      // 从返回的文件中提取 upload_id
      const allFiles = [...(res.data?.video || []), ...(res.data?.subtitle || []), ...(res.data?.image || []), ...(res.data?.other || [])];
      if (allFiles.length > 0) {
        setPreUploadUploadId(allFiles[0].upload_id);
      }
      setUploadStep('preview');
    } catch (error: any) {
      message.error('解析失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setPreUploadLoading(false);
    }
  };

  // 上传文件：确认转存
  const handleConfirmUpload = async () => {
    if (!preUploadUploadId) { message.error('缺少 upload_id'); return; }
    setUploadTaskLoading(true);
    try {
      await uploadTask({ upload_id: preUploadUploadId, app_key: appKey });
      message.success('转存任务已提交');
      setUploadStep('transfers');
      loadTransferList(1);
    } catch (error: any) {
      message.error('转存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadTaskLoading(false);
    }
  };

  // 加载传输列表
  const loadTransferList = async (pg: number = 1) => {
    setTransferListLoading(true);
    try {
      const res = await fetchTransferList({ page: pg, limit: 10, status: '', app_key: appKey });
      const list = Array.isArray(res.file_list) ? res.file_list : (res.file_list ? Object.values(res.file_list) : []);
      setTransferList(list);
      setTransferListTotal(res.total || 0);
      setTransferListPage(pg);
    } catch (error: any) {
      console.error('加载传输列表失败:', error);
      message.error('加载传输列表失败');
    } finally {
      setTransferListLoading(false);
    }
  };

  // 删除文件
  const handleDeleteFile = async (fileId: string) => {
    try {
      const res = await deleteFile({ file_id: fileId, app_key: appKey });
      if (res.success) {
        message.success('删除成功');
        loadTransferList(transferListPage);
      } else {
        message.error(res.error_message || '删除失败');
      }
    } catch (error: any) {
      message.error('删除失败: ' + (error.message));
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + 'GB';
  };

  // 渲染上传弹窗
  const renderUploadModal = () => {
    if (!uploadModalVisible) return null;
    return (
      <div className="upload-modal-overlay" onClick={closeUploadModal}>
        <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
          <div className="upload-modal-header">
            <h3>{uploadStep === 'transfers' ? '📋 文件传输列表' : '📤 上传文件到云盘'}</h3>
            <Button type="text" onClick={closeUploadModal}>✕</Button>
          </div>

          {uploadStep === 'input' && (
            <div className="upload-modal-body">
              <div className="form-group">
                <label className="form-label">资源链接 <span style={{ color: '#ff4d4f' }}>*</span></label>
                <Input placeholder="百度网盘分享链接或资源直链URL" value={uploadLink} onChange={(e) => setUploadLink(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">转存任务名 <span style={{ color: '#ff4d4f' }}>*</span></label>
                <Input placeholder="例如：电影名称" value={uploadTag} onChange={(e) => setUploadTag(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">业务类型 <span style={{ color: '#ff4d4f' }}>*</span></label>
                <Select value={uploadTypeTag} onChange={(v) => setUploadTypeTag(v)} style={{ width: '100%' }}>
                  <Select.Option value="电影">电影</Select.Option>
                  <Select.Option value="短剧">短剧</Select.Option>
                  <Select.Option value="图片">图片</Select.Option>
                </Select>
              </div>
              <Button type="primary" block className="btn-primary-gradient" loading={preUploadLoading} onClick={handlePreUpload}>
                解析文件
              </Button>
            </div>
          )}

          {uploadStep === 'preview' && preUploadResult && (
            <div className="upload-modal-body">
              {preUploadResult.data?.video?.length > 0 && (
                <div className="pre-upload-section">
                  <h4>🎬 视频列表 ({preUploadResult.data.video.length})</h4>
                  {preUploadResult.data.video.map((f: IPreUploadFile) => (
                    <div key={f.id} className={`pre-upload-file ${f.invalid_message ? 'invalid' : ''}`}>
                      <div className="pre-upload-file-name">{f.file_name}</div>
                      <div className="pre-upload-file-meta">
                        {formatFileSize(f.file_size)}
                        {f.name_tag && <Tag color="blue" style={{ marginLeft: 4 }}>{f.name_tag}</Tag>}
                        <Tag color="green" style={{ marginLeft: 4 }}>EP{f.index}</Tag>
                        {f.related_record_name ? <Tag color="purple" style={{ marginLeft: 4 }}>关联: {f.related_record_name}</Tag> : <span style={{ color: '#fa8c16', marginLeft: 4 }}>✕ 未关联</span>}
                      </div>
                      {f.invalid_message && <div className="pre-upload-file-warn">{f.invalid_message}</div>}
                    </div>
                  ))}
                </div>
              )}
              {preUploadResult.data?.subtitle?.length > 0 && (
                <div className="pre-upload-section">
                  <h4>📝 字幕列表 ({preUploadResult.data.subtitle.length})</h4>
                  {preUploadResult.data.subtitle.map((f: IPreUploadFile) => (
                    <div key={f.id} className={`pre-upload-file ${f.invalid_message ? 'invalid' : ''}`}>
                      <div className="pre-upload-file-name">{f.file_name}</div>
                      <div className="pre-upload-file-meta">
                        {formatFileSize(f.file_size)}
                        <Tag color="green" style={{ marginLeft: 4 }}>EP{f.index}</Tag>
                        {f.related_record_name ? <Tag color="purple" style={{ marginLeft: 4 }}>关联: {f.related_record_name}</Tag> : <span style={{ color: '#fa8c16', marginLeft: 4 }}>✕ 未关联</span>}
                      </div>
                      {f.invalid_message && <div className="pre-upload-file-warn">{f.invalid_message}</div>}
                    </div>
                  ))}
                </div>
              )}
              {preUploadResult.data?.image?.length > 0 && (
                <div className="pre-upload-section">
                  <h4>🖼️ 图片列表 ({preUploadResult.data.image.length})</h4>
                  {preUploadResult.data.image.map((f: IPreUploadFile) => (
                    <div key={f.id} className={`pre-upload-file ${f.invalid_message ? 'invalid' : ''}`}>
                      <div className="pre-upload-file-name">{f.file_name}</div>
                      <div className="pre-upload-file-meta">{formatFileSize(f.file_size)}</div>
                      {f.invalid_message && <div className="pre-upload-file-warn">{f.invalid_message}</div>}
                    </div>
                  ))}
                </div>
              )}
              {preUploadResult.data?.other?.length > 0 && (
                <div className="pre-upload-section">
                  <h4>📁 其他文件 ({preUploadResult.data.other.length})</h4>
                  {preUploadResult.data.other.map((f: IPreUploadFile) => (
                    <div key={f.id} className={`pre-upload-file ${f.invalid_message ? 'invalid' : ''}`}>
                      <div className="pre-upload-file-name">{f.file_name}</div>
                      <div className="pre-upload-file-meta">{formatFileSize(f.file_size)}</div>
                      {f.invalid_message && <div className="pre-upload-file-warn">{f.invalid_message}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button onClick={() => setUploadStep('input')} style={{ flex: 1 }}>返回修改</Button>
                <Button type="primary" className="btn-primary-gradient" loading={uploadTaskLoading} onClick={handleConfirmUpload} style={{ flex: 1 }}>
                  全部转存
                </Button>
              </div>
            </div>
          )}

          {uploadStep === 'uploading' && (
            <div className="upload-modal-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Spin tip="正在提交转存任务..." />
            </div>
          )}

          {uploadStep === 'transfers' && (
            <div className="upload-modal-body">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <Button size="small" onClick={() => loadTransferList(transferListPage)} loading={transferListLoading}>刷新</Button>
              </div>
              {transferListLoading && transferList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30 }}><Spin tip="加载中..." /></div>
              ) : transferList.length === 0 ? (
                <Empty description="暂无传输记录" />
              ) : (
                <>
                  {transferList.map((item: any, idx: number) => {
                    const statusMap: Record<string, { text: string; color: string }> = {
                      '0': { text: '初始化', color: '#999' },
                      '1': { text: '上传中', color: '#1890ff' },
                      '2': { text: '已完成', color: '#52c41a' },
                      '3': { text: '上传失败', color: '#ff4d4f' },
                    };
                    const st = statusMap[String(item.status)] || { text: String(item.status), color: '#999' };
                    return (
                      <div key={item.id || idx} className="transfer-item">
                        <div className="transfer-item-info">
                          <div className="transfer-item-name" title={item.file_name || item.tag || ''}>{item.file_name || item.tag || `任务 ${idx + 1}`}</div>
                          <div className="transfer-item-meta">
                            {item.file_size ? formatFileSize(item.file_size) : ''}
                            {item.created_at && <span style={{ marginLeft: 8 }}>{item.created_at}</span>}
                          </div>
                        </div>
                        <div className="transfer-item-actions">
                          <Tag color={st.color}>{st.text}</Tag>
                          <Button size="small" danger onClick={() => handleDeleteFile(item.file_id || item.id)}>删除</Button>
                        </div>
                      </div>
                    );
                  })}
                  {transferListTotal > 10 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                      <Button size="small" disabled={transferListPage <= 1} onClick={() => loadTransferList(transferListPage - 1)}>上一页</Button>
                      <span style={{ fontSize: 12, lineHeight: '24px' }}>{transferListPage}/{Math.ceil(transferListTotal / 10)}</span>
                      <Button size="small" disabled={transferListPage >= Math.ceil(transferListTotal / 10)} onClick={() => loadTransferList(transferListPage + 1)}>下一页</Button>
                    </div>
                  )}
                </>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button onClick={() => setUploadStep('input')} style={{ flex: 1 }}>继续上传</Button>
                <Button type="primary" onClick={closeUploadModal} style={{ flex: 1 }}>关闭</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <div className="section-title">选择爆款电影</div>
            <div className={`movie-list-scroll ${isCustomMovie ? 'compact' : ''}`}>
              {moviesLoading ? (
                <Spin tip="加载中..." />
              ) : (
                movies.map((movie) => (
                  <div
                    key={movie.id}
                    className={`select-card ${selectedMovie?.id === movie.id ? 'selected' : ''}`}
                    onClick={() => setSelectedMovie(movie)}
                  >
                    {movie.cover ? (
                      <img className="select-card-cover" src={movie.cover} alt={movie.name}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <div className={`select-card-cover-placeholder ${movie.cover ? 'hidden' : ''}`}>🎬</div>
                    <div className="select-card-info">
                      <div className="select-card-title">{movie.name}</div>
                      <div className="select-card-desc">
                        <div>类型: {movie.type}</div>
                        <div>{movie.story_info?.slice(0, 50)}...</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {isCustomMovie && (
              <div className="cloud-file-section">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">电影名称 <span style={{ color: '#999' }}>选填</span></label>
                  <Input placeholder="请输入电影名称" value={customMovieName} onChange={(e) => setCustomMovieName(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <Button
                    type={episodeFileStep === 'srt' ? 'primary' : 'default'}
                    size="small"
                    style={{ borderRadius: 8, flex: 1 }}
                    onClick={() => { setEpisodeFileStep('srt'); if (episodeSrtFiles.length === 0) loadEpisodeSrtFiles(); }}
                  >
                    ① 选择SRT文件 {selectedEpisodeSrtFile ? '✓' : '*'}
                  </Button>
                  <Button
                    type={episodeFileStep === 'video' ? 'primary' : 'default'}
                    size="small"
                    style={{ borderRadius: 8, flex: 1 }}
                    onClick={() => { setEpisodeFileStep('video'); if (episodeVideoFiles.length === 0) loadEpisodeVideoFiles(); }}
                  >
                    ② 选择视频文件 {selectedEpisodeVideoFile ? '✓' : '*'}
                  </Button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                      已选SRT <span style={{ color: '#ff4d4f' }}>*必需</span>
                    </label>
                    {selectedEpisodeSrtFile ? (
                      <Tag color="blue" closable onClose={() => setSelectedEpisodeSrtFile(null)} title={selectedEpisodeSrtFile.file_name}
                        style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom', cursor: 'pointer' }}
                        onClick={() => { navigator.clipboard.writeText(selectedEpisodeSrtFile.file_name); message.success('文件名已复制'); }}>
                        {selectedEpisodeSrtFile.file_name}
                      </Tag>
                    ) : (
                      <Tag color="default">未选择</Tag>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                      已选视频 <span style={{ color: '#ff4d4f' }}>*必需</span>
                    </label>
                    {selectedEpisodeVideoFile ? (
                      <Tag color="green" closable onClose={() => setSelectedEpisodeVideoFile(null)} title={selectedEpisodeVideoFile.file_name}
                        style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom', cursor: 'pointer' }}
                        onClick={() => { navigator.clipboard.writeText(selectedEpisodeVideoFile.file_name); message.success('文件名已复制'); }}>
                        {selectedEpisodeVideoFile.file_name}
                      </Tag>
                    ) : (
                      <Tag color="default">未选择</Tag>
                    )}
                  </div>
                </div>

                {episodeFileStep === 'srt' && (
                  <>
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ marginBottom: 0, fontSize: 12 }}>SRT文件列表</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="small" type="link" onClick={openUploadModal}>📤上传</Button>
                        <Button size="small" onClick={() => loadEpisodeSrtFiles(episodeSrtFilesPage)} loading={episodeSrtFilesLoading}>刷新</Button>
                      </div>
                    </div>
                    {episodeSrtFilesLoading ? (
                      <Spin tip="加载SRT文件..." />
                    ) : (
                      <>
                        <List
                          size="small"
                          dataSource={episodeSrtFiles}
                          renderItem={(file: ICloudFile) => {
                            const isSelected = selectedEpisodeSrtFile?.file_id === file.file_id;
                            return (
                              <Card size="small" style={{ marginBottom: 4, background: isSelected ? '#e6f7ff' : '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div title={file.file_name} style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {file.file_name}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#999' }}>
                                      {(file.file_size / 1024 / 1024).toFixed(1)}MB | {file.suffix} | {file.created_at}
                                    </div>
                                  </div>
                                  <Button size="small" type={isSelected ? 'primary' : 'default'} style={{ marginLeft: 8 }}
                                    onClick={() => { setSelectedEpisodeSrtFile(isSelected ? null : file); if (!isSelected) { setEpisodeFileStep('video'); if (episodeVideoFiles.length === 0) loadEpisodeVideoFiles(); } }}>
                                    {isSelected ? '已选择' : '选择'}
                                  </Button>
                                </div>
                              </Card>
                            );
                          }}
                        />
                        {episodeSrtFilesTotalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                            <Button size="small" disabled={episodeSrtFilesPage <= 1} onClick={() => loadEpisodeSrtFiles(episodeSrtFilesPage - 1)}>上一页</Button>
                            <span style={{ fontSize: 12, lineHeight: '24px' }}>{episodeSrtFilesPage}/{episodeSrtFilesTotalPages}</span>
                            <Button size="small" disabled={episodeSrtFilesPage >= episodeSrtFilesTotalPages} onClick={() => loadEpisodeSrtFiles(episodeSrtFilesPage + 1)}>下一页</Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {episodeFileStep === 'video' && (
                  <>
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ marginBottom: 0, fontSize: 12 }}>视频文件列表（按大小排序）</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="small" type="link" onClick={openUploadModal}>📤上传</Button>
                        <Button size="small" onClick={() => loadEpisodeVideoFiles(episodeVideoFilesPage)} loading={episodeVideoFilesLoading}>刷新</Button>
                      </div>
                    </div>
                    {episodeVideoFilesLoading ? (
                      <Spin tip="加载视频文件..." />
                    ) : (
                      <>
                        <List
                          size="small"
                          dataSource={episodeVideoFiles}
                          renderItem={(file: ICloudFile) => {
                            const isSelected = selectedEpisodeVideoFile?.file_id === file.file_id;
                            return (
                              <Card size="small" style={{ marginBottom: 4, background: isSelected ? '#e6f7ff' : '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div title={file.file_name} style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {file.file_name}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#999' }}>
                                      {(file.file_size / 1024 / 1024).toFixed(1)}MB | {file.suffix} | {file.created_at}
                                    </div>
                                  </div>
                                  <Button size="small" type={isSelected ? 'primary' : 'default'} style={{ marginLeft: 8 }}
                                    onClick={() => setSelectedEpisodeVideoFile(isSelected ? null : file)}>
                                    {isSelected ? '已选择' : '选择'}
                                  </Button>
                                </div>
                              </Card>
                            );
                          }}
                        />
                        {episodeVideoFilesTotalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                            <Button size="small" disabled={episodeVideoFilesPage <= 1} onClick={() => loadEpisodeVideoFiles(episodeVideoFilesPage - 1)}>上一页</Button>
                            <span style={{ fontSize: 12, lineHeight: '24px' }}>{episodeVideoFilesPage}/{episodeVideoFilesTotalPages}</span>
                            <Button size="small" disabled={episodeVideoFilesPage >= episodeVideoFilesTotalPages} onClick={() => loadEpisodeVideoFiles(episodeVideoFilesPage + 1)}>下一页</Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
        
      case 1: {
        const isCustomTemplate = selectedTemplate?.name === '自定义';
        const customTemplateOption = { id: -1, name: '自定义', learning_model_id: '', img: null, info: '', remark: null, code: null, type: '', narrator_type: null, name_time: '', time: null, language: null, tags: null, like: null, share: null, messages: null, stars: null, profit: null, slug_img: null, link: null } as INarratorTemplate;
        // 根据 narratorType + modelVersion 计算 type_value
        const typeValueMap: Record<string, number> = {
          'movie_advanced': 1, 'movie_standard': 11,
          'first_person_movie_advanced': 2, 'first_person_movie_standard': 22,
          'multilingual_advanced': 3, 'multilingual_standard': 33,
          'first_person_multilingual_advanced': 4, 'first_person_multilingual_standard': 44,
          'short_drama_advanced': 5, 'short_drama_standard': 55,
        };
        const typeValue = String(typeValueMap[`${narratorType}_${modelVersion}`] ?? 11);
        const filteredTemplates = templates.filter(t => t.type === typeValue);
        const allTemplates = [customTemplateOption, ...filteredTemplates];
        return (
          <div>
            <div className="section-title">选择解说模板</div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">解说类型</label>
                <Select style={{ width: '100%' }} value={narratorType} onChange={(v) => { setNarratorType(v); setSelectedTemplate(null); }}
                  options={[
                    { label: '电影', value: 'movie' },
                    { label: '第一人称电影', value: 'first_person_movie' },
                    { label: '多语种电影', value: 'multilingual' },
                    { label: '第一人称多语种', value: 'first_person_multilingual' },
                    { label: '短剧', value: 'short_drama' }
                  ]}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">模型版本</label>
                <Select style={{ width: '100%' }} value={modelVersion} onChange={(v) => { setModelVersion(v); setSelectedTemplate(null); }}
                  options={[
                    { label: '高级版 (advanced)', value: 'advanced' },
                    { label: '标准版 (standard)', value: 'standard' }
                  ]}
                />
              </div>
            </div>

            <div className={`movie-list-scroll ${isCustomTemplate ? 'compact' : ''}`}>
              {templatesLoading ? (
                <Spin tip="加载中..." />
              ) : (
                allTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`select-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                    onClick={() => { setSelectedTemplate(template); if (template.name === '自定义' && viralSrtFiles.length === 0) loadViralSrtFiles(); }}
                  >
                    {template.img ? (
                      <img className="select-card-cover" src={template.img} alt={template.name}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <div className={`select-card-cover-placeholder ${template.img ? 'hidden' : ''}`}>📝</div>
                    <div className="select-card-info">
                      <div className="select-card-title">{template.name}</div>
                      <div className="select-card-desc">
                        {template.name === '自定义' ? (
                          <div>从云盘选择爆款SRT文件，自动生成学习模型</div>
                        ) : (
                          <>
                            <div>类型: {template.narrator_type || template.type}</div>
                            <div>语言: {template.language || '中文'}</div>
                            {template.tags && <div>标签: {template.tags}</div>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {isCustomTemplate && (
              <div className="cloud-file-section">
                <div className="section-title" style={{ fontSize: 14 }}>配置爆款学习模型</div>

                <div style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                    已选爆款SRT <span style={{ color: '#ff4d4f' }}>*必需</span>
                  </label>
                  {selectedViralSrtFile ? (
                    <Tag color="blue" closable onClose={() => setSelectedViralSrtFile(null)} title={selectedViralSrtFile.file_name}
                      style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom', cursor: 'pointer' }}
                      onClick={() => { navigator.clipboard.writeText(selectedViralSrtFile.file_name); message.success('文件名已复制'); }}>
                      {selectedViralSrtFile.file_name}
                    </Tag>
                  ) : (
                    <Tag color="default">未选择</Tag>
                  )}
                </div>

                <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontSize: 12 }}>爆款SRT文件列表</label>
                  <Button size="small" onClick={() => loadViralSrtFiles(viralSrtFilesPage)} loading={viralSrtFilesLoading}>刷新</Button>
                </div>
                {viralSrtFilesLoading ? (
                  <Spin tip="加载爆款SRT文件..." />
                ) : (
                  <>
                    <List
                      size="small"
                      dataSource={viralSrtFiles}
                      renderItem={(file: ICloudFile) => {
                        const isSelected = selectedViralSrtFile?.file_id === file.file_id;
                        return (
                          <Card size="small" style={{ marginBottom: 4, background: isSelected ? '#e6f7ff' : '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div title={file.file_name} style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {file.file_name}
                                </div>
                                <div style={{ fontSize: 10, color: '#999' }}>
                                  {(file.file_size / 1024 / 1024).toFixed(1)}MB | {file.suffix} | {file.created_at}
                                </div>
                              </div>
                              <Button size="small" type={isSelected ? 'primary' : 'default'} style={{ marginLeft: 8 }}
                                onClick={() => setSelectedViralSrtFile(isSelected ? null : file)}>
                                {isSelected ? '已选择' : '选择'}
                              </Button>
                            </div>
                          </Card>
                        );
                      }}
                    />
                    {viralSrtFilesTotalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                        <Button size="small" disabled={viralSrtFilesPage <= 1} onClick={() => loadViralSrtFiles(viralSrtFilesPage - 1)}>上一页</Button>
                        <span style={{ fontSize: 12, lineHeight: '24px' }}>{viralSrtFilesPage}/{viralSrtFilesTotalPages}</span>
                        <Button size="small" disabled={viralSrtFilesPage >= viralSrtFilesTotalPages} onClick={() => loadViralSrtFiles(viralSrtFilesPage + 1)}>下一页</Button>
                      </div>
                    )}
                  </>
                )}

              </div>
            )}
          </div>
        );
      }
        
      case 2:
        return (
          <div>
            <div className="section-title">配置BGM/配音</div>
            {configLoading ? (
              <Spin tip="加载中..." />
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label">目标平台</label>
                  <Select
                    style={{ width: '100%' }}
                    value={targetPlatform}
                    onChange={setTargetPlatform}
                    options={[
                      { label: '抖音短视频平台', value: '抖音短视频平台' },
                      { label: '快手', value: '快手' },
                      { label: 'YouTube', value: 'YouTube' },
                      { label: 'TikTok', value: 'TikTok' }
                    ]}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">主角名称 (可选)</label>
                  <Input
                    placeholder={selectedMovie?.character_name || '主角'}
                    value={targetCharacterName}
                    onChange={(e) => setTargetCharacterName(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>选择BGM</label>
                    {selectedBGM && !bgmListExpanded && (
                      <Button size="small" type="link" onClick={() => setBgmListExpanded(true)}>重新选择</Button>
                    )}
                  </div>
                  {selectedBGM && !bgmListExpanded ? (
                    <div className="audio-card-list-collapsed">
                      <div className="audio-card audio-card-selected">
                        <div className="audio-card-icon">{selectedBGM.id === -1 ? '🔇' : '🎵'}</div>
                        <div className="audio-card-info">
                          <div className="audio-card-name">{selectedBGM.id === -1 ? '不使用BGM' : selectedBGM.name}</div>
                          <div className="audio-card-desc">
                            {selectedBGM.id === -1 ? '静音模式' : (
                              <>
                                {selectedBGM.tag && <Tag color="blue" style={{ fontSize: 10 }}>{selectedBGM.tag}</Tag>}
                                {selectedBGM.description && <span className="audio-card-desc-text">{selectedBGM.description}</span>}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="audio-card-check">✓</div>
                      </div>
                      {selectedBGM.name === '自定义' && selectedCustomBgmFile && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                          已选文件：<Tag color="blue" style={{ fontSize: 11 }}>{selectedCustomBgmFile.file_name}</Tag>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`audio-card-list ${selectedBGM?.name === '自定义' ? 'compact' : ''}`}>
                      {/* 不使用BGM选项 */}
                      <div 
                        className={`audio-card ${selectedBGM?.id === -1 ? 'audio-card-selected' : ''}`}
                        onClick={() => {
                          setSelectedBGM({ id: -1, name: 'no_bgm', bgm_file_id: 'no_bgm', status: null, remark: null, bgm_demo_url: '', type: null, tag: null, description: null } as IBGM);
                          setSelectedCustomBgmFile(null);
                          setBgmListExpanded(false);
                        }}
                      >
                        <div className="audio-card-icon">🔇</div>
                        <div className="audio-card-info">
                          <div className="audio-card-name">不使用BGM</div>
                          <div className="audio-card-desc">静音模式</div>
                        </div>
                        {selectedBGM?.id === -1 && <div className="audio-card-check">✓</div>}
                      </div>
                      
                      {/* BGM列表 */}
                      {bgmList.map(bgm => {
                        const isSelected = selectedBGM?.id === bgm.id;
                        const isPlaying = playingAudioUrl === bgm.bgm_demo_url;
                        return (
                          <div 
                            key={bgm.id}
                            className={`audio-card ${isSelected ? 'audio-card-selected' : ''}`}
                            onClick={() => {
                              setSelectedBGM(bgm);
                              setSelectedCustomBgmFile(null);
                              if (bgm.name === '自定义') { loadCustomBgmFiles(); } else { setBgmListExpanded(false); }
                            }}
                          >
                            <div className="audio-card-icon">🎵</div>
                            <div className="audio-card-info">
                              <div className="audio-card-name">{bgm.name}</div>
                              <div className="audio-card-desc">
                                {bgm.tag && <Tag color="blue" style={{ fontSize: 10 }}>{bgm.tag}</Tag>}
                                {bgm.description && (
                                  <Tooltip title={bgm.description} placement="top">
                                    <span className="audio-card-desc-text">{bgm.description}</span>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                            {bgm.bgm_demo_url && bgm.name !== '自定义' && (
                              <Button 
                                size="small" 
                                type={isPlaying ? 'primary' : 'default'}
                                className="audio-play-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAudio(bgm.bgm_demo_url);
                                }}
                              >
                                {isPlaying ? '⏸ 暂停' : '▶ 试听'}
                              </Button>
                            )}
                            {isSelected && <div className="audio-card-check">✓</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedBGM?.name === '自定义' && bgmListExpanded && (
                  <div className="cloud-file-section" style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ fontSize: 11, marginBottom: 0 }}>
                        已选BGM文件 <span style={{ color: '#ff4d4f' }}>*必需</span>
                      </label>
                    </div>
                    {selectedCustomBgmFile ? (
                      <Tag color="blue" closable onClose={() => setSelectedCustomBgmFile(null)} title={selectedCustomBgmFile.file_name}
                        style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom', cursor: 'pointer', marginBottom: 6 }}
                        onClick={() => { navigator.clipboard.writeText(selectedCustomBgmFile.file_name); message.success('文件名已复制'); }}>
                        {selectedCustomBgmFile.file_name}
                      </Tag>
                    ) : (
                      <Tag color="default" style={{ marginBottom: 6 }}>未选择</Tag>
                    )}
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ marginBottom: 0, fontSize: 12 }}>云盘文件列表</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="small" type="link" onClick={openUploadModal}>📤上传</Button>
                        <Button size="small" onClick={() => loadCustomBgmFiles(customBgmFilesPage)} loading={customBgmFilesLoading}>刷新</Button>
                      </div>
                    </div>
                    {customBgmFilesLoading ? (
                      <Spin tip="加载文件..." />
                    ) : (
                      <>
                        <List
                          size="small"
                          dataSource={customBgmFiles}
                          renderItem={(file: ICloudFile) => {
                            const isSelected = selectedCustomBgmFile?.file_id === file.file_id;
                            return (
                              <Card size="small" style={{ marginBottom: 4, background: isSelected ? '#e6f7ff' : '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div title={file.file_name} style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {file.file_name}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#999' }}>
                                      {(file.file_size / 1024 / 1024).toFixed(1)}MB | {file.suffix} | {file.created_at}
                                    </div>
                                  </div>
                                  <Button size="small" type={isSelected ? 'primary' : 'default'} style={{ marginLeft: 8 }}
                                    onClick={() => { setSelectedCustomBgmFile(isSelected ? null : file); if (!isSelected) setBgmListExpanded(false); }}>
                                    {isSelected ? '已选择' : '选择'}
                                  </Button>
                                </div>
                              </Card>
                            );
                          }}
                        />
                        {customBgmFilesTotalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                            <Button size="small" disabled={customBgmFilesPage <= 1} onClick={() => loadCustomBgmFiles(customBgmFilesPage - 1)}>上一页</Button>
                            <span style={{ fontSize: 12, lineHeight: '24px' }}>{customBgmFilesPage}/{customBgmFilesTotalPages}</span>
                            <Button size="small" disabled={customBgmFilesPage >= customBgmFilesTotalPages} onClick={() => loadCustomBgmFiles(customBgmFilesPage + 1)}>下一页</Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>选择配音</label>
                    {selectedDubbing && !dubbingListExpanded && (
                      <Button size="small" type="link" onClick={() => setDubbingListExpanded(true)}>重新选择</Button>
                    )}
                  </div>
                  {selectedDubbing && !dubbingListExpanded ? (
                    <div className="audio-card-list-collapsed">
                      <div className="audio-card audio-card-selected">
                        <div className="audio-card-icon">🎙️</div>
                        <div className="audio-card-info">
                          <div className="audio-card-name">{selectedDubbing.name}</div>
                          <div className="audio-card-desc">
                            <Tag color="purple" style={{ fontSize: 10, marginRight: 4 }}>{selectedDubbing.role}</Tag>
                            {selectedDubbing.language && <Tag color="cyan" style={{ fontSize: 10 }}>{selectedDubbing.language}</Tag>}
                          </div>
                        </div>
                        <div className="audio-card-check">✓</div>
                      </div>
                      {selectedDubbing.name === '自定义' && selectedCustomDubbingFile && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                          已选文件：<Tag color="blue" style={{ fontSize: 11 }}>{selectedCustomDubbingFile.file_name}</Tag>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`audio-card-list ${selectedDubbing?.name === '自定义' ? 'compact' : ''}`}>
                      {dubbingList.map(dub => {
                        const isSelected = selectedDubbing?.id === dub.id;
                        const isPlaying = playingAudioUrl === dub.dubbing_demo_url;
                        return (
                          <div 
                            key={dub.id}
                            className={`audio-card ${isSelected ? 'audio-card-selected' : ''}`}
                            onClick={() => {
                              setSelectedDubbing(dub);
                              setSelectedCustomDubbingFile(null);
                              if (dub.name === '自定义') { loadCustomDubbingFiles(); } else { setDubbingListExpanded(false); }
                            }}
                          >
                            <div className="audio-card-icon">🎙️</div>
                            <div className="audio-card-info">
                              <div className="audio-card-name">{dub.name}</div>
                              <div className="audio-card-desc">
                                <Tag color="purple" style={{ fontSize: 10, marginRight: 4 }}>{dub.role}</Tag>
                                {dub.language && <Tag color="cyan" style={{ fontSize: 10 }}>{dub.language}</Tag>}
                              </div>
                            </div>
                            {dub.dubbing_demo_url && dub.name !== '自定义' && (
                              <Button 
                                size="small" 
                                type={isPlaying ? 'primary' : 'default'}
                                className="audio-play-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAudio(dub.dubbing_demo_url);
                                }}
                              >
                                {isPlaying ? '⏸ 暂停' : '▶ 试听'}
                              </Button>
                            )}
                            {isSelected && <div className="audio-card-check">✓</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedDubbing?.name === '自定义' && dubbingListExpanded && (
                  <div className="cloud-file-section" style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ fontSize: 11, marginBottom: 0 }}>
                        已选配音文件 <span style={{ color: '#ff4d4f' }}>*必需</span>
                      </label>
                    </div>
                    {selectedCustomDubbingFile ? (
                      <Tag color="blue" closable onClose={() => setSelectedCustomDubbingFile(null)} title={selectedCustomDubbingFile.file_name}
                        style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom', cursor: 'pointer', marginBottom: 6 }}
                        onClick={() => { navigator.clipboard.writeText(selectedCustomDubbingFile.file_name); message.success('文件名已复制'); }}>
                        {selectedCustomDubbingFile.file_name}
                      </Tag>
                    ) : (
                      <Tag color="default" style={{ marginBottom: 6 }}>未选择</Tag>
                    )}
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ marginBottom: 0, fontSize: 12 }}>云盘文件列表</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="small" type="link" onClick={openUploadModal}>📤上传</Button>
                        <Button size="small" onClick={() => loadCustomDubbingFiles(customDubbingFilesPage)} loading={customDubbingFilesLoading}>刷新</Button>
                      </div>
                    </div>
                    {customDubbingFilesLoading ? (
                      <Spin tip="加载文件..." />
                    ) : (
                      <>
                        <List
                          size="small"
                          dataSource={customDubbingFiles}
                          renderItem={(file: ICloudFile) => {
                            const isSelected = selectedCustomDubbingFile?.file_id === file.file_id;
                            return (
                              <Card size="small" style={{ marginBottom: 4, background: isSelected ? '#e6f7ff' : '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div title={file.file_name} style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {file.file_name}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#999' }}>
                                      {(file.file_size / 1024 / 1024).toFixed(1)}MB | {file.suffix} | {file.created_at}
                                    </div>
                                  </div>
                                  <Button size="small" type={isSelected ? 'primary' : 'default'} style={{ marginLeft: 8 }}
                                    onClick={() => { setSelectedCustomDubbingFile(isSelected ? null : file); if (!isSelected) setDubbingListExpanded(false); }}>
                                    {isSelected ? '已选择' : '选择'}
                                  </Button>
                                </div>
                              </Card>
                            );
                          }}
                        />
                        {customDubbingFilesTotalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                            <Button size="small" disabled={customDubbingFilesPage <= 1} onClick={() => loadCustomDubbingFiles(customDubbingFilesPage - 1)}>上一页</Button>
                            <span style={{ fontSize: 12, lineHeight: '24px' }}>{customDubbingFilesPage}/{customDubbingFilesTotalPages}</span>
                            <Button size="small" disabled={customDubbingFilesPage >= customDubbingFilesTotalPages} onClick={() => loadCustomDubbingFiles(customDubbingFilesPage + 1)}>下一页</Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                
                <div className="form-group">
                  <label className="form-label">厂商要求 (可选)</label>
                  <Input.TextArea
                    rows={2}
                    placeholder="投放要求、目标用户等"
                    value={vendorRequirements}
                    onChange={(e) => setVendorRequirements(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">交付模式</label>
                  <Radio.Group value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value)}>
                    <Radio value="staged">分段式交付（每步确认）</Radio>
                    <Radio value="oneStop">一站式交付（全自动）</Radio>
                  </Radio.Group>
                </div>
              </div>
            )}
          </div>
        );
        
      case 3:
        return (
          <div>
            <div className="section-title">任务执行</div>
            
            {taskPhase === 'idle' && (
              <div>
                <div className="confirm-card">
                  <p><strong>电影:</strong> {selectedMovie?.name}</p>
                  {isCustomMovie && (
                    <>
                      <p className="hint">剧集SRT: {selectedEpisodeSrtFile?.file_name}</p>
                      {selectedEpisodeVideoFile && <p className="hint">剧集视频: {selectedEpisodeVideoFile.file_name}</p>}
                    </>
                  )}
                  {!isCustomMovie && (
                    <>
                      <p className="hint">视频ID: {selectedMovie?.video_file_id}</p>
                      <p className="hint">字幕ID: {selectedMovie?.srt_file_id}</p>
                    </>
                  )}
                  <p><strong>模板:</strong> {selectedTemplate?.name}</p>
                  {selectedTemplate?.name === '自定义' ? (
                    <>
                      <p className="hint">爆款SRT: {selectedViralSrtFile?.file_name}</p>
                      <p><strong>解说类型:</strong> {{ movie: '电影', first_person_movie: '第一人称电影', multilingual: '多语种电影', first_person_multilingual: '第一人称多语种', short_drama: '短剧' }[narratorType] || narratorType}</p>
                      <p><strong>模型版本:</strong> {modelVersion === 'advanced' ? '高级版' : '标准版'}</p>
                      <p className="hint" style={{ color: '#eb2f96' }}>将先生成爆款模型，再自动创建文案</p>
                    </>
                  ) : (
                    <p className="hint">模型ID: {selectedTemplate?.learning_model_id}</p>
                  )}
                  <p><strong>BGM:</strong> {selectedBGM?.name === '自定义' ? `自定义 (${selectedCustomBgmFile?.file_name})` : selectedBGM?.name === 'no_bgm' ? '不使用BGM' : selectedBGM?.name}</p>
                  <p><strong>配音:</strong> {selectedDubbing?.name === '自定义' ? `自定义 (${selectedCustomDubbingFile?.file_name})` : selectedDubbing?.name}</p>
                  <p><strong>平台:</strong> {targetPlatform}</p>
                  <p><strong>交付模式:</strong> {deliveryMode === 'staged' ? '分段式交付' : '一站式交付'}</p>
                </div>
                <Button type="primary" size="large" block className="btn-primary-gradient" onClick={executeWorkflow}>
                  开始生成视频
                </Button>
              </div>
            )}
            
            {taskPhase === 'script' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
                  {taskMessage || '正在创建订单和任务...'}
                </div>
              </div>
            )}
            
            {taskPhase === 'error' && (
              <div>
                <Alert
                  type="error"
                  message="任务执行失败"
                  description={
                    <pre style={{ 
                      fontSize: 11, 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-all',
                      maxHeight: 150,
                      overflow: 'auto',
                      margin: 0,
                      padding: 8,
                      background: '#fff1f0'
                    }}>
                      {errorMessage}
                    </pre>
                  }
                  style={{ marginBottom: 16 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="primary" onClick={() => setTaskPhase('idle')}>
                    重试
                  </Button>
                  <Button onClick={resetWorkflow}>
                    重新开始
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // 检查是否可以进入下一步
  const canGoNext = () => {
    switch (currentStep) {
      case 0: return isCustomMovie ? (!!selectedMovie && !!selectedEpisodeSrtFile && !!selectedEpisodeVideoFile) : !!selectedMovie;
      case 1: {
        if (!selectedTemplate) return false;
        if (selectedTemplate.name === '自定义') return !!selectedViralSrtFile;
        return true;
      }
      case 2: {
        if (!selectedBGM || !selectedDubbing) return false;
        if (selectedBGM.name === '自定义' && !selectedCustomBgmFile) return false;
        if (selectedDubbing.name === '自定义' && !selectedCustomDubbingFile) return false;
        return true;
      }
      default: return false;
    }
  };

  // 渲染登录页
  const renderLoginPage = () => (
    <div className="login-page">
      <div className="login-title">🎬 AI视频解说生成</div>
      <div className="login-subtitle">一键生成爆款电影解说视频</div>
      <div className="login-card">
        <div style={{ marginBottom: 16 }}>
          <Input
            size="large"
            placeholder="请输入App Key (grid_xxx)"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            onPressEnter={handleLogin}
            style={{ marginBottom: 8 }}
          />
          {loginError && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{loginError}</div>
          )}
        </div>
        <Button type="primary" size="large" block className="btn-primary-gradient" onClick={handleLogin}>
          登录
        </Button>
      </div>
    </div>
  );
  
  // 渲染订单列表页
  const renderOrdersPage = () => (
    <div className="page">
      <div className="page-header">
        <h3>我的解说订单</h3>
        <div className="page-header-actions">
          <Button size="small" onClick={refreshOrders}>刷新</Button>
          <Button size="small" type="link" danger onClick={handleLogout}>退出</Button>
        </div>
      </div>
      
      <Button type="primary" block className="btn-create" style={{ marginBottom: 8 }} onClick={startCreateOrder}>
        + 创建新订单
      </Button>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Button block className="btn-upload" onClick={openUploadModal}>
          📤 上传文件到云盘
        </Button>
        <Button block onClick={() => { setUploadStep('transfers'); setUploadModalVisible(true); loadTransferList(1); }}>
          📋 传输列表
        </Button>
      </div>
      
      {orders.length === 0 ? (
        <Empty description="暂无订单" />
      ) : (
        orders.map((order) => (
          <div key={order.id} className="order-card" onClick={() => viewOrderDetail(order.id)}>
            <div className="order-card-header">
              <div>
                <div className="order-card-title">{order.movieName}</div>
                <div className="order-card-meta">{formatTime(order.createdAt)} | {order.templateName}</div>
              </div>
              <Tag color={getStatusColor(order.status)}>{getStatusText(order.status)}</Tag>
            </div>
            {order.status === 'error' && (() => {
              const failedTask = order.tasks.find(t => t.status === 'error');
              const stageMap: Record<string, string> = {
                viral_learn: '生成爆款模型', script: '生成解说文案',
                clip: '生成剪辑脚本', video: '合成视频'
              };
              const stageName = failedTask ? stageMap[failedTask.type] || failedTask.type : '未知阶段';
              const reason = failedTask?.errorMessage || order.errorMessage || '未知原因';
              return (
                <div className="order-card-error">
                  <div className="order-card-error-stage">失败阶段: {stageName}</div>
                  <div className="order-card-error-reason">原因: {reason}</div>
                </div>
              );
            })()}
          </div>
        ))
      )}
    </div>
  );
  
  // 渲染订单详情页
  const renderDetailPage = () => {
    if (!currentOrder) return null;
    
    const getTaskIcon = (type: string) => {
      switch (type) {
        case 'viral_learn': return '🧠';
        case 'script': return '📝';
        case 'clip': return '✂️';
        case 'video': return '🎬';
        default: return '📋';
      }
    };
    
    const getTaskName = (type: string) => {
      switch (type) {
        case 'viral_learn': return '生成爆款模型';
        case 'script': return '生成解说文案';
        case 'clip': return '生成剪辑脚本';
        case 'video': return '合成视频';
        default: return type;
      }
    };
    
    return (
      <div className="page">
        <div className="back-btn" onClick={() => { stopWorkflow(); refreshOrders(); setPage('orders'); }}>
          ← 返回订单列表
        </div>
        
        <div className="detail-info-card">
          <div className="detail-info-header">
            <h3>{currentOrder.movieName}</h3>
            <Tag color={getStatusColor(currentOrder.status)}>{getStatusText(currentOrder.status)}</Tag>
          </div>
          <div className="detail-info-grid">
            <div className="detail-info-item">
              <span className="label">模板:</span>
              <span className="value">{currentOrder.templateName}{currentOrder.templateSource === 'generate' ? ' (自动生成)' : ''}</span>
            </div>
            <div className="detail-info-item">
              <span className="label">平台:</span>
              <span className="value">{currentOrder.targetPlatform}</span>
            </div>
            <div className="detail-info-item">
              <span className="label">BGM:</span>
              <span className="value">{currentOrder.bgmName}</span>
            </div>
            <div className="detail-info-item">
              <span className="label">配音:</span>
              <span className="value">{currentOrder.dubbingName}</span>
            </div>
            <div className="detail-info-item">
              <span className="label">交付:</span>
              <span className="value">{currentOrder.deliveryMode === 'staged' ? '分段式' : '一站式'}</span>
            </div>
            <div className="detail-info-item">
              <span className="label">创建:</span>
              <span className="value">{formatTime(currentOrder.createdAt)}</span>
            </div>
            {currentOrder.learningModelId && (
              <div className="detail-info-item full-row" style={{ fontSize: 10, color: '#999' }}>
                模型ID: {currentOrder.learningModelId}
              </div>
            )}
          </div>
          {currentOrder.videoUrl && (
            <a className="detail-video-link" href={currentOrder.videoUrl} target="_blank" rel="noopener noreferrer">
              🎬 查看视频
            </a>
          )}
          {currentOrder.errorMessage && (
            <Alert type="error" message="错误信息" description={currentOrder.errorMessage} style={{ marginTop: 12 }} />
          )}
        </div>
        
        <div className="task-section-title">📋 任务进度</div>
        {currentOrder.tasks.length === 0 ? (
          <div style={{ color: '#999', fontSize: 12 }}>暂无任务记录</div>
        ) : (
          currentOrder.tasks.map((task, idx) => (
            <div key={idx} className="task-card">
              <div className="task-card-header">
                <div className="task-card-name">
                  <span>{getTaskIcon(task.type)}</span>
                  <span>{getTaskName(task.type)}</span>
                </div>
                <Tag color={getStatusColor(task.status)}>{getStatusText(task.status)}</Tag>
              </div>
              <div className="task-card-meta">
                <span>ID: {task.taskId}</span>
                {task.orderNum && <span>单号: {task.orderNum}</span>}
                <br/>
                <span>轮询: {task.pollCount}次</span>
                <span>耗时: {formatDuration(task.elapsedTime)}</span>
              </div>
              {(task.status === 'done' || task.status === 'wait_confirm') && task.result && (
                <div className="task-product">
                  {task.type === 'viral_learn' && (
                    <div><strong>🧠 模型ID:</strong> {task.result?.api_response?.data?.results?.order_info?.learning_model_id || '未知'}</div>
                  )}
                  {task.type === 'script' && (
                    <div><strong>📄 文案文件:</strong> {task.result?.api_response?.data?.results?.tasks?.[0]?.task_result || '未知'}</div>
                  )}
                  {task.type === 'clip' && (
                    <div><strong>📄 剪辑脚本:</strong> {(() => {
                      try {
                        const taskResult = task.result?.api_response?.data?.results?.tasks?.[0]?.task_result;
                        if (typeof taskResult === 'string') {
                          const parsed = JSON.parse(taskResult);
                          return parsed.clip_data_file || taskResult;
                        }
                        return taskResult || '未知';
                      } catch { return task.result?.api_response?.data?.results?.tasks?.[0]?.task_result || '未知'; }
                    })()}</div>
                  )}
                  {task.type === 'video' && (
                    <div><strong>🎬 视频地址:</strong> {task.result?.api_response?.data?.results?.tasks?.[0]?.video_url || '未知'}</div>
                  )}
                </div>
              )}
              {task.status === 'wait_confirm' && (
                <div className="task-confirm-block">
                  <div className="task-confirm-title">
                    {task.type === 'script' ? '📝 解说文案已生成，请确认' : '✂️ 剪辑脚本已生成，请确认'}
                  </div>
                  <Button type="primary" size="small" style={{ borderRadius: 8 }} onClick={() => confirmTask(currentOrder.id, task.type)}>
                    确认并继续下一步
                  </Button>
                </div>
              )}
              {task.status === 'error' && (
                <div className="task-error-block">
                  {task.errorMessage && (
                    <div className="task-error-msg">{task.errorMessage}</div>
                  )}
                  <Button
                    type="primary"
                    danger
                    size="small"
                    style={{ borderRadius: 8 }}
                    loading={retryingTaskType === task.type}
                    onClick={() => retryFailedTask(currentOrder.id, task.type)}
                  >
                    🔄 重试该任务
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    );
  };
  
  // 渲染创建订单页（工作流）
  const renderCreatePage = () => (
    <div className="page" style={{ maxWidth: 420 }}>
      <div className="back-btn" onClick={() => { stopWorkflow(); refreshOrders(); setPage('orders'); }}>
        ← 返回订单列表
      </div>
      
      <div className="create-page-title">创建新订单</div>
      
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: '选择电影' },
          { title: isCustomMovie ? '爆款模型' : '选择模板' },
          { title: '配置' },
          { title: '执行' }
        ]}
      />
      
      <div className="create-step-content">
        {renderStepContent()}
      </div>
      
      {currentStep < 3 && taskPhase === 'idle' && (
        <div className="step-actions">
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>
              上一步
            </Button>
          )}
          <Button
            type="primary"
            className="btn-primary-gradient"
            disabled={!canGoNext()}
            onClick={() => setCurrentStep(currentStep + 1)}
            style={{ flex: 1 }}
          >
            {currentStep === 2 ? '确认配置' : '下一步'}
          </Button>
        </div>
      )}
    </div>
  );

  // 根据页面类型渲染
  const pageContent = (() => {
    switch (page) {
      case 'login':
        return renderLoginPage();
      case 'orders':
        return renderOrdersPage();
      case 'detail':
        return renderDetailPage();
      case 'create':
        return renderCreatePage();
      default:
        return renderLoginPage();
    }
  })();

  return (
    <>
      {pageContent}
      {renderUploadModal()}
    </>
  );
}
