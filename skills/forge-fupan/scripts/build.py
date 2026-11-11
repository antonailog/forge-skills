#!/usr/bin/env python3
"""把一篇复盘的 JSON 编成阅读页数据，并重建复盘汇总页。

一篇复盘是一个文件夹：记录/复盘/<项目>/<模块>/<日期>-<标题>/，里面放 AI 写的若干 *.json（按文件名顺序合并：
字典逐层合并，列表首尾相接，所以可以分节写、也可以几个子 agent 各写一份 knowledge.entries）。文件名以 _ 开头的不合并。

用法：
  build.py <复盘文件夹>             校验 → 读文件、算行号、打码、截图 → 写 data.js 和「打开复盘.html」→ 重建汇总页
  build.py <复盘文件夹> --check     只校验，不出页面
  build.py --index                  只重建汇总页（记录/复盘/index.html + index.data.js）
  build.py --known-terms 词1 词2… --self <复盘文件夹> --session <会话 id>   这些词在以前的复盘里出现过没有
                                    （不算这一篇自己，也不算同一个会话以前用旧版写的复盘）
  build.py <复盘文件夹> --emit-data 输出.json   编好的数据另存一份（阅读页开发用，别存进复盘文件夹）

复盘根目录默认 ~/claudecode_workspace/记录/复盘，可用环境变量 FUPAN_ROOT 改；JSON 里的文件路径相对工作区根（复盘根的上两级），
也可以写绝对路径或 ~ 开头。字段说明见 references/schema.md。
"""
from __future__ import annotations

import argparse, json, os, re, shutil, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, unquote, urlencode

SKILL = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get('FUPAN_ROOT', Path.home() / 'claudecode_workspace' / '记录' / '复盘')).expanduser().resolve()
BJ = timezone(timedelta(hours=8))
STUB = '打开复盘.html'

# ---------- 取值范围（和 references/schema.md 一致） ----------
EVAL = {'一致', '合理偏离', '待改进', '缺失'}
STATUS = {'达成', '部分达成', '待验证', '未达成', '移出范围', '延后'}
SUMMARY_STATUS = {'已上线', '进行中', '仅讨论'}
DEC_SOURCE = {'用户方案', '用户选择', '用户倾向', '采纳建议', '调整建议', '否决建议', 'AI 决定 · 已告知', 'AI 决定 · 未告知'}
OWNER = {'decide', 'wait', 'ai'}
GROUP = {'盲区', '专题', '延伸'}
KKIND = {'架构', '选型', '工具', '知识点', None}
GKIND = {'选型', '效果', '做法'}
SIDE = {'mine', 'talked', 'base'}
KFTYPE = {'文档', '配置'}
FILE_STATUS = {'', '新增', '修改', '样稿', '本地快照', '已删除'}
LANG = {'.py': 'python', '.sh': 'shellscript', '.zsh': 'shellscript', '.bash': 'shellscript', '.js': 'javascript', '.mjs': 'javascript',
        '.cjs': 'javascript', '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'tsx', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
        '.toml': 'toml', '.sql': 'sql', '.html': 'html', '.htm': 'html', '.css': 'css', '.conf': 'nginx', '.ini': 'ini',
        '.service': 'ini', '.timer': 'ini', '.env': 'ini', '.md': 'markdown'}
MAX_FILE = 400_000
IMAGE = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'}
BAD_NAME = re.compile(r'[#?%&]')

# ---------- 打码 ----------
_OCT = r'(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)'
IPV4 = re.compile(rf'(?<![\d.A-Za-z])(?<![A-Za-z]/)(?<!version )(?<!版本 )(?!127\.0\.0\.1(?!\d))(?!0\.0\.0\.0(?!\d))(?:{_OCT}\.){{3}}{_OCT}(?!\d)(?!\.\d)')
IPV6 = re.compile(r'(?<![0-9A-Za-z_:])(?:(?:[0-9a-fA-F]{1,4}:){5,7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,6})?|::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})(?![0-9A-Za-z_:])')
# 只认 ASCII 字符：\w 在 Python 里包含中文，紧挨着中文的邮箱会被吞掉整句；logo@2x.png 这类文件名不算邮箱
_FILE_EXT = r'(?:png|jpe?g|webp|gif|svg|avif|ico|js|mjs|cjs|ts|tsx|css|json|md|html?|txt|py|sh)(?![A-Za-z0-9-])'
EMAIL = re.compile(rf'(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?!{_FILE_EXT})[A-Za-z]{{2,}}(?![A-Za-z0-9-])')
SAFE_EMAIL = re.compile(r'(?i)noreply@|no-reply@|@example\.(?:com|org|net)$|^git@')
_KEY = r'[A-Za-z0-9_-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[A-Za-z0-9_-]*'
SECRET_Q = re.compile(rf'(?i)(?<![A-Za-z0-9])({_KEY})(["\']?\s*[:=]\s*)(["\'])([^"\'\n]{{4,}}?)\3')
SECRET = re.compile(rf'(?i)(?<![A-Za-z0-9])({_KEY})(["\']?\s*[:=]\s*)(?!["\'`])([^\s"\'`,;()\[\]{{}}<>]{{5,}})(?![\w.]*\()')
SECRET_ARG = re.compile(r'(?i)(--[A-Za-z0-9-]*(?:secret|token|password|api-key)[A-Za-z0-9-]*)(["\']?\s*[,=\s]\s*["\']?)([^\s"\',]{6,})')
BEARER = re.compile(r'(?i)((?:bearer|basic)\s+)([A-Za-z0-9._~+/=-]{12,})')
URL_CRED = re.compile(r'(?i)([a-z][a-z0-9+.-]*://[^\s:/@]*:)([^\s@/]{3,})(@)')
CURL_USER = re.compile(r'(\bcurl\b[^\n|;&]*?\s(?:-u|--user)\s+["\']?[^\s:"\']*:)([^\s"\']{4,})')   # 只认 curl 的 -u（date -u、sudo -u 不算）
PEM = re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----')
PREFIXED = re.compile(r'(?<![A-Za-z0-9])(?:sk-ant-[\w-]{16,}|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|[sr]k_(?:live|test)_[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})')
# 值是这些就不是密钥：类型名、取值说明、纯数字、代码里的属性路径（os.environ、self.token）
_NOT_SECRET = re.compile(r'(?i)^(?:string|number|boolean|bool|any|unknown|null|none|undefined|true|false|str|int|float|object|required|optional|auto|await|async|new|typeof|function|require|import|this|self|xxx+|\*+|\.\.\.|…+)$'
                         r'|^\d+$|^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$|[^\x00-\x7f]')
_TYPE_NAME = re.compile(r'^[A-Z][a-z]+(?:[A-Z][a-z]+)*$')   # Buffer、Promise 这类类型名
_COUNT_KEY = re.compile(r'(?i)tokens\b|max[_-]?tokens?|token[_-]?(?:count|usage|limit|budget|num)|num[_-]?tokens?')


def _secret_ok(key: str, val: str) -> bool:
    """真像密钥才算：键是计数类（max_tokens）、值是类型名或纯数字的不算"""
    v = val.strip()
    return not (_COUNT_KEY.search(key) or _NOT_SECRET.search(v) or _TYPE_NAME.match(v))


