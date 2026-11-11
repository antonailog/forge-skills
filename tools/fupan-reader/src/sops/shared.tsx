import { CircleCheck, CircleDot, CircleX, Contrast, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Eval } from './types'

import { createContext, useContext } from 'react'
import type { Sop } from './types'

/** 经验页的数据：build.py 生成的 经验.data.js（经验库 + 知识点名字 + 图片目录） */
export type SopData = { kind: 'sops'; sops: Sop[]; kmap: Record<string, string>; img: string }
export const SopCtx = createContext<SopData>({ kind: 'sops', sops: [], kmap: {}, img: '' })
export const useSops = () => useContext(SopCtx)
/** 知识点：在工作台里切到知识页并打开它 */
export const knowHref = (k: string) => '#' + new URLSearchParams({ k }).toString()

/** 复盘链接（工作台内跳转）：新版复盘是文件夹（以 / 结尾）走 #r=，旧复盘是 md 走 #o= */
export const retroHref = (p: string) =>
  '#' + new URLSearchParams(p.endsWith('/') ? { r: p.replace(/\/$/, '') } : { o: p }).toString()

/** 上次这一步做得怎样：和对标分析的四种判断同一套图标和颜色 */
export const EVAL: Record<Eval, [LucideIcon, string]> = {
  一致: [CircleCheck, 'text-emerald-600'],
  合理偏离: [CircleDot, 'text-sky-600'],
  待改进: [Contrast, 'text-amber-600'],
  缺失: [CircleX, 'text-rose-600'],
}
export function EvalIcon({ e, className }: { e: Eval; className?: string }) {
  const [I, c] = EVAL[e]
  return <I aria-label={e} className={cn('size-4 shrink-0', c, className)} />
}
