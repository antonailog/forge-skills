# forge-design-impl

把设计文档落成 CSS

## 要解决的问题

设计定稿后写样式代码，要防三件事：顺手「改进」设计、把颜色字号间距写死、连业务逻辑一起改。AI 写前端还有自己的默认审美，比如暖奶油色背景配高对比衬线、暗底配酸绿强调色，不加约束就会冒出来。这个 Skill 从 forge-design 拆出，只负责把 DESIGN.md 照着落成样式代码。

## 运行方式

![forge-design-impl 结构图](../../docs/diagrams/forge-design-impl.jpg)

开工前有两道门：DESIGN.md 已在 forge-design 拿到 B 以上，用户确认实现清单。宿主是 Claude Code 时 CSS 由 Codex 按任务书写，Claude 截图验收后一项一个提交，再回去做下一项。全部做完拿真实截图对比，明显偏离设计时回 forge-design 记录差异，不擅自改 DESIGN.md；通过后交 forge-qa。

## 关键设计

- **只改样式和布局，不碰业务逻辑**：要动 JS 交给 forge-eng；能用 CSS 解决就不改 HTML 结构，CSS 改动更安全、更可逆
- **DESIGN.md 是唯一真相源**：值全部引用它的 token，不写死颜色、字号、间距；有异议回 forge-design 讨论，不在实现里「改进」
- **沿用项目现有写法**：用 Tailwind 就用 Tailwind，不为「更好」引入新的 CSS 方法论，也不重写不相关的样式
- **效果图只作观感参考**：验收证据是真实截图、CSS 属性和行为断言，Image 2 既不是 QA 证据，也不是像素规范
- **交付前回看一眼，移除一件装饰**：大胆只花在一个签名元素上，周围保持克制

## 其他

- 前提：DESIGN.md 已通过 forge-design 审核，评分 B 以上
- 前提：宿主是 Claude Code 时由 codex-delegate 派 Codex 写样式代码，本机要装有 Codex CLI
- 注意：每个逻辑单元一个提交，格式 `style(design): …`，不把不相关的设计变更打包

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
