/**
 * Service Worker - 后台脚本
 * 使用 Offscreen Documents API 实现长时间录屏
 * Chrome 109+ 支持
 */

let isRecording = false;
let currentTabId = null;
let recordingState = {};
let offscreenDocumentPath = 'offscreen.html';
let recordingResult = null; // 存储录制结果
let hasUnsavedRecording = false; // 标记是否有未保存的录制

// 检查浏览器是否支持 Offscreen Documents API
function isOffscreenSupported() {
    return typeof chrome !== 'undefined' &&
           chrome.offscreen &&
           typeof chrome.offscreen.createDocument === 'function';
}

// 检查 Offscreen Document 是否存在
async function hasOffscreenDocument() {
    try {
        // 检查是否支持 getContexts API (Chrome 116+)
        if (chrome.runtime.getContexts) {
            const existingContexts = await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT'],
                documentUrls: [chrome.runtime.getURL(offscreenDocumentPath)]
            });
            return existingContexts.length > 0;
        }
        // 旧版本使用其他方式检查
        return false;
    } catch (error) {
        console.error('[Background] 检查 Offscreen Document 失败:', error);
        return false;
    }
}

// 创建 Offscreen Document
async function createOffscreenDocument() {
    if (!isOffscreenSupported()) {
        throw new Error('浏览器不支持 Offscreen Documents API，请使用 Chrome 109+');
    }

    const hasDocument = await hasOffscreenDocument();
    if (hasDocument) {
        console.log('[Background] Offscreen Document 已存在');
        return;
    }

    console.log('[Background] 创建 Offscreen Document...');
    try {
        await chrome.offscreen.createDocument({
            url: offscreenDocumentPath,
            reasons: ['USER_MEDIA'], // 使用媒体设备
            justification: '录制屏幕需要持续运行，避免 Service Worker 被关闭'
        });
        console.log('[Background] Offscreen Document 创建成功');
    } catch (error) {
        console.error('[Background] 创建 Offscreen Document 失败:', error);
        throw error;
    }
}

// 关闭 Offscreen Document
async function closeOffscreenDocument() {
    if (!isOffscreenSupported()) {
        return;
    }

    const hasDocument = await hasOffscreenDocument();
    if (!hasDocument) {
        return;
    }

    console.log('[Background] 关闭 Offscreen Document...');
    try {
        await chrome.offscreen.closeDocument();
        console.log('[Background] Offscreen Document 已关闭');
    } catch (error) {
        console.error('[Background] 关闭 Offscreen Document 失败:', error);
    }
}

// 发送消息到 Offscreen Document
async function sendMessageToOffscreen(message) {
    const hasDocument = await hasOffscreenDocument();
    if (!hasDocument) {
        console.error('[Background] Offscreen Document 不存在');
        return { success: false, error: 'Offscreen Document 不存在' };
    }

    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            target: 'offscreen',
            ...message
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Background] 发送消息到 Offscreen 失败:', chrome.runtime.lastError);
                resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
                resolve(response || { success: true });
            }
        });
    });
}

// 处理录制开始
async function handleRecordingStarted(tabId, settings) {
    console.log('[Background] 处理录制开始, tabId:', tabId);

    // 检查是否支持 Offscreen API
    if (!isOffscreenSupported()) {
        return {
            success: false,
            error: '浏览器不支持 Offscreen Documents API，请使用 Chrome 109 或更高版本'
        };
    }

    isRecording = true;
    currentTabId = tabId;
    recordingResult = null;
    hasUnsavedRecording = false;

    try {
        // 创建 Offscreen Document
        await createOffscreenDocument();

        // 发送开始录制命令到 Offscreen
        const response = await sendMessageToOffscreen({
            action: 'startRecording',
            settings: settings
        });

        if (!response.success) {
            throw new Error(response.error || '开始录制失败');
        }

        // 通知 content script
        if (tabId) {
            chrome.tabs.sendMessage(tabId, { action: 'recordingStarted' }).catch(() => {
                // 忽略错误
            });
        }

        console.log('[Background] 录制已开始');
        return { success: true };
    } catch (error) {
        console.error('[Background] 开始录制失败:', error);
        isRecording = false;
        currentTabId = null;
        return { success: false, error: error.message };
    }
}

// 处理录制停止
async function handleRecordingStopped(tabId) {
    console.log('[Background] 处理录制停止, tabId:', tabId);

    if (!isRecording) {
        console.log('[Background] 未在录制中');
        return { success: false, error: '未在录制中' };
    }

    try {
        // 发送停止录制命令到 Offscreen
        const response = await sendMessageToOffscreen({
            action: 'stopRecording'
        });

        if (!response.success) {
            throw new Error(response.error || '停止录制失败');
        }

        // 保存录制结果
        recordingResult = response.result;
        hasUnsavedRecording = true; // 标记有未保存的录制

        // 通知 content script
        if (tabId) {
            chrome.tabs.sendMessage(tabId, { action: 'recordingStopped' }).catch(() => {
                // 忽略错误
            });
        }

        console.log('[Background] 录制已停止，等待用户保存...');
        return { success: true, result: response.result };
    } catch (error) {
        console.error('[Background] 停止录制失败:', error);
        return { success: false, error: error.message };
    } finally {
        isRecording = false;
        currentTabId = null;
    }
}

