"""工作台的经验、知识两页数据：build.py 重建汇总页时调用，写到复盘根下的 经验.data.js、知识.data.js。

经验库、知识库默认在 <工作区>/知识/知识图谱/2-结果区/（经验库/、知识库/），可用环境变量 FUPAN_KB 改。
没有经验库或知识库就不写那一份，工作台对应的页签打开时提示读不到。
链接都是工作台内跳转：复盘 #r= / #o=，知识点 #k=。
"""
from __future__ import annotations

import json, os, re
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import quote, urlencode

try:
    import fcntl
except ImportError:   # Windows 没有 fcntl：写库不加锁，其余照常
    fcntl = None

TYPES = ['设计', '选型', '构建', '交付', '排查', '协作', '内容']
ORDER = {'条目': 0, '术语': 1, '提到': 2}


def kb_root(root: Path) -> Path:
    return Path(os.environ.get('FUPAN_KB', root.parent.parent / '知识' / '知识图谱' / '2-结果区')).expanduser().resolve()


def retro_href(retro: str) -> str:
    """出处链接：新版复盘是文件夹（以 / 结尾）走 #r=，旧复盘走 #o="""
    return '#' + urlencode({'r': retro.rstrip('/')} if retro.endswith('/') else {'o': retro})


def domain_order(kb: Path) -> list[str]:
    skel = kb / '知识库' / '骨架.json'
    return [d['name'] for d in json.loads(skel.read_text())['domains']] if skel.exists() else []


def _load(folder: Path, pattern: str) -> tuple[dict[str, dict], list[str]]:
    """读一个库目录：返回（编号 → 内容，读不出来的文件名）。某份 JSON 坏了只跳过它，不让整页、整篇复盘失败"""
    items, bad = {}, []
    for p in sorted(folder.glob(pattern)) if folder.is_dir() else []:
        try:
            x = json.loads(p.read_text())
            if not isinstance(x, dict):
                raise ValueError
            items[p.stem] = x
        except Exception:
            bad.append(p.name)
    return items, bad


def _load_sops(kb: Path) -> tuple[dict[str, dict], list[str]]:
    return _load(kb / '经验库' / '经验', 'S*.json')


def _load_points(kb: Path) -> tuple[dict[str, dict], list[str]]:
    return _load(kb / '知识库' / '知识点', 'K*.json')


def _bad_note(bad: list[str]) -> str:
    return f'（{"、".join(bad)} 读不出来，跳过了）' if bad else ''


def build_sops(root: Path, write_js) -> str | None:
    kb = kb_root(root)
    folder = kb / '经验库' / '经验'
    if not folder.is_dir():
        return None
    got, bad = _load_sops(kb)
    sops = list(got.values())
    dom = domain_order(kb)
    rank = lambda d: dom.index(d) if d in dom else len(dom)
    sops.sort(key=lambda s: (rank(s['domain']), TYPES.index(s['type']) if s['type'] in TYPES else len(TYPES), s['id']))
    names = {k: p.get('name', k) for k, p in _load_points(kb)[0].items()}
    kmap = {k: names.get(k, k) for s in sops for st in s['steps'] for k in st.get('know', [])}
    img = '/'.join(quote(x) for x in Path(os.path.relpath(kb / '经验库' / '图', root)).parts) + '/'
    write_js(root / '经验.data.js', {'kind': 'sops', 'sops': sops, 'kmap': kmap, 'img': img, 'workbench': available(root)})
    return f'经验 {len(sops)} 份' + _bad_note(bad)


def _retro_info(retro: str, projects: dict) -> dict:
    """出处的日期、项目、标题、链接。retro 是相对复盘根的路径，新版复盘是文件夹（以 / 结尾）"""
    if retro.endswith('/'):
        proj, mod, name = retro.rstrip('/').split('/')[-3:]
        return {'date': name[:10], 'project': proj, 'retro': f'{mod} · {name[11:]}', 'href': retro_href(retro)}
    name = os.path.basename(retro)[:-3]
    m = re.match(r'(\d{4}-\d{2}-\d{2})(?:-\d{4})?-?(.*)', name)
    date, rest = (m.group(1), m.group(2)) if m else ('', name)
    title = re.sub(r'^\[([^\]]+)\]-?', r'\1 · ', rest).strip(' -·')
    top = retro.split('/')[0]
    return {'date': date, 'project': projects.get(top, top), 'retro': title, 'href': retro_href(retro)}


