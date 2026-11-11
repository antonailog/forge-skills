import { useState } from 'react'
import { Check } from 'lucide-react'
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
  const on = read.has(k)
  const save = async (next: boolean) => {
    if (busy) return
    setBusy(true)
    try { setRead(await (next ? putRead(k) : deleteRead(k))); setFailed(null) }
    catch { setFailed(next) }
    finally { setBusy(false) }
  }
  if (!available) return null
  return (
    <div data-annot-ui className="flex items-center gap-3 border-t pt-8 text-[15px]">
      <button type="button" disabled={busy || !readReady} onClick={() => void save(!on)} title={on ? '再点一次取消已读' : undefined}
        className={cn('inline-flex items-center gap-2 rounded-lg border px-5 py-2 transition-colors',
          on ? 'border-transparent bg-muted text-muted-foreground' : 'hover:bg-muted')}>
        {on && <Check className="size-4" />}已读
      </button>
      {(failed !== null || readError) && <span className="text-muted-foreground" role="status">未保存 <button type="button" disabled={busy} className="underline underline-offset-4" onClick={() => void (failed !== null ? save(failed) : reloadRead())}>重试</button></span>}
    </div>
  )
}
