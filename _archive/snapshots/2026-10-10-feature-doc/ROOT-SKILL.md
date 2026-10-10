---
name: forge
description: |
  Forge 工作流总入口。只读检测项目状态，推荐下一步该用哪个 skill，自己不干活。触发方式：用户说"forge"、"下一步"、"接下来做什么"。
---

# /forge：工作流总入口

不知道下一步该干什么？打 `/forge`。

全程中文。

---

## 执行流程

### 第1步：检测项目状态

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
echo "项目根目录: $_ROOT"

# 检测文档状态
echo "--- 文档状态 ---"
[ -f "$_ROOT/docs/README.md" ] && echo "[DOCS] 发现 docs/README.md"
[ -f "$_ROOT/docs/INDEX.md" ] && echo "[DOCS] 发现 docs/INDEX.md"
[ -f "$_ROOT/docs/CHANGELOG.md" ] && echo "[DOCS] 发现历史总账"
[ -f "$_ROOT/docs/modules/doc-system.md" ] && echo "[DOCS] 发现项目文档系统说明"
[ -f "$_ROOT/.features/_registry.md" ] && echo "[FEATURES] 发现 Feature 注册表" && sed -n '1,80p' "$_ROOT/.features/_registry.md"
ls "$_ROOT"/brainstorm-*.md 2>/dev/null && echo "[BRAINSTORM] 发现思考文档（根目录）"
ls "$_ROOT"/docs/brainstorm-*.md 2>/dev/null && echo "[BRAINSTORM] 发现思考文档（docs/）"
[ -f "$_ROOT/docs/PRD.md" ] && echo "[PRD] 发现产品当前真相源"
[ -f "$_ROOT/docs/DESIGN.md" ] && echo "[DESIGN] 发现 DESIGN.md"
[ -f "$_ROOT/docs/ENGINEERING.md" ] && echo "[ENGINEERING] 发现 ENGINEERING.md"
[ -f "$_ROOT/docs/QA.md" ] && echo "[QA] 发现 QA.md"

# 检测代码状态
echo "--- 代码状态 ---"
git status --short 2>/dev/null | head -10
git log --oneline -3 2>/dev/null

# 检测 Worktree
echo "--- Worktree ---"
git worktree list 2>/dev/null

# 只读检测 Dev Server（如项目提供统一入口）
echo "--- Dev Server ---"
if [ -f "$_ROOT/package.json" ] && (cd "$_ROOT" && npm run 2>/dev/null | grep -q "dev:status"); then
  (cd "$_ROOT" && npm run dev:status 2>/dev/null) || true
elif [ -x "$_ROOT/scripts/dev-stack.sh" ]; then
  (cd "$_ROOT" && bash scripts/dev-stack.sh status 2>/dev/null) || true
else
  echo "未发现统一 dev server 状态入口"
fi

# 检测分支
echo "--- 分支 ---"
git branch --show-current 2>/dev/null
```

### 第2步：状态判断 + 推荐

根据检测结果，按以下决策树判断。**轻量车道优先于其他规则**：

```
⚡ 轻量车道：用户描述的是小改动（预估 < 半小时，且不碰类型定义/API 格式/枚举/数据结构）
  → "小改动建议走轻量车道，跳过 PRD/设计仪式：
     A) /forge-eng 轻量模式 — 直接实现（自验 + 提交前检查仍然要做）
     B) /forge-bugfix — 如果本质是修问题
     C) 走完整流程 — 如果实际影响面比看起来大（拿不准就选这个）"

完全空项目（无 docs/、无 .features/）
  → "建议先跑一次脚手架铺好状态文件：
     ~/.claude/skills/forge-doc-policy/scripts/init-project.sh
     然后 /forge-brainstorm 或 /forge-prd 开始。"

无任何文档 + 用户没有明确任务
  → "看起来是一个新开始。建议先跑 /forge-brainstorm 理清思路。"

有思考文档，无 PRD 或无 .features Feature Spec
  → "发现思考文档 [{文件名}]。建议下一步：
     A) /forge-prd — 将思考转化为 PRD 当前事实 + .features Feature Spec
     B) /forge-dev — 跳过 PRD，直接进轻量开发模式
     C) /forge-brainstorm — 继续讨论，还没想清楚"

