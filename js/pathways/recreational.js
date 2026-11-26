// Recreational: Ruby, Pink, Teal and Indigo. Built on the standard pathway model (DESIGN.md 6a).
// Screens and wording follow today's Recreational hub (nglrecreational.co.uk); the planning engine is
// copied word for word in rec-engine.js. Content: the published programme in the database when there is
// one, otherwise the public sample (Weeks 1 & 2, Level 1, the competition routines).
import { appLink } from '../config.js';
import api from '../data.js';
import { esc, gbp, date, pill, ic } from '../ui.js';
import { printHTML } from './index.js';
import { PLAN_WEEK_A as WEEK_A, PLAN_WEEK_B as WEEK_B, CLASS_RULES, PIECE_OPTS, planDefaults, buildClubPlan, clubWeekNow } from './rec-engine.js';

export const LEVELS = [
  {key: 'ruby', name: 'Ruby', book: 1, color: '#c8194a'}, {key: 'pink', name: 'Pink', book: 2, color: '#c2185b'},
  {key: 'teal', name: 'Teal', book: 3, color: '#08686b'}, {key: 'indigo', name: 'Indigo', book: 4, color: '#5a55c8'}];
export const BANDS = [
  {k: 'xs', label: '1 to 24 recreational gymnasts', price: 200}, {k: 'sm', label: '25 to 49 recreational gymnasts', price: 300},
  {k: 's', label: '50 to 99 recreational gymnasts', price: 500}, {k: 'm', label: '100 to 249 recreational gymnasts', price: 1000},
  {k: 'm2', label: '250 to 399 recreational gymnasts', price: 1250}, {k: 'l', label: '400 to 599 recreational gymnasts', price: 1500},
  {k: 'xl', label: '600 or more recreational gymnasts', price: 2000}];
const SAMPLE_URL = 'content/rec-sample.json';
// Parents open the one NGL app with the club's code
const ROTA_URL = 'https://club.nationalgymnasticsleague.co.uk/rotation-planner/';
const PIECE_NAMES = {FF: 'Forward Floor', BF: 'Backward Floor', VT: 'Vault', BM: 'Beam', BA: 'Bars', FT: 'Fast Track'};
const PIECE_COL = {FF: '#4a90d9', BF: '#01afb8', VT: '#5cb85c', BM: '#e8914f', BA: '#7b68ee', FT: '#d9534f'};
const RUNGS = [{name: 'Beginner', age: 'Guide 4–5 yrs'}, {name: 'Development', age: 'Guide 5–7 yrs'}, {name: 'Proficient', age: 'Guide 7–9 yrs'}, {name: 'Advanced', age: 'Guide 10+'}];
const GROUP_COLS = [['Orange', '#F28C28'], ['Yellow', '#F5C518'], ['Blue', '#2F80ED'], ['Red', '#E5383B'], ['Green', '#2EAD5B'], ['Purple', '#8E44AD']];
const WARM_PARTS = [['pulse', 'Pulse raiser', '3 min'], ['mob', 'Mobility', '3 min'], ['str', 'Strength & shapes', '4 min']];
const BOOK_PIECES = ['Floor', 'Vault', 'Beam', 'Bars', 'Rebound', 'Physical Prep'];
const DAYS_W = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CP_STEPS = ['Apparatus', 'Weeks', 'Dates', 'Class length'];
const bookOf = L => LEVELS[Math.ceil(L / 4) - 1];
const fmtStation = t => esc(t).replace(/FINAL SKILL:?/g, '<span class="final">Final skill:</span>').replace(/SUPPORTED/g, 'Supported');
const hhmm = m => { m = Math.round(m); const h = Math.floor(m / 60), mi = m % 60, hh = h > 12 ? h - 12 : (h === 0 ? 12 : h); return hh + ':' + String(mi).padStart(2, '0') + (h >= 12 ? 'pm' : 'am'); };
const store = (k, d) => ({get(){ try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (_) { return d; } }, set(v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }});
const GROUP = store('nglrec-group', [0, 1, 2, 3]), RUN = store('nglrec-run', {});

// ---------- state ----------
const S = {content: null, kind: null, club: null, lic: null};
export const UI = {group: GROUP.get(), block: 1, pstep: 'weeks', piece: '', wstep: 'weeks', book: 1, cstep: 0, cdraft: null, rstep: 'pick', ri: 0,
  run: Object.assign({cls: null, gi: 0, startCode: null}, RUN.get())};
const inGroup = i => UI.group.includes(i);
const licensed = () => S.lic && ['live', 'waived'].includes(S.lic.status);
const sample = () => S.kind === 'sample';

async function loadContent(){
  if (S.content) return;
  if (licensed() || (api.isAdmin && await api.isAdmin().catch(() => false))) {
    try { const c = await api.recContent?.(); if (c && c.plan) { S.content = c; S.kind = 'full'; return; } } catch (e) { console.warn('Full programme not available', e.code || e); }
  }
  const r = await fetch(SAMPLE_URL, {cache: 'force-cache'}); if (!r.ok) throw new Error('Sample not available');
  const c = await r.json(), idx = {}; (c.images || []).forEach((ch, n) => Object.keys(ch).forEach(h => { idx[h] = n; }));
  S.content = {...c, imgIndex: idx}; S.kind = 'sample';
}
async function ready(){
  const [lic, club] = await Promise.all([api.licences(), api.club()]); S.lic = lic.recreational || {}; S.club = club;
  await loadContent(); if (S.content && !S.content.imgIndex) S.content.imgIndex = {}; return S;
}

