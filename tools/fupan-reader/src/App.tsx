import { useEffect, useMemo, useState } from 'react'
import { Deliverables } from '@/components/Deliverables'
import { Leftovers } from '@/components/Leftovers'
import { FileSheet } from '@/components/FileSheet'
import { Review } from '@/components/Review'
import { Knowledge } from '@/components/Knowledge'
import { Terms } from '@/components/Terms'
import { Summary, Process, Decisions, Results } from '@/components/Overview'
import { V as v } from '@/variants'
import { cn } from '@/lib/utils'
import { SideNav, useScrollSpy } from '@/components/SideNav'
import { backHref, backLabel } from '@/components/ReviewIndex'
import { T } from '@/typo'
import type { Opened, ReviewPage } from '@/types'

type TocItem = { id: string; n?: string; label: string; level: 1 | 2 | 3 }
/** 左侧目录：章 → 节 → 小节，点了跳到锚点；滚动时高亮当前所在的那一项。数据里没有的小节不进目录（页面上也不出） */
function tocOf(d: ReviewPage): TocItem[] {
  const r = d.review
  const all: (TocItem & { on?: boolean })[] = [
    { id: 'summary', n: '', label: '摘要', level: 1 },
    { id: 'ch1', n: '一', label: '工作总结', level: 1 },
    { id: 'process', label: '过程回顾', level: 2, on: r.overview.stages.length > 0 },
    { id: 'decisions', label: '关键决策', level: 2, on: r.overview.decisions.length > 0 },
    { id: 'results', label: '结果评估', level: 2, on: r.overview.goals.length > 0 },
    { id: 'deliverables', label: '交付物', level: 2, on: d.results.length + d.keyFiles.length + d.code.modules.length + d.others.groups.length + d.others.server.length > 0 },
    { id: 'd-results', label: '结果', level: 3, on: d.results.length > 0 },
    { id: 'd-keyfiles', label: '关键文件', level: 3, on: d.keyFiles.length > 0 },
    { id: 'd-code', label: '关键代码', level: 3, on: d.code.modules.length > 0 },
    { id: 'd-others', label: '其余产出', level: 3, on: d.others.groups.some((g) => g.rows.length > 0) || d.others.server.length > 0 },
    { id: 'leftovers', label: '遗留事项', level: 2, on: d.leftovers.items.length > 0 },
    { id: 'ch2', n: '二', label: '工作复盘', level: 1, on: r.bench.length + r.expression.length > 0 },
    { id: 'bench', label: '对标分析', level: 2, on: r.bench.length > 0 },
    { id: 'expression', label: '需求表达', level: 2, on: r.expression.length > 0 },
    { id: 'ch3', n: '三', label: '知识拓展', level: 1, on: r.knowledge.entries.length + r.glossary.modules.length > 0 },
    { id: 'kmap', label: '知识地图', level: 2, on: r.knowledge.entries.length > 0 },
    { id: 'terms', label: '关键术语', level: 2, on: r.glossary.modules.length > 0 },
  ]
  return all.filter((t) => t.on !== false)
}

function Chapter({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-10">
      <h2 id={id} className={cn(T.h2, 'scroll-mt-8 border-b pb-3')}>{title}</h2>
      {children}
    </section>
  )
}

export default function App({ data, dark }: { data: ReviewPage; dark: boolean }) {
  const [opened, setOpened] = useState<Opened>(null)
  const toc = useMemo(() => tocOf(data), [data])
  const [active, pick] = useScrollSpy(useMemo(() => toc.map((t) => t.id), [toc]))
  const has = (id: string) => toc.some((t) => t.id === id)
  const s = data.review.overview.summary
  const back = backHref('#' + new URLSearchParams({ p: s.projects[0], m: s.module }).toString())
  useEffect(() => { document.title = data.review.overview.summary.title }, [data])

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[13rem_minmax(0,1fr)] gap-12 px-8">
      <SideNav items={toc} active={active} pick={pick} back={{ href: back, label: backLabel(back) }} hrefOf={(id) => `#${id}`} />
      <main className="flex min-w-0 flex-col gap-16 py-8">
        <Summary data={data} />
        <Chapter id="ch1" title="一、工作总结">
          {has('process') && <Process data={data} />}
          {has('decisions') && <Decisions data={data} />}
          {has('results') && <Results data={data} />}
          {has('deliverables') && <section id="deliverables" className="scroll-mt-8"><Deliverables data={data} v={v} dark={dark} open={setOpened} /></section>}
          {has('leftovers') && <section id="leftovers" className="scroll-mt-8"><Leftovers data={data} v={v} open={setOpened} /></section>}
        </Chapter>
        {has('ch2') && <Chapter id="ch2" title="二、工作复盘"><Review data={data} /></Chapter>}
        {has('ch3') && <Chapter id="ch3" title="三、知识拓展">{has('kmap') && <Knowledge data={data} />}<Terms data={data} /></Chapter>}
      </main>
      <FileSheet data={data} opened={opened} setOpened={setOpened} />
    </div>
  )
}
