# `<page>.tokens.json` 字段全表（schemaVersion 1）

这是本 skill 唯一的数据契约：工作台引擎、`build_tokens.py`、`verify_pack.mjs`、`render_design_table.py` 都只认它。引擎不认识任何页面，层级、状态、视口、开关、线框、节点树全部来自这份文件。

## 目录

- [顶层字段](#顶层字段)
- [levels / states / viewports / toggles](#levels--states--viewports--toggles)
- [layout：线框区域](#layout线框区域)
- [effects：非 CSS 变量能表达的决策](#effects非-css-变量能表达的决策)
- [groups / modules / scale / foundation](#groups--modules--scale--foundation)
- [nodes：节点](#nodes节点)
- [decisions / feedback：用户产出](#decisions--feedback用户产出)
- [最小可运行示例](#最小可运行示例)

## 顶层字段

| 字段 | 类型 | 作用 | 谁读 |
|---|---|---|---|
| `schemaVersion` | number | 固定 `1` | build/verify 校验 |
| `version` | string | 页面设计版本（如 `v32.1`），进 localStorage 键与 css 头注释 | 引擎、build |
| `page` | string | 页面 slug，决定 localStorage 键 `wb:<page>:<version>` 与文件名 | 引擎 |
| `title` | string | 面板与 css 头注释里的名字 | 引擎、build |
| `prefix` | string | 页面 token 的 CSS 变量前缀，如 `--ai`；节点 `css` 必须以它开头 | build 校验、scaffold |
| `repoName` | string | 仓库根目录名，用于「保存」选错目录时的提示 | 引擎 |
| `updated` | string | 日期 | 人 |
| `files.json` `files.js` `files.css` | 仓库相对路径 | 「保存」直写的三份文件；build 的输出目标；`css` 是前端 import 的那份 | 引擎、build |
| `mobileBelow` | node id 或 null | 视口宽小于该节点值时给 `#frame` 加 `.mob`（单栏） | 引擎 |
| `elementIds` | `{编号: 说明}` | 指南 tab 的编号表；反馈行首编号的解析依据；键可写范围如 `"C1…Cn"` | 引擎、verify |
| `exported` | ISO 时间 | 引擎保存时写入；Agent 记账用，引擎不读 | 人 |
| `baseline` | object | Agent 记账（哪次导出成为基线、改了几处）；引擎不读 | 人 |

## levels / states / viewports / toggles

```json
"levels": [
  {"key": "wire", "label": "线框"},
  {"key": "site", "label": "整站"},
  {"key": "page", "label": "AI 搜索页", "states": true},
  {"key": "module", "label": "模块放大", "w": 1180, "h": 760}
],
"states": [{"key": "idle", "label": "空态"}, {"key": "done", "label": "完成"}],
"viewports": [
  {"key": "follow", "label": "跟随窗口"},
  {"key": "1440x900", "label": "1440×900", "w": 1440, "h": 900},
  {"key": "390x844", "label": "390 手机", "w": 390, "h": 844}
],
"toggles": [{"key": "vec", "label": "向量失败", "cls": "vecfail"}]
```

- `levels[].states: true` 标出唯一带状态的层；引擎启动落在这一层，状态默认取 `done`（没有则第一个）。
- `levels[].w/h` 固定画布（模块放大层用），其他层跟随视口。
- 页面 HTML 里每层一个 `<div class="lvl <key>">`；`wire` 层可以不写，有 `layout` 时引擎自动补。
- `viewports[0]` 必须是 `follow`：跟随浏览器窗口 1:1，面板停靠后自动扣掉面板宽——这就是响应式压力测试。
- `toggles` 是与状态正交的开关，按下给 `#frame` 加 `cls`。

## layout：线框区域

```json
"layout": [
  {"id": "tb", "el": "T", "label": "TopBar", "style": {"left": "0", "right": "0", "top": "0", "height": "var(--ai-topbar-h)"}, "note": "站点共用，不改"},
  {"id": "left", "el": "L", "label": "左区", "style": {"left": "0", "top": "var(--ai-topbar-h)", "bottom": "0", "right": "calc(var(--ai-col-w) + var(--ai-col-gap) + var(--ai-col-margin))"}},
  {"id": "doc", "el": null, "parent": "left", "label": "正文容器", "style": {"maxWidth": "var(--ai-doc-max)", "margin": "0 auto", "height": "100%"}},
  {"id": "pane", "el": "P", "parent": "doc", "label": "正文（独立滚动）", "style": {"flex": "1"}, "scroll": true}
]
```

- `style` 是 JS 风格属性名（`maxWidth`），值可引用 token 变量，改 token 线框实时变。
- `parent` 嵌套；顶层区域默认 `position:absolute`（引擎 css 给），子区域按 style 排。
- `el` 指向骨架里对应元素的 `data-id`；省略则取 `id` 大写；显式 `null` 表示纯布局容器、没有对应元素（verify 不查）。

## effects：非 CSS 变量能表达的决策

```json
"effects": [
  {"node": "sp.card-thumb", "eq": 0, "cls": "nothumb"},
  {"node": "s.scrollbar", "eq": "thin", "cls": "sb"},
  {"node": "m.glow-when", "neq": "idle", "cls": "glowalways"}
]
```

节点值满足 `eq` / `neq`（没写就是真值判断）时给 `#frame` 加 `cls`。页面 CSS 用 `#frame.nothumb .card .th{display:none}` 之类响应。「缩略图为 0 时隐藏」「滚动条显示与否」「入口位置」这类决策都走这里，不要写进 hooks 的 JS。

## groups / modules / scale / foundation

```json
"groups": [{"key": "structure", "label": "1 结构", "ask": "放对地方了吗、比例对吗", "how": "先看区域划分和尺寸，再看谁滚动、断点在哪。"}],
"modules": [{"key": "col", "label": "引用列"}, {"key": "card", "label": "紧凑卡"}],
"scale": {"px": [10, 11, 12, 13, 14, 16, 18, 20], "space": [0, 4, 8, 12, 16, 20, 24, 32], "weight": [400, 500, 600, 700], "lh": [1.4, 1.5, 1.6], "radius": [4, 6, 8]},
"foundation": {"light": {"background": "#F4F3EF", "brand": "#C65A1E"}, "dark": {"background": "#181611", "brand": "#F0A273"}}
```

- `groups` 固定七层，key 依次 `structure hierarchy type color space motion consistency`（见 seven-layers.md）；`ask` 是这一层的问题，`how` 是走法，都显示在面板。
- `modules` 是「按模块」tab 的分组；每个节点必须属于一个模块。
- `scale` 来自 `adapt_tokens.py` 的实际用量统计；节点值不在对应阶梯上时面板标红（`options` 里列出的值不算）。
- `foundation` 是站点级色板（名 → 色值，不带 `--`）；colorref 节点的色块从这里取色，暗色模式切 `dark`。

## nodes：节点

```json
{"id": "s.col-w", "g": "structure", "mod": "col", "label": "引用列宽", "type": "px", "value": 316,
 "css": "--ai-col-w", "options": [280, 300, 316, 340], "maps": [".col"],
 "q": "J2 1109 窗口下正文 737，与现在相同；扩大只在更宽窗口出现。接受，还是压窄引用列换正文宽度？",
 "note": "", "view": {"level": "page", "state": "done"}}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | `<层前缀>.<名>`，层前缀约定：s 结构、h 层级、t 排版、c 色彩、sp 间距形状、m 状态动效、k 一致性；全小写，反馈行首靠它定位 |
| `g` | 是 | 所属层 key |
| `mod` | 是 | 所属模块 key。检查模式点元素时只选「离点击最近的 token 所在模块」的节点，所以容器 token 和内容 token 要分属不同模块 |
| `label` | 是 | 面板显示名，说人话 |
| `type` | 是 | `px` `ms` `num` `enum` `colorref` `color` `family` `check` `raw` |
| `value` | 是 | 当前值；`check` 型为 null（层级层的三问只要结局不要值） |
| `css` | 可改节点必填 | 生成到 css 的变量名，以 `prefix-` 开头；`check` 型没有 |
| `options` | 建议 | 备选值，全部取阶梯上的值；enum 必填。A/B/C 提案就是往这里加 |
| `maps` | 可改节点必填 | CSS 选择器数组，相对当前层的根；面板悬停高亮、点节点名闪、检查模式反查都靠它 |
| `q` | 建议 | 判断题，J 编号开头，带实测数字，能二选一就二选一 |
| `note` | 否 | 说明或用户备注 |
| `readonly` | 否 | 站点级只读；面板显示 🔒，结局只有「提议改动 / 通过」 |
| `foundation` | 否 | 标记它是站点基础 token 的镜像（与 readonly 同用） |
| `view` | 否 | `{level, state, toggle}`：点节点名时先切到这个视图再闪；没写时引擎按 maps 自动找可见的层/状态（优先 `done`） |

类型与 css 值：`px` → `12px`；`ms` → `300ms`；`num` → `1.4`；`colorref` → `var(--brand)`（值为 `transparent` 时原样）；`color` → 色值；`raw` → 原样输出（派生算式，如 `calc(var(--ai-card-src-size) * 1.5 + 4px)`，面板只读显示）；`enum` `family` `check` 不生成 css，靠 `effects` 或页面 CSS 响应。

## decisions / feedback：用户产出

```json
"decisions": {"s.col-w": {"r": "pass", "note": ""}, "s.bp": {"r": "unsure"}, "c.f.brand": {"r": "propose", "note": "略暗"}},
"feedback": [{"t": "C12 太挤", "ref": "C12", "kind": "el", "at": "2026-09-20T11:43"}, {"t": "s.doc-max 960 还是宽了", "ref": "s.doc-max", "kind": "node", "at": "..."}]
```

- `r` ∈ `pass` 通过 / `change` 改（改过值自动记） / `unsure` 拿不准（Agent 出 A/B/C） / `propose` 提议改动（只对 readonly，导出单列）。
- 反馈一行一条，行首是元素编号或节点 id 时引擎解析出 `ref`/`kind`，点它能跳；不写编号也收。
- 这两个字段是用户的决策记录，Agent 只读；要反对就改 `options` 和 `q`，不改这里。

## 最小可运行示例

```json
{
 "schemaVersion": 1, "version": "v0.1", "page": "demo", "title": "Demo · 设计工作台", "prefix": "--demo", "repoName": "my-repo",
 "files": {"json": "docs/assets/visuals/demo/demo.tokens.json", "js": "docs/assets/visuals/demo/demo.tokens.js", "css": "src/styles/demo.tokens.css"},
 "levels": [{"key": "wire", "label": "线框"}, {"key": "page", "label": "页面", "states": true}],
 "states": [{"key": "default", "label": "默认"}],
 "viewports": [{"key": "follow", "label": "跟随窗口"}, {"key": "1440x900", "label": "1440×900", "w": 1440, "h": 900}],
 "toggles": [], "effects": [], "mobileBelow": null, "elementIds": {"H": "标题区"},
 "layout": [{"id": "h", "el": "H", "label": "标题区", "style": {"left": "0", "right": "0", "top": "0", "height": "var(--demo-head-h)"}}],
 "groups": [{"key": "structure", "label": "1 结构", "ask": "放对地方了吗、比例对吗", "how": "先看区域划分和尺寸。"}],
 "modules": [{"key": "head", "label": "标题区"}],
 "scale": {"px": [12, 14, 16], "space": [8, 16, 24], "weight": [400, 600], "lh": [1.5], "radius": [4, 8]},
 "foundation": {"light": {"background": "#fff", "foreground": "#111"}, "dark": {"background": "#111", "foreground": "#eee"}},
 "nodes": [{"id": "s.head-h", "g": "structure", "mod": "head", "label": "标题区高", "type": "px", "value": 64, "css": "--demo-head-h", "options": [56, 64, 72], "maps": [".head"], "q": "J1 64 够不够放两行？"}],
 "decisions": {}, "feedback": []
}
```
