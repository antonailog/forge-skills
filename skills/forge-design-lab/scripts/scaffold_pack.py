#!/usr/bin/env python3
"""forge-design-lab · S2 从 <page>.tokens.json 生成页面包壳（HTML + meta.json），并同步引擎到项目。

用法:
  python3 scaffold_pack.py <repo_root> <tokens.json> [--adapt <adapt.json>] [--sample <样例数据 json>]
                           [--out <html 路径>] [--date YYYY-MM-DD] [--engine-src <dir>] [--template <file>] [--force]

做什么:
  1. 把引擎母本（默认 design-studio 的 web/lab/workbench/）同步到 <repo>/docs/assets/visuals/_workbench/（整文件覆盖，有差异会提示）
  2. 按模板生成 docs/assets/visuals/<page>/<date>-skeleton-<version>.html：
     引擎与 tokens.css 的相对路径、站点变量复刻（来自 adapt.json 或 spec.foundation）、Google Fonts 链接、
     各层 .lvl 容器、状态显隐规则、样例数据占位、WB.init hooks 模板
  3. 写同名 .meta.json
已存在的 html 不覆盖（--force 才覆盖）。之后：在 @lab:component 段写组件 CSS，在 .lvl 里写骨架片段，跑 verify_pack.mjs。
"""
import argparse
import datetime
import filecmp
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import _design_studio as DS  # noqa: E402  引擎和页面包模板的母本在 design-studio 的 web/lab/


def rel(target, start_dir):
    return os.path.relpath(target, start_dir).replace(os.sep, "/")


