import type { KData, KState } from './types'

// 四层一棵树：知识 → 领域 → 组 → 知识点；3D 图和左边清单共用
export type Kind = 'root' | 'domain' | 'group' | 'point'
export type TNode = { id: string; label: string; kind: Kind; state?: KState; children: TNode[]; parent?: TNode }

export function buildTree(data: KData): { root: TNode; byId: Map<string, TNode> } {
  const byId = new Map<string, TNode>()
  const add = (n: TNode, parent?: TNode) => { n.parent = parent; byId.set(n.id, n); n.children.forEach((c) => add(c, n)); return n }
  const root = add({
    id: 'root', label: '知识', kind: 'root',
    children: data.domains.map((d) => ({
      id: `d:${d.name}`, label: d.name, kind: 'domain',
      children: d.groups.map((g) => ({
        id: `g:${d.name}/${g.name}`, label: g.name, kind: 'group',
        children: g.points.map((pid) => ({ id: pid, label: data.points[pid].name, kind: 'point', state: data.points[pid].state, children: [] })),
      })),
    })),
  })
  return { root, byId }
}

export const pathTo = (n: TNode): TNode[] => (n.parent ? [...pathTo(n.parent), n] : [n])

