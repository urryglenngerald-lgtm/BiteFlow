/* ============================================================
   BiteFlow app logic
   1. Loads the ingredient table and the weekly menus (weeks/*.json)
   2. Shows the newest week that is already live (07:00 Monday, Malta)
   3. Works out nutrition per serving from grams, never typed by hand
   4. Swipe deck, recipe page, saved list, shared 1-5 star ratings
   ============================================================ */

/* Ratings live in Supabase. This key is the public "publishable" key: it is
   safe in the page because the database only allows two actions with it
   (save a rating, read averages). */
const SUPABASE_URL='https://javjhsivqulsrpywvgso.supabase.co';
const SUPABASE_KEY='sb_publishable_znspBYAffdx8YWOxsToEcg_kh9fyyZe';

let ING={},RECIPES=[],ALL=[],WEEK=null,NEXT=null;
const PREVIEW=new URLSearchParams(location.search).has('preview');
const $=id=>document.getElementById(id);
const R=n=>Math.round(n);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- loading the menus ---------- */
async function getJSON(p){const r=await fetch(p,{cache:'no-cache'});if(!r.ok)throw new Error(p);return r.json()}
async function load(){
  const [ing,idx]=await Promise.all([getJSON('data/ingredients.json'),getJSON('weeks/index.json')]);
  ING=ing.items;
  const now=Date.now();
  const weeks=idx.weeks.slice().sort((a,b)=>Date.parse(a.live)-Date.parse(b.live));
  const live=weeks.filter(w=>Date.parse(w.live)<=now);
  WEEK=PREVIEW?weeks[weeks.length-1]:(live[live.length-1]||weeks[0]);
  NEXT=weeks.find(w=>Date.parse(w.live)>now)||null;
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
function loadPhoto(r){const im=new Image();im.onload=()=>{r.img=photoURL(r);refreshPhoto(r)};im.src=photoURL(r)}
function refreshPhoto(r){document.querySelectorAll(`[data-photo="${r.id}"]`).forEach(el=>{
  el.style.background=bg(r);el.querySelector(':scope > .slot')?.remove()})}
function bg(r){return r.img?`url('${r.img}') center/cover`:
 `radial-gradient(circle at 50% 36%,rgba(255,255,255,.3) 0 19%,rgba(255,255,255,.12) 19.5% 27%,transparent 27.5%),linear-gradient(155deg,${r.colors[0]},${r.colors[1]})`}

/* ---------- ratings ---------- */
let device='';try{device=localStorage.getItem('biteflow-device')||''}catch(e){}
if(!device){device=(crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
  try{localStorage.setItem('biteflow-device',device)}catch(e){}}
let mine={};try{mine=JSON.parse(localStorage.getItem('biteflow-ratings')||'{}')}catch(e){}
const scores={};let ratingsOnline=true;
async function rpc(fn,body){const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:'POST',
  headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(fn);const t=await r.text();return t?JSON.parse(t):null}
async function loadScores(ids){try{const rows=await rpc('biteflow_summary',{p_recipes:ids});
  rows.forEach(x=>scores[x.recipe_id]={avg:+x.avg_stars,votes:+x.votes});ratingsOnline=true}catch(e){ratingsOnline=false}}
async function rate(r,stars){
  const prev=mine[r.id];mine[r.id]=stars;try{localStorage.setItem('biteflow-ratings',JSON.stringify(mine))}catch(e){}
  const s=scores[r.id]||{avg:0,votes:0};  /* show the new average straight away */
  const total=s.avg*s.votes-(prev||0)+stars,votes=s.votes+(prev?0:1);scores[r.id]={avg:Math.round(total/votes*10)/10,votes};
  renderRate(r);
  try{await rpc('biteflow_rate',{p_recipe:r.id,p_device:device,p_stars:stars});await loadScores([r.id]);renderRate(r)}
  catch(e){ratingsOnline=false;renderRate(r)}}
const starSVG='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
function renderRate(r){const box=$('rateBox');if(!box||box.dataset.id!==r.id)return;
  const my=mine[r.id]||0,s=scores[r.id];
  box.querySelector('.stars').innerHTML=[1,2,3,4,5].map(n=>
    `<button class="${n<=my?'on':''}" data-s="${n}" aria-label="${n} star${n>1?'s':''}" aria-pressed="${n===my}">${starSVG}</button>`).join('');
  box.querySelector('p').innerHTML=!ratingsOnline?'Ratings are offline right now. Yours is saved on this phone.'
    :s&&s.votes?`Average <b>★ ${s.avg.toFixed(1)}</b> from ${s.votes} rating${s.votes>1?'s':''}${my?` · you gave ${my}`:''}`
    :my?`You gave it ${my}.`:'No ratings yet. Cooked it? Be the first.'}

/* ---------- filters ---------- */
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
let filter='all',deck=[],idx=0,saved=new Set();
try{saved=new Set(JSON.parse(localStorage.getItem('biteflow-saved')||'[]'))}catch(e){}
const persist=()=>{try{localStorage.setItem('biteflow-saved',JSON.stringify([...saved]))}catch(e){}};

function renderChips(){$('chips').innerHTML=FILTERS.map(([id,label])=>
  `<button class="chip" data-f="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}
$('chips').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;filter=b.dataset.f;renderChips();build()});

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function build(mix){const fn=FILTERS.find(f=>f[0]===filter)[2];deck=RECIPES.filter(fn);if(mix)shuffle(deck);idx=0;renderDeck()}

/* ---------- deck ---------- */
const tags=r=>`${esc(r.cuisine)} · ${r.meal}${r.vegan?' · Vegan':r.veg?' · Veggie':''}`;
function cardHTML(r){const s=scores[r.id];return `
  ${r.img?'':'<div class="slot">Photo slot</div>'}
  <div class="shade"></div>
  <div class="stamp open">Open</div><div class="stamp skip">Skip</div>
  <div class="info">
    <div class="eyebrow">${tags(r)}</div>
    <h2>${esc(r.name)}</h2>
    <p>${esc(r.desc)}</p>
    <div class="pills"><span class="pill">${r.time} min</span><span class="pill">${R(r.n.k)} kcal</span><span class="pill hi">${R(r.n.p)} g protein</span>${s&&s.votes?`<span class="pill star">★ ${s.avg.toFixed(1)}</span>`:''}</div>
  </div>`}

function renderDeck(){const d=$('deck');d.innerHTML='';
  const slice=deck.slice(idx,idx+3);
  $('saveBtn').setAttribute('aria-pressed',!!(deck[idx]&&saved.has(deck[idx].id)));
  if(!slice.length){d.innerHTML=`<div class="empty"><img src="assets/leaf.png" alt=""><h3>You've cleared the menu</h3><p>${deck.length?`You've seen all ${deck.length} meals in this filter.`:'Nothing matches this filter this week.'}${NEXT?` New meals drop ${dropText(NEXT)}.`:''}</p><button class="btn" id="again">Shuffle and go again</button></div>`;
    $('again').onclick=()=>build(true);return}
  slice.slice().reverse().forEach((r,ri)=>{const depth=slice.length-1-ri;const el=document.createElement('article');
    el.className='card';el.dataset.photo=r.id;el.style.background=bg(r);el.innerHTML=cardHTML(r);
    el.style.transform=`translateY(${depth*12}px) scale(${1-depth*.045})`;el.style.zIndex=10-depth;
    if(depth===0){el.tabIndex=0;el.setAttribute('aria-label',r.name);drag(el,r)}else el.setAttribute('aria-hidden','true');
    d.appendChild(el)})}

function drag(el,r){let sx=0,sy=0,dx=0,dy=0,on=false;const so=el.querySelector('.stamp.open'),sk=el.querySelector('.stamp.skip');
  el.addEventListener('pointerdown',e=>{on=true;sx=e.clientX;sy=e.clientY;dx=dy=0;el.setPointerCapture(e.pointerId);el.style.transition='none'});
  el.addEventListener('pointermove',e=>{if(!on)return;dx=e.clientX-sx;dy=e.clientY-sy;
    el.style.transform=`translate(${dx}px,${dy*.3}px) rotate(${dx/18}deg)`;
    so.style.opacity=Math.min(1,Math.max(0,dx/90));sk.style.opacity=Math.min(1,Math.max(0,-dx/90))});
  const end=()=>{if(!on)return;on=false;el.style.transition='';
    if(dx>100)fly(el,1,r);else if(dx<-100)fly(el,-1,r);
    else{el.style.transform='';so.style.opacity=sk.style.opacity=0;if(Math.abs(dx)<6&&Math.abs(dy)<6)openDetail(r)}};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)}

let busy=false;
function fly(el,dir,r){if(busy)return;busy=true;
  el.querySelector(dir>0?'.stamp.open':'.stamp.skip').style.opacity=1;
  el.style.transition='transform .35s ease-in,opacity .35s';
  el.style.transform=`translate(${dir*window.innerWidth*1.1}px,40px) rotate(${dir*28}deg)`;el.style.opacity=0;
  setTimeout(()=>{idx++;renderDeck();busy=false;if(dir>0)openDetail(r)},300)}
function topCard(){return $('deck').querySelector('.card[tabindex]')}

$('skipBtn').onclick=()=>{const el=topCard();if(el)fly(el,-1,deck[idx])};
$('openBtn').onclick=()=>{const el=topCard();if(el)fly(el,1,deck[idx])};
$('saveBtn').onclick=()=>{const r=deck[idx];if(!r)return;toggleSave(r.id);$('saveBtn').setAttribute('aria-pressed',saved.has(r.id))};

function setCount(){const n=[...saved].filter(id=>ALL.some(r=>r.id===id)).length,c=$('savedCount');c.textContent=n;c.dataset.n=n}
function toggleSave(id){saved.has(id)?saved.delete(id):saved.add(id);persist();setCount()}

/* ---------- recipe page ---------- */
const heart='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
function openDetail(r){const n=r.n,pk=n.p*4,ck=n.c*4,fk=n.f*9,tot=pk+ck+fk||1;
  const pct=x=>R(x/tot*100);
  $('detail').innerHTML=`
  <div class="hero" data-photo="${r.id}" style="background:${bg(r)}">${r.img?'':'<div class="slot">Photo slot</div>'}
    <button class="fab back" id="dBack" aria-label="Back to cards"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
    <button class="fab fav" id="dFav" aria-label="Save" aria-pressed="${saved.has(r.id)}">${heart}</button>
  </div>
  <div class="body">
    <div class="title"><div class="eyebrow">${tags(r).replace('Veggie','Vegetarian')}</div>
      <h1>${esc(r.name)}</h1><p>${esc(r.desc)}</p>
      <div class="meta"><span>${r.time} min${r.timeNote?' '+esc(r.timeNote):''}</span><span>Serves ${r.serves}</span><span>${r.ing.filter(i=>i[1]>0).length} ingredients</span></div></div>
    <div class="panel">
      <div class="tag">Per serving</div>
      <div class="kcal"><strong>${R(n.k)}</strong><span>kcal</span></div>
      <div class="bar" role="img" aria-label="Energy split: protein ${pct(pk)}%, carbs ${pct(ck)}%, fat ${pct(fk)}%">
        <i style="width:${pk/tot*100}%;background:var(--coral)"></i><i style="width:${ck/tot*100}%;background:var(--lime)"></i><i style="width:${fk/tot*100}%;background:var(--on-panel)"></i></div>
      <div class="macros">
        <div class="macro"><span class="lab"><i style="background:var(--coral)"></i>Protein</span><b>${R(n.p)} g</b><small>${pct(pk)}% of kcal</small></div>
        <div class="macro"><span class="lab"><i style="background:var(--lime)"></i>Carbs</span><b>${R(n.c)} g</b><small>${pct(ck)}% of kcal</small></div>
        <div class="macro"><span class="lab"><i style="background:var(--on-panel)"></i>Fat</span><b>${R(n.f)} g</b><small>${pct(fk)}% of kcal</small></div>
      </div>
      <div class="extra"><span>Fibre</span><b>${R(n.fi)} g</b></div>
      <div class="extra"><span>Protein per 100 kcal</span><b>${(n.p/n.k*100).toFixed(1)} g</b></div>
    </div>
    <div><h3 class="sec">Ingredients</h3><p class="sub">For ${r.serves} serving${r.serves>1?'s':''}</p>
      <ul class="ing">${r.ing.map(([k,g,l])=>`<li><span>${esc(l||(ING[k]?ING[k].n:k))}</span><span>${g?g+' g':'to taste'}</span></li>`).join('')}</ul></div>
    <div><h3 class="sec">Method</h3><ol class="steps">${r.steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')}</ol></div>
    ${r.tip?`<p class="tip"><b>Busy-day tip:</b> ${esc(r.tip)}</p>`:''}
    <div class="rate" id="rateBox" data-id="${r.id}"><h3>Rate it</h3><div class="stars" role="group" aria-label="Your rating"></div><p></p></div>
    <p class="note">Nutrition is calculated per serving from standard food-table values for each ingredient by weight. Brands vary, so treat it as a close estimate.</p>
  </div>`;
  renderRate(r);
  $('rateBox').querySelector('.stars').onclick=e=>{const b=e.target.closest('button[data-s]');if(b)rate(r,+b.dataset.s)};
  $('detail').scrollTop=0;$('detail').classList.add('show');
  $('dBack').onclick=closeDetail;$('dFav').onclick=e=>{toggleSave(r.id);e.currentTarget.setAttribute('aria-pressed',saved.has(r.id));renderSaved();
    if(deck[idx])$('saveBtn').setAttribute('aria-pressed',saved.has(deck[idx].id))};
  setTimeout(()=>$('dBack').focus({preventScroll:true}),350)}
function closeDetail(){$('detail').classList.remove('show');renderDeck()}

/* ---------- saved ---------- */
function renderSaved(){const list=ALL.filter(r=>saved.has(r.id));
  $('savedList').innerHTML=list.length?list.map(r=>{const s=scores[r.id];return `<li><button data-id="${r.id}"><span class="thumb" data-photo="${r.id}" style="background:${bg(r)}"></span><span><strong>${esc(r.name)}</strong><small>${r.time} min · ${R(r.n.k)} kcal · ${R(r.n.p)} g protein</small>${s&&s.votes?` <span class="avg">★ ${s.avg.toFixed(1)}</span>`:''}</span></button></li>`}).join('')
   :'<li class="none">Tap the heart on a meal to keep it here. Saved meals stay after the weekly menu changes.</li>'}
function tab(sv){if(sv){$('tabDiscover').removeAttribute('aria-current');$('savedBtn').setAttribute('aria-current','page')}
  else{$('tabDiscover').setAttribute('aria-current','page');$('savedBtn').removeAttribute('aria-current')}
  $('savedSheet').classList.toggle('show',sv);if(sv)renderSaved()}
$('savedBtn').onclick=()=>tab(true);$('tabDiscover').onclick=()=>tab(false);
$('savedClose').onclick=()=>tab(false);
$('savedList').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(b)openDetail(ALL.find(r=>r.id===b.dataset.id))});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if($('detail').classList.contains('show'))closeDetail();else tab(false);return}
  if($('detail').classList.contains('show')||$('savedSheet').classList.contains('show'))return;
  if(e.key==='ArrowRight')$('openBtn').click();if(e.key==='ArrowLeft')$('skipBtn').click()});

