---
name: forge-qa
description: |
  QA 纯验收（只测不修）：Mode A 完整验收（test-spec → 10 维度断言引擎 → 报告 + User Gate）；Mode B 供 forge-bugfix P6 调用做单 bug 回归并回填 BF 报告。
  铁律：每个测试必须有 pass/fail 和深层断言；console.error 零容忍；不猜端口，只用传入的 app_url。
  触发方式：Mode A 用户说"测试"、"QA"、"forge-qa"或 forge-dev 调度；Mode B 由 forge-bugfix P6 调用（传 review_doc）。
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

> **文档落地路径**：遵循 forge-doc-policy 规范。完整白名单 + frontmatter schema 见
> `~/.claude/skills/forge-doc-policy/doc-paths.md`。
> **当前文档加载顺序**：完整 QA 先读项目 `CLAUDE.md`、`docs/README.md`、`docs/INDEX.md`、
> `docs/QA.md` 当前验收手册和相关 `.features/{feature-id}/feature-spec.md`；单 bug 回归读取活跃 BF 报告。
> 详细规则见 `~/.claude/skills/_shared/current-doc-loading.md`。

# /forge-qa：QA 验收与测试报告

**纯验收模式：测试 + 报告，不修代码。** 发现的问题生成结构化 bug 记录；单 bug 回归时回填 Bug 修复验收报告。

## 调用模式

forge-qa 支持两种调用模式，**入口判断在前置脚本阶段**完成（见"前置脚本"节）。

| 模式 | 触发条件 | 输入 | 输出 | 下游 |
|---|---|---|---|---|
| **Mode A：完整 QA** | 用户直接触发，或 forge-dev 调度 | PRD / DESIGN / git diff | QA.md 报告 + 结构化 bug 候选 + User Gate | forge-ship / forge-bugfix / forge-eng |
| **Mode B：单 bug 修复验收报告** | forge-bugfix 的 P6 调用；入口带参数 `review_doc=docs/bugfix/reviews/BF-XX.md` | 单 bug Bug 修复验收报告 | 报告内 QA 证据区、环境身份校验、逐步截图回填 | forge-bugfix 的 P6.5 / 批次最终验收 / P5（回修）|

**模式判断优先级**（AI 从 args 或触发消息中判断，从高到低）：

1. **显式参数** — Skill 调用时 args 含 `mode=B` 和 `review_doc=<路径>` → 直接 Mode B
2. **调用来源** — 触发消息里出现 "forge-bugfix"、"review-checklist"、`BF-\d+-\d+.md` 文件路径 → Mode B（从消息里提取 review_doc 路径，其余必需参数从报告或上下文推断）
3. **默认** — Mode A

**Mode B 入口校验**：`review_doc` 不存在 → 直接终止并报错；`bug_id` 缺失时取报告文件名。有 `worktree` 但没传 `app_url` 时，若验收项涉及浏览器/curl/截图，要求调用方先运行项目的 `dev:status` / `dev-stack status`，把 Frontend URL 作为 `app_url` 传入后再调用。

Mode B 详见"## Mode B：单 bug 修复验收报告模式"节（本文档末尾）。

Mode A 详见"## 三层架构"往下的完整流程。

**Mode B 的 args 契约（forge-bugfix 必须传，forge-qa 必须接收）**：

| 参数 | 必填 | 含义 |
|---|---|---|
| `mode=B` | ✅ | 强制信号，优先级最高 |
| `review_doc=<路径>` | ✅ | Bug 修复验收报告（存在性校验失败直接 exit） |
| `bug_id=BF-{MMDD}-{N}` | ✅ | 用于命名截图 / 日志 |
| `worktree=<路径>` | ✅ | 在该 worktree 内运行测试 |
| `commit=<hash>` | ✅ | 用于定位修复范围 |
| `app_url=<URL>` | 条件 | 仅当 bug 类型涉及应用运行时；必须来自调用方的 `dev:status` / `dev-stack status` 输出 |

## 三层架构

```
┌─────────────────────────────────────────────────┐
│  Layer 1: 测试规格生成（文档 → test-spec.json）     │
│  输入: PRD / DESIGN.md / git diff / 会话上下文       │
├─────────────────────────────────────────────────┤
│  Layer 2: 10 维度 Playwright 断言引擎               │
│  控制台|数据驱动|网络|视觉|交互|响应式|可访问|SSE|URL|懒加载│
├─────────────────────────────────────────────────┤
│  Layer 3: 智能分析（失败归因 + 根因定位）            │
│  console → 源码 → git diff 交叉引用                │
└─────────────────────────────────────────────────┘
```

## 铁律

