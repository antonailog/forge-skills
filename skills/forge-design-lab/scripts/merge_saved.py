#!/usr/bin/env python3
"""forge-design-lab · S4 把用户保存/下载的 tokens.json 按 id 合并进仓库当前 spec。

用法:
  python3 merge_saved.py <repo_root> <用户保存的 json> [--spec <仓库 tokens.json>] [--apply] [--json <报告输出>]

为什么不能直接覆盖:
  工作台页面加载后 spec 就固定在内存里。用户若在你改过 json 之后没刷新页面就保存，导出的是
  **旧结构**——缺你新增的节点、effects、layout.el 与顶层字段。直接覆盖会把这些改动抹掉。
  所以只取用户那份里真正属于他的三样：节点值、结局、反馈；结构一律以仓库为准。

做什么:
  1. 比节点集合，报出「仓库有而导出没有」（用户页面过期，他没见过这些节点）与
     「导出有而仓库没有」（你删过节点）
  2. 按 id 取值；报出值改动表（仓库值 → 用户值）
  3. 合并 decisions（用户为准，丢弃仓库已不存在的 id）与 feedback（按 (at, t) 去重，只增不删）
  4. 标出不在 options 也不在 scale 阶梯上的值（面板里会标红，多半是用户手输的自定义值）
  5. --apply 时顺手把 baseline 记账写进 json（谁保存的、改了几处、哪些拿不准、他没见过哪些节点）
  6. 默认只报告不落盘；--apply 才写回 <仓库 tokens.json>（写回后记得跑 build_tokens.py）
退出码: 0 正常 · 1 输入有问题 · 2 用户档结构过期（仍可 --apply，报告里已列差异）
"""
import argparse
import json
import os
import sys

LADDER = {"px": ("px", "space", "radius"), "num": ("weight", "lh")}


