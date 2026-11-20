import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ExternalLink, SquareArrowOutUpRight, Star } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Code } from '@/components/viewers'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import { api, IMAGE, langOf, looksDir, raw, type FileData, type Item } from '@/workspace/api'
import { Md } from '@/workspace/Md'
import { JsonTree, ObjTable, parseCsv, parseJson } from '@/workspace/JsonView'
import { Icon } from '@/workspace/parts'

// 看一份文件：文件浏览区右栏和右侧抽屉共用。外壳照复盘阅读页 FileSheet：标题 + 路径 + 「在 VS Code 中打开」；
// 内容按类型渲染：md 渲染（文内相对链接接着在这里开）、代码 Shiki 高亮、JSON 树和表格 / 原文、CSV 表格、图片、html 页面 / 源码、文件夹

const vscode = (abs: string) => 'vscode://file' + abs.split('/').map(encodeURIComponent).join('/')
const RAW_CAP = 300_000   // 高亮的上限，再大 Shiki 会卡
export const WIDE = new Set(['.json', '.jsonl', '.csv', '.tsv', '.html', '.htm'])

export type Got = { kind: 'dir'; path: string; items: Item[] } | { kind: 'file'; f: FileData } | { kind: 'error'; msg: string }

/** 读一个路径：看着像文件夹就先列目录，不行再当文件读（没有扩展名的文件、带点的文件夹） */
export function useEntry(path: string | null) {
  const [got, setGot] = useState<Got | null>(null)
  useEffect(() => {
    if (!path) { setGot(null); return }
    let live = true
    setGot(null)
    const p = path.replace(/\/$/, '')
    const asDir = () => api.list(p).then((r): Got => ({ kind: 'dir', path: r.path, items: r.items }))
    const asFile = () => api.file(p).then((f): Got => ({ kind: 'file', f }))
    const [a, b] = looksDir(path) ? [asDir, asFile] : [asFile, asDir]
    a().then((g) => live && setGot(g), (e: Error) => b().then((g) => live && setGot(g), () => live && setGot({ kind: 'error', msg: e.message })))
    return () => { live = false }
  }, [path])
  return got
}

