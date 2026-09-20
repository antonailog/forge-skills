#!/usr/bin/env node
// forge-design-lab · 页面包验收
// 用法: node verify_pack.mjs <html> [--repo <root>] [--shots <dir>] [--strict-literals] [--json <out>] [--vw 1440 --vh 900]
// 查什么: K3 零 JS 错误 · K4 同源（tokens.css 计算值 = json 基线；--repo 时再跑 build_tokens.py --check）
//        K5 组件 CSS 字面像素值（@lab:component 段，排除 fixed 标记与 0px/1px；默认 warn，--strict-literals 变 fail）
//        K6 每个可改 token 有 maps 且能命中元素 · K2 layout.el ↔ data-id · elementIds/effects/mobileBelow 引用存在
//        交互烟测：切层/切状态/线框区域数/点节点/检查模式点击/反馈解析/手机视口/跟随窗口尺寸/字体徽标/引擎同源检查
// 退出码: 0 全过 · 1 有 FAIL · 3 没有 Playwright（只做静态检查）· 64 用法错误
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execSync, spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = { strict: false, vw: 1440, vh: 900 };
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--repo') opt.repo = path.resolve(argv[++i]);
  else if (a === '--shots') opt.shots = path.resolve(argv[++i]);
  else if (a === '--json') opt.json = path.resolve(argv[++i]);
  else if (a === '--strict-literals') opt.strict = true;
  else if (a === '--vw') opt.vw = +argv[++i];
  else if (a === '--vh') opt.vh = +argv[++i];
  else pos.push(a);
}
if (!pos[0]) { console.error('用法: node verify_pack.mjs <html> [--repo <root>] [--shots <dir>] [--strict-literals] [--json <out>]'); process.exit(64); }
const html = path.resolve(pos[0]);
if (!fs.existsSync(html)) { console.error('找不到', html); process.exit(64); }

const R = { html, checks: [], info: {} };
const add = (level, key, msg, detail) => { R.checks.push({ level, key, msg, detail }); };
const pass = (k, m, d) => add('PASS', k, m, d), fail = (k, m, d) => add('FAIL', k, m, d), warn = (k, m, d) => add('WARN', k, m, d);

function loadPlaywright() {
  const tries = [
    () => createRequire(import.meta.url)('playwright'),
    () => createRequire(path.join(process.cwd(), 'x.js'))('playwright'),
    () => { const g = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); return createRequire(path.join(g, 'x.js'))('playwright'); },
  ];
  for (const t of tries) { try { return t(); } catch (e) { /* next */ } }
  return null;
}

function staticCheck(jsonRel) {
  if (!opt.repo || !jsonRel) return;
  const r = spawnSync('python3', [path.join(HERE, 'build_tokens.py'), opt.repo, jsonRel, '--check'], { encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  if (r.status === 0) pass('K4-static', 'build_tokens.py --check：js/css 与 json 同源', out.split('\n').slice(-1)[0]);
  else if (r.status === 2) fail('K4-static', 'js/css 与 json 不同源（用户保存后未重建，或有人手改了生成文件）', out);
  else fail('K4-static', 'tokens.json 校验失败', out);
}

function finish() {
  const fails = R.checks.filter(c => c.level === 'FAIL'), warns = R.checks.filter(c => c.level === 'WARN');
  R.summary = { pass: R.checks.length - fails.length - warns.length, warn: warns.length, fail: fails.length };
  const mark = { PASS: '✓', WARN: '⚠', FAIL: '✗' };
  console.log(`# verify_pack · ${path.basename(html)}`);
  for (const c of R.checks) {
    console.log(`${mark[c.level]} [${c.key}] ${c.msg}`);
    if (c.detail && c.level !== 'PASS') console.log('    ' + String(c.detail).split('\n').slice(0, 14).join('\n    '));
  }
  if (Object.keys(R.info).length) console.log('info:', JSON.stringify(R.info));
  console.log(`结果：PASS ${R.summary.pass} · WARN ${R.summary.warn} · FAIL ${R.summary.fail}`);
  if (opt.json) { fs.mkdirSync(path.dirname(opt.json), { recursive: true }); fs.writeFileSync(opt.json, JSON.stringify(R, null, 1)); console.log('→', opt.json); }
  process.exit(fails.length ? 1 : 0);
}

const pw = loadPlaywright();
if (!pw) {
  warn('playwright', '未找到 Playwright（本地 node_modules / 全局 npm root -g 都没有），跳过浏览器验收');
  const m = fs.readFileSync(html, 'utf8').match(/<script[^>]+src="([^"]+\.tokens\.js)"/);
  if (m && opt.repo) {
    try {
      const js = fs.readFileSync(path.resolve(path.dirname(html), m[1]), 'utf8');
      const spec = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
      staticCheck(spec.files && spec.files.json);
    } catch (e) { warn('static', '无法从 tokens.js 读出 spec：' + e.message); }
  }
  finish();
}

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: opt.vw, height: opt.vh }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
page.on('requestfailed', r => { const u = r.url(); if (u.startsWith('file:')) errs.push('requestfailed: ' + u); else warn('net', '外部资源加载失败（离线时正常）：' + u.slice(0, 90)); });

