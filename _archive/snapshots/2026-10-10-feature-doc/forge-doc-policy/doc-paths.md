---
status: live
type: reference
module: forge-doc-policy
last_updated: 2026-06-09
---

# 文档落地路径白名单

本文件是 forge-* skill 的文档落地规则源头。项目里如果存在 `docs/modules/doc-system.md`，先遵守项目级文档系统；本文件作为默认规则和 legacy 兼容规则。

## 1. 默认读取顺序

做当前任务时，优先按这个顺序读：

1. 项目 `CLAUDE.md`
2. `docs/README.md`
3. `docs/INDEX.md`
4. 对应根级当前真相源：`PRD.md` / `DESIGN.md` / `ENGINEERING.md` / `QA.md` / `产品实现速查.md`
5. 相关 `docs/modules/*.md` 或 `docs/ops/*.md`
6. 需要历史原因时，再读 `docs/CHANGELOG.md`、分账 changelog、`docs/archive/summaries/`
7. 只有需要原始证据时，才进入 `docs/archive/raw/`

不要把 raw archive 或长 changelog 当默认上下文。

## 2. 当前真相源

| 路径 | 用途 | 写入规则 |
| --- | --- | --- |
| `docs/README.md` | 唯一文档入口 | 短导航，不承载长事实 |
| `docs/INDEX.md` | 当前 live 文档索引 | 汇总入口，不写历史过程 |
| `docs/CHANGELOG.md` | 历史总账 | 只做索引和当前有效决策摘要 |
| `docs/PRD.md` | 产品当前真相源 | 只沉淀当前产品事实；迭代细节进 `.features` 和 changelog |
| `docs/DESIGN.md` | 设计当前真相源 | 只沉淀当前设计原则、token、组件和债务 |
| `docs/ENGINEERING.md` | 工程当前真相源 | 只沉淀当前架构、数据流、API、表和运行边界 |
| `docs/QA.md` | 当前验收手册 | 只沉淀验收方法、命令、case 和证据阶梯 |
| `docs/产品实现速查.md` / `docs/配置指南.md` | PM 调参和配置指南 | 可写当前可调入口；不写 secret |

根级真相源可以变长，但必须可读、可改、可映射到代码/接口/表/配置。不要把 AI 讨论原文塞回根级文档。

## 3. 模块附录和运行文档

| 路径 | 用途 |
| --- | --- |
| `docs/modules/*.md` | 模块附录、快速定位图、代码/接口/表映射 |
| `docs/ops/*.md` | 当前运维 runbook、排障、部署、数据库、调度 |
| `docs/assets/` / `docs/qa-screenshots/` | 当前文档引用的图片、截图和 QA 附件 |

模块附录不能替代根级当前真相源；如果冲突，以代码、运行探针和根级当前真相源为准。

## 4. Active 工作区

| 路径 | 用途 | 生命周期 |
| --- | --- | --- |
| `.features/{feature-id}/feature-spec.md` | 单个功能的 Given/When/Then、验收清单和实现规格 | feature 完成后保留状态，根级 PRD 只吸收仍有效结论 |
| `.features/{feature-id}/status.md` / `.features/_registry.md` | feature 状态 | forge-prd / forge-dev / forge-eng 管理 |
| `.forge/dev-state.json` / `.forge/checkpoints/` / `.forge/visual-decision.md` | 开发流水线检查点和视觉决策索引 | forge-dev 管理（legacy：旧项目的 `.do-dev/`、`.deliver/` 只读迁移，不再写入） |
| `.forge/active.md` | 多会话协调 | forge-bugfix / forge-status 管理 |
| `docs/bugfix/backlog.md` | bug 任务池 | 当前任务入口，长期保留 |
| `docs/bugfix/reviews/BF-{MMDD}-{N}.md` | 正在处理的 bug 验收报告 | `status: draft`；结案后归档到 raw |
| `docs/plans/{YYYY-MM-DD}-{topic}.md` | 跨轮执行计划 | 只放仍可执行的计划 |
| `docs/{版本号}-CONTEXT.md` / `docs/{版本号}-RESEARCH.md` | forge-dev 调度产物（上下文摘要、技术调研） | forge-dev 管理；对应迭代结项后归档到 archive/raw |

