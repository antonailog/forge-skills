import { CircleCheck, CircleDashed, Contrast, type LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { KState } from './types'

// 掌握状态：和单篇的状态图标同一套做法，形状 + 颜色一起区分，图标旁不写字，悬停显示
// 学过 = 复盘里写过条目；碰过 = 复盘里提到过；没碰过 = 业内路线图上有、复盘里没出现
const MAP: Record<KState, [LucideIcon, string]> = {
  学过: [CircleCheck, 'text-emerald-600 dark:text-emerald-400'],
  碰过: [Contrast, 'text-amber-600 dark:text-amber-400'],
  没碰过: [CircleDashed, 'text-muted-foreground'],
}

export function StateIcon({ s, className }: { s: KState; className?: string }) {
  const [Icon, color] = MAP[s]
  return (
    <Tooltip>
      <TooltipTrigger asChild><Icon aria-label={s} className={cn('size-4 shrink-0', color, className)} /></TooltipTrigger>
      <TooltipContent side="top">{s}</TooltipContent>
    </Tooltip>
  )
}
