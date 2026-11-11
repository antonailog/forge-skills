import { memo, type ReactNode } from 'react'
import { DotPattern } from '@/components/fx/DotPattern'
import { BlurFade } from '@/components/fx/BlurFade'

// 工作台的动效和背景（11-10 定 A 安静）：顶栏滑块（TopBar 里的 Motion layoutId）+ 极淡点阵（Magic UI Dot Pattern）+ 进场模糊淡入（Magic UI Blur Fade）

/** 整页背景：顶部一层极淡的点阵，往下渐隐；放在最底层，不挡点击。memo：页面重渲染时不跟着重算几千个点 */
export const Backdrop = memo(function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <DotPattern width={22} height={22} cr={1} className="text-neutral-400/80 [mask-image:radial-gradient(ellipse_at_top,white,transparent_75%)]" />
    </div>
  )
})

/** 进场：内容从模糊到清晰淡入 */
export const Reveal = ({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) =>
  <BlurFade delay={delay} duration={0.35} offset={6} blur="4px" className={className}>{children}</BlurFade>
