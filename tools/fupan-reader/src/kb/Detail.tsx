import { useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronRight, Eye, Square, Star } from 'lucide-react'
import { toggleFav, useFavs } from './favs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SayBlock } from '@/components/kit'
import { Links } from '@/components/Links'
import { StateIcon } from './StateIcon'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import { remember } from '@/components/ReviewIndex'
import type { Full, Point, Source } from './types'

// 知识条目详情（居中弹窗）。顺序照单篇知识地图的右栏「先读后用」：
// 是什么、怎么判断（读）→ 下次这样说、怎么验收（用）→ 我在哪碰到过 → 延伸阅读 → 改动记录
// 没写完整条目的知识点，只有出处那一节

function Md({ text }: { text: string }) {
  return (
    <div className="prose prose-neutral max-w-none text-[15px] leading-[1.7] dark:prose-invert prose-p:my-2 prose-ul:my-1 prose-li:my-0.5 prose-code:before:content-none prose-code:after:content-none prose-code:font-normal prose-code:rounded prose-code:bg-muted prose-code:px-1 [&_table]:my-2 [&_table]:text-[15px] [&_code]:text-[15px] [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:bg-muted/50 [&_td]:px-3 [&_th]:px-3 [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:whitespace-nowrap [&_th]:whitespace-nowrap">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

const Heading = ({ children }: { children: ReactNode }) => <h4 className={T.h4}>{children}</h4> // 小节标题 18
const Sec = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cn('flex flex-col gap-2 border-t pt-5', className)}>{children}</section>
)

function SourceRow({ s }: { s: Source }) {
  return (
    <li className="flex gap-3">
      <span className="w-[104px] shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">{s.date}</span>
      <a href={s.href} onClick={remember} className="group flex min-w-0 flex-col hover:text-brand">
        {s.entry && <span className="text-base font-medium">{s.entry}</span>}
        <span className={cn('truncate', s.entry && 'text-muted-foreground group-hover:text-brand')}>{s.project} · {s.retro}</span>
      </a>
    </li>
  )
}

/** 出处：写过条目、在关键术语里出现过的全列；只提到的先列 6 篇，其余收起 */
function Sources({ p }: { p: Point }) {
  const wrote = p.sources.filter((s) => s.kind === '条目')
  const term = p.sources.filter((s) => s.kind === '术语')
  const ment = p.sources.filter((s) => s.kind === '提到')
  const [open, setOpen] = useState(false)
  if (!p.sources.length) return null
  return (
    <Sec className="gap-4">
      <Heading>我在哪碰到过</Heading>
      {wrote.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground">写过条目 {wrote.length}</span>
          <ul className="flex flex-col gap-2.5">{wrote.map((s, i) => <SourceRow key={i} s={s} />)}</ul>
        </div>
      )}
      {term.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground">关键术语里出现 {term.length}</span>
          <ul className="flex flex-col gap-2.5">{term.map((s, i) => <SourceRow key={i} s={s} />)}</ul>
        </div>
      )}
      {ment.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
          <span className="text-muted-foreground">提到它的复盘 {ment.length}</span>
          <ul className="flex flex-col gap-2">{ment.slice(0, 6).map((s, i) => <SourceRow key={i} s={s} />)}</ul>
          {ment.length > 6 && (
            <>
              <CollapsibleContent><ul className="flex flex-col gap-2">{ment.slice(6).map((s, i) => <SourceRow key={i} s={s} />)}</ul></CollapsibleContent>
              <CollapsibleTrigger className="flex w-fit items-center gap-1 text-muted-foreground hover:text-foreground">
                <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />{open ? '收起' : `其余 ${ment.length - 6} 篇`}
              </CollapsibleTrigger>
            </>
          )}
        </Collapsible>
      )}
    </Sec>
  )
}

/* ---------- 新结构：学懂 · 巩固 · 用上 ---------- */

