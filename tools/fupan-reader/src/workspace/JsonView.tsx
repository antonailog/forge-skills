import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

// 原始数据（JSON / JSONL）：可折叠的树；遇到「对象组成的列表」直接摆成表格，标题、赞藏评一列一列看
// 只用 shadcn 的 Collapsible 和 Table；字号、颜色沿用复盘阅读页的 token

type J = unknown
const isObj = (v: J): v is Record<string, J> => !!v && typeof v === 'object' && !Array.isArray(v)
const MAX_ROWS = 300, MAX_KEYS = 500, MAX_COLS = 14

function brief(v: J): string {
  if (Array.isArray(v)) return `[${v.length}]`
  if (isObj(v)) return '{…}'
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 80) + '…' : v
  return v === null ? 'null' : String(v)
}

function Leaf({ v }: { v: J }) {
  if (v === null) return <span className="text-muted-foreground">null</span>
  if (typeof v === 'string') return <span className="break-all text-emerald-700 dark:text-emerald-400">"{v.length > 800 ? v.slice(0, 800) + '…' : v}"</span>
  if (typeof v === 'number' || typeof v === 'boolean') return <span className="text-amber-700 dark:text-amber-400">{String(v)}</span>
  return <span>{String(v)}</span>
}

/** 对象列表 → 表格：列取前 50 条里出现过的键，最多 14 列；单元格放不下就截断，悬停看全文 */
export function ObjTable({ rows }: { rows: Record<string, J>[] }) {
  const cols = useMemo(() => {
    const out: string[] = []
    for (const o of rows.slice(0, 50)) for (const k of Object.keys(o)) if (!out.includes(k) && out.length < MAX_COLS) out.push(k)
    return out
  }, [rows])
  return (
    <div className="flex flex-col gap-1.5">
      <div className="max-h-[60vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 bg-muted">
            <TableRow><TableHead className="w-10 text-muted-foreground">#</TableHead>{cols.map((c) => <TableHead key={c} className="font-mono">{c}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, MAX_ROWS).map((o, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground tabular-nums">{i}</TableCell>
                {cols.map((c) => <TableCell key={c} title={brief(o[c])} className="max-w-[18rem] truncate">{brief(o[c])}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > MAX_ROWS && <span className="text-muted-foreground">只列了前 {MAX_ROWS} 行，一共 {rows.length} 行；全部看「原文」</span>}
    </div>
  )
}

function Node({ k, v, depth }: { k: string | number | null; v: J; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const label = k === null ? null : <span className="text-brand">{k}</span>
  if (!v || typeof v !== 'object') return <div className="py-0.5 pl-5">{label}{label && ': '}<Leaf v={v} /></div>
  const arr = Array.isArray(v)
  const n = arr ? v.length : Object.keys(v).length
  const rowsOfObjs = arr && n >= 2 && v.every(isObj)
  const entries: [string | number, J][] = arr ? v.slice(0, MAX_KEYS).map((x, i) => [i, x]) : Object.entries(v).slice(0, MAX_KEYS)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 rounded py-0.5 text-left hover:bg-muted/60">
        <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        {label}{label && ': '}<span className="text-muted-foreground">{arr ? `[${n}]` : `{${n}}`}{rowsOfObjs && '　表格'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-l pl-3 ml-2">
        {open && (rowsOfObjs ? <div className="py-2"><ObjTable rows={v as Record<string, J>[]} /></div>
          : <>{entries.map(([kk, x]) => <Node key={kk} k={kk} v={x} depth={depth + 1} />)}{n > MAX_KEYS && <div className="pl-5 text-muted-foreground">还有 {n - MAX_KEYS} 项</div>}</>)}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function JsonTree({ data }: { data: J }) {
  return <div className="font-mono text-sm leading-relaxed"><Node k={null} v={data} depth={0} /></div>
}

/** JSON / JSONL 文本 → 数据；解析不了返回错误 */
export function parseJson(text: string, jsonl: boolean): { data?: J; error?: string } {
  try {
    return { data: jsonl ? text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : JSON.parse(text) }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/** CSV / TSV → 表格（引号里的逗号、换行之外的常见情况） */
export function parseCsv(text: string, sep: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, MAX_ROWS + 1).map((l) => {
    const out: string[] = []; let cur = '', q = false
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
      else if (ch === '"') q = true
      else if (ch === sep) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out
  })
  const [head = [], ...body] = lines
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h || `列${i + 1}`, r[i] ?? ''])))
}