// 处理文件下载
async function handleDownloadFile(url, filename) {
    return new Promise((resolve) => {
        chrome.downloads.download(
            {
                url: url,
                filename: filename,
                saveAs: false,
            },
            downloadId => {
                if (chrome.runtime.lastError) {
                    console.error('[Background] 下载失败:', chrome.runtime.lastError);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    // 监听下载状态变化
                    const onChanged = (delta) => {
                        if (delta.id === downloadId && delta.state?.current === "complete") {
                            chrome.downloads.onChanged.removeListener(onChanged);
                            chrome.downloads.search({ id: downloadId }, results => {
                                if (results && results.length > 0) {
                                    resolve({
                                        success: true,
                                        filename: filename,
                                        path: results[0].filename,
                                        downloadId: downloadId,
                                    });
                                } else {
                                    resolve({ success: true, filename: filename });
                                }
                            });
                        }
                    };
                    chrome.downloads.onChanged.addListener(onChanged);

                    // 超时处理
                    setTimeout(() => {
                        chrome.downloads.onChanged.removeListener(onChanged);
                        resolve({ success: true, filename: filename, downloadId: downloadId });
                    }, 5000);
                }
            }
        );
    });
}

// 监听来自 popup/content/offscreen 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] 收到消息:', request.action, '来自:', sender.tab ? 'content' : 'popup/offscreen');

    switch (request.action) {
        // 来自 popup 的消息
        case 'startRecording':
            handleRecordingStarted(request.tabId, request.settings)
                .then(response => sendResponse(response))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'stopRecording':
            handleRecordingStopped(request.tabId)
                .then(response => sendResponse(response))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'updateRecordingState':
            isRecording = request.isRecording;
            currentTabId = request.tabId;
            recordingState = request.state || {};
            sendResponse({ success: true });
            return false;

        case 'isRecording':
            sendResponse({
                isRecording,
                tabId: currentTabId,
                state: recordingState,
                result: recordingResult,
                hasUnsavedRecording
            });
            return false;

        case 'getRecordingResult':
            // 转发给 Offscreen 获取结果
            sendMessageToOffscreen({ action: 'getRecordingResult' })
                .then(response => sendResponse(response))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'clearRecordingResult':
            recordingResult = null;
            hasUnsavedRecording = false;
            // 用户已保存或取消，可以关闭 Offscreen Document 了
            closeOffscreenDocument();
            sendMessageToOffscreen({ action: 'clearRecordingResult' })
                .then(() => sendResponse({ success: true }))
                .catch(() => sendResponse({ success: true }));
            return true;

        case 'downloadRecording':
            // 转发下载请求给 Offscreen
            sendMessageToOffscreen({
                action: 'downloadRecording',
                fileName: request.fileName
            })
                .then(response => {
                    // 下载完成后，标记为已保存
                    if (response.success) {
                        hasUnsavedRecording = false;
                    }
                    sendResponse(response);
                })
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        // 来自 Offscreen 的消息
        case 'offscreenReady':
            console.log('[Background] Offscreen Document 已就绪');
            sendResponse({ success: true });
            return false;

        case 'offscreenHeartbeat':
            // 收到 Offscreen 的心跳，保持 Service Worker 活跃
            sendResponse({ success: true });
            return false;

        case 'offscreenRecordingStarted':
            console.log('[Background] Offscreen 报告录制已开始');
            isRecording = true;
            sendResponse({ success: true });
            return false;

        case 'offscreenRecordingStopped':
            console.log('[Background] Offscreen 报告录制已停止');
            isRecording = false;
            recordingResult = request.result;
            hasUnsavedRecording = true;
            // 不要在这里关闭 Offscreen Document，等待用户保存后再关闭
            sendResponse({ success: true });
            return false;

        case 'downloadFile':
            // 处理来自 Offscreen 的下载请求
            handleDownloadFile(request.url, request.filename)
                .then(response => sendResponse(response))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        default:
            sendResponse({ success: false, error: '未知操作' });
            return false;
    }
});

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === currentTabId && isRecording) {
        console.log('[Background] 录制中的标签页被关闭，停止录制');
        handleRecordingStopped(tabId).catch(error => {
            console.error('[Background] 标签页关闭时停止录制失败:', error);
        });
    }
});

// 监听扩展安装/更新事件
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] 扩展已安装/更新');
});

// 保持 Service Worker 活跃 - 定期自唤醒
if (chrome.alarms) {
    chrome.alarms.create('keepAlive', { periodInMinutes: 4.5 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'keepAlive') {
            console.log('[Background] 保活闹钟触发');
            // 如果正在录制或有未保存的录制，确保 Offscreen Document 存在
            if ((isRecording || hasUnsavedRecording) && isOffscreenSupported()) {
                createOffscreenDocument().catch(() => {});
            }
        }
    });
}

console.log('[Background] Service Worker 已加载');
console.log('[Background] Offscreen API 支持:', isOffscreenSupported());
