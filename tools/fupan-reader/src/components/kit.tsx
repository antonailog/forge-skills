import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 全页共用的设计零件：
// 方框三种：卡片（白底细边，一级容器）、内嵌块（浅灰底无边，卡片里的次级信息）、话术块（品牌绿底，只给「下次这样说」）
// 按钮只有一种：复制给 AI（无边框小按钮，带图标）

/** 唯一的按钮：复制给 AI */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button variant="ghost" size="sm" title={text} className={cn('h-8 shrink-0 text-muted-foreground hover:text-foreground', className)}
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })}>
      {done ? <Check /> : <Copy />}{done ? '已复制' : '复制给 AI'}
    </Button>
  )
}

/** 话术块：「下次这样说」，标签在左上、复制在右上、话术 16 号 */
export function SayBlock({ text, children, className }: { text: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg bg-brand-soft p-4', className)}>
      <span className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">下次这样说</span>
        <CopyButton text={text} className="-my-1 -mr-2" />
      </span>
      <p className="text-base">{children ?? text}</p>
    </div>
  )
}

/** 内嵌块：卡片里的次级信息 */
export const inset = 'rounded-lg bg-muted/50 p-4'

/** 用户原话：灰字 + 左侧细线，代替「」 */
export const QuoteLine = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn('border-l-2 pl-3 text-muted-foreground', className)}>{children}</p>
)
