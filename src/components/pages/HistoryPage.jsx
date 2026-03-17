function HistoryPage({ recordings, onViewDetail, onDelete }) {
	return (
		<div className="history-page">
			{recordings.length === 0 ? (
				<div className="empty-state">
					<p>暂无录制记录</p>
				</div>
			) : (
				<div className="recordings-list">
					{recordings.map(recording => (
						<div
							key={recording.id}
							className="recording-card"
							onClick={() => onViewDetail(recording.id)}
						>
							<div className="recording-info">
								<h4 className="recording-name">{recording.fileName}</h4>
								<p className="recording-time">
									🕐 {new Date(recording.timestamp).toLocaleString()}
								</p>
								<div className="recording-files">
									{recording.audioFile && <span className="file-tag">🎤 音频</span>}
									{recording.videoFile && <span className="file-tag">📹 视频</span>}
								</div>
							</div>
							<div className="recording-actions">
								<button
									className="btn-icon"
									onClick={e => {
										e.stopPropagation();
										onDelete(recording.id);
									}}
									title="删除"
								>
									🗑️
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export default HistoryPage;
