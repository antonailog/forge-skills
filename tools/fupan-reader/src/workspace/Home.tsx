import { useEffect, useMemo, useState } from 'react'
import { SideNav } from '@/components/SideNav'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import { api, hrefOf, type Summary } from '@/workspace/api'

// 项目总览：和复盘汇总同一个版式。左栏「全部」+ 各区（工具、内容、活动、知识），右边一行一个项目，按最近更新倒序
const ALL = '__all'

function Line({ p }: { p: Summary }) {
  const c = p.counts
  return (
    <li>
      <a href={hrefOf(p.path)} className="group grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 border-b py-4 transition-colors hover:bg-muted/40">
        <span className="font-mono text-muted-foreground tabular-nums">{p.updated}</span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={cn(T.name, 'transition-colors group-hover:text-brand')}>{p.name}</span>
            <span className="text-muted-foreground">{p.area}</span>
            {c['等你定'] > 0 && <Badge className="bg-amber-100 text-sm font-normal text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">等你定 {c['等你定']}</Badge>}
            {p.version === 1 && <Badge variant="secondary" className="text-sm font-normal">第一版格式</Badge>}
          </span>
          {p.oneliner && <span className="text-muted-foreground">{p.oneliner}</span>}
          {p.doing.length > 0 && (
            <span className="flex flex-col gap-0.5">
              {p.doing.map((d, i) => <span key={i} className="truncate">{d.name && <span className="font-medium">{d.name}　</span>}{d.text}</span>)}
            </span>
          )}
          <span className="text-muted-foreground">进行中 {c['进行中']} · 待办 {c['待办']} · 已完成 {c['已完成']}</span>
        </span>
      </a>
    </li>
  )
}

export function Home() {
  const [ps, setPs] = useState<Summary[] | null>(null)
  const [err, setErr] = useState('')
  const [cur, setCur] = useState(ALL)
  useEffect(() => { document.title = '项目总览'; api.projects().then(setPs, (e: Error) => setErr(e.message)) }, [])
  const areas = useMemo(() => [...new Set((ps ?? []).map((p) => p.area))], [ps])
  const sorted = useMemo(() => [...(ps ?? [])].sort((a, b) => b.ts - a.ts), [ps])
  if (err) return <p className="p-8 text-muted-foreground">{err}</p>
  if (!ps) return null
  const shown = cur === ALL ? sorted : sorted.filter((p) => p.area === cur)
  const wait = ps.reduce((n, p) => n + p.counts['等你定'], 0)
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[9rem_minmax(0,1fr)] gap-12 px-8 text-sm typo-body">
      <SideNav items={[{ id: ALL, label: '全部' }, ...areas.map((a) => ({ id: a, label: a }))]}
        active={cur} pick={(id) => { setCur(id); window.scrollTo({ top: 0 }) }} />
      <main className="flex min-w-0 flex-col gap-8 py-8">
        <header className="flex flex-col gap-2">
          <h1 className={T.title}>{cur === ALL ? '项目总览' : cur}</h1>
          <p className="text-muted-foreground">{shown.length} 个项目{wait > 0 && cur === ALL ? ` · 一共 ${wait} 件等你定` : ''} · 按最近更新排</p>
        </header>
        <ol className="flex flex-col border-t border-foreground">{shown.map((p) => <Line key={p.path} p={p} />)}</ol>
      </main>
    </div>
  )
}
