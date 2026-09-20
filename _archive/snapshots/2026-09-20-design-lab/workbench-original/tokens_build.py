#!/opt/homebrew/bin/python3
"""从 <visuals>/<page>/<page>.tokens.json 生成工作台加载的 .js 与前端 import 的 .css。
用法: python3 docs/assets/visuals/ai-search/tokens_build.py <repo_root>
工作台「保存」已直接写这三个文件；本脚本用于 Agent 侧校验/规范化重建（幂等）。"""
import json,sys,os
root=sys.argv[1]
J=os.path.join(root,"docs/assets/visuals/ai-search/ai-search.tokens.json")
spec=json.load(open(J,encoding="utf-8"))
def css_val(n):
    t=n["type"];v=n["value"]
    if t=="px": return f"{v}px"
    if t=="ms": return f"{v}ms"
    if t=="num": return f"{v}"
    if t=="colorref": return "transparent" if v=="transparent" else f"var(--{v})"
    if t=="color": return v
    if t=="raw": return v
    return None
def build_css(spec):
    lines=["/* 由 docs/assets/visuals/ai-search/ai-search.tokens.json 生成（工作台「保存」或 tokens_build.py），勿手改。",
           " * AI 搜索页 "+spec["version"]+" 页面级与组件级 token。站点基础 token 只引用 var(--…)，值在 globals.css。",
           " * 工作台 docs/assets/visuals/ai-search/*.html 与前端组件读的是同一个文件。 */",":root{"]
    for n in spec["nodes"]:
        if n.get("css") and css_val(n) is not None: lines.append(f"  {n['css']}: {css_val(n)}; /* {n['label']} */")
    return "\n".join(lines+["}",""])
files=spec.get("files") or {"js":J[len(root)+1:-5]+".js","css":spec["cssFile"]}
open(os.path.join(root,files["js"]),"w",encoding="utf-8").write("// 由 ai-search.tokens.json 生成，勿手改\nwindow.WB_SPEC=window.AI_TOKENS="+json.dumps(spec,ensure_ascii=False)+";\n")
open(os.path.join(root,files["css"]),"w",encoding="utf-8").write(build_css(spec))
print("wrote",files["js"],"and",files["css"],"vars",sum(1 for n in spec['nodes'] if n.get('css')))
