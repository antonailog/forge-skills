# forge-bugfix · P0-P1 会话级准备手册

> 由 SKILL.md 骨架按需加载：会话内首次进入 bugfix 时必读。含 P0 环境探测脚本（active.md 判重、端口、dev server）与 P1 问题理解和上下文采集。

## P0 环境探测（会话级·前置脚本，自动执行）

```bash
# === 基础信息 ===
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
echo "分支: $_BRANCH"
echo "根目录: $_ROOT"
echo "---"

# === Git 状态 ===
echo "=== Git 状态 ==="
git status --porcelain 2>/dev/null | head -20
echo "=== 最近 10 条提交 ==="
git log --oneline -10 2>/dev/null
echo "---"

# === 现有 worktree 清单 ===
echo "=== 现有 worktree ==="
git worktree list 2>/dev/null
echo "---"

# === 复现引擎: Playwright → $PW_AVAILABLE ===
PW_AVAILABLE="false"
if command -v npx &>/dev/null && npx playwright --version &>/dev/null 2>&1; then
  PW_AVAILABLE="true"
elif python3 -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
  PW_AVAILABLE="true"
fi
echo "PW_AVAILABLE=$PW_AVAILABLE"

# === 框架 / 测试框架 / Dev Server 状态 ===
# ... 框架探测 / 测试框架探测 ...

# === 统一 dev server 入口 → $APP_URL ===
APP_URL=""
DEV_STATUS=""
if [ -f "$_ROOT/package.json" ] && (cd "$_ROOT" && npm run 2>/dev/null | grep -q "dev:status"); then
  DEV_STATUS="$(cd "$_ROOT" && npm run dev:status 2>/dev/null || true)"
  echo "$DEV_STATUS"
  APP_URL="$(printf "%s\n" "$DEV_STATUS" | awk '/Frontend:/{print $2; exit}')"
elif [ -x "$_ROOT/scripts/dev-stack.sh" ]; then
  DEV_STATUS="$(cd "$_ROOT" && bash scripts/dev-stack.sh status 2>/dev/null || true)"
  echo "$DEV_STATUS"
  APP_URL="$(printf "%s\n" "$DEV_STATUS" | awk '/Frontend:/{print $2; exit}')"
else
  # 兼容旧项目：只读探测，不把探测结果当作 worktree 启动许可
  for port in 3456 3000 4000 5173 8080 8000; do
    if lsof -i :"$port" -sTCP:LISTEN &>/dev/null 2>&1; then
      APP_URL="http://localhost:$port"
      _PID=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null | head -1)
      _CWD=$(lsof -p "$_PID" 2>/dev/null | awk '$4=="cwd"{print $9}')
      echo "APP_URL=$APP_URL (PID=$_PID cwd=$_CWD)"
      break
    fi
  done
fi
[ -z "$APP_URL" ] && echo "APP_URL=（未检测到运行中的应用）"

# === 项目文档清单 ===
DOC_PRD=""; DOC_ENG=""; DOC_QA=""; DOC_BACKLOG=""; DOC_BUGFIX=""; DOC_REVIEWS=""
for p in "$_ROOT/docs/PRD.md" "$_ROOT/PRD.md"; do [ -f "$p" ] && DOC_PRD="$p" && echo "PRD: $p" && break; done
for p in "$_ROOT/docs/ENGINEERING.md" "$_ROOT/ENGINEERING.md"; do [ -f "$p" ] && DOC_ENG="$p" && echo "ENGINEERING: $p" && break; done
for p in "$_ROOT/docs/QA.md" "$_ROOT/QA.md"; do [ -f "$p" ] && DOC_QA="$p" && echo "QA: $p" && break; done

# backlog（bug 任务池，单一入口）
for p in "$_ROOT/docs/bugfix/backlog.md" "$_ROOT/backlog.md"; do
  [ -f "$p" ] && DOC_BACKLOG="$p" && echo "BACKLOG: $p" && break
done
if [ -z "$DOC_BACKLOG" ]; then
  DOC_BACKLOG="$_ROOT/docs/bugfix/backlog.md"
  echo "BACKLOG（首次使用，将从模板初始化）: $DOC_BACKLOG"
fi

# reviews 目录（每个正在处理的 bug 一个活跃 Bug 修复验收报告）
DOC_REVIEWS="$_ROOT/docs/bugfix/reviews"
mkdir -p "$DOC_REVIEWS" 2>/dev/null
echo "REVIEWS 目录: $DOC_REVIEWS"
DOC_REVIEWS_ARCHIVE="$_ROOT/docs/archive/raw/bugfix-reviews"
mkdir -p "$DOC_REVIEWS_ARCHIVE" 2>/dev/null
echo "REVIEWS 归档目录: $DOC_REVIEWS_ARCHIVE"

[ -d "$_ROOT/docs/bugfix" ] && DOC_BUGFIX="$_ROOT/docs/bugfix" && echo "BUGFIX 历史: $DOC_BUGFIX"

# === 报告目录 ===
REPORT_DIR="$_ROOT/.gstack/bugfix-reports"
mkdir -p "$REPORT_DIR/screenshots" 2>/dev/null
echo "报告目录: $REPORT_DIR"

# === 并行会话环境（v6.0 新增）===
# active.md: 跨 worktree 的心跳文件，项目根 .forge/active.md
mkdir -p "$_ROOT/.forge" 2>/dev/null
ACTIVE="$_ROOT/.forge/active.md"
if [ ! -f "$ACTIVE" ]; then
  # 首次使用，从模板初始化（模板路径按 skill 安装位置回退）
  for tpl in "$HOME/.claude/skills/forge-bugfix/templates/active.md" \
             "$HOME/.claude/skills/forge/skills/forge-bugfix/templates/active.md"; do
    [ -f "$tpl" ] && cp "$tpl" "$ACTIVE" && echo "✅ 初始化 .forge/active.md（请编辑功能域声明区）" && break
  done
fi
echo "ACTIVE=$ACTIVE"

# 当前 Claude Code session id（通过 PID 回溯 ~/.claude/sessions/<pid>.json）
SID_SCRIPT=""
for s in "$HOME/.claude/skills/forge-bugfix/scripts/get-session-id.sh" \
         "$HOME/.claude/skills/forge/skills/forge-bugfix/scripts/get-session-id.sh"; do
  [ -x "$s" ] || [ -f "$s" ] && SID_SCRIPT="$s" && break
done
CURRENT_SID=""
if [ -n "$SID_SCRIPT" ]; then
  CURRENT_SID=$(bash "$SID_SCRIPT" 2>/dev/null || echo "")
fi
[ -n "$CURRENT_SID" ] && echo "SESSION_ID=$CURRENT_SID" || echo "SESSION_ID=（无法自动获取，后续 P3 会提示）"

# 扫一眼 active.md 里"进行中会话"节，报告当前有哪些并行会话
if [ -f "$ACTIVE" ]; then
  echo "--- 当前并行会话 ---"
  awk '/^## 进行中会话/{flag=1;next} /^## /{flag=0} flag && /^- /{print}' "$ACTIVE" | grep -v '<!--' || echo "（暂无）"
fi
```

