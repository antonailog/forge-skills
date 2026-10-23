# Forge 示范：番茄钟网页

用 Forge 的 Skill 把一个番茄钟网页从一句想法做到上线。项目本身在独立仓库 [antonailog/forge-demo-pomodoro](https://github.com/antonailog/forge-demo-pomodoro)（本地 `~/claudecode_workspace/项目/forge-demo-pomodoro`），这里记录每个 Skill 在这次示范里的输入、过程和产物，`shots/` 放配图用的截图。

## 需求方设定（AI 代用户回答时一律按这里）

- **一句想法**：「我想做一个番茄钟网页，专心工作 25 分钟、休息 5 分钟，能看到今天完成了几个。」
- **谁用**：自己和几个同事，上班时开在浏览器标签页里。
- **必须有**：打开就能用、不用注册；能开始、暂停、跳过；到点有提醒（声音和标签页标题变化）；刷新页面不丢当天的完成记录；手机上也能看。
- **不要**：账号、云同步、团队协作、广告、统计图表大屏。
- **技术偏好**：越简单越好，纯前端静态网页，不要后端；以后可能挂到 GitHub Pages，这次不部署。
- **审美**：简洁、安静，不要花哨动效。
- **没说到的**：选对应 Skill 写明的默认值；默认值也没有时，选最简单、最不打扰用户的那个。

## 示范规矩

- **门禁代确认**：Skill 里要用户拍板的地方，由 AI 按上面的设定代答，并在对应 Skill 的记录里写一行「演示时由 AI 按默认确认：……」。
- **对外动作**：可以向 `antonailog/forge-demo-pomodoro` 推分支、发 PR、合并 PR（这是示范的一部分）；不推任何其他仓库，不部署到任何服务器，不发任何平台。
- **花费**：不嵌套调用 `claude -p`；写代码按 Forge 规矩交给本机 Codex（codex-delegate）。
- **说明文字**：面向大众，不写读者理解不了的具体数字，用通用描述。

## 每个 Skill 的记录

每跑完一个 Skill，在本目录写 `<skill 名>.md`，固定几节：

```markdown
# <skill 名>

## 输入
（这一步拿到了什么：一句话 / 上一步的哪个文件，写路径）

## 用户会怎么说
（真实使用时用户说的那句话）

## 过程
（按 Skill 的步骤简述做了什么；门禁处每处一行「演示时由 AI 按默认确认：……」）

## 产物
（文件路径，相对项目仓库根目录；最适合截图展示的是哪个文件、哪一屏）

## 问题
（遇到的问题、Skill 本身的毛病、不适合宣传的地方）
```

## 进度

| 棒次 | Skill | 状态 |
|---|---|---|
| 1 | forge-doc-policy → forge-brainstorm → forge-prd → forge-feature-doc | 完成（10-23，提交 d0858aa—b581819） |
| 2 | forge（总入口）→ forge-design → forge-design-lab | 完成（10-23，提交 42d07a1） |
| 3 | forge-dev 调度 forge-design-impl、forge-eng（含 codex-delegate）、forge-qa | 进行中 |
| 4 | forge-review → forge-ship → forge-doc-release（主线） | 完成（10-23，PR #1 合并 2282272、PR #2 合并 a456b7f） |
| 5 | forge-bugfix（从功能分支拉，和第 4 棒并行）；forge-status（10-23 提前跑，趁第 3 棒 QA 还在跑时巡检并行工作线） | 完成（10-23，forge-status 提前跑完；BF-1023-1 经 PR #3 合并） |
| 6 | forge-fupan ∥ pm-doc-write（4、5 都结束后并行） | 完成（10-23，复盘提交 931cfdf；项目总结在 yikegunshi-skill 的 pm-doc-write/examples/pomodoro-summary） |

10-23 用户要求提速：后续各棒不再做按真实时间等待的测试（改用模拟时钟），能并行的并行。
