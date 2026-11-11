import { Fragment, useMemo, type ReactNode } from 'react'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SideNav, useScrollSpy, type NavItem } from '@/components/SideNav'
import { Links } from '@/components/Links'
import { retroHref, useSops } from './shared'
import { remember } from '@/components/ReviewIndex'
import { Overview, Steps } from './Variants'
import { T } from '@/typo'
import type { Sop } from './types'

// 一份经验的详情页（11-10 验收后定稿）：面包屑 → 标题 → 目的 / 方法 / 关键控制点三栏 → 适用场景（浅灰底）
// → 输入 → 输出（虚构例子，只放数据；左右并排、中间箭头，文字在上、图在下）→ 步骤 → 历史相关（复盘页同款列表）→ 延伸阅读

type Open = (id: string) => void

/** 适用场景 + 不适用：浅灰底一块，「不适用」里的经验名能点开那一份 */
function Scope({ sop, all, onOpen }: { sop: Sop; all: Sop[]; onOpen: Open }) {
  const sc = sop.scope!
  const name = (id: string) => all.find((x) => x.id === id)?.name ?? id
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1 rounded-lg bg-muted/60 px-5 py-4">
      <dt className="text-muted-foreground">适用场景</dt>
      <dd>{sc.use}</dd>
      <dt className="text-muted-foreground">不适用</dt>
      <dd>
        {sc.notUse.map((u, i) => (
          <span key={u.sop}>
            {i > 0 && '；'}{u.when} → {u.verb}
            <button type="button" onClick={() => onOpen(u.sop)} className="underline-offset-4 hover:underline">「{name(u.sop)}」</button>
          </span>
        ))}
      </dd>
    </dl>
  )
}

/** 例子里的图：经验库 图/ 下的 PNG（640 宽两倍图） */
function Img({ k }: { k?: string }) {
  const { img } = useSops()
  return k ? <img src={`${img}${k}.png`} alt="" loading="lazy" className="w-full rounded-md border shadow-sm" /> : null
}

/** 输入、输出：虚构的一个例子，只放数据不放描述 */
function IO({ sop }: { sop: Sop }) {
  const io = sop.io!
  return (
    <section id="io" className="grid scroll-mt-8 grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] gap-y-3">
      <h3 className={T.h3}>输入</h3><span /><h3 className={T.h3}>输出</h3>
      <div className="flex flex-col gap-5 rounded-lg border p-5">
        <div className="flex flex-col gap-1 border-l-2 pl-4">{io.input.map((l) => <p key={l}>{l}</p>)}</div>
        {io.inputImg && <div className="w-3/4"><Img k={io.inputImg} /></div>}
      </div>
      <div className="flex items-center justify-center text-muted-foreground"><ArrowRight className="size-5" /></div>
      <div className="flex flex-col gap-5 rounded-lg border p-5">
        <div className="flex flex-col gap-2">
          <span className="font-medium">{io.output.title}</span>
          {io.output.rows && (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
              {io.output.rows.map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></Fragment>)}
            </dl>
          )}
          {io.output.lines?.map((l) => <p key={l}>{l}</p>)}
        </div>
        <div className="flex flex-col gap-2"><span className="font-medium">{io.result.title}</span><Img k={io.result.img} /></div>
      </div>
    </section>
  )
}

/** 底部历史相关：和复盘汇总页同一种行（日期 / 项目 · 主题 + 两行描述「起因 → 做法」「结果」/ ›），最近的在前 */
function Cases({ sop }: { sop: Sop }) {
  return (
    <Card className="gap-0 divide-y py-0 shadow-none">
      {[...sop.cases].sort((a, b) => b.date.localeCompare(a.date)).map((c) => (
        <a key={c.retro} href={retroHref(c.retro)} onClick={remember}
          className="group grid w-full grid-cols-[6.5rem_minmax(0,1fr)_auto] items-start gap-x-5 px-5 py-3.5 text-left transition-colors hover:bg-muted/50">
          <span className="text-muted-foreground">{c.date}</span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className={T.name}>{c.project} · {c.topic ?? c.title}</span>
            {c.why && <span className="text-muted-foreground">{[c.why, c.did].filter(Boolean).join(' → ')}</span>}
            {c.got && <span>{c.got}</span>}
          </span>
          <ChevronRight className="mt-0.5 size-4 text-muted-foreground transition-colors group-hover:text-brand" />
        </a>
      ))}
    </Card>
  )
}

/** 左边目录：和单篇复盘同一个组件；步骤不再分小项，正文里的步骤横轴已经吸顶 */
function tocOf(sop: Sop): NavItem[] {
  return ([
    ['ov', '概览', true], ['io', '输入与输出', !!sop.io], ['steps', '步骤', true], ['cases', '历史相关', true], ['reading', '延伸阅读', !!sop.reading],
  ] as [string, string, boolean][]).filter(([, , on]) => on).map(([id, label]) => ({ id, label }))
}

export function Detail({ sop, all, onOpen, crumb }: { sop: Sop; all: Sop[]; onOpen: Open; crumb: ReactNode }) {
  const toc = useMemo(() => tocOf(sop), [sop])
  const [active, pick] = useScrollSpy(useMemo(() => toc.map((t) => t.id), [toc]))
  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-[13rem_minmax(0,1fr)] gap-12 px-8">
    <SideNav items={toc} active={active} pick={pick} hrefOf={(id) => `#${id}`} />
    <div className="typo-body flex min-w-0 flex-col gap-10 py-10">
      <div id="ov" className="flex scroll-mt-8 flex-col gap-4">
        {crumb}
        <h2 className={T.h2}>{sop.name}</h2>
        <Overview sop={sop} />
        {sop.scope && <Scope sop={sop} all={all} onOpen={onOpen} />}
      </div>
      {sop.io && <IO sop={sop} />}

      <section id="steps" className="flex scroll-mt-8 flex-col gap-5">
        <h3 className={T.h3}>步骤</h3>
        <Steps key={sop.id} sop={sop} />
      </section>

      <section id="cases" className="flex scroll-mt-8 flex-col gap-3 border-t pt-6">
        <h3 className={T.h3}>历史相关</h3>
        <Cases sop={sop} />
      </section>

      {sop.reading && (
        <section id="reading" className="flex scroll-mt-8 flex-col gap-3 border-t pt-6">
          <h3 className={T.h3}>延伸阅读</h3>
          <Links text={sop.reading} />
        </section>
      )}
    </div>
    </div>
  )
}
