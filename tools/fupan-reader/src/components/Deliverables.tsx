import type { ReactNode } from 'react'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { FileIcon, dirOf } from '@/components/fileMeta'
import { CodeFilesView, KeyFilesView } from '@/components/Modes'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Clip } from '@/components/Clip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Flow } from '@/components/viewers'
import { cn } from '@/lib/utils'
import type { Opened, SessionData } from '@/types'
import type { Variant } from '@/variants'
import { T } from '@/typo'

type Open = (o: Opened) => void

function Step({ n, id, title, extra, v, children }: { n: number; id: string; title: string; extra?: ReactNode; v: Variant; children: ReactNode }) {
  return (
    <section id={id} className={cn('relative flex min-w-0 scroll-mt-8 flex-col pl-10', v.density === 'cozy' ? 'gap-4' : 'gap-3')}>
      <span className="absolute top-8 bottom-0 left-[13px] w-px bg-border" />
      <h4 className={cn('flex flex-wrap items-center gap-3', T.name)}>
        <span className="absolute left-0 grid size-7 place-items-center rounded-full bg-muted text-muted-foreground">{n}</span>
        {title}
        {extra}
      </h4>
      {children}
    </section>
  )
}

export function Deliverables({ data, v, dark, open }: { data: SessionData; v: Variant; dark: boolean; open: Open }) {
  const pad = v.density === 'cozy' ? 'p-5' : 'p-4'
  const otherCount = data.others.groups.reduce((n, g) => n + g.rows.length, 0)
  const on = { results: data.results.length > 0, keyfiles: data.keyFiles.length > 0, code: data.code.modules.length > 0, others: otherCount + data.others.server.length > 0 }
  const order = (Object.keys(on) as (keyof typeof on)[]).filter((k) => on[k])
  const num = (k: keyof typeof on) => order.indexOf(k) + 1

  return (
    <div className="flex flex-col gap-8 typo-body">
      <div className="flex items-center gap-3">
        <h3 className={T.h3}>交付物</h3>
        <Badge className="bg-amber-100 text-sm font-normal text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">{data.session.commit}</Badge>
      </div>

      {on.results && <Step n={num('results')} id="d-results" title="结果" v={v}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.results.map((r) => r.stale ? (
            <Card key={r.id} className={cn('gap-2 bg-muted/50 text-sm shadow-none', pad)}>
              <a href={r.url} target="_blank" rel="noopener" className={cn('flex items-center gap-1 text-muted-foreground hover:underline', T.name)}>
                {r.title}<ArrowUpRight className="size-4" />
              </a>
              <span className="text-muted-foreground">{r.host}</span>
              <span className="text-muted-foreground">{r.meta}</span>
              <Badge variant="secondary" className="w-fit text-sm font-normal">已停更</Badge>
            </Card>
          ) : (
            <Card key={r.id} className="gap-0 overflow-hidden py-0 text-sm">
              {r.shot && (r.file
                ? <button type="button" onClick={() => open({ key: r.file! })} className="block border-b" title="看会话结束时的快照">
                    <img src={r.shot} alt={`${r.title}截图`} className="aspect-[16/9] w-full object-cover object-top transition hover:opacity-90" />
                  </button>
                : <a href={r.url} target="_blank" rel="noopener" className="block border-b"><img src={r.shot} alt={`${r.title}截图`} className="aspect-[16/9] w-full object-cover object-top transition hover:opacity-90" /></a>)}
              <div className={cn('flex flex-col gap-1', pad)}>
                {r.url
                  ? <a href={r.url} target="_blank" rel="noopener" className={cn('flex w-fit items-center gap-1 hover:text-brand', T.name)}>{r.title}<ArrowUpRight className="size-4 text-brand" /></a>
                  : r.file ? <button type="button" onClick={() => open({ key: r.file! })} className={cn('w-fit text-left hover:text-brand', T.name)}>{r.title}</button>
                  : <span className={T.name}>{r.title}</span>}
                {r.host && <span className="text-brand">{r.host}</span>}
                <span className="text-muted-foreground">{r.meta}</span>
              </div>
            </Card>
          ))}
        </div>
      </Step>}

      {on.keyfiles && <Step n={num('keyfiles')} id="d-keyfiles" title="关键文件" v={v}>
        <KeyFilesView data={data} open={open} />
      </Step>}

      {on.code && <Step n={num('code')} id="d-code" title="关键代码" v={v}>
        {data.code.flow && <Card className={cn('shadow-none', pad)}><Flow chart={data.code.flow} dark={dark} /></Card>}
        <Accordion type="multiple" defaultValue={data.code.modules.map((m) => m.id)} className="flex flex-col gap-3">
          {data.code.modules.map((m) => (
            <AccordionItem key={m.id} value={m.id} className="rounded-lg border bg-card px-4 last:border-b">
              <AccordionTrigger className="group/acc py-4 text-sm hover:no-underline">
                <span className="flex items-baseline gap-2"><span className={cn(T.name, 'transition-colors group-hover/acc:text-brand')}>{m.name}</span><span className="font-normal text-muted-foreground">{m.files.length} 个文件</span></span>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 text-sm">
                <p>{m.role}</p>
                <dl className="grid grid-cols-[minmax(0,10em)_minmax(0,1fr)] gap-x-4 gap-y-2 border-y py-3">
                  {m.practices.map(([term, desc]) => (
                    <div key={term} className="contents"><dt className={T.term}>{term}</dt><dd className="text-muted-foreground">{desc}</dd></div>
                  ))}
                </dl>
                <CodeFilesView files={m.files} data={data} open={open} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Step>}

      {on.others && <Collapsible className="group/others">
        <Step n={num('others')} id="d-others" v={v} title="其余产出" extra={
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-normal text-muted-foreground hover:text-foreground">
            {otherCount} 个文件 · 服务器 {data.others.server.length} 项改动
            <ChevronDown className="size-4 transition group-data-[state=open]/others:rotate-180" />
          </CollapsibleTrigger>
        }>
          <CollapsibleContent className="flex flex-col gap-4">
            <Card className="gap-0 py-0 shadow-none">
              <Table className="table-fixed text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[14em]">文件</TableHead><TableHead>用途</TableHead><TableHead className="w-[7.5em]">改动</TableHead><TableHead className="w-[30%]">目录</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.others.groups.flatMap((g) => [
                    <TableRow key={g.name} className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={4} className="font-semibold">{g.name}<span className="ml-2 font-normal text-muted-foreground">{g.rows.length}</span></TableCell>
                    </TableRow>,
                    ...g.rows.map((r) => {
                      const f = data.files[r.file]
                      return (
                        <TableRow key={r.file} className="cursor-pointer" onClick={() => open({ key: r.file })}>
                          <TableCell><span className="flex min-w-0 items-center gap-2 text-brand"><FileIcon f={f} /><Clip className="min-w-0">{f.name}</Clip></span></TableCell>
                          <TableCell><Clip>{r.use}</Clip></TableCell>
                          <TableCell className="text-muted-foreground"><Clip>{r.change}</Clip></TableCell>
                          <TableCell className="text-muted-foreground"><Clip>{dirOf(f.path)}</Clip></TableCell>
                        </TableRow>
                      )
                    }),
                  ])}
                </TableBody>
              </Table>
            </Card>
            <Card className="gap-0 py-0 shadow-none">
              <Table className="table-fixed text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent"><TableHead className="w-[14em]">服务器</TableHead><TableHead>改了什么</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.others.server.map((s) => (
                    <TableRow key={s.what}><TableCell><Clip>{s.host}</Clip></TableCell><TableCell><Clip>{s.what}</Clip></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </CollapsibleContent>
        </Step>
      </Collapsible>}
    </div>
  )
}
