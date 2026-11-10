import { ArrowUpRight } from 'lucide-react'
import { CopyButton } from '@/components/kit'
import { TermIcon } from '@/components/TermIcon'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { GKind, GModule, SessionData } from '@/types'

// 三、知识拓展 · 关键术语：按这次碰到的领域分模块，一个词一张淡底色卡片（图标 + 加粗词名 + 一句能做到什么），
// 卡片底部能跳到知识地图那一条、对标分析那一步；各模块的「下次这样说」集中放在卡片下面

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
const mods = (d: SessionData) => d.review.glossary.modules
const hue = (d: SessionData, m: GModule) => HUES[mods(d).indexOf(m) % HUES.length]
/** 块内顺序：选型 → 效果 → 做法；同类里本次用了的在前 */
const ordered = (m: GModule) => KINDS.flatMap((k) => m.words.filter((w) => w.kind === k).sort((a, b) => (a.side === 'mine' ? 0 : 1) - (b.side === 'mine' ? 0 : 1)))

const Domain = ({ m, h }: { m: GModule; h: Hue }) => (
  <span className="inline-flex items-center gap-2 whitespace-nowrap"><span className={cn('size-2.5 shrink-0 rounded-full', h.solid)} /><span className="text-muted-foreground">{m.area}</span><span className="font-medium">{m.name}</span></span>
)

function Cards({ data }: P) {
  const kn = data.review.knowledge.entries
  const jump = (name: string, ev: string, id: string) => (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(ev, { detail: id }))}
      className="text-left text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-brand hover:decoration-brand">{name}</button>
  )
  return (
    <div className="flex flex-col gap-7">
      {mods(data).map((m) => {
        const h = hue(data, m)
        return (
          <section key={m.id} className="flex flex-col gap-3">
            <span className="flex items-center gap-2"><span className={cn('size-2.5 rounded-full', h.solid)} /><span className={cn('font-semibold', h.text)}>{m.area}</span><span className={T.name}>{m.name}</span></span>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ordered(m).map((w) => {
                const s = w.src ? data.review.sources[w.src] : null
                const k = w.kref ? kn.find((e) => e.id === w.kref) : null
                const step = w.step ? data.review.path.indexOf(w.step) : -1
                return (
                  <div key={w.term} className={cn('flex flex-col gap-2.5 rounded-xl p-4', h.soft)}>
                    <span className="flex items-center gap-3">
                      <span className={cn('relative grid size-10 shrink-0 place-items-center rounded-lg bg-background', h.text)}>
                        <TermIcon name={w.icon} kind={w.kind} />
                        {w.new && <span title="第一次见" className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-400 ring-2 ring-background" />}
                      </span>
                      {s ? <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-base font-semibold hover:text-brand">{w.term}<ArrowUpRight className="size-3.5 text-muted-foreground" /></a>
                        : <span className="text-base font-semibold">{w.term}</span>}
                    </span>
                    <span>{w.what}</span>
                    {(k || step >= 0) && (
                      <span className="mt-auto flex flex-col items-start gap-1 pt-1">
                        {k && jump(`知识地图：${k.title}`, 'kmap-go', k.id)}
                        {step >= 0 && jump(`对标分析第 ${step + 1} 步`, 'route-go', w.step!)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** 各领域的「下次这样说」：集中放在卡片下面，一行一句 */
function SayList({ data }: P) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-soft p-5">
      <span className="text-muted-foreground">下次这样说</span>
      {mods(data).map((m) => (
        <div key={m.id} className="grid items-start gap-x-6 gap-y-1 border-t border-brand/10 pt-2 first-of-type:border-t-0 sm:grid-cols-[13rem_minmax(0,1fr)_auto]">
          <Domain m={m} h={hue(data, m)} />
          <p>{m.say}</p>
          <CopyButton text={m.say} className="-my-1" />
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
