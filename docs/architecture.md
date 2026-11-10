# 架构设计

## 一、分层架构

Doc-Driven Dev 按职责分为四层，每层独立演进：

```
┌─────────────────────────────────────────────────────┐
│                   调度层（Orchestration）              │
│  forge-dev（--full 覆盖端到端交付）                        │
│  职责：读取 PRD → 收集偏好 → 技术调研 → 调度子技能      │
│  上下文预算：~30%                                     │
├─────────────────────────────────────────────────────┤
│                   执行层（Execution）                  │
│  forge-design · forge-eng · forge-qa · forge-bugfix             │
│  职责：在独立上下文中完成具体工作                        │
│  上下文预算：100%（全新窗口）                           │
├─────────────────────────────────────────────────────┤
│                   审查层（Review）                     │
│  forge-review · forge-doc-release                         │
│  职责：结构性代码审查 + 文档同步                        │
├─────────────────────────────────────────────────────┤
│                   反馈层（Feedback）                   │
│  cn-retro · forge-fupan                                   │
│  职责：收工复盘 → 对标最佳路径 → 补知识盲区            │
└─────────────────────────────────────────────────────┘
```

### 层间通信

层与层之间通过**文档文件**通信，不共享内存或上下文：

| 上游 → 下游 | 传递介质 |
|------------|---------|
| forge-prd → forge-dev | PRD.md（含 Feature Spec）+ PRD-CHANGELOG（迭代摘要） |
| forge-dev → forge-design | CONTEXT.md + RESEARCH.md + PRD 路径 |
| forge-dev → forge-eng | CONTEXT.md + RESEARCH.md + DESIGN.md 路径 + Feature Spec（行为场景+验收检查表） |
| forge-dev → forge-qa | PRD 路径（含 Feature Spec）+ ENGINEERING.md 路径 |
| forge-eng → forge-review | Git diff（分支对比） |
| forge-review → forge-ship | 审查通过的分支 |
| 全链路 → forge-fupan | Git 历史 + 项目文档 |

---

## 二、上下文工程

### 问题：Context Rot

AI 模型的上下文窗口是有限资源。当一个会话中积累了过多信息（需求讨论 + 调研 + 设计 + 代码 + 测试），输出质量会显著下降。我们称之为 **Context Rot**。

### 解决方案：调度器 + 独立上下文

```
forge-dev（调度器）                     forge-eng（执行器）
┌────────────────────┐              ┌────────────────────────┐
│ 30% 上下文利用率     │              │ 100% 全新上下文窗口      │
│                    │              │                        │
│ · PRD 摘要          │   Agent 工具  │ · ENGINEERING.md 全文   │
│ · RESEARCH.md 摘要  │ ──────────→  │ · PRD 相关章节          │
│ · 执行计划          │   传递文件路径  │ · DESIGN.md 相关章节    │
│ · 用户偏好          │              │ · 源代码（按需读取）      │
│                    │              │ · 完整的方法论指令        │
└────────────────────┘              └────────────────────────┘
```

**关键规则**：
- 调度器只传递**文档路径 + 变更摘要**，不传历史会话
- 子 Skill 在 Agent 工具创建的**独立上下文**中执行
- 每个子 Skill 拥有全新的上下文窗口（~200K token）
- 子 Skill 完成后，调度器只读取产出文件，不读回完整执行过程

### 上下文预算管理

| 角色 | 目标利用率 | 策略 |
|------|----------|------|
| 调度器（forge-dev） | ≤30% | 只存摘要和决策，不存执行细节 |
| 执行器（forge-eng 等） | 100% | 全新窗口，按需读取源码 |
| 审查器（forge-review） | 100% | 只读 diff + 相关文件 |

---

## 三、状态管理

### 3.1 项目文档结构

每个 Skill 维护自己的领域文档，遵循统一规范：

```
project/docs/
├── PRD.md                        ← forge-prd 管理（含 Feature Spec 章节）
├── PRD-CHANGELOG.md              ← forge-prd 管理
├── vX.Y-CONTEXT.md               ← forge-dev 管理（Discussion 产出）
├── vX.Y-RESEARCH.md              ← forge-dev 管理（Research 产出）
├── DESIGN.md                     ← forge-design 管理
├── DESIGN-CHANGELOG.md           ← forge-design 管理
├── ENGINEERING.md                ← forge-eng 管理
├── ENGINEERING-CHANGELOG.md      ← forge-eng 管理
├── QA.md                         ← forge-qa 管理
└── QA-CHANGELOG.md               ← forge-qa 管理
```

**文件名不固定**：所有 Skill 通过模式匹配定位文档，支持中文命名变体。

### 3.2 Feature 状态隔离

多会话并行开发时，通过 `.features/` 目录隔离运行状态：

```
project/.features/
├── _registry.md                  # 全局 feature 注册表
├── feat-mobile-layout/
│   └── status.md                 # 运行状态 + heartbeat
├── feat-dark-mode/
│   └── status.md
└── feat-api-v2/
    └── status.md
```

**设计原则**：
- **内容与状态分离** — 领域文档只存内容，运行状态单独管理
- **Heartbeat 机制** — 每次 status.md 变更都更新时间戳
- **孤儿检测** — forge-dev 启动时检查 heartbeat > 30 分钟的 feature（惰性，无需守护进程）
- **版本号预留** — forge-prd 创建 feature 时预留版本号，避免多会话冲突

### 3.3 调度器状态持久化

