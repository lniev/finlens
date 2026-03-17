import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";
import { useAI } from "./hooks/useAI";
import { useRecording } from "./hooks/useRecording";
import { detectMediaFormats, formatTime } from "./utils/media";

function App() {
	// 当前页面状态
	const [currentPage, setCurrentPage] = useState("record");

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

	// 服务器配置
	const [serverConfig, setServerConfig] = useState({
		url: "",
		enabled: false,
	});

	// 保存对话框状态
	const [fileName, setFileName] = useState("");

	// 使用录制 Hook
	const {
		isRecording,
		recordingTime,
		status,
		statusClass,
		hasAudioData,
		audioChunksRef,
		showSaveDialog,
		recordedFiles,
		startRecording,
		stopRecording,
		handleSaveFiles,
		cancelSave,
		checkRecordingStatus,
	} = useRecording(settings, mediaFormats, serverConfig);

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
		chrome.storage.local.get(["recordingSettings", "aiApiConfig", "serverConfig"], result => {
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

			// 加载服务器配置
			if (result.serverConfig) {
				setServerConfig(result.serverConfig);
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

	// 更新服务器配置
	const handleServerConfigChange = key => {
		return e => {
			const newConfig = { ...serverConfig, [key]: e.target.value };
			setServerConfig(newConfig);
			chrome.storage.local.set({ serverConfig: newConfig });
		};
	};

	// 切换服务器启用状态
	const toggleServerEnabled = () => {
		const newConfig = { ...serverConfig, enabled: !serverConfig.enabled };
		setServerConfig(newConfig);
		chrome.storage.local.set({ serverConfig: newConfig });
	};

	// 测试服务器连接
	const testServerConnection = async () => {
		if (!serverConfig.url) {
			alert("请先输入服务器地址");
			return;
		}

		try {
			const response = await fetch(`${serverConfig.url}/health`);
			const data = await response.json();
			if (data.status === "ok") {
				alert("服务器连接成功！");
			} else {
				alert("服务器响应异常");
			}
		} catch (error) {
			alert("连接失败: " + error.message);
		}
	};

	// 导航菜单项
	const navItems = [
		{ id: "record", label: "录制", icon: "🎥" },
		{ id: "history", label: "历史记录", icon: "📁" },
		{ id: "settings", label: "设置", icon: "⚙️" },
	];

	return (
		<div className="app-container">
			{/* 侧边栏 */}
			<aside className="sidebar">
				<h1 className="app-title">🎬 直播录制</h1>
				<nav>
					<ul className="nav-menu">
						{navItems.map(item => (
							<li
								key={item.id}
								className={`nav-item ${currentPage === item.id ? "active" : ""}`}
								onClick={() => setCurrentPage(item.id)}
							>
								<span className="nav-icon">{item.icon}</span>
								<span>{item.label}</span>
							</li>
						))}
					</ul>
				</nav>
			</aside>

			{/* 主内容区域 */}
			<main className="main-content">
				{/* 顶部工具栏 */}
				<header className="toolbar">
					<h2 className="toolbar-title">
						{currentPage === "record" && "录制控制"}
						{currentPage === "history" && "历史记录"}
						{currentPage === "settings" && "系统设置"}
					</h2>
					<div className="toolbar-actions">
						{isRecording && (
							<span className="recording-time">{formatTime(recordingTime)}</span>
						)}
					</div>
				</header>

				{/* 内容区域 */}
				<div className="content-area">
					{/* 录制页面 */}
					{currentPage === "record" && (
						<>
							{/* 录制控制面板 */}
							<div className="recording-panel">
								{/* 状态栏 */}
								<div className={`status-bar ${statusClass}`}>
									<div className="status-indicator"></div>
									<span className="status-text">{status}</span>
								</div>

								{/* 录制按钮 */}
								<div className="recording-controls">
									<button
										className="btn btn-start"
										onClick={startRecording}
										disabled={isRecording}
									>
										<span>▶</span> 开始录制
									</button>
									<button
										className="btn btn-stop"
										onClick={stopRecording}
										disabled={!isRecording}
									>
										<span>⏹</span> 停止录制
									</button>
								</div>
							</div>

							{/* 设置面板 */}
							<div className="settings-panel">
								<h3 className="panel-title">录制设置</h3>
								<div className="settings-grid">
									<div className="setting-item">
										<label htmlFor="recordAudio">🎤 录制音频</label>
										<input
											type="checkbox"
											id="recordAudio"
											checked={settings.recordAudio}
											onChange={handleSettingsChange("recordAudio")}
											disabled={isRecording}
										/>
									</div>
									<div className="setting-item">
										<label htmlFor="recordVideo">📹 录制视频</label>
										<input
											type="checkbox"
											id="recordVideo"
											checked={settings.recordVideo}
											onChange={handleSettingsChange("recordVideo")}
											disabled={isRecording}
										/>
									</div>
									<div className="setting-item">
										<label htmlFor="mutePage">🔇 页面静音</label>
										<input
											type="checkbox"
											id="mutePage"
											checked={settings.mutePage}
											onChange={handleSettingsChange("mutePage")}
											disabled={isRecording}
										/>
									</div>
								</div>
							</div>

							{/* AI 配置面板 */}
							<div className="ai-config-panel">
								<h3 className="panel-title">🤖 AI 功能配置</h3>
								<div className="ai-toggle">
									<input
										type="checkbox"
										id="aiEnabled"
										checked={aiConfig.enabled}
										onChange={toggleAiEnabled}
									/>
									<label htmlFor="aiEnabled">启用 AI 功能</label>
								</div>

								{aiConfig.enabled && (
									<>
										<div className="ai-config-form">
											<div className="form-group">
												<label htmlFor="aiApiKey">API Key</label>
												<input
													type="password"
													id="aiApiKey"
													value={aiConfig.apiKey}
													onChange={handleAiConfigChange("apiKey")}
													placeholder="sk-xxx"
												/>
											</div>
											<div className="form-group">
												<label htmlFor="aiModelId">模型 ID</label>
												<input
													type="text"
													id="aiModelId"
													value={aiConfig.modelId}
													onChange={handleAiConfigChange("modelId")}
													placeholder="qwen-plus"
												/>
												<span className="help-text">
													语音识别: qwen3-asr-flash | 大模型: qwen-plus
												</span>
											</div>
											<div className="form-group full-width">
												<label htmlFor="aiBaseUrl">API 地址</label>
												<input
													type="text"
													id="aiBaseUrl"
													value={aiConfig.baseUrl}
													onChange={handleAiConfigChange("baseUrl")}
													placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
												/>
												<span className="help-text">
													阿里百炼: dashscope.aliyuncs.com | 火山方舟:
													ark.cn-beijing.volces.com/api/v3
												</span>
											</div>
										</div>

										{/* AI 功能按钮 */}
										<div className="ai-actions">
											<button
												className="btn btn-transcribe"
												onClick={transcribeAudio}
												disabled={transcribing || !hasAudioData}
											>
												{transcribing ? "📝 转录中..." : "🎤 音频转文字"}
											</button>
											<button
												className="btn btn-summarize"
												onClick={summarizeContent}
												disabled={summarizing || !transcriptResult}
											>
												{summarizing ? "📊 总结中..." : "📋 内容总结"}
											</button>
										</div>
									</>
								)}
							</div>

							{/* 结果展示面板 */}
							{(transcriptResult || summaryResult) && (
								<div className="results-panel">
									<h3 className="panel-title">📄 处理结果</h3>

									{transcriptResult && (
										<div className="result-section">
											<div className="result-header">
												<h4 className="result-title">🎤 音频转录</h4>
											</div>
											<div className="result-content transcript markdown-body">
												<ReactMarkdown>{transcriptResult}</ReactMarkdown>
											</div>
										</div>
									)}

									{summaryResult && (
										<div className="result-section">
											<div className="result-header">
												<h4 className="result-title">📋 内容总结</h4>
											</div>
											<div className="result-content summary markdown-body">
												<ReactMarkdown>{summaryResult}</ReactMarkdown>
											</div>
										</div>
									)}
								</div>
							)}
						</>
					)}

					{/* 历史记录页面 */}
					{currentPage === "history" && (
						<div className="settings-panel">
							<p style={{ color: "#888", textAlign: "center", padding: "40px" }}>
								📁 历史记录功能开发中...
							</p>
						</div>
					)}

					{/* 设置页面 */}
					{currentPage === "settings" && (
						<div className="settings-content">
							{/* 服务器配置面板 */}
							<div className="settings-panel">
								<h3 className="panel-title">🖥️ 远程服务器配置</h3>
								<div className="ai-toggle">
									<input
										type="checkbox"
										id="serverEnabled"
										checked={serverConfig.enabled}
										onChange={toggleServerEnabled}
									/>
									<label htmlFor="serverEnabled">启用远程服务器存储</label>
								</div>

								{serverConfig.enabled && (
									<div className="server-config-form">
										<div className="form-group full-width">
											<label htmlFor="serverUrl">服务器地址</label>
											<input
												type="text"
												id="serverUrl"
												value={serverConfig.url}
												onChange={handleServerConfigChange("url")}
												placeholder="http://your-server-ip:3000"
											/>
											<span className="help-text">
												输入您的服务器 IP 地址和端口，例如: http://192.168.1.100:3000
											</span>
										</div>
										<button
											className="btn btn-secondary"
											onClick={testServerConnection}
											style={{ marginTop: "10px" }}
										>
											🔄 测试连接
										</button>
									</div>
								)}
							</div>

							{/* AI 配置面板（在设置页面也显示） */}
							<div className="settings-panel">
								<h3 className="panel-title">🤖 AI 功能配置</h3>
								<div className="ai-toggle">
									<input
										type="checkbox"
										id="aiEnabledSettings"
										checked={aiConfig.enabled}
										onChange={toggleAiEnabled}
									/>
									<label htmlFor="aiEnabledSettings">启用 AI 功能</label>
								</div>

								{aiConfig.enabled && (
									<div className="ai-config-form">
										<div className="form-group">
											<label htmlFor="aiApiKeySettings">API Key</label>
											<input
												type="password"
												id="aiApiKeySettings"
												value={aiConfig.apiKey}
												onChange={handleAiConfigChange("apiKey")}
												placeholder="sk-xxx"
											/>
										</div>
										<div className="form-group">
											<label htmlFor="aiModelIdSettings">模型 ID</label>
											<input
												type="text"
												id="aiModelIdSettings"
												value={aiConfig.modelId}
												onChange={handleAiConfigChange("modelId")}
												placeholder="qwen-plus"
											/>
										</div>
										<div className="form-group full-width">
											<label htmlFor="aiBaseUrlSettings">API 地址</label>
											<input
												type="text"
												id="aiBaseUrlSettings"
												value={aiConfig.baseUrl}
												onChange={handleAiConfigChange("baseUrl")}
												placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
											/>
										</div>
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* 底部信息栏 */}
				<footer className="footer-info">
					<p>
						<strong>格式说明:</strong> 浏览器原生不支持 MP4/MP3 格式，默认使用 WebM
						(VP9/Opus) 高画质格式
					</p>
					{serverConfig.enabled && (
						<p>
							<strong>服务器:</strong> {serverConfig.url || "未配置"}
						</p>
					)}
					{aiConfig.enabled && (
						<p>
							<strong>API说明:</strong> 使用 OpenAI 兼容模式调用大模型 API
						</p>
					)}
				</footer>
			</main>

			{/* 保存文件对话框 */}
			{showSaveDialog && (
				<div className="modal-overlay">
					<div className="modal-content">
						<h3 className="modal-title">💾 保存录制文件</h3>

						<div className="modal-body">
							<div className="form-group">
								<label htmlFor="fileName">文件名称</label>
								<input
									type="text"
									id="fileName"
									value={fileName}
									onChange={e => setFileName(e.target.value)}
									placeholder="输入文件名（不含扩展名）"
									autoFocus
								/>
								<span className="help-text">
									文件将保存为: {fileName || "recording"}_audio/video.webm
								</span>
							</div>

							{recordedFiles && (
								<div className="file-preview">
									<p><strong>待保存文件:</strong></p>
									{recordedFiles.audio && (
										<p>🎤 {fileName || "recording"}_audio.{mediaFormats.audioExtension}</p>
									)}
									{recordedFiles.video && (
										<p>📹 {fileName || "recording"}_video.{mediaFormats.videoExtension}</p>
									)}
								</div>
							)}
						</div>

						<div className="modal-actions">
							<button
								className="btn btn-secondary"
								onClick={cancelSave}
							>
								取消
							</button>
							<button
								className="btn btn-start"
								onClick={() => handleSaveFiles(fileName || "recording", "download")}
							>
								💻 下载到本地
							</button>
							{serverConfig.enabled && (
								<button
									className="btn btn-transcribe"
									onClick={() => handleSaveFiles(fileName || "recording", "upload")}
								>
									☁️ 上传到服务器
								</button>
							)}
							{serverConfig.enabled && (
								<button
									className="btn btn-summarize"
									onClick={() => handleSaveFiles(fileName || "recording", "both")}
								>
									💻☁️ 下载并上传
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
