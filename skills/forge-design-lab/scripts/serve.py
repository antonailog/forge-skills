#!/usr/bin/env python3
"""forge-design-lab · 常驻工作台服务。保存直写仓库，不再选目录、不再下载。

用法:
  python3 serve.py <repo_root> [--port 4577] [--open <page>]   启动（前台；用 & 或 run_in_background 挂后台）
  python3 serve.py <repo_root> --status                        查状态
  python3 serve.py <repo_root> --stop                          停止

做什么:
  · 静态根 = 仓库根。页面 URL 形如 /docs/assets/visuals/<page>/<file>.html，
    页面里那些 ../../../../frontend-react/... 的相对路径原样可用，页面包一行都不用改。
  · GET  /api/lab/status          → 绑定的仓库路径、端口、已发现的页面包
  · POST /api/lab/save            → 按 id 合并后直写三文件；回执写 last-save.json，并追加一行到 saves.jsonl
                                    （last-save.json 会被下一次覆盖；连点两次保存时第二次报「无值改动」，
                                     只看它会漏掉第一次的改动。差异表一律以 git diff 为准，回执只作辅助。）
  · GET  /api/lab/packs           → 页面包索引

保存为什么要合并而不是覆盖:
  工作台页面一加载 spec 就固定在内存里。你在页面开着的时候 Agent 改了 json，
  这一存就会把新增节点抹掉——而且直写成功了，你只会看到「已保存」。
  所以服务端按 id 合并：值/结局/反馈取页面的，结构取磁盘的，并把「你没见过的节点」回给页面。

安全边界: 只绑 127.0.0.1；只允许写 spec 里 files.{json,js,css} 三个路径，且必须落在仓库根内。
"""
import argparse
import datetime
import hashlib
import json
import os
import signal
import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_tokens as BT  # noqa: E402

STATE_REL = os.path.join(".forge", "design-lab")
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
        ".woff2": "font/woff2", ".map": "application/json"}


def state_dir(repo):
    d = os.path.join(repo, STATE_REL)
    os.makedirs(d, exist_ok=True)
    return d


def server_file(repo):
    return os.path.join(state_dir(repo), "server.json")


def read_server(repo):
    try:
        with open(server_file(repo), encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def alive(port):
    with socket.socket() as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def pack_rev(repo, name):
    """页面包的版本戳：spec、生成物、骨架、引擎的 mtime+size 摘要。
    页面拿它和自己启动时记下的比，一旦不同就知道 Agent 在这期间改过文件。
    没有这个，页面可以一直显示旧稿而用户毫不知情——保存下去还会把旧值写回磁盘。"""
    d = os.path.join(repo, "docs", "assets", "visuals", name)
    paths = [os.path.join(d, f"{name}.tokens.json"), os.path.join(d, f"{name}.tokens.js"),
             os.path.join(repo, "docs", "assets", "visuals", "_workbench", "workbench.js")]
    paths += sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith(".html")) if os.path.isdir(d) else []
    h = hashlib.sha1()
    for p in paths:
        try:
            st = os.stat(p)
            h.update(f"{os.path.basename(p)}:{int(st.st_mtime)}:{st.st_size};".encode())
        except OSError:
            h.update(f"{os.path.basename(p)}:missing;".encode())
    return h.hexdigest()[:12]


def find_packs(repo):
    base = os.path.join(repo, "docs", "assets", "visuals")
    out = []
    if not os.path.isdir(base):
        return out
    for name in sorted(os.listdir(base)):
        d = os.path.join(base, name)
        if not os.path.isdir(d) or name.startswith("_"):
            continue
        spec = os.path.join(d, f"{name}.tokens.json")
        if not os.path.exists(spec):
            continue
        htmls = sorted(f for f in os.listdir(d) if f.endswith(".html"))
        try:
            with open(spec, encoding="utf-8") as fh:
                s = json.load(fh)
        except (OSError, ValueError):
            continue
        out.append({"page": name, "title": s.get("title") or name, "version": s.get("version"),
                    "nodes": len(s.get("nodes") or []), "updated": s.get("updated"),
                    "exported": s.get("exported"),
                    "questions": sum(1 for n in s.get("nodes") or [] if n.get("q")),
                    "feedback": len(s.get("feedback") or []),
                    "html": [f"/docs/assets/visuals/{name}/{h}" for h in htmls],
                    "rev": pack_rev(repo, name)})
    return out


