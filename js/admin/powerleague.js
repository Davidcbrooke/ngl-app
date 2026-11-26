// NGL Admin · Training League. Copied from the admin part of GYMNASTICS-RESULTS/ngl-training-league.html (?admin=1):
// the same "Add a gymnast" form (first name, surname initial, boy or girl, club, private BG number, age group, training
// hours), the "Enter results" list with search, and the results dialog (league, age, hours, BG number, one entry per
// challenge, best-ever-counts saving, remove a result, remove a gymnast). Same wording and logic; only the shell, look
// and data layer change. The public league table stays on the live page.
// Challenges, units and ratings are copied word for word from GYMNASTICS-RESULTS/ngl-power-league-core.js.
// Data (same names and document ids as the live page, so the public table and the General League Hub keep working):
//   ngl_power_league/{auto id}          = {first, init, club, gender, age, hrs, results:{<challenge>:{best, date, history:[{v, date}]}}, createdAt, updatedAt}
//   ngl_power_league_private/{same id}  = {bg, updatedAt}   (BG numbers: NGL admins only)
// ?demo keeps every change in memory and never writes.
import { fb } from '../firebase.js';
import { MODE } from '../data.js';
import { esc, modal as uiModal, toast } from '../ui.js';

const LIVE_TOOLS = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/';
const PUBLIC_URL = LIVE_TOOLS + 'ngl-training-league.html';
const COL = 'ngl_power_league';
/* BG numbers are kept apart from the public table, in a collection only NGL admins can read. */
const PRIV = 'ngl_power_league_private';