// ---------- the club plan (engine) ----------
let PLAN_CACHE = null;
function clubPlan(){
  const t = sample() ? null : S.club.recTerm, key = JSON.stringify(t || null) + '|' + (S.content.version || '') + '|' + S.content.plan.blocks.length;
  if (PLAN_CACHE && PLAN_CACHE.key === key) return PLAN_CACHE.plan;
  const plan = t && t.custom ? buildClubPlan(S.content, t) : {custom: false, settings: planDefaults(t), removed: [], adapted: [], coverage: null,
    blocks: S.content.plan.blocks.map(b => Object.assign({}, b, {warm: b.assessment ? S.content.warmups.length - 1 : Math.min(b.n - 1, S.content.warmups.length - 1)}))};
  PLAN_CACHE = {key, plan}; return plan;
}
function planNow(){
  if (sample()) return null;
  const t = S.club.recTerm, plan = clubPlan(), blocks = plan.blocks; if (!t || !t.start) return null;
  if (t.custom) { const n = clubWeekNow(t, plan); return n && !n.outside ? n : null; }
  const wk = Math.floor((Date.now() - new Date(t.start + 'T00:00:00')) / (7 * 864e5)) + 1, W = t.weeks || 14, sb = t.startBlock || 1;
  if (wk < 1 || wk > W) return null;
  if (wk > W - 2) return {block: blocks.find(x => x.assessment).n, week: wk === W - 1 ? 'A' : 'B', wk, W};
  return {block: ((sb - 1) + Math.floor((wk - 1) / 2)) % 6 + 1, week: (wk - 1) % 2 === 0 ? 'A' : 'B', wk, W};
}
const bName = b => b.assessment ? 'Assessment fortnight' : b.weeks;
const halfPill = now => now && now.half ? `<div class="card attn" style="margin-bottom:14px"><b>Half term</b>: no classes this week. Classes restart ${new Date(now.back).toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long'})}.</div>` : '';

// ---------- shared building blocks ----------
function groupPicker(compact){
  const boxes = LEVELS.map((l, i) => `<button class="grpbox ${inGroup(i) ? 'on' : ''}" style="--c:${l.color}" data-act="rec-grp" data-i="${i}" aria-pressed="${inGroup(i)}">
    <span class="grp-tick">${inGroup(i) ? '✓' : ''}</span><b>Book ${l.book}</b><span>${l.name}</span>${compact ? '' : `<small>${RUNGS[i].name} rung</small>`}</button>`).join('');
  return compact ? `<div class="grprow compact" aria-label="Your group">${boxes}</div>` : `<div class="card" style="margin-bottom:14px"><h2>Your group</h2><p class="lead">Which books is your group on? Tap one or more. Everything else is hidden.</p><div class="grprow">${boxes}</div></div>`;
}
function stars(s, i){
  const a = (s.assess && s.assess[String(i)] || []).filter(y => inGroup(Math.ceil(y.L / 4) - 1)); if (!a.length) return '';
  return `<div class="stars">${a.map(y => { const b = bookOf(y.L); return `<span class="star" style="--c:${b.color}">★ ${b.name} L${y.L}<span class="sk"> · ${esc(y.s)}</span></span>`; }).join('')}</div>`;
}
const photos = s => [...new Set((s.img || []).flat().filter(Boolean))];
const tips = s => { const n = s.tips && s.tips.safety; return n ? `<div class="safety"><b>Safety</b> ${esc(n)}</div>` : ''; };
const ladder = p => p.stations.map(s => `<div class="ladder"><div class="ladder-h">Station ${s.n}</div>${tips(s)}
  ${[0, 1, 2, 3].filter(inGroup).map(i => s.levels[i] ? `<div class="rung ${stars(s, i) ? 'starred' : ''}"><div class="rung-n">${RUNGS[i].name}<span>${RUNGS[i].age}</span></div><div class="rung-t">${fmtStation(s.levels[i])}</div>${stars(s, i)}</div>` : '').join('')}</div>`).join('')
  + `<p class="lead" style="font-size:13px">★ marks a rung that prepares an award-book checkpoint: the book colour and level it is assessed at.</p>`;
const setupGrid = p => `<div class="setgrid">${p.stations.map(s => { const ph = photos(s);
  return `<div class="setcard"><div class="setn">${s.n}</div>${ph.length ? `<button class="setphoto" data-act="rec-photo" data-img-id="${ph[0]}" aria-label="Enlarge station ${s.n} photo"><img data-img="${ph[0]}" alt="Station ${s.n} set-up"></button>` : '<div class="setphoto empty">No photo yet</div>'}</div>`; }).join('')}</div>`;
function skillVideo(p){
  const vids = S.content.videos || {}, themes = String(p.theme).split(' + ');
  const list = themes.flatMap(t => { const v = vids[p.code + '|' + t]; return !v ? [] : Array.isArray(v) ? v : [v]; }).filter(Boolean);
  return `<div class="card skillvid"><h3>Show your class today’s skill</h3>${list.length ? `<div class="vidbox"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(list[0])}?rel=0&playsinline=1&mute=1" title="${esc(p.theme)}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>${list.length > 1 ? `<p class="lead" style="margin:8px 0 0;font-size:13px">${list.length} parts: the others are in the plan.</p>` : ''}` : `<p class="lead" style="margin:0">${esc(themes[0])}: video coming soon.</p>`}</div>`;
}
function fortnights(key, now){
  const blocks = clubPlan().blocks;
  return `${now ? `<button class="bigbtn now" data-act="${key}" data-v="${now.block}"><small>This week · week ${now.wk} of ${now.W}</small><b>${esc(blocks.find(x => x.n === now.block).weeks)} · Week ${now.week}</b></button>` : ''}
  <p class="flow-l">${now ? 'Or pick a fortnight' : 'Pick a fortnight'}</p>
  <div class="bbgrid">${blocks.map(x => `<button class="bigbtn ${x.assessment ? 'assess' : ''}" data-act="${key}" data-v="${x.n}"><b>${esc(x.assessment ? 'Assessment' : x.weeks)}</b><small>${esc(x.assessment ? x.weeks : x.pieces.filter(p => WEEK_A.includes(p.code)).map(p => p.theme).join(' · '))}</small></button>`).join('')}</div>`;
}
const sampleNote = what => sample() ? `<div class="card" style="border-left:4px solid var(--rec);margin-bottom:14px"><b>${licensed() ? 'Sample programme' : 'You’re exploring a sample'}</b><small style="display:block;color:var(--muted)">${licensed() ? 'This sandbox shows the public sample (Weeks 1 & 2, Level 1). The full programme comes across with the switch-over.' : `Weeks 1 & 2, Level 1 of the award books and the competition routines. A Club Licence opens ${what}.`}</small></div>` : '';

