#!/usr/bin/env python3
"""forge-design-lab · 站点零件库抽取：把代码里现有的设计零件盘点成 system.tokens.json。

用法:
  python3 extract_system.py <repo> [--css-file frontend-react/src/globals.css] [--src frontend-react/src]
                            [--tw frontend-react/tailwind.config.ts] [--product-css] [--quiet]

做什么:
  1. 颜色：全局 CSS 里 :root / .dark / 作用域块（如 .admin-scope）的变量，亮暗配对、按家族分组、
     统计 var(--x) 与 Tailwind 语义类（bg-card、text-muted-foreground…）的使用次数和文件
  2. 写死的颜色：TSX 里的 #hex，能对上站点色的给出「应改用哪个变量」
  3. 字体：Tailwind fontFamily 角色 + 全局 CSS 里的文字角色类（字号/行高/字重/颜色四元组）
  4. 阶梯：字号、间距、圆角、行高、字重的实际用量（复用 adapt_tokens 的统计）
  5. 版面：容器宽度（max-w-[Npx]）与网格模板（grid-cols-[…]）的用量
  6. 按钮：所有 <button> 的类名按长相归成几大类，每类下列出变体、次数、出处
  --product-css 另用项目自己的 Tailwind 编译一份 product.css，零件库页面用它按真像素渲染

不覆盖的东西（重跑安全）:
  template、custom（用户的模板与定制）、feedback、layouts（手写的版面骨架），以及旧版字段 edits、decisions。
  页面保存同样不动这些以外的字段：服务端只替换请求里带了的用户产出（见 serve.py merge_system）。
输出: docs/assets/visuals/system/system.tokens.json，并把页面模板同步到同目录与 _workbench/
"""
import argparse
import collections
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import adapt_tokens as AT  # noqa: E402

PACK_REL = os.path.join("docs", "assets", "visuals", "system")
LAB_ASSETS = os.path.join(os.path.dirname(HERE), "assets", "system")

# 家族：按变量名前缀/全名归组；顺序就是页面上的顺序
FAMILIES = [
    ("surface", "底色与面", ["background", "card", "secondary", "muted", "popover", "input", "border", "line"]),
    ("ink", "墨色（文字）", ["foreground", "card-foreground", "secondary-foreground", "muted-foreground", "ink-", "popover-foreground"]),
    ("brand", "品牌暖铜", ["brand", "primary", "accent", "ring"]),
    ("semantic", "语义色", ["destructive", "success", "warning", "danger", "pulse-", "score-", "badge-", "a-"]),
    ("modal", "弹窗与阅读页", ["modal-"]),
    ("wordmark", "Logo 字标", ["wordmark-"]),
    ("platform", "平台光晕", ["glow-"]),
    ("misc", "其他", []),
    ("scope", "作用域覆写（只在某个容器内生效）", []),
]
TW_COLOR_PROPS = r"(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|divide|placeholder|from|via|to|decoration|caret|accent|shadow)"
VARIANT = r"(?:[a-z0-9-]+:|\[[^\]]+\]:)*"
SIZE_TEXT = re.compile(r"^text-(xs|sm|base|lg|xl|\d?xl|\[\d+(?:\.\d+)?(?:px|rem)\])$")


def rel(repo, p):
    return os.path.relpath(p, repo)


def family_of(name):
    bare = name[2:]
    on_color = ("brand-foreground", "primary-foreground", "destructive-foreground", "accent-foreground")
    if bare.endswith("-foreground") and bare not in on_color:
        return "ink"
    for key, _, pats in FAMILIES:          # 先全名精确匹配，再前缀
        if bare in pats:
            return key
    for key, _, pats in FAMILIES:
        for p in pats:
            if (p.endswith("-") and bare.startswith(p)) or (not p.endswith("-") and bare.startswith(p + "-")):
                return key
    return "misc"


