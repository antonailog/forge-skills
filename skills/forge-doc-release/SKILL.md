---
name: forge-doc-release
description: |
  发布后文档更新。读取所有项目文档，与 diff 交叉对照，
  更新 README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md 使之匹配已发布内容，
  润色 CHANGELOG 语气，清理 TODOS，可选地更新 VERSION。
  触发方式：用户说"更新文档"、"文档同步"、"forge-doc-release"，或 forge-ship 之后、PR 合并之前由 forge-dev --full 调度。
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---

> **文档落地路径**：遵循 forge-doc-policy 规范。完整白名单 + frontmatter schema 见
> `~/.claude/skills/forge-doc-policy/doc-paths.md`。
> **当前文档加载顺序**：优先审查 `CLAUDE.md`、`docs/README.md`、`docs/INDEX.md`、
> 根级当前真相源、相关模块附录和 `.features`；`docs/archive/raw/` 只作历史证据，不纳入默认同步。
> 详细规则见 `~/.claude/skills/_shared/current-doc-loading.md`。

# /forge-doc-release：发布后文档更新

## 前置脚本（每次先运行）

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "当前分支: $_BRANCH"
```

---

> 执行与交互边界见 `~/.claude/skills/_shared/interaction-protocol.md`。

---

## 第0步：检测基础分支

确定此 PR 的目标分支。后续所有步骤以此为"基础分支"。

1. 检查是否已有 PR：
   `gh pr view --json baseRefName -q .baseRefName`
   如果成功，使用打印的分支名。

2. 如果没有 PR（命令失败），检测仓库默认分支：
   `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`

3. 如果都失败，回退到 `main`。

---

## 角色定义

你在运行 `/forge-doc-release` 工作流。这在 `/forge-ship`（代码已提交，PR 已存在或即将创建）**之后**、PR 合并 **之前** 运行。你的任务：确保项目中的每个文档文件都准确、最新、用友好且面向用户的语气书写。

你主要是自动化的。明显的事实性更新直接做。只在风险或主观决策时停下来问。

**只在以下情况停下来问：**
- 风险/可疑的文档变更（叙事、理念、安全、删除、大规模重写）
- VERSION 更新决策（如果尚未更新）
- 要添加的新 TODOS 项
- 叙事性的跨文档矛盾

**绝不因以下原因停下来：**
- 从 diff 明确可得的事实性更正
- 向表格/列表添加条目
- 更新路径、数量、版本号
- 修复过期的交叉引用
- CHANGELOG 语气润色（小幅措辞调整）
- 标记 TODOS 已完成
- 跨文档事实性不一致（如版本号不匹配）

**绝不做：**
- 覆盖、替换或重新生成 CHANGELOG 条目——只润色措辞，保留所有内容
- 不经询问就更新 VERSION——始终用 AskUserQuestion 确认版本变更
- 对 CHANGELOG.md 使用 `Write` 工具——始终用 `Edit` 精确匹配 `old_string`

---

## 执行手册（按需加载，执行时必读）

本文件只保留铁律、流程总览和出口。**进入执行阶段前，必须先读对应手册**：

| 场景 | 必读文件 | 内容 |
|---|---|---|
| 第1步~第9步全部执行细节 | [references/release-details.md](references/release-details.md) | diff 收集命令、逐文件审计启发式、CHANGELOG 润色规则、TODOS/VERSION 决策树、提交与 PR body 更新流程、文档健康摘要模板 |

**规矩**：不允许凭记忆执行细则——骨架没写的操作细节，一律以手册为准；手册与骨架冲突时，以骨架的铁律为准。

---

## 流程总览（9 步）

### 第1步：预检与 Diff 分析

确认不在基础分支上，收集 `git diff <base>...HEAD` 的 stat/log/文件清单，
用 find 发现待同步文档，将变更分为新功能/行为变更/移除/基础设施四类并输出摘要。
命令与分类细则见手册"第1步"。

### 第2步：逐文件文档审计

读取每个文档文件与 diff 交叉对照，按文件类型套用通用审计启发式
（README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md/其他各有清单），
把所需更新分成"自动更新"与"询问用户"两类。各文件的检查清单与分类标准见手册"第2步"。

### 第3步：应用自动更新

用 Edit 直接做所有明确的事实性更新，每个文件输出一行"具体改了什么"的摘要。
简介/理念/安全模型/整段删除属于绝不自动更新范围，完整清单见手册"第3步"。

### 第4步：询问风险/可疑变更

对第2步识别的每个风险项用 AskUserQuestion 确认（含上下文、建议、跳过选项），
每个回答后立即应用。提问要素格式见手册"第4步"。

### 第5步：CHANGELOG 语气润色

只润色现有条目措辞，绝不覆盖/删除/重排/重新生成；条目由 /forge-ship 写成，是事实来源。
分支没改 CHANGELOG 就跳过。五条规则与"推销测试"等改写方向见手册"第5步"。

### 第6步：跨文档一致性与可发现性检查

对照 README/CLAUDE.md/ARCHITECTURE/CONTRIBUTING/CHANGELOG/VERSION 做五项交叉检查；
事实性不一致自动修，叙事矛盾询问；每个文档须从 README 或 CLAUDE.md 可达。
完整清单见手册"第6步"。

### 第7步：TODOS.md 清理

文件不存在则跳过。三件事：diff 有明确证据的 TODO 标记已完成、
描述过期的 TODO 询问处置、diff 里有意义的 TODO/FIXME 注释询问是否纳入。
细则见手册"第7步"。

### 第8步：VERSION 更新问题

文件不存在则静默跳过。绝不静默更新：未更新时用 AskUserQuestion 给 PATCH/MINOR/跳过三选项；
已更新时检查是否覆盖此分支全部变更范围，有遗漏再询问。完整决策树见手册"第8步"。

### 第9步：提交与输出

无文档改动则输出"所有文档都是最新的"并退出。否则按文件名暂存（绝不 `git add -A`）、
单次提交并推送；随后幂等更新 PR body 的 `## 文档` 段落；最终输出结构化文档健康摘要。
提交命令、PR body 更新流程与摘要模板见手册"第9步"。

---

## 重要规则

- **编辑前先读。** 修改文件前始终完整读取其内容。
- **绝不覆盖 CHANGELOG。** 只润色措辞。绝不删除、替换或重新生成条目。
- **绝不静默更新 VERSION。** 始终询问。即使已更新，也检查是否覆盖了完整变更范围。
- **明确说明改了什么。** 每次编辑附一行摘要。
- **通用启发式，非项目特定。** 审计检查适用于任何仓库。
- **可发现性很重要。** 每个文档文件都应从 README 或 CLAUDE.md 可达。
- **语气：友好、面向用户、不晦涩。** 像给一个没看过代码的聪明人解释一样写。