// ---------- Teach: Run your class · Lesson plan · Warm-ups · Club plan ----------
const TEACH = [['', 'Run your class'], ['plan', 'Lesson plan'], ['warmups', 'Warm-ups'], ['club', 'Club plan']];
function teachPills(sub){ return `<div class="paths" style="margin-bottom:14px">${TEACH.map(([k, l]) => `<a class="${(sub || '') === k ? 'on' : ''}" style="--c:var(--rec)" href="#/programmes/recreational/teach${k ? '/' + k : ''}">${l}</a>`).join('')}<a style="--c:var(--rec)" href="${ROTA_URL}" target="_blank" rel="noopener">Class rotations ↗</a></div>`; }

function lessonPlan(){
  const blocks = clubPlan().blocks, now = planNow(), b = blocks.find(x => x.n === UI.block) || blocks[0], p = b.pieces.find(x => x.code === UI.piece);
  const back = (label, to) => `<button class="backbar" data-act="rec-pstep" data-v="${to}">← ${esc(label)}</button>`;
  if (UI.pstep === 'setup' && p) return `${back(bName(b), 'app')}<h2 class="flow-h">${esc(p.piece)}</h2><p class="lead"><b>${esc(p.theme)}</b>${p.setup ? ' · ' + esc(p.setup) : ''} · ${p.stations.length} stations</p>
    ${skillVideo(p)}${setupGrid(p)}<button class="bigbtn wide go" data-act="rec-pstep" data-v="ladder"><b>Skills →</b><small>What each child does at each station</small></button>`;
  if (UI.pstep === 'ladder' && p) return `${back(p.piece + ' set-up', 'setup')}<div class="flow-hrow"><h2 class="flow-h">${esc(p.piece)} skills</h2><button class="btn sm ghost" data-act="rec-print" data-scope="piece">Print</button></div>
    <p class="lead"><b>${esc(p.theme)}</b> · start each child on the rung that suits them, from Beginner up</p>${groupPicker(true)}${ladder(p)}`;
  if (UI.pstep === 'app') { const tile = code => { const x = b.pieces.find(y => y.code === code); if (!x) return '';
      const hot = now && now.block === b.n && (now.week === 'A' ? WEEK_A : WEEK_B).includes(code);
      return `<button class="bigbtn ${hot ? 'now' : ''}" data-act="rec-piece" data-v="${code}"><b>${esc(x.piece)}</b><small>${esc(x.theme)}</small></button>`; };
    return `${back('Fortnights', 'weeks')}<div class="flow-hrow"><h2 class="flow-h">${esc(bName(b))}</h2><button class="btn sm ghost" data-act="rec-print" data-scope="fortnight">Print fortnight</button></div>
      ${b.assessment ? '<p class="lead">Last 2 weeks of term. Run these stations while gymnasts are assessed.</p>' : ''}
      <button class="bigbtn wide warm" data-act="rec-warm-from" data-v="${b.n}"><b>Warm-up</b><small>10 min · same both weeks</small></button>
      <p class="flow-l">Week A</p><div class="bbgrid three">${WEEK_A.map(tile).join('')}</div>
      ${WEEK_B.some(c => b.pieces.find(x => x.code === c)) ? `<p class="flow-l">Week B</p><div class="bbgrid three">${WEEK_B.map(tile).join('')}</div>` : ''}`; }
  return `<div class="flow-hrow"><h2 class="flow-h">Lesson plan</h2>${sample() ? '' : '<button class="btn sm ghost" data-act="rec-print" data-scope="term">Print whole term</button>'}</div>${halfPill(now)}${groupPicker(false)}${fortnights('rec-block', now)}
    ${now || sample() ? '' : '<p class="lead" style="margin-top:12px">Set your term in Club plan and the Hub opens on this week.</p>'}`;
}

function warmBody(blk){
  const b = S.content.warmups[blk.warm]; if (!b) return '<p class="empty">No warm-up for this fortnight yet.</p>';
  return `<p class="lead"><b>Focus:</b> ${esc(b.focus)}</p>` + (b.assess ? `<div class="ladder"><div class="ladder-h">Assessment warm-up</div><div class="rung"><div class="rung-t">Pulse raiser for everyone: stretch, tuck and star jumps in connection (3 min). Then each gymnast runs the four Physical Prep skills from their own award-book level while coaches check them off (7 min).</div></div></div>`
    : WARM_PARTS.map(([k, n, t]) => `<div class="ladder"><div class="ladder-h">${n} <small>· ${t}</small></div>${[0, 1, 2, 3].filter(inGroup).map(c => (b.parts[k][c] || []).length ? `<div class="rung"><div class="rung-n">${RUNGS[c].name}<span>${RUNGS[c].age}</span></div>
      <div class="rung-t">${b.parts[k][c].map(x => esc(x.txt)).join('<br>')}</div><div class="stars">${b.parts[k][c].map(x => { const bk = bookOf(x.L); return `<span class="star" style="--c:${bk.color}">★ ${bk.name} L${x.L}</span>`; }).join('')}</div></div>` : '').join('')}</div>`).join(''))
    + '<p class="lead" style="font-size:13px">The whole group warms up together, each child on the rung that suits them. ★ shows the award-book level each exercise comes from.</p>';
}
function warmups(){
  const now = planNow(), blocks = clubPlan().blocks;
  if (UI.wstep !== 'show') return `<h2 class="flow-h">Warm-ups</h2><p class="lead">10 minutes · the same warm-up both weeks of a fortnight</p>${groupPicker(false)}${fortnights('rec-wblock', now)}`;
  const blk = blocks.find(x => x.n === UI.block) || blocks[0];
  return `<button class="backbar" data-act="rec-wstep" data-v="weeks">← Fortnights</button><h2 class="flow-h">Warm-up · ${esc(blk.assessment ? 'Assessment' : blk.weeks)}</h2>${groupPicker(true)}${warmBody(blk)}`;
}

// Run your class: warm-up, each piece in rotation order, "Rotate to …", cool-down
function rotaRec(){ try { const r = S.club.rotaJson ? JSON.parse(S.club.rotaJson) : null; return r && r.rec && r.rec.classes && r.rec.classes.length ? r.rec : null; } catch (_) { return null; } }
const recClasses = () => { const rec = rotaRec(); return rec ? rec.classes.flatMap(c => ((c.days && c.days.length) ? c.days : [c.day || 'Monday']).map(d => Object.assign({}, c, {day: d, key: c.id + '|' + d}))) : []; };
function runWhen(){ const now = planNow(), blocks = clubPlan().blocks; const block = UI.run.block || (now ? now.block : blocks[0].n), week = UI.run.week || (now ? now.week : 'A');
  return {b: blocks.find(x => x.n === block) || blocks[0], week, now}; }
