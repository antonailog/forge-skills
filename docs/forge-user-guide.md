# Forge 使用指南

## 一、Forge 是什么

Forge 是一套**文档驱动的 AI 辅助开发工作流系统**。品牌名"Forge"（锻造），寓意反复打磨、质量导向。

### 核心理念

```
充分讨论 → 充分设计 → 高质量交付 → 知识沉淀
```

Forge 由 **14 个核心 Skill + 1 个总入口** 组成，覆盖从灵感到上线的完整开发生命周期。每个 Skill 专注一个阶段，Skill 之间通过文档（PRD.md、DESIGN.md、ENGINEERING.md、QA.md）传递上下文，而非依赖会话历史。

### 设计哲学

- **文档即契约** -- PRD、DESIGN、ENGINEERING 等文档既是人类的决策记录，也是下游 Agent 的执行指令
- **上下文隔离** -- 主调度器只做编排，真正的工作在子 Agent 的独立上下文中完成，避免 context rot
- **质量门控** -- 分级 TDD、Verification Gate、设计评分等机制，层层把关
- **用户驱动** -- 关键决策点暂停等待确认，不自动跳过任何环节

---

## 二、系统架构

### 2.1 分层架构

![Forge 分层架构](../assets/forge-architecture.svg)

```
┌─────────────────────────────────────────────────────────────────┐
│  用户层        /forge — 任何时候不知道下一步，打这个命令           │
├─────────────────────────────────────────────────────────────────┤
│  探索层        brainstorm    prd       dev（--full 端到端）      │
│  (讨论+规划)   4模式·6阶段   需求管理   调度器·可一路到发布       │
├─────────────────────────────────────────────────────────────────┤
│  设计层        design（纯规划）          design-impl（纯实现）    │
│  (规划+实现    分级门控·99条UX·          Token驱动·shadcn/ui·    │
│   分离)        搜索引擎·反AI-slop        CSS优先·原子提交        │
├─────────────────────────────────────────────────────────────────┤
│  工程层        eng（工程实现）            bugfix（Bug调查修复）   │
│  (Worktree+    Worktree隔离·四级TDD·     6阶段·根因铁律·        │
│   TDD+验证)    Wave并行·验证门控          三振出局·双层验收      │
├─────────────────────────────────────────────────────────────────┤
│  质量层        qa（纯验收·只测不修）      review（PR审查）        │
├─────────────────────────────────────────────────────────────────┤
│  发布层        ship（发布）   doc-release（文档）  fupan（复盘）  │
├─────────────────────────────────────────────────────────────────┤
│  文档层        brainstorm-*.md → PRD.md → DESIGN.md →           │
│  (Skill间      ENGINEERING.md → QA.md → CHANGELOG → 复盘文档    │
│   唯一通信)                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 完整工作流

![Forge 完整工作流](../assets/forge-workflow.svg)

```
用户有想法
    │
    ▼
/forge（检查状态·推荐下一步）
    │
    ▼
forge-brainstorm ─── 内容模式 → 直接输出
    │                 构建模式 → forge-eng（轻量）→ forge-ship
    ▼
  需要PRD?
  ├─ 是 → forge-prd → PRD.md
  └─ 否 ──────────────────────┐
    │                          │
    ▼                          │
forge-dev（调度器）◄────────────┘
    │
    ├─ 有UI? ──── 是 → forge-design → DESIGN.md
    │                      │
    │                      ▼
    │              forge-design-impl → 样式代码
    │                      │
    ▼                      │
forge-eng ◄────────────────┘
  Worktree隔离 · TDD · Wave并行 · Verification
  ENGINEERING.md · 原子commit
    │
    ▼
forge-qa（纯验收·只测不修）
  ├─ 有bug → 报告回 forge-eng
  └─ 通过 ─┐
           ▼
    forge-review（PR审查）
           │
           ▼
    forge-ship → PR / merge
     ├── forge-doc-release（文档更新）
     └── forge-fupan（复盘知识沉淀）
