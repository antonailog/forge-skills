#!/usr/bin/env python3
"""forge-design-lab · 把零件库页面上的值改动（edits）同步进产品 CSS。

用法:
  python3 apply_system.py <repo>            只报告会改哪几行（默认）
  python3 apply_system.py <repo> --apply    写进 css_source，清空 edits，重新抽取

能同步的两类:
  color:<id>  颜色变量的亮色/暗色值 → 改 globals.css 里该变量定义所在的那一行
  role:<id>   文字角色的字号/行高/字重 → 改该类声明块里对应的那一条
按行号定位，再核对这一行确实是那个变量/那条声明；对不上（代码在抽取之后被改过）就整体中止，
让你先重跑 extract_system.py，不做模糊替换。
"""
import argparse
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.join("docs", "assets", "visuals", "system", "system.tokens.json")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    jpath = os.path.join(repo, PACK)
    with open(jpath, encoding="utf-8") as fh:
        spec = json.load(fh)
    edits = spec.get("edits") or {}
    if not edits:
        print("· 没有待同步的值改动")
        return
    css_rel = spec["files"]["css_source"]
    css_path = os.path.join(repo, css_rel)
    with open(css_path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")
    colors = {c["id"]: c for c in spec.get("colors") or []}
    roles = {r["id"]: r for r in spec.get("text_roles") or []}
    plan, errs = [], []

    def set_line(ln, pattern, repl, what):
        i = ln - 1
        if i < 0 or i >= len(lines) or not re.search(pattern, lines[i]):
            errs.append(f"{what}：第 {ln} 行对不上（{lines[i].strip()[:60] if 0 <= i < len(lines) else '越界'}）")
            return
        new = re.sub(pattern, repl, lines[i], count=1)
        plan.append((ln, lines[i], new, what))
        lines[i] = new

    for key, e in edits.items():
        kind, _, ident = key.partition(":")
        if kind == "color":
            c = colors.get(ident)
            if not c:
                errs.append(f"{key}：零件库里没有这个颜色")
                continue
            name = re.escape(c["name"])
            for mode, ln in (("light", c.get("line")), ("dark", c.get("dark_line"))):
                if e.get(mode):
                    if not ln:
                        errs.append(f"{key}：没有{'亮' if mode == 'light' else '暗'}色定义行，不能只改值，需要新增定义（请人工处理）")
                        continue
                    set_line(ln, rf"({name}\s*:\s*)[^;]+;", rf"\g<1>{e[mode]};", f"{c['name']} {'亮' if mode == 'light' else '暗'}色")
        elif kind == "role":
            r = roles.get(ident)
            if not r:
                errs.append(f"{key}：零件库里没有这个文字角色")
                continue
            # 角色块从 r.line 开始，到下一个 } 为止
            start = r["line"] - 1
            end = next((k for k in range(start, min(start + 40, len(lines))) if "}" in lines[k]), start)
            for prop, field, unit in (("font-size", "size", "px"), ("line-height", "lh", ""), ("font-weight", "weight", "")):
                if field not in e:
                    continue
                k = next((k for k in range(start, end + 1) if re.search(rf"^\s*{prop}\s*:", lines[k])), None)
                if k is None:
                    errs.append(f".{ident} 没有 {prop} 声明，不能只改值（请人工处理）")
                    continue
                set_line(k + 1, rf"({prop}\s*:\s*)[^;]+;", rf"\g<1>{e[field]}{unit};", f".{ident} {prop}")
        else:
            errs.append(f"{key}：不认识的改动类型")

    for ln, old, new, what in plan:
        print(f"  {css_rel}:{ln}  {what}\n    - {old.strip()}\n    + {new.strip()}")
    if errs:
        print("✗ 有对不上的地方，整体中止，一行都不写：")
        for x in errs:
            print("   ", x)
        print("  先重跑 extract_system.py 刷新行号；值改动保存在 edits 里，不会丢。")
        sys.exit(2)
    if not a.apply:
        print(f"· 共 {len(plan)} 行，加 --apply 写入")
        return
    with open(css_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    spec["edits"] = {}
    with open(jpath, "w", encoding="utf-8") as fh:
        json.dump(spec, fh, ensure_ascii=False, indent=1)
    print(f"✓ 写入 {len(plan)} 行到 {css_rel}，已清空 edits；重新抽取：")
    subprocess.run([sys.executable, os.path.join(HERE, "extract_system.py"), repo, "--product-css"], check=False)


if __name__ == "__main__":
    main()
