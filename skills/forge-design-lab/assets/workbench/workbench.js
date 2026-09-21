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
/* 反馈以 spec（磁盘）为底，localStorage 只做增量。
   原来 FB 只从 localStorage 来：换浏览器或清了缓存再保存，磁盘上已有的反馈会被整份抹掉。 */
/* 结局与反馈都以 spec（磁盘）为底，localStorage 只做增量。
   只从 localStorage 来的话，换浏览器一保存就把磁盘上的结局清空。 */
const D={};Object.assign(D,JSON.parse(JSON.stringify(T.decisions||{})));
const FB=[];(T.feedback||[]).forEach(f=>FB.push(f));
let SAVED_D=JSON.stringify(D);   // 已落盘的结局快照，用来判断「真的有未保存改动吗」
const fbKey=f=>(f.at||'')+'|'+(f.t||'');
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
<div id="wb-phead"><div id="wb-tabs"><button data-t="layer">按层</button><button data-t="mod">按模块</button><button data-t="q">判断题</button><button data-t="fb">反馈</button><button data-t="how">指南</button><button class="close" id="wb-pclose" title="收起（P）">×</button></div>
<div id="wb-saverow"><button id="wb-save">保存</button><span id="wb-savestat">未保存</span></div><div id="wb-el"></div>${VIEW_HTML}</div>
<div class="wb-tab" data-t="layer"><p><small>从上往下走七层，每层先读问题再看节点。黄框是我替你标出的风险点。改值即时生效；点节点名跳到它所在的层级/状态并闪一下。</small></p><div id="wb-layer"></div></div>
<div class="wb-tab" data-t="mod"><p><small>选一个模块看它全部 token 并现场改。或开工具条「检查」后直接点骨架上的元素。</small></p><div class="wb-mods" id="wb-mods"></div><div id="wb-modlist"></div></div>
<div class="wb-tab" data-t="q"><p><small>本页所有需要你判断的问题，按七层排。点一条就跳到它所在的层级与状态，并把对应元素闪一下——不用自己翻。给了结局的会打勾。</small></p><div id="wb-qlist"></div></div>
<div class="wb-tab" data-t="fb"><p><small>一行一条。行首写元素编号或 token id 就能定位，例如 <code>C12 太挤</code>、<code>s.col-w 再宽点</code>；不写编号也行。点「记入」后保存时随文件带给我。</small></p><textarea id="wb-fbin" placeholder="C12 太挤&#10;s.doc-max 960 还是宽了&#10;搜索框像广告"></textarea><div style="margin:8px 0 14px"><button class="btn" id="wb-fbadd">记入</button><button class="btn ghost" id="wb-fbclr">清空输入</button></div><div id="wb-fblist"></div></div>
<div class="wb-tab" data-t="how">
<h3>怎么用</h3><p><b>1 走七层。</b>「按层」每层一个问题，每个节点给结局：通过 / 改 / 拿不准。</p><p><b>2 直接改。</b>改值骨架当场变，改过的节点左边出蓝条，自动记为「改」。不在站点阶梯的值标红。</p><p><b>3 说感受。</b>「反馈」tab 一行一条；或开「检查」点元素，面板跳到它的 token。</p><p><b>4 保存。</b>橙色按钮直接写进仓库（首次选一次仓库根目录），然后告诉 Agent「保存好了，按调整后的来」。</p>
<div class="dims8"><span>位置</span><span>尺寸</span><span>间距</span><span>字</span><span>色</span><span>密度</span><span>顺序</span><span>状态</span></div>
<h3>快捷键</h3><p><small><kbd>P</kbd> 面板 · <kbd>T</kbd> 折叠视图块 · <kbd>I</kbd> 检查 · <kbd>D</kbd> 标注 · <kbd>N</kbd> 编号 · <kbd>Esc</kbd> 退出检查/收面板</small></p>
<h3>同源检查</h3><div class="wb-status" id="wb-drift">检测中…</div>
<h3>保存目录</h3><div class="wb-status" id="wb-bind"></div><div class="wb-status" id="wb-root">未授权。点「保存」时在弹出的选择框里进到仓库根目录再点「选择」：文件夹名 ${esc(T.repoName||'（仓库根）')}，里面同时有 ${esc(T.files.json.split('/')[0])}/ 与 ${esc(T.files.css.split('/')[0])}/。选成子目录不行。</div><button class="btn ghost" id="wb-reroot">更换目录</button><button class="btn ghost" id="wb-reset">重置为基线</button>
<h3>编号表</h3><table class="sz">${Object.entries(T.elementIds||{}).map(([k,v])=>`<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join('')}</table>
<h3>结局的含义</h3><p><small><b>通过</b>：值和写法都对。<b>改</b>：改了值（自动）或要 Agent 按备注改。<b>拿不准</b>：Agent 出 A/B/C。<b>提议改动</b>：只对站点级只读 token，导出时单列。</small></p>
<h3>已定的非 token 决策（点了元素闪）</h3><div id="wb-dec"></div>
<h3>尺寸（随视口实时）</h3><table class="sz" id="wb-sz"></table>
</div>`;

/* ---------- 持久化 ---------- */
/* 本地缓存只存「你真的改过」的值，并记下改的时候文件基线是多少。
   存整份快照会出事：Agent 更新 tokens.json 重建之后，旧快照在 load() 里静默盖回来，
   你看到的是旧值，一点保存又把旧值写回磁盘，Agent 这轮的改动就没了。 */
function save(){const edits={};NODES.forEach(n=>{if(JSON.stringify(n.value)!==JSON.stringify(BASE[n.id]))edits[n.id]={v:n.value,b:BASE[n.id]}});
  localStorage.setItem(LS,JSON.stringify({edits,decisions:D,feedback:FB,ui:{tab:S.tab,panel:S.panel,viewOpen:S.viewOpen,vp:S.vp,level:S.level,state:S.state,dims:S.dims,ids:S.ids,dark:S.dark}}))}
let STALE_EDITS=[];
function load(){try{const j=JSON.parse(localStorage.getItem(LS)||'null');if(!j)return;
  if(j.edits){NODES.forEach(n=>{const e=j.edits[n.id];if(!e)return;
    // 文件基线动过 = Agent 在这期间改了 tokens.json，文件为准，本地这条作废
    if(JSON.stringify(e.b)!==JSON.stringify(BASE[n.id])){STALE_EDITS.push(n.id);return}
    n.value=e.v})}
  else if(j.values)STALE_EDITS.push('旧版整份快照（已整体丢弃，以文件为准）');
  Object.assign(D,j.decisions||{});
  {const have=new Set(FB.map(fbKey));(j.feedback||[]).forEach(f=>{if(!have.has(fbKey(f))){FB.push(f);have.add(fbKey(f))}});}if(j.ui){['tab','panel','viewOpen','vp','level','state','dims','ids','dark'].forEach(k=>{if(j.ui[k]!==undefined)S[k]=j.ui[k]})}}catch(e){}}
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
  $('#wb-inspect').classList.toggle('on',S.inspect);if(!S.inspect&&ov)ov.style.display='none';
  document.body.classList.toggle('wb-inspecting',S.inspect);$('#wb-dims').classList.toggle('on',S.dims);$('#wb-ids').classList.toggle('on',S.ids);$('#wb-dark').classList.toggle('on',S.dark);
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
  return `<div class="wb-gh"><span class="prog">${done}/${ns.length}</span><b>${esc(g.label)}</b><button class="gpass" data-gpass="${g.key}" title="把本层还没表态的节点一次标为「通过」——看过就点，别让走查在文件里留不下痕迹">整层通过</button><div class="ask">${esc(g.ask||'')}</div><div class="how">${esc(g.how||'')}</div></div>${extra}${ns.map(nodeHtml).join('')}`}).join('')}
