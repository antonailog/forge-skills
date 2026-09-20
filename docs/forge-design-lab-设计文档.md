# 《forge-design-lab Skill 设计文档》

> 阶段：S2 设计（已按此落地 S3/S4，落地与评测记录见 `docs/forge-design-lab-评测报告.md`）· 状态：待用户评审（2026-09-20）
> 读者：业务方（产品负责人）确认边界、研发确认 tool、评测同学确认考点
> 档位：完整档
> 来源：info2action「AI 搜索页 v32.1」设计轮的实战沉淀（2026-09-19 ～ 09-20），用户在该轮做过 12 处纠正，全部进本文档

## 0. Skill 化决策（S0 结论）

需要一个独立 skill，而不是：

- **扩展 forge-design**。forge-design 的产物是 DESIGN.md 文字规格，本 skill 的产物是「可点、可改、可存的真比例骨架」和从它导出的 token。塞进去 forge-design 的 SKILL.md 会翻倍，而且「只想开工作台看一眼」也要过它的 L1/L2 门控。
- **只加一个脚本/tool**。引擎脚本只是一半，另一半是七层审查方法论、保存后的交接协议、DESIGN.md 的回写规则。没有流程编排，脚本会被当成一次性玩具。
- **改 prompt**。根因是「比例被写成了文字」，任何措辞都救不了 7fr:3fr 看起来合理、实机一屏只放得下 1.9 张卡的问题。
- **不做**。v32.0 的返工（设计定稿 → 实现 → 实机推翻 → 重设计）就是不做的代价。

满足的资格条件：☑ 会重复使用（每个有 UI 的模块） ☑ 容易被路由错（与 forge-design / forge-design-impl / forge-qa 长得像） ☑ 有脚本能省重复劳动（token 适配、构建、验收） ☑ 需要治理（spec 结构、七层口径要跨会话一致）

## 1. 收料结论（S1）

### 1.1 需求与场景

- **使用者与处境**：产品负责人，在 PRD/Feature Spec 已确认、实现未开始的设计阶段。也包括实现后实机验收发现布局问题、需要回到设计层重定的时刻。
- **现在怎么解决、哪一步最烦**：读 DESIGN.md 的文字规格判断布局。文字里 `7fr:3fr`、`完整 InfoCard` 看起来合理；比例、密度、一屏能放几张要到实现后才暴露。Image 2 生图有观感但比例是画出来的，同样骗人。
- **理想产出**：一个占满窗口、按真实 token 和真实像素渲染的骨架；右侧面板按七层逐节点问「对不对」；看不顺眼当场改值、当场变；点保存直接写进仓库；告诉 Agent「保存好了」即完成交接，实现时看到的和骨架上看到的是同一套值。
- **什么算做对了**（用户 2026-09-20 定）：
  - 机器可判：页面包零 JS 错误；同源检查通过（前端 import 的 tokens.css 与 tokens.json 基线一致）；组件 CSS 无字面像素值（只写 `var(--*)`）；每个可改 token 都有映射元素。
  - 人可判：用户一次坐下来能走完七层并保存，中途回到对话改值的次数为 0。
  - 路由可判：10 条相邻请求不误触。
  - 交付可判（留空待跑）：实现后真实截图与工作台尺寸误差 ≤ 2px。

### 1.2 已有决策与约束

| 类别 | 内容 | 可否推翻 |
|---|---|---|
| 平台与形态 | Claude Code 会话 + 本机 Chrome；页面走 `file://`，无服务器；直写仓库靠 File System Access API（首次授权仓库根目录，浏览器记住） | 否 |
| 上游 | forge-design 第三步（遇页面/组件/布局决策时**必调**）；或用户直接触发；输入是 DESIGN.md 模块号 / feature-spec 的页面 | 否 |
| 下游 | DESIGN.md 模块章节里的「token 表」区块（脚本生成，勿手改）；前端 `<page>.tokens.css`（组件 import）；forge-eng / codex 按 css 实现 | 否 |
| 谁写页面包 | Claude 直接写骨架 HTML 与 tokens.json（设计产物，非产品代码）；前端组件改用 `var()` 仍交 codex | 否（用户 2026-09-20 定） |
| 跨项目 | 第一版即跨项目：先跑「token 来源适配」读目标项目的 globals.css / tailwind 配置 / 实际用量，页面 token 前缀按项目定，不写死 `--ai-` | 否 |
| 站点级 token | 在工作台里只读，可标「提议改动」，导出时单列，另走全站审查 | 否 |
| 合规与安全 | 不含凭证、不含内部 URL；样例数据只放可公开的内容或占位 | 否 |
| 改 forge-design | 先 `cp -r` 快照，再改第三步与 `_shared/visual-decision-layer.md`：布局门禁改为调本 skill，Image 2 退为只判断气质 | 否（用户 2026-09-20 定） |

