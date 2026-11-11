import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// 左栏：返回 → 目录 → 回到顶部（带阅读进度环），一整条钉在左边
// 每一行同一种部件：同一行高、同一图标列（22px）、同一文字起点；图标放进浅灰小方块 = 可以点的操作；品牌绿浅底 + 左边竖线 = 你在这里；淡影子 = 悬停
// 动画：点了直接到位；滚动带着走 150ms；悬停影子 100ms
// 汇总页的项目列表、单篇页目录、旧复盘页目录共用这一个

export type NavItem = { id: string; label: string; n?: string; level?: 1 | 2 | 3; count?: number }
type Box = { y: number; h: number }

const ROW = 'flex h-10 items-center gap-2.5 rounded-md px-3 -mx-3'
/** 返回、回到顶部：图标在浅灰小方块里 */
const btn = cn(ROW, 'group/btn w-[calc(100%+1.5rem)] cursor-pointer text-muted-foreground transition-colors duration-150 hover:bg-muted/70 hover:text-foreground')
const ic = 'relative grid size-[22px] shrink-0 place-items-center rounded-md bg-muted transition-colors duration-150 group-hover/btn:bg-border'

/** 阅读进度：0–1，滚动时更新；滚过一屏的 0.8 才露出「回到顶部」 */
function useScroll() {
  const [s, set] = useState({ p: 0, show: false })
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      set({ p: max > 0 ? Math.min(1, window.scrollY / max) : 0, show: window.scrollY > window.innerHeight * 0.8 })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  return s
}

/** 目录的当前项：最后一个滚过视口上沿 120px 的锚点；滚到底时取已进入视口的最后一个；点了目录就锁定，直到用户自己滚 */
export function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  const lock = useRef<string | null>(null)
  useEffect(() => {
    const current = () => {
      if (lock.current) return lock.current
      let cur = ids[0] ?? null
      const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top
        if (top !== undefined && (top <= 120 || (end && top < window.innerHeight - 80))) cur = id
      }
      return cur
    }
    const tick = () => setActive(current())
    const unlock = () => { lock.current = null }
    tick()
    window.addEventListener('scroll', tick, { passive: true })
    const evs = ['wheel', 'touchmove', 'keydown', 'pointerdown'] as const   // 拖滚动条、点「回到顶部」也解锁
    evs.forEach((ev) => window.addEventListener(ev, unlock, { passive: true }))
    return () => { window.removeEventListener('scroll', tick); evs.forEach((ev) => window.removeEventListener(ev, unlock)) }
  }, [ids])
  const pick = (id: string) => { lock.current = id; setActive(id) }
  return [active, pick] as const
}

