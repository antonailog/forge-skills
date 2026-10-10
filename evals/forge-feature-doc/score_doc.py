#!/usr/bin/env python3
"""forge-feature-doc 效果对照：按 rubric.md 的客观考点 O1–O7 给一份文档打分。

用法：python3 score_doc.py <文档路径> [<文档路径> ...]
输出每份文档的考点结果（JSON），主观考点 S1–S3 由人读完填。
"""
import json
import os
import re
import sys

HISTORY = re.compile(r"改为|原来|之前|不再|新增|曾经|后来|\b20\d\d-\d\d-\d\d\b|\bv\d+\.\d+\b")
EVIDENCE_DATE = re.compile(r"(实测|数据)[:：\s]*20\d\d-\d\d-\d\d")
PROMPT_VERSION = re.compile(r"prompt\s*\**\s*v\d+(\.\d+)*", re.I)
FILE_IN_BACKTICKS = re.compile(r"`[^`\s]*/[^`\s]*\.(md|py|ts|tsx|js|mjs|json|html|css|sql|ya?ml)`")
FACTS = {
    "举旗线 4.75": [r"4\.75"],
    "展示闸 6.5": [r"6\.5"],
    "reach 闸": [r"reach|受众覆盖", r"major_event|重大事件"],
    "硬帽 4.9 / 5.9": [r"4\.9", r"5\.9"],
    "五维 + 六套权重": [r"五维|五个维度|5 维", r"权重"],
    "边缘带二跑": [r"二跑|再跑一次|第二跑|两跑|复判|再判一次", r"500"],
    "读模型 7 天": [r"7\s*天"],
    "GitHub ≥50 星": [r"50\**\s*(星|star)|≥\s*\**50|>=\s*50"],
    "why_read 前置": [r"why_read|为什么值得读"],
    "双评分器 v26/v38": [r"v38"],
    "prompt 版本": [r"v26\.9|item_score_v26"],
}


def strip_front(text):
    m = re.match(r"^---\n[\s\S]*?\n---\n", text)
    return text[m.end():] if m else text


def score(path):
    text = open(path, encoding="utf-8").read()
    body_all = strip_front(text)
    body = re.split(r"\n#{1,3} [^\n]*(关键改动|改动记录|变更记录)", body_all)[0]
    h2 = [m for m in re.finditer(r"^## (.+)$", body, re.M)]
    titles = [m.group(1).strip() for m in h2]

    # O1 待拍板最前
    o1 = bool(titles) and bool(re.search(r"待.*(拍板|决定|确认)", titles[0]))
    # O2 必有部分
    need = {"背景": r"背景", "目标": r"目标|成功标准", "流程": r"流程", "细节链接": r"细节在哪|参考|延伸|链接|相关文档",
            "关键改动": r"关键改动|改动记录|变更记录"}
    all_titles = [m.group(1) for m in re.finditer(r"^#{2,3} (.+)$", body_all, re.M)]
    o2 = {k: any(re.search(v, t) for t in all_titles) for k, v in need.items()}
    # O3 先图后字
    images = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", body)
    first_visual = 0
    for i, m in enumerate(h2):
        seg = body[m.end(): h2[i + 1].start() if i + 1 < len(h2) else len(body)]
        first = next((l.strip() for l in seg.split("\n") if l.strip() and not l.strip().startswith("<!--")), "")
        if first.startswith("![") or first.startswith("|") or first.startswith("```"):
            first_visual += 1
    o3 = {"图片数": len(images), "首个元素是图或表的部分": f"{first_visual}/{len(h2)}",
          "比例": round(first_visual / len(h2), 2) if h2 else 0}
    # O4 历史词
    hist = []
    for line in body.split("\n"):
        plain = re.sub(r"`[^`]*`", "", line)
        plain = re.sub(r"\]\([^)]*\)", "]", plain)
        plain = re.sub(r"!\[[^\]]*\]", "", plain)
        plain = PROMPT_VERSION.sub("", EVIDENCE_DATE.sub("", plain))   # 和 check.mjs 同一口径
        if HISTORY.search(plain):
            hist.append(line.strip()[:50])
    # O5 篇幅（中文字数，不含代码块、图片、链接目标）
    prose = re.sub(r"```[\s\S]*?```", "", body)
    prose = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", prose)
    prose = re.sub(r"\]\([^)]*\)", "]", prose)
    cjk = len(re.findall(r"[一-鿿]", prose))
    # O6 链接
    backticks = FILE_IN_BACKTICKS.findall(body)
    broken, absolute = [], []
    for m in re.finditer(r"\]\((<[^>]+>|[^)\s]+)\)", body_all):
        target = m.group(1).strip("<>").split("#")[0]
        if re.match(r"^(/|~|file:)", target, re.I):
            absolute.append(target)
        elif target and not re.match(r"^[a-z]+:", target, re.I):
            if not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(path), target))):
                broken.append(target)
    # O7 关键事实
    facts = {k: all(re.search(p, body_all) for p in pats) for k, pats in FACTS.items()}
    return {
        "文档": path,
        "O1 待拍板最前": o1,
        "O2 必有部分": o2,
        "O3 先图后字": o3,
        "O4 历史词命中": len(hist), "O4 例子": hist[:3],
        "O5 正文中文字数": cjk,
        "O6 反引号文件路径": len(backticks), "O6 绝对路径链接": len(absolute), "O6 坏链接": broken[:5],
        "O7 关键事实": f"{sum(facts.values())}/{len(facts)}", "O7 缺": [k for k, v in facts.items() if not v],
        "二级标题": titles,
    }


if __name__ == "__main__":
    print(json.dumps([score(p) for p in sys.argv[1:]], ensure_ascii=False, indent=1))
