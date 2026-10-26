# forge-bugfix

一次修一个：先根因，再写代码

## 要解决的问题

跟 AI 说一句「这里有问题」，它常常跳过根因直接改，结果修一个冒一个。让它一个会话包下所有报上来的 bug，修的过程中又会吸进新 bug 和新需求，几个 bug 的上下文互相污染，最后修成一场小型重构。修完由 AI 自己判断「好了」，用户也说不清什么时候算修完。

## 运行方式

![forge-bugfix 结构图](../../docs/diagrams/forge-bugfix.jpg)

P0—P1 每个会话只做一次：巡检并行会话、读 PRD 和 bug 历史、回放教训账本。之后每个 bug 走一轮：用户确认范围后建 BF 报告和独立 worktree，根因和修复方案也要用户确认才动手；forge-qa 自动验收不过就回 P5 重修，连挂 3 次交给用户判断。QA 全过之后，用户在报告里填最终结论，Pass 才合并，Fail 回 P5 只修原 bug。

## 关键设计

修 bug 要同时做到两件事：每次修复的边界清楚，修没修好有据可查。forge-bugfix 给每个 bug 一个编号、一个独立 worktree 和一份验收报告，根因、修复、QA 证据和用户结论都写进这份报告；`SKILL.md` 只放铁律和流程总览，各阶段的操作拆成四本手册，进到哪段读哪本。

- **先查清根因，再写修复代码**：复现之后，在疑似位置加带假设编号的临时日志逐个验证，再连问五层「为什么」，把根因和修复方案讲给用户；三个假设都不成立就停下，重新审视架构。做法在 `references/p3-p5-fix-loop.md`。
- **一次修一个 bug，并行靠登记表协调**：每个 bug 开一个独立 worktree，开工时把会话编号、worktree、任务号和功能域登记进项目里的并行登记表，格式见 `templates/active.md`，会话编号由 `get-session-id.sh` 取；同域任务并进已有会话，异域任务开新窗口并行，合并前先预演一次。
- **新问题等原 bug 通过后再分流**：修复中冒出的新 bug、新需求只记为待确认；原 bug 通过后先告诉用户「本次已完成」，再问要不要按独立 bug、新需求、模糊反馈三类写进任务池（`templates/backlog.md`）。说新问题和当前 bug 同根，要指出同一函数、同一状态字段或同一上游依赖的具体位置。
- **一份报告从领取用到结案**：报告照 `templates/review-checklist.md` 建，分区写明谁来填：AI 写根因、修复和人工验收指南，forge-qa 写截图与断言，用户写最终结论；结案后报告移进归档目录，任务池里的链接跟着改。
- **证据齐了才请用户验收**：forge-qa 回填后，`validate-bugfix-report.py` 检查截图文件是否都在、有没有先失败后通过的测试记录、前后端环境是否一致、用户问题闭环断言是否通过，全部过关才把报告交给用户。

```text
forge-bugfix/
├── SKILL.md                        铁律、P0—P8 流程总览、结案归档
├── references/                     进到哪个阶段读哪本
│   ├── p0-p1-session-setup.md      会话准备：环境探测、读文档、回放教训
│   ├── p2-scoping.md               定范围：捞候选、并行判重、建报告
│   ├── p3-p5-fix-loop.md           修复循环：复现、查根因、最小修复
│   └── p6-p7-acceptance.md         验收：自动 QA、用户验收、分流
├── scripts/
│   ├── get-session-id.sh           取当前会话编号，登记并行用
│   └── validate-bugfix-report.py   交给用户前检查报告证据是否齐全
└── templates/
    ├── active.md                   并行会话登记表和功能域声明
    ├── backlog.md                  任务池：待修、新需求、待澄清
    └── review-checklist.md         单个 bug 的验收报告模板
```

## 其他

- 不处理：新需求（进 backlog，建议走 forge-prd）；同类问题的全库扫描（交 forge-review）
- 前提：git 仓库；P6 用 Skill 工具调 forge-qa；在 Claude Code 里用时，修复代码经 codex-delegate 派给本机 Codex 写，Claude 验收后提交
- 注意：多个窗口同时修 bug，靠 `.forge/active.md` 登记和功能域判重防撞车，合并前先跑 `git merge --no-commit --no-ff` 预演
- 注意：worktree 里要启动应用时，走项目统一的 dev 入口，验收地址必须能追溯到当前 worktree 的进程

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
