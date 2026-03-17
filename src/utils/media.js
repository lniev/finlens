// 媒体格式检测工具

export const detectMediaFormats = () => {
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
		if (window.MediaRecorder && window.MediaRecorder.isTypeSupported(type)) {
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
		if (window.MediaRecorder && window.MediaRecorder.isTypeSupported(type)) {
			result.videoMimeType = type;
			result.videoExtension = type.includes("matroska") ? "mkv" : "webm";
			break;
		}
	}

	return result;
};

// Blob 转 Data URI
export const blobToDataUri = blob => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const base64data = reader.result;
			resolve(base64data);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
};

// 格式化录制时间
export const formatTime = seconds => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	let timeString = "";
	if (hours > 0) {
		timeString += `${String(hours).padStart(2, "0")}:`;
	}
	timeString += `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	return timeString;
};

// 保存 Blob 文件，返回 Promise 包含下载路径
export const saveBlob = (blob, filename) => {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);

		if (typeof chrome !== "undefined" && chrome.downloads) {
			chrome.downloads.download(
				{
					url: url,
					filename: filename,
					saveAs: false,
				},
				downloadId => {
					if (chrome.runtime.lastError) {
						console.error("下载失败:", chrome.runtime.lastError);
						fallbackDownload(url, filename);
						// 降级方案无法获取路径，返回文件名
						resolve({ success: true, filename: filename, path: null });
						setTimeout(() => URL.revokeObjectURL(url), 1000);
					} else {
						// 监听下载状态变化，获取完整路径
						const onChanged = (delta) => {
							if (delta.id === downloadId && delta.state && delta.state.current === "complete") {
								chrome.downloads.onChanged.removeListener(onChanged);
								chrome.downloads.search({ id: downloadId }, results => {
									if (results && results.length > 0) {
										const downloadItem = results[0];
										resolve({
											success: true,
											filename: filename,
											path: downloadItem.filename,
											downloadId: downloadId,
										});
									} else {
										resolve({ success: true, filename: filename, path: null });
									}
									setTimeout(() => URL.revokeObjectURL(url), 1000);
								});
							}
						};
						chrome.downloads.onChanged.addListener(onChanged);

						// 超时处理（10秒后移除监听器）
						setTimeout(() => {
							chrome.downloads.onChanged.removeListener(onChanged);
							// 尝试直接查询
							chrome.downloads.search({ id: downloadId }, results => {
								if (results && results.length > 0) {
									const downloadItem = results[0];
									resolve({
										success: true,
										filename: filename,
										path: downloadItem.filename,
										downloadId: downloadId,
									});
								} else {
									resolve({ success: true, filename: filename, path: null });
								}
								setTimeout(() => URL.revokeObjectURL(url), 1000);
							});
						}, 3000);
					}
				},
			);
		} else {
			fallbackDownload(url, filename);
			// 降级方案无法获取路径，返回文件名
			resolve({ success: true, filename: filename, path: null });
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		}
	});
};

// 降级下载方法
const fallbackDownload = (url, filename) => {
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};
