import { useEffect, useMemo, useState } from 'react'
import { SideNav } from '@/components/SideNav'
import { StatusIcon } from '@/components/StatusIcon'
import { Star } from '@/components/Star'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { IndexOld, IndexPage, IndexProject } from '@/types'
import { readKey, readRow, useReadSet } from '@/annot/read'

// 复盘汇总：你打开它主要看最近做了什么，顺带看各模块到哪了
// 左栏最上面是「最近」（默认）：所有项目按时间倒序、按月分组；点某个项目：顶上一排模块现状，下面是这个项目的时间线，点模块只看这一块
// 新版单篇点开进阅读页；旧复盘点开也是二级页面（#o=）

/** 旧复盘的地址：#o=<相对复盘根的路径>；复盘根就是这个页面所在的文件夹 */
export const rootDir = () => decodeURIComponent(location.pathname).replace(/[^/]*$/, '')
export const oldHref = (o: IndexOld) => '#' + new URLSearchParams({ o: o.rel ?? (o.path.startsWith(rootDir()) ? o.path.slice(rootDir().length) : o.path) }).toString()

/** 从汇总页点进单篇时记下位置；单篇页的「返回」回到这里，滚动位置也还原 */
const KEY = 'fupan-back'
type Back = { hash: string; y: number }
const readBack = (): Back | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') } catch { return null } }
export const backHref = (fallback: string) => readBack()?.hash ?? fallback
/** 返回按钮的字：从经验、知识点点进来的回那里 */
export const backLabel = (href: string) => /^#(s=|d=|sop)/.test(href) ? '返回经验' : /^#(k=|kb)/.test(href) ? '返回知识' : '返回复盘汇总'
/** 换页后读一次：地址正是记下的那一页（点了「返回」回来）就给出当时的滚动位置并清掉，下次从顶部开始 */
export const takeBack = (): number | null => {
  const b = readBack()
  if (!b || b.hash !== (location.hash || '#')) return null
  try { sessionStorage.removeItem(KEY) } catch { /* 清不掉也只是下次多还原一次 */ }
  return b.y
}
export const remember = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ hash: location.hash || '#', y: window.scrollY })) } catch { /* 存不了就回默认位置 */ } }

type Row = { key: string; href: string; date: string; title: string; status?: string; project: string; module: string; why?: string; did?: string; got?: string; line?: string | null }
const rowsOf = (p: IndexProject): Row[] => [
  ...p.modules.flatMap((m) => m.reviews.map((r) => ({ key: r.href, href: r.href, date: r.date, title: r.title, status: r.status, project: p.name, module: m.name, why: r.why, did: r.did, got: r.got }))),
  ...p.old.map((o) => ({ key: o.path, href: oldHref(o), date: o.date, title: o.topic ?? o.title, project: p.name, module: o.module ?? '未分模块', why: o.why, did: o.did, got: o.got, line: o.line })),
].sort((a, b) => b.date.localeCompare(a.date))

/** 各模块到哪了：最近一篇的状态和日期，加篇数；按最近一篇倒序 */
const modulesOf = (rows: Row[]) => {
  const m = new Map<string, { name: string; status?: string; date: string; n: number }>()
  rows.forEach((r) => { const x = m.get(r.module); if (x) x.n += 1; else m.set(r.module, { name: r.module, status: r.status, date: r.date, n: 1 }) })
  return [...m.values()]
}

