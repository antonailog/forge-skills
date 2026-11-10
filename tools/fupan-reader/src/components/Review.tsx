import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { SayBlock } from '@/components/kit'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { Bench, Eval, SessionData } from '@/types'

// 工作复盘：按最佳路径画一条路线，按判断着色；点一步，在下面展开
// 差距对（本次 ⇄ 最佳做法）、理由与代价、下次这样说、关键词、证据。原子：判断、差距对、理由与代价、话术、关键词、证据

export const EVAL: Record<Eval, string> = {
  一致: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  合理偏离: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  待改进: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  缺失: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300',
}
export const EvalBadge = ({ e }: { e: Eval }) => <Badge className={cn('text-sm font-normal', EVAL[e])}>{e}</Badge>

/** 关键词标签：本次用的是品牌色，行业基准是中性色 */
export const Chip = ({ children, side }: { children: ReactNode; side: 'mine' | 'base' }) => (
  <span className={cn('inline-flex rounded-md px-2 py-0.5', side === 'mine' ? 'bg-brand-soft text-brand' : 'bg-secondary text-secondary-foreground')}>{children}</span>
)
export const Chips = ({ items, side, className }: { items: string[]; side: 'mine' | 'base'; className?: string }) => (
  <span className={cn('flex flex-wrap items-start gap-1.5', className)}>{items.map((x) => <Chip key={x} side={side}>{x}</Chip>)}</span>
)

export const Block = ({ title, children, className }: { title: string; children: ReactNode; className?: string }) => (
  <section className={cn('flex flex-col gap-2', className)}><h4 className={T.label}>{title}</h4>{children}</section>
)

/** 下次这样说：用关键词写好的一句指令，可复制 */
const EVALS: Eval[] = ['一致', '合理偏离', '待改进', '缺失']
export const DOT: Record<Eval, string> = { 一致: 'bg-emerald-500', 合理偏离: 'bg-sky-500', 待改进: 'bg-amber-500', 缺失: 'bg-rose-500' }


/** 判断：路线上的圆点是什么颜色，这里就用同色小圆点 + 字（兼做图例），不用胶囊 */
export const EvalText = ({ e, n }: { e: Eval; n?: number }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className={cn('size-2.5 rounded-full', DOT[e])} />{e}{n !== undefined && ` ${n}`}</span>
)
const Counts = ({ items }: { items: Bench[] }) => (
  <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {EVALS.filter((e) => items.some((b) => b.eval === e)).map((e) => <EvalText key={e} e={e} n={items.filter((b) => b.eval === e).length} />)}
  </span>
)

const pathOf = (data: SessionData) => data.review.path.map((id) => data.review.bench.find((b) => b.id === id)!)