**关键变量**：

| 变量 | 含义 |
|------|------|
| `$PW_AVAILABLE` | Playwright 是否可用 |
| `$APP_URL` | 本地应用 URL（优先来自项目 `dev:status` / `dev-stack status`）|
| `$DOC_PRD` / `$DOC_ENG` / `$DOC_BUGFIX` | 项目文档路径 |
| `$DOC_BACKLOG` | bug 任务池 `docs/bugfix/backlog.md` |
| `$DOC_REVIEWS` | 活跃 Bug 修复验收报告目录 `docs/bugfix/reviews/` |
| `$DOC_REVIEWS_ARCHIVE` | 已结案 Bug 修复验收报告归档目录 `docs/archive/raw/bugfix-reviews/` |
| `$REPORT_DIR` | 截图和报告输出目录 |
| `$ACTIVE` | 并行心跳文件 `.forge/active.md`（v6.0） |
| `$CURRENT_SID` | 当前 Claude Code session id（v6.0） |

⚠️ **新增**：APP_URL 不再优先扫描常见端口。若项目提供 `npm run dev:status` 或 `scripts/dev-stack.sh`，必须从统一状态输出读取 URL、PID、cwd，防止 worktree 端口劫持（历史踩坑：worktree 旧 uvicorn 抢 8080，主项目改动不生效，30+ 分钟才定位）。

