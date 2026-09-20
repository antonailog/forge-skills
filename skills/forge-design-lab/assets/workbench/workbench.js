/* Forge 设计工作台 · 引擎
 * 母本：~/.claude/skills/forge-design-lab/assets/workbench/workbench.js（项目副本放 docs/assets/visuals/_workbench/，由 scaffold_pack.py 同步）
 * 页面 HTML 只需：① <link> 前端的 *.tokens.css ② <script> *.tokens.js（window.WB_SPEC）③ #frame 里的骨架片段 + 组件 CSS ④ WB.init({hooks})
 * 引擎不认识任何页面：层级/状态/视口/开关/effects/线框布局/节点树全部来自 WB_SPEC。
 */
(function(){
'use strict';
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const WB=window.WB={};

WB.init=function(opts){
opts=opts||{};const T=opts.spec||window.WB_SPEC;if(!T){alert('缺少 WB_SPEC（*.tokens.js 未加载）');return}
const H=opts.hooks||{};const NODES=T.nodes;const byId=Object.fromEntries(NODES.map(n=>[n.id,n]));
const BASE=Object.fromEntries(NODES.map(n=>[n.id,n.value]));
const LS='wb:'+T.page+':'+T.version;
const S={level:(T.levels.find(l=>l.states)||T.levels[0]).key,state:(T.states[0]&&T.states.find(s=>s.key==='done')?'done':(T.states[0]||{}).key),vp:'follow',fit:true,dims:true,ids:false,dark:false,inspect:false,panel:true,viewOpen:true,tab:'layer',mod:(T.modules[0]||{}).key,toggles:{}};
const D={};const FB=[];
(T.toggles||[]).forEach(t=>S.toggles[t.key]=false);

/* ---------- DOM 搭建 ---------- */
const frame=$('#frame');if(!frame){alert('页面缺少 #frame');return}
const stage=document.createElement('div');stage.id='wb-stage';const wrap=document.createElement('div');wrap.id='wb-wrap';const scaler=document.createElement('div');scaler.id='wb-scaler';
frame.parentNode.insertBefore(stage,frame);scaler.appendChild(frame);wrap.appendChild(scaler);stage.appendChild(wrap);
const panel=document.createElement('aside');panel.id='wb-panel';document.body.appendChild(panel);
const ptab=document.createElement('div');ptab.id='wb-panel-tab';ptab.textContent='审查';ptab.title='打开面板（P）';document.body.appendChild(ptab);
if(T.layout&&T.layout.length&&!$('#frame .lvl.wire')){const w=document.createElement('div');w.className='lvl wire';frame.prepend(w)}

const VIEW_HTML=`
<div id="wb-view"><div id="wb-viewsum"><span id="wb-viewtext"></span><span class="sp"></span><span class="font" id="wb-font">字体…</span><button id="wb-viewtoggle" title="T">折叠</button></div>
<div id="wb-viewrows">
<div class="vr"><span class="lab">层级</span>${T.levels.map(l=>`<button data-level="${l.key}">${esc(l.label)}</button>`).join('')}</div>
<div class="vr"><span class="lab">状态</span>${T.states.map(s=>`<button data-state="${s.key}">${esc(s.label)}</button>`).join('')}</div>
<div class="vr"><span class="lab">视口</span>${T.viewports.map(v=>`<button data-vp="${v.key}">${esc(v.label)}</button>`).join('')}<input id="wb-vw" type="number" title="宽"><input id="wb-vh" type="number" title="高"><span id="wb-zoomg"><button id="wb-fit">适合</button><button id="wb-one">1:1</button></span></div>
<div class="vr"><span class="lab">审阅</span><button id="wb-inspect" class="warn" title="I">检查</button><button id="wb-dims" title="D">标注</button><button id="wb-ids" title="N">编号</button><button id="wb-dark">暗色</button>${(T.toggles||[]).map(t=>`<button data-toggle="${t.key}">${esc(t.label)}</button>`).join('')}</div>
</div></div>`;
panel.innerHTML=`
<div id="wb-phead"><div id="wb-tabs"><button data-t="layer">按层</button><button data-t="mod">按模块</button><button data-t="fb">反馈</button><button data-t="how">指南</button><button class="close" id="wb-pclose" title="收起（P）">×</button></div>
<div id="wb-saverow"><button id="wb-save">保存</button><span id="wb-savestat">未保存</span></div>${VIEW_HTML}</div>
<div class="wb-tab" data-t="layer"><p><small>从上往下走七层，每层先读问题再看节点。黄框是我替你标出的风险点。改值即时生效；点节点名跳到它所在的层级/状态并闪一下。</small></p><div id="wb-layer"></div></div>
<div class="wb-tab" data-t="mod"><p><small>选一个模块看它全部 token 并现场改。或开工具条「检查」后直接点骨架上的元素。</small></p><div class="wb-mods" id="wb-mods"></div><div id="wb-modlist"></div></div>
<div class="wb-tab" data-t="fb"><p><small>一行一条。行首写元素编号或 token id 就能定位，例如 <code>C12 太挤</code>、<code>s.col-w 再宽点</code>；不写编号也行。点「记入」后保存时随文件带给我。</small></p><textarea id="wb-fbin" placeholder="C12 太挤&#10;s.doc-max 960 还是宽了&#10;搜索框像广告"></textarea><div style="margin:8px 0 14px"><button class="btn" id="wb-fbadd">记入</button><button class="btn ghost" id="wb-fbclr">清空输入</button></div><div id="wb-fblist"></div></div>
<div class="wb-tab" data-t="how">
<h3>怎么用</h3><p><b>1 走七层。</b>「按层」每层一个问题，每个节点给结局：通过 / 改 / 拿不准。</p><p><b>2 直接改。</b>改值骨架当场变，改过的节点左边出蓝条，自动记为「改」。不在站点阶梯的值标红。</p><p><b>3 说感受。</b>「反馈」tab 一行一条；或开「检查」点元素，面板跳到它的 token。</p><p><b>4 保存。</b>橙色按钮直接写进仓库（首次选一次仓库根目录），然后告诉 Agent「保存好了，按调整后的来」。</p>
<div class="dims8"><span>位置</span><span>尺寸</span><span>间距</span><span>字</span><span>色</span><span>密度</span><span>顺序</span><span>状态</span></div>
<h3>快捷键</h3><p><small><kbd>P</kbd> 面板 · <kbd>T</kbd> 折叠视图块 · <kbd>I</kbd> 检查 · <kbd>D</kbd> 标注 · <kbd>N</kbd> 编号 · <kbd>Esc</kbd> 退出检查/收面板</small></p>
<h3>同源检查</h3><div class="wb-status" id="wb-drift">检测中…</div>
<h3>保存目录</h3><div class="wb-status" id="wb-root">未授权。点「保存」时在弹出的选择框里进到仓库根目录再点「选择」：文件夹名 ${esc(T.repoName||'（仓库根）')}，里面同时有 ${esc(T.files.json.split('/')[0])}/ 与 ${esc(T.files.css.split('/')[0])}/。选成子目录不行。</div><button class="btn ghost" id="wb-reroot">更换目录</button><button class="btn ghost" id="wb-reset">重置为基线</button>
<h3>编号表</h3><table class="sz">${Object.entries(T.elementIds||{}).map(([k,v])=>`<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join('')}</table>
<h3>结局的含义</h3><p><small><b>通过</b>：值和写法都对。<b>改</b>：改了值（自动）或要 Agent 按备注改。<b>拿不准</b>：Agent 出 A/B/C。<b>提议改动</b>：只对站点级只读 token，导出时单列。</small></p>
<h3>已定的非 token 决策（点了元素闪）</h3><div id="wb-dec"></div>
<h3>尺寸（随视口实时）</h3><table class="sz" id="wb-sz"></table>
</div>`;

/* ---------- 持久化 ---------- */
function save(){localStorage.setItem(LS,JSON.stringify({values:Object.fromEntries(NODES.map(n=>[n.id,n.value])),decisions:D,feedback:FB,ui:{tab:S.tab,panel:S.panel,viewOpen:S.viewOpen,vp:S.vp,level:S.level,state:S.state,dims:S.dims,ids:S.ids,dark:S.dark}}))}
function load(){try{const j=JSON.parse(localStorage.getItem(LS)||'null');if(!j)return;NODES.forEach(n=>{if(j.values&&j.values[n.id]!==undefined)n.value=j.values[n.id]});Object.assign(D,j.decisions||{});(j.feedback||[]).forEach(f=>FB.push(f));if(j.ui){['tab','panel','viewOpen','vp','level','state','dims','ids','dark'].forEach(k=>{if(j.ui[k]!==undefined)S[k]=j.ui[k]})}}catch(e){}}
/* ---------- token ---------- */
function cssVal(n,v){v=v===undefined?n.value:v;switch(n.type){case'px':return v+'px';case'ms':return v+'ms';case'num':return String(v);case'colorref':return v==='transparent'?'transparent':'var(--'+v+')';case'color':return v;case'raw':return String(v);default:return null}}
function fmt(n,v){v=v===undefined?n.value:v;if(n.type==='px')return v+'px';if(n.type==='ms')return v+'ms';if(n.type==='colorref')return '--'+v;return String(v)}
function isChanged(n){return n.value!==BASE[n.id]}
function offScale(n){const v=Number(n.value);if(n.options&&n.options.map(String).includes(String(n.value)))return false;const sc=T.scale||{};if(n.type==='px'){return !((sc.px||[]).concat(sc.space||[],sc.radius||[]).includes(v))}if(n.type==='num'&&/weight/.test(n.id))return !(sc.weight||[]).includes(v);if(n.type==='num'&&/lh/.test(n.id))return !(sc.lh||[]).includes(v);return false}
function applyToken(n){if(n.css){const cv=cssVal(n);if(cv!==null)frame.style.setProperty(n.css,cv)}}
function applyEffects(){(T.effects||[]).forEach(e=>{const n=byId[e.node];if(!n)return;const on=e.eq!==undefined?String(n.value)===String(e.eq):(e.neq!==undefined?String(n.value)!==String(e.neq):!!n.value);frame.classList.toggle(e.cls,on)})}
/* ---------- 应用 ---------- */
function curLevel(){return T.levels.find(l=>l.key===S.level)||T.levels[0]}
function vpSize(){const L=curLevel();if(L.w&&L.h)return{W:L.w,H:L.h,fixed:true};if(S.vp==='follow')return{W:stage.clientWidth,H:stage.clientHeight,follow:true};const v=T.viewports.find(x=>x.key===S.vp);return v&&v.w?{W:v.w,H:v.h}:{W:+$('#wb-vw').value||1440,H:+$('#wb-vh').value||900}}
function apply(){
  frame.dataset.level=S.level;frame.dataset.state=S.state;
  stage.style.right=S.panel?(panel.offsetWidth||404)+'px':'0px';
  const {W:VW,H:VH,follow}=vpSize();
  const mb=T.mobileBelow&&byId[T.mobileBelow]?Number(byId[T.mobileBelow].value):1024;
  frame.classList.toggle('mob',VW<mb);frame.classList.toggle('dims',S.dims);frame.classList.toggle('ids',S.ids);frame.classList.toggle('inspect',S.inspect);
  (T.toggles||[]).forEach(t=>frame.classList.toggle(t.cls,!!S.toggles[t.key]));
  document.documentElement.classList.toggle('dark',S.dark);
  NODES.forEach(applyToken);applyEffects();
  frame.style.width=VW+'px';frame.style.height=VH+'px';
  stage.classList.toggle('follow',!!follow);
  let sc=1;if(!follow){const sw=stage.clientWidth-48,sh=stage.clientHeight-104;sc=S.fit?Math.min(1,sw/VW,sh/VH):1}
  scaler.style.transform='scale('+sc+')';wrap.style.width=(VW*sc)+'px';wrap.style.height=(VH*sc)+'px';
  $('#wb-viewtext').textContent=`${esc(curLevel().label)}${curLevel().states?' · '+esc((T.states.find(x=>x.key===S.state)||{}).label||S.state):''} · ${VW}×${VH}${follow?(S.panel?' 跟随窗口（已扣面板）1:1':' 跟随窗口 1:1'):' 显示 '+Math.round(sc*100)+'%'}`;
  $$('#wb-view [data-level]').forEach(b=>b.classList.toggle('on',b.dataset.level===S.level));
  $$('#wb-view [data-state]').forEach(b=>{b.classList.toggle('on',b.dataset.state===S.state);b.disabled=!curLevel().states});
  $$('#wb-view [data-vp]').forEach(b=>b.classList.toggle('on',b.dataset.vp===S.vp));
  $('#wb-zoomg').style.display=follow?'none':'';$('#wb-fit').classList.toggle('on',S.fit);$('#wb-one').classList.toggle('on',!S.fit);
  $('#wb-inspect').classList.toggle('on',S.inspect);$('#wb-dims').classList.toggle('on',S.dims);$('#wb-ids').classList.toggle('on',S.ids);$('#wb-dark').classList.toggle('on',S.dark);
  $$('#wb-view [data-toggle]').forEach(b=>b.classList.toggle('on',!!S.toggles[b.dataset.toggle]));
  $('#wb-view').classList.toggle('collapsed',!S.viewOpen);$('#wb-viewtoggle').textContent=S.viewOpen?'折叠':'展开';
  panel.classList.toggle('closed',!S.panel);
  $$('#wb-tabs button[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===S.tab));$$('.wb-tab').forEach(p=>p.classList.toggle('on',p.dataset.t===S.tab));
  if(S.level==='wire')renderWire();
  if(H.afterApply)H.afterApply(S,{frame,byId});
  requestAnimationFrame(()=>{sizes();if(H.specs)H.specs({byId,fmt})});
}
function sizes(){if(!H.sizes)return;const rows=H.sizes(S,{frame,byId,W:vpSize().W,H:vpSize().H,mob:frame.classList.contains('mob')})||[];const t=$('#wb-sz');if(t)t.innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}
function renderWire(){const host=$('#frame .lvl.wire');if(!host)return;host.innerHTML='';const map={};(T.layout||[]).forEach(r=>{const el=document.createElement('div');el.className='wire-r'+(r.scroll?' scroll':'');el.dataset.id=(r.el===null?'':(r.el||r.id||'')).toUpperCase();Object.assign(el.style,r.style||{});el.innerHTML=`<b>${esc(r.label)}</b><i>${Object.entries(r.style||{}).map(([k,v])=>k+': '+v).join(' · ')}${r.scroll?' · 独立滚动':''}</i>${r.note?'<i>'+esc(r.note)+'</i>':''}`;map[r.id]=el;(r.parent&&map[r.parent]?map[r.parent]:host).appendChild(el)})}
/* ---------- 节点 ---------- */
function control(n){
  if(n.type==='raw')return `<div class="ctl"><code style="white-space:normal">${esc(n.value)}</code><span class="lock">派生值，由上面的 token 算出</span></div>`;
  if(n.readonly)return `<div class="ctl"><span class="nv">${n.type==='color'?`<span class="sw" style="background:${esc(n.value)};cursor:default"></span> ${esc(n.value)}`:esc(n.value)}</span><span class="lock">🔒 站点级</span></div>`;
  if(n.type==='check')return '';
  if(n.type==='enum')return `<div class="ctl"><select data-set="${n.id}">${n.options.map(o=>`<option ${o===n.value?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
  if(n.type==='colorref'){const pal=(T.foundation||{})[S.dark?'dark':'light']||{};return `<div class="ctl">${n.options.map(o=>`<span class="sw ${o===n.value?'on':''}" data-set="${n.id}" data-v="${o}" title="--${o}" style="background:${o==='transparent'?'repeating-linear-gradient(45deg,#ddd 0 4px,#fff 4px 8px)':pal[o]||'#000'}"></span>`).join('')}<span class="nv">--${esc(n.value)}</span></div>`}
  if(n.type==='color')return `<div class="ctl"><input type="color" data-set="${n.id}" value="${esc(n.value)}"><input type="text" data-set="${n.id}" value="${esc(n.value)}"></div>`;
  const inOpt=n.options&&n.options.includes(n.value);const u=n.type==='px'?'px':n.type==='ms'?'ms':'';
  return `<div class="ctl"><select data-set="${n.id}">${(n.options||[]).map(o=>`<option value="${o}" ${o===n.value?'selected':''}>${o}${u}</option>`).join('')}<option value="__c" ${inOpt?'':'selected'}>自定义…</option></select><input type="number" step="${n.type==='num'?'0.01':'1'}" data-set="${n.id}" value="${n.value}" style="${inOpt?'display:none':''}">${offScale(n)?'<span class="off">不在阶梯</span>':''}</div>`}
function nodeHtml(n){const d=D[n.id]||{};const ch=isChanged(n);const r=d.r||(ch?'change':'');const pills=n.readonly?['propose:提议改动','pass:通过']:['pass:通过','change:改','unsure:拿不准'];
  return `<div class="nd ${n.readonly?'ro':''} ${ch?'changed':''}" data-nid="${n.id}"><div class="nh" title="跳到它所在的层级/状态并闪一下"><span class="nid">${n.id}</span><span class="nl">${esc(n.label)}</span>${n.type!=='check'?`<span class="nv">${fmt(n)}${ch?' <span class="wb-muted">（原 '+fmt(n,BASE[n.id])+'）</span>':''}</span>`:''}<span class="go">跳转 ↗</span></div>
  ${n.q?`<div class="q">${esc(n.q)}</div>`:''}${n.note?`<div class="note">${esc(n.note)}</div>`:''}${control(n)}
  <div class="pills">${pills.map(p=>{const[k,l]=p.split(':');return `<button class="${k} ${r===k?'on':''}" data-r="${k}" data-nid="${n.id}">${l}</button>`}).join('')}</div>
  <textarea rows="1" placeholder="备注 / 怎么改" data-note="${n.id}">${esc(d.note||'')}</textarea></div>`}
function renderLayer(){$('#wb-layer').innerHTML=T.groups.map(g=>{const ns=NODES.filter(n=>n.g===g.key);const done=ns.filter(n=>(D[n.id]&&D[n.id].r)||isChanged(n)).length;let extra='';
  if(g.key==='consistency'){const refs=new Set();NODES.forEach(n=>{if(n.type==='colorref')refs.add('--'+n.value)});const off=NODES.filter(offScale);extra=`<div class="wb-status">引用站点 token：${[...refs].join(' ')}\n页面 token：${NODES.filter(n=>n.css).length} 个\n不在阶梯的值：${off.length?off.map(n=>n.id+'='+n.value).join('，'):'无'}\n相对基线改动：${NODES.filter(isChanged).length}</div>`}
  return `<div class="wb-gh"><span class="prog">${done}/${ns.length}</span><b>${esc(g.label)}</b><div class="ask">${esc(g.ask||'')}</div><div class="how">${esc(g.how||'')}</div></div>${extra}${ns.map(nodeHtml).join('')}`}).join('')}
function renderMod(){$('#wb-mods').innerHTML=T.modules.map(m=>`<button data-mod="${m.key}" class="${m.key===S.mod?'on':''}">${esc(m.label)}</button>`).join('');const ns=NODES.filter(n=>n.mod===S.mod);$('#wb-modlist').innerHTML=T.groups.map(g=>{const gs=ns.filter(n=>n.g===g.key);return gs.length?`<h3>${esc(g.label)}</h3>${gs.map(nodeHtml).join('')}`:''}).join('')||'<p class="wb-muted">该模块没有 token。</p>'}
function renderFb(){$('#wb-fblist').innerHTML=FB.map((f,i)=>`<div class="fb" data-i="${i}"><span class="ref ${f.ref?'':'none'}">${f.ref?esc(f.ref):'—'}</span><span class="t">${esc(f.t)}</span><span class="x" data-del="${i}" title="删除">×</span></div>`).join('')||'<p class="wb-muted">还没有反馈。</p>'}
function renderDec(){const el=$('#wb-dec');if(!el)return;el.innerHTML=(H.decisions||[]).map(d=>`<div class="d" data-ids="${d[2].join(',')}"><b>${d[0]}</b><span>${esc(d[1])}</span></div>`).join('')||'<p class="wb-muted">无</p>'}
function rerender(){renderLayer();renderMod();renderFb();renderDec()}
function refreshNode(id){$$(`.nd[data-nid="${id}"]`).forEach(el=>{el.outerHTML=nodeHtml(byId[id])})}
function setVal(id,v){const n=byId[id];if(n.type==='px'||n.type==='ms'||n.type==='num')v=Number(v);n.value=v;applyToken(n);applyEffects();const same=n.value===BASE[id];D[id]=D[id]||{};if(!same&&!D[id].r)D[id].r='change';if(same&&D[id].r==='change')delete D[id].r;save();requestAnimationFrame(()=>{sizes();if(H.specs)H.specs({byId,fmt})});refreshNode(id);if(H.afterApply)H.afterApply(S,{frame,byId});stat('有未保存改动','')}
/* ---------- 映射与跳转 ---------- */
function levelRoot(){return frame.querySelector('.lvl.'+S.level)||frame}
function mapEls(n){if(!n.maps)return[];const root=levelRoot();return n.maps.flatMap(s=>{try{return[...root.querySelectorAll(s)]}catch(e){return[]}})}
function visible(el){return el.getClientRects().length>0}
function flashEls(els){els.slice(0,12).forEach(el=>{el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')})}
function ensureView(n){let changed=false;const v=n.view||{};if(v.level&&v.level!==S.level){S.level=v.level;changed=true}if(v.state&&v.state!==S.state){S.state=v.state;changed=true}if(v.toggle&&!S.toggles[v.toggle]){S.toggles[v.toggle]=true;changed=true}
  if(changed)apply();
  if(!n.view&&n.maps){if(!mapEls(n).some(visible)){const pl=T.levels.find(l=>l.states);if(pl&&S.level!==pl.key){S.level=pl.key;apply()}if(!mapEls(n).some(visible)){const pref=['done',S.state].concat(T.states.map(s=>s.key));for(const k of [...new Set(pref)]){if(!T.states.find(s=>s.key===k))continue;S.state=k;apply();if(mapEls(n).some(visible))break}}}}
  save()}
function jumpTo(n){ensureView(n);setTimeout(()=>flashEls(mapEls(n).filter(visible)),80)}
function jumpToEl(id){const pl=T.levels.find(l=>l.states);const find=()=>$$(`#frame [data-id="${id}"]`).filter(visible);if(!find().length&&pl&&S.level!==pl.key){S.level=pl.key;apply()}if(!find().length){const pref=['done',S.state].concat(T.states.map(s=>s.key));for(const k of [...new Set(pref)]){if(!T.states.find(s=>s.key===k))continue;S.state=k;apply();if(find().length)break}}setTimeout(()=>flashEls(find()),80);save()}
function jumpToNode(id){const n=byId[id];if(!n)return;S.tab='layer';apply();const el=$(`#wb-layer .nd[data-nid="${id}"]`);$$('#wb-panel .nd.sel').forEach(x=>x.classList.remove('sel'));if(el){el.classList.add('sel');el.scrollIntoView({block:'center',behavior:'smooth'})}jumpTo(n)}
/* ---------- 面板事件 ---------- */
panel.addEventListener('change',e=>{const t=e.target;if(!t.dataset.set)return;if(t.tagName==='SELECT'){if(t.value==='__c'){t.nextElementSibling.style.display='';t.nextElementSibling.focus();return}setVal(t.dataset.set,t.value)}else setVal(t.dataset.set,t.value)});
panel.addEventListener('input',e=>{const t=e.target;if(t.dataset.note){(D[t.dataset.note]=D[t.dataset.note]||{}).note=t.value;save()}if(t.type==='color'&&t.dataset.set){byId[t.dataset.set].value=t.value;applyToken(byId[t.dataset.set])}});
panel.addEventListener('click',e=>{
  const sw=e.target.closest('.sw[data-set]');if(sw){setVal(sw.dataset.set,sw.dataset.v);return}
  const pill=e.target.closest('button[data-r]');if(pill){const id=pill.dataset.nid;D[id]=D[id]||{};D[id].r=D[id].r===pill.dataset.r?'':pill.dataset.r;save();refreshNode(id);renderLayer();return}
  const mb=e.target.closest('button[data-mod]');if(mb){S.mod=mb.dataset.mod;renderMod();return}
  const nh=e.target.closest('.nh');if(nh){jumpTo(byId[nh.parentElement.dataset.nid]);return}
  const tb=e.target.closest('#wb-tabs button[data-t]');if(tb){S.tab=tb.dataset.t;save();apply();if(S.tab==='how')drift();return}
  if(e.target.id==='wb-pclose'){S.panel=false;save();apply();return}
  if(e.target.id==='wb-save'){doSave();return}
  if(e.target.id==='wb-reroot'){idbDel('root').then(()=>{$('#wb-root').textContent='已清除授权，下次保存重新选目录。'});return}
  if(e.target.id==='wb-reset'){if(!confirm('清除所有改动、结局与反馈，回到基线？'))return;localStorage.removeItem(LS);NODES.forEach(n=>{n.value=BASE[n.id];if(n.css)frame.style.removeProperty(n.css)});Object.keys(D).forEach(k=>delete D[k]);FB.length=0;apply();rerender();return}
  if(e.target.id==='wb-fbadd'){const ta=$('#wb-fbin');ta.value.split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>{const r=parseRef(l);FB.push({t:l,ref:r?r.ref:null,kind:r?r.kind:null,at:new Date().toISOString().slice(0,16)})});ta.value='';save();renderFb();stat('有未保存改动','');return}
  if(e.target.id==='wb-fbclr'){$('#wb-fbin').value='';return}
  const del=e.target.closest('[data-del]');if(del){FB.splice(+del.dataset.del,1);save();renderFb();return}
  const fb=e.target.closest('.fb');if(fb){const f=FB[+fb.dataset.i];if(f&&f.kind==='node')jumpToNode(f.ref);else if(f&&f.kind==='el')jumpToEl(f.ref);return}
  const d=e.target.closest('.d');if(d){d.dataset.ids.split(',').forEach(id=>jumpToEl(id));return}
});
panel.addEventListener('mouseover',e=>{const nd=e.target.closest('.nd');if(!nd)return;$$('#frame .hl').forEach(x=>x.classList.remove('hl'));mapEls(byId[nd.dataset.nid]).forEach(el=>el.classList.add('hl'))});
panel.addEventListener('mouseleave',()=>$$('#frame .hl').forEach(x=>x.classList.remove('hl')));
function parseRef(line){let m=line.match(/^([a-z]{1,2}\.[a-z0-9.-]+)\b/i);if(m&&byId[m[1].toLowerCase()])return{kind:'node',ref:m[1].toLowerCase()};m=line.match(/^([A-Za-z][A-Za-z0-9-]*\d*)\b/);if(m){const id=m[1].toUpperCase();if(document.querySelector(`#frame [data-id="${id}"]`)||/^C\d+$/.test(id))return{kind:'el',ref:id}}return null}
/* ---------- 工具条 / 快捷键 / 检查 ---------- */
$('#wb-view').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();
  if(b.dataset.level)S.level=b.dataset.level;else if(b.dataset.state)S.state=b.dataset.state;else if(b.dataset.vp){S.vp=b.dataset.vp;const v=T.viewports.find(x=>x.key===S.vp);if(v&&v.w){$('#wb-vw').value=v.w;$('#wb-vh').value=v.h}}
  else if(b.id==='wb-fit')S.fit=true;else if(b.id==='wb-one')S.fit=false;else if(b.id==='wb-inspect')S.inspect=!S.inspect;else if(b.id==='wb-dims')S.dims=!S.dims;else if(b.id==='wb-ids')S.ids=!S.ids;else if(b.id==='wb-dark'){S.dark=!S.dark;rerender()}
  else if(b.dataset.toggle)S.toggles[b.dataset.toggle]=!S.toggles[b.dataset.toggle];else if(b.id==='wb-viewtoggle')S.viewOpen=!S.viewOpen;
  save();apply()});
['#wb-vw','#wb-vh'].forEach(s=>$(s).addEventListener('change',()=>{S.vp='custom';apply()}));
ptab.onclick=()=>{S.panel=true;save();apply()};
document.addEventListener('keydown',e=>{const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;if(e.metaKey||e.ctrlKey||e.altKey)return;
  const k=e.key.toLowerCase();if(k==='p'){S.panel=!S.panel}else if(k==='t'){S.viewOpen=!S.viewOpen;S.panel=true}else if(k==='i'){S.inspect=!S.inspect}else if(k==='d'){S.dims=!S.dims}else if(k==='n'){S.ids=!S.ids}else if(k==='escape'){if(S.inspect)S.inspect=false;else S.panel=false}else return;e.preventDefault();save();apply()});
frame.addEventListener('mouseover',e=>{if(!S.inspect)return;$$('#frame .ins-hover').forEach(x=>x.classList.remove('ins-hover'));e.target.classList.add('ins-hover')});
frame.addEventListener('click',e=>{if(!S.inspect)return;e.preventDefault();e.stopPropagation();
  // 命中按「距离」排序：目标元素自身 0、父级 1……只选最近的一到两层，避免点一张卡把整个引用列的 token 都选上
  const dist=(el,anc)=>{let d=0;for(let x=el;x&&x!==anc;x=x.parentElement)d++;return d};
  const scored=[];NODES.forEach(n=>{if(!n.maps)return;let best=Infinity;n.maps.forEach(sel=>{try{const a=e.target.closest(sel);if(a)best=Math.min(best,dist(e.target,a))}catch(x){}});if(best<Infinity)scored.push([best,n])});
  if(!scored.length)return;scored.sort((a,b)=>a[0]-b[0]||((a[1].css?0:1)-(b[1].css?0:1)));const mod=scored[0][1].mod;const hits=scored.filter(x=>x[1].mod===mod).map(x=>x[1]);
  S.mod=hits[0].mod;S.tab='mod';S.panel=true;apply();renderMod();const ids=new Set(hits.map(h=>h.id));$$('#wb-modlist .nd').forEach(el=>el.classList.toggle('sel',ids.has(el.dataset.nid)));const first=$('#wb-modlist .nd.sel');if(first)first.scrollIntoView({block:'start',behavior:'smooth'})},true);
window.addEventListener('resize',apply);
/* ---------- 构建输出 ---------- */
function buildCss(){return ['/* 由 '+T.files.json+' 生成（工作台「保存」或 build_tokens.py），勿手改。',' * '+(T.title||T.page)+' '+T.version+' 页面级与组件级 token。站点基础 token 只引用 var(--…)，值在站点全局样式。',' * 工作台与前端组件读的是同一个文件。 */',':root{',...NODES.filter(n=>n.css&&cssVal(n)!==null).map(n=>`  ${n.css}: ${cssVal(n)}; /* ${n.label} */`),'}',''].join('\n')}
function buildJson(){const out=JSON.parse(JSON.stringify(T));out.nodes.forEach(n=>{n.value=byId[n.id].value});out.decisions=D;out.feedback=FB;out.exported=new Date().toISOString().slice(0,19);return JSON.stringify(out,null,1)}
/* ---------- 保存（File System Access → 下载兜底） ---------- */
const idb={db:null,open(){return new Promise((res,rej)=>{if(idb.db)return res(idb.db);const r=indexedDB.open('wb-handles',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{idb.db=r.result;res(idb.db)};r.onerror=()=>rej(r.error)})},
  async get(k){const db=await idb.open();return new Promise((res,rej)=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})},
  async set(k,v){const db=await idb.open();return new Promise((res,rej)=>{const q=db.transaction('kv','readwrite').objectStore('kv').put(v,k);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})},
  async del(k){const db=await idb.open();return new Promise((res,rej)=>{const q=db.transaction('kv','readwrite').objectStore('kv').delete(k);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}};
const idbDel=k=>idb.del(k).catch(()=>{});
function stat(msg,cls){const el=$('#wb-savestat');el.textContent=msg;el.className=cls||''}
async function writeFile(root,rel,text){const parts=rel.split('/');let dir=root;for(const p of parts.slice(0,-1))dir=await dir.getDirectoryHandle(p,{create:true});const fh=await dir.getFileHandle(parts[parts.length-1],{create:true});const w=await fh.createWritable();await w.write(text);await w.close()}
async function doSave(){const btn=$('#wb-save');btn.disabled=true;stat('保存中…');const json=buildJson();const payload={json,js:'// 由 '+T.files.json.split('/').pop()+' 生成，勿手改\nwindow.WB_SPEC='+json+';\n',css:buildCss()};
  try{if(!window.showDirectoryPicker)throw new Error('no-fsa');let root=await idb.get('root');if(!root){root=await window.showDirectoryPicker({id:'wb-root',mode:'readwrite'});await idb.set('root',root)}
    let perm=await root.queryPermission({mode:'readwrite'});if(perm!=='granted')perm=await root.requestPermission({mode:'readwrite'});if(perm!=='granted')throw new Error('未授权');
    try{await root.getDirectoryHandle(T.files.json.split('/')[0])}catch(e){await idbDel('root');throw new Error('选的是「'+root.name+'」，需要仓库根目录（文件夹名 '+(T.repoName||'仓库根目录')+'，里面同时有 '+T.files.json.split('/')[0]+'/ 与 '+T.files.css.split('/')[0]+'/）。下次点保存会重新弹选择框')}
    for(const k of ['json','js','css'])await writeFile(root,T.files[k],payload[k]);
    const msg=`已保存 ${new Date().toTimeString().slice(0,5)} → ${root.name}/ · 改动 ${NODES.filter(isChanged).length} · 反馈 ${FB.length}`;stat(msg,'ok');$('#wb-root').textContent='已授权：'+root.name+'/（写 '+Object.values(T.files).join('、')+'）';localStorage.setItem(LS+':saved',msg)}
  catch(e){if(e&&e.name==='AbortError'){stat('已取消','')}else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.download=T.files.json.split('/').pop();a.click();stat('未能直写（'+(e.message||e)+'），已下载 tokens.json 到 Downloads','bad')}}
  finally{btn.disabled=false}}
function drift(){const cs=getComputedStyle(document.documentElement);let miss=0,bad=[];const withCss=NODES.filter(n=>n.css&&n.type!=='raw');withCss.forEach(n=>{let want=cssVal(n,BASE[n.id]);if(n.type==='colorref'&&BASE[n.id]!=='transparent')want=cs.getPropertyValue('--'+BASE[n.id]).trim();const got=cs.getPropertyValue(n.css).trim();if(!got)miss++;else if(got.replace(/\s/g,'')!==String(want).replace(/\s/g,''))bad.push(`${n.css} 文件=${got} 基线=${want}`)});
  const el=$('#wb-drift');if(!el)return;if(miss===withCss.length){el.className='wb-status bad';el.textContent='未加载前端 tokens.css（检查 <link> 相对路径）。当前按 tokens.js 基线渲染。'}else if(bad.length){el.className='wb-status bad';el.textContent='前端 tokens.css 与 tokens.json 基线不一致 '+bad.length+' 处：\n'+bad.join('\n')}else{el.className='wb-status ok';el.textContent=`同源：前端 import 的 tokens.css 与 tokens.json 基线一致（${withCss.length} 个变量）。未保存改动 ${NODES.filter(isChanged).length} 处。`}}
/* ---------- 对外 ---------- */
WB.set=patch=>{Object.assign(S,patch);save();apply()};WB.state=S;WB.jumpToEl=jumpToEl;WB.jumpToNode=jumpToNode;WB.spec=T;WB.byId=byId;WB.fmt=fmt;
/* ---------- 启动 ---------- */
load();
if(S.vp!=='follow'){const v=T.viewports.find(x=>x.key===S.vp);if(v&&v.w){$('#wb-vw').value=v.w;$('#wb-vh').value=v.h}}
apply();rerender();setTimeout(drift,400);
const saved=localStorage.getItem(LS+':saved');if(saved)stat(saved,'ok');
idb.get('root').then(r=>{if(r)$('#wb-root').textContent='已授权：'+r.name+'/（重开浏览器后首次保存可能再确认一次）'}).catch(()=>{});
if(H.fonts&&document.fonts){document.fonts.ready.then(()=>{const ok=H.fonts.every(f=>document.fonts.check(f));const b=$('#wb-font');b.textContent=ok?'字体 ✓':'字体 ✗ 回退';b.className='font '+(ok?'ok':'bad')})}
};
})();
