// 生成 src/brands.ts：关键术语卡片能用的品牌标（Simple Icons）。只引入这里列的，避免把三千多个图标都打进模板。
// 加品牌：在 WANT 里加 slug（https://simpleicons.org 上的名字），再跑 node scripts/gen-brands.mjs
import * as si from 'simple-icons'
import { writeFileSync } from 'node:fs'
const WANT = ['react','vuedotjs','nextdotjs','vite','tailwindcss','shadcnui','typescript','javascript','html5','css','python','nodedotjs','deno','bun','go','rust','docker','nginx','linux','ubuntu','github','git','githubactions','postgresql','mysql','sqlite','redis','mongodb','supabase','cloudflare','vercel','netlify','alibabacloud','googlecloud','figma','anthropic','claude','googlegemini','ollama','huggingface','langchain','puppeteer','mermaid','markdown','notion','obsidian','wechat','x','xiaohongshu','zhihu','bilibili','youtube','tiktok','telegram','discord','googleanalytics','umami','baidu','plausibleanalytics','matomo','stripe','resend','gmail','jira','cursor','npm','pnpm','webpack','electron','tauri','flutter','swift','kotlin','fastapi','flask','django','express','svelte','astro','threedotjs','d3','json','yaml','toml','jupyter','pandas','numpy','pytorch','ffmpeg','githubcopilot','perplexity','v0','replit','zod']
const name = (k) => 'si' + k[0].toUpperCase() + k.slice(1)
const ok = WANT.filter((k) => si[name(k)])
const missing = WANT.filter((k) => !si[name(k)])
if (missing.length) console.warn('simple-icons 里没有：', missing.join(' '))
writeFileSync(new URL('../src/brands.ts', import.meta.url),
  `// 由 scripts/gen-brands.mjs 生成，别手改\nimport { ${ok.map(name).join(', ')} } from 'simple-icons'\n\n` +
  `export const BRANDS: Record<string, string> = {\n${ok.map((k) => `  ${JSON.stringify(k)}: ${name(k)}.path,`).join('\n')}\n}\n`)
console.log('brands:', ok.length)
