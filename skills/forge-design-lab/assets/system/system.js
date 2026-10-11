/* forge-design-lab · 设计零件库页面（模板 + 定制 + 对账）。
   数据：同目录 system.tokens.json。
   - template：唯一的一套模板零件。用户在这里改值，页面即时用 template-css.js 生成样式。
   - custom：登记过的定制。每条有名字、为什么、用在哪、状态（待确认 / 已确认 / 不需要）。
   - 其余字段是 extract_system.py 从代码抽出的现状，只用于「对账」分区算覆盖率，不让用户逐个裁决。
   保存：POST /api/lab/save（kind=system），带 template、custom、feedback 与生成好的 template_css。 */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const sum = a => a.reduce((x, y) => x + y, 0);
  const TABS = [['colors', '颜色'], ['type', '文字'], ['space', '间距与圆角'], ['buttons', '按钮'], ['layout', '版面'], ['custom', '定制'], ['audit', '对账'], ['feedback', '反馈']];
  const WEIGHTS = [300, 400, 500, 600, 700];
  const STATUS = [['已确认', '已确认'], ['待确认', '待确认'], ['不需要', '不需要，并回模板']];
  const LS_UI = 'sys:ui2';
  const SAMPLE = { title: 'OpenAI 发布 GPT-6，推理成本降低 60%', body: '今天值得看的 AI 要点：Claude 发布新模型，GitHub Copilot 更新 Agent 模式。' };

  let J = null, T = null, BASE = null, REPO = '', SAVED = '', REV = null;
  const S = Object.assign({ tab: 'colors', dark: false }, (() => { try { return JSON.parse(localStorage.getItem(LS_UI) || '{}'); } catch (e) { return {}; } })());

  // ---------- 状态 ----------
  function snapshot() { return JSON.stringify({ t: J.template, c: J.custom, f: J.feedback }); }
  function dirty() { return J && snapshot() !== SAVED; }
  function status() { $('#sys-dirty').textContent = dirty() ? '有未保存改动' : ''; }
  function regen() { $('#sys-edits').textContent = window.TemplateCSS.build(T); }
  function changed() { regen(); status(); const y = $('#sys-main').scrollTop; render(); $('#sys-main').scrollTop = y; }
  function isMod(path) {   // 与上次保存比，标「已改」
    const get = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
    return JSON.stringify(get(T, path)) !== JSON.stringify(get(BASE, path));
  }
  const mod = path => isMod(path) ? '<span class="sys-badge edit">已改</span>' : '';
  const colorNames = () => T.colors.map(c => c.name);

  // ---------- 控件 ----------
  function sel(path, value, opts, extra) {
    return `<select data-p="${path}" ${extra || ''}>${opts.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(k)}" ${String(k) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  }
  function num(path, value, step, w) { return `<input type="number" data-p="${path}" data-num="1" step="${step || 1}" value="${esc(value)}" style="width:${w || 64}px">`; }
  function colorSel(path, value, allowNone) { return sel(path, value || '', (allowNone ? [['', '无']] : []).concat(colorNames().map(n => [n, n]))); }

  // ---------- 颜色 ----------
  function renderColors() {
    const groups = [...new Set(T.colors.map(c => c.group))];
    let h = `<p class="sys-intro">这是全站<b>唯一的一套颜色</b>，${T.colors.length} 个，每个都有固定用途。新设计只从这里选色。左半块亮色、右半块暗色，点色块直接改，整页即时生效。</p>`;
    groups.forEach(g => {
      const cs = T.colors.filter(c => c.group === g);
      h += `<h2 class="sys-h2">${esc(g)}</h2><div class="sys-tcolors">`;
      cs.forEach(c => {
        const i = T.colors.indexOf(c);
        h += `<div class="sys-tcolor"><div class="sw">
            <label style="background:${esc(c.light)}"><input type="color" data-p="colors.${i}.light" value="${esc(c.light)}"><em>亮 ${esc(c.light)}</em></label>
            <label style="background:${esc(c.dark)}"><input type="color" data-p="colors.${i}.dark" value="${esc(c.dark)}"><em>暗 ${esc(c.dark)}</em></label></div>
          <div class="meta"><div class="nm">${esc(c.name)}${mod(`colors.${i}`)}</div><div class="role">${esc(c.role)}</div><div class="from">${esc(c.from || '')}</div></div></div>`;
      });
      h += '</div>';
    });
    return h;
  }

  // ---------- 文字 ----------
  function renderType() {
    let h = `<p class="sys-intro">字体只有 <b>${T.fonts.length} 种</b>，文字样式只有 <b>${T.type.length} 种</b>。新模块写文字时套用某个样式，不再单独写字号。每个样式可以直接改，样张即时变。</p><h2 class="sys-h2">字体</h2>`;
    T.fonts.forEach((f, i) => {
      h += `<div class="sys-font"><div class="k">${esc(f.label)} <span class="sys-mono">font-${esc(f.id)}</span>${mod(`fonts.${i}`)}<small>${esc(f.use)}</small></div>
        <div class="s" style="font-family:var(--t-font-${esc(f.id)})">info2act 每日 AI 要点 · The quick brown fox 0123456789<small>${esc(f.stack.join(', '))} · ${esc(f.from || '')}</small></div></div>`;
    });
    h += `<h2 class="sys-h2">文字样式<small>类名 .t-样式名</small></h2><p class="sys-sub">字号只能取字号阶梯里的值：${T.sizes.join(' / ')}。</p>`;
    T.type.forEach((t, i) => {
      const P = `type.${i}`;
      h += `<div class="sys-trow"><div class="k"><b>${esc(t.label)}</b> <span class="sys-mono">.t-${esc(t.id)}</span>${mod(P)}<small>${esc(t.use)}</small>
          <div class="ctl">${sel(P + '.font', t.font, T.fonts.map(f => [f.id, f.label]))}${sel(P + '.size', t.size, T.sizes.map(s => [s, s + 'px']))}${num(P + '.lh', t.lh, 0.01, 60)}${sel(P + '.weight', t.weight, WEIGHTS)}${colorSel(P + '.color', t.color)}</div></div>
        <div class="smp t-${esc(t.id)}">${t.size >= 18 ? SAMPLE.title : SAMPLE.body}</div></div>`;
    });
    h += `<h2 class="sys-h2">字号阶梯${mod('sizes')}</h2><div class="sys-row">${listEdit('sizes', T.sizes)}</div>`;
    return h;
  }
  function listEdit(path, arr) { return `<input type="text" data-p="${path}" data-list="1" value="${esc(arr.join(', '))}" class="sys-listin"><span class="sys-muted" style="font-size:12px">逗号分隔，改完回车</span>`; }

  // ---------- 间距与圆角 ----------
  function renderSpace() {
    let h = `<p class="sys-intro">间距 <b>${T.space.length} 档</b>，圆角 <b>${T.radius.length} 种</b>，容器宽度 <b>${T.containers.length} 种</b>。内边距、间隔、外边距都从这几档里取。</p>`;
    h += `<h2 class="sys-h2">间距${mod('space')}</h2><div class="sys-ladder">`;
    T.space.forEach((s, i) => { h += `<div class="sys-step"><div class="v">${Number(s)}</div><div><div class="bar" style="width:${Number(s) * 4}px"></div></div><div class="n sys-mono">--t-space-${i + 1}</div></div>`; });
    h += `</div><div class="sys-row">${listEdit('space', T.space)}</div><h2 class="sys-h2">圆角</h2><div class="sys-radii">`;
    T.radius.forEach((r, i) => { h += `<div class="sys-radius"><div class="box" style="border-radius:${Math.min(Number(r.v) || 0, 999)}px"></div><div><b class="sys-mono">${esc(r.id)}</b> ${num(`radius.${i}.v`, r.v, 1, 60)}${mod(`radius.${i}`)}<small>${esc(r.use)}</small></div></div>`; });
    h += `</div><h2 class="sys-h2">容器宽度</h2><p class="sys-sub">条长按 1440 视口比例。</p>`;
    T.containers.forEach((c, i) => { h += `<div class="sys-wbar"><div class="v">${Number(c.v)}</div><div><div class="bar" style="width:${Number(c.v) / 1440 * 100}%"></div></div><div class="f"><b class="sys-mono">${esc(c.id)}</b> ${num(`containers.${i}.v`, c.v, 8, 72)} ${esc(c.use)}${mod(`containers.${i}`)}</div></div>`; });
    return h;
  }

  // ---------- 按钮 ----------
  function btnHtml(b, extra, label) { return `<button type="button" tabindex="-1" class="t-btn t-btn-${esc(b.id)} ${extra || ''}" ${extra === 'dis' ? 'disabled' : ''}>${esc(label || (b.id === 'icon' ? '✕' : b.label))}</button>`; }
  function renderButtons() {
    const HL = window.TemplateCSS.HOVER_LABEL;
    let h = `<p class="sys-intro">按钮只有 <b>${T.buttons.length} 种</b>。每种按钮由模板里的颜色、字号、圆角组合而成，下拉框里也只能选模板里有的值。改模板颜色，所有按钮一起变。</p>
      <table class="sys-btable"><thead><tr><th>按钮</th><th>默认</th><th>悬停</th><th>键盘聚焦</th><th>禁用</th><th>暗色</th></tr></thead><tbody>`;
    T.buttons.forEach((b, i) => {
      const P = `buttons.${i}`;
      h += `<tr><td style="width:300px"><b>${esc(b.label)}</b> <span class="sys-mono">.t-btn-${esc(b.id)}</span>${mod(P)}<div class="sys-muted" style="font-size:12px">${esc(b.use)}</div>
          <div class="ctl2">
            <label>高${num(P + '.h', b.h, 4, 52)}</label><label>左右内距${num(P + '.px', b.px, 2, 52)}</label>
            <label>字号${sel(P + '.size', b.size, T.sizes.map(s => [s, s + 'px']))}</label><label>字重${sel(P + '.weight', b.weight, WEIGHTS)}</label>
            <label>圆角${sel(P + '.radius', b.radius, T.radius.map(r => [r.id, r.id + ' ' + r.v]))}</label>
            <label>底色${colorSel(P + '.bg', b.bg, 1)}</label><label>文字${colorSel(P + '.fg', b.fg)}</label>
            <label>边框${colorSel(P + '.border', b.border, 1)}</label><label>悬停${sel(P + '.hover', b.hover, Object.entries(HL))}</label></div></td>
        <td>${btnHtml(b)}</td><td>${btnHtml(b, 'is-hover')}</td><td>${btnHtml(b, 'is-focus')}</td><td>${btnHtml(b, 'dis')}</td><td><div class="sys-dk dark">${btnHtml(b)}</div></td></tr>`;
    });
    h += `</tbody></table><h2 class="sys-h2">组合示例</h2><p class="sys-sub">一个典型操作区：一个主按钮，配次按钮和幽灵按钮。</p>
      <div class="sys-preview" style="background:var(--card)">${T.buttons.filter(b => ['primary', 'secondary', 'ghost'].includes(b.id)).reverse().map(b => btnHtml(b, '', { primary: '保存', secondary: '预览', ghost: '取消' }[b.id])).join('')}</div>`;
    return h;
  }

  // ---------- 版面 ----------
  function shellHtml(L) {
    const W = L.vw || 1440, H = L.vh || 900;
    return `<div class="sys-canvas" style="aspect-ratio:${W}/${H}">${(L.regions || []).map(r => {
      r = Object.assign({}, r, { w: Number(r.w) || 0, h: Number(r.h) || 0 });
      const tip = `${r.label} · ${r.w}×${r.h}${r.note ? ' · ' + r.note : ''}`;
      const inner = r.h <= 60 ? `<b>${esc(r.label)} <i style="display:inline">${r.w}×${r.h}</i></b>` : r.w <= 96 ? `<b>${esc(r.label)}</b><i>${r.w}</i>` : `<b>${esc(r.label)}</b><i>${r.w}×${r.h}${r.note ? ' · ' + esc(r.note) : ''}</i>`;
      const n = v => Number(v) || 0;
      return `<div class="sys-rg ${esc(r.tone || '')}" style="left:${n(r.x) / W * 100}%;top:${n(r.y) / H * 100}%;width:${n(r.w) / W * 100}%;height:${n(r.h) / H * 100}%" title="${esc(tip)}">${inner}</div>`;
    }).join('')}</div>`;
  }
  function renderLayout() {
    const Ls = (T.layouts || []).map(id => (J.layouts || []).find(l => l.id === id)).filter(Boolean);
    let h = `<p class="sys-intro">新页面从这 <b>${Ls.length} 种骨架</b>里选一种。按 1440×900 视口等比画出，数字是真实像素。只有某个页面独有的结构（比如精选的日期目录）登记在「定制」里。</p><div class="sys-shells">`;
    Ls.forEach(L => { h += `<div class="sys-shell"><h4>${esc(L.label)}</h4><p>${esc(L.desc || '')}</p>${shellHtml(L)}</div>`; });
    return h + '</div>';
  }

  // ---------- 定制 ----------
  function renderCustom() {
    const n = k => J.custom.filter(c => c.status === k).length;
    let h = `<p class="sys-intro">模板满足不了的地方才做定制，每一条都写明为什么。<b>新增定制要你确认后才进清单</b>，所以这份清单就是全站全部的例外。下面是从现有代码里认出来的 ${J.custom.length} 条，请逐条看理由：认可选「已确认」；觉得没必要的选「不需要」，以后它并回模板。</p>
      <div class="sys-stat"><div><b>${n('已确认')}</b>已确认</div><div><b>${n('待确认')}</b>待确认</div><div><b>${n('不需要')}</b>不需要</div></div>`;
    J.custom.forEach((c, i) => {
      const L = c.layout && (J.layouts || []).find(l => l.id === c.layout);
      h += `<div class="sys-cust ${c.status === '不需要' ? 'off' : ''}"><div class="hd"><b>${esc(c.name)}</b><span class="sys-badge ${c.status === '已确认' ? 'std' : c.status === '不需要' ? 'drop' : 'unsure'}">${esc(c.status)}</span></div>
        <div class="why">${esc(c.why)}</div>
        <div class="meta">用在：${esc(c.where)} · 基于模板：${esc(c.based_on)} · 包含：<span class="sys-mono">${esc(c.tokens.join('  '))}</span></div>
        ${L ? `<div style="max-width:520px;margin-top:8px">${shellHtml(L)}</div>` : ''}
        <div class="sys-pills" style="margin-top:8px">${STATUS.map(([k, l]) => `<button type="button" data-cs="${i}" data-v="${k}" class="${c.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <input type="text" class="sys-note" data-cn="${i}" value="${esc(c.note || '')}" placeholder="备注（可选）"></div>`;
    });
    return h;
  }

  // ---------- 对账：现有代码落在哪一层 ----------
  function classify(id) {
    if (T.colors.some(c => c.name === id)) return 'tpl';
    if ((T.aliases || {})[id]) return 'alias';
    const name = id.split(' ').pop();
    if (J.custom.some(c => c.status !== '不需要' && c.tokens.some(t => name.startsWith(t) || id.startsWith(t)))) return 'custom';
    return 'legacy';
  }
  function cover(arr, ok) { const tot = sum(arr.map(x => x.n)); const hit = sum(arr.filter(x => ok(x.v)).map(x => x.n)); return { tot, hit, pct: tot ? Math.round(hit / tot * 100) : 100, off: arr.filter(x => !ok(x.v)) }; }
  function renderAudit() {
    const byK = { tpl: [], alias: [], custom: [], legacy: [] };
    J.colors.forEach(c => byK[classify(c.id)].push(c));
    const useOf = k => sum(byK[k].map(c => c.uses));
    const allUse = sum(J.colors.map(c => c.uses)) || 1;
    const colorPct = Math.round((useOf('tpl') + useOf('alias') + useOf('custom')) / allUse * 100);
    const fs = cover(J.scales.px || [], v => T.sizes.includes(v));
    const sp = cover(J.scales.space || [], v => v === 0 || T.space.includes(v));
    const rd = cover(J.scales.radius || [], v => T.radius.some(r => r.v === v) || v >= 999);
    const hex = J.hardcoded_colors || [];
    let h = `<p class="sys-intro">这一页只回答一个问题：<b>现有代码有多少已经落在模板或定制上</b>。剩下的是历史遗留，冻结处理：不要求马上改，但新代码不能再增加，由检查脚本把关。这里不需要你逐个判断。</p>
      <div class="sys-stat"><div><b>${colorPct}%</b>颜色用量落在模板/定制</div><div><b>${fs.pct}%</b>字号用量落在阶梯</div><div><b>${sp.pct}%</b>间距用量落在阶梯</div><div><b>${rd.pct}%</b>圆角用量落在模板</div><div><b>${J.buttons.total}</b>个按钮尚未接入模板按钮</div></div>
      <table class="sys-audit"><tbody>
      <tr><td>颜色变量</td><td>模板 ${byK.tpl.length} · 别名 ${byK.alias.length} · 定制 ${byK.custom.length} · <b>遗留 ${byK.legacy.length}</b></td><td class="sys-mono">${esc(byK.legacy.map(c => c.id).join('  ')) || '无'}</td></tr>
      <tr><td>写死的颜色</td><td><b>${hex.length} 种 · ${sum(hex.map(x => x.uses))} 处</b></td><td class="sys-muted">集中在 ${esc([...new Set(hex.flatMap(x => x.files))].slice(0, 3).map(f => f.split('/').pop()).join('、'))}</td></tr>
      <tr><td>模板外的字号</td><td><b>${fs.off.length} 档 · ${fs.tot - fs.hit} 处</b></td><td class="sys-mono">${esc(fs.off.map(x => x.v + '×' + x.n).join('  '))}</td></tr>
      <tr><td>模板外的间距</td><td><b>${sp.off.length} 档 · ${sp.tot - sp.hit} 处</b></td><td class="sys-mono">${esc(sp.off.map(x => x.v + '×' + x.n).join('  '))}</td></tr>
      <tr><td>模板外的圆角</td><td><b>${rd.off.length} 档 · ${rd.tot - rd.hit} 处</b></td><td class="sys-mono">${esc(rd.off.map(x => x.v + '×' + x.n).join('  '))}</td></tr>
      <tr><td>按钮写法</td><td><b>${sum(J.buttons.families.map(f => f.variants.length))} 种</b></td><td class="sys-muted">现有按钮还没用 .t-btn-*；新按钮必须用模板按钮</td></tr>
      </tbody></table>
      <p class="sys-sub" style="margin-top:16px">别名指的是名字不同、但值和用途就是模板某个颜色的变量，比如 --primary 就是 --brand。它们不算遗留。</p>`;
    return h;
  }

  // ---------- 反馈 ----------
  function renderFeedback() {
    let h = `<p class="sys-intro">对模板的意见写这里，一行一条。比如「主按钮圆角太小」「正文行高再松一点」。</p>
      <div class="sys-fb"><textarea id="sys-fbt" placeholder="一行一条"></textarea><button class="sys-btn sys-primary" id="sys-fba" type="button">添加</button></div><div class="sys-fbl">`;
    J.feedback.slice().reverse().forEach((f, ri) => { const i = J.feedback.length - 1 - ri; h += `<div><small>${esc((f.at || '').slice(5, 16).replace('T', ' '))}</small><span>${esc(f.t)}</span><button data-fbdel="${i}" title="删除">×</button></div>`; });
    return h + '</div>';
  }

  // ---------- 渲染与事件 ----------
  function render() {
    const cnt = { colors: T.colors.length, type: T.type.length, space: T.space.length + T.radius.length, buttons: T.buttons.length, layout: (T.layouts || []).length, custom: J.custom.length, audit: '', feedback: J.feedback.length };
    $('#sys-tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}<i>${cnt[k]}</i></button>`).join('');
    $('#sys-main').innerHTML = ({ colors: renderColors, type: renderType, space: renderSpace, buttons: renderButtons, layout: renderLayout, custom: renderCustom, audit: renderAudit, feedback: renderFeedback }[S.tab] || renderColors)();
  }
  function setPath(path, val) {
    const ks = path.split('.'); let o = T;
    ks.slice(0, -1).forEach(k => { o = o[k]; });
    o[ks[ks.length - 1]] = val;
  }
  function saveUi() { localStorage.setItem(LS_UI, JSON.stringify({ tab: S.tab, dark: S.dark })); }
  function setMode() { document.documentElement.classList.toggle('dark', S.dark); $('#sys-mode').textContent = S.dark ? '切到亮色' : '切到暗色'; }
  function toast(t) { const el = $('#sys-toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); }

  async function save() {
    // 只送用户产出；rev 让服务端发现「页面打开期间文件被改过」并拒绝覆盖
    const body = { kind: 'system', page: 'system', rev: REV, template: T, custom: J.custom, feedback: J.feedback,
      template_css: window.TemplateCSS.build(T), exported: new Date().toISOString().slice(0, 19) };
    try {
      const r = await fetch('/api/lab/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (!j.ok) throw new Error(j.error || r.status);
      if (j.rev) REV = j.rev;
      if (j.warnings && j.warnings.length) console.warn('保存附加步骤：', j.warnings);
      SAVED = snapshot(); BASE = clone(T); status(); render();
      toast('已保存 · 回对话说一声即可');
    } catch (e) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, J, body), null, 1)], { type: 'application/json' }));
      a.download = 'system.tokens.json'; a.click();
      toast((String(e.message).includes('被改过') ? '' : '保存没成功，') + e.message + '（改动已下载为 system.tokens.json）');
    }
  }

  document.addEventListener('click', ev => {
    const t = ev.target;
    const tab = t.closest('[data-tab]');
    if (tab) { S.tab = tab.dataset.tab; saveUi(); render(); $('#sys-main').scrollTop = 0; return; }
    const cs = t.closest('[data-cs]');
    if (cs) { J.custom[+cs.dataset.cs].status = cs.dataset.v; changed(); return; }
    if (t.id === 'sys-fba') {
      const v = $('#sys-fbt').value.trim(); if (!v) return;
      v.split('\n').map(s => s.trim()).filter(Boolean).forEach(line => J.feedback.push({ t: line, at: new Date().toISOString().slice(0, 16) }));
      changed(); return;
    }
    const del = t.closest('[data-fbdel]');
    if (del) { J.feedback.splice(+del.dataset.fbdel, 1); changed(); }
  });
  document.addEventListener('input', ev => {   // 拖色盘时实时预览，不重画整页
    const t = ev.target;
    if (t.matches('input[type=color][data-p]')) { setPath(t.dataset.p, t.value.toUpperCase()); regen(); t.parentElement.style.background = t.value; status(); }
  });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.matches('[data-p]')) {
      let v = t.value;
      if (t.dataset.list) { v = v.split(/[,，\s]+/).map(Number).filter(x => x > 0).sort((a, b) => a - b); if (!v.length) return; }
      else if (t.dataset.num || (t.tagName === 'SELECT' && /^\d+(\.\d+)?$/.test(v) && !/\.(bg|fg|border|color|font|radius|hover)$/.test(t.dataset.p))) v = Number(v);
      else if (t.type === 'color') v = v.toUpperCase();
      setPath(t.dataset.p, v); changed();
    } else if (t.matches('[data-cn]')) { J.custom[+t.dataset.cn].note = t.value.trim(); changed(); }
  });
  document.addEventListener('keydown', ev => { if ((ev.metaKey || ev.ctrlKey) && ev.key === 's') { ev.preventDefault(); save(); } });
  window.addEventListener('beforeunload', ev => { if (dirty()) { ev.preventDefault(); ev.returnValue = ''; } });
  $('#sys-save').addEventListener('click', save);
  $('#sys-mode').addEventListener('click', () => { S.dark = !S.dark; saveUi(); setMode(); });

  async function boot() {
    try { const r = await fetch('system.tokens.json', { cache: 'no-store' }); REV = r.headers.get('X-Lab-Rev'); J = await r.json(); }
    catch (e) { $('#sys-main').innerHTML = '<p style="padding:32px">读不到 system.tokens.json。请用工作台服务打开：python3 ~/.claude/skills/forge-design-lab/scripts/serve.py &lt;仓库&gt;</p>'; return; }
    if (!J.template || !J.template.colors) { $('#sys-main').innerHTML = '<p style="padding:32px">还没有模板。由 Agent 按 references/system-pack.md 从现有代码提炼初稿写进 template 字段。</p>'; return; }
    J.custom = J.custom || []; J.feedback = J.feedback || [];
    T = J.template; BASE = clone(T); SAVED = snapshot();
    try { REPO = (await (await fetch('/api/lab/status')).json()).repo || ''; } catch (e) { /* file:// */ }
    if (!REV) { try { REV = (await (await fetch('/api/lab/system-rev', { cache: 'no-store' })).json()).rev; } catch (e) { /* 旧服务 */ } }
    $('#sys-repo').textContent = `${J.repoName || ''} · 模板 ${T.version || ''}`;
    setMode(); regen(); render(); status();
  }
  boot();
})();
