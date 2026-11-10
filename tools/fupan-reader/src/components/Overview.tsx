import { Fragment, useEffect, useRef, useState } from 'react'
import { LibraryBig } from 'lucide-react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EVAL } from '@/components/Review'
import { StatusIcon, StatusText } from '@/components/StatusIcon'
import { Clip } from '@/components/Clip'
import { Star } from '@/components/Star'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { SessionData } from '@/types'

// 一、工作总结 1.1–1.4

type P = { data: SessionData }
const ov = (data: SessionData) => data.review.overview

/** 决策来源：你主导的紫；否决建议、AI 没告知就定的黄（最值得回看）；其余灰 */
const SOURCE = (s: string) =>
  ['用户方案', '用户选择', '用户倾向'].includes(s) ? 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-400/15 dark:text-fuchsia-300'
  : ['否决建议', 'AI 决定 · 未告知'].includes(s) ? EVAL['待改进'] : 'bg-secondary text-secondary-foreground'

/** 决策编号：点了跳到关键决策表里那一行，并把那一行闪一下 */
function DecRef({ id }: { id: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('dec-go', { detail: id }))}
      className="inline-block rounded-md bg-secondary px-2 py-0.5 leading-snug text-secondary-foreground transition-colors hover:bg-brand-soft hover:text-brand">
      {id}
    </button>
  )
}
/** 文字里的（D3）这类编号换成可点的按钮 */
const withRefs = (text: string) => text.replace(/（(D\d+)）/g, ' $1 ').split(/(D\d+)/).map((t, i) => /^D\d+$/.test(t) ? <DecRef key={i} id={t} /> : <Fragment key={i}>{t}</Fragment>)

/* ---------- 1.1 摘要：页面最顶部 ---------- */
export function Summary({ data }: P) {
  const s = ov(data).summary
  const to = (q: Record<string, string>) => '#' + new URLSearchParams(q).toString()
  const crumb = 'rounded-md px-1.5 py-0.5 hover:bg-muted'
  return (
    <header id="summary" className="flex scroll-mt-8 flex-col gap-3 text-sm typo-body">
      {/* 回汇总页：汇总 → 项目 → 模块；本篇标题就在下面，不再重复 */}
      <Breadcrumb className="-ml-1.5">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="#" className={cn(crumb, 'inline-flex items-center gap-1.5')}><LibraryBig className="size-4" />复盘汇总</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator className="text-muted-foreground/50" />
          {s.projects.map((p, i) => (
            <Fragment key={p}>
              {i > 0 && <li aria-hidden className="text-muted-foreground/50">·</li>}
              <BreadcrumbItem><BreadcrumbLink href={to({ p })} className={crumb}>{p}</BreadcrumbLink></BreadcrumbItem>
            </Fragment>
          ))}
          <BreadcrumbSeparator className="text-muted-foreground/50" />
          <BreadcrumbItem><BreadcrumbLink href={to({ p: s.projects[0], m: s.module })} className={crumb}>{s.module}</BreadcrumbLink></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className={T.title}>{s.title}</h1>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        <span>{s.range}</span><StatusText s={s.status} />
      </p>
      <Star why={s.why} did={s.did} got={s.got} className="text-base" />
      <p className="text-muted-foreground"><span className="text-foreground">起因：</span>「{s.cause}」</p>
    </header>
  )
}

