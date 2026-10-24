#!/usr/bin/env node
// forge-design-lab · 按零件库模板生成 template.css（与页面同一个生成器）。
// 用法：node build_template.js <repo> [--check]   --check：只比对，不一致退出码 1
const fs = require('fs'), path = require('path'), os = require('os');
// 生成器的母本在 design-studio（web/lab/system/template-css.js）。找的顺序、要求和退出码都和 _design_studio.py 一样
function dsHome() {
  const usable = d => fs.existsSync(path.join(d, 'web', 'lab', 'system', 'template-css.js'));
  const die = msg => { console.error(msg); process.exit(69); };
  const env = process.env.DESIGN_STUDIO_HOME;
  if (env) return usable(env) ? env : die(`✗ 环境变量 DESIGN_STUDIO_HOME=${env} 不是带骨架模式的 design-studio（旧版本就 cd 过去 git pull）`);
  const here = fs.realpathSync(__dirname);
  for (const d of [path.join(os.homedir(), '.design-studio'), path.join(os.homedir(), 'design-studio'),
                   path.join(here, '..', '..', '..', '..', '..', '工具', 'design-studio')]) {
    if (usable(d)) return d;
  }
  die('✗ 找不到带骨架模式的 design-studio。安装：git clone https://github.com/antonailog/design-studio.git ~/.design-studio（或用 DESIGN_STUDIO_HOME 指到它的目录；已装的旧版本 git pull）');
}
const { build } = require(path.join(dsHome(), 'web', 'lab', 'system', 'template-css.js'));
const repo = path.resolve(process.argv[2] || '.'), check = process.argv.includes('--check');
const J = JSON.parse(fs.readFileSync(path.join(repo, 'docs/assets/visuals/system/system.tokens.json'), 'utf8'));
const out = path.join(repo, J.files.template_css || 'docs/assets/visuals/system/template.css');
const css = build(J.template);
const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
if (check) { console.log(cur === css ? '✓ template.css 与模板一致' : '✗ template.css 落后于模板，跑 build_template.js'); process.exit(cur === css ? 0 : 1); }
fs.writeFileSync(out, css); console.log(`✓ ${path.relative(repo, out)} ${css.length} 字节`);
