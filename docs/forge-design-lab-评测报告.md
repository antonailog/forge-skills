# forge-design-lab 评测报告（S4）与落地记录（S3 / S5）

> 2026-09-20 · 完整档 · 只写实际跑过的；没跑的明说。

## 1. S3 落地了什么

| 产物 | 位置 | 体检 |
|---|---|---|
| SKILL.md | `skills/forge-design-lab/SKILL.md` | `validate_skill.py`：0 error / 0 warning；description 338 字符；正文 125 行；红线 3 条；强调词 1 处 |
| references（5） | spec-schema · seven-layers · engine-hooks · pitfalls · example-ai-search | 每份在 SKILL.md「按需读取」点名读取时机 |
| scripts（6） | adapt_tokens.py · build_tokens.py · scaffold_pack.py · verify_pack.mjs · render_design_table.py · merge_saved.py（§5 补） | 全部在两个仓库上实跑（见 §2、§5） |
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

## 4. 首次真实使用（2026-09-20 14:23，用户独立操作）

用户在 ai-search 工作台改值、标结局、保存（下载兜底），全程没回到对话要我改值。K7/K8 与 H1/H2 的第一份真实数据：

| 项 | 数据 | 判读 |
|---|---|---|
| K7 用户改值全部进 css | 3 处（`s.col-margin` 16→48、`sp.col-pt` 32→48、`sp.col-pb` 64→48），合并重建后 `--check` 通过 | ✓ |
| K8 反馈条数 = 回复条数 | 新增 0 条（导出里那 9 条是上一轮的，已答） | ✓（本轮无新反馈） |
| H1 一次坐下来走完七层 | 中途回到对话改值 **0 次** ✓；但七层结局覆盖只有 **7/93**（结构 2、排版 2、间距 3；层级/色彩/状态与动效/一致性 **全 0**） | ✗ 不能算走完 |
| H2 判断题可答 | 2 个节点标「拿不准」并附带值，没有「不知道你在问什么」 | ✓ |

H1 不达标暴露的是工具问题，不是用户问题：**看过一层但不逐个点结局，文件里就留不下痕迹**。24 个色彩节点要用户点 24 次「通过」才算走过，没人会这么干。

## 5. S5 迭代（本轮真实使用直接催生，均已实现并验证）

| # | 发现 | 动作 |
|---|---|---|
| 1 | 用户导出的 json **结构过期**：89 节点（缺我当天新增的 3 个）、无 `schemaVersion`/`prefix`、`layout` 无 `el`。SKILL.md 原来写「以用户文件为准覆盖」，照做会抹掉当天的结构改动 | 新增 `scripts/merge_saved.py`：按 id 合并（值/结局/反馈取用户的，结构取仓库的），报出「用户没见过的节点」，`--apply` 时自动写 baseline 记账；SKILL.md S4 改写、失败表改正、`pitfalls.md` 加第 12 条 |
| 2 | 记账事后手改 json 会漏掉重建，`--check` 当场报不同源 | 记账并进 `merge_saved.py --apply`，不再手改 |
| 3 | 走查痕迹留不下（H1 不达标） | 引擎每层头部加「整层通过」按钮：把本层未表态且未改值的节点一次标 `pass`；实测点一次给色彩层 24 个 `pass`、持久化正确、再点提示「本层已全部表过态」、零 JS 错误 |
| 4 | 「对齐」无法表达：左区上留白是写死的 `32px`，用户没法把「卡顶对齐搜索框顶」当成决策 | 新增节点 `sp.left-pt`（左区上留白），骨架里的字面值换成 `var(--ai-left-pt)`；字面像素值 31 → 30 |
| 5 | 删减动作（每轮必须有） | 删 forge-design 内的旧引擎副本（双母本）、删 ai-search 的本地 `tokens_build.py`、引擎去 `AI_TOKENS` 别名与 ai-search 专名 |

改完复跑：`validate_skill.py` 0 error / 0 warning；页面包 verify **12 PASS / 1 WARN / 0 FAIL**（WARN 为剩余 30 行字面像素值）。

## 6. 仍然没跑的（明说）

- **基线对照（with / without 跑 K1–K9 打分）**：没跑。K3/K4/K6 没有 skill 时必然为 0（没有引擎和生成器），跑了只能证明「基建存在」；有区分度的 K1/K7/K8 需要第二个真实页面包才能测。
- **H1 复测**：等用户用上「整层通过」再走一轮，看覆盖度能不能从 7/93 起来。
- **D1 实现还原 ≤ 2px**：留空，实现轮 forge-qa 跑。

## 7. 给用户的待办

1. 审阅设计文档与 SKILL.md；有异议直接改文档，我按文档改 skill。
2. **刷新工作台页面**再走下一轮——你这次的导出是旧页面，缺 3 个节点（`sp.card-thumb-auto`、`sp.card-thumb-fit`、`sp.hint-reserve`），刷新后才能看到它们和新的「整层通过」。
3. 定 `sp.col-pt` / `sp.col-pb`（你标的两个拿不准），备选与实测已写进判断题 J11 / J12。
4. 剩余 30 行字面像素值哪些该进 token。
