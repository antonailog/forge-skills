import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SideNav, useScrollSpy, type NavItem } from '@/components/SideNav'
import { Markdown } from '@/components/viewers'
import { T } from '@/typo'
import { backHref } from '@/components/ReviewIndex'
import { Star } from '@/components/Star'
import type { IndexOld } from '@/types'

// 旧复盘的二级页面：和新版同一套左栏（返回、目录、回到顶部）；右边渲染原文 md。
// 原文一个字不改，只在显示时去掉它自己的一级标题（页头已有）和「目录」那一节（左栏已有）

/** 和 GitHub 一样的标题锚点：原文里「[一、工作叙事](#一工作叙事)」这类页内链接才跳得过去 */
const slug = (t: string) => t.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-')

function prep(md: string) {
  const lines = md.replace(/^\s+/, '').split('\n')
  const h1 = lines[0]?.startsWith('# ') ? lines.shift()!.slice(2).replace(/^\[[^\]]*\]\s*/, '').trim() : null
  const out: string[] = []
  let skip = false
  for (const l of lines) {
    if (/^##\s+目录\s*$/.test(l)) { skip = true; continue }
    if (skip && /^#{1,2}\s/.test(l)) skip = false
    if (!skip) out.push(l)
  }
  // 原文里的 <a id="p1"></a> 是给旧版阅读器跳转用的锚点，这里不认 HTML，会原样露成字，显示时去掉
  return { h1, body: out.join('\n').replace(/<a id="[^"]*">\s*<\/a>/g, '') }
}

export function OldReview({ o, project }: { o: IndexOld; project: string }) {
  const { h1, body } = useMemo(() => prep(o.md ?? ''), [o])
  const box = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<NavItem[]>([])
  // 目录从渲染好的标题里取，同时给标题挂上锚点
  useLayoutEffect(() => {
    const seen = new Map<string, number>()
    const items: NavItem[] = []
    box.current?.querySelectorAll<HTMLElement>('h2, h3').forEach((h) => {
      const base = slug(h.textContent ?? '') || 'section'
      const k = seen.get(base) ?? 0
      seen.set(base, k + 1)
      h.id = k ? `${base}-${k}` : base
      h.classList.add('scroll-mt-8')
      items.push({ id: h.id, label: h.textContent ?? '', level: h.tagName === 'H2' ? 1 : 2 })
    })
    setToc(items)
  }, [body])
  const ids = useMemo(() => toc.map((t) => t.id), [toc])
  const [active, pick] = useScrollSpy(ids)
  const title = h1 ?? o.title
  useEffect(() => { document.title = title }, [title])
  const back = backHref('#' + new URLSearchParams({ p: project, m: o.module ?? '未分模块' }).toString())
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[13rem_minmax(0,1fr)] gap-12 px-8 text-sm typo-body">
      <SideNav title="目录" items={toc} active={active} pick={pick} back={{ href: back, label: '返回复盘汇总' }} hrefOf={(id) => `#${id}`} />
      <main className="flex min-w-0 max-w-4xl flex-col gap-8 py-8">
        <header className="flex flex-col gap-3">
          <h1 className={T.title}>{title}</h1>
          <p className="text-muted-foreground">{[o.date + (o.time ? ` ${o.time}` : ''), project, o.module ?? o.topic].filter(Boolean).join(' · ')}</p>
          <Star why={o.why} did={o.did} got={o.got} line={o.line} className="text-base" />
        </header>
        <div ref={box} className="border-t pt-8 [&_.prose>h2:first-child]:mt-0 [&_h2]:mt-12 [&_h2]:text-[22px] [&_h2]:leading-snug [&_h3]:text-lg [&_img]:rounded-lg [&_img]:border">
          <Markdown text={body} localFiles />
        </div>
      </main>
    </div>
  )
}