function renderMod(){$('#wb-mods').innerHTML=T.modules.map(m=>`<button data-mod="${m.key}" class="${m.key===S.mod?'on':''}">${esc(m.label)}</button>`).join('');const ns=NODES.filter(n=>n.mod===S.mod);$('#wb-modlist').innerHTML=T.groups.map(g=>{const gs=ns.filter(n=>n.g===g.key);return gs.length?`<h3>${esc(g.label)}</h3>${gs.map(nodeHtml).join('')}`:''}).join('')||'<p class="wb-muted">该模块没有 token。</p>'}
function renderQ(){const el=$('#wb-qlist');if(!el)return;
  const qs=NODES.filter(n=>n.q);
  const R={pass:'通过',change:'改',unsure:'拿不准',propose:'提议改动'};
  el.innerHTML=T.groups.map(g=>{const ns=qs.filter(n=>n.g===g.key);if(!ns.length)return '';
    return `<h3>${esc(g.label)}</h3>`+ns.map(n=>{const d=D[n.id]||{};const done=d.r||isChanged(n)?'done':'';
      const m=/^(J\d+)\s*/.exec(n.q||'');const tag=m?m[1]:'';const body=m?n.q.slice(m[0].length):n.q;
      return `<div class="qi ${done}" data-qnid="${n.id}"><span class="qtag">${tag||'·'}</span><b>${esc(n.label)}</b>`
        +`<span class="qst">${d.r?R[d.r]:(isChanged(n)?'已改值':'未表态')}</span><p>${esc(body)}</p></div>`}).join('')}).join('')
    ||'<p class="wb-muted">本页没有判断题。</p>';
  const done=qs.filter(n=>(D[n.id]&&D[n.id].r)||isChanged(n)).length;
  const h=$('#wb-tabs button[data-t="q"]');if(h)h.textContent=`判断题 ${done}/${qs.length}`;}
