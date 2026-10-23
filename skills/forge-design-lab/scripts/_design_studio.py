"""找到 design-studio：forge-design-lab 的运行时（工作台服务、token 工具、引擎和零件库页面的母本）都在那个独立工具里。

找的顺序：环境变量 DESIGN_STUDIO_HOME → ~/.design-studio → ~/design-studio → 本 skill 所在 forge-skills 仓库往上两级的 工具/design-studio
（作者的工作区布局：<工作区>/Skill/forge-skills 和 <工作区>/工具/design-studio）。都没有就提示怎么装，退出。
"""
import importlib
import os
import sys

INSTALL = 'git clone https://github.com/antonailog/design-studio.git ~/.design-studio'


def home():
    here = os.path.dirname(os.path.realpath(__file__))     # 真实路径：skill 用软链装进 ~/.claude/skills 时指回仓库
    cands = [os.environ.get('DESIGN_STUDIO_HOME'), os.path.expanduser('~/.design-studio'), os.path.expanduser('~/design-studio'),
             os.path.join(here, '..', '..', '..', '..', '..', '工具', 'design-studio')]
    for c in cands:
        if c and os.path.isfile(os.path.join(c, 'design_studio.py')):
            return os.path.abspath(c)
    sys.exit('✗ 找不到 design-studio（forge-design-lab 的工作台服务和 token 工具在那里）。\n'
             f'  安装：{INSTALL}\n'
             '  装在别处就用环境变量 DESIGN_STUDIO_HOME 指到它的目录。')


def load(module):
    """按模块名从 design-studio 导入，如 load('studio.lab.build_tokens')。"""
    h = home()
    if h not in sys.path:
        sys.path.insert(0, h)
    return importlib.import_module(module)


def asset(*parts):
    """design-studio 里骨架模式的前端母本：asset('workbench')、asset('system')、asset('page-pack-template.html')。"""
    return os.path.join(home(), 'web', 'lab', *parts)


def entry():
    return os.path.join(home(), 'design_studio.py')
