// 表格列宽「最低高度优先」（11-16 用户定）：浏览器自动排版按各列内容长短分宽度，常常每列都折几行。
// 做法：从浏览器排好的列宽出发，在两列之间挪一截宽度、实测整张表的高度，变矮就留下，挪的步子从大到小，
// 直到怎么挪都不再变矮。每一步都实测，只接受让整张表变矮的挪法。
// 短列（不折行也不超过 9 个字宽）不往窄里挪：高度一样时，算法分不出「关键项」被拦腰折断好不好。
// 只处理不大的表（≤ 60 行、2–6 列），大表交给浏览器。

const STEPS = [96, 48, 24, 12, 6]

function fit(table: HTMLTableElement) {
  const box = table.parentElement
  const head = table.rows[0]
  if (!box || !head) return
  table.style.tableLayout = ''
  table.style.width = ''
  table.style.whiteSpace = ''
  const cells = [...head.cells]
  cells.forEach((c) => { c.style.width = '' })
  const n = cells.length
  const full = box.clientWidth
  if (!full || n < 2 || n > 6 || table.rows.length > 60 || [...table.rows].some((r) => r.cells.length !== n)) return
  if (table.offsetWidth > full + 1) return   // 最窄也放不下、本来就横滑的表不动

  // 每列不折行有多宽：整表不折行、宽度随内容
  table.style.whiteSpace = 'nowrap'
  table.style.width = 'max-content'
  const natural = cells.map((c) => c.offsetWidth)
  table.style.whiteSpace = ''
  // 每列最窄能到多少：表宽压到 1px，浏览器给出各列的最小内容宽度
  table.style.width = '1px'
  const minC = cells.map((c) => c.offsetWidth)
  table.style.width = ''
  const auto = cells.map((c) => c.offsetWidth)
  // 短列以不折行的宽度为下限；短列全撑开也放不下时退回最小内容宽度
  const short = parseFloat(getComputedStyle(head.cells[0]).fontSize) * 9 + 32
  let minW = cells.map((_, j) => natural[j] <= short ? Math.max(natural[j], minC[j]) : minC[j])
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  if (sum(minW) > full) minW = minC
  // 起点：浏览器的列宽抬到下限，多出来的从余量最大的列里扣
  const w = auto.map((x, j) => Math.max(x, minW[j]))
  for (let over = sum(w) - full, guard = 0; over > 0.5 && guard < n; guard++) {
    const k = w.reduce((b, x, j) => x - minW[j] > w[b] - minW[b] ? j : b, 0)
    const take = Math.min(over, w[k] - minW[k]); w[k] -= take; over -= take
  }

  table.style.tableLayout = 'fixed'
  table.style.width = `${full}px`
  const apply = (ws: number[]) => cells.forEach((c, j) => { c.style.width = `${ws[j]}px` })
  apply(w)
  let best = table.offsetHeight
  for (const d of STEPS) {
    for (let moved = true, guard = 0; moved && guard < 40; guard++) {
      moved = false
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (i === j || w[j] - d < minW[j]) continue
        w[i] += d; w[j] -= d; apply(w)
        const h = table.offsetHeight
        if (h < best - 0.5) { best = h; moved = true } else { w[i] -= d; w[j] += d }
      }
    }
  }
  apply(w)
}

/** 容器里所有表格按「最低高度优先」定列宽；容器宽度变了，等这一帧结束再重算（不在 ResizeObserver 回调里同步改布局） */
export function fitTables(root: HTMLElement) {
  if (!root.querySelector('table')) return
  const run = () => root.querySelectorAll('table').forEach((t) => fit(t as HTMLTableElement))
  run()
  let last = root.clientWidth, raf = 0, t = 0
  const ro = new ResizeObserver(() => {
    if (root.clientWidth === last) return
    last = root.clientWidth
    cancelAnimationFrame(raf); clearTimeout(t)
    t = window.setTimeout(() => { raf = requestAnimationFrame(run) }, 150)
  })
  ro.observe(root)
  return () => { ro.disconnect(); cancelAnimationFrame(raf); clearTimeout(t) }
}
