// NGL Recreational: the family side, ported from nglrecreational.co.uk/families/ (index.html) WORD FOR WORD:
// same wording, screens and logic. Only the shell (code entry, install prompt, header), the look and the data
// loading change. The plan maths is the shared Rec engine (js/pathways/rec-engine.js), not a second copy.
//   Tabs (hash #/family/recreational/<tab>): choose · rotations · fortnight · progress · programme · levels · competitions
//   Data: recShared/{doc.key}/docs/{plan,warmups,book,competition,imgIndex,img0…} (JSON strings), rotaLive/{clubId},
//         competition dates from the public saadi-rotation ngl_competitions REST URL (as the original).
//   Demo (?demo): the public sample content and a sample timetable, no database.
//   Saved on the phone only (same keys as the original app): nglrec-book, nglrec-level, nglrec-colour, nglrec-tab, nglrec-progress.
import { esc, modal as uiModal } from '../ui.js';
import { CALENDAR } from '../data.js';
import { fb } from '../firebase.js';
import { CLASS_RULES, buildClubPlan, clubWeekNow } from '../pathways/rec-engine.js';

const SAMPLE_URL = 'https://nglrecreational.co.uk/content/rec-sample.json';
const CAL_URL = 'https://firestore.googleapis.com/v1/projects/saadi-rotation/databases/(default)/documents/ngl_competitions?pageSize=300&key=AIzaSyDV7BuYhSjji9DQDjih5a6Ms7G-SVZpKw4';
const CONTACT_EMAIL = 'admin@nationalgymnasticsleague.co.uk';
const BASE = '#/family/recreational';
// Book colours: the same (slightly deeper) shades the club side uses, so white text stays readable
const LEVELS = [
  {key:'ruby', name:'Ruby', book:1, color:'#c8194a'},
  {key:'pink', name:'Pink', book:2, color:'#c2185b'},
  {key:'teal', name:'Teal', book:3, color:'#08686b'},
  {key:'indigo', name:'Indigo', book:4, color:'#5a55c8'}
];
const PIECE_ORDER = ['FF','BF','VT','BM','BA','FT'];
const strip = s => String(s).replace(/\s*-\s*(Floor|Medium|High|Low|Red Foam) [Bb]eam$/, '');
const norm = s => String(s).toLowerCase().replace(/^or\s+/, '').trim();
const fmtDay = d => d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'});
const store = {
  get(k){ let v = null; try{ v = localStorage.getItem('nglrec-' + k); }catch(e){} return v; },
  set(k, v){ try{ v == null ? localStorage.removeItem('nglrec-' + k) : localStorage.setItem('nglrec-' + k, v); }catch(e){} }
};

