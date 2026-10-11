#!/usr/bin/env python3
"""实现比对（compare_impl.mjs）回归：临时项目里从零建一个最小页面包，对两个假产品页比对。
  好样本：产品页元素与骨架同位同尺寸 → 必须通过
  坏样本：产品页元素偏 5px → 必须报超差；选择器找不到 → 必须报错
用法: python3 evals/forge-design-lab/impl/run_impl_eval.py [--keep]
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
S = os.path.abspath(os.path.join(HERE, "..", "..", "..", "skills", "forge-design-lab", "scripts"))
RES = []


def check(name, ok, detail=""):
    RES.append(ok)
    print(("  ✓ " if ok else "  ✗ ") + name + ("" if ok else f" · {detail[-500:]}"))


def run(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main():
    root = tempfile.mkdtemp(prefix="impl-eval-")
    try:
        os.makedirs(os.path.join(root, "src"))
        open(os.path.join(root, "src", "app.css"), "w").write(":root{--background:#fff;--foreground:#111}\n.p{padding:8px;font-size:14px}\n")
        code, out = run([sys.executable, os.path.join(S, "adapt_tokens.py"), root, "--page", "demo", "--init-spec", "--no-template"])
        check("adapt --init-spec", code == 0, out)
        sp = os.path.join(root, "docs/assets/visuals/demo/demo.tokens.json")
        spec = json.load(open(sp))
        spec["nodes"] = [
            {"id": "s.box-x", "g": "structure", "mod": "structure", "label": "盒子左", "type": "px", "value": 100, "css": "--demo-box-x", "maps": [".box"]},
            {"id": "s.box-w", "g": "structure", "mod": "structure", "label": "盒子宽", "type": "px", "value": 300, "css": "--demo-box-w", "maps": [".box"]}]
        spec["elementIds"] = {"B": "盒子", "SD": "靠右侧栏"}
        good = os.path.join(root, "good.html"); bad = os.path.join(root, "bad.html")
        spec["implCheck"] = {"app": "file://" + good, "viewport": {"w": 1440, "h": 900}, "lab": {"level": "page"}, "tolerance": 2,
                             "pairs": [{"name": "盒子", "lab": ".box", "app": "#real-box", "props": ["x", "y", "w", "h"]},
                                       {"name": "靠右侧栏", "lab": ".side", "app": "#real-side", "props": ["x", "w"]}]}
        json.dump(spec, open(sp, "w"), ensure_ascii=False, indent=1)
        code, out = run([sys.executable, os.path.join(S, "build_tokens.py"), root, sp])
        check("build_tokens", code == 0, out)
        code, out = run([sys.executable, os.path.join(S, "scaffold_pack.py"), root, sp, "--date", "2026-10-10"])
        check("scaffold_pack", code == 0, out)
        html = os.path.join(root, "docs/assets/visuals/demo/2026-10-10-skeleton-v0.1.html")
        h = open(html).read()
        h = h.replace("/* TODO 按模块写组件 CSS。", "#frame .box{position:absolute;left:var(--demo-box-x);top:80px;width:var(--demo-box-w);height:200px;background:#eee} /* fixed */\n#frame .side{position:absolute;right:0;top:0;bottom:0;width:280px;background:#ddd} /* fixed */\n/* TODO 按模块写组件 CSS。")
        h, n = re.subn(r'(<div class="lvl page"[^>]*>)', r'\1<div class="box" data-id="B"></div><div class="side" data-id="SD"></div>', h, count=1)
        check("骨架注入盒子", n == 1)
        open(html, "w").write(h)
        page = '<!doctype html><html><body style="margin:0"><div id="real-box" style="position:absolute;left:{x}px;top:80px;width:300px;height:200px;background:#ddd"></div><div id="real-side" style="position:absolute;right:0;top:0;bottom:0;width:280px"></div></body></html>'
        open(good, "w").write(page.format(x=100))
        open(bad, "w").write(page.format(x=105))
        cmp_ = ["node", os.path.join(S, "compare_impl.mjs"), html]
        code, out = run(cmp_)
        check("好样本：同位同尺寸通过且零偏差", code == 0 and "x 0 y 0 w 0 h 0" in out, out)
        check("靠右元素零偏差（引擎画框不再吃掉 2px）", "靠右侧栏：x 0 w 0" in out, out)
        code, out = run(cmp_ + ["--app", "file://" + bad])
        check("坏样本：偏 5px 报超差且读数准确", code == 1 and "x +5 y 0" in out, out)
        spec["implCheck"]["pairs"] = spec["implCheck"]["pairs"][:1]; spec["implCheck"]["pairs"][0]["app"] = "#nope"
        json.dump(spec, open(sp, "w"), ensure_ascii=False, indent=1)
        run([sys.executable, os.path.join(S, "build_tokens.py"), root, sp])
        code, out = run(cmp_)
        check("坏样本：产品页找不到元素报错", code == 1 and "产品页找不到" in out, out)
    finally:
        if "--keep" in sys.argv:
            print("保留：", root)
        else:
            shutil.rmtree(root, ignore_errors=True)
    print(f"\n实现比对回归：{sum(RES)}/{len(RES)} 通过")
    sys.exit(0 if all(RES) else 1)


if __name__ == "__main__":
    main()
