const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 6001;

// 启用 CORS
app.use(cors());

// 解析 JSON 请求体
app.use(express.json());

// 静态文件服务（用于访问上传的文件）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 按日期创建文件夹
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const dateDir = path.join(uploadsDir, dateStr);

    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }

    cb(null, dateDir);
  },
  filename: function (req, file, cb) {
    // 获取用户提供的文件名或原始文件名
    const customName = req.body.filename || file.originalname;
    const timestamp = Date.now();
    const ext = path.extname(customName) || path.extname(file.originalname);
    const baseName = path.basename(customName, ext);

    // 文件名格式: 自定义名称_时间戳.扩展名
    const finalName = `${baseName}_${timestamp}${ext}`;
    cb(null, finalName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 限制 1GB
  }
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FinLens Server is running',
    timestamp: new Date().toISOString()
  });
});

// 单文件上传接口
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    const fileUrl = `/uploads/${req.file.destination.split('uploads/')[1]}/${req.file.filename}`;

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        originalName: req.body.filename || req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
        url: fileUrl,
        uploadTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({
      success: false,
      message: '文件上传失败',
      error: error.message
    });
  }
});

// 多文件上传接口（同时上传音频和视频）
app.post('/upload/multiple', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    const files = req.files.map(file => ({
      originalName: req.body.filename || file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${file.destination.split('uploads/')[1]}/${file.filename}`
    }));

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        files: files,
        uploadTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({
      success: false,
      message: '文件上传失败',
      error: error.message
    });
  }
});

// 获取文件列表接口
app.get('/files', (req, res) => {
  try {
    const files = [];

    // 遍历 uploads 目录
    const dates = fs.readdirSync(uploadsDir);

    dates.forEach(date => {
      const datePath = path.join(uploadsDir, date);
      if (fs.statSync(datePath).isDirectory()) {
        const dateFiles = fs.readdirSync(datePath);
        dateFiles.forEach(filename => {
          const filePath = path.join(datePath, filename);
          const stats = fs.statSync(filePath);
          files.push({
            filename: filename,
            date: date,
            size: stats.size,
            uploadTime: stats.mtime,
            url: `/uploads/${date}/${filename}`
          });
        });
      }
    });

    // 按时间倒序排列
    files.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));

    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('获取文件列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取文件列表失败',
      error: error.message
    });
  }
});

// 删除文件接口
app.delete('/files/:date/:filename', (req, res) => {
  try {
    const { date, filename } = req.params;
    const filePath = path.join(uploadsDir, date, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: '文件删除成功'
    });
  } catch (error) {
    console.error('删除文件错误:', error);
    res.status(500).json({
      success: false,
      message: '删除文件失败',
      error: error.message
    });
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`FinLens Server 运行在 http://0.0.0.0:${PORT}`);
  console.log(`上传目录: ${uploadsDir}`);
});

module.exports = app;
