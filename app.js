/* ============================================================
   BiteFlow app logic
   1. Loads the ingredient table and the weekly menus (weeks/*.json)
   2. Shows the newest week that is already live (07:00 Monday, Malta)
   3. Works out nutrition per serving from grams, never typed by hand
   4. Swipe deck, This week grid, Saved grid, recipe page, 1-5 star ratings
   ============================================================ */

/* Ratings live in Supabase. This is the public "publishable" key: the database only
   allows two actions with it (save a rating, read averages). */
const SUPABASE_URL='https://javjhsivqulsrpywvgso.supabase.co';
const SUPABASE_KEY='sb_publishable_znspBYAffdx8YWOxsToEcg_kh9fyyZe';

let ING={},RECIPES=[],ALL=[],WEEK=null,NEXT=null;
const PREVIEW=new URLSearchParams(location.search).has('preview')||location.hash==='#preview';
const $=id=>document.getElementById(id);
const R=n=>Math.round(n);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz=ms=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* ---------- loading the menus ---------- */
async function getJSON(p){const r=await fetch(p,{cache:'no-cache'});if(!r.ok)throw new Error(p);return r.json()}
async function load(){
  const [ing,idx]=await Promise.all([getJSON('data/ingredients.json'),getJSON('weeks/index.json')]);
  ING=ing.items;
  const now=Date.now();
  const weeks=idx.weeks.slice().sort((a,b)=>Date.parse(a.live)-Date.parse(b.live));
  const live=weeks.filter(w=>Date.parse(w.live)<=now);
  WEEK=PREVIEW?weeks[weeks.length-1]:(live[live.length-1]||weeks[0]);
  NEXT=weeks.find(w=>Date.parse(w.live)>Math.max(now,Date.parse(WEEK.live)))||null;
  const shown=weeks.filter(w=>Date.parse(w.live)<=Date.parse(WEEK.live));
  const files=await Promise.all(shown.map(w=>getJSON(`weeks/${w.week}.json`).catch(()=>null)));
  files.forEach((f,i)=>{if(!f)return;f.recipes.forEach(r=>{r.week=shown[i].week;r.n=nutr(r);ALL.push(r)})});
  RECIPES=ALL.filter(r=>r.week===WEEK.week);
  ALL.forEach(loadPhoto);
}

/* ---------- nutrition ---------- */
function nutr(r){const t={k:0,p:0,c:0,f:0,fi:0};
  r.ing.forEach(([key,g])=>{const i=ING[key];if(!i)return;for(const m in t)t[m]+=i[m]*g/100});
  for(const m in t)t[m]/=r.serves;return t}

/* ---------- photos: photos/<week>/<recipe id>.jpg, gradient until it exists ---------- */
function photoURL(r){return `photos/${r.week}/${r.id}.jpg`}
function loadPhoto(r){const im=new Image();im.onload=()=>{r.img=photoURL(r);document.querySelectorAll(`[data-photo="${r.id}"]`).forEach(el=>el.style.backgroundImage=bgImg(r))};im.src=photoURL(r)}
function bgImg(r){return r.img?`url('${r.img}')`:`radial-gradient(circle at 50% 38%,rgba(255,255,255,.28) 0 20%,rgba(255,255,255,.1) 20.5% 28%,transparent 28.5%),linear-gradient(155deg,${r.colors[0]},${r.colors[1]})`}

/* ---------- ratings ---------- */
let device='';try{device=localStorage.getItem('biteflow-device')||''}catch(e){}
if(!device){device=crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
  try{localStorage.setItem('biteflow-device',device)}catch(e){}}
let mine=store.get('biteflow-ratings',{});
const scores={};let ratingsOnline=true;
async function rpc(fn,body){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:'POST',
  headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(fn);const t=await r.text();return t?JSON.parse(t):null}
async function loadScores(ids){try{const rows=await rpc('biteflow_summary',{p_recipes:ids});
  rows.forEach(x=>scores[x.recipe_id]={avg:+x.avg_stars,votes:+x.votes});ratingsOnline=true}catch(e){ratingsOnline=false}}
