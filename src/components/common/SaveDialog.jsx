function SaveDialog({
	show,
	settings,
	fileName,
	customFileName,
	recordedFiles,
	mediaFormats,
	onFileNameChange,
	onCustomFileNameChange,
	onSave,
	onCancel,
}) {
	if (!show) return null;

	return (
		<div className="modal-overlay">
			<div className="modal-content">
				<h3 className="modal-title">💾 保存录制文件</h3>

				<div className="modal-body">
					{!settings.autoNaming && (
						<div className="form-group">
							<label htmlFor="customNameInput">自定义文件名</label>
							<input
								type="text"
								id="customNameInput"
								value={customFileName}
								onChange={e => onCustomFileNameChange(e.target.value)}
								placeholder="输入文件名前缀"
								autoFocus
							/>
						</div>
					)}

					<div className="form-group">
						<label>最终文件名</label>
						<input
							type="text"
							value={fileName}
							onChange={e => onFileNameChange(e.target.value)}
							placeholder="文件名"
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
						onClick={onCancel}
					>
						取消
					</button>
					<button
						className="btn btn-start"
						onClick={onSave}
					>
						💻 保存到本地
					</button>
				</div>
			</div>
		</div>
	);
}

export default SaveDialog;
