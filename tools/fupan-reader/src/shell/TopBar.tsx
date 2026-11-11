import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// 工作台顶栏：左上角名字「Learn With AI」（Caveat 手写字），中间复盘 / 经验 / 知识分段按钮（11-10 定），点了在同一页里切换（改地址里的 #）。
// 没有经验库、知识库的环境（build.py 写进 index.data.js 的 workbench 标记）只显示有数据的页签；一个都没有就不显示顶栏
export type Tab = 'fupan' | 'sop' | 'kb'
const TABS: [Tab, string, string][] = [['fupan', '复盘', '#'], ['sop', '经验', '#sop'], ['kb', '知识', '#kb']]
let avail: Partial<Record<Tab, boolean>> = { sop: true, kb: true }
export const setAvail = (w?: { sop?: boolean; kb?: boolean }) => { avail = { sop: !!w?.sop, kb: !!w?.kb } }

export function TopBar({ cur }: { cur: Tab }) {
  const tabs = TABS.filter(([k]) => k === 'fupan' || k === cur || avail[k])
  if (tabs.length < 2) return null
  return (
    <header className="h-14 border-b">
      {/* 左上角名字和复盘汇总页左栏的字对齐（同一个 1400 外框）；底边线算在 h-14 里，知识页 100vh - 3.5rem 正好一屏 */}
      <div className="mx-auto grid h-full max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-8">
      <span className="wordmark justify-self-start">Learn With AI</span>
      <nav className="flex rounded-lg bg-muted p-1">
        {tabs.map(([k, label, href]) => (
          <a key={k} href={href} className={cn('relative rounded-md px-5 py-1 transition-colors', k === cur ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {k === cur && <motion.span layoutId="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-md bg-background shadow-sm" />}
            <span className="relative">{label}</span>
          </a>
        ))}
      </nav>
      </div>
    </header>
  )
}
