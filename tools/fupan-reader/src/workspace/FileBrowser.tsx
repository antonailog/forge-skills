import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Star } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { api, type Item, type Zone } from '@/workspace/api'
import { Content, Head, useEntry } from '@/workspace/FileView'
import { Icon } from '@/workspace/parts'

// 文件区：工作区、成果、调研、数据、归档放在一个视图里，顶上页签切换。
// 左栏是文件树：能逐层展开，每个文件一句话说明（md 取标题或第一段、代码取开头注释、JSON 说多少条什么字段），
// 关键文件（文件夹的主文档、项目.md 里链到的）星标高亮；右栏直接看选中的文件，文件里的链接在右栏接着开

const ORDER = ['2-工作区', '1-工作区', '3-结果区', '2-结果区', '1-调研', '3-素材', '4-数据', '9-归档']
const target = (i: Item) => (i.dir ? i.doc ?? i.path + '/' : i.path)

function Node({ item, depth, sel, pick }: { item: Item; depth: number; sel: string | null; pick: (path: string) => void }) {
  const [open, setOpen] = useState(false)
  const [kids, setKids] = useState<Item[] | null>(null)
  useEffect(() => { if (open && !kids) api.list(item.path).then((r) => setKids(r.items), () => setKids([])) }, [open, kids, item.path])
  const on = sel === target(item) || sel === item.path
  const click = () => { if (item.dir) setOpen((o) => !o); pick(target(item)) }
  // 文件夹的主文档排第一，其次是别的关键文件（项目.md 里链到的），其余照原顺序
  const rank = (k: Item) => (k.path === item.doc ? 2 : k.key ? 1 : 0)
  const sorted = useMemo(() => kids && [...kids].sort((a, b) => rank(b) - rank(a)), [kids]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <li>
      <button type="button" onClick={click} title={item.desc || item.name} style={{ paddingLeft: `${depth * 1.1 + 0.5}rem` }}
        className={cn('group flex w-full items-center gap-1.5 py-1.5 pr-3 text-left transition-colors', on ? 'bg-brand-soft shadow-[inset_2px_0_0_var(--brand)]' : 'hover:bg-muted/60')}>
        <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', !item.dir && 'invisible', open && 'rotate-90')} />
        <Icon path={item.path} dir={item.dir} open={open} className={item.key ? 'text-brand' : undefined} />
        <span className={cn('shrink-0 whitespace-nowrap', depth === 0 && 'font-medium', item.key && 'font-medium text-brand', on && 'text-brand')}>{item.name}</span>
        {item.key && <Star className="size-3.5 shrink-0 fill-brand text-brand" />}
        {item.desc && <span className="min-w-0 truncate text-muted-foreground">{item.desc}</span>}
      </button>
      {open && (
        <ul>
          {!sorted && <li className="py-1.5 text-muted-foreground" style={{ paddingLeft: `${(depth + 1) * 1.1 + 1.6}rem` }}>加载中……</li>}
          {sorted?.length === 0 && <li className="py-1.5 text-muted-foreground" style={{ paddingLeft: `${(depth + 1) * 1.1 + 1.6}rem` }}>空文件夹</li>}
          {sorted?.map((k) => <Node key={k.path} item={k} depth={depth + 1} sel={sel} pick={pick} />)}
        </ul>
      )}
    </li>
  )
}

/** prefer：优先打开的文件（项目页「现在」结果那行链到的），哪个页签里有它，那个页签默认就开它 */
export function FileBrowser({ zones, prefer = [] }: { zones: Zone[]; prefer?: string[] }) {
  const tabs = useMemo(() => [...zones].sort((a, b) => ORDER.indexOf(a.zone) - ORDER.indexOf(b.zone)), [zones])
  const [tab, setTab] = useState(tabs[0]?.zone ?? '')
  const zone = tabs.find((z) => z.zone === tab)
  // 右栏看过的路径：文件里点链接往下看，「返回上一份」退回来；换页签、在左栏点别的就重新开始
  const [stack, setStack] = useState<string[]>([])
  const first = (z?: Zone) => {
    const want = prefer.find((x) => z?.items.some((i) => x === i.path || x.startsWith(i.path + '/')))
    if (want) return want
    const i = z?.items.find((x) => x.key || x.doc) ?? z?.items[0]
    return i ? target(i) : null
  }
  useEffect(() => { const f = first(zone); setStack(f ? [f] : []) }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  const cur = stack[stack.length - 1] ?? null
  const got = useEntry(cur)
  const pick = (p: string) => setStack([p])
  const follow = (p: string) => setStack((s) => (s[s.length - 1] === p ? s : [...s, p]))
  const isKey = useMemo(() => {
    if (!cur) return false
    const hit = zone?.items.find((i) => i.path === cur || i.doc === cur)
    return !!hit?.key || !!hit?.doc
  }, [cur, zone])
  if (!tabs.length) return <p className="text-muted-foreground">这个项目还没有分区文件夹</p>
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {tabs.map((z) => <TabsTrigger key={z.zone} value={z.zone} className="gap-1.5">{z.label}<span className="text-muted-foreground">{z.items.length}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="grid h-[calc(100vh-var(--bar)-7rem)] min-h-[34rem] grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)] overflow-hidden rounded-lg border bg-card">
        <nav className="min-h-0 overflow-y-auto border-r py-2">
          <p className="px-3 pb-2 text-muted-foreground">{zone?.zone}　<Star className="inline size-3.5 fill-brand text-brand" /> 是关键文件</p>
          <ul>{zone?.items.map((i) => <Node key={i.path} item={i} depth={0} sel={cur} pick={pick} />)}</ul>
        </nav>
        <section className="flex min-h-0 min-w-0 flex-col">
          {cur ? (
            <>
              <header className="flex flex-col gap-2 border-b px-6 py-4">
                <Head path={cur} got={got} isKey={isKey} back={stack.length > 1 ? () => setStack((s) => s.slice(0, -1)) : undefined}
                  Title={({ className, children }) => <h4 className={className}>{children}</h4>}
                  Desc={({ className, children }) => <p className={className}>{children}</p>} />
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-6 text-sm typo-body"><Content got={got} onOpen={follow} /></div>
            </>
          ) : <p className="p-6 text-muted-foreground">左边点一个文件</p>}
        </section>
      </div>
    </div>
  )
}
