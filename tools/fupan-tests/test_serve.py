"""正式门禁用真 HTTP；无端口门禁用同一批断言直接跑 HTTP handler。"""
import errno
import http.client
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import quote, urlencode

SCRIPTS = Path(__file__).resolve().parents[2] / 'skills' / 'forge-fupan' / 'scripts'
sys.path.insert(0, str(SCRIPTS))
import serve
import build


def payload(kind='ask', page='r:项目/模块/一篇'):
    return {'kind': kind, 'page': page,
            'doc': {'type': '复盘', 'project': '项目', 'module': '模块', 'title': '恢复发送', 'one': '检查重试的截止点'},
            'section': '工作复盘 › 恢复发送', 'block': '检查截止点。到点还没发成，留待下一次检查。',
            'quote': {'exact': '检查截止点', 'prefix': '', 'suffix': '。'}, 'note': '和发送时间是一回事吗'}


FAKE_CLI = r'''
import json, pathlib, sys, time
mode = pathlib.Path(__file__).with_suffix('.mode').read_text().strip()
assert sys.stdin.read() == '', 'stdin must be /dev/null'
assert sys.argv[1] == '-p'
assert '只输出一个 JSON' in sys.argv[2]
with pathlib.Path(__file__).with_suffix('.calls').open('a') as f:
    f.write('call\n')
if '--model' in sys.argv:
    assert sys.argv[sys.argv.index('--model') + 1] == 'test-model'
if mode == 'timeout':
    time.sleep(5)
elif mode == 'invalid':
    print('not JSON')
elif mode == 'exit':
    sys.exit(7)
else:
    if mode == 'wait':
        marker = pathlib.Path(__file__).with_suffix('.started')
        marker.write_text('started')
        while not pathlib.Path(__file__).with_suffix('.release').exists():
            time.sleep(.01)
    data = {'background': '项目 › 模块：检查重试的截止点。\n这一处在说明超过截止点后该如何处理。',
            'explain': '截止点是本次检查的界限，不代表实际发送发生的时间。'}
    if mode == 'long':
        data['explain'] = '字' * 201
    if mode == 'one-line':
        data['background'] = '只有一段'
    if mode == 'label':
        data['background'] = '项目 › 模块：检查重试的截止点。\n这一处的情况：复盘在说超过截止点后该如何处理。'
    output = json.dumps(data, ensure_ascii=False)
    if mode in ('fenced-json', 'fenced'):
        output = ' \n```' + ('json' if mode == 'fenced-json' else '') + '\n' + output + '\n```\n \t'
    print(output)
'''


class MemorySocket:
    def __init__(self, raw):
        self.input = io.BytesIO(raw)
        self.output = io.BytesIO()

    def makefile(self, *args):
        return self.input

    def sendall(self, data):
        self.output.write(data)


class ResponseSocket:
    def __init__(self, raw):
        self.raw = raw

    def makefile(self, *args):
        return io.BytesIO(self.raw)


