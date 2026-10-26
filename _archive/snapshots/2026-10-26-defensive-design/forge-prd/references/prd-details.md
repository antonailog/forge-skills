# forge-prd · 执行细则手册

> 由 SKILL.md 骨架按需加载。含：可视化规范、从零创建 PRD 流程、Feature Spec 生成细则、Feature 状态管理操作。

## 可视化规范

**核心原则**：在向用户展示信息时，动态判断是否使用 widget 可视化。**不是所有内容都需要画图**——只在可视化明显优于纯文本时才使用。

如判断需要可视化，先读取 `~/.claude/skills/_shared/visual-decision-layer.md`：
- **Mermaid / show-widget** 用于流程、因果、矩阵、健康度、10 星挑战等结构化判断。
- **Image 2** 用于前端观感、页面气质、复杂状态、用户需要“看见效果”才能确认的决策。
- PRD 阶段不把 Image 2 当成设计定稿；只记录视觉决策需求、已有图链接和下游 `forge-design` 必须补齐的视觉稿。

**判断标准**（满足任一即用 widget）：
- 有**对比关系**：方案 A vs B、当前 vs 目标、版本间差异
- 有**多维度数据**：≥3 个模块的评分/状态/频次需要并排展示
- 有**流程/因果链**：多步骤流程、归因路径、决策树
- 有**统计分布**：频次、占比、趋势等数值型数据
- 信息量大且**结构化程度高**：变更清单 ≥5 项、多模块健康度评估

**不需要 widget 的场景**：
- 简单的 1-2 句确认性问题
- 单个变更点的讨论（纯文字更直接）
- 用户只需要 yes/no 的决策
- 信息本身就是线性叙述，没有对比或结构

**使用前**：首次生成 widget 前，调用 `mcp__codepilot-widget__codepilot_load_widget_guidelines` 加载设计规范。

**推荐的 widget 类型参考**：

| 信息类型 | 推荐 widget | 典型场景 |
|----------|-------------|----------|
| 多指标概览 | 指标卡片仪表盘 | 产品状态总结、迭代完成总结 |
| 频次/分布数据 | Chart.js 柱状图 | CHANGELOG 热点分析、变更统计 |
| 因果/流程 | SVG 流程图 | 问题归因路径、决策流程 |
| 多维评估 | SVG 矩阵/评分卡 | 模块健康度、方案评分 |
| A vs B | SVG 并排对比 | 当前 vs 目标、方案对比、10星挑战 |
| 结构化清单 | 交互式 HTML | 变更清单（≥5项时） |

**设计要求**（当决定使用 widget 时）：
- 遵循 widget guidelines 的配色和布局规范（Indigo 主色，Slate 结构色）
- 每个 widget ≤ 3000 字符，解释文字放在代码块外
- SVG 使用 `width="100%" viewBox="0 0 680 H"`
- Chart.js 图表必须 responsive，禁用 legend
- 复杂信息拆成多个 widget，交替文字和可视化

---


---

## 第1步（替代）：从零创建 PRD

当项目没有 PRD 文件时执行此流程。

1. **全面阅读项目代码**：
   - 用 Agent(Explore) 系统性扫描项目目录结构
   - 读取 README、package.json/requirements.txt 等配置文件
   - 读取核心源码文件，理解功能模块
   - 读取数据库 schema（如有）
   - 查看 git log 了解项目演进历史

2. **与用户多轮确认**（每轮一个主题，通过 AskUserQuestion）：
   - 第1轮：产品定位 — "这个项目解决什么问题？给谁用？核心价值是什么？"
   - 第2轮：功能边界 — 列出从代码中识别到的功能模块，确认是否完整
   - 第3轮：技术约束 — 确认技术限制、第三方依赖、性能要求
   - 第4轮：已知问题 — 确认当前存在的 bug 或体验问题
   - 第5轮：后续规划 — 确认近期计划做的功能

3. **产出 PRD 初稿**：
   - 参考 [references/prd-template.md](references/prd-template.md) 的标准章节结构
   - 写入 `{项目目录}/docs/PRD.md`

4. **Feature Spec 写入规则**：
   - 单个功能的 Given/When/Then、验收清单和实现规格写入 `.features/{feature-id}/feature-spec.md`
   - 根级 `docs/PRD.md` 只沉淀仍有效的产品事实、页面规格和未决策
   - 不把完整讨论过程或一次性 feature 草案长期塞回 PRD

5. **新建 CHANGELOG**：
   - 基于项目文档 + git history 回溯生成历史版本记录
   - 记录 v1.0 初始版本
   - 写入 `{项目目录}/docs/` 下

6. 向用户展示 PRD 结构和各章节概要，逐节确认后写入文件

---


---

## 第3.5步：生成 Feature Spec（用户确认门禁）

**前提：第3步变更清单已确认。** 在写入任何文件之前，先生成 Feature Spec 给用户审阅。

### 目的

Feature Spec 是整个开发和 QA 的**行为契约**。它同时服务于：
1. **向用户说明**：整体交互设计和界面结构（全局→细节），让用户判断方向是否正确
2. **向 QA 提供**：可执行的验收检查表（Given/When/Then 场景），让测试有锚点

### 生成流程

