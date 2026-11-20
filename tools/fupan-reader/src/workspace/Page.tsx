import { useEffect, useState } from 'react'
import { Boundary } from '@/components/Boundary'
import { Reveal } from '@/shell/fx'
import { readHash } from '@/workspace/api'
import { Home } from '@/workspace/Home'
import { ProjectPage } from '@/workspace/Project'
import { FileDrawer } from '@/workspace/FileDrawer'

// 工作台的「项目」页签：工作区里按文件规则（docs/文件规则/README.md）维护的项目
//   #w              项目总览：所有项目按最近更新排
//   #w&p=<项目>      项目页
//   &f=<路径>        右侧抽屉看这个文件
// 数据来自工作区的项目页服务（4300），见 api.ts

export function WorkspacePage() {
  const [h, setH] = useState(readHash)
  useEffect(() => { const on = () => setH(readHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on) }, [])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [h.p])
  return (
    <>
      <Boundary key={h.p ?? ''} hint="项目页没有显示出来，刷新一下；还不行看 ~/Library/Logs/project-page.log。">
        <Reveal>{h.p ? <ProjectPage path={h.p} /> : <Home />}</Reveal>
      </Boundary>
      <FileDrawer project={h.p} path={h.f} />
    </>
  )
}
