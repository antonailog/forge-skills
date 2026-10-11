#!/usr/bin/env python3
"""forge-design-lab · 守门检查：新增代码里不准出现模板和定制清单以外的设计值。

用法:
  python3 check_system.py <repo> [--base origin/main] [--src frontend-react/src] [--all]
    默认只查「<base>...HEAD 的新增行 + 工作区未提交改动 + 未跟踪的新文件」——历史遗留冻结，不追究；
    --all 查全量（看遗留规模用，不作门禁）。
退出码: 0 干净；1 有越界（逐条列出 文件:行 与建议）；2 环境问题（不是 git 仓库、基础分支不存在、零件库缺失或损坏）

查什么:
  颜色    #hex（3/4/6/8 位）、rgb()/hsl()/oklch() 字面值、Tailwind 调色板类（text-red-500、bg-white…）、
          var(--x) 引用了模板、别名、定制都没有的变量（var(--x, #fff) 里的兜底色也查）
  字号    text-[Npx|Nrem]、font-size: N、内联样式 fontSize: N
  圆角    rounded(-*)-[N]、border-radius: N、borderRadius: N
  间距    p/m/gap/space/inset 一族的 -[N]（含负值、逻辑方向 ps/pe/ms/me）、padding/margin/gap: N、内联样式同名属性
不查（会漏，人工 review 兜底）: font: 简写、calc() 里的数值、JS 里拼出来的类名。
确需例外：先在零件库「定制」登记，再在行尾写 `design: <定制 id>`；豁免只对这一行生效。
"""
import argparse
import json
import os
import re
import subprocess
import sys

PACK = os.path.join("docs", "assets", "visuals", "system", "system.tokens.json")
CODE = (".tsx", ".jsx", ".ts", ".js", ".css", ".scss")
HEX = re.compile(r"(?<![\w&/])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])")
FUNC_COLOR = re.compile(r"\b(rgba?|hsla?|oklch|oklab|lab|lch)\(\s*[\d.]")
NOT_COLOR_REF = re.compile(r"""(?:href|to|xlinkHref|xlink:href)\s*=\s*\{?\s*["'`]#[\w-]*|url\(\s*["']?#[\w-]*|location\.hash|['"`]#[a-z][\w-]*['"`]\s*\)""")
PALETTE = re.compile(r"(?<![\w-])(?:[a-z0-9-]+:)*(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|fill|stroke|divide|placeholder|from|via|to|decoration|caret|accent|shadow)-"
                     r"((?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(?:/\d+)?(?![\w-])")
VAR = re.compile(r"var\((--[\w-]+)")
LEN = r"(-?\d+(?:\.\d+)?)(px|rem|em)?"
TW = re.compile(r"(?<![\w])-?(?:[a-z0-9-]+:)*-?(text|rounded(?:-[a-z]{1,2})?|p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left)-\[(?:length:)?" + LEN + r"\]")
CSS = re.compile(r"(font-size|border(?:-[\w-]+)?-radius|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|row-gap|column-gap)\s*:\s*([^;}{]+)")
JSX = re.compile(r"\b(fontSize|borderRadius|padding\w*|margin\w*|gap|rowGap|columnGap)\s*:\s*(['\"]?)([^,}'\"]+)\2")
WAIVE = re.compile(r"design:\s*([\w-]+)")


