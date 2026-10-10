---
status: live
type: reference
module: global
last_updated: 2026-07-04
---

# Forge 技能手册（人话版）

> 每个 skill 一份档案：它是干嘛的、什么时候找它、内部怎么走、守什么规矩、吃什么吐什么。
> 想看每个 skill 当前的问题清单和优化计划 → `docs/archive/skill-audit-2026-07.md`（审计）+ `docs/optimization-plan-2026-07.md`（方案确认单）。
> 本版 2026-07-04 全量重写：补齐 forge 总入口/brainstorm/doc-policy，清除 cn-retro、cn-doc-release 等改名残留。

## 先记住这张地图

```
角色分工（14 个 skill = 4 类人）
├── 导航：forge（前台），forge-status（保安）
├── 项目经理：forge-dev（自己不干活，只调度；--full 可一路到发布）
├── 工种：brainstorm → prd → design → design-impl → eng → qa → bugfix → fupan
└── 守门收尾：review（质检）→ ship（发货）→ doc-release（对账）→ doc-policy（档案室）

一条主链：想法 → 思考文档 → PRD+Feature Spec → 设计 → 实现 → QA → 审查 → 发布 → 文档 → 复盘
一条旁路：bug → forge-bugfix P0-P8（P6 自动叫 forge-qa 来验收）
一个灵魂：所有交接靠文档，不靠对话记忆
```

---

## 1. forge — 总入口 / 导航员

**一句话**：不知道下一步干什么，就喊它。
**什么时候用**：会话开头、阶段切换、迷路时。
**怎么工作**：跑一段只读检测（哪些文档存在、git 什么状态、有没有 worktree 和 dev server）→ 按 8 条决策树判断你的处境 → 给出推荐 + 2-3 个备选让你选。
**规矩**：自己绝不干活，只检测和推荐；全程 10 秒内；推荐不是命令。
**产出**：一次选择题。

## 2. forge-brainstorm — 头脑风暴

**一句话**：把模糊的想法聊成可执行的共识，落成"思考文档"。
**什么时候用**：有想法但没想清楚；任何话题（不限开发）。
**怎么工作**：4 种模式（产品/内容/构建/探索）× 6 阶段——感知上下文定模式 → 深度提问 → 扫竞品和参考（可选）→ **挑战你的前提**（专治"顺着你说"）→ 强制给 2-3 个方案 → 写思考文档。需要"看见才能判断"时用 Mermaid/图辅助。
**规矩**：必须挑战前提；必须多方案；思考文档要写"给下一台电脑的自己"的续聊指引。
**产出**：`brainstorm-*.md` 思考文档（含逐轮锁定的决策表），出口指向 forge-prd 或 forge-dev。

## 3. forge-prd — 产品诊断与 PRD 管理

**一句话**：把需求或问题诊断清楚，更新 PRD，产出带验收标准的 Feature Spec。
**什么时候用**：提新需求、改需求、描述产品问题时。
**怎么工作**：定位文档 → 理解现状（或从零创建 PRD）→ 自适应深度诊断（小改快走、大改深审；问题归因三分法：产品设计缺陷/实现偏离/PRD 遗漏）→ 方案确认 → **生成 Feature Spec（用户确认门禁）** → 生成/更新项目 CLAUDE.md → 写入文档。
**规矩**：认为需求不合理要直接反驳并给替代案；Feature Spec 每个功能点至少 3 种异常态（空态/错误态/降级态，本地存储加陈旧态），缺异常态不算完成；写入前必须用户确认。
**产出**：`docs/PRD.md`（当前事实）+ `PRD-CHANGELOG.md`（历史账）+ `.features/{id}/feature-spec.md`。
**附属**：references/ 里有 PRD 模板、Feature Spec 模板、项目 CLAUDE.md 模板。

## 4. forge-design — 设计规划

**一句话**：管 DESIGN.md，让设计有据可依而不是拍脑袋。
**什么时候用**：需要 UI/UX 设计决策、"先看效果图"时。
**怎么工作**：分级门控（改动大小决定流程深浅）→ 理解现状/从零创建 → 设计审计（查询内置规则库：8 个 CSV，含 99 条 UX 规则、161 套配色、字体搭配等，用 `scripts/search.py` 按关键词查）→ 出方案（0-10 分交互评分）→ 更新 DESIGN.md → 质量评估。前端页面要过 Image 2 视觉稿门禁再实现。
**规矩**：三层 Token 架构（原始值→语义→组件）；反 AI 模板检测；视觉偏离和功能 bug 同罪。
**产出**：`docs/DESIGN.md` + `DESIGN-CHANGELOG.md` + 视觉稿决策记录。
**附属**：search.py + design_system.py（设计系统生成引擎，来自 ui-ux-pro-max）+ 8 个 CSV 数据库。

