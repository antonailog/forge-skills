# forge-design-lab

按真实尺寸看页面，当场调布局和间距

## 要解决的问题

设计阶段通常读 DESIGN.md 的文字判断布局。「7fr:3fr、完整卡片」读着合理，实现后实机一屏只放得下不到两张，只能推翻重做；Image 2 效果图有观感，但比例是画出来的，同样不可信。值还散在 DESIGN.md 文字、骨架 CSS 和前端 Tailwind 类里，用户看到的是一套，实现的是另一套。

## 运行方式

![forge-design-lab 结构图](../../docs/diagrams/forge-design-lab.jpg)

Claude 和用户交替推进（图中上下两条线）：区域、模块、状态三件事在线框上确认之前，不画带样式的骨架。用户在骨架上按七层从结构往下审，改值、给结局、写反馈，点保存直写仓库；Claude 读保存回执，拿不准的出 A/B/C 写回页面，进入下一回合。用户说「按调整后的来」，才生成 DESIGN.md 的 token 表，把实现清单交给 forge-eng。

## 关键设计

设计工作台要同时做到两件事：用户在骨架上看到的比例就是上线后的比例，看到的值和实现用的值是同一份。forge-design-lab 以每个页面的 tokens.json 为唯一数据源，骨架、前端样式和 DESIGN.md 的 token 表都由它生成；脚本按适配、线框、骨架、审查、交接各管一段，工作台服务和页面引擎放在独立工具 design-studio 里，由 `_design_studio.py` 找到并转调。

- **每个决策落成一个 token，只存一处**：tokens.json 是所有脚本共认的数据契约，字段写在 `references/spec-schema.md`；`build_tokens.py` 从它生成骨架读的 js 和前端引用的 css，`render_design_table.py` 生成 DESIGN.md 里的 token 表，要改值就改 json 再重建。
- **结构问题在线框阶段改完**：线框层由引擎按 json 里的区域定义自动画出，区域尺寸引用结构 token，改一个值线框跟着动；结构定下来再写骨架片段，交给用户前 `verify_pack.mjs` 检查有没有脚本报错、值是否同源、每个可改 token 能否在骨架上点到。
- **审查按七层从结构往下走**：结构、层级、排版、色彩、间距与形状、状态与动效、一致性，每层一个问题，判断题挂在可点的节点上、带实测数字；色彩排在间距前，因为对比度会改变对密度的感知（`references/seven-layers.md`）。
- **用户存下的值就是决策**：保存回来先由 `merge_saved.py` 按 id 合并，值、结局和反馈取用户的，结构取仓库的；有不同意见就出 A/B/C 三档阶梯值，各写一句看得见的后果，写进页面让用户切着比。
- **全站设计零件要数得清**：零件库分模板、定制、历史遗留三层，用户只看模板和逐条确认的定制，历史遗留冻结、只报覆盖率（`references/system-pack.md`）；`check_system.py` 拦下新增代码里模板和定制以外的颜色、字号、圆角、间距。

```text
forge-design-lab/
├── SKILL.md                     意图分流、各步做法、脚本用法、红线
├── references/
│   ├── spec-schema.md           tokens.json 的全部字段
│   ├── seven-layers.md          七层审查、判断题和 A/B/C 怎么出
│   ├── engine-hooks.md          页面包 HTML 要写什么、引擎接口
│   ├── pitfalls.md              页面包常见故障：症状、原因、修法
│   ├── system-pack.md           零件库：模板、定制、选材清单
│   └── example-ai-search.md     一个完整页面包的范例，供对照
└── scripts/
    ├── _design_studio.py        找到运行时 design-studio
    ├── serve.py                 本机工作台服务，保存直写仓库
    ├── adapt_tokens.py          读项目现有变量，定阶梯和前缀
    ├── build_tokens.py          生成 js 和 css，校验同源
    ├── scaffold_pack.py         生成页面包壳，同步引擎
    ├── verify_pack.mjs          页面包验收：报错、同源、映射
    ├── merge_saved.py           按 id 合并用户保存的 json
    ├── render_design_table.py   生成设计文档里的 token 表
    ├── extract_system.py        盘点代码里现有零件，建零件库
    ├── build_template.js        按零件库模板生成样式文件
    ├── check_system.py          守门：查新增代码里的模板外值
    └── compare_impl.mjs         实现比对：骨架和产品页量尺寸
```

## 其他

- 前提：Python 3 和 Node；工作台运行时在独立工具 design-studio，脚本找不到它时会打印安装命令，装在别处用环境变量 `DESIGN_STUDIO_HOME` 指过去
- 前提：页面包验收和实现比对要 Playwright；没有时验收只做静态校验，请用户自己打开页面看控制台
- 注意：先起 serve.py（只绑 127.0.0.1），保存才能直写仓库；用 file:// 打开时退回选目录或下载，容易存错仓库，主仓库和 worktree 都有 docs/
- 注意：站点级 token（品牌色、字体族、字号阶梯）在工作台里只读，只能标「提议改动」，另走全站审查

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
