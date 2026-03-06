import React, { useEffect, useState, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { Steps, Button, Card, List, Avatar, Alert, Select, Input, Spin, Result, Tag, Empty, Radio } from 'antd';
import { IMovie, INarratorTemplate, IBGM, IDubbing, IEpisodeData, ICloudFile } from './types';
import { fetchMovies } from './api/movies';
import { fetchTemplates } from './api/templates';
import { fetchBGMList } from './api/bgm';
import { fetchDubbingList } from './api/dubbing';
import { generateScript, generateClip, synthesizeVideo, generateViralModel, fetchCloudFiles, pollTaskUntilComplete } from './api/tasks';
import {
  IOrder, ITask, OrderStatus, DeliveryMode,
  getCurrentUser, setCurrentUser, logout,
  getUserOrders, getOrder, createOrder, saveOrder,
  updateOrderStatus, updateOrderTask, setOrderVideoUrl,
  formatTime, formatDuration, getStatusText, getStatusColor
} from './store';

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
  
  // Step 2 (自定义电影): 云盘文件 + 爆款模型配置
  const [cloudFiles, setCloudFiles] = useState<ICloudFile[]>([]);
  const [cloudFilesLoading, setCloudFilesLoading] = useState(false);
  const [cloudFilesPage, setCloudFilesPage] = useState(1);
  const [cloudFilesTotalPages, setCloudFilesTotalPages] = useState(1);
  const [selectedSrtFile, setSelectedSrtFile] = useState<ICloudFile | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<ICloudFile | null>(null);
  const [narratorType, setNarratorType] = useState('电影');
  const [modelVersion, setModelVersion] = useState('advanced');
  
  // Step 3: BGM和配音数据
  const [bgmList, setBgmList] = useState<IBGM[]>([]);
  const [dubbingList, setDubbingList] = useState<IDubbing[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [selectedBGM, setSelectedBGM] = useState<IBGM | null>(null);
  const [selectedDubbing, setSelectedDubbing] = useState<IDubbing | null>(null);
  const [targetPlatform, setTargetPlatform] = useState('抖音短视频平台');
  const [targetCharacterName, setTargetCharacterName] = useState('');
  const [vendorRequirements, setVendorRequirements] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('staged');
  
  // 任务执行状态（仅用于创建页）
  const [taskPhase, setTaskPhase] = useState<TaskPhase>('idle');
  const [taskMessage, setTaskMessage] = useState('');
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
  
  // 加载云盘文件列表
  const loadCloudFiles = useCallback(async (page: number = 1) => {
    setCloudFilesLoading(true);
    try {
      const res = await fetchCloudFiles(appKey, page, 20);
      setCloudFiles(res.api_response.data.items);
      setCloudFilesTotalPages(res.api_response.data.total_pages);
      setCloudFilesPage(res.api_response.data.page);
    } catch (error) {
      console.error('加载云盘文件失败:', error);
    } finally {
      setCloudFilesLoading(false);
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
          
          // 任务完成，更新
          const orderNum = result.api_response?.data?.task_order_num || '';
          updateOrderTask(orderId, {
            ...runningTask,
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
              ...runningTask,
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
            playlet_name: order.movieName === '自定义' ? '自定义解说' : order.movieName,
            playlet_num: '1',
            target_platform: order.targetPlatform,
            task_count: 1,
            target_character_name: '主角',
            refine_srt_gaps: "0",
            vendor_requirements: `投放在${order.targetPlatform}，吸引18-35岁的年轻用户观看。`,
            story_info: ''
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
          // 未知状态，退出
          console.warn('订单状态异常，无法继续:', order.status, order.tasks.map(t => `${t.type}:${t.status}`));
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
        const runningTask = order.tasks.find(t => t.status === 'running');
        if (runningTask) {
          updateOrderTask(orderId, { ...runningTask, status: 'error', errorMessage: error.message });
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
  
  // 开始创建新订单
  const startCreateOrder = () => {
    setCurrentStep(0);
    setSelectedMovie(null);
    setSelectedTemplate(null);
    setSelectedBGM(null);
    setSelectedDubbing(null);
    setSelectedSrtFile(null);
    setSelectedVideoFile(null);
    setNarratorType('电影');
    setModelVersion('advanced');
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
    if (currentStep === 1) {
      if (isCustomMovie) {
        if (cloudFiles.length === 0) loadCloudFiles();
      } else {
        if (templates.length === 0) loadTemplates();
      }
    }
    if (currentStep === 2 && bgmList.length === 0) {
      loadConfig();
    }
  }, [currentStep, isCustomMovie, templates.length, cloudFiles.length, bgmList.length, loadTemplates, loadCloudFiles, loadConfig]);
  
  // 执行完整任务流程：创建订单+第一个任务，然后跳转到详情页由resumeOrderWorkflow接管
  const executeWorkflow = async () => {
    if (!selectedMovie || !selectedBGM || !selectedDubbing) {
      setErrorMessage('请完成所有配置');
      return;
    }
    if (!isCustomMovie && !selectedTemplate) {
      setErrorMessage('请选择解说模板');
      return;
    }
    if (isCustomMovie && !selectedSrtFile) {
      setErrorMessage('请选择视频SRT文件');
      return;
    }
    
    setTaskPhase('script');
    setTaskMessage('正在创建订单...');
    setErrorMessage('');
    
    try {
      // 创建订单记录
      const order = createOrder({
        appKey: appKey,
        movieId: selectedMovie.id,
        movieName: selectedMovie.name,
        templateId: isCustomMovie ? '' : selectedTemplate!.learning_model_id,
        templateName: isCustomMovie ? '自动生成' : selectedTemplate!.name,
        bgmId: selectedBGM.bgm_file_id,
        bgmName: selectedBGM.name,
        dubbingId: selectedDubbing.dubbing_id,
        dubbingName: selectedDubbing.name,
        targetPlatform: targetPlatform,
        deliveryMode: deliveryMode,
        templateSource: isCustomMovie ? 'generate' : 'existing',
        videoPath: selectedVideoFile?.file_id || '',
        videoSrtPath: selectedSrtFile?.file_id || '',
        narratorType: narratorType,
        modelVersion: modelVersion
      });
      
      if (isCustomMovie) {
        // 自定义电影：先创建爆款模型任务
        updateOrderStatus(order.id, 'viral_learn');
        setTaskMessage('正在创建爆款模型任务...');
        
        const viralResponse = await generateViralModel({
          app_key: appKey,
          video_path: selectedVideoFile?.file_id || '',
          video_srt_path: selectedSrtFile!.file_id,
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
        // 普通电影：直接创建文案任务
        updateOrderStatus(order.id, 'script');
        setTaskMessage('正在创建文案任务...');
        
        const episodesData: IEpisodeData[] = [{
          num: 1,
          srt_oss_key: selectedMovie.srt_file_id,
          video_oss_key: selectedMovie.video_file_id,
          negative_oss_key: selectedMovie.video_file_id
        }];
        
        const scriptResponse = await generateScript({
          app_key: appKey,
          learning_model_id: selectedTemplate!.learning_model_id,
          episodes_data: episodesData,
          playlet_name: selectedMovie.name,
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
    }
  };
  
  // 重置流程
  const resetWorkflow = () => {
    setCurrentStep(0);
    setSelectedMovie(null);
    setSelectedTemplate(null);
    setSelectedBGM(null);
    setSelectedDubbing(null);
    setSelectedSrtFile(null);
    setSelectedVideoFile(null);
    setNarratorType('电影');
    setModelVersion('advanced');
    setTaskPhase('idle');
    setTaskMessage('');
    setErrorMessage('');
  };
  
  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <h3 style={{ marginBottom: 16 }}>选择爆款电影</h3>
            {moviesLoading ? (
              <Spin tip="加载中..." />
            ) : (
              <List
                grid={{ gutter: 16, column: 1 }}
                dataSource={movies}
                renderItem={(movie) => (
                  <List.Item>
                    <Card
                      hoverable
                      style={{
                        border: selectedMovie?.id === movie.id ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        background: selectedMovie?.id === movie.id ? '#e6f7ff' : '#fff'
                      }}
                      onClick={() => setSelectedMovie(movie)}
                    >
                      <Card.Meta
                        avatar={<Avatar src={movie.cover} shape="square" size={64} />}
                        title={movie.name}
                        description={
                          <div style={{ fontSize: 12 }}>
                            <div>类型: {movie.type}</div>
                            <div style={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap',
                              maxWidth: 200 
                            }}>
                              {movie.story_info?.slice(0, 50)}...
                            </div>
                          </div>
                        }
                      />
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </div>
        );
        
      case 1:
        if (isCustomMovie) {
          // 自定义电影：云盘选文件 + 爆款模型配置
          return (
            <div>
              <h3 style={{ marginBottom: 16 }}>配置爆款模型</h3>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>解说类型</label>
                <Select style={{ width: '100%' }} value={narratorType} onChange={setNarratorType}
                  options={[
                    { label: '电影', value: '电影' },
                    { label: '短剧', value: '短剧' },
                    { label: '第一人称电影', value: '第一人称电影' },
                    { label: '多语种电影', value: '多语种电影' },
                    { label: '第一人称多语种', value: '第一人称多语种' }
                  ]}
                />
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>模型版本</label>
                <Select style={{ width: '100%' }} value={modelVersion} onChange={setModelVersion}
                  options={[
                    { label: '高级版 (advanced)', value: 'advanced' },
                    { label: '标准版 (standard)', value: 'standard' },
                    { label: '结构严格版 (strict)', value: 'strict' }
                  ]}
                />
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                  视频SRT文件 <span style={{ color: '#ff4d4f' }}>*必需</span>
                </label>
                {selectedSrtFile && (
                  <Tag color="blue" closable onClose={() => setSelectedSrtFile(null)} style={{ marginBottom: 8 }}>
                    {selectedSrtFile.file_name}
                  </Tag>
                )}
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                  视频文件 <span style={{ color: '#999' }}>可选</span>
                </label>
                {selectedVideoFile && (
                  <Tag color="green" closable onClose={() => setSelectedVideoFile(null)} style={{ marginBottom: 8 }}>
                    {selectedVideoFile.file_name}
                  </Tag>
                )}
              </div>
              
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 'bold' }}>从云盘选择文件</label>
                <Button size="small" onClick={() => loadCloudFiles(cloudFilesPage)} loading={cloudFilesLoading}>刷新</Button>
              </div>
              
              {cloudFilesLoading ? (
                <Spin tip="加载文件列表..." />
              ) : (
                <>
                  <List
                    size="small"
                    dataSource={cloudFiles}
                    renderItem={(file) => {
                      const isSrt = ['.srt', '.txt'].includes(file.suffix.startsWith('.') ? file.suffix : `.${file.suffix}`);
                      const isMp4 = file.suffix === '.mp4' || file.suffix === 'mp4';
                      const isSelectedAsSrt = selectedSrtFile?.file_id === file.file_id;
                      const isSelectedAsVideo = selectedVideoFile?.file_id === file.file_id;
                      return (
                        <Card size="small" style={{ marginBottom: 4, background: (isSelectedAsSrt || isSelectedAsVideo) ? '#e6f7ff' : '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.file_name}
                              </div>
                              <div style={{ fontSize: 10, color: '#999' }}>
                                {(file.file_size / 1024 / 1024).toFixed(1)}MB | {file.suffix} | {file.created_at}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                              {isSrt && (
                                <Button size="small" type={isSelectedAsSrt ? 'primary' : 'default'}
                                  onClick={() => setSelectedSrtFile(isSelectedAsSrt ? null : file)}>
                                  {isSelectedAsSrt ? '已选为SRT' : '选为SRT'}
                                </Button>
                              )}
                              {isMp4 && (
                                <Button size="small" type={isSelectedAsVideo ? 'primary' : 'default'}
                                  onClick={() => setSelectedVideoFile(isSelectedAsVideo ? null : file)}>
                                  {isSelectedAsVideo ? '已选为视频' : '选为视频'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    }}
                  />
                  {cloudFilesTotalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                      <Button size="small" disabled={cloudFilesPage <= 1} onClick={() => loadCloudFiles(cloudFilesPage - 1)}>上一页</Button>
                      <span style={{ fontSize: 12, lineHeight: '24px' }}>{cloudFilesPage}/{cloudFilesTotalPages}</span>
                      <Button size="small" disabled={cloudFilesPage >= cloudFilesTotalPages} onClick={() => loadCloudFiles(cloudFilesPage + 1)}>下一页</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }
        
        // 普通电影：选择模板
        return (
          <div>
            <h3 style={{ marginBottom: 16 }}>选择解说模板</h3>
            {templatesLoading ? (
              <Spin tip="加载中..." />
            ) : (
              <List
                grid={{ gutter: 16, column: 1 }}
                dataSource={templates}
                renderItem={(template) => (
                  <List.Item>
                    <Card
                      hoverable
                      style={{
                        border: selectedTemplate?.id === template.id ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        background: selectedTemplate?.id === template.id ? '#e6f7ff' : '#fff'
                      }}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <Card.Meta
                        avatar={template.img ? <Avatar src={template.img} shape="square" size={64} /> : undefined}
                        title={template.name}
                        description={
                          <div style={{ fontSize: 12 }}>
                            <div>类型: {template.narrator_type || template.type}</div>
                            <div>语言: {template.language || '中文'}</div>
                            {template.tags && <div>标签: {template.tags}</div>}
                          </div>
                        }
                      />
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </div>
        );
        
      case 2:
        return (
          <div>
            <h3 style={{ marginBottom: 16 }}>配置BGM/配音</h3>
            {configLoading ? (
              <Spin tip="加载中..." />
            ) : (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>目标平台</label>
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
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>主角名称 (可选)</label>
                  <Input
                    placeholder={selectedMovie?.character_name || '主角'}
                    value={targetCharacterName}
                    onChange={(e) => setTargetCharacterName(e.target.value)}
                  />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>选择BGM</label>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择背景音乐"
                    value={selectedBGM?.id}
                    onChange={(id) => setSelectedBGM(bgmList.find(b => b.id === id) || null)}
                    options={bgmList.map(bgm => ({
                      label: `${bgm.name} ${bgm.tag ? `(${bgm.tag})` : ''}`,
                      value: bgm.id
                    }))}
                  />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>选择配音</label>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择配音角色"
                    value={selectedDubbing?.id}
                    onChange={(id) => setSelectedDubbing(dubbingList.find(d => d.id === id) || null)}
                    options={dubbingList.map(dub => ({
                      label: `${dub.name} (${dub.role})`,
                      value: dub.id
                    }))}
                  />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>厂商要求 (可选)</label>
                  <Input.TextArea
                    rows={2}
                    placeholder="投放要求、目标用户等"
                    value={vendorRequirements}
                    onChange={(e) => setVendorRequirements(e.target.value)}
                  />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>交付模式</label>
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
            <h3 style={{ marginBottom: 16 }}>任务执行</h3>
            
            {taskPhase === 'idle' && (
              <div>
                <Alert
                  type="info"
                  message="确认配置"
                  description={
                    <div style={{ fontSize: 12 }}>
                      <p><strong>电影:</strong> {selectedMovie?.name}</p>
                      {isCustomMovie ? (
                        <>
                          <p><strong>SRT文件:</strong> {selectedSrtFile?.file_name}</p>
                          {selectedVideoFile && <p><strong>视频文件:</strong> {selectedVideoFile.file_name}</p>}
                          <p><strong>解说类型:</strong> {narratorType}</p>
                          <p><strong>模型版本:</strong> {modelVersion}</p>
                          <p style={{ color: '#eb2f96', fontSize: 10 }}>将先生成爆款模型，再自动创建文案</p>
                        </>
                      ) : (
                        <>
                          <p style={{ color: '#999', fontSize: 10 }}>视频ID: {selectedMovie?.video_file_id?.slice(0, 20)}...</p>
                          <p style={{ color: '#999', fontSize: 10 }}>字幕ID: {selectedMovie?.srt_file_id?.slice(0, 20)}...</p>
                          <p><strong>模板:</strong> {selectedTemplate?.name}</p>
                          <p style={{ color: '#999', fontSize: 10 }}>模型ID: {selectedTemplate?.learning_model_id}</p>
                        </>
                      )}
                      <p><strong>BGM:</strong> {selectedBGM?.name}</p>
                      <p><strong>配音:</strong> {selectedDubbing?.name}</p>
                      <p><strong>平台:</strong> {targetPlatform}</p>
                      <p><strong>交付模式:</strong> {deliveryMode === 'staged' ? '分段式交付' : '一站式交付'}</p>
                    </div>
                  }
                  style={{ marginBottom: 16 }}
                />
                <Button type="primary" size="large" block onClick={executeWorkflow}>
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
      case 0: return !!selectedMovie;
      case 1: return isCustomMovie ? !!selectedSrtFile : !!selectedTemplate;
      case 2: return !!selectedBGM && !!selectedDubbing;
      default: return false;
    }
  };

  // 渲染登录页
  const renderLoginPage = () => (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2 style={{ marginBottom: 24 }}>🎬 AI视频解说生成</h2>
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
          <div style={{ color: '#ff4d4f', fontSize: 12 }}>{loginError}</div>
        )}
      </div>
      <Button type="primary" size="large" block onClick={handleLogin}>
        登录
      </Button>
    </div>
  );
  
  // 渲染订单列表页
  const renderOrdersPage = () => (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>我的解说订单</h3>
        <div>
          <Button size="small" onClick={refreshOrders} style={{ marginRight: 8 }}>刷新</Button>
          <Button size="small" type="link" onClick={handleLogout}>退出</Button>
        </div>
      </div>
      
      <Button type="primary" block style={{ marginBottom: 16 }} onClick={startCreateOrder}>
        + 创建新订单
      </Button>
      
      {orders.length === 0 ? (
        <Empty description="暂无订单" />
      ) : (
        <List
          dataSource={orders}
          renderItem={(order) => (
            <Card
              size="small"
              hoverable
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => viewOrderDetail(order.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{order.movieName}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {formatTime(order.createdAt)} | {order.templateName}
                  </div>
                </div>
                <Tag color={getStatusColor(order.status)}>{getStatusText(order.status)}</Tag>
              </div>
            </Card>
          )}
        />
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
      <div style={{ padding: 16 }}>
        <Button type="link" style={{ padding: 0, marginBottom: 16 }} onClick={() => { stopWorkflow(); refreshOrders(); setPage('orders'); }}>
          ← 返回订单列表
        </Button>
        
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{currentOrder.movieName}</h3>
            <Tag color={getStatusColor(currentOrder.status)}>{getStatusText(currentOrder.status)}</Tag>
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            <div>模板: {currentOrder.templateName}{currentOrder.templateSource === 'generate' ? ' (自动生成)' : ''}</div>
            {currentOrder.learningModelId && <div style={{ fontSize: 10, color: '#999' }}>模型ID: {currentOrder.learningModelId}</div>}
            <div>BGM: {currentOrder.bgmName} | 配音: {currentOrder.dubbingName}</div>
            <div>平台: {currentOrder.targetPlatform} | 交付: {currentOrder.deliveryMode === 'staged' ? '分段式' : '一站式'}</div>
            <div>创建时间: {formatTime(currentOrder.createdAt)}</div>
          </div>
          {currentOrder.videoUrl && (
            <div style={{ marginTop: 8 }}>
              <a href={currentOrder.videoUrl} target="_blank" rel="noopener noreferrer">
                🎬 查看视频
              </a>
            </div>
          )}
          {currentOrder.errorMessage && (
            <Alert
              type="error"
              message="错误信息"
              description={currentOrder.errorMessage}
              style={{ marginTop: 8 }}
            />
          )}
        </Card>
        
        <h4 style={{ marginBottom: 8 }}>任务进度</h4>
        {currentOrder.tasks.length === 0 ? (
          <div style={{ color: '#999', fontSize: 12 }}>暂无任务记录</div>
        ) : (
          <List
            size="small"
            dataSource={currentOrder.tasks}
            renderItem={(task) => (
              <Card size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ marginRight: 8 }}>{getTaskIcon(task.type)}</span>
                    <strong>{getTaskName(task.type)}</strong>
                  </div>
                  <Tag color={getStatusColor(task.status)}>{getStatusText(task.status)}</Tag>
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  <div>任务ID: {task.taskId.slice(0, 16)}...</div>
                  {task.orderNum && <div>订单号: {task.orderNum.slice(0, 20)}...</div>}
                  <div>轮询: {task.pollCount}次 | 耗时: {formatDuration(task.elapsedTime)}</div>
                </div>
                {task.status === 'wait_confirm' && (
                  <div style={{ marginTop: 8, padding: 8, background: '#fff7e6', borderRadius: 4, border: '1px solid #ffd591' }}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: '#fa8c16' }}>
                      {task.type === 'script' ? '📝 解说文案已生成，请确认' : '✂️ 剪辑脚本已生成，请确认'}
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 8, wordBreak: 'break-all' }}>
                      {task.type === 'script' && (
                        <div>文案文件: {task.result?.api_response?.data?.results?.tasks?.[0]?.task_result || '未知'}</div>
                      )}
                      {task.type === 'clip' && (
                        <div>剪辑脚本: {(() => {
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
                    </div>
                    <Button type="primary" size="small" onClick={() => confirmTask(currentOrder.id, task.type)}>
                      确认并继续下一步
                    </Button>
                  </div>
                )}
              </Card>
            )}
          />
        )}
      </div>
    );
  };
  
  // 渲染创建订单页（工作流）
  const renderCreatePage = () => (
    <div style={{ padding: 16, maxWidth: 400 }}>
      <Button type="link" style={{ padding: 0, marginBottom: 8 }} onClick={() => { stopWorkflow(); refreshOrders(); setPage('orders'); }}>
        ← 返回订单列表
      </Button>
      
      <h3 style={{ marginBottom: 16, textAlign: 'center' }}>创建新订单</h3>
      
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
      
      <div style={{ 
        minHeight: 300, 
        maxHeight: 400, 
        overflowY: 'auto',
        marginBottom: 16,
        padding: '0 4px'
      }}>
        {renderStepContent()}
      </div>
      
      {currentStep < 3 && taskPhase === 'idle' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>
              上一步
            </Button>
          )}
          <Button
            type="primary"
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
}
