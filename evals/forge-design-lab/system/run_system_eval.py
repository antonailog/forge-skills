#!/usr/bin/env python3
"""零件库（S0）回归评测：在临时假项目上跑抽取 / 生成器 / 守门 / 保存合并 / 适配，逐项断言。

用法: python3 evals/forge-design-lab/system/run_system_eval.py [--keep]
每条断言都有「坏样本必须报错」的对照（踩坑 #18：静默常绿的检查比没有检查更糟）。
退出码：全部通过 0，否则 1。
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.abspath(os.path.join(HERE, "..", "..", "..", "skills", "forge-design-lab"))
S = os.path.join(LAB, "scripts")
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    print(("  ✓ " if ok else "  ✗ ") + name + (f" · {detail}" if detail and not ok else ""))


def run(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def write(root, rel, text):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(text)


GLOBALS = """@tailwind base;
@layer base {
  :root {
    --background: #F4F3EF;
    --foreground: #1A1917;
    --border: #E4E2DC;
    --brand: #C65A1E; /* 品牌暖铜 */
    --primary: var(--brand);
    --modal-surface: #FAF8F5;
    --legacy-pink: #FF00AA;
    --radius: 0.625rem;
  }
  .dark {
    --background: #181611;
    --foreground: #ECE4D8;
    --border: #39342B;
    --brand: #F0A273;
    --modal-surface: #211E18;
  }
}
.reading-body { font-family: theme('fontFamily.serif'); font-size: 16px; line-height: 1.75; font-weight: 400; color: var(--foreground); }
.reading-strong { font-family: theme('fontFamily.serif'); font-size: 16px; font-weight: bold; }
/* --old-brand: #FF0000; 已废弃 */
:root.dark { --card: #211E18; }
:root { --card: #FFFFFF; }
@media (prefers-color-scheme: dark) { :root { --muted: #25211B; } }
:root { --muted: #F2F1ED; }
[data-theme="dark"] { --ink-2: #C8BBAA; }
:root { --ink-2: #54524C; }
:root, .light { --line: #E4E2DC; }
"""
TW = """export default { theme: { extend: {
  fontFamily: { sans: ['Inter', 'sans-serif'], serif: ['Noto Serif SC', 'serif'] },
  colors: { background: 'var(--background)', foreground: 'var(--foreground)', border: 'var(--border)', primary: { DEFAULT: 'var(--primary)' } }
} } }
"""
APP = """export function A() {
  return <div className="bg-background text-foreground">
    <button className="rounded-[4px] bg-[var(--brand)] px-4 py-2 text-[14px] font-semibold text-white">保存</button>
    <button className="rounded-[4px] border border-border px-4 py-2 text-[13px] text-foreground hover:border-[var(--brand)]">重试</button>
    <button className={cn("h-8 w-8 rounded-[4px] text-foreground", on && "bg-background")}>x</button>
    <span style={{ color: '#C65A1E' }}>x</span>
    <button className="rounded-[4px] bg-primary/10 px-3 py-1 text-[13px] text-primary">浅底</button>
    <button className="rounded-[4px] border-2 border-primary px-3 py-1 text-[13px] text-primary">粗描边</button>
    <button className="rounded-[4px] bg-primary/90 px-3 py-1 text-[13px] text-white">九成实心</button>
  </div>
}
"""
TEMPLATE = {
    "version": "eval", "colors": [
        {"name": "--background", "group": "底色", "role": "底", "light": "#F4F3EF", "dark": "#181611"},
        {"name": "--foreground", "group": "文字", "role": "墨", "light": "#1A1917", "dark": "#ECE4D8"},
        {"name": "--border", "group": "底色", "role": "线", "light": "#E4E2DC", "dark": "#39342B"},
        {"name": "--brand", "group": "品牌", "role": "品牌", "light": "#C65A1E", "dark": "#F0A273"},
        {"name": "--brand-foreground", "group": "品牌", "role": "品牌上的字", "light": "#FFFFFF", "dark": "#1F1713"}],
    "aliases": {"--primary": "--brand"},
    "fonts": [{"id": "sans", "label": "无衬线", "stack": ["Inter", "sans-serif"]}, {"id": "serif", "label": "衬线", "stack": ["Noto Serif SC", "serif"]}],
    "sizes": [12, 13, 14, 16, 20], "space": [4, 8, 12, 16, 24],
    "type": [{"id": "body", "label": "正文", "font": "serif", "size": 16, "lh": 1.75, "weight": 400, "color": "--foreground"}],
    "radius": [{"id": "sm", "v": 4}, {"id": "full", "v": 999}],
    "containers": [{"id": "page", "v": 1200}],
    "buttons": [{"id": "primary", "label": "主按钮", "h": 36, "px": 16, "size": 14, "weight": 600, "radius": "sm", "bg": "--brand", "fg": "--brand-foreground", "border": "", "hover": "darken"},
                {"id": "link", "label": "链接", "h": 0, "px": 0, "size": 14, "weight": 500, "radius": "sm", "bg": "", "fg": "--brand", "border": "", "hover": "underline"},
                {"id": "icon", "label": "图标", "h": 32, "px": 0, "size": 14, "weight": 500, "radius": "full", "bg": "", "fg": "--foreground", "border": "", "hover": "muted-bg"}],
    "layouts": []}
CUSTOM = [{"id": "paper", "name": "阅读纸面", "status": "已确认", "why": "暖纸", "where": "弹窗", "tokens": ["--modal-"], "based_on": "底色"},
          {"id": "gone", "name": "废弃定制", "status": "不需要", "why": "-", "where": "-", "tokens": ["--legacy-"], "based_on": "-"}]


def main():
    keep = "--keep" in sys.argv
    root = tempfile.mkdtemp(prefix="sys-eval-")
    try:
        write(root, "frontend-react/src/globals.css", GLOBALS)
        write(root, "frontend-react/tailwind.config.ts", TW)
        write(root, "frontend-react/src/App.tsx", APP)
        for c in (["git", "init", "-q", "-b", "main"], ["git", "add", "-A"], ["git", "-c", "user.email=e@x", "-c", "user.name=e", "commit", "-qm", "base"]):
            run(c, root)
        run(["git", "branch", "base"], root)

        print("抽取")
        code, out = run([sys.executable, os.path.join(S, "extract_system.py"), root, "--quiet"])
        check("extract 退出码 0", code == 0, out[-300:])
        J = json.load(open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")))
        C = {c["id"]: c for c in J["colors"]}
        check("亮暗配对：--brand 亮 #C65A1E 暗 #F0A273", C.get("--brand", {}).get("light") == "#C65A1E" and C["--brand"].get("dark") == "#F0A273")
        check("行尾注释进 note", "品牌暖铜" in C.get("--brand", {}).get("note", ""))
        check("Tailwind 语义类计入用量（bg-background）", C.get("--background", {}).get("uses_tw", 0) >= 1)
        check("--radius 归入非颜色变量", any(o["name"] == "--radius" for o in J["other_vars"]))
        check("写死颜色识别同值变量", any(h["value"] == "#c65a1e" and h["same_as"] == "--brand" for h in J["hardcoded_colors"]))
        fams = {f["key"]: f for f in J["buttons"]["families"]}
        check("按钮总数 6", J["buttons"]["total"] == 6, str(J["buttons"]["total"]))
        check("实心按钮识别（bg-[var(--brand)] 与 bg-primary/90 算实心，bg-primary/10 不算）", fams["solid"]["count"] == 2, str(fams["solid"]["count"]))
        check(":root, .light 不凭空多出作用域", not any(c["scope"] == ".light" for c in J["colors"]))
        check("border-2 border-primary 识别为描边·品牌", fams["outline-brand"]["count"] == 1, str(fams["outline-brand"]["count"]))
        check(":root.dark 识别为暗色", C.get("--card", {}).get("dark") == "#211E18" and C["--card"].get("light") == "#FFFFFF", str(C.get("--card")))
        check("prefers-color-scheme: dark 识别为暗色", C.get("--muted", {}).get("dark") == "#25211B" and C["--muted"].get("light") == "#F2F1ED", str(C.get("--muted")))
        check("[data-theme=dark] 识别为暗色", C.get("--ink-2", {}).get("dark") == "#C8BBAA", str(C.get("--ink-2")))
        check("注释掉的变量不算数", "--old-brand" not in C)
        check("font-weight: bold 不崩并记为 700", any(r["id"] == "reading-strong" and r["weight"] == 700 for r in J["text_roles"]))
        check("描边按钮识别", fams["outline"]["count"] == 1)
        check("cn() 动态类名标记 dynamic", any(v["dynamic"] for f in fams.values() for v in f["variants"]))
        check("悬停态去掉被覆盖的默认类", any("border-[var(--brand)]" in v["cls_hover"] and " border-border" not in " " + v["cls_hover"] for v in fams["outline"]["variants"]))
        check("文字角色抽到 .reading-body", any(r["id"] == "reading-body" and r["size"] == 16 for r in J["text_roles"]))
        ids_before = [v["id"] for f in fams.values() for v in f["variants"]]

        J["template"], J["custom"], J["layouts"] = TEMPLATE, CUSTOM, [{"id": "x", "label": "手写骨架", "regions": []}]
        J["feedback"] = [{"t": "旧反馈", "at": "2026-01-01T00:00"}]
        json.dump(J, open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json"), "w"), ensure_ascii=False)
        run([sys.executable, os.path.join(S, "extract_system.py"), root, "--quiet"])
        J2 = json.load(open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")))
        check("重跑保留 template / custom / layouts / feedback", J2["template"] == TEMPLATE and J2["custom"] == CUSTOM and J2["layouts"][0]["id"] == "x" and J2["feedback"])
        check("按钮编号重跑不漂移", ids_before == [v["id"] for f in J2["buttons"]["families"] for v in f["variants"]])

        print("生成器")
        code, out = run(["node", os.path.join(S, "build_template.js"), root])
        css = open(os.path.join(root, "docs/assets/visuals/system/template.css")).read()
        check("build 退出码 0", code == 0, out)
        check("颜色变量亮暗两套", ":root{--background:#F4F3EF" in css and ".dark{--background:#181611" in css)
        check("文字样式类 .t-body", ".t-body{font-family:var(--t-font-serif);font-size:16px;line-height:1.75" in css)
        check("按钮引用模板圆角与颜色", ".t-btn-primary{font-size:14px;font-weight:600;border-radius:4px;background:var(--brand)" in css)
        check("链接按钮无高度、无边框", ".t-btn-link{" in css and "height:auto" in css.split(".t-btn-link{")[1].split("}")[0])
        check("图标按钮宽 = 高", "width:32px" in css.split(".t-btn-icon{")[1].split("}")[0])
        code, _ = run(["node", os.path.join(S, "build_template.js"), root, "--check"])
        check("--check 一致时 0", code == 0)
        gen = lambda T: subprocess.run(["node", "-e", "const {build}=require(process.argv[1]);process.stdout.write(build(JSON.parse(process.argv[2])))",
                                        os.path.join(LAB, "assets", "system", "template-css.js"), json.dumps(T)], capture_output=True, text=True).stdout
        g2 = gen({"colors": [{"name": "--x", "light": "#fff;}body{display:none", "dark": "#000"}], "type": [{"id": "a", "font": "sans", "size": 14, "lh": 1.5, "weight": 400}],
                  "radius": [{"id": "sm", "v": 4}], "buttons": [{"id": "ink", "h": 32, "px": 8, "size": 13, "weight": 500, "radius": "sm", "bg": "--foreground", "fg": "--card", "border": "", "hover": "darken"}]})
        check("模板值里的 ; } 被清掉，写不坏整份样式（坏样本）", "}body{" not in g2 and "display:none" not in g2, g2[:200])
        g3 = gen({"colors": [{"name": "--x", "light": "#fff", "dark": "#000"}], "fonts": [{"id": "sans", "stack": ['A"}b{x:1']}], "space": ["4;}x{"], "radius": [{"id": "sm}q{", "v": "4"}],
                  "type": [{"id": "t}y{", "font": "sans", "size": "14;}", "lh": 1.5, "weight": 400}],
                  "buttons": [{"id": "ink}evil{", "h": 32, "px": 8, "size": 13, "weight": 500, "radius": "sm", "bg": "var(--foreground)}x{a:b)", "fg": "--card", "border": "", "hover": "darken"}]})
        lines = [l for l in g3.strip().split("\n")[1:] if l]
        check("所有字段注入都写不出第二条规则（按钮/字体/阶梯/编号，坏样本）", all(l.count("{") == 1 and l.count("}") == 1 for l in lines), g3[:300])
        check("没设颜色的文字样式继承颜色，不是透明", ".t-a{" in g2 and "color:inherit" in g2.split(".t-a{")[1].split("}")[0])
        check("加深悬停按按钮自己的底色", "color-mix(in srgb,var(--foreground) 88%" in g2)
        open(os.path.join(root, "docs/assets/visuals/system/template.css"), "a").write("/* tamper */")
        code, _ = run(["node", os.path.join(S, "build_template.js"), root, "--check"])
        check("--check 被改过时非 0（坏样本）", code != 0)
        run(["node", os.path.join(S, "build_template.js"), root])
        run(["git", "add", "-A"], root)
        run(["git", "-c", "user.email=e@x", "-c", "user.name=e", "commit", "-qm", "pack"], root)
        run(["git", "branch", "-f", "base"], root)

        print("守门")
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("无新增时通过", code == 0, out)
        write(root, "frontend-react/src/Good.tsx", 'export const G = () => <div className="text-[14px] rounded-[4px] p-[8px] bg-[var(--brand)] text-[var(--primary)] border-[var(--modal-surface)]" />\n')
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("模板值 / 别名 / 已确认定制 放行（好样本）", code == 0, out)
        write(root, "frontend-react/src/Bad.tsx", 'export const B = () => <div className="text-[15px] rounded-[5px] p-[9px] text-[#ff0000] bg-[var(--legacy-pink)]" />\n')
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("越界 5 类全报（坏样本）", code == 1 and all(k in out for k in ("颜色 #ff0000", "字号 15px", "圆角 5px", "间距 9px", "--legacy-pink")), out[-400:])
        check("「不需要」的定制不再放行", "--legacy-pink" in out)
        write(root, "frontend-react/src/Bad.tsx", 'export const B = () => <div className="bg-[#FAF8F5]" /> // design: paper\n')
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("行尾 design: <定制 id> 放行，且在报告里列出被豁免的行", code == 0 and "豁免 1 行" in out and "[paper]" in out, out)
        write(root, "frontend-react/src/Bad.tsx", 'export const B = () => <div className="bg-[#FAF8F5]" /> // design: nope\n')
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("design: 写了不存在的定制 id 不放行（坏样本）", code == 1, out)
        os.remove(os.path.join(root, "frontend-react/src/Bad.tsx"))
        bads = {
            "八位色值": 'const a = "#ffffffcc"',
            "rgb 字面值": "const a = { color: 'rgb(255, 0, 0)' }",
            "调色板类": '<b className="text-red-500" />',
            "内联字号": "<b style={{ fontSize: 15 }} />",
            "响应式前缀字号": '<b className="md:text-[15px]" />',
            "负间距": '<b className="-mt-[13px]" />',
            "rem 字号": '<b className="text-[0.9375rem]" />',
            "var 兜底色": "const c = 'var(--brand, #ff0000)'",
            "length: 前缀字号": '<b className="text-[length:15px]" />',
        }
        for label, line in bads.items():
            write(root, "frontend-react/src/Probe.tsx", f"export const P = () => {{ {line} }}\n")
            code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
            check(f"漏报修复：{label}（坏样本）", code == 1, out[-200:])
        write(root, "frontend-react/src/Probe.css", ".p { padding-inline-start: 13px; }\n")
        os.remove(os.path.join(root, "frontend-react/src/Probe.tsx"))
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("漏报修复：padding-inline-start（坏样本）", code == 1 and "13px" in out, out[-200:])
        os.remove(os.path.join(root, "frontend-react/src/Probe.css"))
        write(root, "frontend-react/src/组件/新.tsx", 'export const N = () => <b className="text-[15px]" />\n')
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("漏报修复：中文路径的新文件（坏样本）", code == 1 and "15px" in out, out[-200:])
        shutil.rmtree(os.path.join(root, "frontend-react/src/组件"))
        write(root, "frontend-react/src/Anchor.tsx", 'export const A = () => <a href="#add">x</a>\n')
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("锚点 href=\"#add\" 不误报", code == 0, out[-400:])
        os.remove(os.path.join(root, "frontend-react/src/Anchor.tsx"))
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "origin/nope"])
        check("基础分支不存在时退出码 2，不报通过（坏样本）", code == 2 and "✓" not in out, out)
        write(root, "docs/notes.css", ".x{font-size:15px;color:#123456}\n")
        code, out = run([sys.executable, os.path.join(S, "check_system.py"), root, "--base", "base"])
        check("产品目录以外的文件不查", code == 0, out)

        print("保存合并")
        sys.path.insert(0, S)
        import serve  # noqa: E402
        os.makedirs(os.path.join(root, ".forge", "design-lab"), exist_ok=True)
        disk = json.load(open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")))
        inc = {"kind": "system", "files": disk["files"], "template": json.loads(json.dumps(TEMPLATE)), "custom": json.loads(json.dumps(CUSTOM)),
               "feedback": disk["feedback"] + [{"t": "新反馈", "at": "2026-02-01T00:00"}], "template_css": "/* from page */\n", "colors": [{"id": "HACK"}]}
        inc["template"]["buttons"][0]["radius"] = "full"
        inc["custom"][0]["status"] = "待确认"
        rep = serve.merge_and_write(root, inc)
        after = json.load(open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")))
        check("模板改动写入并进回执", after["template"]["buttons"][0]["radius"] == "full" and any(c.get("item") == "primary" for c in rep["template_changes"]))
        check("定制状态改动进回执", rep["custom_changes"] and rep["custom_changes"][0]["status"] == ["已确认", "待确认"])
        check("新反馈只算新增的", len(rep["new_feedback"]) == 1)
        check("抽取字段以磁盘为准（页面送来的 colors 被忽略）", after["colors"] == disk["colors"])
        check("template.css 按页面送来的写入", open(os.path.join(root, "docs/assets/visuals/system/template.css")).read() == "/* from page */\n")
        check("回执写到 last-save.json", os.path.exists(os.path.join(root, ".forge/design-lab/last-save.json")))
        write(root, "package.json", '{"name": "x"}')
        serve.merge_and_write(root, {"kind": "system", "files": {"json": "package.json"}, "feedback": after["feedback"]})
        check("零件库保存不信请求里的路径，别的 JSON 不被改写（坏样本）", open(os.path.join(root, "package.json")).read() == '{"name": "x"}')

        print("服务（真起一个本机服务发请求）")
        import http.client, time
        sib = root.rstrip("/") + "-secret"
        os.makedirs(sib, exist_ok=True); open(os.path.join(sib, "key.txt"), "w").write("TOPSECRET")
        write(root, ".env", "API_KEY=SECRET")
        port = 4690
        srv = subprocess.Popen([sys.executable, os.path.join(S, "serve.py"), root, "--port", str(port)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for _ in range(50):
            try:
                http.client.HTTPConnection("127.0.0.1", port, timeout=1).request("GET", "/api/lab/status"); break
            except OSError:
                time.sleep(0.1)

        def req(method, path, body=None, headers=None):
            c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
            h = {"Host": f"127.0.0.1:{port}"}; h.update(headers or {})
            c.request(method, path, body=body, headers=h)
            r = c.getresponse(); return r.status, r.read().decode("utf-8", "ignore")
        try:
            name = os.path.basename(sib)
            st, b = req("GET", f"/../{name}/key.txt")
            check("同级目录读不到（路径穿越，坏样本）", "TOPSECRET" not in b, f"{st} {b[:60]}")
            st, b = req("GET", "/.env")
            check(".env 读不到（坏样本）", "SECRET" not in b and st == 404, f"{st}")
            st, b = req("GET", "/api/lab/status", headers={"Host": f"evil.example:{port}"})
            check("陌生 Host 被拒（DNS rebinding，坏样本）", st == 403, str(st))
            c0 = http.client.HTTPConnection("127.0.0.1", port, timeout=5); c0.request("GET", "/docs/assets/visuals/system/system.tokens.json", headers={"Host": f"127.0.0.1:{port}"})
            r0 = c0.getresponse(); b = r0.read().decode(); hdr_rev = r0.getheader("X-Lab-Rev")
            check("正常静态读取可用", r0.status == 200 and '"kind": "system"' in b, str(r0.status))
            check("版本指纹随数据同一次返回，且与独立接口一致", hdr_rev and hdr_rev == json.loads(req("GET", "/api/lab/system-rev")[1])["rev"], str(hdr_rev))
            rev = json.loads(req("GET", "/api/lab/system-rev")[1])["rev"]
            body = json.dumps({"kind": "system", "rev": rev, "feedback": after["feedback"]})
            st, b = req("POST", "/api/lab/save", body, {"Content-Type": "text/plain", "Origin": "https://evil.example"})
            check("跨站 POST 被拒（坏样本）", st == 403, str(st))
            st, b = req("POST", "/api/lab/save", body, {"Content-Type": "text/plain"})
            check("非 JSON 类型 POST 被拒（坏样本）", st == 415, str(st))
            disk = json.load(open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")))
            disk["edits"], disk["decisions"] = {"color:--brand": {"light": "#111111"}}, {"btn.x": {"r": "std"}}
            json.dump(disk, open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json"), "w"), ensure_ascii=False)
            rev = json.loads(req("GET", "/api/lab/system-rev")[1])["rev"]
            st, b = req("POST", "/api/lab/save", json.dumps({"kind": "system", "rev": rev, "feedback": disk["feedback"] + [{"t": "页面反馈", "at": "2026-03-01T00:00"}]}), {"Content-Type": "application/json", "Origin": f"http://127.0.0.1:{port}"})
            d2 = json.load(open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")))
            check("页面没送 edits/decisions 时保留磁盘值（坏样本）", st == 200 and d2.get("edits") == disk["edits"] and d2.get("decisions") == disk["decisions"], f"{st} {b[:120]}")
            d2["feedback"].append({"t": "Agent 刚加的", "at": "2026-03-02T00:00"})
            json.dump(d2, open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json"), "w"), ensure_ascii=False)
            st, b = req("POST", "/api/lab/save", json.dumps({"kind": "system", "rev": rev, "feedback": []}), {"Content-Type": "application/json"})
            d3 = json.load(open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")))
            check("页面打开期间文件被改过：拒绝覆盖（409，坏样本）", st == 409 and any(f["t"] == "Agent 刚加的" for f in d3["feedback"]), f"{st} {b[:120]}")
            before = open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")).read()
            rev = json.loads(req("GET", "/api/lab/system-rev")[1])["rev"]
            st, b = req("POST", "/api/lab/save", json.dumps({"kind": "system", "rev": rev, "decisions": {"a": "std"}, "template": TEMPLATE, "template_css": "/* x */"}), {"Content-Type": "application/json"})
            check("非法输入先校验：报错且一个文件都不写（坏样本）", st == 400 and open(os.path.join(root, "docs/assets/visuals/system/system.tokens.json")).read() == before
                  and "/* x */" not in open(os.path.join(root, "docs/assets/visuals/system/template.css")).read(), f"{st} {b[:120]}")
        finally:
            srv.terminate(); srv.wait(5); shutil.rmtree(sib, ignore_errors=True)

        print("适配取模板")
        code, out = run([sys.executable, os.path.join(S, "adapt_tokens.py"), root, "--page", "demo", "--init-spec"])
        spec = json.load(open(os.path.join(root, "docs/assets/visuals/demo/demo.tokens.json")))
        check("色板只含模板颜色", set(spec["foundation"]["light"]) == {c["name"][2:] for c in TEMPLATE["colors"]}, str(list(spec["foundation"]["light"])))
        check("字号阶梯 = 模板字号", spec["scale"]["px"] == TEMPLATE["sizes"])
        check("报告写明来源是模板", "零件库模板" in out)
        code, out = run([sys.executable, os.path.join(S, "adapt_tokens.py"), root, "--page", "demo2", "--no-template", "--out", os.path.join(root, "x.json")])
        check("--no-template 退回用量统计", "色板与阶梯来源" not in out and "来自实际用量" in out, out[-300:])
    finally:
        if keep:
            print("保留临时项目：", root)
        else:
            shutil.rmtree(root, ignore_errors=True)
    bad = [r for r in RESULTS if not r[1]]
    print(f"\n零件库回归：{len(RESULTS) - len(bad)}/{len(RESULTS)} 通过")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
