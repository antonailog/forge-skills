#!/usr/bin/env python3
"""forge-design-lab · S1 token 来源适配。

用法:
  python3 adapt_tokens.py <repo_root> --page <slug> [--prefix xx] [--out <path>] [--init-spec] [--css-out <仓库相对路径>]
  （--prefix 写 ai 或 =--ai 都行；argparse 不接受裸 "--ai" 作参数值）

做什么:
  1. 找全局 CSS，抽 :root 变量与暗色块（.dark / [data-theme=dark] / prefers-color-scheme: dark）变量
  2. 找 tailwind.config.*，抽 theme.extend 的 colors / fontFamily / spacing / fontSize / borderRadius / lineHeight / fontWeight
  3. 扫 CSS / TSX / JSX / Vue / HTML 的实际用量（CSS 声明 + Tailwind 工具类），统计字号 / 间距 / 圆角 / 行高 / 字重阶梯
  4. 找字体来源（:root 字体角色变量、Google Fonts 链接、@font-face 自托管）
  5. 定页面 token 前缀（默认 --<slug 首段>；与站点变量撞前缀时提示）
输出:
  <out>（默认 docs/assets/visuals/<page>/<page>.adapt.json）+ 一屏适配报告（stdout）
  --init-spec 另写起步 <page>.tokens.json（groups / scale / foundation 已填，nodes 为空；已存在则不覆盖）
退出码: 0 正常；3 什么 token 来源都没找到（报告里列候选文件，让用户指认）
"""
import argparse
import collections
import datetime
import json
import os
import re
import sys
from urllib.parse import unquote

SKIP_DIRS = {"node_modules", "dist", "build", "coverage", "out", "__pycache__", "venv", "target", "vendor", "storybook-static"}
CODE_EXT = {".css", ".scss", ".less", ".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte", ".html", ".astro"}
TW_TEXT = {"xs": 12, "sm": 14, "base": 16, "lg": 18, "xl": 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48}
TW_ROUND = {"none": 0, "sm": 2, "md": 6, "lg": 8, "xl": 12, "2xl": 16, "3xl": 24}
TW_LEAD = {"none": 1, "tight": 1.25, "snug": 1.375, "normal": 1.5, "relaxed": 1.625, "loose": 2}
TW_WEIGHT = {"thin": 100, "extralight": 200, "light": 300, "normal": 400, "medium": 500, "semibold": 600, "bold": 700, "extrabold": 800, "black": 900}

SEVEN = [
    {"key": "structure", "label": "1 结构", "ask": "放对地方了吗、比例对吗", "how": "先看区域划分和尺寸，再看谁滚动、断点在哪。"},
    {"key": "hierarchy", "label": "2 层级", "ask": "重点对吗", "how": "不看具体值，只回答三问：先看什么、再看什么、最后看什么。答不出即层级失败。"},
    {"key": "type", "label": "3 排版", "ask": "读起来对吗", "how": "按文字角色走：正文、标题、meta、标签、来源行。每个角色查字体族、字号、字重、行高。"},
    {"key": "color", "label": "4 色彩", "ask": "颜色用对了吗、对比够吗", "how": "只看语义色用在哪，不改站点色值。基础色只读，可标提议。"},
    {"key": "space", "label": "5 间距与形状", "ask": "密度对吗", "how": "padding、gap、圆角、边框。值必须落在站点阶梯上，不在阶梯的标红。"},
    {"key": "motion", "label": "6 状态与动效", "ask": "每个状态都有交代吗", "how": "切视图块的状态逐个看；动效只动 transform/opacity；reduced-motion 下的表现。"},
    {"key": "consistency", "label": "7 一致性", "ask": "有没有另起炉灶", "how": "自动统计：引用了哪些站点 token、新造了哪些页面 token、哪些值不在阶梯上。"},
]

VAR_RE = re.compile(r"(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)")
COLOR_RE = re.compile(r"^(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|oklab\(|color-mix\(|transparent$|currentColor$|white$|black$)")
HSL_PARTS_RE = re.compile(r"^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%$")
DECL_RE = re.compile(r"(font-size|line-height|font-weight|padding(?:-(?:top|right|bottom|left|inline|block))?|margin(?:-(?:top|right|bottom|left|inline|block))?|gap|row-gap|column-gap|border-radius)\s*:\s*([^;}{]+)")
PX_RE = re.compile(r"(?<![\w.-])(\d+(?:\.\d+)?)px\b")
TW_RE = re.compile(r"(?<![\w-])(text|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y|rounded(?:-(?:t|r|b|l|tl|tr|br|bl))?|leading|font)-(\[[^\]]+\]|[\w.]+)")
TW_ROUNDED_BARE_RE = re.compile(r"(?<![\w-])rounded(?![\w-])")
GF_RE = re.compile(r"fonts\.googleapis\.com/css2?\?([^\"'\s>)]+)")