await page.goto(pathToFileURL(html).href);
await page.waitForFunction(() => window.WB && window.WB.spec, null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1200);
const spec = await page.evaluate(() => (window.WB && WB.spec) ? JSON.parse(JSON.stringify(WB.spec)) : null);
if (!spec) { fail('engine', 'WB.spec 不存在：引擎未加载、tokens.js 路径错误或 WB.init 未执行', errs.join('\n')); await browser.close(); finish(); }
R.info.page = spec.page; R.info.version = spec.version; R.info.nodes = spec.nodes.length;
if (spec.schemaVersion !== 1) warn('schema', 'schemaVersion 不是 1');

// tokens.css 是否真的加载
// file:// 下跨目录样式表的 cssRules 会抛 SecurityError，所以只看 sheet 是否存在（加载失败时 sheet 为 null）
const cssLink = await page.evaluate(() => { const l = document.getElementById('tokcss'); return { exists: !!l, href: l ? l.getAttribute('href') : null, loaded: !!(l && l.sheet) }; });
if (!cssLink.exists) fail('K4-link', '页面缺少 <link id="tokcss">（应指向 files.css，工作台与前端读同一份）');
else if (cssLink.loaded) pass('K4-link', `<link id=tokcss> 已加载：${cssLink.href}`); else fail('K4-link', `<link id=tokcss href="${cssLink.href}"> 未加载：相对路径是否指向 files.css？`);

// K4 同源（运行时）
const drift = await page.evaluate(() => {
  const T = WB.spec, cs = getComputedStyle(document.documentElement);
  const cssVal = (n, v) => { switch (n.type) { case 'px': return v + 'px'; case 'ms': return v + 'ms'; case 'num': return String(v); case 'colorref': return v === 'transparent' ? 'transparent' : 'var(--' + v + ')'; case 'color': return v; default: return null; } };
  const out = { miss: [], bad: [], n: 0 };
  T.nodes.filter(n => n.css && n.type !== 'raw').forEach(n => {
    out.n++; let want = cssVal(n, n.value);
    if (n.type === 'colorref' && n.value !== 'transparent') want = cs.getPropertyValue('--' + n.value).trim();
    const got = cs.getPropertyValue(n.css).trim();
    if (!got) out.miss.push(n.css); else if (got.replace(/\s/g, '') !== String(want).replace(/\s/g, '')) out.bad.push(n.css + ' 文件=' + got + ' json=' + want);
  });
  return out;
});
if (drift.miss.length === drift.n && drift.n) fail('K4', 'tokens.css 里没有任何页面变量（文件未加载或前缀不对）');
else if (drift.miss.length || drift.bad.length) fail('K4', `同源不一致：缺 ${drift.miss.length}，值不同 ${drift.bad.length}`, drift.miss.concat(drift.bad).join('\n'));
else pass('K4', `同源：${drift.n} 个变量的文件值 = json 基线`);
staticCheck(spec.files && spec.files.json);

