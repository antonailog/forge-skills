import {
  Accessibility, AppWindow, ChartColumn, CircleCheck, CircleDashed, Compass, Contrast, Database, Gauge, GitBranch, Globe, Hammer,
  Layers, LayoutGrid, Lightbulb, Megaphone, MousePointerClick, Palette, Rocket, Server, Sparkles, SwatchBook, FlaskConical,
  TrendingUp, Type, Bot, type LucideIcon,
} from 'lucide-react'
import type { KState } from './types'
import type { TNode } from './tree'

// 关键词图标：领域、组用 lucide 的语义图标，知识点用掌握状态图标（和页面上的状态图标同一套）
const DOMAIN: Record<string, LucideIcon> = {
  前端: AppWindow, 'UI 与视觉设计': Palette, 后端与数据: Database, 部署与运维: Server, 'AI 工程': Bot,
  'AI 生成工具': Sparkles, 研发流程: GitBranch, 产品与增长: TrendingUp, 内容与传播: Megaphone, 思考方法: Lightbulb,
}
const GROUP: Record<string, LucideIcon> = {
  浏览器与网络基础: Globe, '布局与 CSS': LayoutGrid, 字体与排版实现: Type, 设计系统落到代码: SwatchBook, 交互与动效: MousePointerClick,
  框架与状态: Layers, 构建与工程: Hammer, 性能: Gauge, 测试与验收: FlaskConical, 发布与上线: Rocket, '可访问性与 SEO': Accessibility,
  数据可视化: ChartColumn, '业内路线图上有、你较少碰的': Compass,
}
const STATE: Record<KState, LucideIcon> = { 学过: CircleCheck, 碰过: Contrast, 没碰过: CircleDashed }

export function iconOf(t: TNode): LucideIcon {
  if (t.kind === 'point') return STATE[t.state!]
  if (t.kind === 'domain') return DOMAIN[t.label] ?? Compass
  return GROUP[t.label] ?? Layers
}