/** html 里用根路径引脚本（Vite 的开发入口 <script src="/src/main.tsx">）的，单独打开是空白：直接看源码 */
const devEntry = (html: string) => /<script[^>]+src=["']\/(?!\/)/i.test(html)

export function Body({ f, onOpen }: { f: FileData; onOpen: (path: string) => void }) {
  const e = f.ext
  if (IMAGE.has(e)) return <img src={raw(f.path)} alt={f.name} className="max-w-full rounded-lg border" />
  if (e === '.html' || e === '.htm') {
    const dev = f.content != null && devEntry(f.content)
    return (
      <Tabs defaultValue={dev ? 'src' : 'page'}>
        <TabsList><TabsTrigger value="page">页面</TabsTrigger><TabsTrigger value="src">源码</TabsTrigger></TabsList>
        <TabsContent value="page" className="mt-3">
          {dev
            ? <p className="text-muted-foreground">这是开发用的入口，脚本按网站根路径引用（{'<script src="/src/…">'}），单独打开是空白。要看页面，打开它跑起来的地址，或者构建后的 dist/index.html。</p>
            : <iframe src={raw(f.path)} sandbox="allow-scripts allow-same-origin" title={`${f.name} 页面`} className="h-[calc(100vh-16rem)] min-h-[24rem] w-full rounded-lg border bg-white" />}
        </TabsContent>
        <TabsContent value="src" className="mt-3">{f.content != null && <Code code={f.content} lang="html" />}</TabsContent>
      </Tabs>
    )
  }
  if (f.content == null) {
    return (
      <div className="flex flex-col items-start gap-3 text-muted-foreground">
        <p>{f.note ?? '不是文本文件，没法在这里显示。'}</p>
        <Button variant="secondary" size="sm" asChild><a href={raw(f.path)} target="_blank" rel="noopener"><SquareArrowOutUpRight />新标签打开</a></Button>
      </div>
    )
  }
  if (e === '.md') return <Md text={f.content} file={f.path} onOpen={onOpen} />
  if (e === '.json' || e === '.jsonl') {
    const { data, error } = parseJson(f.content, e === '.jsonl')
    const rawTab = <Code code={f.content.length > RAW_CAP ? f.content.slice(0, RAW_CAP) + '\n…（后面太长，用「新标签打开」看全文）' : f.content} lang="json" />
    if (error) return <div className="flex flex-col gap-3"><p className="text-destructive">JSON 解析失败：{error}</p>{rawTab}</div>
    return (
      <Tabs defaultValue="tree">
        <TabsList><TabsTrigger value="tree">树和表格</TabsTrigger><TabsTrigger value="raw">原文</TabsTrigger></TabsList>
        <TabsContent value="tree" className="mt-3"><JsonTree data={data} /></TabsContent>
        <TabsContent value="raw" className="mt-3">{rawTab}</TabsContent>
      </Tabs>
    )
  }
  if (e === '.csv' || e === '.tsv') {
    return (
      <Tabs defaultValue="table">
        <TabsList><TabsTrigger value="table">表格</TabsTrigger><TabsTrigger value="raw">原文</TabsTrigger></TabsList>
        <TabsContent value="table" className="mt-3"><ObjTable rows={parseCsv(f.content, e === '.tsv' ? '\t' : ',')} /></TabsContent>
        <TabsContent value="raw" className="mt-3"><Code code={f.content.slice(0, RAW_CAP)} lang="text" /></TabsContent>
      </Tabs>
    )
  }
  return <Code code={f.content.length > RAW_CAP ? f.content.slice(0, RAW_CAP) : f.content} lang={langOf(e)} />
}

/** 文件夹：一行一个，点了接着看；主文档排第一并高亮 */
export function DirList({ items, onOpen }: { items: Item[]; onOpen: (path: string) => void }) {
  if (!items.length) return <p className="text-muted-foreground">空文件夹</p>
  const sorted = [...items].sort((a, b) => Number(!!b.key) - Number(!!a.key))
  return (
    <ul className="flex flex-col border-t">
      {sorted.map((i) => (
        <li key={i.path}>
          <button type="button" onClick={() => onOpen(i.dir ? i.path + '/' : i.path)} title={i.desc}
            className="group flex w-full items-center gap-2.5 border-b px-2 py-2 text-left transition-colors hover:bg-muted/50">
            <Icon path={i.path} dir={i.dir} className={i.key ? 'text-brand' : undefined} />
            <span className={cn('shrink-0 whitespace-nowrap group-hover:text-brand', i.key && 'font-medium text-brand')}>{i.name}</span>
            {i.desc && <span className="min-w-0 truncate text-muted-foreground">{i.desc}</span>}
            <span className="ml-auto shrink-0 whitespace-nowrap pl-3 text-muted-foreground tabular-nums">{i.dir ? `${i.files} 个文件` : i.mtime}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const size = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`)

/** 标题区：名字（关键文件带星）、路径和时间、操作按钮。Title / Desc 由外面传：抽屉里要用 SheetTitle 才满足无障碍 */
export function Head({ path, got, isKey, back, Title, Desc }: {
  path: string; got: Got | null; isKey?: boolean; back?: () => void
  Title: (p: { className?: string; children: ReactNode }) => ReactNode; Desc: (p: { className?: string; children: ReactNode }) => ReactNode
}) {
  const f = got?.kind === 'file' ? got.f : null
  const name = path.replace(/\/$/, '').split('/').pop()
  const ghost = 'text-muted-foreground hover:text-foreground'
  return (
    <>
      <Title className={cn('flex flex-wrap items-center gap-2', T.drawerTitle)}>
        {isKey && <Star className="size-4 fill-brand text-brand" />}
        {name}
        {got?.kind === 'dir' && <Badge variant="secondary" className="text-sm font-normal">文件夹 · {got.items.length} 项</Badge>}
      </Title>
      <Desc className="break-all text-muted-foreground">{path.replace(/\/$/, '')}{f && <span>　改于 {f.mtime} · {size(f.size)}</span>}</Desc>
      <div className="-ml-2 flex flex-wrap gap-1">
        {back && <Button variant="ghost" size="sm" className={ghost} onClick={back}><ArrowLeft />返回上一份</Button>}
        {f && <Button variant="ghost" size="sm" className={ghost} asChild><a href={vscode(f.abs)}><ExternalLink />在 VS Code 中打开</a></Button>}
        {f && <Button variant="ghost" size="sm" className={ghost} asChild><a href={raw(f.path)} target="_blank" rel="noopener"><SquareArrowOutUpRight />新标签打开</a></Button>}
      </div>
    </>
  )
}

export function Content({ got, onOpen }: { got: Got | null; onOpen: (path: string) => void }) {
  if (!got) return <p className="text-muted-foreground">加载中……</p>
  if (got.kind === 'error') return <p className="text-muted-foreground">{got.msg}</p>
  if (got.kind === 'dir') return <DirList items={got.items} onOpen={onOpen} />
  return <Body key={got.f.path} f={got.f} onOpen={onOpen} />
}
