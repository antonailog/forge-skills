import { useLayoutEffect } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// 工作台顶栏：左上角名字「Learn With AI」（Caveat 手写字），中间复盘 / 经验 / 知识分段按钮（11-10 定），点了在同一页里切换（改地址里的 #）。
// 没有经验库、知识库的环境（build.py 写进 index.data.js 的 workbench 标记）只显示有数据的页签；一个都没有就不显示顶栏
// 一直吸在顶上（11-11），半透明白底 + 模糊，底下的内容滚过去看得出层次；显示时把 --bar 设成顶栏高度，别的吸顶元素据此让开
export type Tab = 'fupan' | 'sop' | 'kb'
const TABS: [Tab, string, string][] = [['fupan', '复盘', '#'], ['sop', '经验', '#sop'], ['kb', '知识', '#kb']]
let avail: Partial<Record<Tab, boolean>> = { sop: true, kb: true }
export const setAvail = (w?: { sop?: boolean; kb?: boolean }) => { avail = { sop: !!w?.sop, kb: !!w?.kb } }

/** 点页签先回到顶部再换地址：顶栏吸顶后可能在页面深处点，不先回顶，滑块会从下方飞上来；同一页签（经验详情点「经验」）也回顶 */
const toTop = () => window.scrollTo({ top: 0, behavior: 'instant' })

export function TopBar({ cur }: { cur: Tab }) {
  const tabs = TABS.filter(([k]) => k === 'fupan' || k === cur || avail[k])
  const shown = tabs.length >= 2
  useLayoutEffect(() => {
    if (!shown) return
    const el = document.documentElement
    el.style.setProperty('--bar', '3.5rem')
    return () => { el.style.setProperty('--bar', '0px') }
  }, [shown])
  if (!shown) return null
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur">
      {/* 左上角名字和复盘汇总页左栏的字对齐（同一个 1400 外框）；底边线算在 h-14 里，知识页 100vh - 3.5rem 正好一屏 */}
      <div className="mx-auto grid h-full max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-8">
      <span className="wordmark justify-self-start">Learn With AI</span>
      <nav className="flex rounded-lg bg-muted p-1">
        {tabs.map(([k, label, href]) => (
          <a key={k} href={href} onClick={toTop} className={cn('relative rounded-md px-5 py-1 transition-colors', k === cur ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {k === cur && <motion.span layoutId="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-md bg-background shadow-sm" />}
            <span className="relative">{label}</span>
          </a>
        ))}
      </nav>
      </div>
    </header>
  )
}