def on_ladder(node, scale):
    v = node.get("value")
    opts = [str(o) for o in (node.get("options") or [])]
    if str(v) in opts:
        return True
    if node["type"] == "px":
        pool = set(scale.get("px", [])) | set(scale.get("space", [])) | set(scale.get("radius", []))
        return v in pool
    if node["type"] == "num":
        pool = set(scale.get("weight", [])) | set(scale.get("lh", []))
        return v in pool or not pool
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("saved", help="用户保存或下载的 tokens.json")
    ap.add_argument("--spec", help="仓库 tokens.json（默认取用户档里的 files.json）")
    ap.add_argument("--apply", action="store_true", help="写回仓库 spec（默认只报告）")
    ap.add_argument("--json", dest="out", help="把报告存成 json")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    U = json.load(open(a.saved, encoding="utf-8"))
    rel = a.spec or (U.get("files") or {}).get("json")
    if not rel:
        print("✗ 用户档里没有 files.json，请用 --spec 指定仓库 tokens.json")
        sys.exit(1)
    spath = rel if os.path.isabs(rel) else os.path.join(repo, rel)
    if not os.path.exists(spath):
        print(f"✗ 找不到仓库 spec：{rel}")
        sys.exit(1)
    R = json.load(open(spath, encoding="utf-8"))

    ru = {n["id"]: n for n in R["nodes"]}
    uu = {n["id"]: n for n in U.get("nodes", [])}
    only_repo = sorted(set(ru) - set(uu))
    only_user = sorted(set(uu) - set(ru))
    stale = bool(only_repo) or bool(only_user) or U.get("schemaVersion") != R.get("schemaVersion")

    changes, off = [], []
    for nid, un in uu.items():
        rn = ru.get(nid)
        if rn is None:
            continue
        if un.get("value") != rn.get("value"):
            changes.append({"id": nid, "label": rn["label"], "from": rn.get("value"), "to": un.get("value"),
                            "type": rn["type"], "mod": rn["mod"], "g": rn["g"],
                            "in_options": str(un.get("value")) in [str(o) for o in (rn.get("options") or [])]})
            rn["value"] = un.get("value")
        if not on_ladder(rn, R.get("scale") or {}):
            off.append(f"{nid}={rn['value']}")

    dec_in = U.get("decisions") or {}
    dec_out = {k: v for k, v in dec_in.items() if k in ru}
    dropped_dec = sorted(set(dec_in) - set(dec_out))
    dec_changed = [(k, (R.get("decisions") or {}).get(k, {}).get("r", ""), v.get("r", ""))
                   for k, v in dec_out.items() if (R.get("decisions") or {}).get(k, {}).get("r", "") != v.get("r", "")]
    R["decisions"] = dec_out

    old_fb = R.get("feedback") or []
    seen = {(f.get("at"), f.get("t")) for f in old_fb}
    new_fb = [f for f in (U.get("feedback") or []) if (f.get("at"), f.get("t")) not in seen]
    R["feedback"] = old_fb + new_fb
    R["exported"] = U.get("exported") or R.get("exported")

    counts = {}
    for v in dec_out.values():
        counts[v.get("r") or "（无）"] = counts.get(v.get("r") or "（无）", 0) + 1

    print(f"# merge_saved · {os.path.basename(a.saved)} → {rel}")
    print(f"用户导出时间 {U.get('exported')} · 仓库上次导出 {json.load(open(spath, encoding='utf-8')).get('exported')}")
    if stale:
        print("⚠ 用户档结构过期（页面未刷新就保存）。只取值/结局/反馈，结构保留仓库版本：")
        if only_repo:
            print(f"   仓库有而导出没有（用户没见过这些节点）：{', '.join(only_repo)}")
        if only_user:
            print(f"   导出有而仓库没有（已删除的节点，忽略）：{', '.join(only_user)}")
        if U.get("schemaVersion") != R.get("schemaVersion"):
            print(f"   schemaVersion：导出 {U.get('schemaVersion')} · 仓库 {R.get('schemaVersion')}")
    print(f"\n值改动 {len(changes)} 处：")
    for c in changes:
        flag = "" if c["in_options"] else "  ← 自定义值，不在备选里"
        print(f"  [{c['g']}/{c['mod']}] {c['id']:<18} {c['from']} → {c['to']}   {c['label']}{flag}")
    print(f"\n结局：{counts}；变化 {len(dec_changed)} 处" + (f"；丢弃已不存在的 id {dropped_dec}" if dropped_dec else ""))
    for k, o, n in dec_changed:
        print(f"  {k:<18} {o or '（无）'} → {n or '（无）'}")
    print(f"\n反馈：新增 {len(new_fb)} 条（合并后共 {len(R['feedback'])} 条）")
    for f in new_fb:
        print(f"  [{f.get('ref') or '—'}] {f.get('t')}")
    if off:
        print(f"\n⚠ 不在阶梯也不在备选上的值：{', '.join(off)}（面板会标红，确认是有意为之再定稿）")

    report = {"saved": a.saved, "spec": rel, "stale": stale, "only_repo": only_repo, "only_user": only_user,
              "changes": changes, "decisions": counts, "decision_changed": dec_changed, "new_feedback": new_fb, "off_ladder": off}
    if a.out:
        json.dump(report, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"→ 报告 {a.out}")
    if a.apply:
        # 记账写在这里，不要事后手改 json——手改完忘了重建 js 就会同源检查失败
        R["baseline"] = {"from": f"用户 {U.get('exported')} 工作台保存" + ("（结构过期→按 id 合并）" if stale else ""),
                         "changed": len(changes),
                         "changed_after": " ".join(f"{c['id']}={c['to']}" for c in changes) or "无值改动",
                         "unsure": sorted(k for k, v in dec_out.items() if v.get("r") == "unsure"),
                         "stale_nodes_user_not_seen": only_repo}
        json.dump(R, open(spath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"✓ 已写回 {rel}；接着跑 build_tokens.py 重建 js/css")
    else:
        print("\n（只报告，未落盘。确认无误后加 --apply）")
    sys.exit(2 if stale and not a.apply else 0)


if __name__ == "__main__":
    main()
