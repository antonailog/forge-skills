# forge-prd

诊断问题、改 PRD、出 Feature Spec

## 要解决的问题

用户提需求时说的多半是症状：「这里不好用」「结果不对」。照字面改 PRD，可能把代码没按 PRD 实现的问题当成新需求，同一个模块越改越多却没根治。PRD 是给设计、开发、QA 的 Agent 读的，没有逐条可验的验收场景，下游只能各自猜「做到什么算完成」。

## 运行方式

![forge-prd 结构图](../../docs/diagrams/forge-prd.jpg)

找到 PRD 就走迭代，没有就先问要不要从零建。用户拍板两次：变更清单和 Feature Spec，两次都确认之前不写任何文件；Spec 被要求修改，就改完重跑四点自审再交。写完调 forge-feature-doc，把结论同步到给人看的需求设计文档。

## 关键设计

一次 PRD 迭代要同时做到两件事：改动落在问题的根因上，写下的规则让设计、开发、QA 的 Agent 能直接照着做、照着验。forge-prd 先按改动大小分三档诊断，再把确认后的结论分写进三份文档：PRD 只放当前有效的产品事实，Feature Spec 放单个功能的行为场景和验收清单，CHANGELOG 记每次为什么改。

- **先判定根因，再决定改什么**：每个问题归入设计缺陷、实现偏离 PRD、PRD 遗漏三类之一，并告诉用户是哪一类。诊断按改动大小和范围分轻量、标准、深度三档，CHANGELOG 里同一模块在至少 3 个版本中被改过，就直接升到深度档并提醒用户。三档各做哪些检查写在 `SKILL.md`。
- **从整个产品看需求，不合适就反驳**：每一档都做「10 星挑战」：当前方案几星、10 星版本什么样、差距能不能在这次做完。深度档再审 PRD 里的隐含假设是否还成立，判断需求放在这里不合适就直接说，给出替代方案或建议砍掉（`SKILL.md`）。
- **每个功能点都写成能验的场景**：Feature Spec 分用户流程、页面结构、行为场景、验收清单四节，每个功能点写正常、异常、边界三类 Given/When/Then 场景，异常态至少覆盖空态、错误态、降级态，Then 写明界面怎么表现；验收清单从场景里提取，QA 直接拿来当用例。模板在 `references/feature-spec-template.md`，措辞分必须、应该、可以三级，生成细则在 `references/prd-details.md`。
- **PRD 只写现在有效的规则**：改了的原位更新，砍掉的移出正文；单个功能的完整场景写进 .features/ 下该功能的 feature-spec.md，变更背景、用户原话、关键决策和影响范围记进 CHANGELOG。PRD 章节结构和 CHANGELOG 格式见 `references/prd-template.md`。
- **下游会话从项目文件里接上进度**：每个功能在 .features/ 下有一份状态表，记 PRD、设计、开发、QA 各阶段进度，总注册表汇总所有功能和最近心跳；PRD 本身不含运行状态，多个会话能并行改不同功能（`references/prd-details.md`）。首次运行往项目 CLAUDE.md 写入 Forge 工作流规则，比如没有 Feature Spec 不写代码、QA 按验收清单断言（`references/project-claude-md-template.md`）。

```text
forge-prd/
├── SKILL.md                            五步流程、三档诊断、两道确认门
└── references/
    ├── prd-details.md                  从零建 PRD、生成 Spec、状态表细则
    ├── prd-template.md                 PRD 章节结构和 CHANGELOG 格式
    ├── feature-spec-template.md        Feature Spec 模板与验收清单
    └── project-claude-md-template.md   写进项目 CLAUDE.md 的工作流规则
```

## 其他

- 注意：项目没有 CHANGELOG 时，会根据 git 历史回溯生成一份
- 注意：首次运行会在项目 CLAUDE.md 末尾追加 Forge 工作流一节，已有内容不覆盖

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
