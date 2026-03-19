/**
 * Offscreen Document 录屏核心逻辑
 * 这个文件在隐藏的 Offscreen Document 中运行，可以持续执行不受 Service Worker 5分钟限制
 */

// 录制状态
let isRecording = false;
let recordingStartTime = null;
let recordingSettings = {};

// Media 相关引用
let mediaStream = null;
let audioStream = null;
let videoStream = null;
let audioRecorder = null;
let videoRecorder = null;

// 数据块
let audioChunks = [];
let videoChunks = [];

// 定时器
let heartbeatInterval = null;

// 录制结果存储
let lastRecordingResult = null;

// 检测浏览器支持的媒体格式
function detectMediaFormats() {
  const result = {
    audioMimeType: "",
    videoMimeType: "",
    audioExtension: "webm",
    videoExtension: "webm",
  };

  // 检测音频格式
  const audioTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of audioTypes) {
    if (window.MediaRecorder?.isTypeSupported(type)) {
      result.audioMimeType = type;
      result.audioExtension = type.includes("ogg") ? "ogg" : "webm";
      break;
    }
  }

  // 检测视频格式
  const videoTypes = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/x-matroska;codecs=av1",
    "video/x-matroska",
  ];
  for (const type of videoTypes) {
    if (window.MediaRecorder?.isTypeSupported(type)) {
      result.videoMimeType = type;
      result.videoExtension = type.includes("matroska") ? "mkv" : "webm";
      break;
    }
  }

  return result;
}

// 保存 Blob 到本地
async function saveBlob(blob, filename) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);

    chrome.runtime.sendMessage({
      action: 'downloadFile',
      url: url,
      filename: filename
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Offscreen] 下载失败:', chrome.runtime.lastError);
        // 使用备用下载方式
        fallbackDownload(url, filename);
        resolve({ success: true, filename: filename, path: null });
      } else {
        resolve(response || { success: true, filename: filename });
      }
      // 延迟释放 URL
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  });
}

// 备用下载方式
function fallbackDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 保活心跳 - 定期与 Service Worker 通信防止被关闭
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  heartbeatInterval = setInterval(() => {
    // 定期发送心跳消息给 Service Worker
    chrome.runtime.sendMessage({ 
      action: 'offscreenHeartbeat', 
      isRecording,
      recordingTime: recordingStartTime ? Date.now() - recordingStartTime : 0
    }).catch(() => {
      // Service Worker 可能被关闭，忽略错误
    });
  }, 20000); // 每20秒发送一次心跳
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// 开始录制
async function startRecording(settings) {
  if (isRecording) {
    console.log('[Offscreen] 已经在录制中');
    return { success: false, error: '已经在录制中' };
  }

  recordingSettings = settings || {};
  const { recordAudio, recordVideo } = recordingSettings;

  if (!recordAudio && !recordVideo) {
    return { success: false, error: '请至少选择录制音频或视频' };
  }

  try {
    console.log('[Offscreen] 开始录制，设置:', recordingSettings);

    // 请求屏幕共享
    const displayMediaOptions = {
      video: recordVideo ? { cursor: "always" } : false,
      audio: recordAudio,
    };

    mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

    // 获取音频和视频轨道
    const audioTracks = mediaStream.getAudioTracks();
    const videoTracks = mediaStream.getVideoTracks();

    // 创建独立的音频和视频流
    if (audioTracks.length > 0) {
      audioStream = new MediaStream([audioTracks[0]]);
    }
    if (videoTracks.length > 0) {
      videoStream = new MediaStream([videoTracks[0]]);
    }

    // 清空缓冲区
    audioChunks = [];
    videoChunks = [];

    const mediaFormats = detectMediaFormats();

    // 创建音频录制器
    if (audioStream) {
      const audioOptions = mediaFormats.audioMimeType
        ? { mimeType: mediaFormats.audioMimeType }
        : undefined;
      audioRecorder = new MediaRecorder(audioStream, audioOptions);

      audioRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      audioRecorder.onerror = error => {
        console.error('[Offscreen] 音频录制错误:', error);
        stopRecording();
      };

      audioRecorder.start(100);
    }

    // 创建视频录制器
    if (videoStream) {
      const videoOptions = mediaFormats.videoMimeType
        ? { mimeType: mediaFormats.videoMimeType }
        : undefined;
      videoRecorder = new MediaRecorder(videoStream, videoOptions);

      videoRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          videoChunks.push(event.data);
        }
      };

      videoRecorder.onerror = error => {
        console.error('[Offscreen] 视频录制错误:', error);
        stopRecording();
      };

      videoRecorder.start(100);
    }

    // 更新状态
    isRecording = true;
    recordingStartTime = Date.now();

    // 启动保活心跳
    startHeartbeat();

    // 监听流结束事件（用户点击停止共享）
    const tracks = mediaStream.getTracks();
    tracks.forEach(track => {
      track.onended = () => {
        if (isRecording) {
          console.log('[Offscreen] 用户停止屏幕共享，自动停止录制');
          stopRecording();
        }
      };
    });

    console.log('[Offscreen] 录制已开始');
    
    // 通知 Service Worker 录制已开始
    chrome.runtime.sendMessage({
      action: 'offscreenRecordingStarted',
      settings: recordingSettings
    }).catch(() => {});

    return { success: true };

  } catch (error) {
    console.error('[Offscreen] 开始录制失败:', error);
    cleanup();
    return { success: false, error: error.message };
  }
}

