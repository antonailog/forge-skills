import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import { SideNav, useScrollSpy } from '@/components/SideNav'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { inset } from '@/components/kit'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import { api, hrefOf, join, type Bullet, type Item, type Project } from '@/workspace/api'
import { Md } from '@/workspace/Md'
import { FileBrowser } from '@/workspace/FileBrowser'
import { Icon, Inline, Section, openFile } from '@/workspace/parts'

// 项目页：和复盘单篇同一个版式。左栏目录，右边从上到下：
// 概览（高亮容器：背景、进行中、待办、结果，右上角写的时间）→ 等你定（有才出）→ 已完成 → 进行中
// → 文件（工作区 / 成果 / 调研 / 数据 / 归档 一个视图）→ 决策（每类：现行做法 | 变更记录两栏、约束、原始记录收起）→ 待办
// 表格一行一件事、日期和标签不折行（最低高度优先）。11-17 定：标题下不放计数之类的小字

const BG: [string, string][] = [['why', '为什么做'], ['what', '做成什么'], ['not', '不做']]
const short = (d: string) => d.replace(/^\d{4}-/, '')
const note = (t: Bullet) => t.sub.map((s) => s.replace(/^(说明|效果)[：:]\s*/, '')).join('；')

/** 现在：高亮容器，一行一个字段，正常叙述的句子；右上角是写的时间 */
function Now({ p }: { p: Project }) {
  const now = p.now!
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-x-5 gap-y-3 rounded-lg border border-brand/25 bg-brand-soft/60 px-6 py-5 text-base">
      {now.fields.map((f, i) => (
        <div key={f.label} className="contents">
          <span className="text-muted-foreground">{f.label}</span>
          <p className="leading-relaxed"><Inline text={f.text} base={p.path} /></p>
          <span className="font-mono text-sm text-muted-foreground tabular-nums">{i === 0 ? now.time : ''}</span>
        </div>
      ))}
    </div>
  )
}

function Summary({ p }: { p: Project }) {
  const crumb = 'rounded-md px-1.5 py-0.5 hover:bg-muted'
  const bg = Object.fromEntries(BG.map(([k, label]) => [k, p.background.find((b) => b.startsWith(label))?.replace(/^[^：:]+[：:]\s*/, '') ?? '']))
  const loose = p.background.filter((b) => !BG.some(([, label]) => b.startsWith(label)))
  const col = 'flex min-w-0 flex-col gap-2 py-4'
  return (
    <header id="summary" className="flex scroll-mt-8 flex-col gap-3">
      <Breadcrumb className="-ml-1.5">
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href={hrefOf(null)} className={cn(crumb, 'inline-flex items-center gap-1.5')}><LayoutGrid className="size-4" />项目</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator className="text-muted-foreground/50" />
          <BreadcrumbItem><span className="px-1.5 text-muted-foreground">{p.area}</span></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h1 className={T.title}>{p.name}</h1>
      {p.now ? <Now p={p} /> : <>
      {p.oneliner && <p className="text-base">{p.oneliner}</p>}
      {(bg.why || bg.what || bg.not) && (
        <div className="mt-1 grid grid-cols-3 border-y">
          <div className={cn(col, 'pr-6')}><span className="text-muted-foreground">为什么做</span><p>{bg.why}</p></div>
          <div className={cn(col, 'border-l px-6')}><span className="text-muted-foreground">做成什么</span><p>{bg.what}</p></div>
          <div className={cn(col, 'border-l pl-6')}><span className="text-muted-foreground">不做</span><p>{bg.not}</p></div>
        </div>
      )}
      {loose.length > 0 && <ul className="list-disc pl-5 text-muted-foreground">{loose.map((b) => <li key={b}>{b}</li>)}</ul>}
      </>}
    </header>
  )
}

