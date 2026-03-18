import os
import base64
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime
import dashscope
from dashscope import Transcription

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'ogg', 'webm', 'flac', 'aac', 'wma'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 配置 dashscope
# dashscope.api_key = os.getenv('DASHSCOPE_API_KEY', '')
dashscope.api_key = 'sk-feff519b15ad4ad781d2b0e65a9c2702'
# 北京地域，若使用新加坡地域请改为: https://dashscope-intl.aliyuncs.com/api/v1
dashscope.base_http_api_url = 'https://dashscope.aliyuncs.com/api/v1'

# 配置服务器公网地址（用于生成文件URL）
# 可以通过环境变量设置，默认为空，使用相对路径
SERVER_PUBLIC_URL = os.getenv('SERVER_PUBLIC_URL', '')  # 例如: https://your-domain.com


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_date_folder():
    return datetime.now().strftime('%Y-%m-%d')


def build_file_url(date_folder, filename, request=None):
    """
    构建文件的公网访问URL
    """
    if SERVER_PUBLIC_URL:
        # 使用配置的公网地址
        return f"{SERVER_PUBLIC_URL}/uploads/{date_folder}/{filename}"
    elif request:
        # 从请求中构建URL
        host = request.host
        scheme = request.scheme
        return f"{scheme}://{host}/uploads/{date_folder}/{filename}"
    else:
        # 返回相对路径
        return f"/uploads/{date_folder}/{filename}"


def call_asr_api(file_urls, model='qwen3-asr-flash-filetrans', **kwargs):
    """
    使用 dashscope SDK 调用阿里云百炼语音识别模型进行录音文件识别
    """
    # 提交异步任务
    task_response = Transcription.async_call(
        model=model,
        file_urls=file_urls,
        **kwargs
    )

    # 检查响应状态
    if task_response.status_code != 200:
        error_msg = f"API调用失败: status_code={task_response.status_code}"
        if hasattr(task_response, 'message') and task_response.message:
            error_msg += f", message={task_response.message}"
        if hasattr(task_response, 'code') and task_response.code:
            error_msg += f", code={task_response.code}"
        raise Exception(error_msg)

    if not hasattr(task_response, 'output') or task_response.output is None:
        raise Exception("API返回结果中没有output字段")

    if not hasattr(task_response.output, 'task_id') or task_response.output.task_id is None:
        raise Exception("API返回结果中没有task_id")

    # 等待任务完成并获取结果
    task_result = Transcription.wait(task=task_response.output.task_id)

    # 检查任务结果
    if task_result.status_code != 200:
        error_msg = f"任务执行失败: status_code={task_result.status_code}"
        if hasattr(task_result, 'message') and task_result.message:
            error_msg += f", message={task_result.message}"
        raise Exception(error_msg)

    return task_result


def extract_transcription_text(task_result):
    """
    从任务结果中提取识别文本
    """
    try:
        if hasattr(task_result, 'output') and task_result.output:
            output = task_result.output
            # Transcription 返回的结果结构
            if hasattr(output, 'results') and output.results:
                texts = []
                for result in output.results:
                    if hasattr(result, 'text'):
                        texts.append(result.text)
                    elif isinstance(result, dict) and 'text' in result:
                        texts.append(result['text'])
                return '\n'.join(texts)
            if hasattr(output, 'text'):
                return output.text
        return ''
    except Exception as e:
        print(f"提取文本出错: {e}")
        return ''


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'message': 'ASR Service is running',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/uploads/<path:date>/<path:filename>')
def serve_file(date, filename):
    """
    提供上传文件的访问服务
    """
    directory = os.path.join(app.config['UPLOAD_FOLDER'], date)
    return send_from_directory(directory, filename)


