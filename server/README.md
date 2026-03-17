# FinLens 文件上传服务器

## 功能说明

- 接收插件上传的音频和视频文件
- 按日期自动创建文件夹存储
- 文件名添加时间戳防止重复
- 支持文件列表查询和删除

## 安装和运行

```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 启动服务器
npm start

# 开发模式（自动重启）
npm run dev
```

## API 接口

### 健康检查
```
GET /health
```

### 单文件上传
```
POST /upload
Content-Type: multipart/form-data

参数:
- file: 文件数据
- filename: 自定义文件名（可选）
```

### 多文件上传
```
POST /upload/multiple
Content-Type: multipart/form-data

参数:
- files: 多个文件数据
- filename: 自定义文件名前缀（可选）
```

### 获取文件列表
```
GET /files
```

### 删除文件
```
DELETE /files/:date/:filename
```

## 文件存储结构

```
uploads/
├── 2024-01-15/
│   ├── recording_1705312800000.webm
│   └── meeting_1705312900000.webm
├── 2024-01-16/
│   └── live_1705399200000.webm
```

## 部署说明

1. 将 `server` 目录上传到服务器
2. 运行 `npm install` 安装依赖
3. 运行 `npm start` 启动服务
4. 默认端口 3000，可通过环境变量 `PORT` 修改

## 生产环境建议

- 使用 PM2 管理进程: `pm2 start server.js`
- 配置 Nginx 反向代理
- 设置防火墙规则
- 定期清理旧文件
