let isRecording = false;
let currentTabId = null;
let recordingState = {};

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'updateRecordingState':
            isRecording = request.isRecording;
            currentTabId = request.tabId;
            recordingState = request.state || {};
            sendResponse({ success: true });
            return true;
        case 'isRecording':
            sendResponse({ isRecording, tabId: currentTabId, state: recordingState });
            return true;
        case 'recordingStarted':
            handleRecordingStarted(request.tabId);
            sendResponse({ success: true });
            return true;
        case 'recordingStopped':
            handleRecordingStopped(request.tabId);
            sendResponse({ success: true });
            return true;
    }
});

// 处理录制开始
function handleRecordingStarted(tabId) {
    isRecording = true;
    currentTabId = tabId;
    // 通知content script
    if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'recordingStarted' }).catch(() => {
            // 忽略错误
        });
    }
}

// 处理录制停止
function handleRecordingStopped(tabId) {
    isRecording = false;
    // 通知content script
    if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'recordingStopped' }).catch(() => {
            // 忽略错误
        });
    }
    currentTabId = null;
    recordingState = {};
}