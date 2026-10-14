# forge-status

并行会话巡检与清理

## 要解决的问题

多个窗口并行修 bug 时，每个会话在 `.forge/active.md` 登记自己占用的 worktree 和功能域，正常收尾由复盘清掉。但会话会崩、人会漏复盘、worktree 会被手动删，登记就成了「僵尸」，新会话据此判重时，会以为那块还有人在修。按「超过 N 小时没动静」来清，又会误杀只是 AI 跑得慢、或人离开几小时还会回来的会话。

## 运行方式

![forge-status 结构图](../../docs/diagrams/forge-status.jpg)

逐条读 active.md 的登记，每条只查两件事：worktree 目录还在不在、分支合没合进 main；目录还在、分支也没合并，才算活跃。用户直接调用时，报告后问一次：全清、逐条看，还是先不清；清记录时同步改 backlog 里对应 bug 的状态。forge-bugfix 开工时调用它，只报数，不改文件。

## 关键设计

- **判僵尸只认两个硬信号**：worktree 目录不存在，说明已被弃用或清理；分支已合并进 main，说明活干完了只是漏清，两者都能直接查证
- **不用时间戳、最近 commit 和进程存活判断**：AI 慢不等于会话死了；Claude Code 会话一结束进程就没了，也不代表工作被放弃
- **dev server 巡检只报告，不参与判定**：服务可能被手动停掉，也可能会话结束后还在跑，进程在不在说明不了任务的死活
- **清 active.md 必须联动 backlog**：已合并的改为 resolved 并归档；worktree 没了、分支也没合并的改回 pending，下次可以重新领，不让 backlog 挂着已经没人的「领取会话」
- **只改记录，不删 worktree 目录或分支**：删除归 forge-bugfix 的 P7 管，这个 Skill 只动文档里的登记

## 其他

- 前提：项目里有 `.forge/active.md`，没有就直接退出，说明还没用过并行流程；目前只有 forge-bugfix 会往里登记
- 注意：「全部清理」只在明确选它时执行，回复含糊就按逐条确认处理
- 注意：dev server 巡检扫的是常见端口，项目自定义端口以项目 CLAUDE.md 或 `dev:status` 为准

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