async function rate(r,stars){
  const prev=mine[r.id];mine[r.id]=stars;store.set('biteflow-ratings',mine);buzz(12);
  const s=scores[r.id]||{avg:0,votes:0};
  const total=s.avg*s.votes-(prev||0)+stars,votes=s.votes+(prev?0:1);scores[r.id]={avg:Math.round(total/votes*10)/10,votes};
  renderRate(r,stars);
  try{await rpc('biteflow_rate',{p_recipe:r.id,p_device:device,p_stars:stars});await loadScores([r.id]);renderRate(r)}
  catch(e){ratingsOnline=false;renderRate(r)}}
const starSVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
function renderRate(r,popTo){const box=$('rateBox');if(!box||box.dataset.id!==r.id)return;
  const my=mine[r.id]||0,s=scores[r.id];
  box.querySelector('.stars').innerHTML=[1,2,3,4,5].map(n=>
    `<button class="${n<=my?'on':''}" data-s="${n}" aria-label="${n} star${n>1?'s':''}" aria-pressed="${n===my}">${starSVG}</button>`).join('');
  if(popTo&&!calm)box.querySelectorAll('.stars button.on').forEach((b,i)=>{b.style.animationDelay=i*40+'ms';b.classList.add('pop')});
  box.querySelector('p').innerHTML=!ratingsOnline?'Ratings are offline right now. Yours is saved on this phone.'
    :s&&s.votes?`Average <b>★ ${s.avg.toFixed(1)}</b> from ${s.votes} rating${s.votes>1?'s':''}${my?` · you gave ${my}`:''}`
    :my?`You gave it ${my}.`:'No ratings yet. Cooked it? Be the first.'}

/* ---------- filters with a sliding indicator ---------- */
const FILTERS=[
 ['all','All',()=>true],
 ['quick','15 min or less',r=>r.time<=15],
 ['protein','30 g+ protein',r=>r.n.p>=30],
 ['light','Under 450 kcal',r=>r.n.k<450],
 ['veg','Vegetarian',r=>r.veg],
 ['vegan','Vegan',r=>r.vegan],
 ['breakfast','Breakfast',r=>r.meal==='Breakfast'],
 ['prep','Meal prep',r=>r.prep||r.serves>=3]
];
let filter='all',deck=[],idx=0,saved=new Set(store.get('biteflow-saved',[])),tab=0;
const fn=()=>FILTERS.find(f=>f[0]===filter)[2];

function renderChips(){$('chips').innerHTML=FILTERS.map(([id,label])=>
  `<button class="chip" data-f="${id}" aria-pressed="${filter===id}">${label}</button>`).join('');moveChipDot(true)}
function moveChipDot(instant){const b=$('chips').querySelector('[aria-pressed="true"]'),dot=$('chipdot');if(!b)return;
  const x=b.offsetLeft-$('chips').scrollLeft+3;
  if(instant){dot.style.transition='none';requestAnimationFrame(()=>dot.style.transition='')}
  dot.style.width=b.offsetWidth+'px';dot.style.transform=`translateX(${x-3}px)`}
$('chips').addEventListener('scroll',()=>moveChipDot(true),{passive:true});
$('chips').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b||b.dataset.f===filter)return;filter=b.dataset.f;buzz(8);
  $('chips').querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c===b));
  b.scrollIntoView({behavior:calm?'auto':'smooth',inline:'center',block:'nearest'});moveChipDot();build();renderWeek()});
addEventListener('resize',()=>moveChipDot(true));

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function build(mix){deck=RECIPES.filter(fn());if(mix)shuffle(deck);idx=0;renderDeck()}

