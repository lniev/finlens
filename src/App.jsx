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

  // 火山方舟API配置
  const [apiConfig, setApiConfig] = useState({
    apiKey: '',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelId: '',
    enabled: false,
  });

  // 转录和总结状态
  const [transcribing, setTranscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState('');
  const [summaryResult, setSummaryResult] = useState('');

  useEffect(() => {
    // 加载存储的设置
    chrome.storage.local.get(['recordingSettings', 'volcanoApiConfig'], (result) => {
      const defaultSettings = {
        recordAudio: true,
        recordVideo: true,
        mutePage: true,
      };
      const savedSettings = result.recordingSettings || defaultSettings;
      setSettings(savedSettings);

      // 加载 API 配置
      if (result.volcanoApiConfig) {
        setApiConfig(result.volcanoApiConfig);
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

  // 切换API启用状态
  const toggleApiEnabled = () => {
    const newConfig = { ...apiConfig, enabled: !apiConfig.enabled };
    setApiConfig(newConfig);
    chrome.storage.local.set({ volcanoApiConfig: newConfig });
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

  // 音频转文字（火山方舟API）
  const transcribeAudio = async () => {
    if (!apiConfig.enabled || !apiConfig.apiKey) {
      alert('请先在设置中启用火山方舟API并配置API Key');
      return;
    }

    if (audioChunksRef.current.length === 0) {
      alert('没有可用的音频数据，请先录制音频');
      return;
    }

    setTranscribing(true);
    setTranscriptResult('');

    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: audioMimeType || 'audio/webm;codecs=opus',
      });

      // 转换为 base64
      const base64Audio = await blobToBase64(audioBlob);

      // 调用火山方舟语音识别API
      // 这里使用火山方舟兼容的API格式
      const response = await fetch(`${apiConfig.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.modelId || 'speech-1',
          file: base64Audio,
          language: 'zh',
          response_format: 'text',
        }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const result = await response.text();
      setTranscriptResult(result);
    } catch (error) {
      console.error('转录失败:', error);
      alert(`转录失败: ${error.message}\n\n注意：请确认火山方舟API地址和模型ID配置正确。`);
    } finally {
      setTranscribing(false);
    }
  };

  // 内容总结（火山方舟大模型）
  const summarizeContent = async () => {
    if (!apiConfig.enabled || !apiConfig.apiKey) {
      alert('请先在设置中启用火山方舟API并配置API Key');
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
      // 调用火山方舟大模型API
      const response = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.modelId || 'ep-20241203184342-xxxxx',
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
      alert(`总结失败: ${error.message}\n\n注意：请确认火山方舟API地址和模型ID配置正确。`);
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

      {/* 火山方舟API配置 */}
      <div className="api-config">
        <div className="setting-item">
          <label for="apiEnabled">启用AI转录和总结</label>
          <input
            type="checkbox"
            id="apiEnabled"
            checked={apiConfig.enabled}
            onChange={toggleApiEnabled}
          />
        </div>
        {apiConfig.enabled && (
          <>
            <div className="api-config-item">
              <label for="apiKey" style={{ fontSize: '11px', display: 'block', marginBottom: '5px' }}>
                API Key:
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiConfig.apiKey}
                onChange={handleApiConfigChange('apiKey')}
                placeholder="输入火山方舟API Key"
                style={{
                  width: '100%',
                  fontSize: '11px',
                  padding: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div className="api-config-item">
              <label for="baseUrl" style={{ fontSize: '11px', display: 'block', marginBottom: '5px' }}>
                API 地址:
              </label>
              <input
                type="text"
                id="baseUrl"
                value={apiConfig.baseUrl}
                onChange={handleApiConfigChange('baseUrl')}
                placeholder="API地址"
                style={{
                  width: '100%',
                  fontSize: '11px',
                  padding: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div className="api-config-item">
              <label for="modelId" style={{ fontSize: '11px', display: 'block', marginBottom: '5px' }}>
                模型ID:
              </label>
              <input
                type="text"
                id="modelId"
                value={apiConfig.modelId}
                onChange={handleApiConfigChange('modelId')}
                placeholder="输入模型ID（可选）"
                style={{
                  width: '100%',
                  fontSize: '11px',
                  padding: '4px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* AI功能按钮 */}
      {apiConfig.enabled && (
        <div className="control-group">
          <button
            className="btn btn-transcribe"
            onClick={transcribeAudio}
            disabled={transcribing || audioChunksRef.current.length === 0}
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
        {apiConfig.enabled && (
          <p style={{ fontSize: '10px', marginTop: '5px' }}>
            <strong>API说明:</strong> 使用火山方舟API实现音频转文字和内容总结。
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
