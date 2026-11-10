#!/usr/bin/env python3
"""找要复盘的会话日志（Claude Code / Codex 的 JSONL）。

用法：
  find_session.py                 当前会话（Claude Code 按 CLAUDE_CODE_SESSION_ID，Codex 按 CODEX_THREAD_ID；都没有就取当前目录对应项目里最近改过的那份）
  find_session.py <id 或路径>      指定会话
  find_session.py --list [-n 15]   列出最近的会话：开始时间、轮数、大小、第一句话
  find_session.py --grep 关键词     在用户原话里搜，找过去的会话
输出最后一行是 JSONL 路径，其余是给人看的说明。
"""
from __future__ import annotations

import argparse, json, os, re, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

CLAUDE = Path.home() / '.claude' / 'projects'
CODEX = Path(os.environ.get('CODEX_HOME', Path.home() / '.codex'))
BJ = timezone(timedelta(hours=8))


def slug(p: str) -> str:
    return re.sub(r'[^A-Za-z0-9]', '-', p)


def all_logs():
    if CLAUDE.exists():
        yield from (p for p in CLAUDE.glob('*/*.jsonl'))
    for d in (CODEX / 'sessions', CODEX / 'archived_sessions'):
        if d.exists():
            yield from d.rglob('*.jsonl')


def bj(ts: str) -> str:
    try:
        return datetime.fromisoformat(ts.replace('Z', '+00:00')).astimezone(BJ).strftime('%m-%d %H:%M')
    except Exception:
        return '?'


def user_texts(path: Path, limit=200):
    """依次给出 (时间, 用户原话)；跳过工具结果、系统注入和命令输出"""
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if not isinstance(d, dict):
                continue
            p = d.get('payload') if isinstance(d.get('payload'), dict) else {}
            if d.get('type') == 'event_msg' and p.get('type') == 'user_message':
                if isinstance(p.get('message'), str) and p['message'].strip():
                    yield d.get('timestamp', ''), p['message']
                continue
            if d.get('type') != 'user' or d.get('isMeta') or d.get('isSidechain'):
                continue
            msg = d.get('message')
            c = msg.get('content') if isinstance(msg, dict) else None
            if isinstance(c, list):
                c = '\n'.join(b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text')
            if not isinstance(c, str) or not c.strip():
                continue
            c = re.sub(r'<system-reminder>.*?</system-reminder>', '', c, flags=re.S).strip()
            if not c or c.startswith(('<command-', '<local-command', 'Caveat:', '[Request interrupted', '<task-notification', '<agent-message', '[SYSTEM NOTIFICATION')) or 'session is being continued' in c[:300]:
                continue
            yield d.get('timestamp', ''), c


def describe(path: Path) -> str:
    us = list(user_texts(path))
    first = us[0] if us else ('', '')
    last = us[-1][0] if us else ''
    size = path.stat().st_size / 1e6
    return f'{bj(first[0])} → {bj(last)} · {len(us)} 条原话 · {size:.1f} MB · {path.stem[:8]}  「{first[1][:50].replace(chr(10), " ")}」'


def current() -> Path | None:
    """先按会话 id 精确找；没有 id 时，从当前目录往上找对应的 Claude Code 项目目录，取最近改过的那份"""
    for tid in (os.environ.get('CLAUDE_CODE_SESSION_ID'), os.environ.get('CODEX_THREAD_ID')):
        if tid:
            hits = sorted((p for p in all_logs() if tid in p.name), key=lambda p: p.stat().st_mtime)
            if hits:
                return hits[-1]
            print(f'没找到会话 {tid[:8]} 的日志，改按当前目录找最近的一份；不对就用 --list 挑', file=sys.stderr)
    here = Path(os.getcwd())
    for d in [here, *here.parents]:
        proj = CLAUDE / slug(str(d))
        cands = list(proj.glob('*.jsonl')) if proj.exists() else []
        if cands:
            return max(cands, key=lambda p: p.stat().st_mtime)
    cands = list(CLAUDE.glob('*/*.jsonl'))
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target', nargs='?')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--grep')
    ap.add_argument('-n', type=int, default=15)
    a = ap.parse_args()
    logs = sorted(all_logs(), key=lambda p: p.stat().st_mtime, reverse=True)
    if a.list or a.grep:
        shown = 0
        for p in logs:
            if a.grep and not any(a.grep in t for _, t in user_texts(p)):
                continue
            print(describe(p), '\n   ', p)
            shown += 1
            if shown >= a.n:
                break
        if not shown:
            print('没找到')
        return
    if a.target:
        t = Path(a.target).expanduser()
        hit = t if t.exists() else next((p for p in logs if a.target in p.name), None)
    else:
        hit = current()
    if not hit:
        sys.exit('找不到会话日志：用 --list 看最近的会话，或 --grep 搜原话')
    print(describe(hit))
    print(hit)


if __name__ == '__main__':
    main()