参考对象（≤5）及**不借鉴什么**：

| 参考 | 借鉴什么 | 明确不借鉴什么 |
|---|---|---|
| forge-design 现行第三步（Image 2 视觉稿门禁） | 「实现前先给用户看一眼」这个门禁位置 | 用静态生图当布局与比例的判断依据 |
| info2action 7 月报纸化重设计的 `2026-07-10-design-mock.html` | 自包含单文件、token 与 globals.css 同值、审阅工具条与产品 UI 分离 | 每个页面手写一套审阅工具条；token 值抄进文件而不是引用同一份 |
| Storybook / Figma Dev Mode | 「元素 ↔ 属性面板」的检查交互 | 需要构建工具或云服务；属性面板不带方法论、不带结局 |
| Chrome DevTools | 点元素看样式、改值即时生效 | 改完就丢，没有保存和交接 |

### 1.3 基建盘点（完整档）

**tool 清单**

| tool | 什么时候调 | 必调/看情况 | 失败时降级到 |
|---|---|---|---|
| Bash（跑 `scripts/*.py`、`open`、`git`） | 适配、构建、验收、打开工作台、提交 | 必调 | 无 |
| Write / Edit | 写 tokens.json、页面包 HTML、DESIGN.md token 区块 | 必调 | 无 |
| Read / Grep / Glob | 读目标项目 CSS/tailwind/组件、读用户保存的 json | 必调 | 无 |
| Playwright（全局 npm 或项目内） | `verify_pack.mjs` 零错误/映射检查、截图 | 看情况 | 缺则只做静态校验（JSON/CSS 解析）+ 人工打开页面 |
| File System Access（浏览器内，非 Agent tool） | 用户点「保存」直写三文件 | 用户侧 | 不支持则下载 tokens.json，Agent 从 `~/Downloads` 取最新 |
| Google Fonts（浏览器内） | 让骨架用与产品同族的字体 | 用户侧 | 徽标显示「回退系统字体」，不假装 |
| codex exec | 不调（页面包由 Claude 直接写） | — | — |

**字段表：`<page>.tokens.json`（本 skill 唯一的数据契约）**

| 字段 | 类型 | 本 skill 怎么用 | 用不上（写原因） |
|---|---|---|---|
| `schemaVersion` `version` `page` `title` `updated` | string | 版本与页面标识；`page` 决定 localStorage 键与文件名 | |
| `files.{json,js,css}` | 相对路径 | 「保存」直写的三份文件；`tokens_build.py` 的输出目标 | |
| `prefix` | string | 页面 token 的 CSS 变量前缀（如 `--ai`），适配步骤定 | |
| `levels[]` `states[]` `viewports[]` `toggles[]` | 数组 | 视图块的层级/状态/视口/开关按钮；`levels[].states=true` 标哪一层有状态；`levels[].w/h` 固定画布 | |
| `mobileBelow` | node id | 视口宽小于该 token 的值时加 `.mob`（单栏） | |
| `effects[]` | `{node,eq,cls}` | 非 CSS 变量能表达的决策（如缩略图为 0 隐藏）→ 声明式加类，引擎不认识页面 | |
| `layout[]` | 区域 `{id,label,parent,style,scroll,note}` | 线框层自动生成；`style` 可引用 token 变量，改 token 线框跟着动 | |
| `groups[]` | `{key,label,ask,how}` | 七层及每层的问题与走法 | |
| `modules[]` | `{key,label}` | 按模块视图的分组 | |
| `scale.{px,space,weight,lh,radius}` | 数组 | 备选下拉与「不在阶梯」标红的依据；由适配步骤从项目实际用量提取 | |
| `foundation.{light,dark}` | 名→色值 | 色板渲染与只读展示；引擎里用于 colorref 的 swatch | |
| `elementIds` | 编号→说明 | 指南 tab 的编号表；反馈行首编号解析 | |
| `nodes[].id/g/mod/label/type/value/css/options/maps/q/note/readonly/foundation/view` | — | 节点本体：`type` ∈ px/ms/num/enum/colorref/color/family/check/raw；`maps` 为元素选择器（双向映射）；`q` 为判断题；`view` 声明所在层级/状态；`raw` 为派生算式原样输出 | |
| `decisions{id:{r,note}}` | map | 结局（pass/change/unsure/propose）与备注；Agent 读它回写 DESIGN.md | |
| `feedback[]` | `{t,ref,kind,at}` | 反馈 tab 的自由文本，Agent 逐条回 | |
| `exported` | ISO 时间 | | ✓ 只是时间戳，引擎不用 |
| `baseline` | object | | ✓ Agent 记账（哪次导出成为基线），引擎不用 |

