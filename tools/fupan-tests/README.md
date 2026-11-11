# forge-fupan 服务验收

全部用 Python 3.9+ 标准库，不需要安装依赖。仓库根运行：

```bash
cd tools
/usr/bin/python3 -m unittest discover -s fupan-tests -v
```

`HTTPTests` 用临时的 `FUPAN_ROOT`、`FUPAN_KB`，起 `127.0.0.1` 随机端口，发真实 HTTP 请求；生成只用临时的假 Claude CLI。覆盖接口、校验、安全头、静态目录边界、视频 Range、并发写入、生成失败与重试、重启恢复和端口占用。不会调用真实 Claude，也不写作者的数据。

沙箱不允许开端口时，正式门禁会报错，不自动跳过。可另跑下面的补充检查：同一批接口断言直接调用 HTTP handler，用内存流收发，不开端口；不能算真 HTTP 门禁通过。

```bash
cd tools/fupan-tests
/usr/bin/python3 -m unittest test_serve.NoSocketTests test_serve.UnitTests -v
```

## 作者真实目录只读冒烟

仓库根运行：

```bash
/usr/bin/python3 tools/fupan-tests/smoke.py
```

脚本会以 `FUPAN_ROOT=/Users/dbwu/claudecode_workspace/记录/复盘 /usr/bin/python3 skills/forge-fupan/scripts/serve.py --port 4331` 启动服务，用 curl 验以下结果，最后停掉本次进程。不会用 4330，不创建划线，也不写真实目录。

| 请求 | 应有结果 |
| --- | --- |
| `/api/health` | 200，`{"ok":true}` |
| `/` | 302，Location 是编码后的 `/记录/复盘/index.html` |
| `/记录/复盘/index.data.js` | 200，JavaScript |
| `/知识/知识图谱/2-结果区/经验库/图/` 下任一 png | 200，image/png |
| `/.mcp.json` | 404 |
| `/工具/` 下任一真实文件 | 404 |

脚本先检查 `_划线/`：有 pending 生成任务，或已有数据却没有锁文件时，退出并说明原因，避免服务启动后恢复生成或补建锁。前后核对 `_划线/` 文件和目录的元数据；服务启动失败就报告原始 stderr，不连接其他进程。日志只放系统临时文件。

## 原有编译校验

`build.py --check` 原本要求带复盘文件夹，裸命令会报「给一个复盘文件夹」。保持这个行为，使用已有目录只读校验：

```bash
/usr/bin/python3 skills/forge-fupan/scripts/build.py --check
/usr/bin/python3 skills/forge-fupan/scripts/build.py \
  /Users/dbwu/claudecode_workspace/记录/复盘/forge-skills/复盘工具/2026-11-11-经验与工作台上线 --check
```

第一条记录任务书原命令的结果；第二条校验原有数据，不编页面、不回写库。
