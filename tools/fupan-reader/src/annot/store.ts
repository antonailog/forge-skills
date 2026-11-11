import { useEffect, useSyncExternalStore } from 'react'
import { ApiError, createNote, deleteNote, getNotes, patchNote, type NewNote, type Note } from './api'

// 只存本次打开的草稿；切页、轮询和在途请求都不能覆盖尚未保存的备注。
export type Draft = Note & { key: string; persisted: boolean; saved: string; busy?: boolean; error?: boolean; removing?: boolean }
const fromServer = (note: Note): Draft => ({ ...note, key: note.id, persisted: true, saved: note.note })

class PageNotes {
  rows: Draft[] = []
  loadError = false
  private listeners = new Set<() => void>()
  private timers = new Map<string, number>()
  private pendingSince = new Map<string, number>()
  private loading = false
  constructor(readonly page: string) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.rows
  private emit() {
    // 每次状态更新都记录 pending 的进入/退出，避免 React 批量渲染漏掉中间状态。
    const pending = new Set(this.rows.filter((n) => n.persisted && n.kind === 'ask' && n.gen.status === 'pending').map((n) => n.id))
    for (const id of this.pendingSince.keys()) { if (!pending.has(id)) this.pendingSince.delete(id) }
    for (const id of pending) { if (!this.pendingSince.has(id)) this.pendingSince.set(id, Date.now()) }
    this.rows = [...this.rows]; this.listeners.forEach((listener) => listener())
  }
  shouldPoll() { return [...this.pendingSince.values()].some((at) => Date.now() - at <= 180000) }
  private row(key: string) { return this.rows.find((n) => n.key === key) }
  private change(key: string, values: Partial<Draft>) { this.rows = this.rows.map((n) => n.key === key ? { ...n, ...values } : n); this.emit() }
  private forget(n: Draft) {
    clearTimeout(this.timers.get(n.key)); this.timers.delete(n.key)
    this.deleted.add(n.id)
    this.rows = this.rows.filter((x) => x.key !== n.key); this.emit()
  }

  async load() {
    if (this.loading) return
    this.loading = true
    const initial = new Map(this.rows.map((n) => [n.key, n]))
    try {
      const rows = await getNotes(this.page)
      // 干净的条目跟服务同步；请求期间变化过的草稿只刷新生成结果。
      const seen = new Set(this.rows.filter((n) => n.persisted).map((n) => n.id))
      const byId = new Map(rows.map((n) => [n.id, n]))
      this.rows = this.rows.flatMap((n) => {
        const remote = byId.get(n.id)
        if (initial.get(n.key) !== n || !n.persisted || n.busy || n.error || n.removing || n.note !== n.saved) return [remote ? { ...n, gen: remote.gen } : n]
        return remote ? [{ ...fromServer(remote), key: n.key }] : []
      })
      this.rows.push(...rows.filter((n) => !seen.has(n.id) && !this.deleted.has(n.id)).map(fromServer))
      this.loadError = false
    } catch { this.loadError = true }
    finally { this.loading = false; this.emit() }
  }
  private deleted = new Set<string>()

  add(note: NewNote) {
    const key = 'draft-' + crypto.randomUUID()
    this.rows.push({ ...note, id: key, key, persisted: false, saved: '', created_at: new Date().toISOString(), gen: { status: 'pending', tries: 0 }, pushes: [] })
    this.emit()
    void this.save(key)
    return key
  }
  write(key: string, note: string) {
    this.change(key, { note })
    clearTimeout(this.timers.get(key))
    this.timers.set(key, window.setTimeout(() => { this.timers.delete(key); void this.save(key) }, 600))
  }
  remove(key: string) { this.change(key, { removing: true }); void this.save(key) }

  async save(key: string) {
    clearTimeout(this.timers.get(key)); this.timers.delete(key)
    const n = this.row(key)
    if (!n || n.busy) return
    if (n.persisted && !n.removing && n.note === n.saved && !n.error) return
    if (n.removing && !n.persisted) { this.forget(n); return }
    this.change(key, { busy: true })
    try {
      if (n.removing) {
        await deleteNote(n.id)
        this.forget(n)
        return
      }
      const saved = n.persisted ? await patchNote(n.id, n.note) : await createNote({
        kind: n.kind, page: n.page, doc: n.doc, section: n.section, block: n.block, quote: n.quote, note: n.note,
      })
      // 新问题的 PATCH 即使仍是 pending，也属于新一轮讲解；普通 GET 不延长窗口。
      if (n.persisted && n.kind === 'ask' && saved.gen.status === 'pending' && saved.note !== n.saved) this.pendingSince.delete(saved.id)
      this.change(key, { id: saved.id, persisted: true, saved: saved.note, gen: saved.gen, created_at: saved.created_at, error: false, busy: false })
      const latest = this.row(key)
      // 写入期间又输入了文字或点了删除，串行补齐最新意图。
      if (latest && (latest.note !== saved.note || latest.removing)) void this.save(key)
    } catch (error) {
      if (n.persisted && error instanceof ApiError && error.status === 404) this.forget(n)
      else this.change(key, { busy: false, error: true })
    }
  }

  async poll() {
    try {
      const rows = new Map((await getNotes(this.page)).map((n) => [n.id, n]))
      this.rows = this.rows.map((n) => rows.has(n.id) ? { ...n, gen: rows.get(n.id)!.gen } : n)
      this.emit()
    } catch { /* 生成查询失败不影响备注和重试入口 */ }
  }
}

const pages = new Map<string, PageNotes>()
export function useNotes(page: string) {
  if (!pages.has(page)) pages.set(page, new PageNotes(page))
  const store = pages.get(page)!
  const notes = useSyncExternalStore(store.subscribe, store.snapshot)
  useEffect(() => { void store.load() }, [store])
  const hasPending = notes.some((n) => n.persisted && n.kind === 'ask' && n.gen.status === 'pending')
  useEffect(() => {
    if (!hasPending) return
    const timer = window.setInterval(() => {
      if (store.shouldPoll()) void store.poll()
    }, 10000)
    return () => clearInterval(timer)
  }, [store, hasPending])
  return { notes, store }
}

