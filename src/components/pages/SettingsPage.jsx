function SettingsPage({
	aiConfig,
	onAiConfigChange,
	onToggleAi,
	summaryModel,
	onSummaryModelChange,
}) {
	return (
		<div className="settings-content">
			{/* AI 配置面板 */}
			<div className="settings-panel">
				<h3 className="panel-title">🤖 AI 功能配置</h3>
				<div className="ai-toggle">
					<input
						type="checkbox"
						id="aiEnabledSettings"
						checked={aiConfig.enabled}
						onChange={onToggleAi}
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
								onChange={onAiConfigChange("apiKey")}
								placeholder="sk-xxx"
							/>
						</div>
						<div className="form-group">
							<label htmlFor="aiModelIdSettings">语音识别模型 ID</label>
							<input
								type="text"
								id="aiModelIdSettings"
								value={aiConfig.modelId}
								onChange={onAiConfigChange("modelId")}
								placeholder="qwen3-asr-flash"
							/>
							<span className="help-text">
								语音识别: qwen3-asr-flash-filetrans
							</span>
						</div>
						<div className="form-group">
							<label htmlFor="summaryModelSettings">AI 总结模型</label>
							<select
								id="summaryModelSettings"
								value={summaryModel}
								onChange={e => onSummaryModelChange(e.target.value)}
							>
								<option value="kimi-k2.5">kimi-k2.5</option>
							</select>
							<span className="help-text">
								用于内容总结的模型
							</span>
						</div>
						<div className="form-group full-width">
							<label htmlFor="aiBaseUrlSettings">API 地址</label>
							<input
								type="text"
								id="aiBaseUrlSettings"
								value={aiConfig.baseUrl}
								onChange={onAiConfigChange("baseUrl")}
								placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
							/>
							<span className="help-text">
								阿里百炼: dashscope.aliyuncs.com | 火山方舟: ark.cn-beijing.volces.com/api/v3
							</span>
						</div>
					</div>
				)}
			</div>

			{/* 格式说明面板 */}
			<div className="settings-panel">
				<h3 className="panel-title">📋 格式说明</h3>
				<div className="form-group full-width">
					<p className="help-text">
						<strong>音频格式:</strong> 浏览器原生不支持 MP4/MP3 格式，默认使用 WebM (Opus) 格式
					</p>
					<p className="help-text">
						<strong>视频格式:</strong> 默认使用 WebM (VP9) 高画质格式
					</p>
					<p className="help-text">
						<strong>提示:</strong> 如需其他格式，请使用转换工具进行转换
					</p>
				</div>
			</div>
		</div>
	);
}

export default SettingsPage;
