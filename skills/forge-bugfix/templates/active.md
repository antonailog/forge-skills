<!--
使用说明（给 AI 看）：

这是**项目级**的并行会话心跳文件。复制到项目根 `.forge/active.md`。
单一作用：让多个 Claude Code 会话知道"现在谁在干什么"，避免并行撞车。

写入时机（硬性）：
1. forge-bugfix P2 确认修复范围 + worktree 创建成功之后 → 追加一行
2. forge-prd 立项 + feature 分支创建时 → 追加一行
3. forge-eng 进入 worktree 启动实现时 → 追加或更新对应行（任务 id 绑定）

清除时机（只认硬信号，**不用时间戳**）：
1. 正常结束：forge-fupan 末尾按当前 session id 删掉自己
2. 漏复盘兜底：/forge-status 扫描 →
   - 如果 worktree 目录不存在 → 建议清理
   - 如果分支已 merged 到 main → 建议清理
3. 绝不用"超过 N 小时算僵尸"这种基于时间的清理

**字段极简**（不要擅自扩字段）：
- session: Claude Code session id（通过 skills/forge-bugfix/scripts/get-session-id.sh 获取）
- worktree: worktree 绝对或相对路径
- 任务: BF-{MMDD}-{N} 或 FEAT-{N} 之类的任务编号
- 域: 功能域标签（单域或逗号分隔多域），对应 domains 声明

**不要记 Phase、不要记时间戳、不要记优先级**。active 只是"谁在干啥"，不是任务管理器。
-->

# 进行中会话（Active Sessions）

> 跨 worktree 共享的心跳文件。多会话并行时，AI 启动时必读此表，避免撞车。

## 功能域声明（domains）

> 由项目维护，列出本项目的功能域标签清单。AI 给 bug 打标签时**必须从这里选**，不自创。
> 新增域需要人工编辑这里，不得由 AI 擅自扩充。
>
> 填写规则：
> - 代码块内一行一个标签，`标签名 # 简短说明`
> - 标签是业务域（如登录、播放、识别），不是技术栈（不写 "frontend" / "api"）
> - 初次使用时由你编辑此处，编辑完再进入 forge-bugfix 流程

```
（本项目尚未声明功能域——请按实际业务领域列出后再使用 forge-bugfix）
```

---

## 进行中会话

<!--
每行一条，字段用 " / " 分隔，字段顺序固定：
- session: <sid> / worktree: <相对路径> / 任务: <任务编号> / 域: <单域 或 域1,域2>

写入由 forge-bugfix P3.1.5 / forge-prd 立项 / forge-eng 启动时追加。
清除由 forge-fupan 第 9 步收尾或 /forge-status 负责。
-->

（暂无进行中会话）

---

## 并行路由规则（给 AI 看）

启动新会话时，AI 读完上表后按以下规则推荐：

1. **同域已有活跃会话** → 建议用户"加入那个会话顺序修"，不新开窗口
2. **不同域 / 无活跃会话** → 建议用户"新开窗口并行"
3. **多域任务**（重构型跨多个域）→ 任一域与已有会话冲突即判冲突，让用户决定是否并入
4. **合并前强制预演**：worktree 合并到 main 前必须跑 `git merge --no-commit --no-ff`，冲突就回退让后合的 rebase

## 闭环操作速查

| 动作 | 由谁触发 | 操作 |
|---|---|---|
| 领取任务 | forge-bugfix P2 / forge-prd 立项 / forge-eng 启动 | 追加一行 |
| 正常结束 | forge-fupan 第 9 步收尾 | 按 session id 删自己 |
| 任务合并 | forge-bugfix P7 合并 worktree 之后 | 不立即清（等复盘或 /forge-status） |
| 漏清兜底 | /forge-status 扫描 | 基于 worktree 存在性 + 分支 merge 状态报告待清理 |
