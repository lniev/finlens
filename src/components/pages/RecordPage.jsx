function RecordPage({
	settings,
	isRecording,
	status,
	statusClass,
	customFileName,
	onStartRecording,
	onStopRecording,
	onSettingsChange,
	onSetCustomFileName,
}) {
	return (
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
						onClick={onStartRecording}
						disabled={isRecording}
					>
						<span>▶</span> 开始录制
					</button>
					<button
						className="btn btn-stop"
						onClick={onStopRecording}
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
							onChange={onSettingsChange("recordAudio")}
							disabled={isRecording}
						/>
					</div>
					<div className="setting-item">
						<label htmlFor="recordVideo">📹 录制视频</label>
						<input
							type="checkbox"
							id="recordVideo"
							checked={settings.recordVideo}
							onChange={onSettingsChange("recordVideo")}
							disabled={isRecording}
						/>
					</div>
					<div className="setting-item">
						<label htmlFor="mutePage">🔇 页面静音</label>
						<input
							type="checkbox"
							id="mutePage"
							checked={settings.mutePage}
							onChange={onSettingsChange("mutePage")}
							disabled={isRecording}
						/>
					</div>
					<div className="setting-item">
						<label htmlFor="autoNaming">🏷️ 自动命名</label>
						<input
							type="checkbox"
							id="autoNaming"
							checked={settings.autoNaming}
							onChange={onSettingsChange("autoNaming")}
						/>
					</div>
				</div>
				{!settings.autoNaming && (
					<div className="form-group" style={{ marginTop: "15px" }}>
						<label htmlFor="customFileName">自定义文件名前缀</label>
						<input
							type="text"
							id="customFileName"
							value={customFileName}
							onChange={e => onSetCustomFileName(e.target.value)}
							placeholder="输入文件名前缀（不含日期）"
						/>
					</div>
				)}
			</div>
		</>
	);
}

export default RecordPage;
