#!/usr/bin/env python3
"""forge-design-lab · 由 <page>.tokens.json 生成工作台加载的 .tokens.js 与前端 import 的 .tokens.css（幂等）。

用法:
  python3 build_tokens.py <repo_root> <tokens.json（绝对或仓库相对）> [--check]

--check  只校验 json 并比对磁盘上已有的 js/css 是否与 json 同源，不写文件
退出码:  0 正常 · 1 json 结构校验失败 · 2 --check 发现 js/css 与 json 不同源

输出格式与引擎「保存」写出的逐字节一致（js: 头注释 + window.WB_SPEC=…; css: 头注释 + :root{ … }），
所以用户在工作台保存后跑 --check 能判断三件是否同源。
"""
import json
import os
import sys

TYPES = {"px", "ms", "num", "enum", "colorref", "color", "family", "check", "raw"}
GROUP_KEYS = ["structure", "hierarchy", "type", "color", "space", "motion", "consistency"]


def norm(v):
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def css_val(n):
    t, v = n["type"], n.get("value")
    if t == "px":
        return f"{v}px"
    if t == "ms":
        return f"{v}ms"
    if t == "num":
        return f"{v}"
    if t == "colorref":
        return "transparent" if v == "transparent" else f"var(--{v})"
    if t in ("color", "raw"):
        return str(v)
    return None


def validate(spec):
    errs, warns = [], []
    need = ["version", "page", "files", "levels", "states", "viewports", "groups", "modules", "nodes"]
    for k in need:
        if k not in spec:
            errs.append(f"缺少顶层字段 {k}")
    if errs:
        return errs, warns
    if spec.get("schemaVersion") != 1:
        warns.append("schemaVersion 不是 1（旧文件请补 \"schemaVersion\": 1）")
    for k in ("json", "js", "css"):
        if not (spec["files"] or {}).get(k):
            errs.append(f"files.{k} 缺失")
    prefix = spec.get("prefix")
    if not prefix:
        warns.append("缺少 prefix（页面 token 前缀，如 --ai）；无法校验 css 变量名是否越界")
    if not any(l.get("states") for l in spec["levels"]):
        warns.append("没有任何 levels[].states=true 的层；状态按钮将全部禁用")
    if spec["viewports"] and spec["viewports"][0].get("key") != "follow":
        warns.append("viewports[0] 不是 follow；工作台默认应跟随窗口")
    gkeys = [g["key"] for g in spec["groups"]]
    if gkeys != GROUP_KEYS:
        warns.append(f"groups 顺序/键与七层约定不同：{gkeys}")
    mkeys = {m["key"] for m in spec["modules"]}
    ids, csss = set(), {}
    light = (spec.get("foundation") or {}).get("light") or {}
    for n in spec["nodes"]:
        nid = n.get("id", "?")
        if nid in ids:
            errs.append(f"节点 id 重复：{nid}")
        ids.add(nid)
        for k in ("g", "mod", "label", "type"):
            if k not in n:
                errs.append(f"{nid} 缺字段 {k}")
        if n.get("type") not in TYPES:
            errs.append(f"{nid} type 非法：{n.get('type')}")
        if n.get("g") not in gkeys:
            errs.append(f"{nid} 所属层 {n.get('g')} 不在 groups")
        if n.get("mod") not in mkeys:
            errs.append(f"{nid} 所属模块 {n.get('mod')} 不在 modules")
        c = n.get("css")
        if c:
            if not c.startswith("--"):
                errs.append(f"{nid} css 变量名须以 -- 开头：{c}")
            elif prefix and not c.startswith(prefix + "-"):
                errs.append(f"{nid} css 变量 {c} 不以 {prefix}- 开头")
            if c in csss:
                errs.append(f"css 变量重复：{c}（{csss[c]} 与 {nid}）")
            csss[c] = nid
            if css_val(n) is None:
                errs.append(f"{nid} type={n['type']} 不产生 css 值，却写了 css={c}")
            if not n.get("maps") and not n.get("readonly"):
                warns.append(f"{nid} 有 css 但没有 maps，用户点不到它")
        elif n.get("type") in ("px", "ms", "color", "colorref", "raw") and not n.get("readonly"):
            warns.append(f"{nid} 是 {n['type']} 型可改节点却没有 css，改了骨架不会变")
        if n.get("type") == "enum" and not n.get("options"):
            errs.append(f"{nid} enum 缺 options")
        if n.get("type") == "colorref":
            v = n.get("value")
            if v != "transparent" and v not in light:
                warns.append(f"{nid} colorref 值 {v} 不在 foundation.light 里，色块会显示为黑")
        if n.get("view") and n["view"].get("level") and n["view"]["level"] not in {l["key"] for l in spec["levels"]}:
            errs.append(f"{nid} view.level {n['view']['level']} 不在 levels")
    for e in spec.get("effects") or []:
        if e.get("node") not in ids:
            errs.append(f"effects 引用了不存在的节点 {e.get('node')}")
        if not e.get("cls"):
            errs.append(f"effects {e.get('node')} 缺 cls")
    mb = spec.get("mobileBelow")
    if mb and mb not in ids:
        errs.append(f"mobileBelow 引用了不存在的节点 {mb}")
    lids = {r.get("id") for r in spec.get("layout") or []}
    for r in spec.get("layout") or []:
        if r.get("parent") and r["parent"] not in lids:
            errs.append(f"layout {r.get('id')} 的 parent {r['parent']} 不存在")
    for did in (spec.get("decisions") or {}):
        if did not in ids:
            warns.append(f"decisions 里有已不存在的节点 {did}")
    return errs, warns


