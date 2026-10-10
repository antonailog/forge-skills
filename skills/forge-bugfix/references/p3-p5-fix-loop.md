# forge-bugfix · P3-P5.3 修复循环手册

> 由 SKILL.md 骨架按需加载：进入修复阶段时必读。含 worktree 创建与复现、根因追踪/5 Whys、TDD 最小修复、报告更新为待 QA。

## 导航（按需跳读）

> 本文件 400+ 行，按当前所处阶段搜小节标题跳读即可。

| 小节 | 何时需要读 |
|---|---|
| P3 创建 worktree + 复现 | 开始修复前：建 worktree、登记 active.md、Dev Server 契约、复现 Bug |
| P4 根因追踪 + 假设验证 + 方案确认 | 复现成功后定位根因时：模式检查清单、标签化日志、三振出局、5 Whys、红旗信号 |
| P5 worktree 内最小修复 + 原子提交 | 根因确认后动手改代码时：修复原则、范围控制、爆炸半径、原子提交、清理临时代码 |
| P5.3 更新 Bug 修复验收报告为待 QA 状态 | 修复提交后、进入 P6 验收前的报告填充与汇报时 |

---

## P3 创建 worktree + 复现

### 3.1 创建 worktree

```bash
# Bug 编号已在 P2.4 确定，例如 BF-0418-9
BUG_ID="BF-0418-9"
WT_NAME="bf-${BUG_ID#BF-}"  # → bf-0418-9
WT_PATH="$_ROOT/.worktrees/$WT_NAME"
WT_BRANCH="bugfix/$WT_NAME"

git worktree add "$WT_PATH" -b "$WT_BRANCH"
echo "✅ worktree 创建: $WT_PATH (分支: $WT_BRANCH)"
```

### 3.1.5 登记 .forge/active.md（v6.0 硬性步骤）

worktree 创建成功之后**立即**登记，不得拖到修复结束再补。

```bash
# 字段：session id / worktree 相对路径 / 任务 id / 功能域
DOMAIN="<P2.0 打好的功能域标签，单域或逗号分隔多域>"
REL_WT="${WT_PATH#$_ROOT/}"   # 存相对路径，便于跨机器
LINE="- session: $CURRENT_SID / worktree: $REL_WT / 任务: $BUG_ID / 域: $DOMAIN"

# 追加到 active.md 的"进行中会话"节末尾（用 awk 精确插入在 "---" 之前）
python3 -c "
import pathlib,re
p=pathlib.Path('$ACTIVE')
txt=p.read_text()
# 找到'## 进行中会话'节，在它后面的（暂无进行中会话）或第一个 --- 之前插入
pat=re.compile(r'(## 进行中会话\n[\s\S]*?)(\n---)', re.M)
line='''$LINE'''
def repl(m):
    body=m.group(1)
    # 去掉占位行
    body=re.sub(r'\n（暂无进行中会话）', '', body)
    if not body.endswith('\n'):
        body+='\n'
    return body + line + '\n' + m.group(2)
p.write_text(pat.sub(repl, txt, count=1))
"

echo "✅ 已登记到 .forge/active.md: session=$CURRENT_SID 域=$DOMAIN"
```

**硬性要求**：
- `$CURRENT_SID` 为空时 AI 必须停下问用户，不得用 "unknown" 或占位符登记
- 登记失败（awk 未匹配等）必须向用户报错，不得静默跳过
- backlog.md 中对应 bug 的状态同时改 `in-progress`，"领取会话"字段填 session id 前 12 位即可

### 3.2 ⚠️ worktree Dev Server 契约

**强制步骤**。历史踩坑：worktree 内启动的服务和主仓库抢同一端口，curl/前端打到旧代码上，调试 30+ 分钟。

如果本 bug 只需读代码和单元测试即可复现，可以不启动应用；一旦需要浏览器、curl、截图或端到端复现，就必须走项目统一 dev server 入口。