1. **只测不修** — forge-qa 不修改任何业务代码。发现 bug 记录到报告，由 forge-eng 修复。
2. **不生成 test-spec 就不执行测试** — 先从文档提取验收项，结构化后再执行。
3. **每个测试必须有 pass/fail** — 不允许 `.catch(() => {})` 吞错误，不允许"只截图不断言"。
4. **断言必须验证功能正确性，不能只验证元素存在** — `visible` 和 `count_gte` 是前置条件，不是验收断言。每个测试用例必须至少包含一个验证**数据值/文本内容/状态变化**的深层断言（`contains_text`、`has_attribute`、`css_value`、`matches_regex`、自定义 `evaluate`）。详见下方"断言深度规则"。
5. **证据先于结论** — 每个测试结果必须有截图、输出、或日志作为证据。
6. **控制台零容忍** — 任何 `pageerror` 或 `console.error` 自动 FAIL。
7. **不得猜本地端口** — 有 `app_url` 就只测该 URL；没有 `app_url` 时，优先读取 `dev:status` / `dev-stack status`，不得自行发明 `localhost:3000`、`5173`、`8080` 等地址。

**环境适配**：在 Codex 中做本地前端页面/交互 QA 时，若 Browser Use 插件可用，优先使用 `browser-use:browser`（Computer Use 只作明确兜底）；Claude Code 环境用 Playwright（qa-runner.mjs）。

## 定位说明

| forge-eng 负责 | forge-qa 负责 |
|----------------|--------------|
| 单元测试（TDD 红绿重构） | **端到端用户流程测试** |
| 原子 commit 验证（exit code） | **跨模块集成测试** |
| 任务级验证 | **10 维度断言（视觉+响应式+可访问性+网络+数据驱动）** |
| — | **验收标准逐项核对** |
| — | **User Gate（用户验收关卡）** |

## 完整流程

```
第0步 上下文探测
  ├── 0.1 Worktree 检测
  ├── 0.2 文档链定位（PRD/DESIGN/ENGINEERING/FEEDBACK）
  ├── 0.3 变更范围分析（git diff）
  ├── 0.4 选择器审计（铁律：不盲猜选择器）
  └── 0.5 测试级别确认
  │
第1步 建立健康基准
  │
  ├── 已有 QA.md → 第2步 理解现状
  └── 无 QA.md   → 第2步(替代) 从零创建
  │
第2.5步 生成 test-spec（铁律：不生成就不执行）
  │
第3步 测试计划确认（用户审查 test-spec 摘要）
  │
第4步 更新 QA 文档
  │
第5步 10 维度测试执行
  ├── Phase 1: 控制台[console] + 网络[network]
  ├── Phase 2: 交互[functional] + 数据驱动[data-driven] + SSE[streaming] + URL状态[url-state] + 懒加载[async-content]
  ├── Phase 3: 视觉[visual] + 响应式[responsive]
  │     └── 有设计页面包时加跑：零件库守门 check_system.py（新增越界算 fail）、
  │         实现比对 compare_impl.mjs（tokens.json 有 implCheck 时；骨架与实现误差 > 2px 算 fail）
  └── Phase 4: 可访问性[accessibility]
  │
第6步 智能分析 + Bug 报告
  │
第7步 User Gate（用户验收 — 不可跳过）
  │
  ├── accept → forge-ship
  └── reject → FEEDBACK.md → forge-eng → forge-qa (回归) → User Gate
```

全程中文。关键测试策略需用户确认后再执行。

## 报告产出后的出口

```
QA 验收完成。下一步：

[全部通过 + 用户验收通过]
→ /forge-ship 或 /forge-review

[有 FAIL 或用户 reject]
→ 生成修复清单 + FEEDBACK.md → /forge-eng 修复 → /forge-qa 回归
```

---

## 前置脚本

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
echo "当前分支: $_BRANCH"

# === Worktree 检测 ===
_IN_WORKTREE="no"
_WORKTREE_ROOT=""
git worktree list 2>/dev/null | while read line; do
  echo "  worktree: $line"
done
[ "$(git rev-parse --git-common-dir 2>/dev/null)" != "$(git rev-parse --git-dir 2>/dev/null)" ] && _IN_WORKTREE="yes" && _WORKTREE_ROOT="$_ROOT"
echo "在 Worktree 中: $_IN_WORKTREE"

# === 测试引擎: Playwright ===
PW=""
command -v npx >/dev/null 2>&1 && npx playwright --version >/dev/null 2>&1 && PW="npx"
[ -z "$PW" ] && python3 -c "from playwright.sync_api import sync_playwright" 2>/dev/null && PW="python"
[ -n "$PW" ] && echo "Playwright: 可用 ($PW)" || echo "Playwright: 不可用"

# === qa-runner.mjs 检测 ===
QA_RUNNER=""
[ -f "$HOME/.claude/skills/forge-qa/scripts/qa-runner.mjs" ] && QA_RUNNER="$HOME/.claude/skills/forge-qa/scripts/qa-runner.mjs"
[ -n "$QA_RUNNER" ] && echo "qa-runner: $QA_RUNNER" || echo "qa-runner: 不可用"