def walk(root):
    for dp, dns, fns in os.walk(root):
        rel = os.path.relpath(dp, root)
        if rel.startswith(os.path.join("docs", "assets", "visuals")):
            dns[:] = []
            continue
        dns[:] = [d for d in dns if d not in SKIP_DIRS and not d.startswith(".")]
        for f in fns:
            if f.endswith((".tokens.css", ".tokens.js", ".adapt.json")):
                continue  # 页面包生成物不是站点来源，否则页面前缀会被误判为撞站点变量
            if os.path.splitext(f)[1] in CODE_EXT:
                yield os.path.join(dp, f)


def read(path):
    try:
        with open(path, encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except OSError:
        return ""


def css_rules(text, ctx=""):
    """返回 [(上下文@规则, 选择器, 声明体)]，@media/@layer/@supports 递归展开。"""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    out, i, n = [], 0, len(text)
    while i < n:
        j = text.find("{", i)
        if j < 0:
            break
        sel = text[i:j].split(";")[-1].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if text[k] == "{":
                depth += 1
            elif text[k] == "}":
                depth -= 1
            k += 1
        body = text[j + 1:k - 1]
        if sel.startswith(("@media", "@layer", "@supports", "@container")):
            out += css_rules(body, ctx + sel + " ")
        elif not sel.startswith("@"):
            out.append((ctx, sel, body))
        i = k
    return out


def collect_vars(path, text, light, dark, origins):
    found = 0
    for ctx, sel, body in css_rules(text):
        is_dark = bool(("prefers-color-scheme" in ctx and "dark" in ctx) or re.search(r"\.dark\b|data-theme\s*=\s*[\"']?dark", sel))
        is_root = ":root" in sel or sel.strip() in ("html", "body") or is_dark
        if not is_root:
            continue
        for name, val in VAR_RE.findall(body):
            val = val.strip()
            (dark if is_dark else light)[name] = val
            origins.setdefault(name, path)
            found += 1
    return found


def resolve(name, table, depth=0):
    v = table.get(name, "")
    m = re.fullmatch(r"var\((--[\w-]+)\)", v.strip())
    if m and depth < 6:
        return resolve(m.group(1), table, depth + 1)
    return v


def classify(name, val, table, depth=0):
    v = val.strip()
    if "font" in name.lower() or re.search(r"['\"][^'\"]+['\"]\s*,|\b(serif|sans-serif|monospace|system-ui)\b", v):
        return "font"
    if COLOR_RE.match(v) or HSL_PARTS_RE.match(v):
        return "color"
    m = re.fullmatch(r"var\((--[\w-]+)\)", v)
    if m and m.group(1) != name and m.group(1) in table and depth < 6:
        return classify(m.group(1), table[m.group(1)], table, depth + 1)
    if re.fullmatch(r"-?[\d.]+(px|rem|em)", v):
        return "size"
    return "other"


def brace_block(text, start):
    depth = 0
    for k in range(start, len(text)):
        if text[k] == "{":
            depth += 1
        elif text[k] == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1:k]
    return text[start + 1:]


def tailwind_theme(path):
    t = read(path)
    out = {}
    m = re.search(r"\bextend\s*:\s*{", t)
    scope = brace_block(t, m.end() - 1) if m else t
    for key in ["colors", "fontFamily", "spacing", "fontSize", "borderRadius", "lineHeight", "fontWeight"]:
        mm = re.search(r"\b" + key + r"\s*:\s*{", scope)
        if mm:
            blk = brace_block(scope, mm.end() - 1)
            keys = re.findall(r"^\s*['\"]?([\w.-]+)['\"]?\s*:", blk, flags=re.M)
            out[key] = {"keys": keys[:60], "raw": blk.strip()[:1500]}
    return out


def num(s):
    f = float(s)
    return int(f) if f.is_integer() else round(f, 3)


def tw_len(v):
    if v.startswith("[") and v.endswith("]"):
        m = re.fullmatch(r"(\d+(?:\.\d+)?)(px|rem)", v[1:-1])
        return num(float(m.group(1)) * (16 if m.group(2) == "rem" else 1)) if m else None
    if v == "px":
        return 1
    try:
        return num(float(v) * 4)
    except ValueError:
        return None


