let isPageMuted = false;
let mutationObserver = null;
let originalVolumeStore = new Map();

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'recordingStarted':
            handleRecordingStarted();
            break;
        case 'recordingStopped':
            handleRecordingStopped();
            break;
        case 'toggleMute':
            if (request.mute !== undefined) {
                if (request.mute) {
                    mutePage();
                } else {
                    unmutePage();
                }
            } else {
                togglePageMute();
            }
            break;
    }
});

// 处理录制开始
function handleRecordingStarted() {
    console.log('录制开始，检查静音设置');
    // 从chrome.storage获取设置（支持两种存储方式）
    chrome.storage.local.get(['mutePage', 'recordingSettings'], (result) => {
        let shouldMute = true;

        // 优先从 recordingSettings 读取（React版本）
        if (result.recordingSettings && result.recordingSettings.mutePage !== undefined) {
            shouldMute = result.recordingSettings.mutePage;
            console.log('从 recordingSettings 读取静音设置:', shouldMute);
        } else if (result.mutePage !== undefined) {
            // 其次从单独的 mutePage 读取（旧版本）
            shouldMute = result.mutePage !== false;
            console.log('从 mutePage 读取静音设置:', shouldMute);
        }

        if (shouldMute) {
            mutePage();
        }
    });
}

// 处理录制停止
function handleRecordingStopped() {
    console.log('录制停止，恢复原始音量');
    // 录制停止时恢复原始音量状态
    unmutePage();
}

// 静音页面
function mutePage() {
    if (isPageMuted) return;

    console.log('静音页面');

    // 保存原始音量并静音所有视频元素
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        originalVolumeStore.set(video, {
            muted: video.muted,
            volume: video.volume
        });
        video.muted = true;
    });

    // 保存原始音量并静音所有音频元素
    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => {
        originalVolumeStore.set(audio, {
            muted: audio.muted,
            volume: audio.volume
        });
        audio.muted = true;
    });

    // 如果已有观察器，先断开
    if (mutationObserver) {
        mutationObserver.disconnect();
    }

    // 监听新添加的媒体元素
    mutationObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                // 处理直接添加的媒体元素
                if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
                    if (!originalVolumeStore.has(node)) {
                        originalVolumeStore.set(node, {
                            muted: node.muted,
                            volume: node.volume
                        });
                    }
                    node.muted = true;
                }
                // 检查子节点中的媒体元素
                if (node.querySelectorAll) {
                    const newVideos = node.querySelectorAll('video');
                    newVideos.forEach(video => {
                        if (!originalVolumeStore.has(video)) {
                            originalVolumeStore.set(video, {
                                muted: video.muted,
                                volume: video.volume
                            });
                        }
                        video.muted = true;
                    });
                    const newAudios = node.querySelectorAll('audio');
                    newAudios.forEach(audio => {
                        if (!originalVolumeStore.has(audio)) {
                            originalVolumeStore.set(audio, {
                                muted: audio.muted,
                                volume: audio.volume
                            });
                        }
                        audio.muted = true;
                    });
                }
            });
        });
    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 监听媒体元素的音量变化，保持静音状态
    document.addEventListener('volumechange', handleVolumeChange, true);

    isPageMuted = true;
}

// 处理音量变化事件
function handleVolumeChange(event) {
    if (!isPageMuted) return;

    const target = event.target;
    if ((target.tagName === 'VIDEO' || target.tagName === 'AUDIO') && !target.muted) {
        console.log('阻止取消静音');
        target.muted = true;
    }
}

// 切换页面静音状态
function togglePageMute() {
    if (isPageMuted) {
        unmutePage();
    } else {
        mutePage();
    }
}

// 取消静音页面
function unmutePage() {
    if (!isPageMuted) return;

    console.log('取消静音页面');

    // 停止观察器
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }

    // 移除音量变化监听器
    document.removeEventListener('volumechange', handleVolumeChange, true);

    // 恢复原始音量状态
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        const original = originalVolumeStore.get(video);
        if (original) {
            video.muted = original.muted;
            video.volume = original.volume;
        }
    });

    const audios = document.querySelectorAll('audio');
    audios.forEach(audio => {
        const original = originalVolumeStore.get(audio);
        if (original) {
            audio.muted = original.muted;
            audio.volume = original.volume;
        }
    });

    // 清空存储
    originalVolumeStore.clear();
    isPageMuted = false;
}

// 页面加载时不自动静音 - 只有在开始录制时才静音
// 这样用户可以正常控制音量，直到开始录制

// 清理函数
window.addEventListener('beforeunload', () => {
    if (mutationObserver) {
        mutationObserver.disconnect();
    }
    document.removeEventListener('volumechange', handleVolumeChange, true);
});