#!/usr/bin/env node
// 需求设计文档（docs/modules/*.md 中声明了 watch 的）的检查，供上线前门禁使用：
//   1. 漏更新：watch 覆盖的文件在本分支改了，文档本身却没改；watch 里写了不存在的路径（改了也拦不住）。
//      改动确实不影响设计时，在提交说明里写「设计文档无需更新：<文档名>」，这一条放行并列出来。
//   2. 只写现在：正文（「## 关键改动」之前）和正文引用的示意图源文件（overview/src/*.html）出现讲历史的词。
//      「实测 2026-08-02」「数据 2026-08-02」这种数据日期、「prompt v5.1」这种 prompt 版本号放行。
//   3. 关键改动超过 15 条。
//   4. 坏链接：图片或链接指向不存在的文件、用了绝对路径；正文用反引号写文件路径而不是链接。
//
// 用法：node scripts/design-doc/check.mjs [基准分支，默认 origin/main] [--repo <仓库目录>]
// 有问题时退出码为 1。
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const repoAt = args.indexOf('--repo')
const ROOT = repoAt >= 0 ? resolve(args[repoAt + 1]) : resolve(fileURLToPath(new URL('../..', import.meta.url)))
const BASE = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--repo')[0] ?? 'origin/main'
const HISTORY_WORDS = /改为|原来|之前|不再|新增|曾经|后来|\b20\d\d-\d\d-\d\d\b|\bv\d+\.\d+\b/
const EVIDENCE_DATE = /(实测|数据)[:：\s]*20\d\d-\d\d-\d\d/g
const PROMPT_VERSION = /prompt\s*\**\s*v\d+(\.\d+)*/gi
const FILE_IN_BACKTICKS = /`[^`\s]*\/[^`\s]*\.(md|py|ts|tsx|js|mjs|json|html|css|sql|ya?ml)`/
const MAX_CHANGES = 15

const git = (...a) => execFileSync('git', ['-c', 'core.quotePath=false', '-C', ROOT, ...a], { encoding: 'utf8' })
const lines = text => text.split('\n').filter(Boolean)
let changed
try {
  changed = new Set([
    ...lines(git('diff', '--name-only', `${BASE}...HEAD`)),
    ...lines(git('diff', '--name-only', 'HEAD')),                      // 未提交的改动
    ...lines(git('ls-files', '--others', '--exclude-standard')),      // 新文件
  ])
} catch (e) {
  console.error(`无法和基准分支 ${BASE} 比较：${e.message.split('\n')[0]}`)
  process.exit(1)
}

// 提交说明里的「设计文档无需更新：精选、AI搜索」
const waived = new Set()
try {
  for (const m of git('log', '--format=%B', `${BASE}..HEAD`).matchAll(/设计文档无需更新[:：]\s*([^\n]+)/g))
    for (const n of m[1].split(/[、,，\s]+/)) if (n) waived.add(n.replace(/\.md$/, ''))
} catch { /* 基准分支不可用时上面已经退出 */ }

const historyHit = text => HISTORY_WORDS.test(text.replace(EVIDENCE_DATE, '').replace(PROMPT_VERSION, ''))
// 页面示意里的真实内容（标题、摘要）放在 <!-- 样例 --> … <!-- /样例 --> 之间，不扫：真实标题里本来就可能有「新增」
const visibleText = html => html.replace(/<!--\s*样例\s*-->[\s\S]*?<!--\s*\/样例\s*-->/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')

function watchList(front) {
  const out = []; let inWatch = false
  for (const line of front.split('\n')) {
    if (/^\S/.test(line)) inWatch = /^watch:/.test(line)
    else if (inWatch) { const m = line.match(/^\s+-\s+([^\s#]+)/); if (m) out.push(m[1]) }
  }
  return out
}

const problems = [], notes = []
const dir = join(ROOT, 'docs/modules')
for (const name of existsSync(dir) ? readdirSync(dir).filter(n => n.endsWith('.md')) : []) {
  const rel = `docs/modules/${name}`
  const text = readFileSync(join(ROOT, rel), 'utf8')
  const front = text.match(/^---\n([\s\S]*?)\n---\n/)
  if (!front) continue
  const watch = watchList(front[1])
  if (!watch.length) continue                                          // 只检查声明了 watch 的设计文档
  const frontLines = front[0].split('\n').length - 1

  // 1. 漏更新；watch 路径必须存在
  for (const w of watch) if (!existsSync(join(ROOT, w))) problems.push(`${rel}：watch 里的路径不存在，改了也拦不住 → ${w}`)
  const hit = [...changed].filter(f => watch.some(w => f === w || f.startsWith(w.endsWith('/') ? w : w + '/')))
  if (hit.length && !changed.has(rel)) {
    if (waived.has(basename(rel, '.md'))) notes.push(`${rel}：提交说明写了「设计文档无需更新」，放行 → ${hit.join('、')}`)
    else problems.push(`${rel}：这些文件改了，设计文档没更新 → ${hit.join('、')}（改动不影响设计时，在提交说明里写「设计文档无需更新：${basename(rel, '.md')}」）`)
  }

  // 2. 只写现在  4b. 反引号里的文件路径
  const [body, tail = ''] = text.slice(front[0].length).split('\n## 关键改动')
  body.split('\n').forEach((line, i) => {
    const at = `${rel}:${i + 1 + frontLines}`
    const plain = line.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']').replace(/!\[[^\]]*\]/g, '')
    if (historyHit(plain)) problems.push(`${at} 正文出现讲历史的词：${line.trim().slice(0, 60)}`)
    if (FILE_IN_BACKTICKS.test(line)) problems.push(`${at} 文件路径请写成链接：${line.match(FILE_IN_BACKTICKS)[0]}`)
  })

  // 2b. 示意图源文件：图里的字也是正文
  for (const m of body.matchAll(/!\[[^\]]*\]\((<[^>]+>|[^)\s]+)\)/g)) {
    const img = resolve(dirname(join(ROOT, rel)), decodeURI(m[1].replace(/^<|>$/g, '')))
    const src = join(dirname(img), 'src', basename(img).replace(/\.png$/i, '.html'))
    if (!existsSync(src)) continue
    for (const t of visibleText(readFileSync(src, 'utf8')).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean))
      if (historyHit(t)) problems.push(`${rel}：示意图 ${basename(src)} 里出现讲历史的词：${t.slice(0, 60)}`)
  }

  // 3. 关键改动条数
  const changes = tail.split('\n').filter(l => /^\|\s*\d\d-\d\d\s*\|/.test(l))
  if (changes.length > MAX_CHANGES) problems.push(`${rel}：「关键改动」${changes.length} 条，超过 ${MAX_CHANGES} 条，删掉最早的`)

  // 4a. 坏链接（图片和链接）：绝对路径只在写的人本机能点开，提交后别人点不开
  for (const m of text.slice(front[0].length).matchAll(/\]\((<[^>]+>|[^)\s]+)\)/g)) {
    const target = m[1].replace(/^<|>$/g, '').split('#')[0]
    if (!target) continue
    if (/^(\/|~|file:)/i.test(target)) { problems.push(`${rel}：链接用了绝对路径，改成相对本文的路径 → ${target}`); continue }
    if (/^[a-z]+:/i.test(target)) continue
    if (!existsSync(resolve(dirname(join(ROOT, rel)), decodeURI(target)))) problems.push(`${rel}：链接指向不存在的文件 → ${target}`)
  }
}

if (notes.length) console.log('提示：\n- ' + notes.join('\n- '))
if (problems.length) {
  console.error('需求设计文档检查未通过：\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('✓ 需求设计文档检查通过')
