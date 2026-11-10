# 复盘数据：JSON 字段

一篇复盘 = 一个文件夹 `记录/复盘/<项目>/<模块>/<YYYY-MM-DD>-<标题>/`，里面放你写的若干 `*.json`。`build.py` 按文件名顺序合并：字典逐层合并、列表首尾相接。建议按节分四份，写一节存一份，校验报错时只改那一份：

| 文件 | 放什么 |
| --- | --- |
| `1-总结.json` | `session`、`review.overview`（摘要、过程回顾、关键决策、结果评估） |
| `2-交付物.json` | `results`、`keyFiles`、`code`、`others`、`leftovers`、`files`、`mask` |
| `3-复盘.json` | `review.bench`、`review.path`、`review.task`、`review.sources`、`review.expression` |
| `4-知识.json` | `review.knowledge`、`review.glossary` |

子 agent 并行写知识条目时，各写一份 `4-知识-K2.json`，只含 `{"review":{"knowledge":{"entries":[…]}}}`，合并时自动接起来。文件名以 `_` 开头的不合并（草稿用）。

没有内容的部分整段不写或写空列表，页面上那一节就不出现，目录里也没有。

下面每个例子都取自会话 A（博客访问统计），只截了一条。

## 通用

| 字段 | 说明 |
| --- | --- |
| `root` | 可选。文件路径相对哪个目录，默认工作区根（复盘根的上两级） |
| `mask` | 可选。要打码的字符串（登录账号名、私人微信号、内部域名……），嵌进页面的文件内容里替换成 ‹已打码›。IP、邮箱、`password=…` 这类自动打码。用户公开的网站域名、品牌名、社交主页不放：放了，线上成果的网址也会被拦下 |
| `session` | `{title, id, range}`：title 同摘要标题；id 是会话 id 前 8 位；range `2026-11-03 22:25 — 11-04 12:15`（北京时间，build.py 用结束时间判断文件会后有没有再改） |

## 1-总结.json · review.overview

```json
{"summary": {"title": "博客全站和活动页有了每小时更新的访问看板", "range": "2026-11-03 22:25 — 11-04 12:15",
  "projects": ["个人博客", "活动监测"], "module": "访问统计", "status": "已上线",
  "why": "想知道网站和活动页有多少人看、多少人订阅", "did": "写了收数脚本和两个看板，放在博客域名下每小时更新",
  "got": "全站 209 访客、活动页约 130、订阅 2；61% 来源识别不了",
  "cause": "帮我看看这个网站有多少用户了？访问的和邮件订阅的"},
 "stages": [{"start": "11-03 22:25", "dur": "32 分钟", "name": "查活动页人数", "quote": "帮我看看这个网站有多少用户了？……",
  "dec": [], "story": "页面没装统计代码，访客只能从……反推：按 IP 去重、去掉你本人，所以给的是区间。", "out": "访客约 120–150 人、订阅 2 人"}],
 "decisions": [{"id": "D1", "what": "看板放在 example.com/stats/，每小时更新，需密码", "source": "采纳建议",
  "alts": "放在另一台服务器；不做网页，进每日简报邮件", "reason": "AI 推荐理由：挂在博客域名下……", "effect": "—"}],
 "goals": [{"kind": "主目标", "title": "活动页访问效果可随时查看", "status": "达成",
  "origin": "初始需求 · 11-03 22:25", "criterion": "打开固定网址，就能看到最新的活动页访客和订阅数据",
  "children": [{"status": "达成", "title": "活动页访客与订阅规模", "evidence": "访客 133 人、订阅 2 人（D3）"}]}],
 "findings": ["214 次访问里 198 次只看一页就走"]}
```

- `summary.status`：已上线 · 进行中 · 仅讨论
- `summary.why` / `did` / `got`：起因、做法、结果三句（STAR），汇总页列表和单篇页顶部都显示这三句：第一行「why → did」，第二行 got。字数 why ≤25、did ≤35、got ≤45，why + did ≤60，超了 build.py 提醒
- `summary.projects` / `module`：决定归档位置和汇总页分组，和文件夹路径一致
- `stages[].dec`：挂在这段的决策编号，必须在 decisions 里
- `decisions[].source`：八个取值之一——`用户方案`、`用户选择`、`用户倾向`、`采纳建议`、`调整建议`、`否决建议`、`AI 决定 · 已告知`、`AI 决定 · 未告知`（后两个中间的「 · 」是值的一部分）
- `goals[].kind`：主目标 · 衍生目标；`status`（父子都有）：达成 · 部分达成 · 待验证 · 未达成 · 移出范围 · 延后
- `children[].evidence` 里写「（D3）」会变成能点的决策编号

## 2-交付物.json

