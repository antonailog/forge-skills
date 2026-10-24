"""找到 design-studio：forge-design-lab 的运行时（工作台服务、token 工具、引擎和零件库页面的母本）都在那个独立工具里。

找的顺序：环境变量 DESIGN_STUDIO_HOME（设了就只认它）→ ~/.design-studio → ~/design-studio → 本 skill 所在 forge-skills 仓库往上两级的
工具/design-studio（作者的工作区布局：<工作区>/Skill/forge-skills 和 <工作区>/工具/design-studio）。要求是带骨架模式的版本。
都没有就提示怎么装（版本太旧就提示 git pull），退出码 69。
"""
import importlib
import os
import sys

INSTALL = 'git clone https://github.com/antonailog/design-studio.git ~/.design-studio'
EX_MISSING = 69   # 找不到可用的 design-studio（EX_UNAVAILABLE）；和 build_tokens 的 1 = json 校验失败、2 = 不同源区分开
NEED = ('design_studio.py', os.path.join('studio', 'lab_mode.py'), os.path.join('web', 'lab', 'workbench', 'workbench.js'))   # 有骨架模式的版本


def _die(msg):
    sys.stderr.write(msg + '\n')
    sys.exit(EX_MISSING)


def _usable(d):
    return all(os.path.isfile(os.path.join(d, f)) for f in NEED)


def home():
    env = os.environ.get('DESIGN_STUDIO_HOME')
    if env:   # 显式指定了就只认它，指错了直接说，不悄悄换别的
        if _usable(env):
            return os.path.abspath(env)
        old = os.path.isfile(os.path.join(env, 'design_studio.py'))
        _die(f'✗ 环境变量 DESIGN_STUDIO_HOME={env} ' + (f'里的 design-studio 版本太旧，没有骨架模式。更新：cd {env} && git pull'
                                                      if old else f'指向的目录不是 design-studio。改对它，或者去掉它用默认位置（{INSTALL}）'))
    here = os.path.dirname(os.path.realpath(__file__))     # 真实路径：skill 用软链装进 ~/.claude/skills 时指回仓库
    cands = [os.path.expanduser('~/.design-studio'), os.path.expanduser('~/design-studio'),
             os.path.join(here, '..', '..', '..', '..', '..', '工具', 'design-studio')]
    for c in cands:
        if _usable(c):
            return os.path.abspath(c)
    old = next((c for c in cands if os.path.isfile(os.path.join(c, 'design_studio.py'))), None)
    if old:
        _die(f'✗ {os.path.abspath(old)} 里的 design-studio 版本太旧，没有骨架模式。更新：cd {os.path.abspath(old)} && git pull')
    _die('✗ 找不到 design-studio（forge-design-lab 的工作台服务和 token 工具在那里）。\n'
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
