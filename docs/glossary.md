# 术语词典

Doc-Driven Dev 体系中使用的关键概念，中英对照。

---

## 架构概念

| 术语 | 英文 | 定义 |
|------|------|------|
| **上下文工程** | Context Engineering | 管理 AI 上下文窗口利用率：调度器 30%，子任务独立 100% |
| **Context Rot** | Context Rot | 上下文窗口填满后输出质量逐步劣化 |
| **上下文预算** | Context Budget | 分配给不同角色的上下文窗口利用率上限 |
| **分层架构** | Layered Architecture | 调度层 → 执行层 → 审查层 → 反馈层 |

## 执行模型

| 术语 | 英文 | 定义 |
|------|------|------|
| **Wave 并行** | Wave Parallelism | 按依赖分组，同 Wave 内并行执行 |
| **垂直切片** | Vertical Slice | 端到端完成一个功能，非水平分层 |
| **原子提交** | Atomic Commit | 每任务独立 commit，支持 bisect 和 revert |
| **Wave 间验证** | Inter-wave Verification | Wave 后测试 + 冲突检测 + 失败重试 |

## 状态管理

| 术语 | 英文 | 定义 |
|------|------|------|
| **Feature 状态隔离** | Feature State Isolation | `.features/{id}/` 隔离运行状态 |
| **Heartbeat** | Heartbeat | status.md 时间戳，检测会话存活 |
| **孤儿检测** | Orphan Detection | heartbeat > 30 分钟 → 可能崩溃 |
| **检查点** | Checkpoint | 阶段性代码状态（patch 格式） |

## 质量门控

| 术语 | 英文 | 定义 |
|------|------|------|
| **门控点** | Gate | 需要用户确认才继续的决策点 |
| **硬卡点** | Hard Gate | 不可跳过的必须确认点 |
| **三层自适应审查** | Adaptive Review | 轻量 → 标准 → 深度，自动升级 |
| **四章审查** | Four-chapter Audit | 架构 → 代码质量 → 测试 → 性能 |
| **80 项审计** | 80-item Audit | forge-design 设计审计，10 类 |
| **5 维度评分** | 5-dimension Score | 功能/安全/性能/可维护性/UX |
| **三振出局** | Three Strikes | 3 假设失败 → 停止，请求更多信息 |

## 方法论

| 术语 | 英文 | 定义 |
|------|------|------|
| **文档驱动** | Document-Driven | PRD 驱动代码，文档是源代码上游 |
| **完整性原则** | Completeness Principle | "把湖烧干"，AI 边际成本 ≈ 0 |
| **方法论继承** | Methodology Inheritance | 从成熟 Skill 完整继承，不压缩成口号 |
| **收工复盘** | Retrospective | 做 → 复盘（对标最佳路径、补知识盲区）→ 按项目和模块回看 |
| **灰区识别** | Gray Area Identification | Discussion 阶段识别不明确部分 |
| **四维调研** | Four-dimension Research | 最佳实践 + 架构 + 风险 + 可复用代码 |

## Superpowers 概念

| 术语 | 英文 | 定义 |
|------|------|------|
| **模型路闭** | Path Closing | 显式规则关闭 AI 的错误路径 |
| **反 Rationalization** | Counter-rationalization | 预判并堵住 AI 跳过步骤的理由 |
| **Verification Gate** | Verification Gate | 完成前必须运行命令读输出，证据先于断言 |
| **Git Worktree** | Git Worktree | 同一仓库多个独立工作目录，共享 .git |
| **批间审查** | Batch Checkpoint | 每 3 任务暂停展示，等用户确认 |
| **双阶段审查** | Two-stage Review | Spec Review + Code Quality Review |
| **Skill TDD** | Skill TDD | RED-GREEN-REFACTOR 写 Skill |

## Skill 命名约定

| 前缀 | 含义 | 示例 |
|------|------|------|
| `up-` | 上游/需求层 | forge-prd |
| `do-` | 执行层 | do-eng, forge-design |
| `cn-` | 审查/发布层 | cn-review, forge-ship |
| 无前缀 | 独立工具 | forge-fupan |
