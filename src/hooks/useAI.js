import { useCallback, useState } from "react";
import { blobToDataUri } from "../utils/media";

export const useAI = (aiConfig, audioChunksRef) => {
	const [transcribing, setTranscribing] = useState(false);
	const [summarizing, setSummarizing] = useState(false);
	const [transcriptResult, setTranscriptResult] = useState("");
	const [summaryResult, setSummaryResult] = useState("");
	const [summaryModel, setSummaryModel] = useState("kimi-k2.5");

	// 从文件路径读取并转录音频
	const transcribeAudioFromFile = useCallback(async (filePath) => {
		if (!aiConfig.enabled || !aiConfig.apiKey) {
			alert("请先在设置中启用AI功能并配置API Key");
			return null;
		}

		if (!filePath) {
			alert("音频文件路径不存在");
			return null;
		}

		setTranscribing(true);
		setTranscriptResult("");

		try {
			// 使用 fetch 读取本地文件
			const response = await fetch(`file:///${filePath}`);
			if (!response.ok) {
				throw new Error(`无法读取音频文件: ${response.status}`);
			}

			const audioBlob = await response.blob();

			// 将音频文件转换为 Base64 Data URI
			const dataUri = await blobToDataUri(audioBlob);

			// 构建请求消息
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
			const apiResponse = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
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

			if (!apiResponse.ok) {
				const errorText = await apiResponse.text();
				throw new Error(`API请求失败: ${apiResponse.status} - ${errorText}`);
			}

			const data = await apiResponse.json();
			const transcript =
				data.choices?.[0]?.message?.content || "无法识别音频内容";
			setTranscriptResult(transcript);
			return transcript;
		} catch (error) {
			console.error("转录失败:", error);
			alert(`转录失败: ${error.message}`);
			return null;
		} finally {
			setTranscribing(false);
		}
	}, [aiConfig]);

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

		return await summarizeText(textToSummarize);
	}, [aiConfig, transcriptResult]);

	// 总结指定文本（用于历史记录）
	const summarizeText = useCallback(async (textToSummarize) => {
		if (!aiConfig.enabled || !aiConfig.apiKey) {
			alert("请先在设置中启用AI功能并配置API Key");
			return null;
		}

		if (!textToSummarize) {
			alert("转录文本为空");
			return null;
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
					model: summaryModel,
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
			return summary;
		} catch (error) {
			console.error("总结失败:", error);
			alert(
				`总结失败: ${error.message}\n\n请参考文档：https://help.aliyun.com/model-studio/developer-reference/error-code`,
			);
			return null;
		} finally {
			setSummarizing(false);
		}
	}, [aiConfig, summaryModel]);

	return {
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
	};
};