@app.route('/upload', methods=['POST'])
def upload_file():
    """
    文件上传接口
    接收文件并保存，返回可公网访问的URL
    """
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': '没有上传文件'
            }), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({
                'success': False,
                'message': '文件名为空'
            }), 400

        # 保存文件
        date_folder = get_date_folder()
        save_dir = os.path.join(app.config['UPLOAD_FOLDER'], date_folder)
        os.makedirs(save_dir, exist_ok=True)

        filename = secure_filename(file.filename)
        timestamp = int(datetime.now().timestamp() * 1000)
        name, ext = os.path.splitext(filename)
        saved_filename = f"{name}_{timestamp}{ext}"
        file_path = os.path.join(save_dir, saved_filename)

        file.save(file_path)

        # 构建公网访问URL
        public_url = build_file_url(date_folder, saved_filename, request)

        return jsonify({
            'success': True,
            'message': '文件上传成功',
            'data': {
                'originalName': file.filename,
                'filename': saved_filename,
                'size': os.path.getsize(file_path),
                'path': file_path,
                'url': public_url,
                'uploadTime': datetime.now().isoformat()
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': '文件上传失败',
            'error': str(e)
        }), 500


@app.route('/asr/filetotext', methods=['POST'])
def asr_file_to_text():
    """
    文件上传并语音识别接口
    接收文件 -> 保存 -> 获取公网URL -> 调用ASR识别 -> 返回文本
    """
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': '没有上传文件'
            }), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({
                'success': False,
                'message': '文件名为空'
            }), 400

        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'message': f'不支持的文件格式，支持的格式: {", ".join(ALLOWED_EXTENSIONS)}'
            }), 400

        # 保存文件
        date_folder = get_date_folder()
        save_dir = os.path.join(app.config['UPLOAD_FOLDER'], date_folder)
        os.makedirs(save_dir, exist_ok=True)

        filename = secure_filename(file.filename)
        timestamp = int(datetime.now().timestamp() * 1000)
        name, ext = os.path.splitext(filename)
        saved_filename = f"{name}_{timestamp}{ext}"
        file_path = os.path.join(save_dir, saved_filename)

        file.save(file_path)

        # 构建公网访问URL
        public_url = build_file_url(date_folder, saved_filename, request)

        # 获取ASR参数
        model = request.form.get('model', 'qwen3-asr-flash-filetrans')

        # 构建额外参数
        kwargs = {}
        if request.form.get('diarization_enabled'):
            kwargs['diarization_enabled'] = request.form.get('diarization_enabled').lower() == 'true'
        if request.form.get('speaker_count'):
            kwargs['speaker_count'] = int(request.form.get('speaker_count'))
        if request.form.get('disfluency_removal_enabled'):
            kwargs['disfluency_removal_enabled'] = request.form.get('disfluency_removal_enabled').lower() == 'true'
        if request.form.get('timestamp_alignment_enabled'):
            kwargs['timestamp_alignment_enabled'] = request.form.get('timestamp_alignment_enabled').lower() == 'true'
        if request.form.get('audio_event_detection_enabled'):
            kwargs['audio_event_detection_enabled'] = request.form.get('audio_event_detection_enabled').lower() == 'true'
        if request.form.get('special_word_filter'):
            kwargs['special_word_filter'] = request.form.get('special_word_filter')
        if request.form.get('phrase_id'):
            kwargs['phrase_id'] = request.form.get('phrase_id')

        # 调用ASR API
        task_result = call_asr_api([public_url], model=model, **kwargs)

        # 提取识别结果
        transcribed_text = extract_transcription_text(task_result)

        # 获取详细的识别结果
        results_detail = []
        if hasattr(task_result.output, 'results') and task_result.output.results:
            for result in task_result.output.results:
                result_dict = {}
                if hasattr(result, 'text'):
                    result_dict['text'] = result.text
                if hasattr(result, 'begin_time'):
                    result_dict['begin_time'] = result.begin_time
                if hasattr(result, 'end_time'):
                    result_dict['end_time'] = result.end_time
                if hasattr(result, 'speaker_id'):
                    result_dict['speaker_id'] = result.speaker_id
                if hasattr(result, 'words') and result.words:
                    result_dict['words'] = result.words
                results_detail.append(result_dict)

        return jsonify({
            'success': True,
            'message': '语音识别成功',
            'data': {
                'text': transcribed_text,
                'fileUrl': public_url,
                'originalName': file.filename,
                'filename': saved_filename,
                'size': os.path.getsize(file_path),
                'taskId': task_result.output.task_id if hasattr(task_result, 'output') and task_result.output else None,
                'status': task_result.output.task_status if hasattr(task_result, 'output') and hasattr(task_result.output, 'task_status') else 'unknown',
                'results': results_detail,
                'processTime': datetime.now().isoformat()
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': '语音识别失败',
            'error': str(e)
        }), 500


@app.route('/asr/url', methods=['POST'])
def asr_transcribe_url():
    """
    通过音频URL进行语音识别

    请求体示例:
    {
        "url": "https://example.com/audio.wav",
        "model": "qwen3-asr-flash-filetrans",
        "diarization_enabled": false,
        "speaker_count": 2,
        "disfluency_removal_enabled": false,
        "timestamp_alignment_enabled": false,
        "audio_event_detection_enabled": false
    }
    """
    try:
        data = request.get_json()

        if not data or 'url' not in data:
            return jsonify({
                'success': False,
                'message': '缺少url字段'
            }), 400

        file_url = data['url']
        model = data.get('model', 'qwen3-asr-flash-filetrans')

        # 构建额外参数
        kwargs = {}
        if 'diarization_enabled' in data:
            kwargs['diarization_enabled'] = data['diarization_enabled']
        if 'speaker_count' in data:
            kwargs['speaker_count'] = data['speaker_count']
        if 'disfluency_removal_enabled' in data:
            kwargs['disfluency_removal_enabled'] = data['disfluency_removal_enabled']
        if 'timestamp_alignment_enabled' in data:
            kwargs['timestamp_alignment_enabled'] = data['timestamp_alignment_enabled']
        if 'audio_event_detection_enabled' in data:
            kwargs['audio_event_detection_enabled'] = data['audio_event_detection_enabled']
        if 'special_word_filter' in data:
            kwargs['special_word_filter'] = data['special_word_filter']
        if 'phrase_id' in data:
            kwargs['phrase_id'] = data['phrase_id']

        # 调用ASR API
        task_result = call_asr_api([file_url], model=model, **kwargs)

        # 提取识别结果
        transcribed_text = extract_transcription_text(task_result)

        # 获取详细的识别结果
        results_detail = []
        if hasattr(task_result.output, 'results') and task_result.output.results:
            for result in task_result.output.results:
                result_dict = {}
                if hasattr(result, 'text'):
                    result_dict['text'] = result.text
                if hasattr(result, 'begin_time'):
                    result_dict['begin_time'] = result.begin_time
                if hasattr(result, 'end_time'):
                    result_dict['end_time'] = result.end_time
                if hasattr(result, 'speaker_id'):
                    result_dict['speaker_id'] = result.speaker_id
                if hasattr(result, 'words') and result.words:
                    result_dict['words'] = result.words
                results_detail.append(result_dict)

        return jsonify({
            'success': True,
            'message': '语音识别成功',
            'data': {
                'text': transcribed_text,
                'taskId': task_result.output.task_id if hasattr(task_result, 'output') and task_result.output else None,
                'status': task_result.output.task_status if hasattr(task_result, 'output') and hasattr(task_result.output, 'task_status') else 'unknown',
                'results': results_detail,
                'processTime': datetime.now().isoformat()
            }
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': '语音识别失败',
            'error': str(e)
        }), 500


@app.route('/asr/task/<task_id>', methods=['GET'])
def query_task(task_id):
    """
    查询任务状态
    """
    try:
        query_response = Transcription.fetch(task=task_id)

        # 检查响应状态
        if query_response.status_code != 200:
            error_msg = f"查询任务失败: status_code={query_response.status_code}"
            if hasattr(query_response, 'message') and query_response.message:
                error_msg += f", message={query_response.message}"
            raise Exception(error_msg)

        # 提取结果详情
        results_detail = []
        if hasattr(query_response, 'output') and query_response.output and hasattr(query_response.output, 'results') and query_response.output.results:
            for result in query_response.output.results:
                result_dict = {}
                if hasattr(result, 'text'):
                    result_dict['text'] = result.text
                if hasattr(result, 'begin_time'):
                    result_dict['begin_time'] = result.begin_time
                if hasattr(result, 'end_time'):
                    result_dict['end_time'] = result.end_time
                if hasattr(result, 'speaker_id'):
                    result_dict['speaker_id'] = result.speaker_id
                results_detail.append(result_dict)

        return jsonify({
            'success': True,
            'data': {
                'taskId': task_id,
                'status': query_response.output.task_status if hasattr(query_response, 'output') and query_response.output and hasattr(query_response.output, 'task_status') else 'unknown',
                'results': results_detail,
                'raw_output': str(query_response.output) if hasattr(query_response, 'output') else None
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': '查询任务失败',
            'error': str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('ASR_PORT', 6002))
    print(f"ASR Service 运行在 http://0.0.0.0:{port}")
    print(f"上传目录: {UPLOAD_FOLDER}")
    print(f"公网URL: {SERVER_PUBLIC_URL if SERVER_PUBLIC_URL else '自动从请求构建'}")
    app.run(host='0.0.0.0', port=port, debug=True)
