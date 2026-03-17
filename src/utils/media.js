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

// 保存 Blob 文件
export const saveBlob = (blob, filename) => {
	const url = URL.createObjectURL(blob);

	if (chrome.downloads) {
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
				}
				setTimeout(() => URL.revokeObjectURL(url), 1000);
			},
		);
	} else {
		fallbackDownload(url, filename);
	}
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
