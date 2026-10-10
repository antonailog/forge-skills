---
name: forge-bugfix
description: |
  系统性 Bug 修复流水线（P0-P8）：一次修一个，强制根因分析、独立 worktree、TDD、双层验收报告、forge-qa 回归；多会话经 .forge/active.md 防撞车。
  铁律：不做根因分析不写代码；新发现禁止顺手修；没有用户最终结论不合并。
  触发方式：用户说"bugfix"、"反馈个问题"、"修这个 bug"、"这里有问题"、"为什么不对"、"排查一下"、"investigate"、"forge-bugfix"，或报告错误、异常行为、功能失效时。
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - TodoWrite
  - AskUserQuestion
  - WebSearch
  - Skill  # P6 必须用 Skill 工具调用 forge-qa（mode=B）
---

> **文档落地路径**：遵循 forge-doc-policy 规范。完整白名单 + frontmatter schema 见
> `~/.claude/skills/forge-doc-policy/doc-paths.md`。
> **当前文档加载顺序**：先读项目 `CLAUDE.md`、`docs/README.md`、`docs/INDEX.md`、
> `docs/QA.md` / `docs/ENGINEERING.md` 相关当前真相源，再读活跃 BF 报告和 backlog。
> 历史 BF 报告在 `docs/archive/raw/bugfix-reviews/`，只作追溯证据。
> 详细规则见 `~/.claude/skills/_shared/current-doc-loading.md`。

# /forge-bugfix：一次一 bug + Bug 修复验收报告

## 设计哲学

**短会话、单 bug 隔离、结构化证据、可追溯、可丢弃。**

核心机制：

- **Bug 修复验收报告**：每个 bug 从登记/领取开始就创建活跃报告 `docs/bugfix/reviews/BF-XX.md`（`status: draft`）
  - 发现时：记录来源、现象、初始截图/日志、关联 Feature Spec
  - 修复时：记录 worktree、TDD 红绿证据、根因、commit、涉及文件
  - QA 时：forge-qa 回填前后端地址、环境身份校验、逐步截图、深度断言
  - 人工验收时：用户只看"人工验收指南"和同一组验收地址，填最终结论
  - 结案后：移动到 `docs/archive/raw/bugfix-reviews/`（`status: archive`），backlog 保留链接
- **两种验收节奏**：
  - **单 bug 模式**：QA 全过后立即进入 P6.5，等用户验收该 bug
  - **QA 自动闭环 / 批量模式**：单 bug QA 通过后标记 `qa-pass-pending-final-review`，最后由批次汇总统一交给用户验收
- **新发现必须分流**（禁止顺手修）：
  - 原 bug 未 Pass 前：只记录为“待确认新发现”，不进入当前修复
  - 原 bug 已 Pass 后：先明确告知用户“本次 bug 修复已完成”，再询问是否写入文档
  - 用户确认后，独立 bug → `docs/bugfix/backlog.md` 的待修区，分配 BF-XX 编号
  - 用户确认后，新需求 → `docs/bugfix/backlog.md` 的新需求区，建议 /forge-prd 立项
  - 用户确认后，模糊反馈 → `docs/bugfix/backlog.md` 的待澄清区
  - 同根（并入当前修复）→ **AI 必须举证**（同文件/同函数/同数据流的具体证据），举证不通过默认独立 bug
- **Pass 边界接力**：
  - 只要原 bug 已 Pass，不论新问题来自用户验收、QA 发现，还是 AI 在修复中发现的衍生问题，都不得继续修
  - AI 必须先说清楚：原 bug 已收敛、证据是什么、当前修复到此关闭
  - 再问用户：是否把新问题更新到 `docs/bugfix/backlog.md` / 报告中
  - 用户确认后，AI 完成 P7.5 分流，并给一段简短接力 prompt，让用户开另一个会话继续
- **下一个 bug 默认建议新会话或 /clear、/compact**：
  - 上下文干净 + 边界清晰 + 避免长会话的 scope 蔓延
  - 除非用户明确要共因地一起修

> 演进历史和设计决策背景见 `forge-cookbook/docs/forge-bugfix-changelog.md`。

## 铁律