/* ---------- header text ---------- */
const TZ='Europe/Malta';
function dropText(w){const d=new Date(w.live);
  return d.toLocaleDateString('en-GB',{weekday:'long',timeZone:TZ})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:TZ})}
function header(){const d=new Date(),h=d.getHours();
  $('greet').innerHTML=`What's for <span>${h<11?'breakfast':h<16?'lunch':'dinner'}?</span>`;
  $('today').textContent=d.toLocaleDateString('en-GB',{weekday:'long'});
  const wk=new Date(WEEK.week+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  $('weekline').innerHTML=`<span><b>${RECIPES.length} meals</b> · week of ${wk}</span>${NEXT&&!PREVIEW?`<span class="drop">New: ${dropText(NEXT).replace(/day /,' ').replace(/^(\w{3})\w*/,'$1')}</span>`:''}`;
  if(PREVIEW)$('weekline').insertAdjacentHTML('beforebegin',`<div class="preview">Preview: this menu goes live ${dropText(WEEK)}</div>`)}

/* ---------- start ---------- */
(async()=>{
  try{await load()}catch(e){$('deck').innerHTML='<div class="loading">Couldn\'t load this week\'s menu. Check your connection and refresh.</div>';return}
  header();setCount();renderChips();build(true);
  await loadScores(ALL.map(r=>r.id));renderDeck();
})();