## 4.1 forge-design-lab — 设计工作台

**一句话**：在真 token、真像素的 HTML 骨架上让你看、改、存设计决策，实现时看到的和骨架上看到的是同一份值。
**什么时候用**：讨论某个页面/组件的设计稿、争论比例/密度/一屏几张/栏宽时；forge-design 第三步遇到布局决策必调；用户说「开工作台」「保存好了，按调整后的来」。
**怎么工作**：适配（读项目 :root 变量 / tailwind / 实际用量出阶梯）→ 线框确认（json 的 layout 自动画）→ 骨架（组件 CSS 只写 var()）→ 七层审查（结构/层级/排版/色彩/间距与形状/状态与动效/一致性，每层一个问题，判断题挂在元素上）→ 橙色「保存」直写仓库三文件 → Agent 读 json、校验重建、逐条回反馈、拿不准的出 A/B/C → 生成 DESIGN.md token 表交实现。
**规矩**：用户保存的值不替他改；生成文件不手改；备选只取站点阶梯值；站点级 token 只读可提议；Image 2 退为气质判断。
**产出**：`docs/assets/visuals/<page>/`（tokens.json / tokens.js / skeleton.html / meta）+ 前端 `<page>.tokens.css` + DESIGN.md 模块内 token 区块。
**附属**：scripts/ adapt_tokens · build_tokens · scaffold_pack · verify_pack（Playwright）· render_design_table；assets/ 引擎母本 workbench.js/css + 页面包模板；references/ 字段全表、七层方法论、引擎接口、坑清单、范例。

## 5. forge-design-impl — 设计实现

**一句话**：把 DESIGN.md 变成代码，只动样式不动逻辑。
**什么时候用**：设计文档确认后需要写前端样式代码时。
**怎么工作**：前置门禁（DESIGN.md 评分 ≥ B）→ 从 DESIGN.md 提取实现清单给你确认 → 逐项实现（CSS 优先、Token 驱动、遵循项目现有风格、响应式必做）→ 每项自检 + 原子提交 → 质量验证（grep 硬编码值、AI 模板痕迹扫描、真实截图对比视觉稿）。
**规矩**：DESIGN.md 是唯一真相源，不许"顺手改进设计"；要改 JS 逻辑就去 forge-eng；Image 2 视觉稿只是观感参考，验收证据必须是真实截图和 CSS 断言。
**产出**：样式代码 commit（`style(design): ...`）。

## 6. forge-eng — 工程实现

**一句话**：管 ENGINEERING.md + 真正写代码的主力，TDD + worktree 隔离。
**什么时候用**：实现功能、改后端、任何正经代码变更。
**怎么工作**：完整模式（文档+审查+实现）或轻量模式（跳过文档直接干）→ 范围挑战 → 四章工程审查 → 方案设计（架构/数据流/API/测试矩阵，关键决策找你确认）→ 建 worktree（会话隔离 + dev server 端口契约 + 测试框架检测）→ 任务拆成原子单元、分 Wave 并行执行（TDD 红绿循环 + 验证门：证据先于断言）→ 每任务独立 commit → 分支收尾（合并/PR/保留/丢弃四选一）。
**规矩**：三铁律（不先设计不写码、不先写失败测试不写实现、不先验证不说完成）；"把湖烧干"完整性原则——不留一半的活。
**产出**：`docs/ENGINEERING.md` + 代码 commits + 测试。
**附属**：references/ 有 TDD 指南、worktree 指南、工程模板、验证清单（全家最早实践按需加载的）。

## 7. forge-qa — 验收测试

**一句话**：只测不修的质检员，每个测试必须有真断言。
**什么时候用**：Mode A：功能开发完整验收；Mode B：被 forge-bugfix 的 P6 自动调用做单 bug 回归。
**怎么工作**：三层架构——①从 PRD/DESIGN/diff 生成 test-spec.json（不生成就不执行）→ ②10 维度 Playwright 断言引擎（控制台/数据/网络/视觉/交互/响应式/可访问性/SSE/URL/懒加载）→ ③失败智能归因（console→源码→diff 交叉引用）。测试前给你验收计划确认，测试后产出结构化报告 + User Gate（QA 全过也要你人工点头）。
**规矩**：只测不修；断言必须验证数据值/文本/状态变化，"元素存在"不算验收；console.error 零容忍直接 FAIL；不许猜端口（必须用传入的 app_url）；证据先于结论。
**产出**：Mode A：`docs/QA.md` 报告 + 结构化 bug 清单；Mode B：往 BF 报告回填 QA 证据（截图/断言/环境身份校验）。
**附属**：qa-runner.mjs 测试框架 + references/（10 维度代码模板、报告模板）。

## 8. forge-bugfix — Bug 修复