function runOrder(){
  const {b, week} = runWhen(), t = planDefaults(S.club.recTerm), rule = CLASS_RULES[t.classLen] || CLASS_RULES[60];
  const have = c => b.pieces.some(p => p.code === c), setA = WEEK_A.filter(have), setB = WEEK_B.filter(have);
  const rec = rotaRec(), cls = recClasses().find(c => c.key === UI.run.cls); let pieces, j = 0;
  if (cls) { const gi = UI.run.gi, rotA = gi < 3, pat = rec && rec.pattern && rec.pattern[gi];
    if (pat && Array.isArray(pat[week]) && pat[week].filter(have).length) { pieces = pat[week].filter(have); j = 0; }
    else { pieces = rotA ? (week === 'A' ? setA : setB) : (week === 'A' ? setB : setA); j = rotA ? gi : gi - 3; } }
  else { pieces = setB.includes(UI.run.startCode) ? setB : setA; j = Math.max(0, pieces.indexOf(UI.run.startCode)); }
  const n = pieces.length, order = pieces.map((_, r) => pieces[(j + r) % n]);
  const start = cls ? cls.start : null, teach = t.classLen - rule.warm - rule.cool, base = Math.floor(teach / Math.max(1, n));
  const steps = [{k: 'warm', a: start, d: rule.warm}]; let at = start == null ? null : start + rule.warm;
  order.forEach((code, r) => { const d = r === n - 1 ? teach - base * (n - 1) : base; ['rot', 'vid', 'demo'].forEach(k => steps.push({k, code, a: at, d})); if (at != null) at += d; });
  steps.push({k: 'cool', a: at, d: rule.cool});
  return {steps, b, week, cls, map: (rec && rec.map) || {}};
}
const stepLabel = s => s.k === 'warm' ? 'Warm-up' : s.k === 'cool' ? 'Cool-down' : s.k === 'rot' ? 'Rotate to ' + PIECE_NAMES[s.code] : s.k === 'vid' ? 'Show the skill' : 'Demo the stations';
function runPick(){
  const rec = rotaRec(), blocks = clubPlan().blocks, {b, week, now} = runWhen(), today = DAYS_W[(new Date().getDay() + 6) % 7], all = recClasses();
  const days = DAYS_W.filter(d => all.some(c => c.day === d)), day = days.includes(UI.run.day) ? UI.run.day : (days.includes(today) ? today : days[0]);
  const classes = all.filter(c => c.day === day).sort((x, y) => x.start - y.start), cls = all.find(c => c.key === UI.run.cls);
  const pieces = [...WEEK_A, ...WEEK_B].filter(c => b.pieces.some(p => p.code === c));
  const ready = rec ? cls : UI.run.startCode;
  return `<h2 class="flow-h">Run your class</h2>${halfPill(now)}
    <p class="lead">${now ? `This week: <b>${esc(b.assessment ? 'Assessment' : b.weeks)} · Week ${week}</b> (week ${now.wk} of ${now.W})` : `<b>${esc(b.assessment ? 'Assessment' : b.weeks)} · Week ${week}</b>`}</p>
    ${now ? '' : `<p class="flow-l">Which fortnight?</p><div class="chips">${blocks.map(x => `<button class="chip ${x.n === b.n ? 'on' : ''}" data-act="rec-run-set" data-k="block" data-v="${x.n}">${esc(x.assessment ? 'Assessment' : x.weeks)}</button>`).join('')}</div>
      <p class="flow-l">Which week?</p><div class="chips">${['A', 'B'].map(w => `<button class="chip ${w === week ? 'on' : ''}" data-act="rec-run-set" data-k="week" data-v="${w}">Week ${w}</button>`).join('')}</div>`}
    ${rec ? `<p class="flow-l">1 · Which class?</p>${days.length > 1 ? `<div class="chips">${days.map(d => `<button class="chip ${d === day ? 'on' : ''}" data-act="rec-run-set" data-k="day" data-v="${d}">${d === today ? 'Today' : d.slice(0, 3)}</button>`).join('')}</div>` : ''}
      <div class="bbgrid">${classes.map(c => `<button class="bigbtn ${c.key === UI.run.cls ? 'now' : ''}" data-act="rec-run-set" data-k="cls" data-v="${esc(c.key)}"><b>${hhmm(c.start)}</b><small>${esc(c.day)} · ${c.groups} group${c.groups === 1 ? '' : 's'}</small></button>`).join('')}</div>
      ${cls ? `<p class="flow-l">2 · Which group are you coaching?</p><div class="bbgrid three">${Array.from({length: cls.groups}, (_, gi) => `<button class="bigbtn ${gi === UI.run.gi ? 'now' : ''}" style="border-left:8px solid ${GROUP_COLS[gi][1]}" data-act="rec-run-set" data-k="gi" data-v="${gi}"><b>${esc((cls.names && cls.names[gi]) || GROUP_COLS[gi][0])}</b><small>Rotation ${gi < 3 ? 'A' : 'B'}</small></button>`).join('')}</div>` : ''}`
    : `<div class="card" style="margin:14px 0"><p class="lead" style="margin:0 0 8px">Add your Recreational classes in the free NGL Rotation Planner and this screen will know each group’s rotation order for you.</p><a class="btn sm ghost" href="${ROTA_URL}" target="_blank" rel="noopener">Open the Rotation Planner ↗</a></div>
      <p class="flow-l">Which piece does your group start on?</p><p class="lead" style="font-size:13px">With up to six groups in the hall, groups start on all six pieces. Your group then goes round the other two pieces in its set.</p>
      <div class="bbgrid three">${pieces.map(c => { const p = b.pieces.find(x => x.code === c); return `<button class="bigbtn ${UI.run.startCode === c ? 'now' : ''}" data-act="rec-run-set" data-k="startCode" data-v="${c}"><b>${esc(p.piece)}</b><small>${esc(p.theme)}</small></button>`; }).join('')}</div>`}
    <p class="flow-l">${rec ? '3 · ' : ''}Which books is your group on?</p>${groupPicker(true)}
    ${ready ? (() => { const o = runOrder(); return `<div class="runprev">${o.steps.filter(s => s.k !== 'vid' && s.k !== 'demo').map(s => `<span class="rp" style="${s.k === 'rot' ? `--p:${PIECE_COL[s.code]}` : ''}">${s.k === 'warm' ? 'Warm-up' : s.k === 'cool' ? 'Cool-down' : esc(PIECE_NAMES[s.code])}${s.a != null ? `<small>${hhmm(s.a)}</small>` : ''}</span>`).join('<i>›</i>')}</div>
      <button class="bigbtn wide go" data-act="rec-run-start"><b>Start class →</b><small>Warm-up first, then each piece in order</small></button>`; })() : ''}`;
}
function runSequence(){
  const o = runOrder(), steps = o.steps, i = Math.min(UI.ri, steps.length - 1), s = steps[i], nxt = steps[i + 1];
  const p = s.code ? o.b.pieces.find(x => x.code === s.code) : null, col = s.code ? PIECE_COL[s.code] : 'var(--rec)';
  let body = '';
  if (s.k === 'warm') body = groupPicker(true) + warmBody(o.b);
  else if (s.k === 'cool') body = `<div class="card"><p>Bring the group together on the floor.</p><p>Gentle stretches for the muscles used today.</p><p>Ask: <b>what did we learn on each piece?</b> Praise effort.</p></div>`;
  else if (s.k === 'rot') body = `<div class="rotcard" style="--p:${col}"><small>Rotate to</small><b>${esc(PIECE_NAMES[s.code])}</b><em>${esc(p.theme)}</em></div>`;
  else if (s.k === 'vid') body = `<p class="lead">Gather the group and show them today’s skill: <b>${esc(p.theme)}</b>.</p>${skillVideo(p)}`;
  else body = `<p class="lead">Walk the group round. At each station, show the shape and say <b>why it matters</b> for today’s skill. ★ stations are on the award book.</p>${groupPicker(true)}${setupGrid(p)}${ladder(p)}`;
  const nextLabel = !nxt ? 'Finish class ✓' : nxt.k === 'rot' ? 'Rotate to ' + PIECE_NAMES[nxt.code] + ' →' : nxt.k === 'vid' ? 'We’re here: show the skill →' : nxt.k === 'demo' ? 'Demo the stations →' : 'Cool-down →';
  return `<div class="runhead"><b>${esc(o.b.assessment ? 'Assessment' : o.b.weeks)} · Week ${o.week}</b><button class="btn sm ghost" data-act="rec-run-exit" style="margin-left:auto">Change</button></div>
    <div class="runprog">${steps.map((x, k) => `<button class="rpn ${k === i ? 'on' : ''} ${k < i ? 'done' : ''}" style="--p:${x.code ? PIECE_COL[x.code] : 'var(--rec)'}" data-act="rec-run-go" data-v="${k}" aria-label="Step ${k + 1}: ${esc(stepLabel(x))}">${k + 1}</button>`).join('')}</div>
    <div class="stephead" style="--p:${col}"><div class="stepnum">${i + 1}</div><div><small>${s.code ? esc(PIECE_NAMES[s.code]) : 'Step ' + (i + 1) + ' of ' + steps.length}</small><h2 class="flow-h" style="margin:0">${esc(stepLabel(s))}</h2>
      <p class="lead" style="margin:0">${s.a != null ? `${hhmm(s.a)}–${hhmm(s.a + s.d)}` : `${s.d} min`}</p></div></div>
    ${body}<div class="btn-row"><button class="bigbtn wide go" style="--p:${nxt && nxt.code ? PIECE_COL[nxt.code] : 'var(--red)'}" data-act="rec-run-next"><b>${esc(nextLabel)}</b></button>${i > 0 ? `<button class="btn ghost" data-act="rec-run-go" data-v="${i - 1}">← Back</button>` : ''}</div>`;
}

