import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getRead, health } from './api'

const Service = createContext({
  available: false, read: new Set<string>(), readReady: false, readError: false,
  setRead: (_keys: string[]) => {}, reloadRead: async () => {},
})

/** 只在启动时探测；服务中途停了保留界面和草稿，让用户重试。file:// 不发任何请求。 */
export function AnnotationService({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false)
  const [read, setKeys] = useState(new Set<string>())
  const [readReady, setReadReady] = useState(false)
  const [readError, setReadError] = useState(false)
  const setRead = useCallback((keys: string[]) => { setKeys(new Set(keys)); setReadReady(true); setReadError(false) }, [])
  const reloadRead = useCallback(async () => {
    try { setRead(await getRead()) } catch { setReadError(true) }
  }, [setRead])
  useEffect(() => {
    if (!/^https?:$/.test(location.protocol)) return
    let live = true
    health().then((result) => {
      if (live && result.ok === true) { setAvailable(true); void reloadRead() }
    }).catch(() => { /* 没有本地服务，保持原阅读页 */ })
    return () => { live = false }
  }, [reloadRead])
  return <Service.Provider value={{ available, read, readReady, readError, setRead, reloadRead }}>{children}</Service.Provider>
}

export const useAnnotationService = () => useContext(Service)
