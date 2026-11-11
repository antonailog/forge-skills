import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ReviewIndex, rootDir, takeBack } from '@/components/ReviewIndex'
import { Boundary } from '@/components/Boundary'
import { OldReview } from '@/components/OldReview'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TopBar, setAvail, type Tab } from '@/shell/TopBar'
import { Backdrop, Reveal } from '@/shell/fx'
import { SopPage } from '@/sops/Page'
import type { SopData } from '@/sops/shared'
import { KnowledgePage } from '@/kb/Page'
import type { KData } from '@/kb/types'
import { RADIUS, V } from '@/variants'
import type { PageData } from '@/types'

// 一份阅读页管整个 记录/复盘/：放在 记录/复盘/index.html，按地址里的 # 切页面
//   #r=<项目>/<模块>/<日期-标题>  → 单篇，读那个文件夹里的 data.js
//   #o=<旧复盘相对复盘根的路径>      → 旧复盘的二级页面，原文在 index.data.js 里
//   其余（#p=项目&m=模块 或空）     → 复盘汇总，读 index.data.js
//   #sop、#d=领域、#s=编号          → 经验，读 经验.data.js（build.py 从经验库生成）
//   #kb、#k=知识点编号              → 知识，读 知识.data.js（build.py 从知识库生成）
// 复盘汇总、经验、知识三页顶上有一排切换（工作台）；单篇和旧复盘页不放
// 数据文件是 window.__FUPAN__ = {...} 的脚本：file:// 下 fetch 读不了本地文件，<script src> 可以
const cache = new Map<string, PageData>()
function loadScript(src: string): Promise<PageData> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)
  return new Promise((ok, fail) => {
    const el = document.createElement('script')
    el.src = src.split('/').map(encodeURIComponent).join('/')
    el.onload = () => {
      const w = window as unknown as { __FUPAN__?: PageData }
      const d = w.__FUPAN__
      delete w.__FUPAN__
      el.remove()
      if (!d) return fail(new Error('没有加载出来，让 AI 重建一次复盘汇总页再刷新。'))
      cache.set(src, d)
      ok(d)
    }
    el.onerror = () => fail(new Error(src.endsWith('/data.js') ? '这篇没有加载出来，让 AI 重新生成一次再打开。' : '没有加载出来，让 AI 重建一次复盘汇总页再刷新。'))
    document.head.appendChild(el)
  })
}
/** 地址里的 r：只认复盘根下的相对路径（不带协议、不以 / 开头、不含 ..） */
const safe = (r: string | null) => r && !r.includes(':') && !r.startsWith('/') && !r.split('/').includes('..') ? r : null
const route = () => safe(new URLSearchParams(location.hash.slice(1)).get('r'))
const oldRoute = () => safe(new URLSearchParams(location.hash.slice(1)).get('o'))
/** #ch1 这类页内锚点：不算换页，只滚过去 */
const isAnchor = (hash: string) => hash.length > 1 && !/(^#|&)(r|p|m|o|s|d|k)=/.test(hash) && hash !== '#sop' && hash !== '#kb'
/** 地址指向工作台的哪一页 */
const tabOf = (): Tab => {
  const h = location.hash, q = new URLSearchParams(h.slice(1))
  if (h === '#kb' || q.has('k')) return 'kb'
  if (h === '#sop' || q.has('s') || q.has('d')) return 'sop'
  return 'fupan'
}
const dark = window.matchMedia('(prefers-color-scheme: dark)')

/** 这个地址要读哪个数据文件 */
const srcOf = (tab: Tab, r: string | null) => (tab === 'sop' ? '经验.data.js' : tab === 'kb' ? '知识.data.js' : r ? `${r}/data.js` : 'index.data.js')
type View = { tab: Tab; r: string | null; o: string | null; q: URLSearchParams }

function Root() {
  const [isDark, setDark] = useState(dark.matches)
  const [r, setR] = useState(route)
  const [o, setO] = useState(oldRoute)
  const [tab, setTab] = useState(tabOf)
  const [hashQ, setHashQ] = useState(() => new URLSearchParams(location.hash.slice(1)))
  // 数据和读它时的地址存在一起：换页时新数据读到之前，接着显示上一页，不拿旧数据配新地址
  const [state, setState] = useState<{ data?: PageData; error?: string; key?: string; view?: View }>({})
  const back = useRef<number | null>(null)
  useEffect(() => { const on = (e: MediaQueryListEvent) => setDark(e.matches); dark.addEventListener('change', on); return () => dark.removeEventListener('change', on) }, [])
  useEffect(() => {
    const on = () => { if (!isAnchor(location.hash)) { setR(route()); setO(oldRoute()); setTab(tabOf()); setHashQ(new URLSearchParams(location.hash.slice(1))) } }
    // 页内锚点（目录、编号）拦下来自己滚，地址里的 #r= 不被冲掉
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href^="#"]')
      const href = a?.getAttribute('href') ?? ''
      if (!a || !isAnchor(href)) return
      e.preventDefault()
      document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('hashchange', on)
    document.addEventListener('click', click)
    return () => { window.removeEventListener('hashchange', on); document.removeEventListener('click', click) }
  }, [])
  useEffect(() => {
    const src = srcOf(tab, r), key = src + (o ?? '')
    let live = true
    loadScript(src).then((data) => {
      if (!live) return
      back.current = takeBack()
      setState({ data, key, view: { tab, r, o, q: new URLSearchParams(location.hash.slice(1)) } })
    }, (e: Error) => live && setState({ error: e.message, key }))
    return () => { live = false }
  }, [r, o, tab])
  // 换了一页：从单篇点「返回」回来的，回到点进去时的位置；其余回到顶部
  useLayoutEffect(() => { if (state.data) window.scrollTo({ top: back.current ?? 0, behavior: 'instant' }) }, [state.key, state.data])   // 直接到位，不从顶上滑过去
  // 主题挂在 <html> 上：抽屉渲染在 body 下，也要吃到同一套颜色
  useEffect(() => {
    const el = document.documentElement
    el.className = [isDark && 'dark', `theme-${V.base}`, `brand-${V.brand}`].filter(Boolean).join(' ')
    el.style.setProperty('--radius', RADIUS[V.radius])
  }, [isDark])
  // 工作台页（复盘汇总、经验、知识）顶栏放在出错边界外面：一份经验或知识点出错，还能切走
  const want = srcOf(tab, r) + (o ?? '')
  const barOf = (v: View) => (v.tab !== 'fupan' || (!v.r && !v.o) ? <><Backdrop /><TopBar cur={v.tab} /></> : null)
  if (state.error && state.key === want) return <>{barOf({ tab, r, o, q: hashQ })}<p className="p-8 text-sm text-muted-foreground">{state.error}</p></>
  const d = state.data
  const v: View | undefined = state.key === want ? { tab, r, o, q: hashQ } : state.view
  if (!d || !v) return null
  const wb = (d as { workbench?: { sop?: boolean; kb?: boolean } }).workbench
  if (wb) setAvail(wb)   // 三份数据都带「有没有经验库、知识库」，顶栏才知道放哪几个页签
  const bar = barOf(v)
  let page: ReactNode
  const kind = (d as { kind: string }).kind
  const key = `${state.key}#${v.q.toString()}`
  if (kind === 'sops') return <>{bar}<Boundary key={key} hint="这份没有显示出来，让 AI 重建一次复盘汇总页再刷新。"><Reveal><SopPage data={d as unknown as SopData} hash={v.q} /></Reveal></Boundary></>
  if (kind === 'knowledge') return <>{bar}<Boundary key={key} hint="知识页没有显示出来，让 AI 重建一次复盘汇总页再刷新。"><KnowledgePage key={v.q.get('k') ?? ''} data={d as unknown as KData} hash={v.q} /></Boundary></>
  if (d.kind !== 'index') page = <App data={d} dark={isDark} />
  else if (v.o) {
    const vo = v.o
    const hit = d.projects.flatMap((p) => p.old.map((x) => ({ x, p: p.name }))).find(({ x }) => x.rel === vo || x.path === rootDir() + vo || x.path.endsWith('/' + vo))
    page = hit ? <OldReview o={hit.x} project={hit.p} /> : <p className="p-8 text-sm text-muted-foreground">找不到这篇旧复盘：{vo}</p>
  } else return <>{bar}<Boundary key={state.key}><Reveal><ReviewIndex data={d} /></Reveal></Boundary></>
  return <Boundary key={state.key}>{page}</Boundary>
}

createRoot(document.getElementById('root')!).render(<StrictMode><TooltipProvider delayDuration={150}><Root /></TooltipProvider></StrictMode>)
