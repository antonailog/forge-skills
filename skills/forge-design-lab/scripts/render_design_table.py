#!/usr/bin/env python3
"""forge-design-lab · S5 把 <page>.tokens.json 渲染成 DESIGN.md 模块内的 token 表区块（带生成标记，勿手改）。

用法:
  python3 render_design_table.py <repo_root> <tokens.json> [--design docs/DESIGN.md] [--heading "## 模块 28"] [--dry-run]

规则:
  DESIGN.md 里已有 <!-- design-lab:tokens:<page> start --> … <!-- design-lab:tokens:<page> end --> → 原地替换
  没有标记但给了 --heading → 在该标题所属章节末尾（下一个同级或更高级标题之前）插入
  两者都没有 → 只打印区块到 stdout（退出码 3，提示先走 forge-design 建模块章节）
"""
import argparse
import datetime
import json
import os
import re
import sys

R_LABEL = {"pass": "通过", "change": "改", "unsure": "拿不准", "propose": "提议改动", "": ""}


def fmt(n):
    t, v = n["type"], n.get("value")
    if t == "px":
        return f"{v}px"
    if t == "ms":
        return f"{v}ms"
    if t == "colorref":
        return "transparent" if v == "transparent" else f"var(--{v})"
    if t == "check":
        return "—"
    if t == "raw":
        return f"`{v}`"
    return str(v)


def fmt_opts(n):
    o = n.get("options") or []
    if not o or n["type"] == "check":
        return ""
    unit = "px" if n["type"] == "px" else ("ms" if n["type"] == "ms" else "")
    return " / ".join(f"{x}{unit}" if n["type"] in ("px", "ms") else str(x) for x in o[:6])


def esc(s):
    return str(s).replace("|", "\\|").replace("\n", " ")


def render(spec, json_rel):
    D = spec.get("decisions") or {}
    groups = {g["key"]: g for g in spec["groups"]}
    mods = {m["key"]: m["label"] for m in spec["modules"]}
    page = spec["page"]
    when = spec.get("exported") or spec.get("updated") or datetime.date.today().isoformat()
    L = [f"<!-- design-lab:tokens:{page} start · 由 {json_rel} 生成（render_design_table.py），勿手改；改值请在工作台保存后重跑 -->",
         f"**Token 表（{spec['version']} · 工作台 {when}）** — 决策在 `{json_rel}`，前端 import `{spec['files']['css']}`；组件只写 `var()`。",
         "", "| 层 | 模块 | token | CSS 变量 | 值 | 备选 | 结局 | 说明 |", "|---|---|---|---|---|---|---|---|"]
    proposals, unsure = [], []
    for g in spec["groups"]:
        for n in [x for x in spec["nodes"] if x["g"] == g["key"]]:
            d = D.get(n["id"], {})
            r = d.get("r", "")
            note = " ".join(x for x in (n.get("note", ""), d.get("note", "")) if x)
            lock = "🔒 " if n.get("readonly") else ""
            L.append(f"| {esc(g['label'])} | {esc(mods.get(n['mod'], n['mod']))} | {lock}`{n['id']}` {esc(n['label'])} | {('`' + n['css'] + '`') if n.get('css') else ''} | {esc(fmt(n))} | {esc(fmt_opts(n))} | {R_LABEL.get(r, r)} | {esc(note)} |")
            if r == "propose":
                proposals.append((n, d))
            if r == "unsure":
                unsure.append((n, d))
    if proposals:
        L += ["", "**站点级 token 提议改动**（另走全站审查，本轮不改）", "", "| token | 当前 | 备注 |", "|---|---|---|"]
        L += [f"| `{n['id']}` {esc(n['label'])} | {esc(fmt(n))} | {esc(d.get('note', ''))} |" for n, d in proposals]
    if unsure:
        L += ["", "**拿不准（待 A/B/C）**：" + "、".join(f"`{n['id']}`" for n, _ in unsure)]
    eff = spec.get("effects") or []
    if eff:
        L += ["", "**非变量决策（effects）**：" + "；".join(f"`{e['node']}` = {e.get('eq', '≠' + str(e.get('neq', '')))} → `.{e['cls']}`" for e in eff)]
    fb = spec.get("feedback") or []
    if fb:
        L += ["", f"**待回反馈**：{len(fb)} 条（见 json.feedback）"]
    L.append(f"<!-- design-lab:tokens:{page} end -->")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("spec")
    ap.add_argument("--design", default="docs/DESIGN.md")
    ap.add_argument("--heading", help='插入位置的标题行前缀，如 "## 模块 28" 或 "### 28.10"')
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    spath = a.spec if os.path.isabs(a.spec) else os.path.join(repo, a.spec)
    spec = json.load(open(spath, encoding="utf-8"))
    json_rel = os.path.relpath(spath, repo).replace(os.sep, "/")
    block = render(spec, json_rel)
    dpath = a.design if os.path.isabs(a.design) else os.path.join(repo, a.design)
    if not os.path.exists(dpath):
        print(block)
        print(f"\n✗ 找不到 {a.design}；只打印了区块", file=sys.stderr)
        sys.exit(3)
    text = open(dpath, encoding="utf-8").read()
    page = spec["page"]
    m = re.search(rf"<!-- design-lab:tokens:{re.escape(page)} start.*?<!-- design-lab:tokens:{re.escape(page)} end -->", text, flags=re.S)
    if m:
        new = text[:m.start()] + block + text[m.end():]
        where = f"原地替换（第 {text[:m.start()].count(chr(10)) + 1} 行起）"
    elif a.heading:
        lines = text.split("\n")
        idx = next((i for i, l in enumerate(lines) if l.strip().startswith(a.heading.strip())), None)
        if idx is None:
            print(block)
            print(f"\n✗ {a.design} 里找不到标题 {a.heading!r}；只打印了区块。先走 forge-design 建模块章节。", file=sys.stderr)
            sys.exit(3)
        level = len(lines[idx]) - len(lines[idx].lstrip("#"))
        end = next((i for i in range(idx + 1, len(lines)) if re.match(r"^#{1,%d}\s" % level, lines[i])), len(lines))
        while end > idx + 1 and not lines[end - 1].strip():
            end -= 1
        lines[end:end] = ["", block, ""]
        new = "\n".join(lines)
        where = f"插入到 {a.heading!r} 章节末尾（第 {end + 2} 行）"
    else:
        print(block)
        print("\n= 没有标记也没给 --heading，只打印了区块", file=sys.stderr)
        sys.exit(3)
    if a.dry_run:
        print(block)
        print(f"\n[dry-run] 将 {where} 写入 {a.design}")
        return
    open(dpath, "w", encoding="utf-8").write(new)
    print(f"✓ {a.design}：{where}，{sum(1 for n in spec['nodes'])} 个节点")


if __name__ == "__main__":
    main()