```bash
cd "$WT_PATH"

if [ -f package.json ] && npm run 2>/dev/null | grep -q "dev:status"; then
  npm run dev:status || true
  npm run dev
  npm run dev:status | tee /tmp/forge-dev-status.txt
  APP_URL=$(awk '/Frontend:/{print $2; exit}' /tmp/forge-dev-status.txt)
elif [ -x scripts/dev-stack.sh ]; then
  bash scripts/dev-stack.sh status || true
  bash scripts/dev-stack.sh start
  bash scripts/dev-stack.sh status | tee /tmp/forge-dev-status.txt
  APP_URL=$(awk '/Frontend:/{print $2; exit}' /tmp/forge-dev-status.txt)
else
  echo "未发现统一 dev server 入口；必须显式选择非默认端口，并记录 PID/cwd/URL"
  echo "旧项目兜底探测："
  for port in 3456 3000 4000 5173 8080 8000; do
    PID=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null | head -1)
    if [ -n "$PID" ]; then
      CWD=$(lsof -p "$PID" 2>/dev/null | awk '$4=="cwd"{print $9}')
      echo "端口 $port: PID=$PID cwd=$CWD"
    fi
  done
fi
```

**硬性要求**：
- 有 `npm run dev:status` 或 `scripts/dev-stack.sh` 时，不得裸跑 `uvicorn` / `vite` / `next dev`。
- `APP_URL` 必须从状态输出读取，传给复现、截图和 forge-qa；不得凭常见端口猜。
- 状态输出必须显示监听进程 cwd 属于当前 worktree；不一致就先 `npm run dev:stop` / `bash scripts/dev-stack.sh stop` 后重启。
- 旧项目没有统一入口时，AI 必须把端口、PID、cwd、URL 写进报告，且不得占用主分支固定端口。

### 3.3 切换到 worktree 工作

```bash
cd "$WT_PATH"
# 后续所有操作（复现、修改、commit）都在 worktree 内进行
```

### 3.4 复现 Bug

**确定性复现是调查的核心。无法复现就无法验证修复。**

引擎优先级：Codex browser-use:browser（可用时） > Playwright > 纯代码

#### Codex browser-use:browser（Codex + Browser Use 插件可用时）

用于前端页面、交互、视觉、控制台相关 bug 的复现：

- 打开 P3.2 得到的 `APP_URL`，不得猜端口
- 按用户路径操作页面，采集 DOM snapshot 和关键状态截图
- 复现截图写入 `docs/bugfix/reviews/assets/${BUG_ID}/`，并在报告“初始证据 / 复现截图”区内嵌
- 读取 console logs，错误写入报告
- 如果代码或 build 刚变更，验证前 reload 页面并重新采集 DOM/screenshot

规则：

1. 执行浏览器动作前必须加载并遵守 `browser-use:browser` skill。
2. 使用 Codex in-app browser 的 `iab` backend；不要因为 Computer Use 工具可见就跳过 Browser Use。
3. Computer Use 只在 Browser Use 不可用、被中断或目标不是浏览器页面时兜底，兜底原因必须写入报告。
4. P3 复现可以用 Browser Use；P6 正式 QA 仍必须交给 forge-qa。


#### Playwright（`$PW_AVAILABLE=true`）

```bash
npx playwright test --grep "related-test"
npx playwright screenshot $APP_URL/path /tmp/${BUG_ID}-before.png
```

#### 纯代码（始终可用）

```bash
curl -s $APP_URL/api/endpoint | python3 -m json.tool
npm test -- --grep "related-test" 2>/dev/null
python3 -m pytest -k "related-test" -v 2>/dev/null
tail -50 $_ROOT/logs/*.log 2>/dev/null
```

**无法复现 → 停止**。AskUserQuestion 升级或收集更多证据。

---

## P4 根因追踪 + 假设验证 + 方案确认

### 4.1 根因追踪

从症状回溯到根因：
1. **Grep 定位引用**：用错误消息、函数名、API 端点搜索
2. **Read 追踪调用链**：从入口点沿调用链追踪
3. **画数据流**：输入 → 处理 → 输出，哪一步断裂？
4. **检查最近变更**：`git log --oneline -20 -- <affected-files>`

