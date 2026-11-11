#!/usr/bin/env python3
"""真实目录只读冒烟：固定 4331，用 curl 检查，结束后关闭本次服务。"""
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import quote

REPO = Path(__file__).resolve().parents[2]
# 和 build.py、serve.py 同一个取法：FUPAN_ROOT，没设就是 ~/claudecode_workspace/记录/复盘
ROOT = Path(os.environ.get('FUPAN_ROOT', Path.home() / 'claudecode_workspace' / '记录' / '复盘')).expanduser().resolve()
WORKSPACE = ROOT.parent.parent
KB = WORKSPACE / '知识' / '知识图谱' / '2-结果区'
BASE = 'http://127.0.0.1:4331'


def snapshot():
    directory = ROOT / '_划线'
    if not directory.exists():
        return None
    return {str(p.relative_to(directory)): (p.stat().st_size, p.stat().st_mtime_ns)
            for p in [directory] + sorted(directory.rglob('*'))}


def curl(path):
    result = subprocess.run(['curl', '--noproxy', '*', '--silent', '--show-error', '--max-time', '2',
                             '--dump-header', '-', BASE + quote(path)], capture_output=True, check=True)
    raw_headers, _, body = result.stdout.partition(b'\r\n\r\n')
    lines = raw_headers.decode('iso-8859-1').split('\r\n')
    status = int(lines[0].split()[1])
    headers = dict(line.split(': ', 1) for line in lines[1:] if ': ' in line)
    return status, headers, body


def main():
    before = snapshot()
    notes = ROOT / '_划线' / '划线.json'
    if notes.exists() and any(n.get('gen', {}).get('status') == 'pending'
                              for n in json.loads(notes.read_text(encoding='utf-8'))):
        sys.exit('未启动：真实目录有 pending 任务，启动会恢复生成并写入数据。')
    if any((ROOT / '_划线' / name).exists() for name in ('划线.json', '已读.json')) and not (ROOT / '_划线' / '.lock').exists():
        sys.exit('未启动：真实数据缺少 .lock，启动会补建锁文件。')
    png = next((KB / '经验库' / '图').glob('*.png'), None)
    private_file = next((p for p in (WORKSPACE / '工具').rglob('*') if p.is_file()), None)
    if png is None or private_file is None or not (ROOT / 'index.data.js').is_file():
        sys.exit('未启动：缺少冒烟要用的真实文件。')
    env = dict(os.environ, FUPAN_ROOT=str(ROOT), FUPAN_KB=str(KB))
    with tempfile.TemporaryFile() as log:
        process = subprocess.Popen([sys.executable, str(REPO / 'skills/forge-fupan/scripts/serve.py'), '--port', '4331'],
                                   env=env, stdout=log, stderr=log)
        try:
            deadline = time.monotonic() + 5
            # 等本次进程明确打印已启动，再访问，避免误验占用端口的其他服务。
            while True:
                if process.poll() is not None:
                    log.seek(0)
                    sys.exit(log.read().decode('utf-8', errors='replace').strip())
                log.seek(0)
                if b'http://127.0.0.1:4331/' in log.read():
                    break
                if time.monotonic() >= deadline:
                    sys.exit('服务在 5 秒内没有启动。')
                time.sleep(.05)
            cases = [('/api/health', 200), ('/', 302), ('/记录/复盘/index.data.js', 200),
                     ('/' + png.relative_to(WORKSPACE).as_posix(), 200), ('/.mcp.json', 404),
                     ('/' + private_file.relative_to(WORKSPACE).as_posix(), 404)]
            for path, expected in cases:
                status, headers, body = curl(path)
                assert status == expected, (path, status, expected)
                assert not any(k.lower().startswith('access-control-') for k in headers)
                if path == '/api/health':
                    assert json.loads(body) == {'ok': True}
                elif path == '/':
                    assert headers['Location'] == quote('/记录/复盘/index.html')
                elif path.endswith('.js'):
                    assert headers['Content-Type'].startswith('text/javascript')
                elif path.endswith('.png') and expected == 200:
                    assert headers['Content-Type'] == 'image/png'
                print(str(status) + ' ' + path)
        finally:
            if process.poll() is None:
                process.send_signal(signal.SIGINT)
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    process.wait(timeout=3)
            assert snapshot() == before, '真实 _划线 目录发生了变化'
            print('已停止本次服务；真实 _划线 目录未变化。')


if __name__ == '__main__':
    main()