def build_knowledge(root: Path, write_js) -> str | None:
    """知识点的状态和出处现算：有条目 = 学过；只有术语或被 match 认出提到 = 碰过；都没有 = 没碰过"""
    kb = kb_root(root) / '知识库'
    if not (kb / '骨架.json').exists():
        return None
    meta_f = root / '旧复盘描述.json'
    meta = json.loads(meta_f.read_text()) if meta_f.exists() else {}
    projects = meta.get('projects', {})
    texts = {}   # 复盘全文：认「提到」用，键和知识点 sources 里的 retro 同一种写法
    olds = meta.get('reviews') or {p.relative_to(root).as_posix(): None for p in root.glob('*/*.md') if p.name != 'INDEX.md' and not p.name.startswith('_')}
    for k in olds:   # 旧复盘：有 旧复盘描述.json 就按它的清单，和知识页样稿的算法一致；没有就认项目一级的 md
        if (root / k).is_file():
            texts[k] = (root / k).read_text(encoding='utf-8', errors='ignore')
    for js in root.glob('*/*/*/data.js'):   # 新版复盘：编好了（有 data.js）的才算，和汇总页一致
        parts = sorted(js.parent.glob('[1-4]-*.json'))
        if parts:
            texts[js.parent.relative_to(root).as_posix() + '/'] = '\n'.join(j.read_text(encoding='utf-8') for j in parts)
    skel = json.loads((kb / '骨架.json').read_text())
    pts, bad = _load_points(kb.parent)
    miss = []
    by_name = {p['name']: k for k, p in pts.items()}
    points, domains = {}, []
    for dom in skel['domains']:
        groups = []
        for g in dom['groups']:
            for pid in g['points']:
                p = pts.get(pid)
                if not p:
                    miss.append(pid)
                    continue
                srcs, seen = [], set()
                for s in p.get('sources', []):
                    srcs.append({**_retro_info(s['retro'], projects), 'kind': s['kind'], **({'entry': s['entry']} if s.get('entry') else {})})
                    seen.add(s['retro'])
                rx = re.compile('|'.join(p['match'])) if p.get('match') else None
                ment = [k for k, t in texts.items() if rx and rx.search(t)]
                for k in ment:
                    if k not in seen:
                        srcs.append({**_retro_info(k, projects), 'kind': '提到'})
                        seen.add(k)
                srcs.sort(key=lambda s: s['date'], reverse=True)
                srcs.sort(key=lambda s: ORDER[s['kind']])
                kinds = {s['kind'] for s in srcs}
                n_entry = sum(1 for s in srcs if s['kind'] == '条目')
                out = {'id': pid, 'name': p['name'], 'domain': dom['name'], 'group': g['name'],
                       'state': '学过' if '条目' in kinds else ('碰过' if kinds else '没碰过'),
                       'nEntry': n_entry, 'nMention': len(set(ment)), 'sources': srcs}
                c = p.get('content')
                if c:
                    c = json.loads(json.dumps(c))
                    for r in c.get('learn', {}).get('relations', []):
                        r['id'] = r.get('id') or by_name.get(r['name'])
                    for cs in c.get('review', {}).get('cases', []):
                        if cs.get('href'):
                            continue
                        hit = [s for s in srcs if s['date'] == cs.get('date') and s['project'] == cs.get('project') and cs.get('match', '') in s['retro']]
                        if hit:
                            cs['href'], cs['title'] = hit[0]['href'], hit[0]['retro']
                    out['full'] = c
                    # 改动记录：日期取知识点自己 log 的最后一天；条目数只算那天之前的复盘（之后加进来的出处没合进正文）
                    last = max((x['date'] for x in p.get('log', []) if isinstance(x, dict) and isinstance(x.get('date'), str)), default='')
                    day = last[5:] if last else c.get('date')
                    n_at = sum(1 for s in srcs if s['kind'] == '条目' and (not last or s['date'] <= last))
                    if day:
                        out['log'] = f'{day} 合并自复盘里的 {n_at} 条条目' if n_at else f'{day} 新写，内容取自业内资料'
                points[pid] = out
            groups.append({'name': g['name'], 'points': [x for x in g['points'] if x in points]})
        domains.append({'name': dom['name'], 'groups': groups})
    total = {s: sum(1 for p in points.values() if p['state'] == s) for s in ('学过', '碰过', '没碰过')}
    write_js(root / '知识.data.js', {'kind': 'knowledge', 'domains': domains, 'points': points, 'total': total, 'retros': len(texts), 'workbench': available(root)})
    return (f'知识 {len(points)} 个（学过 {total["学过"]}、碰过 {total["碰过"]}、没碰过 {total["没碰过"]}）' + _bad_note(bad)
            + (f'（骨架里的 {"、".join(miss)} 没有知识点文件，跳过了）' if miss else ''))


