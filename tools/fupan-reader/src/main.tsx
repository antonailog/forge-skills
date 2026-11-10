import { Component, StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ReviewIndex, rootDir } from '@/components/ReviewIndex'
import { OldReview } from '@/components/OldReview'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RADIUS, V } from '@/variants'
import type { PageData } from '@/types'

// 一份阅读页管整个 记录/复盘/：放在 记录/复盘/index.html，按地址里的 # 切页面
//   #r=<项目>/<模块>/<日期-标题>  → 单篇，读那个文件夹里的 data.js
//   #o=<旧复盘相对复盘根的路径>      → 旧复盘的二级页面，原文在 index.data.js 里
//   其余（#p=项目&m=模块 或空）     → 复盘汇总，读 index.data.js
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
      if (!d) return fail(new Error(`${src} 里没有数据`))
      cache.set(src, d)
      ok(d)
    }
    el.onerror = () => fail(new Error(`读不到 ${src}`))
    document.head.appendChild(el)
  })
}
/** 地址里的 r：只认复盘根下的相对路径（不带协议、不以 / 开头、不含 ..） */
const safe = (r: string | null) => r && !r.includes(':') && !r.startsWith('/') && !r.split('/').includes('..') ? r : null
const route = () => safe(new URLSearchParams(location.hash.slice(1)).get('r'))
const oldRoute = () => safe(new URLSearchParams(location.hash.slice(1)).get('o'))
/** #ch1 这类页内锚点：不算换页，只滚过去 */
const isAnchor = (hash: string) => hash.length > 1 && !/(^#|&)(r|p|m|o)=/.test(hash)
const dark = window.matchMedia('(prefers-color-scheme: dark)')

/** 页面渲染出错时把报错显示出来，不留一片白 */
class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    return this.state.error
      ? <p className="p-8 text-sm text-muted-foreground">页面出错了：{this.state.error.message}。用 build.py --check 检查这篇复盘的数据。</p>
      : this.props.children
  }
}

function Root() {
  const [isDark, setDark] = useState(dark.matches)
  const [r, setR] = useState(route)
  const [o, setO] = useState(oldRoute)
  const [state, setState] = useState<{ data?: PageData; error?: string; key?: string }>({})
  useEffect(() => { const on = (e: MediaQueryListEvent) => setDark(e.matches); dark.addEventListener('change', on); return () => dark.removeEventListener('change', on) }, [])
  useEffect(() => {
    const on = () => { if (!isAnchor(location.hash)) { setR(route()); setO(oldRoute()) } }
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
    const src = r ? `${r}/data.js` : 'index.data.js'
    let live = true
    loadScript(src).then((data) => { if (live) { setState({ data, key: src + (o ?? '') }); if (r || o) window.scrollTo({ top: 0 }) } }, (e: Error) => live && setState({ error: e.message }))
    return () => { live = false }
  }, [r, o])
  // 主题挂在 <html> 上：抽屉渲染在 body 下，也要吃到同一套颜色
  useEffect(() => {
    const el = document.documentElement
    el.className = [isDark && 'dark', `theme-${V.base}`, `brand-${V.brand}`].filter(Boolean).join(' ')
    el.style.setProperty('--radius', RADIUS[V.radius])
  }, [isDark])
  if (state.error) return <p className="p-8 text-sm text-muted-foreground">{state.error}</p>
  const d = state.data
  if (!d) return null
  let page: ReactNode
  if (d.kind !== 'index') page = <App data={d} dark={isDark} />
  else if (o) {
    const hit = d.projects.flatMap((p) => p.old.map((x) => ({ x, p: p.name }))).find(({ x }) => x.rel === o || x.path === rootDir() + o || x.path.endsWith('/' + o))
    page = hit ? <OldReview o={hit.x} project={hit.p} /> : <p className="p-8 text-sm text-muted-foreground">找不到这篇旧复盘：{o}</p>
  } else page = <ReviewIndex data={d} />
  return <Boundary key={state.key}>{page}</Boundary>
}

createRoot(document.getElementById('root')!).render(<StrictMode><TooltipProvider delayDuration={150}><Root /></TooltipProvider></StrictMode>)
