# forge-dev

开发调度：子 Skill 各开上下文

## 要解决的问题

从 PRD 到交付要依次跑设计、工程、QA。全放在一个会话里顺序做，调度和执行抢同一个上下文，越往后输出越差，排在后面的环节方案明显变粗。子任务做完说一句「完成了」，也不等于真的完成。

## 运行方式

![forge-dev 结构图](../../docs/diagrams/forge-dev.jpg)

先查有没有 PRD 和 Feature Spec：缺了就建议回 forge-prd，用户也可以选轻量模式直接跳到执行计划。默认的交互模式在三处停下等确认，--auto 只在开头对齐一两轮，之后不再停。每个子 skill 开一个新 Agent，主上下文只传文档路径，回来后读它的产出文档核对，再进下一个 Wave。

## 关键设计

开发调度要同时做到两件事：设计、工程、QA 按顺序接力做完，每一步都在干净的上下文里进行。forge-dev 让主会话只当调度员，三个环节各在一个独立的子 agent 里跑；两边只靠文件交接：用户偏好写成 CONTEXT.md，调研写成 RESEARCH.md，进度记进 .forge/dev-state.json 和阶段检查点。

- **主会话只编排，活交给独立上下文**：每个子 agent 只跑一个子技能，任务书固定带项目路径、PRD、本次变更、调研报告、前序产出、用户偏好和视觉决策索引；子技能按依赖关系分批启动，没有依赖的放进同一批并行（`references/orchestration-details.md` 第 4 步）。
- **子 agent 要知道的先写成文件**：动手前把灰区列出来，如布局偏好、返回格式、命名、目录结构，每个给推荐和备选，互不相关的合在一次里问，答案写进 CONTEXT.md，用户跳过就用默认值并标注；调研汇成五节的 RESEARCH.md；Feature Spec 的验收场景一并传给工程和 QA，工程每做完一个功能点先自验对应场景。灰区表和调研模板在 `references/orchestration-details.md`。
- **运行状态集中记在一张表里**：各子技能把自己的进度和失败原因写进功能目录下的 status.md，并更新注册表里的心跳；调度下一环前先读它，确认上一环已完成。设计、工程、QA 三份领域文档只写内容，运行状态都记在 status.md（`references/orchestration-details.md` Feature 状态管理一节）。
- **按任务性质挑选合适的模型**：跑测试、批量重命名、填模板这类机械活给子 agent 指定便宜模型，架构、设计、审查保持默认模型（`SKILL.md` 上下文工程一节）。
- **全自动跑也留好回退点**：自动模式下改动留在工作区，每个阶段结束把改动存成一份补丁当检查点，遇到阻塞记下原因、跳到能做的阶段；恢复模式读 dev-state.json，从上次中断的阶段接着跑（`references/orchestration-details.md` 状态管理一节）。

```text
forge-dev/
├── SKILL.md                       调度流程、三种模式、上下文工程原则
└── references/
    └── orchestration-details.md   状态文件、灰区表、调研模板、分批调度
```

## 其他

- 不处理：设计、写代码、测试本身，分别由 forge-design、forge-eng、forge-qa 在子 Agent 里做；这三个也能单独调用，不经过调度器
- 前提：宿主要能开子 Agent
- 注意：一条流水线只做一个想法，不塞多个不相关的功能

---

完整指令见 [SKILL.md](SKILL.md)；安装方法见仓库首页的 [README](../../README.md)。
