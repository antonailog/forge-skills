import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, BookOpen, Bot, Brain, Eye, GitFork, Hammer, Lightbulb, MessageCircleQuestion, MessageSquareQuote, Microscope, Package, Paperclip, PencilLine, Route, ScanSearch, ShieldCheck, Sparkles, Target, TriangleAlert, User, type LucideIcon } from 'lucide-react'
import { EvalIcon, knowHref, retroHref, useSops } from './shared'
import { remember } from '@/components/ReviewIndex'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { Act, Kind, Sop, Step } from './types'

// 第八轮：概览定三栏等宽 + 色条（关键控制点那一栏顶边绿线）；步骤 = 一个容器：吸顶条（左上你、中间步骤横轴、右上 AI）+ 整条中轴时间线
// 每一下动作 = 谁 + 动作类型 + 内容；注意和历史相关挂在出事的那一下；「表达」是唯一的色块（11-10 删了复制按钮）
// 相关知识标签浅蓝底蓝字（蓝 = 知识，11-10 定）；步骤之间一条虚线分开；你、AI 的图标在时间线左上角、右上角；横轴走到哪步亮到哪步，时间线底色不变；字号 18 / 16 / 15；你 = 绿、AI = 灰

const Lbl = ({ icon: I, className, children }: { icon: typeof Target; className?: string; children: ReactNode }) => (
  <span className={cn('flex items-center gap-1.5 text-muted-foreground', className)}><I className="size-4 shrink-0" />{children}</span>
)

/* ---------------- 概览：三栏等宽，关键控制点那一栏顶边一条绿线 ---------------- */

