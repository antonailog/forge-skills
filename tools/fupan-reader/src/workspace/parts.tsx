import type { ReactNode } from 'react'
import { FileCode2, FileImage, FileText, Folder, FolderOpen, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import { extOf, hrefOf, IMAGE, join, readHash } from '@/workspace/api'

/** 在右侧抽屉打开：改地址里的 f，浏览器的后退能关抽屉、回上一份 */
export const openFile = (path: string) => { location.hash = hrefOf(readHash().p, path) }

/** 文件图标：和复盘阅读页 fileMeta 同一组 lucide 图标；数据表多一个表格图标 */
export function Icon({ path, dir, open, className }: { path: string; dir?: boolean; open?: boolean; className?: string }) {
  const cls = cn('size-4 shrink-0 text-muted-foreground', className)
  if (dir) return open ? <FolderOpen className={cls} /> : <Folder className={cls} />
  const e = extOf(path)
  if (e === '.md' || e === '.txt') return <FileText className={cls} />
  if (IMAGE.has(e)) return <FileImage className={cls} />
  if (['.json', '.jsonl', '.csv', '.tsv', '.xlsx', '.xls'].includes(e)) return <Table2 className={cls} />
  return <FileCode2 className={cls} />
}

/** 节标题：和复盘单篇的「过程回顾」「交付物」同一级（T.h3），右边一句灰字提示 */
export function Section({ id, title, hint, children, className }: { id: string; title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('flex scroll-mt-[calc(var(--bar)+2rem)] flex-col gap-4', className)}>
      <h3 className={cn(T.h3, 'flex flex-wrap items-baseline gap-3')}>{title}{hint && <span className="text-sm font-normal text-muted-foreground">{hint}</span>}</h3>
      {children}
    </section>
  )
}

/** 项目.md 里的一行字：[字](相对路径) 变成可点的链接（在右侧抽屉打开），外链新标签打开；**、` 去掉。base 是 项目.md 所在的项目路径 */
export function Inline({ text, base }: { text: string; base: string }) {
  const out: ReactNode[] = []
  const re = /\[([^\]]+)\]\(<?([^)<>\s]+)>?\)/g
  let last = 0
  let m: RegExpExecArray | null
  const clean = (s: string) => s.replace(/\*\*|`/g, '')
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(clean(text.slice(last, m.index)))
    const [, label, href] = m
    const cls = 'text-brand underline decoration-brand/30 underline-offset-4 transition-colors hover:decoration-brand'
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) out.push(<a key={m.index} href={href} target="_blank" rel="noreferrer" className={cls}>{clean(label)}</a>)
    else {
      const path = join(base, decodeURI(href.split('#')[0])) + (href.endsWith('/') ? '/' : '')
      out.push(<button key={m.index} type="button" onClick={() => openFile(path)} className={cn(cls, 'text-left')}>{clean(label)}</button>)
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(clean(text.slice(last)))
  return <>{out}</>
}
