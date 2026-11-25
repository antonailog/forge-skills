import { useEffect, useMemo, useState } from 'react'
import { SideNav } from '@/components/SideNav'
import { Badge } from '@/components/ui/badge'
import { latestOf } from '@/components/ReviewIndex'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import { api, hrefOf, type Summary } from '@/workspace/api'
import type { IndexPage, IndexProject } from '@/types'

// 项目总览：左栏「全部」+ 各区（工具、内容、活动、知识……），最后一组「其他」放没有项目页、只有复盘的；右边一行一个项目，按最近更新倒序
// 最近更新 = 项目.md 那边的更新时间和最新一篇复盘里更晚的那个；每行最后一行带最新一篇复盘的标题（11-25 定，替代原来复盘汇总的「最近」）
// 项目页服务（4300）不通时只列有复盘的项目
const ALL = '__all'
const OTHER = '其他'

type Row = { key: string; name: string; area: string; ts: number; updated: string; s?: Summary; g?: IndexProject }

/** 复盘只有日期：按当天中午算，和 项目.md 的修改时间比先后 */
const dayTs = (d: string) => Date.parse(`${d}T12:00:00+08:00`) / 1000

function rowsOf(ps: Summary[], groups: IndexProject[]): Row[] {
  const byPath = new Map(groups.filter((g) => g.path).map((g) => [g.path!, g]))
  const rows: Row[] = ps.map((s) => {
    const g = byPath.get(s.path)
    byPath.delete(s.path)
    const gt = g ? dayTs(g.latest) : 0
    return { key: s.path, name: s.name, area: s.area, s, g, ts: Math.max(s.ts, gt), updated: gt > s.ts ? g!.latest.slice(5) : s.updated }
  })
  // 服务没开（或服务不认）的：工作区路径的组按路径第一段归区，没有路径的归「其他」
  for (const g of groups) {
    if (g.path && !byPath.has(g.path)) continue
    rows.push({ key: g.key, name: g.name, area: g.path ? g.path.split('/')[0] : OTHER, g, ts: dayTs(g.latest), updated: g.latest.slice(5) })
  }
  return rows.sort((a, b) => b.ts - a.ts)
}

function Line({ r }: { r: Row }) {
  const p = r.s, c = p?.counts
  const last = r.g ? latestOf(r.g) : undefined
  return (
    <li>
      <a href={hrefOf(r.key)} className="group grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 border-b py-4 transition-colors hover:bg-muted/40">
        <span className="font-mono text-muted-foreground tabular-nums">{r.updated}</span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={cn(T.name, 'transition-colors group-hover:text-brand')}>{r.name}</span>
            <span className="text-muted-foreground">{r.area}</span>
            {c && c['等你定'] > 0 && <Badge className="bg-amber-100 text-sm font-normal text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">等你定 {c['等你定']}</Badge>}
            {p?.version === 1 && <Badge variant="secondary" className="text-sm font-normal">第一版格式</Badge>}
          </span>
          {p?.oneliner && <span className="text-muted-foreground">{p.oneliner}</span>}
          {p && p.doing.length > 0 && (
            <span className="flex flex-col gap-0.5">
              {p.doing.map((d, i) => <span key={i} className="truncate">{d.name && <span className="font-medium">{d.name}　</span>}{d.text}</span>)}
            </span>
          )}
          {c && <span className="text-muted-foreground">进行中 {c['进行中']} · 待办 {c['待办']} · 已完成 {c['已完成']}</span>}
          {last && (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 rounded bg-brand-soft px-1.5 text-brand">复盘</span>
              <span className="shrink-0 font-mono text-muted-foreground tabular-nums">{last.date.slice(5)}</span>
              <span className="truncate">{last.title}</span>
              {!p && <span className="shrink-0 text-muted-foreground">共 {r.g!.count} 篇</span>}
            </span>
          )}
        </span>
      </a>
    </li>
  )
}

export function Home({ index }: { index: IndexPage }) {
  const [ps, setPs] = useState<Summary[] | null>(null)
  const [cur, setCur] = useState(ALL)
  useEffect(() => { document.title = '项目总览'; api.projects().then(setPs, () => setPs([])) }, [])
  const rows = useMemo(() => (ps ? rowsOf(ps, index.projects) : []), [ps, index])
  const areas = useMemo(() => {
    const xs = [...new Set(rows.map((r) => r.area))].filter((a) => a !== OTHER)
    return rows.some((r) => r.area === OTHER) ? [...xs, OTHER] : xs
  }, [rows])
  if (!ps) return null
  const shown = cur === ALL ? rows : rows.filter((r) => r.area === cur)
  const wait = rows.reduce((n, r) => n + (r.s?.counts['等你定'] ?? 0), 0)
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[9rem_minmax(0,1fr)] gap-12 px-8 text-sm typo-body">
      <SideNav items={[{ id: ALL, label: '全部' }, ...areas.map((a) => ({ id: a, label: a }))]}
        active={cur} pick={(id) => { setCur(id); window.scrollTo({ top: 0 }) }} />
      <main className="flex min-w-0 flex-col gap-8 py-8">
        <header className="flex flex-col gap-2">
          <h1 className={T.title}>{cur === ALL ? '项目总览' : cur}</h1>
          <p className="text-muted-foreground">{shown.length} 个项目{wait > 0 && cur === ALL ? ` · 一共 ${wait} 件等你定` : ''} · 按最近更新排</p>
        </header>
        <ol className="flex flex-col border-t border-foreground">{shown.map((r) => <Line key={r.key} r={r} />)}</ol>
      </main>
    </div>
  )
}
