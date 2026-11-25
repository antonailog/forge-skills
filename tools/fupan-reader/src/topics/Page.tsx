import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SideNav, useScrollSpy, type NavItem } from '@/components/SideNav'
import { Code, Flow } from '@/components/viewers'
import { remember } from '@/components/ReviewIndex'
import { fitTables } from '@/lib/fitTable'
import { cn } from '@/lib/utils'
import { T } from '@/typo'
import type { Topic, TopicsPage as Data } from '@/types'

// 专题：我想拓展、还不太了解的东西（11-25 定）。专题库里一个专题一个 专题.md，正文结构随题目，只守标题层级
// 左栏：全部专题「专题 N：短名」，最新的在上；当前专题下面展开它的 ## 目录，读到哪一节再展开那一节的 ###
// 右边：完整标题 → 原话（露两行，点开看全）→ 出自哪篇复盘 → 正文（表格、代码、mermaid、链接、图片 图/…）
// 地址：#topic 是最新一篇，#t=T001 是那一篇；标题锚点 #h-0、#h-1… 由 main.tsx 拦下来页内滚动

const dark = window.matchMedia('(prefers-color-scheme: dark)')
const useDark = () => {
  const [d, set] = useState(dark.matches)
  useEffect(() => { const on = (e: MediaQueryListEvent) => set(e.matches); dark.addEventListener('change', on); return () => dark.removeEventListener('change', on) }, [])
  return d
}

/** 专题文件夹里的相对地址（图/x.png）→ 相对工作台页面的地址；base 已经逐段转义过。带协议的交给默认过滤（挡掉 javascript: 这类），? 和 # 后面原样留着 */
const local = (base: string, u: string) => {
  if (/^[a-z][a-z0-9+.-]*:|^[/#]/i.test(u)) return defaultUrlTransform(u)
  const i = u.search(/[?#]/), path = i < 0 ? u : u.slice(0, i), rest = i < 0 ? '' : u.slice(i)
  return base + path.replace(/^\.\//, '').split('/').map((x) => encodeURIComponent(decodeURIComponent(x))).join('/') + rest
}

type HNode = { type: string; tagName?: string; value?: string; properties?: { className?: unknown }; children?: HNode[] }
const textOf = (n?: HNode): string => n ? (n.value ?? (n.children ?? []).map(textOf).join('')) : ''

function Body({ t }: { t: Topic }) {
  const isDark = useDark()
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => box.current ? fitTables(box.current) : undefined, [t])
  return (
    <div ref={box} className="prose max-w-none text-[15px] leading-[1.8] dark:prose-invert prose-headings:scroll-mt-[calc(var(--bar)+2rem)] prose-h2:mt-14 prose-h2:border-b prose-h2:pb-3 prose-h2:text-[26px] prose-h3:mt-10 prose-h3:text-[22px] prose-h4:text-lg prose-a:text-brand prose-strong:font-semibold prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-sans prose-code:font-normal prose-code:text-[1em] prose-code:before:content-none prose-code:after:content-none prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 prose-img:rounded-lg prose-img:border [&_table]:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(u) => local(t.base, u)}
        components={{
          a: ({ node: _n, href, ...p }) => <a {...p} href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel="noopener" />,
          // 代码块在 pre 这一层认（不带语言的单行块也是块）；行内代码走默认的 code
          pre: ({ node }) => {
            const code = (node as HNode | undefined)?.children?.find((c) => c.tagName === 'code')
            const cls = ([] as unknown[]).concat(code?.properties?.className ?? []).join(' ')
            const lang = /language-(\S+)/.exec(cls)?.[1]
            const text = textOf(code).replace(/\n$/, '')
            if (lang === 'mermaid') return <div className="not-prose my-6"><Flow chart={text} dark={isDark} /></div>
            return <div className="not-prose my-5"><Code code={text} lang={lang ?? 'text'} className="px-4" /></div>
          },
        }}>
        {t.md}
      </ReactMarkdown>
    </div>
  )
}

type Head = { id: string; label: string; level: 2 | 3; parent: string }

export function TopicsPage({ data, hash }: { data: Data; hash: URLSearchParams }) {
  const ts = data.topics
  const t = ts.find((x) => x.id === hash.get('t')) ?? ts[0]
  const main = useRef<HTMLElement>(null)
  const [heads, setHeads] = useState<Head[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => { if (t) document.title = t.title; setOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }) }, [t])
  // 目录从渲染好的标题里取，同时挂上锚点：## 一级，### 挂在它上面的 ## 下面；#### 不进目录
  useLayoutEffect(() => {
    const out: Head[] = []
    let parent = ''
    main.current?.querySelectorAll<HTMLElement>('.prose h2, .prose h3').forEach((h, i) => {
      h.id = `h-${i}`
      const level = h.tagName === 'H2' ? 2 : 3
      if (level === 2) parent = h.id
      out.push({ id: h.id, label: h.textContent ?? '', level, parent: level === 2 ? h.id : parent })
    })
    setHeads(out)
  }, [t])
  const ids = useMemo(() => heads.map((h) => h.id), [heads])
  const [active, pick] = useScrollSpy(ids)
  const cur = heads.find((h) => h.id === active)?.parent
  const items: NavItem[] = ts.flatMap((x) => [
    { id: `t:${x.id}`, label: `专题 ${x.no}：${x.short}` },
    ...(x.id === t?.id ? heads.filter((h) => h.level === 2 || h.parent === cur).map((h) => ({ id: h.id, label: h.label, level: h.level })) : []),
  ])
  if (!t) return <p className="p-8 text-sm text-muted-foreground">专题库里还没有专题</p>
  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-[17rem_minmax(0,1fr)] gap-12 px-8 text-sm typo-body">
      <SideNav items={items} active={active ?? `t:${t.id}`} pick={(id) => !id.startsWith('t:') && pick(id)}
        hrefOf={(id) => (id.startsWith('t:') ? '#' + new URLSearchParams({ t: id.slice(2) }).toString() : `#${id}`)} />
      <main ref={main} className="flex min-w-0 max-w-[52rem] flex-col gap-6 py-8">
        <header className="flex flex-col gap-4">
          <h1 className={T.title}>{t.title}</h1>
          {t.asked && (
            <div className="flex flex-col gap-1 border-l-2 pl-4 text-muted-foreground">
              <p className={cn('whitespace-pre-line', !open && 'line-clamp-2')}>{t.asked}</p>
              {(t.asked.length > 90 || t.asked.includes('\n')) && <button type="button" onClick={() => setOpen(!open)} className="self-start text-brand hover:underline">{open ? '收起' : '展开'}</button>}
            </div>
          )}
          {t.source && (
            <p className="text-muted-foreground">出自 <a href={t.source.href} onClick={remember} className="text-brand hover:underline">{t.source.project} › {t.source.retro}</a></p>
          )}
        </header>
        <Body t={t} />
      </main>
    </div>
  )
}
