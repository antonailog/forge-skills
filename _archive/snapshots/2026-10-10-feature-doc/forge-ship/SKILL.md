---
name: forge-ship
description: |
  发布上线：PR only（建 PR 即停）或 Full ship（合并 PR + 同步本地基础分支）；测试失败不发布、不 force push，状态汇报严格区分提交/推送/合并/部署。
  触发方式：用户说"ship"、"发布"、"合并上线"、"发 PR"。
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---

> **文档落地路径**：遵循 forge-doc-policy 规范。完整白名单 + frontmatter schema 见
> `~/.claude/skills/forge-doc-policy/doc-paths.md`。
> **当前文档加载顺序**：涉及文档更新时，先读项目 `CLAUDE.md`、`docs/README.md`、
> `docs/INDEX.md` 和相关根级当前真相源；`archive/raw` 只作历史证据。
> 详细规则见 `~/.claude/skills/_shared/current-doc-loading.md`。

# /forge-ship：发布上线

## 核心原则

`ship` 不是“创建 PR 就结束”。它有两个模式：

- **PR only**：提交、推送、创建或更新 PR，然后停止。
- **Full ship**：提交、推送、创建或更新 PR，检查 PR 状态，合并 PR 到远程基础分支，再把本地基础分支 worktree 同步到 `origin/<基础分支>`。

当用户明确说“ship / 发布 / 合并 / 通过 PR / 更新远程和本地 main”时，默认使用 **Full ship**。当用户只说“创建 PR / 提交 PR / 先发 PR”时，使用 **PR only**。

永远区分这些状态：代码已提交、分支已推送、PR 已创建、PR 已合并、远程 main 已更新、本地 main 已同步、ECS 已部署。除非真的执行部署并验证运行态，否则不要说线上已更新。

## 前置脚本

