#!/usr/bin/env node
// forge-design-lab · 按零件库模板生成 template.css（与页面同一个生成器）。
// 用法：node build_template.js <repo> [--check]   --check：只比对，不一致退出码 1
const fs = require('fs'), path = require('path');
const { build } = require(path.join(__dirname, '..', 'assets', 'system', 'template-css.js'));
const repo = path.resolve(process.argv[2] || '.'), check = process.argv.includes('--check');
const J = JSON.parse(fs.readFileSync(path.join(repo, 'docs/assets/visuals/system/system.tokens.json'), 'utf8'));
const out = path.join(repo, J.files.template_css || 'docs/assets/visuals/system/template.css');
const css = build(J.template);
const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
if (check) { console.log(cur === css ? '✓ template.css 与模板一致' : '✗ template.css 落后于模板，跑 build_template.js'); process.exit(cur === css ? 0 : 1); }
fs.writeFileSync(out, css); console.log(`✓ ${path.relative(repo, out)} ${css.length} 字节`);
