import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { useAI } from "./hooks/useAI";
import { useRecording } from "./hooks/useRecording";
import { addRecording, deleteRecording, getAllRecordings, getRecording, updateRecording } from "./utils/db";
import { detectMediaFormats, formatTime } from "./utils/media";

// 导入组件
import Sidebar from "./components/Sidebar";
import SaveDialog from "./components/common/SaveDialog";
import DetailPage from "./components/pages/DetailPage";
import HistoryPage from "./components/pages/HistoryPage";
import RecordPage from "./components/pages/RecordPage";
import SettingsPage from "./components/pages/SettingsPage";

function App() {
	// 当前页面状态
	const [currentPage, setCurrentPage] = useState("record");

	// 设置状态
	const [settings, setSettings] = useState({
		recordAudio: true,
		recordVideo: true,
		mutePage: false,
		autoNaming: true,
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


	// 保存对话框状态
	const [fileName, setFileName] = useState("");
	const [customFileName, setCustomFileName] = useState("");

	// 历史记录状态
	const [recordings, setRecordings] = useState([]);
	const [selectedRecording, setSelectedRecording] = useState(null);

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
		setRecordedFiles,
		setShowSaveDialog,
		startRecording,
		stopRecording,
		handleSaveFiles,
		cancelSave,
		checkRecordingStatus,
	} = useRecording(settings, mediaFormats);

	// 使用 AI Hook
	const {
		transcribing,
		summarizing,
		transcriptResult,
		summaryResult,
		setTranscriptResult,
		setSummaryResult,
		transcribeAudio,
		transcribeAudioFromFile,
		summarizeContent,
		summarizeText,
		summaryModel,
		setSummaryModel,
	} = useAI(aiConfig, audioChunksRef);

	// 初始化
	useEffect(() => {
		loadStoredSettings();
		loadMediaFormats();
		checkRecordingStatus();
		loadRecordings();
	}, [checkRecordingStatus]);

	// 加载存储的设置
	const loadStoredSettings = useCallback(() => {
		if (typeof chrome !== "undefined" && chrome.storage) {
			chrome.storage.local.get(["recordingSettings", "aiApiConfig"], result => {
				const defaultSettings = {
					recordAudio: true,
					recordVideo: true,
					mutePage: true,
					autoNaming: true,
				};
				setSettings(result.recordingSettings || defaultSettings);

				if (result.aiApiConfig) {
					setAiConfig(result.aiApiConfig);
				}
			});
		}
	}, []);

	// 加载媒体格式
	const loadMediaFormats = useCallback(() => {
		const formats = detectMediaFormats();
		setMediaFormats(formats);
	}, []);

	// 加载历史记录
	const loadRecordings = useCallback(async () => {
		try {
			const data = await getAllRecordings();
			setRecordings(data.reverse());
		} catch (error) {
			console.error("加载历史记录失败:", error);
		}
	}, []);

	// 生成文件名
	const generateFileName = useCallback(async () => {
		const now = new Date();
		const dateStr = now.toISOString().slice(0, 19).replace(/:/g, "-");

		if (settings.autoNaming) {
			try {
				if (typeof chrome !== "undefined" && chrome.tabs) {
					const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
					const title = tab?.title || "recording";
					const cleanTitle = title.replace(/[<>:"/\\|?*]/g, "_").slice(0, 50);
					return `${cleanTitle}_${dateStr}`;
				}
				return `recording_${dateStr}`;
			} catch {
				return `recording_${dateStr}`;
			}
		} else {
			const custom = customFileName.trim() || "recording";
			return `${custom}_${dateStr}`;
		}
	}, [settings.autoNaming, customFileName]);

	// 更新设置
	const handleSettingsChange = useCallback(key => {
		return e => {
			const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
			const newSettings = { ...settings, [key]: value };
			setSettings(newSettings);
			if (typeof chrome !== "undefined" && chrome.storage) {
				chrome.storage.local.set({ recordingSettings: newSettings });
			}
		};
	}, [settings]);

	// 更新AI API配置
	const handleAiConfigChange = useCallback(key => {
		return e => {
			const newConfig = { ...aiConfig, [key]: e.target.value };
			setAiConfig(newConfig);
			if (typeof chrome !== "undefined" && chrome.storage) {
				chrome.storage.local.set({ aiApiConfig: newConfig });
			}
		};
	}, [aiConfig]);

	// 切换AI API启用状态
	const toggleAiEnabled = useCallback(() => {
		const newConfig = { ...aiConfig, enabled: !aiConfig.enabled };
		setAiConfig(newConfig);
		if (typeof chrome !== "undefined" && chrome.storage) {
			chrome.storage.local.set({ aiApiConfig: newConfig });
		}
	}, [aiConfig]);

	// 停止录制并显示保存对话框
	const handleStopRecording = useCallback(async () => {
		await stopRecording();
		const defaultName = await generateFileName();
		setFileName(defaultName);
		if (!settings.autoNaming) {
			setCustomFileName("");
		}
	}, [stopRecording, generateFileName, settings.autoNaming]);

	// 保存文件到本地并记录到数据库
	const handleSaveToLocal = useCallback(async () => {
		if (!recordedFiles) return;

		const finalFileName = fileName || "recording";

		// 使用新的 handleSaveFiles 函数下载文件，并获取下载路径
		const downloadResult = await handleSaveFiles(finalFileName, "download");

		// 保存记录到数据库
		try {
			const recording = {
				fileName: finalFileName,
				timestamp: Date.now(),
				audioFile: recordedFiles.audio,
				videoFile: recordedFiles.video,
				audioPath: downloadResult.downloads?.audio?.path || null,
				videoPath: downloadResult.downloads?.video?.path || null,
				transcript: null,
				summary: null,
			};
			await addRecording(recording);
			await loadRecordings();
		} catch (error) {
			console.error("保存记录失败:", error);
		}

		setShowSaveDialog(false);
		setRecordedFiles(null);
	}, [recordedFiles, fileName, handleSaveFiles, loadRecordings, setShowSaveDialog, setRecordedFiles]);

	// 查看记录详情
	const viewRecordingDetail = useCallback(async (id) => {
		try {
			const recording = await getRecording(id);
			setSelectedRecording(recording);
			setCurrentPage("detail");
			setTranscriptResult(recording.transcript || "");
			setSummaryResult(recording.summary || "");
		} catch (error) {
			console.error("加载记录详情失败:", error);
		}
	}, [setTranscriptResult, setSummaryResult]);

	// 删除记录
	const handleDeleteRecording = useCallback(async (id) => {
		if (!confirm("确定要删除这条记录吗？")) return;
		try {
			await deleteRecording(id);
			await loadRecordings();
			if (selectedRecording?.id === id) {
				setSelectedRecording(null);
				setCurrentPage("history");
			}
		} catch (error) {
			console.error("删除记录失败:", error);
		}
	}, [selectedRecording, loadRecordings]);

	// 为历史记录执行AI转文字
	const handleTranscribeForRecording = useCallback(async (recording) => {
		if (!recording.audioPath) {
			alert("该记录没有音频文件");
			return;
		}

		// 使用音频路径进行转录
		const transcript = await transcribeAudioFromFile(recording.audioPath);

		// 如果转录成功，保存到数据库
		if (transcript) {
			try {
				await updateRecording(recording.id, { transcript });
				// 更新当前选中的记录
				setSelectedRecording(prev => ({ ...prev, transcript }));
				console.log("转录结果已保存:", transcript);
			} catch (error) {
				console.error("保存转录结果失败:", error);
			}
		}
	}, [transcribeAudioFromFile]);

	// 为历史记录执行AI总结
	const handleSummarizeForRecording = useCallback(async (recording) => {
		if (!recording.transcript) {
			alert("请确保转录文本已存在");
			return;
		}

		// 直接使用 summarizeText 进行总结
		const summary = await summarizeText(recording.transcript);

		// 如果总结成功，保存到数据库
		if (summary) {
			try {
				await updateRecording(recording.id, { summary });
				// 更新当前选中的记录
				setSelectedRecording(prev => ({ ...prev, summary }));
				console.log("总结结果已保存:", summary);
			} catch (error) {
				console.error("保存总结结果失败:", error);
			}
		}
	}, [summarizeText]);

	// 返回历史记录
	const handleBackToHistory = useCallback(() => {
		setCurrentPage("history");
	}, []);

	// 页面标题映射
	const pageTitles = {
		record: "录制控制",
		history: "历史记录",
		detail: "记录详情",
		settings: "系统设置",
	};

	return (
		<div className="app-container">
			{/* 侧边栏 */}
			<Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />

			{/* 主内容区域 */}
			<main className="main-content">
				{/* 顶部工具栏 */}
				<header className="toolbar">
					<h2 className="toolbar-title">{pageTitles[currentPage]}</h2>
					<div className="toolbar-actions">
						{isRecording && (
							<span className="recording-time">{formatTime(recordingTime)}</span>
						)}
					</div>
				</header>

				{/* 内容区域 */}
				<div className="content-area">
					{currentPage === "record" && (
					<RecordPage
						settings={settings}
						isRecording={isRecording}
						status={status}
						statusClass={statusClass}
						customFileName={customFileName}
						onStartRecording={startRecording}
						onStopRecording={handleStopRecording}
						onSettingsChange={handleSettingsChange}
						onSetCustomFileName={setCustomFileName}
					/>
				)}

					{currentPage === "history" && (
						<HistoryPage
							recordings={recordings}
							onViewDetail={viewRecordingDetail}
							onDelete={handleDeleteRecording}
						/>
					)}

					{currentPage === "detail" && selectedRecording && (
						<DetailPage
							recording={selectedRecording}
							onBack={handleBackToHistory}
							aiConfig={aiConfig}
							transcribing={transcribing}
							summarizing={summarizing}
							transcriptResult={transcriptResult}
							summaryResult={summaryResult}
							onTranscribe={handleTranscribeForRecording}
							onSummarize={handleSummarizeForRecording}
							setTranscriptResult={setTranscriptResult}
							setSummaryResult={setSummaryResult}
						/>
					)}

					{currentPage === "settings" && (
					<SettingsPage
						aiConfig={aiConfig}
						onAiConfigChange={handleAiConfigChange}
						onToggleAi={toggleAiEnabled}
						summaryModel={summaryModel}
						onSummaryModelChange={setSummaryModel}
					/>
				)}
				</div>
			</main>

			{/* 保存文件对话框 */}
			<SaveDialog
				show={showSaveDialog}
				settings={settings}
				fileName={fileName}
				customFileName={customFileName}
				recordedFiles={recordedFiles}
				mediaFormats={mediaFormats}
				onFileNameChange={setFileName}
				onCustomFileNameChange={setCustomFileName}
				onSave={handleSaveToLocal}
				onCancel={cancelSave}
			/>
		</div>
	);
}

export default App;
