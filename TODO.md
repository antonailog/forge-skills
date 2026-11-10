# Forge 体系优化项目 — 目标与任务清单

> 创建于 2026-07-04。协作模式：AI 分析 → 用户学习 → AI 提方案 → 用户确认 → AI 落地。
> 详细分析文档：`docs/archive/skill-audit-2026-07.md`

## 目标

让 forge skill 体系在**任何开发类项目**（如 info2action）中都能低成本实际用起来。

三个子目标：
1. **可靠**：真源不漂移、引用不断链、换项目不失效
2. **便宜**：单次调用的上下文消耗大幅下降，长会话不再"中途失忆"
3. **易上手**：新项目一键接入，小改动有轻量车道

硬约束（本轮自律）：**只做减法和解耦，不加新功能**。
验收标准：新项目从零跑通一个小需求，数一数要几步、烧多少上下文。

## 任务清单

### 阶段 0：深度分析（进行中）

- [x] A1. 逐 skill 详细分析 → `docs/archive/skill-audit-2026-07.md`（15 个 skill + 总入口 + _shared，30 个编号问题 P-01~P-30）✅ 2026-07-04
- [x] A2. 用户回答 3 个待定问题 ✅ 2026-07-04：
  - forge-design Python 脚本 → 用户授权 AI 定夺 → **保留**（流程正经入口 + 不占上下文的正确模式）
  - dev vs deliver → **用户实际用 dev** → 合并方向定为：保 dev、吸收 deliver 的发布/文档尾段、退役 deliver
  - fupan Workbench → 每次都开但**效果不好**；复盘要去公式化，核心目的=提升用户自己的能力 → 立项重设计
- [x] A4. 上游 skill 最新版调研 ✅ 2026-07-04 → 审计文档第 5 节（Superpowers v5.1 / gstack 30+ / frontend-design / ui-ux-pro-max v2）
- [x] A3. 优化方案确认单已出 → `docs/optimization-plan-2026-07.md`（D-00~D-11 待用户逐项确认）✅ 2026-07-04
- [x] A5. 技能手册全量重写 → `docs/skills-reference.md`（16 单元人话版档案）✅ 2026-07-04

### 阶段 1：P0 保命（真源与链接）✅ 2026-07-04 完成

- [x] B1. 审查 6 周未提交改动 → 全部是正经工作（doc-policy v0.2 适配 + description 压缩 + bugfix 瘦身 321 行），整体入库 `472b080`；漏提交的 _shared/current-doc-loading.md 一并入库
- [x] B2. 已推送 origin/main（2273987 → 773c4ac，共 4 个 commit），三点一致恢复
- [x] B3. install.sh 增加 _shared 链接（install/uninstall/status 三处）`cccec47`，已执行生效
- [x] B4. 跨 skill 引用统一 `~/.claude/skills/` 锚点 `4925ded`；有意保留：fupan 复盘输出目录（P-24 阶段 4 再议）
- [x] B5. 勘误：.gitignore 本来就覆盖缓存垃圾，磁盘残留未入库，无需动作（审计 A-3 已修正）

### 阶段 2：P1 减重（上下文经济学)

- [x] C1. forge-bugfix 瘦身：63KB → 骨架 12.6KB + 4 份阶段手册（含 Mode B 契约单源化）`1a0f65b` ✅ 2026-07-04
- [x] C2. forge-qa 瘦身：64KB → 骨架 15.4KB + Mode A/B 两份手册 `0422e06` ✅ 2026-07-04
- [x] C3. 中型瘦身完成 ✅ 2026-07-04：brainstorm 27.5→17K、prd 26→17.4K、design 30→15.4K、dev 28→20.5K、eng 28→24.9K（各配 references 手册；fupan 等 E2、deliver 等 E1）
- [x] C4. description 全部压缩到 2-4 行（附带删除总入口过宽触发词"继续"）`0d92b74` ✅ 2026-07-04
- [x] C5. 工作区 CLAUDE.md Forge 段收缩 206→127 行（R1-R11 一行版速查表；原文备份进 cookbook docs/archive/raw/）✅ 2026-07-04
- [~] C6. 实战验证：D3 已用真实字节数验证链路加载账本；「新骨架是否会主动读阶段手册」仍需 info2action 下一个真实 bug 观察（留待日常使用自然触发）

