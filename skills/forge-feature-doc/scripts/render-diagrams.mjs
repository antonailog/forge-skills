#!/usr/bin/env node
// 把需求设计文档的示意图源文件（<dir>/src/*.html）渲染成 PNG（<dir>/<name>.png）。
// 纯本地渲染，不访问任何服务。
//
// 用法：
//   node scripts/design-doc/render-diagrams.mjs docs/assets/visuals/ai-search/overview
// 仓库根目录没装依赖时，用全局 Playwright：
//   NODE_PATH="$(npm root -g)" node scripts/design-doc/render-diagrams.mjs <dir>
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const dir = resolve(process.argv[2] ?? '')
if (!process.argv[2]) {
  console.error('用法：node scripts/design-doc/render-diagrams.mjs <overview 目录>')
  process.exit(1)
}
const sources = readdirSync(join(dir, 'src')).filter(name => name.endsWith('.html'))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
for (const name of sources) {
  await page.goto('file://' + join(dir, 'src', name))
  await page.waitForTimeout(200)
  const height = await page.evaluate(() => document.body.scrollHeight)
  await page.setViewportSize({ width: 960, height })
  const out = join(dir, basename(name, '.html') + '.png')
  await page.screenshot({ path: out, fullPage: true })
  console.log('✓', out)
}
await browser.close()