/* ---------- From ngl-power-league-core.js (word for word) ---------- */
const GENDERS = ['Boys','Girls'], AGES = ['6-8','9-11','12-14','15+'], HRS = ['2-5','6-10'];
/* Challenges. dir: 1 = higher is better, -1 = lower is better. off: added before rating (pike reach can be below the toes). */
const CH = [
  {k:'sprint', n:'10m Sprint', stat:'SPD', unit:'s', dir:-1, step:0.01,
   ok:['Standing start behind the line, no rocking start','Time from first movement to chest crossing the 10m line'],
   no:['False or flying start','Start or finish line out of shot']},
  {k:'jump', n:'Standing Long Jump', stat:'POW', unit:'cm', dir:1, step:1,
   ok:['Both feet behind the line, two-foot take-off, no step','Must stick the landing and hold for 2 seconds','Measured from the line to the back of the nearest heel'],
   no:['Step, hop, fall or hand down on landing','Any run-up']},
  {k:'tuck', n:'Tuck Jumps in 30s', stat:'POW', unit:'reps', dir:1, step:1,
   ok:['Knees come up to at least hip height','Two-foot take-off and landing'],
   no:['Knees below hip height: that jump doesn’t count, but the count carries on']},
  {k:'push', n:'Push-ups in 30s', stat:'STR', unit:'reps', dir:1, step:1,
   ok:['Straight body from head to heels','Chest down to a fist height off the floor, arms fully straight at the top'],
   no:['Hips sagging or piking','Half reps or knees on the floor']},
  {k:'pull', n:'Pull-ups', stat:'STR', unit:'reps', dir:1, step:1,
   ok:['Overhand grip (palms facing away)','From a straight-arm hang, chin over the bar, back to straight arms'],
   no:['Kipping or swinging','Chin not clearing the bar, or not returning to straight arms']},
  {k:'chin', n:'Chin-ups', stat:'STR', unit:'reps', dir:1, step:1,
   ok:['Underhand grip (palms facing you)','From a straight-arm hang, chin over the bar, back to straight arms'],
   no:['Kipping or swinging','Chin not clearing the bar, or not returning to straight arms']},
  {k:'dips', n:'Max Dips', stat:'STR', unit:'reps', dir:1, step:1,
   ok:['From straight-arm support, lower until the upper arms are parallel to the floor','Push back to straight arms'],
   no:['Not low enough or not locking out at the top','Feet touching the floor']},
  {k:'muscle', n:'Muscle-ups on Rings in 1 min', stat:'STR', unit:'reps', dir:1, step:1,
   ok:['From a straight-arm hang below the rings, pull through to straight-arm support above them','Return to a straight-arm hang between reps'],
   no:['Big kip or swing to get through','Not reaching straight-arm support, or feet touching the floor']},
  {k:'rope', n:'5m Straddle Rope Climb', stat:'STR', unit:'s', dir:-1, step:0.01,
   ok:['Feet off the floor, legs held in straddle the whole climb','Arms only','Time from leaving the floor to a hand touching the 5m mark'],
   no:['Legs touching or wrapping the rope','Legs dropping out of straddle']},
  {k:'splits', n:'Oversplit Blocks', stat:'FLX', unit:'cm', dir:1, step:1,
   ok:['Front heel on a stack of blocks, back leg straight behind','Hips square and down on the floor, held for 2 seconds','Left or right leg, whichever is better: measure the total height of the blocks in cm'],
   no:['Bent front or back knee','Hips lifted off the floor or turned out']},
  {k:'mush', n:'Mushroom Circles in 30s', stat:'CTL', unit:'reps', dir:1, step:1,
   ok:['Hands on the mushroom, legs straight and together','Every full circle counts'],
   no:['Feet or legs touching the mushroom or floor: that circle doesn’t count']},
  {k:'vsit', n:'V-Sit Hold on Beam', stat:'BAL', unit:'s', dir:1, step:1,
   ok:['On a low beam for safety','Legs straight and together, lifted into a V with the chest towards the knees','No hands: hands off the beam','Time runs until the shape breaks'],
   no:['Bent knees, legs dropping or chest moving away from the knees','A hand or foot touching the beam, or coming off']},
  {k:'hand', n:'Handstand Hold', stat:'CTL', unit:'s', dir:1, step:1,
   ok:['Arms straight, legs together, straight body','Freestanding: no wall','Time starts when the feet come together at the top'],
   no:['Walking on the hands, legs apart or bent arms','Time stops when the gymnast moves or comes down']}
];
const STATS = ['SPD','POW','STR','FLX','BAL','CTL'];
/* One set of rules for every age. nLow/unitLow (an easier version for ages 6–11) are not used at present. */
const young = age => age === '6-8' || age === '9-11';
const chName = (c, age) => (c.nLow && young(age)) ? c.nLow : c.n;
const chUnit = (c, age) => (c.unitLow && young(age)) ? c.unitLow : c.unit;
const fmt = (v, c) => v == null ? '—' : (c.step < 1 ? (+v).toFixed(2) : String(+v));
/* Boys and girls have separate leagues. Older entries with no gender are boys. */
const genOf = g => g.gender === 'Girls' ? 'Girls' : 'Boys';
const group = g => `${genOf(g)}|${g.age}|${g.hrs}`;
/* ---------- Ratings ----------
   Per challenge, the best valid result in the gymnast's group (same gender, age group and training hours) rates 99;
   everyone else is rated in proportion to it. A missing challenge rates 0. A stat is the average of its
   challenges; OVR is the average of the six stats. */
