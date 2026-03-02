import React, { useEffect, useState, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import { bitable, FieldType, ISingleSelectField, ITextField, ICheckBoxField } from '@lark-base-open/js-sdk';
import { Alert, Button, Select } from 'antd';
import { fetchDramaOptions } from './drama-api';
import { fetchFileList, filterSrtFiles, filterVideoFiles, generateEpisodesJson, IFileItem } from './files-api';
import { submitNarrateTask, buildNarrateRequest, IEpisodeData } from './narrate-api';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LoadApp/>
  </React.StrictMode>
)

// 工具函数: 从选项 "name | id" 格式中提取 learning_model_id
export function extractLearningModelId(optionLabel: string): string | null {
  const parts = optionLabel.split(' | ');
  return parts.length === 2 ? parts[1].trim() : null;
}

// 工具函数: 从ITextField的值(IOpenSegment[])中提取纯文本
function extractTextValue(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map((seg: any) => seg.text || '').join('');
  }
  return '';
}

function LoadApp() {
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'latest' | 'error'>('syncing');
  const [syncMessage, setSyncMessage] = useState<string>('正在同步...');
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // Episodes configuration state
  const [fileList, setFileList] = useState<IFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [episodes, setEpisodes] = useState<{ srtFileId: string; videoFileId: string }[]>([]);
  const [episodesResult, setEpisodesResult] = useState<{ success: boolean; message: string } | null>(null);
  const [appKey, setAppKey] = useState('grid_9OGNTGX73feXcyzatLwMCBdFxPWhNPBe');

  // Field creation state
  const [fieldLoading, setFieldLoading] = useState(false);
  const [fieldResult, setFieldResult] = useState<{ success: boolean; message: string } | null>(null);

  // Narrate state
  const [narrateLoading, setNarrateLoading] = useState(false);
  const [narrateResult, setNarrateResult] = useState<{ success: boolean; message: string; details?: string[] } | null>(null);

  const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  const doSync = useCallback(async (silent: boolean = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    if (!silent) {
      setSyncStatus('syncing');
      setSyncMessage('正在同步...');
    }
    try {
      const table = await bitable.base.getActiveTable();
      const singleSelectField = await table.getFieldByName<ISingleSelectField>('learning_model_id');

      if (!singleSelectField) {
        setSyncStatus('error');
        setSyncMessage('未找到名为"learning_model_id"的字段');
        return;
      }

      const fieldType = await singleSelectField.getType();
      const fieldTypeMap: Record<number, string> = {
        1: 'Text', 2: 'Number', 3: 'SingleSelect', 4: 'MultiSelect',
        5: 'DateTime', 7: 'Checkbox', 11: 'User', 13: 'Phone',
        15: 'Url', 17: 'Attachment', 18: 'SingleLink', 19: 'Lookup',
        20: 'Formula', 21: 'DuplexLink', 22: 'Location', 23: 'GroupChat',
        1001: 'CreatedTime', 1002: 'ModifiedTime', 1003: 'CreatedUser', 1004: 'ModifiedUser',
        1005: 'AutoNumber', 99001: 'Barcode', 99002: 'Progress', 99003: 'Currency', 99004: 'Rating',
        99005: 'Email'
      };
      const typeName = fieldTypeMap[fieldType] || `Unknown(${fieldType})`;

      if (fieldType !== FieldType.SingleSelect) {
        setSyncStatus('error');
        setSyncMessage(`字段类型错误: ${typeName}`);
        return;
      }

      const dramaList = await fetchDramaOptions();
      console.log('API返回数据数量:', dramaList.length);
      // 格式: "name | learning_model_id"
      const optionLabels = dramaList
        .filter(item => item.name && item.learning_model_id)
        .map(item => `${item.name} | ${item.learning_model_id}`);

      if (optionLabels.length === 0) {
        setSyncStatus('latest');
        setSyncMessage('没有选项数据');
        return;
      }

      // 尝试获取现有选项
      let existingLabels = new Set<string>();
      try {
        if (typeof (singleSelectField as any).getOptions === 'function') {
          const existingOptions = await (singleSelectField as any).getOptions();
          existingLabels = new Set(existingOptions.map((opt: any) => opt.name));
          console.log('现有选项数量:', existingLabels.size);
        }
      } catch (e) {
        console.log('获取现有选项失败，将尝试添加所有选项');
      }

      let addedCount = 0;
      let skippedCount = 0;
      let lastError = '';

      for (const label of optionLabels.slice(0, 6)) {
        if (existingLabels.has(label)) {
          skippedCount++;
          continue;
        }
        try {
          const result = await singleSelectField.addOption(label);
          console.log(`添加选项 "${label}" 结果:`, result);
          addedCount++;
        } catch (e) {
          skippedCount++;
          lastError = (e as any).message || JSON.stringify(e);
          console.log(`跳过选项 "${label}":`, e);
        }
      }

      const msg = `新增 ${addedCount} 个，跳过 ${skippedCount} 个`;
      setSyncStatus('latest');
      setSyncMessage(msg);
    } catch (error) {
      console.error('同步失败:', error);
      setSyncStatus('error');
      setSyncMessage(`同步失败: ${(error as any).message}`);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Episodes functions
  const loadFiles = async () => {
    setFilesLoading(true);
    setEpisodesResult(null);
    try {
      const files = await fetchFileList(appKey);
      setFileList(files);
      setEpisodesResult({ success: true, message: `加载了 ${files.length} 个文件` });
    } catch (error) {
      setEpisodesResult({ success: false, message: `加载失败: ${(error as any).message}` });
    } finally {
      setFilesLoading(false);
    }
  };

  const addEpisode = () => {
    setEpisodes([...episodes, { srtFileId: '', videoFileId: '' }]);
  };

  const removeEpisode = (index: number) => {
    setEpisodes(episodes.filter((_, i) => i !== index));
  };

  const updateEpisode = (index: number, field: 'srtFileId' | 'videoFileId', value: string) => {
    const newEpisodes = [...episodes];
    newEpisodes[index] = { ...newEpisodes[index], [field]: value };
    setEpisodes(newEpisodes);
  };

  const generateAndFillEpisodes = async () => {
    const validEpisodes = episodes.filter(ep => ep.srtFileId && ep.videoFileId);
    if (validEpisodes.length === 0) {
      setEpisodesResult({ success: false, message: '请至少配置一集（选择SRT和视频文件）' });
      return;
    }

    try {
      const table = await bitable.base.getActiveTable();
      const textField = await table.getFieldByName<ITextField>('episodes_data');
      
      if (!textField) {
        setEpisodesResult({ success: false, message: '未找到名为"episodes_data"的字段' });
        return;
      }

      const jsonData = generateEpisodesJson(validEpisodes);
      const jsonString = JSON.stringify(jsonData);
      
      // 获取当前选中的记录
      const selection = await bitable.base.getSelection();
      if (!selection.recordId) {
        setEpisodesResult({ success: false, message: '请先选择一条记录' });
        return;
      }

      await textField.setValue(selection.recordId, jsonString);
      setEpisodesResult({ success: true, message: `已填入 ${validEpisodes.length} 集数据` });
    } catch (error) {
      setEpisodesResult({ success: false, message: `填入失败: ${(error as any).message}` });
    }
  };

  const srtFiles = filterSrtFiles(fileList);
  const videoFiles = filterVideoFiles(fileList);

  // 补全字段功能
  const createRequiredFields = async () => {
    setFieldLoading(true);
    setFieldResult(null);
    
    const textFields = [
      { name: 'app_key', description: 'app凭证' },
      { name: 'playlet_name', description: '电影名称' },
      { name: 'target_character_name', description: '第一视角解说电影的主角名称' },
      { name: 'target_platform', description: '目标平台，如：抖音' },
      { name: 'vendor_requirements', description: '厂商要求' },
      { name: 'episodes_data', description: '剧集信息' },
      { name: 'story_info', description: '电影故事剧情简介' },
      { name: '解说文案任务结果', description: '一键解说API返回的task_id' }
    ];
    const singleSelectFields = [
      { name: 'learning_model_id', description: '学习模型id' }
    ];

    try {
      const table = await bitable.base.getActiveTable();
      const existingFields = await table.getFieldMetaList();
      const existingNames = new Set(existingFields.map(f => f.name));

      let createdCount = 0;
      let skippedCount = 0;

      // 创建文本字段
      for (const field of textFields) {
        if (existingNames.has(field.name)) {
          skippedCount++;
          continue;
        }
        await table.addField({ type: FieldType.Text, name: field.name, description: { content: [{ type: 'text' as any, text: field.description }] } });
        createdCount++;
      }

      // 创建单选字段
      for (const field of singleSelectFields) {
        if (existingNames.has(field.name)) {
          skippedCount++;
          continue;
        }
        await table.addField({ type: FieldType.SingleSelect, name: field.name, description: { content: [{ type: 'text' as any, text: field.description }] } });
        createdCount++;
      }

      setFieldResult({
        success: true,
        message: `完成！新建 ${createdCount} 个字段，跳过 ${skippedCount} 个已存在`
      });
    } catch (error) {
      setFieldResult({
        success: false,
        message: `创建失败: ${(error as any).message}`
      });
    } finally {
      setFieldLoading(false);
    }
  };

  // 一键解说功能
  const batchNarrate = async () => {
    setNarrateLoading(true);
    setNarrateResult(null);
    const details: string[] = [];

    try {
      const table = await bitable.base.getActiveTable();
      const recordIds = await table.getRecordIdList();
      
      // 获取所有需要的字段
      const checkboxField = await table.getFieldByName<ICheckBoxField>('是否一键解说');
      if (!checkboxField) {
        setNarrateResult({ success: false, message: '未找到"是否一键解说"字段' });
        return;
      }

      const appKeyField = await table.getFieldByName<ITextField>('app_key');
      const playletNameField = await table.getFieldByName<ITextField>('playlet_name');
      const targetCharacterField = await table.getFieldByName<ITextField>('target_character_name');
      const targetPlatformField = await table.getFieldByName<ITextField>('target_platform');
      const vendorReqField = await table.getFieldByName<ITextField>('vendor_requirements');
      const episodesDataField = await table.getFieldByName<ITextField>('episodes_data');
      const storyInfoField = await table.getFieldByName<ITextField>('story_info');
      const learningModelField = await table.getFieldByName<ISingleSelectField>('learning_model_id');
      const taskResultField = await table.getFieldByName<ITextField>('解说文案任务结果');

      let successCount = 0;
      let skipCount = 0;

      for (const recordId of recordIds) {
        // 检查是否勾选
        const isChecked = await checkboxField.getValue(recordId);
        if (!isChecked) {
          continue;
        }

        // 获取字段值并提取文本
        const appKeyVal = extractTextValue(appKeyField ? await appKeyField.getValue(recordId) : null);
        const playletNameVal = extractTextValue(playletNameField ? await playletNameField.getValue(recordId) : null);
        const targetCharacterVal = extractTextValue(targetCharacterField ? await targetCharacterField.getValue(recordId) : null);
        const targetPlatformVal = extractTextValue(targetPlatformField ? await targetPlatformField.getValue(recordId) : null);
        const vendorReqVal = extractTextValue(vendorReqField ? await vendorReqField.getValue(recordId) : null);
        const episodesDataVal = extractTextValue(episodesDataField ? await episodesDataField.getValue(recordId) : null);
        const storyInfoVal = extractTextValue(storyInfoField ? await storyInfoField.getValue(recordId) : null);
        const learningModelVal = learningModelField ? await learningModelField.getValue(recordId) : null;

        // 校验必填字段
        const missingFields: string[] = [];
        if (!appKeyVal) missingFields.push('app_key');
        if (!playletNameVal) missingFields.push('playlet_name');
        if (!targetCharacterVal) missingFields.push('target_character_name');
        if (!targetPlatformVal) missingFields.push('target_platform');
        if (!vendorReqVal) missingFields.push('vendor_requirements');
        if (!episodesDataVal) missingFields.push('episodes_data');
        if (!storyInfoVal) missingFields.push('story_info');
        if (!learningModelVal) missingFields.push('learning_model_id');

        if (missingFields.length > 0) {
          skipCount++;
          details.push(`跳过记录: 缺少 ${missingFields.join(', ')}`);
          continue;
        }

        // 解析 episodes_data JSON
        let episodesData: IEpisodeData[];
        try {
          const parsed = JSON.parse(episodesDataVal);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            skipCount++;
            details.push(`跳过记录: episodes_data 格式无效`);
            continue;
          }
          episodesData = parsed;
        } catch {
          skipCount++;
          details.push(`跳过记录: episodes_data JSON 解析失败`);
          continue;
        }

        // 提取 learning_model_id
        const learningModelOption = learningModelVal as { text?: string } | null;
        const optionText = learningModelOption?.text || '';
        const learningModelId = extractLearningModelId(optionText);
        if (!learningModelId) {
          skipCount++;
          details.push(`跳过记录: learning_model_id 格式无效`);
          continue;
        }

        // 构建请求
        const request = buildNarrateRequest(
          appKeyVal,
          learningModelId,
          episodesData,
          playletNameVal,
          targetPlatformVal,
          targetCharacterVal,
          vendorReqVal,
          storyInfoVal
        );

        // 调用API
        try {
          const response = await submitNarrateTask(request);
          successCount++;
          details.push(`✅ ${playletNameVal}: task_id=${response.task_id}`);
          // 回填task_id到"解说文案任务结果"字段
          if (taskResultField) {
            await taskResultField.setValue(recordId, response.task_id);
          }
        } catch (error) {
          skipCount++;
          const errorMsg = (error as any).message || '请求失败';
          details.push(`❌ ${playletNameVal}: ${errorMsg}`);
          // 回填错误信息到"解说文案任务结果"字段
          if (taskResultField) {
            await taskResultField.setValue(recordId, `错误: ${errorMsg}`);
          }
        }
      }

      setNarrateResult({
        success: successCount > 0,
        message: `完成! 成功 ${successCount} 条，跳过 ${skipCount} 条`,
        details
      });
    } catch (error) {
      setNarrateResult({
        success: false,
        message: `执行失败: ${(error as any).message}`,
        details
      });
    } finally {
      setNarrateLoading(false);
    }
  };

  // 自动同步: 加载时 + 定时刷新
  useEffect(() => {
    doSync();
    syncIntervalRef.current = setInterval(() => {
      doSync();
    }, SYNC_INTERVAL_MS);
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [doSync]);

  return (
    <div>
      {/* 补全字段功能 */}
      <div style={{ margin: 10, marginBottom: 20 }}>
        <Button onClick={createRequiredFields} loading={fieldLoading}>
          补全表格字段
        </Button>
        <span style={{ marginLeft: 10, fontSize: 12, color: '#888' }}>
          创建必需的8个字段
        </span>
        {fieldResult && (
          <Alert
            style={{ marginTop: 10 }}
            type={fieldResult.success ? 'success' : 'error'}
            message={fieldResult.message}
            showIcon
          />
        )}
      </div>

      {/* 一键解说功能 */}
      <div style={{ margin: 10, marginBottom: 20, padding: 10, background: '#f0f5ff', borderRadius: 4, border: '1px solid #adc6ff' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 10 }}>🎬 一键解说</div>
        <Button type="primary" onClick={batchNarrate} loading={narrateLoading}>
          执行一键解说
        </Button>
        <span style={{ marginLeft: 10, fontSize: 12, color: '#666' }}>
          处理所有勾选"是否一键解说"的记录
        </span>
        {narrateResult && (
          <Alert
            style={{ marginTop: 10 }}
            type={narrateResult.success ? 'success' : 'error'}
            message={narrateResult.message}
            description={narrateResult.details && narrateResult.details.length > 0 ? (
              <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 12 }}>
                {narrateResult.details.map((d, i) => <div key={i}>{d}</div>)}
              </div>
            ) : undefined}
            showIcon
          />
        )}
      </div>

      {/* Learning Model 同步状态提示 */}
      <div style={{ margin: 10, padding: 10, background: syncStatus === 'latest' ? '#f6ffed' : syncStatus === 'error' ? '#fff2f0' : '#e6f7ff', borderRadius: 4, border: `1px solid ${syncStatus === 'latest' ? '#b7eb8f' : syncStatus === 'error' ? '#ffccc7' : '#91d5ff'}` }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: 8, fontSize: 16 }}>
            {syncStatus === 'syncing' ? '🔄' : syncStatus === 'latest' ? '✅' : '❌'}
          </span>
          <span style={{ fontWeight: 'bold' }}>爆款模型数据</span>
          <span style={{ marginLeft: 8, color: syncStatus === 'latest' ? '#52c41a' : syncStatus === 'error' ? '#ff4d4f' : '#1890ff' }}>
            {syncStatus === 'syncing' ? '同步中...' : syncStatus === 'latest' ? '已是最新' : '同步失败'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          {syncMessage}
        </div>
      </div>

      {/* Episodes Configuration */}
      <div style={{ margin: 10, marginTop: 20, paddingTop: 20, borderTop: '1px solid #eee' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 10 }}>剧集配置 (episodes_data)</div>
        
        <div style={{ marginBottom: 10 }}>
          <Button onClick={loadFiles} loading={filesLoading}>
            加载文件列表
          </Button>
          <span style={{ marginLeft: 10, fontSize: 12, color: '#888' }}>
            SRT: {srtFiles.length} | 视频: {videoFiles.length}
          </span>
        </div>

        {episodes.map((ep, index) => (
          <div key={index} style={{ marginBottom: 10, padding: 10, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>第 {index + 1} 集</div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ marginRight: 8 }}>SRT:</span>
              <Select
                style={{ width: 200 }}
                placeholder="选择SRT文件"
                value={ep.srtFileId || undefined}
                onChange={(value) => updateEpisode(index, 'srtFileId', value)}
                options={srtFiles.map(f => ({ label: f.file_name, value: f.file_id }))}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ marginRight: 8 }}>视频:</span>
              <Select
                style={{ width: 200 }}
                placeholder="选择视频文件"
                value={ep.videoFileId || undefined}
                onChange={(value) => updateEpisode(index, 'videoFileId', value)}
                options={videoFiles.map(f => ({ label: f.file_name, value: f.file_id }))}
              />
            </div>
            <Button size="small" danger onClick={() => removeEpisode(index)}>删除</Button>
          </div>
        ))}

        <div style={{ marginBottom: 10 }}>
          <Button onClick={addEpisode} disabled={fileList.length === 0}>
            + 添加剧集
          </Button>
        </div>

        <Button type="primary" onClick={generateAndFillEpisodes} disabled={episodes.length === 0}>
          生成并填入
        </Button>

        {episodesResult && (
          <Alert
            style={{ marginTop: 10 }}
            type={episodesResult.success ? 'success' : 'error'}
            message={episodesResult.message}
            showIcon
          />
        )}
      </div>
    </div>
  );
}