def preceding_comment(text, pos):
    """变量声明的同行尾注释，或紧挨在上方的块注释。"""
    line_end = text.find("\n", pos)
    m = re.search(r"/\*(.*?)\*/", text[pos:line_end if line_end != -1 else None])
    if m:
        return " ".join(m.group(1).split())[:160]
    head = text[:text.rfind("\n", 0, pos)].rstrip()
    if head.endswith("*/"):
        st = head.rfind("/*")
        if st != -1 and head.count("\n", st) <= 4:
            return " ".join(head[st + 2:-2].split())[:160]
    return ""


DARK_SEL = re.compile(r"\.dark\b|\[data-(?:theme|mode)\s*=\s*[\"']?dark[\"']?\s*\]")


def blank_comments(text):
    """注释换成等长空白：注释里的 { } 和被注释掉的变量都不再参与解析，行号保持不变。"""
    return re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.S)


def media_spans(clean):
    """[(start, end, prelude)]：每个 @media 块在文本里的范围，用于判断一条规则处在什么媒体条件下。"""
    out = []
    for m in re.finditer(r"@media([^{]*)\{", clean):
        depth, j = 0, m.end() - 1
        while j < len(clean):
            if clean[j] == "{":
                depth += 1
            elif clean[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.append((m.end(), j, m.group(1)))
    return out


def parse_vars(path):
    """返回 {scope: {mode: {name: (value, line, note)}}}；scope=root 或作用域选择器（.admin-scope）。
    暗色识别：选择器里有 .dark / [data-theme=dark]（含 :root.dark、html.dark、.dark .x），或处在 prefers-color-scheme: dark 媒体块里。
    其他媒体块里的 :root 只是覆写（如移动端高度），已有主值时不取。"""
    text = AT.read(path)
    clean = blank_comments(text)
    spans = media_spans(clean)
    out = collections.defaultdict(lambda: {"light": {}, "dark": {}})
    for m in re.finditer(r"([^{};]+)\{([^{}]*)\}", clean):
        body = m.group(2)
        if not re.search(r"--[\w-]+\s*:", body):
            continue
        media = " ".join(pre for st, en, pre in spans if st <= m.start() < en)
        dark_media = bool(re.search(r"prefers-color-scheme\s*:\s*dark", media))
        other_media = bool(media) and not dark_media
        for sel in (x.strip() for x in " ".join(m.group(1).split()).split(",")):
            if not sel or sel.startswith("@"):
                continue
            is_dark = dark_media or bool(DARK_SEL.search(sel))
            base = DARK_SEL.sub("", sel).replace(":root", "").replace("html", "")
            base = re.sub(r"\.light\b|\[data-(?:theme|mode)\s*=\s*[\"']?light[\"']?\s*\]", "", base).strip()   # 显式亮色主题选择器等同 root
            scope = "root" if not base or base in ("body",) else base
            mode = "dark" if is_dark else "light"
            for vm in re.finditer(r"(--[\w-]+)\s*:\s*([^;]+);", body):
                name, val = vm.group(1), " ".join(vm.group(2).split())
                if name.startswith("--tw-"):
                    continue
                pos = m.start(2) + vm.start()
                if other_media and name in out[scope][mode]:
                    continue
                out[scope][mode].setdefault(name, (val, text.count("\n", 0, pos) + 1, preceding_comment(text, pos)))
    return out


def tw_semantic_names(tw_path):
    """Tailwind 配置里引用了 var(--x) 的颜色名集合（假定类名与变量名同名，shadcn 约定）。"""
    t = AT.read(tw_path)
    return set(re.findall(r"var\((--[\w-]+)\)", t))


def tw_fonts(tw_path):
    t = AT.read(tw_path)
    m = re.search(r"fontFamily\s*:\s*\{", t)
    if not m:
        return []
    block = AT.brace_block(t, m.end() - 1)
    out = []
    for fm in re.finditer(r"(?:'([\w-]+)'|([\w-]+))\s*:\s*\[([^\]]*)\]", block):
        name = fm.group(1) or fm.group(2)
        stack = re.findall(r"'([^']+)'", fm.group(3))
        out.append({"id": name, "stack": stack})
    return out


def tw_static_colors(tw_path):
    """warm-50… 这类写死在配置里的色板。"""
    t = AT.read(tw_path)
    out = []
    m = re.search(r"colors\s*:\s*\{", t)
    if not m:
        return out
    block = AT.brace_block(t, m.end() - 1)
    for gm in re.finditer(r"([\w-]+)\s*:\s*\{", block):
        g = gm.group(1)
        inner = AT.brace_block(block, gm.end() - 1)
        for cm in re.finditer(r"(?:'([\w-]+)'|([\w-]+))\s*:\s*'(#[0-9a-fA-F]{3,8})'", inner):
            k = cm.group(1) or cm.group(2)
            out.append({"id": g if k == "DEFAULT" else f"{g}-{k}", "group": g, "value": cm.group(3)})
    return out


def src_files(src):
    for dp, dns, fns in os.walk(src):
        dns[:] = [d for d in dns if d not in AT.SKIP_DIRS and d != "__tests__" and not d.startswith(".")]
        for f in fns:
            if f.endswith((".tsx", ".ts", ".jsx", ".css")) and ".test." not in f:
                yield os.path.join(dp, f)


def attr_expr(s, i):
    """从 className= 之后的位置取出完整属性值（"…" 或 {…} 平衡括号）。"""
    if i >= len(s):
        return ""
    if s[i] in "\"'":
        j = s.find(s[i], i + 1)
        return s[i + 1:j]
    if s[i] == "{":
        depth, j = 0, i
        while j < len(s):
            c = s[j]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return s[i + 1:j]
            elif c in "\"'`":
                k = s.find(c, j + 1)
                j = k if k != -1 else j
            j += 1
    return ""


VIS = re.compile(r"^(?:(?:hover|focus-visible|focus|disabled|active|dark|group-hover|aria-[\w-]+|data-\[[^\]]+\]):)*"
                 r"(rounded|border|bg-|text-|font-(?:medium|semibold|bold|normal|light)|px-|py-|p-|h-|min-h-|w-|size-|shadow|opacity|underline|ring|tracking)")


def prop_group(tok):
    m = re.match(r"^((?:[a-z-]+:)*)(.*)$", tok)
    pre, base = m.group(1), m.group(2)
    if base.startswith("text-"):
        g = "text-size" if SIZE_TEXT.match(base) else "text-color"
    elif base.startswith("border") and base not in ("border",) and re.match(r"border-(\[|[a-z])", base) and not re.match(r"border-[trblxy]?-?\d", base):
        g = "border-color" if not re.match(r"border-(\d|[trblxy]-)", base) else "border-w"
    else:
        g = re.match(r"^([a-z]+(?:-[xy])?)", base).group(1) if re.match(r"^[a-z]", base) else base
    return pre + g


def button_label(s, end):
    close = s.find("</button>", end)
    if close == -1 or close - end > 1500:
        return ""
    inner = s[end:close]
    inner = re.sub(r"<[^>]+>", " ", inner)
    inner = re.sub(r"\{[^{}]*\}", " ", inner)
    inner = " ".join(inner.split())
    return inner[:12]


def classify_button(toks):
    base = {re.sub(r"^(?:[a-z-]+:)+", "", t) for t in toks if not re.match(r"^(?:hover|focus|focus-visible|disabled|active|group-hover|dark|aria-[\w-]+):", t)}
    bgs = [t for t in base if t.startswith("bg-")]
    texts = [t for t in base if t.startswith("text-") and not SIZE_TEXT.match(t)]
    def strong(t):   # bg-primary 或不透明度 ≥ 70 的 bg-primary/90 算实心；/10 这类浅底不算
        m = re.match(r"bg-(primary|\[var\(--brand\)\]|\[#c65a1e\]|brand)(?:/(\d+))?(?![\w-])", t, re.I)
        return bool(m) and (m.group(2) is None or int(m.group(2)) >= 70)
    solid_brand = any(strong(t) for t in bgs)
    solid_ink = any(re.search(r"bg-(foreground|\[var\(--foreground\)\]|\[var\(--floating-btn-bg\)\])", t) for t in bgs)
    # 浮层只认半透明黑白底；「品牌底 + 白字」是实心按钮，不能因为白字就判成浮层
    overlay = any(re.search(r"bg-(white|black)/", t) for t in bgs) or ("text-white" in base and not bgs)
    has_border = any(re.fullmatch(r"border(-\d+|-[trblxy](-\d+)?)?", t) for t in base) or \
        any(re.match(r"border-(primary|brand|\[var\(--brand)", t) for t in base)
    brand_text = any(re.search(r"text-(primary|\[var\(--brand\)\]|\[#c65a1e\]|brand|destructive)", t, re.I) for t in texts)
    pill = "rounded-full" in base
    has_px = any(re.match(r"px-|p-", t) for t in base)
    underline = "underline" in base or any("underline" in t for t in toks)
    if overlay:
        return "overlay"
    if solid_brand or solid_ink:
        return "solid"
    if has_border and brand_text:
        return "outline-brand"
    if has_border:
        return "outline"
    if pill and has_px:
        return "pill"
    if not has_px and any(re.match(r"(h|size|w)-", t) for t in base):
        return "icon"
    if underline or brand_text:
        return "link"
    return "ghost"


BUTTON_FAMILIES = [
    ("solid", "实心按钮", "整块填色，页面上最重的一个动作（提交、确认）。"),
    ("outline-brand", "描边·品牌色", "细边框 + 暖铜字，次要但想被看见的动作。"),
    ("outline", "描边·中性", "细边框 + 灰/墨字，工具类动作（筛选、展开、导出）。"),
    ("ghost", "纯文字/幽灵", "平时无边无底，悬停才出现底色；弹窗操作条、菜单项。"),
    ("icon", "图标按钮", "只有图标，固定宽高（关闭、复制、更多）。"),
    ("pill", "胶囊/标签切换", "圆角拉满，常见于分段切换和筛选标签。"),
    ("link", "文字链接", "长得像链接的按钮，下划线或品牌色字。"),
    ("overlay", "媒体浮层", "盖在图片/视频上的半透明按钮。"),
]


def scan_buttons(repo, src):
    rows = []
    for p in src_files(src):
        if not p.endswith((".tsx", ".jsx")):
            continue
        s = AT.read(p)
        for m in re.finditer(r"<button\b", s):
            # 找到这个开标签的结束 >（跳过 {} 内部）
            j, depth = m.end(), 0
            while j < len(s):
                c = s[j]
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                elif c == ">" and depth == 0:
                    break
                j += 1
            tag = s[m.start():j + 1]
            cm = re.search(r"className=", tag)
            line = s.count("\n", 0, m.start()) + 1
            label = button_label(s, j + 1)
            if not cm:
                rows.append({"file": rel(repo, p), "line": line, "toks": [], "dynamic": False, "raw": "", "label": label})
                continue
            expr = attr_expr(tag, cm.end())
            dynamic = tag[cm.end()] == "{" and not re.fullmatch(r"\s*\"[^\"]*\"\s*", expr)
            lits = re.findall(r"\"([^\"]*)\"|'([^']*)'|`([^`]*)`", expr) if tag[cm.end()] == "{" else [(expr, "", "")]
            words = []
            for tup in lits:
                for w in " ".join(tup).replace("${", " ").split():
                    if re.match(r"^[\w\[\]#:/().%,_-]+$", w) and not w.endswith("}"):
                        words.append(w)
            toks = sorted({w for w in words if VIS.match(w)})
            rows.append({"file": rel(repo, p), "line": line, "toks": toks, "dynamic": dynamic,
                         "raw": " ".join(dict.fromkeys(words)), "label": label})
    return rows


def render_classes(row):
    """按「每个属性组取第一个」去掉条件分支互斥的类，得到一份可渲染的近似类名。"""
    seen, keep = set(), []
    for w in row["raw"].split():
        g = prop_group(w) if VIS.match(w) else "layout:" + w
        if g in seen and VIS.match(w):
            continue
        seen.add(g)
        keep.append(w)
    return " ".join(keep)


def state_classes(cls, state):
    """把 hover:/focus-visible: 前缀去掉、并删掉被它覆盖的默认类，得到「强制呈现该状态」的类名。"""
    pres = {"hover": ("hover:", "group-hover:"), "focus": ("focus-visible:", "focus:")}[state]
    words = cls.split()
    lifted, groups = [], set()
    for w in words:
        for p in pres:
            if w.startswith(p) and ":" not in w[len(p):].split("[")[0]:
                lifted.append(w[len(p):])
                if VIS.match(w[len(p):]):
                    groups.add(prop_group(w[len(p):]))
                break
    out = [w for w in words if not any(w.startswith(p) for p in pres)
           and not (VIS.match(w) and ":" not in w.split("[")[0] and prop_group(w) in groups)]
    return " ".join(out + lifted)


def build_buttons(repo, src):
    rows = scan_buttons(repo, src)
    fams = collections.OrderedDict((k, {"key": k, "label": l, "desc": d, "variants": collections.OrderedDict()}) for k, l, d in BUTTON_FAMILIES)
    unstyled = []
    for r in rows:
        if not r["toks"]:
            unstyled.append({"file": r["file"], "line": r["line"]})
            continue
        fam = classify_button(r["toks"])
        sig = " ".join(r["toks"])
        v = fams[fam]["variants"].get(sig)
        if not v:
            v = {"sig": sig, "count": 0, "dynamic": False, "cls": render_classes(r), "label": r["label"], "where": []}
            fams[fam]["variants"][sig] = v
        v["count"] += 1
        v["dynamic"] = v["dynamic"] or r["dynamic"]
        if not v["label"] and r["label"]:
            v["label"] = r["label"]
        if not r["dynamic"] and v.get("_static") is None:
            v["cls"], v["_static"] = r["raw"], True
        v["where"].append(f'{r["file"]}:{r["line"]}')
    out = []
    for k, f in fams.items():
        vs = sorted(f["variants"].values(), key=lambda x: -x["count"])
        for i, v in enumerate(vs, 1):
            v.pop("_static", None)
            v["id"] = "btn." + hashlib.sha1(v["sig"].encode()).hexdigest()[:8]   # 按长相定号，重跑不漂移
            v["rank"] = i
            v["cls_hover"] = state_classes(v["cls"], "hover")
            v["cls_focus"] = state_classes(v["cls"], "focus")
        f["variants"] = vs
        f["count"] = sum(v["count"] for v in vs)
        out.append(f)
    return {"total": len(rows), "dynamic": sum(1 for r in rows if r["dynamic"]),
            "unstyled": unstyled, "families": out}


def usage(repo, src, names, tw_names):
    var_cnt, tw_cnt = collections.Counter(), collections.Counter()
    files = collections.defaultdict(collections.Counter)
    tw_res = {n: re.compile(r"(?<![\w-])" + VARIANT + TW_COLOR_PROPS + "-" + re.escape(n[2:]) + r"(?:/\d+)?(?![\w-])")
              for n in names if n in tw_names}
    for p in src_files(src):
        s = AT.read(p)
        r = rel(repo, p)
        for n in re.findall(r"var\((--[\w-]+)", s):
            if n in names:
                var_cnt[n] += 1
                files[n][r] += 1
        if p.endswith((".tsx", ".jsx", ".ts")):
            for n, rx in tw_res.items():
                k = len(rx.findall(s))
                if k:
                    tw_cnt[n] += k
                    files[n][r] += k
    return var_cnt, tw_cnt, files


def hardcoded_colors(repo, src, palette):
    by_val = {}
    for name, val in palette:
        by_val.setdefault(val.lower(), name)
    cnt, files = collections.Counter(), collections.defaultdict(collections.Counter)
    for p in src_files(src):
        if not p.endswith((".tsx", ".jsx", ".ts")):
            continue
        s = AT.read(p)
        for h in re.findall(r"(?<![\w&])#([0-9a-fA-F]{6})(?![\w])", s):
            v = "#" + h.lower()
            cnt[v] += 1
            files[v][rel(repo, p)] += 1
    return [{"value": v, "uses": n, "files": [f for f, _ in files[v].most_common(4)], "same_as": by_val.get(v)}
            for v, n in cnt.most_common()]


WEIGHT_WORDS = {"thin": 100, "extralight": 200, "light": 300, "normal": 400, "regular": 400, "medium": 500,
                "semibold": 600, "bold": 700, "extrabold": 800, "black": 900}


def weight_of(v):
    v = (v or "400").strip().lower()
    if v.isdigit():
        return int(v)
    return WEIGHT_WORDS.get(v, 400)   # var(--w)、bolder 之类按 400 记，不让一个写法让整次抽取崩掉


def text_roles(css_path, tw_fonts_list):
    t = blank_comments(AT.read(css_path))
    raw = AT.read(css_path)
    roles = []
    for m in re.finditer(r"\.([\w-]+)\s*\{([^{}]*)\}", t):
        body = m.group(2)
        if "font-size" not in body or "font-family" not in body:
            continue
        def g(prop):
            mm = re.search(prop + r"\s*:\s*([^;]+);", body)
            return " ".join(mm.group(1).split()) if mm else None
        fam = g("font-family") or ""
        fm = re.search(r"fontFamily\.([\w-]+)", fam)
        note = ""
        cm = re.search(r"/\*(.*?)\*/", raw[m.start(2):m.end(2)], re.S)   # 注释从原文取，解析用去注释的文本
        if cm:
            note = " ".join(cm.group(1).split())[:120]
        roles.append({"id": m.group(1), "family": fm.group(1) if fm else fam,
                      "size": AT.num(re.sub(r"px$", "", g("font-size") or "0")),
                      "lh": AT.num(g("line-height") or "0") if re.fullmatch(r"[\d.]+", g("line-height") or "") else 0,
                      "weight": weight_of(g("font-weight")),
                      "color": (re.search(r"var\((--[\w-]+)\)", g("color") or "") or [None, None])[1],
                      "line": t.count("\n", 0, m.start()) + 1, "note": note})
    return roles


def scales(src):
    cnt = {k: collections.Counter() for k in ("px", "space", "radius", "lh", "weight")}
    for p in src_files(src):
        AT.count_usage(AT.read(p), cnt)
    return {k: [{"v": v, "n": n} for v, n in sorted(c.items())] for k, c in cnt.items()}


def containers(repo, src):
    mw, grid = collections.Counter(), collections.Counter()
    mwf, gf = collections.defaultdict(set), collections.defaultdict(set)
    for p in src_files(src):
        if not p.endswith((".tsx", ".jsx")):
            continue
        s = AT.read(p)
        for v in re.findall(r"max-w-\[(\d+)px\]", s):
            mw[int(v)] += 1
            mwf[int(v)].add(rel(repo, p))
        for v in re.findall(r"grid-cols-\[([^\]\s]+)\]", s):
            grid[v] += 1
            gf[v].add(rel(repo, p))
    return ([{"v": v, "n": n, "files": sorted(mwf[v])[:5]} for v, n in sorted(mw.items(), reverse=True)],
            [{"v": v.replace("_", " "), "n": n, "files": sorted(gf[v])[:5]} for v, n in grid.most_common(20)])


def build_product_css(repo, pack_dir, front):
    """用项目自己的 Tailwind 编译：内容源 = 产品 src + 本零件库 json（按钮变体的类名在 json 里）。"""
    bin_ = os.path.join(front, "node_modules", ".bin", "tailwindcss")
    if not os.path.exists(bin_):
        return f"跳过 product.css：{rel(repo, bin_)} 不存在（worktree 里先软链主仓库的 node_modules）"
    cfg = next((os.path.join(front, f) for f in ("tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs") if os.path.exists(os.path.join(front, f))), None)
    out = os.path.join(pack_dir, "product.css")
    content = f"./src/**/*.{{ts,tsx}},{os.path.relpath(os.path.join(pack_dir, 'system.tokens.json'), front)},{os.path.relpath(os.path.join(pack_dir, 'system.html'), front)}"
    cmd = [bin_, "-c", cfg, "-i", "src/globals.css", "--content", content, "-o", out, "--minify"]
    r = subprocess.run(cmd, cwd=front, capture_output=True, text=True)
    if r.returncode != 0:
        return "product.css 编译失败：" + (r.stderr or r.stdout)[-400:]
    with open(out, encoding="utf-8") as fh:
        css = fh.read()
    # 自托管字体走 @fontsource（在 main.tsx 里 import），这里不会有；页面另挂 Google Fonts 兜底
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("/* 生成物：extract_system.py --product-css 用产品 Tailwind 配置编译，勿手改 */\n" + css)
    return f"product.css {len(css)//1024} KB"


def repo_name(repo):
    """worktree 的目录名不是仓库名；取 git 公共目录的上一级。"""
    try:
        common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=repo,
                                capture_output=True, text=True, timeout=5).stdout.strip()
        if common:
            return os.path.basename(os.path.dirname(common.rstrip("/")))
    except (OSError, subprocess.SubprocessError):
        pass
    return os.path.basename(repo)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("--css-file", default="frontend-react/src/globals.css")
    ap.add_argument("--src", default="frontend-react/src")
    ap.add_argument("--tw", default="frontend-react/tailwind.config.ts")
    ap.add_argument("--product-css", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    css_path, src, tw = (os.path.join(repo, x) for x in (a.css_file, a.src, a.tw))
    for p in (css_path, src):
        if not os.path.exists(p):
            print("✗ 找不到", rel(repo, p))
            sys.exit(3)
    pack_dir = os.path.join(repo, PACK_REL)
    os.makedirs(pack_dir, exist_ok=True)
    jpath = os.path.join(pack_dir, "system.tokens.json")
    old = {}
    if os.path.exists(jpath):
        with open(jpath, encoding="utf-8") as fh:
            old = json.load(fh)

    vars_ = parse_vars(css_path)
    tw_names = tw_semantic_names(tw) if os.path.exists(tw) else set()
    all_names = set()
    for sc in vars_.values():
        for mode in sc.values():
            all_names |= set(mode)
    var_cnt, tw_cnt, files = usage(repo, src, all_names, tw_names)

    colors, others = [], []
    for scope, modes in vars_.items():
        light, dark = modes["light"], modes["dark"]
        table_l = {k: v[0] for k, v in vars_["root"]["light"].items()}
        table_l.update({k: v[0] for k, v in light.items()})
        for name in list(light) + [n for n in dark if n not in light]:
            lv = light.get(name, (None, None, ""))
            dv = dark.get(name, (None, None, ""))
            kind = AT.classify(name, lv[0] or dv[0] or "", table_l)
            item = {"id": name if scope == "root" else f"{scope} {name}", "name": name, "scope": scope,
                    "light": lv[0], "dark": dv[0], "line": lv[1] or dv[1], "dark_line": dv[1],
                    "note": lv[2] or dv[2], "uses": var_cnt[name] + tw_cnt[name], "uses_var": var_cnt[name],
                    "uses_tw": tw_cnt[name], "tw_class": name in tw_names,
                    "files": [f for f, _ in files[name].most_common(8)], "files_n": len(files[name])}
            if kind == "color":
                item["family"] = "scope" if scope != "root" else family_of(name)
                colors.append(item)
            else:
                item["kind"] = kind
                others.append(item)

    palette = [(c["name"], c["light"]) for c in colors if c.get("light") and c["light"].startswith("#")]
    tw_static = tw_static_colors(tw) if os.path.exists(tw) else []
    fonts = tw_fonts(tw) if os.path.exists(tw) else []
    font_cnt = collections.Counter()
    tw_static_cnt = collections.Counter()
    for p in src_files(src):
        if p.endswith((".tsx", ".jsx")):
            s = AT.read(p)
            for f in fonts:
                font_cnt[f["id"]] += len(re.findall(r"(?<![\w-])" + VARIANT + "font-" + re.escape(f["id"]) + r"(?![\w-])", s))
            for c in tw_static:
                tw_static_cnt[c["id"]] += len(re.findall(r"(?<![\w-])" + VARIANT + TW_COLOR_PROPS + "-" + re.escape(c["id"]) + r"(?:/\d+)?(?![\w-])", s))
    for f in fonts:
        f["uses"] = font_cnt[f["id"]]
    for c in tw_static:
        c["uses"] = tw_static_cnt[c["id"]]
    mw, grids = containers(repo, src)

    spec = {
        "kind": "system", "schemaVersion": 1, "page": "system", "title": "设计零件库",
        "repoName": repo_name(repo),
        "updated": datetime.date.today().isoformat(),
        "extracted": datetime.datetime.now().isoformat(timespec="seconds"),
        "files": {"json": os.path.join(PACK_REL, "system.tokens.json"), "css_source": a.css_file,
                  "tailwind": a.tw, "product_css": os.path.join(PACK_REL, "product.css"),
                  "template_css": os.path.join(PACK_REL, "template.css")},
        "families": [{"key": k, "label": l} for k, l, _ in FAMILIES],
        "colors": colors,
        "tw_colors": tw_static,
        "hardcoded_colors": hardcoded_colors(repo, src, palette),
        "other_vars": others,
        "fonts": fonts,
        "text_roles": sorted(text_roles(css_path, fonts), key=lambda r: (not r["id"].startswith("reading-"), r["line"])),
        "scales": scales(src),
        "containers": mw, "grids": grids,
        "buttons": build_buttons(repo, src),
        "layouts": old.get("layouts") or [],
        "template": old.get("template") or {},
        "custom": old.get("custom") or [],
        "edits": old.get("edits") or {},
        "decisions": old.get("decisions") or {},
        "feedback": old.get("feedback") or [],
    }
    with open(jpath, "w", encoding="utf-8") as fh:
        json.dump(spec, fh, ensure_ascii=False, indent=1)

    # 页面模板：页面本体放包内，引擎放 _workbench（与页面包共用目录）
    wb = os.path.join(repo, "docs", "assets", "visuals", "_workbench")
    os.makedirs(wb, exist_ok=True)
    for f in ("system.js", "system.css", "template-css.js"):
        shutil.copyfile(os.path.join(LAB_ASSETS, f), os.path.join(wb, f))
    html = os.path.join(pack_dir, "system.html")
    shutil.copyfile(os.path.join(LAB_ASSETS, "system.html"), html)

    msg = build_product_css(repo, pack_dir, os.path.dirname(src)) if a.product_css else "未编译 product.css（加 --product-css）"
    b = spec["buttons"]
    if not a.quiet:
        print(f"✓ {rel(repo, jpath)}")
        print(f"  颜色 {len(colors)}（作用域外 {sum(1 for c in colors if c['scope'] != 'root')}）· 其他变量 {len(others)} · Tailwind 固定色 {len(tw_static)}")
        print(f"  写死的颜色 {len(spec['hardcoded_colors'])} 种，其中与站点色同值 {sum(1 for h in spec['hardcoded_colors'] if h['same_as'])} 种")
        print(f"  字体角色 {len(fonts)} · 文字角色类 {len(spec['text_roles'])}")
        print(f"  按钮 {b['total']} 个（动态类名 {b['dynamic']}，无类名 {len(b['unstyled'])}）→ "
              + " / ".join(f"{f['label']} {f['count']}·{len(f['variants'])}种" for f in b["families"] if f["count"]))
        print(f"  容器宽度 {len(mw)} 种 · 网格模板 {len(grids)} 种 · 版面骨架 {len(spec['layouts'])}（手写，重跑保留）")
        print(f"  未同步改动 {len(spec['edits'])} · 裁决 {len(spec['decisions'])} · 反馈 {len(spec['feedback'])}")
        print("  " + msg)


if __name__ == "__main__":
    main()