function renderFb(){$('#wb-fblist').innerHTML=FB.map((f,i)=>`<div class="fb" data-i="${i}"><span class="ref ${f.ref||f.els?'':'none'}">${f.els?f.els.length+' 元素':(f.ref?esc(f.ref):'—')}</span><span class="t">${esc(f.t)}</span><span class="x" data-del="${i}" title="删除">×</span></div>`).join('')||'<p class="wb-muted">还没有反馈。</p>'}
function renderDec(){const el=$('#wb-dec');if(!el)return;el.innerHTML=(H.decisions||[]).map(d=>`<div class="d" data-ids="${d[2].join(',')}"><b>${d[0]}</b><span>${esc(d[1])}</span></div>`).join('')||'<p class="wb-muted">无</p>'}
function rerender(){renderLayer();renderMod();renderQ();renderFb();renderDec()}
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
  const gp=e.target.closest('button[data-gpass]');if(gp){const k=gp.dataset.gpass;let n2=0;NODES.filter(n=>n.g===k).forEach(n=>{if(!(D[n.id]&&D[n.id].r)&&!isChanged(n)){(D[n.id]=D[n.id]||{}).r='pass';n2++}});save();renderLayer();renderMod();stat(n2?`本层 ${n2} 个标为通过，有未保存改动`:'本层已全部表过态','');return}
  const pill=e.target.closest('button[data-r]');if(pill){const id=pill.dataset.nid;D[id]=D[id]||{};D[id].r=D[id].r===pill.dataset.r?'':pill.dataset.r;save();refreshNode(id);renderLayer();renderQ();return}
  const mb=e.target.closest('button[data-mod]');if(mb){S.mod=mb.dataset.mod;renderMod();return}
  const nh=e.target.closest('.nh');if(nh){jumpTo(byId[nh.parentElement.dataset.nid]);return}
  const tb=e.target.closest('#wb-tabs button[data-t]');if(tb){S.tab=tb.dataset.t;save();apply();if(S.tab==='how')drift();return}
  if(e.target.id==='wb-pclose'){S.panel=false;save();apply();return}
  if(e.target.id==='wb-save'){doSave();return}
  if(e.target.id==='wb-reroot'){idbDel('root').then(()=>{$('#wb-root').textContent='已清除授权，下次保存重新选目录。'});return}
  if(e.target.id==='wb-reset'){if(!confirm('清除所有改动、结局与反馈，回到基线？'))return;localStorage.removeItem(LS);NODES.forEach(n=>{n.value=BASE[n.id];if(n.css)frame.style.removeProperty(n.css)});Object.keys(D).forEach(k=>delete D[k]);FB.length=0;apply();rerender();return}
  if(e.target.id==='wb-fbadd'){const ta=$('#wb-fbin');ta.value.split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>{
      const r=parseRef(l);const hs=[...l.matchAll(/\[(E\d+)[^\]]*\]/g)].map(m=>m[1]);
      const els=hs.map(h=>ELS[h]?{h,...ELS[h]}:null).filter(Boolean);
      FB.push({t:l,ref:r?r.ref:null,kind:r?r.kind:null,at:new Date().toISOString().slice(0,16),...(els.length?{els}:{})})});
    ta.value='';save();renderFb();stat('有未保存改动','');return}
  if(e.target.id==='wb-fbclr'){$('#wb-fbin').value='';return}
  const del=e.target.closest('[data-del]');if(del){FB.splice(+del.dataset.del,1);save();renderFb();return}
  if(e.target.id==='wb-elx'){PICK=null;$$('#frame .pick').forEach(x=>x.classList.remove('pick'));renderPick();return}
  if(e.target.id==='wb-elins'&&PICK){const h=PICK.h||('E'+(++ELN));PICK.h=h;ELS[h]=PICK.a;
    S.tab='fb';apply();const ta=$('#wb-fbin');
    const nice=[PICK.a.modLabel,PICK.a.dataId].filter(Boolean).join(' ')||PICK.a.sel;
    const tag=`[${h} ${nice}] `;
    const s=ta.selectionStart??ta.value.length,e2=ta.selectionEnd??s;
    ta.value=ta.value.slice(0,s)+tag+ta.value.slice(e2);ta.focus();ta.selectionStart=ta.selectionEnd=s+tag.length;
    renderPick();stat('已插入 '+h+'，接着写你的问题','');return}
  if(e.target.id==='wb-elcopy'&&PICK){const txt=elReport(PICK.a,PICK.h);
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>stat('详情已复制到剪贴板',''),
      ()=>{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
        try{document.execCommand('copy')}catch(x){}ta.remove();stat('详情已复制到剪贴板','')});return}
  const jc=e.target.closest('code[data-jump]');
  if(jc){const tk=jc.dataset.jump;const nd=NODES.find(x=>x.css===tk);if(nd)jumpToNode(nd.id);else stat(tk+' 是站点级变量，本页不可改','');return}
  const qi=e.target.closest('.qi[data-qnid]');if(qi){jumpToNode(qi.dataset.qnid);return}
  const fb=e.target.closest('.fb');if(fb){const f=FB[+fb.dataset.i];if(f&&f.kind==='node')jumpToNode(f.ref);else if(f&&f.kind==='el')jumpToEl(f.ref);return}
  const d=e.target.closest('.d');if(d){d.dataset.ids.split(',').forEach(id=>jumpToEl(id));return}
});
panel.addEventListener('mouseover',e=>{const nd=e.target.closest('.nd');if(!nd)return;$$('#frame .hl').forEach(x=>x.classList.remove('hl'));mapEls(byId[nd.dataset.nid]).forEach(el=>el.classList.add('hl'))});
panel.addEventListener('mouseleave',()=>$$('#frame .hl').forEach(x=>x.classList.remove('hl')));
function parseRef(line){let m=line.match(/^([a-z]{1,2}\.[a-z0-9.-]+)\b/i);if(m&&byId[m[1].toLowerCase()])return{kind:'node',ref:m[1].toLowerCase()};m=line.match(/^([A-Za-z][A-Za-z0-9-]*\d*)\b/);if(m){const id=m[1].toUpperCase();if(document.querySelector(`#frame [data-id="${id}"]`)||/^C\d+$/.test(id))return{kind:'el',ref:id}}return null}
/* ---------- 检查模式：任意元素可选，像 F12，但多回答一件事——哪些属性有 token、哪些没有 ---------- */
const ELS={};let ELN=0,PICK=null;
const INS_PROPS=['font-family','font-size','font-weight','line-height','letter-spacing','color','background-color',
  'border-top-width','border-radius','padding-top','padding-right','padding-bottom','padding-left',
  'margin-top','margin-bottom','gap'];
