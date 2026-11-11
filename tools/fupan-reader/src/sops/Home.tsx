import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Reveal } from '@/shell/fx'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { Sop } from './types'

// 经验首页：照复盘汇总页（03-复盘文档 ReviewIndex.tsx）——左边领域列表，右边这个领域的经验按性质（设计、构建……）分组，一份一行；点开整页进详情

/** 领域列表：和复盘汇总页的项目列表同一套（当前项品牌绿浅底 + 左边竖线，悬停一块淡灰影子） */
function DomainNav({ items, cur, pick }: { items: [string, number][]; cur: string; pick: (d: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const links = useRef<Record<string, HTMLButtonElement | null>>({})
  const list = useRef<HTMLOListElement>(null)
  const [ind, setInd] = useState<{ y: number; h: number } | null>(null)
  const [ghost, setGhost] = useState<{ y: number; h: number } | null>(null)
  const at = (id: string | null) => { const a = id ? links.current[id] : null; const o = list.current; return a && o ? { y: a.getBoundingClientRect().top - o.getBoundingClientRect().top, h: a.offsetHeight } : null }
  useLayoutEffect(() => setInd(at(cur)), [cur])
  useLayoutEffect(() => { if (hover) setGhost(at(hover)) }, [hover])
  const slide = 'pointer-events-none absolute inset-x-0 top-0 transition-[transform,height,opacity] duration-[380ms] ease-[cubic-bezier(.3,.8,.25,1)]'
  return (
    <nav className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col self-start overflow-y-auto text-sm [scrollbar-width:none]">
      <ol ref={list} className="relative grid gap-0.5" onMouseLeave={() => setHover(null)}>
        <i aria-hidden className={cn(slide, 'rounded-md bg-muted/70', hover && ghost ? 'opacity-100' : 'opacity-0')} style={ghost ? { transform: `translateY(${ghost.y}px)`, height: ghost.h } : undefined} />
        <i aria-hidden className={cn(slide, 'rounded-r-md bg-brand-soft shadow-[inset_2px_0_0_var(--brand)]', ind ? 'opacity-100' : 'opacity-0')} style={ind ? { transform: `translateY(${ind.y}px)`, height: ind.h } : undefined} />
        {items.map(([d, n]) => (
          <li key={d} className="relative">
            <button type="button" ref={(el) => { links.current[d] = el }} onMouseEnter={() => setHover(d)} onClick={() => pick(d)}
              className={cn('relative flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors', cur === d ? 'font-medium text-brand' : 'text-foreground')}>
              <span className="truncate">{d}</span>
              <span className="shrink-0 font-normal text-muted-foreground">{n}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Group({ name, n, children }: { name: string; n: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <span className="flex items-baseline gap-2.5"><span className={T.h3}>{name}</span><span className="text-muted-foreground">{n}</span></span>
      <Card className="gap-0 divide-y py-0 shadow-none">{children}</Card>
    </section>
  )
}

const row = 'group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-5 px-5 py-3.5 text-left transition-colors hover:bg-muted/50'

export function Home({ sops, domain, pick, onOpen }: { sops: Sop[]; domain: string; pick: (d: string) => void; onOpen: (id: string) => void }) {
  const domains = [...new Set(sops.map((s) => s.domain))].map((d) => [d, sops.filter((s) => s.domain === d).length] as [string, number])
  const list = sops.filter((s) => s.domain === domain)
  const types = [...new Set(list.map((s) => s.type))]
  const Row = (s: Sop) => (
    <button key={s.id} type="button" onClick={() => onOpen(s.id)} className={row}>
      <span className="flex min-w-0 flex-col gap-1">
        <span className={T.name}>{s.name}</span>
        <span className="text-muted-foreground">{s.one}</span>
      </span>
      <ChevronRight className="mt-0.5 size-4 text-muted-foreground transition-colors group-hover:text-brand" />
    </button>
  )
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[15rem_minmax(0,1fr)] gap-12 px-8 py-8 text-sm typo-body">
      <DomainNav items={domains} cur={domain} pick={pick} />
      <div className="flex min-w-0 flex-col gap-10">
        <header className="flex flex-col gap-2 border-b pb-3">
          <h1 className={T.h2}>{domain}</h1>
          <span className="text-muted-foreground">{list.length} 份</span>
        </header>
        {types.map((t, i) => <Reveal key={domain + t} delay={0.05 * i}><Group name={t} n={list.filter((s) => s.type === t).length}>{list.filter((s) => s.type === t).map(Row)}</Group></Reveal>)}
      </div>
    </div>
  )
}
