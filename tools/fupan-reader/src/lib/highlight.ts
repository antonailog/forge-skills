import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubLight from 'shiki/themes/github-light.mjs'
import githubDark from 'shiki/themes/github-dark.mjs'
import python from 'shiki/langs/python.mjs'
import shellscript from 'shiki/langs/shellscript.mjs'
import javascript from 'shiki/langs/javascript.mjs'
import html from 'shiki/langs/html.mjs'
import css from 'shiki/langs/css.mjs'
import nginx from 'shiki/langs/nginx.mjs'
import ini from 'shiki/langs/ini.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import json from 'shiki/langs/json.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import toml from 'shiki/langs/toml.mjs'
import sql from 'shiki/langs/sql.mjs'

// 只装用得到的语言和两套主题（Shiki 细粒度打包），引擎用纯 JS 正则，不带 wasm
let ready: Promise<HighlighterCore> | null = null
function highlighter() {
  ready ??= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [python, shellscript, javascript, typescript, tsx, json, yaml, toml, sql, html, css, nginx, ini, markdown],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return ready
}

const KNOWN = new Set(['python', 'shellscript', 'javascript', 'typescript', 'tsx', 'json', 'yaml', 'toml', 'sql', 'html', 'css', 'nginx', 'ini', 'markdown'])

/** 代码转成带行号、亮暗双主题的 HTML。marks 里的行加底色；给了 range 就只显示这几行（整段一起高亮，片段不丢上下文） */
export async function highlight(code: string, lang: string, marks: Set<number> = new Set(), range?: [number, number]) {
  const h = await highlighter()
  const start = range ? range[0] : 1
  return h.codeToHtml(code, {
    lang: KNOWN.has(lang) ? lang : 'text',
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: 'light',
    transformers: [
      {
        pre(node) {
          node.properties.style = `${node.properties.style ?? ''};--line-start:${start - 1}`
        },
        line(node, line) {
          if (marks.has(line)) this.addClassToHast(node, 'hl')
        },
        code(node) {
          if (!range) return
          let n = 0, keep = false
          node.children = node.children.filter((c) => {
            if (c.type === 'element') { n += 1; keep = n >= range[0] && n <= range[1]; return keep }
            return keep && n < range[1]   // 行与行之间的换行，跟着上一行走
          })
        },
      },
    ],
  })
}
