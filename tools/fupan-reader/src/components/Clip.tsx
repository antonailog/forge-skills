import { useRef, useState, type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** 表格单元格：按列宽截断成一行或两行，末尾「…」；真被截断了，悬停才弹出全文 */
export function Clip({ children, lines = 1, className }: { children: ReactNode; lines?: 1 | 2; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const cut = () => { const el = ref.current; return !!el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) }
  return (
    <Tooltip open={open} onOpenChange={(v) => setOpen(v && cut())}>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn('block', lines === 1 ? 'truncate' : 'line-clamp-2', className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-md text-left leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