```
project/.forge/
├── dev-state.json                # 调度状态（阶段、进度、配置）
├── checkpoints/
│   ├── design-done.patch         # 设计阶段完成后的代码状态
│   ├── eng-done.patch            # 工程阶段完成后的完整 diff
│   └── qa-done.patch             # QA 修复后的完整 diff
└── visual-decision.md            # 视觉决策索引
```

**恢复模式**：forge-dev 启动时加 `--resume`，从 `dev-state.json` 恢复中断的流水线（legacy 项目的 `.do-dev/`、`.deliver/` 只读迁移）。

---

## 四、并行执行模型

### 4.1 Wave 并行

forge-eng 将任务拆分为 Wave，同一 Wave 内的任务无依赖关系，可并行执行：

```
Wave 1（无依赖，并行执行）
├── Task 1: 创建数据模型      → Agent A
├── Task 2: 创建 API 路由     → Agent B
└── Task 3: 创建配置文件      → Agent C
        │ 全部完成 → 验证 → 冲突检测
        ▼
Wave 2（依赖 Wave 1，并行执行）
├── Task 4: 实现业务逻辑      → Agent D
└── Task 5: 实现前端组件      → Agent E
        │ 全部完成 → 验证 → 冲突检测
        ▼
Wave 3（依赖 Wave 2）
└── Task 6: 集成测试          → Agent F
```

**任务拆分原则**：
- **垂直切片优先** — 端到端完成一个功能，而非水平分层
- **每个任务 1-3 个文件** — 太大难以验证，太小增加协调开销
- **结构化定义** — 文件列表 + 实现要求 + 验证方式 + 完成标准

### 4.2 原子 Git 提交

每个任务完成后立刻独立 commit：

```
feat(auth): add user authentication model
Task-1 of Wave-1
```

**类型约定**：`feat` / `fix` / `refactor` / `docs` / `test` / `chore`

**好处**：
- `git bisect` 精确定位 Bug 引入点
- 独立 revert 某个任务不影响其他任务
- CI/CD 管道可观测每个变更
- Code review 按任务粒度审查

### 4.3 Wave 间验证

每个 Wave 完成后执行：
1. 运行项目测试命令
2. 检查文件冲突（多 Agent 可能修改同一文件）
3. 失败的任务自动重试一次
4. 仍然失败则标记并报告用户

---

## 五、质量门控体系

### 5.1 门控点总览

```
PRD 变更 ──→ [Gate 1: 需求确认] ──→ 调度建议 ──→ [Gate 2: 执行计划确认]
    │                                                      │
    ▼                                                      ▼
设计方案 ──→ [Gate 3: 线框图确认] ──→ 工程方案 ──→ [Gate 4: 架构确认]
    │                                                      │
    ▼                                                      ▼
代码实现 ──→ [Gate 5: Wave 间验证] ──→ QA 测试 ──→ [Gate 6: 上线就绪判定]
    │                                                      │
    ▼                                                      ▼
代码审查 ──→ [Gate 7: 审查通过]   ──→ 发布     ──→ [Gate 8: 交付确认]
```

### 5.2 各 Skill 内置门控

| Skill | 门控机制 |
|-------|---------|
| forge-prd | 三层自适应审查（轻量→标准→深度，自动升级） |
| forge-dev | 三个硬卡点（Discussion 后 / 执行计划 / 交付总结） |
| forge-design | 80 项审计清单 + A-F 评分 + AI 模板痕迹检测 |
| forge-eng | 四章审查 + 范围挑战（每章暂停确认） |
| forge-qa | 5 维度健康评分（功能/安全/性能/可维护性/UX） |
| forge-bugfix | 三振出局（3 个假设失败 → 停止并升级） |
| forge-review | 两轮审查（严重问题 8 类 + 信息性 9 类） |

### 5.3 用户控制权分配

**用户确认**（关键决策）：需求诊断 / 执行计划 / 设计方向 / 架构选型 / 测试策略 / 上线决策

**自动执行**（执行细节）：文档格式 / CSS 实现 / 代码写法 / 测试执行 / Git commit

---

## 六、方法论继承

每个 do-* Skill 继承自对应的成熟审查 Skill：

| 文档驱动 Skill | 继承来源 | 核心方法论 |
|--------------|---------|----------|
| forge-prd | cn-plan-product | 10 星挑战、假设审查、反驳机制 |
| forge-design | cn-plan-design | 12 条认知模式、80 项审计、A-F 评分 |
| forge-eng | cn-plan-eng | 7 条工程思维、范围挑战、四章审查 |
| forge-qa | cn-qa | 5 维度评分、浏览器测试、原子修复 |
| forge-dev | forge-deliver（已退役并入） | 状态管理、双模式、检查点机制 |

**继承原则**：完整继承 → 不压缩成口号 → 适配文档驱动场景

---

## 七、代码隔离策略

### 当前：`.features/` 状态隔离

通过文件系统目录隔离运行状态，代码在同一工作目录：
- 优点：简单、无额外依赖
- 局限：多会话同时改同一文件可能冲突

### 演进：Git Worktree 代码隔离

```bash
git worktree add .worktrees/feat-dark-mode -b feat/dark-mode
cd .worktrees/feat-dark-mode
# ... 开发 ...
git checkout main && git merge feat/dark-mode
git worktree remove .worktrees/feat-dark-mode
```

**双层互补**：`.features/` 管逻辑状态，Worktree 管代码隔离。

详见 [superpowers-comparison.md](archive/superpowers-comparison.md) 中的融合建议。
