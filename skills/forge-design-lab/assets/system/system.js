/* forge-design-lab · 设计零件库页面。
   数据：同目录 system.tokens.json（extract_system.py 生成）。
   用户产出三样：edits（改了还没同步进代码的值）、decisions（保留/定为标准/归并/废弃/拿不准）、feedback。
   保存：POST /api/lab/save（serve.py 按 kind=system 合并，只收这三样）。
   零件预览用 product.css（产品自己的 Tailwind 编译），所以按钮和文字角色是产品真像素。 */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TABS = [
    ['colors', '颜色'], ['type', '字体'], ['scales', '阶梯'], ['buttons', '按钮'], ['layout', '版面'], ['debt', '待清理'], ['feedback', '反馈']];
  const PILLS = {
    button: [['std', '定为标准'], ['merge', '归并到…'], ['drop', '废弃'], ['unsure', '拿不准']],
    other: [['keep', '保留'], ['merge', '归并到…'], ['drop', '废弃'], ['unsure', '拿不准']]
  };
  const BADGE = { std: '标准', keep: '保留', merge: '归并', drop: '废弃', unsure: '拿不准' };
  const RARE = 2;   // 用量 ≤ 2 的阶梯值标「少用」，是归并候选
  const LS_UI = 'sys:ui';

  let J = null, REPO = '', SAVED = '', S = { tab: 'colors', dark: false, sel: null, open: {} };
  const ITEMS = {};  // id -> {kind, title, data}

  try { Object.assign(S, JSON.parse(localStorage.getItem(LS_UI) || '{}'), { sel: null }); } catch (e) { /* 忽略 */ }

  // ---------- 数据 ----------
  function snapshot() { return JSON.stringify({ e: J.edits, d: J.decisions, f: J.feedback }); }
  function dirty() { return J && snapshot() !== SAVED; }
  function dec(id) { return J.decisions[id] || {}; }
  function setDec(id, patch) {
    const d = Object.assign({}, J.decisions[id] || {}, patch);
    Object.keys(d).forEach(k => { if (d[k] === '' || d[k] == null) delete d[k]; });
    if (Object.keys(d).length) J.decisions[id] = d; else delete J.decisions[id];
    changed(id);
  }
  function edit(id) { return J.edits[id] || null; }
  function setEdit(id, patch) {
    const e = Object.assign({}, J.edits[id] || {}, patch);
    Object.keys(e).forEach(k => { if (e[k] === '' || e[k] == null) delete e[k]; });
    if (Object.keys(e).length) J.edits[id] = e; else delete J.edits[id];
    applyEdits();
    changed(id);
  }
  function changed(id) {
    status();
    // 只重画受影响的那一格 + 抽屉，避免整页跳动
    const keepScroll = $('#sys-main').scrollTop;
    renderTab();
    $('#sys-main').scrollTop = keepScroll;
    if (S.sel === id) openDrawer(id, true);
  }
  function status() {
    const n = Object.keys(J.edits).length;
    $('#sys-dirty').textContent = dirty() ? ('有未保存改动' + (n ? ` · ${n} 处值改动待同步进代码` : '')) : (n ? `${n} 处值改动待同步进代码` : '');
  }

  // ---------- 颜色解析：按 json 解 var() 链，色块不依赖当前页面模式 ----------
  const COLOR = {};
  function colorTable() {
    J.colors.forEach(c => { COLOR[c.id] = c; });
  }
  function rawVal(name, mode, scope) {
    const id = scope && scope !== 'root' ? `${scope} ${name}` : name;
    const c = COLOR[id] || (J.other_vars || []).find(o => o.id === id);
    const e = J.edits['color:' + id];
    if (e && e[mode]) return e[mode];
    if (!c) return scope && scope !== 'root' ? rawVal(name, mode, 'root') : null;
    if (mode === 'dark') return c.dark || c.light;
    return c.light;
  }
  function resolve(name, mode, scope, depth) {
    const v = rawVal(name, mode, scope);
    if (!v) return 'transparent';
    return v.replace(/var\((--[\w-]+)\)/g, (_, n) => (depth || 0) > 6 ? 'transparent' : resolve(n, mode, scope, (depth || 0) + 1));
  }
  function rgb(css) {
    const p = document.createElement('i'); p.style.color = css; document.body.appendChild(p);
    const m = getComputedStyle(p).color.match(/[\d.]+/g); p.remove();
    return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  }
  function lum(c) { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; }
  function contrast(a, b) { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }

  // ---------- 改动落到页面：生成覆盖 css ----------
  function applyEdits() {
    const out = [];
    Object.entries(J.edits).forEach(([k, e]) => {
      if (k.startsWith('color:')) {
        const c = COLOR[k.slice(6)]; if (!c) return;
        const sc = c.scope === 'root' ? '' : ' ' + c.scope;
        if (e.light) out.push(`:root:not(.dark)${sc}{${c.name}:${e.light}}`);
        if (e.dark) out.push(`:root.dark${sc},.dark${sc}{${c.name}:${e.dark}}`);
      } else if (k.startsWith('role:')) {
        const decl = [];
        if (e.size) decl.push(`font-size:${e.size}px!important`);
        if (e.lh) decl.push(`line-height:${e.lh}!important`);
        if (e.weight) decl.push(`font-weight:${e.weight}!important`);
        out.push(`.${k.slice(5)}{${decl.join(';')}}`);
      }
    });
    $('#sys-edits').textContent = out.join('\n');
  }

  // ---------- 小部件 ----------
  function badge(id) {
    const d = dec(id), e = edit(id);
    let h = '';
    if (d.r) h += `<span class="sys-badge ${d.r}">${BADGE[d.r]}${d.r === 'merge' && d.to ? ' → ' + esc(d.to) : ''}</span>`;
    if (e) h += '<span class="sys-badge edit">已改值</span>';
    if (d.note) h += '<span class="sys-badge keep" title="' + esc(d.note) + '">备注</span>';
    return h;
  }
  function reg(id, kind, title, data) { ITEMS[id] = { kind, title, data }; return `data-sid="${esc(id)}"`; }
  function codeLink(loc) {
    const m = String(loc).match(/^(.*?)(?::(\d+))?$/);
    const href = REPO ? `vscode://file${REPO}/${m[1]}${m[2] ? ':' + m[2] : ''}` : '#';
    return `<a href="${esc(href)}" title="在 VS Code 打开">${esc(loc)}</a>`;
  }
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  // ---------- 各分区 ----------
  function renderColors() {
    const byFam = {};
    J.colors.forEach(c => { (byFam[c.family] = byFam[c.family] || []).push(c); });
    const used = J.colors.filter(c => c.uses > 0).length;
    let h = `<p class="sys-intro">站点所有颜色变量，左半块是亮色、右半块是暗色。<b>点一张卡</b>在右侧改色值、看谁在用、给出保留或归并的结论。改值会立刻作用到整页（按钮、文字样张都会跟着变），保存后由 Agent 同步进 <span class="sys-mono">${esc(J.files.css_source)}</span>。</p>
      <div class="sys-stat"><div><b>${J.colors.length}</b>颜色变量</div><div><b>${used}</b>有人在用</div><div><b>${J.colors.length - used}</b>没人引用</div><div><b>${(J.hardcoded_colors || []).length}</b>代码里写死的颜色</div></div>`;
    J.families.forEach(f => {
      const cs = byFam[f.key]; if (!cs) return;
      h += `<h2 class="sys-h2">${esc(f.label)}<small>${cs.length} 个${f.key === 'scope' ? ' · 次数是同名变量的全站合计' : ` · 引用 ${sum(cs.map(c => c.uses))} 次`}</small></h2><div class="sys-colors">`;
      cs.forEach(c => {
        const id = 'color:' + c.id;
        const lv = resolve(c.name, 'light', c.scope), dv = resolve(c.name, 'dark', c.scope);
        const show = v => v && v.startsWith('var(') ? '= ' + v.slice(4, -1) : (v || '—');
        h += `<div class="sys-color sys-item ${c.uses ? '' : 'zero'} ${S.sel === id ? 'sel' : ''}" ${reg(id, 'color', c.id, c)}>
          <div class="sw"><div><div style="background:${esc(lv)}"></div><em>亮</em></div><div><div style="background:${esc(dv)}"></div><em>暗</em></div></div>
          <div class="meta"><div class="nm">${esc(c.scope === 'root' ? c.name : c.scope + ' ' + c.name)}${badge(id)}</div>
          <div class="vals">${esc(show(edit(id) && edit(id).light || c.light))} / ${esc(show(edit(id) && edit(id).dark || c.dark))}</div>
          <div class="use">${c.uses ? `引用 ${c.uses} 次 · ${c.files_n || c.files.length} 个文件` : '没人引用'}</div></div></div>`;
      });
      h += '</div>';
    });
    if ((J.tw_colors || []).length) {
      const tw = J.tw_colors;
      h += `<h2 class="sys-h2">Tailwind 固定色板<small>${tw.length} 个 · 写死在 ${esc(J.files.tailwind)}，不随暗色切换</small></h2>
        <p class="sys-sub">这些颜色不是变量，暗色模式下不会变。灰掉的是代码里没用到的。</p><div class="sys-chips">`;
      tw.forEach(c => {
        const id = 'tw:' + c.id;
        h += `<span class="sys-chip sys-item ${c.uses ? '' : 'zero'}" ${reg(id, 'tw', c.id, c)}><i style="background:${esc(c.value)}"></i>${esc(c.id)} · ${c.uses}${badge(id)}</span>`;
      });
      h += '</div>';
    }
    const ov = J.other_vars || [];
    if (ov.length) {
      h += `<h2 class="sys-h2">非颜色变量<small>${ov.length} 个 · 阴影、高度、圆角等</small></h2><div class="sys-chips">`;
      ov.forEach(o => {
        const id = 'var:' + o.id;
        h += `<span class="sys-chip sys-item" ${reg(id, 'var', o.id, o)} style="padding-left:8px">${esc(o.id)} · ${o.uses}${badge(id)}</span>`;
      });
      h += '</div>';
    }
    return h;
  }

  const SAMPLE_CN = '今天值得看的 AI 要点：Claude 发布新模型，GitHub Copilot 更新 Agent 模式。';
  function renderType() {
    let h = `<p class="sys-intro">上半部分是<b>字体角色</b>（用哪套字体），下半部分是<b>文字角色</b>（字号、行高、字重、颜色打包成一个类）。新模块写文字时优先套用文字角色，不要现写字号。</p>
      <h2 class="sys-h2">字体角色<small>${J.fonts.length} 种 · 来自 ${esc(J.files.tailwind)}</small></h2>`;
    J.fonts.forEach(f => {
      const id = 'font:' + f.id;
      h += `<div class="sys-font sys-item ${S.sel === id ? 'sel' : ''}" ${reg(id, 'font', 'font-' + f.id, f)}>
        <div class="k">font-${esc(f.id)}${badge(id)}<small>${f.uses ? `类名引用 ${f.uses} 次` : (f.id === 'sans' ? '页面默认字体，不需要写类名' : '没人用')}</small></div>
        <div class="s" style="font-family:${esc(f.stack.map(x => /\s/.test(x) ? `'${x}'` : x).join(','))}">info2act 每日 AI 要点 · The quick brown fox 0123456789<small>${esc(f.stack.join(', '))}</small></div></div>`;
    });
    h += `<h2 class="sys-h2">文字角色<small>${J.text_roles.length} 个 · 定义在 ${esc(J.files.css_source)}</small></h2>
      <p class="sys-sub">样张直接套用产品里的类名渲染。点一行可以改字号、行高、字重，样张当场变。</p>`;
    J.text_roles.forEach(r => {
      const id = 'role:' + r.id, e = edit(id) || {};
      const sz = e.size || r.size, lh = e.lh || r.lh, wt = e.weight || r.weight;
      h += `<div class="sys-role sys-item ${S.sel === id ? 'sel' : ''}" ${reg(id, 'role', '.' + r.id, r)}>
        <div><div class="sys-mono" style="font-weight:600">.${esc(r.id)}${badge(id)}</div>
          <div class="spec">${sz}px / ${lh || '继承'} / ${wt}<br>font-${esc(r.family)}${r.color ? '<br>' + esc(r.color) : ''}</div>
          ${r.note ? `<div class="sys-muted" style="font-size:11.5px;margin-top:4px">${esc(r.note)}</div>` : ''}</div>
        <div class="smp"><div class="${esc(r.id)}">${sz >= 18 ? 'OpenAI 发布 GPT-6，推理成本降低 60%' : SAMPLE_CN}</div></div></div>`;
    });
    return h;
  }

  function ladderHtml(kind, title, desc, row) {
    const arr = J.scales[kind] || [];
    const tot = sum(arr.map(x => x.n));
    let h = `<div><h2 class="sys-h2">${title}<small>${arr.length} 档 · 用了 ${tot} 次</small></h2><p class="sys-sub">${desc}</p><div class="sys-ladder">`;
    arr.forEach(x => {
      const id = `scale:${kind}:${x.v}`;
      h += `<div class="sys-step sys-item ${x.n <= RARE ? 'rare' : ''} ${S.sel === id ? 'sel' : ''}" ${reg(id, 'scale', `${title} ${x.v}`, Object.assign({ kind }, x))}>
        <div class="v">${x.v}</div><div>${row(x)}</div><div class="n">${x.n} 次${x.n <= RARE ? '<span class="sys-badge rare">少用</span>' : ''}${badge(id)}</div></div>`;
    });
    return h + '</div></div>';
  }
  function renderScales() {
    const all = ['px', 'space', 'radius', 'lh', 'weight'].map(k => (J.scales[k] || []).length);
    let h = `<p class="sys-intro">这些阶梯是从代码里<b>实际用到的值</b>统计出来的，不是理想值。标「少用」的只出现一两次，通常是随手写的，可以归并到相邻的常用档。目标是每组只留 5 到 8 档。</p>
      <div class="sys-stat"><div><b>${all[0]}</b>档字号</div><div><b>${all[1]}</b>档间距</div><div><b>${all[2]}</b>档圆角</div><div><b>${all[3]}</b>档行高</div><div><b>${all[4]}</b>档字重</div></div><div class="sys-cols">`;
    h += ladderHtml('px', '字号', '样张按该字号渲染。', x => `<span style="font-size:${x.v}px;line-height:1.3;white-space:nowrap">信息到行动 Aa 123</span>`);
    h += ladderHtml('space', '间距', '内边距、外边距、gap。条长 = 实际像素。', x => `<div class="bar" style="width:${Math.min(x.v, 400)}px"></div>`);
    h += ladderHtml('radius', '圆角', '', x => `<div class="rad" style="border-radius:${Math.min(x.v, 999)}px"></div>`);
    h += ladderHtml('lh', '行高', '两行样张按该行高排。', x => `<div style="font-size:13px;line-height:${x.v};max-width:240px">AI 要点两行样张，用来看行距松紧是否合适。</div>`);
    h += ladderHtml('weight', '字重', '', x => `<span style="font-weight:${x.v};font-size:15px">信息到行动 Aa 123</span>`);
    return h + '</div>';
  }

  function btnLabel(f, v) { return v.label || ({ icon: '✕', overlay: '▶', pill: '标签' }[f.key] || '按钮'); }
  function btn(cls, label, extra) { return `<button type="button" tabindex="-1" class="${esc(cls)}" ${extra || ''}>${esc(label)}</button>`; }
  function renderButtons() {
    const B = J.buttons;
    const kinds = sum(B.families.map(f => f.variants.length));
    const std = Object.entries(J.decisions).filter(([k, d]) => k.startsWith('btn.') && d.r === 'std').length;
    let h = `<p class="sys-intro">代码里每个 <span class="sys-mono">&lt;button&gt;</span> 都按长相归了类。同一类里本该只有一两种标准样式，现在却有很多变体。<b>请在每类里挑出标准</b>（点一行，右侧选「定为标准」），其余选「归并到」某个标准，以后统一改。</p>
      <div class="sys-stat"><div><b>${B.total}</b>个按钮</div><div><b>${kinds}</b>种长相</div><div><b>${B.dynamic}</b>个是动态类名</div><div><b>${(B.unstyled || []).length}</b>个没写样式</div><div><b>${std}</b>个已定为标准</div></div>`;
    B.families.forEach(f => {
      if (!f.variants.length) return;
      const main = f.variants.filter(v => v.count > 1 || dec(v.id).r);
      const tail = f.variants.filter(v => !(v.count > 1 || dec(v.id).r));
      const open = S.open[f.key];
      h += `<h2 class="sys-h2">${esc(f.label)}<small>${f.count} 个按钮 · ${f.variants.length} 种长相</small></h2><p class="sys-sub">${esc(f.desc)}</p>
        <table class="sys-btable"><thead><tr><th>默认</th><th>悬停</th><th>键盘聚焦</th><th>禁用</th><th>暗色</th><th style="text-align:right">次数</th><th>出处</th></tr></thead><tbody>`;
      const rows = open ? main.concat(tail) : main;
      rows.forEach(v => {
        const L = btnLabel(f, v);
        h += `<tr class="sys-item ${S.sel === v.id ? 'sel' : ''}" ${reg(v.id, 'button', f.label + ' · ' + (v.label || v.id), Object.assign({ fam: f }, v))}>
          <td><div class="stage">${btn(v.cls, L)}</div></td>
          <td><div class="stage">${v.cls_hover !== v.cls ? btn(v.cls_hover, L) : '<span class="sys-muted" style="font-size:11px">无变化</span>'}</div></td>
          <td><div class="stage">${v.cls_focus !== v.cls ? btn(v.cls_focus, L) : '<span class="sys-muted" style="font-size:11px">无</span>'}</div></td>
          <td><div class="stage">${btn(v.cls, L, 'disabled')}</div></td>
          <td><div class="stage dk dark">${btn(v.cls, L)}</div></td>
          <td class="n">${v.count}</td>
          <td><div class="w" title="${esc(v.where.join('\n'))}">${esc(v.where[0])}</div>${v.dynamic ? '<span class="sys-badge dyn" title="类名是条件拼接的，这里取每个属性的第一个值近似渲染">动态·近似</span>' : ''}${badge(v.id)}</td></tr>`;
      });
      h += '</tbody></table>';
      if (tail.length) h += `<button class="sys-more" data-more="${f.key}">${open ? '收起' : `展开只出现 1 次的 ${tail.length} 种`}</button>`;
    });
    return h;
  }

  function shellHtml(L) {
    const W = L.vw || 1440, H = L.vh || 900;
    const rg = (L.regions || []).map(r => {
      const st = `left:${r.x / W * 100}%;top:${r.y / H * 100}%;width:${r.w / W * 100}%;height:${r.h / H * 100}%`;
      // 矮条（≤ 60）和窄条（≤ 96）放不下两行字：只留一行，细节进悬停提示
      const tip = `${r.label} · ${r.w}×${r.h}${r.note ? ' · ' + r.note : ''}`;
      const inner = r.h <= 60 ? `<b>${esc(r.label)} <i style="display:inline">${r.w}×${r.h}</i></b>`
        : r.w <= 96 ? `<b>${esc(r.label)}</b><i>${r.w}</i>`
        : `<b>${esc(r.label)}</b><i>${r.w}×${r.h}${r.note ? ' · ' + esc(r.note) : ''}</i>`;
      return `<div class="sys-rg ${esc(r.tone || '')}" style="${st}" title="${esc(tip)}">${inner}</div>`;
    }).join('');
    return `<div class="sys-canvas" style="aspect-ratio:${W}/${H}">${rg}</div>`;
  }
  function renderLayout() {
    let h = `<p class="sys-intro">新页面先从这里挑一个<b>版面骨架</b>，再挑容器宽度。骨架按 ${'1440×900'} 视口等比画出，数字是真实像素。</p>`;
    const Ls = J.layouts || [];
    h += `<h2 class="sys-h2">版面骨架<small>${Ls.length} 种</small></h2>`;
    if (!Ls.length) h += '<p class="sys-sub">还没有登记版面骨架。由 Agent 按 DESIGN.md 与代码写进 json 的 layouts 字段。</p>';
    h += '<div class="sys-shells">';
    Ls.forEach(L => {
      const id = 'layout:' + L.id;
      h += `<div class="sys-shell sys-item ${S.sel === id ? 'sel' : ''}" ${reg(id, 'layout', L.label, L)}><h4>${esc(L.label)}${badge(id)}</h4><p>${esc(L.desc || '')}</p>${shellHtml(L)}</div>`;
    });
    h += '</div>';
    const mw = J.containers || [];
    h += `<h2 class="sys-h2">容器最大宽度<small>${mw.length} 种 · max-w-[Npx]</small></h2><p class="sys-sub">条长按 1440 视口比例。只出现一两次的通常是某个弹层或卡片自己的宽度，不一定要归并。</p>`;
    mw.forEach(x => {
      const id = 'mw:' + x.v;
      h += `<div class="sys-wbar sys-item ${S.sel === id ? 'sel' : ''}" ${reg(id, 'container', 'max-w ' + x.v + 'px', x)}><div class="v">${x.v}</div><div><div class="bar" style="width:${Math.min(100, x.v / 1440 * 100)}%"></div></div><div class="f">${x.n} 处 · ${esc(x.files[0] || '')}${badge(id)}</div></div>`;
    });
    const gr = J.grids || [];
    h += `<h2 class="sys-h2">网格模板<small>${gr.length} 种 · grid-cols-[…]</small></h2><div class="sys-ladder">`;
    gr.forEach(x => {
      const id = 'grid:' + x.v;
      h += `<div class="sys-wbar sys-item ${S.sel === id ? 'sel' : ''}" ${reg(id, 'grid', x.v, x)} style="grid-template-columns:1fr 60px 240px"><div class="sys-mono">${esc(x.v)}${badge(id)}</div><div class="sys-mono">${x.n} 处</div><div class="f">${esc(x.files[0] || '')}</div></div>`;
    });
    return h + '</div>';
  }

  function renderDebt() {
    const hx = J.hardcoded_colors || [];
    let h = `<p class="sys-intro">绕过零件库直接写死的值。不用一次清完，但<b>新代码不应再增加</b>。和站点色同值的最好改：直接换成变量即可，外观不变。</p>
      <h2 class="sys-h2">写死的颜色<small>${hx.length} 种 · ${sum(hx.map(x => x.uses))} 处</small></h2><p class="sys-sub">按出现次数排序。</p>`;
    hx.forEach(x => {
      const id = 'hex:' + x.value;
      h += `<div class="sys-debt sys-item ${S.sel === id ? 'sel' : ''}" ${reg(id, 'hex', x.value, x)}><i style="background:${esc(x.value)}"></i><span class="sys-mono">${esc(x.value)}</span><span class="sys-mono">${x.uses} 处</span><span>${x.same_as ? `与 <b class="sys-mono">${esc(x.same_as)}</b> 同值，应改用变量 · ` : ''}<span class="sys-muted sys-mono" style="font-size:11px">${esc(x.files.join('  '))}</span>${badge(id)}</span></div>`;
    });
    const un = J.buttons.unstyled || [];
    h += `<h2 class="sys-h2">没写样式的按钮<small>${un.length} 个</small></h2><p class="sys-sub">通常是样式写在父元素或别的组件里，抽取看不到长相，需要人工确认。</p><ul class="sys-files">`;
    un.forEach(u => { h += `<li>${codeLink(u.file + ':' + u.line)}</li>`; });
    h += '</ul>';
    const tz = (J.tw_colors || []).filter(c => !c.uses);
    if (tz.length) h += `<h2 class="sys-h2">没人用的 Tailwind 固定色<small>${tz.length} 个</small></h2><p class="sys-sub sys-mono">${esc(tz.map(c => c.id).join('  '))}</p>`;
    return h;
  }

  function renderFeedback() {
    let h = `<p class="sys-intro">对零件库整体的意见写这里，一行一条。针对某个零件的意见，点那个零件，在右侧「备注」里写。</p>
      <div class="sys-fb"><textarea id="sys-fbt" placeholder="比如：描边按钮圆角 4 和 8 混用，统一成 4"></textarea><button class="sys-btn sys-primary" id="sys-fba" type="button">添加</button></div><div class="sys-fbl">`;
    (J.feedback || []).slice().reverse().forEach((f, ri) => {
      const i = J.feedback.length - 1 - ri;
      h += `<div><small>${esc((f.at || '').slice(5, 16).replace('T', ' '))}</small><span>${esc(f.t)}</span><button data-fbdel="${i}" title="删除">×</button></div>`;
    });
    const notes = Object.entries(J.decisions).filter(([, d]) => d.note);
    if (notes.length) {
      h += `<h2 class="sys-h2">零件上的备注<small>${notes.length} 条</small></h2>`;
      notes.forEach(([k, d]) => { h += `<div class="sys-item" data-sid="${esc(k)}"><small>${esc(k)}</small><span>${esc(d.note)}</span></div>`; });
    }
    return h + '</div>';
  }

  // ---------- 抽屉 ----------
  function decisionHtml(id, kind) {
    const d = dec(id);
    const pills = PILLS[kind === 'button' ? 'button' : 'other'];
    let h = `<div class="sec"><b>结论</b><div class="sys-pills">${pills.map(([k, l]) => `<button type="button" data-r="${k}" class="${d.r === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    if (d.r === 'merge') {
      const cands = mergeCandidates(id, kind);
      h += `<div class="row" style="margin-top:10px"><label>归并到</label><input type="text" id="sys-to" list="sys-tol" value="${esc(d.to || '')}" placeholder="${cands.length ? '选一个或直接写' : '写目标'}" style="flex:1"><datalist id="sys-tol">${cands.map(c => `<option value="${esc(c[0])}">${esc(c[1])}</option>`).join('')}</datalist></div>`;
    }
    h += `</div><div class="sec"><b>备注</b><textarea id="sys-note" placeholder="为什么这么定，或者你想怎么改">${esc(d.note || '')}</textarea></div>`;
    return h;
  }
  function mergeCandidates(id, kind) {
    if (kind === 'button') {
      const f = ITEMS[id].data.fam;
      return f.variants.filter(v => v.id !== id && dec(v.id).r === 'std').map(v => [v.id, '标准：' + (v.label || '') + ' ' + v.cls.slice(0, 40)])
        .concat(f.variants.filter(v => v.id !== id && dec(v.id).r !== 'std').slice(0, 8).map(v => [v.id, `${v.count} 次 · ${v.label || ''}`]));
    }
    if (kind === 'scale') { const k = ITEMS[id].data.kind; return (J.scales[k] || []).filter(x => x.n > RARE).map(x => [String(x.v), `${x.n} 次`]); }
    if (kind === 'color' || kind === 'hex' || kind === 'tw') return J.colors.filter(c => c.uses > 0).map(c => [c.id, (c.light || '')]);
    if (kind === 'container') return (J.containers || []).filter(x => x.n > RARE).map(x => [String(x.v), `${x.n} 处`]);
    return [];
  }
  function usesHtml(files, title) {
    if (!files || !files.length) return `<div class="sec"><b>${title || '用到的地方'}</b><span class="sys-muted" style="font-size:12px">没有</span></div>`;
    return `<div class="sec"><b>${title || '用到的地方'}</b><ul class="sys-files">${files.slice(0, 40).map(f => `<li>${codeLink(f)}</li>`).join('')}${files.length > 40 ? `<li class="sys-muted">…还有 ${files.length - 40} 处</li>` : ''}</ul></div>`;
  }
  function openDrawer(id, keep) {
    const it = ITEMS[id]; if (!it) return;
    S.sel = id;
    const dr = $('#sys-drawer'); dr.hidden = false;
    const scroll = keep ? dr.scrollTop : 0;
    const x = it.data; let body = '';
    if (it.kind === 'color') {
      const e = edit(id) || {};
      const lv = resolve(x.name, 'light', x.scope), dv = resolve(x.name, 'dark', x.scope);
      const bgL = resolve('--background', 'light', 'root'), bgD = resolve('--background', 'dark', 'root');
      const hex = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : null;
      const ctl = (mode, base) => {
        const cur = e[mode] || base;
        const h6 = hex(cur);
        return `<div class="row"><label>${mode === 'light' ? '亮色' : '暗色'}</label>${h6 ? `<input type="color" data-cm="${mode}" value="${h6}">` : ''}<input type="text" data-ct="${mode}" value="${esc(cur || '')}" style="flex:1">${e[mode] ? `<button class="reset" data-cr="${mode}">还原</button>` : ''}</div>`;
      };
      body = `<div class="sec"><b>色值</b>${ctl('light', x.light)}${ctl('dark', x.dark)}
        <div class="sys-muted" style="font-size:11.5px">改了立刻作用到整页。原值 ${esc(x.light || '—')} / ${esc(x.dark || '—')}，定义在第 ${x.line} 行${x.dark_line ? `、暗色第 ${x.dark_line} 行` : ''}。</div></div>
        <div class="sec"><b>对比度</b><div style="font-size:12.5px">${x.family === 'surface'
          ? `正文墨色放在它上面：亮色 ${contrast(resolve('--foreground', 'light', 'root'), lv).toFixed(1)} · 暗色 ${contrast(resolve('--foreground', 'dark', 'root'), dv).toFixed(1)}；弱墨色：亮色 ${contrast(resolve('--muted-foreground', 'light', 'root'), lv).toFixed(1)} · 暗色 ${contrast(resolve('--muted-foreground', 'dark', 'root'), dv).toFixed(1)}`
          : `放在页面底色上：亮色 ${contrast(lv, bgL).toFixed(1)} · 暗色 ${contrast(dv, bgD).toFixed(1)}`}<br><span class="sys-muted" style="font-size:11.5px">正文至少 4.5，大字和图标至少 3。</span></div></div>
        ${x.note ? `<div class="sec"><b>代码注释</b><div style="font-size:12.5px">${esc(x.note)}</div></div>` : ''}
        <div class="sec"><b>使用</b><div style="font-size:12.5px">var() 引用 ${x.uses_var} 次${x.tw_class ? ` · Tailwind 类名 ${x.uses_tw} 次` : ''}</div></div>
        ${usesHtml(x.files, `用得最多的文件（共 ${x.files_n || x.files.length} 个）`)}`;
    } else if (it.kind === 'role') {
      const e = edit(id) || {};
      const num = (k, v, step) => `<div class="row"><label>${{ size: '字号', lh: '行高', weight: '字重' }[k]}</label><input type="number" data-rk="${k}" step="${step}" value="${e[k] || v || ''}">${e[k] ? `<button class="reset" data-rr="${k}">还原 ${v}</button>` : ''}</div>`;
      body = `<div class="sec"><b>样张</b><div class="sys-preview"><div class="${esc(x.id)}">${x.size >= 18 ? 'OpenAI 发布 GPT-6，推理成本降低 60%' : SAMPLE_CN}</div></div></div>
        <div class="sec"><b>四元组</b>${num('size', x.size, 1)}${num('lh', x.lh, 0.01)}${num('weight', x.weight, 100)}
        <div class="sys-muted" style="font-size:11.5px">字体 font-${esc(x.family)}，颜色 ${esc(x.color || '继承')}。定义在第 ${x.line} 行。</div></div>
        ${x.note ? `<div class="sec"><b>代码注释</b><div style="font-size:12.5px">${esc(x.note)}</div></div>` : ''}`;
    } else if (it.kind === 'button') {
      body = `<div class="sec"><b>四种状态</b><div class="sys-preview">${btn(x.cls, btnLabel(x.fam, x))}${btn(x.cls_hover, btnLabel(x.fam, x))}${btn(x.cls, btnLabel(x.fam, x), 'disabled')}</div>
        <div class="sys-preview dark" style="margin-top:6px;background:var(--background)">${btn(x.cls, btnLabel(x.fam, x))}${btn(x.cls_hover, btnLabel(x.fam, x))}</div></div>
        <div class="sec"><b>长相（只取影响外观的类）</b><pre class="sys-code">${esc(x.sig)}</pre></div>
        <div class="sec"><b>渲染用的完整类名${x.dynamic ? '（动态拼接，近似）' : ''}</b><pre class="sys-code">${esc(x.cls)}</pre></div>
        ${usesHtml(x.where, `出现 ${x.count} 次`)}`;
    } else if (it.kind === 'scale') {
      body = `<div class="sec"><b>用量</b><div style="font-size:12.5px">${x.n} 次${x.n <= RARE ? '，少用，通常可归并到相邻常用档' : ''}</div></div>`;
    } else if (it.kind === 'font') {
      body = `<div class="sec"><b>字体栈</b><pre class="sys-code">${esc(x.stack.join(', '))}</pre></div><div class="sec"><b>使用</b><div style="font-size:12.5px">font-${esc(x.id)} 类名 ${x.uses} 次</div></div>`;
    } else if (it.kind === 'layout') {
      body = `<div class="sec"><b>骨架</b>${shellHtml(x)}</div>${x.source ? `<div class="sec"><b>依据</b><div style="font-size:12.5px">${esc(x.source)}</div></div>` : ''}
        <div class="sec"><b>区域</b><ul class="sys-files">${(x.regions || []).map(r => `<li>${esc(r.label)} · ${r.w}×${r.h}${r.note ? ' · ' + esc(r.note) : ''}</li>`).join('')}</ul></div>${usesHtml(x.impl, '实现文件')}`;
    } else if (it.kind === 'container' || it.kind === 'grid') {
      body = `<div class="sec"><b>用量</b><div style="font-size:12.5px">${x.n} 处</div></div>${usesHtml(x.files, '文件')}`;
    } else if (it.kind === 'hex') {
      body = `<div class="sec"><b>色块</b><div style="height:48px;border-radius:4px;background:${esc(x.value)};border:1px solid var(--border)"></div></div>
        <div class="sec"><b>建议</b><div style="font-size:12.5px">${x.same_as ? `与 ${esc(x.same_as)} 同值，直接换成变量，外观不变。` : '没有同值的站点色。要么归并到最接近的站点色，要么确认它该成为新变量。'}</div></div>${usesHtml(x.files, '文件')}`;
    } else if (it.kind === 'tw') {
      body = `<div class="sec"><b>色值</b><div style="font-size:12.5px">${esc(x.value)} · 类名引用 ${x.uses} 次 · 暗色不切换</div></div>`;
    } else if (it.kind === 'var') {
      body = `<div class="sec"><b>值</b><pre class="sys-code">${esc(x.light || '')}${x.dark ? '\n暗色：' + esc(x.dark) : ''}</pre></div>${x.note ? `<div class="sec"><b>代码注释</b><div style="font-size:12.5px">${esc(x.note)}</div></div>` : ''}${usesHtml(x.files, '用得最多的文件')}`;
    }
    dr.innerHTML = `<button class="x" type="button" title="关闭">×</button><h3>${esc(it.title)}</h3><div class="sys-muted sys-mono" style="font-size:11px">${esc(id)}</div>${body}${decisionHtml(id, it.kind)}`;
    dr.scrollTop = scroll;
    $$('.sys-item.sel').forEach(el => el.classList.remove('sel'));
    $$(`[data-sid="${CSS.escape(id)}"]`).forEach(el => el.classList.add('sel'));
  }
  function closeDrawer() { S.sel = null; $('#sys-drawer').hidden = true; $$('.sys-item.sel').forEach(el => el.classList.remove('sel')); }

  // ---------- 渲染与事件 ----------
  function renderTabs() {
    const cnt = {
      colors: J.colors.length, type: J.fonts.length + J.text_roles.length,
      scales: sum(Object.values(J.scales).map(a => a.length)),
      buttons: J.buttons.total, layout: (J.layouts || []).length, debt: (J.hardcoded_colors || []).length,
      feedback: (J.feedback || []).length
    };
    $('#sys-tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}<i>${cnt[k]}</i></button>`).join('');
  }
  function renderTab() {
    const fn = { colors: renderColors, type: renderType, scales: renderScales, buttons: renderButtons, layout: renderLayout, debt: renderDebt, feedback: renderFeedback }[S.tab];
    $('#sys-main').innerHTML = fn();
    renderTabs();
  }
  function saveUi() { localStorage.setItem(LS_UI, JSON.stringify({ tab: S.tab, dark: S.dark, open: S.open })); }
  function setMode() {
    document.documentElement.classList.toggle('dark', S.dark);
    $('#sys-mode').textContent = S.dark ? '切到亮色' : '切到暗色';
  }
  function toast(t) { const el = $('#sys-toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); }

  async function save() {
    const body = { kind: 'system', page: 'system', files: J.files, edits: J.edits, decisions: J.decisions, feedback: J.feedback, exported: new Date().toISOString().slice(0, 19) };
    try {
      const r = await fetch('/api/lab/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || r.status);
      SAVED = snapshot(); status();
      toast(`已保存 · 值改动 ${Object.keys(J.edits).length} · 结论 ${Object.keys(J.decisions).length} · 回对话说一声即可`);
    } catch (e) {
      // 没有服务时退回下载，文件名固定，Agent 去 ~/Downloads 取
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, J, body), null, 1)], { type: 'application/json' }));
      a.download = 'system.tokens.json'; a.click();
      toast('服务没连上，已下载 system.tokens.json：' + e.message);
    }
  }

  document.addEventListener('click', ev => {
    const t = ev.target;
    const tab = t.closest('[data-tab]');
    if (tab) { S.tab = tab.dataset.tab; saveUi(); renderTab(); $('#sys-main').scrollTop = 0; return; }
    if (t.closest('#sys-drawer .x')) { closeDrawer(); return; }
    const more = t.closest('[data-more]');
    if (more) { S.open[more.dataset.more] = !S.open[more.dataset.more]; saveUi(); renderTab(); return; }
    const r = t.closest('#sys-drawer [data-r]');
    if (r) { const cur = dec(S.sel).r; setDec(S.sel, { r: cur === r.dataset.r ? '' : r.dataset.r, to: r.dataset.r === 'merge' ? dec(S.sel).to : '' }); return; }
    const cr = t.closest('[data-cr]');
    if (cr) { setEdit(S.sel, { [cr.dataset.cr]: '' }); return; }
    const rr = t.closest('[data-rr]');
    if (rr) { setEdit(S.sel, { [rr.dataset.rr]: '' }); return; }
    if (t.id === 'sys-fba') {
      const v = $('#sys-fbt').value.trim(); if (!v) return;
      v.split('\n').map(s => s.trim()).filter(Boolean).forEach(line => J.feedback.push({ t: line, at: new Date().toISOString().slice(0, 16) }));
      status(); renderTab(); return;
    }
    const del = t.closest('[data-fbdel]');
    if (del) { J.feedback.splice(+del.dataset.fbdel, 1); status(); renderTab(); return; }
    if (t.closest('a')) return;
    const it = t.closest('#sys-main [data-sid]');
    if (it) { openDrawer(it.dataset.sid); return; }
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.matches('[data-ct]')) { const it = ITEMS[S.sel]; const base = it.data[t.dataset.ct]; setEdit(S.sel, { [t.dataset.ct]: t.value.trim() === base ? '' : t.value.trim() }); }
    else if (t.matches('[data-rk]')) { const base = ITEMS[S.sel].data[t.dataset.rk]; const v = Number(t.value); setEdit(S.sel, { [t.dataset.rk]: v === base ? '' : v }); }
    else if (t.id === 'sys-note') setDec(S.sel, { note: t.value.trim() });
    else if (t.id === 'sys-to') setDec(S.sel, { to: t.value.trim() });
  });
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.matches('[data-cm]')) {   // 拖色盘时只改预览，松手（change）才记
      const c = ITEMS[S.sel].data, mode = t.dataset.cm;
      const sc = c.scope === 'root' ? '' : ' ' + c.scope;
      const sel = mode === 'light' ? `:root:not(.dark)${sc}` : `:root.dark${sc},.dark${sc}`;
      $('#sys-edits').textContent += `\n${sel}{${c.name}:${t.value}}`;
    }
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.matches('[data-cm]')) { const base = ITEMS[S.sel].data[t.dataset.cm]; setEdit(S.sel, { [t.dataset.cm]: t.value.toLowerCase() === String(base).toLowerCase() ? '' : t.value.toUpperCase() }); }
  }, true);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeDrawer(); if ((ev.metaKey || ev.ctrlKey) && ev.key === 's') { ev.preventDefault(); save(); } });
  window.addEventListener('beforeunload', ev => { if (dirty()) { ev.preventDefault(); ev.returnValue = ''; } });
  $('#sys-save').addEventListener('click', save);
  $('#sys-mode').addEventListener('click', () => { S.dark = !S.dark; saveUi(); setMode(); renderTab(); });

  async function boot() {
    try {
      const r = await fetch('system.tokens.json', { cache: 'no-store' });
      J = await r.json();
    } catch (e) {
      $('#sys-main').innerHTML = `<p style="padding:32px">读不到 system.tokens.json。请用工作台服务打开：<code>python3 ~/.claude/skills/forge-design-lab/scripts/serve.py &lt;仓库&gt;</code></p>`;
      return;
    }
    ['edits', 'decisions'].forEach(k => { J[k] = J[k] || {}; });
    J.feedback = J.feedback || [];
    SAVED = snapshot();
    colorTable();
    try { const st = await (await fetch('/api/lab/status')).json(); REPO = st.repo || ''; } catch (e) { /* file:// 模式 */ }
    $('#sys-repo').textContent = (J.repoName || '') + ' · 抽取于 ' + (J.extracted || '').replace('T', ' ').slice(0, 16);
    setMode(); applyEdits(); renderTab(); status();
  }
  boot();
})();
