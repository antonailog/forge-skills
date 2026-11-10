import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileIcon, projectOf } from '@/components/fileMeta'
import { cn } from '@/lib/utils'
import type { CodeFile, Opened, SessionData } from '@/types'

// 关键文件和代码文件的排法：
// 关键文件是设置面板，设定值在右侧突出；代码文件两列小卡。每一项只有一处粗体，长句不加粗；点了走右侧抽屉

type Open = (o: Opened) => void
const Modified = () => <Badge variant="secondary" className="text-sm font-normal">修改</Badge>

/** 文件名这一行：灰色，代码文件带项目名 */
function FileLine({ data, file, project }: { data: SessionData; file: string; project?: boolean }) {
  const f = data.files[file]
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
      <span>{f.name}</span>
      {project && <span>· {projectOf(f.path)}</span>}
      {f.status === '修改' && <Modified />}
    </span>
  )
}

/* ---------------- 关键文件 ---------------- */

export function KeyFilesView({ data, open }: { data: SessionData; open: Open }) {
  const items = data.keyFiles
  return (
    <Card className="gap-0 py-0 text-sm shadow-none">
      {items.map((k, i) => (
        <button key={k.file} type="button" onClick={() => open({ key: k.file })}
          className={cn('flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-muted/50', i && 'border-t')}>
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"><FileIcon f={data.files[k.file]} /></span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span>{k.title}</span>
            <span className="text-muted-foreground">{data.files[k.file].name}</span>
          </span>
          <span className={cn('shrink-0 text-right', k.value ? 'text-base font-semibold' : 'max-w-[45%] text-muted-foreground')}>{k.value ?? k.detail}</span>
        </button>
      ))}
    </Card>
  )
}

/* ---------------- 代码文件（一个模块里的） ---------------- */

export function CodeFilesView({ files, data, open }: { files: CodeFile[]; data: SessionData; open: Open }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {files.map((cf) => (
        <button key={cf.file} type="button" onClick={() => open({ key: cf.file })}
          className="flex flex-col gap-2 rounded-lg bg-muted/50 p-4 text-left transition hover:bg-muted">
          <span className="flex items-center gap-2"><FileIcon f={data.files[cf.file]} className="text-brand" /><span className="text-base font-semibold">{cf.title}</span></span>
          <span className="line-clamp-2">{cf.detail}</span>
          <span className="mt-auto pt-1"><FileLine data={data} file={cf.file} project /></span>
        </button>
      ))}
    </div>
  )
}