function rate(list){
  const best = {};
  list.forEach(g => CH.forEach(c => {
    const r = g.results && g.results[c.k]; if(!r || r.best == null) return;
    const key = group(g) + '|' + c.k, v = +r.best + (c.off || 0);
    if(c.dir < 0 ? v <= 0 : v < 0) return;
    if(best[key] == null || (c.dir > 0 ? v > best[key] : v < best[key])) best[key] = v;
  }));
  list.forEach(g => {
    g.ch = {}; g.stats = {};
    CH.forEach(c => {
      const r = g.results && g.results[c.k], b = best[group(g) + '|' + c.k];
      if(!r || r.best == null || !b){ g.ch[c.k] = 0; return; }
      const v = +r.best + (c.off || 0);
      g.ch[c.k] = Math.max(1, Math.min(99, Math.round(c.dir > 0 ? 99 * v / b : 99 * b / v)));
    });
    STATS.forEach(s => { const cs = CH.filter(c => c.stat === s); g.stats[s] = Math.round(cs.reduce((a, c) => a + g.ch[c.k], 0) / cs.length); });
    g.ovr = Math.round(STATS.reduce((a, s) => a + g.stats[s], 0) / STATS.length);
    g.done = CH.filter(c => g.results && g.results[c.k] && g.results[c.k].best != null).length;
  });
}
const nameOf = g => `${g.first} ${g.init}.`;

/* ---------- State ---------- */
let FS = null, DB = null, LIVE = MODE !== 'demo', ME = {email:''};
let G = [], BG = {};
const S = { loaded:null, q:'', err:'', editId:null, dlg:null };
const opts = (list, lbl) => list.map(v => `<option value="${esc(v)}">${esc(lbl ? lbl(v) : v)}</option>`).join('');
const onScreen = () => !!document.getElementById('tlRoot');
const blocked = err => err && err.code === 'permission-denied';

/* Sample data (?demo): gymnasts from four clubs, boys and girls, some with every challenge in and some just started */
const today0 = new Date(), ago = n => new Date(today0.getTime() - n * 864e5).toISOString().slice(0, 10);
const R = (best, d, prev) => ({best, date:ago(d), history:(prev != null ? [{v:prev, date:ago(d + 21)}] : []).concat([{v:best, date:ago(d)}])});
function demoData(){
  const g = [
    {id:'demo-g1', first:'Oliver', init:'H', club:'SAADI Gymnastics', gender:'Boys', age:'9-11', hrs:'6-10', results:{sprint:R(2.18, 12, 2.31), jump:R(186, 12, 179), tuck:R(24, 12), push:R(31, 12, 27), pull:R(9, 12), chin:R(11, 12), dips:R(19, 12), muscle:R(2, 12), rope:R(11.4, 12), splits:R(22, 12), mush:R(17, 12), vsit:R(26, 12), hand:R(31, 12, 24)}},
    {id:'demo-g2', first:'Harry', init:'P', club:'Riverside Gym Academy', gender:'Boys', age:'9-11', hrs:'6-10', results:{sprint:R(2.25, 20), jump:R(178, 20), tuck:R(22, 20), push:R(28, 20), pull:R(7, 20), chin:R(9, 20), dips:R(16, 20), rope:R(13.2, 20), splits:R(18, 20), mush:R(14, 20), vsit:R(21, 20), hand:R(18, 20)}},
    {id:'demo-g3', first:'Leo', init:'M', club:'Northgate Gymnastics Club', gender:'Boys', age:'9-11', hrs:'6-10', results:{sprint:R(2.31, 5), jump:R(171, 5), push:R(25, 5), hand:R(12, 5)}},
    {id:'demo-g4', first:'Amelia', init:'R', club:'SAADI Gymnastics', gender:'Girls', age:'9-11', hrs:'6-10', results:{sprint:R(2.24, 9), jump:R(174, 9), tuck:R(23, 9), push:R(26, 9), pull:R(5, 9), chin:R(8, 9), dips:R(14, 9), muscle:R(1, 9), rope:R(14.8, 9), splits:R(38, 9, 33), mush:R(12, 9), vsit:R(29, 9), hand:R(27, 9)}},
    {id:'demo-g5', first:'Isla', init:'T', club:'Herts Academy', gender:'Girls', age:'9-11', hrs:'6-10', results:{sprint:R(2.29, 15), jump:R(168, 15), tuck:R(21, 15), push:R(22, 15), splits:R(35, 15), vsit:R(24, 15), hand:R(33, 15)}},
    {id:'demo-g6', first:'Ava', init:'K', club:'Riverside Gym Academy', gender:'Girls', age:'12-14', hrs:'6-10', results:{sprint:R(2.09, 7), jump:R(198, 7), tuck:R(26, 7), push:R(30, 7), pull:R(8, 7), chin:R(12, 7), dips:R(21, 7), muscle:R(3, 7), rope:R(10.6, 7), splits:R(41, 7), mush:R(16, 7), vsit:R(35, 7), hand:R(44, 7)}},
    {id:'demo-g7', first:'Freya', init:'B', club:'SAADI Gymnastics', gender:'Girls', age:'6-8', hrs:'2-5', results:{sprint:R(2.62, 3), jump:R(132, 3), tuck:R(15, 3), hand:R(6, 3)}},
    {id:'demo-g8', first:'Noah', init:'W', club:'Herts Academy', gender:'Boys', age:'12-14', hrs:'2-5', results:{}},
    {id:'demo-g9', first:'Sophie', init:'L', club:'Northgate Gymnastics Club', gender:'Girls', age:'9-11', hrs:'2-5', results:{sprint:R(2.41, 30), jump:R(152, 30), tuck:R(18, 30), push:R(17, 30), splits:R(26, 30), vsit:R(15, 30), hand:R(9, 30)}},
    {id:'demo-g10', first:'Jack', init:'D', club:'SAADI Gymnastics', age:'15+', hrs:'6-10', results:{sprint:R(1.96, 40), jump:R(231, 40), push:R(38, 40), pull:R(14, 40), chin:R(16, 40), dips:R(29, 40), muscle:R(7, 40), rope:R(7.9, 40), hand:R(52, 40)}}   // older entry: no gender, so a boy
  ];
  return {G:g, BG:{'demo-g1':'1234567', 'demo-g4':'2345678', 'demo-g6':'3456789', 'demo-g10':'4567890'}};
}