⚠️ **v6.0 新增**：P0 结束时 AI 必须向用户报告当前 `.forge/active.md` 的"进行中会话"情况——如果发现疑似僵尸（worktree 目录不存在 / 分支已合并到 main），**建议用户先跑 /forge-status 清理**再继续。AI 不自己清（那是 /forge-status 的职责）。

---

## P1 问题理解 + 上下文采集（会话级·一次执行）

> ⚡ **会话级声明**：本步只在会话首次进入时执行一次。同一会话做多次修复时，P1 不重读，直接复用上下文。

### 1.1 解析用户输入

用户报告 bug 的方式：
- 直接描述现象 / 粘贴错误 / 提供截图 / 引用已有 Bug ID

### 1.2 强制读取项目文档

**不读 PRD 不知道"正确"，不读 ENGINEERING.md 不理解数据流，不读 bugfix 历史会重复排查。**

| 文档 | 必须/按需 | 读什么 |
|------|-----------|--------|
| PRD (`$DOC_PRD`) | **必须** | 功能预期行为、验收标准 |
| ENGINEERING.md (`$DOC_ENG`) | **必须** | 架构、数据流、模块边界 |
| Bugfix 历史 (`$DOC_BUGFIX`) | **必须** | 已修 bug 的根因 — 防重复排查 |
| **Backlog (`$DOC_BACKLOG`)** | **必须** | 任务池 — 了解已登记待修 bug / 新需求 / 待澄清反馈 |
| **已归档已处理区** | **必须** | 历史修复回溯 — 以后遇到类似问题时搜这里 |
| QA.md (`$DOC_QA`) | 按需 | 已知问题列表 |
| Memory（MEMORY.md） | **必须** | feedback 类条目 — 历史踩坑 |
| learnings 账本（旧版复盘留下的教训） | 按需 | v4 起不再新增，只读回看 |
| `git log --since="3 days" -- affected-files` | 按需 | 最近变更（回归 Bug 必看）|

#### learnings 账本回看（旧版复盘留下的，只读）

```bash
_LEDGER="${FUPAN_ROOT:-$HOME/claudecode_workspace/记录/复盘}/learnings.jsonl"
_PROJ=$(basename "$_ROOT")
[ -f "$_LEDGER" ] && grep -h "\"project\":\"$_PROJ\"\|\"project\":\"global\"" "$_LEDGER" | tail -30
```

从输出中挑 status=active、置信度 ≥7、与本次问题域相关的条目（最多 5 条），
开工前向用户一行一条复述：`旧复盘教训：{key} — {insight}（置信度 N）`。
没有账本文件则静默跳过。

#### Bugfix 历史检索

```bash
if [ -n "$DOC_BUGFIX" ]; then
  ls -t "$DOC_BUGFIX"/*.md 2>/dev/null | head -5
  grep -rl "<用户描述的关键词>" "$DOC_BUGFIX" 2>/dev/null
fi
```

匹配到历史记录 → AskUserQuestion："这个问题与 BF-XXXX-N 类似，上次根因是 XXX，沿用还是重新排查？"

### 1.3 检查工作区状态

```bash
git status --porcelain
```

主仓库有未提交变更 → AskUserQuestion：
- A) 先提交 — commit 后再开始（推荐）
- B) 先暂存 — stash，修复完 pop
- C) 直接开始 — worktree 隔离，不影响主仓库

### 1.4 信息不足时

通过 AskUserQuestion 一次问一个：什么操作触发？预期行为？实际行为？一直存在还是最近出现？

---

