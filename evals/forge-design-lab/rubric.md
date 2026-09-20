# forge-design-lab 考点表

每个必出模块对应至少一条考点（S2 设计文档 2.4）。能程序化的一律走脚本；人判的只有两条。

| # | 维度 | 对应模块 | 满分条件 | 零分条件 | 主/客观 | 判分方式 |
|---|---|---|---|---|---|---|
| K1 | 阶梯来自实际用量 | 适配报告 | `scale` 四组全部 ⊆ 项目用量统计（adapt.json `usage`），且报告给出最常用值 | 阶梯是默认值或拍脑袋 | 客观 | `adapt_tokens.py` 输出 + 对照 usage |
| K2 | 线框 ↔ 骨架对应 | 线框确认 | 每个 `layout[].el` 都能在骨架 `data-id` 里找到 | 有区域找不到对应元素且未标 `el: null` | 客观 | `verify_pack.mjs` [K2] |
| K3 | 零 JS 错误 | 页面包 | pageerror / console.error / file:// 资源失败均为 0 | 任一 > 0 | 客观 | `verify_pack.mjs` [K3] |
| K4 | 同源 | 页面包 | tokens.css 计算值 = json 基线；`build_tokens.py --check` 通过；`<link id=tokcss>` 已加载 | 任一不一致 | 客观 | `verify_pack.mjs` [K4] [K4-static] [K4-link] |
| K5 | 组件 CSS 无字面像素值 | 页面包 | `@lab:component` 段扫描 0 行（fixed 标记与 0/1px 除外） | 有未标记字面值 | 客观 | `verify_pack.mjs` [K5]（默认 warn，`--strict-literals` 变 fail） |
| K6 | 每个可改 token 有映射 | 页面包 | 带 `css` 或 `q` 的节点都有 `maps` 且能命中元素 | 有节点用户点不到 | 客观 | `verify_pack.mjs` [K6] |
| K7 | 用户改值全部进 css | 审查回合 | 用户保存后 `build_tokens.py --check` 通过，差异表条数 = json 与基线的差异数 | 有改动没进 css，或 Agent 改了用户的值 | 客观 | `--check` + git diff |
| K8 | 反馈条数 = 回复条数 | 审查回合 | json.feedback 每条都有对应回复（含「改不了，因为」） | 漏回 | 客观 | 数条数 |
| K9 | DESIGN.md 区块与 json 一致 | 交接 | 重跑 `render_design_table.py` 无 diff | 有人手改了区块 | 客观 | 重跑 + git diff |
| H1 | 一次坐下来走完七层 | 审查回合 | 用户走完七层并保存，中途回到对话改值 0 次 | 中途要 Agent 改值 ≥ 2 次 | 主观（用户） | 用户报告 |
| H2 | 判断题可答 | 审查回合 | 重点判断题都能二选一或直接给结局，不需要追问 | 用户对 ≥ 2 道题回「不知道你在问什么」 | 主观（用户） | 用户报告 |
| R1 | 路由不误触 | description | 10 条 near-miss 负例 3 次运行触发率均 < 50%；10 条正例均 ≥ 50% | 任一负例误触或正例欠触 | 客观 | `run_trigger_eval.py` |
| D1 | 实现还原 | 交接（留空） | 实现后真实截图与工作台尺寸误差 ≤ 2px | > 2px | 客观 | forge-qa 截图对比，实现轮后跑 |

## 考点自身审计

- K3 / K4 / K6 在「没有 skill」的情况下几乎必然失败（没有引擎、没有 json、没有 css 生成），区分度来自基建而不是措辞，属于「skill 存在即得分」的考点——这是正确的，因为本 skill 的价值就在基建；但它们不能用来评价 SKILL.md 文字的好坏。
- 评价 SKILL.md 文字的考点是 K1（是否真的跑了适配而不是拍脑袋）、K7（是否守住红线 1 不改用户值）、K8、H1、H2、R1。
- D1 留空，待实现轮。