def build_js(spec):
    name = spec["files"]["json"].split("/")[-1]
    return "// 由 " + name + " 生成，勿手改\nwindow.WB_SPEC=" + json.dumps(spec, ensure_ascii=False, indent=1) + ";\n"


def build_css(spec):
    lines = [
        "/* 由 " + spec["files"]["json"] + " 生成（工作台「保存」或 build_tokens.py），勿手改。",
        " * " + (spec.get("title") or spec["page"]) + " " + spec["version"] + " 页面级与组件级 token。站点基础 token 只引用 var(--…)，值在站点全局样式。",
        " * 工作台与前端组件读的是同一个文件。 */",
        ":root{",
    ]
    for n in spec["nodes"]:
        if n.get("css") and css_val(n) is not None:
            lines.append(f"  {n['css']}: {css_val(n)}; /* {n['label']} */")
    return "\n".join(lines + ["}", ""])


def main():
    argv = [x for x in sys.argv[1:] if x != "--check"]
    check = "--check" in sys.argv
    if len(argv) != 2:
        print(__doc__)
        sys.exit(64)
    repo = os.path.abspath(argv[0])
    jpath = argv[1] if os.path.isabs(argv[1]) else os.path.join(repo, argv[1])
    with open(jpath, encoding="utf-8") as fh:
        spec = json.load(fh)
    for n in spec.get("nodes", []):
        n["value"] = norm(n.get("value"))
        if n.get("options"):
            n["options"] = [norm(o) for o in n["options"]]
    errs, warns = validate(spec)
    for w in warns:
        print("⚠", w)
    if errs:
        for e in errs:
            print("✗", e)
        print(f"json 校验失败：{len(errs)} 处")
        sys.exit(1)
    files = spec["files"]
    js, css = build_js(spec), build_css(spec)
    nvars = sum(1 for n in spec["nodes"] if n.get("css") and css_val(n) is not None)
    if check:
        bad = []
        pj = os.path.join(repo, files["js"])
        pc = os.path.join(repo, files["css"])
        if not os.path.exists(pj):
            bad.append(f"{files['js']} 不存在")
        else:
            t = open(pj, encoding="utf-8").read()
            try:
                got = json.loads(t[t.index("{"):t.rindex("}") + 1])
                exp = json.loads(json.dumps(spec))
                if got != exp:
                    diff = [k for k in set(got) | set(exp) if got.get(k) != exp.get(k)]
                    bad.append(f"{files['js']} 内嵌 spec 与 json 不同（顶层差异字段：{', '.join(sorted(diff))[:200]}）")
            except (ValueError, json.JSONDecodeError) as e:
                bad.append(f"{files['js']} 无法解析：{e}")
        if not os.path.exists(pc):
            bad.append(f"{files['css']} 不存在")
        else:
            got = open(pc, encoding="utf-8").read()
            if [l.rstrip() for l in got.strip().splitlines()] != [l.rstrip() for l in css.strip().splitlines()]:
                gv = {l.split(":")[0].strip(): l.split(":", 1)[1].split(";")[0].strip() for l in got.splitlines() if l.strip().startswith("--")}
                ev = {l.split(":")[0].strip(): l.split(":", 1)[1].split(";")[0].strip() for l in css.splitlines() if l.strip().startswith("--")}
                dv = [f"{k}: 文件={gv.get(k)} json={ev.get(k)}" for k in sorted(set(gv) | set(ev)) if gv.get(k) != ev.get(k)]
                bad.append(f"{files['css']} 与 json 不同源：变量差异 {len(dv)} 处" + ("：\n    " + "\n    ".join(dv[:12]) if dv else "（仅头注释/格式不同，重跑 build 即可）"))
        if bad:
            for b in bad:
                print("✗", b)
            sys.exit(2)
        print(f"✓ 同源：{files['js']} 与 {files['css']}（{nvars} 个变量）与 json 一致；节点 {len(spec['nodes'])}，警告 {len(warns)}")
        return
    for rel, text in ((files["js"], js), (files["css"], css)):
        p = os.path.join(repo, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(text)
    print(f"✓ 已写 {files['js']} 与 {files['css']}：{nvars} 个变量，节点 {len(spec['nodes'])}，警告 {len(warns)}")


if __name__ == "__main__":
    main()