// 缺 token 只报「确实是设计决策、且当前值不是默认」的；否则一屏噪声会把真信号盖掉
const NOISE={'font-weight':'400','letter-spacing':'normal','background-color':'rgba(0, 0, 0, 0)','gap':'normal'};
function meaningful(prop,v){
  if(!v||v==='none'||v==='auto'||v==='normal')return false;
  if(NOISE[prop]===v)return false;
  if(/^(padding|margin|border|gap)/.test(prop)&&/^0(px)?$/.test(v))return false;
  if(prop==='border-radius'&&/^0(px)?$/.test(v))return false;
  return true;}
function blurFrame(){const a=document.activeElement;if(a&&a!==document.body&&frame.contains(a))a.blur();}
const ov=document.createElement('div');ov.id='wb-ov';ov.innerHTML='<i></i><b></b>';document.body.appendChild(ov);
function elName(el){
  const d=el.closest('[data-id]');const tag=el.tagName.toLowerCase();
  const cls=[...el.classList].filter(c=>!/^(hl|flash|ins-hover|on|sel)$/.test(c)).slice(0,3).map(c=>'.'+c).join('');
  return (d?d.dataset.id+' ':'')+tag+cls;}
function elSelector(el){ // 只给能在骨架 CSS 里查到的选择器：跳过无 class 的祖先，到最近的 data-id 为止
  const parts=[];let cur=el,hops=0;
  while(cur&&cur.id!=='frame'&&parts.length<3&&hops<8){
    const cls=[...cur.classList].filter(c=>!/^(hl|flash|ins-hover|on|sel|pick)$/.test(c));
    if(cls.length)parts.unshift('.'+cls.join('.'));
    else if(cur===el)parts.unshift(cur.tagName.toLowerCase());
    if(cur!==el&&cur.dataset&&cur.dataset.id)break;
    cur=cur.parentElement;hops++;}
  return parts.join(' ')||el.tagName.toLowerCase();}
