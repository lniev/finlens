import fs from "fs";
import OpenAI from "openai";
import path from "path";
import readline from "readline";

// ==================== 配置区域 ====================
// 百炼API配置
const API_KEY = "sk-7b606dc189aa4255a9eca033bc089618"; // 替换为您的百炼API Key
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL = "qwen-turbo"; // 或其他百炼支持的模型

// 初始化OpenAI客户端
const client = new OpenAI({
	apiKey: API_KEY,
	baseURL: BASE_URL,
});

// ==================== 会话管理 ====================
class ConversationManager {
	constructor() {
		this.messages = [];
		this.conversationId = Date.now().toString();
	}

	// 添加用户消息
	addUserMessage(content, fileUrl = null) {
		const message = {
			role: "user",
			content: fileUrl
				? [
						{ type: "text", text: content },
						{ type: "image_url", image_url: { url: fileUrl } },
					]
				: content,
		};
		this.messages.push(message);
	}

	// 添加助手消息
	addAssistantMessage(content) {
		this.messages.push({
			role: "assistant",
			content: content,
		});
	}

	// 获取所有消息
	getMessages() {
		return this.messages;
	}

	// 清空会话
	clear() {
		this.messages = [];
		console.log("会话已清空");
	}

	// 保存会话到文件
	saveToFile(filePath = null) {
		const savePath = filePath || `./conversation_${this.conversationId}.json`;
		fs.writeFileSync(savePath, JSON.stringify(this.messages, null, 2), "utf-8");
		console.log(`会话已保存到: ${savePath}`);
		return savePath;
	}

	// 从文件加载会话
	loadFromFile(filePath) {
		if (fs.existsSync(filePath)) {
			const data = fs.readFileSync(filePath, "utf-8");
			this.messages = JSON.parse(data);
			console.log(`已从 ${filePath} 加载会话`);
			return true;
		}
		console.log(`文件不存在: ${filePath}`);
		return false;
	}

	// 显示会话历史
	showHistory() {
		console.log("\n========== 会话历史 ==========");
		this.messages.forEach((msg, index) => {
			const role = msg.role === "user" ? "用户" : "助手";
			const content =
				typeof msg.content === "string" ? msg.content : "[包含文件/图片]";
			console.log(`\n[${index + 1}] ${role}:`);
			console.log(
				content.substring(0, 200) + (content.length > 200 ? "..." : ""),
			);
		});
		console.log("\n==============================\n");
	}
}

// ==================== 文件处理 ====================
class FileManager {
	// 读取文件为Base64
	static fileToBase64(filePath) {
		try {
			const fileBuffer = fs.readFileSync(filePath);
			const base64 = fileBuffer.toString("base64");
			const ext = path.extname(filePath).toLowerCase();

			// 根据文件类型返回不同的data URL
			const mimeTypes = {
				".jpg": "image/jpeg",
				".jpeg": "image/jpeg",
				".png": "image/png",
				".gif": "image/gif",
				".webp": "image/webp",
				".pdf": "application/pdf",
				".txt": "text/plain",
			};

			const mimeType = mimeTypes[ext] || "application/octet-stream";
			return `data:${mimeType};base64,${base64}`;
		} catch (error) {
			console.error("文件读取失败:", error.message);
			return null;
		}
	}

	// 检查文件是否存在
	static exists(filePath) {
		return fs.existsSync(filePath);
	}

	// 获取支持的图片格式
	static isImageFile(filePath) {
		const ext = path.extname(filePath).toLowerCase();
		return [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
	}
}

// ==================== API测试 ====================
class APITester {
	constructor(conversationManager) {
		this.conversation = conversationManager;
	}

	// 测试简单文本请求
	async testTextRequest(message) {
		try {
			console.log("\n📝 发送文本请求...");

			this.conversation.addUserMessage(message);

			const response = await client.chat.completions.create({
				model: MODEL,
				messages: this.conversation.getMessages(),
				temperature: 0.7,
			});

			const reply = response.choices[0].message.content;
			this.conversation.addAssistantMessage(reply);

			console.log("✅ 请求成功！");
			console.log("\n🤖 助手回复:");
			console.log(reply);

			return reply;
		} catch (error) {
			console.error("❌ 请求失败:", error.message);
			if (error.response) {
				console.error("错误详情:", error.response.data);
			}
			return null;
		}
	}

	// 测试带图片的请求
	async testImageRequest(message, imagePath) {
		try {
			console.log("\n🖼️ 发送图片请求...");

			if (!FileManager.exists(imagePath)) {
				console.error("❌ 图片文件不存在:", imagePath);
				return null;
			}

			const base64Image = FileManager.fileToBase64(imagePath);
			if (!base64Image) {
				console.error("❌ 图片转换失败");
				return null;
			}

			this.conversation.addUserMessage(message, base64Image);

			const response = await client.chat.completions.create({
				model: MODEL,
				messages: this.conversation.getMessages(),
				temperature: 0.7,
			});

			const reply = response.choices[0].message.content;
			this.conversation.addAssistantMessage(reply);

			console.log("✅ 图片请求成功！");
			console.log("\n🤖 助手回复:");
			console.log(reply);

			return reply;
		} catch (error) {
			console.error("❌ 图片请求失败:", error.message);
			return null;
		}
	}

