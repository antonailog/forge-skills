# Feature: pomodoro-timer
## 描述：番茄钟网页——专注 25 分钟、休息 5 分钟，到点提醒，显示今天完成了几个
## PRD 版本：v1.0
## 创建时间：2026-10-23T00:08:31-07:00

## Pipeline
| phase | status | skill | started | completed | note |
|-------|--------|-------|---------|-----------|------|
| prd | [✅ 已完成] | forge-prd | 2026-10-23T00:08:31-07:00 | 2026-10-23T00:11:22-07:00 | PRD v1.0 + Feature Spec 已确认（R1–R6） |
| design | [✅ 已完成] | forge-design | 2026-10-23T00:18:45-07:00 | 2026-10-23T00:36:24-07:00 | DESIGN.md v1.0（L1，评分 A−）+ 工作台页面包 docs/assets/visuals/pomodoro/，两轮审查定稿 |
| design-impl | [✅ 已完成] | forge-design-impl | 2026-10-23T00:47:15-07:00 | 2026-10-23T01:03:28-07:00 | 分支 eng/pomodoro-timer-2026-10-23（worktree .worktrees/pomodoro-timer）提交 2d218c9、ad9de43：index.html + style.css；Codex 两份任务各一轮通过；骨架比对 5/5、验收脚本全过；接口写在 style.css 文件头 |
| eng | [✅ 已完成] | forge-eng | 2026-10-23T01:10:46-07:00 | 2026-10-23T01:58:56-07:00 | 完整模式；分支 eng/pomodoro-timer-2026-10-23 提交 bfeba66、1bb6cc7、ed1968a、7843ccb、794ff8e、9aee673（保留分支，未推送）；Codex 三份任务各一轮通过；node --test 22/22；浏览器自验 17/17；交接：APP_URL http://127.0.0.1:4577/index.html（worktree 根目录起 python3 http.server 4577），测试矩阵 ENGINEERING §七 |
| qa | [✅ 已完成] | forge-qa | 2026-10-23T02:12:11-07:00 | 2026-10-23T02:55:28-07:00 | 73/74 PASS, 99.7/100；详尽级别；Feature Spec 检查表 31/32 通过、R3 后台真实到点部分验证（交需求方手动验）；唯一失败 V14=BUG-001（低：切阶段时主按钮底色 120ms 过渡，与 DESIGN §5.1 不一致，设计取舍待拍板）；User Gate 接受；提交 a632321（docs/QA.md、scripts/qa/、docs/qa-screenshots/）；分支已由 forge-dev 推到远端，未合并、未开 PR |

## Engineering Tasks
| task | wave | tdd | files | status | note |
|------|------|-----|-------|--------|------|
| Task-00 工程文档 | 0 | 跳过 | docs/ENGINEERING.md、docs/ENGINEERING-CHANGELOG.md、docs/README.md、docs/INDEX.md | [✅ 已完成] | 提交 bfeba66 |
| Task-01 纯规则与单测 | 1 | 严格 | tests/timer-core.test.js、timer-core.js | [✅ 已完成] | Codex job 20261023-011643-T01 一轮通过；提交 1bb6cc7 |
| Task-02 页面接线 | 2 | 验证驱动 | app.js、index.html | [✅ 已完成] | Codex job 20261023-013051-T02 一轮通过；提交 ed1968a；R1/R2/R4/R5/R6 浏览器自验通过 |
| Task-03 到点提醒 | 3 | 验证驱动 | app.js | [✅ 已完成] | Codex job 20261023-014102-T03 一轮通过；提交 7843ccb；R3 浏览器自验通过，全量回归通过 |
| Task-04 需求设计文档 | 4 | 跳过 | docs/modules/番茄钟.md、docs/assets/visuals/pomodoro/overview/、scripts/design-doc/ | [✅ 已完成] | forge-feature-doc；提交 794ff8e；check.mjs 通过 |

## QA Items
| item | dimension | status | evidence |
|------|-----------|--------|----------|
| S01-S03 冒烟：控制台零错误、零外部请求、file:// 打开 | console/network | [✅ 已完成] | docs/QA.md §二；.gstack/qa-reports/test-results.json |
| F01-F06 R1 计时与控制 | functional | [✅ 已完成] | docs/QA.md §二 1-6 |
| F07-F10 R2 今日完成数（含数据驱动 9 种记录） | functional/data-driven | [✅ 已完成] | docs/QA.md §二 7-10 |
| F11 R3 后台真实到点 | realtime | [⏸️ 暂停] | 前台真实 25 分钟几乎准时；无头无法转后台；每分钟唤醒模型最晚约一分钟；需求方手动验 M1（docs/QA.md §五） |
| F12-F14 R3 标题交替、声音被拦截、无通知权限 | functional | [✅ 已完成] | docs/QA.md §二 12-14 |
| F15 R4 标题格式 | functional | [✅ 已完成] | docs/QA.md §二 15 |
| F16-F21、G01-G02 R5 保存与恢复（含数据驱动 15 种损坏记录） | functional/data-driven | [✅ 已完成] | docs/QA.md §二 16-21、工程补齐口径 |
| F22-F23 R6 手机与窄屏 | responsive | [✅ 已完成] | docs/qa-screenshots/phone-focus-running.png 等 |
| P01-P04 流程完整性 | functional | [✅ 已完成] | docs/QA.md §二 29-32 |
| V01-V13、V15 DESIGN token 实测 | visual | [✅ 已完成] | docs/QA.md §三 |
| V14 切阶段直接换色 | visual | [❌ 失败] | BUG-001（低，待 forge-design 拍板） |
| V16 骨架比对 compare_impl | visual | [✅ 已完成] | 5/5 误差 0 |
| V17 零件库守门 check_system | visual | [⏳ 待处理] | 项目无零件库，按 Skill 跳过 |
| A01-A03 可访问性 | accessibility | [✅ 已完成] | axe 四状态零违规 |
| M2 睡眠唤醒（近似） | realtime | [✅ 已完成] | 挂起渲染进程跨过到点，恢复后立即结算 |
| M3-M5 真机锁屏、试听、Safari/Firefox | manual | [⏸️ 暂停] | 需求方手动验（docs/QA.md §五） |
