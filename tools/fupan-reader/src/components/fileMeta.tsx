import { FileCode2, FileImage, FileText, Folder, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileEntry } from '@/types'

export function FileIcon({ f, className }: { f: FileEntry; className?: string }) {
  const cls = cn('size-4 shrink-0', className)
  if (f.kind === 'dir') return <Folder className={cls} />
  if (f.kind === 'md') return <FileText className={cls} />
  if (f.kind === 'image') return <FileImage className={cls} />
  if (['ini', 'nginx', 'text'].includes(f.lang ?? '')) return <Settings2 className={cls} />
  return <FileCode2 className={cls} />
}

/** 工作区路径的第二段是项目名（如 projects/<项目>/…）；其余不标 */
export const projectOf = (path: string) => {
  const seg = path.split('/')
  return seg.length > 2 && !path.startsWith('~') && !path.startsWith('/') ? seg[1] : ''
}

export const dirOf = (path: string) => {
  const d = path.replace(/\/?[^/]+\/?$/, '/')
  return /^~\/\.claude\/projects\/[^/]+\/memory\//.test(d) ? '~/.claude/…/memory/' : d
}