/* ---------- Data ---------- */
async function load(){
  if (LIVE) {
    try { const {fs, D} = await fb(); FS = fs; DB = D; }
    catch (e) { console.error(e); LIVE = false; S.err = 'Couldn’t connect to the database (' + (e.code || e.message) + '). Nothing will save until this is fixed.'; return; }
    await new Promise(res => {
      FS.onSnapshot(FS.collection(DB, COL), snap => {
        G = snap.docs.map(d => ({id: d.id, ...d.data()})); rate(G); S.err = ''; paint(); res();
      }, err => { console.error(err); S.err = blocked(err) ? 'The Training League table isn’t switched on yet.' : 'Couldn’t load the table. Refresh to try again.'; paint(); res(); });
    });
    FS.onSnapshot(FS.collection(DB, PRIV), snap => { BG = {}; snap.docs.forEach(d => { BG[d.id] = d.data().bg || ''; }); paint(); }, err => console.warn('BG numbers not readable', err));
  } else { const d = demoData(); G = d.G; BG = d.BG; rate(G); }
}
/* Sample data: apply a change in memory, then redraw the list (and the dialog when it's open) */
function demoChanged(){ rate(G); paint(); }

/* ---------- Screen ---------- */
function listHTML(){
  if (S.err) return `<tr><td colspan="10" class="empty">${esc(S.err)}</td></tr>`;
  const q = S.q.trim().toLowerCase();
  const list = G.filter(g => !q || nameOf(g).toLowerCase().includes(q) || (g.club || '').toLowerCase().includes(q)).sort((a, b) => (a.club || '').localeCompare(b.club || '') || nameOf(a).localeCompare(nameOf(b)));
  return list.length ? list.map(g => `<tr data-g="${esc(g.id)}"><td class="tl-nm" data-l="Gymnast"><b>${esc(nameOf(g))}</b></td><td class="tl-club" data-l="Club">${esc(g.club)}</td><td data-l="League">${genOf(g)}</td><td data-l="Age">${esc(g.age)}</td><td data-l="Hours">${esc(g.hrs)}</td><td class="num" data-l="BG no.">${BG[g.id] ? '<span aria-label="Saved">✓</span>' : '<span class="tl-mut" aria-label="None">—</span>'}</td><td class="num" data-l="Challenges">${g.done} / ${CH.length}</td><td class="num tl-ovr" data-l="OVR">${g.done ? g.ovr : '—'}</td><td class="tl-act"><button class="btn sm" data-act="tl-edit" data-id="${esc(g.id)}">Results</button></td></tr>`).join('')
    : `<tr><td colspan="10" class="empty">No gymnasts yet. Add the first one above.</td></tr>`;
}
const clubsHTML = () => [...new Set(G.map(g => g.club))].sort().map(c => `<option value="${esc(c)}">`).join('');
/* Live updates without redrawing the whole page (keeps what's typed in the add form and the search box) */
function paint(){
  const l = document.getElementById('tlList'); if (l) l.innerHTML = listHTML();
  const c = document.getElementById('tlClubList'); if (c) c.innerHTML = clubsHTML();
}