// Club plan: four questions, then the engine builds the term
function coverage(plan){
  const cov = plan.coverage || [];
  return `<h2 class="flow-h">What your plan covers</h2><div class="grid g2">${cov.map((c, i) => { const l = LEVELS[i], ok = c.got === c.need;
    return `<div class="card" style="border-left:6px solid ${l.color}"><b>Book ${l.book} · ${l.name}</b><p style="margin:4px 0">${ok ? '✓ Every checkpoint taught' : `${c.need - c.got} checkpoint${c.need - c.got === 1 ? '' : 's'} won’t fit`}</p><small style="color:var(--muted)">${c.got} of ${c.need} apparatus skills taught before assessment</small>
      ${ok ? '' : `<ul>${c.missing.map(m => `<li>${esc(m.p)} L${m.L}: ${esc(m.s)}</li>`).join('')}</ul>`}</div>`; }).join('')}</div>
    <p class="lead" style="font-size:13px">Physical Prep skills are covered in the warm-ups.${cov.some(c => c.got < c.need) ? ' To fit everything, choose 60-minute classes or a longer term, or cover these in a catch-up session.' : ''}</p>
    ${plan.removed.length ? `<div class="card attn"><b>${plan.removed.map(c => PIECE_NAMES[c]).join(' and ')} removed</b> from the plan and from assessment.${plan.twoPiece ? ' We recommend your gymnasts compete <b>2-piece (Floor and Vault)</b>.' : ''}</div>` : ''}
    ${plan.adapted.map(a => `<div class="card" style="margin-top:8px">${esc(a)}</div>`).join('')}`;
}
function clubPlanScreen(){
  if (sample()) return `<h2 class="flow-h">Your club plan</h2>${STORY}<a class="bigbtn wide go" href="#/programmes/recreational/licence"><b>See the licence →</b><small>Build your own plan with a Club Licence</small></a>`;
  const t = S.club.recTerm;
  if (UI.cstep) return wizard(UI.cstep);
  if (!t || !t.custom) return `<h2 class="flow-h">Build your club plan</h2><p class="lead">Four quick questions about your apparatus, your term and your classes. The Hub then builds a lesson plan for your club that still teaches every tested skill before assessment.</p>
    <button class="bigbtn wide go" data-act="rec-cp-start"><b>Start →</b><small>About 2 minutes</small></button><p class="lead" style="font-size:13px">Until you do this, coaches see the standard NGL plan (14 weeks, 60-minute classes, all apparatus).</p>${STORY}`;
  const plan = clubPlan(), st = plan.settings, W = st.weeks, pcs = [...WEEK_A, ...WEEK_B].filter(c => !plan.removed.includes(c));
  return `<h2 class="flow-h">Your club plan</h2><div class="grid g3">
    <div class="card"><small>Term</small><b style="display:block">${W} weeks from ${date(st.start)}</b>${st.halfTerm ? `<small>Half term w/c ${date(st.halfTerm)}</small>` : ''}</div>
    <div class="card"><small>Classes</small><b style="display:block">${st.classLen} minutes</b><small>${plan.rule.warm} min warm-up · 3 × ${plan.rule.rot} min · ${plan.rule.cool} min cool-down</small></div>
    <div class="card"><small>Apparatus</small><b style="display:block">${pcs.map(c => PIECE_NAMES[c]).join(', ')}</b>${plan.removed.length ? `<small>Not used: ${plan.removed.map(c => PIECE_NAMES[c]).join(', ')}</small>` : ''}</div></div>
    <div class="btn-row"><button class="btn ghost" data-act="rec-cp-start">Change set-up</button></div>${coverage(plan)}
    <h2 class="flow-h" style="margin-top:18px">Print your plan</h2><p class="lead">One page per apparatus, with numbered photos.</p>
    <button class="bigbtn wide" data-act="rec-print" data-scope="term"><b>Whole term</b><small>Every fortnight, every apparatus</small></button>
    <p class="flow-l">Whole term, one apparatus</p><div class="bbgrid three">${pcs.map(c => `<button class="bigbtn" data-act="rec-print" data-scope="termPiece" data-arg="${c}"><b>${PIECE_NAMES[c]}</b><small>All fortnights</small></button>`).join('')}</div>`;
}
function wizard(n){
  const d = UI.cdraft || (UI.cdraft = planDefaults(S.club.recTerm));
  const prog = `<div class="cp-prog">${CP_STEPS.map((x, i) => `<div class="${i + 1 < n ? 'done' : ''} ${i + 1 === n ? 'on' : ''}"><span>${i + 1}</span>${x}</div>`).join('')}</div>`;
  const nav = ok => `<div class="btn-row">${n > 1 ? `<button class="btn ghost" data-act="rec-cp-step" data-n="${n - 1}">← Back</button>` : '<button class="btn ghost" data-act="rec-cp-cancel">Cancel</button>'}<button class="btn" data-act="rec-cp-step" data-n="${n + 1}" ${ok ? '' : 'disabled'}>${n === 4 ? 'Build my plan →' : 'Next →'}</button></div>`;
  if (n === 1) return prog + `<h2 class="flow-h">Which apparatus do you have?</h2><p class="lead">Floor is always included. Pick the best you have for each.</p>
    ${['VT', 'BM', 'BA', 'FT'].map(code => `<div class="card" style="margin-bottom:10px"><b>${PIECE_NAMES[code]}</b><div class="chips" style="margin-top:8px">${PIECE_OPTS[code].map(([v, l]) => `<button class="chip ${d.pieces[code] === v ? 'on' : ''}" data-act="rec-cp-set" data-k="${code}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('')}${nav(true)}`;
  if (n === 2) return prog + `<h2 class="flow-h">How many weeks in the term?</h2><p class="lead">Including the 2 assessment weeks at the end. Leave out half term.</p>
    <div class="bbgrid">${[10, 11, 12, 13, 14, 15].map(w => `<button class="bigbtn ${d.weeks === w ? 'now' : ''}" data-act="rec-cp-set" data-k="weeks" data-v="${w}"><b>${w}</b><small>weeks</small></button>`).join('')}</div>${nav(true)}`;
  if (n === 3) return prog + `<h2 class="flow-h">When does term start?</h2><label class="field"><span>First week of term</span><input id="cpStart" type="date" value="${esc(d.start)}" data-cp="start"></label>
    <label class="field"><span>Half-term week starts (optional)</span><input id="cpHalf" type="date" value="${esc(d.halfTerm)}" data-cp="halfTerm"></label><p class="lead" style="font-size:13px">The Hub skips half term, so “This week” stays right all term.</p>${nav(!!d.start)}`;
  if (n === 4) return prog + `<h2 class="flow-h">How long are your classes?</h2><div class="bbgrid three">${[45, 60, 75].map(m => { const r = CLASS_RULES[m]; return `<button class="bigbtn ${d.classLen === m ? 'now' : ''}" data-act="rec-cp-set" data-k="classLen" data-v="${m}"><b>${m} minutes</b><small>${r.warm} min warm-up · 3 × ${r.rot} min · ${r.cool} min cool-down</small></button>`; }).join('')}</div>${nav(true)}`;
  const plan = buildClubPlan(S.content, Object.assign({}, d, {custom: true}));
  return `<h2 class="flow-h">Your plan is ready</h2><p class="lead">${d.weeks} weeks · ${d.classLen}-minute classes · ${plan.F} teaching fortnights${plan.odd ? ' and 1 single week' : ''}, then 2 assessment weeks</p>${coverage(plan)}
    <div class="btn-row"><button class="btn ghost" data-act="rec-cp-step" data-n="4">← Back</button><button class="btn" data-act="rec-cp-save">Save and share with coaches</button></div>`;
}
const STORY = `<div class="grid g2" style="margin:14px 0">${[
  ['Tell us your set-up', 'Your apparatus, the number of weeks in your term, when it starts (and half term), and how long your classes are. Four quick screens, about two minutes.'],
  ['The Hub builds your term', 'It starts from the full NGL plan and fits it to you. Every tested skill is placed before the assessment weeks, and you see a tick for each award book before you save.'],
  ['Week A and Week B', 'Week A is Forward Floor, Vault and Beam. Week B is Backward Floor, Bars and Fast Track. Every group visits all six pieces each fortnight.'],
  ['Four rungs on every station', 'Beginner, Development, Proficient and Advanced. Mixed groups train together, each child on the right rung for them.'],
  ['Works with the apparatus you have', 'No bars? Bars come out of the plan and the assessment. A floor beam or a vault block is used instead, and those skills are marked adapted.'],
  ['Knows what week it is', 'Half term is skipped, so “This week” is always right for coaches and parents.']].map(([h, t]) => `<div class="card"><b>${h}</b><p class="lead" style="margin:4px 0 0;font-size:14px">${t}</p></div>`).join('')}</div>`;

// ---------- the six tabs ----------
const tabs = {
  async overview(p){
    const now = planNow(), blocks = clubPlan().blocks, b = now ? blocks.find(x => x.n === now.block) : blocks[0];
    const today = b.pieces.filter(x => (now && now.week === 'B' ? WEEK_B : WEEK_A).includes(x.code));
    return `${sampleNote('every fortnight, all four books and all 16 levels, the family app and ordering')}${halfPill(now)}
      <h2>${now ? `This week · ${esc(b.weeks)} · Week ${now.week}` : esc(b.weeks)}</h2><p class="lead">${now ? `Week ${now.wk} of ${now.W}` : 'Set your term in Teach → Club plan and the Hub opens on this week.'}</p>
      <div class="grid g3">${today.map(x => `<a class="card tile" href="#/programmes/recreational/teach/plan" data-act="rec-open" data-block="${b.n}" data-piece="${x.code}">${ic('plan', PIECE_COL[x.code])}<div><b>${esc(x.piece)}</b><br><small style="color:var(--muted)">${esc(x.theme)}</small></div></a>`).join('')}</div>
      <div class="grid g3" style="margin-top:16px">
        <a class="card tile" href="#/programmes/recreational/teach">${ic('comp', p.c)}<div><b>Run your class</b><br><small style="color:var(--muted)">Warm-up, rotations and cool-down, step by step</small></div></a>
        <a class="card tile" href="#/programmes/recreational/teach/plan">${ic('plan', p.c)}<div><b>Lesson plan</b><br><small style="color:var(--muted)">Every fortnight, set-up photos and skill ladders</small></div></a>
        <a class="card tile" href="#/programmes/recreational/awards">${ic('book', p.c)}<div><b>Award books</b><br><small style="color:var(--muted)">Ruby to Indigo, 16 levels, assessment sheets</small></div></a></div>`;
  },
  async teach(p, sub){
    const body = sub === 'plan' ? lessonPlan() : sub === 'warmups' ? warmups() : sub === 'club' ? clubPlanScreen() : (UI.rstep === 'go' ? runSequence() : runPick());
    return teachPills(sub) + sampleNote('every fortnight and your own club plan') + body;
  },
  async awards(p){
    const bk = S.content.book, n = sample() ? 1 : UI.book, L0 = (n - 1) * 4 + 1, lv = LEVELS[n - 1], levels = sample() ? [0] : [0, 1, 2, 3];
    return sampleNote('all four books and all 16 levels') + `${sample() ? '' : `<div class="chips" style="margin-bottom:12px">${LEVELS.map(l => `<button class="chip ${UI.book === l.book ? 'on' : ''}" style="--c:${l.color}" data-act="rec-book" data-v="${l.book}">Book ${l.book} · ${l.name}</button>`).join('')}</div>`}
      <p class="lead">${sample() ? `Sample · ${lv.name} · Level 1 across all six pieces` : `Book ${n} · ${lv.name} · Levels ${L0}–${L0 + 3}`}</p>
      ${levels.map(k => { const L = L0 + k; return `<div class="flow-hrow" style="margin-top:14px"><h2 class="flow-h" style="margin:0"><span class="dot" style="background:${lv.color};display:inline-block;margin-right:8px"></span>Level ${L}</h2><button class="btn sm ghost" data-act="rec-sheet" data-level="${L}">Assessment sheet</button></div>
        <div class="grid g3">${BOOK_PIECES.map(pc => `<div class="card"><h3 style="margin:0 0 6px">${pc}</h3><ul style="margin:0;padding-left:18px">${(bk[pc] && bk[pc][String(L)] || []).map(x => `<li>${esc(x.skill)}</li>`).join('')}</ul></div>`).join('')}</div>`; }).join('')}
      <p class="lead" style="margin-top:14px">Gymnasts pass a level when they can do every skill on it. Assessment is in the last 2 weeks of term.</p>
      <div class="card" style="margin-top:12px"><h2>Order books, medals and t-shirts</h2><p class="lead">Award books £5 (RRP £10) · medals £3 (RRP £5) · t-shirts £12.</p>${licensed() ? '<a class="btn" href="#/shop">Order in the shop</a>' : '<span class="pill">Ordering opens once your Recreational licence is live</span>'}</div>`;
  },
  async compete(p){
    const c = S.content.competition, row = (t, xs) => `<h3 style="margin:10px 0 4px">${t}</h3><ol style="margin:0;padding-left:20px">${(xs || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
    const comps = (await api.competitions()).filter(x => x.path === 'recreational');
    return `<div class="card" style="margin-bottom:16px"><h2>Recreational competitions</h2>${comps.length ? `<table>${comps.map(x => `<tr><td><b>${date(x.date)}</b></td><td><b>${esc(x.name)}</b><br><small style="color:var(--muted)">${esc(x.where)} · ${esc(x.who)}</small></td><td style="text-align:right">${x.reserved || x.waiting ? '<a class="btn sm ghost" href="#/competitions/places">My places</a>' : `<button class="btn sm" data-act="reserve" data-comp="${x.id}">Reserve places</button>`}</td></tr>`).join('')}</table>` : '<p class="empty">No Recreational competitions on the calendar yet.</p>'}</div>
      <h2>Routines by level</h2><div class="grid g2">${c.levels.map((l, i) => `<div class="card" style="border-top:6px solid ${LEVELS[i].color}"><p class="kick" style="color:${LEVELS[i].color}">Level ${l.n} · ${esc(l.tag)}</p><h2 style="margin:0">${esc(l.name)}</h2>
        ${row('Floor (strip)', l.floor)}${row('Vault', l.vault)}<p class="lead" style="font-size:13px">${esc(c.vaultNote[i])}</p>${row('Beam', l.beam)}${row('Bars', l.bars)}</div>`).join('')}</div>
      <div class="card" style="margin-top:16px"><h2>Rules and format</h2><ul>${c.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
  },
  async families(p){
    const code = S.club.recCode || (S.lic && S.lic.code), link = code ? appLink('?code=' + encodeURIComponent(code)) : '';
    return `<div class="card"><h2>Family app</h2><p class="lead">Parents see what their child is learning this fortnight and how it links to their award book and the Recreational Competition. No child details are stored.</p>
      ${licensed() ? (code ? `<p><b>Your club code: ${esc(code)}</b></p><div style="display:flex;gap:10px;flex-wrap:wrap"><input readonly value="${esc(link)}" style="flex:1;min-width:240px;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit" aria-label="Family link"><button class="btn" data-act="rec-copy" data-v="${esc(link)}">Copy link</button><a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Open ↗</a></div>`
        : `<p class="lead">Your family code is created when your licence switches on. In the sandbox it appears after the switch-over.</p>`) : `<span class="pill">The family app opens with your Recreational licence</span> <a class="btn sm ghost" href="#/programmes/recreational/licence">See the licence</a>`}</div>`;
  },
  async licence(p){
    const L = S.lic || {};
    if (licensed()) return `<div class="card" style="border-left:4px solid ${p.c}"><h2>Licence live ${pill('Live', 'ok')}</h2><p class="lead" style="margin:0">${esc(L.band || '')}${L.renews ? ' · renews ' + date(L.renews) : ''}. Every fortnight, all four books and 16 levels, the family app and ordering at club prices.</p></div>`;
    return `<div class="card"><h2>Start your Recreational licence</h2><p class="lead">The complete programme from first forward roll to Indigo: lesson plans, warm-ups, your own club plan, Run your class, award books, competitions and the family app.</p>
      <table><tr><th>Recreational gymnasts</th><th>A year (+ VAT)</th><th></th></tr>${BANDS.map(b => `<tr><td>${esc(b.label)}</td><td><b>${gbp(b.price)}</b></td><td style="text-align:right"><button class="btn sm" data-act="rec-buy" data-band="${b.k}">Choose</button></td></tr>`).join('')}</table>
      <p class="lead" style="font-size:13px;margin:10px 0 0">Prices exclude VAT (20%). Runs for 12 months. 5% off if it isn’t your club’s most expensive NGL licence.</p></div>`;
  }
};

// ---------- printing ----------
const sheetFor = L => { const bk = S.content.book, n = 12, lv = bookOf(L);
  return `<div class="recsheet"><h2>NGL Recreational · ${lv.name} · Level ${L} assessment</h2><p>Club: ${esc(S.club.name || '')} · Group: ____________ · Coach: ____________ · Date: ________</p>
  <table><tr><th style="width:26%">Skill</th>${'<th style="height:60px"></th>'.repeat(n)}</tr>${BOOK_PIECES.map(pc => `<tr><td colspan="${n + 1}" style="background:#f4f4f9;font-weight:700">${pc}</td></tr>${(bk[pc] && bk[pc][String(L)] || []).map(x => `<tr><td>${esc(x.skill)}</td>${'<td></td>'.repeat(n)}</tr>`).join('')}`).join('')}
  <tr><td><b>Passed level</b></td>${'<td></td>'.repeat(n)}</tr></table><p>Write gymnast names across the top. Tick each skill achieved. A gymnast passes the level when every skill is ticked.</p></div>`; };
function pieceSheet(b, p){
  const ph = p.stations.map(s => [s.n, photos(s)[0]]);
  return `<div class="recsheet"><div class="rs-head"><b>${esc(bName(b))} · ${WEEK_A.includes(p.code) ? 'Week A' : 'Week B'}</b><span>${esc(p.piece)}: ${esc(p.theme)}</span><small>${esc(S.club.name || '')}</small></div>
    <div class="rs-strip" style="grid-template-columns:repeat(${ph.length},1fr)">${ph.map(([n, id]) => `<div><span>${n}</span>${id ? `<img data-img="${id}" alt="Station ${n}">` : ''}</div>`).join('')}</div>
    <table><tr><th>Stn</th>${RUNGS.map((r, i) => inGroup(i) ? `<th>${r.name}</th>` : '').join('')}</tr>${p.stations.map(s => `<tr><td><b>${s.n}</b></td>${[0, 1, 2, 3].filter(inGroup).map(i => `<td>${esc(s.levels[i] || '')}${(s.assess && s.assess[String(i)] || []).filter(y => inGroup(Math.ceil(y.L / 4) - 1)).map(y => `<div class="rs-star">★ ${bookOf(y.L).name} L${y.L}: ${esc(y.s)}</div>`).join('')}</td>`).join('')}</tr>`).join('')}</table>
    <div class="rs-foot">★ This rung prepares an award-book checkpoint · NGL Recreational</div></div>`;
}
async function hydrate(root){
  const els = [...root.querySelectorAll('img[data-img]:not([src])')]; if (!els.length || !S.content || !S.content.imgIndex) return;
  const cache = {}; (S.content.images || []).forEach(ch => Object.assign(cache, ch));
  els.forEach(e => { const d = cache[e.dataset.img]; if (d) e.src = d; });
}
export async function recPrint(scope, arg){
  const blocks = clubPlan().blocks, order = b => [...WEEK_A, ...WEEK_B].map(c => b.pieces.find(p => p.code === c)).filter(Boolean), list = [];
  if (scope === 'term') blocks.forEach(b => order(b).forEach(p => list.push([b, p])));
  else if (scope === 'termPiece') blocks.forEach(b => { const p = b.pieces.find(x => x.code === arg); if (p) list.push([b, p]); });
  else { const b = blocks.find(x => x.n === UI.block) || blocks[0]; (scope === 'fortnight' ? order(b) : b.pieces.filter(p => p.code === UI.piece)).forEach(p => list.push([b, p])); }
  const tmp = document.createElement('div'); tmp.innerHTML = list.map(([b, p]) => pieceSheet(b, p)).join(''); await hydrate(tmp);
  printHTML(tmp.innerHTML, 'NGL Recreational lesson plan');
}
export const recSheet = L => printHTML(sheetFor(L), 'NGL Recreational Level ' + L + ' assessment');

export default {
  async render(p, tab, sub){ await ready(); return (tabs[tab] || tabs.overview)(p, sub); },
  hydrate, S, saveGroup: () => GROUP.set(UI.group), saveRun: () => RUN.set(UI.run), reset: () => { PLAN_CACHE = null; S.content = null; }
};
