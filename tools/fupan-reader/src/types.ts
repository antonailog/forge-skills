export type FileEntry = {
  path: string
  abs: string
  name: string
  status: string
  later: boolean
  mtime: string
  kind: 'code' | 'md' | 'html' | 'dir' | 'image'
  /** 图片：file:// 地址，抽屉里直接显示 */
  src?: string
  lang?: string
  lines?: number
  content?: string
  excerpt?: { start: number; end: number; text: string }[]
  entries?: { name: string; size: string }[]
  preview?: string
}

export type Result = {
  id: string
  title: string
  url?: string
  host: string
  meta: string
  shot?: string
  file?: string
  stale?: boolean
}

export type FlowFn = { name: string; ranges: [number, number][] }

/** 一个代码文件的讲解：负责什么、技术栈、输入输出、执行流程（每步指向函数或代码段）、设计理念 */
export type CodeFile = {
  file: string
  title: string
  detail: string
  role: string
  stack: string[]
  io: { in: string; out: string }
  flow: { step: string; desc: string; fns: FlowFn[] }[]
  ideas: string[]
}

export type Module = {
  id: string
  name: string
  role: string
  practices: [string, string][]
  files: CodeFile[]
}

export type KeyFile = { file: string; type: '文档' | '配置'; what: string; title: string; detail: string; value?: string; marks?: [number, number][] }

export type OtherRow = { file: string; use: string; change: string }

export type LeftoverItem = { owner: 'decide' | 'wait' | 'ai'; title: string; when: string; note: string; prompt: string }

export type Source = { title: string; publisher: string; url: string; note: string }
export type Eval = '一致' | '合理偏离' | '待改进' | '缺失'
/** 对标分析的一项（最佳路径上的一步）：本次 ⇄ 行业做法，差在哪、为什么、下次怎么说 */
export type Bench = {
  id: string
  step: string
  eval: Eval
  gapLine: string
  mineKw: string[]
  baseKw: string[]
  dims: { dim: string; mine: string[]; base: string[]; same: boolean }[]
  why: string
  cost: string
  say: string
  keywords: { term: string; what: string; side: 'mine' | 'base'; src: string | null }[]
  evidence: string[]
  sources: string[]
  landscape?: { name: string; x: number; y: number; src?: string; chosen?: boolean }[]
  /** 方案全景两条轴的名字：x 左→右，y 下→上 */
  axes?: { x: [string, string]; y: [string, string] }
}
/** 关键术语：只收有指向性的词。side：mine 本次用了 / talked 讨论过没用 / base 行业做法 */
export type GKind = '选型' | '效果' | '做法'
export type GWord = { term: string; kind: GKind; side: 'mine' | 'talked' | 'base'; what: string; src: string | null; new: boolean; step: string | null; kref: string | null; icon: string }
export type GModule = { id: string; area: string; name: string; words: GWord[]; say: string }

/** 三、知识拓展：一条盲区对应的知识条目；what / judge / verify / reading 是 md */
export type KEntry = { id: string; title: string; group: '盲区' | '专题' | '延伸'; kind: '架构' | '选型' | '工具' | '知识点' | null; sourceLabel: string; basis: string | null; source: string; what: string; judge: string; say: string; verify: string; reading: string; layers: string[]; step: string | null }

export type KLayer = { name: string; decide: string; chosen: string }

/** 需求表达：你的一处表达问题。type 用需求质量的标准叫法（不完整、不可验证……） */
export type Expr = { type: string; title: string; quotes: [string, string][]; effect: string; say: string }

/** 一、工作总结 1.1–1.4 */
export type Stage = { start: string; dur: string; name: string; quote: string; dec: string[]; story: string; out: string }
export type Decision = { id: string; what: string; source: string; alts: string; reason: string; effect: string }
export type Goal = { kind: '主目标' | '衍生目标'; title: string; status: string; origin: string; criterion: string; children: { status: string; title: string; evidence: string }[] }
export type Overview = {
  summary: { title: string; range: string; projects: string[]; module: string; status: string; why: string; did: string; got: string; cause: string }
  stages: Stage[]; decisions: Decision[]; goals: Goal[]; findings: string[]
}

export type SessionData = {
  session: { title: string; id: string; range: string; commit: string }
  results: Result[]
  keyFiles: KeyFile[]
  code: { flow: string; modules: Module[] }
  others: { groups: { name: string; rows: OtherRow[] }[]; server: { host: string; what: string }[] }
  leftovers: { asOf: string; items: LeftoverItem[]; status: string }
  review: { bench: Bench[]; sources: Record<string, Source>; path: string[]; task: string; glossary: { modules: GModule[] }; knowledge: { entries: KEntry[]; layers: KLayer[] }; expression: Expr[]; overview: Overview }
  files: Record<string, FileEntry>
}

/** 抽屉里打开的文件；代码文件可指定先看执行流程的第几步 */
export type Opened = { key: string; step?: number } | null

/** 页面数据：build.py 写成 window.__FUPAN__ = {...} 的 .data.js。单篇 = SessionData；汇总页 = 项目列表 */
export type ReviewPage = SessionData & { kind: 'review' }
/** href 是 #r=<项目>/<模块>/<日期-标题> */
export type IndexNew = { title: string; date: string; status: string; why: string; did: string; got: string; href: string }
/** 旧复盘：module、why/did/got 来自 旧复盘描述.json（v2）；只有 line 的是 v1 的一句话描述 */
export type IndexOld = { date: string; time: string | null; topic: string | null; title: string; path: string; rel?: string; ext: string; module?: string; why?: string; did?: string; got?: string; line?: string | null; md?: string; href?: string }
export type IndexProject = { name: string; latest: string; count: number; modules: { name: string; reviews: IndexNew[] }[]; old: IndexOld[] }
export type IndexPage = { kind: 'index'; projects: IndexProject[] }
export type PageData = ReviewPage | IndexPage
