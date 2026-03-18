"""
测试 ASR 简单服务接口
"""
import requests
import json

BASE_URL = "http://localhost:6003"

# 测试音频文件 URL（阿里云百炼示例音频）
# TEST_AUDIO_URL = "https://dashscope.oss-cn-beijing.aliyuncs.com/samples/audio/paraformer/hello_world_female2.wav"
TEST_AUDIO_URL = "https://8.136.26.168:8888/down/87nssN026TTS.webm"


def test_health():
    """测试健康检查接口"""
    print("=" * 50)
    print("测试健康检查接口")
    print("=" * 50)

    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"请求失败: {e}")
        return False


def test_transcribe():
    """测试完整格式接口"""
    print("\n" + "=" * 50)
    print("测试 /asr/transcribe 接口（完整格式）")
    print("=" * 50)

    payload = {
        "file_url": TEST_AUDIO_URL,
        "language_hints": ["zh", "en"]
    }

    try:
        print(f"请求参数: {json.dumps(payload, indent=2, ensure_ascii=False)}")
        response = requests.post(
            f"{BASE_URL}/asr/transcribe",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        print(f"\n状态码: {response.status_code}")

        result = response.json()
        print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")

        if result.get('success') and 'data' in result:
            data = result['data']
            print("\n--- 识别结果摘要 ---")
            print(f"文件 URL: {data.get('file_url')}")
            print(f"音频格式: {data.get('properties', {}).get('audio_format')}")
            print(f"采样率: {data.get('properties', {}).get('original_sampling_rate')}")
            print(f"时长: {data.get('properties', {}).get('original_duration_in_milliseconds')}ms")

            transcripts = data.get('transcripts', [])
            for i, transcript in enumerate(transcripts):
                print(f"\n通道 {transcript.get('channel_id')} 识别文本:")
                print(f"  {transcript.get('text')}")

        return response.status_code == 200 and result.get('success')
    except Exception as e:
        print(f"请求失败: {e}")
        return False


def test_transcribe_simple():
    """测试简化版接口（只返回文字）"""
    print("\n" + "=" * 50)
    print("测试 /asr/transcribe/text 接口（简化版）")
    print("=" * 50)

    payload = {
        "file_url": TEST_AUDIO_URL,
        "language_hints": ["zh", "en"]
    }

    try:
        print(f"请求参数: {json.dumps(payload, indent=2, ensure_ascii=False)}")
        response = requests.post(
            f"{BASE_URL}/asr/transcribe/text",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        print(f"\n状态码: {response.status_code}")

        result = response.json()
        print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")

        if result.get('success') and 'text' in result:
            print(f"\n识别文本: {result['text']}")

        return response.status_code == 200 and result.get('success')
    except Exception as e:
        print(f"请求失败: {e}")
        return False


def test_error_case():
    """测试错误情况"""
    print("\n" + "=" * 50)
    print("测试错误情况（缺少参数）")
    print("=" * 50)

    try:
        response = requests.post(
            f"{BASE_URL}/asr/transcribe",
            json={},
            headers={"Content-Type": "application/json"}
        )
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 400
    except Exception as e:
        print(f"请求失败: {e}")
        return False


def test_upload_and_transcribe():
    """测试文件上传并识别接口"""
    print("\n" + "=" * 50)
    print("测试 /asr/upload-and-transcribe 接口")
    print("=" * 50)

    # 下载测试音频文件到本地
    test_file_path = "test_audio.webm"

    try:
        # 如果本地没有测试文件，先下载
        if not os.path.exists(test_file_path):
            print(f"下载测试音频文件: {TEST_AUDIO_URL}")
            response = requests.get(TEST_AUDIO_URL, timeout=30)
            with open(test_file_path, 'wb') as f:
                f.write(response.content)
            print(f"测试文件已保存: {test_file_path}")

        # 准备上传文件
        with open(test_file_path, 'rb') as f:
            files = {'file': ('test_audio.webm', f, 'audio/webm')}
            data = {'language_hints': 'zh,en'}

            print(f"上传文件并识别...")
            response = requests.post(
                f"{BASE_URL}/asr/upload-and-transcribe",
                files=files,
                data=data
            )

        print(f"\n状态码: {response.status_code}")
        result = response.json()
        print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")

        if result.get('success'):
            print("\n--- 识别结果 ---")
            print(f"原始文件名: {result.get('original_name')}")
            print(f"保存文件名: {result.get('saved_name')}")
            print(f"文件大小: {result.get('file_size')} bytes")
            print(f"文件URL: {result.get('file_url')}")
            print(f"识别文本: {result.get('text')}")

        return response.status_code == 200 and result.get('success')
    except Exception as e:
        print(f"请求失败: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import os

    print("ASR 简单服务测试脚本")
    print(f"服务地址: {BASE_URL}")
    print(f"测试音频: {TEST_AUDIO_URL}")
    print()

    # 运行所有测试
    results = []

    results.append(("健康检查", test_health()))
    results.append(("完整格式接口", test_transcribe()))
    results.append(("简化版接口", test_transcribe_simple()))
    results.append(("上传并识别接口", test_upload_and_transcribe()))
    results.append(("错误处理", test_error_case()))

    print("\n" + "=" * 50)
    print("测试结果汇总")
    print("=" * 50)
    for name, passed in results:
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"{name}: {status}")