/* ---------- Styles (injected once) ---------- */
function injectCss(){
  if (document.querySelector('link[data-fam-css="recreational"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/family-recreational.css'; l.dataset.famCss = 'recreational';
  document.head.appendChild(l);
}

/* ---------- Data ---------- */
const S = {key:null, club:null, content:null, plan:null, planKey:'', rota:undefined, demo:false};
const live = {
  async loadContent(key){
    const {fs, D} = await fb();
    const keys = ['plan','warmups','book','competition','imgIndex'];
    const snaps = await Promise.all(keys.map(k => fs.getDoc(fs.doc(D, 'recShared', key, 'docs', k))));
    const c = {};
    snaps.forEach((s, i) => { if(s.exists()) c[keys[i]] = JSON.parse(s.data().json); });
    if(!c.plan) throw new Error('No programme published');
    return c;
  },
  async loadImgChunk(n){
    const {fs, D} = await fb();
    const s = await fs.getDoc(fs.doc(D, 'recShared', S.club.key, 'docs', 'img' + n));
    return s.exists() ? JSON.parse(s.data().json) : {};
  },
  async loadRota(){
    if(!S.club || !S.club.clubId) return null;
    const {fs, D} = await fb();
    const s = await fs.getDoc(fs.doc(D, 'rotaLive', S.club.clubId));
    return s.exists() && s.data().json ? JSON.parse(s.data().json) : null;
  }
};
let SAMPLE = null;
const demo = {
  async loadContent(){
    const r = await fetch(SAMPLE_URL, {cache: 'force-cache'}); if(!r.ok) throw new Error('Sample not available');
    SAMPLE = await r.json(); const idx = {};
    (SAMPLE.images || []).forEach((ch, n) => Object.keys(ch).forEach(h => idx[h] = n));
    return {...SAMPLE, imgIndex: idx};
  },
  async loadImgChunk(n){ return ((SAMPLE && SAMPLE.images) || [])[n] || {}; },
  async loadRota(){ return demoRota(); }
};
const api = () => S.demo ? demo : live;
// Sample club term: started a few days ago, 14 weeks, from block 1
const DEMO_TERM = {start: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), weeks: 14, startBlock: 1};
// Sample timetable in the Rotation Planner's rotaLive format: two classes today and one on another day, for all six colour groups
function demoRota(){
  const today = DAYS_F[new Date().getDay()], other = today === 'Saturday' ? 'Wednesday' : 'Saturday';
  const locations = [['Warm-up area', '#28225c'], ['Forward Floor', '#2f6fb8'], ['Backward Floor', '#00808a'], ['Vault', '#2e7d32'], ['Beam', '#b85c1a'], ['Bars', '#5b4bc4'], ['Fast Track', '#c0392b']].map(([name, colour]) => ({name, colour}));
  const A = ['Forward Floor', 'Vault', 'Beam'], B = ['Backward Floor', 'Bars', 'Fast Track'];
  const groups = GROUP_COLOURS.map(([n], i) => ({id: 'rec_' + i, section: 'recreational', name: n}));
  const sessions = {};
  [[today, 16 * 60 + 30], [today, 17 * 60 + 45], [other, 9 * 60]].forEach(([day, t0]) => {
    sessions[day] = sessions[day] || {};
    groups.forEach((g, i) => {
      const s = i % 3, list = sessions[day][g.id] = sessions[day][g.id] || [];
      list.push({title: 'Warm-up', location: 'Warm-up area', start_min: t0, duration: 10});
      for(let r = 0; r < 3; r++) list.push({title: 'Rotation ' + (r + 1), location: A[(s + r) % 3], locationB: B[(s + r) % 3], start_min: t0 + 10 + r * 15, duration: 15});
      list.push({title: 'Cool-down', location: 'Warm-up area', start_min: t0 + 55, duration: 5});
    });
  });
  return {groups, sessions, locations, rec: {map: {FF: 'Forward Floor', BF: 'Backward Floor', VT: 'Vault', BM: 'Beam', BA: 'Bars', FT: 'Fast Track'}}};
}

const IMG = {cache:{}, loaded:{}};
async function hydrateImages(){
  const root = document.getElementById('famPage'); if(!root) return;
  const els = [...root.querySelectorAll('img[data-img]:not([src])')];
  if(!els.length || !S.content.imgIndex) return;
  const need = [...new Set(els.map(e => S.content.imgIndex[e.dataset.img]).filter(n => n !== undefined && !IMG.loaded[n]))];
  await Promise.all(need.map(async n => { IMG.loaded[n] = true; try{ Object.assign(IMG.cache, await api().loadImgChunk(n)); }catch(e){ IMG.loaded[n] = false; } }));
  els.forEach(e => { const d = IMG.cache[e.dataset.img]; if(d) e.src = d; });
}

/* ---------- Term maths ---------- */
function familyPlan(){
  const t = S.club && S.club.term;
  if(t && t.custom) return buildClubPlan(S.content, t);
  return {blocks: S.content.plan.blocks.map(b => Object.assign({}, b, {warm: b.assessment ? S.content.warmups.length - 1 : b.n - 1}))};
}
function whereAreWe(term){
  const plan = S.plan, blocks = plan.blocks;
  if(!term || !term.start) return {block: UI.block || 1, note:''};
  if(term.custom){
    const now = clubWeekNow(term, plan);
    if(now.outside) return {block: now.wk < 1 ? 1 : blocks[blocks.length - 1].n, note: now.wk < 1 ? 'Term hasn’t started yet. Here’s what the first fortnight will look like.' : 'This term has finished. Your club will update the dates for next term.'};
    if(now.half) return {block: now.block, half:true, back: now.back, note: `Here’s what comes next: week ${now.wk} of ${now.W}.`};
    return {block: now.block, note: `Week ${now.wk} of ${now.W}.`};
  }
  const assessIdx = blocks.findIndex(b => b.assessment);
  const assessN = assessIdx >= 0 ? blocks[assessIdx].n : blocks[blocks.length - 1].n;   // the public sample has no assessment block
  const start = new Date(term.start + 'T00:00:00'), now = new Date();
  const wk = Math.floor((now - start) / (7 * 86400000)) + 1;
  const W = term.weeks || 14, sb = term.startBlock || 1;
  if(wk < 1) return {block: sb, week: 0, note: `Term starts ${fmtDay(start)}. Here’s what the first fortnight will look like.`};
  if(wk > W) return {block: assessN, week: W, note: 'This term has finished. Your club will update the dates for next term.'};
  if(wk > W - 2) return {block: assessN, week: wk, note: `Week ${wk} of ${W}: assessment weeks.`};
  const n = ((sb - 1) + Math.floor((wk - 1) / 2)) % 6 + 1;
  return {block: n, week: wk, note: `Week ${wk} of ${W}.`};
}

/* ---------- UI state ---------- */
const UI = {book: +store.get('book') || 0, level: +store.get('level') || 0, colour: +store.get('colour') || 0, block: 0, tab: store.get('tab') || 'week', day: null, cls: null, compLv: null};
const TAB_SLUG = {choose:'choose', week:'rotations', fortnight:'fortnight', progress:'progress', programme:'programme', levels:'levels', comps:'competitions'};
const SLUG_TAB = Object.fromEntries(Object.entries(TAB_SLUG).map(([k, v]) => [v, k]));
let CTX = null, INIT = false, SHOWN = '';
function go(tab){
  const h = BASE + '/' + TAB_SLUG[tab];
  if(location.hash === h) redraw(true); else location.hash = h;
}
async function redraw(top){
  const page = document.getElementById('famPage'); if(!page || !CTX || !page.querySelector('.fr')) return;
  page.innerHTML = await render(CTX); after(CTX);
  if(top) window.scrollTo(0, 0);
}

/* ---------- My child's progress: kept on this phone only, never sent to NGL ---------- */
const fmtShort = iso => { try{ return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}); }catch(e){ return iso; } };
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function prog(){
  let p = null; try{ p = JSON.parse(store.get('progress') || 'null'); }catch(e){}
  if(!p || !Array.isArray(p.kids) || !p.kids.length){ p = {kids:[{id:'k' + Date.now(), name:'', current:UI.level || 0, passed:{}}]}; p.active = p.kids[0].id; progSave(p); }
  return p;
}
function progSave(p){ store.set('progress', JSON.stringify(p)); }
function kid(p){ return p.kids.find(k => k.id === p.active) || p.kids[0]; }
const kidName = k => k.name ? k.name : 'Your child';
function progUse(k){   // make the rest of the app follow the chosen child
  UI.level = k.current || 0; UI.book = k.current ? Math.ceil(k.current / 4) : 0;
  store.set('level', UI.level || null); store.set('book', UI.book || null); UI.block = 0;
}
function progSummary(p){
  return p.kids.map(k => { const lv = k.current ? LEVELS[Math.ceil(k.current / 4) - 1] : null;
    const done = Object.keys(k.passed || {}).map(Number).sort((a, b) => a - b);
    return `${kidName(k)} – NGL Recreational progress\n` + (lv ? `Now working on: ${lv.name} book, Level ${k.current}\n` : '') +
      (done.length ? 'Levels passed:\n' + done.map(L => `• Level ${L} (${LEVELS[Math.ceil(L / 4) - 1].name}) – ${fmtShort(k.passed[L])}`).join('\n') : 'No levels recorded yet.'); }).join('\n\n') +
    (S.club ? `\n\nClub: ${S.club.clubName}` : '');
}
function screenProgress(){
  const p = prog(), k = kid(p), L = k.current, lv = L ? LEVELS[Math.ceil(L / 4) - 1] : null, last = L === 16 && (k.passed || {})[16];
  return `<p class="eyebrow">${S.club ? esc(S.club.clubName) : 'NGL Recreational'}</p><h1>Progress</h1>
  <p class="muted" style="margin-top:-4px">Keep track of the levels your child has passed, so you always know where they are, even if the award book goes missing.</p>
  <div class="kids">${p.kids.map(x => `<button class="chip ${x.id === k.id ? 'on' : ''}" data-kid="${x.id}">${esc(kidName(x))}</button>`).join('')}<button class="chip" data-pact="addkid">+ Add a child</button></div>
  <div class="field" style="max-width:360px"><label for="kname">Child’s first name (optional)</label><input class="input" id="kname" value="${esc(k.name || '')}" placeholder="e.g. Ella" maxlength="30" autocomplete="off"></div>
  ${lv ? `<div class="pnow" style="background:${lv.color}"><p class="eyebrow" style="color:#fff;opacity:.9">${last ? 'All 16 levels passed' : 'Working on now'}</p><h2>${lv.name} book · Level ${L}</h2><p>${last ? 'Every NGL Recreational level is complete. Brilliant!' : 'Book ' + lv.book + ' of 4. One level a term, assessed in the last two weeks.'}</p></div>
    ${last ? '' : `<div class="card" style="margin:0 0 16px"><h3 style="margin-top:0">Has ${esc(kidName(k).replace('Your child', 'your child'))} passed Level ${L}?</h3>
      <div class="btn-row" style="align-items:flex-end"><div class="field" style="margin:0"><label for="pdate">Date passed</label><input class="input" type="date" id="pdate" value="${todayISO()}" max="${todayISO()}"></div>
      <button class="btn" data-pact="pass">Yes, record Level ${L} as passed</button></div>
      <p class="note" style="margin-top:8px">${L % 4 === 0 && L < 16 ? `That finishes the ${lv.name} book, so they’ll move on to ${LEVELS[lv.book].name}, Level ${L + 1}.` : `They’ll move on to Level ${L + 1}.`}</p></div>`}`
  : `<div class="card" style="margin:0 0 16px"><h3 style="margin-top:0">Which level is ${esc(kidName(k).replace('Your child', 'your child'))} working on?</h3><p class="muted">Tap their level below. If you’re not sure, ask their coach.</p></div>`}
  <h2>All 16 levels</h2><p class="muted" style="margin-top:-4px">Tap a level to mark it passed, change the date, or set it as the level they’re working on.</p>
  ${LEVELS.map(b => `<p class="eyebrow" style="color:${b.color};margin:10px 0 0">Book ${b.book} · ${b.name}</p><div class="pgrid">${[0,1,2,3].map(i => { const n = (b.book - 1) * 4 + 1 + i, d = (k.passed || {})[n];
    return `<button class="pcell ${d ? 'done' : ''} ${n === L && !last ? 'now' : ''}" style="--c:${b.color}" data-plevel="${n}"><b>Level ${n}</b><small>${d ? fmtShort(d) : n === L ? 'Working on now' : ''}</small></button>`; }).join('')}</div>`).join('')}
  <div class="card"><h3 style="margin-top:0">Keep a copy</h3><p class="muted">Progress is saved on this phone only. NGL never sees it. Copy a summary to keep it somewhere safe, or to send to yourself.</p>
    <div class="btn-row"><button class="btn ghost small" data-pact="copy">Copy summary</button><a class="btn ghost small" href="mailto:?subject=${encodeURIComponent('NGL Recreational progress')}&body=${encodeURIComponent(progSummary(p))}">Email it to myself</a>${p.kids.length > 1 ? '<button class="btn ghost small" data-pact="delkid">Remove this child</button>' : ''}</div><p class="note" id="pnote" aria-live="polite"></p></div>
  <div class="foot">Questions about your child’s progress? Please ask their coach.</div>`;
}
function levelSheet(n){
  const p = prog(), k = kid(p), d = (k.passed || {})[n], b = LEVELS[Math.ceil(n / 4) - 1];
  modal(`<p class="eyebrow" style="color:${b.color}">${b.name} book</p><h2 style="margin-top:0">Level ${n}</h2>
    <div class="field"><label for="ldate">${d ? 'Passed on' : 'Date passed'}</label><input class="input" type="date" id="ldate" value="${d || todayISO()}" max="${todayISO()}"></div>
    <div class="btn-row"><button class="btn" data-pact="setpass" data-n="${n}" data-close>${d ? 'Save date' : 'Mark as passed'}</button>
    ${d ? `<button class="btn ghost" data-pact="unpass" data-n="${n}" data-close>Not passed</button>` : ''}
    ${k.current !== n ? `<button class="btn ghost" data-pact="setnow" data-n="${n}" data-close>Working on this level now</button>` : ''}
    <button class="btn ghost" data-close>Cancel</button></div>`);
}
// Dialogs use the app's own pop-up, marked so this module's styles and clicks apply inside it
function modal(html){ const bg = uiModal(`<div class="fr-in">${html}</div>`); bg.classList.add('fr-modal'); return bg; }

