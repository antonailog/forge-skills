import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as THREE from 'three'
import { Search } from 'lucide-react'
import { buildTree, pathTo, type Kind, type TNode } from './tree'
import { place, norm, useSize, type V } from './geo'
import { DetailHost } from './DetailHost'
import { iconOf } from './icons3d'
import { cn } from '@/lib/utils'
import type { KState, Nav } from './types'

// 知识页：3D 同心球，一级内层、二级中层、知识点外层（从知识页样稿 Lab3D 搬来）。
// 样式是 11-10 在样稿里定的那组：光点 + 亮起的才带名字，大小按复盘里提到的篇数，直线连线，远处变淡；左边浮着清单，顶上居中搜索

type N = NodeObject & { id: string; kind: Kind; t: TNode }
type L = LinkObject & { source: string | N; target: string | N }
type Role = 'hi' | 'self' | 'path' | 'dim'

// 深色跟系统走：底色和页面深色底一致
const PAL = {
  light: { bg: '#fafafa', ink: '#171717', mid: '#9a9a9a', dim: '#d2d2d2', fHi: '#171717', fSelf: '#525252', fPath: '#a3a3a3', fDim: '#e8e8e8', iHi: '#ffffff', iDim: '#a3a3a3', link: '#ececec', linkHi: '#b5b5b5', halo: 'rgba(23,23,23,0.14)', state: { 学过: '#059669', 碰过: '#d97706', 没碰过: '#a3a3a3' } },
  dark: { bg: '#0a0a0a', ink: '#f5f5f5', mid: '#8b93a7', dim: '#3a4150', fHi: '#f5f5f5', fSelf: '#9aa3b5', fPath: '#5b6476', fDim: '#222734', iHi: '#0a0a0a', iDim: '#5b6476', link: '#1b2029', linkHi: '#58627a', halo: 'rgba(255,255,255,0.22)', state: { 学过: '#34d399', 碰过: '#fbbf24', 没碰过: '#9ca3af' } },
}
type Pal = (typeof PAL)['light']

const FONT = '-apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif'
const DOT: Record<Kind, number> = { root: 0, domain: 7, group: 4.6, point: 3.2 }
const LABEL: Record<Kind, number> = { root: 0, domain: 6.2, group: 4.4, point: 3.6 }

/* ---------- 画布贴图：圆盘，按颜色缓存 ---------- */
const texCache = new Map<string, THREE.Texture>()
function discTex(fill: string): THREE.Texture {
  const key = `d|${fill}`
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas'); c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill()
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, tex)
  return tex
}
const sprite = (tex: THREE.Texture, w: number, h = w, order = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  s.scale.set(w, h, 1); s.renderOrder = 20 + order // 连线的绘制顺序靠后，节点要排在它之后才能盖住线
  return s
}


/** 系统深浅色：跟着变 */
function useDark() {
  const [d, setD] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)'), on = (e: MediaQueryListEvent) => setD(e.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return d
}

