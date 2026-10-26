# 项目 CLAUDE.md 模板

> forge-prd 首次运行时自动生成到项目根目录。
> 已有 CLAUDE.md 时追加 Forge 章节，不覆盖已有内容。
> 以下 `{变量}` 由 forge-prd 运行时填充。

---

```markdown
# {项目名称}

## Forge 工作流

本项目使用 Forge 规范驱动开发。以下规则在每次会话中生效。

### 状态感知（每次会话开始时 SHALL 执行）

1. 读取 `.features/_registry.md`，了解所有活跃 feature 的 phase 和状态
2. 读取当前 `git branch`，判断所在的工作上下文（main / feature 分支 / worktree）
3. 如果用户描述的需求与某个活跃 feature 相关，SHALL 主动关联并告知用户当前进度
4. 如果存在 `.forge/dev-state.json`，SHALL 读取并告知用户开发流水线的当前阶段

### 规范驱动规则

#### R1: 无 Feature Spec 不写代码

- 每个功能 SHALL 在 `.features/{feature-id}/feature-spec.md` 中有对应的 Feature Spec
- `docs/PRD.md` 是产品当前真相源，只吸收已确认且仍有效的产品事实，不长期塞完整 Feature Spec
- Feature Spec SHALL 包含：用户流程总览、页面/系统结构、Given/When/Then 行为场景、验收检查表
- 如果用户要求开发但 Feature Spec 不存在，SHALL 提示：「该功能没有 Feature Spec，建议先运行 /forge-prd 生成并确认」
- 用户明确确认 Feature Spec 后才可进入开发

#### R2: 实现严格对标文档

- 写代码时 SHALL 逐条对照 Feature Spec 的行为场景实现
- 每完成一个功能点，SHALL 自验对应的 Given/When/Then 场景（运行代码或检查逻辑），确认 PASS 后再继续下一个
- SHALL NOT 添加 Feature Spec 中未描述的功能或行为（scope creep）
- 如果实现中发现 Feature Spec 有遗漏或矛盾，SHALL 暂停并告知用户，而非自行决定

#### R3: 视觉实现对标设计文档

- 如果存在 `docs/DESIGN.md`，前端代码 SHALL 严格对标其中的配色、字体、间距、布局规范
- CSS 属性值（颜色、字号、间距、圆角等）SHALL 与 DESIGN.md 中定义的 Token 一致
- SHALL NOT 使用 DESIGN.md 未定义的颜色或字号
- 视觉偏离 SHALL 被视为与功能 bug 同等严重的问题

#### R4: QA 基于验收检查表断言

- 测试 SHALL 基于 Feature Spec 的验收检查表逐项执行
- 每个断言 SHALL 验证功能正确性（数据值/文本内容/状态变化），SHALL NOT 仅验证元素存在
- 视觉相关断言 SHALL 包含具体的 CSS 属性值检查（font-size、color、padding 等）
- 测试前 SHALL 生成用户可读的验收计划并请用户确认
- 测试后 SHALL 产出结构化的验收报告（全局评估 → 逐项结果 → 问题清单）

#### R5: 收到反馈时举一反三

- 用户报告问题后，SHALL 先修复该问题
- 修复后 SHALL 在代码库中搜索所有相似模式（Grep 同类 CSS 属性、同类逻辑、同类组件）
- SHALL 回查 Feature Spec，检查其他场景是否可能存在同类问题
- SHALL 产出「类似风险清单」并询问用户是否一并修复
- SHALL NOT 仅修复用户明确指出的单点问题就声称完成

#### R6: 提交前自验

- `git commit` 前 SHALL 验证所有相关的 Given/When/Then 场景仍然 PASS
- 如果涉及前端变更，SHALL 检查页面无控制台错误（console.error）
- SHALL NOT 在未自验的情况下提交代码

#### R7: 声称完成时提供证据

- 声称修复了某个问题时，SHALL 提供验证证据（测试输出、截图、或代码对比）
- SHALL NOT 仅说「已修复」而不给出验证结果
- 如果无法验证（如需要用户手动操作），SHALL 明确说明验证方式并请用户确认

### 状态→行动映射

| `.features/` 中的状态 | 建议行动 |
|---|---|
| 无 .features/ 或无活跃 feature | 使用 `/forge-prd` 创建需求和 Feature Spec |
| prd: ✅ 已完成, design: ⏳ 待处理 | 使用 `/forge-design` 进行设计（前端项目）或 `/forge-dev` 调度开发 |
| prd: ✅ 已完成, eng: ⏳ 待处理 | 使用 `/forge-dev` 进入开发调度 |
| eng: 🔄 进行中 | 继续实现，逐场景对标 Feature Spec |
| eng: ✅ 已完成, qa: ⏳ 待处理 | 使用 `/forge-qa` 进行验收测试 |
| qa: ❌ 失败 | 读取 QA 报告，修复问题并举一反三 |
| qa: ✅ 已完成 | 使用 `/forge-review` 审查或 `/forge-ship` 发布 |

### 文档位置

- PRD 当前真相源：`docs/PRD.md`
- Feature Spec：`.features/{feature-id}/feature-spec.md`
- PRD 变更日志：`docs/PRD-CHANGELOG.md`
- 设计文档：`docs/DESIGN.md`
- 工程文档：`docs/ENGINEERING.md`
- QA 报告：`docs/QA.md`
- Feature 状态：`.features/_registry.md`
```
