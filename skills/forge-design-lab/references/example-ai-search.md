# 范例：info2action AI 搜索页（模块 28，v32.1）

第一个用本方法跑完整闭环的页面包，在 info2action 仓库的 `ai-search-mvp` 分支。看它是为了对照「一个成熟页面包长什么样」，不是复制它的值。

## 文件

| 文件 | 说明 |
|---|---|
| `docs/assets/visuals/ai-search/ai-search.tokens.json` | 92 节点：结构 12、层级 4、排版 21、色彩 24、间距 15、状态动效 13、一致性 3；15 个站点级只读；6 条 effects；6 个线框区域；10 个模块 |
| `docs/assets/visuals/ai-search/ai-search.tokens.js` | 生成 |
| `frontend-react/src/components/ai-search/ai-search.tokens.css` | 生成，62 个 `--ai-*` 变量，前端组件 import 的那份 |
| `docs/assets/visuals/ai-search/2026-09-20-skeleton-v32.1.html` | 页面包：四层（线框 / 整站 / AI 搜索页含 6 状态 / 模块放大）、真实总结正文节选与 16 张引用卡样例、hooks 全套 |
| `docs/assets/visuals/ai-search/2026-09-20-skeleton-v32.1.meta.json` | 元数据：单源保证、验证记录、待办 |
| `docs/assets/visuals/_workbench/` | 引擎项目副本 |

## 值得对照的做法

- **结构 token 把「比例」写成算式**：左区 `right: calc(var(--ai-col-w) + var(--ai-col-gap) + var(--ai-col-margin))`，正文 `max-width: var(--ai-doc-max)` 居中；线框 `layout.style` 引用同一批变量，改一个值线框和骨架同时动。
- **非尺寸决策也是 token**：`s.entry-order`（「AI」入口在图标组的位置，-1 最左 / 0 原位）、`m.glow-when`（光晕只在空态 / 常亮）、`sp.hint-reserve`（提示行预留 / 不预留）都做成节点 + effects，用户切着看。
- **派生值用 raw**：`--ai-card-thumb-auto` 由来源行字号、卡标题字号、行高、行数算出，缩略图随文字高。
- **层级层只要结局**：`h.first`（开头段直接回答）、`h.second`（加粗小标题扫全篇）、`h.third`（引用列核对来源）、`h.control`（唯一控件是搜索框），check 型，maps 指向元素。
- **判断题带实测**：`s.col-w` 的 J2 用 hooks `sizes()` 算出的正文宽与一屏张数说话。
- **模块划分让检查模式好用**：容器 `col` 与内容 `card` 分开，点卡片只选卡片的 token。
- **样例是真的**：2026-09-19 真实总结 job 的正文节选 + 引用序前 14 条卡片 + 2 条未引用，行长与密度可判。

## 这一轮的用户纠正（进了方法论）

1. DESIGN.md 是给 AI 看的实现约束，人看不了 → 骨架先行、DESIGN.md 从它导出。
2. 比例必须真实 → 真尺寸 + 真 token，Image 2 退为气质判断。
3. 判断题必须和元素双向绑定 → 点节点元素亮、点元素面板跳。
4. 审查要有方法论 → 七层从顶往下，每层一个问题。
5. 备选只取阶梯值，自定义标红；站点级只读可提议。
6. 无损：json → 生成前端 import 的 css，骨架 link 同一份，组件只写 var()，导出页做同源检查。
7. 保存 = 直写仓库，说「保存好了，按调整后的来」即交接。
8. 辅助 UI 不占页面：无顶部工具条，全在右侧抽屉；抽屉固定宽停靠并挤压页面。
9. 检查模式只选最近模块的 token。
10. 先线框确认结构与模块清单，再写带样式骨架。
11. 反馈一行一条，行首编号可定位；四个 tab + 橙色保存。
12. 入口位置这类非尺寸决策也做成 token。

## 已知的未完项（不要当成范例的一部分）

- 前端组件尚未 import `ai-search.tokens.css`，仍用 Tailwind 字面类；属实现轮。
- 组件 CSS 里仍有若干字面像素值（按钮内距、列表缩进、空态内距等）未 token 化，`verify_pack.mjs` 会列出；下一轮审查时决定哪些进 token。
- 状态文案（失败 / 额度用尽 / 空结果）的一行式排版待出 A/B。