export function Lab3D({ nav, stats }: { nav: Nav; stats?: ReactNode }) {
  const { root, byId } = useMemo(() => buildTree(nav.data), [nav.data])
  const [fid, setFid] = useState('root')
  const [show, setShow] = useState(() => !!nav.sel) // 地址里带了知识点（#k=…，比如从经验页的知识标签点过来）就直接打开弹窗
  const [hover, setHover] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [ready, setReady] = useState(false)
  const fg = useRef<ForceGraphMethods<N, L>>(undefined)
  const searchRef = useRef<HTMLInputElement>(null)
  const { ref, w, h } = useSize<HTMLDivElement>()
  const dark = useDark()
  const P: Pal = dark ? PAL.dark : PAL.light

  useEffect(() => setReady(true), [])

  const graph = useMemo(() => {
    const nodes: N[] = []
    const links: L[] = []
    const fixed = new Map<string, V>()
    place(root, fixed)
    const walk = (t: TNode) => {
      const f = t.kind === 'root' ? ([0, 0, 0] as V) : fixed.get(t.id)!
      nodes.push({ id: t.id, kind: t.kind, t, fx: f[0], fy: f[1], fz: f[2] })
      t.children.forEach((c) => { links.push({ source: t.id, target: c.id }); walk(c) })
    }
    walk(root)
    return { nodes, links }
  }, [root])

  /* 大小依据：复盘里提到的篇数；上层是下层之和；同一层里按平方根缩放到 1–1.45 倍 */
  const metric = useMemo(() => {
    const m = new Map<string, number>()
    const walk = (t: TNode): number => {
      const c = t.kind === 'point' ? nav.data.points[t.id].nMention : t.children.reduce((s, x) => s + walk(x), 0)
      m.set(t.id, c)
      return c
    }
    walk(root)
    const maxes = {} as Record<Kind, number>
    for (const k of ['domain', 'group', 'point'] as Kind[]) maxes[k] = Math.max(1, ...[...byId.values()].filter((t) => t.kind === k).map((t) => m.get(t.id) ?? 0))
    return { m, maxes }
  }, [root, byId, nav.data])
  const scale = useCallback((t: TNode) => (t.kind === 'root' ? 1 : 1 + 0.45 * Math.sqrt((metric.m.get(t.id) ?? 0) / metric.maxes[t.kind])), [metric])

  const focus = byId.get(fid) ?? root
  const hi = useMemo(() => new Set(focus.children.map((c) => c.id)), [focus])
  const path = useMemo(() => new Set(pathTo(focus).map((t) => t.id)), [focus])
  const role = useCallback((id: string): Role => (hi.has(id) ? 'hi' : id === fid ? 'self' : path.has(id) ? 'path' : 'dim'), [hi, fid, path])
  const clickable = useCallback((t: TNode) => t.kind === 'point' || t.children.length > 0, [])

  /* ---------- 镜头 ---------- */
  const fog = useCallback((near: number, far: number) => {
    const sc = fg.current?.scene()
    if (sc) sc.fog = new THREE.Fog(P.bg, near, far)
  }, [P.bg])
  const home = useCallback((ms: number) => {
    fg.current?.zoomToFit(ms, 60, (n: N) => n.kind === 'domain')
    setTimeout(() => { const d = fg.current?.camera().position.length() ?? 600; fog(d, d * 2) }, ms + 40)
  }, [fog])
  const flyTo = useCallback((t: TNode) => {
    const f = fg.current
    if (!f) return
    if (t.kind === 'root') { home(900); return }
    // 只看子节点那一圈：父节点在内层、离得远，算进去镜头就拉得太远
    const pts = (t.children.length ? t.children : [t]).map((c) => graph.nodes.find((x) => x.id === c.id)!)
    const c = [0, 1, 2].map((i) => pts.reduce((s, n) => s + ([n.fx, n.fy, n.fz][i] ?? 0), 0) / pts.length) as V
    const spread = Math.max(25, ...pts.map((n) => Math.hypot((n.fx ?? 0) - c[0], (n.fy ?? 0) - c[1], (n.fz ?? 0) - c[2])))
    const dist = Math.max(spread * 3.5 + 60, 300)
    const d = norm(Math.hypot(...c) > 1 ? c : [0, 0, 1])
    const pos = { x: c[0] + d[0] * dist, y: c[1] + d[1] * dist, z: c[2] + d[2] * dist }
    // 镜头飞到那一团跟前
    f.cameraPosition(pos, { x: c[0], y: c[1], z: c[2] }, 1000)
    fog(dist + spread, dist + spread + dist * 1.3)
  }, [graph, home, fog])
  const go = useCallback((t: TNode) => { setFid(t.id); flyTo(t) }, [flyTo])

  const open = useCallback((t: TNode) => {
    if (t.kind === 'point') { nav.setSel(t.id); setShow(true); return }
    if (t.children.length) go(t)
  }, [nav, go])
  const clickNode = useCallback((t: TNode) => { if (clickable(t)) open(t) }, [clickable, open])

  useEffect(() => { const id = setTimeout(() => home(0), 80); return () => clearTimeout(id) }, [home, ready])
  useEffect(() => {
    const c = fg.current?.controls() as { autoRotate?: boolean; autoRotateSpeed?: number } | undefined
    if (c) { c.autoRotate = fid === 'root'; c.autoRotateSpeed = 0.5 }
  }, [fid, ready])
  // 系统换深浅色：只重设雾的颜色，不动镜头
  useEffect(() => {
    const f = fg.current
    const sc = f?.scene()
    if (!f || !sc) return
    const d = f.camera().position.length()
    sc.fog = new THREE.Fog(P.bg, d * 0.9, d * 2.1)
  }, [P.bg, ready])

  /* ---------- 关键词长什么样 ---------- */
  const makeNode = useCallback((n: N) => {
    const t = n.t
    const r = role(t.id)
    const s = scale(t)
    const isSel = t.id === nav.sel && show
    const hov = t.id === hover
    const bright = r === 'hi' || r === 'self' || isSel || hov
    const stateCol = t.kind === 'point' ? P.state[t.state as KState] : null
    const labelCol = isSel || hov ? P.ink : r === 'hi' ? (stateCol ?? P.ink) : r === 'self' ? P.ink : r === 'path' ? P.mid : P.dim
    // 光点：圆盘 + 亮起的才在下面挂名字
    const g = new THREE.Group()
    const d = DOT[t.kind] * s
    const fill = isSel ? P.ink : t.kind === 'point' ? (r === 'hi' || hov ? stateCol! : r === 'path' ? P.fPath : P.fDim)
      : r === 'hi' || hov ? P.fHi : r === 'self' ? P.fSelf : r === 'path' ? P.fPath : P.fDim
    g.add(sprite(discTex(fill), d, d, 2))
    if (bright && !(r === 'self' && !isSel && !hov)) {
      const st = new SpriteText(t.label, LABEL[t.kind] * s * 1.15, labelCol)
      st.fontFace = FONT; st.fontWeight = bright ? '600' : '400'
      st.material.depthWrite = false; st.renderOrder = 23
      st.center.set(0.5, 1 + (d / 2 + 1) / st.scale.y) // 按屏幕方向挂在圆盘下面，镜头从哪个角度看都不叠
      g.add(st)
    }
    return g
  }, [role, scale, nav.sel, show, hover, P])
  const nodeVisible = useCallback((n: N) => n.kind !== 'root', [])

  const linkMat = useMemo(() => ({
    lo: new THREE.LineBasicMaterial({ color: P.link, transparent: true, opacity: 0.9, depthWrite: false }),
    hi: new THREE.LineBasicMaterial({ color: P.linkHi, transparent: true, opacity: 0.9, depthWrite: false }),
  }), [P])
  const isHiLink = useCallback((l: L) => {
    const s = (l.source as N).id ?? l.source, t = (l.target as N).id ?? l.target
    return s === fid && hi.has(t as string)
  }, [fid, hi])
  const linkVisible = useCallback((l: L) => (l.source as N).kind !== 'root', [])
  const linkMaterial = useCallback((l: L) => (isHiLink(l) ? linkMat.hi : linkMat.lo), [isHiLink, linkMat])

  /* ---------- ⌘K 搜索 ---------- */
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  const hits = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return []
    return [...byId.values()].filter((t) => t.kind !== 'root' && t.label.toLowerCase().includes(k)).slice(0, 8)
  }, [q, byId])
  const jump = (t: TNode) => {
    setQ('')
    if (t.kind === 'point') { go(t.parent!); nav.setSel(t.id); setTimeout(() => setShow(true), 700) } else go(t)
  }


  const crumbs = pathTo(focus).map((t, i, a) => (
    <span key={t.id} className="flex items-center gap-2">
      {i > 0 && <span>›</span>}
      <button type="button" onClick={() => go(t)} className={cn('hover:text-foreground', i === a.length - 1 && 'font-semibold text-foreground')}>{t.label}</button>
    </span>
  ))
  const p = nav.sel ? nav.data.points[nav.sel] : null

  return (
    <div className="relative h-full">
      {/* 3D 图铺满整块，图和搜索框按整块宽度居中；清单浮在左边，四周留边 */}
      <div ref={ref} className="absolute inset-0 overflow-hidden" style={{ background: P.bg }}>
        <div className="absolute top-5 left-1/2 z-20 w-[420px] -translate-x-1/2">
            <label className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm">
              <Search className="size-4 text-muted-foreground" />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索关键词"
                onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) jump(hits[0]); if (e.key === 'Escape') setQ('') }}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
              <kbd className="rounded border px-1.5 text-muted-foreground">⌘K</kbd>
            </label>
            {hits.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-lg border bg-background shadow-md">
                {hits.map((t) => {
                  const I = iconOf(t)
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => jump(t)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted">
                        <I className="size-4 text-muted-foreground" />{t.label}
                        <span className="ml-auto truncate text-muted-foreground">{pathTo(t).slice(1, -1).map((x) => x.label).join(' › ')}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

        <ForceGraph3D<N, L>
          ref={fg} graphData={graph} width={w} height={h} backgroundColor={P.bg} controlType="orbit" showNavInfo={false}
          nodeThreeObject={makeNode} nodeVisibility={nodeVisible}
          onNodeClick={(n: N) => clickNode(n.t)}
          onNodeHover={(n: N | null) => { setHover(n ? n.id : null); if (ref.current) ref.current.style.cursor = n && clickable(n.t) ? 'pointer' : '' }}
          onBackgroundClick={() => { if (focus.parent) go(focus.parent) }}
          linkVisibility={linkVisible} linkMaterial={linkMaterial} linkWidth={0}
          enableNodeDrag={false} warmupTicks={0} cooldownTicks={0}
        />
      </div>
      <div className="absolute top-4 bottom-4 left-4 z-30 flex w-[280px] flex-col overflow-hidden rounded-xl border bg-background/95 shadow-sm backdrop-blur">
          <div className="flex items-start gap-2 border-b px-5 py-4">
            <div className="flex flex-1 flex-col gap-1.5"><nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">{crumbs}</nav>{stats}</div>
          </div>
          <ul className="flex flex-col overflow-y-auto p-2">
            {focus.children.map((t) => {
              const I = iconOf(t)
              const st = t.kind === 'point' ? nav.data.points[t.id].state : null
              return (
                <li key={t.id}>
                  <button type="button" onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} onClick={() => open(t)}
                    className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-muted', t.id === nav.sel && show && 'bg-foreground/10 font-medium')}>
                    <I className={cn('size-4 shrink-0', st ? { 学过: 'text-emerald-600', 碰过: 'text-amber-600', 没碰过: 'text-muted-foreground' }[st] : 'text-muted-foreground')} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{t.label}</span>
                    </span>
                    {t.children.length > 0 && <span className="ml-auto tabular-nums text-muted-foreground">{t.children.length}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

      <DetailHost p={p} open={show} onJump={(id) => { const t = byId.get(id); if (t) jump(t) }}
        setOpen={(v) => { setShow(v); if (!v) history.replaceState(null, '', '#kb') }} />   {/* 关了弹窗，地址回到只看地图，刷新不再弹出 */}
    </div>
  )
}
