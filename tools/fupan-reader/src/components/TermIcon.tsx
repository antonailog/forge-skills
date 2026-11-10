import { icons, Boxes, ListChecks, Target, type LucideIcon } from 'lucide-react'
import { BRANDS } from '@/brands'
import { cn } from '@/lib/utils'
import type { GKind } from '@/types'

// 关键术语卡片的图标：数据里写 'si:<slug>' 用品牌标（Simple Icons，可用的见 src/brands.ts），
// 否则是 lucide 图标名（PascalCase，如 Eye、Timer）；都找不到就按词的类别给一个通用图标。颜色跟所在模块走（currentColor）
const FALLBACK: Record<GKind, LucideIcon> = { 选型: Boxes, 效果: Target, 做法: ListChecks }

export function TermIcon({ name, kind, className }: { name: string; kind: GKind; className?: string }) {
  const n = String(name ?? '')
  const path = n.startsWith('si:') && Object.hasOwn(BRANDS, n.slice(3)) ? BRANDS[n.slice(3)] : undefined
  if (path) return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn('size-5', className)}><path d={path} /></svg>
  const L = (Object.hasOwn(icons, n) ? (icons as Record<string, LucideIcon>)[n] : undefined) ?? FALLBACK[kind] ?? Boxes
  return <L aria-hidden className={cn('size-5', className)} />
}