function view(){
  return `<div class="tl" id="tlRoot">
    <p class="lead tl-who">${esc(ME.email)} · <a href="${PUBLIC_URL}" target="_blank" rel="noopener">View public table</a></p>
    ${LIVE ? '' : '<p class="tl-demo">Sample data: nothing here is saved.</p>'}
    <div class="card tl-card">
      <h2>Add a gymnast</h2>
      <p class="tl-note">The public table only shows the first name and surname initial. The BG number is private: only NGL admins can see it, and it links their Training League card to their General League Hub.</p>
      <form class="tl-form" id="tlAdd" autocomplete="off">
        <label class="field"><span>First name</span><input type="text" id="tlFirst" required maxlength="30"></label>
        <label class="field"><span>Surname initial</span><input type="text" id="tlInit" required maxlength="1"></label>
        <label class="field"><span>Boy or girl</span><select id="tlGen">${opts(GENDERS)}</select></label>
        <label class="field"><span>Club</span><input type="text" id="tlClub" required maxlength="80" list="tlClubList"></label>
        <label class="field"><span>BG number (private)</span><input type="text" id="tlBg" inputmode="numeric" maxlength="12" placeholder="e.g. 1234567"></label>
        <label class="field"><span>Age group</span><select id="tlAge">${opts(AGES)}</select></label>
        <label class="field"><span>Training hours</span><select id="tlHrs">${opts(HRS, v => v + ' hrs')}</select></label>
        <div class="tl-addbtn"><button class="btn" type="submit" id="tlAddBtn">Add gymnast</button></div>
      </form>
      <datalist id="tlClubList">${clubsHTML()}</datalist>
    </div>
    <div class="card tl-card">
      <h2>Enter results</h2>
      <label class="field tl-find"><span>Find gymnast</span><input type="text" id="tlFind" placeholder="Name or club" value="${esc(S.q)}"></label>
      <div class="tl-tablewrap"><table class="tl-table"><thead><tr><th>Gymnast</th><th>Club</th><th>League</th><th>Age</th><th>Hours</th><th class="num">BG no.</th><th class="num">Challenges</th><th class="num">OVR</th><th><span class="tl-sr">Action</span></th></tr></thead><tbody id="tlList">${listHTML()}</tbody></table></div>
    </div></div>`;
}