### 4.2 模式检查清单（追踪时内嵌）

- **竞态条件** — 间歇性、时序敏感 → 查共享状态并发访问
- **空值传播** — TypeError → 查可选值缺少守卫
- **状态不同步** — 数据不一致、部分更新 → 查事务/回调/生命周期
- **前后端不一致** — 前端异常但 API 正确 → 查字段映射、类型转换
- **缓存过期** — 旧数据 → 查 Redis/CDN/浏览器/SW 缓存版本号
- **配置漂移** — 本地正常线上不行 → 查环境变量、特性开关
- **进程身份** — 改了代码没效果 → 查进程 cwd（worktree 端口劫持是典型）
- **SQL/查询错误** — 数据缺失或重复 → 查 WHERE/JOIN/去重
- **开关/数据就绪错位** — API 通过但 UI 仍不对 → 查 feature flag、config、DB settings、后端 `enabled` 字段、测试数据是否足以展示用户问题

### 4.2.1 用户问题闭环检查（前端/交互 bug 必做）

如果 bug 来自用户反馈，AI 必须把用户原话转成一句可验收断言：

```
用户原话：<用户看到/无法完成的问题>
闭环断言：修复后，用户在 <页面/流程> 中应该能 <看到/完成的结果>
证明方式：<截图 / 交互 / API / 测试命令>
```

后续 P5/P6/P6.5 都以这句闭环断言为准。**接口 200、单测通过、没有 console error 都只是证据，不等于用户问题闭环。**

### 4.2.2 配置 / 开关 / 数据就绪门禁

涉及页面展示、权限边界、数据可见性、灰度发布、冷启动、实验开关的 bug，根因阶段必须检查并写入报告：

| 检查面 | 必查内容 |
|---|---|
| Feature flag / config | 配置文件、环境变量、远程配置、DB settings 是否符合预期 |
| 后端返回状态 | API 是否返回 `enabled/disabled`、权限状态、空态原因 |
| 数据就绪 | 本地/测试/线上数据是否足以让用户看到目标状态 |
| UI fallback | 前端是否因开关/空态/error 走了合理 fallback |

如果配置或数据不满足用户闭环断言，不得声称 bug 已修复；应修正配置/数据，或标记 `blocked-human` 请用户确认开关策略。

### 4.3 假设验证（标签化日志）

在疑似根因处加**标签化临时日志**，每条标注假设编号：

```
命名规则：[DEBUG H{N}] — N 是假设编号
  console.log('[DEBUG H1] feedItems length:', items.length)
  logger.info(f'[DEBUG H2] query params: {params}')
```

复现后查日志，按 `[DEBUG HN]` 过滤验证。

### 4.4 三振出局

3 个假设都失败 → 立即停止。AskUserQuestion：

```
A) 继续调查 — 我有新假设：[描述]
B) 升级处理 — 需要更了解系统的人
C) 埋点等待 — 加日志，下次触发时捕获
D) 放弃本次尝试 — git worktree remove，开新会话用精炼描述重启
   （适用于上下文已嘈杂的情况）
```

两个假设都说得通、证据分不出高下时，先按 `codex-delegate` 的盲解仲裁让 Codex 独立判断一次，再进 4.5。

### 4.5 5 Whys 根因确认 + 方案确认

**假设验证通过后不直接动手。先向用户解释根因 + 方案，确认后才进 P5。**

通过 AskUserQuestion，用 5 Whys 因果链：

```
🔍 根因定位完成（{BUG_ID}）

问题：[用户看到的现象]

5 Whys 因果链：
  1. 为什么 [症状]？→ 因为 [直接原因]
  2. 为什么 [直接原因]？→ 因为 [更深一层]
  3. 为什么 [更深一层]？→ 因为 [根因]
  ✅ 根因：[一句话]

影响范围：[影响哪些功能/页面]

Bug 类型：[选一个]
  数据流断裂 / 前后端不一致 / 状态同步 / 配置漂移
  / 工具链约束 / UI 渲染 / 兄弟路径遗漏 / 进程身份

修复方案：
  A) [用"做什么"描述，不写代码] （推荐）
  B) [备选]

推荐 A，理由 [一句话]。
```