**失败与降级**（门禁第 6 条）

| 情况 | 处理 |
|---|---|
| 目标项目没有 `:root` CSS 变量，只有 tailwind theme | 适配脚本改读 `tailwind.config.*` 的 colors/fontFamily/spacing；仍无 → 列出候选让用户指认 |
| Playwright 不可用 | 跳过浏览器验收，只做 JSON/CSS 静态校验，让用户人工打开页面并报告控制台 |
| 浏览器不支持 File System Access（Safari/Firefox） | 「保存」自动下载 tokens.json；Agent 从 `~/Downloads` 取最新一份，按 mtime |
| 用户选错授权目录（选到 `docs` 而非仓库根） | 引擎报「选的是 docs，需要仓库根目录（同时有 docs/ 与 frontend-react/）」并清除授权，下次重选 |
| 没有真实样例数据 | 用占位文案并在页面包 meta 里标明「样例为占位」，验收时不拿它判断行长与密度 |
| Google Fonts 不通 | 字体徽标显示回退，比例仍真实，气质判断延后 |
| 用户保存的 json 与仓库基线冲突（多轮并行） | 以用户文件为准覆盖，Agent 在提交信息里列差异 |

## 2. 设计

### 2.1 要解决的问题

一句话：替产品负责人把「读文字规格猜比例」换成「在真尺寸、真 token 的骨架上看、改、存」，并把改好的值无损带进实现。

### 2.2 定位与边界

**定位**：一个占满窗口、按真实 token 与真实像素渲染的设计工作台，加上一套从顶往下的七层审查。像一个把设计稿钉在墙上的美术指导——把「这一屏到底放得下几张、这一行到底多少个字、这个间距到底是 8 还是 12」讲透：先给能点、能改、能存的真比例骨架，再逐层提问，不把一份两百行的文字规格甩回给用户。

**核心立场**：设计阶段用户要的是「看一眼就能判断」，判断完就该直接进实现。所以产出是可交互的骨架加挂在元素上的判断题，每个决策落成一个 token，token 只存在一处，骨架和产品读同一份文件。文档是从决策导出的副产品，不是决策的载体。

**范围**：给定一个 DESIGN.md 模块（或 feature-spec 里的一个页面/组件），产出一个页面包并跑完「适配 → 线框确认 → 骨架 → 审查 → 保存 → 交接」。一次只处理一个模块。

**不处理**：

| 不处理什么 | 交给谁 |
|---|---|
| 写 DESIGN.md 的散文规格、设计评分、AI 模板痕迹检测、Token 体系建设 | forge-design |
| 把设计变成产品代码（组件、样式、测试） | forge-eng（codex）/ forge-design-impl |
| 生成效果图、气质预判 | Image 2（visual-decision-layer） |
| 实现后的验收与截图对比 | forge-qa |
| 站点级 token 的修改（brand 色、字体族、字号阶梯） | 全站设计审查（forge-design L1） |
| 需求本身还没定（要不要这个页面、放什么模块） | forge-brainstorm / forge-prd |