def _bare_ok(key: str, val: str) -> bool:
    """不带引号的 key=value：值是变量名（docId、match）、环境变量引用（$KEY）、占位（test-key、sk-...）的不算"""
    v = val.strip().rstrip('.')
    return _secret_ok(key, v) and not (re.fullmatch(r'[A-Za-z_-]+', v) or v.startswith('$') or val.endswith(('...', '…')))


def _bearer_ok(val: str) -> bool:
    """「Bearer authentication」这种普通英文词不算"""
    return bool(re.search(r'[0-9=+/]', val))   # 真令牌几乎都带数字或 base64 的 = + /；「Basic Authentication」这类英文词不算


def _is_version(m) -> bool:
    """「版本 1.2.3.4」「Version: 1.2.3.4」「版本号1.2.3.4」是版本号，不是 IP"""
    return bool(re.search(r'(?i)(?:version|ver\.?|版本号?)\s*[:：=]?\s*$', m.string[max(0, m.start() - 14):m.start()]))


def _ipv6_ok(s: str) -> bool:
    """去掉误判：MAC 地址（每段两位）、时间（全是两位以内的数字）、切片写法 1::2"""
    groups = [g for g in s.split(':') if g]
    if len(groups) < 2 or not any(len(g) >= 3 for g in groups):
        return False
    return not all(len(g) == 2 for g in groups)


def mask(text: str, extra: list[str]) -> str:
    for s in extra:
        if s:
            text = text.replace(s, '‹已打码›')
    text = PEM.sub('‹已打码›', text)
    text = PREFIXED.sub('‹已打码›', text)
    text = URL_CRED.sub(lambda m: m.group(1) + '‹已打码›' + m.group(3), text)
    text = CURL_USER.sub(lambda m: m.group(1) + '‹已打码›', text)
    text = BEARER.sub(lambda m: m.group(1) + '‹已打码›' if _bearer_ok(m.group(2)) else m.group(0), text)
    text = SECRET_ARG.sub(lambda m: m.group(1) + m.group(2) + '‹已打码›' if _secret_ok(m.group(1), m.group(3)) else m.group(0), text)
    text = SECRET_Q.sub(lambda m: m.group(1) + m.group(2) + m.group(3) + '‹已打码›' + m.group(3) if _secret_ok(m.group(1), m.group(4)) else m.group(0), text)
    text = SECRET.sub(lambda m: m.group(1) + m.group(2) + '‹已打码›' if _bare_ok(m.group(1), m.group(3)) else m.group(0), text)
    text = EMAIL.sub(lambda m: m.group(0) if SAFE_EMAIL.search(m.group(0)) else '‹邮箱›', text)
    text = IPV4.sub(lambda m: m.group(0) if _is_version(m) else '‹IP›', text)
    return IPV6.sub(lambda m: '‹IP›' if _ipv6_ok(m.group(0)) else m.group(0), text)


def leaks(text: str, extra: list[str] = ()) -> list[str]:
    """页面文字里要拦下的：IP、邮箱、密钥（和 mask() 同一套规则），加上 mask 名单里的字"""
    hits = [m.group(0) for m in IPV4.finditer(text) if not _is_version(m)] + [m.group(0) for m in IPV6.finditer(text) if _ipv6_ok(m.group(0))]
    hits += [m.group(0) for m in EMAIL.finditer(text) if not SAFE_EMAIL.search(m.group(0))]
    hits += [m.group(0)[:30] for r in (PREFIXED, PEM, URL_CRED, CURL_USER) for m in r.finditer(text)]
    hits += [m.group(0)[:30] for m in BEARER.finditer(text) if _bearer_ok(m.group(2))]
    hits += [m.group(0)[:30] for m in SECRET.finditer(text) if _bare_ok(m.group(1), m.group(3))]
    hits += [m.group(0)[:30] for m in SECRET_Q.finditer(text) if _secret_ok(m.group(1), m.group(4))]
    hits += [m.group(0)[:30] for m in SECRET_ARG.finditer(text) if _secret_ok(m.group(1), m.group(3))]
    hits += [x for x in extra if x and x in text]
    return hits