def count_usage(text, cnt):
    for prop, val in DECL_RE.findall(text):
        if prop == "font-size":
            for p in PX_RE.findall(val):
                cnt["px"][num(p)] += 1
        elif prop == "line-height":
            m = re.fullmatch(r"\s*(\d(?:\.\d+)?)\s*", val)
            if m:
                cnt["lh"][num(m.group(1))] += 1
        elif prop == "font-weight":
            m = re.match(r"\s*(\d{3})\b", val)
            if m:
                cnt["weight"][int(m.group(1))] += 1
        elif prop == "border-radius":
            for p in PX_RE.findall(val):
                cnt["radius"][num(p)] += 1
        else:
            for p in PX_RE.findall(val):
                cnt["space"][num(p)] += 1
    for kind, v in TW_RE.findall(text):
        if kind == "text":
            if v in TW_TEXT:
                cnt["px"][TW_TEXT[v]] += 1
            elif v.startswith("["):
                x = tw_len(v)
                if x is not None:
                    cnt["px"][x] += 1
        elif kind.startswith("rounded"):
            if v in TW_ROUND:
                cnt["radius"][TW_ROUND[v]] += 1
            elif v.startswith("["):
                x = tw_len(v)
                if x is not None:
                    cnt["radius"][x] += 1
        elif kind == "leading":
            if v in TW_LEAD:
                cnt["lh"][TW_LEAD[v]] += 1
        elif kind == "font":
            if v in TW_WEIGHT:
                cnt["weight"][TW_WEIGHT[v]] += 1
        else:
            x = tw_len(v)
            if x is not None:
                cnt["space"][x] += 1
    cnt["radius"][4] += len(TW_ROUNDED_BARE_RE.findall(text))


