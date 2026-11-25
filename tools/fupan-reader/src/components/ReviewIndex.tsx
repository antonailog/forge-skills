import { useMemo, useState } from 'react'
import { StatusIcon } from '@/components/StatusIcon'
import { Star } from '@/components/Star'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { IndexOld, IndexProject } from '@/types'
import { readKey, readRow, useReadSet } from '@/annot/read'

// 复盘时间线：11-25 起复盘汇总页并进「项目」页签，每个项目页最后一节是它的复盘时间线（Timeline）
// 顶上一排模块现状，点模块只看这一块；下面按月分组、一行一篇
// 新版单篇点开进阅读页；旧复盘点开也是二级页面（#o=）；返回回到点进去的那个项目页

/** 旧复盘的地址：#o=<相对复盘根的路径>；复盘根就是这个页面所在的文件夹 */
export const rootDir = () => decodeURIComponent(location.pathname).replace(/[^/]*$/, '')
export const oldHref = (o: IndexOld) => '#' + new URLSearchParams({ o: o.rel ?? (o.path.startsWith(rootDir()) ? o.path.slice(rootDir().length) : o.path) }).toString()

/** 从汇总页点进单篇时记下位置；单篇页的「返回」回到这里，滚动位置也还原 */
const KEY = 'fupan-back'
/** href、top：点的那一行和它当时离视口顶的距离；项目页签的内容异步撑开，按这一行还原才准 */
type Back = { hash: string; y: number; href?: string | null; top?: number }
const readBack = (): Back | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') } catch { return null } }
export const backHref = (fallback: string) => readBack()?.hash ?? fallback
/** 返回按钮的字：从经验、知识点点进来的回那里 */
export const backLabel = (href: string) => /^#(s=|d=|sop)/.test(href) ? '返回经验' : /^#(k=|kb)/.test(href) ? '返回知识' : /^#(t=|topic)/.test(href) ? '返回专题' : '返回项目'
/** 换页后读一次：地址正是记下的那一页（点了「返回」回来）就给出当时的滚动位置并清掉，下次从顶部开始 */
export const takeBack = (): number | null => {
  const b = readBack()
  if (!b || b.hash !== (location.hash || '#')) return null
  try { sessionStorage.removeItem(KEY) } catch { /* 清不掉也只是下次多还原一次 */ }
  return b.y
}
/** 项目页签的数据要等 4300 现取，换页时还原不了：页面内容齐了再还原；没有记下的位置就回 false */
/** 项目页签的数据要等 4300 现取、文件夹列表还会陆续撑开页面：按点的那一行对齐，页面长高时跟着再对齐，直到用户自己滚（最多 3 秒）；
 *  没记下位置就回 false */
export const restore = () => {
  const b = readBack()
  if (takeBack() === null || !b) return false
  const row = b.href ? document.querySelector<HTMLElement>(`a[href="${CSS.escape(b.href)}"]`) : null
  if (!row || b.top === undefined) { requestAnimationFrame(() => window.scrollTo({ top: b.y, behavior: 'instant' })); return true }
  const align = () => window.scrollBy({ top: row.getBoundingClientRect().top - b.top!, behavior: 'instant' })
  const ro = new ResizeObserver(align)
  const stop = () => { ro.disconnect(); evs.forEach((ev) => window.removeEventListener(ev, stop)) }
  const evs = ['wheel', 'touchmove', 'keydown', 'pointerdown'] as const
  evs.forEach((ev) => window.addEventListener(ev, stop, { passive: true }))
  ro.observe(document.body)
  requestAnimationFrame(align)
  setTimeout(stop, 3000)
  return true
}
export const remember = (e?: { currentTarget: Element }) => {
  const a = e?.currentTarget
  const back: Back = { hash: location.hash || '#', y: window.scrollY, href: a?.getAttribute('href'), top: a?.getBoundingClientRect().top }
  try { sessionStorage.setItem(KEY, JSON.stringify(back)) } catch { /* 存不了就回默认位置 */ }
}

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

/** 一个项目的复盘时间线：模块筛选 + 按月列表。m 是地址里带的模块（从单篇返回时还原） */
export function Timeline({ p, m }: { p: IndexProject; m?: string | null }) {
  const rows = useMemo(() => rowsOf(p), [p])
  const mods = useMemo(() => modulesOf(rows), [rows])
  const [mod, setModState] = useState<string | null>(() => (m && mods.some((x) => x.name === m) ? m : null))
  /** 筛选写进地址（&m=），点进单篇再返回还是这个模块 */
  const setMod = (next: string | null) => {
    setModState(next)
    const q = new URLSearchParams(location.hash.slice(1))
    if (next) q.set('m', next); else q.delete('m')
    history.replaceState(null, '', '#' + q.toString().replace(/^w=(&|$)/, 'w$1'))
  }
  const shown = mod ? rows.filter((r) => r.module === mod) : rows
  return (
    <div className="flex flex-col gap-8">
      {mods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {mods.map((x) => (
            <button key={x.name} type="button" onClick={() => setMod(mod === x.name ? null : x.name)}
              className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 transition-colors', mod === x.name ? 'bg-brand-soft text-brand' : 'bg-muted/60 hover:bg-muted')}>
              {x.status && <StatusIcon s={x.status} />}
              <span className="font-medium">{x.name}</span>
              <span className="text-muted-foreground">{x.date.slice(5)} · {x.n} 篇</span>
            </button>
          ))}
        </div>
      )}
      <ByMonth rows={shown} cross={false} />
    </div>
  )
}

/** 最新一篇：项目总览每行带上 */
export const latestOf = (p: IndexProject) => rowsOf(p)[0] as Row | undefined
