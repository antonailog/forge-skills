export type Eval = '一致' | '合理偏离' | '待改进' | '缺失'

/** 协作动作：你 = 思考 / 判断 / 表达 / 提供 / 感受 / 纠偏（客观的验收都归 AI 自检）；AI = 盘点 / 分析 / 发散 / 执行 / 自检 / 请示 / 交付 */
export type Kind = '思考' | '判断' | '表达' | '提供' | '感受' | '纠偏' | '盘点' | '分析' | '发散' | '执行' | '自检' | '请示' | '交付'
export type Act = {
  who: '你' | 'AI'
  kind: Kind
  text: string
  say?: boolean                                   // 下次这样说：唯一的高亮卡
  branches?: { label: string; result: string }[]  // 判断 / 分析的分支
  mine?: boolean                                  // 历史相关挂在这一下
  tips?: string[]                                 // 注意挂在这一下
}

export type Step = {
  id: string
  name: string
  key: string
  actions: string[]
  do: string
  output: string
  done: string
  say: string
  decision?: { q: string; branches: { label: string; result: string }[] }
  mine?: { eval: Eval; note: string; retro: string }
  tips: { text: string; src: string }[]
  know: string[]
  flow: Act[]                                     // 这一步人和 AI 怎么协作，按发生顺序
}

export type Sop = {
  id: string
  name: string
  domain: string                                  // 领域：照知识库骨架（前端、后端与数据、AI 工程……）
  type: string                                    // 性质：设计、构建、排查、交付……
  one: string
  purpose: string
  approach: string
  keys: string[]
  output: string
  prereq: string
  partOf: string[]
  steps: Step[]
  checklist: string[]
  cases: { date: string; project: string; title: string; retro: string; steps: string[]; topic?: string; why?: string; did?: string; got?: string }[]   // topic / why / did / got 照复盘汇总页取
  reading: string
  // 11-10 验收第二轮新加（先只有 S04，其余等批量）
  scope?: { use: string; notUse: { when: string; verb: string; sop: string }[] }
  // 输入、输出：虚构的一个例子，只放数据不放描述。图是 src/mocks/S??.tsx 里画的小样，按名字取
  io?: {
    input: string[]                                                   // 你对 AI 说的一段需求
    inputImg?: string                                                 // 输入里附的东西（截图、日志、现状页面）
    output: { title: string; rows?: [string, string][]; lines?: string[] }  // 这份经验最关键的那份产出
    result: { title: string; img: string }                            // 做完得到的东西（一张图）
  }
}
