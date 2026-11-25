// 项目页签的项目信息：来自工作区的项目页服务（docs/文件规则/项目页/服务.py，launchd 常驻 4300），每次都现读，不缓存
// 页面在复盘工作台里（4330）。服务只给本机 http 页面回 CORS 头；从 file:// 打开或服务没开时，项目页签只显示复盘时间线（index.data.js）
export const BASE = 'http://127.0.0.1:4300'

export type Bullet = { name: string; text: string; date: string; done: boolean; sub: string[] }
export type Summary = {
  path: string; name: string; area: string; version: 1 | 2; oneliner: string; updated: string; ts: number
  counts: Record<'等你定' | '进行中' | '待办' | '已完成', number>
  doing: { name: string; text: string }[]
}
export type Item = {
  name: string; path: string; dir: boolean; mtime: string; desc?: string
  doc?: string | null; files?: number; size?: number; latest?: string; batches?: number; key?: boolean
}
export type Zone = { zone: string; label: string; path: string; items: Item[] }
export type Project = Omit<Summary, 'doing'> & {
  source: string; background: string[]
  /** 项目.md「现在（时间）」：背景、进行中、待办、结果四行，每次会话整块重写 */
  now: { time: string; fields: { label: string; text: string }[] } | null
  doing: Bullet[]; decide: Bullet[]; todo: Bullet[]; done: Bullet[]; rules: string[]
  decisions: string; overturned: string; modules?: string; zones: Zone[]; entry: string[]
}
export type FileData = { path: string; abs: string; name: string; ext: string; size: number; mtime: string; content?: string | null; note?: string }

async function get<T>(url: string): Promise<T> {
  const r = await fetch(BASE + url, { signal: AbortSignal.timeout(5000) })   // 服务卡住时别让页面一直空白
  const j = await r.json()
  if (j && typeof j === 'object' && 'error' in j) throw new Error(j.error)
  return j as T
}
const q = (path: string) => encodeURIComponent(path)
export const api = {
  projects: () => get<Summary[]>('/api/projects'),
  project: (path: string) => get<Project>('/api/project?path=' + q(path)),
  list: (path: string) => get<{ path: string; items: Item[] }>('/api/list?path=' + q(path)),
  file: (path: string) => get<FileData>('/api/file?path=' + q(path)),
}
/** 原样给文件：路径式地址，html 里的相对资源（./assets/…）也能加载 */
export const raw = (path: string) => BASE + '/raw/' + path.split('/').map(encodeURIComponent).join('/')

/** 地址：#w 是项目总览；#w&p=<项目> 是项目页；再带 &f=<路径> 就在右侧抽屉打开这个文件或文件夹 */
export const readHash = () => {
  const s = new URLSearchParams(location.hash.slice(1))
  return { p: s.get('p'), f: s.get('f'), m: s.get('m') }
}
export const hrefOf = (p: string | null, f?: string | null) =>
  '#w' + (p ? '&p=' + encodeURIComponent(p) : '') + (f ? '&f=' + encodeURIComponent(f) : '')

/** 相对路径：md 里的链接按所在文件的目录解析 */
export const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
export function join(base: string, href: string) {
  const parts = base.split('/').filter(Boolean)
  for (const x of href.split('/')) {
    if (x === '..') parts.pop()
    else if (x && x !== '.') parts.push(x)
  }
  return parts.join('/')
}
export const looksDir = (p: string) => p.endsWith('/') || !/\.[^./]+$/.test(p)

/** 扩展名 → 复盘阅读页 Shiki 认识的语言（不认识的按纯文本） */
const LANG: Record<string, string> = {
  '.py': 'python', '.sh': 'shellscript', '.zsh': 'shellscript', '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'tsx', '.json': 'json', '.jsonl': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.sql': 'sql', '.html': 'html', '.htm': 'html', '.css': 'css', '.conf': 'nginx', '.ini': 'ini', '.plist': 'html', '.xml': 'html', '.svg': 'html', '.md': 'markdown',
}
export const langOf = (ext: string) => LANG[ext] ?? 'text'
export const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'])
export const extOf = (p: string) => (p.match(/\.[^./]+$/)?.[0] ?? '').toLowerCase()
