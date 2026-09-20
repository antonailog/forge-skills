# 2026-09-20 · forge-design-lab 建包前快照

建 `forge-design-lab` 时改动了 forge-design 第三步与共享视觉决策层，按 skill-build 红线在动手前做了 `cp -r` 全量快照。这里只保留**无法从 git 历史恢复的部分**，全量副本里其余文件（references/ · scripts/ · data/ 八个 CSV · __pycache__）逐字节等同当时仓库内容，已被 git 覆盖，不再重复入库。

| 文件 | 是什么 | 对应的新版本 |
|---|---|---|
| `forge-design-SKILL.md` | forge-design SKILL.md 改动前（git 历史 95d1b1c 起） | `skills/forge-design/SKILL.md` |
| `visual-decision-layer.md` | 共享视觉决策层改动前（git 历史 c6a588d 起） | `skills/_shared/visual-decision-layer.md` |
| `workbench-original/workbench.{js,css}` | 引擎通用化前的原件。当时放在 `skills/forge-design/assets/workbench/`，**从未进过 git**，所以必须留档 | `skills/forge-design-lab/assets/workbench/` |
| `workbench-original/tokens_build.py` | 退役的 ai-search 专用生成器，`build_tokens.py` 的前身 | `skills/forge-design-lab/scripts/build_tokens.py` |

引擎通用化改了五处：去掉 `AI_TOKENS` 别名与 ai-search 专名、生成器改指 build_tokens.py、css 头注释不再写死 globals.css、保存目录提示按 spec 的 `repoName`/`files` 生成、线框区域按 `layout[].el` 映射 `data-id`。
