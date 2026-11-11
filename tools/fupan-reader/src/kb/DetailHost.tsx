import { Dialog as D } from 'radix-ui'
import { XIcon } from 'lucide-react'
import { Boundary } from '@/components/Boundary'
import { DetailBody, DetailHead } from './Detail'
import type { Point } from './types'

// 知识点详情：居中弹窗，标题区固定、正文在下面滚。某个知识点的数据有问题只影响它自己的弹窗，地图和清单照常

export function DetailHost({ p, open, setOpen, onJump }: { p: Point | null; open: boolean; setOpen: (v: boolean) => void; onJump?: (id: string) => void }) {
  return (
    <D.Root open={open && !!p} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <D.Content data-slot="dialog-content" className="fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[880px] max-w-[calc(100vw-4rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
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
                <Boundary key={p.id} hint="这个知识点没有显示出来，让 AI 重建一次复盘汇总页再刷新。"><DetailBody p={p} onJump={onJump} /></Boundary>
              </div>
            </>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