# ---------- 读 JSON ----------
def merge(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        out = dict(a)
        for k, v in b.items():
            out[k] = merge(out[k], v) if k in out else v
        return out
    if isinstance(a, list) and isinstance(b, list):
        return a + b
    return b


def natural(p: Path):
    return [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', p.stem)]


def load(folder: Path) -> dict:
    parts = sorted((p for p in folder.glob('*.json') if not p.name.startswith('_')), key=natural)
    if not parts:
        sys.exit(f'{folder} 里没有 *.json')
    data = {}
    for p in parts:
        try:
            x = json.loads(p.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            sys.exit(f'{p.name} 不是合法 JSON：第 {e.lineno} 行第 {e.colno} 列 {e.msg}')
        if not isinstance(x, dict):
            sys.exit(f'{p.name} 最外层要是对象 {{…}}')
        data = merge(data, x)
    return data


TYPE_ERR: list[str] = []   # defaults() 发现写错类型的整节，validate() 报出来（不静默丢掉）


def _dict(d: dict, k: str) -> dict:
    if not isinstance(d.get(k), dict):
        if d.get(k) is not None:
            TYPE_ERR.append(f'{k} 要写成对象 {{…}}，现在是{type(d[k]).__name__}')
        d[k] = {}
    return d[k]


def _list(d: dict, k: str, where: str = '') -> list:
    if not isinstance(d.get(k), list):
        if d.get(k) is not None:
            TYPE_ERR.append(f'{where + " 的 " if where else ""}{k} 要写成列表 […]，现在是{type(d[k]).__name__}')
        d[k] = []
    return d[k]


def _key(v):
    """拿来查「在不在取值范围里」：写成列表、对象的值换成一个不可能命中的字符串，不让 set 查找崩掉"""
    return v if isinstance(v, (str, int, float, bool, type(None))) else f'<{type(v).__name__}>'


def defaults(d: dict) -> dict:
    TYPE_ERR.clear()
    for k in ('results', 'keyFiles', 'mask'):
        _list(d, k)
    _dict(d, 'files'); _dict(d, 'session')
    code = _dict(d, 'code'); _list(code, 'modules'); code.setdefault('flow', '')
    oth = _dict(d, 'others'); _list(oth, 'groups'); _list(oth, 'server')
    lo = _dict(d, 'leftovers'); _list(lo, 'items'); lo.setdefault('asOf', ''); lo.setdefault('status', '')
    r = _dict(d, 'review')
    for k in ('bench', 'path', 'expression'):
        _list(r, k)
    _dict(r, 'sources'); r.setdefault('task', '')
    kn = _dict(r, 'knowledge'); _list(kn, 'entries'); _list(kn, 'layers')
    _list(_dict(r, 'glossary'), 'modules')
    ov = _dict(r, 'overview'); _dict(ov, 'summary')
    for k in ('stages', 'decisions', 'goals', 'findings'):
        _list(ov, k)
    for g in ov['goals']:
        if isinstance(g, dict):
            _list(g, 'children')
    return d


# ---------- 校验 ----------
def parse_range(rg: str):
    """「2026-11-03 22:25 — 11-04 12:15」→ (开始, 结束)；跨年时结束年份自动加一"""
    m = re.match(r'\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})\s*(?:—|–|-|~|～|至|到)+\s*(?:(?:(\d{4})-)?(\d{2})-(\d{2})\s+)?(\d{2}):(\d{2})\s*$', rg or '')
    if not m:
        return None
    y, mo, dd, h1, m1, y2, mo2, dd2, h2, m2 = m.groups()
    try:
        a = datetime(int(y), int(mo), int(dd), int(h1), int(m1), tzinfo=BJ)
        b = datetime(int(y2 or y), int(mo2 or mo), int(dd2 or dd), int(h2), int(m2), tzinfo=BJ)
    except ValueError:   # 2 月 30 日、25:00 这类不存在的时间
        return None
    if b < a and not mo2:   # 只写了钟点：跨午夜
        b += timedelta(days=1)
    elif b < a and not y2 and (int(mo2), int(dd2)) < (int(mo), int(dd)):   # 写了月日没写年、月日比开始早：跨年
        try:
            b = b.replace(year=b.year + 1)
        except ValueError:
            return None
    if b < a:   # 结束早于开始
        return None
    return a, b


def validate(d: dict, icons: dict) -> tuple[list[str], list[str]]:
    E, W = [], []

    def need(obj, keys, where, typ=str):
        for k in keys:
            v = obj.get(k) if isinstance(obj, dict) else None
            if typ is str and not (isinstance(v, str) and v.strip()):
                E.append(f'{where} 缺 {k}（要一段文字）')
            elif typ is list and not isinstance(v, list):
                E.append(f'{where} 的 {k} 要写成列表 […]')
            elif typ is dict and not isinstance(v, dict):
                E.append(f'{where} 的 {k} 要写成对象 {{…}}')

    def items(lst, where):
        if not isinstance(lst, list):
            E.append(f'{where} 要写成列表')
            return []
        bad = [i for i, x in enumerate(lst) if not isinstance(x, dict)]
        if bad:
            E.append(f'{where} 第 {bad[0] + 1} 项要写成对象 {{…}}')
        return [x for x in lst if isinstance(x, dict)]

    if not isinstance(d['mask'], list) or not all(isinstance(x, str) for x in d['mask']):
        E.append('mask 要写成字符串列表 ["…", "…"]')
        d['mask'] = []
    r, ov = d['review'], d['review']['overview']
    s = ov['summary']
    need(s, ('title', 'range', 'module', 'status', 'why', 'did', 'got', 'cause'), '摘要 review.overview.summary')
    for k, n in (('why', 25), ('did', 35), ('got', 45)):
        if len(str(s.get(k, ''))) > n:
            W.append(f'摘要 {k} 有 {len(str(s[k]))} 字，超过 {n} 字，汇总页一行放不下')
    if len(str(s.get('why', ''))) + len(str(s.get('did', ''))) > 60:
        W.append('摘要 why + did 超过 60 字，汇总页第一行放不下')
    if not (isinstance(s.get('projects'), list) and s['projects'] and all(isinstance(x, str) for x in s['projects'])):
        E.append('摘要的 projects 要写成项目名列表，如 ["个人博客"]')
    if s.get('range') and not parse_range(str(s['range'])):
        E.append(f'摘要 range「{s["range"]}」要写成「2026-11-03 22:25 — 11-04 12:15」（汇总页按它排序、分月）')
    if s.get('status') and _key(s['status']) not in SUMMARY_STATUS:
        E.append(f'摘要状态「{s["status"]}」不在 {sorted(SUMMARY_STATUS)}')
    if str(s.get('title', '')).endswith('复盘'):
        W.append('摘要标题写成了「××复盘」，应是一句结论')
    need(d['session'], ('title', 'id', 'range'), 'session')
    if d['session'].get('range') and not parse_range(str(d['session']['range'])):
        E.append(f'session.range「{d["session"]["range"]}」要写成「2026-11-03 22:25 — 11-04 12:15」')
    stages, decs, goals = items(ov['stages'], '过程回顾'), items(ov['decisions'], '关键决策'), items(ov['goals'], '结果评估')
    dec_ids = {_key(x.get('id')) for x in decs}
    for x in decs:
        need(x, ('id', 'what', 'source', 'alts', 'reason', 'effect'), f'决策 {x.get("id", "?")}')
        if x.get('source') and _key(x['source']) not in DEC_SOURCE:
            E.append(f'决策 {x.get("id")} 的来源「{x.get("source")}」不在 {sorted(DEC_SOURCE)}')
    for st in stages:
        need(st, ('start', 'dur', 'name', 'quote', 'story', 'out'), f'过程回顾「{st.get("name", "?")}」')
        for x in _list(st, 'dec', f'过程回顾「{st.get("name", "?")}」'):
            if _key(x) not in dec_ids:
                E.append(f'过程回顾「{st.get("name")}」挂的决策 {x} 不存在')
    for g in goals:
        need(g, ('kind', 'title', 'status', 'origin', 'criterion'), f'目标「{g.get("title", "?")}」')
        if g.get('kind') and _key(g['kind']) not in ('主目标', '衍生目标'):
            E.append(f'目标「{g.get("title")}」的 kind「{g.get("kind")}」要写 主目标 或 衍生目标')
        kids_ = items(g['children'], f'目标「{g.get("title", "?")}」的 children')
        for c in kids_:
            need(c, ('status', 'title', 'evidence'), f'子目标「{c.get("title", "?")}」')
        for x in [g] + kids_:
            if x.get('status') and _key(x['status']) not in STATUS:
                E.append(f'目标「{x.get("title")}」状态「{x.get("status")}」不在 {sorted(STATUS)}')
    if not all(isinstance(x, str) for x in ov['findings']):
        E.append('findings 要写成字符串列表')

    # 交付物
    for x in items(d['results'], '结果 results'):
        need(x, ('id', 'title', 'meta'), f'结果「{x.get("title", "?")}」')
        if not x.get('url') and not x.get('file'):
            E.append(f'结果「{x.get("title")}」要有 url（线上网址）或 file（本地文件）')
        x.setdefault('host', '')
        if 'shot' in x and not isinstance(x['shot'], str):
            E.append(f'结果「{x.get("title")}」的 shot 要写 "capture" 或一张图片的路径')
        if x.get('id') and not re.fullmatch(r'[A-Za-z0-9_-]+', str(x['id'])):
            E.append(f'结果 id「{x["id"]}」只用英文、数字、- 和 _（截图按它命名）')
    for x in items(d['keyFiles'], '关键文件 keyFiles'):
        need(x, ('file', 'type', 'title', 'what'), f'关键文件「{x.get("title", "?")}」')
        if x.get('type') and _key(x['type']) not in KFTYPE:
            E.append(f'关键文件「{x.get("title")}」的 type「{x["type"]}」不在 文档/配置')
        if 'marks' in x and not (isinstance(x['marks'], list) and x['marks'] and all(isinstance(r, list) and len(r) == 2 and all(isinstance(n, int) for n in r) for r in x['marks'])):
            E.append(f'关键文件「{x.get("title")}」的 marks 要写成 [[起, 止], …]，至少一段；不标行就别写 marks')
        if 'match' in x and not (isinstance(x['match'], list) and x['match'] and all(isinstance(t, str) and t for t in x['match'])):
            E.append(f'关键文件「{x.get("title")}」的 match 要写成 ["要找的字", …]，至少一个')
        if not (x.get('value') or x.get('detail')):
            W.append(f'关键文件「{x.get("title")}」没写 value 也没写 detail，卡片右边会空着')
    for m in items(d['code']['modules'], '代码模块 code.modules'):
        need(m, ('id', 'name', 'role'), f'代码模块「{m.get("name", "?")}」')
        need(m, ('practices', 'files'), f'代码模块「{m.get("name", "?")}」', list)
        if isinstance(m.get('practices'), list) and not all(isinstance(pr, list) and len(pr) == 2 and all(isinstance(t, str) for t in pr) for pr in m['practices']):
            E.append(f'代码模块「{m.get("name")}」的 practices 要写成 [["标准叫法", "解决什么"], …]')
        for cf in items(m.get('files') or [], f'代码模块「{m.get("name", "?")}」的 files'):
            w = f'代码文件 {cf.get("file", "?")}'
            need(cf, ('file', 'title', 'detail', 'role'), w)
            need(cf, ('stack', 'flow', 'ideas'), w, list)
            io = cf.get('io')
            if not (isinstance(io, dict) and io.get('in') and io.get('out')):
                E.append(f'{w} 的 io 要写成 {{"in": "…", "out": "…"}}')
            if isinstance(cf.get('flow'), list) and not cf['flow']:
                E.append(f'{w} 的 flow 至少写一步')
            for st in items(cf.get('flow') or [], f'{w} 的 flow'):
                need(st, ('step', 'desc'), f'{w} 的执行流程')
                for fn in items(_list(st, 'fns', f'{w} 的执行流程'), f'{w} 的 fns'):
                    need(fn, ('name',), f'{w} 的函数')
                    if 'ranges' in fn and not (isinstance(fn['ranges'], list) and fn['ranges'] and all(
                            isinstance(r_, list) and len(r_) == 2 and all(isinstance(n, int) for n in r_) for r_ in fn['ranges'])):
                        E.append(f'{w} 的函数「{fn.get("name")}」ranges 要写成 [[起, 止], …]（是两层括号）')
    for g in items(d['others']['groups'], '其余产出 others.groups'):
        for row in items(_list(g, 'rows', f'其余产出「{g.get("name", "?")}」'), f'其余产出「{g.get("name", "?")}」'):
            need(row, ('file', 'use', 'change'), f'其余产出「{g.get("name", "?")}」的一行')
    lo = d['leftovers']
    for it in items(lo['items'], '遗留事项'):
        need(it, ('owner', 'title', 'when', 'note', 'prompt'), f'遗留事项「{it.get("title", "?")}」')
        if it.get('owner') and _key(it['owner']) not in OWNER:
            E.append(f'遗留事项「{it.get("title")}」的 owner「{it.get("owner")}」不在 decide/wait/ai')
    if lo['items'] and not lo.get('status'):
        E.append('有遗留事项时 leftovers.status 要写项目最新状态文件的路径（如 docs/project.md）')

    # 二、工作复盘
    sources = r['sources']
    for k, src in sources.items():
        if not isinstance(src, dict) or not str(src.get('url', '')).startswith(('http://', 'https://')):
            E.append(f'来源 {k} 的网址不对：{src.get("url") if isinstance(src, dict) else src}')
        elif not src.get('title'):
            E.append(f'来源 {k} 缺 title')
    benches = items(r['bench'], '对标分析 bench')
    bench_ids = {_key(b.get('id')) for b in benches}
    for b in benches:
        w = f'对标项 {b.get("id", "?")}'
        need(b, ('id', 'step', 'eval', 'gapLine', 'why', 'cost', 'say'), w)
        need(b, ('mineKw', 'baseKw', 'dims', 'keywords', 'evidence', 'sources'), w, list)
        if b.get('eval') and _key(b['eval']) not in EVAL:
            E.append(f'{w} 的判断「{b.get("eval")}」不在 {sorted(EVAL)}')
        for dm in items(b.get('dims') or [], f'{w} 的 dims'):
            if not (isinstance(dm.get('mine'), list) and isinstance(dm.get('base'), list) and 'same' in dm and dm.get('dim')):
                E.append(f'{w} 的 dims 每项要有 dim、mine[]、base[]、same')
        for kw in items(b.get('keywords') or [], f'{w} 的 keywords'):
            kw.setdefault('src', None)
            need(kw, ('term', 'what'), f'{w} 的关键词「{kw.get("term", "?")}」')
            if _key(kw.get('side')) not in ('mine', 'base'):
                E.append(f'{w} 的关键词「{kw.get("term")}」side 要写 mine 或 base')
            if kw['src'] and _key(kw['src']) not in sources:
                E.append(f'{w} 的关键词「{kw.get("term")}」引用的来源 {kw["src"]} 不在 review.sources')
        for x in b.get('sources') or []:
            if _key(x) not in sources:
                E.append(f'{w} 引用的来源 {x} 不在 review.sources')
        if b.get('landscape') is not None:
            for n in items(b['landscape'], f'{w} 的 landscape'):
                if not n.get('chosen') and n.get('src') and _key(n['src']) not in sources:
                    E.append(f'{w} 方案全景里「{n.get("name")}」的来源 {n["src"]} 不在 review.sources')
    for x in r['path']:
        if _key(x) not in bench_ids:
            E.append(f'review.path 里的 {x} 不是对标项 id')
    if benches and ({_key(x) for x in r['path']} != bench_ids or len(r['path']) != len(bench_ids)):
        E.append('review.path 要把每个对标项按最佳路径顺序排一遍，每个一次')
    if benches and not r.get('task'):
        E.append('有对标分析时 review.task 要写这类工作叫什么（如「网站访问统计」）')
    for e in items(r['expression'], '需求表达'):
        need(e, ('type', 'title', 'effect', 'say'), f'需求表达「{e.get("title", "?")}」')
        if not (isinstance(e.get('quotes'), list) and e['quotes'] and all(isinstance(q, list) and len(q) == 2 for q in e['quotes'])):
            E.append(f'需求表达「{e.get("title")}」的 quotes 要写成 [["北京时间", "原话"], …]')

    # 三、知识拓展
    layers = items(r['knowledge']['layers'], '知识地图骨架 knowledge.layers')
    for l in layers:
        need(l, ('name', 'decide', 'chosen'), f'骨架层「{l.get("name", "?")}」')
    layer_names = {_key(l.get('name')) for l in layers}
    entries = items(r['knowledge']['entries'], '知识条目')
    kids = [_key(e.get('id')) for e in entries]
    if len(kids) != len(set(kids)):
        E.append('知识条目的 id 有重复')
    for e in entries:
        w = f'知识条目 {e.get("id", "?")}'
        need(e, ('id', 'title', 'sourceLabel', 'source', 'what', 'judge', 'say', 'verify', 'reading'), w)
        if _key(e.get('group')) not in GROUP:
            E.append(f'{w} 的 group「{e.get("group")}」不在 {sorted(GROUP)}')
        e.setdefault('kind', None)
        if _key(e['kind']) not in KKIND:
            E.append(f'{w} 的 kind「{e.get("kind")}」不在 架构/选型/工具/知识点/null')
        _list(e, 'layers', w); e.setdefault('basis', None); e.setdefault('step', None)
        for n in e['layers']:
            if _key(n) not in layer_names:
                E.append(f'{w} 挂的层「{n}」不在 knowledge.layers')
        if e['step'] and _key(e['step']) not in bench_ids:
            E.append(f'{w} 的 step {e["step"]} 不是对标项 id')
    if entries and not layers:
        E.append('有知识条目但没有 knowledge.layers（地图骨架）')
    lucide, brands = set(icons.get('lucide', [])), set(icons.get('brands', []))
    for m in items(r['glossary']['modules'], '关键术语 glossary.modules'):
        need(m, ('id', 'area', 'name', 'say'), f'关键术语模块「{m.get("name", "?")}」')
        for w in items(_list(m, 'words', f'关键术语模块「{m.get("name", "?")}」'), f'关键术语模块「{m.get("name", "?")}」的 words'):
            for k, v in (('src', None), ('new', False), ('icon', '')):
                if w.get(k) is None:
                    w[k] = v
            need(w, ('term', 'what'), f'术语「{w.get("term", "?")}」')
            if _key(w.get('kind')) not in GKIND:
                E.append(f'术语「{w.get("term")}」的 kind「{w.get("kind")}」不在 选型/效果/做法')
            if _key(w.get('side')) not in SIDE:
                E.append(f'术语「{w.get("term")}」的 side「{w.get("side")}」不在 mine/talked/base')
            if w['src'] and _key(w['src']) not in sources:
                E.append(f'术语「{w.get("term")}」的来源 {w["src"]} 不在 review.sources')
            ic = str(w['icon'])
            if icons and ic and not ((ic.startswith('si:') and ic[3:] in brands) or ic in lucide):
                W.append(f'术语「{w.get("term")}」的图标 {ic} 不在可用名单，会按类别显示通用图标')

    for p, meta in d['files'].items():
        if not isinstance(meta, dict) or _key(meta.get('status', '')) not in FILE_STATUS:
            E.append(f'文件 {p} 的 status 要在 {sorted(FILE_STATUS - {""})} 里（新增的可以不写）')
        elif 'excerpt' in meta and not (isinstance(meta['excerpt'], list) and all(
                isinstance(x, str) or (isinstance(x, list) and len(x) == 2 and all(isinstance(n, int) for n in x)) for x in meta['excerpt'])):
            E.append(f'文件 {p} 的 excerpt 要写成 [[起, 止], "要找的字", …]（行号是数字）')

    # 页面上的文字不能带 IP、邮箱、密码（只有顶层的 files、mask 不查：那是文件元数据和打码清单）
    def walk(x, at):
        if isinstance(x, dict):
            for k, v in x.items():
                walk(v, f'{at}.{k}')
        elif isinstance(x, list):
            for i, v in enumerate(x):
                walk(v, f'{at}[{i}]')
        elif isinstance(x, str):
            for h in leaks(x, d['mask']):
                E.append(f'{at} 里有要打码的内容：{h}（换成「需密码」「‹IP›」这类说法；mask 名单里的字也不能出现在正文）')
    walk({k: v for k, v in d.items() if k not in ('files', 'mask', 'root')}, '')
    walk(list(d['files']), 'files 的路径')
    # 文件路径字段要是一段文字（下面编译时拿它当键）
    for where, lst in (('结果', d['results']), ('关键文件', d['keyFiles'])):
        for x in lst if isinstance(lst, list) else []:
            if isinstance(x, dict) and 'file' in x and not isinstance(x['file'], str):
                E.append(f'{where}「{x.get("title")}」的 file 要写成一个路径')
    for m in d['code']['modules'] if isinstance(d['code']['modules'], list) else []:
        for cf in (m.get('files') or []) if isinstance(m, dict) and isinstance(m.get('files'), list) else []:
            if isinstance(cf, dict) and not isinstance(cf.get('file'), str):
                E.append(f'代码模块「{m.get("name")}」里有个文件的 file 不是路径')
    if d['leftovers'].get('status') and not isinstance(d['leftovers']['status'], str):
        E.append('leftovers.status 要写成一个路径')
    E.extend(TYPE_ERR)   # 放最后：校验里调 _list 时发现的嵌套类型错误也一起报
    return E, W


# ---------- 文件 ----------
def resolve(p: str, root: Path) -> Path:
    q = Path(p).expanduser()
    return q if q.is_absolute() else root / q


def _python_end(lines: list[str], start: int) -> int:
    """Python：到下一个同级或更外层语句为止（三引号字符串里的顶格行不算）"""
    ind = len(lines[start]) - len(lines[start].lstrip())
    end, quote_open = len(lines), None
    for j in range(start + 1, len(lines)):
        l = lines[j]
        if quote_open:
            if l.count(quote_open) % 2 == 1:
                quote_open = None
            continue
        for q in ('"""', "'''"):
            if l.count(q) % 2 == 1:
                quote_open = q
        if quote_open and len(l) - len(l.lstrip()) > ind:
            continue
        if not l.strip() or len(l) - len(l.lstrip()) > ind or l.lstrip()[:1] in (')', ']', '}'):
            continue
        if quote_open:
            continue
        end = j
        break
    while end > start + 1 and (not lines[end - 1].strip() or lines[end - 1].lstrip().startswith('#')):
        end -= 1
    return end


def _brace_end(lines: list[str], start: int, shell: bool) -> int | None:
    """花括号配对：跳过字符串、模板字符串（含 ${}）、注释；shell 跳过 heredoc"""
    depth, seen, state, tmpl, heredoc, paren, bparen = 0, False, None, [], None, 0, 0
    for j in range(start, len(lines)):
        line = lines[j]
        if heredoc:
            if line.strip() == heredoc:
                heredoc = None
            continue
        if shell and state is None:
            # heredoc：<<EOF、<<-'EOF'；$(( 1 << 2 )) 里的位移、<<< 不算
            h = re.search(r'(?<!<)<<-?\s*[\'"]?([A-Za-z_]\w*)[\'"]?', line)
            if h and line[:h.start()].count('((') <= line[:h.start()].count('))'):
                heredoc = h.group(1)
        k = 0
        while k < len(line):
            c, nx = line[k], line[k + 1:k + 2]
            if state is None:
                if (c == '/' and nx == '/') or (shell and c == '#' and (k == 0 or line[k - 1] in ' \t;')):
                    break
                if c == '/' and nx == '*':
                    state = '/*'; k += 2; continue
                if c in '\'"`' and not (shell and c == '`'):
                    state = c
                elif c == '(' and not seen:
                    paren += 1
                elif c == ')' and not seen:
                    paren = max(0, paren - 1)
                elif c == '}' and tmpl and depth == tmpl[-1]:
                    tmpl.pop(); state = '`'
                elif c == '{':
                    # 函数体的 {：在括号外，或紧跟 =>；参数里的 { }（解构、默认值、类型）不算
                    if not seen and (shell or paren == 0 or line[:k].rstrip().endswith('=>')):
                        seen, bparen, depth = True, paren, 1
                    elif seen and (shell or paren == bparen):
                        depth += 1
                elif c == '}' and seen and (shell or paren == bparen):
                    depth -= 1
                    if depth <= 0:
                        return j + 1
            elif state == '/*':
                if c == '*' and nx == '/':
                    state = None; k += 2; continue
            elif state in ('\'', '"'):
                if c == '\\':
                    k += 2; continue
                if c == state:
                    state = None
            elif state == '`':
                if c == '\\':
                    k += 2; continue
                if c == '`':
                    state = None
                elif c == '$' and nx == '{':
                    tmpl.append(depth); state = None; k += 2; continue
            k += 1
        if state in ('\'', '"') and not shell:
            state = None
    return None


def _arrow_paren_end(lines: list[str], start: int) -> int | None:
    """箭头函数体是括号（() => ( <div/> )）时，按 => 后面的括号配对找结尾"""
    i = lines[start].find('=>')
    if i < 0:
        return None
    bal, opened = 0, False
    for j in range(start, len(lines)):
        for c in (lines[j][i + 2:] if j == start else lines[j]):
            if c == '(':
                bal += 1; opened = True
            elif c == ')':
                bal -= 1
                if opened and bal <= 0:
                    return j + 1
    return None


def _def_patterns(n: str) -> list[str]:
    mods = r'(?:(?:export|default|public|private|protected|static|async|abstract|override|readonly|get|set)\s+)*'
    return [rf'^\s*(?:async\s+)?def\s+{n}\b', rf'^\s*{mods}class\s+{n}\b', rf'^\s*{mods}function\*?\s+{n}\b',
            rf'^\s*{mods}(?:const|let|var)\s+{n}\s*[=:]', rf'^\s*(?:function\s+)?{n}\s*\(\)\s*\{{?\s*$',
            rf'^\s*{n}\s*[:=]\s*(?:async\s*)?(?:function\b|\()', rf'^\s*{mods}\*?\s*{n}\s*(?:<[^>]*>)?\s*\([^;]*$']


def find_symbol(lines: list[str], name: str, lang: str = '') -> list[list[int]] | None:
    """按函数名找起止行（1 起）。名字可以写「a()、b()」（每个一段）或「类名.方法名」；任何一个找不到返回 None"""
    out = []
    for nm in [x.strip() for x in re.split(r'[、,，]', name) if x.strip()]:
        nm = nm.rstrip('()').strip()
        lo, hi = 0, len(lines)
        if '.' in nm:
            cls, nm = nm.rsplit('.', 1)
            rg = find_symbol(lines, cls, lang)
            if not rg:
                return None
            lo, hi = rg[0][0] - 1, rg[0][1]
        n = re.escape(nm)
        pats = _def_patterns(n)[:2] if lang == 'python' else _def_patterns(n)   # Python 只认 def / class，单独一行的调用不算
        start = next((i for i in range(lo, hi) if any(re.search(p, lines[i]) for p in pats)), None)
        if start is None:
            return None
        if lang == 'python' or re.match(r'^\s*(async\s+)?(def|class)\b.*:\s*(#.*)?$', lines[start]):
            end = _python_end(lines, start)
        else:
            end = _brace_end(lines, start, lang == 'shellscript') or _arrow_paren_end(lines, start) or start + 1
        out.append([start + 1, end])
    return out


def excerpt(lines: list[str], spec, extra):
    out = []
    for x in spec:
        if isinstance(x, list) and len(x) == 2:
            a, b = x
        else:
            hit = next((i for i, l in enumerate(lines) if str(x) in l), None)
            if hit is None:
                continue
            a = b = hit + 1
        out.append({'start': a, 'end': b, 'text': mask('\n'.join(lines[a - 1:b]), extra)})
    return out


def compile_files(d: dict, root: Path, end, E: list[str], W: list[str]) -> dict:
    refs = list(d['files'])
    refs += [x['file'] for x in d['results'] if isinstance(x, dict) and x.get('file')]
    refs += [x['file'] for x in d['keyFiles'] if isinstance(x, dict) and x.get('file')]
    refs += [f['file'] for m in d['code']['modules'] if isinstance(m, dict) for f in m.get('files') or [] if isinstance(f, dict) and f.get('file')]
    refs += [r['file'] for g in d['others']['groups'] if isinstance(g, dict) for r in g.get('rows') or [] if isinstance(r, dict) and r.get('file')]
    if d['leftovers'].get('status'):
        refs.append(d['leftovers']['status'])
    extra = d['mask']
    out = {}
    for key in dict.fromkeys(refs):
        meta = d['files'].get(key) if isinstance(d['files'].get(key), dict) else {}
        p = resolve(key, root)
        status = meta.get('status', '')
        shown = mask(key, extra)
        if not p.exists():
            if status != '已删除':
                E.append(f'文件不存在：{key}（{p}）；会话后删了就在 files 里标 "status": "已删除"')
            out[key] = {'path': shown, 'abs': mask(str(p), extra), 'name': mask(p.name, extra), 'status': status, 'later': False, 'mtime': '', 'kind': 'code', 'lines': 0, 'content': '（文件已删除）'}
            continue
        st = p.stat()
        mt = datetime.fromtimestamp(st.st_mtime, BJ)
        f = {'path': shown, 'abs': mask(str(p), extra), 'name': mask(p.name, extra) + ('/' if p.is_dir() else ''), 'status': status,
             'later': bool(end and mt > end + timedelta(minutes=5)), 'mtime': mt.strftime('%m-%d %H:%M')}
        if p.is_dir():
            f['kind'] = 'dir'
            ents = sorted(x for x in p.iterdir() if not x.name.startswith('.'))[:60]
            f['entries'] = [{'name': mask(x.name, extra) + ('/' if x.is_dir() else ''), 'size': '' if x.is_dir() or not x.exists() else f'{x.stat().st_size / 1024:.1f} KB'} for x in ents]
        elif p.suffix.lower() in IMAGE:
            f['kind'], f['src'], f['lines'] = 'image', p.as_uri(), 0
        else:
            ext = p.suffix.lower()
            f['lang'] = LANG.get(ext, 'text')
            f['kind'] = 'md' if ext == '.md' else 'html' if ext in ('.html', '.htm') else 'code'
            raw = p.read_bytes() if st.st_size <= MAX_FILE else b''
            text = None
            if raw and b'\0' not in raw[:4000]:
                try:
                    text = raw.decode('utf-8')
                except UnicodeDecodeError:
                    text = None
            if text is None:
                W.append(f'{key} 太大或不是 UTF-8 文本，只列名字不嵌内容')
                f['kind'], f['lines'] = 'code', 0
                f['content'] = '（文件太大或不是文本，没有嵌进页面）'
            else:
                text = mask(text, extra)
                f['content'] = text
                f['lines'] = text.count('\n') + 1
                if f['kind'] == 'html':
                    # 预览里的相对路径（图片、样式）按原文件所在目录找
                    base = f'<base href="{p.parent.as_uri()}/">'
                    f['preview'] = re.sub(r'(<head[^>]*>)', r'\1' + base, text, count=1, flags=re.I) if re.search(r'<head', text, re.I) else base + text
                if meta.get('excerpt'):
                    f['excerpt'] = excerpt(text.split('\n'), meta['excerpt'], extra)
        out[key] = f
    # 执行流程的行号：没给 ranges 就按函数名找
    for m in d['code']['modules']:
        for cf in (m.get('files') or []) if isinstance(m, dict) else []:
            f = out.get(cf.get('file'), {})
            lines = f.get('content', '').split('\n')
            for st in cf.get('flow') or []:
                for fn in st.get('fns') or []:
                    if fn.get('ranges'):
                        continue
                    rg = find_symbol(lines, fn.get('name', ''), f.get('lang', ''))
                    if rg:
                        fn['ranges'] = rg
                    else:
                        E.append(f'{cf.get("file")} 里找不到「{fn.get("name")}」：写函数名，或直接给 "ranges": [[起, 止]]')
    for kf in d['keyFiles']:
        if isinstance(kf, dict) and kf.get('match') and not kf.get('marks'):
            lines = out.get(kf.get('file'), {}).get('content', '').split('\n')
            kf['marks'] = [[i + 1, i + 1] for i, l in enumerate(lines) if any(s in l for s in kf['match'])] or None
            if not kf['marks']:
                E.append(f'关键文件 {kf["file"]} 里找不到 match 的内容')
        if isinstance(kf, dict):
            kf.pop('match', None)
    return out


def shots(d: dict, folder: Path, root: Path, W: list[str]):
    rel = folder.relative_to(ROOT).as_posix()
    for r in d['results']:
        s = r.get('shot')
        if not s:
            r.pop('shot', None)
            continue
        dst = folder / 'shots' / f'{r["id"]}.jpg'
        dst.parent.mkdir(exist_ok=True)
        if s == 'capture':
            target = r.get('url') or (resolve(r['file'], root).as_uri() if r.get('file') else None)
            if not target:
                W.append(f'结果 {r["id"]} 没有网址也没有本地文件，截不了图')
                r.pop('shot')
                continue
            try:
                from playwright.sync_api import sync_playwright
                with sync_playwright() as pw:
                    b = pw.chromium.launch()
                    pg = b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
                    pg.goto(target, wait_until='networkidle', timeout=30000)
                    pg.wait_for_timeout(800)
                    pg.screenshot(path=str(dst), type='jpeg', quality=82)
                    b.close()
            except Exception as e:
                W.append(f'结果 {r["id"]} 截图失败（{str(e).splitlines()[0][:80]}），只放链接')
                r.pop('shot')
                continue
        elif not Path(s).expanduser().is_absolute() and (folder / s).is_file() and folder in (folder / s).resolve().parents:
            dst = (folder / s).resolve()
        elif resolve(s, root).is_file():
            src = resolve(s, root)
            dst = dst.with_suffix(src.suffix.lower())
            if src.resolve() != dst.resolve():
                shutil.copyfile(src, dst)
        else:
            W.append(f'结果 {r["id"]} 的截图 {s} 不存在，只放链接')
            r.pop('shot')
            continue
        r['shot'] = '/'.join(quote(x) for x in f'{rel}/{dst.relative_to(folder).as_posix()}'.split('/'))


# ---------- 输出 ----------
def write_js(path: Path, data: dict):
    js = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    path.write_text(f'window.__FUPAN__={js};\n', encoding='utf-8')


def install_reader():
    shutil.copyfile(SKILL / 'assets' / 'reader.html', ROOT / 'index.html')


def build_review(folder: Path, check_only=False, emit=None):
    folder = folder.resolve()
    try:
        parts = folder.relative_to(ROOT).parts
    except ValueError:
        sys.exit(f'复盘文件夹要在 {ROOT} 下面：<项目>/<模块>/<日期>-<标题>/')
    if len(parts) != 3:
        sys.exit(f'复盘文件夹要正好三层：<项目>/<模块>/<日期>-<标题>/，现在是 {"/".join(parts)}')
    bad = [x for x in parts if BAD_NAME.search(x)]
    if bad:
        sys.exit(f'文件夹名里不能有 # ? % &：{bad[0]}')
    if emit and Path(emit).resolve().parent == folder and emit.endswith('.json'):
        sys.exit('--emit-data 别存进复盘文件夹，下次构建会被一起合并')
    d = defaults(load(folder))
    icons_p = SKILL / 'assets' / 'icons.json'
    icons = json.loads(icons_p.read_text()) if icons_p.exists() else {}
    E, W = validate(d, icons)

    def stop():
        for w in W:
            print('提醒：', w)
        print(f'\n{len(E)} 处要改：')
        for e in E:
            print('  -', e)
        sys.exit(1)
    if E:
        stop()
    root = Path(d.get('root') or ROOT.parent.parent).expanduser()
    rg = parse_range(d['session'].get('range', ''))
    files = compile_files(d, root, rg[1] if rg else None, E, W)
    for w in W:
        print('提醒：', w)
    shown = len(W)
    if E:
        print(f'\n{len(E)} 处要改：')
        for e in E:
            print('  -', e)
        sys.exit(1)
    if check_only:
        print('校验通过')
        return
    shots(d, folder, root, W)
    for w in W[shown:]:   # 截图失败、截图文件不存在
        print('提醒：', w)
    page = {k: v for k, v in d.items() if k not in ('files', 'mask', 'root')}
    page['files'] = files
    page['kind'] = 'review'
    if emit:
        Path(emit).write_text(json.dumps(page, ensure_ascii=False), encoding='utf-8')
    write_js(folder / 'data.js', page)
    rel = '/'.join(parts)
    href = '../../../index.html#' + urlencode({'r': rel})
    (folder / STUB).write_text(f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url={href}"><a href="{href}">打开复盘</a>\n', encoding='utf-8')
    build_index()
    size = (folder / 'data.js').stat().st_size / 1e6
    print(f'单篇：{folder / STUB}（数据 {size:.1f} MB）')
    # 给用户的复盘页地址（SKILL.md 第 9 步）：在 VS Code 等编辑器里点「打开复盘.html」会在编辑器里打开、不执行跳转，落不到这一篇；
    # 这个地址粘进浏览器地址栏就直接是这一篇。中文照原样（好认，浏览器认得），只转义会弄坏地址的几个字符
    esc = lambda s: ''.join(f'%{ord(c):02X}' if c in ' %#?+' else c for c in s)
    print(f'浏览器地址：file://{esc(str(ROOT / "index.html"))}#r={esc(rel)}')


_IMG = re.compile(r'(!\[[^\]]*\]\()(<[^>]+>|[^)\s]+)((?:\s+"[^"]*")?\))')


def _old_md(text: str, pdir: Path) -> str:
    """旧复盘的 md：去掉头部元数据、打码，相对图片路径换成 file:// 绝对路径"""
    text = re.sub(r'\A---\n.*?\n---\n', '', text, flags=re.S)

    def fix(m):
        url = m.group(2).strip('<>')
        if re.match(r'^[a-z]+:|^#|^/', url):
            return m.group(0)
        return m.group(1) + 'file://' + quote(str((pdir / unquote(url)).resolve())) + m.group(3)
    return mask(_IMG.sub(fix, text), [])


def build_index():
    ROOT.mkdir(parents=True, exist_ok=True)
    # 旧复盘描述表：v2 是 {"projects": {文件夹: 显示名}, "reviews": {"<项目文件夹>/<文件名>.md": {module, why, did, got}}}；v1 是 {md 绝对路径: 一句话}
    desc_p = ROOT / '旧复盘描述.json'
    try:
        desc = json.loads(desc_p.read_text(encoding='utf-8')) if desc_p.exists() else {}
    except json.JSONDecodeError as e:
        print(f'提醒：旧复盘描述.json 不是合法 JSON（第 {e.lineno} 行），这次汇总页不带旧复盘的描述')
        desc = {}
    if not isinstance(desc, dict):
        desc = {}
    shown = desc.get('projects', {}) if isinstance(desc.get('reviews'), dict) else {}
    shown = shown if isinstance(shown, dict) else {}
    rdesc = desc['reviews'] if isinstance(desc.get('reviews'), dict) else {k: {'line': v} for k, v in desc.items() if isinstance(v, str)}
    name_re = re.compile(r'^(\d{4}-\d{2}-\d{2})-(?:([01]\d|2[0-3])([0-5]\d)-)?(?:\[(.+?)\]-?)?(.+)\.(md|html)$')
    name_re2 = re.compile(r'^\[(.+?)\] (\d{4}-\d{2}-\d{2})-(.+)\.(md|html)$')
    projects = {}
    for pdir in sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith(('.', '_'))):
        olds = []
        for f in sorted(pdir.iterdir()):
            m, m2 = name_re.match(f.name), name_re2.match(f.name)
            if not f.is_file() or not (m or m2):
                continue
            if m:
                date, hh, mm, topic, title, ext = m.groups()
            else:
                date, hh, mm, topic, title, ext = m2[2], None, None, m2[1], m2[3], m2[4]
            rel = f.relative_to(ROOT).as_posix()
            o = {'date': date, 'time': f'{hh}:{mm}' if hh else None, 'topic': topic, 'title': title.replace('-', ' '),
                 'path': str(f), 'rel': rel, 'ext': ext}
            rd = rdesc.get(rel) or rdesc.get(str(f)) or {}
            if isinstance(rd, dict):
                o.update({k: v for k, v in rd.items() if k in ('module', 'why', 'did', 'got', 'line') and isinstance(v, str) and v})
            if ext == 'md':
                o['md'] = _old_md(f.read_text(encoding='utf-8', errors='replace'), pdir)
            else:
                o['href'] = 'file://' + quote(str(f))
            olds.append(o)
        olds.sort(key=lambda x: (x['date'], x['time'] or ''), reverse=True)
        name = shown.get(pdir.name) if isinstance(shown.get(pdir.name), str) and shown.get(pdir.name) else pdir.name
        proj = projects.setdefault(name, {'name': name, 'modules': [], 'old': []})
        proj['old'] = sorted(proj['old'] + olds, key=lambda x: (x['date'], x['time'] or ''), reverse=True)
    # 新格式：<项目>/<模块>/<日期>-<标题>/ 里有 data.js 的才算编好了；摘要从 json 读
    for js in sorted(ROOT.glob('*/*/*/data.js')):
        folder = js.parent
        try:
            s = defaults(load(folder))['review']['overview']['summary']
            rg = parse_range(str(s.get('range', '')))
            item = {'title': s['title'], 'date': rg[0].strftime('%Y-%m-%d') if rg else folder.name[:10], 'status': s['status'],
                    'why': s['why'], 'did': s['did'], 'got': s['got'], 'href': '#' + urlencode({'r': folder.relative_to(ROOT).as_posix()})}
            names = s['projects'] if isinstance(s.get('projects'), list) and s['projects'] else [folder.parts[-3]]
        except (SystemExit, Exception) as e:
            print(f'提醒：{folder.relative_to(ROOT)} 的摘要读不出来，汇总页先不列（{e}）')
            continue
        for pname in names:
            proj = projects.setdefault(pname, {'name': pname, 'modules': [], 'old': []})
            mname = s.get('module') or folder.parts[-2]
            mod = next((x for x in proj['modules'] if x['name'] == mname), None)
            if not mod:
                mod = {'name': mname, 'reviews': []}
                proj['modules'].append(mod)
            mod['reviews'].append(item)
    out = []
    for p in projects.values():
        for m in p['modules']:
            m['reviews'].sort(key=lambda x: x['date'], reverse=True)
        p['modules'].sort(key=lambda m: m['reviews'][0]['date'], reverse=True)
        dates = [r['date'] for m in p['modules'] for r in m['reviews']] + [o['date'] for o in p['old']]
        if not dates:
            continue
        p['latest'] = max(dates)
        p['count'] = len(dates)
        out.append(p)
    out.sort(key=lambda p: p['latest'], reverse=True)
    write_js(ROOT / 'index.data.js', {'kind': 'index', 'projects': out})
    install_reader()
    n = len({r['href'] for p in out for m in p['modules'] for r in m['reviews']}) + sum(len(p['old']) for p in out)   # 跨项目的一篇只算一次
    print(f'汇总页：{ROOT / "index.html"}（{len(out)} 个项目，{n} 篇）')


def known_terms(terms: list[str], self_folder: str | None = None, session: str | None = None):
    """以前的复盘里出现过的词：新格式查 json 里的关键术语，旧复盘查全文（英文词按整词匹配）"""
    me = Path(self_folder).expanduser().resolve() if self_folder else None
    seen = {}
    for js in ROOT.glob('*/*/*/*.json'):
        if js.name.startswith('_') or (me and js.parent.resolve() == me):
            continue
        try:
            folder = defaults(load(js.parent))   # 同一篇的几份 json 合起来看，才知道是不是同一个会话
        except (SystemExit, Exception):
            continue
        if session and str(folder['session'].get('id', '')).lower()[:8] == session[:8].lower():
            continue   # 同一个会话以前写过的复盘不算「见过」
        try:
            mods = json.loads(js.read_text(encoding='utf-8')).get('review', {}).get('glossary', {}).get('modules', [])
        except Exception:
            continue
        for m in mods if isinstance(mods, list) else []:
            words = m.get('words') if isinstance(m, dict) else None
            for w in words if isinstance(words, list) else []:
                if isinstance(w, dict) and w.get('term'):
                    seen.setdefault(str(w['term']).lower(), js.parent.name)
    olds = [(p, p.read_text(encoding='utf-8', errors='replace').lower()) for p in ROOT.glob('*/*.md')]
    if session:
        olds = [(p, txt) for p, txt in olds if session[:8].lower() not in txt[:2000]]
    for t in terms:
        k = t.lower()
        pat = re.compile(rf'(?<![a-z0-9]){re.escape(k)}(?![a-z0-9])') if re.fullmatch(r'[\x00-\x7f]+', k) else re.compile(re.escape(k))
        hit = seen.get(k) or next((p.name[:40] for p, txt in olds if pat.search(txt)), None)
        print(f'{t}\t{"见过：" + hit if hit else "第一次见"}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('folder', nargs='?')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--index', action='store_true')
    ap.add_argument('--known-terms', nargs='+')
    ap.add_argument('--self', dest='self_folder')
    ap.add_argument('--session')
    ap.add_argument('--emit-data')
    a = ap.parse_args()
    if a.known_terms:
        return known_terms(a.known_terms, a.self_folder or a.folder, a.session)
    if a.index:
        return build_index()
    if not a.folder:
        ap.error('给一个复盘文件夹，或用 --index / --known-terms')
    build_review(Path(a.folder).expanduser(), a.check, a.emit_data)


if __name__ == '__main__':
    main()
