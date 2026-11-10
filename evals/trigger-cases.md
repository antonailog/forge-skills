# 触发评估用例集（trigger-cases）

> 用途：任何人修改任一 skill 的 frontmatter description（尤其是触发短语）后，人工把本表过一遍——逐条判断"按新 description，这句话会路由到哪个 skill"，与期望列对比。发现偏差就修 description，不改用例。
> 维护规则：新增触发词时同步补 1 条触发用例 + 1 条不触发用例；发生过一次真实误路由，就把那句话固化成用例。

## 一、应触发（正路由）

| # | 用户输入 | 期望路由 | 说明 |
|---|---|---|---|
| T1 | "我有个想法，帮我想想" | forge-brainstorm | 标准触发词 |
| T2 | "更新一下 PRD，加个导出功能" | forge-prd | 标准触发词 |
| T3 | "PRD 确认了，开始开发" | forge-dev | 标准触发词 |
| T4 | "端到端交付，一路到发布" | forge-dev --full | deliver 退役后并入的触发词 |
| T5 | "先看效果图再说" | forge-design | 视觉稿门禁入口 |
| T6 | "把设计稿实现成代码" | forge-design-impl | 只改样式不改逻辑 |
| T7 | "实现这个需求"（已有 Feature Spec） | forge-eng | 标准触发词 |
| T8 | "测试一下这个功能" | forge-qa Mode A | 标准触发词 |
| T9 | "列表页点了没反应，排查一下" | forge-bugfix | 报告异常行为 |
| T10 | "上线前检查一下代码" | forge-review | 新增触发词（2026-07-17） |
| T11 | "发 PR" | forge-ship | PR only 模式 |
| T12 | "合并上线" | forge-ship | Full ship 模式 |
| T13 | "ship 完了，把文档同步一下" | forge-doc-release | 新增触发词（2026-07-17） |
| T14 | "复盘一下今天的工作" | forge-fupan | 标准触发词 |
| T15 | "看下谁在跑，清理下 worktree" | forge-status | 标准触发词 |
| T16 | "这个文档应该放哪" | forge-doc-policy | 标准触发词 |
| T17 | "接下来做什么？" | forge（总入口） | 标准触发词 |

## 二、不应触发（负样本）

| # | 用户输入 | 期望行为 | 风险点 |
|---|---|---|---|
| N1 | "为什么天空是蓝的" | 直接回答，不触发任何 skill | bugfix 的"为什么不对"触发面过宽时会误吃疑问句 |
| N2 | "这里有问题吗？帮我看看这段代码写得好不好" | 直接代码点评，不进 bugfix | "这里有问题"是 bugfix 触发词，但这句是求评价不是报障 |
| N3 | "帮我写个脚本统计词频"（一次性小任务） | 直接写，不进 forge-eng 完整流程 | /forge 轻量车道存在的原因 |
| N4 | "测试环境的账号密码是什么" | 直接回答 | "测试"不等于要跑 QA |
| N5 | "帮我把这篇文章润色一下" | 直接改，不进 brainstorm | "帮我想想"类触发词不该吃写作任务 |
| N6 | "git 怎么撤销上一次 commit" | 直接回答 | 不是 ship/review 场景 |

## 三、易混淆（消歧路由）

| # | 用户输入 | 期望路由 | 消歧依据 |
|---|---|---|---|
| C1 | "/code-review" 或 "用 code-review 审一下" | 内置 code-review skill | 用户点名内置命令时不走 forge-review |
| C2 | "review 一下这个分支再上线" | forge-review | forge 工作流语境（分支/上线）→ forge-review；见其 description 分工说明 |
| C3 | "verify 一下这个改动能不能跑" | 内置 verify skill | 点名 verify = 端到端行为验证，不是结构性审查 |
| C4 | "QA 发现的 BF-0717-1 回归一下"（带 review_doc） | forge-qa Mode B | 带 BF 报告路径 → Mode B，不是 Mode A |
| C5 | "修完了，测一下有没有修好" | forge-qa Mode B（bugfix P6 语境）| 在 bugfix 会话内 → Mode B；独立会话且无 BF 报告 → Mode A |
| C6 | "界面颜色不对，应该是 #F4F1EA" | forge-bugfix（实现偏离）或 forge-design-impl | 有 DESIGN.md 且值明确 → 属实现偏离走 bugfix；无设计文档 → design 先定值 |
| C7 | "需求好像不对，用户其实要的是 X" | forge-prd | 产品诊断（需求层）不是 bugfix（实现层） |
| C8 | "讨论一下这个 bug 怎么修" | forge-bugfix | "讨论一下"是 brainstorm 触发词，但对象是 bug → bugfix 的 P4 方案确认已覆盖讨论 |
| C9 | "把这次学到的东西记下来" | forge-fupan | 不是让 AI 写 Memory，是做一篇复盘（v4 起不写账本） |
| C10 | "文档乱了，帮我整理 docs 目录" | forge-doc-policy | 不是 doc-release（doc-release 只在发布后对齐文档） |
