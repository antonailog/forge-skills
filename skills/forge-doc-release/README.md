# forge-doc-release

发布后同步 README、CHANGELOG

## 要解决的问题

代码改完、PR 建好，README 的功能列表、CLAUDE.md 里的命令和目录树、CONTRIBUTING 的上手步骤往往还停在上一版。人工逐份对一遍容易漏；全交给 AI 改，又有改掉项目定位、重写 CHANGELOG 的风险。这个 Skill 在两者之间划线：哪些直接改，哪些必须问。

## 运行方式

![forge-doc-release 结构图](../../docs/diagrams/forge-doc-release.jpg)

在 forge-ship 之后、PR 合并之前跑。先把 diff 里的变更分成新功能、行为变更、移除、基础设施四类，再逐份文档对照；从 diff 能确定的事实直接改，每处附一行摘要，叙事、安全、删除、大改、新增 TODO 和 VERSION 才停下来问。没有文档要改就报「都是最新的」，不提交。

## 关键设计

发布后的文档同步要同时做到两件事：文档里的事实跟上这次发布，涉及项目定位、条目含义和版本号的改动都经用户点头。forge-doc-release 以 diff 为依据，把每处改动分成直接改和问用户两类；`SKILL.md` 放这条界线和九步总览，每一步的命令、清单和决策树放进一份执行手册，执行到哪步读哪步。

- **diff 能确定的直接改，判断交给用户**：`SKILL.md` 的角色定义列出三张清单：哪些情况停下来问、哪些情况照改不停、哪些事一律不做；审计时每处改动按这三张清单归类，问用户时附建议和跳过选项。
- **审计清单按文档类型写，任何仓库都能套**：`release-details.md` 给 README、ARCHITECTURE、CONTRIBUTING、CLAUDE.md 各配一组检查问题，其他文档先判断写给谁再对照 diff；CONTRIBUTING 按第一次上手的贡献者把步骤走一遍，标出会失败的命令。
- **CHANGELOG 只润色措辞，条目保留**：条目由 forge-ship 从 diff 和提交历史写成，是事实来源；这里只用 Edit 精确替换措辞，条目看着不对就问用户。润色过一遍「推销测试」：开头写用户现在能做什么，读着像提交信息的条目改写，内部变更归到「贡献者相关」（`release-details.md` 第 5 步）。
- **VERSION 每次都由用户拍板**：没升版本就给 PATCH、MINOR、跳过三个选项；已经升过，也核对当前版本的 CHANGELOG 条目有没有漏掉这个分支的新功能，有遗漏再问。两条路径的决策树在 `release-details.md` 第 8 步。
- **每份文档都能从入口点到**：跨文档检查时，除了核对各份文档之间的功能列表、组件列表和版本号是否一致，还查每份文档能否从 README 或 CLAUDE.md 点到，两个入口都没链接的标出来（`release-details.md` 第 6 步）。

```text
forge-doc-release/
├── SKILL.md                 改与问的界线、九步总览
└── references/
    └── release-details.md   九步执行手册：命令、清单、决策树
```

## 其他

- 不处理：写新的 CHANGELOG 条目（由 forge-ship 写）；`docs/archive/raw/` 下的历史材料不纳入同步
- 前提：在功能分支上运行，在基础分支上会直接中止；更新 PR 描述要用 `gh`，没有 PR 就跳过这一步
- 注意：提交时按文件名暂存，不用 `git add -A`；PR 描述里的「文档」段落重复跑只替换、不追加

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
