import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { deleteRead, putRead } from './api'
import { useAnnotationService } from './service'

export const readKey = (href: string): string => {
  const q = new URLSearchParams(href.replace(/^#/, ''))
  for (const key of ['r', 'o', 's']) { const value = q.get(key); if (value) return key + ':' + value }
  return ''
}
export const readRow = (on: boolean) => on ? 'opacity-50 hover:opacity-100' : ''
export const useReadSet = () => useAnnotationService().read

export function ReadButton({ k }: { k: string }) {
  const { available, read, readReady, readError, setRead, reloadRead } = useAnnotationService()
  const [failed, setFailed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  // 刚点成已读：播一次完成动效（回弹 + 对勾画出 + 光环 + 小点迸开），约 0.9 秒后撤掉
  const [pop, setPop] = useState(false)
  useEffect(() => { if (!pop) return; const t = setTimeout(() => setPop(false), 900); return () => clearTimeout(t) }, [pop])
  const on = read.has(k)
  const save = async (next: boolean) => {
    if (busy) return
    setBusy(true)
    try { setRead(await (next ? putRead(k) : deleteRead(k))); setFailed(null); setPop(next) }
    catch { setFailed(next) }
    finally { setBusy(false) }
  }
  if (!available) return null
  // 11-16 用户定：按钮要显眼、点了有让人愉快的成功反馈；不显示近期阅读进度
  return (
    <div data-annot-ui className="flex items-center gap-3 border-t pt-8 text-[15px]">
      <button type="button" disabled={busy || !readReady} onClick={() => void save(!on)} title={on ? '再点一次取消已读' : undefined}
        className={cn('read-btn relative inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-base font-medium transition-colors',
          on ? 'bg-brand-soft text-brand' : 'bg-brand text-background shadow-sm hover:opacity-90', pop && 'read-pop')}>
        {on && (
          <svg viewBox="0 0 24 24" className="read-check size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
        {on ? '已读' : '标为已读'}
        {pop && <span aria-hidden className="read-burst">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--a': `${i * 45}deg` } as React.CSSProperties} />)}</span>}
      </button>
      {(failed !== null || readError) && <span className="text-muted-foreground" role="status">未保存 <button type="button" disabled={busy} className="underline underline-offset-4" onClick={() => void (failed !== null ? save(failed) : reloadRead())}>重试</button></span>}
    </div>
  )
}