1. **不做根因分析，就不写修复代码。** 直觉再强也要先验证。
2. **每次只修 1 bug，或 1-2 个**经 P4.5 确认共因**的 bug**。其余进 `docs/bugfix/backlog.md`。
3. **每个 bug 独立 worktree + 独立 TDD + 独立 commit + 独立 QA 回归**。批量只做编排，不合并工程单元。
4. **修完不自动合并**，必须等用户填完单 bug 或批次最终验收结论。
5. **没有活跃 Bug 修复验收报告不算完**。每个 BF 编号必须先有 `docs/bugfix/reviews/BF-XX.md`，经 forge-qa 和用户/批次两层验收后才进 P7；P8 结案时归档到 `docs/archive/raw/bugfix-reviews/`。
6. **新发现的 bug / 新需求 / 模糊反馈 → 原 bug Pass 后询问是否写入 `docs/bugfix/backlog.md`**，绝不在当前修复内夹带。
7. **同根判定必须举证**。AI 声称"这条新发现是当前 bug 同根"时，必须列出具体证据（同文件、同函数、同数据流），证据不足默认为独立 bug。
8. **并行协调必须登记**（v6.0）。P2 确认范围 + P3 创建 worktree 之后，必须在项目根 `.forge/active.md` 追加一行会话登记；P2 推荐前必须读 `.forge/active.md` 做功能域判重；P7 合并前必须跑 `git merge --no-commit --no-ff` 预演。清理 active 的责任在 forge-fupan 或 /forge-status，不在 forge-bugfix 自己。
9. **自动闭环有上限**。同一 bug 连续回修失败 3 次，或遇到需求/设计/环境身份不确定，必须标记 `blocked-human` 并让用户判断，禁止无限循环。
10. **生产写面先取授权**（账本复发 5 次后固化，2026-07-17）。P2 范围确认时同步枚举本次修复预计触碰的仓库外写面（DB 写 / 部署 / 第三方账号写 / self-merge；判断标准：动作对象不在本仓库工作区内），一次性列清单向用户取点名授权，需要时请用户亲手在 `.claude/settings.local.json` 预置 allow 规则（AI 代改会被反自授权拦截）；禁止逐次撞权限门后原样重试。

---

## 流程总览

```
═══════════ 会话级（每会话一次，多次修复复用）═══════════
P0  环境探测（前置脚本，自动执行）
P1  问题理解 + 强制读 PRD/ENGINEERING/Bugfix 历史/Memory

═══════════ 每次修复（一次一 bug，可循环）═══════════
P2   范围推荐
     ├─ AI 从 docs/bugfix/backlog.md 捞候选 + 列出本会话新报告的 bug
     ├─ AI 接收 forge-qa 发现的结构化 bug（若来自 QA 自动闭环）
     ├─ 推荐"本次修 X"（1 个 / 或 1-2 共因），其余 → backlog
     └─ 用户确认范围
P2.5 创建/更新 Bug 修复验收报告 docs/bugfix/reviews/BF-XX.md
     ├─ 写入来源、现象、初始证据、Feature Spec 场景、功能域、当前状态
     └─ 同步 backlog.md 的报告链接
P3   创建 worktree（端口预检）+ 复现
P4   根因追踪 + 假设验证 + 5 Whys + 修复方案确认
P5   worktree 内独立 TDD 驱动修复 + 原子提交
P5.3 ⭐ 更新 Bug 修复验收报告为待 QA 状态
     ├─ 写入 TDD 红绿证据、根因、修复摘要、commit、涉及文件
     └─ 写入人工验收指南草案，QA 区域留给 forge-qa
P6   ⭐ 调用 forge-qa 自动验收
     ├─ forge-qa 针对每个验证项跑自动化测试
     ├─ 强校验 Frontend/Backend 地址、PID、cwd、commit 一致性
     ├─ 把每个前端交互关键步骤截图嵌入报告
     ├─ QA 全过 → 单 bug 模式进 P6.5；批量模式标记 qa-pass-pending-final-review
     └─ QA 有挂 → 有界回 P5；达到上限或有疑问则 blocked-human
P6.5 ⭐ 用户人工验收 / 批次最终验收
     ├─ AI 输出"请人工验收 @ docs/bugfix/reviews/BF-XX.md"
     ├─ 用户打开文档填"你的验收"列 + 最终结论（Pass / Fail / Pass + 新发现）
     └─ 用户说"验收了" → AI 读报告 → 判定
P7   ⭐ 按最终结论分流
     ├─ Pass → worktree 合并决策（合并 / 暂存 / 推迟）
     ├─ Fail → 回 P5（只修原 bug，不接新问题）
     └─ Pass + 新发现 → 先完成当前修复的合并/暂存决策 → 进 P7.4
P7.4 ⭐ Pass 边界确认 + 文档更新询问
     ├─ 告知用户：本次 bug 已完成，当前修复到此关闭
     ├─ 列出新问题来源：用户反馈 / QA 发现 / AI 发现的衍生问题
     ├─ 询问是否写入 docs/bugfix/backlog.md / 报告索引
     ├─ 用户确认 → 进 P7.5 分流，并输出简短接力 prompt
     └─ 用户不确认 → 不写 backlog，不继续修新问题，结束本次 bugfix
P7.5 ⭐ 新发现分流到 backlog
     ├─ 逐条分析，AI 做分类判断（同根 / 独立 bug / 新需求 / 模糊反馈）
     ├─ 同根（声称时必须举证）→ 新 bug 建议在新会话修
     ├─ 独立 bug → backlog.md 的 🐛 待修区，分配 BF-XX
     ├─ 新需求 → backlog.md 的 💡 新需求区，建议 /forge-prd 立项
     └─ 模糊反馈 → backlog.md 的 🌀 待澄清区
P8   沉淀：归档 backlog 对应条目 + BF 报告移动到 archive/raw

═══════════ 出口 ═══════════
- 用户想继续修下一个 bug → 默认建议新会话或 /clear、/compact
  （除非明确共因才本会话继续，由用户主动选择）
- 全部完成 → 建议 /forge-review、/forge-ship 或 /forge-fupan
```