/* ---------- Results dialog ---------- */
function editorHTML(g){
  const today = new Date().toISOString().slice(0, 10);
  return `<div class="tl-dlg" id="tlDlg" data-id="${esc(g.id)}"><h2 id="tlDlgTitle">${esc(nameOf(g))} <span class="tl-dlgclub">${esc(g.club)}</span></h2>
    <div class="tl-eform">
      <label class="field"><span>Boy or girl</span><select id="tlEGen">${GENDERS.map(v => `<option ${v === genOf(g) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Age group</span><select id="tlEAge">${AGES.map(v => `<option ${v === g.age ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>Training hours</span><select id="tlEHrs">${HRS.map(v => `<option ${v === g.hrs ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>BG number (private)</span><input type="text" id="tlEBg" inputmode="numeric" maxlength="12" value="${esc(BG[g.id] || '')}"></label>
    </div>
    <p class="tl-note">Enter a result only once you've checked the video meets every "Counts" rule. The best result each gymnast has ever posted counts, so a lower score never replaces a better one.</p>
    <div class="tl-entries">${CH.map(c => { const r = (g.results || {})[c.k], nm = chName(c, g.age), u = chUnit(c, g.age); return `<div class="tl-entry"><div class="tl-ename"><b>${esc(nm)}</b><div class="tl-hist">Best: ${r && r.best != null ? fmt(r.best, c) + ' ' + u + (r.date ? ' · ' + esc(r.date) : '') : 'none yet'}</div></div>
      <input type="number" step="${c.step}" data-v="${c.k}" placeholder="${u}" aria-label="${esc(nm)} result (${u})"><input type="date" data-d="${c.k}" value="${today}" aria-label="${esc(nm)} date">
      ${r && r.best != null ? `<button class="btn sm tl-danger tl-x" data-act="tl-clear" data-k="${c.k}" title="Remove this result" aria-label="Remove the ${esc(nm)} result">✕</button>` : '<span></span>'}</div>`; }).join('')}</div>
    <div class="tl-dlgbtns">
      <button class="btn sm tl-danger" data-act="tl-del">Remove gymnast</button>
      <div class="tl-dlgr"><button class="btn ghost" data-close>Close</button><button class="btn" data-act="tl-save" id="tlSave">Save</button></div>
    </div></div>`;
}
function openEditor(id){
  const g = G.find(x => x.id === id); if (!g) return;
  S.editId = id;
  if (S.dlg && S.dlg.isConnected) { S.dlg.querySelector('.modal').innerHTML = editorHTML(g); return; }
  const m = S.dlg = uiModal(editorHTML(g)), d = m.querySelector('.modal');
  d.classList.add('tl-modal'); d.setAttribute('aria-labelledby', 'tlDlgTitle');
  m.addEventListener('keydown', e => { if (e.key === 'Escape') closeEditor(); });
}
function closeEditor(){ if (S.dlg) S.dlg.remove(); S.dlg = null; S.editId = null; }
const dlgEl = sel => S.dlg && S.dlg.querySelector(sel);
const cur = () => G.find(x => x.id === S.editId);

/* Buttons (data-act="tl-…"): the app shell sends clicks here */
export const TL = {
  'tl-edit'(b){ openEditor(b.dataset.id); },
  async 'tl-clear'(b){
    const g = cur(); if (!g) return; const id = g.id;
    if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Sure?'; return; }
    const res = {...(g.results || {})}; delete res[b.dataset.k];
    try {
      if (LIVE) await FS.updateDoc(FS.doc(DB, COL, id), {results: res, updatedAt: FS.serverTimestamp()});
      g.results = res; rate(G); paint();
      toast('Result removed'); openEditor(id);
    } catch (err) { console.error(err); toast('Couldn’t remove it.', false); }
  },
  async 'tl-del'(b){
    const g = cur(); if (!g) return; const id = g.id;
    if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again to remove'; return; }
    try {
      if (LIVE) { await FS.deleteDoc(FS.doc(DB, COL, id)); if (BG[id]) await FS.deleteDoc(FS.doc(DB, PRIV, id)); }
      else { G = G.filter(x => x.id !== id); delete BG[id]; demoChanged(); }
      closeEditor(); toast('Gymnast removed');
    } catch (err) { console.error(err); toast('Couldn’t remove the gymnast.', false); }
  },
  async 'tl-save'(){
    const g = cur(); if (!g) return; const id = g.id;
    const today = new Date().toISOString().slice(0, 10);
    const res = JSON.parse(JSON.stringify(g.results || {})); let n = 0, kept = 0;
    CH.forEach(c => {
      const raw = dlgEl(`[data-v="${c.k}"]`).value; if (raw === '') return;
      const v = +raw, date = dlgEl(`[data-d="${c.k}"]`).value || today;
      if (!isFinite(v) || (v <= 0)) return;
      const r = res[c.k] || {history: []}; r.history = (r.history || []).concat([{v, date}]).slice(-20);
      const better = r.best == null || (c.dir > 0 ? v > r.best : v < r.best);
      if (better) { r.best = v; r.date = date; } else kept++;
      res[c.k] = r; n++;
    });
    const upd = {results: res, gender: dlgEl('#tlEGen').value, age: dlgEl('#tlEAge').value, hrs: dlgEl('#tlEHrs').value};
    const bg = dlgEl('#tlEBg').value.replace(/\D/g, '');
    const btn = dlgEl('#tlSave'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      if (LIVE) {
        await FS.updateDoc(FS.doc(DB, COL, id), {...upd, updatedAt: FS.serverTimestamp()});
        if (bg !== (BG[id] || '')) { if (bg) await FS.setDoc(FS.doc(DB, PRIV, id), {bg, updatedAt: FS.serverTimestamp()}); else await FS.deleteDoc(FS.doc(DB, PRIV, id)); }
      } else { Object.assign(g, upd); if (bg) BG[id] = bg; else delete BG[id]; demoChanged(); }
      closeEditor();
      toast(n ? `${n} result${n > 1 ? 's' : ''} saved${kept ? ` (${kept} didn’t beat the best, so the best stays)` : ''}` : 'Saved');
    } catch (err) {
      console.error(err); if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      toast(blocked(err) ? 'The database blocked this. The Training League rules need adding.' : 'Couldn’t save.', false);
    }
  }
};

/* Add a gymnast (the form's own submit, so Enter works in any field) */
const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
document.addEventListener('submit', async e => {
  if (!e.target || e.target.id !== 'tlAdd') return;
  e.preventDefault();
  const first = val('tlFirst').trim(), init = val('tlInit').trim().toUpperCase().slice(0, 1), club = val('tlClub').trim();
  if (!first || !init || !club) return;
  const btn = document.getElementById('tlAddBtn'); if (btn) btn.disabled = true;
  try {
    const bg = val('tlBg').replace(/\D/g, '');
    const rec = {first, init, club, gender: val('tlGen'), age: val('tlAge'), hrs: val('tlHrs'), results: {}};
    if (LIVE) {
      const ref = await FS.addDoc(FS.collection(DB, COL), {...rec, createdAt: FS.serverTimestamp(), updatedAt: FS.serverTimestamp()});
      if (bg) await FS.setDoc(FS.doc(DB, PRIV, ref.id), {bg, updatedAt: FS.serverTimestamp()});
    } else { const id = 'demo-' + Date.now().toString(36); G.push({id, ...rec}); if (bg) BG[id] = bg; demoChanged(); }
    ['tlFirst', 'tlInit', 'tlBg'].forEach(k => { const el = document.getElementById(k); if (el) el.value = ''; });
    const f = document.getElementById('tlFirst'); if (f) f.focus();
    toast(`${first} ${init}. added`);
  } catch (err) { console.error(err); toast(blocked(err) ? 'The database blocked this. The Training League rules need adding.' : 'Couldn’t add the gymnast.', false); }
  finally { if (btn) btn.disabled = false; }
});
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'tlFind' && onScreen()) { S.q = e.target.value; paint(); }
});

/* The screen: #/admin/powerleague */
export default async function powerleague(me = {}, parts = []){
  ME = {email: (me && me.email) || ''};
  if (!S.loaded) S.loaded = load();
  await S.loaded;
  if (S.dlg && !S.dlg.isConnected) S.dlg = null;
  return view();
}
