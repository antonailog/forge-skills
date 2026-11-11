import { Dialog as D } from 'radix-ui'
import { XIcon } from 'lucide-react'
import { Boundary } from '@/components/Boundary'
import { DetailBody, DetailHead } from './Detail'
import type { Point } from './types'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Annotator } from '@/annot/Annotator'
import { useAnnotationService } from '@/annot/service'

// 知识点详情：居中弹窗，标题区固定、正文在下面滚。某个知识点的数据有问题只影响它自己的弹窗，地图和清单照常

export function DetailHost({ p, open, setOpen, onJump }: { p: Point | null; open: boolean; setOpen: (v: boolean) => void; onJump?: (id: string) => void }) {
  const { available } = useAnnotationService()
  return (
    <D.Root open={open && !!p} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <D.Content data-slot="dialog-content" onEscapeKeyDown={(e) => {
          if ((e.target as Element).closest?.('[data-annot-ui]') || document.querySelector('[data-annot-toolbar]')) e.preventDefault()
        }} className={cn('fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] max-w-[calc(100vw-4rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95', available ? 'w-[1200px]' : 'w-[880px]')}>
          <D.Title className="sr-only">{p?.name}</D.Title>
          <D.Description className="sr-only">知识条目</D.Description>
          {p && (
            <>
              {/* 标题区固定，正文在下面滚 */}
              <div className="shrink-0 border-b px-8 pt-6 pb-5">
                <DetailHead p={p} close={
                  <D.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><XIcon className="size-5" /><span className="sr-only">关闭</span></D.Close>
                } />
              </div>
              <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                <Boundary key={p.id} hint="这个知识点没有显示出来，让 AI 重建一次复盘汇总页再刷新。"><AnnotatedBody p={p} onJump={onJump} /></Boundary>
              </div>
            </>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

/** 整个批注层都在 dialog-body 的滚动内容里，和原句一起滚动。 */
function AnnotatedBody({ p, onJump }: { p: Point; onJump?: (id: string) => void }) {
  const { available } = useAnnotationService()
  const box = useRef<HTMLDivElement>(null), scope = useRef<HTMLDivElement>(null), col = useRef<HTMLDivElement>(null)
  if (!available) return <DetailBody p={p} onJump={onJump} />
  return (
    <div ref={box} className="relative grid grid-cols-[minmax(0,1fr)_17rem] gap-12">
      <div ref={scope} data-annot-scope className="min-w-0"><DetailBody p={p} onJump={onJump} /></div>
      <div ref={col} data-annot-col aria-hidden />
      <Annotator page={'k:' + p.id} doc={{ type: '知识', project: '知识', module: p.domain, title: p.full?.name ?? p.name, one: p.full?.one ?? '' }} scope={scope} box={box} col={col} />
    </div>
  )
}