// 长写属性查不到时要回落到简写：CSSOM 里 border-radius / background / padding 这些
// 只在简写上有值，按长写去取会拿到空串，误报成「写死」或「无 token」
const SHORT={'background-color':['background'],
  'border-top-width':['border-width','border-top','border'],
  'border-radius':['border-top-left-radius'],
  'padding-top':['padding'],'padding-right':['padding'],'padding-bottom':['padding'],'padding-left':['padding'],
  'margin-top':['margin'],'margin-bottom':['margin'],
  'font-size':['font'],'font-family':['font'],'font-weight':['font'],'line-height':['font']};
function analyze(el){
  const decls={};
  for(const sheet of document.styleSheets){
    let rules;try{rules=sheet.cssRules}catch(e){continue}
    const walk=rs=>{for(const r of rs){
      if(r.cssRules&&!r.selectorText){walk(r.cssRules);continue}
      if(!r.selectorText)continue;let m=false;try{m=el.matches(r.selectorText)}catch(e){}
      if(!m)continue;
      const put=(k,v)=>{if(v)decls[k]={v,sel:r.selectorText}};
      for(const prop of r.style)put(prop,r.style.getPropertyValue(prop));
      // 简写单独兜一层，枚举不一定给得出来
      ['border-radius','background','padding','margin','border','border-width','font','gap'].forEach(s=>put(s,r.style.getPropertyValue(s)));}};
    walk(rules);}
  const KW=/^(initial|inherit|unset|revert|revert-layer)$/;
  const pick=prop=>{const cands=[decls[prop],...(SHORT[prop]||[]).map(s=>decls[s])].filter(Boolean);
    return cands.find(d=>/var\(/.test(d.v))||cands.find(d=>!KW.test(d.v.trim()))||null;};
  const cs=getComputedStyle(el),tok={},hard={},none=[];
  for(const prop of INS_PROPS){const d=pick(prop);const c=cs.getPropertyValue(prop);
    if(!d){if(meaningful(prop,c))none.push(prop+': '+c);continue}
    const m=/var\((--[a-zA-Z0-9-]+)/.exec(d.v);
    if(m)tok[prop]={token:m[1],computed:c,rule:d.sel};
    else if(d.sel!==':where(#frame *)')hard[prop]={declared:d.v,computed:c,rule:d.sel};}
  const r=el.getBoundingClientRect(),fr=frame.getBoundingClientRect();
  const dataEl=el.closest('[data-id]');
  let mod=null;const scored=[];
  NODES.forEach(nd=>{if(!nd.maps)return;let best=Infinity;
    nd.maps.forEach(s=>{try{const a=el.closest(s);if(a){let d2=0;for(let x=el;x&&x!==a;x=x.parentElement)d2++;best=Math.min(best,d2)}}catch(e){}});
    if(best<Infinity)scored.push([best,nd]);});
  scored.sort((a,b)=>a[0]-b[0]||((a[1].css?0:1)-(b[1].css?0:1)));
  if(scored.length)mod=scored[0][1].mod;
  const modDef=(T.modules||[]).find(m=>m.key===mod);
  return {sel:elSelector(el),name:elName(el),dataId:dataEl?dataEl.dataset.id:null,mod,
    modLabel:modDef?modDef.label:null,impl:modDef&&modDef.impl?modDef.impl:null,
    level:S.level,state:S.state,
    box:{x:Math.round(r.left-fr.left),y:Math.round(r.top-fr.top),w:Math.round(r.width),h:Math.round(r.height)},
    text:(el.textContent||'').trim().slice(0,40),
    tokens:tok,hardcoded:hard,missing:none};}
function elReport(a,h){
  const L=[`${h?'['+h+'] ':''}${a.name}`,
    `  选择器 ${a.sel}`+(a.dataId?` · 编号 ${a.dataId}`:'')+(a.mod?` · 模块 ${a.modLabel}(${a.mod})`:''),
    `  可见于 ${a.level} / ${a.state} · 盒 ${a.box.w}×${a.box.h} @ ${a.box.x},${a.box.y}`+(a.text?` · 文本「${a.text}」`:'')];
  if(a.impl)L.push(`  产品代码 ${[].concat(a.impl).join(' , ')}`);
  const tk=Object.entries(a.tokens);
  if(tk.length)L.push('  来自 token：'+tk.map(([p,v])=>`${p}=${v.token}(${v.computed})`).join(' · '));
  const hd=Object.entries(a.hardcoded);
  if(hd.length)L.push('  ⚠ 写死：'+hd.map(([p,v])=>`${p}:${v.declared} @${v.rule}`).join(' · '));
  if(a.missing.length)L.push('  ⚠ 无人管（浏览器默认）：'+a.missing.join(' · '));
  return L.join('\n');}
function renderPick(){const box=$('#wb-el');if(!box)return;
  if(!PICK){box.innerHTML='';box.classList.remove('on');return}
  const a=PICK.a,h=PICK.h;box.classList.add('on');
  const tk=Object.entries(a.tokens),hd=Object.entries(a.hardcoded);
  box.innerHTML=`<div class="eh"><b>${esc(a.name)}</b><span class="ex" id="wb-elx" title="关掉">×</span></div>
   <div class="em">${esc(a.sel)}${a.mod?' · '+esc(a.modLabel):''}${a.dataId?' · '+esc(a.dataId):''} · ${a.box.w}×${a.box.h}</div>
   ${tk.length?`<div class="et">token ${tk.map(([p,v])=>`<code data-jump="${v.token}">${esc(p)}=${esc(v.token)}</code>`).join('')}</div>`:''}
   ${hd.length||a.missing.length?`<div class="ew">⚠ 没 token ${hd.map(([p,v])=>`<code>${esc(p)}:${esc(v.declared)}</code>`).join('')}${a.missing.map(m=>`<code>${esc(m)}</code>`).join('')}</div>`:''}
   <div class="eb"><button class="btn" id="wb-elins">插入反馈</button><button class="btn ghost" id="wb-elcopy">复制详情</button></div>`;}
function pickEl(el){const a=analyze(el);PICK={el,a,h:null};renderPick();stat('已选中 '+a.name+'，面板顶部可「插入反馈」','');
  if(a.mod){S.mod=a.mod;renderMod();}
  $$('#frame .pick').forEach(x=>x.classList.remove('pick'));el.classList.add('pick');}
/* ---------- 工具条 / 快捷键 / 检查 ---------- */
$('#wb-view').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();
  if(b.dataset.level)S.level=b.dataset.level;else if(b.dataset.state)S.state=b.dataset.state;else if(b.dataset.vp){S.vp=b.dataset.vp;const v=T.viewports.find(x=>x.key===S.vp);if(v&&v.w){$('#wb-vw').value=v.w;$('#wb-vh').value=v.h}}
  else if(b.id==='wb-fit')S.fit=true;else if(b.id==='wb-one')S.fit=false;else if(b.id==='wb-inspect'){S.inspect=!S.inspect;if(S.inspect)blurFrame();}else if(b.id==='wb-dims')S.dims=!S.dims;else if(b.id==='wb-ids')S.ids=!S.ids;else if(b.id==='wb-dark'){S.dark=!S.dark;rerender()}
  else if(b.dataset.toggle)S.toggles[b.dataset.toggle]=!S.toggles[b.dataset.toggle];else if(b.id==='wb-viewtoggle')S.viewOpen=!S.viewOpen;
  save();apply()});