Bug 报告结案规则：QA 和用户验收通过、修复合并后，移动到 `docs/archive/raw/bugfix-reviews/`，改为 `status: archive`，并更新 backlog 链接。

## 5. 历史和原始材料

| 路径 | 用途 |
| --- | --- |
| `docs/PRD-CHANGELOG.md` / `docs/DESIGN-CHANGELOG.md` / `docs/ENGINEERING-CHANGELOG.md` | 产品/设计/工程历史分账 |
| `docs/archive/summaries/` | 历史结论卡 |
| `docs/archive/raw/discussions/` | 原始 AI 讨论 |
| `docs/archive/raw/research/` | 原始调研材料 |
| `docs/archive/raw/optimizations/` | 已上线功能优化讨论原文 |
| `docs/archive/raw/retrospectives/` | 原始复盘材料 |
| `docs/archive/raw/bugfix-reviews/` | 已结案 bugfix review |

历史材料保留，但默认不作为当前事实源。

## 6. Legacy 兼容

老项目可能仍使用：

- `docs/讨论/{模块名}/`
- `docs/调研/`
- `docs/优化/`
- `docs/复盘/`
- `docs/DEPLOY.md`
- `docs/bugfix/reviews/` 作为长期报告库

兼容原则：

1. 如果项目没有 `docs/modules/doc-system.md`，可以按 legacy 路径继续写，但新文档仍必须有 frontmatter。
2. 如果项目已经声明 archive/raw 结构，forge-* skill 不得再把上述 legacy 目录当当前写入路径。
3. `docs/DEPLOY.md` 只有在项目明确声明它是当前部署入口时才可作为当前事实；否则优先看 `docs/modules/ops-runtime.md`、`docs/ops/README.md` 或项目 CLAUDE。

## 7. 快速决策树

```text
要写当前产品/设计/工程/QA 事实？
  -> 更新对应根级当前真相源，必要时同步模块附录

要写单个功能的详细规格？
  -> .features/{feature-id}/feature-spec.md

要写当前正在修的 bug 验收报告？
  -> docs/bugfix/reviews/BF-{MMDD}-{N}.md

bug 已验收并合并？
  -> 移到 docs/archive/raw/bugfix-reviews/

要记录历史原因？
  -> docs/CHANGELOG.md 或对应 *-CHANGELOG.md

要保存原始 AI 讨论/调研/优化过程？
  -> docs/archive/raw/{discussions|research|optimizations|retrospectives}/

路径仍不明确？
  -> 停下，给用户 2-3 个候选入口确认
```

## 8. 反模式

| 反模式 | 正确做法 |
| --- | --- |
| 在 `docs/` 根创建随手文档 | 放入根级真相源、模块附录、plans、active 工作区或 archive |
| 把 Feature Spec 长期塞进 `docs/PRD.md` | 写 `.features/{feature-id}/feature-spec.md`，PRD 只吸收最终有效事实 |
| 把历史 AI 讨论原文复制进根级文档 | 放 archive/raw，根级只写结论 |
| 把 `docs/DEPLOY.md` 当所有项目的部署权威 | 先看项目 CLAUDE、ops-runtime 和 ops README |
| 把已结案 bugfix review 留在 active 路径 | 结案后归档到 raw，并更新 backlog 链接 |

## 修订记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v0.2 | 2026-06-09 | 适配根级当前真相源、模块附录、active bugfix 后归档和 archive/raw 结构 |
| v0.1 | 2026-04-28 | 初版，基于 info2action 早期文档治理 |
