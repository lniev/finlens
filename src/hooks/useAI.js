import { useCallback, useState } from "react";
import { blobToDataUri } from "../utils/media";

export const useAI = (aiConfig, audioChunksRef) => {
	const [transcribing, setTranscribing] = useState(false);
	const [summarizing, setSummarizing] = useState(false);
	const [transcriptResult, setTranscriptResult] = useState("");
	const [summaryResult, setSummaryResult] = useState("");

	// 音频转文字（参考 quickTest 函数，使用 input_audio 格式）
	const transcribeAudio = useCallback(async () => {
		if (!aiConfig.enabled || !aiConfig.apiKey) {
			alert("请先在设置中启用AI功能并配置API Key");
			return;
		}

		if (audioChunksRef.current.length === 0) {
			alert("没有可用的音频数据，请先录制音频");
			return;
		}

		setTranscribing(true);
		setTranscriptResult("");

		try {
			// 将音频转换为 Blob
			const audioBlob = new Blob(audioChunksRef.current, {
				type: "audio/webm",
			});

			// 将音频文件转换为 Base64 Data URI（参考 quickTest 函数）
			const dataUri = await blobToDataUri(audioBlob);

			// 构建请求消息（参考 quickTest 函数的格式）
			const testMessage = [
				{
					role: "user",
					content: [
						{
							type: "input_audio",
							input_audio: {
								data: dataUri,
							},
						},
					],
				},
			];

			// 发送请求到百炼 API
			const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${aiConfig.apiKey}`,
				},
				body: JSON.stringify({
					model: aiConfig.modelId || "qwen3-asr-flash",
					messages: testMessage,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`API请求失败: ${response.status} - ${errorText}`);
			}

			const data = await response.json();
			const transcript =
				data.choices?.[0]?.message?.content || "无法识别音频内容";
			setTranscriptResult(transcript);
		} catch (error) {
			console.error("转录失败:", error);
			alert(
				`转录失败: ${error.message}\n\n请参考文档：https://help.aliyun.com/model-studio/developer-reference/error-code`,
			);
		} finally {
			setTranscribing(false);
		}
	}, [aiConfig, audioChunksRef]);

	// 内容总结（OpenAI兼容模式）
	const summarizeContent = useCallback(async () => {
		if (!aiConfig.enabled || !aiConfig.apiKey) {
			alert("请先在设置中启用AI功能并配置API Key");
			return;
		}

		const textToSummarize = transcriptResult;
		if (!textToSummarize) {
			alert("请先进行音频转录");
			return;
		}

		setSummarizing(true);
		setSummaryResult("");

		try {
			// 使用OpenAI兼容模式调用大模型API
			const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${aiConfig.apiKey}`,
				},
				body: JSON.stringify({
					// model: aiConfig.modelId || "qwen-plus",
					model: "kimi-k2.5",
					messages: [
						{
							role: "system",
							content:
								"你是一个专业的内容总结助手，请用简洁明了的语言总结以下内容，提取关键要点。",
						},
						{
							role: "user",
							content: `请总结以下内容：\n\n${textToSummarize}`,
						},
					],
					temperature: 0.7,
					max_tokens: 1000,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`API请求失败: ${response.status} - ${errorText}`);
			}

			const data = await response.json();
			const summary = data.choices?.[0]?.message?.content || "无法生成总结";
			setSummaryResult(summary);
		} catch (error) {
			console.error("总结失败:", error);
			alert(
				`总结失败: ${error.message}\n\n请参考文档：https://help.aliyun.com/model-studio/developer-reference/error-code`,
			);
		} finally {
			setSummarizing(false);
		}
	}, [aiConfig, transcriptResult]);

	return {
		transcribing,
		summarizing,
		transcriptResult,
		summaryResult,
		transcribeAudio,
		summarizeContent,
	};
};
