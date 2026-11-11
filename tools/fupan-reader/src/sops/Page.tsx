import { useEffect } from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Detail } from './Detail'
import { Home } from './Home'
import { SopCtx, type SopData } from './shared'

// 经验页：地址 #s=S04 是一份详情，#d=领域 是首页某个领域，#sop 是首页（第一个领域）
const go = (q: Record<string, string>) => { location.hash = '#' + new URLSearchParams(q).toString(); window.scrollTo({ top: 0 }) }

export function SopPage({ data, hash }: { data: SopData; hash: URLSearchParams }) {
  const { sops } = data
  const domains = [...new Set(sops.map((s) => s.domain))]
  const sop = sops.find((s) => s.id === hash.get('s'))
  const d = hash.get('d')
  const domain = sop?.domain ?? (d && domains.includes(d) ? d : domains[0])
  const open = (id: string) => go({ s: id })
  const home = (dm: string) => go({ d: dm })
  useEffect(() => { document.title = sop ? `经验 · ${sop.name}` : `经验 · ${domain}` }, [sop, domain])
  return (
    <SopCtx.Provider value={data}>
      {sop
        ? <Detail sop={sop} all={sops} onOpen={open} crumb={
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem><BreadcrumbLink href={'#' + new URLSearchParams({ d: sop.domain })}>经验</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink href={'#' + new URLSearchParams({ d: sop.domain })}>{sop.domain}</BreadcrumbLink></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          } />
        : <Home sops={sops} domain={domain} pick={home} onOpen={open} />}
    </SopCtx.Provider>
  )
}
