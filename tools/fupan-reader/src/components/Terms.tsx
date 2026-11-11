import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight } from 'lucide-react'
import { TermIcon } from '@/components/TermIcon'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { GKind, GModule, GWord, SessionData } from '@/types'

// 三、知识拓展 · 关键术语：按这次碰到的领域分模块，左边模块名，右边三列词条（图标 + 词名，一行一个、不折行）；
// 悬停一行，旁边浮出这条的详情（类别、本次用没用、一句话、出处和出处里怎么说）。浮窗只有一块，在行与行之间滑动，
// 放在这一行右边（放不下就左边），竖向对齐这一行并夹在视口里；页面一滚就收起。做法照博客首页 Skill 列表的 .sk-peek，
// 不同的是鼠标能移进浮窗停住、点出处：离开词条或浮窗后留 300ms 再收（Radix HoverCard 的默认 closeDelay）
// 各模块的「下次这样说」集中放在词条下面

type P = { data: SessionData }
type Hue = { solid: string; soft: string; text: string }
/** 领域色按模块顺序取，只代表「哪个领域」，不带好坏含义 */
const HUES: Hue[] = [
  { solid: 'bg-sky-500', soft: 'bg-sky-50 dark:bg-sky-400/10', text: 'text-sky-700 dark:text-sky-300' },
  { solid: 'bg-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-400/10', text: 'text-emerald-700 dark:text-emerald-300' },
  { solid: 'bg-violet-500', soft: 'bg-violet-50 dark:bg-violet-400/10', text: 'text-violet-700 dark:text-violet-300' },
  { solid: 'bg-orange-500', soft: 'bg-orange-50 dark:bg-orange-400/10', text: 'text-orange-700 dark:text-orange-300' },
  { solid: 'bg-teal-500', soft: 'bg-teal-50 dark:bg-teal-400/10', text: 'text-teal-700 dark:text-teal-300' },
  { solid: 'bg-rose-500', soft: 'bg-rose-50 dark:bg-rose-400/10', text: 'text-rose-700 dark:text-rose-300' },
]
const KINDS: GKind[] = ['选型', '效果', '做法']
const SIDE: Record<GWord['side'], string> = { mine: '本次用了', talked: '讨论过、没用', base: '行业做法' }
const mods = (d: SessionData) => d.review.glossary.modules
const hue = (d: SessionData, m: GModule) => HUES[mods(d).indexOf(m) % HUES.length]
/** 块内顺序：选型 → 效果 → 做法；同类里本次用了的在前 */
const ordered = (m: GModule) => KINDS.flatMap((k) => m.words.filter((w) => w.kind === k).sort((a, b) => (a.side === 'mine' ? 0 : 1) - (b.side === 'mine' ? 0 : 1)))
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(x, hi))

const Domain = ({ m, h }: { m: GModule; h: Hue }) => (
  <span className="inline-flex items-center gap-2 whitespace-nowrap"><span className={cn('size-2.5 shrink-0 rounded-full', h.solid)} /><span className="text-muted-foreground">{m.area}</span><span className="font-medium">{m.name}</span></span>
)