**≥3 个「很像但不该触发」的 query**（门禁第 1 条）：

1. 「把 DESIGN.md 模块 28 的设计评分再审一遍，看有没有 AI 模板痕迹」→ forge-design 的审计，不开工作台。
2. 「按 DESIGN.md 把紧凑卡组件实现出来，用 Tailwind」→ forge-eng / forge-design-impl，写代码。
3. 「给 AI 搜索页出一张手机端效果图，我发给同事看气质」→ Image 2，不是真比例骨架。
4. 「本地起前端，帮我截图对比一下和设计稿差多少」→ forge-qa。
5. 「brand 色 #C65A1E 太暗了，全站换一个」→ 站点级 token，不在本 skill 范围。

### 2.3 触发与意图路由

**触发层素材**（打磨留到 S3）

- 应触发：「开工作台看看模块 28」「讨论一下 AI 搜索页的设计稿」「这个页面右栏太挤了，帮我调一下密度」「把引用列宽改成 340 看看」「我保存好了，按调整后的来」「先出线框我确认一下再写骨架」「forge-design 第三步到了，走 lab」「新页面的 token 树帮我建一下」「上一版工作台里我改的值导出给我」
- near-miss 负例：见 2.2 的 5 条，加「帮我看看这个 PRD 的布局描述合不合理」（forge-prd）、「把工作台里的骨架 HTML 直接当页面上线」（不是产品代码）
- 可能抢活的隔壁 skill：forge-design（设计文档）、forge-design-impl（实现）、forge-qa（截图验收）、forge-brainstorm（要不要做）

**路由层分流**

| 意图强度 | 判断信号 | 应答粒度 |
|---|---|---|
| 强 | 点名了模块/页面/组件 + 动作是看、改、审、存、交接之一 | 全流程或从对应步骤续跑（页面包已存在则不重建） |
| 弱 | 只说「看看设计」「效果对不对」没点名对象 | 列出已有页面包让选；没有则问模块号，不猜 |
| 潜在 | 用户在 forge-design / forge-prd 讨论里出现「比例」「一屏几张」「行长」「挤」这类词 | 反问「要不要开工作台按真实尺寸看」，不自动开 |

### 2.4 输出框架

**固定骨架**（顺序锁死）

1. **适配报告**：目标项目的站点级 token、字号/间距/圆角阶梯、字体来源、页面 token 前缀。一屏内。
2. **线框确认**：页面包只含 `layout` 与模块清单，工作台「线框」层可看；请用户确认区域划分、比例、模块与状态清单。
3. **页面包**：带样式骨架 + tokens.json + 生成的 js/css；验收脚本结果；在浏览器打开。
4. **审查回合**：用户在工作台改、判、存 → Agent 读文件、校验重建、逐条回反馈、对「拿不准」出 A/B/C。可重复。
5. **交接**：DESIGN.md 模块内 token 表区块更新；给 forge-eng 的实现清单（css 文件路径、变量清单、非 token 决策）。

**必出模块**

| 模块 | 入选条件 | 内部结构 | 对应考点 |
|---|---|---|---|
| 适配报告 | 每次新页面包 | 站点 token 表（名→值，只读）、阶梯四组、字体来源与加载方式、前缀 | K1 阶梯来自实际用量而非拍脑袋（脚本：阶梯值 ⊆ 项目用量） |
| 线框确认 | 每次新页面包 | 区域框（名、尺寸引用、谁滚动）、模块清单、状态清单、待确认问题 ≤3 | K2 线框区域与最终骨架的区域一一对应（脚本：layout ids ⊆ 骨架 data-id） |
| 页面包 | 线框确认后 | HTML（骨架片段 + 组件 CSS + hooks）、tokens.json、js、前端 css、meta | K3 零 JS 错误；K4 同源检查通过；K5 组件 CSS 无字面像素值；K6 每个可改 token 有映射元素 |
| 审查回合 | 用户保存后 | 差异表（token、原值、新值）、结局统计、反馈逐条回、拿不准的 A/B/C | K7 用户改值全部体现在重建后的 css；K8 反馈条数 = 回复条数 |
| 交接 | 用户说「按调整后的来」 | DESIGN.md token 区块、实现清单、提交 | K9 token 区块与 json 一致（脚本） |

