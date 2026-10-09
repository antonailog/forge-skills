# 零件库（system 页面包）

站点级只有一份，路径固定 `docs/assets/visuals/system/`。和普通页面包的区别：它不是一个页面的设计稿，而是全站零件的总账；数据主要来自代码抽取，用户只在上面做结论和少量改值。

## 文件

| 文件 | 谁写 | 说明 |
|---|---|---|
| `system.tokens.json` | `extract_system.py` 抽取 + 用户保存 | 唯一数据源，进 git |
| `system.html` | 从 skill `assets/system/` 同步 | 页面壳，勿手改 |
| `product.css` | `extract_system.py --product-css` | 用产品 Tailwind 编译，勿手改；产品样式改过就重跑 |
| `_workbench/system.js` `system.css` | 从 skill 同步 | 页面逻辑与外壳样式 |

## json 字段（`kind: "system"`）

抽取字段，每次重跑覆盖：

- `colors[]`：`id`（作用域变量为 `.admin-scope --a-ok`）、`name`、`scope`、`family`、`light`、`dark`、`line`、`dark_line`、`note`（代码注释）、`uses`（var 引用 + Tailwind 语义类）、`files`、`files_n`
- `tw_colors[]`：Tailwind 配置里写死的色板，`uses` 为类名引用次数
- `hardcoded_colors[]`：TSX 里的 `#hex`，`same_as` 为同值的站点变量
- `other_vars[]`：非颜色变量（阴影、高度、圆角等）
- `fonts[]`：Tailwind 字体角色；`text_roles[]`：全局 CSS 里带字号与字体的类（四元组）
- `scales`：`px space radius lh weight` 各档 `{v, n}`
- `containers[]`（`max-w-[Npx]`）、`grids[]`（`grid-cols-[…]`）
- `buttons`：`total`、`dynamic`、`unstyled[]`、`families[]`；变体 `id` 是长相签名的哈希（重跑不漂移），`sig` 为影响外观的类，`cls` 为渲染用类名（动态拼接的按属性取第一个值近似），`cls_hover` `cls_focus` 为强制状态，`where[]` 为出处

保留字段，重跑不动：

- `layouts[]`：手写版面骨架，`{id, label, desc, source, impl[], vw, vh, regions[{label, x, y, w, h, tone(main|side|chrome), note}]}`，坐标为该视口下的真实像素
- `edits`：`color:<id>` → `{light, dark}`；`role:<类名>` → `{size, lh, weight}`。只存与代码不同的值
- `decisions`：键为零件 id（`color:--brand`、`btn.3be44a7c`、`scale:px:11.5`、`mw:1168`、`layout:info`、`hex:#171512`、`font:mono`、`role:reading-body`），值 `{r, to, note}`；`r` ∈ `std keep merge drop unsure`
- `feedback[]`：`{t, at}`

## 读用户保存

回执 `.forge/design-lab/last-save.json` 里有 `edit_changes`、`decision_changes`、`new_feedback`、`pending_edits`。回复顺序：

1. 值改动表：零件、原值、新值；提醒这些还没进代码，问是否同步（同步是产品代码改动）
2. 结论汇总：每类按钮定了几个标准、几种归并、几种废弃；还有哪类一个标准都没定
3. 「拿不准」的出 A/B/C，三档都来自零件库里已有的值
4. 反馈逐条回

结论转实现清单时按文件分组：哪个文件第几行的按钮，改成哪个标准的类名。数量大时建议先抽一个共享组件（如 `Button` 的几个变体），再分批替换。

## 选材清单（新页面包开工前）

写在 feature-spec 或对话里，四段：

```
复用  颜色：--background --foreground --muted-foreground --brand --border
      文字：.reading-body .reading-meta；字号阶梯 13 / 15 / 20
      按钮：描边·中性标准（btn.xxxx）、文字链接标准（btn.yyyy）
      版面：信息页骨架（1168 内容区）
新造  --xx-col-w 300：引用列宽，零件库没有侧栏宽度这一档
      --xx-card-gap 12：……
组合  卡片 = card 底 + border 1px + 圆角 4 + 内距 12/16 + .reading-meta 来源行
不用  Tailwind 固定色、写死的 #hex
```

S5 交接时对照这份清单检查：页面 token 的值与零件库某个值相同却没引用，改成引用；新造的被两个以上页面包用到，提议升格进零件库。
