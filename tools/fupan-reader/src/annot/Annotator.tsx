import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createTextQuoteSelectorMatcher, describeTextQuote } from '@apache-annotator/dom'
import { CircleQuestionMark, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotes, type Draft } from './store'
import type { Doc, Kind } from './api'
import { selectionContext } from './context'

// 划线批注：选中正文 → 弹出 ⭐ 收藏 / ❓ 疑问 → 原文上色，右侧出虚线 + 备注
// 原文上色用 CSS Custom Highlight API（不改 React 管的 DOM）；定位用 W3C TextQuoteSelector（Apache Annotator）
// 保留已定稿的 A 批注栏和引线。
export const FRAME = 'max-w-[1720px] grid-cols-[13rem_minmax(0,1fr)_17rem]'

const STROKE: Record<Kind, string> = { star: '#f59e0b', ask: '#8b5cf6' }
const NAME: Record<Kind, string> = { star: '收藏', ask: '疑问' }
const RING: Record<Kind, string> = { star: 'ring-amber-400', ask: 'ring-violet-400' }

export function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  return kind === 'star'
    ? <Star className={cn('size-4 shrink-0 fill-amber-400 text-amber-500', className)} />
    : <CircleQuestionMark className={cn('size-4 shrink-0 text-violet-500', className)} />
}

/** 备注：一行起，随字数长高；回车或 Esc 收起，中文输入法选词时的回车不算 */
function NoteField({ value, onChange, focus, onFocus, onBlur }: { value: string; onChange: (s: string) => void; focus: boolean; onFocus: () => void; onBlur: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // 字数变了、卡片宽度变了都重算高度（卡片刚出现时宽度是 0，只按字数算会撑出一大块空白）
  const fit = () => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }
  useLayoutEffect(fit, [value])
  useEffect(() => { const el = ref.current; if (!el) return; let w = el.clientWidth; const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; fit() } }); ro.observe(el); return () => ro.disconnect() }, [])
  useEffect(() => { if (focus) ref.current?.focus() }, [focus])
  return (
    <textarea ref={ref} rows={1} maxLength={2000} aria-label="备注" value={value} placeholder="备注" onChange={(e) => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur}
      onKeyDown={(e) => { if (!e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229 && (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing))) { e.preventDefault(); e.currentTarget.blur() } }}
      className="w-full min-w-0 resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70" />
  )
}

/** 原文上色的样式：CSS 构建器不认 ::highlight，放在组件里输出 */
const HL_CSS = `
::highlight(annot-star) { background-color: rgb(252 211 77 / 0.42); }
::highlight(annot-ask) { background-color: rgb(196 181 253 / 0.45); }
::highlight(annot-star-on) { background-color: rgb(252 211 77 / 0.8); }
::highlight(annot-ask-on) { background-color: rgb(167 139 250 / 0.6); }
.dark ::highlight(annot-star) { background-color: rgb(245 158 11 / 0.28); }
.dark ::highlight(annot-ask) { background-color: rgb(139 92 246 / 0.32); }
.dark ::highlight(annot-star-on) { background-color: rgb(245 158 11 / 0.5); }
.dark ::highlight(annot-ask-on) { background-color: rgb(139 92 246 / 0.55); }`

/** Range 返回排版矩形；引线和浮层只用正文内各层 overflow 裁切后仍可见的部分。 */
function visibleRects(range: Range, scope: HTMLElement, rects: DOMRect[]) {
  let left = -Infinity, top = -Infinity, right = Infinity, bottom = Infinity
  const node = range.commonAncestorContainer
  for (let el = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement; el && scope.contains(el); el = el.parentElement) {
    const style = getComputedStyle(el)
    const clipX = style.overflowX !== 'visible', clipY = style.overflowY !== 'visible'
    if (!clipX && !clipY) continue
    const bounds = el.getBoundingClientRect()
    // client 区域不包含边框和滚动条，且两轴分别裁切。
    const x = bounds.left + el.clientLeft, y = bounds.top + el.clientTop
    if (clipX) { left = Math.max(left, x); right = Math.min(right, x + el.clientWidth) }
    if (clipY) { top = Math.max(top, y); bottom = Math.min(bottom, y + el.clientHeight) }
  }
  return rects.map((r) => {
    const x = Math.max(r.left, left), y = Math.max(r.top, top)
    return new DOMRect(x, y, Math.min(r.right, right) - x, Math.min(r.bottom, bottom) - y)
  }).filter((r) => r.width > 1 && r.height > 1)
}

type Pos = { top: number; endX: number; visible: { bottom: number; startX: number; endX: number } | null }
type Bar = { id: number; x: number; y: number; range: Range }

