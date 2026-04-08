import React, { useEffect, useState, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { Steps, Button, Card, List, Avatar, Alert, Select, Input, Spin, Result, Tag, Empty, Radio, message, Tooltip, Modal } from 'antd';
import { IMovie, INarratorTemplate, IBGM, IDubbing, IEpisodeData, ICloudFile, IPreUploadFile, IPreUploadResponse, IEstimatePointsResponse, ITaskConsumCalcResponse, IMovieSearchResult } from './types';
import { fetchMovies } from './api/movies';
import { fetchTemplates } from './api/templates';
import { fetchBGMList } from './api/bgm';
import { fetchDubbingList } from './api/dubbing';
import { generateScript, generateClip, synthesizeVideo, generateViralModel, fetchCloudFiles, fetchCloudFilesDirect, pollTaskUntilComplete, preUpload, uploadTask, fetchTransferList, deleteFile, updatePreFile, fetchUserBalance, fetchCloudDriveUsage, estimatePoints, taskConsumCalcPoints, fetchFileDownloadUrl, generateOriginalScript, generateOriginalClip, searchMovies, getPresignedUploadUrl, reportUploadResult } from './api/tasks';
import {
  IOrder, ITask, TaskType, OrderStatus, DeliveryMode,
  getCurrentUser, setCurrentUser, logout,
  getUserOrders, getOrder, createOrder, saveOrder,
  updateOrderStatus, updateOrderTask, setOrderVideoUrl,
  loadOrdersFromBackend,
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
  const [showContactModal, setShowContactModal] = useState(false);
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
  const [episodeFileStep, setEpisodeFileStep] = useState<'srt' | 'video' | null>('srt');
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
  const [episodePairs, setEpisodePairs] = useState<Array<{ srt: ICloudFile; video: ICloudFile }>>([]);

  // Step 1 (自定义模板): 爆款SRT文件选择 + 爆款模型配置
  const [viralSrtFiles, setViralSrtFiles] = useState<ICloudFile[]>([]);
  const [viralSrtFilesLoading, setViralSrtFilesLoading] = useState(false);
  const [viralSrtFilesPage, setViralSrtFilesPage] = useState(1);
  const [viralSrtFilesTotalPages, setViralSrtFilesTotalPages] = useState(1);
  const [selectedViralSrtFile, setSelectedViralSrtFile] = useState<ICloudFile | null>(null);
  const [viralVideoFiles, setViralVideoFiles] = useState<ICloudFile[]>([]);
  const [viralVideoFilesLoading, setViralVideoFilesLoading] = useState(false);
  const [viralVideoFilesPage, setViralVideoFilesPage] = useState(1);
  const [viralVideoFilesTotalPages, setViralVideoFilesTotalPages] = useState(1);
  const [selectedViralVideoFile, setSelectedViralVideoFile] = useState<ICloudFile | null>(null);
  const [narratorType, setNarratorType] = useState('movie');
  const [modelVersion, setModelVersion] = useState('standard');

  // 原创文案相关状态
  const [copywritingType, setCopywritingType] = useState<'secondary' | 'original'>('secondary');
  const [originalMode, setOriginalMode] = useState('热门影视');
  const [originalLanguage, setOriginalLanguage] = useState('中文');
  const [originalModel, setOriginalModel] = useState<'flash' | 'standard'>('flash');
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchLoading, setMovieSearchLoading] = useState(false);
  const [movieSearchResults, setMovieSearchResults] = useState<IMovieSearchResult[]>([]);
  const [movieSearchModalVisible, setMovieSearchModalVisible] = useState(false);
  const [confirmedMovieJson, setConfirmedMovieJson] = useState<IMovieSearchResult | null>(null);

  // 解析 character_name（JSON数组字符串）取第一个演员名
  const parseFirstCharacterName = (characterName: string | null): string => {
    if (!characterName) return '';
    try {
      const arr = JSON.parse(characterName);
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    } catch { /* not JSON, use as-is */ }
    return characterName;
  };

  // 从系统爆款电影构建 confirmed_movie_json
  const buildConfirmedMovieJsonFromMovie = (movie: IMovie): IMovieSearchResult => {
    let stars: string[] = [];
    if (movie.character_name) {
      try { stars = JSON.parse(movie.character_name); } catch { stars = [movie.character_name]; }
    }
    return {
      year: movie.year || '',
      genre: movie.type || '',
      stars,
      title: movie.title || '',
      summary: movie.story_info || '',
      director: '',
      local_title: movie.name
    };
  };

  // 搜索电影信息（原创文案 + 自定义电影时使用）
  const handleSearchMovies = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setMovieSearchLoading(true);
    setMovieSearchResults([]);
    try {
      const results = await searchMovies(appKey, query.trim());
      setMovieSearchResults(results);
    } catch (err: any) {
      message.error(err?.message || '搜索电影失败');
    } finally {
      setMovieSearchLoading(false);
    }
  }, [appKey]);

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

  // Step 2 (自定义配音): 文本输入
  const [customDubbingText, setCustomDubbingText] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('抖音短视频平台');
  const [targetCharacterName, setTargetCharacterName] = useState('');
  const [vendorRequirements, setVendorRequirements] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('staged');
  const [movieListExpanded, setMovieListExpanded] = useState(true);
  const [templateListExpanded, setTemplateListExpanded] = useState(true);
  const [bgmListExpanded, setBgmListExpanded] = useState(true);
  const [dubbingListExpanded, setDubbingListExpanded] = useState(true);
  
  // 上传文件相关状态
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadLink, setUploadLink] = useState('');
  const [uploadTag, setUploadTag] = useState('');
  const [uploadTypeTag, setUploadTypeTag] = useState('电影');
  const [uploadStep, setUploadStep] = useState<'cloud_drive' | 'input' | 'preview' | 'uploading' | 'transfers'>('cloud_drive');
  const [preUploadLoading, setPreUploadLoading] = useState(false);
  const [preUploadResult, setPreUploadResult] = useState<IPreUploadResponse | null>(null);
  const [preUploadUploadId, setPreUploadUploadId] = useState('');
  const [uploadTaskLoading, setUploadTaskLoading] = useState(false);
  const [transferList, setTransferList] = useState<any[]>([]);
  const [transferListLoading, setTransferListLoading] = useState(false);
  const [transferListTotal, setTransferListTotal] = useState(0);
  const [transferListPage, setTransferListPage] = useState(1);
  const transferPollingRef = useRef<NodeJS.Timeout | null>(null);
  const [updatingRelationFileId, setUpdatingRelationFileId] = useState<string | null>(null);

  // 本地文件上传相关状态
  const [uploadMode, setUploadMode] = useState<'link' | 'local'>('link');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localUploadProgress, setLocalUploadProgress] = useState(0);
  const [localUploading, setLocalUploading] = useState(false);
  const localUploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const [fileDisguiseWarning, setFileDisguiseWarning] = useState<string | null>(null);
  const [fileFormatError, setFileFormatError] = useState<string | null>(null);

  // 允许上传的文件扩展名
  const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.mkv', '.mov', '.srt', '.png', '.jpg', '.jpeg']);
  const ALLOWED_ACCEPT = Array.from(ALLOWED_EXTENSIONS).join(',');

  const checkFileExtension = (file: File): string | null => {
    const ext = file.name.includes('.') ? ('.' + file.name.split('.').pop()!.toLowerCase()) : '';
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return `不支持的文件格式 ${ext || '(无扩展名)'}，仅支持：${Array.from(ALLOWED_EXTENSIONS).join('、')}`;
    }
    return null;
  };

  // 文件伪装检测：通过魔术字节判断文件真实格式，与扩展名比对
  const detectFileDisguise = async (file: File): Promise<string | null> => {
    // 魔术字节签名表：[偏移量, 字节序列, 真实格式名, 兼容扩展名列表]
    const signatures: Array<{ offset: number; magic: number[]; format: string; extensions: string[] }> = [
      // 视频
      { offset: 4, magic: [0x66, 0x74, 0x79, 0x70], format: 'mp4/mov', extensions: ['mp4', 'mov', 'm4v', 'm4a', 'f4v', '3gp', '3g2'] },
      { offset: 0, magic: [0x1A, 0x45, 0xDF, 0xA3], format: 'mkv/webm', extensions: ['mkv', 'webm'] },
      { offset: 0, magic: [0x46, 0x4C, 0x56, 0x01], format: 'flv', extensions: ['flv'] },
      { offset: 0, magic: [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11], format: 'wmv/wma', extensions: ['wmv', 'wma', 'asf'] },
      { offset: 0, magic: [0x00, 0x00, 0x01, 0xBA], format: 'mpeg', extensions: ['mpg', 'mpeg', 'vob'] },
      { offset: 0, magic: [0x00, 0x00, 0x01, 0xB3], format: 'mpeg', extensions: ['mpg', 'mpeg'] },
      // 音频
      { offset: 0, magic: [0x49, 0x44, 0x33], format: 'mp3', extensions: ['mp3'] },
      { offset: 0, magic: [0xFF, 0xFB], format: 'mp3', extensions: ['mp3'] },
      { offset: 0, magic: [0xFF, 0xF3], format: 'mp3', extensions: ['mp3'] },
      { offset: 0, magic: [0xFF, 0xF2], format: 'mp3', extensions: ['mp3'] },
      { offset: 0, magic: [0x66, 0x4C, 0x61, 0x43], format: 'flac', extensions: ['flac'] },
      { offset: 0, magic: [0x4F, 0x67, 0x67, 0x53], format: 'ogg', extensions: ['ogg', 'oga', 'ogv', 'opus'] },
      // 图片
      { offset: 0, magic: [0xFF, 0xD8, 0xFF], format: 'jpg', extensions: ['jpg', 'jpeg', 'jfif'] },
      { offset: 0, magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], format: 'png', extensions: ['png'] },
      { offset: 0, magic: [0x47, 0x49, 0x46, 0x38], format: 'gif', extensions: ['gif'] },
      { offset: 0, magic: [0x42, 0x4D], format: 'bmp', extensions: ['bmp'] },
      { offset: 0, magic: [0x49, 0x49, 0x2A, 0x00], format: 'tiff', extensions: ['tif', 'tiff'] },
      { offset: 0, magic: [0x4D, 0x4D, 0x00, 0x2A], format: 'tiff', extensions: ['tif', 'tiff'] },
      // 压缩包
      { offset: 0, magic: [0x50, 0x4B, 0x03, 0x04], format: 'zip', extensions: ['zip', 'xlsx', 'docx', 'pptx', 'jar', 'apk'] },
      { offset: 0, magic: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], format: 'rar', extensions: ['rar'] },
      { offset: 0, magic: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], format: '7z', extensions: ['7z'] },
      { offset: 0, magic: [0x1F, 0x8B], format: 'gzip', extensions: ['gz', 'tgz'] },
      // 文档
      { offset: 0, magic: [0x25, 0x50, 0x44, 0x46], format: 'pdf', extensions: ['pdf'] },
    ];

    // RIFF 容器需要特殊处理（AVI / WAV / WEBP 共用 RIFF 头）
    const riffSubTypes: Array<{ offset: number; magic: number[]; format: string; extensions: string[] }> = [
      { offset: 8, magic: [0x41, 0x56, 0x49, 0x20], format: 'avi', extensions: ['avi'] },
      { offset: 8, magic: [0x57, 0x41, 0x56, 0x45], format: 'wav', extensions: ['wav'] },
      { offset: 8, magic: [0x57, 0x45, 0x42, 0x50], format: 'webp', extensions: ['webp'] },
    ];

    const headerSize = 16;
    const blob = file.slice(0, headerSize);
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const extMatch = file.name.match(/\.([^.]+)$/);
    if (!extMatch) return null; // 无扩展名，不检测
    const ext = extMatch[1].toLowerCase();

    // 检查 RIFF 容器
    const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    if (isRiff) {
      for (const sub of riffSubTypes) {
        const match = sub.magic.every((b, i) => bytes[sub.offset + i] === b);
        if (match) {
          if (sub.extensions.includes(ext)) return null;
          return `${file.name} 文件伪装检测：后缀为 .${ext}，但实际文件格式为 ${sub.format}`;
        }
      }
      // RIFF 但子类型未知，不报警
      return null;
    }

    // 检查常规签名
    for (const sig of signatures) {
      if (sig.offset + sig.magic.length > bytes.length) continue;
      const match = sig.magic.every((b, i) => bytes[sig.offset + i] === b);
      if (match) {
        if (sig.extensions.includes(ext)) return null;
        return `${file.name} 文件伪装检测：后缀为 .${ext}，但实际文件格式为 ${sig.format}`;
        }
      }

    // 未匹配任何已知签名，放行
    return null;
  };

  // 我的云盘相关状态
  const [cloudDriveFiles, setCloudDriveFiles] = useState<ICloudFile[]>([]);
  const [cloudDriveFilesPage, setCloudDriveFilesPage] = useState(1);
  const [cloudDriveFilesTotalPages, setCloudDriveFilesTotalPages] = useState(1);
  const [cloudDriveFilesTotal, setCloudDriveFilesTotal] = useState(0);
  const [cloudDriveFilesLoading, setCloudDriveFilesLoading] = useState(false);
  const [cloudDriveSearch, setCloudDriveSearch] = useState('');
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // 用户信息 & 云盘用量
  const [userInfo, setUserInfo] = useState<{ nickname: string; balance: string; mobile: string; company_name: string } | null>(null);
  const [cloudDriveUsage, setCloudDriveUsage] = useState<{ used_size: number; max_size: number; file_count: number; usage_percentage: number } | null>(null);

  // 预估点数弹窗
  const [estimateModalVisible, setEstimateModalVisible] = useState(false);
  const [estimateResult, setEstimateResult] = useState<IEstimatePointsResponse | null>(null);
  const [taskCalcResult, setTaskCalcResult] = useState<ITaskConsumCalcResponse | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const [pendingConfirmInfo, setPendingConfirmInfo] = useState<{ orderId: string; taskType: string } | null>(null);

  // 刷新订单状态
  const [refreshingOrders, setRefreshingOrders] = useState(false);

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

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    setPlayingAudioUrl(null);
  }, []);
  
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
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
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

  // 加载爆款 Video 文件列表（search=mp4，用于自定义模板可选视频）
  const loadViralVideoFiles = useCallback(async (page: number = 1) => {
    setViralVideoFilesLoading(true);
    try {
      const res = await fetchCloudFilesDirect(appKey, { page, pageSize: 20, search: 'mp4' });
      setViralVideoFiles(res.data.items);
      setViralVideoFilesTotalPages(res.data.total_pages);
      setViralVideoFilesPage(res.data.page);
    } catch (error) {
      console.error('加载爆款Video文件失败:', error);
    } finally {
      setViralVideoFilesLoading(false);
    }
  }, [appKey]);

  // 加载自定义 BGM 云盘文件列表（拉取全部文件后前端筛选音频格式并分页）
  const [allBgmFiles, setAllBgmFiles] = useState<ICloudFile[]>([]);
  const BGM_PAGE_SIZE = 20;
  const loadCustomBgmFiles = useCallback(async (page: number = 1) => {
    setCustomBgmFilesLoading(true);
    try {
      // 一次拉取足够多的文件，前端筛选音频格式
      const res = await fetchCloudFilesDirect(appKey, { page: 1, pageSize: 200 });
      const items = res?.data?.items || [];
      const audioFiles = items.filter((f: ICloudFile) => ['mp3', 'm4a', 'mav', 'wav', 'aac', 'flac', 'ogg'].includes(f.suffix));
      setAllBgmFiles(audioFiles);
      const totalPages = Math.max(1, Math.ceil(audioFiles.length / BGM_PAGE_SIZE));
      const safePage = Math.min(page, totalPages);
      setCustomBgmFiles(audioFiles.slice((safePage - 1) * BGM_PAGE_SIZE, safePage * BGM_PAGE_SIZE));
      setCustomBgmFilesTotalPages(totalPages);
      setCustomBgmFilesPage(safePage);
    } catch (error) {
      console.error('加载自定义BGM文件失败:', error);
      message.error('加载BGM文件列表失败，请点击刷新重试');
    } finally {
      setCustomBgmFilesLoading(false);
    }
  }, [appKey]);
  // BGM 前端翻页（不重新请求API）
  const goToBgmPage = useCallback((page: number) => {
    const totalPages = Math.max(1, Math.ceil(allBgmFiles.length / BGM_PAGE_SIZE));
    const safePage = Math.max(1, Math.min(page, totalPages));
    setCustomBgmFiles(allBgmFiles.slice((safePage - 1) * BGM_PAGE_SIZE, safePage * BGM_PAGE_SIZE));
    setCustomBgmFilesPage(safePage);
    setCustomBgmFilesTotalPages(totalPages);
  }, [allBgmFiles]);

  
  
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
      // 恢复登录时也加载用户信息
      fetchUserBalance(savedUser).then(res => {
        if (res?.data) setUserInfo(res.data);
      }).catch(() => {});
      // 从后端加载订单（异步，加载完刷新列表）
      loadOrdersFromBackend(savedUser).then(orders => {
        setOrders(orders);
      });
    }
  }, []);
  
  // 登录
  const handleLogin = () => {
    if (!appKey.trim()) {
      setLoginError('请输入App Key');
      return;
    }
    setCurrentUser(appKey);
    setOrders(getUserOrders(appKey));
    setPage('orders');
    setLoginError('');
    // 加载用户信息
    fetchUserBalance(appKey).then(res => {
      if (res?.data) setUserInfo(res.data);
    }).catch(() => {});
    // 从后端加载订单（异步，加载完刷新列表）
    loadOrdersFromBackend(appKey).then(orders => {
      setOrders(orders);
    });
  };
  
  // 登出：清除所有用户相关状态，防止下一个用户看到上个用户的数据
  const handleLogout = () => {
    // 中断正在进行的工作流轮询
    if (abortRef.current) abortRef.current.aborted = true;
    pollingRef.current = false;
    // 清除存储
    logout();
    // 清除核心状态
    setAppKey('');
    setOrders([]);
    setPage('login');
    setCurrentOrder(null);
    // 清除用户信息
    setUserInfo(null);
    setCloudDriveUsage(null);
    // 清除创建订单流程中的状态
    setCurrentStep(0);
    setSelectedMovie(null);
    setSelectedTemplate(null);
    setSelectedBGM(null);
    setSelectedDubbing(null);
    setMovies([]);
    setTemplates([]);
    setBgmList([]);
    setDubbingList([]);
    setCustomMovieName('');
    setEpisodePairs([]);
    setSelectedEpisodeSrtFile(null);
    setSelectedEpisodeVideoFile(null);
    setSelectedViralSrtFile(null);
    setSelectedViralVideoFile(null);
    setSelectedCustomBgmFile(null);
    setCustomDubbingText('');
    setErrorMessage('');
    setLoginError('');
  };
  
  // 手动刷新订单状态
  const refreshOrders = async () => {
    setRefreshingOrders(true);
    try {
      const orders = await loadOrdersFromBackend(appKey);
      setOrders(orders);
    } catch {
      setOrders(getUserOrders(appKey));
    } finally {
      setRefreshingOrders(false);
    }
  };
  
  // 查看订单详情
  const viewOrderDetail = (orderId: string) => {
    const order = getOrder(orderId);
    if (order) {
      setCurrentOrder(order);
      setPage('detail');
    }
  };
  
  // 【Fix36】校验任务创建API响应：无task_id或有error字段时抛异常，由调用方catch统一处理
  const validateTaskCreation = (response: any, taskLabel: string) => {
    if (!response?.task_id) {
      const errMsg = response?.error || response?.message || response?.error_message || '未返回task_id';
      throw new Error(`${taskLabel}创建失败: ${errMsg}`);
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

          // 【Fix30】pollTaskUntilComplete 成功返回 = 任务确实已完成
          // 无论 abort 状态如何，都必须先保存完成结果，避免竞态丢失
          // 竞态场景：abort 在 queryTaskStatus 网络请求期间被设置，
          // 请求返回 status=2 后函数正常 return，但旧代码在此处 break 导致结果丢失
          const latestTask = getOrder(orderId)?.tasks.find(t => t.taskId === runningTask.taskId) || runningTask;
          const orderNum = result.api_response?.data?.task_order_num || '';

          // 【Fix32】分段式交付：先判断 staged 暂停点，直接设为 wait_confirm，
          // 不经过 done 中间态，不推进订单状态，避免竞态导致自动推进
          if (order.deliveryMode === 'staged' && runningTask.type !== 'video' && (runningTask.type === 'viral_learn' || runningTask.type === 'script' || runningTask.type === 'clip' || runningTask.type === 'original_script' || runningTask.type === 'original_clip')) {
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

          // 非分段/video任务：设为 done 并推进订单状态
          updateOrderTask(orderId, {
            ...latestTask,
            orderNum: orderNum,
            status: 'done',
            result: result,
            completedAt: Date.now()
          });

          // 【Fix31】任务完成后同步更新订单状态，反映当前实际进度
          const nextStatusMap: Record<TaskType, OrderStatus> = {
            viral_learn: 'script',
            script: 'clip',
            clip: 'video',
            original_script: 'original_clip',
            original_clip: 'video',
            video: 'done'
          };
          const nextOrderStatus = nextStatusMap[runningTask.type];
          if (nextOrderStatus) {
            updateOrderStatus(orderId, nextOrderStatus, '');
          }

          // 如果是video任务完成，提取URL标记订单完成
          if (runningTask.type === 'video') {
            const videoUrl = result.api_response?.data?.results?.tasks?.[0]?.video_url || '';
            setOrderVideoUrl(orderId, videoUrl);
            setCurrentOrder(getOrder(orderId));
            break;
          }

          // 完成结果已保存，再检查是否需要中断工作流
          if (signal.aborted) {
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
        const originalScriptTask = order.tasks.find(t => t.type === 'original_script');
        const originalClipTask = order.tasks.find(t => t.type === 'original_clip');
        
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
          
          const episodesData: IEpisodeData[] = order.episodesData?.length > 0
            ? order.episodesData
            : [{
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
            playlet_num: episodesData.map(e => e.num).join(','),
            target_platform: order.targetPlatform,
            task_count: 1,
            target_character_name: order.targetCharacterName || '主角',
            refine_srt_gaps: "0",
            vendor_requirements: order.vendorRequirements || `投放在${order.targetPlatform}，吸引18-35岁的年轻用户观看。`,
            story_info: order.storyInfo || ''
          });
          validateTaskCreation(scriptResponse, '文案任务');

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

          // 【防重复】先写入 pending 占位任务，再调用 API
          const placeholderClipTask: ITask = {
            type: 'clip', taskId: '', orderNum: '',
            status: 'pending', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, placeholderClipTask);
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
          validateTaskCreation(clipResponse, '剪辑任务');
          
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

          // 【防重复】先写入 pending 占位任务，再调用 API
          const placeholderVideoTask: ITask = {
            type: 'video', taskId: '', orderNum: '',
            status: 'pending', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, placeholderVideoTask);
          setCurrentOrder(getOrder(orderId));

          const videoResponse = await synthesizeVideo({
            order_num: clipTask.orderNum,
            app_key: order.appKey
          });
          validateTaskCreation(videoResponse, '视频合成任务');
          
          const newVideoTask: ITask = {
            type: 'video', taskId: videoResponse.task_id, orderNum: '',
            status: 'running', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, newVideoTask);
          setCurrentOrder(getOrder(orderId));
          continue; // 回到循环顶部轮询video
          
        // === 原创文案流程 ===
        } else if (originalScriptTask?.status === 'done' && !originalClipTask) {
          // original_script完成，original_clip未创建 → 创建original_clip
          // 从原创文案任务产物中提取file_id：优先 data.files[0].file_id，其次 task_result
          const osData = originalScriptTask.result?.api_response?.data;
          let origFileId = osData?.files?.[0]?.file_id || '';
          if (!origFileId) {
            const tr = osData?.results?.tasks?.[0]?.task_result || '';
            if (typeof tr === 'string' && tr.startsWith('{')) {
              try { const p = JSON.parse(tr); origFileId = p.file_id || p.clip_data_file || tr; } catch { origFileId = tr; }
            } else { origFileId = tr; }
          }
          console.log('创建原创剪辑任务，文案任务ID:', originalScriptTask.taskId, 'file_id:', origFileId);
          updateOrderStatus(orderId, 'original_clip');
          setCurrentOrder(getOrder(orderId));

          // 【防重复】先写入 pending 占位任务，再调用 API
          const placeholderOcTask: ITask = {
            type: 'original_clip', taskId: '', orderNum: '',
            status: 'pending', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, placeholderOcTask);
          setCurrentOrder(getOrder(orderId));

          const ocEpisodesData = order.episodesData?.length > 0
            ? order.episodesData
            : [{ num: 1, srt_oss_key: order.videoSrtPath, video_oss_key: order.videoPath || '', negative_oss_key: order.videoPath || '' }];

          const ocResponse = await generateOriginalClip({
            app_key: order.appKey,
            bgm: order.bgmId,
            dubbing: order.dubbingId,
            file_id: origFileId,
            task_id: originalScriptTask.taskId,
            font_path: null,
            custom_cover: '',
            dubbing_type: 'default',
            episodes_data: ocEpisodesData,
            subtitle_style: {
              shadow: null, outline: null, fontname: null, fontsize: null,
              margin_l: null, margin_r: null, margin_v: null, alignment: null,
              back_colour: null, border_style: null, outline_colour: null, primary_colour: null
            }
          });
          validateTaskCreation(ocResponse, '原创剪辑任务');

          const newOcTask: ITask = {
            type: 'original_clip', taskId: ocResponse.task_id, orderNum: '',
            status: 'running', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, newOcTask);
          setCurrentOrder(getOrder(orderId));
          continue;

        } else if (originalClipTask?.status === 'done' && !videoTask) {
          // original_clip完成，video未创建 → 创建video
          if (!originalClipTask.orderNum) {
            console.error('original_clip任务缺少orderNum，无法创建video');
            updateOrderStatus(orderId, 'error', '原创剪辑任务缺少订单号(orderNum)，请重新创建订单');
            setCurrentOrder(getOrder(orderId));
            break;
          }
          console.log('创建视频任务（原创流程），订单号:', originalClipTask.orderNum);
          updateOrderStatus(orderId, 'video');
          setCurrentOrder(getOrder(orderId));

          // 【防重复】先写入 pending 占位任务，再调用 API
          const placeholderOcVideoTask: ITask = {
            type: 'video', taskId: '', orderNum: '',
            status: 'pending', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, placeholderOcVideoTask);
          setCurrentOrder(getOrder(orderId));

          const ocVideoResponse = await synthesizeVideo({
            order_num: originalClipTask.orderNum,
            app_key: order.appKey
          });
          validateTaskCreation(ocVideoResponse, '视频合成任务');

          const newOcVideoTask: ITask = {
            type: 'video', taskId: ocVideoResponse.task_id, orderNum: '',
            status: 'running', pollCount: 0, elapsedTime: 0,
            result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
          };
          updateOrderTask(orderId, newOcVideoTask);
          setCurrentOrder(getOrder(orderId));
          continue; // 回到循环顶部轮询video

        } else if (videoTask?.status === 'done') {
          // 所有任务完成
          const videoUrl = videoTask.result?.api_response?.data?.results?.tasks?.[0]?.video_url || '';
          setOrderVideoUrl(orderId, videoUrl);
          setCurrentOrder(getOrder(orderId));
          break;
          
        } else if (order.tasks.some(t => t.status === 'pending')) {
          // 有占位任务（API调用进行中），等待后重试
          console.log('有占位任务，等待API响应:', order.tasks.filter(t => t.status === 'pending').map(t => t.type));
          await new Promise(r => setTimeout(r, 1000));
          continue;

        } else if (order.tasks.length === 0) {
          // 【Fix33】订单刚创建、任务尚未写入（API调用中或localStorage被异步覆盖），静默退出等待后续触发
          console.log('订单无任务，等待任务写入:', order.id, order.status);
          break;
        } else {
          // 未知状态，标记为error并退出，防止无限重试
          console.warn('订单状态异常，无法继续:', order.status, JSON.stringify(order.tasks.map(t => ({ type: t.type, status: t.status, taskId: t.taskId }))));
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
  
  // 回到订单列表页时刷新余额点数
  useEffect(() => {
    if (page === 'orders' && appKey) {
      fetchUserBalance(appKey).then(res => {
        if (res?.data) setUserInfo(res.data);
      }).catch(() => {});
    }
  }, [page, appKey]);

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

  // 预估下一个任务点数后再确认（分段式交付，调用 task_consum_calc_points 接口）
  const handleEstimateForConfirm = async (orderId: string, taskType: string) => {
    const order = getOrder(orderId);
    if (!order) return;

    setPendingConfirmInfo({ orderId, taskType });
    setEstimateLoading(true);
    setEstimateError('');
    setEstimateResult(null);
    setTaskCalcResult(null);
    setEstimateModalVisible(true);

    const completedTask = order.tasks.find(t => t.type === taskType);
    const isOriginal = order.copywritingType === 'original';

    // 根据当前完成的任务类型，构建下一步任务的预估参数
    const requestParams: any = {};

    if (taskType === 'viral_learn') {
      // 爆款模型完成 → 下一步是生成文案（generate_writing）
      const learningModelId = completedTask?.result?.api_response?.data?.results?.order_info?.learning_model_id || order.learningModelId || order.templateId;
      const episodesData = order.episodesData?.length > 0
        ? order.episodesData
        : [{ num: 1, srt_oss_key: order.videoSrtPath, video_oss_key: order.videoPath || order.videoSrtPath, negative_oss_key: order.videoPath || order.videoSrtPath }];
      requestParams.generate_writing_params = {
        learning_model_id: learningModelId,
        learning_srt: order.viralSrtPath || order.videoSrtPath,
        episodes_data: episodesData,
        task_count: 1,
        model_version: order.modelVersion || 'standard',
        narrator_type: order.narratorType || 'movie'
      };
    } else if (taskType === 'script') {
      // 文案完成 → 下一步是生成剪辑脚本（generate_clip_data）
      requestParams.generate_clip_data_params = {
        order_num: completedTask?.orderNum || ''
      };
    } else if (taskType === 'clip') {
      // 剪辑完成 → 下一步是合成视频（video_composing）
      requestParams.video_composing_params = {
        order_num: completedTask?.orderNum || ''
      };
    } else if (taskType === 'original_script') {
      // 原创文案完成 → 下一步是原创剪辑（fast_generate_writing_clip_data）
      requestParams.fast_generate_writing_clip_data_params = {
        task_id: completedTask?.taskId || ''
      };
    } else if (taskType === 'original_clip') {
      // 原创剪辑完成 → 下一步是合成视频（video_composing）
      requestParams.video_composing_params = {
        order_num: completedTask?.orderNum || ''
      };
    }

    try {
      const result = await taskConsumCalcPoints({
        app_key: order.appKey,
        request_params: requestParams
      });
      setTaskCalcResult(result);
    } catch (err: any) {
      setEstimateError(err?.message || '预估点数失败，请重试');
    } finally {
      setEstimateLoading(false);
    }
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
      video: 'video',
      original_script: 'original_script',
      original_clip: 'original_clip'
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
            video_srt_path: order.viralSrtPath || order.videoSrtPath,
            ...(order.viralVideoPath ? { video_path: order.viralVideoPath } : {}),
            narrator_type: order.narratorType,
            model_version: order.modelVersion
          });
          validateTaskCreation(response, '爆款模型任务');
          newTaskId = response.task_id;
          break;
        }
        case 'script': {
          let episodesData: IEpisodeData[];
          if (order.episodesData?.length > 0) {
            episodesData = order.episodesData;
          } else if (order.movieSource === 'custom' || order.templateSource === 'generate') {
            if (!order.videoSrtPath) throw new Error('缺少字幕文件路径，无法重试。请重新创建订单');
            episodesData = [{
              num: 1,
              srt_oss_key: order.videoSrtPath,
              video_oss_key: order.videoPath || order.videoSrtPath,
              negative_oss_key: order.videoPath || order.videoSrtPath
            }];
          } else {
            const movies = await fetchMovies(order.appKey);
            const movie = movies.find(m => m.id === order.movieId);
            if (!movie) throw new Error('无法找到电影数据，请重新创建订单');
            if (!movie.srt_file_id || movie.srt_file_id === 'else') throw new Error('该电影缺少有效的字幕文件，请重新创建订单');
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
            playlet_num: episodesData.map(e => e.num).join(','),
            target_platform: order.targetPlatform,
            task_count: 1,
            target_character_name: '主角',
            refine_srt_gaps: "0",
            vendor_requirements: `投放在${order.targetPlatform}，吸引18-35岁的年轻用户观看。`,
            story_info: ''
          });
          validateTaskCreation(scriptResponse, '文案任务');
          newTaskId = scriptResponse.task_id;
          break;
        }
        case 'original_script': {
          const learningSrt = order.viralSrtPath || order.videoSrtPath;
          if (!learningSrt) throw new Error('缺少SRT文件，无法重试原创文案任务');
          const osEpisodesData = order.episodesData?.length > 0
            ? order.episodesData.map(e => ({ num: e.num, srt_oss_key: e.srt_oss_key }))
            : [{ num: 1, srt_oss_key: order.videoSrtPath }];
          const osLearningModelId = order.templateSource === 'generate' ? null : (order.templateId || null);
          const osResponse = await generateOriginalScript({
            app_key: order.appKey,
            model: order.originalModel || 'flash',
            language: order.originalLanguage || '中文',
            perspective: 'third_person',
            target_mode: order.originalMode || '热门影视',
            learning_srt: learningSrt,
            playlet_name: order.movieName,
            episodes_data: osEpisodesData,
            learning_model_id: osLearningModelId,
            confirmed_movie_json: order.confirmedMovieJson || null,
            target_character_name: order.targetCharacterName || '主角名'
          });
          validateTaskCreation(osResponse, '原创文案任务');
          newTaskId = osResponse.task_id;
          break;
        }
        case 'original_clip': {
          const origScriptTask = order.tasks.find(t => t.type === 'original_script' && t.status === 'done');
          if (!origScriptTask?.taskId) throw new Error('缺少原创文案任务ID，无法重试原创剪辑');
          // 从原创文案任务产物中提取file_id
          const retryOsData = origScriptTask.result?.api_response?.data;
          let origScriptFileId = retryOsData?.files?.[0]?.file_id || '';
          if (!origScriptFileId) {
            const tr = retryOsData?.results?.tasks?.[0]?.task_result || '';
            if (typeof tr === 'string' && tr.startsWith('{')) {
              try { const p = JSON.parse(tr); origScriptFileId = p.file_id || p.clip_data_file || tr; } catch { origScriptFileId = tr; }
            } else { origScriptFileId = tr; }
          }
          const ocEpisodesData = order.episodesData?.length > 0
            ? order.episodesData
            : [{ num: 1, srt_oss_key: order.videoSrtPath, video_oss_key: order.videoPath || '', negative_oss_key: order.videoPath || '' }];
          const ocResponse = await generateOriginalClip({
            app_key: order.appKey,
            bgm: order.bgmId,
            dubbing: order.dubbingId,
            file_id: origScriptFileId,
            task_id: origScriptTask.taskId,
            font_path: null,
            custom_cover: '',
            dubbing_type: 'default',
            episodes_data: ocEpisodesData,
            subtitle_style: {
              shadow: null, outline: null, fontname: null, fontsize: null,
              margin_l: null, margin_r: null, margin_v: null, alignment: null,
              back_colour: null, border_style: null, outline_colour: null, primary_colour: null
            }
          });
          validateTaskCreation(ocResponse, '原创剪辑任务');
          newTaskId = ocResponse.task_id;
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
          validateTaskCreation(clipResponse, '剪辑任务');
          newTaskId = clipResponse.task_id;
          break;
        }
        case 'video': {
          const clipTask = order.tasks.find(t => t.type === 'clip' && t.status === 'done') || order.tasks.find(t => t.type === 'original_clip' && t.status === 'done');
          if (!clipTask?.orderNum) throw new Error('缺少剪辑任务订单号，无法重试视频合成');
          const videoResponse = await synthesizeVideo({
            order_num: clipTask.orderNum,
            app_key: order.appKey
          });
          validateTaskCreation(videoResponse, '视频合成任务');
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

  // 恢复异常订单（通用恢复机制：订单error但任务流程未完成）
  const resumeErrorOrder = useCallback((orderId: string) => {
    const order = getOrder(orderId);
    if (!order || order.status !== 'error') return;

    // 根据任务状态推断应恢复到的订单阶段
    const runningOrPending = order.tasks.find(t => t.status === 'running' || t.status === 'pending');
    let resumeStatus: OrderStatus = 'pending';

    if (runningOrPending) {
      // 有中断的任务，恢复到该任务阶段
      const statusMap: Record<string, OrderStatus> = {
        viral_learn: 'viral_learn', script: 'script', clip: 'clip',
        video: 'video', original_script: 'original_script', original_clip: 'original_clip'
      };
      resumeStatus = statusMap[runningOrPending.type] || 'pending';
    } else {
      // 所有任务都是done，推断下一步应该创建的任务阶段
      const doneTasks = order.tasks.filter(t => t.status === 'done').map(t => t.type);
      const hasVideo = doneTasks.includes('video');
      const hasClip = doneTasks.includes('clip');
      const hasScript = doneTasks.includes('script');
      const hasViralLearn = doneTasks.includes('viral_learn');
      const hasOriginalClip = doneTasks.includes('original_clip');
      const hasOriginalScript = doneTasks.includes('original_script');

      if (hasVideo) {
        resumeStatus = 'done'; // 实际上不应该到这里，但安全兜底
      } else if (hasClip || hasOriginalClip) {
        resumeStatus = 'video';
      } else if (hasScript) {
        resumeStatus = 'clip';
      } else if (hasOriginalScript) {
        resumeStatus = 'original_clip';
      } else if (hasViralLearn) {
        resumeStatus = 'script';
      } else {
        resumeStatus = 'pending';
      }
    }

    // 清理 error 状态的占位任务（让状态机重新创建）
    const errorTasks = order.tasks.filter(t => t.status === 'error' && !t.taskId);
    errorTasks.forEach(t => {
      const idx = order.tasks.indexOf(t);
      if (idx !== -1) order.tasks.splice(idx, 1);
    });

    order.errorMessage = '';
    order.status = resumeStatus;
    order.updatedAt = Date.now();
    saveOrder(order);
    setCurrentOrder(getOrder(orderId));

    if (resumeStatus !== 'done') {
      resumeOrderWorkflow(orderId);
    }
  }, [resumeOrderWorkflow]);

  // 重试订单（订单创建时首个任务API调用失败，tasks为空的情况）
  const [retryingOrder, setRetryingOrder] = useState(false);
  const retryOrderCreation = useCallback(async (orderId: string) => {
    const order = getOrder(orderId);
    if (!order || order.tasks.length > 0) return;

    setRetryingOrder(true);
    try {
      if (order.copywritingType === 'original') {
        // 原创文案流程：创建 original_script 任务
        updateOrderStatus(orderId, 'original_script', '');
        setCurrentOrder(getOrder(orderId));

        const learningSrt = order.viralSrtPath || order.videoSrtPath;
        const osEpisodesData = order.episodesData?.length > 0
          ? order.episodesData.map(e => ({ num: e.num, srt_oss_key: e.srt_oss_key }))
          : [{ num: 1, srt_oss_key: order.videoSrtPath }];
        const osLearningModelId = order.templateSource === 'generate' ? null : (order.templateId || null);

        const osResponse = await generateOriginalScript({
          app_key: order.appKey,
          model: order.originalModel || 'flash',
          language: order.originalLanguage || '中文',
          perspective: 'third_person',
          target_mode: order.originalMode || '热门影视',
          learning_srt: learningSrt,
          playlet_name: order.movieName,
          episodes_data: osEpisodesData,
          learning_model_id: osLearningModelId,
          confirmed_movie_json: order.confirmedMovieJson || null,
          target_character_name: order.targetCharacterName || '主角名'
        });
        validateTaskCreation(osResponse, '原创文案任务');

        const osTask: ITask = {
          type: 'original_script', taskId: osResponse.task_id, orderNum: '',
          status: 'running', pollCount: 0, elapsedTime: 0,
          result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
        };
        updateOrderTask(orderId, osTask);
      } else if (order.templateSource === 'generate') {
        // 自定义模板：创建爆款模型任务
        updateOrderStatus(orderId, 'viral_learn', '');
        setCurrentOrder(getOrder(orderId));

        const viralResponse = await generateViralModel({
          app_key: order.appKey,
          video_srt_path: order.viralSrtPath || order.videoSrtPath,
          ...(order.viralVideoPath ? { video_path: order.viralVideoPath } : {}),
          narrator_type: order.narratorType,
          model_version: order.modelVersion
        });
        validateTaskCreation(viralResponse, '爆款模型任务');

        const viralTask: ITask = {
          type: 'viral_learn', taskId: viralResponse.task_id, orderNum: '',
          status: 'running', pollCount: 0, elapsedTime: 0,
          result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
        };
        updateOrderTask(orderId, viralTask);
      } else {
        // 使用现成模板：创建文案任务
        updateOrderStatus(orderId, 'script', '');
        setCurrentOrder(getOrder(orderId));

        const episodesData = order.episodesData?.length > 0
          ? order.episodesData
          : [{
              num: 1,
              srt_oss_key: order.videoSrtPath,
              video_oss_key: order.videoPath || order.videoSrtPath,
              negative_oss_key: order.videoPath || order.videoSrtPath
            }];

        const scriptResponse = await generateScript({
          app_key: order.appKey,
          learning_model_id: order.templateId,
          episodes_data: episodesData,
          playlet_name: order.movieName,
          playlet_num: episodesData.map(e => e.num).join(','),
          target_platform: order.targetPlatform,
          task_count: 1,
          target_character_name: order.targetCharacterName || '主角',
          refine_srt_gaps: "0",
          vendor_requirements: order.vendorRequirements || `投放在${order.targetPlatform}，吸引18-35岁的年轻用户观看。`,
          story_info: order.storyInfo || ''
        });
        validateTaskCreation(scriptResponse, '文案任务');

        const scriptTask: ITask = {
          type: 'script', taskId: scriptResponse.task_id, orderNum: '',
          status: 'running', pollCount: 0, elapsedTime: 0,
          result: null, errorMessage: '', createdAt: Date.now(), completedAt: null
        };
        updateOrderTask(orderId, scriptTask);
      }

      setCurrentOrder(getOrder(orderId));
      resumeOrderWorkflow(orderId);
    } catch (error: any) {
      console.error('重试订单失败:', error);
      let errMsg = '重试失败';
      if (error.response) {
        errMsg = `${error.message}\n状态码: ${error.response.status}\n响应: ${JSON.stringify(error.response.data || {}).slice(0, 200)}`;
      } else if (error.message) {
        errMsg = error.message;
      }
      updateOrderStatus(orderId, 'error', errMsg);
      setCurrentOrder(getOrder(orderId));
    } finally {
      setRetryingOrder(false);
    }
  }, [resumeOrderWorkflow]);
  
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
    setEpisodePairs([]);
    setSelectedViralSrtFile(null);
    setSelectedViralVideoFile(null);
    setSelectedCustomBgmFile(null);
    setCustomDubbingText('');
    setNarratorType('movie');
    setModelVersion('standard');
    setCopywritingType('secondary');
    setOriginalMode('热门影视');
    setOriginalLanguage('中文');
    setOriginalModel('flash');
    setMovieSearchQuery('');
    setMovieSearchResults([]);
    setConfirmedMovieJson(null);
    setMovieSearchModalVisible(false);
    setMovieListExpanded(true);
    setTemplateListExpanded(true);
    setBgmListExpanded(true);
    setDubbingListExpanded(true);
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
  const isShortDrama = narratorType === 'short_drama';
  
  // 短剧模式自动选中"自定义"电影
  useEffect(() => {
    if (isShortDrama && !selectedMovie && movies.length > 0) {
      const customMovie = movies.find(m => m.name === '自定义');
      if (customMovie) setSelectedMovie(customMovie);
    }
  }, [isShortDrama, selectedMovie, movies]);

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
    if (currentStep === 2 && selectedBGM?.name === '自定义' && customBgmFiles.length === 0) {
      loadCustomBgmFiles();
    }
  }, [currentStep, isCustomMovie, templates.length, episodeSrtFiles.length, bgmList.length, loadTemplates, loadEpisodeSrtFiles, loadConfig, selectedBGM, customBgmFiles.length, loadCustomBgmFiles]);
  
  // 预估点数：点击"开始生成视频"时先调用
  const handleEstimatePoints = async () => {
    setPendingConfirmInfo(null);
    setTaskCalcResult(null);
    const _isOriginal = copywritingType === 'original';
    if (!selectedMovie || !selectedBGM || !selectedDubbing || !selectedTemplate) {
      setErrorMessage('请完成所有配置');
      return;
    }
    const _isCustomMovie = selectedMovie.name === '自定义';
    const _isCustomTemplate = selectedTemplate?.name === '自定义';
    if (_isCustomMovie && !customMovieName.trim()) {
      setErrorMessage('请输入电影名称');
      return;
    }
    if (_isCustomMovie && isShortDrama && episodePairs.length === 0) {
      setErrorMessage('请至少添加一对SRT+视频文件');
      return;
    }
    if (_isCustomMovie && !isShortDrama && !selectedEpisodeSrtFile) {
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
    if (selectedDubbing.name === '自定义' && !customDubbingText.trim()) {
      setErrorMessage('请输入自定义配音名称');
      return;
    }

    setErrorMessage('');
    setEstimateLoading(true);
    setEstimateError('');
    setEstimateResult(null);
    setEstimateModalVisible(true);

    const srtOssKey = _isCustomMovie && !isShortDrama ? (selectedEpisodeSrtFile!.file_id) : selectedMovie.srt_file_id;
    const videoOssKey = _isCustomMovie && !isShortDrama ? (selectedEpisodeVideoFile?.file_id || selectedEpisodeSrtFile!.file_id) : selectedMovie.video_file_id;

    const estimateEpisodesData = _isCustomMovie && isShortDrama
      ? episodePairs.map((pair, i) => ({
          num: i + 1,
          srt_oss_key: pair.srt.file_id,
          video_oss_key: pair.video.file_id,
          negative_oss_key: pair.video.file_id
        }))
      : [{
          num: 1,
          srt_oss_key: srtOssKey,
          video_oss_key: videoOssKey,
          negative_oss_key: videoOssKey
        }];

    const requestParams: any = {
      episodes_data: estimateEpisodesData,
      model_version: _isCustomTemplate ? modelVersion : 'standard',
      narrator_type: narratorType,
      ...(_isOriginal ? { text_model: originalModel } : {}),
      ...(_isCustomTemplate
        ? { learning_srt: selectedViralSrtFile!.file_id }
        : { learning_model_id: selectedTemplate!.learning_model_id })
    };

    try {
      const result = await estimatePoints({
        app_key: appKey,
        request_params: requestParams
      });
      setEstimateResult(result);
    } catch (err: any) {
      setEstimateError(err?.message || '预估点数失败，请重试');
    } finally {
      setEstimateLoading(false);
    }
  };

  // 执行完整任务流程：创建订单+第一个任务，然后跳转到详情页由resumeOrderWorkflow接管
  const executeWorkflow = async () => {
    setEstimateModalVisible(false);
    if (!selectedMovie || !selectedBGM || !selectedDubbing || !selectedTemplate) {
      setErrorMessage('请完成所有配置');
      return;
    }
    const _isCustomMovie = selectedMovie.name === '自定义';
    const _isCustomTemplate = selectedTemplate.name === '自定义';
    if (_isCustomMovie && !customMovieName.trim()) {
      setErrorMessage('请输入电影名称');
      return;
    }
    if (_isCustomMovie && isShortDrama && episodePairs.length === 0) {
      setErrorMessage('请至少添加一对SRT+视频文件');
      return;
    }
    if (_isCustomMovie && !isShortDrama && !selectedEpisodeSrtFile) {
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
    if (selectedDubbing.name === '自定义' && !customDubbingText.trim()) {
      setErrorMessage('请输入自定义配音名称');
      return;
    }
    
    setTaskPhase('script');
    setTaskMessage('正在创建订单...');
    setErrorMessage('');
    
    // 构建 episode_data 所需的文件ID
    const srtOssKey = _isCustomMovie && !isShortDrama ? (selectedEpisodeSrtFile!.file_id) : selectedMovie.srt_file_id;
    const videoOssKey = _isCustomMovie && !isShortDrama ? (selectedEpisodeVideoFile?.file_id || selectedEpisodeSrtFile!.file_id) : selectedMovie.video_file_id;

    // 构建 episodesData（短剧多集对 vs 单集）
    const orderEpisodesData = _isCustomMovie && isShortDrama
      ? episodePairs.map((pair, i) => ({
          num: i + 1,
          srt_oss_key: pair.srt.file_id,
          video_oss_key: pair.video.file_id,
          negative_oss_key: pair.video.file_id
        }))
      : [{
          num: 1,
          srt_oss_key: srtOssKey,
          video_oss_key: videoOssKey,
          negative_oss_key: videoOssKey
        }];

    let order: IOrder | null = null;
    try {
      // 创建订单记录
      const isOriginal = copywritingType === 'original';
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
        dubbingId: selectedDubbing.name === '自定义' ? customDubbingText.trim() : selectedDubbing.dubbing_id,
        dubbingName: selectedDubbing.name === '自定义' ? customDubbingText.trim() : selectedDubbing.name,
        targetPlatform: targetPlatform,
        targetCharacterName: targetCharacterName || parseFirstCharacterName(selectedMovie.character_name) || '主角',
        vendorRequirements: vendorRequirements || `投放在${targetPlatform}，吸引18-35岁的年轻用户观看。`,
        storyInfo: selectedMovie.story_info || '',
        deliveryMode: deliveryMode,
        videoPath: isShortDrama ? (episodePairs[0]?.video.file_id || '') : videoOssKey,
        videoSrtPath: isShortDrama ? (episodePairs[0]?.srt.file_id || '') : srtOssKey,
        viralSrtPath: _isCustomTemplate ? selectedViralSrtFile!.file_id : (isOriginal ? srtOssKey : ''),
        viralVideoPath: _isCustomTemplate && selectedViralVideoFile ? selectedViralVideoFile.file_id : '',
        narratorType: narratorType,
        modelVersion: modelVersion,
        episodesData: orderEpisodesData,
        copywritingType: copywritingType,
        originalMode: isOriginal ? originalMode : '',
        originalLanguage: isOriginal ? originalLanguage : '',
        originalModel: isOriginal ? originalModel : 'flash',
        confirmedMovieJson: isOriginal
          ? (confirmedMovieJson || (!_isCustomMovie && selectedMovie ? buildConfirmedMovieJsonFromMovie(selectedMovie) : null))
          : null
      });
      
      if (isOriginal) {
        // 原创文案流程：直接创建 original_script 任务（无爆款学习步骤）
        updateOrderStatus(order.id, 'original_script');
        setTaskMessage('正在创建原创文案任务...');

        const learningSrt = _isCustomTemplate ? selectedViralSrtFile!.file_id : srtOssKey;
        const osEpisodesData = orderEpisodesData.map(e => ({ num: e.num, srt_oss_key: e.srt_oss_key }));
        const osLearningModelId = _isCustomTemplate ? null : selectedTemplate.learning_model_id;

        const osResponse = await generateOriginalScript({
          app_key: appKey,
          model: originalModel,
          language: originalLanguage,
          perspective: 'third_person',
          target_mode: originalMode,
          learning_srt: learningSrt,
          playlet_name: _isCustomMovie ? (customMovieName.trim() || '自定义') : selectedMovie.name,
          episodes_data: osEpisodesData,
          learning_model_id: osLearningModelId,
          confirmed_movie_json: confirmedMovieJson || (!_isCustomMovie && selectedMovie ? buildConfirmedMovieJsonFromMovie(selectedMovie) : null),
          target_character_name: targetCharacterName || parseFirstCharacterName(selectedMovie.character_name) || '主角名'
        });
        validateTaskCreation(osResponse, '原创文案任务');

        const osTask: ITask = {
          type: 'original_script',
          taskId: osResponse.task_id,
          orderNum: '',
          status: 'running',
          pollCount: 0,
          elapsedTime: 0,
          result: null,
          errorMessage: '',
          createdAt: Date.now(),
          completedAt: null
        };
        updateOrderTask(order.id, osTask);
      } else if (_isCustomTemplate) {
        // 二创文案 + 自定义模板：先创建爆款模型任务
        updateOrderStatus(order.id, 'viral_learn');
        setTaskMessage('正在创建爆款模型任务...');
        
        const viralResponse = await generateViralModel({
          app_key: appKey,
          video_srt_path: selectedViralSrtFile!.file_id,
          ...(selectedViralVideoFile ? { video_path: selectedViralVideoFile.file_id } : {}),
          narrator_type: narratorType,
          model_version: modelVersion
        });
        validateTaskCreation(viralResponse, '爆款模型任务');
        
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
        
        const scriptResponse = await generateScript({
          app_key: appKey,
          learning_model_id: selectedTemplate.learning_model_id,
          episodes_data: orderEpisodesData,
          playlet_name: _isCustomMovie ? (customMovieName.trim() || selectedEpisodeVideoFile?.file_name?.replace(/\.[^.]+$/, '') || selectedEpisodeSrtFile?.file_name?.replace(/\.[^.]+$/, '') || '自定义解说') : selectedMovie.name,
          playlet_num: orderEpisodesData.map(e => e.num).join(','),
          target_platform: targetPlatform,
          task_count: 1,
          target_character_name: targetCharacterName || parseFirstCharacterName(selectedMovie.character_name) || '主角',
          refine_srt_gaps: "0",
          vendor_requirements: vendorRequirements || `投放在${targetPlatform}，吸引18-35岁的年轻用户观看。`,
          story_info: selectedMovie.story_info || ''
        });
        validateTaskCreation(scriptResponse, '文案任务');
        
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
      setOrders(getUserOrders(appKey)); // 仅从localStorage刷新，避免后端异步覆盖
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
    setEpisodePairs([]);
    setSelectedViralSrtFile(null);
    setSelectedViralVideoFile(null);
    setSelectedCustomBgmFile(null);
    setCustomDubbingText('');
    setNarratorType('movie');
    setModelVersion('standard');
    setCopywritingType('secondary');
    setOriginalMode('热门影视');
    setOriginalLanguage('中文');
    setOriginalModel('flash');
    setMovieSearchQuery('');
    setMovieSearchResults([]);
    setConfirmedMovieJson(null);
    setMovieSearchModalVisible(false);
    setMovieListExpanded(true);
    setTemplateListExpanded(true);
    setBgmListExpanded(true);
    setDubbingListExpanded(true);
    setTaskPhase('idle');
    setTaskMessage('');
    setErrorMessage('');
  };
  
  // 我的云盘：加载文件列表
  const loadCloudDriveFiles = useCallback(async (page: number = 1, search: string = '') => {
    setCloudDriveFilesLoading(true);
    try {
      const res = await fetchCloudFilesDirect(appKey, { page, pageSize: 20, search, orderBy: 'created_at', order: 'desc' });
      setCloudDriveFiles(res.data.items);
      setCloudDriveFilesPage(res.data.page);
      setCloudDriveFilesTotalPages(res.data.total_pages);
      setCloudDriveFilesTotal(res.data.total);
    } catch (error) {
      console.error('加载云盘文件失败:', error);
    } finally {
      setCloudDriveFilesLoading(false);
    }
  }, [appKey]);

  // 我的云盘：打开弹窗
  const openCloudDriveModal = () => {
    setUploadStep('cloud_drive');
    setCloudDriveSearch('');
    setUploadModalVisible(true);
    loadCloudDriveFiles(1, '');
    // 加载云盘用量
    fetchCloudDriveUsage(appKey).then(res => setCloudDriveUsage(res)).catch(() => {});
  };

  // 我的云盘：删除文件
  const handleCloudDriveDelete = async (fileId: string) => {
    setDeletingFileId(fileId);
    try {
      const res = await deleteFile({ file_id: fileId, app_key: appKey });
      if (res.success) {
        message.success('删除成功');
        loadCloudDriveFiles(cloudDriveFilesPage, cloudDriveSearch);
      } else {
        message.error(res.error_message || '删除失败');
      }
    } catch (error: any) {
      message.error('删除失败: ' + error.message);
    } finally {
      setDeletingFileId(null);
    }
  };

  // 我的云盘：下载文件
  const handleCloudDriveDownload = async (fileId: string, fileName: string) => {
    setDownloadingFileId(fileId);
    try {
      const url = await fetchFileDownloadUrl(appKey, fileId);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      message.success('开始下载');
    } catch (error: any) {
      message.error('下载失败: ' + error.message);
    } finally {
      setDownloadingFileId(null);
    }
  };

  // 上传文件：打开弹窗
  const openUploadModal = () => {
    setUploadLink('');
    setUploadTag('');
    setUploadTypeTag('电影');
    setUploadStep('input');
    setUploadMode('link');
    setLocalFile(null);
    setLocalUploadProgress(0);
    setLocalUploading(false);
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
      if (res.code !== 10000) {
        message.error(res.message || '链接解析失败，请检查链接是否正确');
        return;
      }
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

  // 本地文件上传：获取预签名URL并直传OSS
  const handleLocalFileUpload = async () => {
    if (!localFile) { message.error('请选择文件'); return; }
    setLocalUploading(true);
    setLocalUploadProgress(0);
    let reportContext: { file_id: string; object_key: string } | null = null;
    try {
      // 1. 获取预签名上传URL
      const presignedRes = await getPresignedUploadUrl({
        app_key: appKey,
        file_name: localFile.name,
        file_size: localFile.size,
        content_type: localFile.type || 'application/octet-stream'
      });
      const uploadUrl = presignedRes.upload_url;
      if (!uploadUrl) {
        message.error('获取上传地址失败');
        setLocalUploading(false);
        return;
      }
      reportContext = { file_id: presignedRes.file_id, object_key: presignedRes.object_key };
      // 2. 通过XHR直传文件到OSS
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        localUploadXhrRef.current = xhr;
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', localFile!.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setLocalUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`上传失败，HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('网络错误，上传失败'));
        xhr.onabort = () => reject(new Error('上传已取消'));
        xhr.send(localFile);
      });
      // 3. 汇报上传成功
      reportUploadResult({ app_key: appKey, ...reportContext, upload_status: 'success', file_size: localFile.size, error_message: '' }).catch(() => {});
      message.success('文件上传成功');
      setLocalFile(null);
      setLocalUploadProgress(0);
      // 上传完成后跳转到云盘页面并刷新
      setUploadStep('cloud_drive');
      loadCloudDriveFiles(1, '');
      fetchCloudDriveUsage(appKey).then(res => setCloudDriveUsage(res)).catch(() => {});
    } catch (error: any) {
      if (error.message !== '上传已取消') {
        message.error(error.message || '上传失败');
        // 汇报上传失败（仅在已获取到 file_id 时）
        if (reportContext) {
          reportUploadResult({ app_key: appKey, ...reportContext, upload_status: 'failed', file_size: localFile!.size, error_message: error.message || '上传失败' }).catch(() => {});
        }
      }
    } finally {
      setLocalUploading(false);
      localUploadXhrRef.current = null;
    }
  };

  // 取消本地文件上传
  const cancelLocalUpload = () => {
    if (localUploadXhrRef.current) {
      localUploadXhrRef.current.abort();
      localUploadXhrRef.current = null;
    }
    setLocalUploading(false);
    setLocalUploadProgress(0);
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

  // 更新预转存文件关联关系（双向同步）
  const handleUpdateRelation = async (
    sourceFile: IPreUploadFile,
    targetFile: IPreUploadFile | null,
    sourceType: 'video' | 'subtitle'
  ) => {
    if (!preUploadResult) return;
    setUpdatingRelationFileId(sourceFile.pre_file_id);
    try {
      // 1) 更新源文件的关联
      await updatePreFile({
        app_key: appKey,
        pre_file_id: sourceFile.pre_file_id,
        index: sourceFile.index,
        related_record_id: targetFile ? String(targetFile.id) : undefined,
      });
      // 2) 双向同步：更新目标文件的关联指向源文件
      if (targetFile) {
        await updatePreFile({
          app_key: appKey,
          pre_file_id: targetFile.pre_file_id,
          index: targetFile.index,
          related_record_id: String(sourceFile.id),
        });
      }
      // 3) 更新本地状态
      const srcId = sourceFile.pre_file_id;
      const tgtId = targetFile?.pre_file_id;
      const updateFiles = (files: IPreUploadFile[]) =>
        files.map(f => {
          if (f.pre_file_id === srcId) {
            return { ...f, related_record_id: targetFile ? String(targetFile.id) : null, related_record_name: targetFile?.file_name || null };
          }
          if (tgtId && f.pre_file_id === tgtId) {
            return { ...f, related_record_id: String(sourceFile.id), related_record_name: sourceFile.file_name };
          }
          return f;
        });
      setPreUploadResult({
        ...preUploadResult,
        data: {
          ...preUploadResult.data,
          video: updateFiles(preUploadResult.data.video),
          subtitle: updateFiles(preUploadResult.data.subtitle),
          image: preUploadResult.data.image,
          other: preUploadResult.data.other,
        }
      });
      message.success('关联已更新');
    } catch (error: any) {
      message.error('更新关联失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setUpdatingRelationFileId(null);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + 'GB';
  };

  // 渲染预估点数弹窗
  const renderEstimateModal = () => {
    if (!estimateModalVisible) return null;
    return (
      <div className="estimate-overlay">
        <div className="estimate-modal" onClick={(e) => e.stopPropagation()}>
          {!estimateLoading && (
            <button className="estimate-close-btn" onClick={() => setEstimateModalVisible(false)}>✕</button>
          )}
          <div className="estimate-header">
            <div className="estimate-header-icon">💰</div>
            <div className="estimate-header-title">预估消耗点数</div>
            <div className="estimate-header-subtitle">{pendingConfirmInfo ? '以下为当前任务预估消耗，实际消耗以执行结果为准' : '以下为本次订单所有阶段预估消耗，实际消耗以执行结果为准'}</div>
          </div>

          {estimateLoading && (
            <div className="estimate-loading">
              <Spin size="large" />
              <div className="estimate-loading-text">正在计算预估点数...</div>
            </div>
          )}

          {estimateError && (
            <div style={{ padding: '16px 0' }}>
              <Alert type="error" message="预估失败" description={estimateError} style={{ marginBottom: 16, borderRadius: 10 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <Button block onClick={() => setEstimateModalVisible(false)}>关闭</Button>
                <Button block type="primary" className="btn-primary-gradient" onClick={handleEstimatePoints}>重试</Button>
              </div>
            </div>
          )}

          {(estimateResult || taskCalcResult) && !estimateLoading && !estimateError && (
            <>
              {(() => {
                if (pendingConfirmInfo && taskCalcResult) {
                  // 确认任务场景：只展示下一步任务的预估点数
                  let taskLabel = ''; let taskIcon = ''; let taskPoints = 0;
                  const t = pendingConfirmInfo.taskType;
                  if (t === 'viral_learn') {
                    taskLabel = '解说文案'; taskIcon = '📝'; taskPoints = taskCalcResult.generate_writing_points ?? 0;
                  } else if (t === 'script') {
                    taskLabel = '生成剪辑脚本'; taskIcon = '✂️'; taskPoints = taskCalcResult.generate_clip_data_points ?? 0;
                  } else if (t === 'clip') {
                    taskLabel = '合成视频'; taskIcon = '🎬'; taskPoints = taskCalcResult.video_composing_points ?? 0;
                  } else if (t === 'original_script') {
                    taskLabel = '原创剪辑'; taskIcon = '✂️'; taskPoints = taskCalcResult.fast_generate_writing_clip_data_points ?? 0;
                  } else if (t === 'original_clip') {
                    taskLabel = '合成视频'; taskIcon = '🎬'; taskPoints = taskCalcResult.video_composing_points ?? 0;
                  }
                  return (
                    <>
                      <div className="estimate-detail-list">
                        <div className="estimate-detail-row">
                          <span className="estimate-detail-label"><span className="estimate-icon">{taskIcon}</span>{taskLabel}</span>
                          <span className="estimate-detail-value">{taskPoints}<small> 点</small></span>
                        </div>
                      </div>
                      <div className="estimate-total-row">
                        <span className="estimate-total-label">本次消耗</span>
                        <span className="estimate-total-value">{taskPoints}<small> 点</small></span>
                      </div>
                    </>
                  );
                }

                if (!estimateResult) return null;

                // 创建订单场景：展示所有阶段点数明细
                const allStages: { icon: string; label: string; points: number }[] = [];
                const isCustomTpl = selectedTemplate?.name === '自定义';

                if (copywritingType === 'original') {
                  if ((estimateResult.text_model_points ?? 0) > 0)
                    allStages.push({ icon: '📄', label: '原创文案', points: estimateResult.text_model_points! });
                } else {
                  if (isCustomTpl && (estimateResult.viral_learning_points ?? 0) > 0)
                    allStages.push({ icon: '🧠', label: '爆款模型学习', points: estimateResult.viral_learning_points! });
                  if ((estimateResult.commentary_generation_points ?? 0) > 0)
                    allStages.push({ icon: '📝', label: '解说文案', points: estimateResult.commentary_generation_points! });
                }
                if ((estimateResult.video_synthesis_points ?? 0) > 0)
                  allStages.push({ icon: '✂️', label: '合成视频', points: estimateResult.video_synthesis_points! });

                return (
                  <>
                    <div className="estimate-detail-list">
                      {allStages.map((stage, i) => (
                        <div className="estimate-detail-row" key={i}>
                          <span className="estimate-detail-label"><span className="estimate-icon">{stage.icon}</span>{stage.label}</span>
                          <span className="estimate-detail-value">{stage.points}<small> 点</small></span>
                        </div>
                      ))}
                    </div>
                    <div className="estimate-total-row">
                      <span className="estimate-total-label">预估总消耗</span>
                      <span className="estimate-total-value">{copywritingType === 'original' ? ((estimateResult.text_model_points ?? 0) + (estimateResult.video_synthesis_points ?? 0)) : estimateResult.total_consume_points}<small> 点</small></span>
                    </div>
                  </>
                );
              })()}

              {userInfo && (
                <div className="estimate-balance-hint">
                  当前余额: <strong>{userInfo.balance}</strong> 点
                </div>
              )}

              <div className="estimate-actions">
                <button className="estimate-btn estimate-btn-cancel" onClick={() => { setEstimateModalVisible(false); setPendingConfirmInfo(null); }}>取消</button>
                <button className="estimate-btn estimate-btn-confirm" onClick={() => {
                  if (pendingConfirmInfo) {
                    setEstimateModalVisible(false);
                    confirmTask(pendingConfirmInfo.orderId, pendingConfirmInfo.taskType);
                    setPendingConfirmInfo(null);
                  } else {
                    executeWorkflow();
                  }
                }}>确认并开始</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // 渲染上传弹窗
  const renderUploadModal = () => {
    if (!uploadModalVisible) return null;
    return (
      <div className="upload-modal-overlay">
        <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
          <div className="upload-modal-header">
            <h3>{uploadStep === 'cloud_drive' ? '📁 我的云盘' : uploadStep === 'transfers' ? '📋 文件传输列表' : '📤 上传文件到云盘'}</h3>
            <Button type="text" onClick={closeUploadModal}>✕</Button>
          </div>

          {uploadStep === 'cloud_drive' && (
            <div className="upload-modal-body">
              {/* 操作栏 */}
              <div className="cloud-drive-toolbar">
                <Input.Search
                  placeholder="搜索文件名..."
                  value={cloudDriveSearch}
                  onChange={(e) => setCloudDriveSearch(e.target.value)}
                  onSearch={(v) => loadCloudDriveFiles(1, v)}
                  allowClear
                  style={{ flex: 1 }}
                />
                <Button type="primary" className="btn-primary-gradient" onClick={() => { setUploadLink(''); setUploadTag(''); setUploadTypeTag('电影'); setUploadStep('input'); setUploadMode('link'); setLocalFile(null); setLocalUploadProgress(0); setLocalUploading(false); setPreUploadResult(null); setPreUploadUploadId(''); }}>
                  📤 上传文件
                </Button>
              </div>
              {/* 云盘用量 */}
              {cloudDriveUsage && (
                <div className="cloud-drive-usage-card">
                  <div className="cloud-drive-usage-header">
                    <span>☁️ 云盘空间</span>
                    <span className="cloud-drive-usage-text">
                      {cloudDriveUsage.used_size >= 1024 * 1024 * 1024
                        ? (cloudDriveUsage.used_size / 1024 / 1024 / 1024).toFixed(2) + ' GB'
                        : (cloudDriveUsage.used_size / 1024 / 1024).toFixed(1) + ' MB'
                      } / {(cloudDriveUsage.max_size / 1024 / 1024 / 1024).toFixed(1)} GB
                    </span>
                  </div>
                  <div className="cloud-drive-progress-bar">
                    <div
                      className="cloud-drive-progress-fill"
                      style={{ width: `${Math.min(cloudDriveUsage.usage_percentage, 100)}%` }}
                    />
                  </div>
                  <div className="cloud-drive-usage-footer">
                    <span>{cloudDriveUsage.file_count} 个文件</span>
                    <span>已用 {cloudDriveUsage.usage_percentage}%</span>
                  </div>
                </div>
              )}
              {/* 信息栏 */}
              <div className="cloud-drive-info-bar">
                <span>共 <strong>{cloudDriveFilesTotal}</strong> 个文件</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button size="small" type="link" onClick={() => { setUploadStep('transfers'); loadTransferList(1); }}>
                    📋 传输列表
                  </Button>
                  <Button size="small" type="link" onClick={() => { loadCloudDriveFiles(cloudDriveFilesPage, cloudDriveSearch); fetchCloudDriveUsage(appKey).then(res => setCloudDriveUsage(res)).catch(() => {}); }} loading={cloudDriveFilesLoading}>
                    🔄 刷新
                  </Button>
                </div>
              </div>
              {/* 文件列表 */}
              {cloudDriveFilesLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="加载中..." /></div>
              ) : cloudDriveFiles.length === 0 ? (
                <Empty description="暂无文件" style={{ padding: '30px 0' }} />
              ) : (
                <div className="cloud-drive-file-list">
                  {cloudDriveFiles.map((file: ICloudFile) => {
                    const sizeMB = file.file_size / 1024 / 1024;
                    const sizeStr = sizeMB >= 1024 ? (sizeMB / 1024).toFixed(2) + ' GB' : sizeMB >= 1 ? sizeMB.toFixed(1) + ' MB' : (file.file_size / 1024).toFixed(0) + ' KB';
                    const suffixColorMap: Record<string, string> = { mp4: 'purple', srt: 'cyan', mp3: 'green', m4a: 'green', mav: 'green', jpg: 'orange', jpeg: 'orange', png: 'orange', gif: 'orange' };
                    return (
                      <div key={file.file_id} className="cloud-drive-file-item">
                        <div className="cloud-drive-file-icon">
                          {['mp4', 'avi', 'mkv', 'mov'].includes(file.suffix) ? '🎬' : ['mp3', 'm4a', 'mav', 'wav'].includes(file.suffix) ? '🎵' : ['srt', 'ass', 'txt'].includes(file.suffix) ? '📝' : ['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(file.suffix) ? '🖼️' : '📄'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cloud-drive-file-name" title={file.file_name}>{file.file_name}</div>
                          <div className="cloud-drive-file-meta">
                            <span>{sizeStr}</span>
                            <Tag color={suffixColorMap[file.suffix] || 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{file.suffix}</Tag>
                            <span>{file.created_at}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button
                            size="small"
                            type="text"
                            loading={downloadingFileId === file.file_id}
                            onClick={() => handleCloudDriveDownload(file.file_id, file.file_name)}
                            style={{ fontSize: 12, color: '#1677ff' }}
                          >
                            下载
                          </Button>
                          <Button
                            size="small"
                            danger
                            type="text"
                            loading={deletingFileId === file.file_id}
                            onClick={() => handleCloudDriveDelete(file.file_id)}
                            style={{ fontSize: 12 }}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* 分页 */}
              {cloudDriveFilesTotalPages > 1 && (
                <div className="cloud-drive-pagination">
                  <Button size="small" disabled={cloudDriveFilesPage <= 1} onClick={() => loadCloudDriveFiles(cloudDriveFilesPage - 1, cloudDriveSearch)}>上一页</Button>
                  <span style={{ fontSize: 12, color: '#666' }}>{cloudDriveFilesPage} / {cloudDriveFilesTotalPages}</span>
                  <Button size="small" disabled={cloudDriveFilesPage >= cloudDriveFilesTotalPages} onClick={() => loadCloudDriveFiles(cloudDriveFilesPage + 1, cloudDriveSearch)}>下一页</Button>
                </div>
              )}
            </div>
          )}

          {uploadStep === 'input' && (
            <div className="upload-modal-body">
              {/* Tab 切换 */}
              <div className="upload-mode-tabs">
                <div className={`upload-mode-tab ${uploadMode === 'link' ? 'active' : ''}`} onClick={() => { if (!localUploading) setUploadMode('link'); }}>
                  🔗 链接转存
                </div>
                <div className={`upload-mode-tab ${uploadMode === 'local' ? 'active' : ''}`} onClick={() => { if (!localUploading) setUploadMode('local'); }}>
                  📁 本地上传
                </div>
              </div>

              {/* 链接转存模式 */}
              {uploadMode === 'link' && (
                <>
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button style={{ flex: 1 }} onClick={() => { setUploadStep('cloud_drive'); loadCloudDriveFiles(1, ''); }}>返回云盘</Button>
                    <Button type="primary" className="btn-primary-gradient" style={{ flex: 1 }} loading={preUploadLoading} onClick={handlePreUpload}>
                      解析文件
                    </Button>
                  </div>
                </>
              )}

              {/* 本地上传模式 */}
              {uploadMode === 'local' && (
                <>
                  <div
                    className={`local-upload-dropzone ${localFile ? 'has-file' : ''}`}
                    onClick={() => { if (!localUploading) document.getElementById('local-file-input')?.click(); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('dragover'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('dragover'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.classList.remove('dragover');
                      if (!localUploading && e.dataTransfer.files.length > 0) {
                        const f = e.dataTransfer.files[0];
                        setLocalFile(f);
                        setFileDisguiseWarning(null);
                        setFileFormatError(null);
                        const formatErr = checkFileExtension(f);
                        setFileFormatError(formatErr);
                        if (!formatErr) {
                          detectFileDisguise(f).then(warning => setFileDisguiseWarning(warning));
                        }
                      }
                    }}
                  >
                    <input
                      id="local-file-input"
                      type="file"
                      style={{ display: 'none' }}
                      accept={ALLOWED_ACCEPT}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const f = e.target.files[0];
                          setLocalFile(f);
                          setFileDisguiseWarning(null);
                          setFileFormatError(null);
                          const formatErr = checkFileExtension(f);
                          setFileFormatError(formatErr);
                          if (!formatErr) {
                            const warning = await detectFileDisguise(f);
                            setFileDisguiseWarning(warning);
                          }
                          e.target.value = '';
                        }
                      }}
                    />
                    {localFile ? (
                      <div className="local-upload-file-info">
                        <div className="local-upload-file-icon">📄</div>
                        <div className="local-upload-file-detail">
                          <div className="local-upload-file-name" title={localFile.name}>{localFile.name}</div>
                          <div className="local-upload-file-size">
                            {localFile.size >= 1024 * 1024 * 1024
                              ? (localFile.size / 1024 / 1024 / 1024).toFixed(2) + ' GB'
                              : localFile.size >= 1024 * 1024
                                ? (localFile.size / 1024 / 1024).toFixed(1) + ' MB'
                                : (localFile.size / 1024).toFixed(0) + ' KB'
                            }
                          </div>
                        </div>
                        {!localUploading && (
                          <Button size="small" type="text" danger onClick={(e) => { e.stopPropagation(); setLocalFile(null); setFileDisguiseWarning(null); setFileFormatError(null); }}>
                            移除
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="local-upload-placeholder">
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
                        <div>点击或拖拽文件到此处上传</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>支持格式：mp4, mkv, mov, mp3, wav, m4a, srt, png, jpg</div>
                      </div>
                    )}
                  </div>

                  {/* 文件格式错误 / 伪装警告 */}
                  {(fileFormatError || fileDisguiseWarning) && (
                    <div className="file-disguise-warning">
                      <span className="file-disguise-warning-icon">⚠</span>
                      <span>{fileFormatError || fileDisguiseWarning}</span>
                    </div>
                  )}

                  {/* 上传进度 */}
                  {localUploading && (
                    <div className="local-upload-progress-wrapper">
                      <div className="local-upload-progress-bar">
                        <div className="local-upload-progress-fill" style={{ width: `${localUploadProgress}%` }} />
                      </div>
                      <span className="local-upload-progress-text">{localUploadProgress}%</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button style={{ flex: 1 }} onClick={() => { if (localUploading) { cancelLocalUpload(); } else { setUploadStep('cloud_drive'); loadCloudDriveFiles(1, ''); } }}>
                      {localUploading ? '取消上传' : '返回云盘'}
                    </Button>
                    <Button type="primary" className="btn-primary-gradient" style={{ flex: 1 }} loading={localUploading} disabled={!localFile || !!fileDisguiseWarning || !!fileFormatError} onClick={handleLocalFileUpload}>
                      {localUploading ? '上传中...' : '开始上传'}
                    </Button>
                  </div>
                </>
              )}
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
                      </div>
                      <div className="pre-upload-file-relation">
                        <span style={{ fontSize: 11, color: '#666', marginRight: 4 }}>关联字幕:</span>
                        <Select
                          size="small"
                          style={{ flex: 1, minWidth: 0 }}
                          value={f.related_record_id ? String(f.related_record_id) : undefined}
                          placeholder="选择字幕文件"
                          allowClear
                          loading={updatingRelationFileId === f.pre_file_id}
                          disabled={updatingRelationFileId === f.pre_file_id}
                          onChange={(val) => {
                            if (val) {
                              const target = (preUploadResult.data.subtitle || []).find(s => String(s.id) === val) || null;
                              handleUpdateRelation(f, target, 'video');
                            } else {
                              handleUpdateRelation(f, null, 'video');
                            }
                          }}
                        >
                          {(preUploadResult.data.subtitle || []).map((s: IPreUploadFile) => (
                            <Select.Option key={s.id} value={String(s.id)}>{s.file_name}</Select.Option>
                          ))}
                        </Select>
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
                      </div>
                      <div className="pre-upload-file-relation">
                        <span style={{ fontSize: 11, color: '#666', marginRight: 4 }}>关联视频:</span>
                        <Select
                          size="small"
                          style={{ flex: 1, minWidth: 0 }}
                          value={f.related_record_id ? String(f.related_record_id) : undefined}
                          placeholder="选择视频文件"
                          allowClear
                          loading={updatingRelationFileId === f.pre_file_id}
                          disabled={updatingRelationFileId === f.pre_file_id}
                          onChange={(val) => {
                            if (val) {
                              const target = (preUploadResult.data.video || []).find(v => String(v.id) === val) || null;
                              handleUpdateRelation(f, target, 'subtitle');
                            } else {
                              handleUpdateRelation(f, null, 'subtitle');
                            }
                          }}
                        >
                          {(preUploadResult.data.video || []).map((v: IPreUploadFile) => (
                            <Select.Option key={v.id} value={String(v.id)}>{v.file_name}</Select.Option>
                          ))}
                        </Select>
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
                <Button onClick={() => { setUploadStep('cloud_drive'); loadCloudDriveFiles(1, ''); }} style={{ flex: 1 }}>返回云盘</Button>
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

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">文案类型</label>
              <Radio.Group
                value={copywritingType === 'secondary' ? 'secondary' : `original_${originalMode}`}
                onChange={(e) => {
                  const val = e.target.value as string;
                  setSelectedTemplate(null);
                  setTemplateListExpanded(true);
                  setSelectedViralSrtFile(null);
                  setSelectedViralVideoFile(null);
                  setConfirmedMovieJson(null);
                  setMovieSearchResults([]);

                  if (val === 'secondary') {
                    setCopywritingType('secondary');
                  } else if (val === 'original_热门影视') {
                    setCopywritingType('original');
                    setOriginalMode('热门影视');
                    if (narratorType === 'short_drama') {
                      setNarratorType('movie');
                      setSelectedMovie(null);
                      setMovieListExpanded(true);
                      setEpisodePairs([]);
                    }
                  } else if (val === 'original_原声混剪') {
                    setCopywritingType('original');
                    setOriginalMode('原声混剪');
                    if (narratorType === 'short_drama') {
                      setNarratorType('movie');
                      setSelectedMovie(null);
                      setMovieListExpanded(true);
                      setEpisodePairs([]);
                    }
                  } else if (val === 'original_冷门/新剧') {
                    setCopywritingType('original');
                    setOriginalMode('冷门/新剧');
                    if (narratorType !== 'short_drama') {
                      setNarratorType('short_drama');
                      setSelectedMovie(null);
                      setMovieListExpanded(true);
                      setSelectedEpisodeSrtFile(null);
                      setSelectedEpisodeVideoFile(null);
                      setCustomMovieName('');
                      setEpisodePairs([]);
                    }
                  }
                }}
                optionType="button"
                buttonStyle="solid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
              >
                <Radio.Button value="secondary" style={{ textAlign: 'center', borderRadius: 8 }}>二创文案</Radio.Button>
                <Radio.Button value="original_热门影视" style={{ textAlign: 'center', borderRadius: 8 }}>原创·纯解说</Radio.Button>
                <Radio.Button value="original_原声混剪" style={{ textAlign: 'center', borderRadius: 8 }}>原创·原声混剪</Radio.Button>
                <Radio.Button value="original_冷门/新剧" style={{ textAlign: 'center', borderRadius: 8 }}>原创·冷门短剧</Radio.Button>
              </Radio.Group>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">解说类型</label>
                <Select style={{ width: '100%' }} value={narratorType}
                  disabled={originalMode === '冷门/新剧' && copywritingType === 'original'}
                  onChange={(v: string) => {
                    setNarratorType(v);
                    setSelectedTemplate(null);
                    setTemplateListExpanded(true);
                    setSelectedMovie(null);
                    setMovieListExpanded(true);
                    setSelectedEpisodeSrtFile(null);
                    setSelectedEpisodeVideoFile(null);
                    setCustomMovieName('');
                    setEpisodePairs([]);
                  }}
                  options={
                    copywritingType === 'original' && originalMode === '冷门/新剧'
                      ? [{ label: '短剧', value: 'short_drama' }]
                      : copywritingType === 'original'
                        ? [
                            { label: '电影', value: 'movie' },
                            { label: '第一人称电影', value: 'first_person_movie' },
                            { label: '多语种电影', value: 'multilingual' },
                            { label: '第一人称多语种', value: 'first_person_multilingual' }
                          ]
                        : [
                            { label: '电影', value: 'movie' },
                            { label: '第一人称电影', value: 'first_person_movie' },
                            { label: '多语种电影', value: 'multilingual' },
                            { label: '第一人称多语种', value: 'first_person_multilingual' },
                            { label: '短剧', value: 'short_drama' }
                          ]
                  }
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">模型版本</label>
                <Select style={{ width: '100%' }} value={modelVersion} onChange={(v: string) => { setModelVersion(v); setSelectedTemplate(null); }}
                  options={[
                    { label: '标准版 (standard)', value: 'standard' }
                  ]}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>选择影片</label>
              {selectedMovie && !movieListExpanded && (
                <Button size="small" type="link" onClick={() => setMovieListExpanded(true)}>重新选择</Button>
              )}
            </div>
            {selectedMovie && !movieListExpanded ? (
              <div className={`movie-list-scroll ${isCustomMovie ? 'compact' : ''}`}>
                <div className="select-card selected">
                  {selectedMovie.cover ? (
                    <img className="select-card-cover" src={selectedMovie.cover} alt={selectedMovie.name}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  <div className={`select-card-cover-placeholder ${selectedMovie.cover ? 'hidden' : ''}`}>🎬</div>
                  <div className="select-card-info">
                    <div className="select-card-title">{selectedMovie.name}</div>
                    <div className="select-card-desc">
                      <div>类型: {selectedMovie.type}</div>
                      <div>{selectedMovie.story_info?.slice(0, 50)}...</div>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: 8, right: 8, color: '#5b21b6', fontSize: 18 }}>✓</div>
                </div>
              </div>
            ) : (
              <div className={`movie-list-scroll ${isCustomMovie ? 'compact' : ''}`}>
                {moviesLoading ? (
                  <Spin tip="加载中..." />
                ) : (
                  (isShortDrama ? movies.filter(m => m.name === '自定义') : movies).map((movie) => (
                    <div
                      key={movie.id}
                      className={`select-card ${selectedMovie?.id === movie.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedMovie(movie);
                        setMovieListExpanded(false);
                        if (movie.name !== '自定义') {
                          setConfirmedMovieJson(buildConfirmedMovieJsonFromMovie(movie));
                        } else {
                          setConfirmedMovieJson(null);
                        }
                      }}
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
            )}

            {isCustomMovie && (
              <div className="cloud-file-section">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">影片名称 <span style={{ color: '#ff4d4f' }}>*必填</span></label>
                  <Input placeholder="请输入影片名称" value={customMovieName} onChange={(e) => setCustomMovieName(e.target.value)}
                    onPressEnter={() => { if (copywritingType === 'original' && customMovieName.trim()) handleSearchMovies(customMovieName); }}
                    style={{ marginBottom: copywritingType === 'original' ? 8 : 0 }}
                  />
                  {copywritingType === 'original' && !confirmedMovieJson && (() => {
                    const isOptional = originalMode === '冷门/新剧';
                    return (
                      <div>
                        <Button
                          type={isOptional ? 'dashed' : 'primary'}
                          block
                          loading={movieSearchLoading}
                          disabled={!customMovieName.trim()}
                          onClick={() => handleSearchMovies(customMovieName)}
                          style={{ borderRadius: 8 }}
                        >
                          🔍 搜索关联电影信息{isOptional ? '（可选）' : ''}
                        </Button>
                        {!isOptional && (
                          <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4 }}>请输入影片名称后搜索并选择电影信息</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* 原创文案：电影搜索结果 */}
                {copywritingType === 'original' && movieSearchResults.length > 0 && !confirmedMovieJson && (
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>搜索结果 ({movieSearchResults.length} 部)</label>
                    {movieSearchResults.map((movie, idx) => (
                      <Card key={idx} size="small" style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ width: 50, height: 70, borderRadius: 4, flexShrink: 0, overflow: 'hidden', position: 'relative', background: '#f0f0f0' }}>
                            {movie.poster_url ? (
                              <img src={movie.poster_url} alt={movie.local_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                              />
                            ) : null}
                            <div className={movie.poster_url ? 'hidden' : ''} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎬</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{movie.local_title}</div>
                            <div style={{ fontSize: 11, color: '#666' }}>{movie.title} ({movie.year})</div>
                            <div style={{ fontSize: 11, color: '#888' }}>{movie.genre} | 导演: {movie.director}</div>
                            <div style={{ fontSize: 11, color: '#888' }}>主演: {movie.stars?.slice(0, 3).join(', ')}</div>
                            <div style={{ fontSize: 11, color: '#999', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{movie.summary?.slice(0, 60)}...</div>
                          </div>
                          <Button size="small" type="primary" style={{ alignSelf: 'center', flexShrink: 0 }}
                            onClick={() => {
                              setConfirmedMovieJson(movie);
                              setMovieSearchResults([]);
                              message.success(`已选择: ${movie.local_title}`);
                            }}>
                            选择
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {copywritingType === 'original' && movieSearchLoading && (
                  <div style={{ textAlign: 'center', padding: 16 }}><Spin tip="正在搜索电影信息..." /></div>
                )}

                {/* 原创文案：已确认的电影信息 */}
                {copywritingType === 'original' && confirmedMovieJson && (
                  <div style={{ marginBottom: 12, padding: 12, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>✅ 已确认电影信息</div>
                        <div style={{ fontSize: 12 }}>
                          <div><strong>{confirmedMovieJson.local_title}</strong> ({confirmedMovieJson.year})</div>
                          <div style={{ color: '#666' }}>{confirmedMovieJson.genre} | 导演: {confirmedMovieJson.director}</div>
                          <div style={{ color: '#888', marginTop: 2 }}>{confirmedMovieJson.summary?.slice(0, 80)}...</div>
                        </div>
                      </div>
                      <Button size="small" type="link" danger onClick={() => setConfirmedMovieJson(null)} style={{ flexShrink: 0 }}>清除</Button>
                    </div>
                  </div>
                )}

                {isShortDrama ? (
                  <>
                    {/* 短剧模式：多集对 */}
                    {episodePairs.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>已添加剧集 ({episodePairs.length} 对)</label>
                        {episodePairs.map((pair, index) => (
                          <Card key={index} size="small" style={{ marginBottom: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{index + 1} SRT: {pair.srt.file_name}</div>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#666' }}>视频: {pair.video.file_name}</div>
                              </div>
                              <Button size="small" danger style={{ marginLeft: 8 }}
                                onClick={() => setEpisodePairs(prev => prev.filter((_, i) => i !== index))}>
                                删除
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}

                    <div style={{ border: '1px dashed #d9d9d9', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <label className="form-label" style={{ fontSize: 12, marginBottom: 8 }}>添加新剧集对</label>
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
                                          onClick={() => { setSelectedEpisodeVideoFile(isSelected ? null : file); if (!isSelected) setEpisodeFileStep(null); }}>
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

                      <Button
                        type="primary"
                        block
                        disabled={!selectedEpisodeSrtFile || !selectedEpisodeVideoFile}
                        onClick={() => {
                          if (selectedEpisodeSrtFile && selectedEpisodeVideoFile) {
                            setEpisodePairs(prev => [...prev, { srt: selectedEpisodeSrtFile, video: selectedEpisodeVideoFile }]);
                            setSelectedEpisodeSrtFile(null);
                            setSelectedEpisodeVideoFile(null);
                            setEpisodeFileStep('srt');
                          }
                        }}
                        style={{ marginTop: 8 }}
                      >
                        添加此对 ({episodePairs.length + 1})
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 非短剧模式：单 SRT+视频 选择 */}
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
                                        onClick={() => { setSelectedEpisodeVideoFile(isSelected ? null : file); if (!isSelected) setEpisodeFileStep(null); }}>
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
          'movie_standard': 11,
          'first_person_movie_standard': 22,
          'multilingual_standard': 33,
          'first_person_multilingual_standard': 44,
          'short_drama_standard': 55,
        };
        const typeValue = String(typeValueMap[`${narratorType}_${modelVersion}`] ?? 11);
        const filteredTemplates = templates.filter(t => t.type === typeValue);
        const allTemplates = [customTemplateOption, ...filteredTemplates];
        return (
          <div>
            {/* 原创文案配置 */}
            {copywritingType === 'original' && (
              <>
                <div className="section-title">原创文案配置</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">文案语言</label>
                    <Select style={{ width: '100%' }} value={originalLanguage} onChange={(v: string) => setOriginalLanguage(v)}
                      options={[
                        { label: '中文', value: '中文' },
                        { label: '英语', value: '英语' },
                        { label: '日语', value: '日语' },
                        { label: '韩语', value: '韩语' },
                        { label: '泰语', value: '泰语' },
                        { label: '印尼语', value: '印尼语' },
                        { label: '葡萄牙语', value: '葡萄牙语' },
                        { label: '西班牙语', value: '西班牙语' },
                        { label: '法语', value: '法语' },
                        { label: '德语', value: '德语' },
                        { label: '阿拉伯语', value: '阿拉伯语' }
                      ]}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">文案模型</label>
                    <Select style={{ width: '100%' }} value={originalModel} onChange={(v: 'flash' | 'standard') => setOriginalModel(v)}
                      options={[
                        { label: '极速版 (5点/千字)', value: 'flash' },
                        { label: '旗舰版 (15点/千字)', value: 'standard' }
                      ]}
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>选择解说模板</div>
              {selectedTemplate && !templateListExpanded && (
                <Button size="small" type="link" onClick={() => setTemplateListExpanded(true)}>重新选择</Button>
              )}
            </div>
            {selectedTemplate && !templateListExpanded ? (
              <div className={`movie-list-scroll ${isCustomTemplate ? 'compact' : ''}`}>
                <div className="select-card selected">
                  {selectedTemplate.img ? (
                    <img className="select-card-cover" src={selectedTemplate.img} alt={selectedTemplate.name}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  <div className={`select-card-cover-placeholder ${selectedTemplate.img ? 'hidden' : ''}`}>📝</div>
                  <div className="select-card-info">
                    <div className="select-card-title">{selectedTemplate.name}</div>
                    <div className="select-card-desc">
                      {selectedTemplate.name === '自定义' ? (
                        <div>从云盘选择爆款SRT文件，自动生成学习模型</div>
                      ) : (
                        <>
                          <div>类型: {selectedTemplate.narrator_type || selectedTemplate.type}</div>
                          <div>语言: {selectedTemplate.language || '中文'}</div>
                          {selectedTemplate.tags && <div>标签: {selectedTemplate.tags}</div>}
                          {selectedTemplate.time && <div>时长: {selectedTemplate.time}</div>}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: 8, right: 8, color: '#5b21b6', fontSize: 18 }}>✓</div>
                </div>
              </div>
            ) : (
              <div className={`movie-list-scroll ${isCustomTemplate ? 'compact' : ''}`}>
                {templatesLoading ? (
                  <Spin tip="加载中..." />
                ) : (
                  allTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`select-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                      onClick={() => { setSelectedTemplate(template); setTemplateListExpanded(false); if (template.name === '自定义') { if (viralSrtFiles.length === 0) loadViralSrtFiles(); if (viralVideoFiles.length === 0) loadViralVideoFiles(); } }}
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
                              {template.time && <div>时长: {template.time}</div>}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

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

                {!selectedViralSrtFile && (
                  <>
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
                          renderItem={(file: ICloudFile) => (
                              <Card size="small" style={{ marginBottom: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div title={file.file_name} style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {file.file_name}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#999' }}>
                                      {(file.file_size / 1024 / 1024).toFixed(1)}MB | {file.suffix} | {file.created_at}
                                    </div>
                                  </div>
                                  <Button size="small" style={{ marginLeft: 8 }}
                                    onClick={() => setSelectedViralSrtFile(file)}>
                                    选择
                                  </Button>
                                </div>
                              </Card>
                          )}
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
                  </>
                )}

                {/* 爆款视频文件（可选） */}
                <div style={{ marginTop: 14, marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 4 }}>
                    已选爆款视频 <span style={{ color: '#999' }}>可选</span>
                  </label>
                  {selectedViralVideoFile ? (
                    <Tag color="purple" closable onClose={() => setSelectedViralVideoFile(null)} title={selectedViralVideoFile.file_name}
                      style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom', cursor: 'pointer' }}
                      onClick={() => { navigator.clipboard.writeText(selectedViralVideoFile.file_name); message.success('文件名已复制'); }}>
                      {selectedViralVideoFile.file_name}
                    </Tag>
                  ) : (
                    <Tag color="default">未选择</Tag>
                  )}
                </div>

                {!selectedViralVideoFile && (
                  <>
                    <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ marginBottom: 0, fontSize: 12 }}>爆款视频文件列表</label>
                      <Button size="small" onClick={() => loadViralVideoFiles(viralVideoFilesPage)} loading={viralVideoFilesLoading}>刷新</Button>
                    </div>
                    {viralVideoFilesLoading ? (
                      <Spin tip="加载爆款视频文件..." />
                    ) : (
                      <>
                        <List
                          size="small"
                          dataSource={viralVideoFiles}
                          renderItem={(file: ICloudFile) => (
                              <Card size="small" style={{ marginBottom: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div title={file.file_name} style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {file.file_name}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#999' }}>
                                      {(file.file_size / 1024 / 1024).toFixed(1)}MB | {file.suffix} | {file.created_at}
                                    </div>
                                  </div>
                                  <Button size="small" style={{ marginLeft: 8 }}
                                    onClick={() => setSelectedViralVideoFile(file)}>
                                    选择
                                  </Button>
                                </div>
                              </Card>
                          )}
                        />
                        {viralVideoFilesTotalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                            <Button size="small" disabled={viralVideoFilesPage <= 1} onClick={() => loadViralVideoFiles(viralVideoFilesPage - 1)}>上一页</Button>
                            <span style={{ fontSize: 12, lineHeight: '24px' }}>{viralVideoFilesPage}/{viralVideoFilesTotalPages}</span>
                            <Button size="small" disabled={viralVideoFilesPage >= viralVideoFilesTotalPages} onClick={() => loadViralVideoFiles(viralVideoFilesPage + 1)}>下一页</Button>
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
                  <label className="form-label">主角名称 {narratorType.startsWith('first_person') ? <span style={{ color: '#ff4d4f' }}>*必填</span> : '(可选)'}</label>
                  <Input
                    placeholder={parseFirstCharacterName(selectedMovie?.character_name ?? null) || '主角'}
                    value={targetCharacterName}
                    onChange={(e) => setTargetCharacterName(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>选择BGM</label>
                    {selectedBGM && !bgmListExpanded && (
                      <Button size="small" type="link" onClick={() => { setBgmListExpanded(true); if (selectedBGM.name === '自定义') loadCustomBgmFiles(); }}>重新选择</Button>
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
                        {selectedBGM.bgm_demo_url && selectedBGM.id !== -1 && selectedBGM.name !== '自定义' && (
                          <Button 
                            size="small" 
                            type={playingAudioUrl === selectedBGM.bgm_demo_url ? 'primary' : 'default'}
                            className="audio-play-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAudio(selectedBGM.bgm_demo_url);
                            }}
                          >
                            {playingAudioUrl === selectedBGM.bgm_demo_url ? '⏸ 暂停' : '▶ 试听'}
                          </Button>
                        )}
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
                          stopAudio();
                          setSelectedBGM({ id: -1, name: 'NO_BGM', bgm_file_id: 'NO_BGM', status: null, remark: null, bgm_demo_url: '', type: null, tag: null, description: null } as IBGM);
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
                              stopAudio();
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
                            <Button size="small" disabled={customBgmFilesPage <= 1} onClick={() => goToBgmPage(customBgmFilesPage - 1)}>上一页</Button>
                            <span style={{ fontSize: 12, lineHeight: '24px' }}>{customBgmFilesPage}/{customBgmFilesTotalPages}</span>
                            <Button size="small" disabled={customBgmFilesPage >= customBgmFilesTotalPages} onClick={() => goToBgmPage(customBgmFilesPage + 1)}>下一页</Button>
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
                        {selectedDubbing.dubbing_demo_url && selectedDubbing.name !== '自定义' && (
                          <Button 
                            size="small" 
                            type={playingAudioUrl === selectedDubbing.dubbing_demo_url ? 'primary' : 'default'}
                            className="audio-play-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAudio(selectedDubbing.dubbing_demo_url);
                            }}
                          >
                            {playingAudioUrl === selectedDubbing.dubbing_demo_url ? '⏸ 暂停' : '▶ 试听'}
                          </Button>
                        )}
                        <div className="audio-card-check">✓</div>
                      </div>
                      {selectedDubbing.name === '自定义' && customDubbingText && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                          配音名称：<Tag color="blue" style={{ fontSize: 11 }}>{customDubbingText}</Tag>
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
                              stopAudio();
                              setSelectedDubbing(dub);
                              setCustomDubbingText('');
                              if (dub.name !== '自定义') { setDubbingListExpanded(false); }
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
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>
                      自定义配音名称 <span style={{ color: '#ff4d4f' }}>*必填</span>
                    </label>
                    <Input
                      placeholder="输入配音名称，如 test_dubbing"
                      value={customDubbingText}
                      onChange={(e) => setCustomDubbingText(e.target.value)}
                      onPressEnter={() => { if (customDubbingText.trim()) setDubbingListExpanded(false); }}
                    />
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
                  <p><strong>影片:</strong> {selectedMovie?.name === '自定义' ? (customMovieName || '自定义影片') : selectedMovie?.name}</p>
                  <p><strong>解说类型:</strong> {{ movie: '电影', first_person_movie: '第一人称电影', multilingual: '多语种电影', first_person_multilingual: '第一人称多语种', short_drama: '短剧' }[narratorType] || narratorType}</p>
                  <p><strong>模型版本:</strong> 标准版</p>
                  {isCustomMovie && isShortDrama && (
                    <>
                      <p className="hint">剧集对数: {episodePairs.length}</p>
                      {episodePairs.map((pair, i) => (
                        <p key={i} className="hint" style={{ fontSize: 11 }}>
                          #{i + 1}: {pair.srt.file_name} + {pair.video.file_name}
                        </p>
                      ))}
                    </>
                  )}
                  {isCustomMovie && !isShortDrama && (
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
                  {copywritingType === 'original' && (
                    <>
                      <p><strong>文案类型:</strong> 原创文案 ({originalMode === '原声混剪' ? '原声混剪' : originalMode === '冷门/新剧' ? '冷门/新剧' : '纯解说'})</p>
                      <p className="hint">文案语言: {originalLanguage} | 文案模型: {originalModel === 'flash' ? '极速版' : '旗舰版'}</p>
                      {confirmedMovieJson && <p className="hint">电影信息: {confirmedMovieJson.local_title} ({confirmedMovieJson.year})</p>}
                    </>
                  )}
                  <p><strong>模板:</strong> {selectedTemplate?.name === '自定义' ? '自定义模板' : selectedTemplate?.name}</p>
                  {selectedTemplate?.name === '自定义' ? (
                    <>
                      <p className="hint">爆款SRT: {selectedViralSrtFile?.file_name}</p>
                      {selectedViralVideoFile && <p className="hint">爆款视频: {selectedViralVideoFile.file_name}</p>}
                      {copywritingType === 'original'
                        ? <p className="hint" style={{ color: '#52c41a' }}>无需爆款学习步骤，直接生成原创文案</p>
                        : <p className="hint" style={{ color: '#eb2f96' }}>将先生成爆款模型，再自动创建文案</p>
                      }
                    </>
                  ) : (
                    <p className="hint">模型ID: {selectedTemplate?.learning_model_id}</p>
                  )}
                  <p><strong>BGM:</strong> {selectedBGM?.name === '自定义' ? `自定义 (${selectedCustomBgmFile?.file_name})` : selectedBGM?.name === 'NO_BGM' ? '不使用BGM' : selectedBGM?.name}</p>
                  <p><strong>配音:</strong> {selectedDubbing?.name === '自定义' ? `自定义 (${customDubbingText})` : selectedDubbing?.name}</p>
                  <p><strong>平台:</strong> {targetPlatform}</p>
                  <p><strong>交付模式:</strong> {deliveryMode === 'staged' ? '分段式交付' : '一站式交付'}</p>
                </div>
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
      case 0: {
        if (!selectedMovie) return false;
        if (!isCustomMovie) return true;
        if (!customMovieName.trim()) return false;
        // 原创模式电影搜索必填校验（仅冷门/新剧可选，其余原创必填）
        if (copywritingType === 'original' && isCustomMovie) {
          const searchOptional = originalMode === '冷门/新剧';
          if (!searchOptional && !confirmedMovieJson) return false;
        }
        if (isShortDrama) return episodePairs.length > 0;
        return !!selectedEpisodeSrtFile && !!selectedEpisodeVideoFile;
      }
      case 1: {
        if (!selectedTemplate) return false;
        if (selectedTemplate.name === '自定义') return !!selectedViralSrtFile;
        return true;
      }
      case 2: {
        if (!selectedBGM || !selectedDubbing) return false;
        if (selectedBGM.name === '自定义' && !selectedCustomBgmFile) return false;
        if (selectedDubbing.name === '自定义' && !customDubbingText.trim()) return false;
        if ((narratorType === 'first_person_movie' || narratorType === 'first_person_multilingual') && !targetCharacterName.trim()) return false;
        return true;
      }
      default: return false;
    }
  };

  // 渲染登录页
  const renderLoginPage = () => (
    <div className="login-page">
      <img src="https://jieshuo.cn/subtitle-preview/logo.png" alt="Logo" style={{ width: 64, height: 64, marginBottom: 12 }} />
      <div className="login-title">AI解说大师</div>
      <div className="login-subtitle">电影解说AI智能体</div>
      <div className="login-card">
        <div style={{ marginBottom: 16 }}>
          <Input
            size="large"
            placeholder="请输入App Key"
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
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#999' }}>
          还没有 App Key？<a onClick={() => setShowContactModal(true)} style={{ color: '#7c5cfc', cursor: 'pointer' }}>联系我们获取</a>
        </div>
      </div>
      <Modal open={showContactModal} onCancel={() => setShowContactModal(false)} footer={null} centered width={340}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <img src="/contact-qrcode.png" alt="联系我们" style={{ width: 240, height: 240 }} />
          <div style={{ marginTop: 12, fontSize: 14, color: '#666' }}>扫码添加企业微信</div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>咨询并获取 App Key</div>
        </div>
      </Modal>
    </div>
  );
  
  // 渲染订单列表页
  const renderOrdersPage = () => (
    <div className="page">
      <div className="page-header">
        <h3><img src="https://jieshuo.cn/subtitle-preview/logo.png" alt="Logo" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 6 }} />AI解说大师</h3>
        <div className="page-header-actions">
          <Button size="small" onClick={refreshOrders} loading={refreshingOrders}>🔄 同步订单状态</Button>
          <Button size="small" type="link" danger onClick={handleLogout}>退出</Button>
        </div>
      </div>

      {/* 用户信息卡片 */}
      {userInfo && (
        <div className="user-info-card">
          <div className="user-info-row">
            <span className="user-info-label">👤 {userInfo.nickname}</span>
            <span className="user-info-company">{userInfo.company_name}</span>
          </div>
          <div className="user-info-row">
            <span className="user-info-balance">💰 余额: <strong>{userInfo.balance}</strong> 点</span>
            <span className="user-info-mobile">{userInfo.mobile}</span>
          </div>
        </div>
      )}
      
      <Button type="primary" block className="btn-create" style={{ marginBottom: 8 }} onClick={startCreateOrder}>
        + 创建新订单
      </Button>
      <Button block className="btn-upload" style={{ marginBottom: 20 }} onClick={openCloudDriveModal}>
        📁 我的云盘
      </Button>

      <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>📋 我的订单</h4>
      {orders.length === 0 ? (
        <Empty description="暂无订单" />
      ) : (
        orders.map((order) => (
          <div key={order.id} className="order-card" onClick={() => viewOrderDetail(order.id)}>
            <div className="order-card-header">
              <div>
                <div className="order-card-title">{order.movieName}</div>
                <div className="order-card-meta">{formatTime(order.createdAt)} | {order.copywritingType === 'original' ? '原创文案' : (order.templateSource === 'generate' ? '自定义模板' : order.templateName)}</div>
              </div>
              <Tag color={getStatusColor(order.status)}>{getStatusText(order.status)}</Tag>
            </div>
            {order.status === 'error' && (() => {
              const failedTask = order.tasks.find(t => t.status === 'error');
              const stageMap: Record<string, string> = {
                viral_learn: '生成爆款模型', script: '生成解说文案',
                clip: '生成剪辑脚本', video: '合成视频',
                original_script: '原创文案生成', original_clip: '原创文案剪辑'
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
        case 'original_script': return '✍️';
        case 'original_clip': return '🎞️';
        default: return '📋';
      }
    };
    
    const getTaskName = (type: string) => {
      switch (type) {
        case 'viral_learn': return '生成爆款模型';
        case 'script': return '生成解说文案';
        case 'clip': return '生成剪辑脚本';
        case 'video': return '合成视频';
        case 'original_script': return '原创文案生成';
        case 'original_clip': return '原创文案剪辑';
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
              <span className="value">{currentOrder.templateSource === 'generate' ? '自定义模板 (自动生成)' : currentOrder.templateName}</span>
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
            <Alert type="error" message="错误信息" description={
              <>
                {currentOrder.errorMessage}
              </>
            } style={{ marginTop: 12 }} />
          )}
        </div>
        
        <div className="task-section-title">📋 任务进度</div>
        {currentOrder.tasks.length === 0 ? (
          <div>
            <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>暂无任务记录</div>
            {currentOrder.status === 'error' && (
              <Button
                type="primary"
                danger
                size="small"
                style={{ borderRadius: 8 }}
                loading={retryingOrder}
                onClick={() => retryOrderCreation(currentOrder.id)}
              >
                🔄 重试订单
              </Button>
            )}
          </div>
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
                  {task.result?.api_response?.data?.consumed_points > 0 && (
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>消耗点数: {task.result.api_response.data.consumed_points}</div>
                  )}
                  {task.type !== 'viral_learn' && (() => {
                    // 优先使用 data.files；script/clip/original_script/original_clip 任务若无 files 则从 task_result 构造
                    let files: any[] = task.result?.api_response?.data?.files || [];
                    if (files.length === 0 && (task.type === 'script' || task.type === 'clip' || task.type === 'original_script' || task.type === 'original_clip')) {
                      const taskResults: any[] = task.result?.api_response?.data?.results?.tasks || [];
                      files = taskResults.reduce((acc: any[], t: any) => {
                        if (!t.task_result) return acc;
                        let fileId = t.task_result;
                        let fileName = t.task_result;
                        if (typeof t.task_result === 'string' && t.task_result.startsWith('{')) {
                          try {
                            const parsed = JSON.parse(t.task_result);
                            fileId = parsed.clip_data_file || parsed.file_id || t.task_result;
                            fileName = parsed.clip_data_file || t.task_result;
                          } catch { /* keep original */ }
                        }
                        const namePart = String(fileName).split('/').pop() || String(fileName);
                        const suffix = namePart.includes('.') ? namePart.split('.').pop() : '';
                        acc.push({ file_id: fileId, file_name: namePart, original_name: namePart, suffix, file_size: 0 });
                        return acc;
                      }, []);
                    }
                    if (files.length === 0) return null;
                    return (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>📎 产物文件 ({files.length})</div>
                        {files.map((f: any, fi: number) => (
                          <div key={fi} className="task-file-item">
                            <div className="task-file-info">
                              <span className="task-file-name" title={f.file_path || f.file_name}>{f.original_name || f.file_name}</span>
                              <span className="task-file-meta">{f.suffix}{f.file_size > 0 ? ` | ${(Number(f.file_size) / 1024).toFixed(1)}KB` : ''}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                              {f.file_id && (
                                <Button size="small" type="link" style={{ fontSize: 11, padding: '0 4px' }}
                                  loading={downloadingFileId === f.file_id}
                                  onClick={async () => {
                                    try {
                                      setDownloadingFileId(f.file_id);
                                      const url = await fetchFileDownloadUrl(appKey, f.file_id);
                                      window.open(url, '_blank');
                                    } catch (err: any) {
                                      message.error(err.message || '获取下载地址失败');
                                    } finally {
                                      setDownloadingFileId(null);
                                    }
                                  }}>
                                  下载
                                </Button>
                              )}
                              <Button size="small" type="link" style={{ fontSize: 11, padding: '0 4px' }}
                                onClick={() => { navigator.clipboard.writeText(f.file_id || f.file_path); message.success('已复制文件ID'); }}>
                                复制ID
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
              {task.status === 'wait_confirm' && (
                <div className="task-confirm-block">
                  <div className="task-confirm-title">
                    {task.type === 'viral_learn' ? `🧠 爆款模型已生成，模型ID: ${task.result?.api_response?.data?.results?.order_info?.learning_model_id || '未知'}` : task.type === 'script' ? '📝 解说文案已生成，请确认' : '✂️ 剪辑脚本已生成，请确认'}
                  </div>
                  <Button type="primary" size="small" style={{ borderRadius: 8 }} onClick={() => handleEstimateForConfirm(currentOrder.id, task.type)}>
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
          { title: '选择模板' },
          { title: '配置' },
          { title: '执行' }
        ]}
      />
      
      <div className="create-step-content">
        {renderStepContent()}
      </div>
      
      {taskPhase === 'idle' && (
        <div className="step-actions">
          {currentStep > 0 && (
            <Button onClick={() => setCurrentStep(currentStep - 1)}>
              上一步
            </Button>
          )}
          {currentStep < 3 && (
            <Button
              type="primary"
              className="btn-primary-gradient"
              disabled={!canGoNext()}
              onClick={() => setCurrentStep(currentStep + 1)}
              style={{ flex: 1 }}
            >
              {currentStep === 2 ? '确认配置' : '下一步'}
            </Button>
          )}
          {currentStep === 3 && (
            <Button
              type="primary"
              className="btn-primary-gradient"
              onClick={handleEstimatePoints}
              style={{ flex: 1 }}
            >
              开始生成视频
            </Button>
          )}
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
      {renderEstimateModal()}
    </>
  );
}
