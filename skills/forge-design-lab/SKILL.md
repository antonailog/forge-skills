---
name: forge-design-lab
description: 在真实 token、真实像素的 HTML 骨架上做页面与组件的设计决策：生成可点、可改、可存的设计工作台，按七层逐节点审查，保存即导出 token 与 CSS 并回写 DESIGN.md 的 token 表。用户说「开工作台」「看骨架」「讨论 XX 的设计稿」「改 token」「我保存好了，按调整后的来」时用；只要在争论比例、密度、一屏几张、行长、栏宽、留白这类要看见才能判断的问题，哪怕没提工作台也用；forge-design 第三步遇到页面、组件、布局决策时必调。不处理：DESIGN.md 散文与评分（forge-design）、产品代码（forge-eng、forge-design-impl）、效果图气质预判（Image 2）、实现后截图验收（forge-qa）。
---

# forge-design-lab — 在真比例骨架上定设计

交付一个页面包（骨架 HTML + `<page>.tokens.json` + 由它生成的 `.js` 与前端 `.tokens.css`），并跑完一轮闭环：适配 → 线框确认 → 骨架 → 七层审查 → 保存 → 交接。实现时看到的值和用户在骨架上看到的是同一份文件。

## 定位与边界

像一个把设计稿钉在墙上的美术指导：把「这一屏到底放得下几张、这一行到底多少个字、这个间距到底是 8 还是 12」讲透。手段是一个占满窗口、按真实 token 与真实像素渲染的骨架，右侧面板从顶往下七层逐节点提问；用户看不顺眼当场改值、当场变、点保存直写仓库。

核心立场：设计阶段用户要的是「看一眼就能判断」，判断完直接进实现。所以每个决策落成一个 token，token 只存在一处（tokens.json），骨架 `<link>` 的和前端 import 的是同一份生成的 css，组件 CSS 只写 `var()`。DESIGN.md 里的 token 表是从 json 生成的副产品，不是决策的载体。Image 2 生图画出来的比例不可信：v32.0 的「7fr:3fr、完整卡」看文字很合理，实机一屏只放得下 1.9 张，这就是文字掩盖比例的代价。

一次只处理一个模块（DESIGN.md 的一个模块号，或 feature-spec 的一个页面/组件）。

边界之外的交出去：DESIGN.md 散文规格、评分、AI 模板痕迹检测交 forge-design；把设计变成组件代码交 forge-eng / forge-design-impl（codex）；气质与风格方向的效果图交 Image 2（visual-decision-layer）；实现后的截图对比交 forge-qa；站点级 token（brand 色、字体族、字号阶梯）的修改交全站设计审查，本 skill 只读并可标「提议改动」；「要不要这个页面」交 forge-brainstorm / forge-prd。

## 按需读取

| 文件 | 什么时候读 |
|---|---|
| `references/spec-schema.md` | S2 写 tokens.json 之前；S4 读用户保存的 json 遇到不认识的字段时 |
| `references/seven-layers.md` | S3 给节点补判断题之前；S4 对「拿不准」出 A/B/C 之前 |
| `references/engine-hooks.md` | S3 写页面包 HTML（data-id、hooks、状态切换）之前 |
| `references/pitfalls.md` | S3 写组件 CSS 之前；verify 报错、页面空白或列表不渲染时 |
| `references/example-ai-search.md` | 第一次在一个新项目用本 skill，想对照一个完整范例时 |
| `references/system-pack.md` | 建或刷新零件库、读用户在零件库的保存、写选材清单之前 |

## 意图分流

| 意图 | 信号 | 应答 |
|---|---|---|
| 强 | 点名了模块/页面/组件，动作是看、改、审、存、交接之一；或 forge-design 第三步转交 | 走全流程；页面包已存在就从对应步骤续跑，不重建 |
| 弱 | 只说「看看设计」「效果对不对」，没点名对象 | 列出项目里已有的页面包（`docs/assets/visuals/*/`）让选；没有就问模块号，不猜 |
| 潜在 | 在 forge-design / forge-prd 讨论里出现「比例」「一屏几张」「行长」「挤」「留白」 | 反问一句「要不要开工作台按真实尺寸看」，不自动开 |
| 交接 | 「保存好了」「按调整后的来」「在 download 里」 | 直接进 S4：读 json → 重建校验 → 差异表 → 回反馈 |
| 零件库 | 「零件库」「设计 token 总表」「全站颜色/字体/按钮」「统一按钮」「站点 token 改值」 | 走 S0；用户在零件库保存后读回执，「同步进代码」时跑 `apply_system.py` |

