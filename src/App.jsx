import { useEffect, useState } from "react";
import { useRecording } from "./hooks/useRecording";
import { useAI } from "./hooks/useAI";
import { detectMediaFormats, formatTime } from "./utils/media";
import "./App.css";

function App() {
	// 设置状态
	const [settings, setSettings] = useState({
		recordAudio: true,
		recordVideo: true,
		mutePage: true,
	});

	// 媒体格式状态
	const [mediaFormats, setMediaFormats] = useState({
		audioMimeType: "",
		videoMimeType: "",
		audioExtension: "webm",
		videoExtension: "webm",
	});

	// AI API配置
	const [aiConfig, setAiConfig] = useState({
		apiKey: "",
		baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		modelId: "qwen-plus",
		enabled: false,
	});

	// 使用录制 Hook
	const {
		isRecording,
		recordingTime,
		status,
		statusClass,
		hasAudioData,
		audioChunksRef,
		startRecording,
		stopRecording,
		checkRecordingStatus,
	} = useRecording(settings, mediaFormats);

	// 使用 AI Hook
	const {
		transcribing,
		summarizing,
		transcriptResult,
		summaryResult,
		transcribeAudio,
		summarizeContent,
	} = useAI(aiConfig, audioChunksRef);

	// 初始化
	useEffect(() => {
		// 加载存储的设置
		chrome.storage.local.get(["recordingSettings", "aiApiConfig"], result => {
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
		const formats = detectMediaFormats();
		setMediaFormats(formats);

		// 检查录制状态
		checkRecordingStatus();
	}, [checkRecordingStatus]);

	// 更新设置
	const handleSettingsChange = key => {
		return e => {
			const newSettings = { ...settings, [key]: e.target.checked };
			setSettings(newSettings);
			chrome.storage.local.set({ recordingSettings: newSettings });
		};
	};

	// 更新AI API配置
	const handleAiConfigChange = key => {
		return e => {
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
					<label htmlFor="recordAudio">录制音频</label>
					<input
						type="checkbox"
						id="recordAudio"
						checked={settings.recordAudio}
						onChange={handleSettingsChange("recordAudio")}
						disabled={isRecording}
					/>
				</div>
				<div className="setting-item">
					<label htmlFor="recordVideo">录制视频</label>
					<input
						type="checkbox"
						id="recordVideo"
						checked={settings.recordVideo}
						onChange={handleSettingsChange("recordVideo")}
						disabled={isRecording}
					/>
				</div>
				<div className="setting-item">
					<label htmlFor="mutePage">页面静音</label>
					<input
						type="checkbox"
						id="mutePage"
						checked={settings.mutePage}
						onChange={handleSettingsChange("mutePage")}
						disabled={isRecording}
					/>
				</div>
			</div>

			<div className="recording-info" id="recordingInfo">
				{recordingTime > 0 &&
					isRecording &&
					`录制时间: ${formatTime(recordingTime)}`}
			</div>

			{/* AI API配置 */}
			<div className="api-config">
				<div className="setting-item">
					<label htmlFor="aiEnabled">启用AI功能</label>
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
							<label
								htmlFor="aiApiKey"
								style={{
									fontSize: "11px",
									display: "block",
									marginBottom: "5px",
								}}
							>
								API Key:
							</label>
							<input
								type="password"
								id="aiApiKey"
								value={aiConfig.apiKey}
								onChange={handleAiConfigChange("apiKey")}
								placeholder="输入API Key (sk-xxx)"
								style={{
									width: "100%",
									fontSize: "11px",
									padding: "4px",
									boxSizing: "border-box",
								}}
							/>
						</div>
						<div className="api-config-item">
							<label
								htmlFor="aiBaseUrl"
								style={{
									fontSize: "11px",
									display: "block",
									marginBottom: "5px",
								}}
							>
								API 地址:
							</label>
							<input
								type="text"
								id="aiBaseUrl"
								value={aiConfig.baseUrl}
								onChange={handleAiConfigChange("baseUrl")}
								placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
								style={{
									width: "100%",
									fontSize: "11px",
									padding: "4px",
									boxSizing: "border-box",
								}}
							/>
							<p style={{ fontSize: "9px", color: "#888", marginTop: "3px" }}>
								阿里百炼: dashscope.aliyuncs.com | 火山方舟:
								ark.cn-beijing.volces.com/api/v3
							</p>
						</div>
						<div className="api-config-item">
							<label
								htmlFor="aiModelId"
								style={{
									fontSize: "11px",
									display: "block",
									marginBottom: "5px",
								}}
							>
								模型ID:
							</label>
							<input
								type="text"
								id="aiModelId"
								value={aiConfig.modelId}
								onChange={handleAiConfigChange("modelId")}
								placeholder="qwen-plus"
								style={{
									width: "100%",
									fontSize: "11px",
									padding: "4px",
									boxSizing: "border-box",
								}}
							/>
							<p style={{ fontSize: "9px", color: "#888", marginTop: "3px" }}>
								语音识别: qwen3-asr-flash | 大模型: qwen-plus, qwen-max
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
							backgroundColor: "#2196F3",
							color: "white",
							marginBottom: "8px",
							fontSize: "12px",
							padding: "8px",
						}}
					>
						{transcribing ? "转录中..." : "音频转文字"}
					</button>
					<button
						className="btn btn-summarize"
						onClick={summarizeContent}
						disabled={summarizing || !transcriptResult}
						style={{
							backgroundColor: "#9C27B0",
							color: "white",
							fontSize: "12px",
							padding: "8px",
						}}
					>
						{summarizing ? "总结中..." : "内容总结"}
					</button>
				</div>
			)}

			{/* 转录和总结结果 */}
			{transcriptResult && (
				<div className="transcript-result">
					<h4 style={{ fontSize: "12px", marginBottom: "5px", color: "#333" }}>
						音频转录：
					</h4>
					<div
						style={{
							fontSize: "11px",
							color: "#555",
							backgroundColor: "#f9f9f9",
							padding: "8px",
							borderRadius: "4px",
							maxHeight: "200px",
							overflowY: "auto",
						}}
					>
						{transcriptResult}
					</div>
				</div>
			)}

			{summaryResult && (
				<div className="summary-result">
					<h4 style={{ fontSize: "12px", marginBottom: "5px", color: "#333" }}>
						内容总结：
					</h4>
					<div
						style={{
							fontSize: "11px",
							color: "#555",
							backgroundColor: "#f0f8ff",
							padding: "8px",
							borderRadius: "4px",
							maxHeight: "200px",
							overflowY: "auto",
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
				<p style={{ fontSize: "10px", marginTop: "5px" }}>
					浏览器原生不支持 MP4 和 MP3 格式（专利格式）， 默认使用 WebM
					(VP9/Opus) 高画质格式。 如果需要其他格式，请使用转换工具。
				</p>
				{aiConfig.enabled && (
					<p style={{ fontSize: "10px", marginTop: "5px" }}>
						<strong>API说明:</strong>{" "}
						使用OpenAI兼容模式调用大模型API实现音频转文字和内容总结。
					</p>
				)}
			</div>
		</div>
	);
}

export default App;
