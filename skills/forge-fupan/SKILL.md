---
name: forge-fupan
description: |
  复盘 v3（Workbench 门禁型）：启动本地 Workbench，用户在独立会话页确认想学的知识点和深度，按选择调研产出复盘文档；
  同时落 2-3 条账本条目（记录/复盘/learnings.jsonl）供 bugfix/eng 开工回放与复发检测。
  触发方式：用户说"总结知识"、"学习总结"、"复盘"、"可视化复盘"、"/forge-fupan"。
---

> **文档落地路径**：遵循 forge-doc-policy 规范。完整白名单 + frontmatter schema 见
> `~/.claude/skills/forge-doc-policy/doc-paths.md`。

# 复盘 — 协作知识沉淀与深度诊断

## 设计说明（v3，2026-07-17 重构）

v3 = v1 的 Workbench 门禁流程 + v2 的账本复利机制：
- **Workbench 是复盘的确认门禁**：AI 分析会话后把学习地图推到本地网页，用户在**独立会话页**（`/session/{task_id}`）勾选知识点和深度，提交后 AI 才继续调研写作。
- **Workbench 首页是所有复盘会话的历史列表**：进行中的在上，历史的（含已完成）在下，每个会话可点进独立页面回看当时的选择和生成的文档。
- **账本是副产出**（保留自 v2）：每次复盘顺手落 2-3 条 learnings.jsonl 条目，bugfix/eng 开工时回放、下次复盘时做复发检测。写法见 [references/learnings-schema.md](references/learnings-schema.md)。

## 使用建议

> **在会话收尾时复盘，不要在中途插入。** 中途复盘的问题：工作未收敛导致判断被推翻、全量重新生成浪费 token、知识调研重跑成本高。最佳节奏：一个会话的工作做完 → 复盘一次 → 结束。同会话迭代机制仅作为兜底方案保留。
>
> **优先在上下文压缩或清空之前复盘。** 这是最佳路径，因为当前模型上下文和本地 JSONL 都可用。若已经压缩，必须先检查原始 JSONL 是否仍包含 `user_message/agent_message` 或 Claude `message.role`；有原始日志则可正常复盘，无原始日志则只能做轻量复盘。
>
> **长会话 token 管理**：单次功能完成后先复盘，再压缩或新开会话；隔夜/隔天继续时新开会话；超过 200 条消息无论如何都该压缩或新开。

---

## 输出位置

统一保存到 `~/claudecode_workspace/记录/复盘/{项目名}/` 目录：
- **项目名**由 AI 根据当前项目判断（如 `info2action`、`skill-system`、`视频转文本`），用户可覆盖。
- 文件名格式：`{YYYY-MM-DD}-{HHMM}-[任务标签]-{主题关键词}.md`。
- 示例路径：`~/claudecode_workspace/记录/复盘/info2action/2026-04-06-1430-[多数据源聚合]-RSS-HN-Reddit-GitHub信息源扩展.md`。

---

## 前置脚本（每次先运行）

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "当前分支: $_BRANCH"
echo "项目根目录: $_ROOT"

# === Git 卫生检查 ===
git fetch --quiet 2>/dev/null
_AHEAD=$(git rev-list @{u}..HEAD --count 2>/dev/null || echo "?")
_BEHIND=$(git rev-list HEAD..@{u} --count 2>/dev/null || echo "?")
echo "远程同步: 领先 $_AHEAD / 落后 $_BEHIND"
if [ "$_BEHIND" != "?" ] && [ "$_BEHIND" -gt 0 ]; then
  echo "⚠️ 落后远程 $_BEHIND 个提交，自动 rebase..."
  _HAS_CHANGES=$(git status --porcelain 2>/dev/null | head -1)
  [ -n "$_HAS_CHANGES" ] && git stash --quiet 2>/dev/null && _STASHED=1 || _STASHED=0
  git pull --rebase --quiet 2>/dev/null && echo "✅ 已同步远程" || echo "❌ rebase 失败，请手动处理"
  [ "$_STASHED" = "1" ] && git stash pop --quiet 2>/dev/null
fi
_DIRTY=$(git status --porcelain 2>/dev/null | head -5)
[ -n "$_DIRTY" ] && echo "⚠️ 工作区有未提交改动"