// 停止录制
async function stopRecording() {
  if (!isRecording) {
    return { success: false, error: '未在录制中' };
  }

  console.log('[Offscreen] 停止录制...');

  // 停止保活心跳
  stopHeartbeat();

  // 等待所有录制器停止
  const stopPromises = [];

  if (audioRecorder && audioRecorder.state !== "inactive") {
    const audioPromise = new Promise(resolve => {
      const originalOnStop = audioRecorder.onstop;
      audioRecorder.onstop = event => {
        if (originalOnStop) originalOnStop(event);
        resolve();
      };
      audioRecorder.stop();
    });
    stopPromises.push(audioPromise);
  }

  if (videoRecorder && videoRecorder.state !== "inactive") {
    const videoPromise = new Promise(resolve => {
      const originalOnStop = videoRecorder.onstop;
      videoRecorder.onstop = event => {
        if (originalOnStop) originalOnStop(event);
        resolve();
      };
      videoRecorder.stop();
    });
    stopPromises.push(videoPromise);
  }

  await Promise.all(stopPromises);

  console.log('[Offscreen] 所有录制器已停止');
  console.log('[Offscreen] 音频数据块数:', audioChunks.length);
  console.log('[Offscreen] 视频数据块数:', videoChunks.length);

  // 准备录制结果
  const mediaFormats = detectMediaFormats();
  const result = {
    audio: null,
    video: null,
    audioBlob: null,
    videoBlob: null,
    audioMimeType: null,
    videoMimeType: null,
  };

  // 准备音频 Blob
  if (audioChunks.length > 0 && recordingSettings.recordAudio) {
    const audioType = mediaFormats.audioMimeType || "audio/webm;codecs=opus";
    const audioBlob = new Blob(audioChunks, { type: audioType });
    const audioFileName = `audio_${Date.now()}.${mediaFormats.audioExtension}`;
    result.audio = audioFileName;
    result.audioBlob = audioBlob;
    result.audioMimeType = audioType;
    result.hasAudioData = true;
  }

  // 准备视频 Blob
  if (videoChunks.length > 0 && recordingSettings.recordVideo) {
    const videoType = mediaFormats.videoMimeType || "video/webm;codecs=vp9";
    const videoBlob = new Blob(videoChunks, { type: videoType });
    const videoFileName = `video_${Date.now()}.${mediaFormats.videoExtension}`;
    result.video = videoFileName;
    result.videoBlob = videoBlob;
    result.videoMimeType = videoType;
    result.hasVideoData = true;
  }

  // 保存录制结果
  lastRecordingResult = result;

  // 清理资源
  cleanup();

  // 通知 Service Worker 录制已停止
  chrome.runtime.sendMessage({
    action: 'offscreenRecordingStopped',
    result: {
      audio: result.audio,
      video: result.video,
      audioMimeType: result.audioMimeType,
      videoMimeType: result.videoMimeType,
      hasAudioData: result.hasAudioData,
      hasVideoData: result.hasVideoData,
    }
  }).catch(() => {});

  console.log('[Offscreen] 录制结果:', result);
  
  return { success: true, result };
}

