#!/usr/bin/env python3
"""forge-design-lab · 守门检查：新增代码里不准出现模板和定制清单以外的设计值。

用法:
  python3 check_system.py <repo> [--base origin/main] [--all]
    默认只查 <base>...HEAD 加上工作区未提交的「新增行」——历史遗留冻结，不追究；
    --all 查全量（看遗留规模用，不作为门禁）。
退出码: 0 干净；1 有越界（逐条列出文件:行与建议）；2 零件库不存在

查四类:
  颜色  #hex 写死；var(--x) 引用了既不在模板、别名，也不在已确认/待确认定制里的变量
  字号  text-[Npx] / font-size: Npx，N 不在模板字号阶梯
  圆角  rounded-[Npx] / border-radius: Npx，N 不在模板圆角
  间距  p/m/gap-[Npx] / padding|margin|gap: Npx，N 不在模板间距阶梯
确需例外：行尾写注释 `design: <定制 id>`（必须是定制清单里的 id），或先在零件库登记定制。
"""
import argparse
import json
import os
import re
import subprocess
import sys

PACK = os.path.join("docs", "assets", "visuals", "system", "system.tokens.json")
CODE = (".tsx", ".jsx", ".ts", ".css")
HEX = re.compile(r"(?<![\w&])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w])")
VAR = re.compile(r"var\((--[\w-]+)")
TW_PX = re.compile(r"(?<![\w-])(?:[a-z-]+:)*(text|rounded(?:-[trbl]{1,2})?|p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|space-[xy])-\[(\d+(?:\.\d+)?)px\]")
CSS_PX = re.compile(r"(font-size|border-radius|padding(?:-\w+)?|margin(?:-\w+)?|gap|row-gap|column-gap)\s*:\s*([^;}{]+)")
WAIVE = re.compile(r"design:\s*([\w-]+)")


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True).stdout


def added_lines(repo, base, all_, src):
    """返回 [(file, line_no, text)]。"""
    out = []
    if all_:
        files = git(repo, "ls-files").split("\n")
        for f in files:
            if f.endswith(CODE) and f.startswith(src) and "__tests__" not in f and ".test." not in f:
                try:
                    for i, t in enumerate(open(os.path.join(repo, f), encoding="utf-8", errors="ignore"), 1):
                        out.append((f, i, t.rstrip("\n")))
                except OSError:
                    pass
        return out
    diff = git(repo, "diff", "-U0", f"{base}...HEAD") + git(repo, "diff", "-U0", "HEAD")
    cur, ln = None, 0
    for t in diff.split("\n"):
        if t.startswith("+++ "):
            cur = t[6:] if t.startswith("+++ b/") else None
        elif t.startswith("@@"):
            m = re.search(r"\+(\d+)", t)
            ln = int(m.group(1)) if m else 0
        elif cur and t.startswith("+") and not t.startswith("+++"):
            if cur.endswith(CODE) and cur.startswith(src) and "__tests__" not in cur and ".test." not in cur:
                out.append((cur, ln, t[1:]))
            ln += 1
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("--base", default="origin/main")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--src", default="frontend-react/src", help="只查这个目录下的产品代码")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    try:
        spec = json.load(open(os.path.join(repo, PACK), encoding="utf-8"))
    except OSError:
        print("✗ 没有零件库", PACK)
        sys.exit(2)
    T = spec.get("template") or {}
    customs = [c for c in spec.get("custom") or [] if c.get("status") != "不需要"]
    custom_ids = {c["id"] for c in customs}
    ok_vars = {c["name"] for c in T.get("colors", [])} | {k.split(" ")[-1] for k in (T.get("aliases") or {})}
    ok_vars |= {f"--t-{x}" for x in ("font-sans", "font-serif", "font-mono")}
    prefixes = [t for c in customs for t in c.get("tokens", []) if t.startswith("--")]
    sizes, space = set(T.get("sizes", [])), set(T.get("space", [])) | {0, 1}
    radii = {r["v"] for r in T.get("radius", [])} | {0}
    tpl_hex = {(c.get(m) or "").lower(): c["name"] for c in T.get("colors", []) for m in ("light", "dark")}
    # 页面包自己的 token（--ai- 这类）由页面包管，不在这里拦
    page_prefixes = []
    vis = os.path.join(repo, "docs", "assets", "visuals")
    for d in os.listdir(vis) if os.path.isdir(vis) else []:
        p = os.path.join(vis, d, f"{d}.tokens.json")
        if d != "system" and os.path.exists(p):
            try:
                pre = json.load(open(p, encoding="utf-8")).get("prefix")
                if pre:
                    page_prefixes.append(pre + "-")
            except (OSError, ValueError):
                pass

    hits = []
    for f, ln, t in added_lines(repo, a.base, a.all, a.src.rstrip("/") + "/"):
        if f.endswith("globals.css") and re.match(r"\s*--[\w-]+\s*:", t):
            continue   # 变量定义本身由零件库对账管，不在门禁里重复报
        w = WAIVE.search(t)
        if w and w.group(1) in custom_ids:
            continue
        for m in HEX.finditer(t):
            v = "#" + m.group(1).lower()
            hits.append((f, ln, "颜色", v, f"改用 var({tpl_hex[v]})" if v in tpl_hex else "改用模板颜色，或在零件库登记定制"))
        for m in VAR.finditer(t):
            n = m.group(1)
            if n in ok_vars or n.startswith("--tw-") or any(n.startswith(p) for p in prefixes + page_prefixes):
                continue
            hits.append((f, ln, "颜色变量", n, "不在模板/定制里"))
        for m in TW_PX.finditer(t):
            kind, v = m.group(1), float(m.group(2))
            v = int(v) if v.is_integer() else v
            if kind == "text" and v not in sizes:
                hits.append((f, ln, "字号", f"{v}px", f"模板字号：{sorted(sizes)}"))
            elif kind.startswith("rounded") and v not in radii:
                hits.append((f, ln, "圆角", f"{v}px", f"模板圆角：{sorted(radii)}"))
            elif not kind.startswith(("text", "rounded")) and v not in space:
                hits.append((f, ln, "间距", f"{v}px", f"模板间距：{sorted(space)}"))
        if f.endswith(".css"):
            for prop, val in CSS_PX.findall(t):
                for px in re.findall(r"(\d+(?:\.\d+)?)px", val):
                    v = float(px); v = int(v) if v.is_integer() else v
                    if prop == "font-size" and v not in sizes:
                        hits.append((f, ln, "字号", f"{v}px", f"模板字号：{sorted(sizes)}"))
                    elif prop == "border-radius" and v not in radii:
                        hits.append((f, ln, "圆角", f"{v}px", f"模板圆角：{sorted(radii)}"))
                    elif prop not in ("font-size", "border-radius") and v not in space:
                        hits.append((f, ln, "间距", f"{v}px", f"模板间距：{sorted(space)}"))
    scope = "全量（含历史遗留）" if a.all else f"相对 {a.base} 的新增行"
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