1. **读取参考模板**：[references/feature-spec-template.md](references/feature-spec-template.md)
2. **结合第3步的变更清单**，逐节生成 Feature Spec：
   - **用户流程总览**：从全局视角画出用户在该功能中的完整流转路径（入口→步骤→出口），包含异常分支
   - **页面/系统结构**：
     - 前端项目：整体布局 → 各区块职责 → 具体组件（名称、职责、交互行为、CSS 约束）
     - 后端项目：API 拓扑 → 模块职责 → 数据流
     - 全栈项目：两者都写
   - **视觉决策记录**（前端/全栈必填）：
     - 已有 brainstorm / Image 2 / Figma / 真实截图链接
     - 仍需 `forge-design` 生成的视觉稿清单（桌面端、移动端、关键空态/错态）
     - 用户已经确认或明确否定的视觉方向
   - **行为场景**：每个功能点 3 个 Given/When/Then 场景（正常 / 异常 / 边界），使用 SHALL/MUST 标记强制要求
   - **验收检查表**：从行为场景自动提取，分为功能验证、视觉/设计合规（含具体 CSS 值）、流程完整性三类

3. **措辞规范**（吸收 RFC 2119）：
   - **SHALL / 必须** = 强制要求，违反即为 bug
   - **SHOULD / 应该** = 推荐，有合理理由可偏离
   - **MAY / 可以** = 可选

4. **视觉合规项**：如果存在 DESIGN.md，从中提取具体的 CSS 约束（颜色、字号、间距、圆角等）写入验收检查表。不只描述视觉意图，SHALL 包含具体属性值。

### 用户确认（⚠️ 关键门禁）

Feature Spec 生成后，通过 AskUserQuestion 展示给用户：

```
Feature Spec 已生成，请审阅：

一、用户流程：{流程概要，2-3 句话}
二、页面结构：{区块数量} 个区块，{组件数量} 个组件
三、行为场景：{功能点数量} 个功能点，共 {场景数量} 个场景
四、验收检查表：{检查项数量} 项（功能 X 项 + 视觉 Y 项 + 流程 Z 项）

A) 确认，进入文档写入和开发
B) 整体方向需要调整（说明哪里不对）
C) 细节需要修改（指出具体项）
D) 需要看完整文档再决定
```

如果用户选 D，输出完整的 Feature Spec 文本。

**⚠️ 铁律：用户未确认 Feature Spec 前，不得进入第4步，不得写入任何文件。**

---


---

## Feature 状态管理（.features/ 架构）

> 状态标记与通用操作规则见 `~/.claude/skills/_shared/feature-status-protocol.md`。

### forge-prd 是 Feature 的创建者

forge-prd 在第0步中负责创建 `.features/{feature-id}/` 目录并注册到全局索引。

#### 第0步额外操作：创建 Feature

1. **生成 feature-id**：基于需求描述生成简短的 kebab-case ID（如 `dedup-optimization`、`channel-mgmt-v2`）

2. **创建目录和文件**：
   ```bash
   mkdir -p .features/{feature-id}
   ```

3. **创建 status.md**：
   ```markdown
   # Feature: {feature-id}
   ## 描述：{一句话需求描述}
   ## PRD 版本：vX.Y
   ## 创建时间：{ISO 8601}

   ## Pipeline
   | phase | status | skill | started | completed | note |
   |-------|--------|-------|---------|-----------|------|
   | prd | [🔄 进行中] | forge-prd | {时间} | — | 诊断阶段 |
   | design | [⏳ 待处理] | — | — | — | — |
   | eng | [⏳ 待处理] | — | — | — | — |
   | qa | [⏳ 待处理] | — | — | — | — |
   ```

4. **注册到 `_registry.md`**（不存在则新建）：
   ```markdown
   | feature-id | version | status | skill | heartbeat | branch | 描述 |
   |------------|---------|--------|-------|-----------|--------|------|
   | {id} | vX.Y | active | forge-prd | {时间} | {分支名} | {描述} |
   ```

5. **版本号预留**：读取 `_registry.md` 找最高版本号 → 预留下一个 → 写入注册表。版本号不回收。

#### 状态更新时机

1. **进入第1步时**：创建 `.features/{id}/` + status.md + 注册到 `_registry.md`，prd 行标记为 `[🔄 进行中]`
2. **等待用户确认时**：prd 行状态改为 `[⏸️ 暂停]`，更新 heartbeat
3. **第4步写入完成后**：prd 行状态改为 `[✅ 已完成]`，记录 completed 时间，更新 heartbeat
4. **失败/中断时**：prd 行状态改为 `[❌ 失败]`，note 填失败原因

#### Heartbeat 规则

每次写入 status.md 时，同步更新 `_registry.md` 中该 feature 的 heartbeat 字段。

### 跨 Agent 协作

- 其他 skill 通过读取 `.features/{id}/status.md` 的 Pipeline 表来感知 forge-prd 的状态
- forge-dev 启动时读取 `_registry.md`，如果某 feature 的 heartbeat 超过 30 分钟且 status 仍为 active，触发孤儿检测警告
- **领域文档（PRD.md）不含任何运行状态**，多个会话可以安全地并行操作不同 feature

---