# ---------- 写复盘时接进经验库、知识库（11-10 定）----------
# 3-复盘.json：review.sops 认领这次对应哪份经验、哪几步，每步一句历史相关；review.sopCandidates 记对不上的
# 4-知识.json：knowledge.entries[].kb、glossary.modules[].words[].kb 标知识库编号；条目写 null = 库里没有，进待归位
# 记录 <库根>/复盘写入记录.json：每篇写进去了什么（认领的每一步那句、底部那行改之前的样子、加的出处、候选、待归位），
# 另有 _原值 记每一步第一次被复盘换掉之前的句子。每一步显示哪句 = 原值和所有仍在认领它的复盘里，工作开始最晚的那个；
# 同一篇重跑先撤掉记录里这篇的，再按这次的写、重算，所以重跑等于覆盖。只撤得掉 build.py 写进去的，迁移进库的不算
EVAL = {'一致', '合理偏离', '待改进', '缺失'}   # build.py 也用这一份
KID = re.compile(r'K\d{4}')
LEDGER = '复盘写入记录.json'
BASE = '_原值'   # 记录里的保留键；复盘的键都以 / 结尾，不会撞


def available(root: Path) -> dict:
    """工作台哪几页有库：顶栏只显示有的"""
    kb = kb_root(root)
    return {'sop': (kb / '经验库' / '经验').is_dir(), 'kb': (kb / '知识库' / '骨架.json').exists()}


def catalog(root: Path):
    """给写复盘的人看：全部经验（编号、名字、步骤）和知识点（编号、名字、别名），认领和标编号时对照"""
    kb = kb_root(root)
    (sops, bad_s), (pts, bad_k) = _load_sops(kb), _load_points(kb)
    if not sops and not pts:
        print(f'没有经验库和知识库（{kb}），复盘里不用写 sops 和 kb')
        return
    print(f'# 经验库 {len(sops)} 份（review.sops 认领用）' + _bad_note(bad_s))
    for s in sops.values():
        print(f"{s.get('id')} {s.get('name')}〔{s.get('domain', '')} · {s.get('type', '')}〕：" + ' / '.join(f"{st.get('id')} {st.get('name')}" for st in s.get('steps', [])))
    print(f'\n# 知识库 {len(pts)} 个（entries[].kb、words[].kb 用）' + _bad_note(bad_k))
    for p in pts.values():
        al = '、'.join(p.get('aliases', []))
        print(f"{p.get('id')} {p.get('name')}" + (f'（{al}）' if al else ''))


def _note_len(t: str) -> int:
    return len(t.replace(' ', ''))


def _refs(r: dict) -> tuple[list[dict], list[dict]]:
    """复盘里标了知识编号的地方：（知识条目，关键术语），写错类型的跳过（校验另报）"""
    kn = r.get('knowledge') if isinstance(r.get('knowledge'), dict) else {}
    gl = r.get('glossary') if isinstance(r.get('glossary'), dict) else {}
    entries = [e for e in (kn.get('entries') if isinstance(kn.get('entries'), list) else []) if isinstance(e, dict)]
    mods = [m for m in (gl.get('modules') if isinstance(gl.get('modules'), list) else []) if isinstance(m, dict)]
    words = [w for m in mods for w in (m.get('words') if isinstance(m.get('words'), list) else []) if isinstance(w, dict)]
    return entries, words