**用户确认才进 P5。**

### 红旗信号

- "先临时修一下" — 没有"临时"。要么修到位，要么升级。
- 还没追踪数据流就提方案 — 在猜。
- 每次修复都暴露新问题 — 错误层级。

---

## P5 worktree 内最小修复 + 原子提交

宿主是 Claude Code 时，修复代码由 Codex 写：调用 `codex-delegate`，任务书带上 P4 确认的根因、TDD 红灯用例和以下范围约束；Claude 验收后按 5.4 提交。宿主是 Codex 时直接写。

### 5.1 修复原则

- **修根因不修症状** — 最小变更，消除实际问题
- **最少文件、最少行数** — 抵制"顺手重构"
- **只修本次范围内的 bug，不加功能**

### 5.2 ⚠️ 修复中的范围控制（默认硬性拒绝 + 同根必须举证）

**修复过程中识别到以下信号 → 立即停下，列为“待确认新发现”，不在本次修复中处理。**

原 bug 尚未 Pass 时，不把这些新问题正式写入 backlog。AI 只在当前报告或会话回复里保留“待确认新发现”摘要，等原 bug 通过 P6/P6.5 后进入 **P7.4 Pass 边界确认**，由用户决定是否写入文档。

| 信号 | 处理 |
|------|------|
| 用户说"顺便加..."、"另外..."、"延伸需求"、"我希望..."、"如果能..." | 列为待确认新需求；原 bug Pass 后询问是否写入 `$DOC_BACKLOG` 的 💡 新需求区，并建议走 /forge-prd 立项 |
| 验收反馈中描述了当前功能不存在的行为 | 同上（大概率是新需求） |
| AI 自己想到"顺手重构"、"加 lint"、"优化下" | **硬性拒绝**：不写入 backlog（backlog 不是 AI 想法垃圾桶），在相关代码加 `// REFACTOR: {想法}` 注释即可，下次动到这个文件时再看 |
| 修复中发现新 bug（明显不共因）| 列为待确认独立 bug；原 bug Pass 后询问是否写入 `$DOC_BACKLOG` 的 🐛 待修区并分配 BF-XX |
| 修复中怀疑发现"同根"的另一个 bug | **必须举证**（下文 5.2.1）否则默认独立 bug |

#### 5.2.1 同根判定的举证要求（硬约束）

AI 不得轻易声称"这个新发现和当前 bug 同根、要一起修"。声称同根必须满足以下**至少一项**并向用户展示证据：

- ✓ **同一文件的同一函数** 被两个症状触发（贴代码位置：文件名:行号）
- ✓ **同一个数据结构/状态字段** 的错误处理引发两个症状（贴字段名 + 引用点）
- ✓ **同一个上游依赖失效**（同一个 API 端点 / 同一个外部库调用）

举证不足 → 默认独立 bug，先列为待确认新发现；原 bug Pass 后询问是否写入 backlog，再走下次会话。

新发现 bug 的默认处理：

```
通过 AskUserQuestion：

🆕 修 {当前 BUG_ID} 时发现新 bug：
   [新 bug 症状]

AI 同根判定：[独立 / 疑似同根（附证据）]
我会先把它列为“待确认新发现”，不写入 backlog，也不夹带到本次修复。
等 {当前 BUG_ID} 通过验收后，我会先告知本次 bug 已完成，再问你是否把这个新问题更新到文档中。

A) 默认：本次修复继续，新 bug 等当前 bug Pass 后再决定是否入档（推荐）
B) 这是共因（AI 举证已给出）→ 并入当前修复（罕见）
C) 我现在就想修 → 必须先完成当前 bug 并进入 P7.4；确认入档后开新会话接力
```

### 5.3 爆炸半径控制

