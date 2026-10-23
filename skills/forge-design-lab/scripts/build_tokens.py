#!/usr/bin/env python3
"""forge-design-lab · build_tokens：2026-10-23 起本体在 design-studio（studio/lab/build_tokens.py），这里转调。

命令行用法和 `import build_tokens` 都不变（本文件把它的全部函数和常量原样导出）。说明和用法见那边文件开头。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _design_studio as DS  # noqa: E402

_m = DS.load('studio.lab.build_tokens')
globals().update({k: v for k, v in vars(_m).items() if not k.startswith('__')})

if __name__ == '__main__':
    sys.exit(_m.main() or 0)
