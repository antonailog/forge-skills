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
| 13 | 页面包里某个元素莫名多出边框、内距或白底，行高被撑大 | 页面包的类名与引擎 CSS 撞车。引擎用了不少两三个字母的短类名（`.d` `.q` `.nd` `.nh` `.fb` `.ctl` `.sw` `.btn`），页面写 `.hist .d` 照样被命中 | 页面包里凡是短类名都加模块前缀（`.hd` `.hq` `.hrow`）；写之前先 `grep -oE "^\.[a-z]{1,4}[ ,{]" workbench.css` 看一眼引擎占了哪些 |
| 14 | 按了快捷键没反应，字母还被打进了骨架的输入框 | 快捷键守卫写成「任何 input/textarea 都跳过」。骨架里的输入框是设计稿的装饰件，用户点一下焦点就停在那儿，之后所有快捷键全失效 | 守卫只挡 `#wb-panel` 内的输入；开检查时顺手 `blur()` 掉骨架里的焦点，并给一条常驻提示条，别让人以为没生效 |
| 15 | 用户看到的是一套值、实现的是另一套 | 值散落在 DESIGN.md 文字、骨架 CSS 字面值、前端 Tailwind 类里 | 只写 `var()`；字面值要么 token 化、要么 `/* fixed */` 说明；前端组件 import 生成的 `.tokens.css`；`verify_pack.mjs` 的字面值扫描与同源检查把这条守住 |
| 16 | 按钮看着是「纯文字」，边框像没画。验收脚本 13 项全绿也查不出来 | 重置写成 `#frame button{…border:0}`，ID 特异度 (1,0,1) 压过 `.st .retry{border:var(…)}` 的 (0,2,0)。边框简写整条作废，`border-style` 退回 `none`，于是 `border-width` 算出 0、`border-color` 退回 `currentColor` | 重置一律 `:where(#frame button){…}`（同坑 #2）。`verify_pack.mjs` 的 K7 专抓这一类：声明了边框 token 却算出 0，以及类规则被「ID + 裸元素名」压过 |
| 17 | 自己写的 CSSOM 遍历一条规则都收不到，检查脚本静默常绿 | CSS 嵌套落地后普通 `CSSStyleRule` 也带 `cssRules`（空列表），而空列表是真值。写成 `if (r.cssRules) { walk(r.cssRules); continue; }` 会把所有样式规则当容器递归吞掉 | 先收 `r.selectorText`，再 `if (r.cssRules && r.cssRules.length) walk(...)`。另：带 `var()` 的简写在 CSSOM 里被拆成长名且 `getPropertyValue` 返回空串，取作者写法要解析 `rule.style.cssText`，不能枚举 `Array.from(rule.style)` |
| 18 | 新写的检查脚本在「已知坏」的输入上也报通过 | 没拿坏样本验证过就信它。静默常绿的检查比没有检查更糟，它带着「我查过了」的可信度 | 每条新检查都要先造一份「只坏这一处」的对照文件跑一遍，必须报错；再在健康文件上跑一遍，必须干净。K7 就是这样抓出上面两个自身 bug 的 |
| 19 | 你改完 tokens.json 并重建，用户那边看到的还是旧稿；他一保存，你这轮的改动全被打回上一版 | 引擎 `load()` 把上一次会话里**所有节点**的值从 localStorage 整份盖回来。页面结构是新的（新节点、新元素都在），值却是旧的，所以 `merge_saved.py` 的「用户没见过的节点」也报不出来——他确实见过，只是值被本地快照覆盖了 | 本地缓存只存「与当前文件基线不同」的值，并连基线一起记；载入时基线对不上就丢弃该条、以文件为准，并在状态栏点名。**识别信号：用户保存回来的值和他当天说过的话相反**（说要调慢却变快、说用 48 却变回 40），那多半不是他改的。先比对 `git show HEAD:<tokens.json>` 再动手，别当成他的决策照单全收 |

## 写组件 CSS 的硬约束（verify 会查）

1. `<style>` 里用 `/* @lab:site-tokens */` 与 `/* @lab:component */` 两个标记分段；字面像素扫描只查 component 段。
2. 站点组件的复刻（TopBar、整站地图、模块放大板的边框）用 `/* @lab:fixed-start */ … /* @lab:fixed-end */` 包起来，或行尾 `/* fixed */`；`0px` `1px` 不算字面值。
3. 每个有 `css` 的节点都要有 `maps`，且选择器在 `#frame` 里能匹配到元素（跨层跨状态都算）。
4. `layout[].el` 指向的 `data-id` 要存在；不对应元素就写 `el: null`。
5. 引擎文件不改项目副本；要改就改母本再由 `scaffold_pack.py` 同步（它会整文件覆盖并提示）。
