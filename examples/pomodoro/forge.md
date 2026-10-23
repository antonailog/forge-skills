# forge

## 输入

第 1 棒结束时的项目仓库（main 分支，工作区干净）：文档入口和索引、需求讨论、`docs/PRD.md`、`docs/PRD-CHANGELOG.md`、`.features/pomodoro-timer/feature-spec.md`、功能登记表、需求设计文档 `docs/modules/番茄钟.md`。还没有设计文档、工程文档和任何页面代码。

## 用户会怎么说

「forge，下一步做什么？」

## 过程

1. **只读检测**：在项目根目录跑 Skill 自带的检测脚本，查文档、功能登记表、git 状态、worktree、本地服务和当前分支。全程只读，不写任何文件。
2. **按决策树判断**：命中「有 PRD + Feature Spec，没有 DESIGN.md，而且项目有前端」这一格。
3. **给出推荐**：Skill 的原样输出如下（检测结果 + 推荐 + 选项）：

   ```text
   当前项目状态：
     forge-demo-pomodoro | main | 有文档入口与索引、PRD 与变更日志、
     Feature 登记表（pomodoro-timer：PRD 已完成，设计/工程/QA 待处理）、
     需求设计文档；没有 DESIGN.md / ENGINEERING.md / QA.md；工作区干净，还没有代码

   产品当前事实和 Feature Spec 就绪，但还没有设计文档。建议：
   A) /forge-dev — 启动开发调度（会自动触发设计）（推荐）
   B) /forge-design — 单独做设计规划
   C) 其他 — 告诉我你想做什么
   ```

4. **选择**：
   - 演示时由 AI 按示范安排确认：选 B「/forge-design 单独做设计规划」。理由是需求方对审美有明确要求（简洁、安静），先把设计单独定下、看过骨架再进开发；开发调度放到下一棒。
5. Skill 到此结束：它只提示「请运行 /forge-design」，自己不干活。

## 产物

本 Skill 不写文件，产物就是上面那段「项目状态 + 推荐下一步」的输出。

最适合截图：终端里 `/forge` 的输出那一屏——上半截是检测脚本列出的「发现 PRD」「发现 Feature 注册表」和登记表那一行，下半截是「还没有设计文档，建议：A) /forge-dev  B) /forge-design」。适合讲「不知道下一步干什么，打一个命令就知道」。

## 问题

- **认不出放在归档目录的思考文档**：检测脚本只在项目根目录和 `docs/` 下找 `brainstorm-*.md`，但 forge-doc-policy 和 forge-brainstorm 把思考文档放进 `docs/archive/raw/discussions/<主题>/`、文件名也不以 `brainstorm-` 开头。这次因为已经有 PRD，判断没受影响；如果项目停在「刚讨论完、还没写 PRD」，`/forge` 会看不到思考文档，误判成「什么都没有」。
- **检测脚本在 zsh 下报错**：通配符没匹配到文件时，zsh 直接打印「no matches found」，输出里多了两行报错，截图不好看。
- **两处推荐顺序不一致**：`/forge` 的决策树把「/forge-dev」排在第一个当推荐；而 forge-prd 写进项目 `CLAUDE.md` 的状态对照表写的是「前端项目用 /forge-design，或 /forge-dev」。用户在两个地方看到的首选不一样。
- **非交互运行时没法弹选项**：Skill 第 3 步要求用选择框问用户，示范是以无界面的子任务跑的，没有这个工具，只能把选项以文字列出、由 AI 代选。
