#!/usr/bin/env python3
"""forge-design-lab · 常驻工作台服务。保存直写仓库，不再选目录、不再下载。

2026-10-23 起服务本体在 design-studio（独立工具，`design_studio.py lab`），这里只转调它；用法、端口、接口、回执都不变：
  python3 serve.py <repo_root> [--port 4577]   启动（前台；用 & 或 run_in_background 挂后台）
  python3 serve.py <repo_root> --status        查状态
  python3 serve.py <repo_root> --stop          停止
找不到 design-studio 时会提示安装命令；装在别处用环境变量 DESIGN_STUDIO_HOME 指过去。
被 import 时（如评测脚本调 serve.merge_and_write）导出 design-studio 骨架模式 studio.lab_mode 的函数和常量（合并、写盘、回执、零件库等），
供脚本直接调用；命令行行为和原来的 serve.py 一样。原来的 main、make_handler 等服务内部函数不再导出（没有调用方）。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _design_studio as DS  # noqa: E402

if __name__ == '__main__':
    os.execv(sys.executable, [sys.executable, '-I', DS.entry(), 'lab'] + sys.argv[1:])

_m = DS.load('studio.lab_mode')
globals().update({k: v for k, v in vars(_m).items() if not k.startswith('__')})
