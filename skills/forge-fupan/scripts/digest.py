#!/usr/bin/env python3
"""把一份会话日志（Claude Code / Codex JSONL，常有几十 MB）压成能读的摘要 md，复盘只读这份。

用法：digest.py <jsonl> [-o 输出.md] [--text 400] [--from '11-03 22:00'] [--until '11-04 12:15']

--from / --until 是北京时间，写到天（11-03）或到分钟（11-03 22:25）：复盘范围只到用户要求复盘之前，就用 --until 把后面那段切掉。

摘要里有：
- 用户原话：编号 U1、U2…，北京时间，原文照录（贴进来的长内容截断）
- 每条原话之后 AI 做了什么：回复文字（截断到 --text 字）、工具调用一行一个（命令、读写的文件、联网、子 agent、skill）
- 中断、上下文压缩的位置
- 文末：写过的文件清单（第一次是新建还是修改、改了几次、最后时间）、打开过的网址
"""
from __future__ import annotations

import argparse, json, re, sys
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path

BJ = timezone(timedelta(hours=8))


def t(ts):
    try:
        return datetime.fromisoformat(str(ts).replace('Z', '+00:00')).astimezone(BJ)
    except Exception:
        return None


def in_range(dt, rng):
    """rng 是 (起, 止) 两个北京时间；用 bound() 从命令行参数换算"""
    a, b = rng
    return (a is None or dt >= a) and (b is None or dt <= b)


_TIME = re.compile(r'^\s*(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?\s*$')


def bound(text, start, end_of_day):
    """「11-03」「11-03 22:25」「11-3 9:30」→ 北京时间；年份取会话开始那年，月份比开始早就算第二年；只写到天的，止那天整天都算"""
    m = _TIME.match(text or '')
    if not m:
        sys.exit(f"时间「{text}」要写成 '11-03' 或 '11-03 22:25'（北京时间）")
    mo, dd, hh, mm = m.groups()
    y = start.year + (1 if int(mo) < start.month else 0)
    try:
        x = datetime(y, int(mo), int(dd), int(hh or 0), int(mm or 0), tzinfo=BJ)
    except ValueError:
        sys.exit(f'时间「{text}」不是有效的日期或钟点')
    return x + timedelta(days=1, seconds=-1) if end_of_day and hh is None else x


def clip(s, n):
    s = re.sub(r'\s+', ' ', str(s or '')).strip()
    return s if len(s) <= n else s[:n] + '…'


def clean_user(c: str) -> str:
    c = re.sub(r'<system-reminder>.*?</system-reminder>', '', c, flags=re.S)
    c = re.sub(r'<ide_selection>.*?</ide_selection>', '[IDE 里选中了一段]', c, flags=re.S)
    c = re.sub(r'<ide_opened_file>.*?</ide_opened_file>', '', c, flags=re.S)
    # 贴进来的长内容只留开头
    c = re.sub(r'(<pasted_content[^>]*>)(.*?)(</pasted_content>)', lambda m: '[贴入] ' + clip(m.group(2), 300), c, flags=re.S)
    return c.strip()


