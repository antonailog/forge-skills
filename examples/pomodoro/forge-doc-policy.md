# forge-doc-policy

## 输入

一个刚建好的空仓库 `forge-demo-pomodoro`：只有一个说明项目来历的 `README.md`，还没有任何文档目录。

## 用户会怎么说

「新项目开个头，先把文档目录搭好。」

## 过程

1. 读 Skill 的三份规则：文档该放哪（`doc-paths.md`）、每份文档开头要带的身份信息（`frontmatter-schema.md`）、项目 `CLAUDE.md` 里该引用什么（`claude-md-snippet.md`）。
2. 先用「只预览不写入」的方式跑一遍新项目脚手架 `init-project.sh`，确认它只会新建、不会覆盖已有的 `README.md`。
3. 正式跑脚手架，一次搭好：
   - 文档入口和索引：`docs/README.md`、`docs/INDEX.md`
   - 功能工作区：`.features/` 和功能登记表 `.features/_registry.md`
   - Bug 任务池：`docs/bugfix/backlog.md`（从 forge-bugfix 的模板拷来）
   - 预留目录：`docs/modules/`（以后放给人看的需求设计文档）、`docs/bugfix/reviews/`、`docs/archive/raw/bugfix-reviews/`
   - 项目级 `CLAUDE.md`：告诉之后进来的 AI「这个项目走 Forge，新建文档前先查白名单」
   - `.gitignore`：忽略系统杂文件和工具缓存
4. 核对：所有新建文件都在白名单里，没有需要停下来问用户的路径。

本步没有需要用户拍板的地方：脚手架只新建缺失的文件、已有文件一律不动，全部路径都在白名单内，按 Skill 规则静默写入。

## 产物

（相对项目仓库根目录）

- `CLAUDE.md`
- `.gitignore`
- `docs/README.md`
- `docs/INDEX.md`
- `docs/bugfix/backlog.md`
- `.features/_registry.md`

最适合截图：终端里脚手架的运行输出（一列 `add …`，最后一行「已存在的一律不动」），配上编辑器侧栏里新出现的 `docs/` 目录树。

## 问题

- **空目录进不了 git**：脚手架建的 `docs/modules/`、`docs/bugfix/reviews/`、`docs/archive/raw/bugfix-reviews/` 是空目录，脚本没放占位文件，提交后别人克隆下来看不到这几个目录。宣传时如果展示远端仓库的目录树，会和本地截图对不上。
- **Bug 任务池带着别的项目的示例行**：`docs/bugfix/backlog.md` 原样拷自模板，里面有「登录后头像不刷新」「语音识别按钮可连点」这类示例条目，放在番茄钟项目里显得突兀；而且这份文件没有 Skill 自己要求的开头身份信息（status / type 等）。
- **Skill 文字前后不一致**：`SKILL.md` 说要核对「层 1 白名单」，但 `doc-paths.md` 里没有「层 1」这个分层说法；`frontmatter-schema.md` 列了十一类文档类型，校验规则里却写「不在 10 类枚举」。
- **`docs/README.md` 里的真相源没有链接**：PRD、DESIGN 等几行是纯文字，文件建好以后不会自动变成可点链接，要靠后续 Skill 记得回来改。