export function Annotator({ page, doc, scope, box, col, compact = false }: {
  page: string; doc: Doc; scope: RefObject<HTMLElement | null>; box: RefObject<HTMLElement | null>; col?: RefObject<HTMLElement | null>; compact?: boolean
}) {
  const { notes, store } = useNotes(page)
  const key = notes.map((n) => n.key + n.kind + JSON.stringify(n.quote)).join(',')

  const [ranges, setRanges] = useState<Map<string, Range>>(new Map())
  const rangesRef = useRef(ranges); rangesRef.current = ranges
  const [pos, setPos] = useState<Map<string, Pos>>(new Map())
  const [geo, setGeo] = useState({ colX: 0, colW: 0 })
  const [active, setActive] = useState<string | null>(null)
  const [showPopover, setShowPopover] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [bar, setBar] = useState<Bar | null>(null)
  const selectionId = useRef(0)
  const consumedSelection = useRef<Bar | null>(null)
  const [heights, setHeights] = useState<Record<string, number>>({})
  const [tick, setTick] = useState(0)

  // 正文变了（展开、切换）就重新找一遍原句
  useEffect(() => {
    const root = scope.current
    if (!root) return
    let t = 0
    const mo = new MutationObserver(() => { clearTimeout(t); t = window.setTimeout(() => setTick((x) => x + 1), 150) })
    mo.observe(root, { childList: true, subtree: true, characterData: true })
    return () => { mo.disconnect(); clearTimeout(t) }
  }, [scope])

  useEffect(() => {
    const root = scope.current
    if (!root) return
    let dead = false
    ;(async () => {
      const m = new Map<string, Range>()
      for (const n of notes) {
        try { for await (const r of createTextQuoteSelectorMatcher({ ...n.quote, type: 'TextQuoteSelector' })(root)) { m.set(n.key, r); break } } catch { /* 找不到原句：不上色、不出卡片，保留服务里的快照 */ }
      }
      if (!dead) setRanges(m)
    })()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, page, scope])

  const measure = useCallback(() => {
    const b = box.current, root = scope.current
    if (!b || !root) return
    const br = b.getBoundingClientRect()
    const m = new Map<string, Pos>()
    ranges.forEach((r, id) => {
      const rects = [...r.getClientRects()].filter((x) => x.width > 1 && x.height > 1)
      if (!rects.length) return
      const f = rects[0], l = rects[rects.length - 1]
      const visible = visibleRects(r, root, rects), vf = visible[0], vl = visible[visible.length - 1]
      // 卡片对齐和排序仍取原句排版位置，完全裁掉也保留卡片。
      m.set(id, { top: f.top - br.top, endX: l.right - br.left,
        visible: vf && vl ? { bottom: vl.bottom - br.top, startX: vf.left - br.left, endX: vl.right - br.left } : null })
    })
    setPos(m)
    const c = col?.current?.getBoundingClientRect()
    setGeo({ colX: c ? c.left - br.left : 0, colW: c ? c.width : 0 })
  }, [ranges, box, col, scope])
  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    const ro = new ResizeObserver(() => measure())
    if (box.current) ro.observe(box.current)
    if (scope.current) ro.observe(scope.current)
    const root = scope.current
    let frame = 0
    const move = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure() }) }
    root?.addEventListener('scroll', move, { capture: true, passive: true })
    window.addEventListener('scroll', move, { capture: true, passive: true })
    window.addEventListener('resize', move)
    return () => { ro.disconnect(); cancelAnimationFrame(frame); root?.removeEventListener('scroll', move, true); window.removeEventListener('scroll', move, true); window.removeEventListener('resize', move) }
  }, [measure, box, scope])

  // 原文上色：普通、当前两档，各分收藏、疑问
  useEffect(() => {
    const hs = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const H = (window as unknown as { Highlight?: new (...r: Range[]) => { priority: number } }).Highlight
    if (!hs || !H) return
    const pick = (k: Kind, on: boolean) => notes.filter((n) => n.kind === k && (n.key === active) === on).map((n) => ranges.get(n.key)).filter((r): r is Range => !!r)
    const names: [string, Kind, boolean][] = [['annot-star', 'star', false], ['annot-ask', 'ask', false], ['annot-star-on', 'star', true], ['annot-ask-on', 'ask', true]]
    names.forEach(([name, k, on]) => { const h = new H(...pick(k, on)); h.priority = on ? 2 : 1; hs.set(name, h) })
    return () => names.forEach(([name]) => hs.delete(name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranges, active, key])

  // 松开鼠标：选中了正文就弹工具条；没选中就看点没点在某条划线上
  useEffect(() => {
    const hit = (e: MouseEvent) => {
      const d = document as unknown as { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null }
      let node: Node | null = null, off = 0
      if (d.caretPositionFromPoint) { const p = d.caretPositionFromPoint(e.clientX, e.clientY); if (p) { node = p.offsetNode; off = p.offset } }
      else if (d.caretRangeFromPoint) { const r = d.caretRangeFromPoint(e.clientX, e.clientY); if (r) { node = r.startContainer; off = r.startOffset } }
      if (!node || !scope.current?.contains(node)) return setActive(null)
      for (const [id, r] of rangesRef.current) { try { if (r.isPointInRange(node, off)) { setActive(id); if (compact) setShowPopover(true); return } } catch { /* 跨文档的点 */ } }
      setActive(null)
    }
    const up = (e: MouseEvent) => {
      if ((e.target as Element).closest?.('[data-annot-ui]')) return
      setTimeout(() => {
        const root = scope.current, b = box.current
        if (!root || !b) return
        const sel = getSelection()
        if (!sel || sel.isCollapsed || !sel.rangeCount) { setBar(null); hit(e); return }
        const r = sel.getRangeAt(0)
        const text = r.toString()
        if (!root.contains(r.startContainer) || !root.contains(r.endContainer) || (e.target as Element).closest?.('[data-annot-ui],button,input,textarea') || Array.from(text.trim()).length < 2 || Array.from(text).length > 1000) return setBar(null)
        const rr = r.getBoundingClientRect(), br = b.getBoundingClientRect()
        // 每次有效选区都重新挂载工具条，重选同一句也播放入场动画。
        setBar({ id: ++selectionId.current, x: rr.left + rr.width / 2 - br.left, y: rr.top - br.top, range: r.cloneRange() })
      })
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setBar(null)
      if (compact) { setActive(null); setShowPopover(false) }
    }
    const down = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('[data-annot-toolbar]')) setBar(null)
      if (compact && !(e.target as Element).closest?.('[data-annot-popover]')) { setActive(null); setShowPopover(false) }
    }
    document.addEventListener('mousedown', down)
    document.addEventListener('mouseup', up)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('mouseup', up); document.removeEventListener('keydown', key) }
  }, [scope, box, compact])

  const add = async (kind: Kind) => {
    const root = scope.current
    if (!bar || !root || consumedSelection.current === bar) return
    consumedSelection.current = bar
    const range = bar.range
    setBar(null)
    getSelection()?.removeAllRanges()
    const context = selectionContext(range, root, doc.title)
    const q = await describeTextQuote(range, root)
    const id = store.add({ kind, page, doc, ...context, quote: { exact: q.exact, prefix: q.prefix, suffix: q.suffix }, note: '' })
    // 直接使用刚选的 Range，提交是否成功都马上显示；随后定位器负责刷新后的还原。
    setRanges((old) => new Map(old).set(id, range))
    setEditing(compact ? null : id); setActive(id); setShowPopover(false)
  }
  const remove = (id: string) => { store.remove(id); setEditing(null) }
  const write = (id: string, note: string) => store.write(id, note)

  // 卡片高度量出来，供下面排位置用
  const layer = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = layer.current
    if (!el || compact) return
    const measureCards = () => {
      const h: Record<string, number> = {}
      el.querySelectorAll<HTMLElement>('[data-card]').forEach((c) => { h[c.dataset.card!] = c.offsetHeight })
      setHeights((old) => Object.keys(h).length !== Object.keys(old).length || Object.keys(h).some((k) => old[k] !== h[k]) ? h : old)
    }
    measureCards()
    const ro = new ResizeObserver(measureCards)
    el.querySelectorAll('[data-card]').forEach((c) => ro.observe(c))
    return () => ro.disconnect()
  }, [key, pos, compact])

  // 从上往下排：和原句同高，挤了就往下顺延
  const order = notes.filter((n) => pos.has(n.key)).sort((a, b) => pos.get(a.key)!.top - pos.get(b.key)!.top || pos.get(a.key)!.endX - pos.get(b.key)!.endX)
  const ys: Record<string, number> = {}
  let cur = -Infinity
  for (const n of order) {
    const p = pos.get(n.key)!
    const want = p.top - 3
    ys[n.key] = Math.max(want, cur)
    cur = ys[n.key] + (heights[n.key] ?? 40) + 10
  }
  const { colX, colW } = geo

  const path = (n: Draft) => {
    const p = pos.get(n.key)!.visible!, y = ys[n.key]
    return `M${p.endX + 2} ${p.bottom + 2} H${colX - 16} V${y + 19} H${colX}`
  }

  // 卡片顺延到底部时，右栏撑开滚动内容；不让最后一张被弹窗裁掉。
  useLayoutEffect(() => {
    const column = col?.current
    if (!column) return
    const top = column.offsetTop
    column.style.minHeight = order.length ? `${Math.max(0, cur - top)}px` : ''
    return () => { column.style.minHeight = '' }
  }, [col, cur, order.length])

  // 精简模式划完只上色；点击原句或保存失败才显示浮层。关闭时清掉 active，轮询不会把它重新打开。
  const popover = compact ? notes.find((n) => n.key === active && (showPopover || n.error)) : undefined
  const popoverPos = popover && pos.get(popover.key)?.visible

  return (
    <>
      <style>{HL_CSS}</style>
      <div ref={layer} data-annot-ui data-annot-layer className="pointer-events-none absolute inset-0 z-10">
        {!compact && <svg className="absolute inset-0 h-full w-full overflow-visible">
          {order.filter((n) => pos.get(n.key)!.visible).map((n) => (
            <path key={n.key} d={path(n)} fill="none" stroke={STROKE[n.kind]} strokeWidth={active === n.key ? 1.75 : 1.25}
              strokeDasharray="4 3" strokeLinejoin="round" opacity={active === n.key ? 1 : 0.35} />
          ))}
        </svg>}
        {!compact && order.map((n) => {
          const on = active === n.key || editing === n.key
          const hover = { onMouseEnter: () => setActive(n.key), onMouseLeave: () => { if (editing !== n.key) setActive(null) } }
          const field = <NoteField value={n.note} onChange={(s) => write(n.key, s)} focus={editing === n.key}
            onFocus={() => { setEditing(n.key); setActive(n.key) }} onBlur={() => { setEditing(null); void store.save(n.key) }} />
          const del = (
            <button type="button" title="删除这条划线" onMouseDown={(e) => e.preventDefault()} onClick={() => remove(n.key)} className={cn('shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground', on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
              <Trash2 className="size-4" />
            </button>
          )
          return (
            <div key={n.key} data-card={n.key} {...hover} style={{ left: colX, top: ys[n.key], width: colW }}
              className={cn('group pointer-events-auto absolute flex items-start gap-2 rounded-[8px] border bg-card px-3 py-2 shadow-xs transition-shadow', on && cn('shadow-md ring-1', RING[n.kind]))}>
              <KindIcon kind={n.kind} className="mt-[5px]" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {field}
                {n.kind === 'ask' && n.gen.status === 'done' && n.gen.explain && <p data-annot-explain className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">{n.gen.explain}</p>}
                {n.error && <span role="status" className="text-[15px] text-muted-foreground">未保存 <button type="button" disabled={n.busy} onClick={() => void store.save(n.key)} className="underline underline-offset-4">重试</button></span>}
              </div>{del}
            </div>
          )
        })}
        {popover && popoverPos && (
          <div data-annot-ui data-annot-popover role="group" aria-label={NAME[popover.kind] + '划线'}
            style={{ left: `clamp(0px, ${popoverPos.startX}px, max(0px, 100% - 18rem))`, top: popoverPos.bottom + 8 }}
            className="pointer-events-auto absolute z-20 flex w-[18rem] max-w-full flex-col gap-2 rounded-[8px] border bg-popover p-3 text-[15px] shadow-md">
            <div className="flex items-center gap-2">
              <KindIcon kind={popover.kind} className="size-[18px]" /><span>{NAME[popover.kind]}</span>
              <button type="button" title="删除这条划线" onClick={() => remove(popover.key)} className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <Trash2 className="size-4" />
              </button>
            </div>
            {popover.kind === 'ask' && popover.gen.status === 'done' && popover.gen.explain && <p data-annot-explain className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">{popover.gen.explain}</p>}
            {popover.error && <span role="status" className="text-[15px] text-muted-foreground">未保存 <button type="button" disabled={popover.busy} onClick={() => void store.save(popover.key)} className="underline underline-offset-4">重试</button></span>}
          </div>
        )}
      </div>
      {store.loadError && <div data-annot-ui className="absolute top-8 text-[15px] text-muted-foreground" style={{ left: colX }} role="status">未保存 <button type="button" className="underline underline-offset-4" onClick={() => void store.load()}>重试</button></div>}
      {bar && (
        <div key={bar.id} data-annot-ui data-annot-toolbar onMouseDown={(e) => e.preventDefault()} style={{ left: bar.x, top: bar.y }}
          className="absolute z-30 flex -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-0.5 rounded-[8px] border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-150 motion-reduce:animate-none">
          {(['star', 'ask'] as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => add(k)} className="flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[15px] text-foreground hover:bg-accent">
              <KindIcon kind={k} className="size-[18px]" /><span>{NAME[k]}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