```json
{"results": [{"id": "site", "title": "全站访问看板", "url": "https://example.com/stats/", "host": "example.com/stats/",
   "meta": "每小时更新 · 需密码", "shot": "capture", "file": "blog/dist/stats/dashboard.html"}],
 "keyFiles": [{"file": "blog/deploy/site-stats.timer", "type": "配置", "title": "全站看板更新频率",
   "what": "全站看板多久更新一次", "value": "每小时第 35 分", "detail": "错过会补跑", "match": ["OnCalendar", "Persistent"]}],
 "code": {"flow": "flowchart LR\n  beacon[\"访问上报\"] -- \"POST /e\" --> logs[(\"CDN 和服务器日志\")]\n  logs --> collect[\"收数统计\"]",
  "modules": [{"id": "collect", "name": "收数统计", "role": "拉日志、去掉爬虫后算出访客……",
   "practices": [["服务端日志分析", "不在页面装第三方统计，直接从访问日志算访客"]],
   "files": [{"file": "blog/scripts/stats.py", "title": "全站统计", "detail": "拉日志、认出真人访客，算访客、来源……",
     "role": "全站看板的数据：……", "stack": ["Python 3 标准库", "systemd 每小时跑一次"],
     "io": {"in": "CDN 离线日志、nginx 日志", "out": "统计.json、看板页面"},
     "flow": [{"step": "拉日志", "desc": "补齐缺的 CDN 离线日志，读源站日志", "fns": [{"name": "pull_cdn()"}, {"name": "pull_origin()"}]},
              {"step": "判定真人", "desc": "……", "fns": [{"name": "爬虫和真人规则", "ranges": [[50, 52], [55, 59]]}]}],
     "ideas": ["口径集中在文件开头的常量里，改口径只动这几行"]}]}]},
 "others": {"groups": [{"name": "部署运维", "rows": [{"file": "blog/deploy/deploy-stats.sh", "use": "部署全站看板……", "change": "新增 70 行"}]}],
  "server": [{"host": "博客服务器", "what": "/stats/ 加密码访问"}]},
 "leftovers": {"asOf": "截至 11-04 12:15", "status": "blog/project.md",
  "items": [{"owner": "decide", "title": "第一版私有看板删不删", "when": "随时", "note": "已停更，不删也不影响", "prompt": "把 11-03 那个私有看板删掉"}]},
 "files": {"events/todo.md": {"status": "修改", "excerpt": [[29, 30]]},
           "blog/dist/stats/dashboard.html": {"status": "本地快照"}}}
```

- 文件路径：相对工作区根，或绝对路径、`~` 开头。build.py 读内容、行数、修改时间、目录清单，html 自动带页面预览
- `results[]`：`url` 和 `file` 至少一个——线上成果写 url（`host` 写显示用的短网址），没有网址的成果（邮件、本地文件）只写 file
- `results[].shot`：`"capture"` 让 build.py 用 Playwright 截图（有 url 截 url，没有就截本地 file；要登录的页面截不到，别写）；或给一张本机图片的路径（相对工作区根或绝对路径）；不写就不放图
- `results[].file`：本地快照或成果文件，点截图、点标题在抽屉里看
- `keyFiles[].type`：文档 · 配置；卡片上显示 `value`，没有就显示 `detail`：文档写 `detail`（一句说明），配置写 `value`（设定值）和要高亮的行：`marks: [[起, 止]]`，或 `match: ["要找的字"]` 让 build.py 找
- `code.flow`：Mermaid 流程图，模块之间怎么串；只有一个模块可以不写
- `fns[].name`：写函数名（`pull_cdn()`、`line()、words()`），build.py 按函数边界算行号；不是函数的一段代码写说明性名字 + `ranges`
- `others.groups[].rows[].change`：「新增 70 行」「改 3 行」这类
- `leftovers.items[].owner`：decide（待你决定）· wait（等条件）· ai（AI 来做）；`prompt` 是能直接复制给 AI 的一句；`status` 是项目最新状态文件的路径（有遗留事项就必填，build.py 会把它收进 files）
- `files`：只给需要补充的文件写——`status`（修改 · 样稿 · 本地快照 · 已删除；新增的可以不写）、`excerpt`（md 文档只显示改动的几段：`[[起, 止]]` 或要找的字）

## 3-复盘.json

```json
{"review": {"task": "网站访问统计", "path": ["b2", "b1", "b3"],
 "bench": [{"id": "b1", "step": "统计方案选型", "eval": "合理偏离",
   "gapLine": "没用现成统计工具，自建「日志分析 + 自托管上报」",
   "mineKw": ["自建", "服务端日志分析", "自托管上报"], "baseKw": ["GA4", "Plausible", "Umami", "GoAccess"],
   "dims": [{"dim": "要不要数据库", "mine": ["不要"], "base": ["Umami 自部署要 PostgreSQL"], "same": false}],
   "why": "服务器内存小，跑不动 Umami 要的 PostgreSQL", "cost": "访客怎么算、爬虫怎么去，都要自己定、自己维护",
   "say": "个人博客要加访问统计：先比较 Plausible、Umami、GoAccess 和自建四条路，按服务器内存……给我一张对比再动手",
   "keywords": [{"term": "Plausible", "what": "不用 cookie 的轻量统计，可托管也可自部署", "side": "base", "src": "plausible"}],
   "evidence": ["讨论方案时的备选：Umami 要多跑一个数据库……", "你的回复：「装同一套」"],
   "sources": ["plausible", "umami", "goaccess"],
   "landscape": [{"name": "Plausible", "x": 38, "y": 25, "src": "plausible"}, {"name": "本次：自建", "x": 86, "y": 86, "chosen": true}]}],
 "sources": {"plausible": {"title": "Data policy", "publisher": "Plausible Analytics", "url": "https://plausible.io/data-policy",
   "note": "不用 cookie：每天换一次盐，对 IP 和 UA 做哈希来认访客"}},
 "expression": [{"type": "需求不完整", "title": "没说在哪看、多久看、谁能看", "quotes": [["11-03 22:57", "给我做一个统计看板"]],
   "effect": "第一版做成了私有页面，也不会自己更新；第二天才说要放到自己的网站上，又做了一轮部署",
   "say": "给活动页做个访问统计看板：放在我的网站上，每小时自动更新，只有我能看"}]}}
```