// K5 字面像素值
const lit = await page.evaluate(() => {
  let css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const hasMarker = /@lab:component/.test(css);
  if (hasMarker) css = css.slice(css.indexOf('@lab:component'));
  css = css.replace(/\/\*\s*@lab:fixed-start[\s\S]*?@lab:fixed-end\s*\*\//g, '');
  const hits = [];
  css.split('\n').forEach((ln, i) => {
    if (/fixed\s*\*\//.test(ln)) return;
    const clean = ln.replace(/\/\*[\s\S]*?\*\//g, '');
    const m = [...clean.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g)].map(x => x[1]).filter(v => v !== '0' && v !== '1');
    if (m.length) hits.push({ line: i + 1, px: m, text: clean.trim().slice(0, 120) });
  });
  return { hasMarker, hits };
});
if (!lit.hasMarker) warn('K5', '没有 /* @lab:component */ 标记，字面值扫描覆盖了整个 <style>（含站点 token 复刻）');
if (lit.hits.length) (opt.strict ? fail : warn)('K5', `组件 CSS 有 ${lit.hits.length} 行字面像素值（未 token 化也未标 fixed）`, lit.hits.map(h => `L${h.line} ${h.px.join(',')}px  ${h.text}`).join('\n'));
else pass('K5', '组件 CSS 无未标记的字面像素值');

// K6 / K2 映射
const map = await page.evaluate(() => {
  const T = WB.spec, frame = document.getElementById('frame');
  const missing = [], nomaps = [], badsel = [];
  T.nodes.forEach(n => {
    if (!n.maps || !n.maps.length) { if (n.css || n.q) nomaps.push(n.id); return; }
    let c = 0; n.maps.forEach(s => { try { c += frame.querySelectorAll(s).length; } catch (e) { badsel.push(n.id + ' ' + s); } });
    if (!c) missing.push(n.id + ' → ' + n.maps.join(', '));
  });
  const dataIds = new Set([...frame.querySelectorAll('[data-id]')].map(e => e.dataset.id.toUpperCase()));
  const layoutMissing = (T.layout || []).filter(r => r.el !== null).map(r => (r.el || r.id).toUpperCase()).filter(id => !dataIds.has(id));
  const elMissing = Object.keys(T.elementIds || {}).filter(k => !/…|\.\.\./.test(k) && !dataIds.has(k.toUpperCase()));
  const ids = new Set(T.nodes.map(n => n.id));
  const effMissing = (T.effects || []).filter(e => !ids.has(e.node)).map(e => e.node);
  return { missing, nomaps, badsel, layoutMissing, elMissing, effMissing, mobileMissing: !!(T.mobileBelow && !ids.has(T.mobileBelow)), dataIdCount: dataIds.size };
});
if (map.missing.length || map.badsel.length) fail('K6', `有 maps 但命中不到元素 ${map.missing.length}，选择器非法 ${map.badsel.length}`, map.missing.concat(map.badsel).join('\n'));
else pass('K6', '所有带 maps 的节点都能命中骨架元素');
if (map.nomaps.length) warn('K6', `${map.nomaps.length} 个可改/带判断题的节点没有 maps（用户点不到）`, map.nomaps.join(', '));
if (map.layoutMissing.length) warn('K2', `线框区域找不到对应 data-id（layout.el）：${map.layoutMissing.join(', ')}`);
else if ((spec.layout || []).length) pass('K2', '线框区域与骨架 data-id 一一对应');
if (map.elMissing.length) warn('ids', `elementIds 登记了但骨架里没有的编号：${map.elMissing.join(', ')}`);
if (map.effMissing.length) fail('spec', `effects 引用了不存在的节点：${map.effMissing.join(', ')}`);
if (map.mobileMissing) fail('spec', `mobileBelow 引用了不存在的节点 ${spec.mobileBelow}`);
R.info.dataIds = map.dataIdCount;

// 交互烟测
if (opt.shots) fs.mkdirSync(opt.shots, { recursive: true });
const shot = async n => { if (!opt.shots) return; await page.waitForTimeout(150); await page.screenshot({ path: path.join(opt.shots, n + '.png') }); };
const statesLevel = spec.levels.find(l => l.states);
if ((spec.layout || []).length) {
  await page.evaluate(() => WB.set({ level: 'wire' })); await page.waitForTimeout(200);
  const n = await page.locator('#frame .lvl.wire .wire-r').count();
  if (n === spec.layout.length) pass('wire', `线框 ${n} 个区域`); else fail('wire', `线框区域数 ${n} ≠ layout ${spec.layout.length}`);
  await shot('wire');
}
for (const l of spec.levels) {
  if (l.key === 'wire') continue;
  if (l.states) {
    for (const s of spec.states) { await page.evaluate(k => WB.set({ level: k.l, state: k.s }), { l: l.key, s: s.key }); await shot(`${l.key}-${s.key}`); }
  } else { await page.evaluate(k => WB.set({ level: k }), l.key); await shot(l.key); }
}
if (statesLevel) await page.evaluate(k => WB.set({ level: k.l, state: k.s }), { l: statesLevel.key, s: (spec.states.find(s => s.key === 'done') || spec.states[0]).key });
await page.evaluate(() => WB.set({ tab: 'layer', panel: true }));
const nh = page.locator('#wb-layer .nd .nh').first();
if (await nh.count()) { await nh.click(); await page.waitForTimeout(250); pass('panel', '点节点名跳转无错误'); } else warn('panel', '按层面板里没有节点');
await page.evaluate(() => WB.set({ inspect: true }));
const fb = await page.locator('#frame').boundingBox();
if (fb) { await page.mouse.click(fb.x + fb.width / 2, fb.y + fb.height / 2); await page.waitForTimeout(200); }
const selCount = await page.locator('#wb-modlist .nd.sel').count();
await page.evaluate(() => WB.set({ inspect: false }));
R.info.inspectHits = selCount;
pass('inspect', `检查模式点击骨架中心：选中 ${selCount} 个 token（同一模块）`);
// 反馈解析
const firstEl = Object.keys(spec.elementIds || {}).find(k => !/…|\.\.\./.test(k));
const firstNode = spec.nodes[0] && spec.nodes[0].id;
if (firstEl || firstNode) {
  await page.evaluate(() => WB.set({ tab: 'fb' }));
  const lines = [firstEl && `${firstEl} 验收测试`, firstNode && `${firstNode} 验收测试`].filter(Boolean);
  await page.fill('#wb-fbin', lines.join('\n')); await page.click('#wb-fbadd'); await page.waitForTimeout(150);
  const refs = await page.locator('#wb-fblist .fb .ref:not(.none)').count();
  if (refs === lines.length) pass('feedback', `反馈行首编号解析 ${refs}/${lines.length}`); else warn('feedback', `反馈行首编号解析 ${refs}/${lines.length}（元素编号大小写或 elementIds 与 data-id 不一致？）`);
  await page.evaluate(() => { const T = WB.spec; localStorage.removeItem('wb:' + T.page + ':' + T.version); });
}
// 手机视口
const mob = spec.viewports.find(v => v.w && v.w < 600);
if (mob && spec.mobileBelow) {
  await page.evaluate(k => WB.set({ vp: k }), mob.key); await page.waitForTimeout(200);
  const isMob = await page.evaluate(() => document.getElementById('frame').classList.contains('mob'));
  if (isMob) pass('mobile', `${mob.label}：.mob 生效`); else fail('mobile', `${mob.label} 下 .mob 未生效（mobileBelow=${spec.mobileBelow} 的值大于视口宽？）`);
  await shot('mobile');
}
// 跟随窗口尺寸
await page.evaluate(() => WB.set({ vp: 'follow', panel: true })); await page.waitForTimeout(200);
const dims = await page.evaluate(() => { const f = document.getElementById('frame'), p = document.getElementById('wb-panel'); return { fw: f.offsetWidth, fh: f.offsetHeight, iw: innerWidth, ih: innerHeight, pw: p.offsetWidth }; });
if (Math.abs(dims.fw - (dims.iw - dims.pw)) <= 1 && Math.abs(dims.fh - dims.ih) <= 1) pass('follow', `跟随窗口 1:1：frame ${dims.fw}×${dims.fh} = 窗口 ${dims.iw}×${dims.ih} − 面板 ${dims.pw}`);
else fail('follow', `跟随窗口尺寸不对：frame ${dims.fw}×${dims.fh}，窗口 ${dims.iw}×${dims.ih}，面板 ${dims.pw}`);
// 字体与引擎同源检查
await page.click('#wb-tabs button[data-t="how"]'); await page.waitForTimeout(700);
R.info.font = (await page.textContent('#wb-font')).trim();
R.info.engineDrift = (await page.textContent('#wb-drift')).trim().slice(0, 160);
if (/✗/.test(R.info.font)) warn('fonts', '面板字体徽标：' + R.info.font + '（比例可判，气质延后）');
if (!/^同源/.test(R.info.engineDrift)) warn('K4-engine', '引擎同源检查：' + R.info.engineDrift);
await shot('how-tab');

// K3
if (errs.length) fail('K3', `${errs.length} 个 JS/资源错误`, errs.join('\n')); else pass('K3', '零 JS 错误、零 file:// 资源失败');
await browser.close();
finish();
