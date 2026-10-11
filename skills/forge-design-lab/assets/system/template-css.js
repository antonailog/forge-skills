/* forge-design-lab · 模板 → CSS 的唯一生成器。浏览器（零件库页面）和 node（build_template.js）共用。
   输入 system.tokens.json 的 template 段；输出 template.css：
   颜色变量（沿用产品现有变量名，亮暗两套）、--t-* 尺寸变量、.t-<文字样式> 类、.t-btn-<按钮> 类。
   .is-hover / .is-focus 让零件库能并排展示强制状态。 */
(function (root) {
  'use strict';
  const HOVER = {
    darken: b => `background:color-mix(in srgb,var(${b.bg || '--brand'}) 88%,#171512)`,   // 按按钮自己的底色加深
    'border-brand': 'border-color:var(--brand-border);color:var(--foreground)',
    'soft-brand': 'background:var(--brand-soft)',
    'muted-bg': 'background:var(--muted);color:var(--foreground)',
    underline: 'text-decoration:underline;text-underline-offset:3px'
  };
  const HOVER_LABEL = { darken: '加深底色', 'border-brand': '描边变品牌色', 'soft-brand': '铺品牌浅底', 'muted-bg': '铺次级面底色', underline: '加下划线' };
  // 模板里的每个值进 CSS 前都要过一道：名字只留 [\w-]，数字转 Number，颜色必须长得像颜色，不像就丢弃。
  // 一个写坏的值（混进 ; { } 引号）不能写坏整份样式，也不能被悄悄改写成一个怪值。
  const id = x => String(x == null ? '' : x).replace(/[^\w-]/g, '');
  const cssVar = x => { const n = String(x || ''); return /^--[\w-]+$/.test(n) ? n : ''; };
  const num = x => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const COLOR_OK = /^(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch|oklab|color-mix)\([^;{}"'<>]*\)|var\(--[\w-]+\)|transparent|currentColor|white|black)$/;
  const color = x => (COLOR_OK.test(String(x || '').trim()) ? String(x).trim() : null);
  const fontName = x => String(x || '').replace(/[^\w\s.-]/g, '').trim();
  const v = n => cssVar(n) ? `var(${cssVar(n)})` : 'transparent';
  function fontStack(T, fid) { const f = (T.fonts || []).find(x => x.id === fid); return f ? (f.stack || []).map(fontName).filter(Boolean).map(x => /\s/.test(x) ? `"${x}"` : x).join(',') || 'inherit' : 'inherit'; }
  function radius(T, rid) { const r = (T.radius || []).find(x => x.id === rid); return r ? num(r.v) : 4; }
  function build(T) {
    if (!T || !T.colors) return '';
    const L = [], D = [];
    T.colors.forEach(c => {
      const n = cssVar(c.name); if (!n) return;
      if (color(c.light)) L.push(`${n}:${color(c.light)}`);
      if (color(c.dark)) D.push(`${n}:${color(c.dark)}`);
    });
    (T.fonts || []).forEach(f => L.push(`--t-font-${id(f.id)}:${fontStack(T, f.id)}`));
    (T.space || []).forEach((s, i) => L.push(`--t-space-${i + 1}:${num(s)}px`));
    (T.radius || []).forEach(r => L.push(`--t-radius-${id(r.id)}:${num(r.v)}px`));
    (T.containers || []).forEach(c => L.push(`--t-w-${id(c.id)}:${num(c.v)}px`));
    const out = [`/* 生成物：零件库模板 ${T.version || ''}，改 system.tokens.json 的 template 段后重新生成，勿手改 */`,
      `:root{${L.join(';')}}`, `.dark{${D.join(';')}}`];
    (T.type || []).forEach(t => out.push(`.t-${id(t.id)}{font-family:var(--t-font-${id(t.font)});font-size:${num(t.size)}px;line-height:${num(t.lh)};font-weight:${num(t.weight)};color:${cssVar(t.color) ? v(t.color) : 'inherit'}}`));
    out.push('.t-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;border:1px solid transparent;font-family:var(--t-font-sans);line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}');
    out.push('.t-btn:focus-visible,.t-btn.is-focus{outline:2px solid var(--brand-border);outline-offset:2px}');
    out.push('.t-btn:disabled{opacity:.5;cursor:not-allowed}');
    (T.buttons || []).forEach(b => {
      const bid = id(b.id), h = num(b.h), px = num(b.px);
      const d = [`font-size:${num(b.size)}px`, `font-weight:${num(b.weight)}`, `border-radius:${radius(T, b.radius)}px`, `background:${v(b.bg)}`, `color:${v(b.fg)}`, `border-color:${v(b.border)}`];
      if (h) d.push(`height:${h}px`); else d.push('height:auto', 'border-width:0');
      d.push(px ? `padding:0 ${px}px` : 'padding:0');
      if (h && !px) d.push(`width:${h}px`);
      out.push(`.t-btn-${bid}{${d.join(';')}}`);
      const hv = HOVER[b.hover];
      if (hv) out.push(`.t-btn-${bid}:hover:not(:disabled),.t-btn-${bid}.is-hover{${typeof hv === 'function' ? hv({ bg: cssVar(b.bg) }) : hv}}`);
    });
    return out.join('\n') + '\n';
  }
  const api = { build, HOVER_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TemplateCSS = api;
})(typeof window !== 'undefined' ? window : globalThis);
