import { useRef } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { extOf, hrefOf } from '@/workspace/api'
import { Content, Head, WIDE, useEntry } from '@/workspace/FileView'
import { openFile } from '@/workspace/parts'

// 右侧抽屉：正在推进的卡片、关键决定里的链接点开看一眼用。地址带 &f=，浏览器后退能回上一份、关抽屉

export function FileDrawer({ project, path }: { project: string | null; path: string | null }) {
  const got = useEntry(path)
  // 抽屉里一份份往下点：记下路径，「返回上一份」就是浏览器后退
  const trail = useRef<string[]>([])
  if (!path) trail.current = []
  else {
    const t = trail.current
    if (t[t.length - 2] === path) t.pop(); else if (t[t.length - 1] !== path) t.push(path)
  }
  const close = () => { trail.current = []; location.hash = hrefOf(project) }
  const wide = path ? WIDE.has(extOf(path)) : false
  return (
    <Sheet open={!!path} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className={cn('w-full gap-0', wide ? 'sm:max-w-[min(1100px,94vw)]' : 'sm:max-w-3xl')}>
        {path && (
          <>
            <SheetHeader className="gap-2.5 border-b p-6 pr-14">
              <Head path={path} got={got} back={trail.current.length > 1 ? () => history.back() : undefined}
                Title={({ className, children }) => <SheetTitle className={className}>{children}</SheetTitle>}
                Desc={({ className, children }) => <SheetDescription className={className}>{children}</SheetDescription>} />
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6 text-sm typo-body"><Content got={got} onOpen={openFile} /></div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