// 下载录制的文件
async function downloadRecording(customFileName) {
  if (!lastRecordingResult) {
    return { success: false, error: '没有可下载的录制文件' };
  }

  const result = lastRecordingResult;
  const downloadResults = {
    audio: null,
    video: null,
  };

  try {
    // 下载音频文件
    if (result.audioBlob && result.audio) {
      const audioFileName = customFileName 
        ? `${customFileName}_audio.${result.audio.split('.').pop()}`
        : result.audio;
      downloadResults.audio = await saveBlob(result.audioBlob, audioFileName);
    }

    // 下载视频文件
    if (result.videoBlob && result.video) {
      const videoFileName = customFileName 
        ? `${customFileName}_video.${result.video.split('.').pop()}`
        : result.video;
      downloadResults.video = await saveBlob(result.videoBlob, videoFileName);
    }

    console.log('[Offscreen] 文件下载完成:', downloadResults);
    return { success: true, downloads: downloadResults };
  } catch (error) {
    console.error('[Offscreen] 下载文件失败:', error);
    return { success: false, error: error.message };
  }
}

// 清理资源
function cleanup() {
  isRecording = false;
  recordingStartTime = null;

  // 停止所有流
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }

  audioRecorder = null;
  videoRecorder = null;
  
  stopHeartbeat();
}

// 获取录制状态
function getRecordingStatus() {
  return {
    isRecording,
    recordingTime: recordingStartTime ? Date.now() - recordingStartTime : 0,
    settings: recordingSettings
  };
}

// 获取录制结果
function getRecordingResult() {
  if (!lastRecordingResult) {
    return null;
  }
  
  return {
    audio: lastRecordingResult.audio,
    video: lastRecordingResult.video,
    audioMimeType: lastRecordingResult.audioMimeType,
    videoMimeType: lastRecordingResult.videoMimeType,
    hasAudioData: lastRecordingResult.hasAudioData,
    hasVideoData: lastRecordingResult.hasVideoData,
  };
}

// 清除录制结果
function clearRecordingResult() {
  lastRecordingResult = null;
  audioChunks = [];
  videoChunks = [];
  return { success: true };
}

// 监听来自 Service Worker 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] 收到消息:', message.action);

  // 只处理发给 offscreen 的消息
  if (message.target !== 'offscreen') {
    return false;
  }

  switch (message.action) {
    case 'startRecording':
      startRecording(message.settings).then(response => {
        sendResponse(response);
      });
      return true; // 保持消息通道开放

    case 'stopRecording':
      stopRecording().then(response => {
        sendResponse(response);
      });
      return true;

    case 'downloadRecording':
      downloadRecording(message.fileName).then(response => {
        sendResponse(response);
      });
      return true;

    case 'getRecordingStatus':
      sendResponse({ success: true, status: getRecordingStatus() });
      return false;

    case 'getRecordingResult':
      sendResponse({ success: true, result: getRecordingResult() });
      return false;

    case 'clearRecordingResult':
      sendResponse(clearRecordingResult());
      return false;

    default:
      sendResponse({ success: false, error: '未知操作' });
      return false;
  }
});

// 页面加载完成后发送就绪消息
console.log('[Offscreen] Offscreen Document 已加载');
chrome.runtime.sendMessage({
  action: 'offscreenReady'
}).catch(() => {});
