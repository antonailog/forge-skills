#!/usr/bin/env python3
"""forge-design-lab 触发评测：对 trigger-eval.json 里每条 query 跑 N 次 `claude -p`，看第一轮是否调用 Skill(forge-design-lab)。

用法:
  python3 run_trigger_eval.py [--runs 3] [--only train|test] [--cwd <项目目录>] [--parallel 5] [--out results.json] [--ids t1,n2]

工具集放开只读工具（Read/Grep/Glob/Skill），接近真实环境；--max-turns 1 只看首轮决策。
判定：assistant 消息里出现 tool_use name=Skill 且 input.skill / input.command 含 forge-design-lab → 触发。
其他被调用的 skill 也记下来，用于看被谁抢活。
"""
import argparse
import concurrent.futures as cf
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = "forge-design-lab"


def run_once(query, cwd, timeout):
    cmd = ["claude", "-p", query, "--output-format", "stream-json", "--verbose", "--max-turns", "1",
           "--allowedTools", "Skill,Read,Grep,Glob", "--permission-mode", "bypassPermissions"]
    t0 = time.time()
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        out = r.stdout
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or "") if isinstance(e.stdout, str) else ""
    skills, tools = [], []
    for line in out.splitlines():
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        if ev.get("type") != "assistant":
            continue
        for blk in (ev.get("message") or {}).get("content") or []:
            if blk.get("type") != "tool_use":
                continue
            tools.append(blk.get("name"))
            if blk.get("name") == "Skill":
                inp = blk.get("input") or {}
                skills.append(str(inp.get("skill") or inp.get("command") or inp.get("name") or inp))
    hit = any(SKILL in s for s in skills)
    return {"hit": hit, "skills": skills, "tools": tools, "sec": round(time.time() - t0, 1), "bytes": len(out)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--only", choices=["train", "test"])
    ap.add_argument("--cwd", default=os.getcwd())
    ap.add_argument("--parallel", type=int, default=5)
    ap.add_argument("--timeout", type=int, default=180)
    ap.add_argument("--out", default=os.path.join(HERE, "results.json"))
    ap.add_argument("--ids", help="只跑这些 id，逗号分隔")
    a = ap.parse_args()
    spec = json.load(open(os.path.join(HERE, "trigger-eval.json"), encoding="utf-8"))
    cases = [dict(c, expect=True) for c in spec["should_trigger"]] + [dict(c, expect=False) for c in spec["should_not_trigger"]]
    if a.only:
        cases = [c for c in cases if c["split"] == a.only]
    if a.ids:
        want = set(a.ids.split(","))
        cases = [c for c in cases if c["id"] in want]
    jobs = [(c, i) for c in cases for i in range(a.runs)]
    results = {c["id"]: dict(c, runs=[]) for c in cases}
    print(f"{len(cases)} 条 × {a.runs} 次 = {len(jobs)} 次运行，cwd={a.cwd}，并行 {a.parallel}", flush=True)
    with cf.ThreadPoolExecutor(a.parallel) as ex:
        futs = {ex.submit(run_once, c["query"], a.cwd, a.timeout): (c, i) for c, i in jobs}
        for f in cf.as_completed(futs):
            c, i = futs[f]
            r = f.result()
            results[c["id"]]["runs"].append(r)
            print(f"  {c['id']} #{i + 1} {'HIT ' if r['hit'] else 'miss'} {r['sec']}s skills={r['skills'] or '-'} tools={r['tools'] or '-'}", flush=True)
    rows, agg = [], {"train": {"tp": 0, "tn": 0, "fp": 0, "fn": 0}, "test": {"tp": 0, "tn": 0, "fp": 0, "fn": 0}}
    for cid, c in results.items():
        n = len(c["runs"])
        hits = sum(1 for r in c["runs"] if r["hit"])
        rate = hits / n if n else 0
        ok = (rate >= 0.5) == c["expect"]
        c["rate"] = rate
        c["ok"] = ok
        s = agg[c["split"]]
        if c["expect"]:
            s["tp" if ok else "fn"] += 1
        else:
            s["tn" if ok else "fp"] += 1
        others = sorted({x for r in c["runs"] for x in r["skills"] if SKILL not in x})
        rows.append((cid, c["split"], "应触发" if c["expect"] else "不应触发", f"{hits}/{n}", "✓" if ok else "✗", ", ".join(others)))
    print("\n| id | split | 期望 | 触发 | 判定 | 其他 skill |\n|---|---|---|---|---|---|")
    for r in rows:
        print("| " + " | ".join(r) + " |")
    for sp, s in agg.items():
        pos, neg = s["tp"] + s["fn"], s["tn"] + s["fp"]
        if pos + neg:
            print(f"{sp}: 正例召回 {s['tp']}/{pos} · 负例不误触 {s['tn']}/{neg} · 准确 {(s['tp'] + s['tn'])}/{pos + neg}")
    json.dump({"skill": SKILL, "runs": a.runs, "cwd": a.cwd, "when": time.strftime("%Y-%m-%d %H:%M"), "agg": agg, "cases": list(results.values())},
              open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("→", a.out)


if __name__ == "__main__":
    main()