export function Overview({ sop }: { sop: Sop }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-3 divide-x">
        <div className="flex flex-col gap-2 p-5"><Lbl icon={Target}>目的</Lbl><p>{sop.purpose}</p></div>
        <div className="flex flex-col gap-2 p-5"><Lbl icon={Route}>方法</Lbl><p>{sop.approach}</p></div>
        <div className="flex flex-col gap-2 p-5 shadow-[inset_0_3px_0_var(--brand)]">
          <Lbl icon={TriangleAlert} className="text-brand">关键控制点</Lbl>
          <ol className="flex flex-col gap-2">
            {sop.keys.map((k, i) => (
              <li key={k} className="flex gap-2.5"><span className="w-4 shrink-0 text-right font-semibold tabular-nums text-brand">{i + 1}</span><span className="font-medium">{k}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

/* ---------------- 步骤：一张动作卡 ---------------- */

const KIND: Record<Kind, LucideIcon> = {
  思考: Brain, 判断: GitFork, 表达: MessageSquareQuote, 提供: Paperclip, 感受: Eye, 纠偏: PencilLine,
  盘点: ScanSearch, 分析: Microscope, 发散: Sparkles, 执行: Hammer, 自检: ShieldCheck, 请示: MessageCircleQuestion, 交付: Package,
}

/** 动作标签：你的绿、AI 的灰 */
function Tag({ n, onTint, className }: { n: Act; onTint?: boolean; className?: string }) {
  const I = KIND[n.kind]
  return (
    <span className={cn('inline-flex h-[1.5em] w-fit items-center gap-1 rounded-md px-1.5 align-top leading-none', n.who === '你' ? (onTint ? 'bg-background text-brand' : 'bg-brand-soft text-brand') : 'bg-muted text-muted-foreground', className)}>
      <I className="size-3.5" />{n.kind}
    </span>
  )
}

/** 一下动作：标签后面紧跟内容；表达整段中等粗细；判断带分支；注意和历史相关挂在出事的这一下 */
function ActCard({ n, s }: { n: Act; s: Step }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg px-3 py-2.5', n.say ? 'bg-brand-soft' : 'border bg-background')}>
      <p className={cn(n.say && 'text-base font-medium', n.branches && 'font-medium')}><Tag n={n} onTint={n.say} className="mr-2" />{n.text}</p>
      {n.branches && (
        <ul className="flex flex-col gap-1">{n.branches.map((b) => <li key={b.label}><span className="text-muted-foreground">{b.label}</span> → {b.result}</li>)}</ul>
      )}
      {n.tips?.map((t) => <p key={t} className="flex gap-1.5 text-muted-foreground"><Lightbulb className="mt-1 size-4 shrink-0" />{t}</p>)}
      {n.mine && s.mine && (
        <div className="flex flex-col gap-0.5 border-t pt-2">
          <span className="flex items-center gap-1.5"><EvalIcon e={s.mine.eval} />
            <a href={retroHref(s.mine.retro)} onClick={remember} className="font-medium text-foreground underline-offset-4 hover:underline">历史相关</a>
          </span>
          <span className="text-muted-foreground">{s.mine.note}</span>
        </div>
      )}
    </div>
  )
}

/** 你、AI：图标在上、字在下，放在时间线两侧的窄栏里 */
const Who = ({ me }: { me?: boolean }) => (
  <span className="flex flex-col items-center gap-1 font-semibold">
    <span className={cn('flex size-8 items-center justify-center rounded-full', me ? 'bg-brand-soft text-brand' : 'bg-muted text-muted-foreground')}>{me ? <User className="size-4.5" /> : <Bot className="size-4.5" />}</span>
    {me ? '你' : 'AI'}
  </span>
)

/* ---------------- 步骤：吸顶横轴 + 整条中轴时间线 ---------------- */

/** 一步里的一下动作：你的卡在左、AI 的在右，虚线连到中轴上的点（中轴是整段一根，画在外层） */
function Row({ n, s }: { n: Act; s: Step }) {
  const me = n.who === '你'
  return (
    <div className="grid grid-cols-[1fr_2.5rem_1fr]">
      <div className="pb-3">{me && <ActCard n={n} s={s} />}</div>
      <div className="relative">
        <span className={cn('absolute top-[22px] border-t border-dashed border-muted-foreground/50', me ? 'left-0 right-1/2' : 'left-1/2 right-0')} />
        <span className={cn('absolute left-1/2 top-[17px] size-2.5 -translate-x-1/2 rounded-full', me ? 'bg-brand' : 'bg-muted-foreground/60')} />
      </div>
      <div className="pb-3">{!me && <ActCard n={n} s={s} />}</div>
    </div>
  )
}

export function Steps({ sop }: { sop: Sop }) {
  const { kmap } = useSops()
  const [cur, setCur] = useState(0)
  const bar = useRef<HTMLDivElement>(null)
  const bands = useRef<(HTMLElement | null)[]>([])
  const lock = useRef(false), timer = useRef(0)
  const unlockLater = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => { lock.current = false }, 150) }
  // 滚动监听：滚到哪一步，横轴就亮到哪一步
  useEffect(() => {
    const on = () => {
      // 点横轴后的平滑滚动途中不跟着变，滚停了再接着联动
      if (lock.current) return unlockLater()
      const b = bar.current!.getBoundingClientRect().bottom
      let k = 0
      bands.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= b + 32) k = i })
      setCur(k)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); clearTimeout(timer.current) }
  }, [sop.id])
  // 点横轴：滚到那一步（停在横轴下面），横轴直接亮到那一步
  const go = (i: number) => {
    const el = bands.current[i]!
    lock.current = true; unlockLater(); setCur(i)
    const stuck = parseFloat(getComputedStyle(bar.current!).top) || 0   // 横轴吸在顶栏下面：要让开顶栏 + 横轴
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - stuck - bar.current!.offsetHeight + 1, behavior: 'smooth' })
  }
  const n = sop.steps.length
  return (
    <div className="rounded-xl border">
      {/* 吸顶条：只放步骤横轴，和时间线同一个容器 */}
      <div ref={bar} className="sticky top-[var(--bar)] z-20 rounded-t-xl border-b bg-background/95 px-4 py-4 backdrop-blur">
        <ol className="axis grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {sop.steps.map((s, i) => (
            <li key={s.id} className="relative">
              {i > 0 && <span className={cn('absolute left-0 right-1/2 top-3.5 h-px', i <= cur ? 'bg-foreground' : 'bg-border')} />}
              {i < n - 1 && <span className={cn('absolute left-1/2 right-0 top-3.5 h-px', i < cur ? 'bg-foreground' : 'bg-border')} />}
              <button type="button" onClick={() => go(i)} className="group relative flex w-full flex-col items-center gap-1.5 px-1.5">
                <span className={cn('flex size-7 items-center justify-center rounded-full border bg-background text-[15px] tabular-nums', i <= cur ? 'border-foreground font-semibold' : 'text-muted-foreground group-hover:border-foreground/40')}>{i + 1}</span>
                <span className={cn('text-balance text-center leading-snug', i <= cur ? 'font-semibold' : 'text-muted-foreground group-hover:text-foreground')}>
                  {s.name}{s.mine && (s.mine.eval === '待改进' || s.mine.eval === '缺失') && <EvalIcon e={s.mine.eval} className="ml-1 inline align-[-2px]" />}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {/* 整条时间线：步骤之间一条虚线；中轴一根线贯穿 */}
      <div className="relative">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
        {/* 你在左上角、AI 在右上角；两侧各留一条窄栏 */}
        {[true, false].map((me) => (
          <div key={String(me)} className={cn('absolute top-0 z-10 flex w-14 justify-center pt-3', me ? 'left-0' : 'right-0')}><Who me={me} /></div>
        ))}
        {sop.steps.map((s, i) => (
          <section key={s.id} ref={(el) => { bands.current[i] = el }} className="step-band px-14 pb-3">
            {/* 每步开头：左边本步关键，中轴上是序号，右边相关知识 */}
            <div className="mb-3 grid grid-cols-[1fr_2.5rem_1fr] items-center py-3">
              <span className={cn(T.headline, 'pr-4 text-right')}>{s.key}</span>
              <div className="flex justify-center"><span className="relative z-10 flex size-8 items-center justify-center rounded-full border-2 border-foreground bg-background font-semibold tabular-nums">{i + 1}</span></div>
              <div className="flex flex-wrap gap-2 pl-4">
                {s.know.map((k) => (
                  <a key={k} href={knowHref(k)}
                    className="inline-flex items-center gap-0.5 rounded-md bg-blue-50 px-2.5 py-0.5 text-blue-700 transition-colors hover:bg-blue-100"><BookOpen className="mr-1 size-3.5 text-blue-600" />{kmap[k] ?? k}<ArrowUpRight className="size-3.5" /></a>
                ))}
              </div>
            </div>
            {s.flow.map((a, k) => <Row key={k} n={a} s={s} />)}
          </section>
        ))}
      </div>
    </div>
  )
}
