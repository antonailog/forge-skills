# Changelog

本文档记录 forge-cookbook 的重要变更。遵循 [Keep a Changelog](https://keepachangelog.com/) 风格。

标签命名：`vYYYY.MM.DD`（以迭代发布日期为准，同日多次发布追加 `.N` 后缀）。

---

## [Unreleased]

### Changed
- **_shared/interaction-protocol.md 重写为「Forge 执行与交互协议」**：先判定请求终点，按情况决定自行处理还是提问，相互独立的问题合并问，工作量与验证按影响选择，完成标准区分技术验证、人工验收和发布授权；各 Skill 正文写明的停顿点照 Skill 执行。各 Skill 的一行引用改为「执行与交互边界见…」，forge-eng、forge-review 去掉旧的「≤3 个逐个问」。
- **forge-dev 调度状态文件统一为 `.forge/dev-state.json`**（编排细则原写 `state.json`）。
- **forge-fupan 复盘会话加 `title`**：Workbench 列表和会话页优先显示标题、摘要另起一行；账本条数统一为 2-3 条，复发 ≥2 提醒、≥3 当场固化。
- **forge-prd**：prd-details 的场景要求和 SKILL.md 的异常态门禁写成同一条。
- **forge-design-lab 的运行时搬进独立工具 design-studio**：工作台服务（`serve.py`）、`build_tokens.py`、`adapt_tokens.py` 的本体，以及引擎、零件库页面、页面包模板的母本，都搬到 design-studio（`design_studio.py lab`、`studio/lab/`、`web/lab/`）。skill 里同名脚本变成转调它的薄壳，命令、端口、`/api/lab/*` 接口和保存回执、tokens 三件生成物都不变（`scaffold_pack.py` 写进 meta.json 的 `engine` 字段和 `_workbench/README.md` 的说明文字改成指向 design-studio）；`assets/` 删除。脚本按 `DESIGN_STUDIO_HOME`（设了就只认它）→ `~/.design-studio` → `~/design-studio` → 工作区布局找带骨架模式的 design-studio，找不到或版本太旧时打印安装 / 更新命令并以退出码 69 退出（`verify_pack` 报「缺 design-studio」）。design-studio 同时是一个页面模式的编辑器（改已经做出来的页面），两种模式共用一个本机服务。验证：design-studio 的骨架模式回归在 forge-demo-pomodoro、info2action 的页面包上和旧 serve.py 逐条一致；本仓库 evals 零件库回归 74/74、实现比对回归 8/8，`verify_pack.mjs` PASS 14，均与改动前相同。需要先装 design-studio（`install.sh` 会检测并提示）。

### Added
- **forge-design 防御性设计检查**（轻档，经 /skill-build）：新增 `references/defensive-design.md`，定义 + 三问（写给谁 / 删了读者的交互和理解受不受影响 / 这个场景会不会发生）+ 按阶段和页面类型处理（搭建 demo 可留占位，上线前清；展示页缺数据整节不出，工具保留真实状态提示）+ 四类 15 条症状（自证型、解释型、状态型、结构型，案例来自个人博客 10-25 清理）+ 不算防御性的边界 +「检查防御性设计」「不要防御性设计」两种用法。SKILL.md：description 加这两个触发词和排除项（代码层防御性编程交 forge-review），流程总览加直达说明，设计自检第 2 条补「覆盖≠每种状态配字」、新增第 5 条。audit-and-scoring.md：交互状态和微文案里「温暖空状态」「错误消息讲清为什么」按页面类型改写，加「无防御性说明」一项。forge-prd 第 3.5 步：异常态「Then 写明确 UI 行为」补一句，展示页空态可以写「整节不出」，错误态写读者下一步，不写开发者报错；`references/feature-spec-template.md` 的「错误提示」字段和验收项改成「UI 行为」。和新规则冲突的旧条目一并改：`data/ux-guidelines.csv` No.16（核心内容不进滚动框）、No.79（空状态分工具和展示页）、No.84（只截次要文字）；`references/design-template.md` 空状态表的预设列。直达路径写明是「不写代码」的例外（清单确认后只删改页面文字和元素）。推送前独立审查一轮，A 块 5 条必须修已修。体检告警 2 → 1（补上排除项）；触发未实跑。讨论稿 `docs/archive/raw/discussions/defensive-design/`，快照 `_archive/snapshots/2026-10-26-defensive-design/`。
- **forge-feature-doc**（新 skill，完整档，经 /skill-build S0–S5）：每个功能一份给人看的需求设计文档 `docs/modules/<功能>.md`——待拍板置顶、按类型取舍 12 部分、先图后字、只写当前设计、末尾关键改动 ≤15 条。4 个脚本（scaffold / render-diagrams / annotate / check）、文档模板 + 6 个示意图模板、4 份 references。设计文档 `docs/forge-feature-doc-设计文档.md`，评测报告 `docs/forge-feature-doc-评测报告.md`（触发 v2：train 10/10、test 6/6；精选留出样本三位盲评 3 : 0 选用 skill 的版本，正文 2,428 字 vs 对照组 5,732 字）。
- **forge-design-lab**（新 skill，完整档，经 /skill-build S0–S3）：真 token、真像素骨架上的设计工作台与闭环——适配 → 线框确认 → 骨架 → 七层审查 → 保存直写 → token 同源导出 → DESIGN.md token 表。引擎母本 `assets/workbench/`（自 forge-design/assets 迁入并通用化：去掉 ai-search 专名、生成器统一为 build_tokens.py、layout.el 映射）；5 个脚本；5 份 references。设计文档见 `docs/forge-design-lab-设计文档.md`，评测报告见 `docs/forge-design-lab-评测报告.md`（触发评测 24 条 × 3 次 0 误判；范例页面包 verify 12 PASS / 1 WARN）。

### Changed
- **forge 各阶段挂钩 forge-feature-doc**：forge-prd（E 同步需求设计文档）、forge-design（D）、forge-design-lab（S5 第 4 步）、forge-eng（第 8 步）、forge-bugfix（P8 第 5 条）收尾时调用；forge-review 第 6 步、forge-ship 第 3 步跑 `scripts/design-doc/check.mjs` 当门禁；forge-doc-policy/doc-paths.md 登记这类文档；总入口 SKILL.md 表格加一行。快照 `_archive/snapshots/2026-10-10-feature-doc/`。
- **forge-design 第三步**：Image 2 视觉稿门禁改为 forge-design-lab 工作台门禁（必调），Image 2 退为气质判断的辅助；规则 1 改为「不写产品代码」（骨架页面包是设计产物）；交付模板加「工作台页面包」一行。快照 `_archive/snapshots/forge-design-2026-09-20-pre-design-lab/`。
- **_shared/visual-decision-layer.md**：三类视觉产物增「工作台骨架」一行；design / design-impl 生命周期改为工作台真相源；产物保存约定加页面包路径。快照 `_archive/snapshots/visual-decision-layer-2026-09-20.md`。

## [v2026.07.17.2] — 2026-07-17（第二轮瘦身：复测遗留项清零）

### Changed
- **forge-eng 399→275**：四章审查细则/从零创建流程移入 engineering-template（278→340），第 9 步交付模板移入 wave-execution（184→218），第 5.5 步 worktree 块与手册去重合并；范围挑战/方案设计/必需产出三块判断逻辑保留在骨架。
- **forge-doc-release 347→156**：告别"零 references"，第 1-9 步细则移入新建 `references/release-details.md`（275 行，含按需跳读导航），骨架保留铁律 + 9 步摘要。
- **forge-brainstorm 382→315**：Phase 1 四模式提问全文 + Phase 4 Pushback 模板移入新建 `references/question-banks.md`（89 行），骨架留主题摘要 + "逐字使用原文问法"指针。
- **forge-design 337→312**："设计师认知模式"12 条压缩为 4 条可检查自检要点，原文与设计批评话术移入 create-mode.md（171→199）；末尾重复"资源"节并入"数据资源"表。
- **forge-design-impl 210→201**：删除 shadcn 组件分类常识表。
- **forge-prd 343→332**："流程总览"文字版与 ASCII 交互流程图二选一（留图），修复"CEO 角色扮演"表述随 ask 规范单源化一并消失。
- **forge-doc-policy**：装载说明中的"第 10 轮决策"历史叙事收敛（渊源指向 CHANGELOG）。

### Evidence
- 15 个 SKILL.md 总量 3876→3449 行；对比迭代起点 4429 行**累计 -22.1%**。最大文件 prd 332（迭代前最大 eng 492）。
- 新指针全部命中目标小节，全库 SKILL.md → references 零断链（grep 全量核验）。

## [v2026.07.17.1] — 2026-07-17（对标审查整改 F1-F12 全量落地）

### Changed
- **共享层单源化**：新增 `_shared/interaction-protocol.md`（AskUserQuestion 格式 + 全体系统一批量策略：≤3 单独问、>3 同类批量）与 `_shared/feature-status-protocol.md`（状态标记 + 通用操作规则）；8 个 skill 的 ask 规范副本、design/eng/qa 的状态表副本全部改为一行引用，根治副本漂移。
- **三大 skill 二次瘦身**：forge-ship 488→286 行（第 9-11 步细节移 `references/merge-and-sync.md`，info2action 专属命令去除）；forge-eng 492→399 行（第 10 步 bash 归 worktree-guide、口号区压缩、铁律单点化）；forge-dev 458→326 行（灰区表/RESEARCH 模板/--auto 细则/前置脚本下沉 orchestration-details.md）。
- **forge-qa 去伪存真**：313→244 行，删除不可运行的伪 bash 模式判断块（保留判定优先级表 + 入口校验规则），Codex 特异内容移入"环境适配"说明。
- **workbench 迁出 skill 包**：`skills/forge-fupan/workbench/` → `tools/fupan-workbench/`（skill 目录不再承载 41MB 应用），启动路径经 forge 根 symlink 保持可用。
- **可移植性**：forge-status 端口表与 tmux 关键词去 info2action 化；active.md 登记方表述收窄为与现实一致（仅 forge-bugfix 登记）。
- **doc-paths 白名单增补**：`docs/{版本号}-CONTEXT/RESEARCH.md`（forge-dev 管理）转正。
- **doc-policy 反 future-outline**：未实现脚本/模板从 SKILL.md 文件清单表移入其 CHANGELOG Roadmap 节，删除三处防御性"勿引导运行"文本。

### Added
- **`evals/trigger-cases.md`**：33 条触发/不触发/易混淆路由用例（含 forge-review 与内置 code-review/verify 消歧），description 变更后人工回归。
- **四份大 reference 补导航**：mode-a-execution（1006 行）、p6-p7、p3-p5、thinking-doc-template 顶部按需跳读表。
- forge-review / forge-doc-release 的 description 补触发方式。

### Evidence
- 15 个 SKILL.md 总量 4429→3876 行（-12.5%），最大文件 492→399，全部脱离 500 行红线；skill-creator 标准复测报告见本次提交说明。

## [v2026.07.17] — 2026-07-17（外部对标审查 + 一致性修复）

### Added
- **外部对标审查报告**：用 Anthropic skill-creator 官方标准 + yao-meta-skill 方法论对全部 15 个 SKILL.md 做三路审查（官方合规、token 效率、内部一致性），报告归档 `docs/archive/skill-review-2026-07-17.md`；结构性改进项（_shared 提取、eng/ship/dev 二次瘦身、触发评估等）进 TODO 阶段 6 待逐项确认。

### Fixed
- **deliver 退役残留清零（docs 外圈）**：forge-user-guide（架构图、skill 清单第 12 节、FAQ、产出物表）、workflow-guide 场景 E、architecture 分层图/状态目录/对照表全部改为 `/forge-dev --full` 与 `.forge/` 口径；user-guide 第 12 节补上此前缺失的 forge-doc-policy。
- **旧路径纠正**：forge-prd 的项目 CLAUDE.md 模板 `.deliver/state.json` → `.forge/dev-state.json`；forge-qa Mode A 视觉意图参考补上现行 `.forge/visual-decision.md`（旧目录标 legacy）。
- **fupan v2 口径同步**：_shared/visual-decision-layer 生命周期表改为"默认不配图、用户点名才生成"；fupan SKILL.md 删除"待实施"过期措辞。
- **数字与断链**：forge-design 数据资源表计数对齐 CSV 实测（colors 161 / typography 73 / styles 84 / landing 34）；user-guide 图片相对路径修复（`../assets/`）；doc-paths 删除幽灵路径 `.forge/backlog.md`；forge-prd 第 1 步重复编号"4."修复；bugfix review-checklist 残留 gstack 引用清除。
- **README 重写**：删除不存在的 README_EN 链接，skill 数量口径统一（14 skill + 1 总入口），fupan 描述更新到 v2，仓库结构图补 `_shared/`。

## [v2026.07.04] — 2026-07-04（体系大重构：只做减法和解耦）

> 本条为补记。当时变更散落在 TODO.md 与 git log，未同步进 CHANGELOG。详细分析见 `docs/archive/skill-audit-2026-07.md` 与 `docs/optimization-plan-2026-07.md`。

### Changed
- **全面瘦身（上下文经济学）**：forge-bugfix 63KB → 骨架 12.6KB + 4 份阶段手册；forge-qa 64KB → 骨架 15.4KB + Mode A/B 手册；brainstorm/prd/design/dev/eng 中型瘦身各配 references；eng/dev 二次骨架化（Wave 执行、调度细则外移）；description 全部压缩到 2-4 行。
- **forge-deliver 退役并入 forge-dev**：`--full` 尾段（review → ship → doc-release），状态目录统一 `.forge/`（旧 `.do-dev/`、`.deliver/` 只读迁移），归档 `_archive/2026-07-04-forge-deliver-retired/`。
- **fupan v2 重设计（能力复利型）**：主产出改为 `learnings.jsonl` 账本（append-only/置信度/复发检测），一页纸 ≤60 行 + 每次 1 个深度小课；五章模板、流水账、强制配图、网页勾选门禁全部砍掉；回放钩子接入 bugfix P1 + eng 理解现状；Workbench 改造为账本+文档双页阅览器。
- **gstack/browse 引擎引用全部移除**（qa/bugfix 两侧，`.gstack/` 报告目录名保留兼容存量）。
- **上游增量融合**：Superpowers v5 四点 Spec 自审进 forge-prd；子代理模型路由进 forge-dev；frontend-design 新禁令 6 条 + 美学锚定法进 design/design-impl；ui-ux-pro-max 8 个 CSV 与上游核对一致。

### Added
- **init-project.sh 一键脚手架**（幂等、绝不覆盖）；/forge 决策树轻量车道置顶 + 空项目导向脚手架。
- install.sh：skill 清单改自动发现（skills/ 下含 SKILL.md 的非 `_*` 目录），status 增加坏链检测，_shared 纳入 symlink。

### Evidence
- 端到端验收：`docs/d3-acceptance-2026-07.md`（接入 1 命令/0.03 秒/6 文件；bug 链路峰值 127KB → 53KB）。
- 独立评审：Opus 4.8 评审 B- → 复验 B+（`docs/archive/skill-review-opus-2026-07.md`）。

## [v2026.04.27] — 2026-04-27（Fupan 复盘报告结构优化）

### Changed
- **删除无效概览**：`forge-fupan` 最终复盘不再输出“仪表盘速览”和“会话脉络”，也不再强制生成 show-widget 仪表盘。
- **Claude/Codex 会话兼容**：预检会优先用 `CODEX_THREAD_ID` 定位 Codex Desktop 当前 JSONL，并保留 Claude Code `~/.claude/projects` 兼容路径。
- **压缩后复盘策略**：新增原始会话可用性检查，区分“完整复盘 / JSONL 恢复复盘 / 轻量复盘”，避免压缩后误以摘要伪造逐条 Prompt 证据。
- **Workbench 反馈入链**：`selection.feedback` 从“提交附带字段”升级为调研和成文的全局约束，影响知识调研、行为诊断、AI 表现复盘和末尾 TLDR/SOP。
- **工作叙事收敛**：第一章改为短段落叙事，只保留目标、关键转折、交付结果和协作问题。
- **Prompt 分析重构**：逐条 Prompt 分析删除严重度标记，只保留“表达问题”和“低关键词版 / 进阶版”的更好说法。
- **行为诊断升级**：原“模式诊断”改为“行为诊断”，用“问题 / 分析 / 建议”分析用户在 AI coding 协作中的行为问题。
- **知识拓展聚焦**：从大领域调研改为按单个知识点呈现，固定结构为“是什么 / 怎么用 / 延伸学习”。
- **知识模块图**：每个最终展开的知识模块默认强尝试生成 1 张 Image 2 学习图，优先使用 Codex 内置 `image_gen`，fallback 到 `generate_image2.py`；复制图片时只取本轮新增 PNG，图片失败时保存 prompt pack，不阻塞复盘。
- **Workbench 时间戳**：task 时间戳改为 timezone-aware UTC，移除 `datetime.utcnow()` deprecation warning。
- **知识来源约束收敛**：每个知识点至少提供 1 个权威延伸来源，按官方/主流项目文档、权威教程/官方视频、高质量社区资源排序，避免误读为每类资源都必须齐全。
- **AI 表现复盘改造**：取消固定四维评分，由 AI 基于会话证据自行识别表现问题和用户可辅助方式。
- **末尾 TLDR**：TLDR 移到全文最后，只沉淀需要记住的知识、表达优化和协作 SOP。

### Evidence
- 文档规则：最终复盘不得包含旧章节；TLDR 必须位于全文最后；速查手册只保留“概念 / 解释 / 场景”三列；必须读取 `task.selection.feedback`；压缩后必须先判断原始会话可用性。
- 发布说明：`docs/releases/v2026.04.27.md`
- 验证：`parse_tokens.py` 已在 Codex Desktop JSONL 和 Claude Code JSONL 上跑通；Codex 内置 `image_gen` 已生成测试学习图；`skill-creator` quick validate、Workbench 单测、Python 编译检查、`npm run build` 和 `git diff --check` 通过。

## [v2026.04.25.1] — 2026-04-25（Fupan Workbench 阅读与队列体验优化）

### Changed
- **上海时间展示**：Workbench 首页 task UTC 时间转换为中国上海时间；顶部显示最近刷新时间。
- **完成任务出队**：`consumed` task 默认不再进入 `/api/tasks` 首页队列，`forge-fupan` 最终复盘写完后会调用 `launcher.py consume`。
- **详情页目录**：历史复盘详情页基于 Markdown H2/H3 生成可点击目录，并为正文标题注入稳定锚点。
- **Markdown 图片放大**：复盘详情页正文图片支持点击放大，Escape 或关闭按钮返回阅读。
- **知识地图侧栏**：左侧“学到的知识”改为编号学习路线，显示知识点数量，减少大块蓝色标签噪音。
- **复盘 TLDR**：`forge-fupan` 输出文档强制增加 `TLDR`，用短分点沉淀关键词、表达方法和关键知识。
- **表达原话可读性**：“表达待优化原话”字号、行高和问题/建议说明提升，避免关键学习材料像脚注。
- **首页空态收敛**：没有待处理任务时不再展示空任务面板，历史复盘直接成为首页主体。

### Evidence
- 验证：`python3 -m unittest discover -s skills/forge-fupan/workbench/tests -p 'test_*.py'` 通过。
- 验证：`/tmp/fupan-polish-venv/bin/python -m pytest -q skills/forge-fupan/workbench/tests` 通过，7 passed。
- 验证：`npm run build` 通过。
- 文档规则：TLDR 至少 5 条，并包含 1 条“下次可以说：...”。
- 浏览器验收：Playwright 确认上海时间、consumed 出队、详情页目录跳转、图片放大、知识地图编号列表、console error = 0。

## [v2026.04.25] — 2026-04-25（Bug 修复验收报告与 QA 自动闭环）

### Added
- **Bug 修复验收报告**：`docs/bugfix/reviews/BF-XX.md` 从“修完后的验收清单”升级为从发现到关闭的单 bug 案卷，覆盖发现、复现、根因、TDD、修复、QA、人工验收和新发现分流。
- **QA 自动闭环**：`forge-qa` 可产出结构化 BF candidate，交给 `forge-bugfix` 独立 worktree/TDD 修复，再由 `forge-qa` Mode B 回归。
- **Codex Browser Use 接入**：Codex 环境中前端页面/交互/视觉/控制台 QA 优先使用 `browser-use:browser` 采集用户视角截图和 DOM 证据。
- **批次最终验收**：支持多 bug、多会话、多天修复后统一汇总到最终人工验收包。
- **`forge-bugfix` v7.1 证据完整性门禁**：新增 `validate-bugfix-report.py`，交给用户验收前必须校验环境一致性、Markdown 截图、用户问题闭环、配置/开关/数据就绪和独立 worktree 证据。

### Changed
- **`forge-bugfix` v7.0**：新增 P2.5 报告创建；P5 改为独立 TDD 驱动；P6 支持单 bug 验收和批次待最终验收；自动闭环最多 3 轮，疑问进入 `blocked-human`。
- **`forge-bugfix` v7.1**：最终 QA 必须回到用户原话，证明“用户现在能看到/完成什么”；接口 200、单测通过或无 console error 只能作为证据，不能替代用户问题闭环。
- **`forge-qa` Mode B**：从回填“验收清单”升级为回填 Bug 修复验收报告，包括逐步截图、深度断言、前后端环境身份校验。
- **`backlog.md` 状态模型**：新增 `fixed-awaiting-qa`、`qa-failed`、`qa-pass-pending-final-review`、`blocked-human`、`deferred` 等状态。
- **工程边界原则**：批次 = 管理单元，Bug = 工程单元，Worktree = 隔离单元，TDD = 质量单元，QA = 验收单元。

### Evidence
- 发布说明：`docs/releases/v2026.04.25.md`
- 迭代记录：`docs/iterations/2026-04-25-Bug修复验收报告与QA自动闭环.md`
- 验证：`git diff --check`（release scope）通过；`python3 -m py_compile skills/forge-bugfix/scripts/validate-bugfix-report.py` 通过；严格临时报告样例输出 `QA_EVIDENCE_COMPLETE`。

## [v2026.04.24.3] — 2026-04-24（Fupan Workbench 批注修复）

### Fixed
- **顶部状态栏重合**：修复中等宽度下 `127.0.0.1` 与“刷新状态”按钮重叠的问题。
- **学习深度按钮对齐**：知识点卡片改为底部控制区，`了解 / 表达 / 复现` 按钮在左右卡片中保持同一底线。
- **反馈区间距**：反馈输入框与提交 footer 保持清楚间距。
- **表达待优化原话展示**：学习地图 task 新增 `expression_issue_quotes`，由 LLM 自行判断并逐字摘录表达有问题的用户原话，Workbench 展示原话、问题原因和下次说法。

### Evidence
- Playwright 首页能力截图：`docs/assets/fupan-workbench/v2026.04.24.3-home.png`
- Playwright 详情页能力截图：`docs/assets/fupan-workbench/v2026.04.24.3-detail.png`
- 验收：`npm run build`、`pytest`、`py_compile`、浏览器 console error = 0。

## [v2026.04.24.2] — 2026-04-24（Fupan Workbench + 视觉决策层）

### Added
- **`forge-fupan` 本地 Workbench**：新增 `skills/forge-fupan/workbench/`，包含 FastAPI 本地服务、React/Vite 静态前端、task JSON 状态流和历史复盘浏览。
- **学习地图确认**：复盘先生成候选知识点，用户在页面选择数量和深度（`了解 / 表达 / 复现`）后，AI 再继续调研。
- **多任务队列**：多个复盘 task 可并存，页面只展开一个完整表单；AI 只轮询自己的 task ID。
- **历史复盘网页阅读**：首页按历史索引展示“学到的知识”，详情页渲染 Markdown。
- **Forge 视觉决策层**：新增 `skills/_shared/visual-decision-layer.md`，统一规定 brainstorm、PRD、design、design-impl、eng、QA、fupan 中何时使用 Mermaid/show-widget、Image 2 和真实截图。
- **Image 2 生成脚本**：新增 `skills/_shared/generate_image2.py`，按统一约定保存图片、prompt 和 meta，缺少 `OPENAI_API_KEY` 时保留 prompt pack 并降级。

### Changed
- **复盘表达语气调整**：将旧的批改感措辞改为“表达复盘”“待补背景”“增加的沟通成本”等学习型表达。
- **表达待优化原话入库**：`forge-fupan` 生成学习地图时会让 LLM 自行判断并摘录用户表达有问题的原话，Workbench 单独展示。
- **运行态轻量化**：前端由 Vite 构建为静态文件，运行时由 FastAPI 托管，不要求用户手动启动 npm dev server。
- **前端设计门禁前移**：`forge-design` 对新页面/组件/状态要求先生成 1-3 张 Image 2 视觉稿供用户确认；`forge-qa` 明确 Image 2 只作观感参考，不作为通过证据。
- **Skill frontmatter 兼容最新校验**：移除旧式 `version` 字段，确保全部 `forge-*` skill 通过最新 `skill-creator` 的 `quick_validate.py`。

### Fixed
- **顶部状态栏重合**：本地 IP 和“刷新状态”按钮改为独立 flex action 区，避免中等宽度下重叠。
- **原话摘录信息不足**：当前任务区新增“表达待优化原话”，展示 LLM 判断出的原始问题表达、问题原因和下次说法。

### Notes
- 第一版只面向本机单用户，不做账号、云同步、数据库、全文搜索或知识图谱。
- FastAPI/Uvicorn 缺失时，`forge-fupan` 应降级到对话内确认。
- 视觉稿不替代 DESIGN.md、Feature Spec、CSS 断言或真实截图；它只用于提前暴露误解和辅助人工判断。

## [v2026.04.24.1] — 2026-04-24（Dev Server 端口治理）

### 主题

把 worktree 启动前后端这件事从"靠人记住端口"改成"由项目统一状态入口负责"。核心目标是：main 只跑一套服务，worktree 不抢端口，QA 不测错进程。

### Changed
- **`forge-bugfix` v6.0 → v6.1**：P0/P3.2/P6/铁律接入 `npm run dev:status` / `scripts/dev-stack.sh`，应用启动和 `APP_URL` 都必须来自统一状态输出。
- **`forge-eng` 新增 Dev Server 端口契约**：worktree 创建后如需运行应用，优先使用项目统一 dev entrypoint；收尾前必须停止当前 worktree 服务。
- **`forge-qa` v3.1 → v3.2**：浏览器验收不再猜 `localhost:3000/5173/8080`，Mode B 的 `app_url` 必须由调用方或 dev-status 提供。
- **`forge-status` 增加只读 dev server 巡检**：展示 `.devserver.json`、tmux session、监听端口、PID、cwd；但不把进程状态用于 active.md 僵尸判定。
- **`/forge` 总入口展示 dev server 状态**：如果项目提供 `dev:status` 或 `dev-stack`，状态检查时一并展示当前前后端监听信息。

### Fixed
- **worktree 抢主分支端口**：避免旧 Vite / uvicorn 继续占着 `3000`、`5173`、`8080`，导致浏览器看到旧代码。
- **localhost URL 不可追溯**：`APP_URL` 必须能追到具体 cwd，减少"我到底测的是哪个分支"的排查时间。
- **QA 测错服务**：forge-qa 不再自行扫常见端口，避免把 main 或其他 worktree 当作当前修复结果。

### Notes
- 这是流程治理 release，不改变业务功能。
- `skills/forge-brainstorm/SKILL.md` 的既有未提交改动不属于本次端口治理，未纳入本次 release。

## [v2026.04.24] — 2026-04-24（Codex 安装兼容）

### Fixed
- **Codex skill 未加载 forge 系列**：安装脚本此前只写入 `~/.claude/skills`，导致 Codex 当前会话可发现的 `~/.agents/skills` 中没有 `forge-fupan` 等 skill。

### Changed
- **`install.sh` 默认安装到双目标**：同时创建 Claude Code `~/.claude/skills` 和 Codex `~/.agents/skills` 的 symlink。
- **新增安装目标参数**：`--target claude|codex|both`、`--status`、`--dry-run`、`--force`。
- **安装安全性提升**：默认只替换 symlink；遇到同名真实文件/目录会停止并提示，避免误删。
- **README 安装说明**：补充 Claude Code / Codex 双端安装和状态检查命令。

## [v2026.04.19.1] — 2026-04-19（并行化迭代）

### 主题

`forge-bugfix` v5.0 → v6.0：**多会话并行协调**。支持 3–4 个 Claude Code 窗口同时修不同功能域的 bug，互不撞车。

详细见 [`docs/forge-bugfix-changelog.md`](docs/forge-bugfix-changelog.md) 的 v6.0 节。

### Added
- **`.forge/active.md` 心跳文件**：跨 worktree 共享的并行会话登记表，字段极简（session id / worktree / 任务 id / 功能域）
- **功能域判重**：`backlog.md` 表格新增"功能域"和"领取会话"列；`.forge/active.md` 头部有"功能域声明"区，项目自定义业务标签（AI 不得自创）
- **合并前 merge 预演**（forge-bugfix P7.1.0）：`git merge --no-commit --no-ff` 预演，冲突则回退 + 让用户决策 rebase 或暂存
- **新 skill `/forge-status`**：扫 `.forge/active.md`，按硬信号（worktree 存在性 + 分支合并状态）判活/死，交互确认后清理。合并 status + cleanup 两种职责为一个 skill
- **session id 自动获取**：`skills/forge-bugfix/scripts/get-session-id.sh` 通过 `$PPID` 回溯读 `~/.claude/sessions/<pid>.json`
- **新增模板**：`skills/forge-bugfix/templates/active.md`

### Changed
- **`forge-bugfix` SKILL.md**：version 5.0 → 6.0；铁律 +1（并行协调登记）；P0 新增并行探测；P2 新增 2.0 功能域判重节；P3 新增 3.1.5 登记 active；P7 新增 7.1.0 合并预演 / 7.1.2 冲突处理；规则新增 7 条并行纪律（29.1-29.7）
- **`forge-fupan` SKILL.md**：Phase 5.0 新增"清理本会话 `.forge/active.md` 登记"步骤（只清 session id 匹配的行，不动其他会话）
- **`forge-bugfix` description**：从串行"一次只修一个 bug"改为支持"多会话并行 + 同域归并 + 异域并行 + 合并预演"
- **闭环哲学**：修复完成后**不立即清 active.md**，交给 forge-fupan（正常结束）或 /forge-status（兜底）；绝不用时间戳判"僵尸"
- **README.md / docs/forge-user-guide.md / docs/skills-reference.md / SKILL.md**：Skills-14 → 15，相关 skill 清单同步加入 forge-status
- **`install.sh`**：SKILLS 数组新增 forge-status

### Design Decisions（关键决策记录在 changelog）

- **为什么不用文件集判重而用功能域**：用户直接否决文件集方案——3 个 ASR bug 跨前后端时文件集零重叠但上下文强相关，功能域是业务视角能正确分组
- **为什么一个会话内多 bug 仍然各自独立 worktree**：同域归并是复用"认知"，但代码隔离价值与会话数量无关
- **为什么不用时间戳判僵尸**：时间启发式会误杀活跃会话；worktree 存在性 + 分支合并状态是客观事实
- **为什么 status 和 cleanup 合并成一个 skill**：用户明确要求"别复杂"，一个命令一条流程直接走完

---

## [v2026.04.19] — 2026-04-19

### 主题

`forge-bugfix` 双层验收清单：给 bug 修复加明确封闭边界 + 新发现行动化分流。

详细见 [`docs/iterations/2026-04-19-双层验收清单.md`](docs/iterations/2026-04-19-双层验收清单.md)。

### Added
- **`forge-bugfix` 新节点**：
  - P5.3 生成验收清单文档
  - P6.5 用户人工验收
  - P7.5 新发现分流到 backlog
- **模板**：
  - `skills/forge-bugfix/templates/review-checklist.md`（单 bug 验收清单）
  - `skills/forge-bugfix/templates/backlog.md`（4 区任务池：待修 / 新需求 / 待澄清 / 已处理）
- **`forge-qa` 新增 Mode B**（单 bug 验收清单模式），Mode A 不变
- **文档沉淀**：
  - `docs/brainstorm-人工反馈收集-2026-04-19.md`（讨论过程）
  - `docs/forge-bugfix-changelog.md`（skill 演进索引）
  - `docs/iterations/2026-04-19-双层验收清单.md`（迭代记录）
  - `updatemd/claude-md/2026-04-19-R11-双层验收清单.md`（R11 规则模板，供其他用户抄到 CLAUDE.md）
  - `updatemd/forge-bugfix/2026-04-19-双层验收清单改造.md`
  - `updatemd/forge-qa/2026-04-19-Mode-B单bug验收.md`
- **`skills/forge-bugfix` allowed-tools 新增 `Skill`**（用于 P6 调用 forge-qa）

### Changed
- **`forge-bugfix` P6 重写**：不再内部做 QA，明确通过 Skill 工具调用 `forge-qa`（Mode B），强规范包含前置门禁 / 参数契约 / 异常兜底
- **`forge-bugfix` P7 改造**：按用户验收结论三选一分流（Pass 合并 / Fail 回 P5 / Pass + 新发现 合并并 P7.5）
- **`forge-bugfix` 出口默认**：推荐新会话或 `/clear`、`/compact`，避免长会话 scope 蔓延
- **任务池**：`TODO.md` → `docs/bugfix/backlog.md`（单一入口 + 4 区结构）
- **同根判定**：软建议 → 硬性举证（同文件/同函数/同数据流），举证不足默认独立 bug

### Removed
- **`forge-bugfix` P7 "弃用 worktree" 选项**：Fail 回 P5 继续修，真要放弃走 P4.4 三振出局
- **skill 内所有版本号引用**：`v5.0`、`v4.0`、`v3.x` 相关标注从 SKILL.md 移除，历史对比放 `docs/forge-bugfix-changelog.md`

### Fixed
- **验收边界模糊**：加入用户人工验收的明确 Pass/Fail/Pass + 新发现 结论，解决"修到第 5 个还没封闭"
- **scope 蔓延**：新发现禁止当场顺手修，必须分流到 backlog
- **QA 散乱**：每次修复的证据集中到同一份验收清单文档，不再散落各处

---

## [v2026.04.18] — 2026-04-18（追溯）

### 主题

`forge-bugfix` v2.1.0 → v4.0.0：单弹道最小修复 + worktree 隔离。

### Changed
- **一次只修 1 个 bug**（或 1-2 个共因 bug），其余进 TODO
- **每次一个 worktree** 隔离代码变更
- **修完不自动合并**，必须用户 P7 确认
- **出口建议下一步**（review / ship / fupan）

### Added
- **CLAUDE.md R8/R9/R10 规则**：异常态必须设计 / 改动必须扫描影响面 / 环境改动必须验证

---

## [2026-04 早期]（追溯）

- 规范驱动开发框架确立：Feature Spec + 验收计划 + 举一反三
- 仓库重构为 skill repository 结构
- README 重写 + MIT License

---

## 命名约定

- **稳定标签**：`vYYYY.MM.DD`
- **迭代记录**：`docs/iterations/YYYY-MM-DD-<主题>.md`
- **skill 优化记录**：`updatemd/<skill>/YYYY-MM-DD-<主题>.md`
