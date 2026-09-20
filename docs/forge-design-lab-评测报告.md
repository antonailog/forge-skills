# forge-design-lab 评测报告（S4）与落地记录（S3 / S5）

> 2026-09-20 · 完整档 · 只写实际跑过的；没跑的明说。

## 1. S3 落地了什么

| 产物 | 位置 | 体检 |
|---|---|---|
| SKILL.md | `skills/forge-design-lab/SKILL.md` | `validate_skill.py`：0 error / 0 warning；description 338 字符；正文 124 行；红线 3 条；强调词 1 处 |
| references（5） | spec-schema · seven-layers · engine-hooks · pitfalls · example-ai-search | 每份在 SKILL.md「按需读取」点名读取时机 |
| scripts（5） | adapt_tokens.py · build_tokens.py · scaffold_pack.py · verify_pack.mjs · render_design_table.py | 全部在两个仓库上实跑（见 §2） |
| assets | `workbench/workbench.{js,css}` 引擎母本 · `page-pack-template.html` | 引擎自 forge-design/assets 迁入并通用化（去 ai-search 专名与 `AI_TOKENS` 别名、生成器统一为 build_tokens.py、`layout.el` 映射、保存目录提示按 spec 生成） |
| 上游改动 | `forge-design/SKILL.md` 第三步与总览、description；`_shared/visual-decision-layer.md` | 快照 `_archive/snapshots/forge-design-2026-09-20-pre-design-lab/`、`visual-decision-layer-2026-09-20.md` |
| 登记 | README 表格与目录树、docs/skills-reference.md §4.1、CHANGELOG Unreleased | — |
| 安装 | `./install.sh --target claude` → `~/.claude/skills/forge-design-lab` symlink | 本会话内 Skill 列表已出现 |
| 范例回填 | info2action `ai-search-mvp` 分支 101f40ee | json 补 schemaVersion/prefix/repoName/layout.el；HTML 加 `@lab` 标记；js/css 用新生成器重建；DESIGN.md 模块 28 章末插入生成区块；CLAUDE.md 路由表加本 skill |

## 2. 机器可判考点（K1–K6，实跑）

### 2.1 范例页面包（info2action / ai-search v32.1，92 节点）

`node verify_pack.mjs …/2026-09-20-skeleton-v32.1.html --repo <worktree>`：**PASS 12 · WARN 1 · FAIL 0**

| 考点 | 结果 |
|---|---|
| K3 零 JS 错误 | ✓ 零 pageerror / console.error / file:// 失败 |
| K4 同源 | ✓ `<link id=tokcss>` 已加载；61 个变量文件值 = json 基线；`build_tokens.py --check` 通过（62 变量含 1 个 raw） |
| K5 字面像素值 | ⚠ 组件 CSS 31 行未 token 化、未标 fixed（按钮内距、提示行高、列表缩进、空态内距、骨架屏条高等）——下一轮审查时决定哪些进 token |
| K6 映射 | ✓ 所有带 maps 的节点命中元素 |
| K2 线框↔骨架 | ✓ 6 个区域（`doc` 显式 `el: null`） |
| 交互烟测 | ✓ 线框 6 区域 · 点节点跳转 · 检查模式点中心选中 3 个 token（同模块） · 反馈行首编号解析 2/2 · 390 手机 `.mob` 生效 · 跟随窗口 1036×900 = 1440 − 面板 404 · 字体 ✓ · 引擎同源检查绿 |
| K1 阶梯来自用量 | ✓ `adapt_tokens.py` 在 info2action 上：78 个站点变量、Google Fonts 4 族、字号阶梯 14 档（12×209 / 13×198 / 14×175 最常用）、间距 10 档、圆角 6 档；tailwind fontFamily 6 角色被识别并提示 |

截图：线框 / 整站 / 页面 × 6 状态 / 模块放大 / 手机 / 指南 tab（scratchpad `verify-ai-search/`，未入库）。

### 2.2 全新演示仓库（scratchpad，复制 info2action 前端源码）

