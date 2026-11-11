/** 取选区所在的标题路径和完整语义块；标题也可由不改变版式的 data 属性标注。 */
export function selectionContext(range: Range, root: HTMLElement, title: string) {
  const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement!
  const headings: { level: number; text: string }[] = []
  for (const heading of root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[data-annot-heading]')) {
    // 只遍历选区起点之前的标题；已离开的分块中的内部标题不能泄漏到下一块。
    if (range.comparePoint(heading, 0) > 0) break
    const owner = heading.closest('[data-annot-block]')
    if (owner && !owner.contains(start)) continue
    let level = Number(heading.dataset.annotLevel ?? heading.tagName.slice(1)) || 4
    const namedBlock = heading.parentElement?.closest<HTMLElement>('[data-annot-heading]')
    if (namedBlock) level = Math.max(level, Number(namedBlock.dataset.annotLevel ?? 4) + 1)
    const text = heading.dataset.annotHeading || heading.textContent?.trim()
    if (!text) continue
    while (headings.length && headings[headings.length - 1].level >= level) headings.pop()
    headings.push({ level, text })
  }
  const block = start.closest<HTMLElement>('[data-annot-block]') ?? start.closest<HTMLElement>('section') ?? root
  const section = headings.map((h) => h.text).join(' › ') || title
  return { section, block: Array.from(block.innerText.trim()).slice(0, 2000).join('') }
}
