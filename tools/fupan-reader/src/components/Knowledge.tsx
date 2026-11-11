import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/viewers'
import { SayBlock } from '@/components/kit'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { KEntry, KLayer, SessionData } from '@/types'

// 三、知识拓展：三块共用一张知识地图（竖向管道 + 侧栏）
// 知识盲区：会话证据，往回补；专题学习：你说想学的，往深走；延伸学习：AI 推荐的，往外走（这类工作的下一步 / 你的长期方向）
// 左边是这类工作的结构竖排（每层写这次的选择），盲区、专题、延伸挂在各自落在的层上；右边固定显示选中的那条

type P = { data: SessionData }
type Group = KEntry['group']
const GROUPS: Group[] = ['盲区', '专题', '延伸']
/** 三块的标签色：只用在右侧详情的一个小标签上 */
const TAG: Record<Group, string> = {
  盲区: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  专题: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-400/15 dark:text-fuchsia-300',
  延伸: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
}

/* ---------- 色彩：块一律浅灰，类别只用块前一个小圆点；选中加深灰底 ---------- */
const DOTC: Record<Group, string> = { 盲区: 'bg-amber-400', 专题: 'bg-fuchsia-400', 延伸: 'bg-sky-400' }
const LABEL: Record<Group, string> = { 盲区: '知识盲区', 专题: '专题学习', 延伸: '延伸学习' }
const chipCls = (on: boolean) => on ? 'bg-foreground/10 font-medium' : 'bg-muted/60 hover:bg-muted'
const Dot = ({ g }: { g: Group }) => <span className={cn('size-2 shrink-0 rounded-full', DOTC[g])} />
const ChipText = ({ e }: { e: KEntry }) => <span className="flex items-center gap-2"><Dot g={e.group} />{e.title}</span>

const layersOf = (data: SessionData) => data.review.knowledge.layers
const firstLayer = (e: KEntry, L: KLayer[]) => Math.min(...e.layers.map((n) => L.findIndex((l) => l.name === n)))
/** 横跨整条结构：架构类盲区、跨全部层的专题，放在管道顶上 */
const spansAll = (e: KEntry, L: KLayer[]) => e.kind === '架构' || e.layers.length === L.length

function Tags({ e }: { e: KEntry }) {
  return (
    <>
      <Badge className={cn('text-sm font-normal', TAG[e.group])}>{LABEL[e.group]}</Badge>
      {e.kind && <Badge variant="secondary" className="text-sm font-normal">{e.kind}</Badge>}
    </>
  )
}

function StepLink({ e, data }: { e: KEntry; data: SessionData }) {
  if (!e.step) return null
  const i = data.review.path.indexOf(e.step)
  const b = data.review.bench.find((x) => x.id === e.step)!
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('route-go', { detail: e.step }))}
      className="w-fit text-left text-muted-foreground underline decoration-border underline-offset-4 hover:text-brand hover:decoration-brand">
      对标分析第 {i + 1} 步：{b.step}
    </button>
  )
}

/* ---------- 右侧详情的零件 ---------- */

/** md 正文：表格放进浅底容器、表头用中性灰，和段落分开 */
function Md({ text }: { text: string }) {
  return (
    <div className="[&_table]:my-1 [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:bg-muted/50 [&_td]:px-3 [&_th]:px-3 [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:whitespace-nowrap [&_th]:whitespace-nowrap">
      <Markdown text={text} />
    </div>
  )
}

/** 延伸阅读：md 里「[标题](链接)（说明）· …」拆成一行一个 */
function Links({ text }: { text: string }) {
  const items = [...text.matchAll(/\[([^\]]+)\]\(([^)]+)\)(?:（([^）]*)）)?/g)]
  if (!items.length) return <Md text={text} />
  return (
    <ul className="flex flex-col gap-2">
      {items.map(([, title, url, note]) => (
        <li key={url} className="flex flex-wrap items-baseline gap-x-2">
          <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 font-medium text-brand hover:underline">{title}<ArrowUpRight className="size-3.5" /></a>
          {note && <span className="text-muted-foreground">{note}</span>}
        </li>
      ))}
    </ul>
  )
}

/** 下次这样说：绿底 */
const Say = ({ e }: { e: KEntry }) => <SayBlock text={e.say} />

/** 标题区：只有「三块」的标签带颜色；来源那句不加竖线，直接跟在标题下 */
function Head({ e }: { e: KEntry }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2"><Tags e={e} /></span>
      <span className={T.h4}>{e.title}</span>
      <p className="text-muted-foreground"><span className="text-foreground">{e.sourceLabel}：</span>{e.source}</p>
    </div>
  )
}

const Heading = ({ children }: { children: ReactNode }) => <h4 className={T.name}>{children}</h4>

