// 排版阶梯：30 / 26 / 22 / 18 / 16 / 15，正文 15，不用更小的字；重点句升到 16；
// 粗体只给标题和条目名，术语用中等字重；中文正文行高 1.7（index.css 的 .typo-body）
export const T = {
  title: 'text-[30px] leading-tight font-semibold',   // 页标题：单篇的结论标题、汇总页的项目名
  h2: 'text-[26px] leading-tight font-semibold',      // 章：一、工作总结
  h3: 'text-[22px] leading-snug font-semibold',       // 节：过程回顾、关键决策、结果评估、交付物、对标分析、知识地图
  h4: 'text-lg font-semibold',                        // 卡片标题：目标、对标的某一步、知识条目
  name: 'text-base font-semibold',                    // 条目名：阶段名、结果卡、模块名、遗留事项
  headline: 'text-base font-medium text-foreground',  // 条目里最要紧的一句：决定什么、负责什么
  term: 'font-medium',                                // 关键做法的术语
  label: 'font-medium text-muted-foreground',         // 抽屉左栏的分节名
  drawerTitle: 'text-lg',
  step: 'text-base font-semibold',                    // 抽屉里执行流程的每一步
} as const
