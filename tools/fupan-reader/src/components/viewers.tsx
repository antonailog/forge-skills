import { useEffect, useId, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { highlight } from '@/lib/highlight'
import { cn } from '@/lib/utils'

/** 语法高亮的代码块：marks 里的行加底色，range 只显示这几行 */
export function Code({ code, lang, range, marks, className, scrollTo }: {
  code: string; lang: string; range?: [number, number]; marks?: number[]; className?: string; scrollTo?: number
}) {
  const start = range ? range[0] : 1
  const [html, setHtml] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const key = marks?.join(',') ?? ''
  const first = useRef(true)
  useEffect(() => {
    let live = true
    // 第一次等抽屉滑出（约 220ms）再高亮：Shiki 高亮整份文件会占住主线程，动画会卡顿；之后切换步骤立刻高亮
    const t = setTimeout(() => highlight(code, lang, new Set(marks ?? []), range).then((h) => live && setHtml(h)), first.current ? 240 : 0)
    first.current = false
    return () => { live = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, lang, range?.[0], range?.[1], key])
  useEffect(() => {
    if (!html || !scrollTo || !box.current) return
    const row = box.current.querySelectorAll('.line')[scrollTo - start]
    row?.scrollIntoView({ block: 'center' })
  }, [html, scrollTo, start])
  return (
    <div
      ref={box}
      className={cn('overflow-x-auto rounded-lg border bg-muted/40 py-3 font-mono text-sm leading-relaxed', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** 裸网址后面紧跟中文时，GFM 会把中文也算进链接；先把网址用尖括号括起来，链接只到网址本身为止 */
const fenceUrls = (text: string) =>
  text.split(/(```[\s\S]*?```|`[^`\n]*`)/).map((part, i) => i % 2 ? part : part.replace(/(?<![(<\w])https?:\/\/[\x21-\x7e]+/g, (u) => {
    const tail = u.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    return `<${u.slice(0, u.length - tail.length)}>${tail}`
  })).join('')

/** md 渲染：GFM 表格、任务列表都支持；行内代码不换字体，只加浅底色 */
/** localFiles：本机的 md（汇总页里的旧复盘），图片是 file:// 绝对路径，不能被默认的 URL 过滤掉 */
export function Markdown({ text, localFiles }: { text: string; localFiles?: boolean }) {
  return (
    <div className="prose prose-sm max-w-none [&_table]:text-sm dark:prose-invert prose-headings:text-sm prose-headings:font-semibold prose-a:text-brand prose-strong:font-semibold prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-sans prose-code:font-normal prose-code:text-[1em] prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={localFiles ? (u) => u : undefined} components={{ a: (p) => <a {...p} target="_blank" rel="noopener" /> }}>{fenceUrls(text)}</ReactMarkdown>
    </div>
  )
}

let mermaidTheme = ''
/** Mermaid 流程图：AI 在 md 里写文字，阅读页画成图 */
export function Flow({ chart, dark }: { chart: string; dark: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let live = true
    const theme = dark ? 'dark' : 'neutral'
    if (mermaidTheme !== theme) {
      mermaid.initialize({ startOnLoad: false, theme, fontFamily: 'inherit', themeVariables: { fontSize: '15px', edgeLabelBackground: dark ? '#171717' : '#ffffff' }, flowchart: { curve: 'basis', htmlLabels: true } })
      mermaidTheme = theme
    }
    mermaid.render(`flow${id}`, chart).then(({ svg }) => live && setSvg(svg)).catch(() => live && setSvg(''))
    return () => { live = false }
  }, [chart, dark, id])
  return <div className="flex justify-center text-sm [&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}