/** 右侧详情：「先读后用」的顺序，「结论先行」的元素——每节一个标题、节间分隔线；读的在前（是什么、怎么判断），用的在后（下次这样说、怎么验收），最后是链接 */
function Detail({ e, data }: { e: KEntry; data: SessionData }) {
  return (
    <div data-annot-block data-annot-heading={e.title} data-annot-level="4" className="flex flex-col gap-6">
      <Head e={e} />
      <section className="flex flex-col gap-2 border-t pt-5"><Heading>是什么</Heading><Md text={e.what} /></section>
      <section className="flex flex-col gap-2 border-t pt-5"><Heading>怎么判断</Heading><Md text={e.judge} /></section>
      <section className="flex flex-col gap-3 border-t pt-5">
        <Say e={e} />
        <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-4"><Heading>怎么验收</Heading><Md text={e.verify} /></div>
      </section>
      <section className="flex flex-col gap-2 border-t pt-5"><Heading>延伸阅读</Heading><Links text={e.reading} /><StepLink e={e} data={data} /></section>
    </div>
  )
}

function Chip({ e, sel, setSel }: { e: KEntry; sel: KEntry; setSel: (e: KEntry) => void }) {
  return (
    <button type="button" onClick={() => setSel(e)} className={cn('rounded-md px-3 py-1.5 text-left transition', chipCls(sel === e))}>
      <ChipText e={e} />
    </button>
  )
}

/* ---------- 竖向管道 + 侧栏 ---------- */
function Rail({ data }: P) {
  const L = layersOf(data)
  const all = data.review.knowledge.entries
  const top = all.filter((e) => spansAll(e, L))
  const onLayer = all.filter((e) => !spansAll(e, L) && e.layers.length)
  const outside = all.filter((e) => !e.layers.length && e.kind !== '架构')
  const [sel, setSel] = useState(onLayer.find((e) => e.group === '盲区') ?? all[0])
  // 换一条就从头读：右栏滚回顶部
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => { panel.current?.scrollTo({ top: 0 }) }, [sel])
  const blind = onLayer.filter((e) => e.group === '盲区')
  const hit = (i: number) => blind.some((e) => e.layers.includes(L[i].name))
  // 一条盲区跨两层（指标口径跨清洗、指标计算），两层之间的轨道也标黄
  const bridge = (i: number) => blind.some((e) => e.layers.includes(L[i].name) && e.layers.includes(L[i + 1]?.name))
  const groupsBy = (es: KEntry[]) => GROUPS.flatMap((g) => es.filter((e) => e.group === g))
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <Card className="gap-4 p-5 shadow-none lg:self-start">
        {top.length > 0 && <div className="flex flex-col gap-2">{groupsBy(top).map((e) => <Chip key={e.id} e={e} sel={sel} setSel={setSel} />)}</div>}
        <ol className="flex flex-col">
          {L.map((l, i) => {
            const here = groupsBy(onLayer.filter((e) => firstLayer(e, L) === i))
            return (
              <li key={l.name} className="relative flex gap-3 pb-5 last:pb-0">
                {i < L.length - 1 && <span className={cn('absolute top-8 bottom-0 left-[15px] w-0.5', bridge(i) ? 'bg-amber-300 dark:bg-amber-400/50' : 'bg-border')} />}
                <span className={cn('relative grid size-8 shrink-0 place-items-center rounded-full font-medium', hit(i) ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                  <span className="font-medium">{l.name}</span>
                  <span className="text-muted-foreground">这次：{l.chosen}</span>
                  {here.map((e) => <Chip key={e.id} e={e} sel={sel} setSel={setSel} />)}
                </div>
              </li>
            )
          })}
        </ol>
        {outside.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <span className="font-medium">往你的长期方向</span>
            {outside.map((e) => (
              <button key={e.id} type="button" onClick={() => setSel(e)} className={cn('flex flex-col rounded-md px-3 py-1.5 text-left transition', chipCls(sel === e))}>
                <ChipText e={e} />
                {e.basis && <span className="text-muted-foreground">{e.basis.replace('长期方向：', '')}</span>}
              </button>
            ))}
          </div>
        )}
      </Card>
      <Card ref={panel} className="gap-5 p-6 shadow-none lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
        <Detail e={sel} data={data} />
      </Card>
    </div>
  )
}

export function Knowledge({ data }: P) {
  const all = data.review.knowledge.entries
  const n = (g: Group) => all.filter((e) => e.group === g).length
  return (
    <div className="flex flex-col gap-6 text-sm typo-body">
      <div id="kmap" className="flex scroll-mt-8 flex-wrap items-center gap-3">
        <h3 className={T.h3}>知识地图</h3>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {GROUPS.map((g) => <span key={g} className="flex items-center gap-1.5 text-muted-foreground"><Dot g={g} />{LABEL[g]} {n(g)}</span>)}
        </p>
      </div>
      <Rail data={data} />
    </div>
  )
}
