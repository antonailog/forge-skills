import { useEffect, useState } from 'react'
import { Boundary } from '@/components/Boundary'
import { Reveal } from '@/shell/fx'
import { readHash } from '@/workspace/api'
import { Home } from '@/workspace/Home'
import { ProjectPage } from '@/workspace/Project'
import { FileDrawer } from '@/workspace/FileDrawer'
import type { IndexPage, IndexProject } from '@/types'

// 工作台的「项目」页签：我现在的状态。工作区里按文件规则（docs/文件规则/README.md）维护的项目，加上每个项目的复盘时间线
//   #w（或空）       项目总览：所有项目按最近更新排
//   #w&p=<项目>      项目页；p 是工作区路径，没有项目页的复盘项目就是它的名字
//   &m=<模块>        时间线先只看这个模块（从单篇复盘返回时带着）
//   &f=<路径>        右侧抽屉看这个文件
// 项目信息来自工作区的项目页服务（4300，见 api.ts），服务不通只显示复盘时间线；时间线来自 index.data.js（build.py 写）

/** 地址里的 p 对到哪一组复盘：带模块的先认「复盘项目/模块」（模块单独挂走的），再认组的 key，最后认「复盘项目」（build.py 写的 alias） */
export function findGroup(index: IndexPage, p: string, m?: string | null): { key: string; group?: IndexProject } {
  const byKey = new Map(index.projects.map((g) => [g.key, g]))
  const key = (m && index.alias?.[`${p}/${m}`]) || (byKey.has(p) ? p : index.alias?.[p] || p)
  return { key, group: byKey.get(key) }
}

export function WorkspacePage({ index }: { index: IndexPage }) {
  const [h, setH] = useState(readHash)
  useEffect(() => { const on = () => setH(readHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on) }, [])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [h.p])
  const hit = h.p ? findGroup(index, h.p, h.m) : null
  return (
    <>
      <Boundary key={hit?.key ?? ''} hint="项目页没有显示出来，刷新一下；还不行看 ~/Library/Logs/project-page.log。">
        <Reveal>{hit ? <ProjectPage path={hit.key} group={hit.group} m={h.m} /> : <Home index={index} />}</Reveal>
      </Boundary>
      <FileDrawer project={hit?.key ?? null} path={h.f} />
    </>
  )
}
