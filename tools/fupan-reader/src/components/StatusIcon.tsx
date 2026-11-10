import { CircleCheck, CircleDashed, CircleDotDashed, CircleSlash, CircleX, Clock, Contrast, MessageCircle, type LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// 状态图标：状态是辅助信息，退成行首一个 16px 小图标；形状和颜色一起区分，色弱也分得清（WCAG 1.4.1）
// 图标旁不写字，悬停显示状态名；同一节顶上的计数用同样的图标带字，兼做图例
const MAP: Record<string, [LucideIcon, string]> = {
  达成: [CircleCheck, 'text-emerald-600 dark:text-emerald-400'],
  已上线: [CircleCheck, 'text-emerald-600 dark:text-emerald-400'],
  部分达成: [Contrast, 'text-amber-600 dark:text-amber-400'],
  进行中: [CircleDotDashed, 'text-amber-600 dark:text-amber-400'],
  待验证: [CircleDashed, 'text-sky-600 dark:text-sky-400'],
  未达成: [CircleX, 'text-rose-600 dark:text-rose-400'],
  移出范围: [CircleSlash, 'text-muted-foreground'],
  延后: [Clock, 'text-muted-foreground'],
  仅讨论: [MessageCircle, 'text-muted-foreground'],
}

export function StatusIcon({ s, className }: { s: string; className?: string }) {
  const [Icon, color] = MAP[s] ?? [CircleDashed, 'text-muted-foreground']
  return (
    <Tooltip>
      <TooltipTrigger asChild><Icon aria-label={s} className={cn('size-4 shrink-0', color, className)} /></TooltipTrigger>
      <TooltipContent side="top">{s}</TooltipContent>
    </Tooltip>
  )
}

/** 图标 + 状态名：摘要、汇总页每行、各节顶上的计数用 */
export function StatusText({ s, n, className }: { s: string; n?: number; className?: string }) {
  const [Icon, color] = MAP[s] ?? [CircleDashed, 'text-muted-foreground']
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <Icon aria-hidden className={cn('size-4 shrink-0', color)} />
      <span>{s}{n !== undefined && ` ${n}`}</span>
    </span>
  )
}
