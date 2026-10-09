/* forge-design-lab · 模板 → CSS 的唯一生成器。浏览器（零件库页面）和 node（build_template.js）共用。
   输入 system.tokens.json 的 template 段；输出 template.css：
   颜色变量（沿用产品现有变量名，亮暗两套）、--t-* 尺寸变量、.t-<文字样式> 类、.t-btn-<按钮> 类。
   .is-hover / .is-focus 让零件库能并排展示强制状态。 */
(function (root) {
  'use strict';
  const HOVER = {
    darken: 'background:color-mix(in srgb,var(--brand) 88%,#171512)',
    'border-brand': 'border-color:var(--brand-border);color:var(--foreground)',
    'soft-brand': 'background:var(--brand-soft)',
    'muted-bg': 'background:var(--muted);color:var(--foreground)',
    underline: 'text-decoration:underline;text-underline-offset:3px'
  };
  const HOVER_LABEL = { darken: '加深底色', 'border-brand': '描边变品牌色', 'soft-brand': '铺品牌浅底', 'muted-bg': '铺次级面底色', underline: '加下划线' };
  const v = n => n ? `var(${n})` : 'transparent';
  function fontStack(T, id) { const f = (T.fonts || []).find(x => x.id === id); return f ? f.stack.map(x => /\s/.test(x) ? `"${x}"` : x).join(',') : 'inherit'; }
  function radius(T, id) { const r = (T.radius || []).find(x => x.id === id); return r ? r.v : 4; }
  function build(T) {
    if (!T || !T.colors) return '';
    const L = [], D = [];
    T.colors.forEach(c => { if (c.light) L.push(`${c.name}:${c.light}`); if (c.dark) D.push(`${c.name}:${c.dark}`); });
    (T.fonts || []).forEach(f => L.push(`--t-font-${f.id}:${fontStack(T, f.id)}`));
    (T.space || []).forEach((s, i) => L.push(`--t-space-${i + 1}:${s}px`));
    (T.radius || []).forEach(r => L.push(`--t-radius-${r.id}:${r.v}px`));
    (T.containers || []).forEach(c => L.push(`--t-w-${c.id}:${c.v}px`));
    const out = [`/* 生成物：零件库模板 ${T.version || ''}，改 system.tokens.json 的 template 段后重新生成，勿手改 */`,
      `:root{${L.join(';')}}`, `.dark{${D.join(';')}}`];
    (T.type || []).forEach(t => out.push(`.t-${t.id}{font-family:var(--t-font-${t.font});font-size:${t.size}px;line-height:${t.lh};font-weight:${t.weight};color:${v(t.color)}}`));
    out.push('.t-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;border:1px solid transparent;font-family:var(--t-font-sans);line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}');
    out.push('.t-btn:focus-visible,.t-btn.is-focus{outline:2px solid var(--brand-border);outline-offset:2px}');
    out.push('.t-btn:disabled{opacity:.5;cursor:not-allowed}');
    (T.buttons || []).forEach(b => {
      const d = [`font-size:${b.size}px`, `font-weight:${b.weight}`, `border-radius:${radius(T, b.radius)}px`, `background:${v(b.bg)}`, `color:${v(b.fg)}`, `border-color:${v(b.border)}`];
      if (b.h) d.push(`height:${b.h}px`); else d.push('height:auto', 'border-width:0');
      d.push(b.px ? `padding:0 ${b.px}px` : 'padding:0');
      if (b.h && !b.px) d.push(`width:${b.h}px`);
      out.push(`.t-btn-${b.id}{${d.join(';')}}`);
      if (HOVER[b.hover]) out.push(`.t-btn-${b.id}:hover:not(:disabled),.t-btn-${b.id}.is-hover{${HOVER[b.hover]}}`);
    });
    return out.join('\n') + '\n';
  }
  const api = { build, HOVER_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TemplateCSS = api;
})(typeof window !== 'undefined' ? window : globalThis);