const GROUP_COLOURS = [['Orange','#F28C28'],['Yellow','#F5C518'],['Blue','#2F80ED'],['Red','#E5383B'],['Green','#2EAD5B'],['Purple','#8E44AD']];
function screenChoose(){
  return `<p class="eyebrow">${esc(S.club.clubName)}</p>
  <h1>1. Which book?</h1>
  <p class="lead" style="margin-top:-4px">The colour on the front of your child’s award book.</p>
  <div class="levels-art pick4">${LEVELS.map(l => `<button class="lvtile bg-${l.key} ${UI.book === l.book ? 'picked' : ''}" data-book="${l.book}" aria-pressed="${UI.book === l.book}"><small>Book ${l.book}</small>${l.name}</button>`).join('')}</div>
  ${UI.book ? `<h1 style="margin-top:26px">2. Which colour group?</h1>
  <p class="lead" style="margin-top:-4px">The colour group your child is in for their class. Ask their coach if you’re not sure.</p>
  <div class="grp-pick">${GROUP_COLOURS.map(([n, c], i) => `<button class="grp-tile ${UI.colour === i + 1 ? 'picked' : ''}" data-colour="${i + 1}" style="background:${c};color:${textOn(c)}">${n}</button>`).join('')}</div>` : ''}`;
}
// Coaching tips, worded for parents: what the coach will say and what to look for.
// Safety notes are for coaches only, so they are left out here.
function parentTips(s){
  return '';   // coaching tips switched off (Oct 2026): they didn't match the skills closely enough
  /* eslint-disable no-unreachable */
  const t = s.tips; if(!t || !(t.cues || []).length) return '';
  return `<details class="tipbox"><summary>Coaching tips</summary>
    <p class="tip-row"><b>What the coach will say</b></p>
    <ul class="tip-cues">${t.cues.map(c => `<li>“${esc(c)}”</li>`).join('')}</ul>
    ${t.watch ? `<p class="tip-row"><b>What the coach is looking for</b> ${esc(t.watch)}</p>` : ''}
    <p class="tip-row tip-home">Practise the shapes and cues at home, but leave anything that needs a coach’s support for the gym.</p></details>`;
}
function stationBlock(p, col, L){
  const lv = LEVELS[UI.book - 1];
  return p.stations.map(s => {
    const text = s.levels[col] || '';
    if(!text || text === '—') return '';
    const a = (s.assess && s.assess[String(col)]) || [];
    const mine = a.filter(y => y.L === L);
    const book = a.filter(y => y.L !== L && Math.ceil(y.L / 4) === UI.book);
    const comp = [];
    a.forEach(y => (y.c || []).forEach(([cl, el]) => { if(cl === lv.name && !comp.includes(el)) comp.push(el); }));
    const imgs = (s.img && s.img[col]) || [];
    return `<div class="fstation">
      <div class="ftext">${esc(text).replace(/FINAL SKILL:?/g, '<b>Final skill:</b>').replace(/SUPPORTED/g, 'Supported')}</div>
      ${mine.length || comp.length || book.length ? `<div class="flinks">
        ${mine.map(y => `<span class="flink fa" style="--c:${lv.color}">Level ${L} assessment · ${esc(y.s)}</span>`).join('')}
        ${comp.map(el => `<span class="flink fc">${lv.name} competition · ${esc(el)}</span>`).join('')}
        ${book.map(y => `<span class="flink fb" style="--c:${lv.color}">Level ${y.L} skill · ${esc(y.s)}</span>`).join('')}
      </div>` : ''}
      ${imgs.length ? `<div class="thumbs">${imgs.map(h => `<button class="thumb" data-photo="${esc(h)}" aria-label="Enlarge photo"><img data-img="${esc(h)}" alt="How the station is set up"></button>`).join('')}</div>` : ''}
      ${parentTips(s)}
    </div>`;
  }).join('');
}