['#wb-vw','#wb-vh'].forEach(s=>$(s).addEventListener('change',()=>{S.vp='custom';apply()}));
ptab.onclick=()=>{S.panel=true;save();apply()};
document.addEventListener('keydown',e=>{const t=e.target;
  // 只挡面板里的真输入（反馈框、数值框）；骨架里的 input 是设计稿的装饰件，不能让它吃掉快捷键
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)&&t.closest('#wb-panel'))return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const k=e.key.toLowerCase();if(k==='p'){S.panel=!S.panel}else if(k==='t'){S.viewOpen=!S.viewOpen;S.panel=true}else if(k==='i'){S.inspect=!S.inspect;if(S.inspect)blurFrame()}else if(k==='d'){S.dims=!S.dims}else if(k==='n'){S.ids=!S.ids}else if(k==='escape'){if(S.inspect){S.inspect=false;ov.style.display='none'}else S.panel=false}else return;e.preventDefault();save();apply()});
frame.addEventListener('mousemove',e=>{if(!S.inspect){ov.style.display='none';return}
  const el=e.target;if(!el||el===frame){ov.style.display='none';return}
  const r=el.getBoundingClientRect();ov.style.display='block';
  ov.style.left=r.left+'px';ov.style.top=r.top+'px';ov.style.width=r.width+'px';ov.style.height=r.height+'px';
  ov.querySelector('b').textContent=`${elName(el)}  ${Math.round(r.width)}×${Math.round(r.height)}`;
  ov.querySelector('b').style.top=(r.top<24?r.height:-20)+'px';});