/** 关键词的紧凑写法：一行一个，术语可点，后面一句话 */
export function TermList({ b, data, side }: { b: Bench; data: SessionData; side?: 'mine' | 'base' }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {b.keywords.filter((k) => !side || k.side === side).map((k) => {
        const s = k.src ? data.review.sources[k.src] : null
        return (
          <li key={k.term} className="flex flex-wrap items-baseline gap-x-2">
            {s ? <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline">{k.term}<ArrowUpRight className="size-3.5" /></a>
               : <span className="font-medium">{k.term}</span>}
            <span className="text-muted-foreground">{k.what}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** 话术里的关键词高亮：有来源的可点 */
export function Highlight({ text, b, data }: { text: string; b: Bench; data: SessionData }) {
  const terms = b.keywords.map((k) => ({ word: (k.term ?? '').split(' ')[0], src: k.src }))
    .concat([...b.baseKw, ...b.mineKw].map((w) => ({ word: w.split('（')[0], src: null })))
    .filter((t) => t.word.length > 1 && text.includes(t.word))
    .sort((x, y) => y.word.length - x.word.length)
  if (!terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.map((t) => t.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return (
    <>
      {text.split(re).map((part, i) => {
        const t = terms.find((x) => x.word === part)
        if (!t) return <span key={i}>{part}</span>
        const s = t.src ? data.review.sources[t.src] : null
        const cls = 'font-medium text-brand underline decoration-brand/40 underline-offset-4'
        return s ? <a key={i} href={s.url} target="_blank" rel="noopener" className={cn(cls, 'hover:decoration-brand')}>{part}</a> : <span key={i} className={cls}>{part}</span>
      })}
    </>
  )
}


/** 对照表的一行：左本次、右最佳做法 */
const Pair = ({ l, r, last }: { l: ReactNode; r: ReactNode; last?: boolean }) => (
  <div className={cn('grid grid-cols-2', !last && 'border-b')}>
    <div className="flex min-w-0 flex-col gap-1.5 border-r p-4">{l}</div>
    <div className="flex min-w-0 flex-col gap-1.5 p-4">{r}</div>
  </div>
)

/** 路线一行排开，放不下就横向滑；两头还有内容时边缘淡出，选中的那一步自动滑进来 */
function HScroll({ sel, children }: { sel: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ l: false, r: false })
  const measure = () => { const b = box.current; if (b) setEdge({ l: b.scrollLeft > 1, r: b.scrollLeft < b.scrollWidth - b.clientWidth - 1 }) }
  useEffect(() => { measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }, [])
  useEffect(() => {
    const b = box.current, li = b?.querySelector<HTMLElement>(`[data-i="${sel}"]`)
    if (!b || !li) return
    const pad = 48
    if (li.offsetLeft < b.scrollLeft + pad) b.scrollTo({ left: li.offsetLeft - pad, behavior: 'smooth' })
    else if (li.offsetLeft + li.offsetWidth > b.scrollLeft + b.clientWidth - pad) b.scrollTo({ left: li.offsetLeft + li.offsetWidth - b.clientWidth + pad, behavior: 'smooth' })
  }, [sel])
  const mask = edge.l && edge.r ? 'linear-gradient(to right, transparent, #000 48px, #000 calc(100% - 48px), transparent)'
    : edge.r ? 'linear-gradient(to right, #000 calc(100% - 48px), transparent)' : edge.l ? 'linear-gradient(to right, transparent, #000 48px)' : undefined
  return <div ref={box} onScroll={measure} className="overflow-x-auto [scrollbar-width:thin]" style={{ maskImage: mask, WebkitMaskImage: mask }}>{children}</div>
}

function Route({ data }: { data: SessionData }) {
  const steps = pathOf(data)
  const [sel, setSel] = useState(Math.max(0, steps.findIndex((b) => b.eval === '待改进')))
  const routeRef = useRef<HTMLDivElement>(null)
  // 关键术语里点「第 N 步」：选中那一步并滚到路线图
  useEffect(() => {
    const go = (e: Event) => {
      const i = steps.findIndex((s) => s.id === (e as CustomEvent<string>).detail)
      if (i < 0) return
      setSel(i)
      routeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('route-go', go)
    return () => window.removeEventListener('route-go', go)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const b = steps[sel]
  const diffs = b.dims.filter((d) => !d.same)
  return (
    <div className="flex flex-col gap-6 text-sm typo-body">
      <div id="bench" className="flex scroll-mt-8 flex-col gap-2">
        <h3 className={T.h3}>对标分析</h3>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">对照「{data.review.task}」的最佳路径，看这次在哪一步偏了 <Counts items={steps} /></p>
      </div>

      <Card ref={routeRef} className="scroll-mt-6 gap-0 overflow-hidden py-0 shadow-none">
        <HScroll sel={sel}>
          <ol className="relative flex w-max gap-2 p-6">
            <span className="absolute top-[3.25rem] right-[calc(1.5rem+5rem)] left-[calc(1.5rem+5rem)] h-0.5 bg-border" />
            {steps.map((s, i) => (
              <li key={s.id} data-i={i} className="w-40 shrink-0">
                <button type="button" onClick={() => setSel(i)}
                  className={cn('relative flex w-full flex-col items-center gap-3 rounded-lg p-2 text-center transition', i === sel ? 'bg-muted' : 'hover:bg-muted/50')}>
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-base font-semibold text-white', DOT[s.eval])}>{i + 1}</span>
                  <span className="flex flex-col gap-0.5 break-words">
                    <span className="font-semibold">{s.step}</span>
                    <span className="text-muted-foreground">本次：{s.mineKw[0]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </HScroll>
      </Card>

      <Card className="gap-5 p-6 shadow-none">
        <div className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-3"><span className="text-muted-foreground">第 {sel + 1} 步</span><span className={T.h4}>{b.step}</span><span className="text-muted-foreground"><EvalText e={b.eval} /></span></span>
          <p className="text-base">{b.gapLine}</p>
        </div>
        {/* 本次｜最佳做法对照：左栏只放这次怎么做的，右栏只放该怎么做；同一维度左右对齐 */}
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-2 border-b bg-muted/40 font-medium">
            <span className="border-r px-4 py-2.5">本次</span><span className="px-4 py-2.5 text-brand">最佳做法</span>
          </div>
          {diffs.map((d) => (
            <Pair key={d.dim}
              l={<><span className="text-muted-foreground">{d.dim}</span><Chips items={d.mine} side="mine" /></>}
              r={<><span className="text-muted-foreground">{d.dim}</span><Chips items={d.base} side="base" /></>} />
          ))}
          {diffs.length === 0 && <Pair l={<span className="text-muted-foreground">这一步和最佳做法一致</span>} r={null} />}
          <Pair last
            l={<><span className="text-muted-foreground">为什么这样做</span><p>{b.why}</p><span className="pt-2 text-muted-foreground">代价</span><p>{b.cost}</p></>}
            r={<><SayBlock text={b.say}><Highlight text={b.say} b={b} data={data} /></SayBlock><span className="pt-2 text-muted-foreground">关键词</span><TermList b={b} data={data} /></>} />
        </div>
        {b.landscape && <Landscape b={b} data={data} />}
        <details className="text-muted-foreground"><summary className="w-fit transition-colors hover:text-foreground">这次的证据</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">{b.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </details>
      </Card>

    </div>
  )
}

/** 方案全景：同一类问题的可选方案摊在一张图上，本次的选择高亮，其他方案点了看官方资料 */
export function Landscape({ b, data }: { b: Bench; data: SessionData }) {
  return (
    <Block title="方案全景">
      <div className="relative h-56 rounded-lg bg-muted/50">
        <span className="absolute inset-x-0 top-1/2 border-t border-dashed" />
        <span className="absolute inset-y-0 left-1/2 border-l border-dashed" />
        {b.axes?.y && <><span className="absolute top-2 left-3 text-muted-foreground">{b.axes.y[1]}</span><span className="absolute bottom-2 left-3 text-muted-foreground">{b.axes.y[0]}</span></>}
        {b.landscape!.map((n) => {
          const pos = { left: `${n.x}%`, bottom: `${n.y}%`, transform: 'translate(-50%, 50%)' }
          const src = n.src ? data.review.sources[n.src] : undefined
          return n.chosen || !src ? (
            <span key={n.name} style={pos} className={cn('absolute rounded-full px-3 py-0.5 whitespace-nowrap', n.chosen ? 'bg-brand text-background' : 'bg-background')}>{n.name}</span>
          ) : (
            <a key={n.name} href={src.url} target="_blank" rel="noopener" style={pos}
              className="absolute rounded-full bg-background px-3 py-0.5 whitespace-nowrap transition hover:text-brand">{n.name}</a>
          )
        })}
      </div>
      {b.axes?.x && <div className="flex justify-between text-muted-foreground"><span>{b.axes.x[0]}</span><span>{b.axes.x[1]}</span></div>}
    </Block>
  )
}

/** 需求表达：你的原话和更好的说法差在哪 */
function Expression({ data }: { data: SessionData }) {
  return (
    <div className="flex flex-col gap-6 text-sm typo-body">
      <div id="expression" className="flex scroll-mt-8 flex-col gap-2">
        <h3 className={T.h3}>需求表达</h3>
        <p className="text-muted-foreground">你这次的原话和更好的说法差在哪</p>
      </div>
      <Card className="gap-0 py-0 shadow-none">
        {data.review.expression.map((x, i) => (
          <div key={x.title} className={cn('grid gap-6 p-6 lg:grid-cols-2', i && 'border-t')}>
            <div className="flex flex-col gap-3">
              <span className="flex flex-wrap items-center gap-2"><Badge className={cn('text-sm font-normal', EVAL['待改进'])}>{x.type}</Badge><span className={T.name}>{x.title}</span></span>
              <div className="flex flex-col gap-1.5">
                {x.quotes.map(([t, q], i) => <p key={i}><span className="text-muted-foreground">{t}　</span>「{q}」</p>)}
              </div>
              <p className="text-muted-foreground"><span className="text-foreground">造成了什么：</span>{x.effect}</p>
            </div>
            <SayBlock text={x.say} className="self-start" />
          </div>
        ))}
      </Card>
    </div>
  )
}

export function Review({ data }: { data: SessionData }) {
  return (
    <div className="flex flex-col gap-10">
      {data.review.bench.length > 0 && <Route data={data} />}
      {data.review.expression.length > 0 && <Expression data={data} />}
    </div>
  )
}
