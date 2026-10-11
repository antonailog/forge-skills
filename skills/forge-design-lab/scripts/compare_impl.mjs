#!/usr/bin/env node
// forge-design-lab · 实现比对：同一视口下，量骨架里的元素和真实产品页里的对应元素，位置与尺寸误差 ≤ 容差（默认 2px）。
//
// 用法:
//   node compare_impl.mjs <骨架 html 路径或 URL> [--app <产品页 URL>] [--json <报告输出>] [--shots <目录>]
// 比对清单写在 <page>.tokens.json 的 implCheck 字段（详见 references/spec-schema.md）：
//   {"app": "http://127.0.0.1:3567/#ai-search", "viewport": {"w":1440,"h":900}, "lab": {"level":"page","state":"done"},
//    "tolerance": 2, "waitFor": "[data-testid=ai-pane]", "pairs": [{"name":"引用列","lab":".col","app":"[data-testid=ai-cards]","props":["x","w"]}]}
// 骨架按 WB.set 切到同一视口、关面板，坐标按 #frame 缩放还原成真实像素；产品页按视口左上角量。
// 退出码：0 全部在容差内；1 有超差或元素找不到；2 配置或环境问题。
import { createRequire } from 'module';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

function loadPlaywright() {
  const tries = [
    () => createRequire(import.meta.url)('playwright'),
    () => createRequire(path.join(process.cwd(), 'x.js'))('playwright'),
    () => { const g = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); return createRequire(path.join(g, 'x.js'))('playwright'); },
  ];
  for (const t of tries) { try { return t(); } catch (e) { /* 下一个 */ } }
  return null;
}
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const target = args[0];
if (!target || target.startsWith('--')) { console.error('用法: node compare_impl.mjs <骨架 html> [--app URL] [--json out] [--shots dir]'); process.exit(2); }
const labUrl = /^https?:|^file:/.test(target) ? target : 'file://' + path.resolve(target);
const pw = loadPlaywright();
if (!pw) { console.error('✗ 没有 Playwright（npm i -g playwright && npx playwright install chromium）'); process.exit(2); }

const browser = await pw.chromium.launch();
try {
  // 先从骨架页拿 spec（WB.spec），再按 implCheck 配置开两个页面
  const probe = await browser.newPage();
  await probe.goto(labUrl, { waitUntil: 'load' });
  await probe.waitForFunction(() => window.WB && window.WB.spec, null, { timeout: 10000 });
  const spec = await probe.evaluate(() => window.WB.spec);
  await probe.close();
  const C = spec.implCheck;
  if (!C || !Array.isArray(C.pairs) || !C.pairs.length) { console.error('✗ tokens.json 里没有 implCheck.pairs'); process.exit(2); }
  const W = (C.viewport || {}).w || 1440, H = (C.viewport || {}).h || 900, tol = C.tolerance ?? 2;
  const appUrl = opt('--app') || C.app;
  if (!appUrl) { console.error('✗ 没有产品页地址（implCheck.app 或 --app）'); process.exit(2); }
  const vp = (spec.viewports || []).find(v => v.w === W && v.h === H);
  if (!vp) { console.error(`✗ spec.viewports 里没有 ${W}×${H} 这一档，骨架无法切到同一视口`); process.exit(2); }

  const lab = await browser.newPage({ viewport: { width: W + 420, height: H + 200 } });
  const errs = [];
  lab.on('pageerror', e => errs.push(e.message));
  await lab.goto(labUrl, { waitUntil: 'load' });
  await lab.waitForFunction(() => window.WB && window.WB.set);
  await lab.evaluate(([v, L]) => window.WB.set(Object.assign({ vp: v, panel: false, inspect: false, dims: false, ids: false }, L || {})), [vp.key, C.lab]);
  await lab.waitForTimeout(400);
  const labBoxes = await lab.evaluate(([pairs, W]) => {
    // 坐标原点取 #frame 的内容区左上角：引擎给画框加了边框，从边框外沿量会系统性多出 1px
    const frame = document.getElementById('frame'); const b = frame.getBoundingClientRect();
    const k = b.width / W;                                   // 预设视口会把画框缩放到适合窗口
    const bk = b.width / (frame.offsetWidth || W);           // 边框宽同样被缩放
    const fr = { left: b.left + frame.clientLeft * bk, top: b.top + frame.clientTop * bk };
    return pairs.map(p => {
      const el = [...frame.querySelectorAll(p.lab)].find(e => e.getClientRects().length);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: (r.left - fr.left) / k, y: (r.top - fr.top) / k, w: r.width / k, h: r.height / k };
    });
  }, [C.pairs, W]);

  const app = await browser.newPage({ viewport: { width: W, height: H } });
  await app.goto(appUrl, { waitUntil: 'networkidle' }).catch(() => app.goto(appUrl, { waitUntil: 'load' }));
  if (C.waitFor) await app.waitForSelector(C.waitFor, { timeout: 15000 }).catch(() => {});
  const appBoxes = await app.evaluate(pairs => pairs.map(p => {
    const el = [...document.querySelectorAll(p.app)].find(e => e.getClientRects().length);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }), C.pairs);

  const shots = opt('--shots');
  if (shots) { fs.mkdirSync(shots, { recursive: true }); await lab.locator('#frame').screenshot({ path: path.join(shots, 'lab.png') }); await app.screenshot({ path: path.join(shots, 'app.png') }); }

  const rows = []; let bad = 0;
  C.pairs.forEach((p, i) => {
    const a = labBoxes[i], b = appBoxes[i];
    const props = p.props || ['x', 'y', 'w', 'h'];
    if (!a || !b) { bad++; rows.push({ name: p.name, ok: false, why: !a ? `骨架里找不到 ${p.lab}` : `产品页找不到 ${p.app}` }); return; }
    const diffs = Object.fromEntries(props.map(k => [k, +(b[k] - a[k]).toFixed(1)]));
    const ok = Object.values(diffs).every(d => Math.abs(d) <= tol);
    if (!ok) bad++;
    rows.push({ name: p.name, ok, lab: a, app: b, diffs });
  });
  console.log(`# 实现比对 · ${W}×${H} · 容差 ${tol}px · ${C.pairs.length - bad}/${C.pairs.length} 通过`);
  for (const r of rows) {
    if (r.why) { console.log(`  ✗ ${r.name}：${r.why}`); continue; }
    const d = Object.entries(r.diffs).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' ');
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}：${d}（骨架 ${Math.round(r.lab.w)}×${Math.round(r.lab.h)} @${Math.round(r.lab.x)},${Math.round(r.lab.y)}）`);
  }
  if (errs.length) console.log('  ⚠ 骨架页 JS 错误：' + errs.slice(0, 3).join(' | '));
  const out = opt('--json');
  if (out) fs.writeFileSync(out, JSON.stringify({ viewport: { w: W, h: H }, tolerance: tol, rows }, null, 1));
  process.exitCode = bad ? 1 : 0;
} finally {
  await browser.close();
}