// Home practice: safe skills to try at home in each fortnight (from "NGL Homework", Nov 2026). "(Ruby L1)" = that level's skill.
const HOMEWORK = [
 ['Bunny hops','High bunny hops','Half turn jump (Ruby L1)','Full turn jump (Teal L11)','Front support','Tuck jump half turn (Teal L11)','Half turn on toes (Ruby L3)','Half spin (Pink L7)','Full spin (Teal L10)','Press ups against a wall','Caterpillar walks (Pink L6 & Teal L9)','Straddle bunny hops (Ruby L4)','Front support walking','Tucked full turn jump (Teal L12)','Stretch jump (Ruby L1)','Landing shape (Ruby L1)'],
 ['Rocking backward and forward to stand','Sideways bunny hops','Star jump holding the landing (Ruby L2)','Tuck jump, star jump rebound (Pink L8)','Broad jumps (Ruby L2)','Straight jumps','Bunny hops','High knees running (Ruby L1)','Back support','Front support walking through to back support','Walking in a straight line','Stork balance (Ruby L3)','Arabesque (Ruby L4)','Y balance (Teal L10)','Rebound jumping','Front support hold','Lying down leg lifts','Piked sit ups','Press ups'],
 ['High bunny hops (Ruby L4)','Caterpillar walks (Pink L5 & Pink L6)','Arabesque (Ruby L4)','Standing on 1 leg (Pink L5)','Front support shoulder shrugs (Ruby L4)','Backward arm circle to reach high on a wall (Pink L5)','Front support hold','Press ups against a wall','Shoulder shrugs against a wall','Standing leg kicks forward (Pink L6)','Sit in a tuck shape (Ruby L2)','Shoulder stand','Shoulder stand without hand support (Pink L8)','Dish shape','Bent leg dish','Dish rocks','Arch shape','Arch rocks','Hopscotch (Ruby L2)','Duck jumps (Pink L8)','Hopping (Pink L7)','Long bunny hops','Split jump','Rebound jumps'],
 ['Single leg bunny hops','Bunny hops','Chassé','Chassé cat leap','Chassé scissor leap','Chassé split leap (Indigo L13)','Half turn cat leap (Indigo L15)','Straddle bunny hops (Ruby L4)','Long straddle bunny hops','Caterpillar walks','Backwards straddle bunny hops','High straddle bunny hops','Elephant lift walking','Stretch jump (Ruby L4)','Cat leap (Pink L6)','Jump prep: bend, on toes, stretch tall (Ruby L2)','Scissor leap (Teal L9)','Tuck jump (Teal L11)','Wolf jump (Teal L9 & Teal L12 & Indigo L14)','Hopping','Hopscotch','Split leap or jump (Indigo L15)','Lie on your back, lift legs in straddle','Jump from 1 foot to 2 feet','Sissone jump (Teal L10)','Half turn tuck jump','Full turn tuck jump','Sit ups'],
 ['Bunny hops','Front support walks','Needle kick','Front support shoulder shrugs','Stretch jump','Front support shoulder taps','Half turn on toes (Ruby L3)','Crouched half turn (Pink L5)','Balance on toes (Ruby L3)','Tiptoe walking (Pink L8)','Half spin (Pink L7 & Teal L11 & Indigo L13)','Relevé half turn (Pink L8)','Spin prep: step, touch knee to toe, step forward','Full spin (Teal L11 & Indigo L16)','Half spin, half turn (Indigo L14)','Rebound jumps','Sideways bunny hops','Dish hold','Arch hold','Dish hold to arch hold'],
 ['Show your landing shape (Ruby L1)','Balance on 1 leg','Rebound jumps','Rebound hops','Front support hold','Backward arm circle to reach high on a wall (Pink L5)','Lie on your back holding a straight shape','Stretch jump','Star jump','Tuck jump','Straddle jump','High bunny hops','Caterpillar walks','Sideways front support walking','V-sit hold','Dish rocks']
];
const HOMEWORK_ASSESS = ['Standing long jump','Standing backwards long jump','Standing long hops','Walking sideways','Hopscotch','Teddy bear roll (Pink L6)','Jump backwards','Dish hold','Arch hold','Rebound jumps'];
function homeBlock(b, L){
  const list = b.assessment ? HOMEWORK_ASSESS : HOMEWORK[(b.n - 1) % HOMEWORK.length];
  if(!list) return '';
  const lv = LEVELS[UI.book - 1];
  const rows = list.map(t => {
    const m = t.match(/\s*\(([^)]*\bL\d+[^)]*)\)\s*$/), name = m ? t.slice(0, m.index) : t;
    const refs = m ? m[1].split('&').map(x => x.trim().match(/^(\w+)\s+L(\d+)$/)).filter(Boolean).map(x => +x[2]) : [];
    const mine = refs.includes(L), book = refs.filter(n => n !== L && Math.ceil(n / 4) === UI.book);
    return {name, mine, book, rank: mine ? 0 : book.length ? 1 : 2};
  }).sort((a, b) => a.rank - b.rank);
  return `<article class="piece home-practice"><div class="piece-h"><h2>At home this fortnight</h2><span class="th">${b.assessment ? 'Keep everything ticking over' : 'Safe to practise at home'}</span></div>
    <div class="hp-body"><p class="muted" style="margin:0 0 10px">Short and often is best: 10 minutes, a few times a week. Use a clear space on a soft floor, with an adult watching. Leave anything that needs a coach’s support for the gym, and stop if anything hurts.</p>
    <ul class="home-list">${rows.map(r => `<li>${esc(r.name)}${r.mine ? ` <span class="flink fa" style="--c:${lv.color}">Level ${L} assessment</span>` : ''}${r.book.map(n => ` <span class="flink fb" style="--c:${lv.color}">Level ${n} skill</span>`).join('')}</li>`).join('')}</ul></div></article>`;
}
function screenWeek(){
  const lv = LEVELS[UI.book - 1], col = UI.book - 1, L = UI.level;
  S.plan = S.plan || familyPlan();
  const pos = whereAreWe(S.club.term);
  if(!UI.block) UI.block = pos.block;
  const blocks = S.plan.blocks;
  const b = blocks.find(x => x.n === UI.block) || blocks[0];
  const current = UI.block === pos.block;
  // what's practised this block
  const practised = new Set(), compDone = new Set();
  b.pieces.forEach(p => p.stations.forEach(s => Object.values(s.assess || {}).flat().forEach(y => {
    practised.add(y.p + '|' + y.s); (y.c || []).forEach(([cl, el]) => { if(cl === lv.name) compDone.add(norm(el)); });
  })));
  const bk = S.content.book;
  const pieces = ['Floor','Vault','Beam','Bars','Rebound','Physical Prep'];
  const comp = S.content.competition.levels[col];
  const wu = S.content.warmups[b.warm];
  return `
  <div class="fhead" style="border-color:${lv.color}">
    <div><p class="eyebrow" style="color:${lv.color}">${esc(S.club.clubName)}</p>
    <h1 style="margin:0">${(k => k.name ? esc(k.name) + ' · ' : '')(kid(prog()))}${lv.name} · Level ${L}</h1></div>
    <button class="btn ghost small" data-ftab="week">Back to rotations</button>
  </div>

  <section class="section" style="margin-top:18px">
    ${current && pos.half ? `<div class="halfterm"><b>Half term</b><span>No classes this week. Classes restart ${esc(fmtDay(pos.back))}.</span></div><p class="eyebrow">After half term</p>` : `<p class="eyebrow">${current ? 'This fortnight' : 'Looking ahead'}</p>`}
    <h2>${esc(b.assessment ? 'Assessment' : b.weeks)}${b.assessment ? '' : ': ' + esc(b.pieces.map(p => p.theme).slice(0, 3).join(', ')) + '…'}</h2>
    <p class="muted">${current ? esc(pos.note) : 'You’re looking at a different block. '}${b.assessment ? ' Your child is being assessed on their award-book level, so stations are a mix of everything they’ve practised.' : ''}</p>
    <div class="chips" style="margin:8px 0 14px">${blocks.map(x => `<button class="chip ${x.n === UI.block ? 'on' : ''}" data-block="${x.n}">${x.n === pos.block ? '● ' : ''}${x.assessment ? 'Assessment' : esc(x.weeks)}</button>`).join('')}</div>
    <div class="legend-f">
      <span class="flink fa" style="--c:${lv.color}">Level ${L} assessment</span> on your child’s Level ${L} assessment
      <span class="flink fc">${lv.name} competition</span> in their competition routine
      <span class="flink fb" style="--c:${lv.color}">Level skill</span> another level in their book
    </div>
    ${PIECE_ORDER.map(code => b.pieces.find(p => p.code === code)).filter(Boolean).map(p => `
      <article class="piece">
        <div class="piece-h"><h2>${esc(p.piece)}</h2><span class="th">${esc(p.theme)}</span></div>
        <div class="fstations">${stationBlock(p, col, L)}</div>
      </article>`).join('')}
    ${wu && !wu.assess ? `<article class="piece"><div class="piece-h"><h2>Warm-up</h2><span class="th">Physical prep to try at home</span></div>
      <div class="fstations">${['pulse','mob','str'].map(k => (wu.parts[k][col] || []).map(x => `<div class="fstation"><div class="ftext">${esc(x.txt)}</div><div class="flinks">${x.L === L ? `<span class="flink fa" style="--c:${lv.color}">Level ${L} assessment</span>` : `<span class="flink fb" style="--c:${lv.color}">Level ${x.L} skill</span>`}</div></div>`).join('')).join('')}</div></article>` : ''}
    ${homeBlock(b, L)}
  </section>

  <section class="section">
    <p class="eyebrow">Award book</p><h2>Level ${L} assessment</h2>
    <p class="muted">Your child passes Level ${L} when they can do every skill below. Assessment is in the last two weeks of term. Skills marked “this fortnight” are practised at the stations above.</p>
    <div class="bookgrid">${pieces.map(pc => `<div class="card" style="margin:0"><h3>${pc}</h3><ul class="skill-list">${((bk[pc] || {})[String(L)] || []).map(x => {
      const on = practised.has(pc + '|' + strip(x.skill));
      return `<li>${esc(strip(x.skill))}${on ? ' <span class="tag info">This fortnight</span>' : ''}${(x.comp || []).some(([cl]) => cl === lv.name) ? ` <span class="tag gold">In ${lv.name} routine</span>` : ''}</li>`; }).join('')}</ul></div>`).join('')}</div>
  </section>

  <section class="section">
    <p class="eyebrow">Competition</p><h2>${lv.name} routine</h2>
    <p class="muted">The NGL Recreational competition routine for ${lv.name}. Every skill in it is in your child’s award book, so what they practise in class is what they compete.</p>
    <div class="grid4">${[['Floor', comp.floor], ['Vault', comp.vault], ['Beam', comp.beam], ['Bars', comp.bars]].map(([t, xs]) => `<div class="card" style="margin:0;border-top:6px solid ${lv.color}"><h3>${t}</h3><ol style="margin:0;padding-left:20px">${xs.map(x => `<li style="padding:3px 0">${esc(x)}${compDone.has(norm(x)) ? ' <span class="tag info">This fortnight</span>' : ''}</li>`).join('')}</ol>${compVideosHTML(lv.key, t)}</div>`).join('')}</div>
  </section>
  <div class="foot">${esc(S.club.clubName)} · NGL Recreational · Questions about your child’s progress? Please ask their coach.</div>`;
}

/* =====================================================================
   PROGRAMME, LEVELS AND COMPETITIONS
   ===================================================================== */
