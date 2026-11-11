export type Kind = 'star' | 'ask'
export type Quote = { exact: string; prefix?: string; suffix?: string }
export type Doc = { type: '复盘' | '经验' | '知识'; project: string; module: string; title: string; one: string }
export type NewNote = { kind: Kind; page: string; doc: Doc; section: string; block: string; quote: Quote; note: string }
export type Note = NewNote & {
  id: string
  created_at: string
  gen: { status: 'pending' | 'done' | 'failed'; background?: string; explain?: string; at?: string; tries: number }
  pushes: { n: number; at: string; msg_id: string }[]
}

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`未保存 (${status})`)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(path, {
      method, signal: controller.signal, cache: 'no-store',
      headers: method === 'GET' ? undefined : { 'X-Fupan': '1', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new ApiError(response.status)
    return await response.json() as T
  } finally { clearTimeout(timer) }
}

export const health = () => request<{ ok: boolean }>('/api/health')
export const getNotes = (page?: string) => request<Note[]>('/api/notes' + (page ? '?' + new URLSearchParams({ page }) : ''))
export const createNote = (note: NewNote) => request<Note>('/api/notes', 'POST', note)
export const patchNote = (id: string, note: string) => request<Note>('/api/notes/' + encodeURIComponent(id), 'PATCH', { note })
export const deleteNote = (id: string) => request<{ ok: boolean }>('/api/notes/' + encodeURIComponent(id), 'DELETE')
// T1 的 GET 是整个键列表，只有 PUT / DELETE 使用 /api/read/<键>。
export const getRead = () => request<string[]>('/api/read')
export const putRead = (key: string) => request<string[]>('/api/read/' + encodeURIComponent(key), 'PUT')
export const deleteRead = (key: string) => request<string[]>('/api/read/' + encodeURIComponent(key), 'DELETE')
