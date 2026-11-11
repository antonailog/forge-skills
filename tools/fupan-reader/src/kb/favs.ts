import { useSyncExternalStore } from 'react'

// 收藏：觉得不会的点一下收藏，会了再取消。按知识点名字记（骨架里的名字比编号稳），存在这台电脑的浏览器里
const KEY = 'knowledge-favs'
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } }
let cur = read()
const subs = new Set<() => void>()

export function toggleFav(name: string) {
  cur = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]
  try { localStorage.setItem(KEY, JSON.stringify(cur)) } catch { /* 存不了就只在这次打开里有效 */ }
  subs.forEach((f) => f())
}

export function useFavs(): string[] {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => cur)
}