const PATHS = [
  {k:'preschool', n:'Pre-School', c:'#E84187', d:'Gymnastics for the very youngest. Coming soon.'},
  {k:'schools', n:'Schools', c:'#F8D438', d:'Gymnastics in primary schools, run by BG clubs, with its own awards.'},
  {k:'recreational', n:'Recreational', c:'#E88230', d:'Weekly club classes with four award books and the Ruby to Indigo competitions. You are here.'},
  {k:'general', n:'General League', c:'#0071B3', d:'Club competitions for gymnasts ready for more: girls Levels 1 to 4, boys Levels 1 to 3.'},
  {k:'performance', n:'Performance League', c:'#01AFB8', d:'For gymnasts training over 10 hours a week, preparing for British Gymnastics competitions.'},
  {k:'university', n:'University League', c:'#6AA525', d:'Gymnastics at university. Coming soon.'},
  {k:'masters', n:'Masters', c:'#90276A', d:'Adult gymnastics. Coming soon.'}
];
const COMP_RULES = [
  '2 piece (Floor & Vault) or 4 piece (Floor, Vault, Beam & Bars)',
  'Same level on every apparatus',
  'Positive 10.0: skill completion 4.0, shapes and technique 4.0, confidence and effort 2.0',
  'Gold 8.0+, Silver 6.0–7.99, Bronze below 6.0: every gymnast gets a medal',
  'Gymnasts training over 1 hour a week may only enter Teal and Indigo',
  'Coaches may prompt and support gymnasts',
  'Under 2 hours per competition: arrival, warm up, march on, rotations, awards'
];
const LEVEL_TAGS = ['Beginner', 'Beginner +', 'Intermediate', 'Advanced'];
const ICONS = {
  week:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  programme:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 8h6"/></svg>',
  levels:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4v-5h4v-5h4V5h4"/></svg>',
  comps:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/></svg>',
  progress:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6"/><path d="M9 14.5 8 22l4-2 4 2-1-7.5"/><path d="m9.5 9 1.8 1.8L14.8 7"/></svg>'
};
// Bottom tab bar, as the original app: Rotations, Progress, Programme, Levels, Competitions
function tabbar(tab){
  const tabs = [['week','Rotations'], ['progress','Progress'], ['programme','Programme'], ['levels','Levels'], ['comps','Competitions']];
  const on = ['choose', 'fortnight'].includes(tab) ? 'week' : tab;
  return `<nav class="ftabbar" aria-label="Recreational"><div class="ftab-in">${tabs.map(([k, l]) => `<a class="ftab ${on === k ? 'active' : ''}" href="${BASE}/${TAB_SLUG[k]}" data-ftab="${k}" ${on === k ? 'aria-current="page"' : ''}>${ICONS[k]}<span>${l}</span></a>`).join('')}</div></nav>`;
}

/* =====================================================================
   ROTATIONS: book + colour group -> today's rotations, with the set-up
   for each piece this fortnight at that book's level
   ===================================================================== */