def merge_and_write(repo, incoming):
    """按 id 合并页面提交的 spec 到磁盘 spec，写三文件与回执。返回报告。"""
    rel = (incoming.get("files") or {}).get("json")
    if not rel:
        raise ValueError("spec 里没有 files.json")
    spath = os.path.join(repo, rel)
    if not os.path.abspath(spath).startswith(os.path.abspath(repo) + os.sep):
        raise ValueError("越界路径")
    if not os.path.exists(spath):
        raise ValueError(f"磁盘上没有 {rel}")
    with open(spath, encoding="utf-8") as fh:
        disk = json.load(fh)

    dk = {n["id"]: n for n in disk["nodes"]}
    ik = {n["id"]: n for n in incoming.get("nodes") or []}
    only_disk = sorted(set(dk) - set(ik))      # 页面没见过的新节点
    only_page = sorted(set(ik) - set(dk))      # 磁盘已删的节点
    stale = bool(only_disk or only_page)

    changes = []
    for nid, inode in ik.items():
        dnode = dk.get(nid)
        if dnode is None:
            continue
        if inode.get("value") != dnode.get("value"):
            changes.append({"id": nid, "label": dnode.get("label"), "from": dnode.get("value"),
                            "to": inode.get("value"), "mod": dnode.get("mod"), "g": dnode.get("g")})
            dnode["value"] = inode.get("value")

    dec_in = incoming.get("decisions") or {}
    disk["decisions"] = {k: v for k, v in dec_in.items() if k in dk}
    old_fb = disk.get("feedback") or []
    seen = {(f.get("at"), f.get("t")) for f in old_fb}
    new_fb = [f for f in (incoming.get("feedback") or []) if (f.get("at"), f.get("t")) not in seen]
    disk["feedback"] = old_fb + new_fb
    disk["exported"] = incoming.get("exported") or datetime.datetime.now().isoformat(timespec="seconds")
    counts = {}
    for v in disk["decisions"].values():
        counts[v.get("r") or "（无）"] = counts.get(v.get("r") or "（无）", 0) + 1
    disk["baseline"] = {"from": f"工作台服务保存 {disk['exported']}" + ("（页面结构过期→按 id 合并）" if stale else ""),
                        "changed": len(changes),
                        "changed_after": " ".join(f"{c['id']}={c['to']}" for c in changes) or "无值改动",
                        "unsure": sorted(k for k, v in disk["decisions"].items() if v.get("r") == "unsure"),
                        "stale_nodes_user_not_seen": only_disk}

    errs, warns = BT.validate(disk)
    if errs:
        raise ValueError("合并后 json 校验失败：" + "；".join(errs[:5]))
    # 回执会被下一次保存覆盖。连点两次保存时，第二次看到磁盘已是新值、报「无值改动」，
    # 第一次的改动记录就没了，Agent 照回执读会漏掉用户的决定。所以另存一份追加流水。
    for k, text in (("json", json.dumps(disk, ensure_ascii=False, indent=1)),
                    ("js", BT.build_js(disk)), ("css", BT.build_css(disk))):
        p = os.path.join(repo, disk["files"][k])
        if not os.path.abspath(p).startswith(os.path.abspath(repo) + os.sep):
            raise ValueError("越界路径：" + disk["files"][k])
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(text)

    # 到这里三个文件已经落盘，这就是提交点。之后的任何失败都不准把请求报成失败——
    # 否则用户看到「保存失败」而数据其实已经写进去了，他会以为工作没了、重做一遍，
    # 或者像这次一样让 Agent 误判、把已保存的内容当成脏数据清掉。（2026-09-21 实发）
    report = {"at": disk["exported"], "repo": repo, "page": disk.get("page"), "version": disk.get("version"),
              "stale": stale, "nodes_user_not_seen": only_disk, "nodes_removed": only_page,
              "changes": changes, "decisions": counts, "new_feedback": new_fb,
              "files": [disk["files"][k] for k in ("json", "js", "css")], "warnings": warns}
    try:
        report["rev"] = pack_rev(repo, disk.get("page") or "")
    except Exception as exc:                        # noqa: BLE001 — 附加信息，坏了不能影响保存
        report["warnings"] = warns + [f"版本戳算不出来：{exc}"]
    for name, mode in (("last-save.json", "w"), ("saves.jsonl", "a")):
        try:
            with open(os.path.join(state_dir(repo), name), mode, encoding="utf-8") as fh:
                if mode == "a":
                    fh.write(json.dumps(report, ensure_ascii=False) + "\n")
                else:
                    json.dump(report, fh, ensure_ascii=False, indent=1)
        except OSError as exc:
            report.setdefault("warnings", warns).append(f"回执写不进去（文件已保存）：{exc}")
    return report