def git(repo, *args):
    r = subprocess.run(["git", "-c", "core.quotePath=false", *args], cwd=repo, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr


def die(msg):
    print("✗ " + msg)
    sys.exit(2)


def to_px(num, unit):
    v = float(num) * (16 if unit in ("rem", "em") else 1)
    return int(v) if v.is_integer() else round(v, 2)


def added_lines(repo, base, all_, src):
    keep = lambda f: f.endswith(CODE) and f.startswith(src) and "__tests__" not in f and ".test." not in f and ".spec." not in f
    out = []

    def whole(f):
        try:
            for i, t in enumerate(open(os.path.join(repo, f), encoding="utf-8", errors="ignore"), 1):
                out.append((f, i, t.rstrip("\n")))
        except OSError:
            pass

    if all_:
        code, files, err = git(repo, "ls-files")
        if code:
            die("不是 git 仓库：" + err.strip())
        for f in files.split("\n"):
            if keep(f):
                whole(f)
        return out
    code, _, err = git(repo, "rev-parse", "--verify", "--quiet", base + "^{commit}")
    if code:
        die(f"基础分支 {base} 不存在（先 git fetch，或用 --base 指定）。不能在缺基线时报「通过」。")
    code, diff1, err = git(repo, "diff", "-U0", "--no-renames", f"{base}...HEAD")
    code2, diff2, err2 = git(repo, "diff", "-U0", "--no-renames", "HEAD")
    if code or code2:
        die("git diff 失败：" + (err or err2).strip())
    seen = set()
    for diff in (diff1, diff2):
        cur, ln = None, 0
        for t in diff.split("\n"):
            if t.startswith("+++ "):
                name = t[4:]
                cur = name[2:] if name.startswith("b/") else None   # /dev/null = 删除的文件
            elif t.startswith("@@"):
                m = re.search(r"\+(\d+)", t)
                ln = int(m.group(1)) if m else 0
            elif cur and t.startswith("+") and not t.startswith("+++"):
                if keep(cur) and (cur, t) not in seen:     # 同一行同时出现在两份 diff 里只算一次
                    seen.add((cur, t))
                    out.append((cur, ln, t[1:].rstrip("\r")))
                ln += 1
    code, files, _ = git(repo, "ls-files", "--others", "--exclude-standard")
    for f in files.split("\n"):
        if keep(f):
            whole(f)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("--base", default="origin/main")
    ap.add_argument("--src", default="frontend-react/src", help="只查这个目录下的产品代码")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    try:
        spec = json.load(open(os.path.join(repo, PACK), encoding="utf-8"))
    except OSError:
        die(f"没有零件库 {PACK}")
    except ValueError as e:
        die(f"零件库 json 损坏：{e}")
    T = spec.get("template") or {}
    if not T.get("colors"):
        die("零件库还没有模板（template.colors 为空）")
    customs = [c for c in spec.get("custom") or [] if c.get("status") != "不需要"]
    custom_ids = {c["id"] for c in customs}
    ok_vars = {c["name"] for c in T["colors"]} | {k.split(" ")[-1] for k in (T.get("aliases") or {})}
    ok_vars |= {f"--t-font-{f['id']}" for f in T.get("fonts") or []} | {f"--t-space-{i + 1}" for i in range(len(T.get("space") or []))}
    ok_vars |= {f"--t-radius-{r['id']}" for r in T.get("radius") or []} | {f"--t-w-{c['id']}" for c in T.get("containers") or []}
    # 非颜色的站点变量（安全区、视口高、吸顶偏移这类布局基础设施）不是设计值，放行
    ok_vars |= {o.get("name") for o in spec.get("other_vars") or [] if o.get("kind") != "color"}
    var_prefixes = [t for c in customs for t in c.get("tokens", []) if t.startswith("--")]
    class_prefixes = [t for c in customs for t in c.get("tokens", []) if not t.startswith("--")]
    sizes = set(T.get("sizes", []))
    space = set(T.get("space", [])) | {0, 1}
    radii = {r["v"] for r in T.get("radius", [])} | {0}
    tpl_hex = {(c.get(m) or "").lower(): c["name"] for c in T["colors"] for m in ("light", "dark")}
    vis = os.path.join(repo, "docs", "assets", "visuals")
    for d in os.listdir(vis) if os.path.isdir(vis) else []:      # 页面包自己的前缀（--ai- 之类）由页面包管
        p = os.path.join(vis, d, f"{d}.tokens.json")
        if d != "system" and os.path.exists(p):
            try:
                pre = json.load(open(p, encoding="utf-8")).get("prefix")
                if pre:
                    var_prefixes.append(pre + "-")
            except (OSError, ValueError):
                pass

    hits, waived = [], []

    def length(kind, v, f, ln):
        if kind == "字号" and v not in sizes:
            hits.append((f, ln, "字号", f"{v}px", f"模板字号：{sorted(sizes)}"))
        elif kind == "圆角" and v not in radii and v < 999:
            hits.append((f, ln, "圆角", f"{v}px", f"模板圆角：{sorted(radii)}"))
        elif kind == "间距" and abs(v) not in space:
            hits.append((f, ln, "间距", f"{v}px", f"模板间距：{sorted(space)}"))

    for f, ln, t in added_lines(repo, a.base, a.all, a.src.rstrip("/") + "/"):
        if re.match(r"\s*--[\w-]+\s*:", t) and f.endswith((".css", ".scss")):
            continue   # 变量定义本身由零件库对账管
        if re.match(r"\s*(//|\*|/\*)", t):
            continue   # 注释行
        w = WAIVE.search(t)
        if w and w.group(1) in custom_ids:
            waived.append((f, ln, w.group(1), t.strip()[:90]))   # 豁免对整行生效，所以要列出来给 review 看
            continue
        scan = NOT_COLOR_REF.sub(" ", t)
        if any(p in t for p in class_prefixes):
            for p in class_prefixes:
                scan = re.sub(re.escape(p) + r"[\w/.-]*", " ", scan)
        for m in HEX.finditer(scan):
            v = "#" + m.group(1).lower()
            hits.append((f, ln, "颜色", v, f"改用 var({tpl_hex[v]})" if v in tpl_hex else "改用模板颜色，或在零件库登记定制"))
        for m in FUNC_COLOR.finditer(scan):
            hits.append((f, ln, "颜色", m.group(1) + "(…)", "改用模板颜色，或在零件库登记定制"))
        for m in PALETTE.finditer(scan):
            hits.append((f, ln, "颜色", m.group(0).split(":")[-1], "Tailwind 调色板不随模板与暗色切换；改用模板颜色"))
        for m in VAR.finditer(scan):
            n = m.group(1)
            if n in ok_vars or n.startswith("--tw-") or any(n.startswith(p) for p in var_prefixes):
                continue
            hits.append((f, ln, "变量", n, "不在模板/别名/定制里"))
        for m in TW.finditer(scan):
            kind = m.group(1)
            v = to_px(m.group(2), m.group(3))
            length("字号" if kind == "text" else "圆角" if kind.startswith("rounded") else "间距", v, f, ln)
        if f.endswith((".css", ".scss")):
            for prop, val in CSS.findall(scan):
                for num, unit in re.findall(LEN, val):
                    if unit or float(num) == 0:
                        length("字号" if prop == "font-size" else "圆角" if prop.endswith("radius") else "间距", to_px(num, unit), f, ln)
        else:
            for prop, _, val in JSX.findall(scan):
                for num, unit in re.findall(LEN, val):
                    length("字号" if prop == "fontSize" else "圆角" if prop == "borderRadius" else "间距", to_px(num, unit), f, ln)
    scope = "全量（含历史遗留）" if a.all else f"相对 {a.base} 的新增行"
    if waived:
        print(f"· 豁免 {len(waived)} 行（行尾 design: <定制 id>，整行放行；review 时逐行确认确属该定制）：")
        for f, ln, cid, txt in waived:
            print(f"    {f}:{ln}  [{cid}]  {txt}")
    if not hits:
        print(f"✓ 设计值检查通过 · {scope}")
        return
    by = {}
    for h in hits:
        by[h[2]] = by.get(h[2], 0) + 1
    print(f"✗ 设计值越界 {len(hits)} 处 · {scope} · " + " ".join(f"{k} {v}" for k, v in by.items()))
    for f, ln, kind, v, tip in hits[:200 if a.all else 1000]:
        print(f"  {f}:{ln}  {kind} {v}  → {tip}")
    if a.all and len(hits) > 200:
        print(f"  …还有 {len(hits) - 200} 处")
    print("  确需例外：先在零件库「定制」登记，再在行尾写 `design: <定制 id>`。")
    sys.exit(1)


if __name__ == "__main__":
    main()