const REC_KEYS_F = [['FORWARD','FF'],['BACKWARD','BF'],['VAULT','VT'],['BEAM','BM'],['BAR','BA'],['FAST','FT'],['TRACK','FT'],['TRAMP','FT']];
function pieceCode(loc, rota){
  const m = rota && rota.rec && rota.rec.map;
  if(m){ const k = Object.keys(m).find(k => !['warm','cool'].includes(k) && m[k] === loc); if(k) return k; }
  const u = String(loc || '').toUpperCase(); const f = REC_KEYS_F.find(([w]) => u.includes(w)); return f ? f[1] : null;
}
function rotaWeekLetter(term){
  const t = term || {}; if(!t.start) return 'A';
  const day = 86400000, mon = x => { const d = new Date(x); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; };
  const start = mon(t.start + 'T00:00:00'); let wk = Math.floor((new Date() - start) / (7 * day)) + 1;
  if(t.halfTerm){ const hw = Math.floor((new Date(t.halfTerm + 'T00:00:00') - start) / (7 * day)) + 1; if(wk >= hw) wk -= (wk === hw ? 0 : 1); }
  const W = +t.weeks || 14;
  if(wk < 1) return 'A';
  if(wk > W - 2) return wk === W - 1 ? 'A' : 'B';
  return (wk - 1) % 2 === 0 ? 'A' : 'B';
}
const DAYS_F = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const fmtT = m => { const h = Math.floor(m / 60), mm = String(Math.round(m % 60)).padStart(2, '0'); return (h % 12 || 12) + ':' + mm + (h < 12 ? 'am' : 'pm'); };
// Text on a club colour: navy or white, whichever reads better (the original used lightHex; this also passes the contrast check)
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const textOn = h => { if(!/^#[0-9a-f]{6}$/i.test(h || '')) return '#fff'; const L = lum(h); return (1.05 / (L + 0.05)) >= ((L + 0.05) / (lum('#28225c') + 0.05)) ? '#fff' : '#28225c'; };
// this colour group's sessions, split into classes (each class starts with a warm-up)
function groupClasses(rota, gi){
  const g = (rota.groups || []).find(x => x.id === 'rec_' + gi) || (rota.groups || []).find(x => x.section === 'recreational' && String(x.name).toLowerCase() === GROUP_COLOURS[gi][0].toLowerCase());
  if(!g) return {};
  const out = {};
  DAYS_F.forEach(day => {
    const ss = ((rota.sessions || {})[day] || {})[g.id] || [];
    if(!ss.length) return;
    const sorted = ss.slice().sort((a, b) => a.start_min - b.start_min), classes = [];
    sorted.forEach(x => { const last = classes[classes.length - 1]; const prev = last && last[last.length - 1];
      if(!last || /warm/i.test(x.title || '') || x.start_min > prev.start_min + prev.duration + 1) classes.push([x]); else last.push(x); });
    out[day] = classes;
  });
  return out;
}
async function screenRotations(){
  const lv = LEVELS[UI.book - 1], col = UI.book - 1, gi = UI.colour - 1, [gName, gHex] = GROUP_COLOURS[gi];
  const L = UI.level && Math.ceil(UI.level / 4) === UI.book ? UI.level : 0;
  if(S.rota === undefined){ try{ S.rota = await api().loadRota(); }catch(e){ console.warn(e); S.rota = null; } }
  S.plan = S.plan || familyPlan();
  const pos = whereAreWe(S.club.term), b = S.plan.blocks.find(x => x.n === pos.block) || S.plan.blocks[0];
  const week = rotaWeekLetter(S.club.term);
  const head = `<div class="rhead" style="--g:${gHex};--b:${lv.color}">
      <div class="rh-chips"><span class="rh-chip" style="background:${lv.color}">${lv.name} book</span><span class="rh-chip" style="background:${gHex};color:${textOn(gHex)}">${gName} group</span></div>
      <button class="btn ghost small" data-go="choose">Change</button></div>`;
  const piecesHTML = code => { const p = b.pieces.find(x => x.code === code); if(!p) return '';
    return `${p.theme ? `<div class="rskill" style="--b:${lv.color}"><span>Skill this fortnight</span><b>${esc(p.theme)}</b></div>` : ''}${p.setup ? `<p class="rsetup"><b>Set-up:</b> ${esc(p.setup)}</p>` : ''}<div class="fstations">${stationBlock(p, col, L)}</div>`; };
  const cls = S.rota ? groupClasses(S.rota, gi) : {};
  const days = DAYS_F.filter(d => cls[d]);
  if(!days.length){
    // no rotations from the planner: show this fortnight's pieces in order
    const order = week === 'A' ? ['FF','VT','BM','BF','BA','FT'] : ['BF','BA','FT','FF','VT','BM'];
    return `${head}<p class="eyebrow" style="margin-top:16px">${b.assessment ? 'Assessment' : esc(b.weeks)} · Rotation Week ${week}</p>
      <h1 style="margin-top:0">This fortnight</h1>
      <p class="muted">Your club hasn’t shared its class rotations yet, so here is every piece your child will work on this fortnight.</p>
      ${order.map(c => b.pieces.find(p => p.code === c)).filter(Boolean).map(p => `<article class="rcard"><div class="rbar" style="background:${lv.color};color:#fff"><b>${esc(p.piece)}</b></div><div class="rbody">${piecesHTML(p.code)}</div></article>`).join('')}
      <div style="margin-top:20px">${homeBlock(b, L)}</div>
      ${moreLink()}`;
  }
  const today = DAYS_F[new Date().getDay()];
  if(!UI.day || !cls[UI.day]) UI.day = days.includes(today) ? today : days.find(d => DAYS_F.indexOf(d) > DAYS_F.indexOf(today)) || days[0];
  const list = cls[UI.day], now = new Date().getHours() * 60 + new Date().getMinutes();
  if(UI.cls == null || !list[UI.cls]){ const i = list.findIndex(c => now < c[c.length - 1].start_min + c[c.length - 1].duration); UI.cls = UI.day === today && i >= 0 ? i : 0; }
  const c = list[UI.cls], isToday = UI.day === today;
  const locs = (S.rota.locations || []);
  const locCol = n => { const l = locs.find(x => x.name === n); return l ? l.colour : '#555'; };
  return `${head}
    ${days.length > 1 ? `<div class="chips" style="margin:14px 0 4px">${days.map(d => `<button class="chip ${d === UI.day ? 'on' : ''}" data-rday="${d}">${d === today ? 'Today' : d}</button>`).join('')}</div>` : ''}
    ${list.length > 1 ? `<p class="eyebrow" style="margin:14px 0 6px">Which class?</p><div class="chips">${list.map((x, i) => `<button class="chip ${i === UI.cls ? 'on' : ''}" data-rcls="${i}">${fmtT(x[0].start_min)}</button>`).join('')}</div>` : ''}
    <p class="eyebrow" style="margin-top:18px">${isToday ? 'Today' : esc(UI.day)} · ${fmtT(c[0].start_min)} class · Rotation Week ${week}</p>
    <h1 style="margin-top:0">${gName} group rotations</h1>
    <div class="rlist">${c.map(x => {
      const loc = week === 'B' && x.locationB ? x.locationB : x.location, code = pieceCode(loc, S.rota), lc = locCol(loc);
      const on = isToday && now >= x.start_min && now < x.start_min + x.duration;
      const label = /warm/i.test(x.title || '') ? 'Warm-up' : /cool/i.test(x.title || '') ? 'Cool-down' : '';
      const body = code ? piecesHTML(code) : '';
      return `<article class="rcard ${on ? 'now' : ''}">
        <div class="rbar" style="background:${lc};color:${textOn(lc)}"><span class="rtime">${fmtT(x.start_min)}</span><b>${esc(label || (code ? (b.pieces.find(p => p.code === code) || {}).piece || loc : loc))}</b>${label ? `<span class="rloc">${esc(loc)}</span>` : ''}${!label && code && (b.pieces.find(p => p.code === code) || {}).theme ? `<span class="rpill">${esc(b.pieces.find(p => p.code === code).theme)}</span>` : ''}${on ? '<span class="rnow">NOW</span>' : ''}<span class="rdur">${x.duration} min</span></div>
        ${body ? `<details class="rbody" ${on ? 'open' : ''}><summary>See the set-up and skills</summary>${body}</details>` : ''}
      </article>`; }).join('')}</div>
    <div style="margin-top:20px">${homeBlock(b, L)}</div>
    ${moreLink()}`;
}
function moreLink(){ return `<div class="card" style="margin-top:20px"><h3 style="margin-top:0">Award book and competition</h3><p class="muted">The skills on your child’s Level assessment and their ${esc(LEVELS[UI.book - 1].name)} competition routine.</p><button class="btn ghost small" data-go="fortnight">See the full fortnight</button></div>
  <div class="foot">${esc(S.club.clubName)} · NGL Recreational · Questions? Please ask your child’s coach.</div>`; }

function classShape(){
  const t = S.club && S.club.term && S.club.term.custom ? S.club.term : null;
  const len = t ? +t.classLen || 60 : 60, r = CLASS_RULES[len] || CLASS_RULES[60];
  return {len, warm:r.warm, cool:r.cool, rot:Math.floor((len - r.warm - r.cool) / 3), own:!!t};
}

function screenProgramme(){
  const cs = classShape(), club = S.club ? esc(S.club.clubName) : 'Your club';
  const comp = S.content && S.content.competition;
  return `
  <p class="eyebrow">NGL Recreational</p>
  <h1>The NGL Recreational programme</h1>
  <p class="lead">A complete recreational gymnastics programme for British Gymnastics clubs. Award books, weekly lesson plans, warm-ups and competitions that all line up, so your child is taught every skill before they are tested on it, and competes what they have learnt.</p>

  <div class="section grid3">
    <div class="card"><div class="stat">4</div><p class="muted" style="margin-top:8px">Award books: Ruby, Pink, Teal and Indigo.</p></div>
    <div class="card"><div class="stat">16</div><p class="muted" style="margin-top:8px">Levels, four in each book. One level a term.</p></div>
    <div class="card"><div class="stat">6</div><p class="muted" style="margin-top:8px">Pieces of apparatus, with every child working at their own level.</p></div>
  </div>

  <section class="section">
    <h2>It’s all connected</h2>
    <div class="grid3 steps">
      <div class="card step"><h3>Award book</h3><p class="muted">Each level lists the skills your child works towards this term. They pass when they can do every one.</p></div>
      <div class="card step"><h3>Lesson plan</h3><p class="muted">Every class follows a plan that teaches those skills, a fortnight at a time, before the assessment weeks.</p></div>
      <div class="card step"><h3>Competition</h3><p class="muted">NGL Recreational competitions use the same four colours, so your child competes what they have been taught.</p></div>
    </div>
  </section>

  <section class="section">
    <h2>A term at ${club}</h2>
    <div class="story-grid">
      <div class="story-f"><b>One level a term</b><p>Your child works on one award-book level each term.</p></div>
      <div class="story-f"><b>Taught in fortnights</b><p>The term is planned in two-week blocks. Each block has its own themes on every piece of apparatus and its own warm-up. Half term is skipped.</p></div>
      <div class="story-f"><b>Assessed in the last two weeks</b><p>The final fortnight of every term is assessment, mixing everything practised that term. Your child passes the level when they can do every skill on it.</p></div>
      <div class="story-f"><b>Medals and certificates</b><p>A medal for each level passed, and attendance certificates every 10 sessions, from 10 to 120.</p></div>
      <div class="story-f"><b>Not passed yet?</b><p>Anything not passed is simply retaken next term, or in a catch-up session if your club runs them.</p></div>
      <div class="story-f"><b>See it at home</b><p>With your club’s family code, the This fortnight tab shows exactly what your child is working on, with photos and coaching tips.</p></div>
    </div>
  </section>

  <section class="section card">
    <h2>How a class works</h2>
    <p class="muted">${cs.own ? `${club}’s classes are ${cs.len} minutes` : `A typical class is ${cs.len} minutes`}: a warm-up, three pieces of apparatus in small groups, then a cool-down. Over each fortnight your child visits all six: forward floor, vault and beam one week; backward floor, bars and Fast Track the next.</p>
    <div class="journey" style="margin:12px 0 14px">
      <span class="jstep on">Warm-up</span><span class="jstep">Apparatus 1</span><span class="jstep">Apparatus 2</span><span class="jstep">Apparatus 3</span><span class="jstep on">Cool-down</span>
    </div>
    <div class="story-f"><b>A plan built for ${S.club ? club : 'each club'}</b><p>Every club uses the NGL plan generator to build its own lesson plans around the equipment it has, the number of weeks in its term and the length of its classes, while making sure every skill is taught before it is tested.</p></div>
  </section>

  <section class="section">
    <h2>Core skills</h2>
    <p class="muted">Every colour has a set of <b>core skills</b>: the skills in that colour’s competition routine. The four levels in each book are checkpoints on the way to them, and the stations in every class build the shapes, strength and confidence each checkpoint needs. By the end of a book, your child can perform their colour’s routine.</p>
    ${comp ? `<div class="grid4">${LEVELS.map((l, i) => { const c = comp.levels[i]; return `<div class="card" style="margin:0;border-top:6px solid ${l.color}"><h3 style="margin-bottom:2px">${l.name}</h3><p class="note" style="margin:0 0 8px">Book ${l.book} · Levels ${(l.book - 1) * 4 + 1}–${l.book * 4} · ${esc(c.tag || LEVEL_TAGS[i])}</p>
      ${[['Floor', c.floor], ['Vault', c.vault], ['Beam', c.beam], ['Bars', c.bars]].map(([t, xs]) => `<p class="note" style="margin:6px 0 2px"><b>${t}</b></p><p class="muted" style="margin:0;font-size:14px">${xs.map(esc).join(' · ')}</p>`).join('')}</div>`; }).join('')}</div>`
      : `<div class="levels-art" style="max-width:640px">${LEVELS.map((l, i) => `<div class="lvtile bg-${l.key}"><small>Book ${l.book} · ${LEVEL_TAGS[i]}</small>${l.name}</div>`).join('')}</div>`}
  </section>

  <section class="section card">
    <h2>Connected pathways</h2>
    <p class="muted">NGL Recreational is one of seven connected NGL pathways. Gymnasts move through the four books and can compete at every colour, then, if they want more, on into the NGL General and Performance Leagues.</p>
    <div class="story-grid" style="margin-top:12px">${PATHS.map(p => `<div class="story-f ${p.k === 'recreational' ? 'here' : ''}" style="border-left-color:${p.c}"><b>NGL ${p.n}</b><p>${p.d}</p></div>`).join('')}</div>
  </section>
  <div class="foot">Questions about your child’s progress? Please ask their coach. About NGL Recreational: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>`;
}

function screenLevels(){
  const bk = S.content && S.content.book, comp = S.content && S.content.competition;
  const pieces = ['Floor','Vault','Beam','Bars','Rebound','Physical Prep'];
  return `
  <p class="eyebrow">NGL Recreational pathway</p>
  <h1>Books and levels</h1>
  <p class="lead">Four award books, one for each competition colour, with four levels in each: 16 levels in all. Your child works on one level a term and is assessed in the last two weeks.</p>
  <div class="levels-art" style="max-width:640px;margin-bottom:8px">${LEVELS.map((l, i) => `<div class="lvtile bg-${l.key}"><small>Book ${l.book} · Levels ${(l.book - 1) * 4 + 1}–${l.book * 4}</small>${l.name}<small style="margin-top:4px">${LEVEL_TAGS[i]}</small></div>`).join('')}</div>
  ${bk ? LEVELS.map((l, i) => `<section class="section">
      <h2 style="color:${l.color}">Book ${l.book} · ${l.name}</h2>
      ${[0,1,2,3].map(k => { const L = i * 4 + 1 + k; return `<details class="card lvdet" style="margin:0 0 10px;border-left:6px solid ${l.color}" ${UI.level === L ? 'open' : ''}>
        <summary>Level ${L}${UI.level === L ? ' <span class="tag info">Your child</span>' : ''}</summary>
        <div class="bookgrid" style="margin-top:12px">${pieces.map(pc => { const xs = (bk[pc] && bk[pc][String(L)]) || []; return xs.length ? `<div><h3 style="margin:0 0 4px">${pc}</h3><ul class="skill-list">${xs.map(x => `<li>${esc(strip(x.skill))}</li>`).join('')}</ul></div>` : ''; }).join('')}</div>
      </details>`; }).join('')}
      ${comp ? `<details class="card lvdet" style="margin:0;border-top:4px solid ${l.color}"><summary class="sm">${l.name} competition routine (core skills)</summary>
        <div class="grid4" style="margin-top:10px">${[['Floor', comp.levels[i].floor], ['Vault', comp.levels[i].vault], ['Beam', comp.levels[i].beam], ['Bars', comp.levels[i].bars]].map(([t, xs]) => `<div><h3 style="margin:0 0 4px">${t}</h3><ol style="margin:0;padding-left:20px">${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`).join('')}</div></details>` : ''}
    </section>`).join('') : ''}
  <div class="foot">Not sure which level your child is on? Please ask their coach.</div>`;
}

/* Competition dates come straight from the NGL competition calendar */
const CAL = {list:null, error:false};
function fsVal(v){
  if(!v) return '';
  if('stringValue' in v) return v.stringValue;
  if('integerValue' in v) return +v.integerValue;
  if('doubleValue' in v) return +v.doubleValue;
  if('booleanValue' in v) return v.booleanValue;
  if('timestampValue' in v) return v.timestampValue;
  if('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
  return '';
}
async function loadComps(){
  if(CAL.list) return CAL.list;
  let all;
  if(S.demo){   // sample data: the app's sample calendar, no database
    all = CALENDAR.map(c => ({name: c.name, date: c.date, venue: c.where, level: c.who, pathway: c.path === 'recreational' ? 'recreational' : c.path}));
  } else {
    const r = await fetch(CAL_URL); if(!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    all = (j.documents || []).map(d => { const o = {}; Object.entries(d.fields || {}).forEach(([k, v]) => o[k] = fsVal(v)); return o; });
  }
  const isRec = c => c.pathway ? c.pathway === 'recreational' : /rec/i.test((c.name || '') + ' ' + (c.level || ''));
  const day = s => { const d = new Date(String(s).length === 10 ? s + 'T00:00:00' : s); return isNaN(d) ? null : d; };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  CAL.list = all.filter(isRec).map(c => Object.assign(c, {_d:day(c.date)})).filter(c => c._d && c._d >= today).sort((a, b) => a._d - b._d);
  return CAL.list;
}
/* Competition routine videos (same YouTube videos as the NGL website) */
const COMP_VIDEOS = {
  ruby:   {Floor:'QUmO-2VM4jQ', Vault:'TKV4rRq4JoQ', Beam:'6Xf6tzbyuI0', Bars:'UqIItuGwqmg'},
  pink:   {Floor:'cXcmczamdLs', Vault:'8IE9zY81g_g', Beam:'YyuTaVTMHto', Bars:'Mm_Dnm3WXzw'},
  teal:   {Floor:'AYcnuE1zZc8', Vault:'4Lgkq3aaues', Beam:'3PhzRfogvIM', Bars:'9n-AtEJIr_U'},
  indigo: {Floor:'Uu8si-DM_CI', Vault:'w58EYcW2Loo', Beam:'0GzVp2KSjbI', Bars:'pv8VOObrh0Q'}
};
const vidTile = (id, label) => id ? `<button class="cvid" data-yt="${id}" aria-label="Play ${esc(label)} routine video"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="cvid-play"></span><span class="cvid-lab">${esc(label)}</span></button>` : '';
function compVideosHTML(lvKey, only){
  const lv = LEVELS.find(l => l.key === lvKey), v = COMP_VIDEOS[lvKey] || {};
  return `<div class="cvids">${['Floor','Vault','Beam','Bars'].filter(a => !only || only === a).map(a => vidTile(v[a], lv.name + ' ' + a)).join('')}</div>`;
}

async function screenComps(){
  const rules = (S.content && S.content.competition && S.content.competition.rules) || COMP_RULES;
  if(!CAL.list && !CAL.error){ try{ await loadComps(); }catch(e){ console.error(e); CAL.error = true; } }
  const body = () => {
    if(CAL.error) return `<p class="muted">We couldn’t load the competition calendar just now. Please try again later.</p>`;
    if(!CAL.list) return `<p class="muted">Loading competition dates…</p>`;
    if(!CAL.list.length) return `<p class="muted">No NGL Recreational competitions are listed at the moment. New dates appear here as soon as they’re announced.</p>`;
    return CAL.list.map(c => `<div class="card" style="border-left:6px solid var(--rec)">
      <p class="eyebrow" style="margin:0">${esc(c._d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'}))}</p>
      <h3 style="margin:4px 0 6px">${esc(c.name || 'NGL Recreational Competition')}</h3>
      <p class="muted" style="margin:0">${[c.venue, c.region].filter(Boolean).map(esc).join(' · ')}${c.address || c.postcode ? `<br>${esc([c.address, c.postcode].filter(Boolean).join(', '))}` : ''}</p>
      ${[c.level, c.gender, Array.isArray(c.apparatus) ? c.apparatus.join(', ') : c.apparatus].filter(Boolean).length ? `<p class="note" style="margin:8px 0 0">${[c.level, c.gender, Array.isArray(c.apparatus) ? c.apparatus.join(', ') : c.apparatus].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
      ${c.address || c.postcode ? `<p style="margin:10px 0 0"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.venue, c.address, c.postcode].filter(Boolean).join(', '))}" target="_blank" rel="noopener">Map</a></p>` : ''}
    </div>`).join('');
  };
  UI.compLv = UI.compLv || (UI.book ? LEVELS[UI.book - 1].key : 'ruby');
  return `
    <p class="eyebrow">NGL Recreational</p><h1>Competitions</h1>
    <p class="lead">NGL Recreational competitions use the same four colours as the award books: Ruby, Pink, Teal and Indigo. Every routine skill is in your child’s book, so they compete what they have been taught.</p>
    <section class="section"><h2>Coming up</h2>${body()}
      <p class="note">Clubs enter their gymnasts, so please ask your coach if you’d like your child to take part.</p></section>
    <section class="section"><h2>Competition routines</h2>
      <p class="muted">Watch every routine for each colour. Tap a video to play it.</p>
      <div class="chips" style="margin:6px 0 12px">${LEVELS.map(l => `<button class="chip ${UI.compLv === l.key ? 'on' : ''}" data-complv="${l.key}" style="--c:${l.color};${UI.compLv === l.key ? '' : `border-color:${l.color}`}">${l.name}</button>`).join('')}</div>
      ${compVideosHTML(UI.compLv)}</section>
    <section class="section card"><h2>How the competitions work</h2><ul class="ticks">${rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></section>
    <div class="foot">Dates come from the NGL competition calendar.</div>`;
}

/* ---------- Entry point for the family shell ---------- */
export default async function render(ctx){
  CTX = ctx; injectCss();
  const doc = ctx.doc || {};
  S.demo = !!ctx.demo;
  const key = S.demo ? 'demo' : doc.key;
  const term = doc.term || (S.demo ? DEMO_TERM : null);
  S.club = {clubName: ctx.clubName || doc.clubName || 'Your club', clubId: doc.clubId, key, term};
  const pk = JSON.stringify(term || null);
  if(S.planKey !== pk){ S.planKey = pk; S.plan = null; }
  if(!INIT){ INIT = true;   // the app follows the child whose progress is saved on this phone
    let p = null; try{ p = JSON.parse(store.get('progress') || 'null'); }catch(e){} if(p && p.kids && p.kids.length){ const k = kid(p); if(k.current) progUse(k); } }
  if(!S.content || S.key !== key){
    try{
      if(!key) throw new Error('No programme key on this code');
      S.content = await api().loadContent(key); S.key = key; S.plan = null; S.rota = undefined; IMG.cache = {}; IMG.loaded = {};
    }catch(err){ console.error(err); S.content = null;
      return `<div class="fr"><div class="card"><p class="error">We couldn’t load the programme just now. Please try again.</p></div></div>`; }
  }
  const slug = (ctx.parts || [])[0];
  let tab = slug ? SLUG_TAB[slug] : UI.tab;
  if(!tab || !TAB_SLUG[tab]) tab = 'week';
  if(['week', 'progress', 'programme', 'levels', 'comps'].includes(tab) && slug){ UI.tab = tab; store.set('tab', tab); }
  if((tab === 'week' || tab === 'fortnight') && !(UI.book && (UI.colour || tab === 'fortnight'))) tab = 'choose';
  if(tab === 'fortnight' && !UI.level) UI.level = (UI.book - 1) * 4 + 1;
  if(tab === 'fortnight' && Math.ceil(UI.level / 4) !== UI.book) UI.level = (UI.book - 1) * 4 + 1;
  const html = await ({choose:screenChoose, week:screenRotations, fortnight:screenWeek, progress:screenProgress, programme:screenProgramme, levels:screenLevels, comps:screenComps})[tab]();
  ctx._tab = tab;
  return `<div class="fr" data-tab="${tab}"><div class="screen">${html}</div>${tabbar(tab)}</div>`;
}
export function after(ctx){
  if(ctx._tab && SHOWN !== ctx._tab){ if(SHOWN) window.scrollTo(0, 0); SHOWN = ctx._tab; }
  if(S.content) hydrateImages();
}

/* ---------- Events (document level, only for this page and its pop-ups) ---------- */
const mine = t => (t.closest && (t.closest('#famPage') && document.querySelector('#famPage .fr') || t.closest('.fr-modal')));
document.addEventListener('change', e => {
  if(!mine(e.target) || e.target.id !== 'kname') return;
  const q = prog(); kid(q).name = e.target.value.trim().slice(0, 30); progSave(q); redraw();
});
document.addEventListener('click', e => {
  const t = e.target; if(!mine(t)) return;
  // My child's progress
  const kd = t.closest('[data-kid]'); if(kd){ const p = prog(); p.active = kd.dataset.kid; progSave(p); progUse(kid(p)); redraw(); return; }
  const pl = t.closest('[data-plevel]'); if(pl){ levelSheet(+pl.dataset.plevel); return; }
  const a = t.closest('[data-pact]');
  if(a){
    const p = prog(), k = kid(p); k.passed = k.passed || {};
    const act = a.dataset.pact, n = +a.dataset.n;
    // The pop-up has already closed itself by now, so read its date from the button's own pop-up
    const ldate = () => { const box = a.closest('.modal'); const i = box && box.querySelector('#ldate'); return (i && i.value) || todayISO(); };
    if(act === 'pass'){ const d = (document.getElementById('pdate') || {}).value || todayISO(); k.passed[k.current] = d; if(k.current < 16) k.current += 1; }
    else if(act === 'setpass'){ const d = ldate(); k.passed[n] = d; if(k.current === n && n < 16) k.current = n + 1; if(!k.current) k.current = Math.min(16, n + 1); }
    else if(act === 'unpass'){ delete k.passed[n]; }
    else if(act === 'setnow'){ k.current = n; }
    else if(act === 'addkid'){ const nk = {id:'k' + Date.now(), name:'', current:0, passed:{}}; p.kids.push(nk); p.active = nk.id; }
    else if(act === 'delkid'){ if(!confirm('Remove ' + kidName(k) + ' from this phone?')) return; p.kids = p.kids.filter(x => x.id !== k.id); p.active = p.kids[0].id; }
    else if(act === 'copy'){ const txt = progSummary(p); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { const n = document.getElementById('pnote'); if(n) n.textContent = 'Summary copied.'; }).catch(() => modal(`<h2 style="margin-top:0">Progress summary</h2><textarea class="input" style="min-height:200px" aria-label="Progress summary">${esc(txt)}</textarea><div class="btn-row"><button class="btn" data-close>Close</button></div>`)); return; }
    progSave(p); progUse(kid(p));
    setTimeout(() => { if(document.querySelector('#famPage .fr[data-tab="progress"]')) redraw(); }, 0);
    return;
  }
  // Competition videos and colour chips
  const cl = t.closest('[data-complv]'); if(cl){ UI.compLv = cl.dataset.complv; redraw(); return; }
  const yt = t.closest('[data-yt]');
  if(yt){ const id = yt.dataset.yt;
    const w = document.createElement('div'); w.className = 'cvid playing';
    w.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${esc(yt.getAttribute('aria-label') || 'Routine video')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    yt.replaceWith(w); return; }
  // Choosing, tabs and blocks
  const bk = t.closest('[data-book]'); if(bk){ UI.book = +bk.dataset.book; if(UI.level && Math.ceil(UI.level / 4) !== UI.book) UI.level = 0; store.set('book', UI.book); redraw(); return; }
  const gc = t.closest('[data-colour]'); if(gc){ UI.colour = +gc.dataset.colour; store.set('colour', UI.colour); UI.tab = 'week'; store.set('tab', 'week'); UI.cls = null; go('week'); return; }
  const rd = t.closest('[data-rday]'); if(rd){ UI.day = rd.dataset.rday; UI.cls = null; redraw(); return; }
  const rc = t.closest('[data-rcls]'); if(rc){ UI.cls = +rc.dataset.rcls; redraw(); return; }
  const ft = t.closest('[data-ftab]'); if(ft){ e.preventDefault(); UI.tab = ft.dataset.ftab; store.set('tab', UI.tab); go(UI.tab); return; }
  const bl = t.closest('[data-block]'); if(bl){ UI.block = +bl.dataset.block; redraw(true); return; }
  const ph = t.closest('[data-photo]'); if(ph){ const d = IMG.cache[ph.dataset.photo]; if(d) modal(`<img src="${d}" alt="How the station is set up" style="width:100%;border-radius:12px;display:block"><div class="btn-row" style="margin-top:12px"><button class="btn ghost" data-close>Close</button></div>`); return; }
  const g = t.closest('[data-go]');
  if(g){ e.preventDefault();
    if(g.dataset.go === 'choose') go('choose');
    else if(g.dataset.go === 'fortnight'){ go('fortnight'); }
  }
});