**一句话**：一次修一个 bug 的完整流水线，全家打磨最久的 skill。
**什么时候用**：报 bug、"这里不对"、"排查一下"。
**怎么工作**：P0 环境探测（读 .forge/active.md 防和其他会话撞车）→ P1 读 PRD/ENG/bugfix 历史 → P2 定范围（从 backlog 捞候选，推荐"本次修 X"）→ P2.5 建 BF 验收报告 → P3 建 worktree + 复现 → P4 根因追踪 + 5 Whys + 方案确认 → P5 TDD 最小修复 + 原子提交 → P6 调 forge-qa 自动验收 → P6.5 你人工验收（Pass / Fail / Pass+新发现三选一）→ P7 分流 → P7.5 新发现进 backlog → P8 报告归档沉淀。
**规矩**（9 条铁律精华）：不做根因分析不写代码；没有 BF 报告不算完；**新发现禁止顺手修**（声称"同根"必须举证，证据不足算独立 bug）；没有你的最终结论不合并；自动闭环修 3 次不过必须停下来找人。
**产出**：`docs/bugfix/reviews/BF-{MMDD}-{N}.md` 双层验收报告（QA 填一列、你填一列）→ 结案归档到 `docs/archive/raw/bugfix-reviews/`。
**附属**：报告校验脚本、active.md/backlog/验收单模板。

## 9. forge-review — 上线前审查

**一句话**：专抓测试测不出来的结构性问题，发现直接修。
**什么时候用**：合并/发布前。
**怎么工作**：确定基础分支 → 读完整 diff → 两轮审查（第一轮严重：SQL 注入/无 WHERE 全表操作、竞态条件、**LLM 输出信任边界**、**枚举完整性**——新枚举值必须查 diff 之外的所有引用处；第二轮信息性：条件副作用、魔法数字、死代码、测试缺口、XSS）→ 机械问题直接修（AUTO-FIX），要权衡的批量问你（ASK）→ TODO 交叉检查 → 文档过时检查。
**规矩**：每个发现都要有行动，不许只报告不修；绝不提交/推送/建 PR（那是 ship 的活）。
**产出**：已应用的修复 + 问题摘要。

## 10. forge-ship — 发布

**一句话**：把审查过的分支安全送进远程 main，状态汇报绝不注水。
**什么时候用**：说"ship/发布/合并"（Full ship：一路到合并+同步本地 main）或"先发 PR"（PR only：建完 PR 就停）。
**怎么工作**：12 步——定模式和基础分支 → 安全检查 → 先吸收最新 main → 跑项目测试（禁止用会吞失败的链式命令）→ 发布前 diff 审查（调试代码/密钥/构建产物）→ CHANGELOG → 提交 → 推送 → 建/更 PR → 合并前逐项核对（mergeable/checks/review）→ 合并 → 只从 origin 同步本地 main。
**规矩**：永远区分七种状态（已提交/已推送/PR 已建/PR 已合并/远程 main 已更新/本地 main 已同步/已部署）；**发布不等于部署**；测试失败不发布；不 force push；本地 main 有脏文件绝不自动覆盖。
**产出**：PR + Ship Summary 状态表。

## 11. forge-doc-release — 发布后文档同步

**一句话**：发布之后把所有文档对齐现实。
**什么时候用**：ship 之后、PR 合并之前。
**怎么工作**：diff 分析 → 逐文件审计（README 功能是否都写了、CONTRIBUTING 按新贡献者视角走一遍、CLAUDE.md 的命令还准不准）→ 事实性更正直接改、叙事/删除/安全模型必须问 → CHANGELOG 只润色语气绝不覆盖内容（"推销测试"：用户读了会想试吗）→ 跨文档一致性 + 可发现性检查 → TODO 清理 → VERSION 询问 → 提交 + 更新 PR body。
**规矩**：绝不覆盖 CHANGELOG 条目；绝不擅自改 VERSION；每次编辑附一行"具体改了什么"。
**产出**：文档同步 commit + 文档健康摘要表。

## 12. forge-fupan — 复盘

**一句话**：干完活之后的知识沉淀（重设计立项中：目标从"漂亮文档"转向"你的能力增量"）。
**什么时候用**：说"复盘/总结知识"。
**怎么工作**（现状）：启动本地 Workbench 网页让你勾选想学的知识点和深度 → 按选择调研 → 生成结构化复盘文档（TLDR/知识点展开/双方行为诊断/表达优化/可执行清单）→ 每个知识模块尝试配一张 Image 2 学习图 → 更新 INDEX 索引 → 顺手清理 .forge/active.md 登记。
**产出**：`记录/复盘/{项目名}/日期-主题.md` + 配图。
**附属**：整个 Workbench Web 应用（Python server + vite 前端）+ token 统计脚本。

## 13. forge-status — 并行会话巡检

