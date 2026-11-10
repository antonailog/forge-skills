#!/usr/bin/env python3
"""验收用：复盘里引用的原话，在会话日志里搜不搜得到。只打印搜不到的，不读进上下文。

用法：check_quotes.py <会话日志.jsonl> <复盘文件夹>

从复盘 JSON 里取：过程回顾的触发原话、摘要的 cause、需求表达的原话（整句），
以及关键决策理由、知识条目来源、对标证据里「」括起来的部分。按 … 切成片段，
去掉空白、引号和加粗符号后在日志的文字里找（日志里转义过的引号、换行先解码）。
‹邮箱›‹IP› 这类打码处当断点。延伸学习引的是长期方向表，不查。上下文压缩的摘要不算原文。
"""
from __future__ import annotations

import json, re, sys
from pathlib import Path


def strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from strings(v)


def squash(s: str) -> str:
    """去掉空白、Markdown 加粗和反引号、各种引号：原话常被改了引号或去掉了加粗"""
    return re.sub(r'[\s*`「」『』“”‘’"\']+', '', s)


def log_text(path: Path) -> str:
    parts = []
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if not isinstance(d, dict) or d.get('isCompactSummary') or d.get('type') == 'summary':
                continue
            parts.extend(strings(d.get('message', d.get('payload', d))))
    return squash('\n'.join(parts))


def load(folder: Path) -> dict:
    out: dict = {}
    for p in sorted(folder.glob('*.json')):
        if p.name.startswith('_'):
            continue
        try:
            d = json.loads(p.read_text(encoding='utf-8'))
        except ValueError:
            continue
        for k, v in (d.get('review') or {}).items():
            if isinstance(v, list):
                out.setdefault(k, []).extend(v)
            elif isinstance(v, dict):
                for k2, v2 in v.items():
                    if isinstance(v2, list):
                        out.setdefault(k, {}).setdefault(k2, []).extend(v2)
                    else:
                        out.setdefault(k, {})[k2] = v2
    return out


def quotes(r: dict):
    """(在哪, 引的话)"""
    ov = r.get('overview') or {}
    s = ov.get('summary') or {}
    if s.get('cause'):
        yield '摘要 cause', s['cause']
    for st in ov.get('stages') or []:
        if isinstance(st, dict) and st.get('quote'):
            yield f'过程回顾「{st.get("name", "?")}」', st['quote']
    for e in r.get('expression') or []:
        for q in (e.get('quotes') or []) if isinstance(e, dict) else []:
            if isinstance(q, list) and len(q) == 2:
                yield f'需求表达「{e.get("title", "?")}」', q[1]
    bracket = []
    for d in ov.get('decisions') or []:
        if isinstance(d, dict):
            bracket.append((f'决策 {d.get("id", "?")}', d.get('reason', '')))
    for k in (r.get('knowledge') or {}).get('entries') or []:
        if isinstance(k, dict) and k.get('group') != '延伸':
            bracket.append((f'知识 {k.get("id", "?")}', k.get('source', '')))
    for b in r.get('bench') or []:
        for ev in (b.get('evidence') or []) if isinstance(b, dict) else []:
            bracket.append((f'对标 {b.get("id", "?")}', ev))
    for where, text in bracket:
        for m in re.finditer(r'「([^「」]{4,})」', str(text or '')):
            yield where, m.group(1)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    log, folder = Path(sys.argv[1]).expanduser(), Path(sys.argv[2]).expanduser()
    text = log_text(log)
    total, miss = 0, []
    for where, q in quotes(load(folder)):
        frags = [squash(x) for x in re.split(r'…+|\.{3,}|‹[^›]*›', str(q))]
        frags = [x for x in frags if len(x) >= 6]
        if not frags:
            continue
        total += 1
        bad = [x for x in frags if x not in text]
        if bad:
            miss.append((where, bad[0]))
    print(f'原话 {total} 处，搜不到 {len(miss)} 处')
    for where, x in miss:
        print(f'  - {where}：{x[:60]}')


if __name__ == '__main__':
    main()
