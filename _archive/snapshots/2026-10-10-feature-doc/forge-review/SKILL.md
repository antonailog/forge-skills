---
name: forge-review
description: |
  上线前 PR 审查。分析当前分支与基础分支的 diff，检查 SQL 安全、竞态条件、
  LLM 信任边界、枚举完整性等测试捕获不到的结构性问题。发现问题直接修复。
  触发方式：用户说"review"、"审查代码"、"上线前检查"、"forge-review"，或 forge-dev --full 调度。
  与内置 code-review/verify 的分工：forge 工作流内的上线前结构性审查用本 skill；用户点名 /code-review 或 /verify 时用对应内置 skill。
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

> **文档落地路径**：遵循 forge-doc-policy 规范。完整白名单 + frontmatter schema 见
> `~/.claude/skills/forge-doc-policy/doc-paths.md`。
> **当前文档加载顺序**：需要判断需求/设计/工程口径时，先读项目 `CLAUDE.md`、
> `docs/README.md`、`docs/INDEX.md` 和相关根级当前真相源；历史 archive 只作追溯证据。
> 详细规则见 `~/.claude/skills/_shared/current-doc-loading.md`。

# /forge-review：代码审查

## 前置脚本（每次先运行）

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "当前分支: $_BRANCH"
```

---

> 提问格式与批量策略见 `~/.claude/skills/_shared/interaction-protocol.md`。

---

## 第0步：确定基础分支

按顺序判断此 PR 合并到哪个分支：

```bash
# 1. 检查是否已有 PR
gh pr view --json baseRefName -q .baseRefName 2>/dev/null

# 2. 没有 PR 则获取仓库默认分支
gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null

# 3. 都失败则回退到 main
```

打印出基础分支名称，后续所有 `git diff`、`git fetch`、`git merge` 等命令中用实际分支名替换"基础分支"。

---

## 第1步：检查分支状态

```bash
git branch --show-current
git fetch origin <基础分支> --quiet && git diff origin/<基础分支> --stat
```

如果在基础分支上，或没有 diff，输出：**"没有可审查的内容——你在基础分支上或没有变更。"** 并停止。

---

## 第2步：获取完整 diff

```bash
git fetch origin <基础分支> --quiet
git diff origin/<基础分支>
```

**在评论之前先读完完整 diff。** 不要标记 diff 中已经修复的问题。

---

## 第3步：两轮审查

### 第一轮（严重问题）

逐项检查以下类别，对每个 diff 文件详细分析：

#### 1. SQL 与数据安全
**检查**：
- 用户输入是否直接拼入 SQL？（注入风险）
- 原始 SQL 查询是否使用了参数化？
- 批量更新/删除是否有 `WHERE` 条件？（全表操作风险）
- 事务边界是否正确？（部分成功状态）
- 软删除记录是否在所有查询中被过滤了？

**报告格式**：`[严重] 文件:行号 — 问题描述 → 修复建议`

#### 2. 竞态条件与并发
**检查**：
- 先读后写操作是否有并发安全问题？（检查-再-操作 TOCTOU）
- 数据库操作是否需要乐观锁/悲观锁？
- 共享状态是否在多个请求间安全？
- 缓存失效是否有竞态？

**特别注意**：状态转换（如 `draft → published`）必须用数据库级约束，不能只依赖应用层检查。

#### 3. LLM 输出信任边界
**检查**：
- LLM 生成的内容在写入数据库前是否经过验证/清洗？
- LLM 输出是否直接用于 SQL 构建或系统命令？
- 是否对 LLM 输出的类型和格式做了断言？
- Prompt 中是否包含了敏感数据（密钥、PII）？

#### 4. 枚举与值完整性
**检查**：
- 新增枚举值/状态/类型时，所有引用了同级值的文件是否都处理了新值？

**重要**：枚举完整性**必须读取 diff 以外的代码**。当 diff 新增了枚举值，用 Grep 找出所有引用了同级值的文件，Read 这些文件检查新值是否被处理。

### 第二轮（信息性问题）

#### 5. 条件副作用
**检查**：
- 副作用（发邮件、写日志、扣费用）是否在 `if` 语句的所有分支中都正确处理？
- 删除或禁用功能时，是否清理了对应的副作用触发器？

#### 6. 魔法数字与字符串耦合
**检查**：
- 是否有应该提取为常量的重复数字/字符串？
- 硬编码的限制值（如 `100`、`1000`）是否有注释说明含义？

#### 7. 死代码与一致性
**检查**：
- 是否有明显无法执行的代码路径？
- 同一逻辑的命名方式是否在整个文件中一致？

#### 8. 测试缺口
**检查**：
- 新的分支逻辑有没有对应测试？
- 错误路径有没有测试？
- 是否存在只测试了 Happy Path 但跳过了边界情况？

#### 9. 前端/视图层
**检查**：
- 用户输入是否经过 HTML 转义？（XSS 风险）
- 是否有 `dangerouslySetInnerHTML` 或 `v-html` 使用了未清洗的数据？
- 长文本/图片/空状态是否有兜底处理？

---

## 第4步：修复优先原则

**每个发现都要有行动——不只是报告。**

输出摘要头：`上线前审查：N 个问题（X 严重，Y 信息性）`

### 自动修复（AUTO-FIX）
机械性、无争议的修复直接应用。每个输出：
`[已自动修复] 文件:行号 — 问题 → 修复内容`

**适合自动修复的典型问题**：
- 添加缺失的 WHERE 条件（无歧义的全表操作）
- 移除 `outline: none` / `!important`
- 添加明显缺失的类型检查
- 修复 HTML 转义问题

### 需要确认（ASK）
需要判断或有真实权衡的问题，**批量放入一次 AskUserQuestion**（≤3个时可单独提问）：

```
我已自动修复了 5 个问题。2 个需要你的判断：

1. [严重] app/models/order.rb:42 — 状态转换竞态条件
   修复：在 UPDATE 中添加 WHERE status = 'pending'
   → A) 按建议修复  B) 跳过

2. [信息性] app/services/ai_writer.rb:88 — AI 输出未经类型验证就写入数据库
   修复：添加 JSON Schema 验证
   → A) 按建议修复  B) 跳过

推荐：两个都修——#1是真实竞态，#2防止静默数据损坏。
```

---

## 第5步：TODOS 交叉检查

读取仓库根目录的 `TODO.md` 或 `TODOS.md`（如果存在）：
- 此 PR 是否解决了某个 TODO？如果是，标注出来。
- 此 PR 是否创建了需要变成 TODO 的工作？如果是，标记为信息性发现。

---

## 第6步：文档过时检查

对比 diff 与根目录下的文档文件（README.md、ARCHITECTURE.md、CLAUDE.md 等）：
- 如果代码改动影响了文档描述的功能，但文档没有在此分支更新，标记为信息性发现：
  "文档可能过时：[文件] 描述了 [功能]，但本分支修改了相关代码。考虑运行 `/forge-ship` 后更新文档。"

---

## 重要规则

- **先读完完整 diff，再评论。** 不标记 diff 中已修复的问题。
- **修复优先，不只是报告。** AUTO-FIX 直接应用，ASK 等用户确认。
- **简洁。** 一行问题，一行修复建议。
- **只标记真实问题。** 正常代码直接跳过。
- **绝不提交、推送或创建 PR**——那是 `/forge-ship` 的工作。
