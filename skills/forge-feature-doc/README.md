# forge-feature-doc

每个功能一份给人看的设计文档

## 要解决的问题

Forge 产出的 PRD、DESIGN、feature-spec 是写给 AI 执行的，篇幅必然长。要拍板的人读不完，迭代中改了交互、阈值、prompt 也看不到。文档和代码就一路漂移，功能现在到底是什么样，谁也说不清。

## 运行方式

![forge-feature-doc 结构图](../../docs/diagrams/forge-feature-doc.jpg)

进来先分流：文档不存在就新建，各阶段收尾来的是更新，只改受影响的部分；用户只是抱怨看不懂时，问一句要不要建，不自动开工。新建和更新都以 check.mjs 收尾，被 forge-review、forge-ship 调用时它是上线门禁，没过就拦，用户明说跳过才放行。读者要做的决定集中在文档最前面的「待你拍板」，每条带建议。

## 关键设计

需求设计文档要同时做到两件事：要拍板的人十分钟看懂功能现在的样子，文档跟着代码改动同步更新。forge-feature-doc 用一套固定骨架和写法规则管内容，用示意图模板和截图工具管图，再用一个检查脚本把文档和代码绑在一起，上线前查出漏更新。

- **先图后字，每部分文字不超过三行**：读者是要拍板、注意力有限的人，所以每部分先放图或表，数字标在图上，文字只做注释，正文十分钟读完。12 个部分各用什么形式、常犯什么错，列在 `writing-rules.md`。
- **骨架顺序固定，按功能类型取舍**：`doc-template.md` 固定开头是「待拍板」、中间 12 个部分、末尾是「细节在哪」和「关键改动」；`scaffold.mjs` 按有没有界面、后端、AI 保留对应部分，不适用的整节删掉、编号不变，读者靠编号定位。
- **正文只写功能当前的设计**：旧值和改动理由只进末尾的关键改动，最多 15 条；「改为」「原来」「不再」这类词和日期不进正文，`check.mjs` 会扫出来。
- **文档和功能改动放进同一个提交**：每份文档的 frontmatter 用 watch 列出决定效果的代码、prompt 和配置，`check.mjs` 发现这些文件在本分支改了、文档没改就报错。哪类改动该更新哪几部分，查 `stage-map.md`。
- **图和数取自真实来源，截图全程只读**：页面图截真实页面或设计骨架，示意图由 `render-diagrams.mjs` 从模板渲染，图上的数取自代码和配置。截图时 `annotate.mjs` 先拦下所有非 GET 请求，登录、额度、失败这些状态用假数据造，本地服务就算连着生产库、带着付费模型的密钥，也写不进数据、花不了钱；标注约定在 `visuals.md`。

```text
forge-feature-doc/
├── SKILL.md                    意图分流、新建与更新流程、红线
├── references/
│   ├── writing-rules.md        12 个部分怎么写、只写当前设计
│   ├── stage-map.md            哪类改动更新哪几部分
│   ├── visuals.md              示意图和截图怎么出、标注约定
│   └── example-ai-search.md    完整范例每部分用了什么图
├── scripts/
│   ├── scaffold.mjs            按功能类型建文档和图模板
│   ├── render-diagrams.mjs     示意图源文件渲染成图片
│   ├── annotate.mjs            截图只读保险、假数据、标注
│   └── check.mjs               上线前查漏更新、历史词、坏链接
└── assets/
    ├── doc-template.md         文档骨架模板，按类型保留部分
    └── diagrams/               示意图模板，换字和数字即可
        ├── diagram.css         示意图共用样式和配色
        ├── status-quo.html     现状问题的数字卡片
        ├── flow.html           用户流程主路径和岔路
        ├── funnel.html         召回漏斗：从哪找、找多少
        ├── pipeline.html       AI 生成管道：输入到校验
        ├── architecture.html   系统怎么搭的架构图
        └── page-mock.html      截不到页面时的页面示意
```

## 其他

- 前提：Node 跑脚本；出图和截图要 Playwright，没有时只交示意图的 HTML 源文件，说明图待补
- 注意：数值以代码和配置为准，对不上时改文档；只在生产环境变量里的值标「未核对生产」，不去读生产 .env
- 注意：scaffold 会把出图和检查脚本复制进项目，项目里没装这个 Skill 也能跑检查

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
