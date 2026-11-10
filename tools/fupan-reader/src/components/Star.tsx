import { Fragment } from 'react'
import { cn } from '@/lib/utils'

// 摘要的两行：第一行「起因 → 做法」灰色，第二行只放结果，正文色、数字加重
// 汇总页列表和单篇页顶部用同一份；列表里各截成一行，单篇页顶部不截

/** 结果里的数字加一点字重，眼睛能直接落在结果上 */
const nums = (t: string) => t.split(/(\d[\d.,/%:：–-]*)/).map((x, i) => (i % 2 ? <span key={i} className="font-medium tabular-nums">{x}</span> : <Fragment key={i}>{x}</Fragment>))

export function Star({ why, did, got, line, clip, className }: { why?: string; did?: string; got?: string; line?: string | null; clip?: boolean; className?: string }) {
  if (!why && !got) return line ? <span className={cn('text-muted-foreground', clip && 'line-clamp-2', className)}>{line}</span> : null
  return (
    <span className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <span className={cn('text-muted-foreground', clip && 'truncate')}>{[why, did].filter(Boolean).join(' → ')}</span>
      {got && <span className={cn(clip && 'truncate')}>{nums(got)}</span>}
    </span>
  )
}
