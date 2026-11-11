export type KState = '学过' | '碰过' | '没碰过'

export type Source = {
  kind: '条目' | '术语' | '提到'
  date: string
  project: string
  retro: string
  href: string
  entry?: string
}

/** 知识条目：新结构分学懂、巩固、用上三段；旧结构（what / judge / say / verify）还没改写的条目先照旧显示 */
export type Full = {
  name: string
  aliases: string[]
  one: string
  date?: string
  what?: string
  judge?: string
  say?: string
  verify?: string
  reading?: string
  learn?: { what: string; why: string; how?: string; compare?: string; relations: { name: string; note: string; id?: string }[] }
  review?: {
    quiz: { q: string; a: string }[]
    cases: { project: string; date: string; title?: string; href?: string; did: string; decided: string; pitfall: string }[]
    mistakes: string[]
  }
  use?: { keywords: string[]; say: { when: string; text: string }[]; params: string; checklist: string[]; reading: string }
}

export type Point = {
  id: string
  name: string
  domain: string
  group: string
  state: KState
  nEntry: number
  nMention: number
  sources: Source[]
  full?: Full
  log?: string
}

export type Group = { name: string; points: string[] }
export type Domain = { name: string; groups: Group[] }

export type KData = {
  domains: Domain[]
  points: Record<string, Point>
  total: Record<KState, number>
  retros: number
}

/** 三种导航共用的选中状态 */
export type Nav = {
  data: KData
  sel: string | null
  setSel: (id: string | null) => void
}