### 阶段 3：P2 降门槛（任何项目可用）

- [x] D1. init-project.sh 已兑现（幂等、绝不覆盖、复用 bugfix backlog 模板；scratchpad 实测两遍通过）✅ 2026-07-04
  - 附带修复：install.sh 的 SKILLS 清单漏了 forge-doc-policy，导致 B4 改的 ~/.claude/skills/forge-doc-policy/ 引用一直是断链（实测踩出，已补链）
- [x] D2. /forge 决策树：轻量车道置顶 + 空项目导向 init 脚手架 ✅ 2026-07-04
- [x] D3. 端到端验收完成 → `docs/d3-acceptance-2026-07.md` ✅ 2026-07-04（接入 1 命令/0.03秒/6文件；bug 链路峰值 127→53KB；诚实记录 progressive disclosure 使总量变大的反直觉发现）

### 阶段 4：结构性调整（每项单独讨论定案后动手）

- [x] E1. dev/deliver 合并 ✅ 2026-07-04（细案经用户确认）：
  - forge-dev 新增第 6 步可选发布尾段（--full：review→ship→doc-release），默认行为不变
  - 状态目录统一 `.forge/`（dev-state.json/checkpoints/visual-decision.md），旧 .do-dev/.deliver 只读迁移
  - forge-deliver 退役归档 `_archive/2026-07-04-forge-deliver-retired/`，install.sh 清单同步，触发词并入 dev
  - 验证：16 链接 ok、全库无悬空引用、注册表不再出现 deliver
- [x] E2. fupan v2 重设计 ✅ 2026-07-04（细案经用户确认）：（已被 v4 替代：2026-11 重写为单篇复盘页 + 复盘汇总页，账本停写、Workbench 删除）
  - 主产出改为 learnings.jsonl 账本（append-only/置信度/复发检测，参考 gstack /learn+/retro）
  - 一页纸 ≤60 行 + 每次 1 个深度小课；五章模板/流水账/强制配图/网页勾选门禁全部砍掉
  - 回放钩子接入 bugfix P1 + eng 理解现状（闭环：产条目→开工回放→复盘验复发），端到端实测通过
  - 试点迁移：近 5 篇复盘蒸馏 12 条入账本（跨篇复现的「ship 状态链验收」置信度 9）
  - 踩坑沉淀：账本必须紧凑 JSON（grep 契约），已写进 schema 铁律
  - 子项 3 Workbench 阅览器改造 ✅ 2026-07-04：账本+文档双页（UI 草图经确认），/api/learnings 上线，勾选门禁路由退役，实测通过
- [x] E3. P-31：qa/bugfix 两侧 gstack/browse 引擎引用全部移除（.gstack/ 报告目录名保留兼容存量）✅ 2026-07-04
- [x] E4. 上游增量融合 ✅ 2026-07-04：
  - Superpowers v5 四点 Spec 自审 → forge-prd 第 3.5 步（占位符/一致性/范围/歧义）
  - 子代理模型路由 → forge-dev 上下文工程（机械任务 sonnet、判断任务不降级）
  - frontend-design 新禁令 6 条 + 美学锚定法 → design-impl / design create-mode
  - ui-ux-pro-max：现有 8 个 CSV 与上游逐一核对一致；上游新增 8 个数据域（motion/icons/google-fonts 等）需连引擎升级，暂缓另立项（减法原则）

### 阶段 5：独立评审后续（Opus 4.8 评审 B-，2026-07-04）

- [x] 批次 1-3 无争议清理：README 重写 deliver 段/数字对齐、eng+dev+bugfix 的 gstack/browse 清零、删古董 docs/README ✅
- [x] 批次 4：eng 673→505 行、dev 518→458 行二次骨架化（Wave 执行/调度细则外移）✅
- [x] 批次 5：test-dimensions.md 加维度导航表 + 按需跳读指引 ✅
- [x] Opus 复验（B- → B+）三个遗留项全部关闭 ✅ 2026-07-04：doc-policy 停止宣传 audit-project.sh、eng 492 行破线、总入口清单补齐
- [x] 决定不拆 test-dimensions（2026-07-04 用户拍板）：导航表已解决「不必整读」，物理拆分收益不抵 10 文件维护+交叉引用成本
- [ ] 未来能力（非本轮）：真正实现 audit-project.sh（老项目接入审计）

