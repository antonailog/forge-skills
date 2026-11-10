// 把构建好的单文件阅读页拷进 skill：skills/forge-fupan/assets/reader.html（build.py 再拷成 记录/复盘/index.html）；
// 顺带导出图标名单 assets/icons.json，build.py 用它检查关键术语的 icon 写得对不对
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { icons } from 'lucide-react'
const assets = new URL('../../../skills/forge-fupan/assets/', import.meta.url)
mkdirSync(assets, { recursive: true })
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
copyFileSync(new URL('../dist/index.html', import.meta.url), new URL('reader.html', assets))
const brands = [...readFileSync(new URL('../src/brands.ts', import.meta.url), 'utf8').matchAll(/^  "([^"]+)":/gm)].map((m) => m[1])
writeFileSync(new URL('icons.json', assets), JSON.stringify({ lucide: Object.keys(icons).sort(), brands: brands.sort() }))
console.log(`reader.html ${(html.length / 1024 / 1024).toFixed(1)} MB · lucide ${Object.keys(icons).length} · brands ${brands.length}`)