def ladder(c, min_count, cap):
    items = [(v, n) for v, n in c.items() if n >= min_count]
    items.sort(key=lambda x: -x[1])
    return sorted(v for v, _ in items[:cap])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("--page", required=True, help="页面 slug，如 ai-search")
    ap.add_argument("--prefix", help="页面 token 前缀，写 ai（脚本补 --）或 --prefix=--ai；默认取 slug 首段")
    ap.add_argument("--out", help="adapt.json 输出路径（默认 docs/assets/visuals/<page>/<page>.adapt.json）")
    ap.add_argument("--init-spec", action="store_true", help="同时生成起步 <page>.tokens.json（已存在则不覆盖）")
    ap.add_argument("--css-out", help="前端 tokens.css 的仓库相对路径（默认放在主全局 CSS 同目录）")
    ap.add_argument("--no-template", action="store_true", help="不用零件库模板，退回按实际用量统计（只在模板还没建时用）")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    slug = a.page.strip().lower()
    today = datetime.date.today().isoformat()

    light, dark, origins = {}, {}, {}
    per_file = collections.Counter()
    cnt = {k: collections.Counter() for k in ("px", "space", "radius", "lh", "weight")}
    google, fontface_names, fontface_count = set(), set(), 0
    tailwind_cfgs, html_files = [], []
    for path in walk(repo):
        ext = os.path.splitext(path)[1]
        base = os.path.basename(path)
        text = read(path)
        if not text:
            continue
        if base.startswith("tailwind.config."):
            tailwind_cfgs.append(path)
            continue
        if ext in (".css", ".scss", ".less"):
            per_file[path] += collect_vars(path, text, light, dark, origins)
            for m in re.finditer(r"@font-face\s*{([^}]*)}", text):
                fontface_count += 1
                fm = re.search(r"font-family\s*:\s*([^;]+)", m.group(1))
                if fm:
                    fontface_names.add(fm.group(1).strip().strip("'\""))
        if ext == ".html":
            html_files.append(path)
        for q in GF_RE.findall(text):
            for part in q.split("&"):
                if part.startswith("family="):
                    google.add(unquote(part[7:].split(":")[0].replace("+", " ")))
        count_usage(text, cnt)

    primary = per_file.most_common(1)[0][0] if per_file and per_file.most_common(1)[0][1] else None
    tw = {os.path.relpath(p, repo): tailwind_theme(p) for p in tailwind_cfgs}

    kinds = {n: classify(n, v, light) for n, v in light.items()}
    colors_light, colors_dark, fonts_roles, sizes = {}, {}, {}, {}
    for n, v in light.items():
        k = kinds[n]
        rv = resolve(n, light)
        if k == "color":
            colors_light[n[2:]] = f"hsl({rv})" if HSL_PARTS_RE.match(rv) else rv
        elif k == "font":
            fonts_roles[n] = v
        elif k == "size":
            sizes[n] = v
    for n, v in dark.items():
        if kinds.get(n) == "color" or classify(n, v, {**light, **dark}) == "color":
            rv = resolve(n, {**light, **dark})
            colors_dark[n[2:]] = f"hsl({rv})" if HSL_PARTS_RE.match(rv) else rv

    scale = {
        "px": ladder(cnt["px"], 3, 14), "space": ladder(cnt["space"], 3, 10), "radius": ladder(cnt["radius"], 2, 6),
        "lh": ladder(cnt["lh"], 2, 9), "weight": ladder(cnt["weight"], 2, 5),
    }
    warnings = []
    defaults = {"px": [12, 13, 14, 16, 18, 20, 24], "space": [4, 8, 12, 16, 24, 32], "radius": [4, 8], "lh": [1.4, 1.5, 1.6], "weight": [400, 500, 600, 700]}
    for k, d in defaults.items():
        if not scale[k]:
            scale[k] = d
            warnings.append(f"阶梯 {k} 没有统计到足够用量，先用默认 {d}，请人工确认")

    # 零件库模板存在时，它就是唯一来源：色板只给模板颜色，阶梯只给模板阶梯。
    # 页面包不再各自从代码里抽站点值，否则每个页面一套「站点色」，模板就不唯一了。
    template_src = None
    tpl_path = os.path.join(repo, "docs", "assets", "visuals", "system", "system.tokens.json")
    if not a.no_template and os.path.exists(tpl_path):
        try:
            T = (json.load(open(tpl_path, encoding="utf-8")).get("template") or {})
        except (OSError, ValueError):
            T = {}
        if T.get("colors"):
            colors_light = {c["name"][2:]: c["light"] for c in T["colors"] if c.get("light")}
            colors_dark = {c["name"][2:]: c["dark"] for c in T["colors"] if c.get("dark")}
            types = T.get("type") or []
            scale = {
                "px": sorted(T.get("sizes") or scale["px"]),
                "space": sorted(set([0] + (T.get("space") or scale["space"]))),
                "radius": sorted(r["v"] for r in T.get("radius") or [] if r["v"] < 999) or scale["radius"],
                "lh": sorted({t["lh"] for t in types}) or scale["lh"],
                "weight": sorted({t["weight"] for t in types} | {400, 600}) or scale["weight"],
            }
            fonts_roles = {f"--t-font-{f['id']}": ", ".join(f["stack"]) for f in T.get("fonts") or []} or fonts_roles
            template_src = f"零件库模板 {T.get('version', '')}（{os.path.relpath(tpl_path, repo)}）"
            warnings = [w for w in warnings if not w.startswith("阶梯")]

    seg = re.sub(r"[^a-z0-9]", "", slug.split("-")[0]) or "pg"
    prefix = "--" + (a.prefix or seg).strip().lstrip("-").rstrip("-")
    collide = sorted(n for n in light if n.startswith(prefix + "-"))
    if collide:
        warnings.append(f"前缀 {prefix} 与站点变量撞前缀：{', '.join(collide[:6])}… 建议 --prefix 换一个")

    out_path = a.out or os.path.join(repo, "docs", "assets", "visuals", slug, f"{slug}.adapt.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    css_out = a.css_out or (os.path.join(os.path.relpath(os.path.dirname(primary), repo), f"{slug}.tokens.css") if primary else f"src/{slug}.tokens.css")
    adapt = {
        "schemaVersion": 1, "generated": today, "repo": os.path.basename(repo), "page": slug, "prefix": prefix,
        "sources": {"primaryCss": os.path.relpath(primary, repo) if primary else None,
                    "cssFiles": [os.path.relpath(p, repo) for p, c in per_file.most_common(8) if c],
                    "tailwindConfigs": list(tw.keys()), "htmlWithFonts": [os.path.relpath(p, repo) for p in html_files if GF_RE.search(read(p))][:5]},
        "vars": {"light": light, "dark": dark, "kinds": kinds},
        "foundation": {"light": colors_light, "dark": colors_dark},
        "fonts": {"roles": fonts_roles, "google": sorted(google), "selfHosted": sorted(fontface_names), "fontFaceCount": fontface_count},
        "sizes": sizes, "tailwind": tw, "scale": scale,
        "usage": {k: dict(sorted(((str(v), n) for v, n in c.most_common(20)), key=lambda x: -x[1])) for k, c in cnt.items()},
        "suggestedCssOut": css_out, "warnings": warnings, "templateSource": template_src,
    }
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(adapt, fh, ensure_ascii=False, indent=1)

    nothing = not light and not tw
    print(f"# 适配报告 · {os.path.basename(repo)} / {slug} · {today}")
    print(f"站点 CSS 变量：{len(light)} 个（暗色覆盖 {len(dark)}）· 主文件：{adapt['sources']['primaryCss'] or '未找到 :root 变量'}")
    print(f"  色 {len(colors_light)} · 字体角色 {len(fonts_roles)} · 尺寸 {len(sizes)} · 其他 {sum(1 for k in kinds.values() if k == 'other')}")
    if fonts_roles:
        for n, v in list(fonts_roles.items())[:6]:
            print(f"  {n}: {v[:70]}")
    print(f"tailwind 配置：{', '.join(tw.keys()) or '无'}" + (f" · extend 键：{', '.join(k for v in tw.values() for k in v)}" if tw else ""))
    for v in tw.values():
        if v.get("fontFamily"):
            print(f"  fontFamily：{', '.join(v['fontFamily']['keys'])}  ← 字体角色在 tailwind 里，骨架的站点变量复刻要手工补 --serif/--sans/--mono")
    print(f"色板与阶梯来源：{template_src}——页面只从模板取值，模板没有的值走定制申请" if template_src else "阶梯（来自实际用量，次数≥阈值）：")
    for k, lab in (("px", "字号"), ("space", "间距"), ("radius", "圆角"), ("lh", "行高"), ("weight", "字重")):
        top = ", ".join(f"{v}×{n}" for v, n in cnt[k].most_common(6))
        print(f"  {lab:<3} {scale[k]}    最常用 {top or '—'}")
    print(f"字体来源：Google Fonts {sorted(google) or '无'} · 自托管 @font-face {fontface_count} 处 {sorted(fontface_names)[:4] or ''}")
    print(f"页面 token 前缀：{prefix}    前端 css 建议路径：{css_out}")
    for w in warnings:
        print(f"⚠ {w}")
    print(f"→ 已写 {os.path.relpath(out_path, repo)}")

    if a.init_spec:
        spec_path = os.path.join(repo, "docs", "assets", "visuals", slug, f"{slug}.tokens.json")
        if os.path.exists(spec_path):
            print(f"= 起步 spec 已存在，不覆盖：{os.path.relpath(spec_path, repo)}")
        else:
            rel_dir = os.path.relpath(os.path.dirname(spec_path), repo)
            spec = {
                "schemaVersion": 1, "version": "v0.1", "page": slug, "title": f"{slug} · 设计工作台", "prefix": prefix,
                "repoName": os.path.basename(repo), "updated": today,
                "files": {"json": f"{rel_dir}/{slug}.tokens.json", "js": f"{rel_dir}/{slug}.tokens.js", "css": css_out},
                "levels": [{"key": "wire", "label": "线框"}, {"key": "page", "label": "页面", "states": True}, {"key": "module", "label": "模块放大", "w": 1180, "h": 760}],
                "states": [{"key": "default", "label": "默认"}],
                "viewports": [{"key": "follow", "label": "跟随窗口"}, {"key": "1440x900", "label": "1440×900", "w": 1440, "h": 900}, {"key": "390x844", "label": "390 手机", "w": 390, "h": 844}],
                "toggles": [], "effects": [], "mobileBelow": None, "elementIds": {}, "layout": [],
                "groups": SEVEN, "modules": [{"key": "structure", "label": "结构"}],
                "scale": scale, "foundation": {"light": colors_light, "dark": colors_dark},
                "nodes": [], "decisions": {}, "feedback": [],
                "_todo": "S2：填 layout / modules / states 与结构层节点 → build_tokens.py → scaffold_pack.py → 线框确认；S3：补七层节点与判断题。",
            }
            with open(spec_path, "w", encoding="utf-8") as fh:
                json.dump(spec, fh, ensure_ascii=False, indent=1)
            print(f"→ 已写起步 spec {os.path.relpath(spec_path, repo)}（nodes 为空）")

    if nothing:
        print("✗ 没找到任何 :root 变量或 tailwind 配置。候选文件：")
        for p, _ in per_file.most_common(10):
            print("   ", os.path.relpath(p, repo))
        print("请让用户指认站点全局样式文件，或用 --css-out / --prefix 手工给定。")
        sys.exit(3)


if __name__ == "__main__":
    main()