### 阶段 6：外部对标审查遗留项 ✅ 2026-07-17 全部落地（用户授权整批推进）

> 来源：skill-creator + yao-meta-skill 三路对标审查，报告见 `docs/archive/skill-review-2026-07-17.md`。

- [x] F1. AskUserQuestion 规范提取 `_shared/interaction-protocol.md`，8 skill 改一行引用；批量策略统一为"≤3 单独问，>3 同类批量"（消除 eng/review 矛盾）✅
- [x] F2. forge-ship 488→286 行：第 9-11 步细节移 `references/merge-and-sync.md`；info2action 专属命令替换为"项目 CLAUDE.md 已记录命令优先"✅
- [x] F3. forge-eng 492→399 行：第 10 步 bash 归 worktree-guide、口号区压缩为 3 条可执行工程原则、铁律单点化 ✅
- [x] F4. forge-dev 458→326 行：灰区表/RESEARCH 模板/--auto 细则/前置脚本/展示模板下沉 orchestration-details.md（303→453 行）；OWASP 等越权规则删除 ✅
- [x] F5. forge-qa 313→244 行：伪 bash 模式判断块改为优先级表+入口校验散文；Codex 内容移"环境适配"说明 ✅
- [x] F6. 状态标记协议提取 `_shared/feature-status-protocol.md`，design/eng/qa 改引用+各自特有动作 ✅
- [x] F7. workbench 迁至 `tools/fupan-workbench/`（git mv 19 文件），fupan SKILL.md 启动路径改经 forge 根 symlink，.gitignore 同步 ✅
- [x] F8. brainstorm/bugfix/ship/dev/eng 尾部速查去重，只留正文未覆盖条目 ✅
- [x] F9. `evals/trigger-cases.md`（17 触发 + 6 不触发 + 10 易混淆）；doc-release/review 补触发方式；review description 写明与内置 code-review/verify 分工 ✅
- [x] F10. mode-a-execution/p6-p7/p3-p5/thinking-doc-template 四份补导航（+60 行纯新增）；doc-policy ⏳ 项移入其 CHANGELOG Roadmap 节 ✅
- [x] F11. 定案：收窄表述——active.md 登记方仅 forge-bugfix（description/哲学/模式表三处同步）；顺带 status 端口表去 info2action 化 ✅
- [x] F12. 定案：白名单增补——doc-paths 新增 `docs/{版本号}-CONTEXT/RESEARCH.md` 行（forge-dev 管理，结项归档 archive/raw）✅

成果：15 个 SKILL.md 总量 4429→3876 行（-12.5%），最大文件从 492 降到 399，全部脱离 500 行红线。

### 阶段 7：第二轮瘦身（复测遗留项）✅ 2026-07-17 完成

- [x] eng 399→275（四章审查/从零创建/交付模板下沉，worktree 块与手册去重）✅
- [x] doc-release 347→156（新建 references/release-details.md，零 references 状态终结）✅
- [x] brainstorm 382→315（提问集下沉 references/question-banks.md）✅
- [x] design 337→312 + design-impl 210→201（认知模式压缩、资源节合并、shadcn 常识表删除）✅
- [x] prd 343→332（双流程图二选一）；doc-policy 历史叙事收敛 ✅

最终账：总量 4429→3449（-22.1%），最大文件 332；指针零断链。明确不做：test-dimensions 拆分（已定档）、audit-project.sh（维持未来能力）。

## 决策记录

| 日期 | 决策 | 原因 |
|---|---|---|
| 2026-07-03 | 重建 ~/.claude/skills symlink（install.sh） | 目录整体丢失导致 skill 全部未注册 |
| 2026-07-04 | 本轮只做减法不加功能 | 复盘证据：失效都源于上下文超载，不是功能缺失 |