每次先运行：

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "当前分支: $_BRANCH"
git status --short
git remote -v
```

如果当前分支就是基础分支（通常是 `main`），不要直接 ship。先询问用户是要：
- A) 新建功能分支再 ship（推荐）
- B) 只同步本地 main
- C) 停止

> 提问格式与批量策略见 ~/.claude/skills/_shared/interaction-protocol.md。

## 第0步：确定 Ship 模式和基础分支

先根据用户措辞判断模式（PR only / Full ship），不确定时询问。

确定基础分支：

```bash
gh pr view --json baseRefName -q .baseRefName 2>/dev/null                   # 1. 已有 PR 则读 PR base
gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null  # 2. 否则读仓库默认分支；都失败回退 main
```

记录：当前分支、基础分支、ship 模式、当前 HEAD、`origin/<基础分支>` HEAD。

## 第0.5步：生产写面授权门

> 账本"权限.生产操作点名授权清单"复发 5 次后的固化（2026-07-17）。

开工前枚举本轮全部**仓库外写面**。判断标准：动作对象不在本仓库工作区内，就是写面。常见：

- self-PR merge / 删远程分支
- 部署（ssh / scp / 重启服务 / 改服务器 .env）
- 数据库写（迁移、pg_cron、生产数据修改）
- 第三方账号写（X List、飞书、发布平台）

把清单**一次性**列给用户请求点名授权，不要逐次撞权限门。同时给出用户可预置进 `.claude/settings.local.json` 的 allow 规则（如 `Bash(ssh root@HOST *)`、`Bash(./scripts/deploy.sh*)`），并说明：AI 代改 settings 会被反自授权设计拦截，这几条只能用户亲手加。

本轮没有仓库外写面就记录"无写面"跳过。中途被拦时按账本"被拦即换路勿重试"处理，禁止原样重试同一命令。

## 第1步：安全检查

检查当前 worktree：

```bash
git status --short --branch
git fetch origin <基础分支> --quiet
git diff origin/<基础分支> --stat
git log origin/<基础分支>..HEAD --oneline
```

如果有未提交更改，询问：
- A) 将本次相关更改加入暂存区并提交（推荐）
- B) 交互式选择文件
- C) 停下来，让我处理

不要自动加入无关文件。特别注意构建产物和缓存文件（如 tsbuildinfo、`__pycache__`）。

如果是 Full ship，提前定位本地基础分支 worktree（定位命令见 references/merge-and-sync.md 第11步），但此时不要修改它。找不到就记录“未找到”，不要自动创建，除非用户明确要求。

## 第2步：同步基础分支到当前功能分支

```bash
git fetch origin <基础分支> --quiet
git merge origin/<基础分支> --no-edit
```

如果项目约定使用 rebase，需先确认，不要擅自 rebase 已共享分支。

如果有冲突：
1. 列出冲突文件。
2. 解释冲突发生在当前功能分支合并基础分支阶段。
3. 帮助解决冲突。
4. 解决后重新运行关键测试。
5. 冲突未解决前停止 ship。

## 第3步：运行项目验证

不要使用 `npm test || yarn test || ... || echo "未找到测试命令"` 这种链式命令，它会吞掉真实失败。

优先运行项目 CLAUDE.md 或项目验证脚本中已记录的测试命令；没有记录时按项目类型探测（npm test / pytest / go test 等），优先运行与本次改动相关的测试。

如果测试失败：
1. 分析是否与本次改动相关。
2. 相关则修复后重跑。
3. 不相关则列出证据并询问是否继续。
4. 未经确认不要跳过失败测试。

如果没有可用测试，询问：
- A) 为本次改动补基础测试（推荐）
- B) 只做静态检查和人工验证
- C) 停止

## 第4步：发布前 diff 审查

```bash
git diff origin/<基础分支> --stat
git diff origin/<基础分支>
```

检查：
- 是否有调试代码：`console.log`、`debugger`、临时 `print`
- 是否有密钥、token、私有配置
- 是否有 `TODO: 上线前删除`
- 是否误提交构建产物、缓存、tsbuildinfo
- 是否包含无关文件
- 是否修改了数据库、prompt、skill、部署脚本等高风险区域

发现问题先修复或询问，不要带病 push。

## 第5步：更新 CHANGELOG

如果仓库存在 `CHANGELOG.md`，且本次变更值得未来追溯，则更新。CHANGELOG 只记录发布事实和历史账本；不要把它当作 PRD/DESIGN/ENGINEERING 的当前事实源。

```bash
git log origin/<基础分支>..HEAD --oneline --no-merges
```

如果只是纯机械变更，或用户明确不需要文档，允许跳过，但发布总结要写明“CHANGELOG 未更新”。

如果存在 `VERSION` 文件，询问是否升级版本：
- A) patch
- B) minor
- C) major
- D) 不升级

## 第6步：最终提交

```bash
git add <本次相关文件>
git status --short   # 确认无关文件未暂存
git commit -m "<type>: <summary>"
```

如果已经有提交且只有 CHANGELOG/VERSION 变更，可单独提交一条 `chore: update changelog`。提交后记录 commit SHA。

## 第7步：推送当前分支

```bash
git push -u origin <当前分支>
```

如果推送被拒绝，不要直接 `git pull --rebase`。先查看远端差异：

```bash
git fetch origin <当前分支> --quiet
git log --left-right --graph --oneline HEAD...origin/<当前分支>
```

询问：
- A) rebase 到远端分支后再推送（推荐，若只是远端新增提交）
- B) merge 远端分支后再推送
- C) 停止，让我处理

不要 force push，除非用户明确要求且确认影响范围。

## 第8步：创建或更新 PR

先检查是否已有 PR：

```bash
gh pr view --json number,url,state,baseRefName,headRefName 2>/dev/null
```

如果没有 PR，创建：

```bash
gh pr create --title "<PR标题>" --body "<PR描述>" --base <基础分支> --head <当前分支>
```

PR 描述必须包含：
- 变更摘要
- 测试情况
- 注意事项
- 是否需要部署
- 是否有 migration / 数据修正 / prompt 变更

PR 创建后记录 PR URL。

如果模式是 **PR only**，到这里停止，并输出当前状态。

## 第9步：PR 合并前检查

目的：Full ship 合并前确认 PR 状态可合并（OPEN、非 draft、无冲突、checks 通过、review 满足）。

红线：
- `statusCheckRollup` 为空时只能说“无远程 checks”，不能说“CI 已通过”。
- 有 failed check 或冲突时停止；不绕过 review 和保护规则。

执行细节必读 references/merge-and-sync.md。

## 第10步：合并 PR 以更新远程基础分支

目的：按仓库约定的 merge 方式合并 PR，更新远程基础分支并记录新 SHA。

红线：
- 合并失败时停在 PR 合并阶段，不绕过 review、CI、权限或保护规则。
- 不 force push。

执行细节必读 references/merge-and-sync.md。

## 第11步：同步本地基础分支 worktree

目的：把本地基础分支 worktree 快进到 `origin/<基础分支>`。

红线：
- 只从 `origin/<基础分支>` 同步，不要用功能分支直接覆盖本地 main。
- 禁止 `git reset --hard`、`git checkout --`、静默覆盖用户未提交文件；脏工作区或分叉时停止询问。
- worktree 找不到时报告，不自动创建。
- 本地 HEAD 与 `origin/<基础分支>` 一致后，才能说“本地基础分支已同步”。

执行细节必读 references/merge-and-sync.md。

## 第12步：发布完成总结

总结必须拆状态：

```text
+====================================================+
|                  Ship Summary                      |
+====================================================+
| 模式：PR only / Full ship                           |
| 功能分支：<branch>                                  |
| 基础分支：<base>                                    |
| 提交：<commit sha>                                  |
| PR：<url>                                           |
| PR 状态：已创建 / 已合并 / 未合并                    |
| 远程基础分支：<origin/base sha>                      |
| 本地基础分支 worktree：<路径 / 未找到>               |
| 本地基础分支状态：已同步 / 未同步 / 因脏工作区暂停    |
| 测试：通过 / 跳过 / 失败                             |
| CHANGELOG：已更新 / 未更新                           |
| 部署：未执行 / 已执行并验证                          |
+====================================================+
```

如果没有执行 ECS 部署，必须写：

```text
ECS/线上部署未执行。本次 ship 只表示代码进入远程基础分支，并同步了本地基础分支。
```

## 重要规则

- **先 review，后 ship**：`forge-ship` 默认用于 review 后的发布，不替代完整 code review。
- **PR 是远程 main 的入口**：需要进入远程 main 的代码必须通过 PR merge。
