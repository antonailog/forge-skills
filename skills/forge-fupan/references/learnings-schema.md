# forge-fupan · learnings 账本规范

> 由 SKILL.md 骨架按需加载：落账本条目、做复发检测时必读。
> 设计参考 gstack /learn（append-only + 置信度 + 矛盾检测）。

## 账本位置

工作区唯一一本：`~/claudecode_workspace/记录/复盘/learnings.jsonl`
（每条带 project 字段，跨项目通用教训——尤其 AI 协作类——全局可检索。）

## 条目格式（一行一条 JSON）

```json
{"ts":"2026-07-04T10:30","project":"info2action","domain":"ai-collab","key":"bugfix.同根判定","insight":"新发现先举证再合并；同文件/同函数/同数据流三证不全，默认拆独立 bug","confidence":8,"evidence":"BF-0704-1","status":"active","supersedes":null}
```

| 字段 | 说明 |
|---|---|
| `ts` | 写入时间，ISO 格式到分钟 |
| `project` | 项目名（info2action / forge-cookbook / …），跨项目通用教训写 `global` |
| `domain` | 能力域四选一：`ai-collab`（AI 协作）/ `tech`（技术判断）/ `product`（产品决策）/ `expression`（表达） |
| `key` | 短键，`领域.主题` 格式（如 `bugfix.同根判定`、`prompt.范围控制`），同类教训复用同一 key |
| `insight` | 洞察本体，一句话，**必须锚定具体做法**（"下次遇到 X 就做 Y"），禁止"要多注意"式空话 |
| `confidence` | 1-10。首次记录默认 6-7；被复发验证 +1；被推翻 → 写新条目取代 |
| `evidence` | 来源锚点：BF 编号 / 复盘文档文件名 / commit hash |
| `status` | `active` / `superseded`（被新条目取代）/ `stale`（引用的东西已不存在） |
| `supersedes` | 取代的旧条目 key+ts，无则 null |

## 写入规则（append-only）

0. **必须写紧凑 JSON**（`json.dumps(..., separators=(",",":"))`，冒号后无空格）——回放钩子用 `"project":"X"` 精确 grep，带空格会全部漏配（2026-07-04 实测踩坑）
1. **只追加，永不修改旧行**——历史即审计轨迹
2. 同 key 出新认识 → 追加新条目，`supersedes` 指向旧条目，旧条目视为 superseded（读取时按 ts 取最新）
3. 每次复盘只落 **2-3 条**真实冒出来的教训，禁止为覆盖四个能力域硬凑
4. 写入前 grep 同 key 旧条目：结论一致 → 置信度 +1 追加；矛盾 → 新条目 supersedes 旧条目，并在一页纸里明说"推翻了之前的认识"

## 复发检测（每次复盘必做）

1. `grep '"project":"{本项目}"' learnings.jsonl` + `grep '"project":"global"'`，取 status=active 的条目
2. 对照本次会话暴露的问题：
   - **复发**（老毛病又犯）→ 一页纸里标 🔴 复发 + 该条目置信度 +1 追加（教训是真的，但没长在身上——考虑把它加进对应 skill 的检查项）
   - **已改进**（上次的坑这次避开了）→ 一页纸里标 🟢 已改进（进步可见）
3. 复发 ≥2 次的条目：提醒用户这条该固化成流程约束了（写进项目 CLAUDE.md 特化规则或对应 forge skill）；复发 ≥3 次必须当场固化，做法见 SKILL.md 落账本一节

## 读取方（回放钩子）

- forge-bugfix P1、forge-eng 理解现状阶段：开工前回放本项目 + global 的高置信（≥7）active 条目，最多 5 条，一行一条复述给用户
- Workbench 阅览器：全量浏览/筛选/搜索