/* ---------- 1.2 过程回顾：纵向时间轴 ---------- */
export function Process({ data }: P) {
  const st = ov(data).stages
  return (
    <section id="process" className="flex scroll-mt-8 flex-col gap-4 text-sm typo-body">
      <h3 className={T.h3}>过程回顾</h3>
      <ol className="flex flex-col">
        {st.map((s, i) => (
          <li key={i} className="grid grid-cols-[7rem_1.25rem_minmax(0,1fr)] gap-x-4">
            <div className="flex flex-col items-end pt-px">
              <span>{s.start}</span>
              <span className="text-muted-foreground">{s.dur}</span>
            </div>
            <div className="relative flex justify-center">
              <span className="relative mt-2 size-2.5 rounded-full bg-muted-foreground/50" />
              {i < st.length - 1 && <span className="absolute top-6 -bottom-2 w-px bg-border" />}
            </div>
            <div className={cn('flex min-w-0 flex-col gap-2', i < st.length - 1 && 'pb-8')}>
              <span className="flex flex-wrap items-center gap-2"><span className={T.name}>{s.name}</span>{s.dec.map((d) => <DecRef key={d} id={d} />)}</span>
              <p className="text-muted-foreground">「{s.quote}」</p>
              <p>{s.story}</p>
              <p className="rounded-lg bg-muted/50 px-4 py-2.5"><span className="text-muted-foreground">产出　</span>{s.out}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ---------- 1.3 关键决策：表格 ---------- */
export function Decisions({ data }: P) {
  const ds = ov(data).decisions
  const [hl, setHl] = useState<string | null>(null)
  const rows = useRef<Record<string, HTMLTableRowElement | null>>({})
  useEffect(() => {
    let t: number | undefined
    const go = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      rows.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHl(id)
      window.clearTimeout(t)
      t = window.setTimeout(() => setHl(null), 1800)
    }
    window.addEventListener('dec-go', go)
    return () => { window.removeEventListener('dec-go', go); window.clearTimeout(t) }
  }, [])
  return (
    <section id="decisions" className="flex scroll-mt-8 flex-col gap-4 text-sm typo-body">
      <h3 className={T.h3}>关键决策</h3>
      <Card className="gap-0 py-0 shadow-none">
        <Table className="table-fixed text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[4em]">编号</TableHead><TableHead className="w-[17%]">决策</TableHead><TableHead className="w-[10em]">决策来源</TableHead>
              <TableHead>备选方案</TableHead><TableHead>理由</TableHead><TableHead className="w-[19%]">后果</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ds.map((d) => (
              <TableRow key={d.id} ref={(el) => { rows.current[d.id] = el }} className={cn('align-top transition-colors duration-700', hl === d.id ? 'bg-brand-soft hover:bg-brand-soft' : 'hover:bg-transparent')}>
                <TableCell className="text-muted-foreground">{d.id}</TableCell>
                <TableCell className="font-medium"><Clip lines={2}>{d.what}</Clip></TableCell>
                <TableCell><Badge className={cn('text-sm font-normal', SOURCE(d.source))}>{d.source}</Badge></TableCell>
                <TableCell className="text-muted-foreground"><Clip lines={2}>{d.alts}</Clip></TableCell>
                <TableCell><Clip lines={2}>{d.reason}</Clip></TableCell>
                <TableCell><Clip lines={2}>{d.effect}</Clip></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  )
}

/* ---------- 1.4 结果评估：目标树 ---------- */
export function Results({ data }: P) {
  const { goals, findings } = ov(data)
  const kids = goals.flatMap((g) => g.children)
  const counts = ['达成', '部分达成', '待验证', '未达成', '移出范围', '延后'].map((s) => [s, kids.filter((k) => k.status === s).length] as const).filter(([, n]) => n)
  const derived = goals.filter((g) => g.kind === '衍生目标').length
  return (
    <section id="results" className="flex scroll-mt-8 flex-col gap-4 text-sm typo-body">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 className={T.h3}>结果评估</h3>
        <span className="text-muted-foreground">主目标 {goals.length - derived} · 衍生目标 {derived} · 子目标 {kids.length}</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">{counts.map(([s, n]) => <StatusText key={s} s={s} n={n} />)}</span>
      </div>
      <div className="flex flex-col gap-3">
        {goals.map((g) => (
          <Card key={g.title} className="gap-0 py-0 shadow-none">
            <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 p-5">
              <StatusIcon s={g.status} className="mt-1" />
              <span className="flex flex-wrap items-baseline gap-x-3"><span className={T.name}>{g.title}</span><span className="text-muted-foreground">{g.kind}</span></span>
              <span className="col-start-2 text-muted-foreground">来源：{g.origin} · 完成标准：{g.criterion}</span>
            </div>
            {g.children.map((c) => (
              <div key={c.title} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 border-t px-5 py-3.5">
                <StatusIcon s={c.status} className="mt-1" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-muted-foreground">{withRefs(c.evidence)}</span>
                </span>
              </div>
            ))}
          </Card>
        ))}
      </div>
      {findings.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2">
          <span className="font-medium">附带发现</span>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-muted-foreground">{findings.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}
    </section>
  )
}
