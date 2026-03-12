import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [settings, setSettings] = useState({
    recordAudio: true,
    recordVideo: true,
    mutePage: true,
  });
  const [status, setStatus] = useState('未录制');
  const [statusClass, setStatusClass] = useState('status-stopped');
  const timerRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const videoStreamRef = useRef(null);

  // 格式检测状态
  const [audioMimeType, setAudioMimeType] = useState('');
  const [videoMimeType, setVideoMimeType] = useState('');
  const [audioExtension, setAudioExtension] = useState('webm');
  const [videoExtension, setVideoExtension] = useState('webm');

  // AI API配置（统一使用OpenAI兼容模式）
  const [aiConfig, setAiConfig] = useState({
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelId: 'qwen-plus',
    enabled: false,
  });

  // 转录和总结状态
  const [transcribing, setTranscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState('');
  const [summaryResult, setSummaryResult] = useState('');

  // 音频数据可用状态（用于触发按钮状态更新）
  const [hasAudioData, setHasAudioData] = useState(false);

  useEffect(() => {
    // 加载存储的设置
    chrome.storage.local.get(['recordingSettings', 'aiApiConfig'], (result) => {
      const defaultSettings = {
        recordAudio: true,
        recordVideo: true,
        mutePage: true,
      };
      const savedSettings = result.recordingSettings || defaultSettings;
      setSettings(savedSettings);

      // 加载 AI API 配置
      if (result.aiApiConfig) {
        setAiConfig(result.aiApiConfig);
      }
    });

    // 检测媒体录制格式
    detectMediaFormats();

    // 检查录制状态
    checkRecordingStatus();

    // 清理定时器
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 格式检测
  const detectMediaFormats = () => {
    const audioTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const type of audioTypes) {
      if (window.MediaRecorder && window.MediaRecorder.isTypeSupported(type)) {
        setAudioMimeType(type);
        setAudioExtension(type.includes('ogg') ? 'ogg' : 'webm');
        break;
      }
    }

    const videoTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/x-matroska;codecs=av1',
      'video/x-matroska',
    ];
    for (const type of videoTypes) {
      if (window.MediaRecorder && window.MediaRecorder.isTypeSupported(type)) {
        setVideoMimeType(type);
        setVideoExtension(type.includes('matroska') ? 'mkv' : 'webm');
        break;
      }
    }
  };

  // 检查录制状态
  const checkRecordingStatus = () => {
    chrome.runtime.sendMessage({ action: 'isRecording' }, (response) => {
      if (response && response.isRecording) {
        setIsRecording(true);
        startTimer();
        setStatus('正在录制');
        setStatusClass('status-recording');
      }
    });
  };

  // 更新设置
  const handleSettingsChange = (key) => {
    return (e) => {
      const newSettings = { ...settings, [key]: e.target.checked };
      setSettings(newSettings);
      chrome.storage.local.set({ recordingSettings: newSettings });
    };
  };

  // 更新API配置
  const handleApiConfigChange = (key) => {
    return (e) => {
      const newConfig = { ...apiConfig, [key]: e.target.value };
      setApiConfig(newConfig);
      chrome.storage.local.set({ volcanoApiConfig: newConfig });
    };
  };

  // 更新AI API配置
  const handleAiConfigChange = (key) => {
    return (e) => {
      const newConfig = { ...aiConfig, [key]: e.target.value };
      setAiConfig(newConfig);
      chrome.storage.local.set({ aiApiConfig: newConfig });
    };
  };

  // 切换AI API启用状态
  const toggleAiEnabled = () => {
    const newConfig = { ...aiConfig, enabled: !aiConfig.enabled };
    setAiConfig(newConfig);
    chrome.storage.local.set({ aiApiConfig: newConfig });
  };

  // 格式化录制时间
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let timeString = '';
    if (hours > 0) {
      timeString += `${String(hours).padStart(2, '0')}:`;
    }
    timeString += `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return timeString;
  };

  // 定时器
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // 开始录制
  const startRecording = async () => {
    const { recordAudio, recordVideo } = settings;

    if (!recordAudio && !recordVideo) {
      alert('请至少选择录制音频或视频');
      return;
    }

    try {
      setStatus('请求录制权限...');
      setStatusClass('status-stopping');

      console.log('开始录制...');

      // 检查 API 是否支持
      if (!navigator.mediaDevices) {
        throw new Error('navigator.mediaDevices 未定义，请确保在 HTTPS 环境或扩展 popup 中运行');
      }
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error('浏览器不支持 getDisplayMedia，请使用最新版 Chrome 浏览器');
      }

      // 获取当前标签页 ID
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = currentTab.id;

      // 请求屏幕共享
      const displayMediaOptions = {
        video: recordVideo ? { cursor: 'always' } : false,
        audio: recordAudio,
      };

      console.log('请求屏幕共享，选项:', displayMediaOptions);
      const mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      mediaStreamRef.current = mediaStream;

      // 获取音频和视频轨道
      const audioTracks = mediaStream.getAudioTracks();
      const videoTracks = mediaStream.getVideoTracks();

      // 创建独立的音频和视频流
      if (audioTracks.length > 0) {
        audioStreamRef.current = new MediaStream([audioTracks[0]]);
      }
      if (videoTracks.length > 0) {
        videoStreamRef.current = new MediaStream([videoTracks[0]]);
      }

      // 清空缓冲区
      audioChunksRef.current = [];
      videoChunksRef.current = [];
      setHasAudioData(false);

      // 创建音频录制器
      if (audioStreamRef.current) {
        const audioOptions = audioMimeType ? { mimeType: audioMimeType } : undefined;
        const audioRecorder = new MediaRecorder(audioStreamRef.current, audioOptions);
        audioRecorderRef.current = audioRecorder;

        audioRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        audioRecorder.onerror = (error) => {
          console.error('音频录制错误:', error);
          stopRecording();
        };

        audioRecorder.start(100); // 每100ms收集一次数据
      }

      // 创建视频录制器
      if (videoStreamRef.current) {
        const videoOptions = videoMimeType ? { mimeType: videoMimeType } : undefined;
        const videoRecorder = new MediaRecorder(videoStreamRef.current, videoOptions);
        videoRecorderRef.current = videoRecorder;

        videoRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            videoChunksRef.current.push(event.data);
          }
        };

        videoRecorder.onerror = (error) => {
          console.error('视频录制错误:', error);
          stopRecording();
        };

        videoRecorder.start(100); // 每100ms收集一次数据
      }

      // 状态更新
      setIsRecording(true);
      setRecordingTime(0);
      startTimer();
      setStatus('正在录制');
      setStatusClass('status-recording');

      // 保存静音设置到 chrome.storage，供 content.js 读取
      chrome.storage.local.set({ mutePage: settings.mutePage });

      // 通知 background.js 录制已开始
      chrome.runtime.sendMessage({
        action: 'recordingStarted',
        tabId: tabId,
      });

      // 监听流结束事件
      const tracks = mediaStream.getTracks();
      tracks.forEach((track) => {
        track.onended = () => {
          if (isRecording) {
            stopRecording();
          }
        };
      });
    } catch (error) {
      console.error('录制失败:', error);
      alert('录制失败: ' + error.message);
      setStatus('录制失败');
      setStatusClass('status-stopped');
      setIsRecording(false);
    }
  };

  // 停止录制
  const stopRecording = () => {
    if (!isRecording) return;

    setIsRecording(false);
    stopTimer();
    setStatus('停止中...');
    setStatusClass('status-stopping');

    // 停止录制器
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop();
    }

    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoRecorderRef.current.stop();
    }

    // 等待录制器停止并保存文件
    setTimeout(() => {
      saveRecordings();
      // 停止流
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      mediaStreamRef.current = null;
      audioStreamRef.current = null;
      videoStreamRef.current = null;
      audioRecorderRef.current = null;
      videoRecorderRef.current = null;

      setStatus('录制已停止');
      setStatusClass('status-stopped');
      setRecordingTime(0);

      // 通知 background.js 录制已停止
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.runtime.sendMessage({
          action: 'recordingStopped',
          tabId: tabs[0].id,
        });
      });
    }, 1000);
  };

  // 保存录制
  const saveRecordings = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const { recordAudio, recordVideo } = settings;

    // 保存音频
    if (audioChunksRef.current.length > 0 && recordAudio) {
      const audioType = audioMimeType || 'audio/webm;codecs=opus';
      const audioBlob = new Blob(audioChunksRef.current, { type: audioType });
      saveBlob(audioBlob, `audio_${timestamp}.${audioExtension}`);
    }

    // 保存视频
    if (videoChunksRef.current.length > 0 && recordVideo) {
      const videoType = videoMimeType || 'video/webm;codecs=vp9';
      const videoBlob = new Blob(videoChunksRef.current, { type: videoType });
      saveBlob(videoBlob, `video_${timestamp}.${videoExtension}`);
    }

    // 【重要修改】保留缓冲区，不立即清空
    // 这样停止录制后，audioChunksRef.current 仍然包含数据
    // 用户可以点击音频转文字按钮进行转录
    // 如果用户再次开始录制，startRecording 函数会在开始前清空缓冲区

    // 更新音频数据状态，启用音频转文字按钮
    if (audioChunksRef.current.length > 0 && recordAudio) {
      setHasAudioData(true);
    }
  };

  // 保存 Blob 文件
  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);

    if (chrome.downloads) {
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false,
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('下载失败:', chrome.runtime.lastError);
          fallbackDownload(url, filename);
        }
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    } else {
      fallbackDownload(url, filename);
    }
  };

  // 降级下载方法
  const fallbackDownload = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // 音频转文字（使用阿里百炼Qwen ASR模型 - 异步任务方式）
  const transcribeAudio = async () => {
    if (!aiConfig.enabled || !aiConfig.apiKey) {
      alert('请先在设置中启用AI功能并配置API Key');
      return;
    }

    if (audioChunksRef.current.length === 0) {
      alert('没有可用的音频数据，请先录制音频');
      return;
    }

    setTranscribing(true);
    setTranscriptResult('');

    try {
      // 将音频转换为WAV格式
      const audioBlob = new Blob(audioChunksRef.current, {
        type: 'audio/webm',
      });

      // 步骤1：上传音频文件到百炼服务器
      const uploadFormData = new FormData();
      uploadFormData.append('file', audioBlob, 'audio.webm');
      uploadFormData.append('purpose', 'file-extract');

      const uploadResponse = await fetch(`${aiConfig.baseUrl}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text();
        throw new Error(`文件上传失败: ${uploadResponse.status} - ${errorData}`);
      }

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.id;

      // 步骤2：创建异步转录任务
      const taskResponse = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: aiConfig.modelId || 'qwen3-asr-flash-filetrans',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '请转录这段音频'
                }
              ]
            }
          ],
          input: {
            file: fileId
          }
        }),
      });

      if (!taskResponse.ok) {
        const errorData = await taskResponse.text();
        throw new Error(`创建任务失败: ${taskResponse.status} - ${errorData}`);
      }

      const taskData = await taskResponse.json();
      const taskId = taskData.output?.task_id;

      if (!taskId) {
        throw new Error('未能获取任务ID');
      }

      // 步骤3：轮询查询任务结果
      let taskResult = null;
      let retryCount = 0;
      const maxRetries = 60; // 最多轮询60次，每次2秒，总共2分钟

      while (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒

        const queryResponse = await fetch(`${aiConfig.baseUrl}/tasks/${taskId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${aiConfig.apiKey}`,
          },
        });

        if (!queryResponse.ok) {
          const errorData = await queryResponse.text();
          console.error(`查询任务失败: ${queryResponse.status} - ${errorData}`);
          retryCount++;
          continue;
        }

        const queryData = await queryResponse.json();
        const taskStatus = queryData.output?.task_status;

        if (taskStatus === 'SUCCEEDED') {
          taskResult = queryData.output?.results?.[0]?.text || queryData.output?.text;
          break;
        } else if (taskStatus === 'FAILED') {
          throw new Error(`任务执行失败: ${queryData.output?.message || '未知错误'}`);
        }

        // 任务还在进行中，继续轮询
        retryCount++;
      }

      if (taskResult) {
        setTranscriptResult(taskResult);
      } else {
        throw new Error('任务超时或未能获取识别结果');
      }
    } catch (error) {
      console.error('转录失败:', error);
      alert(`转录失败: ${error.message}\n\n请参考文档：https://help.aliyun.com/model-studio/developer-reference/error-code`);
    } finally {
      setTranscribing(false);
    }
  };

  // 内容总结（OpenAI兼容模式）
  const summarizeContent = async () => {
    if (!aiConfig.enabled || !aiConfig.apiKey) {
      alert('请先在设置中启用AI功能并配置API Key');
      return;
    }

    const textToSummarize = transcriptResult;
    if (!textToSummarize) {
      alert('请先进行音频转录');
      return;
    }

    setSummarizing(true);
    setSummaryResult('');

    try {
      // 使用OpenAI兼容模式调用大模型API
      const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.modelId || 'qwen-plus',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的内容总结助手，请用简洁明了的语言总结以下内容，提取关键要点。',
            },
            {
              role: 'user',
              content: `请总结以下内容：\n\n${textToSummarize}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content || '无法生成总结';
      setSummaryResult(summary);
    } catch (error) {
      console.error('总结失败:', error);
      alert(`总结失败: ${error.message}\n\n请参考文档：https://help.aliyun.com/model-studio/developer-reference/error-code`);
    } finally {
      setSummarizing(false);
    }
  };

  // Blob 转 Base64
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result;
        // 移除 data:audio/webm;base64, 前缀
        const base64WithoutPrefix = base64data.split(',')[1];
        resolve(base64WithoutPrefix);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="container">
      <h1>直播录制插件</h1>

      <div className="control-group">
        <button
          id="startBtn"
          className="btn btn-start"
          onClick={startRecording}
          disabled={isRecording}
        >
          开始录制
        </button>
        <button
          id="stopBtn"
          className="btn btn-stop"
          onClick={stopRecording}
          disabled={!isRecording}
        >
          停止录制
        </button>
      </div>

      <div id="status" className={`status ${statusClass}`}>
        {status}
      </div>

      <div className="settings">
        <div className="setting-item">
          <label for="recordAudio">录制音频</label>
          <input
            type="checkbox"
            id="recordAudio"
            checked={settings.recordAudio}
            onChange={handleSettingsChange('recordAudio')}
            disabled={isRecording}
          />
        </div>
        <div className="setting-item">
          <label for="recordVideo">录制视频</label>
          <input
            type="checkbox"
            id="recordVideo"
            checked={settings.recordVideo}
            onChange={handleSettingsChange('recordVideo')}
            disabled={isRecording}
          />
        </div>
        <div className="setting-item">
          <label for="mutePage">页面静音</label>
          <input
            type="checkbox"
            id="mutePage"
            checked={settings.mutePage}
            onChange={handleSettingsChange('mutePage')}
            disabled={isRecording}
          />
        </div>
      </div>

      <div className="recording-info" id="recordingInfo">
        {recordingTime > 0 && isRecording && `录制时间: ${formatTime(recordingTime)}`}
      </div>

      {/* AI API配置（OpenAI兼容模式） */}
      <div className="api-config">
        <div className="setting-item">
          <label for="aiEnabled">启用AI功能</label>
          <input
            type="checkbox"
            id="aiEnabled"
            checked={aiConfig.enabled}
            onChange={toggleAiEnabled}
          />
        </div>
        {aiConfig.enabled && (
          <>
            <div className="api-config-item">
              <label for="aiApiKey" style={{ fontSize: '11px', display: 'block', marginBottom: '5px' }}>
                API Key:
              </label>
              <input
                type="password"
                id="aiApiKey"
                value={aiConfig.apiKey}
                onChange={handleAiConfigChange('apiKey')}
                placeholder="输入API Key (sk-xxx)"
                style={{
                  width: '100%',
                  fontSize: '11px',
                  padding: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div className="api-config-item">
              <label for="aiBaseUrl" style={{ fontSize: '11px', display: 'block', marginBottom: '5px' }}>
                API 地址:
              </label>
              <input
                type="text"
                id="aiBaseUrl"
                value={aiConfig.baseUrl}
                onChange={handleAiConfigChange('baseUrl')}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                style={{
                  width: '100%',
                  fontSize: '11px',
                  padding: '4px',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: '9px', color: '#888', marginTop: '3px' }}>
                阿里百炼: dashscope.aliyuncs.com | 火山方舟: ark.cn-beijing.volces.com/api/v3
              </p>
            </div>
            <div className="api-config-item">
              <label for="aiModelId" style={{ fontSize: '11px', display: 'block', marginBottom: '5px' }}>
                模型ID:
              </label>
              <input
                type="text"
                id="aiModelId"
                value={aiConfig.modelId}
                onChange={handleAiConfigChange('modelId')}
                placeholder="qwen-plus"
                style={{
                  width: '100%',
                  fontSize: '11px',
                  padding: '4px',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: '9px', color: '#888', marginTop: '3px' }}>
                语音识别: qwen3-asr-flash-filetrans | 大模型: qwen-plus, qwen-max
              </p>
            </div>
          </>
        )}
      </div>

      {/* AI功能按钮 */}
      {aiConfig.enabled && (
        <div className="control-group">
          <button
            className="btn btn-transcribe"
            onClick={transcribeAudio}
            disabled={transcribing || !hasAudioData}
            style={{
              backgroundColor: '#2196F3',
              color: 'white',
              marginBottom: '8px',
              fontSize: '12px',
              padding: '8px',
            }}
          >
            {transcribing ? '转录中...' : '音频转文字'}
          </button>
          <button
            className="btn btn-summarize"
            onClick={summarizeContent}
            disabled={summarizing || !transcriptResult}
            style={{
              backgroundColor: '#9C27B0',
              color: 'white',
              fontSize: '12px',
              padding: '8px',
            }}
          >
            {summarizing ? '总结中...' : '内容总结'}
          </button>
        </div>
      )}

      {/* 转录和总结结果 */}
      {transcriptResult && (
        <div className="transcript-result">
          <h4 style={{ fontSize: '12px', marginBottom: '5px', color: '#333' }}>
            音频转录：
          </h4>
          <div
            style={{
              fontSize: '11px',
              color: '#555',
              backgroundColor: '#f9f9f9',
              padding: '8px',
              borderRadius: '4px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {transcriptResult}
          </div>
        </div>
      )}

      {summaryResult && (
        <div className="summary-result">
          <h4 style={{ fontSize: '12px', marginBottom: '5px', color: '#333' }}>
            内容总结：
          </h4>
          <div
            style={{
              fontSize: '11px',
              color: '#555',
              backgroundColor: '#f0f8ff',
              padding: '8px',
              borderRadius: '4px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            {summaryResult}
          </div>
        </div>
      )}

      <div className="format-info">
        <p>
          <strong>格式说明:</strong>
        </p>
        <p style={{ fontSize: '10px', marginTop: '5px' }}>
          浏览器原生不支持 MP4 和 MP3 格式（专利格式），
          默认使用 WebM (VP9/Opus) 高画质格式。
          如果需要其他格式，请使用转换工具。
        </p>
        {aiConfig.enabled && (
          <p style={{ fontSize: '10px', marginTop: '5px' }}>
            <strong>API说明:</strong> 使用OpenAI兼容模式调用大模型API实现音频转文字和内容总结。
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