def validate_links(d: dict, root: Path) -> tuple[list[str], list[str]]:
    """review.sops、sopCandidates、knowledge.entries[].kb、words[].kb 的校验：返回（要改的，提醒）。写错类型也只报错，不抛异常"""
    E, W = [], []
    r = d.get('review') if isinstance(d.get('review'), dict) else {}
    claims, cands = r.get('sops'), r.get('sopCandidates')
    kb = kb_root(root)
    (sops, bad_s), (pts, bad_k) = _load_sops(kb), _load_points(kb)
    used_bad = set()
    if claims is not None:
        if not isinstance(claims, list):
            E.append('review.sops 要写成列表：[{"sop": "S02", "steps": [{"step": "s1", "eval": "待改进", "note": "…"}]}]')
        elif claims and not sops and not bad_s:
            W.append(f'没有经验库（{kb / "经验库"}），review.sops 不写入')
        else:
            seen = set()
            for i, c in enumerate(claims):
                sid = c.get('sop') if isinstance(c, dict) else None
                if isinstance(sid, str) and f'{sid}.json' in bad_s:
                    E.append(f'经验库里 {sid}.json 读不出来（JSON 坏了），先修好它再认领'); used_bad.add(f'{sid}.json'); continue
                if not isinstance(sid, str) or sid not in sops:
                    E.append(f'review.sops 第 {i + 1} 条：sop 要写经验库里的编号（字符串，如 "S02"），现在是 {sid!r}；build.py --catalog 看全部编号'); continue
                if sid in seen:
                    E.append(f'review.sops：{sid} 认领了两次，合成一条')
                seen.add(sid)
                ids = {st.get('id') for st in sops[sid].get('steps', []) if isinstance(st, dict)}
                steps = c.get('steps')
                if not isinstance(steps, list) or not all(isinstance(x, dict) for x in steps):
                    E.append(f'review.sops {sid}：steps 要写成对象列表 [{{"step": "s1", "eval": "…", "note": "…"}}]，不是步骤编号列表'); continue
                done = set()
                for st in steps:
                    step = st.get('step')
                    where = f'review.sops {sid} {step}'
                    if not isinstance(step, str) or step not in ids:
                        E.append(f'{where}：这份经验没有这一步（有 {"、".join(sorted(str(x) for x in ids))}）')
                    elif step in done:
                        E.append(f'{where}：这一步写了两次，合成一条')
                    done.add(step if isinstance(step, str) else None)
                    ev = st.get('eval')
                    if not isinstance(ev, str) or ev not in EVAL:
                        E.append(f'{where}：eval 只能是 {"、".join(sorted(EVAL))}')
                    note = st.get('note')
                    if not isinstance(note, str) or not note.strip() or _note_len(note) > 60 or note.count('。') > 1:
                        E.append(f'{where}：note 要一句话（最多一个句号）、60 字内（不算空格），讲当时情况、怎么做的、结果如何')
    if cands is not None and not (isinstance(cands, list) and all(isinstance(x, dict) and isinstance(x.get('name'), str) and x['name'] and isinstance(x.get('why'), str) and x['why'] for x in cands)):
        E.append('review.sopCandidates 每条要有 name（这次做的事）和 why（为什么对不上现有经验），都是文字')
    entries, words = _refs(r)
    no_kb = False
    for x, what in [(e, '条目') for e in entries] + [(w, '术语') for w in words]:
        if 'kb' not in x or x['kb'] is None:
            continue
        name = x.get('title') if what == '条目' else x.get('term')
        if not isinstance(x['kb'], str) or not KID.fullmatch(x['kb']):
            E.append(f'{what}「{name}」的 kb 要写知识点编号（如 "K0014"）' + ('，库里没有写 null' if what == '条目' else '，对不上就去掉 kb'))
        elif f'{x["kb"]}.json' in bad_k:
            E.append(f'知识库里 {x["kb"]}.json 读不出来（JSON 坏了），先修好它（{what}「{name}」）'); used_bad.add(f'{x["kb"]}.json')
        elif not pts:
            no_kb = True
        elif x['kb'] not in pts:
            E.append(f'知识库没有 {x["kb"]}（{what}「{name}」）；条目写 null、术语去掉 kb，build.py --catalog 看全部编号')
    if no_kb:
        W.append(f'没有知识库（{kb / "知识库"}），kb 编号不写入')
    if pts:
        miss = [str(e.get('title')) for e in entries if 'kb' not in e]
        if miss:
            W.append('知识条目没写 kb（库里没有写 null）：' + '、'.join(miss[:5]))
    if sops and claims is None and cands is None:
        W.append('没认领经验也没写 sopCandidates（build.py --catalog 看经验库）')
    other = [b for b in bad_s + bad_k if b not in used_bad]
    if other:
        W.append(f'经验库、知识库里有文件读不出来（{"、".join(other)}），这篇没用到，不影响；先修好它们')
    return E, W