/** 一行一篇：日期 | 状态图标 + 标题 + 路径（同一行），下面两行摘要 */
function List({ rows, cross }: { rows: Row[]; cross: boolean }) {
  const read = useReadSet()
  return (
    <ol className="flex flex-col border-t border-foreground">
      {rows.map((r) => (
        <li key={r.key}>
          <a href={r.href} onClick={remember} className={cn('group grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 border-b py-4 transition-colors hover:bg-muted/40', readRow(read.has(readKey(r.href))))}>
            <span className="font-mono text-muted-foreground tabular-nums">{r.date}</span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex min-w-0 items-center gap-2">
                {r.status && <StatusIcon s={r.status} />}
                <span className={cn(T.name, 'truncate transition-colors group-hover:text-brand')}>{r.title}</span>
                <span className="shrink-0 text-muted-foreground">{cross ? `${r.project} › ${r.module}` : r.module}</span>
              </span>
              <Star why={r.why} did={r.did} got={r.got} line={r.line} clip />
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}

/** 按月分组 */
function ByMonth({ rows, cross }: { rows: Row[]; cross: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>()
    rows.forEach((r) => { const k = r.date.slice(0, 7); m.set(k, [...(m.get(k) ?? []), r]) })
    return [...m.entries()]
  }, [rows])
  return (
    <div className="flex flex-col gap-10">
      {groups.map(([k, rs]) => (
        <section key={k} className="flex flex-col gap-3">
          <span className="flex items-baseline gap-2.5"><span className={T.h4}>{Number(k.slice(0, 4))} 年 {Number(k.slice(5))} 月</span><span className="text-muted-foreground">{rs.length}</span></span>
          <List rows={rs} cross={cross} />
        </section>
      ))}
    </div>
  )
}

const RECENT = '__recent'
const hashQ = () => new URLSearchParams(location.hash.slice(1))

export function ReviewIndex({ data }: { data: IndexPage }) {
  const projects = data.projects
  const [cur, setCur] = useState(() => { const p = hashQ().get('p'); return p && projects.some((x) => x.name === p) ? p : RECENT })
  const [mod, setMod] = useState<string | null>(() => hashQ().get('m'))
  const p = projects.find((x) => x.name === cur)
  const all = useMemo(() => {
    const seen = new Set<string>()
    return projects.flatMap(rowsOf).filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true))).sort((a, b) => b.date.localeCompare(a.date))
  }, [projects])
  const rows = useMemo(() => (p ? rowsOf(p) : []), [p])
  const mods = useMemo(() => modulesOf(rows), [rows])
  const shown = mod ? rows.filter((r) => r.module === mod) : rows
  const go = (q: Record<string, string>) => history.replaceState(null, '', '#' + new URLSearchParams(q).toString())
  const pick = (name: string) => { setCur(name); setMod(null); go(name === RECENT ? {} : { p: name }); window.scrollTo({ top: 0 }) }
  const pickMod = (m: string) => { const next = mod === m ? null : m; setMod(next); go(next ? { p: cur, m: next } : { p: cur }) }
  useEffect(() => { document.title = p ? `复盘汇总 · ${p.name}` : '复盘汇总' }, [p])
  if (!projects.length) return <p className="p-8 text-sm text-muted-foreground">还没有复盘</p>
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[15rem_minmax(0,1fr)] gap-12 px-8 text-sm typo-body">
      <SideNav items={[{ id: RECENT, label: '最近' }, ...projects.map((x) => ({ id: x.name, label: x.name, count: x.count }))]} active={cur} pick={pick} />
      <main className="flex min-w-0 flex-col gap-8 py-8">
        {p ? (
          <>
            <header className="flex flex-col gap-4">
              <h1 className={T.title}>{p.name}</h1>
              <div className="flex flex-wrap gap-2">
                {mods.map((m) => (
                  <button key={m.name} type="button" onClick={() => pickMod(m.name)}
                    className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-colors', mod === m.name ? 'bg-brand-soft text-brand' : 'bg-muted/60 hover:bg-muted')}>
                    {m.status && <StatusIcon s={m.status} />}
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground">{m.date.slice(5)} · {m.n} 篇</span>
                  </button>
                ))}
              </div>
            </header>
            <ByMonth rows={shown} cross={false} />
          </>
        ) : (
          <>
            <h1 className={T.title}>最近</h1>
            <ByMonth rows={all} cross />
          </>
        )}
      </main>
    </div>
  )
}