frame.addEventListener('mouseleave',()=>{ov.style.display='none'});
frame.addEventListener('click',e=>{if(!S.inspect)return;e.preventDefault();e.stopPropagation();
  S.panel=true;apply();pickEl(e.target);},true);
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
const SERVED=location.protocol==='http:'||location.protocol==='https:';
async function saveViaServer(json){
  const r=await fetch('/api/lab/save',{method:'POST',headers:{'Content-Type':'application/json'},body:json});
  const d=await r.json().catch(()=>({ok:false,error:'返回不是 JSON'}));
  if(!r.ok||!d.ok) throw new Error(d.error||('HTTP '+r.status));
  return d;}
async function doSave(){const btn=$('#wb-save');btn.disabled=true;stat('保存中…');const json=buildJson();
  if(SERVED){
    try{const d=await saveViaServer(json);
      const msg=`已保存 ${new Date().toTimeString().slice(0,5)} → 服务直写 · 改动 ${d.changes.length} · 反馈 +${d.new_feedback.length}`;
      stat(msg,'ok');localStorage.setItem(LS+':saved',msg);
      // 自己的保存也会改文件时间戳。不把 REV 跟上，监视器下一轮就把页面重载了。
      if(d.rev)REV=d.rev;else fetch('/api/lab/status',{cache:'no-store'}).then(r=>r.json())
        .then(x=>{const r2=(x.revs||{})[T.page];if(r2)REV=r2}).catch(()=>{});
      // 磁盘现在等于页面了，基线与结局快照都要跟上，否则页面永远自认为脏
      NODES.forEach(n=>{BASE[n.id]=n.value});SAVED_D=JSON.stringify(D);
      revBar(false);rerender();
      const el=$('#wb-root');
      if(el) el.innerHTML=`已直写 ${d.files.map(esc).join('、')}`
        +(d.stale&&d.nodes_user_not_seen.length?`\n⚠ 你这个页面是旧的，以下节点你还没见过（已按 id 合并，没覆盖掉）：\n${d.nodes_user_not_seen.join(', ')}\n刷新页面就能看到。`:'')
        +(d.warnings&&d.warnings.length?`\n提示：${d.warnings.slice(0,3).join('；')}`:'');
    }catch(e){stat('保存失败：'+(e.message||e),'bad')}
    finally{btn.disabled=false}
    return;}const payload={json,js:'// 由 '+T.files.json.split('/').pop()+' 生成，勿手改\nwindow.WB_SPEC='+json+';\n',css:buildCss()};
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
WB.set=patch=>{Object.assign(S,patch);save();apply()};WB.state=S;WB.jumpToEl=jumpToEl;WB.jumpToNode=jumpToNode;WB.spec=T;WB.byId=byId;WB.fmt=fmt;WB.dirty=()=>dirty();WB.dirtyWhat=()=>dirtyWhat();
/* ---------- 启动 ---------- */
load();
if(S.vp!=='follow'){const v=T.viewports.find(x=>x.key===S.vp);if(v&&v.w){$('#wb-vw').value=v.w;$('#wb-vh').value=v.h}}
apply();rerender();setTimeout(drift,400);
const saved=localStorage.getItem(LS+':saved');if(saved)stat(saved,'ok');
if(STALE_EDITS.length)stat('文件已更新，本地 '+STALE_EDITS.length+' 处旧改动已丢弃（以文件为准）：'+STALE_EDITS.slice(0,6).join('、'),'bad');
/* 文件监视：页面一加载就把 spec 读进内存，此后 Agent 改文件它无从知晓。
   没有这一段，用户可以对着旧稿审半小时，保存下去还会把旧值写回磁盘。
   有未保存改动时不擅自重载，出提示条让用户决定。 */
let REV=null,REVBUSY=false,PENDING=null;
/* 判断真的有未保存的东西。原来写成「D 非空」是错的：结局一旦保存过就一直非空，
   页面于是永远认为自己是脏的，自动重载那条路等于死掉，每次文件变动都只能弹提示条。 */
function dirty(){return NODES.some(isChanged)||JSON.stringify(D)!==SAVED_D}
function dirtyWhat(){const v=NODES.filter(isChanged).length;
  return [v?v+' 处改值':'',JSON.stringify(D)!==SAVED_D?'结局有变动':''].filter(Boolean).join(' · ')}
function revBar(show){let el=$('#wb-rev');
  if(!show){if(el)el.remove();return}
  if(el)return;
  el=document.createElement('div');el.id='wb-rev';
  el.innerHTML='<b>文件已更新</b>（Agent 改过页面包）。你还有没保存的东西（'+(dirtyWhat()||'未知')
    +'），重载会丢掉。先点保存，或者：'
    +'<button id="wb-rev-go">丢掉并重载</button><button id="wb-rev-no">先不管</button>';
  document.body.appendChild(el);
  el.querySelector('#wb-rev-go').onclick=()=>location.reload();
  el.querySelector('#wb-rev-no').onclick=()=>{el.remove();REV=null};}
function watchRev(){
  if(!SERVED||REVBUSY||document.hidden)return;REVBUSY=true;
  fetch('/api/lab/status',{cache:'no-store'}).then(r=>r.json()).then(d=>{
    const r=(d.revs||{})[T.page];if(!r)return;
    if(REV===null){REV=r;PENDING=null;return}
    if(r===REV){PENDING=null;return}
    // Agent 往往连着改好几个文件。等同一个新版本戳连续看到两轮再动作，
    // 免得在他改到一半时重载出一个半成品。
    if(PENDING!==r){PENDING=r;return}
    if(dirty()){revBar(true)}          // 有未保存改动：交给用户决定
    else{stat('文件已更新，正在重载…','ok');location.reload()}   // 没有：直接换成新稿
  }).catch(()=>{}).finally(()=>{REVBUSY=false});}
if(SERVED){fetch('/api/lab/status').then(r=>r.json()).then(d=>{
    const b=$('#wb-bind');if(b)b.className='wb-status ok',b.textContent=`服务模式 · 直写 ${d.repo}\n点「保存」即写盘，不用选目录、不下载。存完回对话说一声即可。\n页面会自己盯着文件：Agent 改过页面包后，没有未保存改动就自动重载，有就出提示条问你。`;
    const rt=$('#wb-root');if(rt)rt.textContent='服务模式下本节不适用。';
    REV=(d.revs||{})[T.page]||null;setInterval(watchRev,4000);
  }).catch(()=>{const b=$('#wb-bind');if(b)b.className='wb-status bad',b.textContent='页面走的是 HTTP，但没探测到工作台服务（/api/lab/status 不通）。保存会失败。';});}
else{const b=$('#wb-bind');if(b)b.className='wb-status bad',b.textContent='file:// 打开 ⚠ 保存要手动选目录，容易存错仓库（主仓库与 worktree 都有 docs/ 和 frontend-react/，分不出来）。\n建议改用服务：python3 {skill}/scripts/serve.py <仓库根>';
  idb.get('root').then(r=>{if(r)$('#wb-root').textContent='已授权：'+r.name+'/（重开浏览器后首次保存可能再确认一次）'}).catch(()=>{});}
if(H.fonts&&document.fonts){document.fonts.ready.then(()=>{const ok=H.fonts.every(f=>document.fonts.check(f));const b=$('#wb-font');b.textContent=ok?'字体 ✓':'字体 ✗ 回退';b.className='font '+(ok?'ok':'bad')})}
};
})();