function Quiz({ q, a, i }: { q: string; a: string; i: number }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-4">
      <p className={T.headline}>{i + 1}. {q}</p>
      {open ? <p className="text-muted-foreground">{a}</p> : (
        <button type="button" onClick={() => setOpen(true)} className="flex w-fit items-center gap-1.5 text-muted-foreground hover:text-foreground"><Eye className="size-4" />想好了，看答案</button>
      )}
    </li>
  )
}

const Part = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} className="flex flex-col gap-6 border-t-2 border-foreground/80 pt-5 first:border-t-0 first:pt-0">
    <h3 className={T.h3}>{title}</h3>
    {children}
  </section>
)
const Sub = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-3"><Heading>{title}</Heading>{children}</div>
)

function NewBody({ f, onJump }: { f: Full; onJump?: (id: string) => void }) {
  // AI 写的知识点可能缺段、缺字段：缺的整段不出，不让整个弹窗报错
  const alias = f.aliases?.length ? <p className="text-muted-foreground">也叫：{f.aliases.join('、')}</p> : null
  const learn = f.learn!, { review, use } = f
  const rel = learn.relations ?? []
  return (
    <>
      <Part id="k-learn" title="原理讲解">
        {learn.what && <Sub title="是什么"><Md text={learn.what} />{alias}</Sub>}
        {learn.why && <Sub title="为什么这样"><Md text={learn.why} /></Sub>}
        {learn.how && <Sub title="一个完整例子"><Md text={learn.how} /></Sub>}
        {learn.compare && <Sub title="几种做法怎么选"><Md text={learn.compare} /></Sub>}
        {rel.length > 0 && <Sub title="和旁边的知识">
          <ul className="flex flex-col gap-2">
            {rel.map((r) => (
              <li key={r.name} className="flex flex-wrap items-baseline gap-x-2">
                <button type="button" onClick={() => r.id && onJump?.(r.id)} className="text-base font-medium text-brand hover:underline">{r.name}</button>
                <span className="text-muted-foreground">{r.note}</span>
              </li>
            ))}
          </ul>
        </Sub>}
      </Part>

      {review && <Part id="k-review" title="练习回顾">
        {(review.quiz ?? []).length > 0 && <Sub title="自测：先想，再看答案">
          <ol className="flex flex-col gap-3">{review.quiz.map((x, i) => <Quiz key={i} q={x.q} a={x.a} i={i} />)}</ol>
        </Sub>}
        {(review.cases ?? []).length > 0 && <Sub title="我的案例">
          <ul className="flex flex-col gap-3">
            {review.cases.map((c, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-lg bg-muted/50 p-4">
                <a href={c.href} {...(c.href?.startsWith('#') ? { onClick: remember } : { target: '_blank', rel: 'noopener' })} className="flex flex-wrap items-baseline gap-x-2 hover:text-brand">
                  <span className={T.name}>{c.project}</span>
                  <span className="text-muted-foreground tabular-nums">{c.date}</span>
                  <span className="truncate text-muted-foreground">{c.title}</span>
                </a>
                <dl className="grid grid-cols-[4.5em_1fr] gap-x-2 gap-y-1.5">
                  <dt className="text-muted-foreground">当时</dt><dd>{c.did}</dd>
                  <dt className="text-muted-foreground">定了</dt><dd>{c.decided}</dd>
                  <dt className="text-muted-foreground">踩的坑</dt><dd>{c.pitfall}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </Sub>}
        {(review.mistakes ?? []).length > 0 && <Sub title="常见误区">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">{review.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
        </Sub>}
      </Part>}

      {use && <Part id="k-use" title="实践应用">
        {(use.keywords ?? []).length > 0 && <Sub title="关键词">
          <div className="flex flex-wrap gap-2">{use.keywords.map((k) => <span key={k} className="rounded-md bg-muted px-2.5 py-1">{k}</span>)}</div>
        </Sub>}
        {(use.say ?? []).length > 0 && <Sub title="下次这样说">
          <ul className="flex flex-col gap-3">
            {use.say.map((x) => (
              <li key={x.when} className="flex flex-col gap-1.5 rounded-lg bg-brand-soft p-4">
                <span className="text-muted-foreground">{x.when}</span>
                <p className="text-base">{x.text}</p>
              </li>
            ))}
          </ul>
        </Sub>}
        {use.params && <Sub title="参数速查"><Md text={use.params} /></Sub>}
        {(use.checklist ?? []).length > 0 && <Sub title="检查清单">
          <ul className="flex flex-col gap-2">{use.checklist.map((c) => <li key={c} className="flex items-start gap-2"><Square className="mt-1 size-4 shrink-0 text-muted-foreground" />{c}</li>)}</ul>
        </Sub>}
        {use.reading && <Sub title="延伸阅读"><Links text={use.reading} /></Sub>}
      </Part>}
    </>
  )
}

/** 收藏：觉得不会的点一下，会了再点取消 */
function FavButton({ name }: { name: string }) {
  const on = useFavs().includes(name)
  return (
    <button type="button" onClick={() => toggleFav(name)} className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted', on ? 'text-foreground' : 'text-muted-foreground')}>
      <Star className={cn('size-4', on && 'fill-yellow-400 text-yellow-500')} />{on ? '已收藏' : '收藏'}
    </button>
  )
}

/** 弹窗头：固定不动。左边名字和状态，右边收藏和关闭放在一起；下面一句话 */
export function DetailHead({ p, close }: { p: Point; close?: ReactNode }) {
  const f = p.full
  return (
    <div className="flex flex-col gap-2 text-[15px]">
      <div className="flex items-center gap-3">
        <span className={T.h2}>{f?.name ?? p.name}</span>
        <StateIcon s={p.state} />
        <span className="ml-auto flex items-center gap-1"><FavButton name={p.name} />{close}</span>
      </div>
      {f && <p className={T.headline}>{f.one}</p>}
    </div>
  )
}

/** 弹窗正文：会滚动。正文统一 15，重点句和条目名 16，小节 18，段 22 */
export function DetailBody({ p, onJump }: { p: Point; onJump?: (id: string) => void }) {
  const f = p.full
  const isNew = !!f?.learn
  const top = useRef<HTMLDivElement>(null)
  useEffect(() => { top.current?.closest('[data-slot=dialog-body]')?.scrollTo({ top: 0 }) }, []) // 从相关知识跳过来时回到顶部
  return (
    <div ref={top} className="flex flex-col gap-6 text-[15px]">
      {isNew && f && <NewBody f={f} onJump={onJump} />}
      {/* 旧结构：是什么、怎么判断、下次这样说、怎么验收、延伸阅读 */}
      {!isNew && f && (
        <>
          {f.what && <Sec><Heading>是什么</Heading><Md text={f.what} />{f.aliases?.length ? <p className="text-muted-foreground">也叫：{f.aliases.join('、')}</p> : null}</Sec>}
          {f.judge && <Sec><Heading>怎么判断</Heading><Md text={f.judge} /></Sec>}
          {(f.say || f.verify) && <section className="flex flex-col gap-3 border-t pt-5">
            {f.say && <SayBlock text={f.say} />}
            {f.verify && <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-4"><Heading>怎么验收</Heading><p>{f.verify}</p></div>}
          </section>}
          {f.reading && <Sec><Heading>延伸阅读</Heading><Links text={f.reading} /></Sec>}
        </>
      )}
      {/* 附录：这个知识点在哪些复盘里碰到过、条目怎么来的；和另外三段同级 */}
      <section className="mt-6 flex flex-col gap-5 rounded-lg bg-muted/40 p-5">
        <h3 className={T.h3}>附录：来源与修订记录</h3>
        <Sources p={p} />
        {p.log && <Sec><Heading>改动记录</Heading><p className="text-muted-foreground">{p.log}</p></Sec>}
      </section>
    </div>
  )
}
