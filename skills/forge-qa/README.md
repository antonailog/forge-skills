# forge-qa

只测不修的验收

## 要解决的问题

让 AI 做验收，常见结果是一组截图加一句「看起来正常」。这个 Skill 改版前就是这样：项目里 5 个 QA 脚本只有 1 个有真正的 pass/fail，其余只截图，有的还用 `.catch(() => {})` 把错误吞掉。加上断言之后，模型写出的仍多是「元素可见」「数量大于 0」，页面渲染出来就算通过。还有一种失误是测错进程：自己扫常见端口，测到的可能是主分支或别的 worktree 起的旧服务。

## 运行方式

![forge-qa 结构图](../../docs/diagrams/forge-qa.jpg)

默认走 Mode A：先把 PRD、设计文档、diff 和历史反馈转成 test-spec，验收计划用户确认后才开跑；10 个维度分 4 个 Phase 按测试级别执行，Phase 1 冒烟全挂就停。报告出来后停在 User Gate：accept 交给 forge-ship；reject 时反馈写进 FEEDBACK.md 交 forge-eng 修，修完回来重测，反馈项自动并入下一轮 test-spec。Mode B 只给 forge-bugfix 调用，不生成 test-spec、不做 User Gate，只把单个 bug 的截图、断言和环境身份回填进 BF 报告。

## 关键设计

- **不生成 test-spec 就不执行**：验收项先从 PRD、DESIGN.md、diff 和 FEEDBACK.md 里抽出来，结构化后给用户看；改版前测试脚本靠模型在会话里即兴写，从没解析过 PRD 的验收项
- **「元素可见」只算前置条件，不算验收**：每条用例至少有一个检查文本、数据、状态或 CSS 值的断言，只有存在性断言的用例退回去补；页面渲染出来不等于功能做对了
- **console.error 零容忍**：主流程通过，只要有 `pageerror` 或 `console.error` 也判 FAIL；画面正常不代表没有 JS 错误
- **不猜端口**：只测调用方传入、从项目 `dev:status` 拿到的地址，Mode B 还要核对进程 cwd 属于当前 worktree；扫端口只能知道有服务在跑，不知道是不是这次要测的那个
- **自动化全过也要过 User Gate**：设计意图偏差、功能遗漏这类问题，断言测不出来，只有用户能判断

## 其他

- 不处理：修代码（只测不修，问题交给 forge-eng 或 forge-bugfix）；单元测试归 forge-eng
- 前提：Claude Code 里用 Playwright 跑 `qa-runner.mjs`；在 Codex 里优先用 Browser Use 插件
- 注意：项目最好提供 `npm run dev:status` 或 `scripts/dev-stack.sh status`，浏览器验收的地址从这里取
- 注意：仓库有设计零件库时，Phase 3 会加跑零件库检查和骨架比对，新增越界或误差超过 2px 都算 fail

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