## 工具

脚本都在本 skill 的 `scripts/`，用 `python3` / `node` 直接跑；`{lab}` 指本 skill 目录（`~/.claude/skills/forge-design-lab`）。

| 脚本 | 什么时候 | 用法 | 失败降级 |
|---|---|---|---|
| `serve.py` | 每个仓库一次，之后常驻 | `python3 {lab}/scripts/serve.py <repo> [--status\|--stop]` | 端口默认 4577，占用则递增；只绑 127.0.0.1 |
| `adapt_tokens.py` | S1，每个新页面包一次 | `python3 {lab}/scripts/adapt_tokens.py <repo> --page <slug> [--prefix xx] [--init-spec]` | 没有 `:root` 变量就读 tailwind theme；两者都没有则列候选让用户指认 |
| `merge_saved.py` | S4 拿到用户保存/下载的 json 后，先于 build | `python3 {lab}/scripts/merge_saved.py <repo> <保存的 json> [--apply]` | 默认只报告；页面过期时退出码 2，报告里列出用户没见过的节点 |
| `build_tokens.py` | S2/S3 写完 json 后；S4 合并后校验重建 | `python3 {lab}/scripts/build_tokens.py <repo> <tokens.json> [--check]` | 校验不过就修 json，不手改生成的 js/css |
| `scaffold_pack.py` | S2，线框确认后建骨架壳 | `python3 {lab}/scripts/scaffold_pack.py <repo> <tokens.json> [--adapt <adapt.json>] [--sample <json>]` | 同时把引擎母本同步到 `docs/assets/visuals/_workbench/` |
| `verify_pack.mjs` | S3 交付前；S4 每次重建后 | `node {lab}/scripts/verify_pack.mjs <html> --repo <repo> [--shots <dir>] [--strict-literals] [--json <out>]` | 没有 Playwright 就只跑 `build_tokens.py --check`，让用户人工开页面报控制台 |
| `extract_system.py` | S0，建零件库；产品 CSS 或组件改过后刷新 | `python3 {lab}/scripts/extract_system.py <repo> --product-css` | worktree 没有 node_modules 就软链主仓库的；编译失败页面仍能看颜色与阶梯，按钮不按真像素 |
| `apply_system.py` | 用户说零件库的改值「同步进代码」 | `python3 {lab}/scripts/apply_system.py <repo> [--apply]` | 行号对不上就整体中止，先重跑 extract 再来，不做模糊替换 |
| `render_design_table.py` | S5 | `python3 {lab}/scripts/render_design_table.py <repo> <tokens.json> --design docs/DESIGN.md --heading "## 模块 28"` | DESIGN.md 里找不到模块标题就只打印区块，提示先走 forge-design |

**先起服务，再打开页面**。`serve.py` 把仓库根当静态根，页面 URL 形如
`http://127.0.0.1:4577/docs/assets/visuals/<page>/<file>.html`，页面里那些跨目录相对路径原样可用。
这样「保存」就是一次 POST，直写仓库，用户不用选目录、不下载，存完回对话说一声即可。
服务把回执写进 `.forge/design-lab/last-save.json`（改了哪些 token、结局统计、新增反馈、
页面没见过的节点），你直接读它，不用让用户复述。

**服务端保存必须按 id 合并，不能覆盖**——`serve.py` 已经这么做了。工作台页面一加载 spec 就固定在
内存里；用户开着页面时你改了 json，他一存就会抹掉你新增的节点，而且直写成功了他只会看到「已保存」。
合并后服务把「你没见过的节点」回给页面显示，提示刷新。

没有服务时页面仍可用 `file://` 打开，退回 File System Access 选目录 / 下载兜底，但**容易存错仓库**：
主仓库与 worktree 都有 `docs/` 和 `frontend-react/`，引擎的目录校验分不出来（实发过一次）。
Google Fonts 让骨架用与产品同族的字体（不通时面板徽标显示「回退」，比例仍真实）。

## S0 零件库：全站只有一份的设计零件

零件库是站点级的页面包（`docs/assets/visuals/system/`），把项目里已有的颜色、字体与文字角色、阶梯、按钮、版面骨架盘点在一页上，按产品真像素渲染。它解决两件事：现有零件在哪里维护和展示；新设计开工前先从这里挑零件。