	// 测试流式响应
	async testStreamRequest(message) {
		try {
			console.log("\n🌊 发送流式请求...");

			this.conversation.addUserMessage(message);

			const stream = await client.chat.completions.create({
				model: MODEL,
				messages: this.conversation.getMessages(),
				stream: true,
				temperature: 0.7,
			});

			console.log("\n🤖 助手回复 (流式):");
			let fullReply = "";

			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content || "";
				process.stdout.write(content);
				fullReply += content;
			}

			console.log("\n");
			this.conversation.addAssistantMessage(fullReply);

			return fullReply;
		} catch (error) {
			console.error("❌ 流式请求失败:", error.message);
			return null;
		}
	}
}

// ==================== 交互式CLI ====================
class InteractiveCLI {
	constructor() {
		this.conversation = new ConversationManager();
		this.tester = new APITester(this.conversation);
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
	}

	printMenu() {
		console.log("\n========== 百炼API测试工具 ==========");
		console.log("1. 测试简单文本请求");
		console.log("2. 测试带图片的请求");
		console.log("3. 测试流式响应");
		console.log("4. 查看会话历史");
		console.log("5. 保存会话到文件");
		console.log("6. 从文件加载会话");
		console.log("7. 清空会话");
		console.log("8. 连续对话模式");
		console.log("0. 退出");
		console.log("=====================================\n");
	}

	async askQuestion(question) {
		return new Promise(resolve => {
			this.rl.question(question, answer => {
				resolve(answer.trim());
			});
		});
	}

	async run() {
		console.log("欢迎使用百炼API测试工具！");
		console.log(`当前配置: ${BASE_URL}`);
		console.log(`使用模型: ${MODEL}`);

		while (true) {
			this.printMenu();
			const choice = await this.askQuestion("请选择操作 (0-8): ");

			switch (choice) {
				case "1": {
					const message = await this.askQuestion("请输入消息: ");
					await this.tester.testTextRequest(message);
					break;
				}

				case "2": {
					const message = await this.askQuestion("请输入消息: ");
					const imagePath = await this.askQuestion("请输入图片路径: ");
					await this.tester.testImageRequest(message, imagePath);
					break;
				}

				case "3": {
					const message = await this.askQuestion("请输入消息: ");
					await this.tester.testStreamRequest(message);
					break;
				}

				case "4": {
					this.conversation.showHistory();
					break;
				}

				case "5": {
					const filePath = await this.askQuestion(
						"请输入保存路径 (直接回车使用默认): ",
					);
					this.conversation.saveToFile(filePath || null);
					break;
				}

				case "6": {
					const filePath = await this.askQuestion("请输入文件路径: ");
					this.conversation.loadFromFile(filePath);
					break;
				}

				case "7": {
					this.conversation.clear();
					break;
				}

				case "8": {
					await this.chatMode();
					break;
				}

				case "0": {
					console.log("再见！");
					this.rl.close();
					return;
				}

				default: {
					console.log("无效的选择，请重试");
				}
			}
		}
	}

	async chatMode() {
		console.log("\n========== 连续对话模式 ==========");
		console.log("输入 /image <路径> 发送图片");
		console.log("输入 /save 保存会话");
		console.log("输入 /clear 清空会话");
		console.log("输入 /exit 退出对话模式");
		console.log("================================\n");

		while (true) {
			const input = await this.askQuestion("你: ");

			if (input === "/exit") {
				console.log("退出对话模式");
				break;
			}

			if (input === "/clear") {
				this.conversation.clear();
				continue;
			}

			if (input === "/save") {
				this.conversation.saveToFile();
				continue;
			}

			if (input.startsWith("/image ")) {
				const imagePath = input.slice(7).trim();
				const message = await this.askQuestion("请输入消息: ");
				await this.tester.testImageRequest(message, imagePath);
			} else {
				await this.tester.testStreamRequest(input);
			}
		}
	}
}

// ==================== 快速测试函数 ====================

// 快速测试API连通性
async function quickTest() {
	console.log("🧪 快速测试百炼API连通性...");
	const projectDir = process.cwd();
	console.log(`📁 项目目录: ${projectDir}`);
	// 定义测试文件路径（使用绝对路径）
	const testFile = path.join(projectDir, "01.webm");
	const encodeAudioFile = audioFilePath => {
		const audioFile = fs.readFileSync(audioFilePath);
		return audioFile.toString("base64");
	};
	const dataUri = `data:audio/mpeg;base64,${encodeAudioFile(testFile)}`;
	try {
		// 检查是否存在测试文件
		let testMessage = [
			{
				content: [
					{
						type: "input_audio",
						input_audio: {
							data: dataUri,
						},
					},
				],
				role: "user",
			},
		];
		const response = await client.chat.completions.create({
			model: "qwen3-asr-flash",
			messages: testMessage,
		});

		console.log("✅ API连接成功！");
		console.log("🤖 回复:", response.choices[0].message.content);
		return true;
	} catch (error) {
		console.error("❌ API连接失败:", error.message);
		if (error.response) {
			console.error("错误详情:", error.response.data);
		}
		return false;
	}
}

// ==================== 主程序 ====================
async function main() {
	// 检查API Key是否已配置
	if (API_KEY === "YOUR_BAILIAN_API_KEY") {
		console.log("⚠️ 警告: 请先配置您的百炼API Key！");
		console.log("请修改文件中的 API_KEY 变量");
		return;
	}

	const args = process.argv.slice(2);

	// 如果带参数运行，执行快速测试
	if (args.includes("--quick") || args.includes("-q")) {
		await quickTest();
		return;
	}

	// 否则启动交互式CLI
	const cli = new InteractiveCLI();
	await cli.run();
}

// 运行程序
main().catch(console.error);