const IconBox = ({ w, h, className }: { w: GWord; h: Hue; className?: string }) => (
  <span className={cn('relative grid shrink-0 place-items-center rounded-md', h.soft, h.text, className)}>
    <TermIcon name={w.icon} kind={w.kind} className="size-4" />
    {w.new && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-background" />}
  </span>
)

type Cur = { w: GWord; h: Hue; el: HTMLElement }

/** 悬停浮窗：鼠标移进来不收，出处标题可点；收起时 inert，焦点和读屏都进不去 */
function Peek({ cur, on, data, box, keep, hide }: { cur: Cur | null; on: boolean; data: SessionData; box: React.RefObject<HTMLDivElement | null>; keep: () => void; hide: () => void }) {
  const s = cur?.w.src ? data.review.sources[cur.w.src] : null
  return createPortal(
    <div ref={box} inert={!on} data-on={on} onPointerEnter={keep} onPointerLeave={hide} className="term-peek typo-body fixed top-0 left-0 z-50 flex w-[22rem] flex-col gap-3 rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg">
      {cur && (
        <>
          <span className="flex items-center gap-3">
            <IconBox w={cur.w} h={cur.h} className="size-9" />
            <span className="flex min-w-0 flex-col">
              <span className="text-base font-semibold">{cur.w.term}</span>
              <span className="text-muted-foreground">{cur.w.kind} · {SIDE[cur.w.side]}{cur.w.new && ' · 第一次见'}</span>
            </span>
          </span>
          <p>{cur.w.what}</p>
          {s && (
            <span className="flex flex-col gap-1 border-t pt-3">
              <a href={s.url} target="_blank" rel="noopener" className="flex w-fit items-center gap-1 font-medium hover:text-brand">{s.title}<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" /></a>
              <span className="text-muted-foreground">{s.publisher}</span>
              {s.note && <p className="mt-1 text-muted-foreground">{s.note}</p>}
            </span>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}

function Cards({ data }: P) {
  const [cur, setCur] = useState<Cur | null>(null)
  const [on, setOn] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const shown = useRef(false)
  const hideT = useRef(0)
  const curRef = useRef<Cur | null>(null)
  /** 键盘聚焦打开的：浏览器把这一行滚进视口时重新定位，不收起 */
  const byFocus = useRef(false)

  const show = (el: HTMLElement, w: GWord, h: Hue, focus = false) => {
    window.clearTimeout(hideT.current)
    byFocus.current = focus
    if (shown.current && cur?.el === el) return
    setCur({ w, h, el })
  }
  const hide = (now?: boolean) => {
    window.clearTimeout(hideT.current)
    const go = () => { shown.current = false; setOn(false) }
    if (now) go(); else hideT.current = window.setTimeout(go, 300)
  }
  const keep = () => window.clearTimeout(hideT.current)

  /** 放在这一行右边（放不下就左边），竖向对齐这一行并夹在视口里；slide=false 时直接落位不滑 */
  const place = (slide: boolean) => {
    const p = box.current, c = curRef.current
    if (!c || !p) return
    const W = p.offsetWidth, H = p.offsetHeight, GAP = 12, M = 16
    const vw = document.documentElement.clientWidth, vh = window.innerHeight
    const r = c.el.getBoundingClientRect()
    let left: number, side: 'left' | 'right'
    if (r.right + GAP + W <= vw - M) { left = r.right + GAP; side = 'left' }
    else if (r.left - GAP - W >= M) { left = r.left - GAP - W; side = 'right' }
    else { left = clamp(r.right + GAP, M, vw - M - W); side = 'left' }
    const top = clamp(r.top + r.height / 2 - H / 2, M, vh - M - H)
    const pos = `${Math.round(left)}px ${Math.round(top)}px`
    p.style.transformOrigin = `${side} center`
    if (!slide) { p.style.transition = 'none'; p.style.translate = pos; void p.offsetWidth; p.style.transition = '' }
    else p.style.translate = pos
  }

  // 内容换了再量尺寸、定位置：第一次出现直接落在位置上再淡入，之后在行与行之间滑过去
  useLayoutEffect(() => {
    curRef.current = cur
    if (!cur) return
    place(shown.current)
    shown.current = true
    setOn(true)
  }, [cur]) // eslint-disable-line react-hooks/exhaustive-deps

  // 页面滚动、窗口变宽窄：鼠标打开的收起；键盘聚焦打开的跟着重新定位。Esc 收起（WCAG 1.4.13）
  useEffect(() => {
    const onMove = () => { if (!shown.current) return; if (byFocus.current) place(false); else hide(true) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && shown.current) hide(true) }
    window.addEventListener('scroll', onMove, { passive: true })
    window.addEventListener('resize', onMove)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('scroll', onMove); window.removeEventListener('resize', onMove); window.removeEventListener('keydown', onKey); window.clearTimeout(hideT.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col">
      {mods(data).map((m) => {
        const h = hue(data, m)
        const words = ordered(m)
        return (
          <section key={m.id} className="grid grid-cols-[13rem_minmax(0,1fr)] gap-x-6 border-t py-4 first:border-t-0 first:pt-0">
            <span className="flex items-center gap-2 self-start py-1.5"><span className={cn('size-2.5 rounded-full', h.solid)} /><span className={cn('font-semibold', h.text)}>{m.area}</span><span className={T.name}>{m.name}</span></span>
            <ul className="grid grid-flow-col grid-cols-3 gap-x-6 gap-y-1" style={{ gridTemplateRows: `repeat(${Math.ceil(words.length / 3)}, auto)` }}>
              {words.map((w) => {
                const s = w.src ? data.review.sources[w.src] : null
                const ev = {
                  onPointerEnter: (e: React.PointerEvent<HTMLElement>) => { if (e.pointerType !== 'touch') show(e.currentTarget, w, h) },
                  onPointerLeave: () => hide(),
                  onFocus: (e: React.FocusEvent<HTMLElement>) => { if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget, w, h, true) },
                  onBlur: () => hide(),
                }
                const row = 'group/row -mx-2 flex w-fit max-w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-muted focus-visible:bg-muted'
                const inner = (
                  <>
                    <IconBox w={w} h={h} className="size-7" />
                    <span className="truncate text-base font-semibold transition-colors group-hover/row:text-brand">{w.term}<span className="sr-only">：{w.what}</span></span>
                    {s && <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100" />}
                  </>
                )
                return (
                  <li key={w.term} className="min-w-0">
                    {s ? <a href={s.url} target="_blank" rel="noopener" className={row} {...ev}>{inner}</a>
                       : <span tabIndex={0} className={row} {...ev}>{inner}</span>}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <Peek cur={cur} on={on} data={data} box={box} keep={keep} hide={() => hide()} />
    </div>
  )
}

/** 各领域的「下次这样说」：集中放在词条下面，一行一句 */
function SayList({ data }: P) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-soft p-5">
      <span className="text-muted-foreground">下次这样说</span>
      {mods(data).map((m) => (
        <div key={m.id} className="grid items-start gap-x-6 gap-y-1 border-t border-brand/10 pt-2 first-of-type:border-t-0 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <Domain m={m} h={hue(data, m)} />
          <p>{m.say}</p>
        </div>
      ))}
    </div>
  )
}

export function Terms({ data }: P) {
  if (!mods(data).length) return null
  return (
    <section id="terms" className="flex scroll-mt-8 flex-col gap-4 text-sm typo-body">
      <div className="flex flex-col gap-2">
        <h3 className={T.h3}>关键术语</h3>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          这次碰到的关键词，按模块汇总
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />第一次见</span>
        </p>
      </div>
      <Cards data={data} />
      <SayList data={data} />
    </section>
  )
}
