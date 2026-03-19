import { useState } from "react";
import ReactMarkdown from "react-markdown";

function DetailPage({
	recording,
	onBack,
	aiConfig,
	transcribing,
	summarizing,
	transcriptResult,
	summaryResult,
	onTranscribe,
	onSummarize,
}) {
	// 指定接口转文字相关状态
	const [showCustomApiForm, setShowCustomApiForm] = useState(false);
	const [customApiUrl, setCustomApiUrl] = useState("");
	const [customFileParam, setCustomFileParam] = useState("file");
	const [customApiLoading, setCustomApiLoading] = useState(false);
	const [customApiResult, setCustomApiResult] = useState(null);
	const [customApiError, setCustomApiError] = useState(null);
	const [requestType, setRequestType] = useState("multipart"); // "json" 或 "multipart"

	// 处理指定接口转文字
	const handleCustomApiTranscribe = async () => {
		if (!customApiUrl.trim()) {
			alert("请输入API地址");
			return;
		}
		if (!recording.audioPath) {
			alert("该记录没有音频文件");
			return;
		}

		setCustomApiLoading(true);
		setCustomApiError(null);
		setCustomApiResult(null);

		try {
			let response;

			if (requestType === "multipart") {
				// multipart/form-data 格式 - 用于 /asr/upload-and-transcribe 等接口
				// 需要先读取文件内容
				const fileResponse = await fetch(`file:///${recording.audioPath}`);
				const fileBlob = await fileResponse.blob();
				const fileName = recording.audioFile || "audio.wav";

				const formData = new FormData();
				formData.append(customFileParam, fileBlob, fileName);

				response = await fetch(customApiUrl, {
					method: "POST",
					body: formData,
				});
			} else {
				// JSON 格式 - 用于接收文件URL的接口
				const fileUrl = `file:///${recording.audioPath}`;
				response = await fetch(customApiUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						[customFileParam]: fileUrl,
					}),
				});
			}

			if (!response.ok) {
				throw new Error(`请求失败: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			setCustomApiResult(data);
		} catch (error) {
			console.error("指定接口转文字失败:", error);
			setCustomApiError(error.message || "请求失败");
		} finally {
			setCustomApiLoading(false);
		}
	};

	return (
		<div className="detail-page">
			<button
				className="btn btn-secondary"
				onClick={onBack}
				style={{ marginBottom: "20px" }}
			>
				← 返回历史记录
			</button>

			<div className="detail-header">
				<h3>{recording.fileName}</h3>
				<p className="detail-time">
					🕐 {new Date(recording.timestamp).toLocaleString()}
				</p>
			</div>

			<div className="detail-files">
				{recording.audioPath && (
					<div className="file-player">
						<h4>🎤 音频文件</h4>
						<p className="file-name">文件名: {recording.audioFile}</p>
						<p className="file-path">路径: {recording.audioPath}</p>
						<audio
							controls
							src={`file:///${recording.audioPath}`}
							style={{ width: "100%", marginTop: "10px" }}
						>
							您的浏览器不支持音频播放
						</audio>
					</div>
				)}

				{recording.videoPath && (
					<div className="file-player">
						<h4>📹 视频文件</h4>
						<p className="file-name">文件名: {recording.videoFile}</p>
						<p className="file-path">路径: {recording.videoPath}</p>
						<video
							controls
							src={`file:///${recording.videoPath}`}
							style={{ width: "100%", marginTop: "10px" }}
						>
							您的浏览器不支持视频播放
						</video>
					</div>
				)}
			</div>

			{/* AI 功能按钮 */}
			{aiConfig.enabled && (
				<div className="ai-actions detail-ai-actions">
					<button
						className="btn btn-transcribe"
						onClick={() => onTranscribe(recording)}
						disabled={transcribing}
					>
						{transcribing ? "📝 转录中..." : "🎤 AI 转文字"}
					</button>
					<button
						className="btn btn-summarize"
						onClick={() => onSummarize(recording)}
						disabled={summarizing || !recording.transcript}
					>
						{summarizing ? "📊 总结中..." : "📋 AI 总结"}
					</button>
				</div>
			)}

			{/* 指定接口转文字按钮 */}
			<div className="ai-actions detail-ai-actions">
				<button
					className="btn btn-custom-api"
					onClick={() => setShowCustomApiForm(!showCustomApiForm)}
				>
					{showCustomApiForm ? "🔼 收起指定接口" : "🔧 指定接口转文字"}
				</button>
			</div>

			{/* 指定接口转文字表单 */}
			{showCustomApiForm && (
				<div className="custom-api-form">
					<div className="form-group">
						<label>API 地址:</label>
						<input
							type="text"
							placeholder="请输入API地址，如 http://localhost:5000/asr/upload-and-transcribe"
							value={customApiUrl}
							onChange={(e) => setCustomApiUrl(e.target.value)}
						/>
					</div>
					<div className="form-group">
						<label>请求方式:</label>
						<select
							value={requestType}
							onChange={(e) => setRequestType(e.target.value)}
						>
							<option value="multipart">multipart/form-data (上传文件)</option>
							<option value="json">application/json (发送文件URL)</option>
						</select>
					</div>
					<div className="form-group">
						<label>文件参数名称:</label>
						<input
							type="text"
							placeholder={requestType === "multipart" ? "默认为 file" : "默认为 file_url"}
							value={customFileParam}
							onChange={(e) => setCustomFileParam(e.target.value)}
						/>
					</div>
					<button
						className="btn btn-primary"
						onClick={handleCustomApiTranscribe}
						disabled={customApiLoading}
					>
						{customApiLoading ? "⏳ 请求中..." : "✅ 确定"}
					</button>
				</div>
			)}

			{/* 指定接口转文字结果 */}
			{customApiResult && (
				<div className="result-section">
					<div className="result-header">
						<h4 className="result-title">🔧 指定接口转文字结果</h4>
					</div>
					<div className="result-content custom-api-result markdown-body">
						<pre>{JSON.stringify(customApiResult, null, 2)}</pre>
					</div>
				</div>
			)}

			{/* 指定接口转文字错误 */}
			{customApiError && (
				<div className="result-section">
					<div className="result-header">
						<h4 className="result-title">❌ 请求失败</h4>
					</div>
					<div className="result-content custom-api-error">
						<p>{customApiError}</p>
					</div>
				</div>
			)}

			{/* 结果显示 */}
			{(transcriptResult || summaryResult) && (
				<div className="results-panel">
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
		</div>
	);
}

export default DetailPage;
