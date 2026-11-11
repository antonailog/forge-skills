import { useEffect, useRef, useState } from 'react'
import type { TNode } from './tree'

// 3D 同心球的排布（从知识页样稿 Map3D 抽出来）和容器尺寸钩子（从 ForceNet 抽出来）

export type V = [number, number, number]
export const norm = (v: V): V => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
/** 一组方向：k 个子节点用向日葵螺旋（Vogel）铺在父方向周围半径 cap 的圆盘里 */
function around(d: V, k: number, cap: number): V[] {
  const a: V = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = norm(cross(a, d)), v = cross(d, u)
  return Array.from({ length: k }, (_, i) => {
    const r = cap * Math.sqrt((i + 0.6) / k), th = i * 2.39996
    const c = Math.cos(r), s = Math.sin(r)
    return norm([d[0] * c + (u[0] * Math.cos(th) + v[0] * Math.sin(th)) * s, d[1] * c + (u[1] * Math.cos(th) + v[1] * Math.sin(th)) * s, d[2] * c + (u[2] * Math.cos(th) + v[2] * Math.sin(th)) * s])
  })
}
/** 斐波那契球：n 个方向均匀铺满球面 */
const fib = (n: number): V[] => Array.from({ length: n }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = i * 2.39996
  return [r * Math.cos(th), y, r * Math.sin(th)]
})

/** 同心球的固定位置：一级内层、二级中层、知识点外层 */
export function place(root: TNode, out: Map<string, V>) {
  const R = { domain: 90, group: 180, point: 270 }
  const capG = (k: number) => Math.min(0.75, 0.22 + 0.033 * k)
  const capP = (k: number) => 0.1 + 0.02 * k // 知识点铺开一点，下钻后名字不挤
  fib(root.children.length).forEach((d, i) => {
    const dom = root.children[i]
    out.set(dom.id, [d[0] * R.domain, d[1] * R.domain, d[2] * R.domain])
    around(d, dom.children.length, capG(dom.children.length)).forEach((g, j) => {
      const grp = dom.children[j]
      out.set(grp.id, [g[0] * R.group, g[1] * R.group, g[2] * R.group])
      around(g, grp.children.length, capP(grp.children.length)).forEach((p, m) => out.set(grp.children[m].id, [p[0] * R.point, p[1] * R.point, p[2] * R.point]))
    })
  })
}

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, ...size }
}
