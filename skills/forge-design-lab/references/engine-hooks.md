# 引擎接口：页面包 HTML 要写什么

引擎是 `assets/workbench/workbench.js` + `workbench.css`，复制到项目 `docs/assets/visuals/_workbench/`（`scaffold_pack.py` 会做）。页面 HTML 只负责四件事：`<link>` 前端那份 `.tokens.css`、`<script>` 加载 `.tokens.js`、`#frame` 里的骨架片段与组件 CSS、`WB.init({hooks})`。

## 目录

- [页面结构契约](#页面结构契约)
- [引擎给 #frame 的类与属性](#引擎给-frame-的类与属性)
- [WB.init 的 hooks](#wbinit-的-hooks)
- [对外 API](#对外-api)
- [面板行为一览](#面板行为一览)
- [保存与同源检查](#保存与同源检查)

## 页面结构契约

```html
<link rel="stylesheet" href="../_workbench/workbench.css">
<link id="tokcss" rel="stylesheet" href="<相对路径到 files.css>">   <!-- 前端 import 的同一份 -->
<script src="<page>.tokens.js"></script>                             <!-- window.WB_SPEC -->
<style>
/* @lab:site-tokens */  :root{...站点变量复刻...} html.dark{...}
/* @lab:component */    组件 CSS，只写 var(--<prefix>-*) 与站点 token
</style>
<div id="frame">
  <div class="lvl wire"></div>            <!-- 可省，有 layout 时引擎自动补 -->
  <div class="lvl site">...</div>
  <div class="lvl page">...</div>          <!-- 带状态的那层 -->
  <div class="lvl module">...</div>
</div>
<script src="../_workbench/workbench.js"></script>
<script>WB.init({hooks:{...}})</script>
```

- 引擎把 `#frame` 包进 `#wb-stage > #wb-wrap > #wb-scaler`，右侧追加 `#wb-panel`（停靠，固定宽 404，挤压 stage）与收起后的 `#wb-panel-tab`。页面自己不要写任何工具条。
- `#frame` 的宽高由引擎设：跟随窗口时等于 stage 尺寸；预设视口时按 `w/h` 并缩放到适合。骨架里的顶层区域用 `position:absolute` 相对 `#frame` 排。
- 元素编号：`data-id="C12"`；默认编号标签显示在元素上方（`translateY(-100%)`），窄元素或紧贴上边界的加 `data-id-inline` 让编号显示在元素内部。编号要登进 `elementIds`。
- 标注：`<span class="dim" style="left:0;top:-22px">文字</span>` 放在相对定位的父元素里，「标注」开关控制显示；hooks 的 `sizes()` 可以写它们的文字。
- 状态切换靠 CSS：`#frame[data-state=loading] .st.loading{display:block}`；不要用 JS 显隐。
- 手机：`#frame.mob` 下改成单栏、整页滚动；`.mob` 由 `mobileBelow` 节点值与视口宽比较得出。

## 引擎给 #frame 的类与属性

| 类 / 属性 | 来源 | 页面 CSS 怎么用 |
|---|---|---|
| `data-level` | 当前层 key | `#frame[data-level=page] .page{display:block}` |
| `data-state` | 当前状态 key | `#frame[data-state=idle] .idle{display:block}` |
| `.mob` | 视口宽 < mobileBelow 值 | 单栏规则 |
| `.dims` `.ids` `.inspect` | 视图块开关 | 引擎 css 已处理 `.dim` / `[data-id]::before` / 悬停框；页面一般不用管 |
| `toggles[].cls` | 开关按下 | `#frame.vecfail .vec1{display:block}` |
| `effects[].cls` | 节点值满足条件 | `#frame.nothumb .card .th{display:none}` |
| `html.dark` | 暗色开关 | 站点变量的 `html.dark{}` 块生效 |
| 每个可改节点的 `css` | inline style 设在 `#frame` 上 | 组件 CSS 里 `var(--ai-col-w)` 直接读到实时值；未改时由 `.tokens.css` 提供 |

节点闪烁 `.flash`、悬停高亮 `.hl`、检查悬停 `.ins-hover` 由引擎 css 提供。

## WB.init 的 hooks

```js
WB.init({hooks:{
  fonts:['16px "Noto Serif SC"','600 16px "Cormorant Garamond"'],   // document.fonts.check 用；全通过面板显示「字体 ✓」
  afterApply(S,{frame,byId}){ renderCards(S.state) },                 // 每次 apply 后；按状态渲染样例数据（引用序 vs 候选序）
  sizes(S,{frame,byId,W,H,mob}){ return [['视口',W+'×'+H],['一屏≈',per+' 张']] },  // 指南 tab 的尺寸表；也在这里写 .dim 标注文字
  specs({byId,fmt}){ $('#specCard').textContent=`… ${fmt(byId['sp.card-pad'])} …` }, // 模块放大层的规格文字，随 token 实时变
  decisions:[['D1','页面本身不滚动；正文与引用列各自独立滚动。',['L','R','T']]]     // 非 token 决策；点了对应元素闪
}})
```

- `S` 是引擎状态：`level state vp fit dims ids dark inspect panel viewOpen tab mod toggles`。
- `byId[id].value` 是实时值；`fmt(node)` 把值格式化成 `12px` / `--brand` / `1.4`。
- `afterApply` 只做渲染，不改 token；改 token 用 `WB.set` 或面板。渲染要幂等（用 lastState 之类去重），因为 apply 频繁。
- `sizes()` 里的实测值（`clientWidth`、`offsetHeight`）就是判断题里「带实测数字」的来源。

## 对外 API

| API | 用途 |
|---|---|
| `WB.set({level:'page', state:'done', vp:'1440x900', panel:true, tab:'mod', inspect:false})` | 改状态并 apply；整站层的「点此进入」按钮用它 |
| `WB.state` | 只读当前状态 |
| `WB.jumpToEl('C12')` / `WB.jumpToNode('s.col-w')` | 定位元素 / 节点（自动切到可见的层与状态） |
| `WB.spec` `WB.byId` `WB.fmt` | 规格与格式化，verify 脚本也靠它们 |

## 面板行为一览

- tab：按层（七层折叠，每层 ask/how + 节点）、按模块（模块按钮 + 该模块节点按层分组）、反馈（textarea 一行一条 + 列表）、指南（用法、快捷键、同源检查、保存目录、编号表、结局含义、非 token 决策、尺寸表）。
- 视图块（可折叠 T）：层级 / 状态 / 视口（预设 + 自定义宽高 + 适合/1:1）/ 审阅（检查 I、标注 D、编号 N、暗色、toggles）。
- 节点：点名字 → 切到它的视图并闪 maps 元素；悬停 → maps 元素高亮；改值 → 立即生效、左侧蓝条、自动结局「改」；不在阶梯 → 标红；结局按钮 通过/改/拿不准（只读节点：提议改动/通过）；备注框。
- 检查模式：点骨架元素 → 面板切到按模块，选中「离点击最近的 token 所在模块」的节点；距离 = 从点击目标到 maps 命中祖先的层数，同距离优先有 css 的节点。所以容器 token 与内容 token 要分模块。
- 反馈：行首 `C12` / `s.col-w` 解析为可跳转引用；点条目跳转。
- 快捷键：P 面板、T 折叠视图块、I 检查、D 标注、N 编号、Esc 退出检查或收面板。
- 持久化：localStorage `wb:<page>:<version>` 存值、结局、反馈、UI 状态；「重置为基线」清空。

## 保存与同源检查

- 橙色「保存」：`showDirectoryPicker` 首次选仓库根目录（句柄存 IndexedDB，之后不再弹），校验目录里同时有 `files.json` 与 `files.css` 的首级目录，写三文件；选错目录报错并清除句柄；不支持 FSA 或写失败 → 下载 tokens.json。
- 写的 js 是 `// 由 <json 名> 生成，勿手改\nwindow.WB_SPEC=<json>;`，css 是 `:root{ --x: v; /* label */ }` 带头注释；`build_tokens.py` 产出逐字节一致，所以 Agent 侧 `--check` 能判断用户保存的三件是否同源。
- 指南 tab 的「同源检查」：读 `<link id=tokcss>` 里每个变量的计算值与 json 基线比，colorref 比解析后的色值；全一致才显示绿色。
