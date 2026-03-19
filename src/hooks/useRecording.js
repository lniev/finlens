import { useState, useRef, useCallback, useEffect } from "react";

/**
 * 录屏 Hook - 使用 Offscreen Documents API
 * 录屏逻辑实际在 Offscreen Document 中执行，避免 Service Worker 被关闭
 */
export const useRecording = (settings, mediaFormats) => {
	const [isRecording, setIsRecording] = useState(false);
	const [recordingTime, setRecordingTime] = useState(0);
	const [status, setStatus] = useState("未录制");
	const [statusClass, setStatusClass] = useState("status-stopped");
	const [hasAudioData, setHasAudioData] = useState(false);
	const [recordedFiles, setRecordedFiles] = useState(null);
	const [showSaveDialog, setShowSaveDialog] = useState(false);

	const timerRef = useRef(null);
	const recordingSettingsRef = useRef(settings);
	const heartbeatIntervalRef = useRef(null);

	// 更新设置引用
	useEffect(() => {
		recordingSettingsRef.current = settings;
	}, [settings]);

	// 定时器
	const startTimer = useCallback(() => {
		timerRef.current = setInterval(() => {
			setRecordingTime(prev => prev + 1);
		}, 1000);
	}, []);

	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	// 开始录制 - 通过 Service Worker 调用 Offscreen Document
	const startRecording = useCallback(async () => {
		const currentSettings = recordingSettingsRef.current;
		const { recordAudio, recordVideo } = currentSettings;

		if (!recordAudio && !recordVideo) {
			alert("请至少选择录制音频或视频");
			return;
		}

		try {
			setStatus("请求录制权限...");
			setStatusClass("status-stopping");

			// 获取当前标签页 ID
			let tabId = null;
			if (typeof chrome !== "undefined" && chrome.tabs) {
				const [currentTab] = await chrome.tabs.query({
					active: true,
					currentWindow: true,
				});
				tabId = currentTab?.id;
			}

			// 发送开始录制消息给 Service Worker
			const response = await new Promise((resolve) => {
				chrome.runtime.sendMessage({
					action: "startRecording",
					tabId: tabId,
					settings: {
						recordAudio,
						recordVideo,
						mutePage: currentSettings.mutePage,
					},
				}, (response) => {
					if (chrome.runtime.lastError) {
						console.error("开始录制失败:", chrome.runtime.lastError);
						resolve({ success: false, error: chrome.runtime.lastError.message });
					} else {
						resolve(response || { success: true });
					}
				});
			});

			if (!response.success) {
				throw new Error(response.error || "开始录制失败");
			}

			// 状态更新
			setIsRecording(true);
			setRecordingTime(0);
			startTimer();
			setStatus("正在录制");
			setStatusClass("status-recording");

			// 保存静音设置到 chrome.storage
			if (typeof chrome !== "undefined" && chrome.storage) {
				chrome.storage.local.set({ mutePage: currentSettings.mutePage });
			}

			console.log("[useRecording] 录制已开始");

		} catch (error) {
			console.error("录制失败:", error);
			alert("录制失败: " + error.message);
			setStatus("录制失败");
			setStatusClass("status-stopped");
			setIsRecording(false);
		}
	}, [startTimer]);

	// 停止录制
	const stopRecording = useCallback(async () => {
		if (!isRecording) return;

		setIsRecording(false);
		stopTimer();
		setStatus("停止中...");
		setStatusClass("status-stopping");

		try {
			// 获取当前标签页 ID
			let tabId = null;
			if (typeof chrome !== "undefined" && chrome.tabs) {
				const [currentTab] = await chrome.tabs.query({
					active: true,
					currentWindow: true,
				});
				tabId = currentTab?.id;
			}

			// 发送停止录制消息给 Service Worker
			const response = await new Promise((resolve) => {
				chrome.runtime.sendMessage({
					action: "stopRecording",
					tabId: tabId,
				}, (response) => {
					if (chrome.runtime.lastError) {
						console.error("停止录制失败:", chrome.runtime.lastError);
						resolve({ success: false, error: chrome.runtime.lastError.message });
					} else {
						resolve(response || { success: true });
					}
				});
			});

			if (!response.success) {
				throw new Error(response.error || "停止录制失败");
			}

			console.log("[useRecording] 录制已停止，结果:", response.result);

			// 处理录制结果
			if (response.result) {
				const result = response.result;

				// 更新音频数据状态
				if (result.hasAudioData && recordingSettingsRef.current.recordAudio) {
					setHasAudioData(true);
				}

				// 准备文件数据
				const files = {
					audio: result.audio,
					video: result.video,
					audioMimeType: result.audioMimeType,
					videoMimeType: result.videoMimeType,
					hasAudioData: result.hasAudioData,
					hasVideoData: result.hasVideoData,
				};

				setRecordedFiles(files);
				setShowSaveDialog(true);
			}

			setStatus("录制完成，等待保存");
			setStatusClass("status-stopped");

		} catch (error) {
			console.error("停止录制失败:", error);
			alert("停止录制失败: " + error.message);
			setStatus("停止失败");
			setStatusClass("status-stopped");
		}
	}, [isRecording, stopTimer]);

	// 处理保存文件 - 通过 Offscreen Document 直接下载
	const handleSaveFiles = useCallback(async (fileName, action) => {
		if (!recordedFiles) return { success: false, error: '没有录制文件' };

		if (action === "download") {
			setStatus("正在保存文件...");

			try {
				// 发送下载请求给 Service Worker，由 Offscreen 处理
				const response = await new Promise((resolve) => {
					chrome.runtime.sendMessage({
						action: "downloadRecording",
						fileName: fileName,
					}, (response) => {
						if (chrome.runtime.lastError) {
							console.error("下载失败:", chrome.runtime.lastError);
							resolve({ success: false, error: chrome.runtime.lastError.message });
						} else {
							resolve(response || { success: true });
						}
					});
				});

				if (response.success) {
					setStatus("文件已下载到本地");
					console.log("[useRecording] 文件下载完成:", response.downloads);
					return { success: true, downloads: response.downloads };
				} else {
					setStatus("文件保存失败: " + (response.error || "未知错误"));
					return { success: false, error: response.error };
				}
			} catch (error) {
				console.error("保存文件失败:", error);
				setStatus("文件保存失败");
				return { success: false, error: error.message };
			}
		}

		// 关闭对话框
		setShowSaveDialog(false);

		// 清除录制结果
		chrome.runtime.sendMessage({ action: "clearRecordingResult" });
		return { success: true };
	}, [recordedFiles]);

	// 取消保存
	const cancelSave = useCallback(() => {
		setShowSaveDialog(false);
		setRecordedFiles(null);
		setStatus("录制已取消");

		// 清除录制结果
		chrome.runtime.sendMessage({ action: "clearRecordingResult" });
	}, []);

	// 检查录制状态
	const checkRecordingStatus = useCallback(() => {
		if (typeof chrome !== "undefined" && chrome.runtime) {
			chrome.runtime.sendMessage({ action: "isRecording" }, response => {
				if (response && response.isRecording) {
					setIsRecording(true);
					startTimer();
					setStatus("正在录制");
					setStatusClass("status-recording");
				}
			});
		}
	}, [startTimer]);

	// 清理函数
	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
			if (heartbeatIntervalRef.current) {
				clearInterval(heartbeatIntervalRef.current);
			}
		};
	}, []);

	return {
		isRecording,
		recordingTime,
		status,
		statusClass,
		hasAudioData,
		showSaveDialog,
		recordedFiles,
		setRecordedFiles,
		setShowSaveDialog,
		startRecording,
		stopRecording,
		handleSaveFiles,
		cancelSave,
		checkRecordingStatus,
	};
};