def _range_start(text: str) -> str:
    m = re.search(r'(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?', text or '')
    return (m.group(1) + (' ' + m.group(2) if m.group(2) else '')) if m else ''


def _when(retro: str, root: Path) -> str:
    """一篇复盘对应的工作从什么时候开始：新版读摘要的 range，旧 md 取文件名里的日期和时刻，比新旧用"""
    if retro.endswith('/'):
        f = root / retro / '1-总结.json'
        try:
            w = _range_start(str(json.loads(f.read_text())['review']['overview']['summary'].get('range', '')))
        except Exception:
            w = ''
        return w or _range_start(retro)
    m = re.search(r'(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})-', retro)
    return f'{m.group(1)} {m.group(2)}:{m.group(3)}' if m else _range_start(retro)


def _summary(d: dict, folder: Path) -> dict:
    s = d['review']['overview']['summary']
    when = _range_start(str(s.get('range', ''))) or folder.name[:10]
    proj = s['projects'][0] if isinstance(s.get('projects'), list) and s['projects'] else folder.parts[-3]
    return {'date': when[:10], 'when': when, 'project': proj, 'module': s.get('module') or folder.parts[-2],
            'title': s.get('title', folder.name[11:]), 'why': s.get('why'), 'did': s.get('did'), 'got': s.get('got')}