export function SideNav({ items, active, pick, back, hrefOf }: {
  items: NavItem[]
  active: string | null
  /** 点了一项：instant 表示是点击（高亮直接到位），不是滚动带过去的 */
  pick: (id: string) => void
  back?: { href: string; label: string }
  /** 目录项是页内锚点时给 href；项目列表这类切换给空 */
  hrefOf?: (id: string) => string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const links = useRef<Record<string, HTMLElement | null>>({})
  const list = useRef<HTMLOListElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<Box | null>(null)
  const [ghost, setGhost] = useState<Box | null>(null)
  const clicked = useRef(false)
  const [instant, setInstant] = useState(true)
  const { p, show } = useScroll()
  const at = (id: string | null): Box | null => { const a = id ? links.current[id] : null; const o = list.current; return a && o ? { y: a.getBoundingClientRect().top - o.getBoundingClientRect().top, h: a.offsetHeight } : null }
  useLayoutEffect(() => {
    setInstant(clicked.current)
    clicked.current = false
    setInd(at(active))
    // 目录比栏高时，把当前项滚进目录可见范围（只滚目录，不动页面）
    const a = active ? links.current[active] : null, box = scroller.current
    if (a && box) {
      const ar = a.getBoundingClientRect(), br = box.getBoundingClientRect()
      if (ar.top < br.top + 24 || ar.bottom > br.bottom - 24) box.scrollTo({ top: box.scrollTop + ar.top - br.top - br.height / 3 })
    }
  }, [active, items]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (hover) setGhost(at(hover)) }, [hover]) // eslint-disable-line react-hooks/exhaustive-deps
  const slide = 'pointer-events-none absolute inset-x-0 top-0 ease-out'
  const R = 2 * Math.PI * 17
  return (
    <nav className="sticky top-0 flex max-h-screen flex-col gap-5 self-start py-8 text-sm">
      {back && (
        <a href={back.href} className={btn}>
          <span className={ic}><ArrowLeft className="size-3.5 transition-transform duration-150 group-hover/btn:-translate-x-0.5" /></span>
          <span className="truncate">{back.label}</span>
        </a>
      )}
      <div ref={scroller} className="-mx-3 min-h-0 overflow-y-auto px-3 [scrollbar-width:none]">
        <ol ref={list} className="relative -mx-3 grid gap-0.5" onMouseLeave={() => setHover(null)}>
          <i aria-hidden className={cn(slide, 'rounded-md bg-muted/70 transition-[transform,height,opacity] duration-100', hover && ghost ? 'opacity-100' : 'opacity-0')}
            style={ghost ? { transform: `translateY(${ghost.y}px)`, height: ghost.h } : undefined} />
          <i aria-hidden className={cn(slide, 'rounded-r-md bg-brand-soft shadow-[inset_2px_0_0_var(--brand)]', instant ? 'transition-none' : 'transition-[transform,height] duration-150', ind ? 'opacity-100' : 'opacity-0')}
            style={ind ? { transform: `translateY(${ind.y}px)`, height: ind.h } : undefined} />
          {items.map((t, k) => {
            const lv = t.level ?? 1
            const on = active === t.id
            const cls = cn('relative flex w-full items-center gap-2.5 rounded-md py-2 pr-3 text-left transition-colors duration-100',
              lv === 1 ? 'pl-3' : lv === 2 ? 'pl-11' : 'pl-[3.75rem]',
              on ? 'font-medium text-brand' : lv === 1 ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
            const body = (
              <>
                {t.n !== undefined && <span className="w-5 shrink-0 text-muted-foreground">{t.n}</span>}
                <span className="min-w-0 flex-1 truncate">{t.label}</span>
                {t.count !== undefined && <span className="shrink-0 font-normal text-muted-foreground">{t.count}</span>}
              </>
            )
            const ref = (el: HTMLElement | null) => { links.current[t.id] = el }
            const onClick = () => { clicked.current = true; pick(t.id) }
            return (
              <li key={t.id} className={cn('relative', lv === 1 && k > 0 && t.n !== undefined && 'mt-2')}>
                {lv > 1 && !on && <span aria-hidden className="absolute -top-px -bottom-px left-[22px] w-px bg-border" />}
                {hrefOf
                  ? <a ref={ref} href={hrefOf(t.id)} onMouseEnter={() => setHover(t.id)} onClick={onClick} className={cls}>{body}</a>
                  : <button ref={ref} type="button" onMouseEnter={() => setHover(t.id)} onClick={onClick} className={cls}>{body}</button>}
              </li>
            )
          })}
        </ol>
      </div>
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(btn, 'mt-auto shrink-0 transition-opacity', show ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <span className="relative grid size-[22px] shrink-0 place-items-center rounded-full transition-colors duration-150 group-hover/btn:bg-muted">
          <svg aria-hidden viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90">
            <circle cx="20" cy="20" r="17" fill="none" strokeWidth="2.5" className="stroke-border" />
            <circle cx="20" cy="20" r="17" fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-brand transition-[stroke-dashoffset] duration-150 ease-linear"
              strokeDasharray={R} strokeDashoffset={R * (1 - p)} />
          </svg>
          <ArrowUp className="size-3" />
        </span>
        <span>回到顶部</span>
      </button>
    </nav>
  )
}
