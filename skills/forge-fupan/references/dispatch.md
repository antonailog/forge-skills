# 派活：复盘交给执行方写

用户说「复盘」时，正在和他对话的会话是**调度方**：定范围、派活、转启动提问、验收、收尾。写复盘（第 1–7 步）交给一个从零读日志的**执行方**。

这样分工有两个原因。一是省：调度方往往是一个跑了很久的会话，每次请求都带着几十万 token 的上下文，在它里面写一篇复盘，比新开一个执行方贵几倍。二是准：执行方只看日志原文，不会把记忆里的印象当证据。

## 选执行方

| 情况 | 执行方 |
| --- | --- |
| 默认 | **Codex**，经 [codex-delegate](https://github.com/antonailog/skills/tree/main/skills/codex-delegate) 的 `delegate.sh` 派 |
| 用户说「用 Claude 写」；没装 codex-delegate；Codex 不可用（`delegate.sh doctor` 不过、启动卡死两次） | **Claude 子 agent** |
| 宿主本身就是 Codex；或 Codex 和 Claude 子 agent 都派不了 | 不派，当前会话从第 1 步自己写 |
| 你是被派来的执行方（任务书里写着） | 不再往下派，按任务书做 |

## D1 定范围（调度方，不读日志）

- **会话**：复盘当前会话就跑 `find_session.py` 拿日志路径；复盘过去的某次，用 `--grep` / `--list` 找，拿不准就列候选让用户挑
- **截止时间**：复盘当前会话，写用户说「复盘」的时间，用 `TZ=Asia/Shanghai date '+%m-%d %H:%M'` 取（digest.py 按北京时间算，本机时区不一定是北京）；复盘过去的会话不写，交给执行方按第 2 步「复盘范围」判断
- **用户的话**：用户启动时说的重点、想学的东西，原文照抄；说了「直接写」「不用问」就记下，执行方跳过启动提问
- **调度方自己在非交互运行**（如 `claude -p`，没人回复）：按「直接写」派，前台等结果

调度方不跑 digest.py、不读 digest 文件：读了就等于在长会话里把执行方的活又干了一半。

## D2 写任务书

复盘根 `R` 取 `${FUPAN_ROOT:-~/claudecode_workspace/记录/复盘}`。先确认 `R/.forge/` 不会进 git（`git -C "$R" check-ignore -q .forge/x` 不通过，就把 `.forge/` 加进那个仓库的 .gitignore）：作业目录里有 Codex 的完整对话记录，含会话原文。

任务书写到 `R/.forge/jobs/fupan-<会话 id 前 8 位>.prompt.md`，两个执行方用同一份。尖括号处填实值，路径都写绝对路径：

```markdown
# 复盘 <会话 id 前 8 位>

## 背景
用户要复盘一次会话，你是执行方：照 forge-fupan 写这篇复盘。我是调度方，负责把你的启动提问转给用户、最后验收。
- skill：<SKILL_DIR>/SKILL.md。写法规则以 skill 为准；分几段做、范围、收尾以这份任务书为准
- 会话日志：<jsonl 绝对路径>（会话 id <完整 id>）
- 复盘范围：到 <截止时间，北京时间> 为止（之后是要求复盘和复盘本身，不算）｜过去的会话写「按 SKILL.md 第 2 步自己判断」
- 复盘根：<R 的绝对路径>。所有 build.py 命令前都加 `FUPAN_ROOT=<R>`（含 --known-terms、--catalog）；设了 FUPAN_KB 的，再加 `FUPAN_KB=<路径>`
- 用户启动时说的：<原文；没有写「无」>

## 分两段做
1. 做第 1–3 步：日志用上面的路径；digest 写到 /tmp/digest-<id8>.md；定好项目、模块、文件夹名，按 references/startup.md 写启动消息存进 `<文件夹>/_启动消息.md`。然后**停下**，最后一条消息只放启动消息全文。你是被派来的，不算 startup.md 说的「非交互运行」，要停。
2. 我会把用户的回复原文转给你。按 startup.md「用户怎么回」处理，接着做第 4–7 步。
（用户说过「直接写」时：不停，第 3 步按默认写，一口气做完第 1–7 步。）

## 验收标准
1. `FUPAN_ROOT=<R> python3 <SKILL_DIR>/scripts/build.py <文件夹>` 退出码 0。截图失败的提醒不用管，也别删 shot 字段，我这边会重编补图；线上成果打不开也照会话里的网址写 url，别换成本地文件；哪些没打开核对写进最后一条消息，不写进 meta（meta 是给读者看的）
2. 数字、原话、验收结果都能在日志里搜到原文
3. 外部链接每个都用你的网页工具打开过，note 写的意思原文里有
4. 守 SKILL.md 的四条红线

## 范围
- 只写复盘文件夹里的 JSON 和 `_启动消息.md`；build.py 会顺带重建汇总页、把认领的经验和知识编号写进经验库和知识库，正常。输出「经验库、知识库这次没写进去」是沙箱写不了复盘根以外的目录，照常收尾，我验收重编时会写进去
- 不做第 8、9 步，不改 skill、旧复盘、记忆、learnings.jsonl、经验库和知识库里的文件，不 git commit

## 收尾
最后一条消息只写：
- 文件夹路径、build.py 的结果（连同它最后打印的「浏览器地址」那一行）
- 三行：结果、最值得看的一条对标、补了几条盲区；第 3 步是不是按默认写的
- 最多 3 行没把握的地方（换掉的链接、和印象对不上的证据）
```

## D3 派活

Bash 每次调用不保留变量：下面的 `D`、`R`、作业 id 每条命令里都写实值。作业 id 丢了用 `$D list --repo "$R"` 找回。

**Codex**：

```bash
D=~/.claude/skills/codex-delegate/scripts/delegate.sh; R=<复盘根>
$D submit --repo "$R" --prompt-file "$R/.forge/jobs/fupan-<id8>.prompt.md" --label fupan-<id8> [--model <模型> --effort <档位>]   # 打印作业 id
$D status <作业 id> --repo "$R" --wait --timeout 1800    # 放后台，结束会通知
$D result <作业 id> --repo "$R"                          # 最后一条消息 = 启动消息
```

- `status` 的退出码：0 完成；1 失败或取消；3 启动卡死（取消后原样重派一次）；2 到了超时还在跑，再等一轮，别急着 `result`
- 运行中久没动静的判断，照 codex-delegate 的 `references/acceptance.md` 判活表；重派、返工、换人以本文件为准
- 模型和档位：用户定过的（这次对话里说的，或记忆里写的长期设置）用 `--model`、`--effort` 传；没定过就跟 `~/.codex/config.toml`，都不传。`resume` 沿用第一段的设置，不用再传（codex-delegate 2026-11-11 之前的版本续写时会退回 config.toml 的模型）

**Claude 子 agent**：用 Agent 工具（general-purpose），prompt 就是任务书全文，放后台跑；它交回启动消息后，用 SendMessage 把回复发给同一个 agent，让它接着写。

派出去时给用户一句：交给谁了、先写启动提问、大约多久（Codex 实测：第一段约 5 分钟，写完一篇 15–25 分钟）。

## D4 转启动提问

- 执行方交回的启动消息**原样**发给用户，不改写、不删减，等用户回；消息前加一行写明执行方和模型档位，例：「执行方：Codex · gpt-5.6-sol · xhigh」；没传 `--model` 的照 config.toml 写实际值，Claude 子 agent 写「执行方：Claude 子 agent」
- 用户回复后，把下面这段写进 `R/.forge/jobs/fupan-<id8>.reply.md`，原文转给同一个执行方：

```markdown
用户对启动提问的回复（原文）：
<原文>
按 references/startup.md「用户怎么回」处理，接着做第 4–7 步，收尾格式照任务书。
```

- Codex：`$D resume <第一段的作业 id> --repo "$R" --prompt-file "$R/.forge/jobs/fupan-<id8>.reply.md"` 会**打印一个新的作业 id**（原 id 加 `-r1`），之后的 `status --wait`、`result` 都对新 id；再续也从最新的那个续，别对还在跑的作业重复 resume
- Claude 子 agent：SendMessage 发同样的内容

## D5 验收

执行方说做完了不算数，调度方看过才交给用户。只看执行方的最后一条消息和下面几条命令的输出，不读日志、不读整份 JSON：

1. **重编**：`FUPAN_ROOT=<R> python3 <SKILL_DIR>/scripts/build.py <文件夹>`。Codex 的沙箱不联网，截图在这一步补上；报错就是没做完
2. **自查**：照第 8 步截首屏，三节都在、抽屉能打开
3. **原话**：`python3 <SKILL_DIR>/scripts/check_quotes.py <jsonl> <文件夹>`，只列搜不到的。逐条看：引用原话的退回（图片里的批注不算原文，要改成描述）；只是用「」标出一个概念的不算
4. **链接**：从 `3-复盘.json` 的 sources 和知识条目的 reading 里抽 3 个，用 curl 或网页工具打开，看能打开、note 的意思对得上
5. **经验和知识**：只看 `3-复盘.json` 的 `sops`、`sopCandidates` 和 `4-知识.json` 里 kb 为 null 的条目。认领的经验要真是这次做的事（用 `build.py --catalog` 对步骤名），kb 写 null 的条目在 `--catalog` 里确实搜不到；note 里引的原话第 3 步的 check_quotes.py 一起查。重编输出里「工作台：」开头的几行列出这次写进去了什么；打开 `<R>/index.html#s=<编号>` 看认领的那几步，每步那句要是这次的真事。退回后改了认领或编号的，重编时会先撤掉上次写进去的再写，不用手动删。Codex 沙箱里写不进经验库、知识库是正常的，以这一步重编为准

不过就写返工意见发回同一个执行方（Codex 对最新作业 `resume`，子 agent 用 SendMessage）：列出哪处原话搜不到、哪个链接打不开、哪个字段错，每条一个可复现的事实，不写「再仔细一点」。Codex 作业第二段失败（status 退出码 1）也先对它 resume 一次，不重新提交。

同一执行方返工两轮还不过，换另一个执行方接手。接手版任务书在原任务书后面加一节：

```markdown
## 接手
- 第 1–3 步已经做完，跳过；文件夹：<路径>；用户对启动提问的回复（原文）：<原文>
- 要重写：<哪几份 JSON>；问题清单：<返工意见原文>
- 其余 JSON 不动
```

只差一两处的，调度方直接改。

## D6 收尾

做第 9 步：复盘页地址给 D5 重编时 build.py 打印的「浏览器地址」，放进代码块请用户粘进浏览器（不给「打开复盘.html」的相对链接，理由见 SKILL.md 第 9 步）；回复用户的三行直接用执行方收尾消息里的，按默认写的照它说的写一句；再加一句是谁写的、用的模型档位、用了多久（例：「Codex（gpt-5.6-sol · xhigh）写，18 分钟，返工 0 轮」）。
