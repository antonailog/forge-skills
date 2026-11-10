import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CopyButton } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { LeftoverItem, Opened, SessionData } from '@/types'
import type { Variant } from '@/variants'
import { T } from '@/typo'

const OWNER: Record<LeftoverItem['owner'], { label: string; cls: string }> = {
  decide: { label: '待你决定', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300' },
  wait: { label: '等条件', cls: 'bg-secondary text-secondary-foreground' },
  ai: { label: 'AI 来做', cls: 'bg-secondary text-secondary-foreground' },
}


/** 行动清单：一条一行，谁来做、什么时候能做、接着做时复制给 AI 的一句话 */
export function Leftovers({ data, v, open }: { data: SessionData; v: Variant; open: (o: Opened) => void }) {
  return (
    <section className="flex flex-col gap-4 typo-body">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h3 className={T.h3}>遗留事项</h3>
          <span className="text-muted-foreground">{data.leftovers.asOf}</span>
        </div>
        {data.files[data.leftovers.status] && (
          <button type="button" onClick={() => open({ key: data.leftovers.status })} className="text-sm text-brand hover:underline">
            项目最新状态：{data.files[data.leftovers.status].path}
          </button>
        )}
      </div>
      <Card className="gap-0 py-0 text-sm shadow-none">
        {data.leftovers.items.map((it, i) => (
          <div key={it.title} className={cn('grid items-center gap-x-4 gap-y-2 sm:grid-cols-[6.5em_minmax(0,1fr)_auto]', v.density === 'cozy' ? 'p-5' : 'p-4', i && 'border-t')}>
            <Badge className={cn('text-sm font-normal', OWNER[it.owner].cls)}>{OWNER[it.owner].label}</Badge>
            <div className="flex min-w-0 flex-col gap-1">
              <span className={T.name}>{it.title}</span>
              <span className="text-muted-foreground">{it.note}{it.when !== '随时' && `；${it.when}`}</span>
            </div>
            <CopyButton text={it.prompt} />
          </div>
        ))}
      </Card>
    </section>
  )
}
