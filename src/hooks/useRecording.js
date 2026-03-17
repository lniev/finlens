import { useState, useRef, useCallback } from "react";
import { saveBlob } from "../utils/media";

export const useRecording = (settings, mediaFormats, serverConfig) => {
	const [isRecording, setIsRecording] = useState(false);
	const [recordingTime, setRecordingTime] = useState(0);
	const [status, setStatus] = useState("未录制");
	const [statusClass, setStatusClass] = useState("status-stopped");
	const [hasAudioData, setHasAudioData] = useState(false);
	const [recordedFiles, setRecordedFiles] = useState(null);
	const [showSaveDialog, setShowSaveDialog] = useState(false);

	const timerRef = useRef(null);
	const mediaStreamRef = useRef(null);
	const audioRecorderRef = useRef(null);
	const videoRecorderRef = useRef(null);
	const audioChunksRef = useRef([]);
	const videoChunksRef = useRef([]);
	const audioStreamRef = useRef(null);
	const videoStreamRef = useRef(null);
	const fileNameRef = useRef("");

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

	// 准备录制文件数据
	const prepareRecordings = useCallback((customFileName) => {
		const { recordAudio, recordVideo } = settings;
		const files = {
			audio: null,
			video: null,
			audioBlob: null,
			videoBlob: null,
		};

		// 准备音频
		if (audioChunksRef.current.length > 0 && recordAudio) {
			const audioType = mediaFormats.audioMimeType || "audio/webm;codecs=opus";
			const audioBlob = new Blob(audioChunksRef.current, { type: audioType });
			const audioFileName = customFileName
				? `${customFileName}_audio.${mediaFormats.audioExtension}`
				: `audio_${Date.now()}.${mediaFormats.audioExtension}`;
			files.audio = audioFileName;
			files.audioBlob = audioBlob;
			files.audioMimeType = audioType;
		}

		// 准备视频
		if (videoChunksRef.current.length > 0 && recordVideo) {
			const videoType = mediaFormats.videoMimeType || "video/webm;codecs=vp9";
			const videoBlob = new Blob(videoChunksRef.current, { type: videoType });
			const videoFileName = customFileName
				? `${customFileName}_video.${mediaFormats.videoExtension}`
				: `video_${Date.now()}.${mediaFormats.videoExtension}`;
			files.video = videoFileName;
			files.videoBlob = videoBlob;
			files.videoMimeType = videoType;
		}

		return files;
	}, [settings, mediaFormats]);

	// 下载文件到本地，返回 Promise 包含下载路径
	const downloadFiles = useCallback(async (files) => {
		const results = {
			audio: null,
			video: null,
		};

		if (files.audioBlob && files.audio) {
			results.audio = await saveBlob(files.audioBlob, files.audio);
		}
		if (files.videoBlob && files.video) {
			results.video = await saveBlob(files.videoBlob, files.video);
		}

		return results;
	}, []);

	// 上传文件到服务器
	const uploadFiles = useCallback(async (files) => {
		if (!serverConfig?.enabled || !serverConfig?.url) {
			alert("请先配置服务器地址");
			return { success: false, message: "服务器未配置" };
		}

		const uploadResults = [];
		const uploadPromises = [];

		// 上传音频
		if (files.audioBlob && files.audio) {
			const audioFormData = new FormData();
			audioFormData.append("file", files.audioBlob, files.audio);
			audioFormData.append("filename", files.audio);

			const audioPromise = fetch(`${serverConfig.url}/upload`, {
				method: "POST",
				body: audioFormData,
			})
				.then(res => res.json())
				.then(data => {
					uploadResults.push({ type: "audio", ...data });
					return data;
				})
				.catch(err => {
					uploadResults.push({ type: "audio", success: false, error: err.message });
					throw err;
				});
			uploadPromises.push(audioPromise);
		}

		// 上传视频
		if (files.videoBlob && files.video) {
			const videoFormData = new FormData();
			videoFormData.append("file", files.videoBlob, files.video);
			videoFormData.append("filename", files.video);

			const videoPromise = fetch(`${serverConfig.url}/upload`, {
				method: "POST",
				body: videoFormData,
			})
				.then(res => res.json())
				.then(data => {
					uploadResults.push({ type: "video", ...data });
					return data;
				})
				.catch(err => {
					uploadResults.push({ type: "video", success: false, error: err.message });
					throw err;
				});
			uploadPromises.push(videoPromise);
		}

		try {
			await Promise.all(uploadPromises);
			return { success: true, results: uploadResults };
		} catch (error) {
			return { success: false, message: error.message, results: uploadResults };
		}
	}, [serverConfig]);

	// 开始录制
	const startRecording = useCallback(async () => {
		const { recordAudio, recordVideo } = settings;

		if (!recordAudio && !recordVideo) {
			alert("请至少选择录制音频或视频");
			return;
		}

		try {
			setStatus("请求录制权限...");
			setStatusClass("status-stopping");

			// 检查 API 是否支持
			if (!navigator.mediaDevices) {
				throw new Error(
					"navigator.mediaDevices 未定义，请确保在 HTTPS 环境或扩展 popup 中运行",
				);
			}
			if (!navigator.mediaDevices.getDisplayMedia) {
				throw new Error("浏览器不支持 getDisplayMedia，请使用最新版 Chrome 浏览器");
			}

			// 获取当前标签页 ID
			let tabId = null;
			if (typeof chrome !== "undefined" && chrome.tabs) {
				const [currentTab] = await chrome.tabs.query({
					active: true,
					currentWindow: true,
				});
				tabId = currentTab?.id;
			}

			// 请求屏幕共享
			const displayMediaOptions = {
				video: recordVideo ? { cursor: "always" } : false,
				audio: recordAudio,
			};

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
			setRecordedFiles(null);
			setShowSaveDialog(false);

			// 创建音频录制器
			if (audioStreamRef.current) {
				const audioOptions = mediaFormats.audioMimeType
					? { mimeType: mediaFormats.audioMimeType }
					: undefined;
				const audioRecorder = new MediaRecorder(audioStreamRef.current, audioOptions);
				audioRecorderRef.current = audioRecorder;

				audioRecorder.ondataavailable = event => {
					if (event.data.size > 0) {
						audioChunksRef.current.push(event.data);
					}
				};

				audioRecorder.onerror = error => {
					console.error("音频录制错误:", error);
					stopRecording();
				};

				audioRecorder.onstop = () => {
					console.log("音频录制器已停止，数据块数:", audioChunksRef.current.length);
				};

				audioRecorder.start(100);
			}

			// 创建视频录制器
			if (videoStreamRef.current) {
				const videoOptions = mediaFormats.videoMimeType
					? { mimeType: mediaFormats.videoMimeType }
					: undefined;
				const videoRecorder = new MediaRecorder(videoStreamRef.current, videoOptions);
				videoRecorderRef.current = videoRecorder;

				videoRecorder.ondataavailable = event => {
					if (event.data.size > 0) {
						videoChunksRef.current.push(event.data);
					}
				};

				videoRecorder.onerror = error => {
					console.error("视频录制错误:", error);
					stopRecording();
				};

				videoRecorder.onstop = () => {
					console.log("视频录制器已停止，数据块数:", videoChunksRef.current.length);
				};

				videoRecorder.start(100);
			}

			// 状态更新
			setIsRecording(true);
			setRecordingTime(0);
			startTimer();
			setStatus("正在录制");
			setStatusClass("status-recording");

			// 保存静音设置到 chrome.storage
			if (typeof chrome !== "undefined" && chrome.storage) {
				chrome.storage.local.set({ mutePage: settings.mutePage });
			}

			// 通知 background.js 录制已开始
			if (typeof chrome !== "undefined" && chrome.runtime) {
				chrome.runtime.sendMessage({
					action: "recordingStarted",
					tabId: tabId,
				});
			}

			// 监听流结束事件
			const tracks = mediaStream.getTracks();
			tracks.forEach(track => {
				track.onended = () => {
					if (isRecording) {
						stopRecording();
					}
				};
			});
		} catch (error) {
			console.error("录制失败:", error);
			alert("录制失败: " + error.message);
			setStatus("录制失败");
			setStatusClass("status-stopped");
			setIsRecording(false);
		}
	}, [settings, mediaFormats, startTimer, isRecording]);

	// 停止录制
	const stopRecording = useCallback(() => {
		if (!isRecording) return;

		setIsRecording(false);
		stopTimer();
		setStatus("停止中...");
		setStatusClass("status-stopping");

		// 等待所有录制器停止的 Promise
		const stopPromises = [];

		// 停止音频录制器
		if (audioRecorderRef.current && audioRecorderRef.current.state !== "inactive") {
			const audioPromise = new Promise(resolve => {
				const recorder = audioRecorderRef.current;
				const originalOnStop = recorder.onstop;
				recorder.onstop = event => {
					if (originalOnStop) originalOnStop(event);
					resolve();
				};
				recorder.stop();
			});
			stopPromises.push(audioPromise);
		}

		// 停止视频录制器
		if (videoRecorderRef.current && videoRecorderRef.current.state !== "inactive") {
			const videoPromise = new Promise(resolve => {
				const recorder = videoRecorderRef.current;
				const originalOnStop = recorder.onstop;
				recorder.onstop = event => {
					if (originalOnStop) originalOnStop(event);
					resolve();
				};
				recorder.stop();
			});
			stopPromises.push(videoPromise);
		}

		// 等待所有录制器完全停止
		Promise.all(stopPromises).then(() => {
			console.log("所有录制器已停止");
			console.log("音频数据块数:", audioChunksRef.current.length);
			console.log("视频数据块数:", videoChunksRef.current.length);

			// 准备文件数据
			const files = prepareRecordings();
			setRecordedFiles(files);

			// 更新音频数据状态
			if (audioChunksRef.current.length > 0 && settings.recordAudio) {
				setHasAudioData(true);
			}

			// 显示保存对话框
			setShowSaveDialog(true);

			// 停止流
			if (mediaStreamRef.current) {
				mediaStreamRef.current.getTracks().forEach(track => track.stop());
			}
			if (audioStreamRef.current) {
				audioStreamRef.current.getTracks().forEach(track => track.stop());
			}
			if (videoStreamRef.current) {
				videoStreamRef.current.getTracks().forEach(track => track.stop());
			}
			mediaStreamRef.current = null;
			audioStreamRef.current = null;
			videoStreamRef.current = null;
			audioRecorderRef.current = null;
			videoRecorderRef.current = null;

			setStatus("录制完成，等待保存");
			setStatusClass("status-stopped");

			// 通知 background.js 录制已停止
			if (typeof chrome !== "undefined" && chrome.tabs && chrome.runtime) {
				chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
					if (tabs && tabs[0]) {
						chrome.runtime.sendMessage({
							action: "recordingStopped",
							tabId: tabs[0].id,
						});
					}
				});
			}
		});
	}, [isRecording, stopTimer, prepareRecordings, settings.recordAudio]);

	// 处理保存文件
	const handleSaveFiles = useCallback(async (fileName, action) => {
		if (!recordedFiles) return;

		// 使用自定义文件名重新准备文件
		const files = prepareRecordings(fileName);

		if (action === "download") {
			// 下载到本地
			downloadFiles(files);
			setStatus("文件已下载到本地");
		} else if (action === "upload") {
			// 上传到服务器
			setStatus("正在上传...");
			const result = await uploadFiles(files);
			if (result.success) {
				setStatus("文件已上传到服务器");
				alert("文件上传成功！");
			} else {
				setStatus("上传失败");
				alert("上传失败: " + result.message);
			}
		} else if (action === "both") {
			// 同时下载和上传
			downloadFiles(files);
			setStatus("正在上传...");
			const result = await uploadFiles(files);
			if (result.success) {
				setStatus("文件已下载并上传");
				alert("文件下载并上传成功！");
			} else {
				setStatus("下载完成，上传失败");
				alert("下载完成，但上传失败: " + result.message);
			}
		}

		// 关闭对话框
		setShowSaveDialog(false);
	}, [recordedFiles, prepareRecordings, downloadFiles, uploadFiles]);

	// 取消保存
	const cancelSave = useCallback(() => {
		setShowSaveDialog(false);
		setRecordedFiles(null);
		setStatus("录制已取消");
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

	return {
		isRecording,
		recordingTime,
		status,
		statusClass,
		hasAudioData,
		audioChunksRef,
		showSaveDialog,
		recordedFiles,
		setRecordedFiles,
		setShowSaveDialog,
		startRecording,
		stopRecording,
		prepareRecordings,
		downloadFiles,
		handleSaveFiles,
		cancelSave,
		checkRecordingStatus,
	};
};