**建与刷新**：跑 `extract_system.py --product-css`。它从产品 CSS 和 Tailwind 配置抽颜色变量（亮暗配对、使用次数、出处），把所有 `<button>` 按长相归类，统计阶梯与容器宽度，并用产品自己的 Tailwind 编译一份 `product.css` 供页面渲染。版面骨架是手写的（`layouts` 字段），重跑保留；用户的改值、结论、反馈也保留。

**用户在页面上做三件事**：改值（色值、文字角色的字号行高字重，整页即时生效）；给结论（按钮选「定为标准 / 归并到 / 废弃」，其他零件选「保留 / 归并到 / 废弃」）；写反馈。保存走 `serve.py`，回执在 `.forge/design-lab/last-save.json`。读回执后照 S4 的方式出差异表、逐条回反馈。

**同步进代码**：用户明确说同步时才跑 `apply_system.py --apply`，它把改值写回产品 CSS 并清空待同步记录。这是产品代码改动，走 worktree、过 QA。结论（标准/归并）不自动改代码，而是转成实现清单交 forge-eng。

**选材门禁**：任何新页面包在 S1 之前先写选材清单，格式见 `references/system-pack.md`：这一页复用哪些颜色、文字角色、按钮标准、版面骨架；需要新造哪些页面 token，每个一句理由。理由不能是「差一点」：差 1–2px 或相邻色阶的，先用零件库的值，在骨架上看不顺眼再提。新造的值在 S5 交接时检查：两个以上页面包都在用的，提议升格进零件库。

## S1 适配：先知道这个项目有什么

跑 `adapt_tokens.py`，读它打印的适配报告，再定页面 token 前缀。报告里四组阶梯（字号、间距、圆角、行高与字重）来自项目实际用量而不是拍脑袋，后面所有备选值只从阶梯上取，自定义值在面板里标红。站点级变量原样进 `foundation`，在工作台里只读。

带 `--init-spec` 生成起步 json：七层 groups、scale、foundation 已填，nodes 为空等你写。把一屏适配报告给用户看，不用等确认就进 S2。

## S2 线框：先确认结构，再画皮

在 json 里只写 `layout`（区域：id、label、parent、style、谁滚动）、`modules`、`states` 和结构层节点，跑 `build_tokens.py` 后用 `scaffold_pack.py` 建壳，打开页面切到「线框」层。引擎从 `layout` 自动画出区域框，`style` 里引用 token 变量，改结构 token 线框跟着动。

请用户确认三件事：区域划分与比例、模块清单、状态清单；一次最多 3 个问题。没确认之前不写带样式的骨架。这一步存在的原因是骨架返工最贵，线框返工只是改几行 json。

## S3 骨架：真 token、真像素、可点

在壳里写骨架片段与组件 CSS，遵守三条：组件 CSS 只写 `var(--<prefix>-*)` 与站点 token，字面像素值要么改成 token、要么行尾标 `/* fixed */` 说明为什么固定；每个可点元素给 `data-id` 编号并登进 `elementIds`；每个可改 token 至少有一个 `maps` 选择器，否则用户点不到它、判断题也挂不上。样例数据用真实内容（真实的总结、真实的标题长度），因为行长与密度只有真文字才能判断；没有真数据就用占位并在 meta 里标明，验收时不拿它判断密度。

按 `references/seven-layers.md` 给每层补节点与判断题（J 编号，带实测数字，能二选一就二选一）。写完跑 `verify_pack.mjs`，零 JS 错误、同源一致、映射完整才交给用户；用 `open` 打开页面，同时给两三行开场：先看哪层、哪几个判断题是本轮重点。

## S4 审查回合：读文件，不读截图

用户在工作台改值、给结局、写反馈，点保存，回来说「保存好了」。此时：

1. 起了服务就直接读 `.forge/design-lab/last-save.json`，改动、结局、反馈、过期节点都在里面，跳到第 3 步。没起服务才需要找文件：先看 `git status`，再取 `~/Downloads` 里最新的同名 json。
2. `merge_saved.py` 按 id 合并，别直接覆盖——工作台页面一加载 spec 就固定在内存里，用户在你改过 json 之后没刷新页面就保存的话，导出的是旧结构，缺你新增的节点、effects 与顶层字段。脚本只取用户那份里真正属于他的三样（值、结局、反馈），结构以仓库为准，并报出「用户没见过的节点」。确认报告无误后 `--apply`，再 `build_tokens.py` 重建、`verify_pack.mjs` 验收。
3. 出差异表：token、原值、新值、用户结局；同时报七层覆盖（每层有结局的节点数），某层为 0 就在回复里点名，别默认他走过。反馈 tab 里一行一条，逐条回复，能直接改的改进 json（加 options、改判断题），改不了的说为什么。
4. 「拿不准」的节点出 A/B/C：三档都取阶梯值，每档一句可见后果，直接写进该节点 `options`，用户下轮在工作台上切着看。
5. 用户保存的值是决策，不替他改；要反对就出选项。json 损坏就请他重新保存，不手修。

