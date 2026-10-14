# forge-doc-release

发布后同步 README、CHANGELOG

## 要解决的问题

代码改完、PR 建好，README 的功能列表、CLAUDE.md 里的命令和目录树、CONTRIBUTING 的上手步骤往往还停在上一版。人工逐份对一遍容易漏；全交给 AI 改，又有改掉项目定位、重写 CHANGELOG 的风险。这个 Skill 在两者之间划线：哪些直接改，哪些必须问。

## 运行方式

![forge-doc-release 结构图](../../docs/diagrams/forge-doc-release.jpg)

在 forge-ship 之后、PR 合并之前跑。先把 diff 里的变更分成新功能、行为变更、移除、基础设施四类，再逐份文档对照；从 diff 能确定的事实直接改，每处附一行摘要，叙事、安全、删除、大改和 VERSION 才停下来问。没有文档要改就报「都是最新的」，不提交。

## 关键设计

- **事实直接改，判断才问**：路径、数量、版本号、交叉引用、表格条目从 diff 就能确定，不打断用户；项目定位、设计理由、安全模型、整段删除、超过约 10 行的重写属于风险或主观判断，逐条问
- **CHANGELOG 只润色措辞，不覆盖条目**：条目由 forge-ship 从 diff 和提交历史写成，是事实来源；只用 Edit 精确替换，不用 Write 整体重写，条目看着不对也是问，不默默改
- **CHANGELOG 过一遍「推销测试」**：用户读完会不会想试；开头写用户现在能做什么，读着像 commit 消息的条目改写，内部变更归到「贡献者相关」
- **VERSION 不静默更新**：没升就给 PATCH / MINOR / 跳过三个选项；已经升过，也要核对当前版本的 CHANGELOG 条目有没有漏掉这个分支的新功能
- **每份文档都要能从 README 或 CLAUDE.md 点到**：两个入口都没链接的文档会被标出来，内容准确和能被找到一起查

## 其他

- 不处理：写新的 CHANGELOG 条目（由 forge-ship 写）；`docs/archive/raw/` 下的历史材料不纳入同步
- 前提：在功能分支上运行，在基础分支上会直接中止；更新 PR 描述要用 `gh`，没有 PR 就跳过这一步
- 注意：提交时按文件名暂存，不用 `git add -A`；PR 描述里的「文档」段落重复跑只替换、不追加

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