class EndpointCases:
    network = False

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.workspace = Path(self.temp.name).resolve()
        self.root = self.workspace / '记录' / '复盘'
        self.kb = self.workspace / '知识' / '知识图谱' / '2-结果区'
        self.root.mkdir(parents=True)
        self.kb.mkdir(parents=True)
        self.cli = self.workspace / 'fake-claude'
        self.cli.write_text('#!' + sys.executable + '\n' + FAKE_CLI, encoding='utf-8')
        self.cli.chmod(0o700)
        self.cli.with_suffix('.mode').write_text('success')
        self.env = patch.dict(os.environ, {'FUPAN_ROOT': str(self.root), 'FUPAN_KB': str(self.kb),
                                          'FUPAN_CLAUDE': str(self.cli), 'FUPAN_CLAUDE_MODEL': 'test-model'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.app = serve.App(timeout=2)
        self.addCleanup(self.app.generator.close)
        self.log_patch = patch.object(serve.Handler, 'log_message')
        self.log_patch.start()
        self.addCleanup(self.log_patch.stop)
        if self.network:
            # 不跳过、不用 mock 替代端口失败：沙箱错误也必须出现在正式门禁结果里。
            self.server = serve.Server(self.app, 0)
            self.port = self.server.server_port
            self.worker = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': .02})
            self.worker.start()
            self.addCleanup(self.stop_server)
        else:
            self.port = 4330
            self.server = SimpleNamespace(app=self.app, server_port=self.port)

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(2)
        self.assertFalse(self.worker.is_alive())

    def request(self, method='GET', path='/api/health', data=None, headers=None, write_header=True, raw=None):
        body = raw if raw is not None else json.dumps(data, ensure_ascii=False).encode('utf-8') if data is not None else b''
        supplied = {'Host': '127.0.0.1:' + str(self.port), 'Content-Length': str(len(body))}
        if method != 'GET' and write_header:
            supplied['X-Fupan'] = '1'
        supplied.update(headers or {})
        path = quote(path, safe='/:?=&%')
        if self.network:
            connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=6)
            try:
                connection.request(method, path, body, supplied)
                response = connection.getresponse()
                return response.status, dict(response.getheaders()), response.read()
            finally:
                connection.close()
        raw_request = (method + ' ' + path + ' HTTP/1.1\r\n' +
                       ''.join(k + ': ' + v + '\r\n' for k, v in supplied.items()) + '\r\n').encode('ascii') + body
        sock = MemorySocket(raw_request)
        serve.Handler(sock, ('127.0.0.1', 10000), self.server)
        response = http.client.HTTPResponse(ResponseSocket(sock.output.getvalue()), method=method)
        response.begin()
        return response.status, dict(response.getheaders()), response.read()

    def api(self, method='GET', path='/api/health', data=None, status=200, **kwargs):
        code, headers, raw = self.request(method, path, data, **kwargs)
        self.assertEqual(code, status, raw)
        self.assertFalse(any(k.lower().startswith('access-control-') for k in headers))
        self.assertEqual(headers['Cache-Control'], 'no-cache')
        decoded = json.loads(raw)
        if status >= 400:
            self.assertEqual(set(decoded), {'error'})
            self.assertIsInstance(decoded['error'], str)
        return decoded

    def create(self, **kwargs):
        data = payload(**kwargs)
        return self.api('POST', '/api/notes', data, status=201)

    def wait_for(self, predicate):
        deadline = time.monotonic() + 4
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(.01)
        self.fail('等待生成超时')

    def test_health_and_read_only_start_make_no_files(self):
        self.assertEqual(self.api(), {'ok': True})
        self.assertEqual(self.api(path='/api/notes'), [])
        self.assertEqual(self.api(path='/api/read'), [])
        self.app.generator.start()
        self.assertFalse((self.root / '_划线').exists())

    def test_note_crud_and_server_fields(self):
        data = payload()
        data.update(id='forged', created_at='fake', gen={'status': 'done'}, pushes=[{}])
        note = self.api('POST', '/api/notes', data, status=201)
        self.assertNotEqual(note['id'], 'forged')
        self.assertIsNotNone(datetime.fromisoformat(note['created_at']).utcoffset())
        self.assertEqual(note['gen'], {'status': 'pending', 'tries': 0})
        self.assertEqual(note['pushes'], [])
        other = self.create(kind='star', page='k:K01')
        url = '/api/notes?' + urlencode({'page': data['page']})
        self.assertEqual(self.api(path=url), [note])
        self.assertEqual(len(self.api(path='/api/notes')), 2)
        changed = self.api('PATCH', '/api/notes/' + note['id'], {'note': '新的备注'})
        self.assertEqual(changed['note'], '新的备注')
        self.assertEqual(changed['gen'], note['gen'])
        self.api('DELETE', '/api/notes/' + note['id'])
        self.assertEqual(self.api(path='/api/notes'), [other])
        self.api('PATCH', '/api/notes/' + note['id'], {'note': 'x'}, status=404)
        self.api('DELETE', '/api/notes/' + note['id'], status=404)

    def test_validation_and_truncation(self):
        for key, bad in [('kind', 'wrong'), ('kind', []), ('page', 'x:bad'), ('page', 'r:'),
                         ('page', None), ('doc', []), ('section', 3), ('block', None),
                         ('quote', {'exact': '  '}), ('quote', {'exact': ''}), ('note', '字' * 2001)]:
            with self.subTest(key=key, bad=str(bad)[:30]):
                data = payload()
                data[key] = bad
                self.api('POST', '/api/notes', data, status=400)
        data = payload()
        data['doc']['type'] = '其他'
        self.api('POST', '/api/notes', data, status=400)
        for raw in (b'[]', b'{broken', b'null', b'\xff'):
            self.api('POST', '/api/notes', raw=raw, status=400)
        data = payload()
        data['note'] = '\ud800'
        self.api('POST', '/api/notes', raw=json.dumps(data).encode('ascii'), status=400)
        data = payload()
        data.update(block='文' * 2001, note='字' * 2000)
        note = self.api('POST', '/api/notes', data, status=201)
        self.assertEqual(note['block'], '文' * 2000)
        self.api('PATCH', '/api/notes/' + note['id'], {'note': '字' * 2001}, status=400)
        self.api('PATCH', '/api/notes/' + note['id'], {'kind': 'star'}, status=400)
        self.api('GET', '/api/notes?page=invalid', status=400)

    def test_read_keys_are_persistent_and_idempotent(self):
        for key in ('r:项目/模块/一篇', 'o:项目/旧复盘.md', 's:S01'):
            path = '/api/read/' + quote(key, safe='')
            self.api('PUT', path)
            self.api('PUT', path)
        expected = ['r:项目/模块/一篇', 'o:项目/旧复盘.md', 's:S01']
        self.assertEqual(self.api(path='/api/read'), expected)
        self.assertEqual(serve.Store(self.root).read('已读.json'), expected)
        self.api('DELETE', '/api/read/' + quote(expected[0], safe=''))
        self.api('DELETE', '/api/read/' + quote(expected[0], safe=''))
        self.assertEqual(self.api(path='/api/read'), expected[1:])
        self.api('PUT', '/api/read/bad', status=400)

    def test_security_on_static_api_and_preflight(self):
        (self.root / 'index.data.js').write_text('private')
        for path in ('/api/health', '/记录/复盘/index.data.js', '/'):
            self.api(path=path, headers={'Host': 'evil.test:' + str(self.port)}, status=403)
            self.api(path=path, headers={'Sec-Fetch-Site': 'cross-site'}, status=403)
        self.api(headers={'Host': 'localhost:' + str(self.port)})
        self.api(headers={'Host': '127.0.0.1'}, status=403)
        for method, path in [('POST', '/api/notes'), ('PATCH', '/api/notes/missing'),
                             ('DELETE', '/api/notes/missing'), ('PUT', '/api/read/s:S01'),
                             ('POST', '/api/notes/missing/gen'), ('POST', '/api/notes/missing/push'),
                             ('OPTIONS', '/api/notes'), ('HEAD', '/api/health')]:
            code, headers, body = self.request(method, path, write_header=False)
            self.assertEqual(code, 403, body)
            self.assertFalse(any(k.lower().startswith('access-control-') for k in headers))
        self.api('OPTIONS', '/api/notes', status=404)
        self.api('TRACE', '/', headers={'Sec-Fetch-Site': 'cross-site'}, status=403)
        self.api('POST', '/api/notes', payload(), headers={'Sec-Fetch-Site': 'cross-site'}, status=403)
        self.assertEqual(self.api(path='/api/notes'), [])

    def test_static_types_roots_redirect_and_symlinks(self):
        for extension, expected in [('html', 'text/html'), ('js', 'text/javascript'), ('json', 'application/json'),
                                    ('png', 'image/png'), ('jpg', 'image/jpeg'), ('svg', 'image/svg+xml'),
                                    ('mp4', 'video/mp4'), ('webm', 'video/webm'), ('woff2', 'font/woff2')]:
            (self.root / ('sample.' + extension)).write_bytes(b'content')
            code, headers, body = self.request(path='/记录/复盘/sample.' + extension)
            self.assertEqual((code, body), (200, b'content'))
            self.assertEqual(headers['Content-Type'].split(';')[0], expected)
            self.assertEqual(headers['Cache-Control'], 'no-cache')
            self.assertFalse(any(k.lower().startswith('access-control-') for k in headers))
        (self.kb / '经验图.png').write_bytes(b'png')
        self.assertEqual(self.request(path='/知识/知识图谱/2-结果区/经验图.png')[0], 200)
        (self.workspace / '.mcp.json').write_text('secret')
        (self.workspace / '工具').mkdir()
        (self.workspace / '工具' / 'private.txt').write_text('private')
        (self.root / 'escape').symlink_to(self.workspace / '工具', target_is_directory=True)
        (self.root / 'secret').symlink_to(self.workspace / '.mcp.json')
        (self.root / 'loop').symlink_to(self.root / 'loop')
        (self.workspace / 'shortcut').symlink_to(self.root, target_is_directory=True)
        for path in ('/.mcp.json', '/工具/private.txt', '/记录/复盘/../复盘/sample.html',
                     '/记录/复盘/%2e%2e/%2e%2e/.mcp.json', '/记录/复盘/escape/private.txt',
                     '/记录/复盘/secret', '/记录/复盘/loop', '/shortcut/sample.html', '/记录/复盘/', '/记录/复盘/%00'):
            self.api(path=path, status=404)
        code, headers, body = self.request(path='/')
        self.assertEqual(code, 302)
        self.assertEqual(headers['Location'], quote('/记录/复盘/index.html'))
        code, headers, body = self.request('HEAD', '/记录/复盘/sample.html', write_header=False)
        self.assertEqual((code, body), (200, b''))
        self.assertEqual(headers['Content-Length'], '7')

    def test_range_video(self):
        (self.root / 'video.mp4').write_bytes(b'0123456789')
        for requested, expected, content_range in [('bytes=2-5', b'2345', 'bytes 2-5/10'),
                                                   ('bytes=7-', b'789', 'bytes 7-9/10'),
                                                   ('bytes=-3', b'789', 'bytes 7-9/10'),
                                                   ('bytes=7-99', b'789', 'bytes 7-9/10')]:
            code, headers, body = self.request(path='/记录/复盘/video.mp4', headers={'Range': requested})
            self.assertEqual((code, body), (206, expected))
            self.assertEqual(headers['Content-Range'], content_range)
            self.assertEqual(headers['Accept-Ranges'], 'bytes')
        for requested in ('bytes=10-', 'bytes=-0', 'bytes=5-2', 'bytes=0-1,3-4', 'garbage'):
            code, headers, body = self.request(path='/记录/复盘/video.mp4', headers={'Range': requested})
            self.assertEqual(code, 416)
            self.assertEqual(headers['Content-Range'], 'bytes */10')

    def test_concurrent_creates_and_push_records(self):
        barrier = threading.Barrier(10)

        def create(i):
            barrier.wait()
            return self.create(page='s:S' + str(i))

        with ThreadPoolExecutor(max_workers=10) as pool:
            notes = list(pool.map(create, range(10)))
        disk = json.loads((self.root / '_划线' / '划线.json').read_text())
        self.assertEqual(len(disk), 10)
        self.assertEqual(len({n['id'] for n in disk}), 10)
        self.assertEqual(set(p.name for p in (self.root / '_划线').iterdir()), {'.lock', '划线.json'})
        note = notes[0]
        records = [{'n': n, 'at': '2026-11-11T21:05:00+08:00', 'msg_id': 'message-' + str(n)} for n in (1, 2, 3)]
        for record in records:
            changed = self.api('POST', '/api/notes/' + note['id'] + '/push', record)
        self.assertEqual(changed['pushes'], records)
        self.assertEqual(serve.Store(self.root).get(note['id'])['pushes'], records)
        for invalid in ({'n': 4}, {'n': True}, {'at': 'yesterday'}, {'at': '2026-11-11T21:05:00'}, {'msg_id': ''}):
            bad = dict(records[0], **invalid)
            self.api('POST', '/api/notes/' + note['id'] + '/push', bad, status=400)
        self.api('POST', '/api/notes/missing/push', records[0], status=404)

    def test_synchronous_generation_and_failure_preserve_content(self):
        for kind in ('ask', 'star'):
            note = self.create(kind=kind)
            path = '/api/notes/' + note['id'] + '/gen'
            done = self.api('POST', path)
            self.assertEqual(done['gen']['status'], 'done')
            self.assertEqual(done['gen']['tries'], 1)
            self.assertEqual('explain' in done['gen'], kind == 'ask')
            self.assertEqual(len(done['gen']['background'].splitlines()), 2)
            self.assertLessEqual(len(done['gen']['background']), 160)
            self.assertIsNotNone(datetime.fromisoformat(done['gen']['at']).utcoffset())
            if kind == 'ask':
                self.assertTrue(done['gen']['explain'])
                self.assertLessEqual(len(done['gen']['explain']), 200)
            for tries, mode in enumerate(('invalid', 'exit', 'timeout', 'one-line'), 2):
                self.cli.with_suffix('.mode').write_text(mode)
                self.app.generator.timeout = .08 if mode == 'timeout' else 2
                failed = self.api('POST', path)
                self.assertEqual(failed['gen']['status'], 'failed')
                self.assertEqual(failed['gen']['tries'], tries)
                for field in ('background', 'explain', 'at'):
                    self.assertEqual(failed['gen'].get(field), done['gen'].get(field))
            self.cli.with_suffix('.mode').write_text('success')
            self.app.generator.timeout = 2
        self.api('POST', '/api/notes/missing/gen', status=404)

    def test_generation_removes_second_paragraph_label_before_saving(self):
        self.cli.with_suffix('.mode').write_text('label')
        note = self.create()
        done = self.api('POST', '/api/notes/' + note['id'] + '/gen')
        expected = '项目 › 模块：检查重试的截止点。\n复盘在说超过截止点后该如何处理。'
        self.assertEqual(done['gen']['status'], 'done')
        self.assertEqual(done['gen']['background'], expected)
        self.assertEqual(self.app.store.get(note['id'])['gen']['background'], expected)

    def test_generation_accepts_fenced_json(self):
        for mode in ('fenced-json', 'fenced'):
            with self.subTest(mode=mode):
                self.cli.with_suffix('.mode').write_text(mode)
                note = self.create()
                done = self.api('POST', '/api/notes/' + note['id'] + '/gen')
                self.assertEqual(done['gen']['status'], 'done')
                self.assertEqual(done['gen']['background'],
                                 '项目 › 模块：检查重试的截止点。\n这一处在说明超过截止点后该如何处理。')
                self.assertEqual(done['gen']['explain'], '截止点是本次检查的界限，不代表实际发送发生的时间。')
                self.assertEqual(self.app.store.get(note['id'])['gen'], done['gen'])

    def test_background_generation_and_pending_restart(self):
        pending = self.create()
        failed = self.create()
        self.app.store.change(failed['id'], lambda n: n['gen'].update(status='failed', tries=1))
        # 丢掉原队列，模拟重启后仅从文件恢复 pending。
        self.app.generator = serve.Generator(self.app.store, timeout=2)
        self.addCleanup(self.app.generator.close)
        self.app.generator.start()
        self.wait_for(lambda: self.app.store.get(pending['id'])['gen']['status'] == 'done')
        self.assertEqual(self.app.store.get(failed['id'])['gen']['tries'], 1)
        created = self.create(kind='star')
        self.assertEqual(created['gen']['status'], 'pending')
        self.wait_for(lambda: self.app.store.get(created['id'])['gen']['status'] == 'done')
        self.assertNotIn('explain', self.app.store.get(created['id'])['gen'])

    def test_queue_runs_one_cli_at_a_time(self):
        self.cli.with_suffix('.mode').write_text('wait')
        self.app.generator.start()
        notes = [self.create()]
        self.wait_for(lambda: self.cli.with_suffix('.started').exists())
        notes.extend(self.create() for _ in range(9))
        self.assertEqual(self.cli.with_suffix('.calls').read_text().splitlines(), ['call'])
        self.assertTrue(all(n['gen']['status'] == 'pending' for n in self.api(path='/api/notes')))
        self.cli.with_suffix('.release').touch()
        self.wait_for(lambda: all(n['gen']['status'] == 'done' for n in self.api(path='/api/notes')))
        self.assertEqual(len(self.cli.with_suffix('.calls').read_text().splitlines()), 10)

    def test_synchronous_wait_counts_toward_timeout(self):
        note = self.create()
        self.app.generator.timeout = .08
        with self.app.generator.serial:
            started = time.monotonic()
            failed = self.api('POST', '/api/notes/' + note['id'] + '/gen')
        self.assertLess(time.monotonic() - started, 1)
        self.assertEqual(failed['gen'], {'status': 'failed', 'tries': 1})
        self.assertFalse(self.cli.with_suffix('.calls').exists())

    def test_invalid_generation_length_fails(self):
        self.cli.with_suffix('.mode').write_text('long')
        note = self.create()
        failed = self.api('POST', '/api/notes/' + note['id'] + '/gen')
        self.assertEqual(failed['gen'], {'status': 'failed', 'tries': 1})

    def test_generation_preserves_concurrent_edits_and_does_not_resurrect_deleted_note(self):
        self.cli.with_suffix('.mode').write_text('wait')
        self.app.generator.start()
        note = self.create()
        self.wait_for(lambda: self.cli.with_suffix('.started').exists())
        self.api('PATCH', '/api/notes/' + note['id'], {'note': '生成中改备注'})
        record = {'n': 1, 'at': '2026-11-11T21:05:00+08:00', 'msg_id': 'message'}
        self.api('POST', '/api/notes/' + note['id'] + '/push', record)
        self.cli.with_suffix('.release').touch()
        self.wait_for(lambda: self.app.store.get(note['id'])['gen']['status'] == 'done')
        final = self.app.store.get(note['id'])
        self.assertEqual(final['note'], '生成中改备注')
        self.assertEqual(final['pushes'], [record])
        self.cli.with_suffix('.started').unlink()
        self.cli.with_suffix('.release').unlink()
        deleted = self.create()
        self.wait_for(lambda: self.cli.with_suffix('.started').exists())
        self.api('DELETE', '/api/notes/' + deleted['id'])
        self.cli.with_suffix('.release').touch()
        self.wait_for(lambda: self.app.generator.queue.unfinished_tasks == 0)
        self.assertEqual([n['id'] for n in self.api(path='/api/notes')], [note['id']])

    def test_missing_cli_marks_failed(self):
        with patch.dict(os.environ, {'FUPAN_CLAUDE': str(self.workspace / 'missing')}):
            self.app.generator.start()
            note = self.create()
            self.wait_for(lambda: self.app.store.get(note['id'])['gen']['status'] == 'failed')
            self.assertEqual(self.app.store.get(note['id'])['gen'], {'status': 'failed', 'tries': 1})

    def test_corrupt_json_is_not_overwritten(self):
        self.create()
        path = self.root / '_划线' / '划线.json'
        path.write_text('broken')
        self.api(path='/api/notes', status=500)
        self.api('POST', '/api/notes', payload(), status=500)
        self.assertEqual(path.read_text(), 'broken')


class HTTPTests(EndpointCases, unittest.TestCase):
    network = True

    def test_build_uses_live_health_and_encoded_address(self):
        with patch.object(build, 'ROOT', self.root), patch.dict(os.environ, {'FUPAN_PORT': str(self.port)}):
            address = build.browser_address('项目/模块/含 空格+号')
        self.assertEqual(address, 'http://127.0.0.1:' + str(self.port) + quote('/记录/复盘/index.html') +
                         '#r=' + quote('项目/模块/含 空格+号', safe=''))

    def test_occupied_port_fails_without_switching(self):
        result = subprocess.run([sys.executable, str(SCRIPTS / 'serve.py'), '--port', str(self.port)],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 1)
        self.assertIn('端口已被占用', result.stderr)
        self.assertIn(str(self.port), result.stderr)
        self.assertIn('不会换端口', result.stderr)
        self.assertFalse((self.root / '_划线').exists())


class NoSocketTests(EndpointCases, unittest.TestCase):
    """沙箱拒绝 bind 时可以单独运行；不替代 HTTPTests 的正式门禁。"""


class UnitTests(unittest.TestCase):
    def test_build_encodes_http_path_and_fragment(self):
        with patch('urllib.request.build_opener') as factory, patch.dict(os.environ, {'FUPAN_PORT': '4338'}):
            response = factory.return_value.open.return_value.__enter__.return_value
            response.status = 200
            response.read.return_value = b'{"ok": true}'
            with patch.object(build, 'ROOT', Path('/tmp/workspace/记录/复盘')):
                self.assertEqual(build.browser_address('项目/模块/含 空格+号'),
                                 'http://127.0.0.1:4338' + quote('/记录/复盘/index.html') +
                                 '#r=' + quote('项目/模块/含 空格+号', safe=''))

    def test_atomic_replace_failure_keeps_previous_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = serve.Store(Path(temporary))
            first = serve.new_note(payload())
            store.add(first)
            with patch('serve.os.replace', side_effect=OSError('replace failed')):
                with self.assertRaises(OSError):
                    store.add(serve.new_note(payload()))
            self.assertEqual(store.read('划线.json'), [first])
            self.assertEqual(set(p.name for p in store.directory.iterdir()), {'.lock', '划线.json'})

    def test_build_fallback_and_health_timeout(self):
        with patch('urllib.request.build_opener') as factory, patch.dict(os.environ, {'FUPAN_PORT': '4338'}):
            factory.return_value.open.side_effect = OSError('offline')
            result = build.browser_address('项目/模块/标题')
            self.assertTrue(result.startswith('file://'))
            self.assertTrue(result.endswith('#r=项目/模块/标题'))
            factory.return_value.open.assert_called_once_with('http://127.0.0.1:4338/api/health', timeout=.5)

    def test_cli_lookup_order_and_numeric_version(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = Path(temporary)
            candidates = []
            for version in ('2.0.9', '2.0.10'):
                p = home / '.vscode' / 'extensions' / ('anthropic.claude-code-' + version) / 'resources' / 'native-binary' / 'claude'
                p.parent.mkdir(parents=True)
                p.write_text('fake')
                p.chmod(0o700)
                candidates.append(str(p))
            with patch.dict(os.environ, {'FUPAN_CLAUDE': ''}), patch.object(Path, 'home', return_value=home):
                with patch('serve.shutil.which', return_value=None):
                    self.assertEqual(serve.find_claude(), candidates[1])
                with patch('serve.shutil.which', return_value=candidates[0]):
                    self.assertEqual(serve.find_claude(), candidates[0])
                    with patch.dict(os.environ, {'FUPAN_CLAUDE': candidates[1]}):
                        self.assertEqual(serve.find_claude(), candidates[1])
                    with patch.dict(os.environ, {'FUPAN_CLAUDE': 'relative/claude'}):
                        self.assertIsNone(serve.find_claude())

    def test_default_paths_match_existing_scripts(self):
        with patch.dict(os.environ, {'FUPAN_ROOT': str(build.ROOT)}):
            self.assertEqual(serve.fupan_root(), build.ROOT)
            self.assertEqual(serve.App().kb, build.workbench.kb_root(build.ROOT))

    def test_bind_failure_reports_actual_port(self):
        with patch.object(serve, 'Server', side_effect=OSError(errno.EADDRINUSE, 'in use')):
            with patch('sys.stderr', new_callable=io.StringIO) as error:
                self.assertEqual(serve.main(['--port', '4339']), 1)
            self.assertIn('127.0.0.1:4339', error.getvalue())


if __name__ == '__main__':
    unittest.main()