**红线**：
1. 写任何修复代码前必须完成 P2-P4（含范围确认和 5 Whys 根因确认）
2. 每个 BF 编号必须先有 Bug 修复验收报告（P2.5），修复后必须更新报告（P5.3）才能进入 QA
3. 报告没有用户最终结论或批次最终结论前，**不进 P7**——即使 QA 全过
4. 同根判定声称必须举证，证据不足默认独立 bug → 原 bug Pass 后问用户是否写入 backlog，再走新会话

---


## 阶段手册（按需加载，进入对应阶段前必读）

本文件只保留哲学、铁律、流程总览和 P8 收尾。**执行各阶段前必须先读对应手册**：

| 阶段 | 必读文件 | 内容 |
|---|---|---|
| P0-P1（会话级准备） | [references/p0-p1-session-setup.md](references/p0-p1-session-setup.md) | 环境探测脚本、active.md 判重、PRD/ENG/历史阅读 |
| P2/P2.5（定范围建报告） | [references/p2-scoping.md](references/p2-scoping.md) | backlog 捞候选、范围确认、BF 报告创建 |
| P3-P5.3（修复循环） | [references/p3-p5-fix-loop.md](references/p3-p5-fix-loop.md) | worktree/复现、根因/5 Whys、TDD 修复、报告更新 |
| P6-P7.5（验收与分流） | [references/p6-p7-acceptance.md](references/p6-p7-acceptance.md) | forge-qa 调用、人工验收、分流、边界确认 |

**规矩**：骨架没写的操作细节一律以对应手册为准；手册与骨架冲突时，以骨架的铁律和红线为准。
Mode B 调用 forge-qa 的参数契约以 `~/.claude/skills/forge-qa/SKILL.md`「调用模式」节为唯一出处，本 skill 不再复制该表。

---

## P8 沉淀与出口

`docs/bugfix/reviews/{BUG_ID}.md` 是处理中的案卷；结案后进入 archive/raw，成为历史证据。P8 只做这些硬动作：

1. 如果 bug 来自 backlog，将待修条目移动到“已处理”区，并把链接改到 `docs/archive/raw/bugfix-reviews/{BUG_ID}.md`；已处理区永久保留。
2. 将活跃 BF 报告从 `docs/bugfix/reviews/{BUG_ID}.md` 移动到 `docs/archive/raw/bugfix-reviews/{BUG_ID}.md`，frontmatter `status` 改为 `archive`，并确认截图链接仍可打开。
3. 批量修复时维护 `docs/bugfix/batches/BATCH-YYYY-MM-DD.md`，用于最终人工验收汇总；每个 bug 的技术证据仍回到各自 BF 报告。
4. Memory 默认不写，除非能说明这条经验下次会触发什么具体行为。
5. 同类模式扫描不在 bugfix 内做，交给 `/forge-review`。
6. 出口默认建议新会话或 `/clear`、`/compact` 后继续下一个 bug；全部完成则建议 `/forge-review`、`/forge-ship`、`/forge-fupan` 或 `/forge-status`。

---

## 补充速查（铁律与红线见上，此处只列正文未覆盖的执行细节）

- 无法复现不修；3 次假设验证失败就停下来质疑架构（与铁律 9 的"回修失败 3 次 blocked-human"是两道不同的闸）。
- P6 的 QA 截图、环境一致性和报告完整性不满足时，不得交给用户验收；用户结论只有 Pass / Fail / Pass + 新发现。
- worktree 创建后如需启动应用，必须走项目统一 dev entrypoint；APP_URL 必须可追溯到正确 cwd/PID/commit。
- 功能域标签从 active.md 声明区选，不自造。
- 新发现只进 `docs/bugfix/backlog.md`，不进 TODO；顺手重构想法只写代码注释。

