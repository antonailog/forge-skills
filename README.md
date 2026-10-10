<div align="center">

# Forge

**规范驱动的 AI 辅助开发工作流（Claude Code / Codex Skills）**

> 先充分讨论，再写文档明确需求，再基于文档设计和实现。<br>
> 无 Feature Spec 不写代码。无验收计划不跑测试。发现问题必须举一反三。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Skills](https://img.shields.io/badge/Skills-14%2B1-blue)]()
[![Release](https://img.shields.io/github/v/release/yike-gunshi/forge-skills?label=Release&color=green)](https://github.com/yike-gunshi/forge-skills/releases)

[这是什么](#这是什么) · [快速开始](#快速开始) · [Skill 清单](#skill-清单) · [关键机制](#关键机制) · [安装](#安装) · [设计哲学](#设计哲学) · [文档导航](#文档导航)

</div>

---

## 这是什么

Forge 是一套覆盖**从头脑风暴到发布复盘完整开发链路**的 Claude Code / Codex Skills：**14 个专职 Skill + 1 个总入口 `/forge`**。既可全链路串联（`/forge-dev --full` 从需求一路编排到发布），也可单独调用任意一环（比如只用 `/forge-eng` 写代码）。

核心理念是**规范驱动开发（Spec-Driven Development）**：每个功能在写代码前必须有 Feature Spec——Given/When/Then 行为场景 + 验收检查表——经用户确认后才进入开发；QA 基于同一份 Spec 逐项断言。文档是 Skill 之间传递上下文的唯一通道，不依赖会话历史。

### 解决的核心问题

| 问题 | 没有 Forge | 有 Forge |
|------|-----------|---------|
| 讨论不足，直接开干 | 口头一说就写代码 | forge-brainstorm 多轮讨论 → 方案确认 |
| 需求模糊，验收靠人肉 | PRD 没有精确验收标准 | Feature Spec（Given/When/Then + 验收检查表）→ 用户确认后才开发 |
| QA 测不出问题 | 只测"元素存在"不测"符合设计" | 基于验收检查表逐项断言（含 CSS 属性值） |
| 反馈后不举一反三 | 报了 3 个 bug，只修 3 个 | 搜索相似模式 → 类似风险清单 → 一并修复 |
| 设计粗糙，改了又改 | 简单想法直接写 | forge-design 自闭环（竞品 + 美学 + 99 条 UX 规则 + 门控） |
| AI 长会话质量劣化 | 一个会话干到底 | 上下文工程：调度器精简，子任务独立上下文 |
| 教训不沉淀，问题复发 | 复盘写完就忘 | forge-fupan 账本 + 开工自动回放 + 复发检测 |
| 不知道下一步 | 记住所有 skill 名字 | `/forge` 检查状态，推荐下一步 |

---

## 系统全景

```
用户有想法
       │
       ▼
  ┌─────────────────┐
  │ forge-brainstorm │  头脑风暴 → 思考文档
  └──────┬──────────┘  4 模式：产品 · 内容 · 构建 · 探索
         │
         ▼
  ┌──────────┐
  │ forge-prd│  产品诊断 → PRD 当前事实 + .features Feature Spec + CHANGELOG
  └────┬─────┘  ⚠️ Feature Spec 用户确认后才进入开发
       │
       ▼
  ┌──────────┐
  │ forge-dev│  调度器 → Discussion → Research → 子技能调度
  └────┬─────┘  --full 尾段可一路编排到发布
       │ 独立上下文执行
  ┌────┼──────────────────────┐
  ▼    ▼                      ▼
┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐
│  forge-  │ │forge-design- │ │  forge-  │ │  forge-  │
│  design  │ │    impl      │ │   eng    │ │    qa    │
└──────────┘ └──────────────┘ └──────────┘ └──────────┘
 设计规划      设计→代码        工程实现      QA 验收
 自闭环                       TDD+Worktree  验收计划→测试
                                            →举一反三
       │
       ▼
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │  forge-  │ → │  forge-  │ → │  forge-  │
  │  review  │   │   ship   │   │  fupan   │
  └──────────┘   └──────────┘   └──────────┘
   代码审查       发布流程       复盘沉淀

随时：/forge → 检查项目状态，推荐下一步
```

---

## 快速开始

**场景 A：新想法**
```
/forge-brainstorm  → 讨论想法，产出思考文档
/forge-prd         → PRD 当前事实 + .features Feature Spec（用户确认后才开发）
/forge-dev         → 调度设计 + 工程 + QA
```

**场景 B：已有 PRD**
```
/forge-dev         → 检查 Feature Spec → 调度
```

**场景 C：不知道下一步**
```
/forge             → 检查状态，告诉你该做什么
```

**场景 D：单独调用**
```
/forge-eng         → 只写代码（Worktree + TDD）
/forge-qa          → 只跑验收测试
/forge-bugfix      → 系统性修 Bug
```

**场景 E：全自动交付**
```
/forge-dev --full   → 从需求一路编排到发布（review → ship → doc-release）
/forge-dev --resume → 从检查点恢复
```
> forge-deliver 已于 2026-07-04 退役并入 forge-dev（归档在 `_archive/2026-07-04-forge-deliver-retired/`）。

**场景 F：新项目一键接入**
```
~/.claude/skills/forge-doc-policy/scripts/init-project.sh
                    → 幂等铺好 docs/、.features/、.forge/ 状态文件
```

---

## 效果示例

### Feature Spec 确认门禁

```
用户    ❯ 帮我加一个频道管理功能

forge   ❯ ⚠️ 该功能没有 Feature Spec。建议先运行 /forge-prd 生成。

用户    ❯ /forge-prd

forge   ❯ Feature Spec 已生成，请审阅：
          一、用户流程：设置页 → 频道列表 → 添加/删除/排序 → 保存
          二、页面结构：3 个区块，5 个组件
          三、行为场景：3 个功能点，共 9 个 Given/When/Then 场景
          四、验收检查表：18 项（功能 9 + 视觉 6 + 流程 3）
          
          A) 确认，进入开发
          B) 整体方向需要调整
          C) 细节需要修改
```

### 举一反三

```
用户    ❯ 频道卡片的间距不对，应该是 16px 不是 12px

forge   ❯ 已修复。搜索代码库发现 3 处类似风险：
          1. src/components/SourceCard.tsx:42 — 同样使用 gap-3（12px）
          2. src/components/ActionCard.tsx:28 — padding 也是 12px
          3. Feature Spec 中 StarredView 组件要求 gap: 16px，当前为 12px
          
          要一并修复吗？
          A) 全部修复
          B) 选择性修复
```

---

## Skill 清单

### 核心链路（9 个）

| 阶段 | Skill | 命令 | 职责 | 产出 |
|------|-------|------|------|------|
| 讨论 | forge-brainstorm | `/forge-brainstorm` | 头脑风暴（4 模式 · 6 阶段 · 反谄媚 · 对抗性审查） | 思考文档 |
| 需求 | forge-prd | `/forge-prd` | 产品诊断 + Feature Spec 生成 | PRD.md + .features/feature-spec.md |
| 调度 | forge-dev | `/forge-dev` | 开发调度器，编排子技能；`--full` 一路到发布 | CONTEXT.md + RESEARCH.md + .forge/ 检查点 |
| 设计 | forge-design | `/forge-design` | 全栈设计（竞品 + 美学 + Token + UX 规则 + 评分） | DESIGN.md |
| 设计工作台 | forge-design-lab | `/forge-design-lab` | 真 token 真像素骨架上定布局/密度（七层审查 + 保存直写 + token 同源导出） | 页面包 + tokens.css + DESIGN.md token 表 |
| 设计实现 | forge-design-impl | `/forge-design-impl` | 设计转代码（反 AI 模板 + Token 驱动 + 原子提交） | 样式代码 |
| 工程 | forge-eng | `/forge-eng` | 工程实现（Worktree + TDD + 逐场景自验） | ENGINEERING.md + 代码 |
| QA | forge-qa | `/forge-qa` | 验收计划 → 测试 → 报告 → 举一反三（只测不修） | QA 验收报告 |
| 审查 | forge-review | `/forge-review` | 代码审查（测试捕获不到的结构性问题） | 审查结论 + 修复 |
| 发布 | forge-ship | `/forge-ship` | 合并 + 测试 + CHANGELOG + PR | PR / 合并上线 |

### 辅助技能（6 个）

| Skill | 命令 | 职责 |
|-------|------|------|
| forge-bugfix | `/forge-bugfix` | 系统性 Bug 修复流水线（P0-P8：根因铁律 + 独立 worktree + TDD + 双层验收 + 多会话防撞车） |
| forge-status | `/forge-status` | 并行会话巡检与清理（扫 `.forge/active.md`，按硬信号判活/死，不用时间戳启发式） |
| forge-doc-release | `/forge-doc-release` | 发布后文档同步（README/ARCHITECTURE/CHANGELOG 对齐已发布内容） |
| forge-doc-policy | `/forge-doc-policy` | 文档治理规范（doc-paths.md 真相源白名单 + frontmatter schema + init-project.sh 脚手架） |
| forge-feature-doc | `/forge-feature-doc` | 需求设计文档：每个功能一份给人看的设计文档（待拍板置顶、先图后字、只写当前设计、末尾关键改动），配出图脚本和上线前检查；forge 各阶段收尾时同步，review / ship 当门禁 |
| forge-fupan | `/forge-fupan` | 复盘 v3：Workbench 门禁（独立会话页确认知识点和深度）→ 调研产出复盘文档；账本（learnings.jsonl）作副产出，开工回放 + 复发检测 |

### 总入口

```
/forge  →  检查项目状态（.features/、git branch、文档），推荐下一步
```

### 共享层

`skills/_shared/` 存放被多个 Skill 引用的公共规范，随 install.sh 一起 symlink，各 Skill 只写一行引用、不复制内容（单源防漂移）：

| 文件 | 内容 |
|------|------|
| `interaction-protocol.md` | AskUserQuestion 提问格式 + 全体系统一批量策略（≤3 单独问，>3 同类批量） |
| `feature-status-protocol.md` | `.features/` 状态标记（⏳🔄✅❌⏸️）+ 通用操作规则 |
| `current-doc-loading.md` | 当前文档加载契约（真相源优先，changelog/archive 按需） |
| `visual-decision-layer.md` | 视觉决策层：结构问题优先 Mermaid，气质判断用 Image 2，验收只认真实截图 + CSS 断言；复盘默认不配图 |

---

## 关键机制

### Feature Spec（规范驱动）

每个功能在开发前**必须**有 Feature Spec。完整 Spec 写入 `.features/{feature-id}/feature-spec.md`；`docs/PRD.md` 保持为产品当前真相源，只吸收已确认且仍有效的产品事实。

| 章节 | 内容 | 服务于 |
|------|------|--------|
| 用户流程总览 | 入口 → 步骤 → 出口（含异常分支） | 用户确认整体方向 |
| 页面/系统结构 | 全局布局 → 区块职责 → 组件清单 + CSS 约束 | 用户确认结构 |
| 行为场景 | Given/When/Then × 3（正常/异常/边界） | 开发对标 + QA 断言 |
| 验收检查表 | 功能验证 + 视觉合规（含 CSS 值）+ 流程完整性 | QA 直接用作测试用例 |

### 规范驱动规则（R1-R7）

写入项目 CLAUDE.md，每次会话自动加载：

| 规则 | 内容 |
|------|------|
| **R1** | 无 Feature Spec 不写代码 |
| **R2** | 实现严格对标文档，逐场景自验 Given/When/Then |
| **R3** | 视觉实现对标 DESIGN.md，CSS 值必须一致 |
| **R4** | QA 基于验收检查表断言，含具体 CSS 属性值检查 |
| **R5** | 收到反馈时举一反三（搜索相似模式 + 类似风险清单） |
| **R6** | 提交前自验所有相关场景 |
| **R7** | 声称完成时提供验证证据 |

### 上下文工程

解决 AI 长会话质量劣化（Context Rot）问题：

```
forge-dev（调度器，~30% 上下文）     forge-eng（执行器，100% 全新上下文）
┌─────────────────────┐           ┌──────────────────────────┐
│ PRD 摘要             │  Agent    │ ENGINEERING.md 全文       │
│ RESEARCH.md 摘要     │ ───────→ │ .features Feature Spec 行为场景 │
│ 执行计划             │  传递路径  │ 源代码（按需读取）         │
└─────────────────────┘           └──────────────────────────┘
```

同一思路贯穿全体系：每个 SKILL.md 只保留骨架和铁律，阶段细则拆进 `references/` 按需加载（如 forge-bugfix 63KB → 12.6KB 骨架 + 4 份阶段手册）。2026-07-17 对标 Anthropic skill-creator 与 yao-meta-skill 完成两轮整改后，15 个 SKILL.md 总量累计下降 22%（4429→3449 行），最大文件 332 行，全部远离官方 500 行红线；触发路由用 `evals/trigger-cases.md` 回归。

### 复盘闭环（能力复利）

```
forge-fupan 产出账本条目（learnings.jsonl，含置信度）
       │
       ▼
下次开工：forge-bugfix P1 / forge-eng 理解现状 自动回放相关条目
       │
       ▼
再复盘：检测同类问题复发 → 复发 ≥3 次强制固化为 skill 规则
```

---

## 安装

```bash
# 克隆到本地
git clone https://github.com/yike-gunshi/forge-skills.git

# 运行安装脚本（默认同时安装到 Claude Code 和 Codex 可发现目录）
cd forge-skills
./install.sh

# 新开 Claude Code / Codex 会话即可使用
```

常用选项：

```bash
./install.sh --uninstall      # 卸载（移除 symlink）
./install.sh --target claude  # 仅 ~/.claude/skills
./install.sh --target codex   # 仅 ~/.agents/skills
./install.sh --status         # 检查当前 symlink 是否完整（含坏链检测）
./install.sh --dry-run        # 只打印动作，不改文件
```

安装方式是 **symlink 而非复制**：`skills/` 目录是唯一真源，`git pull` 后所有会话立即用上新版本，不会产生漂移的副本。skill 清单自动发现（`skills/` 下含 SKILL.md 的目录），新增 skill 无需改安装脚本。

---

## 设计哲学

1. **讨论是最便宜的修复** — 充分讨论 → 充分设计 → 才写代码
2. **文档是源代码的上游** — PRD 变更驱动代码变更，不是反过来
3. **规范驱动开发** — Feature Spec（Given/When/Then）是行为契约，无 Spec 不写代码
4. **上下文是最稀缺的资源** — 调度器精简（30%），子任务独立上下文（100%），骨架 + references 按需加载
5. **证据先于断言** — TDD + Verification Gate，声称完成须提供证据
6. **用户保持控制权** — Feature Spec、验收计划、举一反三——关键决策交用户
7. **举一反三** — 发现问题后搜索相似模式，不仅修单点
8. **原子化一切** — 每个任务独立 commit，可追溯、可回滚
9. **复盘闭环** — 教训进账本 → 开工回放 → 复发检测 → 反哺 Skill，下次更好

---

## 文档导航

| 文档 | 内容 |
|------|------|
| [forge-user-guide.md](docs/forge-user-guide.md) | 使用指南 — 架构图、Skill 详解、工作流模式 |
| [architecture.md](docs/architecture.md) | 架构设计 — 上下文工程、分层架构、状态管理 |
| [workflow-guide.md](docs/workflow-guide.md) | 工作流 — 场景选择、最佳实践、常见问题 |
| [skills-reference.md](docs/skills-reference.md) | 技能手册 — 每个 Skill 的完整机制和产出 |
| [glossary.md](docs/glossary.md) | 术语词典 — 关键概念中英对照 |
| [releases/](docs/releases/) | 发布说明 — 各版本详细变更（最新：[v2026.07.17](docs/releases/v2026.07.17.md)） |
| [openspec-research.md](docs/archive/openspec-research.md) | OpenSpec 调研 — Given/When/Then 思想来源 |

<details>
<summary>更多文档（历史分析与审计）</summary>

| 文档 | 内容 |
|------|------|
| [skill-audit-2026-07.md](docs/archive/skill-audit-2026-07.md) | 2026-07 逐 skill 深度审计（P-01~P-30） |
| [skill-review-2026-07-17.md](docs/archive/skill-review-2026-07-17.md) | 2026-07-17 外部对标审查（skill-creator + yao-meta-skill） |
| [external-tools-analysis.md](docs/archive/external-tools-analysis.md) | 外部工具分析 — Superpowers/gstack/CKM 能力拆解 |
| [superpowers-comparison.md](docs/archive/superpowers-comparison.md) | Superpowers 对照 — 融合对比与完成状态 |
| [design-skill-fusion-methodology.md](docs/design-skill-fusion-methodology.md) | 设计 Skill 融合方法论 |
| [forge-deliver-analysis.md](docs/archive/forge-deliver-analysis.md) | forge-deliver 重写分析 — v1 vs v2 对比 |

</details>

---

## 仓库结构

```
forge-skills/
├── README.md                       ← 你在这里
├── SKILL.md                        ← /forge 总入口
├── CHANGELOG.md                    ← 版本变更账本
├── LICENSE                         ← MIT
├── install.sh                      ← 一键安装/卸载（symlink，自动发现 skill）
├── skills/                         ← 16 个专职 Skill + 共享层
│   ├── _shared/                    ←   跨 skill 公共规范（文档加载协议、视觉决策层）
│   ├── forge-brainstorm/           ←   头脑风暴
│   ├── forge-prd/                  ←   PRD 当前事实 + .features Feature Spec
│   ├── forge-dev/                  ←   开发调度器（--full 端到端）
│   ├── forge-design/               ←   设计规划（含 UX 规则/配色/字体数据库）
│   ├── forge-design-lab/           ←   设计工作台（真比例骨架 + 七层审查 + token 同源）
│   ├── forge-design-impl/          ←   设计实现
│   ├── forge-eng/                  ←   工程实现（Worktree + TDD）
│   ├── forge-qa/                   ←   QA 验收（只测不修）
│   ├── forge-bugfix/               ←   Bug 修复流水线（P0-P8）
│   ├── forge-review/               ←   PR 审查
│   ├── forge-ship/                 ←   发布
│   ├── forge-doc-release/          ←   发布后文档更新
│   ├── forge-doc-policy/           ←   文档治理规范 + init 脚手架
│   ├── forge-feature-doc/          ←   需求设计文档（每功能一份给人看 + 出图 + 上线前检查）
│   ├── forge-status/               ←   并行会话巡检
│   └── forge-fupan/                ←   复盘（Workbench 门禁 + 账本副产出）
│       └── */references/           ←   各 skill 的阶段手册（按需加载）
├── tools/
│   └── fupan-workbench/            ← 复盘工作台应用（复盘流程门禁 + 历史回看，不随 skill 加载）
├── evals/
│   └── trigger-cases.md            ← 触发路由回归用例（改 description 后过一遍）
├── _archive/                       ← 退役 skill（含 forge-deliver）
├── docs/                           ← 文档
└── assets/                         ← 架构图（SVG）
```

---

## 融合来源

Forge 融合了以下框架的精华：

| 来源 | 整合了什么 |
|------|-----------|
| **OpenSpec** | Given/When/Then 行为场景、SHALL/MUST 措辞规范（思想，非工具链） |
| **Superpowers** | Worktree 隔离、TDD 红绿重构、Verification Gate、对抗性审查、Spec 四点自审 |
| **gstack office-hours** | 6 个强迫性问题、反谄媚规则、Pushback 模板 |
| **gstack plan-ceo-review** | 梦想状态映射、反转思维、最窄楔子 |
| **gstack /learn + /retro** | 复盘账本（append-only + 置信度 + 复发检测）思路 |
| **ui-ux-pro-max** | 99 条 UX 规则、配色/字体搜索引擎 |
| **design-consultation** | 竞品调研、美学方向探索 |
| **frontend-design** | 反 AI-slop 方法论 |
| **ckm-design-system** | 三层 Token 架构 |

---

<div align="center">

MIT License &copy; [yike-gunshi](https://github.com/yike-gunshi)

</div>
