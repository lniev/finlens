import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 源目录和目标目录
const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

// 确保 dist 目录存在
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('创建 dist 目录');
}

// 需要复制的文件
const filesToCopy = ['content.js', 'background.js'];

console.log('复制必要文件到 dist 目录...');

filesToCopy.forEach((file) => {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(distDir, file);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ 已复制: ${file}`);
  } else {
    console.warn(`⚠️ 文件不存在: ${file}`);
  }
});

console.log('\n📦 构建完成！');
console.log('\n下一步操作:');
console.log('1. 打开 Chrome 浏览器，访问 chrome://extensions/');
console.log('2. 启用"开发者模式"');
console.log('3. 点击"加载已解压的扩展程序"');
console.log('4. 选择 dist 目录');
console.log('5. 开始使用！');
