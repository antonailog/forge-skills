#!/usr/bin/env node
// 新建一份需求设计文档的骨架：
//   docs/modules/<功能名>.md                        按类型保留需要的部分
//   docs/assets/visuals/<短名>/overview/src/        示意图模板（diagram.css + 对应的 HTML）
//   scripts/design-doc/{render-diagrams,check,annotate}.mjs   复制进项目，没装 skill 也能跑
//
// 用法：node scaffold.mjs --repo <仓库> --feature <功能名> --slug <英文短名> --types ui,backend,ai [--force] [--update-scripts]
//   --types 取 ui（有界面）、backend（有后端）、ai（有 AI 或算法）的任意组合，可以为空
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL = resolve(fileURLToPath(new URL('..', import.meta.url)))
const argv = process.argv.slice(2)
const opt = name => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : undefined }
const flag = name => argv.includes('--' + name)
const repo = opt('repo'), feature = opt('feature'), slug = opt('slug')
const types = new Set((opt('types') ?? '').split(',').map(s => s.trim()).filter(Boolean))
if (!repo || !feature || !slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('用法：node scaffold.mjs --repo <仓库> --feature <功能名> --slug <英文短名，小写和连字符> --types ui,backend,ai')
  process.exit(1)
}
for (const t of types) if (!['ui', 'backend', 'ai'].includes(t)) { console.error(`未知类型：${t}`); process.exit(1) }

const ROOT = resolve(repo)
const docPath = join(ROOT, 'docs/modules', `${feature}.md`)
if (existsSync(docPath) && !flag('force')) { console.error(`已存在：${docPath}（要覆盖加 --force）`); process.exit(1) }

// 1. 文档：按类型保留 @if 块，替换占位符
let doc = readFileSync(join(SKILL, 'assets/doc-template.md'), 'utf8')
doc = doc.replace(/<!-- @if (\w+) -->\n([\s\S]*?)<!-- @endif -->\n/g, (_, t, body) => types.has(t) ? body : '')
const today = new Date().toISOString().slice(0, 10)
doc = doc.replaceAll('{{功能名}}', feature).replaceAll('{{短名}}', slug).replaceAll('{{日期}}', today)
mkdirSync(join(ROOT, 'docs/modules'), { recursive: true })
writeFileSync(docPath, doc)

// 2. 示意图模板
const src = join(ROOT, 'docs/assets/visuals', slug, 'overview/src')
mkdirSync(src, { recursive: true })
const diagrams = ['diagram.css', 'status-quo.html', 'flow.html',
  ...(types.has('ui') ? ['page-mock.html'] : []),                  // 截不到真实页面时的页面示意
  ...(types.has('ai') ? ['funnel.html', 'pipeline.html'] : []),
  ...(types.has('backend') ? ['architecture.html'] : [])]
for (const f of diagrams) if (!existsSync(join(src, f))) copyFileSync(join(SKILL, 'assets/diagrams', f), join(src, f))

// 3. 脚本复制进项目
const scriptsDir = join(ROOT, 'scripts/design-doc')
mkdirSync(scriptsDir, { recursive: true })
const copied = []
for (const f of ['render-diagrams.mjs', 'check.mjs', 'annotate.mjs']) {
  const to = join(scriptsDir, f)
  if (!existsSync(to) || flag('update-scripts')) { copyFileSync(join(SKILL, 'scripts', f), to); copied.push(f) }
}

console.log(`✓ 文档：${docPath}
✓ 示意图模板：${src}（${diagrams.join('、')}）
✓ 脚本：${scriptsDir}（${copied.length ? '复制了 ' + copied.join('、') : '已存在，未覆盖；要更新加 --update-scripts'}）
下一步：填 frontmatter 的 watch；按 references/writing-rules.md 写正文；改 src/*.html 后跑 render-diagrams.mjs；最后跑 check.mjs。`)