/** 一行一件事：日期、归属、做了什么不折行，说明放最后一列（放不下才折） */
function TaskTable({ xs, dated, base }: { xs: Bullet[]; dated?: boolean; base: string }) {
  return (
    <Table>
      <TableBody>
        {xs.map((t, i) => (
          <TableRow key={i} className="hover:bg-muted/40">
            {dated && <TableCell className="w-0 whitespace-nowrap py-2.5 pl-0 font-mono text-muted-foreground tabular-nums">{short(t.date)}</TableCell>}
            <TableCell className={cn('w-0 whitespace-nowrap py-2.5', !dated && 'pl-0')}>{t.name && <Badge variant="secondary" className="text-sm font-normal">{t.name}</Badge>}</TableCell>
            <TableCell className="w-0 whitespace-nowrap py-2.5 font-medium"><Inline text={t.text} base={base} /></TableCell>
            <TableCell className="py-2.5 whitespace-normal text-muted-foreground">{note(t)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-3">
      <CollapsibleTrigger className="inline-flex w-fit items-center gap-1.5 text-muted-foreground hover:text-foreground">
        <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />{title}
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

/** 卡片里的文件：一行一个，点了在右侧抽屉看；关键文件排前面、高亮 */
function Files({ path }: { path: string }) {
  const [items, setItems] = useState<Item[] | null>(null)
  useEffect(() => { api.list(path).then((r) => setItems([...r.items].sort((a, b) => Number(!!b.key) - Number(!!a.key))), () => setItems([])) }, [path])
  if (!items?.length) return null
  return (
    <ul className="flex flex-col border-t pt-2">
      {items.map((i) => (
        <li key={i.path}>
          <button type="button" onClick={() => openFile(i.dir ? i.path + '/' : i.path)} title={i.desc}
            className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60">
            <Icon path={i.path} dir={i.dir} className={i.key ? 'text-brand' : undefined} />
            <span className={cn('shrink-0 whitespace-nowrap transition-colors group-hover:text-brand', i.key && 'font-medium text-brand')}>{i.name}</span>
            {i.desc && <span className="min-w-0 truncate text-muted-foreground">{i.desc}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** 正在推进：2-工作区 每件事一张卡（第一版项目列「进行中」任务） */
function Doing({ p }: { p: Project }) {
  const work = p.zones.find((z) => z.zone === '2-工作区')
  const folders = (work?.items ?? []).filter((i) => i.dir)
  if (p.version === 1) return p.doing.length ? <TaskTable xs={p.doing} base={p.path} /> : <p className="text-muted-foreground">无</p>
  const names = [...new Set([...p.doing.map((d) => d.name), ...folders.map((f) => f.name)])]
  if (!names.length) return <p className="text-muted-foreground">没有正在推进的事</p>
  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      {names.map((n) => {
        const d = p.doing.find((x) => x.name === n)
        const f = folders.find((x) => x.name === n)
        const eff = d?.sub.filter((s) => s.startsWith('效果')) ?? []
        const other = d?.sub.filter((s) => !s.startsWith('效果')) ?? []
        return (
          <Card key={n} className="gap-3 p-5 shadow-none">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className={T.h4}>{n}</h4>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">{f ? `改于 ${f.mtime}` : '没有文件夹'}</span>
            </div>
            {d ? <p className={T.headline}><Inline text={d.text} base={p.path} /></p> : <p className="text-muted-foreground">项目.md「进行中」没写这一行</p>}
            {eff.map((e) => <p key={e} className={inset}><span className="text-muted-foreground">效果　</span>{e.replace(/^效果[：:]\s*/, '')}</p>)}
            {other.length > 0 && <ul className="list-disc pl-5 text-muted-foreground">{other.map((o) => <li key={o}>{o}</li>)}</ul>}
            {f && <Files path={f.path} />}
          </Card>
        )
      })}
    </div>
  )
}

const empty = (s: string) => !s.trim() || s.trim() === '- 无'

type DecGroup = { name: string; blocks: Record<string, string> }
const BLOCKS = ['现行做法', '变更记录', '约束', '原始记录']
/** 项目.md「关键决定」：### 类名，下面「现行做法：」「变更记录：」「约束：」「原始记录：」几块，每块是一段 Markdown 无序列表 */
function parseDecisions(md: string): DecGroup[] {
  const out: DecGroup[] = []
  let block = ''
  for (const line of md.split('\n')) {
    const g = line.match(/^###\s+(.+)$/)
    if (g) { out.push({ name: g[1].trim(), blocks: {} }); block = ''; continue }
    const cur = out[out.length - 1]
    if (!cur) continue
    const m = line.trim().match(/^(现行做法|变更记录|约束|原始记录)[：:]$/)
    if (m) { block = m[1]; cur.blocks[block] = ''; continue }
    if (block) cur.blocks[block] += line + '\n'
  }
  return out
}

/** 每一类：左「现行做法」右「变更记录」两栏，下面一行「约束」，原始记录收起 */
function Decisions({ p }: { p: Project }) {
  const groups = parseDecisions(p.decisions)
  if (!groups.length) return empty(p.decisions) ? <p className="text-muted-foreground">无</p> : <Card className="p-6 shadow-none"><Md text={p.decisions} file={p.source} /></Card>
  const label = 'text-sm font-medium text-muted-foreground'
  const body = (t?: string) => t && !empty(t) ? <Md text={t.trim()} file={p.source} /> : <p className="text-muted-foreground">无</p>
  return (
    <div className="flex flex-col">
      {groups.map((g) => {
        const raw = (g.blocks['原始记录'] ?? '').trim()
        const n = raw.split('\n').filter((l) => l.startsWith('- ')).length
        return (
          <section key={g.name} className="flex flex-col gap-4 border-t py-6 first:border-t-0 first:pt-0">
            <h4 className={T.h4}>{g.name}</h4>
            {g.blocks['现行做法'] !== undefined && (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="flex min-w-0 flex-col gap-1.5"><span className={label}>现行做法</span>{body(g.blocks['现行做法'])}</div>
                <div className="flex min-w-0 flex-col gap-1.5"><span className={label}>变更记录</span>{body(g.blocks['变更记录'])}</div>
              </div>
            )}
            {g.blocks['约束'] !== undefined && !empty(g.blocks['约束']) && (
              <div className="flex flex-col gap-1.5 rounded-md bg-muted/50 px-5 py-3"><span className={label}>约束</span>{body(g.blocks['约束'])}</div>
            )}
            {n > 0 && <Fold title={`原始记录 ${n} 条`}><Md text={raw} file={p.source} /></Fold>}
          </section>
        )
      })}
    </div>
  )
}
const DONE_SHOWN = 6

/** 「现在」结果那行链到的文件：成果页签默认打开第一个 */
const prefer = (p: Project) => {
  const t = p.now?.fields.find((f) => f.label === '结果')?.text ?? ''
  return [...t.matchAll(/\]\(<?([^)<>\s]+)>?\)/g)].map((m) => join(p.path, decodeURI(m[1])))
}

export function ProjectPage({ path }: { path: string }) {
  const [p, setP] = useState<Project | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { let live = true; api.project(path).then((d) => { if (live) { setP(d); document.title = d.name } }, (e: Error) => live && setErr(e.message)); return () => { live = false } }, [path])
  const toc = useMemo(() => {
    if (!p) return []
    const all: { id: string; label: string; on: boolean }[] = [
      { id: 'summary', label: '概览', on: true },
      { id: 'decide', label: '等你定', on: p.decide.length > 0 },
      { id: 'done', label: '已完成', on: true },
      { id: 'doing', label: '进行中', on: true },
      { id: 'files', label: '文件', on: p.zones.length > 0 },
      { id: 'decisions', label: '决策', on: true },
      { id: 'rules', label: '规矩', on: p.rules.length > 0 },
      { id: 'todo', label: '待办', on: true },
    ]
    return all.filter((t) => t.on).map(({ id, label }) => ({ id, label }))   // 11-17 定：左栏不放数量
  }, [p])
  const [active, pick] = useScrollSpy(useMemo(() => toc.map((t) => t.id), [toc]))
  if (err) return <p className="p-8 text-muted-foreground">{err}</p>
  if (!p) return null
  return (
    <div className="relative mx-auto grid max-w-[1400px] grid-cols-[9rem_minmax(0,1fr)] gap-12 px-8 text-sm typo-body">
      <SideNav items={toc} active={active} back={{ href: hrefOf(null), label: '返回项目总览' }}
        pick={(id) => { pick(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
      <main className="flex min-w-0 flex-col gap-14 py-8">
        <Summary p={p} />
        {p.decide.length > 0 && <Section id="decide" title="等你定"><TaskTable xs={p.decide} base={p.path} /></Section>}
        <Section id="done" title="已完成">
          {p.done.length ? <>
            <TaskTable xs={p.done.slice(0, DONE_SHOWN)} dated base={p.path} />
            {p.done.length > DONE_SHOWN && <Fold title={`更早的 ${p.done.length - DONE_SHOWN} 件`}><TaskTable xs={p.done.slice(DONE_SHOWN)} dated base={p.path} /></Fold>}
          </> : <p className="text-muted-foreground">无</p>}
        </Section>
        <Section id="doing" title="进行中"><Doing p={p} /></Section>
        {p.zones.length > 0 && <Section id="files" title="文件"><FileBrowser zones={p.zones} prefer={prefer(p)} /></Section>}
        <Section id="decisions" title="决策">
          {p.version === 2 ? <Decisions p={p} /> : <>
            {empty(p.decisions) ? <p className="text-muted-foreground">无</p> : <Card className="p-6 shadow-none"><Md text={p.decisions} file={p.source} /></Card>}
            {!empty(p.overturned) && <Fold title="推翻过的"><Card className="p-6 shadow-none"><Md text={p.overturned} file={p.source} /></Card></Fold>}
          </>}
        </Section>
        {p.rules.length > 0 && <Section id="rules" title="规矩"><ul className="list-disc pl-5">{p.rules.map((r) => <li key={r}>{r}</li>)}</ul></Section>}
        <Section id="todo" title="待办">
          {p.todo.length ? <TaskTable xs={p.todo} base={p.path} /> : <p className="text-muted-foreground">无</p>}
        </Section>
      </main>
    </div>
  )
}