```

---

## 三、快速开始

### 2.1 不知道该干什么？

```
/forge
```

总入口会检查项目状态（文档、代码、分支、Worktree），推荐下一步。任何时候迷失方向，打 `/forge` 就对了。

### 2.2 六种常见场景

| 场景 | 命令 | 说明 |
|------|------|------|
| 有个新想法 | `/forge-brainstorm` | 4 模式头脑风暴，产出思考文档 |
| 要做新功能 | `/forge-prd` | 创建或迭代 PRD |
| PRD 确认了，开始开发 | `/forge-dev` | 自动调度设计 → 工程 → QA |
| 改 bug | `/forge-bugfix` | 6 阶段根因分析 + 修复 |
| 代码写好了，要发布 | `/forge-ship` | 测试 → 审查 → PR |
| 做完了，总结一下 | `/forge-fupan` | 复盘知识沉淀 |

---

## 三、完整 Skill 清单

### 1. forge -- 总入口

- **触发方式**: 说"forge"、"下一步"、"接下来做什么"
- **核心流程**: 检测项目状态（文档、代码、分支、Worktree）→ 决策树判断 → 推荐下一步
- **产出物**: 无文件产出，纯建议
- **出口建议**: 根据状态推荐具体 Skill

### 2. forge-brainstorm -- 头脑风暴

- **触发方式**: 说"头脑风暴"、"brainstorm"、"讨论一下"、"我有个想法"、"帮我想想"
- **核心流程**: 6 阶段
  1. Phase 0: 上下文感知 + 模式检测
  2. Phase 1: 深度提问（模式专属问题）
  3. Phase 2: 景观感知（可选，搜索行业现状）
  4. Phase 3: 前提挑战（防止 XY 问题）
  5. Phase 4: 方案生成（强制 2-3 个方案）
  6. Phase 5: 思考文档（含对抗性审查）
- **4 种模式**:
  - **产品模式** -- 工程项目/功能设计/系统架构（严格诊断，挑战假设）
  - **内容模式** -- 写文章/演讲/内容策划（编辑伙伴）
  - **构建模式** -- 小 demo/POC/学习项目（热情协作者）
  - **探索模式** -- 方向不明确（最宽漏斗）
- **产出物**: `brainstorm-{topic}-{YYYY-MM-DD}.md`
- **出口建议**: 产品模式推荐 `/forge-prd`，构建模式推荐 `/forge-dev`

### 3. forge-prd -- PRD 管理

- **触发方式**: 说"更新 PRD"、"调整需求"、"迭代 PRD"
- **核心流程**: 4 步
  1. 第 0 步: 定位项目、PRD 与 CHANGELOG
  2. 第 1 步: 理解现状（读 PRD + CHANGELOG + 源码）/ 从零创建 PRD
  3. 第 2 步: 诊断与审查（自适应三层深度：轻量/标准/深度）
  4. 第 3 步: 方案确认（多轮交互，门禁：确认前不写文件）
  5. 第 4 步: 写入文档（CHANGELOG + PRD + 迭代交付说明）
- **产出物**: `docs/PRD.md`、PRD CHANGELOG、`.features/{feature-id}/status.md`
- **出口建议**: `/forge-dev` 启动开发

### 4. forge-dev -- 开发调度器

- **触发方式**: 说"开始开发"、"实现需求"，或 PRD 更新后
- **核心流程**: 6 步
  1. 第 -1 步: Brainstorm 感知（检查 PRD/思考文档）
  2. 第 0 步: 读取 PRD 输出 + 项目类型判断
  3. 第 1 步: Discussion 阶段（结构化偏好收集，识别灰区）
  4. 第 2 步: Research 阶段（技术调研，四维度）
  5. 第 3 步: 分析与调度建议（判断需要哪些子 Skill）
  6. 第 4 步: Wave 并行调度子 Skill（独立上下文执行）
  7. 第 5 步: 汇总交付报告
- **4 种模式**: 交互模式（默认）、自动模式（`--auto`）、恢复模式（`--resume`）、全自动交付（`--full`：review → ship → doc-release，原 forge-deliver 已退役并入）
- **产出物**: `docs/CONTEXT.md`、`docs/RESEARCH.md`、`.forge/dev-state.json`
- **出口建议**: `/forge-review` 或 `/forge-ship` 或 `/forge-fupan`

### 5. forge-design -- 设计规划

- **触发方式**: 说"设计"，或由 forge-dev 调度
- **核心流程**: 分级门控
  - L1 完整设计: 竞品调研 → 美学方向(3+) → 配色/字体 → Token 体系 → 99 条 UX 规则审计 → 0-10 评分 → DESIGN.md
  - L2 轻量审查: 读 DESIGN.md → 对照检查 → 重点 10 项审计 → 一致性验证 → 更新文档
  - L3 跳过设计: 纯后端/无 UI → 直接进 forge-eng
- **特色**: 自闭环，内嵌 99 条 UX 规则 + 搜索引擎 + 反 AI 模板检测 + 设计师认知模式 12 条
- **产出物**: `docs/DESIGN.md`、DESIGN CHANGELOG
- **出口建议**: `/forge-design-impl` 或 `/forge-eng`

### 6. forge-design-impl -- 设计实现

- **触发方式**: 说"实现设计"，或设计文档确认后
- **核心流程**: 读取 DESIGN.md → 识别实现清单 → 逐项实现 → 每项自检 → 原子提交 → 质量验证
- **实现原则**: CSS 优先、Token 驱动、遵循现有代码风格、响应式必须
- **产出物**: 代码变更（样式和布局，不改业务逻辑）
- **出口建议**: `/forge-eng` 继续业务逻辑实现

### 7. forge-eng -- 工程实现

- **触发方式**: 说"工程"、"实现"，或由 forge-dev 调度
- **核心流程**: 10 步
  1. 第 0 步: 定位项目文档
  2. 第 0.5 步: 模式选择（完整/轻量）
  3. 第 1 步: 范围挑战
  4. 第 2 步: 理解现状 / 从零创建 ENGINEERING.md
  5. 第 3 步: 四章工程审查（架构/代码质量/测试/性能）
  6. 第 4 步: 工程方案设计
  7. 第 5 步: 更新工程文档
  8. 第 5.5 步: 创建 Worktree（会话级隔离）
  9. 第 5.7 步: 测试框架检测与引导
  10. 第 6 步: 任务拆分与 Wave 规划（含 TDD 级别标注）
  11. 第 7 步: Wave 并行执行（TDD + Verification Gate）
  12. 第 8 步: 必需产出
  13. 第 9 步: 确认总结
  14. 第 10 步: 分支收尾（merge / PR / keep / discard）
- **三条铁律**:
  1. 不先验证就不准声称完成
  2. 不先写失败测试就不准写实现（严格 TDD）
  3. 3 次修复失败就质疑架构
- **产出物**: `docs/ENGINEERING.md`、ENGINEERING CHANGELOG、代码变更、测试代码、Worktree 分支
- **出口建议**: `/forge-qa`

### 8. forge-qa -- QA 验收

- **触发方式**: 说"测试"、"QA"，或由 forge-dev 调度
- **核心流程**: 读取 PRD + ENGINEERING.md → 测试计划 → 执行测试 → 生成报告
- **铁律**: **只测不修** -- 发现 bug 记录到报告，由 forge-eng 修复
- **测试引擎**: Playwright（浏览器截图 + E2E 断言；Codex 环境优先 browser-use）、纯代码（静态分析）
- **测试范围**: 端到端用户流程、跨模块集成、视觉回归+响应式、性能指标、验收标准逐项核对
- **产出物**: `docs/QA.md`、QA CHANGELOG、测试报告
- **出口建议**: 有问题回 `/forge-eng`，全部通过走 `/forge-review` 或 `/forge-ship`

### 9. forge-bugfix -- Bug 调查修复

- **触发方式**: 说"修这个 bug"、"这里有问题"、"排查一下"
- **核心流程**: P0-P8 流水线
  1. P0-P1（会话级）: 环境探测 + 问题理解（强制读 PRD/ENGINEERING/Bugfix 历史/Memory）
  2. P2-P2.5: 范围推荐（一次修一个）+ 创建 Bug 修复验收报告 `docs/bugfix/reviews/BF-XX.md`
  3. P3-P5: 独立 worktree 复现 → 根因追踪（5 Whys + 三振出局）→ TDD 驱动修复 + 原子提交
  4. P6-P7: forge-qa Mode B 自动回归 + 用户最终验收（双层验收）
  5. P8: 沉淀（backlog 归档 + BF 报告移入 archive/raw）
- **铁律**: **不做根因分析，就不写修复代码**；没有用户最终结论不合并。
- **产出物**: 修复代码、`docs/bugfix/reviews/BF-XX.md` 案卷
- **出口建议**: `/forge-qa` → `/forge-ship`

### 10. forge-review -- PR 审查

- **触发方式**: 上线前代码审查
- **核心流程**: 确定基础分支 → 检查分支状态 → 分析 diff → 检查结构性问题（SQL 安全、竞态条件、LLM 信任边界、枚举完整性等）→ 发现问题直接修复
- **产出物**: 审查结论、修复代码（如有）
- **出口建议**: `/forge-ship`

### 11. forge-ship -- 发布

- **触发方式**: 代码写好准备上线
- **核心流程**: 审查就绪检查 → 合并基础分支 → 运行测试 → 审查 diff → 更新 CHANGELOG → 提交 → 推送 → 创建 PR
- **产出物**: Git 提交、远程分支、PR
- **出口建议**: `/forge-doc-release` → `/forge-fupan`

### 12. forge-doc-policy -- 文档治理规范

- **触发方式**: 说"文档治理"、"文档放哪"，或 AI 准备创建任意 .md / 新目录前自查
- **核心流程**: 提供当前真相源白名单（doc-paths.md）+ frontmatter schema + 新项目一键脚手架（init-project.sh）
- **产出物**: 所有 forge-* skill 的文档落地路径以它的 doc-paths.md 为准
- **备注**: 端到端交付请用 `/forge-dev --full`（原 forge-deliver 已于 2026-07-04 退役并入 forge-dev）

### 13. forge-doc-release -- 发布后文档更新

- **触发方式**: 在 forge-ship 之后、PR 合并之前
- **核心流程**: 读取所有项目文档 → 与 diff 交叉对照 → 更新 README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md → 润色 CHANGELOG 语气 → 清理 TODOS → 可选更新 VERSION
- **产出物**: 更新后的项目文档
- **出口建议**: 合并 PR → `/forge-fupan`

### 14. forge-fupan -- 复盘

- **触发方式**: 说"复盘"、"总结一下这次"、"学习总结"
- **核心流程**: 派给执行方（默认 Codex）→ 读会话日志 → 对话里问一次（由当前会话转话）→ 写三节（工作总结、工作复盘、知识拓展）→ `build.py` 编成单篇页面、重建汇总页 → 当前会话验收
- **产出物**: 单篇复盘页（对标最佳路径、需求表达、知识地图、关键术语）+ 工作台（按项目和模块组织的复盘汇总、经验、知识三页）；认领的经验和知识编号写进经验库、知识库
- **出口建议**: 下一个迭代
- **额外职责**: 收尾时清理本会话在 `.forge/active.md` 的登记

### 15. forge-status -- 并行会话巡检（v6.0 新增）

- **触发方式**: 说 "forge 状态" / "看下谁在跑" / "清理 worktree" / `/forge-status`
- **核心流程**: 读 `.forge/active.md` → 对每条记录跑硬信号判定（worktree 目录是否存在、分支是否已合并）→ 交互确认清理
- **两种模式**:
  - 交互清理（默认，用户主动触发）：扫 → 报告 → 一次 y/n → 清理
  - 只读巡检（forge-bugfix P0 自动调用）：只报告不清理
- **硬信号（僵尸判定）**:
  - worktree 目录不存在 → 真·已弃用
  - 分支已 merged 到 main → 真·已完成，漏清理
- **明确不用的信号**: 时间戳 / "超过 N 小时" / 最近 commit 时间
- **产出物**: 清理后的 `.forge/active.md` + backlog.md 联动更新（状态、领取会话字段）
- **出口建议**: 继续用 `/forge-bugfix` 等主流程 skill

---

## 四、工作流模式

### 4.1 完整流程（新项目 / 重大功能）

```
forge-brainstorm → forge-prd → forge-dev → forge-design → forge-design-impl → forge-eng → forge-qa → forge-review → forge-ship → forge-doc-release → forge-fupan
```

适用场景：从零开始的新项目、重大架构调整、全新功能模块。

### 4.2 标准流程（迭代已有功能）

```
forge-prd → forge-dev → forge-eng → forge-qa → forge-ship
```

适用场景：在已有 PRD 基础上迭代功能，设计体系已建立。forge-dev 会自动判断是否需要 forge-design。

### 4.3 轻量流程（小 demo / POC）

```
forge-brainstorm → forge-eng（轻量模式）→ forge-ship
```

适用场景：快速实验、学习项目、黑客松。跳过 PRD 和完整文档，保留 Worktree 隔离和 TDD。

### 4.4 Bug 修复

```
forge-bugfix → forge-qa → forge-ship
```

适用场景：修复 bug。bugfix 自带根因分析和修复验证，qa 做回归测试。

### 4.5 写文章 / 内容

```
forge-brainstorm（内容模式）→ 直接输出
```

适用场景：写文章、做演讲、内容策划。brainstorm 的内容模式会帮你理清结构和论点。

---

## 五、关键机制详解

### 5.1 分级门控（forge-design）

![设计门控体系](../assets/forge-design-gating.svg)

forge-design 使用三级门控系统，自动判断设计工作的深度：

| 级别 | 触发条件 | 流程深度 |
|------|----------|---------|
| **L1 完整** | 新项目/新页面/新功能模块 | 竞品调研 → 美学方向 → Token 体系 → 99 条 UX 审计 → 0-10 评分 |
| **L2 轻量** | 迭代已有功能/样式微调 | 读 DESIGN.md → 重点 10 项审计 → 一致性验证 |
| **L3 跳过** | 纯后端/API/无 UI | 直接进 forge-eng |

**自动升级机制**：
- **迭代不满**: 同一模块在 PRD CHANGELOG 中 >= 3 次迭代 → L2 升 L1，强制重新设计
- **评分过低**: L2 评分 < C → L2 升 L1，完整重来
- **子模块一致性**: 大需求下的子模块必须与父页面 DESIGN.md 保持一致

### 5.2 四级 TDD + Worktree + Verification（forge-eng）

![forge-eng 三大机制](../assets/forge-eng-internals.svg)

forge-eng 根据文件类型自动判断 TDD 级别：

| TDD 级别 | 适用场景 | 执行方式 |
|----------|---------|---------|
| **严格 TDD** | 后端 API / 数据处理 / Bug 修复 | 写失败测试 → 最小实现 → 测试通过 → 重构（红绿重构） |
| **轻量 TDD** | 前端组件（*.tsx / *.vue / *.jsx） | 关键交互测试，不要求先红后绿 |
| **验证驱动** | 无测试框架时 | 每个任务定义可执行验证命令（curl / 脚本 / 截图） |
| **跳过** | 纯样式 / 配置 / 文档 | 无需测试 |

**特殊规则**：Bug 修复无论文件类型，一律使用严格 TDD（必须先写复现测试）。

### 5.3 Worktree 隔离（forge-eng）

每次 forge-eng 会话创建独立的 Git Worktree：

- **隔离**: 在 `.worktrees/{feature-slug}` 目录工作，不影响主工作目录
- **分支**: 自动创建 `eng/{feature-slug}-{日期}` 分支
- **多会话**: 多个 forge-eng 会话可以同时运行，互不冲突
- **收尾选项**:
  - merge -- 合并到主分支
  - PR -- 创建 Pull Request
  - keep -- 保留分支，稍后处理
  - discard -- 放弃变更

### 5.4 Verification Gate（forge-eng）

每个原子 commit 前的强制验证：

1. 运行验证命令（测试 / curl / 脚本）
2. 读取完整输出，确认 exit code
3. **3 次重试**：失败后尝试修复，3 次仍失败则暂停并报告
4. **禁止模糊措辞**：不允许"should work"、"probably fixed"等表述

### 5.5 反谄媚与 Pushback（forge-brainstorm）

forge-brainstorm 内置严格的反谄媚机制：

**禁止的表达**：
- "有趣的想法" → 应说"这个想法的核心价值在于 X"
- "有很多种方式" → 应说"有两个方案：A 适合 X，B 适合 Y"
- "你的思路很好" → 应说"X 部分成立，但 Y 部分有漏洞"
- "这取决于你的需求" → 应说"基于你说的 X，我推荐 Y"

**5 种 Pushback 场景**：

| 检测模式 | Pushback |
|---------|----------|
| 模糊市场/受众 | "AI 工具"不是市场——哪个具体的人每周在哪个具体任务上浪费 2+ 小时？ |
| 社交证明代替验证 | "大家都觉得不错"——有人愿意付费吗？有人会在它挂掉时恐慌吗？ |
| 平台愿景 | "需要完整平台才能用"——这是红旗。最小有价值版本是什么？ |
| 未定义术语 | "更流畅的体验"——"流畅"不是功能。哪一步导致用户流失？ |
| 功能堆砌 | "你列了 12 个功能——哪 2 个能让人说 whoa？其他都砍掉。" |

**前提挑战 3 问**：
1. 这是正确的问题吗？（防止 XY 问题）
2. 不做会怎样？（验证必要性）
3. 已有什么可以复用？（避免从零开始的错觉）

---

## 六、产出物清单

| Skill | 产出文件 | 位置 |
|-------|---------|------|
| forge-brainstorm | `brainstorm-{topic}-{日期}.md` | 当前目录 |
| forge-prd | `PRD.md`、PRD CHANGELOG | `{项目}/docs/` |
| forge-prd | `status.md`、`_registry.md` | `{项目}/.features/{id}/` |
| forge-dev | `CONTEXT.md` | `{项目}/docs/` |
| forge-dev | `RESEARCH.md` | `{项目}/docs/` |
| forge-dev | `dev-state.json`、`checkpoints/`、`visual-decision.md` | `{项目}/.forge/` |
| forge-design | `DESIGN.md`、DESIGN CHANGELOG | `{项目}/docs/` |
| forge-design-impl | 代码变更（样式/布局） | 项目源码 |
| forge-eng | `ENGINEERING.md`、ENG CHANGELOG | `{项目}/docs/` |
| forge-eng | 代码变更 + 测试代码 | Worktree 分支 |
| forge-qa | `QA.md`、QA CHANGELOG | `{项目}/docs/` |
| forge-bugfix | 修复代码 + 验收清单 | 项目源码 |
| forge-review | 审查结论 + 修复代码 | 项目源码 |
| forge-ship | Git 提交、PR | 远程仓库 |
| forge-doc-release | 更新后的文档 | 项目根目录 |
| forge-fupan | 单篇复盘页 + 工作台（复盘 / 经验 / 知识） | `记录/复盘/<项目>/<模块>/<日期>-<标题>/` |

---

## 七、与其他工具的关系

### 被 Forge 调用的工具

| 工具 | 调用方 | 用途 |
|------|--------|------|
| Playwright | forge-qa、forge-bugfix | 浏览器截图 + E2E 测试脚本 |
| browser-use:browser | forge-qa、forge-bugfix（Codex 环境） | 用户视角截图 + DOM 证据 |
| WebSearch | forge-brainstorm、forge-dev | 行业调研、技术调研 |

### 独立工具（不在 Forge 流程内）

以下工具独立使用，不属于 Forge 工作流：

- **model-api** -- 模型 API 调用
- **project-learner** -- 项目学习
- **文档工具**（docx、pdf、xlsx、pptx）-- 文档格式转换

---

## 八、FAQ

**Q: 我不想走完整流程怎么办？**

A: `/forge` 会根据项目当前状态智能推荐，你也可以直接调用任何单独的 Skill。比如只想写代码就直接 `/forge-eng`，只想测试就 `/forge-qa`。每个 Skill 都能独立运行。

**Q: 改了代码发现还是有 bug？**

A: forge-qa 只报告不修。发现问题后，根据 QA 报告回到 `/forge-eng` 走 TDD 修复。这是设计如此，确保测试和修复职责分离。

**Q: 多个会话同时开发不同功能？**

A: Worktree 自动隔离。每个 forge-eng 会话创建独立的 `.worktrees/{feature}` 目录和分支，互不干扰。完成后可以选择 merge、PR、保留或丢弃。

**Q: 想一步到位从需求到发布怎么办？**

A: 用 `/forge-dev --full`。它在 设计 → 工程 → QA 之后接上可选发布尾段（review → ship → doc-release）。原来的 forge-deliver 已于 2026-07-04 退役并入 forge-dev，归档在 `_archive/`。

**Q: 轻量模式和完整模式怎么选？**

A: forge-eng 在检测到无 PRD/ENGINEERING.md 时会提示选择。完整模式适合正式项目（创建工程文档、做四章审查），轻量模式适合 demo/POC/快速实验（跳过文档，保留 Worktree + TDD + 原子提交）。

**Q: 自动模式（--auto）真的不需要人参与吗？**

A: 不是。自动模式的"自动"是指**前置沟通完毕后**的执行自动化。前置沟通（1-2 轮需求确认）不可跳过。自动模式下代码不会 git commit，而是用 patch 保存检查点。

**Q: Feature 状态文件（.features/）是什么？**

A: 这是多会话并行的协调机制。forge-prd 创建 feature，各 Skill 通过 `.features/{id}/status.md` 的 Pipeline 表互相感知状态。领域文档（PRD.md/DESIGN.md 等）只存内容不存运行状态，保证多会话安全。