回合可重复。每回合结束把 json 提交（设计产物进 git，`.forge/` 证据不进）。

## S5 交接：让实现看到同一份值

用户说「按调整后的来」：

1. `render_design_table.py` 把 json 生成 DESIGN.md 模块内的 token 表区块（带生成标记，勿手改），散文部分不动。
2. 写实现清单给 forge-eng / codex：`<page>.tokens.css` 的路径与 import 位置、变量清单、非 token 决策（effects、hooks 里的 decisions）、样例里出现过的边界（长标题、空态）。
3. 站点级「提议改动」单列一份清单，注明另走全站审查，本轮不改。
4. 提交，报告页面包路径。

## 和 forge-design 的接口

forge-design 第三步遇到页面/组件/布局决策时转到本 skill：输入是模块号与 DESIGN/Spec 章节；返回页面包路径、定稿 json 与 DESIGN.md 的 token 区块。forge-design 继续做散文规格与评分；Image 2 只在气质方向不明时另出 1–3 张，不用它判断比例。

## 输出

**固定骨架**（顺序锁死；每步一段，一屏内）：

```
1 适配报告    站点 token 数 / 四组阶梯 / 字体来源 / 前缀                 —— 每个新页面包必出
2 线框确认    区域框 + 模块清单 + 状态清单 + ≤3 个问题                  —— 每个新页面包必出
3 页面包      文件清单 + verify 结果 + 开场（先看哪层、重点判断题）        —— 线框确认后必出
4 审查回合    差异表 / 结局统计 / 反馈逐条回 / 拿不准的 A/B/C            —— 用户保存后必出，可重复
5 交接        DESIGN.md 区块位置 / 实现清单 / 站点级提议 / 提交号          —— 用户说「按调整后的来」后必出
0 零件库      分区计数 / 本轮改值与结论 / 待同步行 / 选材清单             —— 建零件库、零件库保存、新页面包开工时出
```

触发式模块：A/B/C 提案（有「拿不准」才出，按七层顺序，每个 ≤3 选项）；站点级提议清单（有「提议改动」才出）；响应式压力提示（面板停靠后正文宽低于阶梯最小舒适行长时报一次）。

## 红线

1. 用户在工作台保存的值与结局不替他改。要反对就出 A/B/C 让他在骨架上切着看；覆盖他的决策等于把这轮审查作废。
2. 生成的 `.tokens.js` / `.tokens.css` 与 DESIGN.md 里的 token 区块不手改，只改 json 后重建。手改一处就出现两套值，「看到的和实现的不一样」正是本 skill 要消灭的事故。
3. 页面包与样例数据里不放凭证、内部 URL、真人隐私。页面包进 git、可能随文档公开。

## 边界与失败处理

| 情况 | 处理 |
|---|---|
| 项目没有 `:root` 变量，只有 tailwind theme | 适配脚本读 `theme.extend`；仍无则列候选让用户指认站点色与字体角色 |
| Playwright 不可用 | 只做 `build_tokens.py --check` 静态校验，请用户打开页面并报告控制台是否有红字 |
| 浏览器不支持 File System Access | 起 `serve.py` 走服务模式；不得已才用下载兜底，从 `~/Downloads` 取最新一份 |
| 用户把文件存到了另一个 checkout（主仓库 vs worktree） | 用 `merge_saved.py` 从那个路径合并回来，再清掉误写的目录；根治办法是改用服务模式，服务绑定哪个仓库页面上就显示哪个 |
| 用户保存的 json 结构比仓库旧（页面没刷新就保存） | `merge_saved.py` 按 id 合并，值与结局以用户为准、结构以仓库为准；报告里把「他没见过的节点」念给他听，下一轮让他刷新页面再看 |
| Google Fonts 不通 | 面板徽标显示「字体 ✗ 回退」，比例判断照常，气质判断延后 |
| DESIGN.md 里没有该模块 | 只输出实现清单，提示先走 forge-design 建模块章节 |
| 用户在对话里描述问题但说不出维度 | 先用八个维度词（位置、尺寸、间距、字、色、密度、顺序、状态）替他翻译，再对应到元素编号或 token，最后才出选项 |
