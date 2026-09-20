# 写页面包时踩过的坑（2026-09-20 ai-search 轮，全部实发）

症状 → 原因 → 修法。verify 报错或页面不对时先对照这里。

| # | 症状 | 原因 | 修法 |
|---|---|---|---|
| 1 | 列表/卡片区域空白，控制台 `JSON.parse` 空串 | 样例数据 `<script type="application/json" id="cards">` 与容器 `<div id="cards">` 撞 id，`querySelector` 拿到了容器 | 数据脚本 id 加后缀：`cardsData` `sampleData`；容器 id 保持语义名 |
| 2 | 组件规则被覆盖，全部元素 margin/padding 归零 | 重置写成 `#frame *{margin:0;padding:0}`，特异度 (1,0,1) 压过 `.card{padding:…}`；`#frame :where(*)` 也不行，`#frame` 本身仍贡献 (1,0,0) | 用 `:where(#frame *){margin:0;padding:0;box-sizing:border-box}`，特异度为 0 |
| 3 | 两栏布局塌成上下堆叠 | 引擎 css 给 `[data-id]{position:relative}` 显示编号，压过页面 `.left{position:absolute}` | 页面里绝对定位的区域用 `#frame .left{position:absolute…}` 提高特异度；或把 `data-id` 放在内层 |
| 4 | `afterApply` 从未执行，卡片不渲染、自动探测状态失败 | 引擎里 `const {W,H}=vpSize()` 解构出的 `H` 遮蔽了 hooks 对象 `H` | 引擎已改名 `VW/VH`；页面钩子里也别用 `H` 当局部变量名以外的东西 |
| 5 | 同源检查报几十处不一致，实际值一样 | `getComputedStyle` 解析了 `var(--brand)` 得到色值，直接与基线字符串 `var(--brand)` 比 | colorref 节点比解析后的站点色值（引擎 drift 已处理）；自己写校验时同样处理 |
| 6 | 字体看着像系统字体，行长判断失真 | Google Fonts 未加载（离线/被墙）或 family 名与产品自托管的不一致 | hooks `fonts` 列出要检查的字体，面板显示 ✓/✗；✗ 时只判比例不判气质，并在报告里写明 |
| 7 | 点一张卡，整个引用列的 token 都被选中 | 检查模式把所有 maps 命中的节点都算上，容器 `.col` 也命中 | 引擎已改为「最近模块」规则；页面侧把容器 token（`mod: col`）与内容 token（`mod: card`）分模块 |
| 8 | 缩略图宽为 0 | `aspect-ratio:1` 配合 `height:auto` 在 flex 里算不出宽 | 派生尺寸用 `raw` 节点写 `calc()` 明确给宽高：`--ai-card-thumb-auto: calc(var(--ai-card-src-size) * 1.5 + 4px + …)` |
| 9 | 编号标签互相遮挡或盖住文字 | 默认标签在元素上方 `translateY(-100%)`，紧贴上边界或很窄的元素放不下 | 那些元素加 `data-id-inline`，标签进元素内部左上角 |
| 10 | 保存写进了 `docs/` 而不是仓库根 | 用户在目录选择框里点进了子目录 | 引擎校验根目录必须同时含 `files.json` 与 `files.css` 的首级目录，不满足就报错清句柄；`repoName` 写进 json 让提示带上目录名 |
| 11 | 面板一开正文就挤成手机版 | `mobileBelow` 断点与「面板停靠扣宽」叠加：1440 窗口扣 404 后 1036 < 1024 | 这是特性不是 bug——它就是响应式压力测试；判断时看面板宽提示，或切预设视口 |
| 12 | 用户保存回来的 json 少了几个节点、没有 `schemaVersion`，覆盖后你上轮的改动全没了 | 工作台页面加载时就把 spec 读进内存了，用户没刷新页面就保存，导出的是旧结构 | 永远用 `merge_saved.py` 按 id 合并（值/结局/反馈取用户的，结构取仓库的）；回复里点名「这几个节点你还没见过，刷新页面就有」 |
| 13 | 用户看到的是一套值、实现的是另一套 | 值散落在 DESIGN.md 文字、骨架 CSS 字面值、前端 Tailwind 类里 | 只写 `var()`；字面值要么 token 化、要么 `/* fixed */` 说明；前端组件 import 生成的 `.tokens.css`；`verify_pack.mjs` 的字面值扫描与同源检查把这条守住 |

## 写组件 CSS 的硬约束（verify 会查）

1. `<style>` 里用 `/* @lab:site-tokens */` 与 `/* @lab:component */` 两个标记分段；字面像素扫描只查 component 段。
2. 站点组件的复刻（TopBar、整站地图、模块放大板的边框）用 `/* @lab:fixed-start */ … /* @lab:fixed-end */` 包起来，或行尾 `/* fixed */`；`0px` `1px` 不算字面值。
3. 每个有 `css` 的节点都要有 `maps`，且选择器在 `#frame` 里能匹配到元素（跨层跨状态都算）。
4. `layout[].el` 指向的 `data-id` 要存在；不对应元素就写 `el: null`。
5. 引擎文件不改项目副本；要改就改母本再由 `scaffold_pack.py` 同步（它会整文件覆盖并提示）。
