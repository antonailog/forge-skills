// 需求设计文档的截图工具：只读保险、假数据、标注、截图。
// 在项目截图脚本里 import { guardWrites, mockJson, annotate, rect, shotTo } from './annotate.mjs'
// 用法和标注约定见 forge-feature-doc 的 references/visuals.md。
import { join } from 'node:path'

/** 第一件事就调用：拦下页面发出的所有非 GET / HEAD 请求，不让它到达后端。
 *  项目本地服务可能连着生产库、带着付费模型的 key。 */
export async function guardWrites(page) {
  await page.route('**/*', route => {
    const method = route.request().method()
    return method === 'GET' || method === 'HEAD' ? route.fallback() : route.abort()
  })
}

/** 用假数据回应某个接口（默认只拦 GET）。登录态、额度、失败、空结果都这样造。 */
export async function mockJson(page, pattern, json, { method = 'GET', status = 200 } = {}) {
  await page.route(pattern, route => route.request().method() === method
    ? route.fulfill({ status, json: typeof json === 'function' ? json(route.request()) : json })
    : route.fallback())
}

/** 元素的位置和尺寸：{ x, y, w, h, right, bottom }。 */
export function rect(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`找不到元素：${sel}`)
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom }
  }, selector)
}

/** 截图函数工厂：shot(page, 文件名, 裁剪区域?) */
export function shotTo(outDir) {
  return (page, name, clip) => page.screenshot({ path: join(outDir, name), ...(clip ? { clip } : {}) })
}

/** 在页面上叠加标注。spec 每项是下面之一：
 *  { box: 1, rect: {x,y,w,h}, label, pad?, below?, labelRight?, maxw? }  橙色虚线框 + 标签
 *  { gap: [x1, x2, y], label }                                        两块之间的间距
 *  { hline: y, label }                                                 对齐横线
 *  { vline: x, y1, y2, label }                                         对齐竖线
 *  { callout: [labelX, labelY, toX, toY], label }                      标签放空白处，点线指过去 */
export function annotate(page, spec, { accent = '#C2410C', ink = '#1A1917' } = {}) {
  return page.evaluate(([spec, ACCENT, INK]) => {
    const layer = document.createElement('div')
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;font:600 13px/1 "PingFang SC","Noto Sans SC",sans-serif'
    document.body.appendChild(layer)
    const chip = (parent, text, css, color = ACCENT) => {
      const l = document.createElement('div'); l.textContent = text
      l.style.cssText = `position:absolute;background:${color};color:#fff;padding:5px 8px;border-radius:4px;white-space:nowrap;${css}`
      parent.appendChild(l)
    }
    const div = css => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;' + css; layer.appendChild(d); return d }
    for (const a of spec) {
      if (a.box) {
        const r = a.rect, p = a.pad ?? 0
        const d = div(`left:${r.x - p}px;top:${r.y - p}px;width:${r.w + 2 * p}px;height:${r.h + 2 * p}px;border:2px dashed ${ACCENT};background:${ACCENT}0d;box-sizing:border-box`)
        if (a.label) {
          const side = a.labelRight ? 'right:-2px;' : 'left:-2px;'
          const wrap = a.maxw ? `white-space:normal;max-width:${a.maxw}px;line-height:1.35;` : ''
          chip(d, a.label, side + wrap + (a.below ? 'top:calc(100% + 4px)' : 'bottom:calc(100% + 4px)'))
        }
      }
      if (a.gap) {
        const [x1, x2, y] = a.gap
        chip(div(`left:${x1}px;top:${y}px;width:${x2 - x1}px;border-top:2px solid ${INK}`), a.label, 'left:50%;transform:translateX(-50%);top:6px', INK)
      }
      if (a.hline !== undefined) chip(div(`left:0;right:0;top:${a.hline}px;border-top:2px dotted ${INK}`), a.label, 'right:12px;top:-27px', INK)
      if (a.vline !== undefined) chip(div(`top:${a.y1}px;height:${a.y2 - a.y1}px;left:${a.vline}px;border-left:2px dotted ${ACCENT}`), a.label, 'left:8px;top:-26px')
      if (a.callout) {
        const [x, y, toX, toY] = a.callout
        div(`left:${toX}px;top:${Math.min(y, toY)}px;height:${Math.abs(toY - y)}px;border-left:2px dotted ${ACCENT}`)
        chip(div(`left:${x}px;top:${y}px`), a.label, 'left:0;top:0')
      }
    }
  }, [spec, accent, ink])
}