从零跑 `adapt --init-spec → 填 4 节点 → build → scaffold → 注入最小骨架 → verify`：**PASS 12 · WARN 1（2 行字面值，为演示注入的）· FAIL 0**；`render_design_table.py` 在无 DESIGN.md 时正确退出码 3 并打印区块。证明脚手架在没有任何手工准备的仓库上能起一个可审查的页面包。

### 2.3 实跑中修掉的脚本缺陷（都已修，属 S3 内迭代）

- `verify_pack.mjs` 的 `<link>` 加载检查在 file:// 下误报（跨目录样式表 `cssRules` 抛 SecurityError）→ 改看 `sheet` 是否存在。
- `adapt_tokens.py --prefix --ai` 被 argparse 吞 → 改为 `--prefix ai`（脚本补 `--`），SKILL.md 同步。
- `adapt_tokens.py` 把页面包自己的 `*.tokens.css` 当站点变量，误报「前缀撞站点变量」→ 跳过 `.tokens.css/.tokens.js/.adapt.json`。
- macOS 无 `timeout` → 评测跑器改用 Python subprocess 超时。

## 3. 路由考点 R1（触发评测，实跑）

跑器 `evals/forge-design-lab/run_trigger_eval.py`：`claude -p` + `--max-turns 1`，放开 Skill/Read/Grep/Glob（模型仍可试 Bash），cwd 为 info2action worktree（含项目 CLAUDE.md 路由表）。每条 3 次。

| 集 | 正例召回 | 负例不误触 | 准确 |
|---|---|---|---|
| train（6 正 + 6 负） | 6/6 | 6/6 | 12/12 |
| test（4 正 + 4 负） | 4/4 | 4/4 | 8/8 |
| 追加加难（1 正 + 3 负，首轮全对后加） | 1/1 | 3/3 | 4/4 |

72 次运行 0 次误判；正例 33/33 次首轮直接调 `Skill(forge-design-lab)`（平均 12 s），负例 39/39 次未调本 skill（n1、n3 正确转给 forge-design，其余首轮走 Bash 自己动手）。追加的三条负例专门打同词干扰：「复盘工作台」代码改动、明确「直接改 Tailwind 不用讨论」的字号改动、单步读 token 值——都没误触。

结果文件：`evals/forge-design-lab/results-2026-09-20.json`、`results-2026-09-20-extra.json`。

**判读与保留意见**：24 条全对说明 description 的排除项和「哪怕没提工作台」两段起了作用，但也说明这套 query 还不够刁钻；下一轮该加的是「用户在 forge-design 讨论中途顺口提到比例」这类潜在意图（SKILL.md 里定为反问不自动开），以及跨 skill 长对话里的第二轮路由——本跑器只看首轮。

## 4. 没有跑的（明说）

- **基线对照（with / without skill 跑 K1–K9 打分）**：没跑。K3/K4/K6 没有 skill 时必然为 0（没有引擎和生成器），跑了也只能证明「基建存在」；有区分度的是 K1/K7/K8，它们要一个真实的新页面包和一轮用户保存才能测，本轮没有第二个真实页面。
- **人可判 H1/H2**（一次走完七层并保存、判断题可答）：等用户在 ai-search 工作台走下一轮时记录。
- **D1 实现还原 ≤ 2px**：留空，实现轮 forge-qa 跑。

## 5. S5 迭代记录

本轮评测没有失分项，不改 description、不改正文。建包过程中的删减动作（每轮必须有）：删掉 forge-design 内的旧引擎副本（避免双母本）、删掉 ai-search 目录里的本地 `tokens_build.py`（被 skill 脚本取代）、引擎去掉 `AI_TOKENS` 别名与 ai-search 专名。停止条件：评测无实质发现，等用户实机走一轮再进下一次 S5。

## 6. 给用户的待办

1. 审阅 `docs/forge-design-lab-设计文档.md` 与 `skills/forge-design-lab/SKILL.md`；有异议直接改文档，我按文档改 skill。
2. 在 ai-search 工作台走一轮七层并保存（H1/H2 的第一份数据）；顺便看 31 处字面像素值哪些该进 token。
3. forge-skills 仓库本次改动未提交（与你未提交的 fupan 改动并存）；确认后我按路径提交，不碰 fupan 那几处。