- `path`：对标项 id 按最佳路径的顺序排，每个对标项都要出现一次
- `bench[].eval`：一致 · 合理偏离 · 待改进 · 缺失
- `dims`：只列本次和行业不同的维度（`same: false`），相同的最多留一两条做对照
- `landscape`：可选，选型类才写。两个维度上的位置（0–100），本次的选择 `chosen: true`；配一个 `"axes": {"x": ["托管服务", "自己部署"], "y": ["可定制 低", "可定制 高"]}` 写轴名
- `keywords[].side`：mine（本次用的）· base（行业做法）；`src` 指向 sources 的键
- `bench[].sources`：这一步引用的来源键，必填（没有引用写 `[]`）
- `sources`：所有外部链接集中在这里，键名自己起；每个都要打开核对过，`note` 写引用的那句话在原文里说了什么
- `expression[].type`：需求质量的标准叫法：需求不完整 · 需求不可验证 · 需求有歧义 · 需求不一致 · 约束缺失 · 优先级缺失……

## 4-知识.json

```json
{"review": {
 "knowledge": {
  "layers": [{"name": "采集", "decide": "数据从哪来", "chosen": "服务器日志 + 页面上报"}, {"name": "清洗", "decide": "去掉哪些", "chosen": "爬虫、你自己"}],
  "entries": [{"id": "K2", "group": "盲区", "kind": "知识点", "title": "访客从哪来：来源归因", "sourceLabel": "盲区来源",
    "source": "AI 问要不要给发出去的链接加来源标记，你回「不加」，没问不加的代价；结果 61% 的访客来源认不出来。",
    "basis": null, "layers": ["采集"], "step": "b4",
    "what": "（md）用这次的例子讲……", "judge": "（md）怎么判断……", "say": "下次这样说的一句",
    "verify": "（md）怎么验收……", "reading": "[标题](网址)（谁家的，看哪部分）· [标题](网址)"}]},
 "glossary": {"modules": [{"id": "data", "area": "数据", "name": "访问统计",
   "say": "做站点访问统计：用服务端日志分析 + 自托管上报，不接第三方……",
   "words": [{"term": "Umami", "kind": "选型", "side": "talked", "what": "开源可自部署、界面现成，要多跑一个数据库",
     "src": "umami", "new": false, "icon": "si:umami"}]}]}}}
```

- `layers`：知识地图的骨架，这次工作对象的结构，自上而下 4–7 层；每层 `decide` 要定什么、`chosen` 这次选了什么
- `entries[].group`：盲区 · 专题 · 延伸；`kind`：架构 · 选型 · 工具 · 知识点（延伸、专题可以写 null）
- `sourceLabel`：盲区写「盲区来源」，专题写「你说想学」，延伸写「为什么推荐给你」
- `layers`：落在哪几层（名字要在 knowledge.layers 里）；空列表 = 挂不上这条结构，放进「结构之外」；kind 为架构或覆盖全部层的放在地图顶上
- `basis`：延伸学习按长期方向推荐时写「长期方向：<方向名>」，进「往你的长期方向」一组；其余 null
- `step`：和对标分析哪一步有关（对标项 id），可空
- `what` / `judge` / `verify` / `reading` 是 markdown，可以有表格和列表；`say` 是一句纯文字
- `glossary.modules[].id`：英文短 id；颜色按模块顺序自动分
- `words[].kind`：选型 · 效果 · 做法；`side`：mine（这次最终用的）· talked（会话里出现过但最终没用）· base（会话里没出现、业内常用）；`area` 是领域通用叫法，`name` 是这块在这次工作里的叫法
- `words[].new`：用 `build.py --known-terms 词1 词2… --self <复盘文件夹> --session <会话 id>` 查，以前的复盘里没出现过的写 true
- `words[].icon`：品牌词写 `si:<slug>`（react、vuedotjs、umami、baidu、github、docker……，全表在 assets/icons.json 的 brands），其余写 lucide 图标名（Eye、Timer、Lock、Bot、Tag、Rocket、SearchCheck……）；写错会退回类别通用图标
