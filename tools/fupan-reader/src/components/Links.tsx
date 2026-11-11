import { ArrowUpRight } from 'lucide-react'

// 延伸阅读：「[标题](链接)（说明）· …」拆成一行一个，新标签页打开。经验详情、知识点弹窗共用
// 链接里可以带一层括号（维基那种 Foo_(bar)）
const LINK = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)(?:（([^）]*)）)?/g

export function Links({ text }: { text: string }) {
  const items = [...text.matchAll(LINK)]
  return (
    <ul className="flex flex-col gap-2">
      {items.map(([, title, url, note]) => (
        <li key={url} className="flex flex-wrap items-baseline gap-x-2">
          <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-base font-medium text-brand hover:underline">{title}<ArrowUpRight className="size-3.5" /></a>
          {note && <span className="text-muted-foreground">{note}</span>}
        </li>
      ))}
    </ul>
  )
}