class Digest:
    def __init__(self, text_n):
        self.n = text_n
        self.out = []
        self.files = OrderedDict()  # path -> {first, count, last}
        self.urls = OrderedDict()
        self.u = 0
        self.first = self.last = None
        self.counts = {'user': 0, 'tools': 0, 'compact': 0, 'interrupt': 0}

    def stamp(self, ts):
        d = t(ts)
        if d:
            self.first = self.first or d
            self.last = d
        return d.strftime('%m-%d %H:%M') if d else '?'

    def user(self, ts, text, images=0):
        self.u += 1
        self.counts['user'] += 1
        extra = f'（附图 {images} 张）' if images else ''
        self.out.append(f'\n## U{self.u} · {self.stamp(ts)}{extra}\n\n{text}\n')

    def note(self, ts, s):
        self.out.append(f'- {self.stamp(ts)} {s}')

    def ai(self, ts, s):
        s = s if isinstance(s, str) else ''
        if s.strip():
            self.out.append(f'- A：{clip(s, self.n)}')

    def file(self, ts, path, op):
        f = self.files.setdefault(path, {'first': op, 'count': 0, 'last': ''})
        f['count'] += 1
        f['last'] = self.stamp(ts)

    def merge(self, verb, item):
        """连续的读文件、搜索并成一行，长会话的摘要才读得完"""
        last = self.out[-1] if self.out else ''
        if last.startswith(f'- {verb} '):
            self.out[-1] = last + ' · ' + item
        else:
            self.out.append(f'- {verb} {item}')

    def tool(self, ts, name, inp):
        self.counts['tools'] += 1
        inp = inp or {}
        if name == 'Bash' or name == 'exec_command' or name == 'shell':
            cmd = inp.get('command') or inp.get('cmd') or ''
            if isinstance(cmd, list):
                cmd = ' '.join(cmd)
            desc = inp.get('description')
            self.out.append(f'- $ {clip(desc, 120) + "：" if desc else ""}{clip(cmd, 160)}')
        elif name in ('Write', 'Edit', 'MultiEdit', 'NotebookEdit'):
            p = inp.get('file_path') or inp.get('notebook_path', '')
            op = '写' if name == 'Write' else '改'
            self.file(ts, p, op)
            self.out.append(f'- ✎ {op} {p}')
        elif name == 'apply_patch':
            raw = inp.get('input') if isinstance(inp.get('input'), str) else json.dumps(inp, ensure_ascii=False).replace('\\n', '\n')
            for op, p in re.findall(r'\*\*\* (Add|Update|Delete) File: ([^\n"]+)', raw):
                o = {'Add': '写', 'Update': '改', 'Delete': '删'}[op]
                self.file(ts, p.strip(), o)
                self.out.append(f'- ✎ {o} {p.strip()}')
        elif name == 'Read':
            self.merge('读', Path(str(inp.get('file_path', ''))).name)
        elif name in ('WebFetch', 'WebSearch'):
            x = inp.get('url') or inp.get('query', '')
            if inp.get('url'):
                self.urls[x] = True
            self.out.append(f'- 🌐 {name}：{clip(x, 160)}')
        elif name in ('Agent', 'Task'):
            self.out.append(f'- 子 agent：{inp.get("description", "")} —— {clip(inp.get("prompt", ""), 200)}')
        elif name == 'Skill':
            self.out.append(f'- skill：{inp.get("skill", "")} {clip(str(inp.get("args", "")), 120)}')
        elif name in ('Grep', 'Glob'):
            self.merge('搜', clip(str(inp.get('pattern', '')), 40))
        elif name in ('TodoWrite', 'ToolSearch'):
            self.counts['tools'] -= 1
        else:
            self.out.append(f'- 工具 {name}：{clip(json.dumps(inp, ensure_ascii=False), 120)}')

    def render(self, src):
        head = [
            f'# 会话摘要：{Path(src).stem}',
            '',
            f'- 日志：{src}',
            f'- 时间（北京）：{self.first:%Y-%m-%d %H:%M} — {self.last:%m-%d %H:%M}' if self.first else '- 时间：未知',
            f'- 用户原话 {self.counts["user"]} 条 · 工具调用 {self.counts["tools"]} 次 · 中断 {self.counts["interrupt"]} 次 · 上下文压缩 {self.counts["compact"]} 次',
            '- 说明：A 是 AI 回复（截断），$ 是命令，✎ 是写文件（写 = Write 整份写入，改 = Edit），🌐 是联网',
        ]
        tail = ['\n## 写过的文件\n', '| 文件 | 第一次 | 次数 | 最后 |', '| --- | --- | --- | --- |']
        tail += [f'| {p} | {f["first"]} | {f["count"]} | {f["last"]} |' for p, f in self.files.items()]
        if self.urls:
            tail += ['\n## 打开过的网址\n'] + [f'- {u}' for u in self.urls]
        return '\n'.join(head + self.out + tail) + '\n'