# === 框架检测 ===
[ -f "$_ROOT/package.json" ] && grep -q '"react"' "$_ROOT/package.json" 2>/dev/null && echo "框架: React"
[ -f "$_ROOT/package.json" ] && grep -q '"vue"' "$_ROOT/package.json" 2>/dev/null && echo "框架: Vue"
[ -f "$_ROOT/package.json" ] && grep -q '"next"' "$_ROOT/package.json" 2>/dev/null && echo "框架: Next.js"
[ -f "$_ROOT/requirements.txt" ] || [ -f "$_ROOT/pyproject.toml" ] && echo "运行时: Python"
[ -f "$_ROOT/package.json" ] && echo "运行时: Node.js"

# === 本地服务探测 ===
echo "本地服务:"
if [ -n "$APP_URL" ]; then
  echo "  APP_URL=$APP_URL（由调用方传入）"
elif [ -f "$_ROOT/package.json" ] && (cd "$_ROOT" && npm run 2>/dev/null | grep -q "dev:status"); then
  (cd "$_ROOT" && npm run dev:status)
  echo "  未传 APP_URL：如需浏览器验收，请使用 dev:status 输出中的 Frontend URL 重新调用 forge-qa。"
elif [ -x "$_ROOT/scripts/dev-stack.sh" ]; then
  (cd "$_ROOT" && bash scripts/dev-stack.sh status)
  echo "  未传 APP_URL：如需浏览器验收，请使用 dev-stack status 输出中的 Frontend URL 重新调用 forge-qa。"
else
  for port in 3000 3456 4000 5173 8080 8081; do
    curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" 2>/dev/null | grep -qE "200|301|302|304" && echo "  http://localhost:$port ✓（旧项目兜底探测）"
  done
fi

# === 报告目录 ===
REPORT_DIR="$_ROOT/.gstack/qa-reports"
mkdir -p "$REPORT_DIR/screenshots" 2>/dev/null
echo "报告目录: $REPORT_DIR"
```

---

> 提问格式与批量策略见 `~/.claude/skills/_shared/interaction-protocol.md`。

---

## 执行手册（按需加载，执行时必读）

本文件只保留契约、铁律和流程总览。**进入执行阶段前，必须先读对应手册**：

| 场景 | 必读文件 | 内容 |
|---|---|---|
| Mode A 完整 QA（第0步~第8步） | [references/mode-a-execution.md](references/mode-a-execution.md) | 上下文探测、健康基准、test-spec 生成、验收计划、10 维度执行、智能分析、User Gate、健康评分全细则 |
| Mode B 单 bug 回归（bugfix P6 调用） | [references/mode-b-regression.md](references/mode-b-regression.md) | 报告解析、环境身份校验、逐项测试与回填、判定与出口 |
| 写测试脚本时 | [references/test-dimensions.md](references/test-dimensions.md) | 10 维度逐个的代码模板与断言写法 |
| 产出报告时 | [references/qa-template.md](references/qa-template.md) | QA.md 结构、验收计划、健康评分表格式 |

**规矩**：不允许凭记忆执行细则——骨架没写的操作细节，一律以对应手册为准；手册与骨架冲突时，以骨架的铁律和契约为准。

---

## Feature 状态管理

> 状态标记与通用操作规则见 `~/.claude/skills/_shared/feature-status-protocol.md`。

qa 特有动作：启动前确认 eng 行为 `[✅ 已完成]`；执行中更新 QA Items 表（每个测试项独立状态）；完成时 note 填 `{passed}/{total} PASS, {score}/100`（未通过填 `{failed} FAIL, 需修复后重测`）。

---

## 重要规则

1. **像真实用户一样测试** — 点所有可点的，填所有表单，测试所有状态。
2. **截图留证** — 每个测试步骤至少一张截图。用 `snapElement()` 紧凑裁剪，不用 fullPage。截图后用 Read 工具展示给用户。
3. **不要只测 Happy Path** — 边界、空状态、超长输入、网络错误都要测。
4. **控制台是第一现场** — 每次交互后检查控制台。视觉上没问题不代表没有 JS 错误。
5. **数据驱动是核心** — 不只测一条数据。用 `pickStratified()` 采样多条。
6. **前后端联动是重点** — 验证 API 调用是否正确、响应是否合理。
7. **深度优于广度** — 5-10 个证据充分的 Bug > 20 个模糊描述。
8. **自我调节** — 拿不准就停下来问。
9. **绝不拒绝使用浏览器** — 后端变更也会影响应用行为，始终打开浏览器测试。
10. **User Gate 不可跳过** — 自动化测不到设计意图偏差，必须等用户验收。

