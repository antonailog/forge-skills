import { useEffect, useState } from 'react'
import { Lab3D } from './Lab3D'
import { StateIcon } from './StateIcon'
import type { KData, KState, Nav } from './types'

// 知识页：3D 同心球 + 左侧清单 + 居中弹窗。地址 #k=K0014 直接打开那个知识点，#kb 是只看地图；学过 / 碰过 / 没碰过的总数放在清单标题下
export function KnowledgePage({ data, hash }: { data: KData; hash: URLSearchParams }) {
  const [sel, setSelState] = useState<string | null>(() => { const k = hash.get('k'); return k && data.points[k] ? k : null })
  const setSel = (id: string | null) => { setSelState(id); history.replaceState(null, '', '#' + (id ? new URLSearchParams({ k: id }).toString() : 'kb')) }
  const nav: Nav = { data, sel, setSel }
  useEffect(() => { document.title = '知识' }, [])
  const stats = <span className="flex flex-wrap gap-x-3 text-muted-foreground">{(['学过', '碰过', '没碰过'] as KState[]).map((s) => <span key={s} className="inline-flex items-center gap-1.5 whitespace-nowrap"><StateIcon s={s} />{s} {data.total[s]}</span>)}</span>
  return <div className="h-[calc(100vh-3.5rem)]"><Lab3D nav={nav} stats={stats} /></div>
}