def foundation_css(adapt, spec):
    light, dark = {}, {}
    if adapt:
        light, dark = adapt.get("vars", {}).get("light", {}), adapt.get("vars", {}).get("dark", {})
    if not light:
        light = {"--" + k: v for k, v in (spec.get("foundation") or {}).get("light", {}).items()}
        dark = {"--" + k: v for k, v in (spec.get("foundation") or {}).get("dark", {}).items()}

    def block(sel, d):
        if not d:
            return f"{sel}{{}}"
        items = [f"{k}:{v}" for k, v in d.items()]
        rows, row = [], []
        for it in items:
            row.append(it)
            if sum(len(x) for x in row) > 140:
                rows.append(";".join(row))
                row = []
        if row:
            rows.append(";".join(row))
        return sel + "{" + ";\n  ".join(rows) + "}"

    return block(":root", light) + "\n" + block("html.dark", dark)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("spec")
    ap.add_argument("--adapt")
    ap.add_argument("--sample")
    ap.add_argument("--out")
    ap.add_argument("--date", default=datetime.date.today().isoformat())
    ap.add_argument("--engine-src", help="引擎母本目录，默认 design-studio 的 web/lab/workbench")
    ap.add_argument("--template", help="页面包模板，默认 design-studio 的 web/lab/page-pack-template.html")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    a.engine_src = a.engine_src or DS.asset("workbench")          # 解析完再找 design-studio：--help 和显式给了路径时不要求装它
    a.template = a.template or DS.asset("page-pack-template.html")
    repo = os.path.abspath(a.repo)
    spath = a.spec if os.path.isabs(a.spec) else os.path.join(repo, a.spec)
    spec = json.load(open(spath, encoding="utf-8"))
    adapt = json.load(open(a.adapt if os.path.isabs(a.adapt) else os.path.join(repo, a.adapt), encoding="utf-8")) if a.adapt else None
    if not adapt:
        guess = os.path.join(os.path.dirname(spath), f"{spec['page']}.adapt.json")
        if os.path.exists(guess):
            adapt = json.load(open(guess, encoding="utf-8"))
            print(f"= 自动使用 {rel(guess, repo)}")

    # 1. 引擎同步
    eng_dst = os.path.join(repo, "docs", "assets", "visuals", "_workbench")
    os.makedirs(eng_dst, exist_ok=True)
    for f in ("workbench.js", "workbench.css"):
        src, dst = os.path.join(a.engine_src, f), os.path.join(eng_dst, f)
        if not os.path.exists(src):
            print(f"✗ 引擎母本缺 {src}")
            sys.exit(1)
        if os.path.exists(dst) and filecmp.cmp(src, dst, shallow=False):
            continue
        shutil.copyfile(src, dst)
        print(f"→ 引擎 {'更新' if os.path.exists(dst) else '安装'}：{rel(dst, repo)}")
    readme = os.path.join(eng_dst, "README.md")
    if not os.path.exists(readme):
        open(readme, "w", encoding="utf-8").write(
            "# 设计工作台引擎（项目副本）\n\n母本在 design-studio 的 `web/lab/workbench/`；由 forge-design-lab 的 `scaffold_pack.py` 同步，不要在这里改。\n"
            "页面包 = `docs/assets/visuals/<page>/`：`<page>.tokens.json`（决策树）→ `<page>.tokens.js`（本页加载）+ 前端 `<page>.tokens.css`（组件 import）；"
            "`<date>-skeleton-<ver>.html` 只含骨架、组件 CSS（只写 var()）、样例、hooks。\n")

    # 2. HTML
    page_dir = os.path.dirname(spath)
    html = a.out or os.path.join(page_dir, f"{a.date}-skeleton-{spec['version']}.html")
    html = html if os.path.isabs(html) else os.path.join(repo, html)
    if os.path.exists(html) and not a.force:
        print(f"= 已存在，不覆盖（--force 覆盖）：{rel(html, repo)}")
        sys.exit(0)
    html_dir = os.path.dirname(html)
    os.makedirs(html_dir, exist_ok=True)
    tpl = open(a.template, encoding="utf-8").read()
    prefix = spec.get("prefix") or "--pg"
    levels = spec["levels"]
    states_level = next((l for l in levels if l.get("states")), None)
    fonts_google = (adapt or {}).get("fonts", {}).get("google", []) if adapt else []
    font_links = ""
    if fonts_google:
        fam = "&".join("family=" + f.replace(" ", "+") + ":wght@400;500;600;700" for f in fonts_google[:4])
        font_links = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                      f'<link href="https://fonts.googleapis.com/css2?{fam}&display=swap" rel="stylesheet">')
    else:
        font_links = "<!-- 项目未用 Google Fonts；如产品自托管字体，骨架用系统回退，面板会标「字体 ✗ 回退」 -->"
    font_checks = json.dumps([f'16px "{f}"' for f in fonts_google[:2]], ensure_ascii=False)
    level_rules = ",".join(f"#frame[data-level={l['key']}] .{l['key']}" for l in levels) + "{display:block}"
    state_rules = ""
    if states_level:
        state_rules = ".st{display:none}\n" + "\n".join(f"#frame[data-state={s['key']}] .st.{s['key']}{{display:block}}" for s in spec["states"])
    level_divs = []
    for l in levels:
        if l["key"] == "wire":
            level_divs.append('  <div class="lvl wire"></div>  <!-- 引擎按 layout 自动画 -->')
        else:
            hint = "带状态的层：每个状态一个 .st.<state> 容器，切换靠 CSS" if l.get("states") else "TODO 骨架片段"
            level_divs.append(f'  <div class="lvl {l["key"]}">\n    <!-- {l["label"]} · {hint}；可点元素加 data-id="编号"（登进 elementIds） -->\n  </div>')
    sample = "{}"
    if a.sample:
        sp = a.sample if os.path.isabs(a.sample) else os.path.join(repo, a.sample)
        sample = json.dumps(json.load(open(sp, encoding="utf-8")), ensure_ascii=False)
    css_abs = os.path.join(repo, spec["files"]["css"])
    js_abs = os.path.join(repo, spec["files"]["js"])
    fill = {
        "{{TITLE}}": spec.get("title") or spec["page"],
        "{{ENGINE_REL}}": rel(eng_dst, html_dir),
        "{{JSON_REL}}": spec["files"]["json"],
        "{{JS_NAME}}": rel(js_abs, html_dir),
        "{{CSS_REL}}": rel(css_abs, html_dir),
        "{{CSS_REPO}}": spec["files"]["css"],
        "{{PREFIX}}": prefix,
        "{{FONT_LINKS}}": font_links,
        "{{FONT_CHECKS}}": font_checks,
        "{{FOUNDATION_CSS}}": foundation_css(adapt, spec),
        "{{LEVEL_RULES}}": level_rules,
        "{{STATE_RULES}}": state_rules,
        "{{LEVEL_DIVS}}": "\n".join(level_divs),
        "{{SAMPLE_JSON}}": sample,
    }
    for k, v in fill.items():
        tpl = tpl.replace(k, v)
    open(html, "w", encoding="utf-8").write(tpl)
    meta = {
        "type": "forge-design-lab page pack (engine + page)",
        "page": spec["page"], "version": spec["version"], "created": a.date, "status": "scaffold",
        "single_source": {"spec": spec["files"]["json"], "js": spec["files"]["js"], "css": spec["files"]["css"],
                          "guarantee": "本页 <link> 的就是前端 import 的 css；组件 CSS 只写 var(" + prefix + "-*)；verify_pack.mjs 做同源与字面值检查"},
        "engine": rel(eng_dst, repo) + "（母本：design-studio/web/lab/workbench）",
        "sample_content": "占位" if sample == "{}" else "来自 " + a.sample,
        "next": ["S2 线框确认：打开页面切「线框」层", "S3 在 @lab:component 段写组件 CSS、在 .lvl 里写骨架、补七层节点", "node verify_pack.mjs 零错误后交用户"],
    }
    open(html[:-5] + ".meta.json", "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    print(f"→ 已写 {rel(html, repo)} 与 .meta.json")
    if not os.path.exists(js_abs):
        print(f"⚠ {spec['files']['js']} 尚不存在：先跑 build_tokens.py")
    print(f"打开：open '{html}'\n验收：node '{os.path.join(HERE, 'verify_pack.mjs')}' '{html}' --repo '{repo}'")


if __name__ == "__main__":
    main()
