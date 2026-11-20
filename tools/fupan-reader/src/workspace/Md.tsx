import { useLayoutEffect, useRef } from 'react'
import { Markdown } from '@/components/viewers'
import { dirname, join, raw } from '@/workspace/api'
import { openFile } from '@/workspace/parts'

/** 复盘阅读页的 Markdown 原样渲染；外面包一层，把 md 里的相对链接、相对图片按这份文件所在目录解析：
 *  链接交给 onOpen 接着打开（默认开右侧抽屉），图片走项目页服务；外部网址照旧新标签打开 */
export function Md({ text, file, onOpen = openFile }: { text: string; file: string; onOpen?: (path: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const base = dirname(file)
  useLayoutEffect(() => {
    box.current?.querySelectorAll('img').forEach((img) => {
      const s = img.getAttribute('src') ?? ''
      if (s && !/^[a-z][a-z0-9+.-]*:|^\//i.test(s) && !img.dataset.fixed) {
        img.dataset.fixed = '1'
        img.src = raw(join(base, decodeURIComponent(s)))
      }
    })
  }, [text, base])
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as Element).closest('a')
    const href = a?.getAttribute('href') ?? ''
    if (!a || !href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return
    e.preventDefault()
    e.stopPropagation()
    const target = join(base, decodeURIComponent(href.split('#')[0]))
    onOpen(href.split('#')[0].endsWith('/') ? target + '/' : target)
  }
  return <div ref={box} onClickCapture={onClick}><Markdown text={text} /></div>
}