def make_handler(repo):
    class H(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *a):
            if "/api/lab/save" in (a[0] if a else ""):
                sys.stderr.write("[save] %s\n" % (a[0],))

        def _send(self, code, body: bytes, ctype="application/json; charset=utf-8"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, code, obj):
            self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

        def do_GET(self):
            path = unquote(urlparse(self.path).path)
            if path == "/api/lab/status":
                packs = find_packs(repo)
                return self._json(200, {"ok": True, "repo": repo, "repoName": os.path.basename(repo),
                                        "port": self.server.server_address[1], "packs": len(packs),
                                        "revs": {p["page"]: p["rev"] for p in packs}})
            if path == "/api/lab/packs":
                return self._json(200, {"repo": repo, "packs": find_packs(repo)})
            if path in ("/", "/index.html"):
                return self._send(200, gallery(repo).encode("utf-8"), MIME[".html"])
            p = os.path.normpath(os.path.join(repo, path.lstrip("/")))
            if not p.startswith(repo) or not os.path.isfile(p):
                return self._send(404, b"not found", "text/plain; charset=utf-8")
            ctype = MIME.get(os.path.splitext(p)[1], "application/octet-stream")
            with open(p, "rb") as fh:
                return self._send(200, fh.read(), ctype)

        def do_POST(self):
            path = unquote(urlparse(self.path).path)
            if path != "/api/lab/save":
                return self._json(404, {"ok": False, "error": "unknown endpoint"})
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > 32 * 1024 * 1024:
                return self._json(400, {"ok": False, "error": "bad body size"})
            try:
                incoming = json.loads(self.rfile.read(n).decode("utf-8"))
                report = merge_and_write(repo, incoming)
                return self._json(200, {"ok": True, **report})
            except Exception as e:  # noqa: BLE001 — 回给页面显示
                return self._json(400, {"ok": False, "error": str(e)})
    return H


def gallery(repo):
    packs = find_packs(repo)
    rows = "".join(
        f'<li><a href="{p["html"][0] if p["html"] else "#"}"><b>{p["title"]}</b>'
        f'<span>{p["page"]} · {p.get("version") or ""} · {p["nodes"]} 节点 · {p["questions"]} 判断题'
        f' · {p["feedback"]} 反馈</span></a></li>' for p in packs)
    return f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>设计工作台 · {os.path.basename(repo)}</title><style>
body{{font:14px/1.6 system-ui,-apple-system,'PingFang SC',sans-serif;background:#F4F3EF;color:#1A1917;margin:0;padding:40px}}
.w{{max-width:720px;margin:0 auto}} h1{{font-size:20px;margin:0 0 4px}}
.sub{{font:12px ui-monospace,Menlo,monospace;color:#6B6A65;margin-bottom:24px}}
ul{{list-style:none;padding:0}} li{{margin:0 0 10px}}
a{{display:block;padding:14px 16px;background:#fff;border:1px solid #E4E2DC;border-radius:6px;text-decoration:none;color:inherit}}
a:hover{{border-color:#C65A1E}} b{{display:block;font-size:15px}}
span{{font:11.5px ui-monospace,Menlo,monospace;color:#6B6A65}}
.e{{color:#6B6A65}}</style></head><body><div class="w">
<h1>设计工作台</h1><div class="sub">{repo}</div>
{'<ul>'+rows+'</ul>' if packs else '<p class="e">这个仓库还没有页面包。用 adapt_tokens.py + scaffold_pack.py 建一个。</p>'}
</div></body></html>"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("--port", type=int, default=0, help="默认 4577，被占用则自动递增")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--stop", action="store_true")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo)
    if not os.path.isdir(repo):
        print("✗ 仓库路径不存在:", repo)
        sys.exit(1)

    cur = read_server(repo)
    if a.status:
        if cur and alive(cur["port"]):
            print(f"✓ 在跑 · http://127.0.0.1:{cur['port']}/ · pid {cur['pid']} · 绑定 {cur['repo']}")
            for p in find_packs(repo):
                print(f"    {p['page']:<14} {p.get('version') or '':<8} {p['nodes']} 节点  http://127.0.0.1:{cur['port']}{p['html'][0] if p['html'] else ''}")
        else:
            print("· 没在跑")
        return
    if a.stop:
        if cur and alive(cur["port"]):
            try:
                os.kill(cur["pid"], signal.SIGTERM)
                print(f"✓ 已停止 pid {cur['pid']}")
            except OSError as e:
                print("✗ 停止失败:", e)
        else:
            print("· 没在跑")
        try:
            os.remove(server_file(repo))
        except OSError:
            pass
        return

    if cur and alive(cur["port"]):
        print(f"= 已经在跑，不重复启动 · http://127.0.0.1:{cur['port']}/ · pid {cur['pid']}")
        return
    port = a.port or 4577
    while port < 4600 and alive(port):
        port += 1
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(repo))
    with open(server_file(repo), "w", encoding="utf-8") as fh:
        json.dump({"pid": os.getpid(), "port": port, "repo": repo,
                   "started": datetime.datetime.now().isoformat(timespec="seconds")}, fh, ensure_ascii=False)
    print(f"✓ 工作台服务 http://127.0.0.1:{port}/   绑定 {repo}")
    for p in find_packs(repo):
        print(f"    {p['page']:<14} http://127.0.0.1:{port}{p['html'][0] if p['html'] else ''}")
    sys.stdout.flush()
    def bye(*_):
        try:
            os.remove(server_file(repo))
        except OSError:
            pass
        httpd.shutdown()
    signal.signal(signal.SIGTERM, bye)
    signal.signal(signal.SIGINT, bye)
    threading.Thread(target=httpd.serve_forever, daemon=False).start()


if __name__ == "__main__":
    main()
