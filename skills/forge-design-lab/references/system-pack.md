# 零件库：模板 + 定制 + 对账

站点级只有一份，路径固定 `docs/assets/visuals/system/`。目的：全站设计零件可枚举、不无限增长；将来调整时只改模板一处。

## 三层

| 层 | 在 json 里 | 谁决定 | 用户要做什么 |
|---|---|---|---|
| 模板 | `template` | 用户 | 整体看，哪里不顺眼直接在页面上改 |
| 定制 | `custom[]` | 用户逐条确认 | 每条选 已确认 / 待确认 / 不需要 |
| 历史遗留 | 其余抽取字段 | 不需要决定 | 不看；「对账」只给覆盖率 |

## 文件

| 文件 | 谁写 | 说明 |
|---|---|---|
| `system.tokens.json` | 抽取脚本 + Agent 写模板初稿 + 用户保存 | 唯一数据源，进 git |
| `template.css` | `build_template.js` 或页面保存 | 模板生成的样式：颜色变量、`--t-*`、`.t-<文字样式>`、`.t-btn-<按钮>`；勿手改 |
| `product.css` | `extract_system.py --product-css` | 产品现有样式，供页面外壳与对账；勿手改 |
| `system.html`，`_workbench/system.js` `system.css` `template-css.js` | 从 design-studio 的 `web/lab/system/` 同步 | 页面与生成器 |

## template 字段

```json
{
 "version": "v1 初稿",
 "colors": [{"name": "--brand", "group": "品牌", "role": "主按钮、当前项、链接", "light": "#C65A1E", "dark": "#F0A273", "from": "现有 --brand，引用 173 次"}],
 "aliases": {"--primary": "--brand", ".admin-scope --a-ok": "--success"},
 "fonts": [{"id": "sans", "label": "无衬线", "use": "界面", "stack": ["Noto Sans SC", "Inter", "sans-serif"]}],
 "sizes": [11, 12, 13, 14, 16, 18, 20, 28],
 "type": [{"id": "meta", "label": "元信息", "use": "来源、时间", "font": "sans", "size": 13, "lh": 1.5, "weight": 400, "color": "--muted-foreground"}],
 "space": [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40],
 "radius": [{"id": "sm", "v": 4, "use": "按钮、卡片（默认）"}],
 "containers": [{"id": "page", "v": 1200, "use": "全站主区"}],
 "buttons": [{"id": "primary", "label": "主按钮", "use": "一屏最多一个", "h": 36, "px": 16, "size": 14, "weight": 600,
              "radius": "sm", "bg": "--brand", "fg": "--brand-foreground", "border": "", "hover": "darken"}],
 "layouts": ["app-shell", "event-full", "event-modal"]
}
```

- 颜色沿用产品现有变量名，引入 `template.css` 时现有代码自动吃到模板值。
- 按钮、文字样式的每个字段只能引用模板里的值（颜色名、字号阶梯、圆角 id），页面上的下拉框也只给这些选项。这就是「组合而不是新造」。
- `hover` ∈ `darken border-brand soft-brand muted-bg underline`，含义见 `template-css.js`。
- `layouts` 是 `layouts[]`（手写骨架目录）里的 id；页面独有的骨架挂在对应定制的 `layout` 上。

## custom 字段

`{id, name, status: 已确认|待确认|不需要, why, where, tokens: [变量前缀或类名前缀], based_on, layout?, note?}`

`tokens` 同时用于对账分类和守门放行：`--modal-` 表示所有 `--modal-*` 变量属于这条定制。状态为「不需要」的定制不再放行，它的值算历史遗留，后续并回模板。

## 提炼模板初稿的取值原则

1. 每组只留用量最大、用途清楚的值；字号 6–8 档，颜色 12–16 个，按钮 4–6 种。
2. 名字与值沿用现有代码里的主力变量，现有代码天然有一部分已经落在模板上。
3. 同值同用途的变量记 `aliases`，不算遗留。
4. 一组值只服务于一个独特场景（阅读纸面、Logo、平台色）记 `custom`，状态待确认，写清为什么模板不够。
5. 取完看「对账」覆盖率：颜色、字号、间距、圆角的用量覆盖率都应在 85% 以上，低于这个说明漏了主力值。

## 选材清单与定制申请（新页面包开工前）

```
复用  颜色：--background --card --foreground --muted-foreground --brand
      文字：.t-title .t-reading .t-meta
      按钮：.t-btn-primary .t-btn-ghost
      版面：全站外壳；容器 content 1040
组合  卡片 = --card 底 + --border 边 + 圆角 sm + 内距 12/16 + .t-meta 来源行
申请定制  引用列宽 300：模板没有侧栏宽度；只用于 AI 搜索页
```

申请的定制经用户确认后写进 `custom`，页面包 token 用自己的前缀（如 `--ai-`），守门脚本按页面包前缀放行。

## 读用户保存

回执 `.forge/design-lab/last-save.json`：`template_changes`（哪个零件哪个字段从什么改成什么）、`custom_changes`（状态与备注）、`new_feedback`。回复顺序：模板改动表；定制确认情况（还剩几条待确认）；反馈逐条回。模板改值不自动改产品代码，要产品用上模板另开实现任务。