**触发式模块**（命中才出）

| 模块 | 触发条件 | 命中多个时怎么取舍 |
|---|---|---|
| A/B/C 提案 | 某节点结局为「拿不准」 | 按七层顺序逐个出，每个 ≤3 个选项，可直接改成节点 options |
| 站点级提议清单 | 有节点标「提议改动」 | 汇总为一份清单，注明另走全站审查，不在本轮改 |
| 响应式压力提示 | 面板停靠后正文宽度低于阶梯最小舒适行长 | 只报一次 |

模块总数 8 个（5 必出 + 3 触发式），不合并。

### 2.5 执行流程

| 步 | 做什么 | 调什么 tool | 输入 | 输出 | 失败怎么办 |
|---|---|---|---|---|---|
| 1 适配 | 跑 `adapt_tokens.py <repo>`：找 globals.css / tailwind 配置，提取 `:root` 语义色、字体角色、字号/间距/圆角/行高的实际用量阶梯；定前缀 | Bash | 项目路径 | `adapt.json` + 适配报告 | 无 CSS 变量 → 读 tailwind theme；仍无 → 列候选让用户指认 |
| 2 线框 | 写 tokens.json 的 `layout`、`modules`、`states`、结构组节点；生成 js；页面包用引擎线框层渲染 | Write, Bash(`build_tokens.py`), `open` | 模块的 Spec/DESIGN 章节 | 线框可看，≤3 个确认问题 | 用户不确认 → 改 layout 重画，不写骨架 |
| 3 骨架 | 写 HTML 页面包（骨架片段、组件 CSS 只写 var()、样例数据、hooks）；补全七层节点；跑 `verify_pack.mjs` | Write, Bash(Playwright) | 确认后的线框 + 样例数据 | 页面包 + 验收报告 | Playwright 缺 → 静态校验；有 JS 错误 → 修到零再交 |
| 4 审查 | 打开工作台；用户改/判/存；Agent 读 json（仓库或 Downloads）→ `build_tokens.py` 重建 → git diff → 回反馈 → 对拿不准出 A/B/C | `open`, Read, Bash | 用户保存的 json | 差异表 + 回复 + 可能的节点 options 更新 | 直写失败 → 从 Downloads 取；json 损坏 → 让用户重新保存，不手改 |
| 5 交接 | `render_design_table.py` 生成 DESIGN.md 模块 token 区块；写实现清单；提交 | Write/Edit, Bash(git) | 定稿 json | DESIGN.md 更新 + 清单 + 提交 | DESIGN.md 无该模块 → 只输出清单并提示先走 forge-design |

背景 / 角色 / 场景补充：Agent 在整个流程里是「画骨架的人 + 提问的人 + 记账的人」，不是「拍板的人」。拍板只发生在工作台上，由用户完成；Agent 对每个「拿不准」给选项，不替用户选。

### 2.6 辅助资源

| 资源 | 类型 | 为什么需要 |
|---|---|---|
| `scripts/adapt_tokens.py` | scripts/ | 每个项目都要提取一遍站点 token 与阶梯，纯机械 |
| `scripts/build_tokens.py` | scripts/ | json → js + css，幂等重建，保存后校验 |
| `scripts/scaffold_pack.py` | scripts/ | 从 json 生成页面包 HTML 壳（引擎引用、站点 token 复刻、hooks 模板），避免每次手抄 300 行 |
| `scripts/verify_pack.mjs` | scripts/ | Playwright 验收：零错误、同源、字面值黑名单、映射完整、截图 |
| `scripts/render_design_table.py` | scripts/ | json → DESIGN.md 模块 token 区块（表格 + 生成标记） |
| `assets/workbench/workbench.js` `workbench.css` | assets/ | 引擎母本，复制到项目 `docs/assets/visuals/_workbench/` |
| `assets/page-pack-template.html` | assets/ | 页面包模板（scaffold 用） |
| `references/spec-schema.md` | references/ | tokens.json 全字段、类型、effects/layout/view 写法 |
| `references/seven-layers.md` | references/ | 七层方法论：每层问什么、怎么走、判断题怎么写、A/B/C 怎么出 |
| `references/engine-hooks.md` | references/ | 引擎 API：`WB.init` 钩子、元素编号约定、检查模式命中规则 |
| `references/pitfalls.md` | references/ | 这轮踩过的六个坑与写骨架的硬约束 |
| `references/example-ai-search.md` | references/ | 范例页面包的路径与要点（不复制文件，指向 info2action） |