**一句话**：清理 .forge/active.md 里的僵尸登记，只认硬信号。
**什么时候用**：早上开机看昨天的摊子、"看下谁在跑"、bugfix/prd/eng 启动时自动只读巡检。
**怎么工作**：扫 active.md 每条登记 → 硬信号判定（worktree 目录没了 = 已弃用；分支已合并 main = 已完成漏清理；否则活跃）→ 报告分组 → 你一次 y/n 确认 → 批量清理 + backlog 联动（已合并→resolved 归档；worktree 没了→回 pending 可重领）。
**规矩**：绝不用时间戳/进程存活当判据（"AI 慢不等于死"）；清理前必须确认；不删 worktree 本体（那是 bugfix P7 的活）。
**产出**：巡检报告 + 清理后的 active.md/backlog.md。

## 14. forge-dev — 开发调度器（编排器，保留）

**一句话**：从 PRD 到交付的项目经理，核心本事是"上下文工程"。
**什么时候用**："开始开发/实现需求"、PRD 更新后。
**怎么工作**：Brainstorm 感知 → 读真相源 + Feature Spec 检查 → Discussion 收集你的偏好 → 并行技术调研 → 给出调度建议（该叫哪些工种、什么顺序）→ 用 Agent 工具在**独立上下文**里跑各子 skill（主上下文只调度不干活，防止越聊越傻）→ 汇总交付报告。三模式：交互（3 个硬卡点）/--auto（前置沟通后全自动）/--resume（断点续跑）。
**规矩**：主上下文不做实现；给子 agent 只传必要文档路径；子 agent 完成后读其产出文档确认，不轻信其口头汇报。
**产出**：`.forge/dev-state.json` 检查点 + 交付总结（--full 时含 Ship Summary）。

## 15. forge-deliver — 已退役（2026-07-04）

职责已并入 forge-dev：说"端到端交付 / 一路到发布"即走 dev 的 --full 尾段（review → ship → doc-release）。
原文件归档在 cookbook `_archive/2026-07-04-forge-deliver-retired/`，可恢复。

## 16. forge-doc-policy — 文档治理规范

**一句话**：所有文档"该放哪、长什么样"的规则源头。
**什么时候用**："文档放哪"、"docs 乱了"，以及每个 AI 创建 .md 前的自查。
**怎么工作**：三份核心文件——doc-paths.md（路径白名单：当前真相源/模块附录/active 工作区/archive）、frontmatter-schema.md（4 必填字段）、claude-md-snippet.md（项目 CLAUDE.md 的 3 行引用段）。强校验走"LLM 自觉 + 违规才问"，刻意不用 hook（会误伤打断，用户会关掉）。
**规矩**：14 个 forge skill 顶部都引用它；规则改动锁版本号、走 worktree 预演。
**附属**：init-project.sh（新项目一键脚手架，✅ 2026-07-04 已兑现）；audit-project.sh 等其余脚本仍待实现。

## 16.1 forge-feature-doc — 需求设计文档

**一句话**：每个功能一份给人看的设计文档，先图后字、只写当前设计，读者 10 分钟内能看懂并拍板。
**什么时候用**：PRD / DESIGN 太长看不过来、看不到功能现在的设计和最近改了什么时；forge 各阶段改了规则、文案、交互、布局、阈值、prompt、模型、架构后收尾；上线前看文档跟上没有。
**怎么工作**：判类型（有无界面 / 后端 / AI）→ scaffold 建骨架（待拍板置顶 + 按需 12 部分 + 细节在哪 + 关键改动）→ 照写法规则填内容（数值以代码为准，只写现在）→ 出图（示意图模板渲染；页面图用真实截图加标注，截不到画页面示意）→ check.mjs 检查（漏更新、讲历史的词、坏链接和绝对路径、关键改动条数）。
**规矩**：截图只读（拦下所有非 GET）；图和数值不编；不写凭证和内部地址；文档和功能改动放进同一个提交。
**产出**：`docs/modules/<功能>.md` + `docs/assets/visuals/<短名>/overview/`；项目里 `scripts/design-doc/` 三个脚本。
**附属**：scripts/ scaffold · render-diagrams · annotate · check；assets/ 文档模板 + 6 个示意图模板；references/ 写法规则、阶段对照、出图、范例。评测见 `docs/forge-feature-doc-评测报告.md`。

## 17. _shared — 共享层（非 skill）

- `current-doc-loading.md`：文档加载契约——先读当前真相源（CLAUDE.md/README/INDEX/根级文档），长 changelog 和 raw archive 只在追溯历史时读。
- `visual-decision-layer.md`：什么时候该用 Image 2 / show-widget / 真实截图辅助决策的选型指引。
- `generate_image2.py`：Image 2 生图脚本（gpt-image-2）。
