# forge-design

定页面设计规范，统一颜色、字体和组件

## 要解决的问题

让 AI 一边定设计一边写 CSS，设计决策还没想清楚就进了实现，结果按钮样式返工几轮也改不对，问题出在最初的决策上。没人把关时，AI 做的界面还容易落进同一套模板：蓝紫渐变、三列彩色图标、一切居中。页面上还会越堆越多写给验收人看的说明、提示和小字，挤占布局。

## 运行方式

![forge-design 结构图](../../docs/diagrams/forge-design.jpg)

第 0 步按改动类型定级并请用户确认：新页面、新模块走 L1 完整设计，迭代走 L2 轻量审查，没有界面的直接交 forge-eng；布局、比例、密度这类要看见才能判断的决定，交给 forge-design-lab 在真实骨架上定。最后按 A–F 打分，没过线就回退（图中虚线），过线后把 DESIGN.md 交给 forge-design-impl 实现。用户只要求检查防御性设计时不走这套流程，先列清单请用户确认，再删改页面上的文字和元素。

## 关键设计

设计阶段要同时做到两件事：决策在写代码之前定下来，评判有一把固定的尺子。forge-design 把分级流程放在 `SKILL.md`，从零建文档、审计与评分、防御性设计检查各写成一本手册，配色、字体、风格和交互体验规则收进本地数据表，由检索脚本按关键词查。

- **只出设计决策，代码交给下游**：成品是 DESIGN.md、设计变更日志和工作台骨架页面包，样式实现交给 forge-design-impl，逻辑交给 forge-eng；DESIGN.md 照 `references/design-template.md` 的章节写。
- **页面比例的数字都来自骨架**：DESIGN.md 里的页面级 token 表由 forge-design-lab 导出的 tokens.json 生成，布局说明里的比例和尺寸都引用这些 token；Image 2 效果图只用来判断气质和风格（`SKILL.md` 第 3、4 步）。
- **设计方向从资料里查出来**：建新文档时，`search.py` 按产品类型和风格关键词检索 `data/` 下的配色、字体、风格表，`design_system.py` 再按 `ui-reasoning.csv` 的推理规则合成一套设计体系建议；先给至少三个美学方向，token 按原始值、语义、组件三层搭（`references/create-mode.md`）。
- **审计和评分用同一把尺子**：`references/audit-and-scoring.md` 列出十类审计项，其中一类专查 AI 模板痕迹，如蓝紫渐变、三列彩色圆圈图标、左边框高亮卡片；评分从 A 起算，高影响问题降一级、中影响降半级，轻量审查只查其中的重点十项。发现写成「把 X 改成 Y，因为 Z」，另附 3—5 条见效快的改进（`SKILL.md` 重要规则）。
- **只留读者用得上的说明和提示**：每个说明、提示、按钮、折叠都过三问（写给谁、删掉它读者的交互和理解受不受影响、这个场景现在会不会发生）；`references/defensive-design.md` 按自证、解释、状态、结构四类列出症状，搭建 demo 和对外上线分开处理。这条检查是 forge-design 唯一直接改页面的地方，只做减法和替换，不借机加新设计。

```text
forge-design/
├── SKILL.md                   分级门控、第 0—6 步流程、重要规则
├── references/
│   ├── create-mode.md         从零建文档：方向、配色、字体、token
│   ├── audit-and-scoring.md   审计清单、AI 模板痕迹、A—F 评分
│   ├── defensive-design.md    防御性设计：三问、症状、分阶段处理
│   └── design-template.md     DESIGN.md 和变更日志的章节模板
├── scripts/
│   ├── search.py              按关键词检索设计规则库的入口
│   ├── core.py                规则库的关键词检索引擎
│   └── design_system.py       合成整套设计体系建议
└── data/                      设计规则库，检索脚本从这里查
    ├── colors.csv             按产品类型给的配色方案
    ├── typography.csv         标题与正文的字体搭配
    ├── styles.csv             设计风格定义和适用场景
    ├── products.csv           各产品类型的设计属性
    ├── ui-reasoning.csv       从产品类型推到设计决策的规则
    ├── ux-guidelines.csv      交互体验规则，附正反代码示例
    ├── charts.csv             数据图表类型怎么选
    └── landing.csv            落地页区块类型和排列顺序
```

## 其他

- 不处理：代码层的防御性编程（空值判断、try/catch），交 forge-review
- 前提：Python 3 跑 search.py，查自带的规则库（99 条 UX 规则、161 套配色、73 组字体搭配等 CSV），不依赖外部服务
- 注意：大需求下的子模块要先读父页面的 DESIGN.md，配色、字体、间距、圆角对不上的要改，或者拿到用户明确许可

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
