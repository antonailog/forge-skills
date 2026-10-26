# forge-design-impl

把设计文档落成 CSS

## 要解决的问题

设计定稿后写样式代码，要防三件事：顺手「改进」设计、把颜色字号间距写死、连业务逻辑一起改。AI 写前端还有自己的默认审美，比如暖奶油色背景配高对比衬线、暗底配酸绿强调色，不加约束就会冒出来。这个 Skill 只负责一件事：把 DESIGN.md 照着落成样式代码。

## 运行方式

![forge-design-impl 结构图](../../docs/diagrams/forge-design-impl.jpg)

开工前有两道门：DESIGN.md 已在 forge-design 拿到 B 以上，用户确认实现清单。宿主是 Claude Code 时 CSS 由 Codex 按任务书写，Claude 截图验收后一项一个提交，再回去做下一项。全部做完拿真实截图对比，明显偏离设计时回 forge-design 记录差异，不擅自改 DESIGN.md；通过后交 forge-qa。

## 关键设计

把设计落成样式代码，要同时做到两件事：做出来和 DESIGN.md 一致，每次改动小到随时能退回。forge-design-impl 只有一个 `SKILL.md`，按识别清单、逐项实现、自检提交、整体验证四步走，每一步都以 DESIGN.md 的 token 和组件规范为准。

- **DESIGN.md 是唯一的依据**：样式值全部引用 DESIGN.md 定义的 token，颜色、字号、间距走 CSS 变量或 Tailwind 配置；对设计有异议，回 forge-design 讨论（`SKILL.md` 实现原则）。
- **改动限定在样式和布局**：能用 CSS 解决就只改样式文件，布局变化时才动 HTML 结构，要改 JS 逻辑交给 forge-eng（`SKILL.md` 重要规则）。
- **沿用项目现有的样式写法**：项目用 Tailwind 就写 Tailwind，用 CSS Modules 就写 CSS Modules，只动这次清单里的样式；断点照 DESIGN.md 的定义，每个改动都单独考虑移动端（`SKILL.md` 实现原则）。
- **主动绕开 AI 的默认审美**：`SKILL.md` 按排版、配色、布局、组件列出常见的泛用写法，如一切居中、彩色圆圈包图标、三列等宽网格、暖奶油色背景配高对比衬线，实现和自检时逐条对照；大胆只花在一个签名元素上，交付前回看一眼，移除一件装饰。
- **验收看真实渲染出来的页面**：验收证据是真实截图、CSS 属性和行为断言，视觉稿只作观感参考；交付前搜代码里写死的值，报出 token 引用率（`SKILL.md` 第 4 步）。

```text
forge-design-impl/
└── SKILL.md   前置条件、实现原则、反模板清单、验证步骤
```

## 其他

- 前提：DESIGN.md 已通过 forge-design 审核，评分 B 以上
- 前提：宿主是 Claude Code 时由 codex-delegate 派 Codex 写样式代码，本机要装有 Codex CLI
- 注意：每个逻辑单元一个提交，格式 `style(design): …`，不把不相关的设计变更打包

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
