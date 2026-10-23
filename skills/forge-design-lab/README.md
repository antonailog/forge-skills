# forge-design-lab

在真 token 的骨架上定布局和密度

## 要解决的问题

设计阶段通常读 DESIGN.md 的文字判断布局。「7fr:3fr、完整卡片」读着合理，实现后实机一屏只放得下 1.9 张，只能推翻重做；Image 2 效果图有观感，但比例是画出来的，同样不可信。值还散在 DESIGN.md 文字、骨架 CSS 和前端 Tailwind 类里，用户看到的是一套，实现的是另一套。

## 运行方式

![forge-design-lab 结构图](../../docs/diagrams/forge-design-lab.jpg)

Claude 和用户交替推进（图中上下两条线）：区域、模块、状态三件事在线框上确认之前，不画带样式的骨架。用户在骨架上按七层从结构往下审，改值、给结局、写反馈，点保存直写仓库；Claude 读保存回执，拿不准的出 A/B/C 写回页面，进入下一回合。用户说「按调整后的来」，才生成 DESIGN.md 的 token 表，把实现清单交给 forge-eng。

## 关键设计

- **每个决策落成一个 token，只存一处**：骨架和前端 import 同一份由 tokens.json 生成的 CSS，DESIGN.md 的 token 表也是生成的，手改一处就有两套值
- **先确认线框，再画骨架**：线框返工只是改几行 json，骨架返工最贵
- **用户存下的值不替他改**：要反对就出 A/B/C，三档都取阶梯值、各写一句看得见的后果，让他在骨架上切着比；覆盖他的决策等于这轮审查作废
- **七层顺序固定，从结构往下**：结构没定，排版无从谈起；色彩排在间距前，因为对比度会改变对密度的感知
- **零件库不让用户逐项裁决现状**：第一版把现有乱值全摊开让用户判断，被否了，人眼分辨得了的很少；现在只给他看模板和定制，历史遗留冻结，只报覆盖率

## 其他

- 前提：Python 3 和 Node；运行时（工作台服务、token 工具、引擎母本）在独立工具 [design-studio](https://github.com/antonailog/design-studio)，没装时脚本会提示 `git clone https://github.com/antonailog/design-studio.git ~/.design-studio`；验收脚本和实现比对要 Playwright，没有时只做静态校验，请用户自己打开页面看控制台
- 注意：先起 serve.py（只绑 127.0.0.1），保存才能直写仓库；用 file:// 打开时退回选目录或下载，容易存错仓库，主仓库和 worktree 都有 docs/
- 注意：站点级 token（品牌色、字体族、字号阶梯）在工作台里只读，只能标「提议改动」，另走全站审查

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
