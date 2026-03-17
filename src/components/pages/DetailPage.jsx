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