有 PRD + Feature Spec，无 DESIGN.md（且项目含前端）
  → "产品当前事实和 Feature Spec 就绪，但还没有设计文档。建议：
     A) /forge-dev — 启动开发调度（会自动触发设计）
     B) /forge-design — 单独做设计规划"

有 PRD + DESIGN.md，无 ENGINEERING.md
  → "设计已就绪。建议：
     A) /forge-dev — 启动开发调度
     B) /forge-eng — 单独做工程实现"

有 ENGINEERING.md，代码有改动未测试
  → "代码已改动。建议：
     A) /forge-qa — 验收测试
     B) /forge-eng — 继续工程实现"

代码改动已测试，在 feature 分支上
  → "看起来可以收尾了。建议：
     A) /forge-review — PR 审查
     B) /forge-ship — 发布
     C) /forge-fupan — 先复盘再发布"

在 Worktree 中
  → "当前在 Worktree [{分支名}] 中。建议：
     A) 继续当前工作（列出未完成任务）
     B) /forge-eng — 继续工程实现
     C) 收尾 Worktree — merge/PR/keep/discard"

主分支，一切就绪
  → "项目状态良好。你想做什么？
     A) /forge-brainstorm — 讨论新想法
     B) /forge-prd — 迭代现有需求
     C) /forge-bugfix — 修个 bug
     D) /forge-fupan — 复盘最近的工作"
```

### 第3步：AskUserQuestion

基于判断，通过 AskUserQuestion 展示推荐：

```
当前项目状态：
  {项目名} | {分支} | {文档状态摘要}

推荐下一步：【{推荐的 skill}】— {理由}

选项：
A) {推荐选项}（推荐）
B) {备选1}
C) {备选2}
D) 其他 — 告诉我你想做什么
```

### 第4步：执行

用户选择后：
- 如果选择了某个 forge-* skill → 提示用户调用对应 skill（如"请运行 /forge-brainstorm"）
- 如果选择"其他" → 听用户描述，重新判断

---

## Forge 体系完整 Skill 清单

供参考，当用户问"有哪些工具"时展示：

| Skill | 用途 | 何时使用 |
|-------|------|---------|
| `/forge-brainstorm` | 头脑风暴 | 有想法要讨论时 |
| `/forge-prd` | PRD 管理 | 需要正式需求文档时 |
| `/forge-dev` | 开发调度 | 从需求到交付；`--full` 一路到发布（原 forge-deliver 已并入） |
| `/forge-design` | 设计规划 | 需要 UI/UX 设计时 |
| `/forge-design-impl` | 设计实现 | 将设计文档转为代码 |
| `/forge-eng` | 工程实现 | 写代码（含 TDD + Worktree） |
| `/forge-qa` | QA 验收 | 测试+报告（不修代码） |
| `/forge-bugfix` | Bug 修复 | 系统性调试和修复 |
| `/forge-review` | PR 审查 | 上线前代码审查 |
| `/forge-ship` | 发布 | 合并+推送+创建 PR |
| `/forge-fupan` | 复盘 | 教训进账本 + 一页纸 + 复发检测（Workbench 是阅览器） |
| `/forge-doc-release` | 发布后文档同步 | ship 之后让文档对齐现实 |
| `/forge-status` | 并行会话巡检 | 扫 `.forge/active.md`，按硬信号清理僵尸 |
| `/forge-doc-policy` | 文档治理规范 | 文档放哪的规则源头 + 新项目脚手架 |

---

## 重要规则

1. **不做具体工作** — forge 只做状态检测和推荐，不写代码、不改文档
2. **快速** — 整个流程应该在 10 秒内完成（跑脚本 + 判断 + 展示）
3. **不强制** — 推荐不是命令，用户可以选"其他"做任何事
4. **每个 forge-* skill 也有出口建议** — 完成后会推荐下一步，形成链式引导
5. **视觉决策提示** — 如果当前任务涉及前端设计、人类判断或复盘学习图，推荐链路中优先提示对应 skill 使用 `~/.claude/skills/_shared/visual-decision-layer.md`，但 /forge 本身不生成图片