def parse_claude(lines, dg: Digest, rng):
    for d in lines:
        ts = d.get('timestamp')
        dt = t(ts)
        if rng and dt and not in_range(dt, rng):
            continue
        if d.get('isSidechain'):
            continue
        typ = d.get('type')
        if d.get('isCompactSummary'):
            dg.counts['compact'] += 1
            dg.note(ts, '【上下文压缩】')
            continue
        msg = d.get('message') if isinstance(d.get('message'), dict) else {}
        c = msg.get('content')
        if typ == 'user' and not d.get('isMeta'):
            if isinstance(c, str):
                blocks = [{'type': 'text', 'text': c}]
            else:
                blocks = c or []
            texts = [b.get('text', '') for b in blocks if isinstance(b, dict) and b.get('type') == 'text']
            imgs = sum(1 for b in blocks if isinstance(b, dict) and b.get('type') == 'image')
            errs = [b for b in blocks if isinstance(b, dict) and b.get('type') == 'tool_result' and b.get('is_error')]
            for e in errs:
                cc = e.get('content')
                cc = cc if isinstance(cc, str) else ' '.join(x.get('text', '') for x in (cc or []) if isinstance(x, dict))
                dg.out.append(f'  - ✗ 工具报错：{clip(cc, 160)}')
            raw = '\n'.join(texts)
            if '[Request interrupted' in raw:
                dg.counts['interrupt'] += 1
                dg.note(ts, '【用户中断】')
                continue
            if 'session is being continued from a previous conversation' in raw[:300]:
                dg.counts['compact'] += 1
                dg.note(ts, '【上下文压缩】')
                continue
            cmd = re.search(r'<command-name>(.*?)</command-name>', raw)
            if cmd:  # 用户敲的斜杠命令：记成「/命令 参数」
                args = re.search(r'<command-args>(.*?)</command-args>', raw, re.S)
                dg.user(ts, f'{cmd.group(1).strip()} {args.group(1).strip() if args else ""}'.strip(), imgs)
                continue
            text = clean_user(raw)
            if not text or text.startswith(('<command-', '<local-command', 'Caveat:', '<task-notification', '<agent-message', '[SYSTEM NOTIFICATION')):
                continue
            if text.startswith('<command-name>'):
                continue
            dg.user(ts, text, imgs)
        elif typ == 'assistant' and isinstance(c, list):
            for b in c:
                if not isinstance(b, dict):
                    continue
                if b.get('type') == 'text':
                    dg.ai(ts, b.get('text', ''))
                elif b.get('type') == 'tool_use':
                    dg.tool(ts, b.get('name', ''), b.get('input'))


def parse_codex(lines, dg: Digest, rng):
    for d in lines:
        ts = d.get('timestamp')
        dt = t(ts)
        if rng and dt and not in_range(dt, rng):
            continue
        p = d.get('payload') if isinstance(d.get('payload'), dict) else {}
        pt = p.get('type')
        if d.get('type') == 'compacted' or pt == 'context_compacted':
            dg.counts['compact'] += 1
            dg.note(ts, '【上下文压缩】')
        elif d.get('type') == 'event_msg' and pt == 'user_message':
            dg.user(ts, clean_user(p.get('message', '')))
        elif d.get('type') == 'event_msg' and pt == 'agent_message':
            dg.ai(ts, p.get('message', ''))
        elif d.get('type') == 'response_item' and pt in ('function_call', 'custom_tool_call'):
            args = p.get('arguments') or p.get('input') or '{}'
            try:
                args = json.loads(args) if isinstance(args, str) else args
            except Exception:
                args = {'input': args}
            dg.tool(ts, p.get('name', ''), args if isinstance(args, dict) else {'input': args})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('jsonl')
    ap.add_argument('-o', '--out')
    ap.add_argument('--text', type=int, default=400, help='AI 回复每段最多保留多少字')
    ap.add_argument('--from', dest='frm', help="从这个时间起（北京时间，'11-03' 或 '11-03 22:25'）")
    ap.add_argument('--until', '--to', dest='to', help="到这个时间为止（'11-04' 或 '11-04 12:15'）")
    a = ap.parse_args()
    lines = []
    with open(a.jsonl, encoding='utf-8', errors='replace') as f:
        for line in f:
            try:
                x = json.loads(line)
            except Exception:
                continue
            if isinstance(x, dict):
                lines.append(x)
    codex = any(d.get('type') in ('event_msg', 'response_item') for d in lines[:50])
    dg = Digest(a.text)
    rng = None
    if a.frm or a.to:
        first = next((x for x in (t(d.get('timestamp')) for d in lines) if x), None)
        if first:
            rng = (bound(a.frm, first, False) if a.frm else None, bound(a.to, first, True) if a.to else None)
    (parse_codex if codex else parse_claude)(lines, dg, rng)
    md = dg.render(a.jsonl)
    if a.out:
        Path(a.out).write_text(md, encoding='utf-8')
        print(f'摘要写到 {a.out}：{len(md)} 字，用户原话 {dg.counts["user"]} 条')
    else:
        sys.stdout.write(md)


if __name__ == '__main__':
    main()
