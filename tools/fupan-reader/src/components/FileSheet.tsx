import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Code, Markdown } from '@/components/viewers'
import { projectOf } from '@/components/fileMeta'
import { T } from '@/typo'
import { cn } from '@/lib/utils'
import type { CodeFile, FileEntry, Opened, SessionData } from '@/types'

const vscode = (abs: string) => 'vscode://file' + abs.split('/').map(encodeURIComponent).join('/')
const expand = (ranges: [number, number][]) => ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))

/** 没有讲解卡、也不是关键配置的文件：按类型渲染 */
function PlainBody({ f }: { f: FileEntry }) {
  if (f.kind === 'dir') {
    return (
      <ul className="divide-y rounded-lg border text-sm">
        {f.entries!.map((e) => <li key={e.name} className="flex justify-between px-3 py-2"><span>{e.name}</span><span className="text-muted-foreground">{e.size}</span></li>)}
      </ul>
    )
  }
  if (f.excerpt) {
    return (
      <div className="flex flex-col gap-4">
        {f.excerpt.map((s, i) => (
          <section key={i} className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">本次改动 · 第 {s.start === s.end ? s.start : `${s.start}–${s.end}`} 行</p>
            {f.kind === 'md' ? <div className="rounded-lg border p-4"><Markdown text={s.text} /></div> : <Code code={s.text} lang={f.lang!} />}
          </section>
        ))}
      </div>
    )
  }
  if (f.kind === 'image') return <img src={f.src} alt={f.name} className="max-w-full rounded-lg border" />
  if (f.kind === 'md') return <Markdown text={f.content!} />
  if (f.kind === 'html' && f.preview) {
    return (
      <Tabs defaultValue="page">
        <TabsList><TabsTrigger value="page">页面</TabsTrigger><TabsTrigger value="src">源码</TabsTrigger></TabsList>
        <TabsContent value="page" className="mt-3">
          <iframe srcDoc={f.preview} sandbox="allow-scripts" title={`${f.name} 页面`} className="h-[calc(100vh-13rem)] w-full rounded-lg border bg-white" />
        </TabsContent>
        <TabsContent value="src" className="mt-3"><Code code={f.content!} lang="html" /></TabsContent>
      </Tabs>
    )
  }
  return <Code code={f.content!} lang={f.lang!} />
}

/** 代码文件：左栏讲解（也是代码的导航），右栏全文。点执行流程的一步，右栏跳到那段并高亮；打开时停在第一步 */
function CodeBody({ f, cf, start }: { f: FileEntry; cf: CodeFile; start: number }) {
  const [active, setActive] = useState<{ step: number; fn?: number }>({ step: start })
  const st = cf.flow[active.step] ?? { step: '', desc: '', fns: [] }
  const ranges = (active.fn === undefined ? st.fns.flatMap((x) => x.ranges ?? []) : st.fns[active.fn]?.ranges) ?? []
  const first = ranges.length ? Math.min(...ranges.map(([a]) => a)) : 1
  return (
    <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[420px_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="flex flex-col gap-6 border-b p-6 text-sm typo-body lg:overflow-y-auto lg:border-r lg:border-b-0 [&>section+section]:border-t [&>section+section]:pt-6">
        <section className="flex flex-col gap-2">
          <h4 className={T.name}>负责什么</h4>
          <p>{cf.role}</p>
        </section>
        <section className="flex flex-col gap-2.5">
          <h4 className={T.name}>技术栈</h4>
          <div className="flex flex-wrap gap-1.5">{cf.stack.map((s) => <Badge key={s} variant="secondary" className="text-sm font-normal">{s}</Badge>)}</div>
        </section>
        <section className="flex flex-col gap-2.5">
          <h4 className={T.name}>输入 → 输出</h4>
          <div className="grid grid-cols-[3em_minmax(0,1fr)] gap-x-3 gap-y-2.5 rounded-lg bg-muted/50 p-4">
            <span className="text-muted-foreground">输入</span><span>{cf.io.in}</span>
            <span className="text-muted-foreground">输出</span><span>{cf.io.out}</span>
          </div>
        </section>
        <section className="flex flex-col gap-2.5">
          <h4 className={T.name}>执行流程</h4>
          <ol className="flex flex-col gap-1.5">
            {cf.flow.map((s, i) => (
              <li key={s.step}>
                <div role="button" tabIndex={0} onClick={() => setActive({ step: i })} onKeyDown={(e) => e.key === 'Enter' && setActive({ step: i })}
                  className={cn('flex cursor-pointer gap-3 rounded-lg p-3 transition', i === active.step ? 'bg-brand-soft' : 'hover:bg-muted/60')}>
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full', i === active.step ? 'bg-brand text-background' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-medium">{s.step}</span>
                    <span className="text-muted-foreground">{s.desc}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {s.fns.map((x, j) => (
                        <button key={x.name} type="button" onClick={(e) => { e.stopPropagation(); setActive({ step: i, fn: j }) }}
                          className={cn('rounded-md px-2 transition', i === active.step && active.fn === j ? 'bg-brand text-background' : 'bg-muted text-brand hover:bg-brand-soft')}>
                          {x.name}
                        </button>
                      ))}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="flex flex-col gap-2.5">
          <h4 className={T.name}>设计理念</h4>
          <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground">{cf.ideas.map((s) => <li key={s}>{s}</li>)}</ul>
        </section>
      </aside>
      <div className="min-w-0 p-6 lg:overflow-y-auto">
        <Code code={f.content!} lang={f.lang!} marks={expand(ranges)} scrollTo={first} />
      </div>
    </div>
  )
}

export function FileSheet({ data, opened, setOpened }: { data: SessionData; opened: Opened; setOpened: (o: Opened) => void }) {
  const fo = opened
  const f = fo ? data.files[fo.key] : null
  const cf = fo ? data.code.modules.flatMap((m) => m.files).find((c) => c.file === fo.key) : undefined
  const kf = fo ? data.keyFiles.find((k) => k.file === fo.key && k.marks?.length) : undefined
  return (
    <Sheet open={!!opened} onOpenChange={(o) => !o && setOpened(null)}>
      <SheetContent side="right" className={cn('w-full gap-0', cf ? 'sm:max-w-[min(1200px,94vw)]' : 'sm:max-w-3xl')}>
        {f && (
          <>
            <SheetHeader className="gap-2.5 border-b p-6 pr-14">
              <SheetTitle className={cn('flex flex-wrap items-center gap-2', T.drawerTitle)}>
                {f.name}
                {cf && <span className="font-normal text-muted-foreground">{projectOf(f.path)}</span>}
                {['修改', '样稿', '本地快照'].includes(f.status) && <Badge variant="secondary" className="text-sm font-normal">{f.status}</Badge>}
              </SheetTitle>
              <SheetDescription className="break-all">
                {f.path}
                {f.later && <span className="text-amber-600 dark:text-amber-400">　会话结束后又改过，最后修改 {f.mtime}</span>}
              </SheetDescription>
              <div className="-ml-2 flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild><a href={vscode(f.abs)}><ExternalLink />在 VS Code 中打开</a></Button>
              </div>
            </SheetHeader>
            {cf ? <CodeBody key={`${fo!.key}-${fo!.step ?? 0}`} f={f} cf={cf} start={fo!.step ?? 0} /> : (
              <div className="flex-1 overflow-y-auto p-6">
                {kf ? <Code code={f.content!} lang={f.lang!} marks={expand(kf.marks!)} scrollTo={kf.marks![0][0]} /> : <PlainBody key={fo!.key} f={f} />}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