修复涉及 >5 个文件 → AskUserQuestion：

```
本次修复涉及 N 个文件，超出"最小修复"预期。

A) 继续 — 根因确实跨这些文件
B) 拆分 — 先修关键路径，其余开新会话
C) 重新思考 — 可能有更精准的方案
```

### 5.4 原子提交（在 worktree 内）

```bash
# 仍在 $WT_PATH 内
git add <修改的文件>
git commit -m "$(cat <<EOF
fix(${BUG_ID}): <一句话描述>

根因: <根因>
修复: <修复方式>
EOF
)"
```

### 5.5 清理临时代码

删除所有 `[DEBUG H` 标签化日志和断言。

```bash
grep -rn "\[DEBUG H" --include="*.{js,ts,tsx,py,go,rb}" .
# 上述命令应返回空
```

---

## P5.3 更新 Bug 修复验收报告为待 QA 状态

> 🎯 **关键节点**。代码修完 + 独立 TDD 变绿 + 原子提交之后，AI **必须**更新 `docs/bugfix/reviews/{BUG_ID}.md`。没有完整报告，禁止进入 P6。

### 5.3.1 文档存在性

`$REVIEW_DOC` 应该已经在 P2.5 创建。若不存在，说明流程违规，AI 必须回到 P2.5 补建，并在报告中注明“补建原因”。

```bash
REVIEW_DOC="$DOC_REVIEWS/${BUG_ID}.md"
test -f "$REVIEW_DOC" || echo "❌ Bug 修复验收报告缺失，回 P2.5 补建"
```

### 5.3.2 AI 填充的内容

AI 负责更新报告的工程事实和人工验收草案：

| 字段 | 填什么 |
|------|--------|
| BUG_ID | `BF-{MMDD}-{N}` |
| Bug 描述 | 一句话用户视角的现象 |
| 根因 | P4 5 Whys 追到的根因 |
| 修复做了什么 | 关键逻辑改动，不超过两句话 |
| 涉及文件 | 本次 commit 改到的文件列表 |
| 修复时间 | 当前时间 |
| 修复 commit | 短 hash + commit message 首行 |
| TDD / 回归用例 | RED 失败证据 + GREEN 通过证据 |
| 验收入口 | Frontend/Backend URL 草案；最终由 forge-qa 强校验 |
| 人工验收指南 | 用户要检查什么 / 怎么操作 / 预期效果 / QA 参考截图占位 |
| 用户问题闭环断言 | 用户原话 / 最终用户可见结果 / 证明方式 |
| 配置 / 开关 / 数据就绪 | feature flag、config、后端 enabled 状态、测试数据状态 |
| 当前状态 | `fixed-awaiting-qa` |

同时把 `$DOC_BACKLOG` 中该 bug 状态更新为 `fixed-awaiting-qa`。

### 5.3.3 人工验收指南最少条件

- **至少 3 条**验证项
- 其中**至少 1 条边界/异常态**（空数据 / 失败场景 / 错误恢复）
- 每条验证项必须可以**独立验证**（不依赖其他条）
- 操作步骤用 `1. ... → 2. ...` 方式写，明确可执行

### 5.3.4 禁止行为

- ❌ AI 不得填"QA 测试过程与截图证据"节（留给 forge-qa）
- ❌ AI 不得填"你的验收"列或最终结论（留给用户）
- ❌ AI 不得自行勾选最终结论
- ❌ AI 不得省略任何验证项（即使 bug 很小，也要最少 3 条）
- ❌ AI 不得把多个非同根 bug 写进同一份报告

### 5.3.5 完成后向用户报告

```
✅ Bug 修复验收报告已更新为待 QA (BF-0419-2)

📄 文档路径：docs/bugfix/reviews/BF-0419-2.md

我已经填好：根因、修复记录、TDD 红绿证据、{N} 条人工验收指南。
接下来我会调用 forge-qa 跑自动验收（P6），
QA 会把逐步截图、深度断言、前后端环境身份校验写回报告。

现在开始 P6，请稍候。
```

---