### 2.7 输入输出定义

**预期输入**：项目路径 + 模块标识（DESIGN.md 模块号 / feature-spec 页面）+ 可选的样例数据来源；或用户保存后的一句「保存好了」。

**≥5 条真实 query 样本**：

1. 「模块 28 AI 搜索页的设计定了，先别写代码，开工作台把两栏比例和紧凑卡密度给我看一下，用昨天那条 seedance 的真实总结当样例」
2. 「forge-design 走到第三步了，按新流程走 lab，先线框」
3. 「我在工作台里把引用列改成 316、顶部留白改 48 保存了（在 download 里），按调整后的来」
4. 「右边那列太挤，卡片看着像广告，你先别改，出 ABC 我选」
5. 「换个项目：/Users/dbwu/xxx/repo 这个仓库用的是 tailwind theme 没有 :root 变量，帮我把首页的 hero 模块建个页面包」
6. 「工作台里我标了三个拿不准，逐个给我选项」
7. 「把这轮定稿的 token 表写进 DESIGN.md 模块 28，然后给 codex 一份实现清单」

**预期输出**：页面包目录（`docs/assets/visuals/<page>/`：json、js、html、meta）+ 前端 `<page>.tokens.css` + 验收报告 + 审查回合的差异表与回复 + DESIGN.md 模块 token 区块 + 实现清单。

### 2.8 上下文分层规划

| 层 | 放什么 | 预估体量 |
|---|---|---|
| description | 做什么、何时用（含同义词与「用户没说工作台但在讨论比例/密度/行长」）、排除项 | ~320 字符 |
| SKILL.md 正文 | 定位边界、意图分流、五步流程（每步输入输出与失败）、输出骨架、红线 3 条、边界与失败 | < 220 行 |
| references/ | spec-schema、seven-layers、engine-hooks、pitfalls、example | 每份在正文点名何时读 |
| scripts/ | adapt / build / scaffold / verify / render_design_table | 代码不进上下文 |
| assets/ | 引擎母本、页面包模板 | 复制进项目 |

## 3. 完备性门禁自查

| # | 检查项 | 通过 |
|---|---|---|
| 1 | 能说出 ≥3 个「很像但不该触发」的 query | ☑ 2.2 列了 5 条 |
| 2 | 能说清不处理什么、该交给谁 | ☑ 2.2 表 6 行 |
| 3 | 每个必出模块都对应一条考点 | ☑ K1–K9 |
| 4 | 每个 tool 字段已确认，标明哪些不用 | ☑ 1.3 字段表，`exported`/`baseline` 标不用 |
| 5 | 有 ≥5 条真实的、带细节的 query 样本 | ☑ 2.7 列了 7 条 |
| 6 | 能说清失败怎么办 | ☑ 1.3 失败与降级表 + 2.5 每步 |

## 4. 待决策项

| # | 问题 | 我的倾向 | 状态 |
|---|---|---|---|
| 1 | DESIGN.md 里 token 区块的位置与格式 | 模块章节末尾插带 `design-lab:tokens:<page>` 标记的表格区块（层/模块/token/CSS 变量/值/备选/结局/说明 + 站点级提议 + 拿不准 + effects），散文手写不动 | 已执行：ai-search 模块 28 章末（101f40ee） |
| 2 | 适配脚本对 tailwind-only 项目的支持深度 | 第一版读 `theme.extend.colors/fontFamily/spacing/fontSize/borderRadius`，其余让用户指认 | 默认执行 |
| 3 | 页面包是否进 git | 进（docs/assets/visuals 下），引擎副本也进；`.forge` 证据不进 | 默认执行 |
| 4 | 交付可判考点（≤2px）何时跑 | 实现轮结束后由 forge-qa 跑，本 skill 评测集先留空 | 待实现轮 |
