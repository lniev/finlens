# React 版本开发指南

## 项目结构

```
finlens/
├── public/
│   ├── manifest.json      # 扩展配置
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── main.jsx           # React 入口
│   ├── App.jsx            # 主组件（Popup）
│   ├── index.css          # 全局样式
│   └── App.css            # App 组件样式
├── content.js             # Content Script（保持原样）
├── background.js          # Background Script（保持原样）
├── popup.html             # Popup 入口 HTML
├── vite.config.js         # Vite 配置
├── build-extension.js     # 构建脚本
└── package.json
```

## 安装依赖

```bash
npm install
```

## 开发

开发模式目前主要用于组件预览，实际功能需要在扩展环境中测试：

```bash
npm run dev
```

## 构建

构建用于生产的扩展：

```bash
npm run build
```

构建产物会生成在 `dist/` 目录。

## 安装扩展（构建后）

1. 构建项目：`npm run build`
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `dist` 目录（**不是**项目根目录！）

## 开发工作流

1. 修改 React 组件（`src/App.jsx` 等）
2. 运行 `npm run build` 重新构建
3. 在 `chrome://extensions/` 页面点击刷新按钮
4. 测试功能

## 主要文件说明

### src/App.jsx
- React 主组件
- 包含所有 popup UI 和逻辑
- 使用 Hooks 管理状态

### content.js 和 background.js
- 保持原样，不需要修改
- 构建时会自动复制到 dist/ 目录

### public/manifest.json
- 扩展配置文件
- 注意：修改后需要重新构建

## 技术栈

- **React 18** - UI 框架
- **Vite 5** - 构建工具
- **Chrome Extensions Manifest V3**

## 注意事项

1. **测试前请先构建**：React 代码需要构建后才能在扩展中使用
2. **使用 dist 目录**：加载扩展时请选择 `dist` 目录
3. **刷新扩展**：每次修改代码后需要：
   - 重新构建：`npm run build`
   - 在 `chrome://extensions/` 刷新扩展

## 故障排除

**问题：React 更改没有生效？**
- 确保运行了 `npm run build`
- 在 `chrome://extensions/` 刷新扩展
- 关闭并重新打开 popup

**问题：找不到图标或配置？**
- 确保 `public/` 目录下的文件完整
- 重新运行 `npm run build`
