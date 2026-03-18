from http import HTTPStatus
from dashscope.audio.asr import Transcription
from urllib import request as urllib_request
import dashscope
import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)
CORS(app)

# 配置 DashScope
# 北京地域 URL，若使用新加坡地域请改为: https://dashscope-intl.aliyuncs.com/api/v1
dashscope.base_http_api_url = 'https://dashscope.aliyuncs.com/api/v1'

# 从环境变量获取 API Key，如果没有配置，请手动设置
# 获取 API Key: https://help.aliyun.com/zh/model-studio/get-api-key
dashscope.api_key = os.getenv('DASHSCOPE_API_KEY', 'sk-feff519b15ad4ad781d2b0e65a9c2702')

# 文件上传配置
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'ogg', 'webm', 'flac', 'aac', 'wma', 'mp4'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB 最大文件大小

# 创建上传目录
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 服务器公网地址配置（部署到服务器后需要设置）
# 可以通过环境变量设置，例如: https://your-domain.com
SERVER_PUBLIC_URL = os.getenv('SERVER_PUBLIC_URL', '')


def allowed_file(filename):
    """检查文件类型是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_date_folder():
    """获取日期文件夹名称"""
    return datetime.now().strftime('%Y-%m-%d')


def build_file_url(date_folder, filename, req=None):
    """
    构建文件的公网访问 URL
    优先级:
    1. 环境变量 SERVER_PUBLIC_URL
    2. 从请求中自动构建
    """
    if SERVER_PUBLIC_URL:
        return f"{SERVER_PUBLIC_URL}/uploads/{date_folder}/{filename}"
    elif req:
        # 从请求中构建 URL
        host = req.host
        scheme = req.scheme
        return f"{scheme}://{host}/uploads/{date_folder}/{filename}"
    else:
        # 返回相对路径
        return f"/uploads/{date_folder}/{filename}"


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'message': 'ASR Service is running'
    })


@app.route('/asr/transcribe', methods=['POST'])
def transcribe_audio():
    """
    音频文件转文字接口

    请求体:
    {
        "file_url": "https://example.com/audio.wav"
    }

    响应格式（与示例一致）:
    {
        "file_url": "https://example.com/audio.wav",
        "properties": {
            "audio_format": "pcm_s16le",
            "channels": [0],
            "original_sampling_rate": 16000,
            "original_duration_in_milliseconds": 3834
        },
        "transcripts": [
            {
                "channel_id": 0,
                "content_duration_in_milliseconds": 3720,
                "text": "Hello world, 这里是阿里巴巴语音实验室。",
                "sentences": [...]
            }
        ]
    }
    """
    try:
        # 获取请求参数
        data = request.get_json()

        if not data or 'file_url' not in data:
            return jsonify({
                'success': False,
                'message': '缺少 file_url 参数'
            }), 400

        file_url = data['file_url']

        # 可选参数：语言提示
        language_hints = data.get('language_hints', ['zh', 'en'])

        # 调用 DashScope ASR API
        task_response = Transcription.async_call(
            model='fun-asr',
            file_urls=[file_url],
            language_hints=language_hints
        )

        # 等待任务完成
        transcription_response = Transcription.wait(task=task_response.output.task_id)

        if transcription_response.status_code != HTTPStatus.OK:
            return jsonify({
                'success': False,
                'message': '语音识别任务失败',
                'error': transcription_response.output.message if hasattr(transcription_response.output, 'message') else 'Unknown error'
            }), 500

        # 解析识别结果
        results = []
        if hasattr(transcription_response.output, 'results') or isinstance(transcription_response.output, dict):
            output = transcription_response.output
            if isinstance(output, dict) and 'results' in output:
                results = output['results']
            elif hasattr(output, 'results'):
                results = output.results

        # 获取第一个成功的识别结果
        for transcription in results:
            subtask_status = transcription.get('subtask_status') if isinstance(transcription, dict) else getattr(transcription, 'subtask_status', None)

            if subtask_status == 'SUCCEEDED':
                transcription_url = transcription.get('transcription_url') if isinstance(transcription, dict) else getattr(transcription, 'transcription_url', None)

                if transcription_url:
                    # 从 URL 获取识别结果
                    result = json.loads(urllib_request.urlopen(transcription_url).read().decode('utf8'))

                    # 返回与示例一致的格式
                    return jsonify({
                        'success': True,
                        'data': result
                    })

        return jsonify({
            'success': False,
            'message': '语音识别失败，未获取到有效结果'
        }), 500

    except Exception as e:
        return jsonify({
            'success': False,
            'message': '语音识别失败',
            'error': str(e)
        }), 500


@app.route('/asr/transcribe/text', methods=['POST'])
def transcribe_audio_simple():
    """
    音频文件转文字接口（简化版，只返回文字）

    请求体:
    {
        "file_url": "https://example.com/audio.wav"
    }

    响应:
    {
        "success": true,
        "text": "识别的文字内容"
    }
    """
    try:
        # 获取请求参数
        data = request.get_json()

        if not data or 'file_url' not in data:
            return jsonify({
                'success': False,
                'message': '缺少 file_url 参数'
            }), 400

        file_url = data['file_url']
        language_hints = data.get('language_hints', ['zh', 'en'])

        # 调用 DashScope ASR API
        task_response = Transcription.async_call(
            model='fun-asr',
            file_urls=[file_url],
            language_hints=language_hints
        )

        # 等待任务完成
        transcription_response = Transcription.wait(task=task_response.output.task_id)

        if transcription_response.status_code != HTTPStatus.OK:
            return jsonify({
                'success': False,
                'message': '语音识别任务失败',
                'error': transcription_response.output.message if hasattr(transcription_response.output, 'message') else 'Unknown error'
            }), 500

        # 解析识别结果
        results = []
        if hasattr(transcription_response.output, 'results') or isinstance(transcription_response.output, dict):
            output = transcription_response.output
            if isinstance(output, dict) and 'results' in output:
                results = output['results']
            elif hasattr(output, 'results'):
                results = output.results

        # 提取所有文本
        texts = []
        for transcription in results:
            subtask_status = transcription.get('subtask_status') if isinstance(transcription, dict) else getattr(transcription, 'subtask_status', None)

            if subtask_status == 'SUCCEEDED':
                transcription_url = transcription.get('transcription_url') if isinstance(transcription, dict) else getattr(transcription, 'transcription_url', None)

                if transcription_url:
                    result = json.loads(urllib_request.urlopen(transcription_url).read().decode('utf8'))

                    # 提取文本
                    if isinstance(result, dict) and 'transcripts' in result:
                        for transcript in result['transcripts']:
                            if 'text' in transcript:
                                texts.append(transcript['text'])

        return jsonify({
            'success': True,
            'text': '\n'.join(texts) if texts else ''
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': '语音识别失败',
            'error': str(e)
        }), 500


@app.route('/uploads/<path:date>/<path:filename>')
def serve_uploaded_file(date, filename):
    """
    提供上传文件的访问服务
    通过此接口可以通过公网 URL 访问上传的文件
    """
    directory = os.path.join(app.config['UPLOAD_FOLDER'], date)
    return send_from_directory(directory, filename)


@app.route('/asr/upload-and-transcribe', methods=['POST'])
def upload_and_transcribe():
    """
    文件上传并语音识别接口（一体化）

    接收用户上传的音频文件 -> 保存到本地 -> 生成公网 URL
    -> 调用 ASR 识别 -> 返回识别文字

    请求方式: multipart/form-data
    参数:
        - file: 音频文件 (必需)
        - language_hints: 语言提示，如 "zh,en" (可选，默认 "zh,en")

    响应示例:
    {
        "success": true,
        "text": "识别的文字内容",
        "file_url": "https://your-domain.com/uploads/2026-03-18/audio_1234567890.wav",
        "original_name": "audio.wav",
        "file_size": 102400
    }
    """
    try:
        # 检查是否有文件
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': '没有上传文件，请使用 "file" 字段上传音频文件'
            }), 400

        file = request.files['file']

        # 检查文件名
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': '文件名为空'
            }), 400

        # 检查文件类型
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'message': f'不支持的文件格式，支持的格式: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400

        # 保存文件
        date_folder = get_date_folder()
        save_dir = os.path.join(app.config['UPLOAD_FOLDER'], date_folder)
        os.makedirs(save_dir, exist_ok=True)

        # 生成安全的文件名
        filename = secure_filename(file.filename)
        timestamp = int(datetime.now().timestamp() * 1000)
        name, ext = os.path.splitext(filename)
        saved_filename = f"{name}_{timestamp}{ext}"
        file_path = os.path.join(save_dir, saved_filename)

        # 保存文件
        file.save(file_path)
        file_size = os.path.getsize(file_path)

        # 构建公网访问 URL
        public_url = build_file_url(date_folder, saved_filename, request)

        # 获取语言提示参数
        language_hints_str = request.form.get('language_hints', 'zh,en')
        language_hints = [lang.strip() for lang in language_hints_str.split(',')]

        # 调用 ASR 接口识别
        task_response = Transcription.async_call(
            model='fun-asr',
            file_urls=[public_url],
            language_hints=language_hints
        )

        # 等待任务完成
        transcription_response = Transcription.wait(task=task_response.output.task_id)

        if transcription_response.status_code != HTTPStatus.OK:
            return jsonify({
                'success': False,
                'message': '语音识别任务失败',
                'file_url': public_url,
                'error': transcription_response.output.message if hasattr(transcription_response.output, 'message') else 'Unknown error'
            }), 500

        # 解析识别结果
        results = []
        if hasattr(transcription_response.output, 'results') or isinstance(transcription_response.output, dict):
            output = transcription_response.output
            if isinstance(output, dict) and 'results' in output:
                results = output['results']
            elif hasattr(output, 'results'):
                results = output.results

        # 提取所有文本
        texts = []
        for transcription in results:
            subtask_status = transcription.get('subtask_status') if isinstance(transcription, dict) else getattr(transcription, 'subtask_status', None)

            if subtask_status == 'SUCCEEDED':
                transcription_url = transcription.get('transcription_url') if isinstance(transcription, dict) else getattr(transcription, 'transcription_url', None)

                if transcription_url:
                    result = json.loads(urllib_request.urlopen(transcription_url).read().decode('utf8'))

                    # 提取文本
                    if isinstance(result, dict) and 'transcripts' in result:
                        for transcript in result['transcripts']:
                            if 'text' in transcript:
                                texts.append(transcript['text'])

        return jsonify({
            'success': True,
            'text': '\n'.join(texts) if texts else '',
            'file_url': public_url,
            'original_name': file.filename,
            'saved_name': saved_filename,
            'file_size': file_size,
            'upload_time': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': '文件上传或语音识别失败',
            'error': str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('ASR_PORT', 6003))
    print(f"ASR Simple Service 运行在 http://0.0.0.0:{port}")
    print(f"API Key: {dashscope.api_key[:10]}...")
    app.run(host='0.0.0.0', port=port, debug=True)
