# 出图

目录：两类图 · 示意图 · 页面图 · 标注约定 · 截图脚本模板 · 踩坑

## 两类图

| 类型 | 用在 | 来源 | 怎么改 |
|---|---|---|---|
| 示意图 | 1 现状、3 流程、8 召回、9 管道、12 架构 | `overview/src/*.html`（模板在 `{skill}/assets/diagrams/`） | 改 HTML 里的字和数字，跑 `render-diagrams.mjs` |
| 页面图 | 4 布局、5 状态、6 细节、10 效果样例 | 真实页面截图，或设计阶段的骨架页面截图，再加标注；都没有时用页面示意（`page-mock.html`） | 改项目截图脚本，重跑；页面示意同示意图 |

## 示意图

- 模板：`status-quo.html`（现状卡片）、`flow.html`（主路径 + 岔路）、`funnel.html`（召回漏斗）、`pipeline.html`（AI 生成管道）、`architecture.html`（系统）、`page-mock.html`（页面示意）。共用 `diagram.css`。
- 颜色：先读项目的站点色（`:root` 变量或设计 token），改 `diagram.css` 顶部的变量，让图和产品同色系；品牌色只用来标关键数字。
- 关键数字用 `<span class="num">0.45</span>` 放大；大数字卡片用 `<span class="big">0 条</span>`。`.num` 不换行，避免「8–15」被拆成两行。
- 宽 960、2 倍图；`render-diagrams.mjs` 按内容高度截全图。
- 一张图只讲一件事。超过 8 个框就拆成两张。

## 页面图

**来源按阶段选**：实现后截真实页面；设计阶段截 forge-design-lab 的骨架页面（file:// 打开即可）；两者都没有（起不了服务、已上线但没做过骨架）时，用 `page-mock.html` 画页面示意。

**页面示意怎么画**：照真实页面的结构画，文字用真实文案（标题、分类名、按钮字、状态文案），区域用编号标出（最多 6 个），文档里在图下配「编号 / 区域 / 说明」表；尺寸取自代码，写在图注里并注明来源文件，标题写明「示意图，不是截图」。只有方框和尺寸的抽象线框不行：读者要判断的是「页面像什么样」，方框回答不了。

状态和细节截不到时也画示意：5 状态一览画成一张合成图，每个状态一张小卡（卡头写情况，卡里放真实文案）；6 交互与细节把关键元素（如一张卡片）放大画，编号配说明。页面里的真实内容夹在 `<!-- 样例 -->` 和 `<!-- /样例 -->` 之间：真实标题里本来就可能有「新增」这类词，检查脚本不扫这一段；图的标题和图注照常检查。

**状态造法**：别为了截某个状态去真的触发它。用 `page.route` 拦截接口返回假数据——登录态（拦 `/api/auth/me` 之类，返回演示账号）、额度用完、任务失败、空结果都这样造。假数据只填前端用到的最少字段。

**尺寸**
- 布局标注：视口 1600×900，倍率 1.5，整屏截。
- 状态缩略图：视口 1440×900，倍率 1，裁掉顶栏，两列表格排。
- 细节放大：倍率 2，按元素位置裁小块（四周留 12–40px）。
- 效果样例：倍率 2，裁文章开头约一屏。

## 标注约定

| 元素 | 画法 | 用来表示 |
|---|---|---|
| 橙色虚线框 + 橙底白字标签 | `box` | 这一块是什么、多大 |
| 黑色实线 + 黑底白字数字 | `gap` | 两块之间的间距 |
| 黑色点线横线 | `hline` | 对齐线（如三栏顶边） |
| 橙色点线竖线 | `vline` | 对齐边（如两端对齐的右边） |
| 引线标注 | `callout` | 标签放到空白处，用点线指过去 |

- 标签放在框上方，别压住正文；放不下就用 `callout` 挪到空白处。
- 标签比框宽时用 `maxw` 换行，靠右的框用 `labelRight`。
- 一张图最多标 3–4 处；要标更多就拆成多张细节图。
- 标签写结论（「目录 200（视口 ≥1500 才有）」），不写过程。

## 截图脚本模板

项目里新建 `scripts/design-doc/<短名>-shots.mjs`，引用 scaffold 复制过来的 `annotate.mjs`：

```js
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { guardWrites, mockJson, annotate, rect, shotTo } from './annotate.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const OUT = join(ROOT, 'docs/assets/visuals/<短名>/overview')
const BASE = '<本地前端地址>/'           // 从项目的 dev 配置读，别写死端口
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
const shot = shotTo(OUT)

const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 })
await guardWrites(page)                                         // 第一件事：拦下所有非 GET
await mockJson(page, '**/api/<状态接口>', { /* 假数据 */ })
await page.goto(BASE + '<路由>'); await page.waitForTimeout(3000)
const col = await rect(page, '<选择器>')
await annotate(page, [{ box: 1, rect: col, label: `正文 ${Math.round(col.w)}` }])
await shot(page, 'layout.png')
await browser.close()
```

运行：`NODE_PATH="$(npm root -g)" node scripts/design-doc/<短名>-shots.mjs`

## 踩坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 本地后端被写进数据、花了模型额度 | 项目本地服务连着生产库、带着付费 key | `guardWrites` 放在每个页面的第一行；提交类操作全部拦截返回假数据 |
| 脚本里 `git -C` 找不到目录 | `new URL(...).pathname` 把中文路径编码成 `%E9…` | 用 `fileURLToPath` |
| git 列出的中文文件名对不上 | git 默认转义非 ASCII 路径 | `git -c core.quotePath=false` |
| 截图里没有滚动条 | Playwright 无头模式默认隐藏滚动条 | `launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })` |
| 「只在滚动时出现」的元素截不到 | 页面要先看到真实输入才显示 | 用 `page.mouse.wheel` 而不是直接改 `scrollTop` |
| 标签被截断 | 标签超出裁剪区域 | `maxw` 换行、`labelRight`，或扩大裁剪区域 |
| 标签压住正文 | 段落里没有空白放标签 | `callout` 把标签挪到段落外 |
| 图里的数和代码不一致 | 示意图手写数字 | 写图前从代码、配置里取值；改了代码就重出图 |
| 本地服务没重启，截到旧行为 | dev 服务不会自动重载后端代码 | 截图前先重启，并用一个新接口确认新代码已生效 |
| 页面示意的编号被裁掉、压到相邻区域 | 区域有 `overflow: hidden` 或行数截断；相邻区域贴得太近 | 编号挂在没有裁剪的外层元素上；相邻区域留出间距，或调 `.mark` 的 top / right |
