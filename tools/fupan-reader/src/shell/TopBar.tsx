import { useLayoutEffect } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { Workbench } from '@/types'

// 工作台顶栏：左上角名字「Learn With AI」（Caveat 手写字），中间「项目 │ 专题 · 经验 · 知识」分段按钮，点了在同一页里切换（改地址里的 #）。
// 11-25 定：项目是「我现在的状态」，竖线右边三个是三种知识的维护；「复盘」不再是页签，复盘挂在各项目的时间线里
// 项目页签一直在（复盘时间线由 build.py 写进 index.data.js）；专题、经验、知识按 build.py 写的 workbench 标记，没库的不显示
// 一直吸在顶上（11-11），半透明白底 + 模糊；显示时把 --bar 设成顶栏高度，别的吸顶元素据此让开
export type Tab = 'ws' | 'topic' | 'sop' | 'kb' | 'fupan'
type Item = [Tab, string, string]
const LEFT: Item[] = [['ws', '项目', '#w']]
const RIGHT: Item[] = [['topic', '专题', '#topic'], ['sop', '经验', '#sop'], ['kb', '知识', '#kb']]
let avail: Workbench = { topic: false, sop: true, kb: true }
export const setAvail = (w?: Workbench) => { avail = { topic: !!w?.topic, sop: !!w?.sop, kb: !!w?.kb } }

/** 点页签先回到顶部再换地址：顶栏吸顶后可能在页面深处点，不先回顶，滑块会从下方飞上来；同一页签（经验详情点「经验」）也回顶 */
const toTop = () => window.scrollTo({ top: 0, behavior: 'instant' })

export function TopBar({ cur }: { cur: Tab }) {
  const right = RIGHT.filter(([k]) => k === cur || avail[k as keyof Workbench])
  useLayoutEffect(() => {
    const el = document.documentElement
    el.style.setProperty('--bar', '3.5rem')
    return () => { el.style.setProperty('--bar', '0px') }
  }, [])
  const tab = ([k, label, href]: Item) => (
    <a key={k} href={href} onClick={toTop} className={cn('relative rounded-md px-5 py-1 transition-colors', k === cur ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>
      {k === cur && <motion.span layoutId="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-md bg-background shadow-sm" />}
      <span className="relative">{label}</span>
    </a>
  )
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur">
      {/* 左上角名字和下面左栏的字对齐（同一个 1400 外框）；底边线算在 h-14 里，知识页 100vh - 3.5rem 正好一屏 */}
      <div className="mx-auto grid h-full max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-8">
      <span className="wordmark justify-self-start">Learn With AI</span>
      <nav className="flex items-center rounded-lg bg-muted p-1">
        {LEFT.map(tab)}
        {right.length > 0 && <span aria-hidden className="mx-1.5 h-4 w-px bg-foreground/20" />}
        {right.map(tab)}
      </nav>
      </div>
    </header>
  )
}
