# forge-qa

只测不修的验收

## 要解决的问题

让 AI 做验收，常见结果是一组截图加一句「看起来正常」：测试脚本只截图、不给 pass/fail，有的还用 `.catch(() => {})` 把错误吞掉。就算加了断言，模型写出的也多是「元素可见」「数量大于 0」，页面渲染出来就算通过。还有一种失误是测错进程：自己扫常见端口，测到的可能是主分支或别的 worktree 起的旧服务。

## 运行方式

![forge-qa 结构图](../../docs/diagrams/forge-qa.jpg)

默认走 Mode A：先把 PRD、设计文档、diff 和历史反馈转成 test-spec，验收计划用户确认后才开跑；10 个维度分 4 个 Phase 按测试级别执行，Phase 1 冒烟全挂就停。报告出来后停在 User Gate：accept 交给 forge-ship；reject 时反馈写进 FEEDBACK.md 交 forge-eng 修，修完回来重测，反馈项自动并入下一轮 test-spec。Mode B 只给 forge-bugfix 调用，不生成 test-spec、不做 User Gate，只把单个 bug 的截图、断言和环境身份回填进 BF 报告。

## 关键设计

一次验收要同时做到两件事：每条结论都有可复查的证据，测到的确实是这次改动跑起来的服务。forge-qa 分三层：先把需求和设计文档转成结构化的测试规格，再交给 10 个维度的断言引擎执行，最后把失败追到源码和本次 diff；完整验收和单 bug 回归共用这套断言引擎，各有一份执行手册。

- **先写测试规格，再跑测试**：验收项从 Feature Spec 的验收清单、DESIGN.md、diff 和历史反馈里抽出来，写成 test-spec.json，每条用例能追溯到 Feature Spec 里的一个场景。生成前先扫一遍代码，选择器只用确认存在的，按语义角色、data 属性、可见文本这样从稳到脆的顺序挑（`references/mode-a-execution.md`）。
- **每条用例都要检查内容对不对**：元素可见、数量大于 0 只算前置条件，每条用例至少带一个检查文本、属性、CSS 值或页面脚本结果的断言；test-spec 生成后自动扫一遍，只有存在性断言的用例退回补齐。各类场景的浅断言和深断言对照表在 `references/mode-a-execution.md`，10 个维度的代码模板在 `references/test-dimensions.md`。
- **每个测试都给判定和证据**：Playwright 测试脚本都基于 `qa-runner.mjs` 写，它收集每条用例的通过、失败、跳过，自动监听控制台和网络请求，截图自动编号。出现 pageerror 或 console.error 的用例直接判失败，主流程通过也一样。
- **只测这次该测的那个服务**：地址只用调用方传入的，或项目 dev:status 给出的。单 bug 回归还要把前后端的地址、PID、cwd 和分支写进报告，cwd 属于当前 worktree、QA 测的地址和交给用户验收的一致，环境核对才算通过（`references/mode-b-regression.md`）。
- **断言测不到的交给用户判断**：自动化全过也停在用户验收关卡，设计意图偏差、功能遗漏这类问题只有用户能判断。用户提的问题按设计意图、功能缺失、回归、打磨四类记进 FEEDBACK.md，逐轮累积成项目的回归基线（`references/mode-a-execution.md`）。

```text
forge-qa/
├── SKILL.md                   调用契约、铁律、三层结构、流程总览
├── references/                按场景读对应的那份
│   ├── mode-a-execution.md    完整验收：从测试规格到报告的逐步细则
│   ├── mode-b-regression.md   单 bug 回归：环境核对、截图回填
│   ├── test-dimensions.md     10 个测试维度的代码模板
│   └── qa-template.md         QA.md 结构、健康评分格式
└── scripts/
    └── qa-runner.mjs          执行引擎：收结果、监听控制台、截图
```

## 其他

- 不处理：修代码（只测不修，问题交给 forge-eng 或 forge-bugfix）；单元测试归 forge-eng
- 前提：Claude Code 里用 Playwright 跑 `qa-runner.mjs`；在 Codex 里优先用 Browser Use 插件
- 注意：项目最好提供 `npm run dev:status` 或 `scripts/dev-stack.sh status`，浏览器验收的地址从这里取
- 注意：项目有设计页面包时，Phase 3 会加跑零件库检查和骨架与实现的比对，新增越界或误差超过 2px 都算 fail；页面包没配实现比对时报告写「未配置实现比对」，不算通过

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