# === 项目上下文收集 ===
_RECENT_COMMITS=$(git log --oneline -20 2>/dev/null)
_DIFF_STAT=$(git diff --stat HEAD~10..HEAD 2>/dev/null)
_PROJECT_DOCS=$(ls docs/*.md 2>/dev/null)
echo "--- 最近提交 ---"
echo "$_RECENT_COMMITS"
echo "--- 变更统计 ---"
echo "$_DIFF_STAT"
echo "--- 项目文档 ---"
echo "$_PROJECT_DOCS"

# === 会话日志定位（Claude Code / Codex）===
_SESSION_SOURCE="unknown"
_JSONL_FILE=""
_CLAUDE_PROJECT_DIR="$HOME/.claude/projects"
_CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
_PARSE_TOKENS="$HOME/.claude/skills/forge-fupan/parse_tokens.py"
[ -f "$_PARSE_TOKENS" ] || _PARSE_TOKENS=$(find ~ -maxdepth 6 -path '*/forge-fupan/parse_tokens.py' -type f 2>/dev/null | head -1)

_latest_jsonl() {
  _name_pattern="$1"
  shift
  find "$@" -type f -name "$_name_pattern" -print 2>/dev/null | while IFS= read -r _f; do
    [ -f "$_f" ] || continue
    _mtime=$(stat -f %m "$_f" 2>/dev/null || stat -c %Y "$_f" 2>/dev/null || echo 0)
    printf "%s\t%s\n" "$_mtime" "$_f"
  done | sort -rn | head -1 | cut -f2-
}

if [ -n "${CODEX_THREAD_ID:-}" ] && [ -d "$_CODEX_HOME" ]; then
  _JSONL_FILE=$(_latest_jsonl "*${CODEX_THREAD_ID}*.jsonl" "$_CODEX_HOME/sessions" "$_CODEX_HOME/archived_sessions")
  [ -n "$_JSONL_FILE" ] && _SESSION_SOURCE="codex"
fi
if [ -z "$_JSONL_FILE" ] && [ -n "${CODEX_THREAD_ID:-}" ] && [ -d "$_CODEX_HOME" ]; then
  _JSONL_FILE=$(_latest_jsonl "*.jsonl" "$_CODEX_HOME/sessions" "$_CODEX_HOME/archived_sessions")
  [ -n "$_JSONL_FILE" ] && _SESSION_SOURCE="codex"
fi
if [ -z "$_JSONL_FILE" ] && [ -d "$_CLAUDE_PROJECT_DIR" ]; then
  _JSONL_FILE=$(_latest_jsonl "*.jsonl" "$_CLAUDE_PROJECT_DIR")
  [ -n "$_JSONL_FILE" ] && _SESSION_SOURCE="claude"
fi
if [ -z "$_JSONL_FILE" ] && [ -z "${CODEX_THREAD_ID:-}" ] && [ -d "$_CODEX_HOME" ]; then
  _JSONL_FILE=$(_latest_jsonl "*.jsonl" "$_CODEX_HOME/sessions" "$_CODEX_HOME/archived_sessions")
  [ -n "$_JSONL_FILE" ] && _SESSION_SOURCE="codex"
fi

echo "--- 会话日志 ---"
echo "会话来源: $_SESSION_SOURCE"
echo "会话日志: ${_JSONL_FILE:-未找到}"

if [ -n "$_JSONL_FILE" ]; then
  echo "--- Token 统计 ---"
  if [ -n "$_PARSE_TOKENS" ]; then
    python3 "$_PARSE_TOKENS" "$_JSONL_FILE" 2>/dev/null || echo "⚠️ Token 解析失败，将使用轮次估算"
  else
    echo "⚠️ parse_tokens.py 未找到，将使用轮次估算"
  fi
fi

if [ -n "$_JSONL_FILE" ]; then
  echo "--- 原始会话可用性 ---"
  python3 - "$_JSONL_FILE" "$_SESSION_SOURCE" <<'PY' 2>/dev/null || echo "⚠️ 原始会话检查失败，将按摘要降级判断"
import json
import sys

path = sys.argv[1]
source = sys.argv[2]
counts = {"user": 0, "agent": 0, "tool": 0, "compacted": 0}

with open(path, encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
        except Exception:
            continue

        payload = data.get("payload") or {}
        top_type = data.get("type")
        payload_type = payload.get("type") if isinstance(payload, dict) else None

        if top_type == "compacted" or payload_type == "context_compacted":
            counts["compacted"] += 1

        if source == "codex":
            if top_type == "event_msg" and payload_type == "user_message":
                counts["user"] += 1
            elif top_type == "event_msg" and payload_type == "agent_message":
                counts["agent"] += 1
            elif top_type == "event_msg" and payload_type in {"exec_command_end", "patch_apply_end"}:
                counts["tool"] += 1
        else:
            msg = data.get("message") or data.get("data", {}).get("message") or {}
            role = msg.get("role")
            if role == "user":
                counts["user"] += 1
            elif role == "assistant":
                counts["agent"] += 1
            if data.get("type") in {"tool_result", "tool_use"}:
                counts["tool"] += 1

if counts["user"] > 0 and counts["agent"] > 0:
    status = "FULL_LOG_AVAILABLE"
elif counts["user"] > 0:
    status = "PARTIAL_LOG_AVAILABLE"
else:
    status = "SUMMARY_ONLY_OR_MISSING"

print(f"原始消息: user={counts['user']} agent={counts['agent']} tool={counts['tool']} compacted={counts['compacted']}")
print(f"复盘可用性: {status}")
PY
fi

# === 同会话迭代检测 ===
_FUPAN_DIR="$HOME/claudecode_workspace/记录/复盘"
if [ -n "$_JSONL_FILE" ]; then
  _SESSION_ID=$(basename "$_JSONL_FILE")
  _EXISTING_FUPAN=$(grep -rl "session: $_SESSION_ID" "$_FUPAN_DIR" 2>/dev/null | head -1)
  if [ -n "$_EXISTING_FUPAN" ]; then
    echo "⚠️ 检测到同会话已有复盘: $_EXISTING_FUPAN"
    echo "将迭代更新该文档，而非新建"
  fi
fi

# === 账本读取（复发检测对照组，v2 机制保留） ===
_LEDGER="$_FUPAN_DIR/learnings.jsonl"
_PROJECT=$(basename "$_ROOT")
if [ -f "$_LEDGER" ]; then
  echo "--- 账本已有条目（本项目 + global）---"
  grep -h "\"project\":\"$_PROJECT\"\|\"project\":\"global\"" "$_LEDGER" | tail -30
else
  echo "账本尚不存在，本次将创建：$_LEDGER"
fi
```

Token 数据只作为内部判断材料，不在复盘正文输出“精力分布”“会话脉络”或仪表盘。

会话日志来源说明：
- Claude Code 日志通常位于 `~/.claude/projects/**/*.jsonl`，消息 usage 在 `message.usage`。
- Codex Desktop 当前会话通常位于 `~/.codex/sessions/YYYY/MM/DD/rollout-...{CODEX_THREAD_ID}.jsonl`，归档会话可能位于 `~/.codex/archived_sessions/rollout-*.jsonl`。
- Codex JSONL 属于本地会话记录格式，不假定其结构长期稳定；解析时必须按 `event_msg.token_count` 等可识别字段防御式读取，缺字段时降级而不是中断复盘。

上下文压缩后的复盘策略：
- **最佳**：压缩前复盘。当前模型上下文和本地 JSONL 都可用，正常执行完整复盘。
- **可接受**：已经压缩，但前置脚本输出 `FULL_LOG_AVAILABLE` 或 `PARTIAL_LOG_AVAILABLE`。说明本地 JSONL 仍保留原始消息，可从 JSONL 恢复逐条 Prompt 分析和行为序列分析。
- **降级**：找不到 JSONL，或前置脚本输出 `SUMMARY_ONLY_OR_MISSING`。只能做轻量复盘：不做逐条 Prompt 分析，不对行为序列做强判断；只基于当前摘要、文件 diff、工具结果和用户补充反馈提炼知识点、AI 表现风险和下次 SOP。

---

## 文档结构

复盘文档以 frontmatter 开头，包含会话标记：

```markdown
---
session: {JSONL文件名}
session_source: {claude|codex|unknown}
iteration: {迭代次数，首次为1}
created: {首次创建时间}
updated: {最后更新时间}
---
```

随后写导航目录和 5 个章节，最后写 `TLDR`。复盘不是周报，不追求完整复述全会话，只保留能帮助用户改进表达、行为和知识结构的信息。

### 导航目录

```markdown
## 目录

- [一、工作叙事](#一工作叙事)
- [二、表达与行为复盘](#二表达与行为复盘)
- [三、知识拓展](#三知识拓展)
- [四、AI 表现复盘](#四ai-表现复盘)
- [五、速查手册](#五速查手册)
- [TLDR](#tldr)
```

### 一、工作叙事

用 2-5 个短叙事段落回顾本次会话，不要写成阶段列表、流水账或 token 分布图。

必须包含：
- 本次用户真正想完成什么。
- 会话中出现过哪些关键转折。
- 最终交付了什么，或卡在什么地方。
- 哪些表达或行为问题影响了协作效率，并自然引到第二章。
- 只可补充与表达、行为、知识或 AI 表现诊断直接相关的信息。

写法要求：
- 写成 2-5 个短段落，不使用项目符号列表、阶段表、时间线表或自由扩展小标题。

### 二、表达与行为复盘

本章是整篇复盘的信息入口。目标是把“用户当时怎么说、为什么会增加 AI 协作成本、下次怎么说更好、哪些行为模式要调整”讲清楚。语气像教练，不像批改作业。

#### 2.1 逐条 Prompt 分析

只挑有学习价值的问题 Prompt，不按严重度打标签，不使用颜色标记。

每条格式：

```markdown
<a id="p1"></a>
#### #P1: "{用户原话}"

- **表达问题**：一针见血说明这句话的问题，例如目标缺失、范围不清、验收标准缺失、技术层级混在一起、默认 AI 知道上下文、只给结论不给约束。
- **更好的说法**：
  - **低关键词版**：当你不知道专业术语时，可以这样说：...
  - **进阶版**：如果你已经知道一点背景，可以这样说：...
```

硬性规则：
- `表达问题` 必须具体、短、准，不能写“表达不够清楚”这种空话。
- `低关键词版` 不默认用户知道术语，重点帮用户说清目标、现状、约束、验收。
- `进阶版` 可以引入第三章知识点中的专业术语，给出更像工程任务单的表达。

#### 2.2 行为诊断

行为诊断不是单条 Prompt 分析，而是跨多个 Prompt 的抽象观察。只列用户真实暴露出的低效行为或认知习惯，不为了凑数。

每个行为格式：

```markdown
#### B1：{行为名称}

- **问题**：描述这个行为暗含的问题（比如协作问题、表达问题、理解问题）。
- **分析**：解释用户为什么会这样说或这样推进：可能是缺知识、没遵守已有规范、急于推进、陷入局部修复循环、没有先定义验收标准，或其他真实原因。
- **建议**：给出可执行的修复方法。用户按这个建议做，下一次 AI coding 的效率和效果应该更好。
```

硬性规则：
- `问题` 要描述行为，不要复述某一句话。
- `分析` 必须判断原因类型：知识缺口、规范缺失、流程惯性、注意力偏移、目标不清、验收缺失等。
- `建议` 必须能变成下次协作动作，例如“先给目标状态 + 验收标准，再让 AI 选方案”。
- 决策复盘不再单独成章；有价值的决策、取舍和反思并入行为诊断。

### 三、知识拓展

按“单个知识点”展开，不按大领域写百科。每个知识点都必须来自用户选择、表达问题或本次实践中的真实知识缺口。

知识点生产前必须经过 web research，规则如下：

- 每个知识点必须做 web search 来搜集信息。
- `延伸学习` 至少给出 1 个可打开的权威来源链接。来源优先级：官方文档或主流项目文档 > 权威教程或官方视频 > 高质量社区资源。
- 若某知识点找不到官方或主流项目来源，必须在 `延伸学习` 中说明原因，并给出次优来源。
- 调研结果必须融入 `是什么 / 怎么用 / 延伸学习` 三段。



知识点了解的深度需匹配用户的选择，具体说明：

- `了解`：讲清是什么、本次为什么出现、什么场景下会用、暂时不用深入什么。
- `表达`：补充关键词、常见说法、什么场景下会用、下次可以怎么说。
- `复现`：补充原理拆解、最小可复现实例、检查清单和练习方向。

深度递增，兼容深度浅的规则。



知识点输出格式：

```markdown
### K1：{知识点名称} [来自 #P1 / B2 / 本次实践]

![K1 知识图](assets/{YYYY-MM-DD}-fupan-k1-{slug}.png)

#### 是什么

用通俗易懂的描述解释这个知识点，讲解方式视具体知识点和用户需求而定，可自由发挥。
你的目标是让用户理解这个知识点、了解它的关键信息、学会运用这个知识点。

#### 怎么用

说明它在哪些场景下有用；如果本次会话已经用到，要连接回本次实践。
若这个知识点只是背景知识，也要说明“什么时候不用深入”。

#### 延伸学习

- {官方文档 / 权威教程 / 视频 / 高质量资源}：说明适合看什么部分，解决什么问题。
```

知识图规则：
- 每个最终展开的知识模块必须执行 1 次学习图强尝试；成功时插入 PNG，放在模块标题下方、`是什么` 之前。
- 图片只服务记忆和理解，不替代 `是什么 / 怎么用 / 延伸学习` 正文。
- 未被用户选择或未展开的候选知识点不生成图。
- 若图片生成失败，保留同名 `.prompt.md` 和 `.meta.json`，在图片位置写：`> 图像待生成：已保存 prompt pack 到 {路径}`。
- 最终回复必须报告学习图状态：`已生成 N 张 / 待生成 N 张`；不得把 prompt pack 占位描述成已生成图片。



### 四、AI 表现复盘

不要使用固定评分维度。根据本次原始会话和工具结果，自行识别 AI 表现不好的地方，只写真实发生、对协作效率或交付质量有影响的问题。

每个问题格式：

```markdown
#### A1：{问题标题}

- **表现**：AI 具体哪里做得不好。
- **原因**：这是误解、遗漏、过度执行、验证不足、上下文管理问题，还是其他问题。
- **用户可辅助方式**：用户下次可以提供什么信息、约束或检查点，帮助 AI 更快做对。
```

硬性规则：
- 写真实可操作的优化方案，不能写“双方沟通不够”这类模糊归因。
- 如果 AI 表现整体合格，可以写“可进一步提升的点”，但仍然必须基于会话证据。

### 五、速查手册

只保留概念速查表，服务复习和下次协作，不再写避坑指南、效率词典或下次行动清单。

| 概念 | 解释 | 场景 |
|------|------|------|
| {概念名} | 详细说明这个名词的含义、边界和容易误解的点 | 最常使用它的场景，最好能连接到本次会话 |

### TLDR（必须位于文档最后）

`TLDR` 是最后的记忆卡，只关注用户以后要记住和执行的东西，不做普通摘要。

```markdown
## TLDR

- **需要记住的知识**：{本次最值得带走的知识点，用人话说清楚}
- **表达优化**：下次可以说：{一条可直接复制的高质量指令}
- **协作 SOP**：{以后遇到同类任务时的操作顺序}
```

硬性规则：
- TLDR 必须放在全文最后。
- TLDR 必须是分点陈述，5-10 条为宜；不得写成长段落。
- 每条都必须能在正文找到支撑，不得凭空发明。
- 包含 `表达优化`，格式必须出现“下次可以说：...”。
- 包含 `协作 SOP`，帮助用户提升与AI协作的能力。

---

## 执行流程

### Phase 0：环境准备

运行前置脚本，完成：
1. Git 卫生检查 + 项目上下文收集。
2. Token 统计（仅供内部判断，不作为正文图表）。
3. 原始会话可用性检查。
4. 同会话迭代检测。
5. 读取 MEMORY.md。

### Phase 1：对话分析（主 agent 串行）

会话读取规则：
- Claude Code：从 `message.role` / `message.content` / `message.usage` 读取用户消息、AI 消息和 token。
- Codex Desktop：从 `event_msg.user_message`、`event_msg.agent_message`、`event_msg.exec_command_end`、`event_msg.patch_apply_end` 读取用户可见对话和工具结果；`response_item` 只在需要补充模型内部调用细节时参考。
- 任一来源缺字段时只降级相关分析，不得中断整个复盘。
- 若前置脚本显示 `FULL_LOG_AVAILABLE` 或 `PARTIAL_LOG_AVAILABLE`，即使当前上下文已压缩，也优先以 JSONL 原始消息为准。
- 若前置脚本显示 `SUMMARY_ONLY_OR_MISSING`，进入轻量复盘：跳过逐条 Prompt 分析，只写“原始 Prompt 不可用，本节跳过”；行为诊断只写当前摘要和文件证据能支撑的低置信观察，不能伪造轮次和用户原话。

1. **提取工作叙事材料**：
   - 找出本次用户真正想完成的目标。
   - 找出关键转折、交付结果、卡点和返工来源。
   - 只为第一章准备短叙事素材，不输出会话脉络、仪表盘或 token 分布。

2. **逐条 Prompt 分析**：
   - 扫描用户的每一条消息。
   - 只保留有学习价值的问题 Prompt。
   - 为每条准备 `表达问题`、`低关键词版`、`进阶版`。
   - 不做严重度分级，不使用颜色标记。

3. **识别行为诊断项**：
   - 扫描多个 Prompt 构成的行为序列。
   - 提取用户真实暴露出的低效行为或认知习惯。
   - 为每个行为准备 `问题 / 分析 / 建议`。
   - 将有价值的决策、取舍和反思并入行为诊断，不单独写决策复盘。

4. **识别知识点**：
   - 从 Prompt 表达问题、行为诊断和工作内容中提取需要调研的单个知识点。
   - 每个知识点必须能说明“为什么本次需要学它”。
   - 为 Workbench 准备人话解释、相关性和推荐深度。

5. **AI 表现评估**：
   - 不使用固定维度。
   - 基于原始会话和工具结果，识别 AI 的误解、遗漏、过度执行、验证不足或上下文管理问题。
   - 为每个问题准备用户可辅助方式。

### Phase 1.5：学习地图确认（Workbench 优先）

Phase 1 完成后，**不要直接进入 Phase 2 调研**。先把推测的学习内容交给用户确认。目标是让用户选择“学什么、学多少”。

#### 1. 生成学习地图 JSON

把 Phase 1 的分析整理为 `/tmp/fupan-learning-map.json`：

```json
{
  "project": "{项目名}",
  "session": "{JSONL文件名}",
  "source_thread": "{可为空}",
  "active": true,
  "title": "[公众号抓取静默失败] 凭据续期链路与告警分层设计",
  "summary": "本次复盘背景，用人话概括",
  "user_questions": [
    "用户原话摘录 1",
    "用户原话摘录 2"
  ],
  "expression_issue_quotes": [
    {
      "quote": "用户表达有问题的原话，必须逐字摘录",
      "issue": "这句话为什么会增加歧义或沟通成本",
      "suggestion": "低关键词版：... / 进阶版：..."
    }
  ],
  "topics": [
    {
      "id": "react",
      "title": "React",
      "plain_explanation": "用来搭网页界面的前端框架。",
      "why_relevant": "本次设计了 React + Vite 的本地页面。",
      "recommended_depth": "表达",
      "selected": true,
      "depth": "表达"
    }
  ]
}
```

标题规则：
- `title` 是 Workbench 列表页的会话名，只有一行可显示，**不超过 24 个汉字宽**（英文、数字、空格各算半个）。
- 格式固定为 `[主题] 一句话结论`，`[主题]` 和复盘文档文件名里的 `[任务标签]` 用同一个词。
- `[主题]` 是这次干的那件事（4-10 字），后半句说清结果或落点，让人扫一眼就知道该不该点进去。
- `title` 负责"是什么"，`summary` 负责"背景与来龙去脉"，不要把 summary 的内容塞进 title。

Topic 规则：
- `topics` 是 Workbench 兼容字段，语义上表示“知识点”，不是大领域。
- 数量由用户最终选择，AI 只提出候选。
- 每个 topic 必须是单个知识点，并有 `plain_explanation`，不能只写专业名词。
- `recommended_depth` 只能是 `了解 / 表达 / 复现`。
- 推荐深度只是建议，不代表替用户做决定。

表达原话规则：
- `expression_issue_quotes` 由 LLM 自行分析本次原始会话，不要求用户手动指出。
- 只摘录真实出现过的用户原话，不能改写、概括或美化。
- 只要用户表达导致目标、范围、验收标准、技术关键词、优先级或约束不清，就必须收入。
- 如果确实没有表达问题，写空数组 `[]`。

#### 2. 创建 task 并启动 Workbench

```bash
_WB="$HOME/.claude/skills/forge/tools/fupan-workbench/launcher.py"
_TASK_JSON="/tmp/fupan-learning-map.json"
_TASK=$(python3 "$_WB" create-task --input "$_TASK_JSON")
_TASK_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<< "$_TASK")
python3 "$_WB" start --task-id "$_TASK_ID" --open
```

`start --task-id ... --open` 会直接打开本次会话的独立页面 `{url}/session/{task_id}`，
不是首页——用户在这一页只看到本次复盘的确认表单，历史会话在首页「复盘会话」列表里回看。

启动成功后，在对话里只提示一句：

> 我已经打开这次复盘的确认页（Workbench 独立会话页），请勾选想学习的知识点和深度；提交后我会自动继续。

不要要求用户回命令行输入“好了”。

#### 3. 等待当前 task 提交

```bash
python3 "$_WB" wait --task-id "$_TASK_ID" --timeout 1800
```

硬性规则：
- 只轮询当前 `_TASK_ID`。
- 不得读取或消费其他会话创建的 task。
- 30 分钟未提交则停止等待，告诉用户页面仍可提交，下次可继续读取。
- 如果 Workbench 启动失败、FastAPI/Uvicorn 缺失或浏览器无法打开，降级到对话内确认。
- `wait` 返回的 task JSON 是后续写作依据，必须读取 `selection.topics` 和 `selection.feedback`。
- `selection.feedback` 是用户补充反馈，不是备注字段；它会影响知识调研、行为诊断取舍、AI 表现复盘和最终文档写法。
- 如果 `selection.feedback` 与默认推荐深度或主 agent 推断冲突，优先遵循用户反馈；除非反馈无法执行，此时必须在最终文档中说明冲突。

#### 4. 对话内降级格式

只有在 Workbench 不可用时使用：

```markdown
Workbench 暂时没启动成功，我先用对话内确认兜底。

我推测这次可以学：
1. React — 人话解释：... — 推荐：表达
2. FastAPI — 人话解释：... — 推荐：了解

请告诉我：
- 要学哪些编号
- 每个编号学到：了解 / 表达 / 复现
- 还有没有补充反馈
```

#### 5. 后续写作约束

- Phase 2 只深度调研用户选择的 topic。
- 未选择 topic 不得长篇展开，默认不写；如确需保留，只能在附录“未展开候选”里一行带过。
- 有用户补充反馈时，按 `selection.feedback` 调整调研重点、解释深度、表达方式和 TLDR/SOP；没有反馈时，显式按默认深度规则执行。
- `了解` 输出：人话解释 + 本次为什么出现 + 暂时不用深入学什么。
- `表达` 输出：关键词 + 下次可以怎么说 + 常见误区。
- `复现` 输出：原理拆解 + 最小可复现实例 + 检查清单 + 练习方向。

### Phase 2：调研与诊断深化

Phase 1.5 完成后，为用户选择的每个知识点做调研，并对每个行为诊断项做深化分析。可并行时并行；不可并行时串行完成，但不能跳过。

#### 知识调研 Prompt（每个知识点一个）

```text
你正在为一次协作复盘调研一个“单个知识点”，不是泛泛调研一个大领域。

## 知识点
{知识点名称}

## 项目背景
{本次项目做了什么，核心目标是什么}

## 用户背景
{用户的角色、技术水平、工作习惯}
{用户在本次会话中对该知识点展现出的认知水平}
{用户用过的术语和没用到的术语}

## 用户的核心目标
通过复盘按用户选择的学习深度补齐该知识点的关键背景。不是写百科，而是让用户下次能更好地向 AI 表达、判断和协作。

## 用户补充反馈
{Workbench selection.feedback；若为空写“无”}

## 本次实践摘要
{本次会话里这个知识点出现在哪里、用了什么、卡在哪里}

## 用户暴露出的知识缺口
{具体列出哪些 Prompt 或行为暴露了哪些知识缺口}

## 输出结构

### 是什么
用人话解释这个知识点的定义、边界和关键机制。先讲用户需要知道的 20%，不要铺百科。

### 怎么用
说明它在什么场景下有用；如果本次场景适用，要连接回本次实践。若只是背景知识，也说明什么时候不用深入。

### 延伸学习
给出官方文档、权威教程、视频或高质量资源，并说明每个资源适合看什么、解决什么问题。

## 约束
- 必须 web search 验证，不凭记忆编造
- 优先官方文档、主流项目文档、权威教程、官方视频或高质量社区资源
- 按用户选择的深度写：了解 / 表达 / 复现
- 用户补充反馈优先于推荐深度和默认写法，必须体现在调研重点或输出取舍中
- 不写百科全书，只写用户下次能用上的知识
- 输出纯 markdown，不含代码块
```

#### 行为诊断 Prompt（每个行为一个）

```text
你正在分析一个用户和 AI 协作 coding 时暴露出的行为问题。

## 行为
{行为名称，如"碎片修复循环"}

## 对话中的证据
{主 agent 提取的具体对话片段，包括轮次编号和用户原文}

## 用户背景
{用户的角色、工作习惯、已知的偏好}

## 用户补充反馈
{Workbench selection.feedback；若为空写“无”}

## 输出结构

### 问题
描述这个行为暗含的协作问题，不要只复述某一句话。

### 分析
解释用户为什么会这样说或这样推进：是没有知识、没有遵守规范、流程惯性、目标不清、验收缺失，还是陷入某个循环自己不自知。

### 建议
给出可执行的修复方法。用户遵循这个建议后，下一次 AI coding 的效率和效果应该更好。

## 约束
- 不要泛泛而谈，每个论点必须有对话证据支撑
- 用户补充反馈会影响行为诊断取舍；若反馈要求关注某类行为，优先分析该类行为
- 建议必须能变成下次协作动作
- 输出纯 markdown
```

#### AI 表现复盘 Prompt

```text
不要使用固定评分维度。请基于本次原始会话和工具结果，自行识别 AI 表现不好的地方。

用户补充反馈：{Workbench selection.feedback；若为空写“无”}

只写真实发生、对协作效率或交付质量有影响的问题。每个问题包含：
- 表现：AI 具体哪里做得不好。
- 原因：这是误解、遗漏、过度执行、验证不足、上下文管理问题，还是其他问题。
- 用户可辅助方式：用户下次可以提供什么信息、约束或检查点，帮助 AI 更快做对。

如果 AI 表现整体合格，可以写“可进一步提升的点”，但仍然必须基于会话证据。
```

### Phase 2.5：知识模块图生成

Phase 2 完成后，为每个最终展开的知识模块强尝试生成一张 Image 2 学习图。知识图必须表达该模块的关键概念、出现原因、关系链和用户下次可迁移的判断方式。图片生成是强尝试交付步骤，不是所有运行环境都能保证成功的硬依赖；失败时必须明确降级为 prompt pack 占位。

#### 生成路径

优先路径：
- 使用 Codex 内置 `image_gen` / `imagegen` 能力逐张生成，不要求 `OPENAI_API_KEY`。
- 每个知识模块单独调用一次，避免多个模块混在同一张图里。
- 内置工具默认输出到 `${CODEX_HOME:-$HOME/.codex}/generated_images/{CODEX_THREAD_ID}/`。生成前先创建 marker 文件，生成后只复制 marker 之后新增的 PNG 到复盘文档的 `assets/` 目录，不删除原图。

内置工具生成后复制示例：

```bash
_IMAGE_ROOT="${CODEX_HOME:-$HOME/.codex}/generated_images"
[ -n "${CODEX_THREAD_ID:-}" ] && _IMAGE_ROOT="$_IMAGE_ROOT/$CODEX_THREAD_ID"
_IMAGE_MARKER=$(mktemp)

# 在这里调用 Codex 内置 image_gen 生成当前知识模块图片。

_IMAGE_SRC=$(find "$_IMAGE_ROOT" -type f -name "*.png" -newer "$_IMAGE_MARKER" -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)
if [ -n "$_IMAGE_SRC" ]; then
  cp "$_IMAGE_SRC" "$_ASSET_OUT"
fi
rm -f "$_IMAGE_MARKER"
```

Fallback：
- 若内置图片工具不可用，且存在 `OPENAI_API_KEY`，使用 `~/.claude/skills/_shared/generate_image2.py`，默认模型 `gpt-image-2`。
- 若两条路径都不可用，只保存 `.prompt.md` 和 `.meta.json`，不阻塞复盘。
- 降级后必须在最终回复和文档中写清楚待生成数量，不能说“图片已生成”。

#### 保存约定

```text
~/claudecode_workspace/记录/复盘/{项目名}/assets/{YYYY-MM-DD}-fupan-k{序号}-{slug}.png
~/claudecode_workspace/记录/复盘/{项目名}/assets/{YYYY-MM-DD}-fupan-k{序号}-{slug}.prompt.md
~/claudecode_workspace/记录/复盘/{项目名}/assets/{YYYY-MM-DD}-fupan-k{序号}-{slug}.meta.json
```

#### 知识图 Prompt 模板

```text
Use case: scientific-educational
Asset type: AI coding retrospective knowledge-module illustration
Primary request: Create a clean educational knowledge map illustration for one module in an AI coding retrospective.

Topic: {知识点名称}

Core idea to teach:
{这个知识点最重要的 1-3 个概念}

How it appeared in this session:
{本次会话中它出现在哪里，用户为什么需要学它}

Key relationships to show:
{概念 A} -> {概念 B} -> {概念 C}
{如果适用，列出流程、因果链、层级关系或判断路径}

User takeaway:
{用户看完这张图应该记住什么、下次应该怎么判断或表达}

Visual style:
- Educational diagram, not marketing poster
- Clear hierarchy, readable short Chinese labels, minimal decoration
- Use simple boxes, arrows, callouts, and small symbolic icons
- Neutral professional palette, white or light background
- Keep text short and large enough to read
- Avoid dense paragraphs; prefer 6-9 short labels
- No code screenshots, no fake UI, no unrelated people
- No purple-blue gradients, no decorative blobs, no watermark

Output: A single 16:9 PNG knowledge map suitable for embedding in a Markdown retrospective.
```

### Phase 3：组装文档（主 agent 串行）

1. **撰写文档**：按 5 章 + TLDR 结构组装，插入知识调研、知识图和行为诊断结果。
2. **应用用户反馈**：把 `selection.feedback` 作为全局写作约束，影响调研重点、诊断取舍、解释深度和 TLDR/SOP；反馈为空则按默认规则。
3. **提炼 TLDR**：从表达问题、行为诊断、知识拓展、AI 表现复盘和速查手册中提取最值得记住的内容，放到文档最后。
4. **建立锚点引用**：表达复盘 ↔ 知识拓展双向引用。
5. **保存文档**：
   - 新文档：写入复盘目录。
   - 迭代更新：覆写已有文档，更新 frontmatter 的 iteration 和 updated。

#### 文档内容 Checklist（全部 PASS 才能进入 Phase 4）

```text

□ 工作叙事是短段落，不是列表、进度条或 token 分布
□ 已读取 task.selection.feedback，并反映在知识调研和最终输出中（为空则标注无）
□ Prompt 分析没有严重度标记
□ 每条 Prompt 分析只包含“表达问题”和“两档更好的说法”
□ 每个行为诊断都包含“问题 / 分析 / 建议”
□ 每个知识点都包含“是什么 / 怎么用 / 延伸学习”
□ 每个展开知识点都已强尝试生成学习图；最终回复写明已生成 N 张 / 待生成 N 张，待生成项已保存 prompt pack
□ AI 表现复盘不使用固定四维评分
□ 速查手册概念表只有“概念 / 解释 / 场景”三列
□ TLDR 位于全文最后，且至少 5 条
□ TLDR 至少包含 1 条“下次可以说：...”表达优化
□ TLDR 至少包含 1 条可执行协作 SOP
□ TLDR 的知识、表达优化和 SOP 均能在正文中找到支撑
□ 导航目录的锚点跳转全部正确
□ frontmatter 中 session/session_source/iteration/created/updated 字段正确
□ 已根据原始会话可用性选择完整复盘 / JSONL 恢复复盘 / 轻量复盘
□ 若为轻量复盘，未伪造用户原话、轮次或行为序列证据
```

如果某项 FAIL，必须修复后重新检查。

### Phase 3.5：落账本（复利副产出，保留自 v2）

文档写完后，从本次复盘中提炼 2-3 条最值得复利的教训落入账本：

1. 向用户一行确认：“我准备落账本的条目：{每条一行}”，用户可改可否。
2. 确认后按 [references/learnings-schema.md](references/learnings-schema.md) 追加到
   `~/claudecode_workspace/记录/复盘/learnings.jsonl`（紧凑单行 JSON，append-only）。
3. **复发检测**：对照前置脚本读出的旧条目——复发的标 🔴（置信度 +1），避开的标 🟢 已改进；
   复发 ≥3 次禁止只再记一条，必须当场固化（改对应 skill 的检查项/门禁，或产出让用户亲手执行的配置清单），
   固化落点写进新条目 evidence；需要用户亲手执行的固化动作不算完成前不结案。
4. 每条锚定具体事件（哪个 bug、哪次返工、哪句指令），禁止“要多注意 X”式空话；
   本次没有值得复利的教训就不硬凑，0 条也合法。

### Phase 4：回流与索引

1. **清理 `.forge/active.md` 本会话登记**：
   - 只清当前会话自己的登记行（session id 匹配），不动别的会话。
   - 无法获取 session id → 不清理 + 提示用户后续 `/forge-status` 兜底。
   - 这一步在 Memory 回流之前执行。

2. **Memory 回流**：
   - 读取当前 MEMORY.md。
   - 只提取跨会话有价值的行为指令、项目状态、外部资源指向。
   - 每条 Feedback 创建独立 `.md` 文件，在 MEMORY.md 加一行索引。
   - 已有相同主题 → 更新而非新建。
   - 不复制复盘全文。

3. **INDEX.md 维护**：
   - 新文档：在对应日期下追加条目。
   - 迭代更新：更新已有条目的描述和迭代标记。

4. **标记 Workbench task 已完成（必须带 --review）**：

   ```bash
   _WB="${_WB:-$HOME/.claude/skills/forge/tools/fupan-workbench/launcher.py}"
   if [ -n "${_TASK_ID:-}" ] && [ -f "$_WB" ]; then
     python3 "$_WB" consume --task-id "$_TASK_ID" --review "$_DOC_PATH" \
       || echo "⚠️ Workbench task 标记 consumed 失败，可稍后手动处理: $_TASK_ID"
   fi
   ```

   `$_DOC_PATH` 是最终复盘文档的绝对路径。`--review` 写入后，该会话的独立页面会出现
   “打开这次的复盘文档”入口——漏传的话用户在会话页看不到文档链接。

5. **提交与推送**：

   ```bash
   git add ~/claudecode_workspace/记录/复盘/ 2>/dev/null
   git add ~/.claude/projects/*/memory/ 2>/dev/null || true
   git commit -m "docs: 复盘 — [主题关键词]"
   git push origin "$_BRANCH" 2>/dev/null && echo "✅ 复盘已推送"
   ```

6. **最终输出**：
   - 列出所有生成的文件路径。
   - 提醒用户 TLDR 已位于文档最后，可从最后一节开始复习。

---

## INDEX.md 规范

**位置**：`~/claudecode_workspace/记录/复盘/INDEX.md`

**格式**：

```markdown
# 复盘索引

## 2026-04-06

- **[视频转文本工具：从 brainstorm 到端到端交付](视频转文本/2026-04-06-0100-[视频转文本工具]-从brainstorm到端到端交付.md)** `视频转文本` `工具开发` `视频处理` `LLM-API`
  录屏/截图→结构化文档的全自动管线。核心收获：LLM做语义+CV做像素。
```

规则：
- 按日期倒序（最新在上）。
- 同一天多篇复盘按时间排列。
- 每条：标题超链接 + 项目标签 + 领域标签 + 1-2 句话描述。
- 路径使用相对路径（相对于 INDEX.md 所在目录）。
- 同会话迭代时更新已有条目，加 `迭代×N` 标签。
- 每次 forge-fupan 执行完自动追加/更新。

---

## 同会话迭代规范

当 Phase 0 检测到当前会话已有复盘文档时：

1. 读取已有文档，获取 frontmatter 中的 iteration 和 created。
2. 全量重新分析整个对话（包括第一次复盘前后的所有内容）。
3. 覆写原文件，更新 frontmatter：
   ```yaml
   iteration: {原值+1}
   updated: {当前时间}
   ```
4. INDEX.md 更新已有条目，加 `迭代×N` 标签。
5. 工作叙事只补充复盘后的关键变化，不恢复“会话脉络”或 token 分布。
6. Git 提交信息：`docs: 复盘迭代 — [主题关键词] (iter {N})`。

---

## 约束规范

### 内容规范
- **不放代码片段**：用自然语言描述概念；只有复现深度确实需要时才放最小示例。
- **结构化克制**：诊断和速查用结构化格式，工作叙事和知识解释避免表格堆砌。
- **不生成仪表盘**：不写“仪表盘速览”，不强制 show-widget，不输出精力分布图。
- **知识模块图强尝试生成**：每个展开知识模块默认强尝试生成 1 张 Image 2 学习图；成功图插入对应知识模块标题下方，不替代正文；失败时保存 prompt pack 并明确标注待生成；行为诊断和 AI 表现复盘不默认生成图。
- **内容全面优先**：每个分析点都要有充分依据，但不要为了凑结构扩写无价值内容。

### AI 表现复盘规范
- 必须归因到 AI 侧的具体失误，不能写“双方沟通不够”这类模糊归因。
- 每个问题必须写“用户可辅助方式”。
- 不使用固定评分维度。

### Research 规范
- 每个用户选择的知识点至少做一次 web search。
- 用户描述模糊的地方，必须调研该知识点的标准表达方式并告诉用户“下次可以说”。
- `延伸学习` 至少给出 1 个权威来源链接。来源优先级：官方文档或主流项目文档 > 权威教程或官方视频 > 高质量社区资源。
- 若缺少官方或主流项目来源，必须说明原因并给出次优来源。
- 调研结果融入知识拓展章节，不单独成章。

### Memory 回流规范
- ✅ 行为指令：“做X/不做Y” + 原因。
- ✅ 项目活跃状态：架构、设计方向、待解决问题。
- ✅ 外部资源指向：API 文档、监控地址、配置文件位置。
- ❌ 代码实现细节。
- ❌ 完整踩坑过程（已在复盘文件中）。
- ❌ 一次性任务的临时状态。

### Memory 文件格式

```markdown
---
name: 名称
description: 一行描述（用于判断是否相关，要具体）
metadata:
  type: feedback | project | reference
---

行为指令或项目状态描述。

**Why:** 原因
**How to apply:** 适用场景
```