/* ---------- deck ---------- */
const tags=r=>`${esc(r.cuisine)} · ${r.meal}${r.vegan?' · Vegan':r.veg?' · Veggie':''}`;
const star=r=>{const s=scores[r.id];return s&&s.votes?`★ ${s.avg.toFixed(1)}`:''};
let hinted=store.get('biteflow-hinted',false);
function cardHTML(r,pos){return `
  <div class="shade"></div>
  <div class="topline"><span class="tag">${pos}</span>${star(r)?`<span class="tag star">${star(r)}</span>`:''}</div>
  <div class="stamp open">Cook</div><div class="stamp skip">Skip</div>
  ${!hinted&&pos.startsWith('1 ')?`<div class="hint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>Swipe right to cook, left to skip</div>`:''}
  <div class="info">
    <div class="eyebrow">${tags(r)}</div>
    <h2>${esc(r.name)}</h2>
    <p>${esc(r.desc)}</p>
    <div class="pills"><span class="pill">${r.time} min</span><span class="pill">${R(r.n.k)} kcal</span><span class="pill hi">${R(r.n.p)} g protein</span></div>
  </div>`}

function renderDeck(promote){const d=$('deck');d.innerHTML='';
  const slice=deck.slice(idx,idx+3);
  $('saveBtn').setAttribute('aria-pressed',!!(deck[idx]&&saved.has(deck[idx].id)));
  if(!slice.length){d.innerHTML=`<div class="empty glass"><img src="assets/leaf.png" alt=""><h3>Menu cleared</h3><p>${deck.length?`You've seen all ${deck.length} meals in this filter.`:'Nothing matches this filter this week. Try another chip.'}${NEXT?` Fresh meals land ${dropText(NEXT)}.`:''}</p>${deck.length?'<button class="btn" id="again">Shuffle and go again</button>':''}</div>`;
    const a=$('again');if(a)a.onclick=()=>build(true);return}
  slice.slice().reverse().forEach((r,ri)=>{const depth=slice.length-1-ri;const el=document.createElement('article');
    el.className='card'+(depth===0?' top':'');el.dataset.photo=r.id;el.style.backgroundImage=bgImg(r);
    el.innerHTML=cardHTML(r,`${idx+depth+1} / ${deck.length}`);
    const rest=`translateY(${depth*14}px) scale(${1-depth*.05})`;
    if(promote&&!calm){el.style.transition='none';el.style.transform=`translateY(${(depth+1)*14}px) scale(${1-(depth+1)*.05})`;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition='';el.style.transform=rest}))}
    else el.style.transform=rest;
    el.style.zIndex=10-depth;
    if(depth===0){el.tabIndex=0;el.setAttribute('aria-label',r.name);drag(el,r)}else el.setAttribute('aria-hidden','true');
    d.appendChild(el)})}

function drag(el,r){let sx=0,sy=0,dx=0,dy=0,on=false;const so=el.querySelector('.stamp.open'),sk=el.querySelector('.stamp.skip');
  el.addEventListener('pointerdown',e=>{on=true;sx=e.clientX;sy=e.clientY;dx=dy=0;el.setPointerCapture(e.pointerId);el.style.transition='none';
    const h=el.querySelector('.hint');if(h)h.remove()});
  el.addEventListener('pointermove',e=>{if(!on)return;dx=e.clientX-sx;dy=e.clientY-sy;
    el.style.transform=`translate(${dx}px,${dy*.3}px) rotate(${dx/16}deg)`;
    so.style.opacity=Math.min(1,Math.max(0,dx/90));sk.style.opacity=Math.min(1,Math.max(0,-dx/90))});
  const end=()=>{if(!on)return;on=false;el.style.transition='';
    if(dx>100)fly(el,1,r);else if(dx<-100)fly(el,-1,r);
    else{el.style.transform='';so.style.opacity=sk.style.opacity=0;if(Math.abs(dx)<6&&Math.abs(dy)<6)openDetail(r,el)}};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)}

let busy=false;
function fly(el,dir,r){if(busy)return;busy=true;buzz(dir>0?14:6);
  if(!hinted){hinted=true;store.set('biteflow-hinted',true)}
  el.querySelector(dir>0?'.stamp.open':'.stamp.skip').style.opacity=1;
  if(dir>0){busy=false;idx++;el.style.transition='transform .3s var(--spring)';el.style.transform='';openDetail(r,el,()=>renderDeck(true));return}
  el.style.transition='transform .34s var(--in),opacity .34s';
  el.style.transform=`translate(${-window.innerWidth*1.1}px,40px) rotate(-26deg)`;el.style.opacity=0;
  setTimeout(()=>{idx++;renderDeck(true);busy=false},260)}
function topCard(){return $('deck').querySelector('.card.top')}

$('skipBtn').onclick=()=>{const el=topCard();if(el)fly(el,-1,deck[idx])};
$('openBtn').onclick=()=>{const el=topCard();if(el)fly(el,1,deck[idx])};
$('saveBtn').onclick=e=>{const r=deck[idx];if(!r)return;toggleSave(r.id,e.currentTarget);$('saveBtn').setAttribute('aria-pressed',saved.has(r.id))};

function burst(btn){if(calm)return;for(let i=0;i<8;i++){const a=i/8*Math.PI*2,s=document.createElement('i');s.className='burst';
  s.style.setProperty('--dx',Math.cos(a)*38+'px');s.style.setProperty('--dy',Math.sin(a)*38+'px');btn.appendChild(s);setTimeout(()=>s.remove(),600)}}
function popEl(el){if(calm||!el)return;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}
function setCount(bump){const n=[...saved].filter(id=>ALL.some(r=>r.id===id)).length,c=$('savedCount');c.textContent=n;c.dataset.n=n;if(bump)popEl(c)}
function toggleSave(id,btn){const on=!saved.has(id);on?saved.add(id):saved.delete(id);store.set('biteflow-saved',[...saved]);
  setCount(on);buzz(on?[10,40,10]:8);if(btn){popEl(btn.querySelector('svg')||btn);if(on)burst(btn)}
  toast(on?'Saved for later':'Removed from saved');if(tab===2)renderSaved()}

let tt;function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),1400)}

/* ---------- tabs: sliding indicator, content follows direction ---------- */
const VIEWS=['vDiscover','vWeek','vSaved'];
function setTab(n){if(n===tab)return;buzz(8);const old=tab;tab=n;
  document.querySelectorAll('.tab').forEach(b=>{const on=+b.dataset.tab===n;on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')});
  $('tabdot').style.transform=`translateX(${n*100}%)`;
  VIEWS.forEach((id,i)=>$(id).dataset.pos=i===n?'center':i<n?'left':'right');
  $('rail').classList.toggle('saved',n===2);
  if(n===1)renderWeek(true);if(n===2)renderSaved(true)}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setTab(+b.dataset.tab));

/* ---------- grids ---------- */
function tileHTML(r,i,animate){const s=star(r);return `<li class="${animate&&!calm?'enter':''}" style="animation-delay:${Math.min(i,12)*30}ms"><button class="tile" data-id="${r.id}">
  <span class="ph" data-photo="${r.id}" style="background-image:${bgImg(r)}">${s?`<span class="tag star">${s}</span>`:''}</span>
  <span class="tx"><strong>${esc(r.name)}</strong><small><span>${R(r.n.k)} kcal</span><span><b>${R(r.n.p)} g</b> protein</span></small></span></button></li>`}
function renderWeek(animate){const list=RECIPES.filter(fn());
  $('weekGrid').innerHTML=list.length?list.map((r,i)=>tileHTML(r,i,animate)).join('')
    :'<li class="gridempty"><h3>No matches</h3><p>Nothing this week fits that filter. Tap All to see every meal.</p></li>'}
function renderSaved(animate){const list=ALL.filter(r=>saved.has(r.id));
  $('savedGrid').innerHTML=list.length?list.map((r,i)=>tileHTML(r,i,animate)).join('')
    :`<li class="gridempty"><span class="heart glass"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></span><h3>Nothing saved yet</h3><p>Tap the heart on any meal you want to cook. Saved meals stay here after the weekly menu changes.</p><button class="btn" id="goSwipe">Start swiping</button></li>`;
  const g=$('goSwipe');if(g)g.onclick=()=>setTab(0)}
['weekGrid','savedGrid'].forEach(id=>$(id).addEventListener('click',e=>{const b=e.target.closest('.tile');if(b)openDetail(ALL.find(r=>r.id===b.dataset.id),b.querySelector('.ph'))}));

/* ---------- recipe page: grows out of the card or tile it came from ---------- */
const heart='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
let openR=null,openSrc=null,afterClose=null;
function insetOf(el){const b=el.getBoundingClientRect(),W=innerWidth,H=innerHeight;
  return `inset(${Math.max(0,b.top)}px ${Math.max(0,W-b.right)}px ${Math.max(0,H-b.bottom)}px ${Math.max(0,b.left)}px round 26px)`}
function ring(n){const C=2*Math.PI*52,pk=n.p*4,ck=n.c*4,fk=n.f*9,t=pk+ck+fk||1,gap=6;
  const segs=[[pk,'var(--coral)'],[ck,'var(--lime)'],[fk,'var(--green)']];let off=0;
  return `<svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="52" stroke="rgba(31,107,79,.08)"/>`+segs.map(([v,c])=>{const len=Math.max(0,v/t*C-gap);
    const s=`<circle cx="66" cy="66" r="52" stroke="${c}" data-len="${len.toFixed(1)}" stroke-dasharray="0 ${C}" stroke-dashoffset="${(-off).toFixed(1)}"/>`;off+=v/t*C;return s}).join('')+'</svg>'}
function openDetail(r,src,onClosed){openR=r;openSrc=src||null;afterClose=onClosed||null;buzz(10);
  const n=r.n,pk=n.p*4,ck=n.c*4,fk=n.f*9,tot=pk+ck+fk||1,pct=x=>R(x/tot*100);
  const sheet=$('detail');
  sheet.innerHTML=`
  <div class="hero" data-photo="${r.id}" style="background-image:${bgImg(r)}">
    <button class="fab back glass" id="dBack" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
    <button class="fab fav glass" id="dFav" aria-label="Save" aria-pressed="${saved.has(r.id)}">${heart}</button>
  </div>
  <div class="body">
    <div class="titlecard glass"><div class="eyebrow">${tags(r).replace('Veggie','Vegetarian')}</div>
      <h1>${esc(r.name)}</h1><p>${esc(r.desc)}</p>
      <div class="meta"><span>${r.time} min${r.timeNote?' '+esc(r.timeNote):''}</span><span>Serves ${r.serves}</span><span>${r.ing.filter(i=>i[1]>0).length} ingredients</span></div></div>
    <div class="nutri glass" aria-label="Per serving: ${R(n.k)} kcal, protein ${R(n.p)} g, carbs ${R(n.c)} g, fat ${R(n.f)} g">
      <div class="ring">${ring(n)}<div class="ctr"><b>${R(n.k)}</b><span>kcal</span></div></div>
      <div class="bars">
        <div class="bar"><div class="lab"><span>Protein</span><b>${R(n.p)} g</b></div><div class="tr"><i style="--v:${Math.min(1,n.p/50)};background:var(--coral)"></i></div></div>
        <div class="bar"><div class="lab"><span>Carbs</span><b>${R(n.c)} g</b></div><div class="tr"><i style="--v:${Math.min(1,n.c/90)};background:var(--lime);transition-delay:80ms"></i></div></div>
        <div class="bar"><div class="lab"><span>Fat</span><b>${R(n.f)} g</b></div><div class="tr"><i style="--v:${Math.min(1,n.f/40)};background:var(--green);transition-delay:160ms"></i></div></div>
      </div>
      <div class="foot"><span>Fibre <b>${R(n.fi)} g</b></span><span>Protein ${pct(pk)}% of kcal</span></div>
    </div>
    <div><h3 class="sec">Ingredients</h3><p class="subt">For ${r.serves} serving${r.serves>1?'s':''}</p>
      <ul class="ing">${r.ing.map(([k,g,l])=>`<li><span>${esc(l||(ING[k]?ING[k].n:k))}</span><span>${g?g+' g':'to taste'}</span></li>`).join('')}</ul></div>
    <div><h3 class="sec" style="margin-bottom:12px">Method</h3><ol class="steps">${r.steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')}</ol></div>
    ${r.tip?`<p class="tipbox"><b>Busy-day tip:</b> ${esc(r.tip)}</p>`:''}
    <div class="rate glass" id="rateBox" data-id="${r.id}"><h3>Cooked it? Rate it</h3><div class="stars" role="group" aria-label="Your rating"></div><p></p></div>
    <p class="note">Nutrition is worked out per serving from standard food-table values for each ingredient by weight. Brands vary, so treat it as a close estimate.</p>
  </div>`;
  renderRate(r);
  $('rateBox').querySelector('.stars').onclick=e=>{const b=e.target.closest('button[data-s]');if(b)rate(r,+b.dataset.s)};
  $('dBack').onclick=closeDetail;
  $('dFav').onclick=e=>{toggleSave(r.id,e.currentTarget);syncSave()};
  $('dockKcal').innerHTML=`<span><b>${R(n.k)}</b> kcal</span><span><b>${R(n.p)} g</b> protein</span>`;
  syncSave();
  sheet.querySelectorAll('.body>*').forEach((c,i)=>c.style.transitionDelay=(140+i*40)+'ms');
  sheet.scrollTop=0;
  sheet.style.transition='none';
  sheet.style.clipPath=src&&!calm?insetOf(src):'inset(0 0 0 0 round 0px)';
  sheet.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    sheet.style.transition=calm?'none':'clip-path .44s var(--out)';
    sheet.style.clipPath='inset(0px 0px 0px 0px round 0px)';sheet.classList.add('in');$('dock').classList.add('show');
    sheet.querySelectorAll('.ring circle[data-len]').forEach(c=>{const C=2*Math.PI*52;c.setAttribute('stroke-dasharray',`${c.dataset.len} ${C}`)});
  }));
  history.pushState({sheet:1},'');
  setTimeout(()=>$('dBack').focus({preventScroll:true}),450)}
function syncSave(){if(!openR)return;const on=saved.has(openR.id),b=$('dockSave');
  b.setAttribute('aria-pressed',on);b.innerHTML=`${heart}${on?'Saved':'Save for later'}`;const f=$('dFav');if(f)f.setAttribute('aria-pressed',on);
  if(deck[idx])$('saveBtn').setAttribute('aria-pressed',saved.has(deck[idx].id))}
$('dockSave').onclick=e=>{if(openR){toggleSave(openR.id,e.currentTarget);syncSave()}};
function closeDetail(fromPop){const sheet=$('detail');if(!sheet.classList.contains('show'))return;
  if(fromPop!==true&&history.state&&history.state.sheet){history.back();return}
  $('dock').classList.remove('show');sheet.classList.remove('in');
  const target=openSrc&&openSrc.isConnected&&!calm?insetOf(openSrc):`inset(100% 0px 0px 0px round 26px)`;
  sheet.style.transition=calm?'none':'clip-path .36s var(--in)';sheet.style.clipPath=target;
  const done=()=>{sheet.classList.remove('show');sheet.innerHTML='';const cb=afterClose;afterClose=null;openR=null;if(cb)cb()};
  calm?done():setTimeout(done,340)}
addEventListener('popstate',()=>closeDetail(true));

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeDetail();return}
  if($('detail').classList.contains('show')||tab!==0)return;
  if(e.key==='ArrowRight')$('openBtn').click();if(e.key==='ArrowLeft')$('skipBtn').click()});

/* ---------- header text ---------- */
const TZ='Europe/Malta';
function dropText(w){const d=new Date(w.live);
  return d.toLocaleDateString('en-GB',{weekday:'long',timeZone:TZ})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:TZ})}
function countdown(w){const ms=Date.parse(w.live)-Date.now();if(ms<=0)return 'now';const h=Math.floor(ms/36e5),d=Math.floor(h/24);
  return d?`${d}d ${h%24}h`:h?`${h}h ${Math.floor(ms/6e4)%60}m`:`${Math.max(1,Math.floor(ms/6e4))}m`}
function header(){const h=new Date().getHours();
  $('greet').innerHTML=`What's for <span>${h<11?'breakfast':h<16?'lunch':'dinner'}?</span>`;
  const wk=new Date(WEEK.week+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  $('sub').innerHTML=`<b>${RECIPES.length} meals</b><span>· week of ${wk}</span>`;
  if(NEXT&&!PREVIEW){const d=$('drop');d.hidden=false;d.querySelector('span').textContent=`New menu in ${countdown(NEXT)}`;d.title=`Next menu: ${dropText(NEXT)}`}
  if(PREVIEW)$('previewBanner').innerHTML=`<div class="preview">Preview: this menu goes live ${dropText(WEEK)}</div>`}

/* ---------- start ---------- */
(async()=>{
  try{await load()}catch(e){$('deck').innerHTML='<div class="empty glass"><h3>Menu didn\'t load</h3><p>Check your connection, then pull down or reopen the app to try again.</p><button class="btn" onclick="location.reload()">Try again</button></div>';return}
  header();setCount();renderChips();build(true);renderWeek();renderSaved();
  await loadScores(ALL.map(r=>r.id));renderDeck();renderWeek();
  setInterval(header,60000);
})();