def _dump(p: Path, data):
    """先写临时文件再换名：写到一半中断，原文件不坏"""
    tmp = p.with_name(p.name + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(tmp, p)


def _read(p: Path, default):
    return json.loads(p.read_text()) if p.exists() else default


@contextmanager
def _lock(kb: Path):
    """两个会话同时重编时排队写库（只管 build.py 之间；库里自己的整理脚本不拿这把锁）"""
    with open(kb / '.复盘写入.lock', 'w') as f:
        if fcntl:
            fcntl.flock(f, fcntl.LOCK_EX)
        yield


def apply_links(d: dict, folder: Path, root: Path) -> list[str]:
    """把这篇复盘写进经验库、知识库；出错只提醒，不让构建失败（Codex 沙箱写不了复盘根以外的目录，调度方本机重编时写）"""
    kb = kb_root(root)
    if not any(available(root).values()):
        return []
    r = d.get('review') if isinstance(d.get('review'), dict) else {}
    entries, words = _refs(r)
    if not (r.get('sops') or r.get('sopCandidates') or any('kb' in e for e in entries) or any(w.get('kb') for w in words)):
        try:   # 这篇什么都没认领、以前也没写过：不碰库，沙箱里也不出提醒
            if folder.relative_to(root).as_posix() + '/' not in _read(kb / LEDGER, {}):
                return []
        except Exception:
            return []
    try:
        with _lock(kb):
            return _apply_links(d, folder, root, kb)
    except OSError as e:
        return [f'经验库、知识库这次没写全（{e.__class__.__name__}：{getattr(e, "filename", "") or e}），在本机重编一次就会补上']
    except Exception as e:   # 库里某份文件坏了之类：提醒，单篇照常出
        return [f'提醒：写经验库、知识库出错，这次没写全（{e.__class__.__name__}：{e}）']


def _step(s: dict | None, sid: str) -> dict | None:
    return next((st for st in (s or {}).get('steps', []) if st.get('id') == sid), None)


def _undo(retro: str, rec: dict, kb: Path, sops: dict, pts: dict, touched: set, files: dict):
    """撤掉这篇上次写进去的：底部那行还原成写之前的样子、出处、候选、待归位。认领的句子不在这里还原，交给重算"""
    for sid, x in rec.get('sops', {}).items():
        s = sops.get(sid)
        if s:
            s['cases'] = [c for c in s.get('cases', []) if c.get('retro') != retro] + ([x['case']] if x.get('case') else [])
            touched.add(('S', sid))
    for k, kind, entry in rec.get('kb', []):
        p = pts.get(k)
        if p:
            p['sources'] = [x for x in p.get('sources', []) if not (x.get('retro') == retro and x.get('kind') == kind and x.get('entry') == entry)]
            touched.add(('K', k))
    cf, pf = kb / '经验库' / '候选.json', kb / '知识库' / '待归位.json'
    if rec.get('cands') and cf.exists():
        cur = files.get(cf) or _read(cf, [])
        files[cf] = [y for y in cur if not (y.get('name') in rec['cands'] and y.get('retro') == retro)]
    if rec.get('pend') and pf.exists():
        keep = []
        for y in files.get(pf) or _read(pf, []):
            if y.get('name') in rec['pend'] and any(z.get('retro') == retro for z in y.get('sources', [])):
                y = {**y, 'sources': [z for z in y['sources'] if z.get('retro') != retro]}   # 整理时合并过的一项只去掉这篇那条出处
                if not y['sources']:
                    continue
            keep.append(y)
        files[pf] = keep


def _recompute(s: dict, sname: str, base: dict, ledger: dict, root: Path) -> dict | None:
    """这一步显示哪句：原值和所有仍在认领它的复盘里，工作开始最晚的那个（同时开始的，复盘写的优先）"""
    cands = []
    old = base.get(f"{s['id']}/{sname}")
    if old:
        cands.append((_when(old['retro'], root) if old.get('retro') else '', 0, '', old))
    for k, v in ledger.items():
        cl = v.get('sops', {}).get(s['id'], {}).get('claims', {}).get(sname) if k != BASE else None
        if cl:
            cands.append((v.get('when') or _when(k, root), 1, k, {**cl, 'retro': k}))
    best = max(cands, key=lambda x: x[:3])[3] if cands else None
    step = _step(s, sname)
    if best:
        step['mine'] = best
        if not any(a.get('mine') for a in step.get('flow', [])):   # 原来这步没有历史相关：挂在你说的那一下
            act = next((a for a in step.get('flow', []) if a.get('say')), None) or next((a for a in step.get('flow', []) if a.get('who') == '你'), None) or (step.get('flow') or [None])[0]
            if act is not None:
                act['mine'] = True
    else:
        step.pop('mine', None)
        for a in step.get('flow', []):
            a.pop('mine', None)
    return best


def _apply_links(d: dict, folder: Path, root: Path, kb: Path) -> list[str]:
    r = d.get('review') if isinstance(d.get('review'), dict) else {}
    retro = folder.relative_to(root).as_posix() + '/'
    info = _summary(d, folder)
    sops, pts = _load_sops(kb)[0], _load_points(kb)[0]
    ledger_f = kb / LEDGER
    ledger = _read(ledger_f, {})
    base = ledger.setdefault(BASE, {})
    touched: set = set()
    files: dict = {}   # 候选、待归位：等记录写完再写
    redo: set = set()   # 要重算句子的（经验，步骤）
    prev = ledger.pop(retro, None)
    if prev:
        _undo(retro, prev, kb, sops, pts, touched, files)
        redo |= {(sid, st) for sid, x in prev.get('sops', {}).items() for st in x.get('claims', {})}
    rec = {'when': info['when'], 'sops': {}, 'kb': [], 'cands': [], 'pend': []}
    out = []
    for c in (r.get('sops') or []) if sops and isinstance(r.get('sops'), list) else []:
        s = sops.get(c.get('sop')) if isinstance(c, dict) else None
        if not s:
            continue
        old_case = next((x for x in s.get('cases', []) if x.get('retro') == retro), None)
        claims = {st['step']: {'eval': st['eval'], 'note': st['note']} for st in c.get('steps', []) if isinstance(st, dict) and _step(s, st.get('step'))}
        for sname in claims:
            base.setdefault(f"{s['id']}/{sname}", _step(s, sname).get('mine'))   # 第一次有复盘换这一步：记下原来那句
        steps = set((old_case or {}).get('steps', [])) | set(claims)   # 原来记的步骤留着，再加这次认领的
        case = {'date': info['date'], 'project': info['project'], 'title': f"{info['module']} · {info['title']}", 'retro': retro,
                'steps': [st['id'] for st in s['steps'] if st['id'] in steps], 'topic': info['title'], 'why': info['why'], 'did': info['did'], 'got': info['got']}
        s['cases'] = [x for x in s.get('cases', []) if x.get('retro') != retro] + [case]
        rec['sops'][s['id']] = {'case': old_case, 'claims': claims}
        redo |= {(s['id'], x) for x in claims}
        touched.add(('S', s['id']))
    ledger[retro] = rec
    shown: dict = {}
    for sid, sname in sorted(redo):
        s = sops.get(sid)
        if s and _step(s, sname):
            best = _recompute(s, sname, base, ledger, root)
            if best and best.get('retro') == retro:
                shown.setdefault(sid, []).append(sname)
            touched.add(('S', sid))
    for sid, x in rec['sops'].items():
        changed = shown.get(sid, [])
        out.append(f"经验 {sid} {sops[sid].get('name')}：底部{'更新' if x['case'] else '加了'}这篇" + (f"，{'、'.join(changed)} 换成这次" if changed else ''))
    cands = [x for x in r.get('sopCandidates') or [] if isinstance(x, dict) and x.get('name')] if isinstance(r.get('sopCandidates'), list) else []
    if cands and (kb / '经验库').is_dir():
        cf = kb / '经验库' / '候选.json'
        cur = files.get(cf) if cf in files else _read(cf, [])
        new = [{'name': x['name'], 'why': x.get('why', ''), 'retro': retro, 'date': info['date']} for x in cands
               if not any(y.get('retro') == retro and y.get('name') == x['name'] for y in cur)]
        rec['cands'] = [x['name'] for x in cands]
        files[cf] = cur + new
        out.append(f'经验候选：这篇 {len(cands)} 条（共 {len(cur) + len(new)} 条，同类攒到 3 篇再写新经验）')
    if pts:
        entries, words = _refs(r)
        refs = [(e.get('kb'), '条目', e.get('title')) for e in entries if 'kb' in e]
        refs += [(w.get('kb'), '术语', w.get('term')) for w in words if w.get('kb')]
        pend, added = [], set()
        for k, kind, entry in refs:
            if isinstance(k, str) and k in pts:
                p = pts[k]
                if not any(x.get('retro') == retro and x.get('kind') == kind and x.get('entry') == entry for x in p.setdefault('sources', [])):
                    p['sources'].append({'retro': retro, 'kind': kind, 'entry': entry})
                    rec['kb'].append([k, kind, entry])
                    touched.add(('K', k)); added.add(k)
            elif k is None and kind == '条目':
                pend.append({'name': entry, 'one': '', 'domain': None, 'group_hint': None,
                             'sources': [{'retro': retro, 'kind': '条目', 'entry': entry}], 'reason': '复盘里写了，知识库里没有'})
        if added:
            out.append(f'知识点加出处 {len(added)} 个：' + '、'.join(sorted(added)))
        if pend:
            pf = kb / '知识库' / '待归位.json'
            cur = files.get(pf) if pf in files else _read(pf, [])
            new = [x for x in pend if not any(y.get('name') == x['name'] and any(z.get('retro') == retro for z in y.get('sources', [])) for y in cur)]
            rec['pend'] = [x['name'] for x in pend]
            files[pf] = cur + new
            out.append(f'知识待归位：这篇 {len(pend)} 条（你说「整理知识库」时一次过）')
    if not any(rec[k] for k in ('sops', 'kb', 'cands', 'pend')):
        ledger.pop(retro)
    # 先写记录再写库：库写到一半失败，重跑时按记录撤销、重算，结果和一次写成一样
    _dump(ledger_f, ledger)
    for p, data in files.items():
        _dump(p, data)
    for typ, k in sorted(touched):
        if typ == 'S' and k in sops:
            _dump(kb / '经验库' / '经验' / f'{k}.json', sops[k])
        elif typ == 'K' and k in pts:
            _dump(kb / '知识库' / '知识点' / f'{k}.json', pts[k])
    return out


def build_all(root: Path, write_js) -> list[str]:
    out = []
    for f in (build_sops, build_knowledge):
        try:
            x = f(root, write_js)
        except Exception as e:   # 库里某份文件坏了、另一个会话正在写：提醒，汇总页照常出
            x = f'提醒：{f.__name__} 没生成（{e.__class__.__name__}：{e}）'
        if x:
            out.append(x)
    led = kb_root(root) / LEDGER
    try:
        gone = [k for k in _read(led, {}) if k != BASE and not (root / k).is_dir()]
    except Exception:
        gone = []
    if gone:
        out.append(f'提醒：复盘写入记录里有 {len(gone)} 篇的文件夹已经不在了（{"、".join(gone[:3])}），它们写进经验库、知识库的还留着')
    return out
