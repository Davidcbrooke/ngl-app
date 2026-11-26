// Schools: the club takes NGL gymnastics into local schools. Standard pathway model (DESIGN.md 6a).
// Prices, the Profit planner, the Secondary planner and the programme content come word for word from
// today's Schools hub via schools-data.js; the screens are rebuilt in the Club Hub style.
import { appLink } from '../config.js';
import api from '../data.js';
import { esc, gbp, date, pill, ic } from '../ui.js';
import { printHTML } from './index.js';
import * as D from './schools-data.js';
import PRICES from '../prices.js';

const VAT_RATE = PRICES.vatRate;
const PROSPECTUS = 'docs/NGL_Schools_Prospectus.pdf';
const S = {club: null, lic: null, all: null};
export const UI = {app: 'floor', lvl: 1, sec: null};
const licensed = () => S.lic && S.lic.status === 'live';
const schools = () => S.club.schoolsList || [];
const childrenTotal = () => schools().reduce((a, s) => a + (parseInt(s.children) || 0), 0);
export const bandForCount = n => D.SCHOOLS_BANDS.find(b => b.max == null || n <= b.max);
const otherLive = () => ['preschool', 'recreational'].some(k => S.all[k] && S.all[k].status === 'live');
const todayISO = () => new Date().toISOString().slice(0, 10);

async function ready(){ const [lic, club] = await Promise.all([api.licences(), api.club()]); S.all = lic; S.lic = lic.schools || {}; S.club = club; return S; }
export const state = () => S;

// ---------- Profit planner (calculation copied from the Schools hub; only the discount is simplified) ----------
export function planStart(){
  const saved = S.club.projection || {}, p = {...D.PLAN_DEFAULTS, ...saved};
  if (!saved.bandChildren) { const n = childrenTotal(); if (n) { p.bandChildren = n; p.o1Children = n; p.o1Schools = Math.max(1, schools().length); } }
  return p;
}
export function planCalc(p){
  const r2 = x => Math.round(x * 100) / 100;
  const band = bandForCount(Math.max(1, p.bandChildren)), disc = otherLive() ? r2(band.price * 0.05) : 0;
  const licNet = band.price - disc, licVat = p.vatRegistered ? 0 : r2(licNet * VAT_RATE);
  const book = D.shopItem('book').price, cert = D.shopItem('cert').price;
  const gradKeep = p.vatRegistered ? D.GRAD_CLUB_KEEPS : D.GRAD_FAMILY_PRICE - D.GRAD_NGL_FEE * (1 + VAT_RATE);
  const opt = (on, kind, newOnly) => {
    if (!on) return null;
    const n = kind === 1 ? p.o1Children : p.o2Children, books = Math.round(newOnly ? n * p.newRate / 100 : n), grads = Math.round(n * p.gradRate / 100), inc = [], cost = [];
    if (kind === 1) { const per = p.o1Schools ? Math.round(n / p.o1Schools) : 0, sf = D.schoolFeeFor(p, per);
      inc.push(['School licence fees', `${p.o1Schools} school${p.o1Schools === 1 ? '' : 's'} × ${gbp(sf.fee)} (about ${per} children each: ${sf.tier})`, p.o1Schools * sf.fee]);
      inc.push(['Awards Books sold to schools', `${books} × ${gbp(p.o1BookPrice)}`, books * p.o1BookPrice]); }
    else { inc.push(['Weekly club fees', `${n} children × ${gbp(p.o2Fee)} × ${p.o2Weeks} weeks`, n * p.o2Fee * p.o2Weeks]);
      inc.push(['Awards Books sold to families', `${books} × ${gbp(p.o2BookPrice)}`, books * p.o2BookPrice]); }
    inc.push(['Graduation (you keep ' + gbp(gradKeep) + ' a gymnast)', `${grads} graduates; extra spectator money goes to NGL`, grads * gradKeep]);
    cost.push(['Awards Books from NGL', `${books} × ${gbp(book)}`, books * book]);
    cost.push(['Certificates from NGL', `${n * p.certsPerChild} × ${gbp(cert)}`, r2(n * p.certsPerChild * cert)]);
    const items = books + Math.ceil(n * p.certsPerChild / 10);
    cost.push(['Postage', '2 orders a year', items ? 2 * D.postageFor(Math.ceil(items / 2)) : 0]);
    if (kind === 1) { cost.push(['Coach: monthly visits', `${p.o1Schools} × ${p.o1Visits} visits × ${p.o1VisitHrs} hrs × ${gbp(p.coachRate)}`, p.o1Schools * p.o1Visits * p.o1VisitHrs * p.coachRate]);
      cost.push(['Coach: teacher training', `${p.o1Schools} × ${p.o1TrainHrs} hrs × ${gbp(p.coachRate)}`, p.o1Schools * p.o1TrainHrs * p.coachRate]); }
    else { const groups = Math.max(n ? 1 : 0, Math.ceil(n / Math.max(1, p.o2Group)));
      cost.push(['Coaches', `${groups} group${groups === 1 ? '' : 's'} × ${p.o2Weeks} weeks × ${p.o2SessHrs} hrs × ${gbp(p.coachRate)}`, groups * p.o2Weeks * p.o2SessHrs * p.coachRate]);
      if (p.o2Hall) cost.push(['Hall hire', `${groups} × ${p.o2Weeks} weeks × ${gbp(p.o2Hall)}`, groups * p.o2Weeks * p.o2Hall]);
      cost.push(['Admin, equipment and insurance', `${p.o2Overheads}% of fees`, r2(n * p.o2Fee * p.o2Weeks * p.o2Overheads / 100)]); }
    const I = r2(inc.reduce((a, x) => a + x[2], 0)), C = r2(cost.reduce((a, x) => a + x[2], 0));
    return {inc, cost, I, C, P: r2(I - C), n};
  };
  const yr = newOnly => { const o1 = opt(p.o1On, 1, newOnly), o2 = opt(p.o2On, 2, newOnly), lic = r2(licNet + licVat);
    const I = r2((o1 ? o1.I : 0) + (o2 ? o2.I : 0)), C = r2((o1 ? o1.C : 0) + (o2 ? o2.C : 0) + lic); return {o1, o2, lic, I, C, P: r2(I - C)}; };
  return {band, disc, licNet, licVat, y1: yr(false), y2: yr(true)};
}
function planInputs(p){
  const num = (k, label, step = 1, pre = '', note = '') => `<label class="field"><span>${label}</span><span style="display:flex;align-items:center;gap:6px">${pre ? `<b>${pre}</b>` : ''}<input data-k="${k}" type="number" min="0" step="${step}" value="${esc(p[k])}"></span>${note ? `<small style="color:var(--muted)">${note}</small>` : ''}</label>`;
  const chk = (k, label, note = '') => `<label style="display:flex;gap:8px;align-items:center;font-weight:700;margin:6px 0"><input type="checkbox" data-k="${k}" ${p[k] ? 'checked' : ''} style="width:18px;height:18px"> ${label}</label>${note ? `<small style="color:var(--muted);display:block;margin-bottom:8px">${note}</small>` : ''}`;
  return `<div class="grid g2"><div class="card"><h2>1. Your licence</h2>${num('bandChildren', 'Children across your schools', 1, '', 'Every child taking part, across every school (both options). This sets your licence band.')}
      <p class="lead" id="pl_band" style="font-size:13px"></p>${chk('vatRegistered', 'Our club is VAT registered', 'If not, the 20% VAT on the licence is counted as a cost.')}
      <h2 style="margin-top:16px">2. Costs for both options</h2>${num('coachRate', 'Coach pay per hour', 0.5, '£', 'Including travel if you pay it.')}
      ${num('gradRate', 'Children who graduate each year (%)', 1, '', `Families pay £${D.GRAD_FAMILY_PRICE} including one spectator. You keep £5 if VAT registered (£6 if not); NGL charges £5 + VAT, medal included.`)}
      ${num('newRate', 'New children each year after year 1 (%)', 1, '', 'Each child keeps one Awards Book for their whole time at school.')}</div>
    <div class="card">${chk('o1On', 'Option 1: Teacher-led', 'Your coaches train the school’s teachers, who run NGL Schools in PE lessons. The school pays you.')}
      ${num('o1Schools', 'Number of schools')}${num('o1Children', 'Children in teacher-led classes')}
      <p class="flow-l">Your yearly fee to each school, by children at that school</p><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px">${D.SCHOOL_FEE_TIERS.map(([k, , label]) => `<label class="field" style="margin:0"><span>${label}</span><input data-k="${k}" type="number" min="0" step="10" value="${esc(p[k])}"></label>`).join('')}</div>
      ${num('o1BookPrice', 'Your price for each Awards Book, to the school', 0.5, '£', 'You buy books from NGL at £5; we suggest £8.')}${num('o1Visits', 'Coach visits to each school, per year', 1, '', 'Monthly is 10 visits.')}
      ${num('o1VisitHrs', 'Hours per visit', 0.5)}${num('o1TrainHrs', 'Teacher training hours per school', 0.5)}</div></div>
    <div class="card" style="margin-top:16px">${chk('o2On', 'Option 2: After-school club', 'Your coaches run a weekly club in the school hall. Parents book and pay your club, so it costs the school nothing.')}
      <div class="grid g2"><div>${num('o2Children', 'Children in after-school clubs')}${num('o2Fee', 'Your fee per child, per session', 0.5, '£')}${num('o2Weeks', 'Weeks a year', 1, '', 'A school year is about 36 weeks; 33 allows for the first and last weeks of term.')}${num('o2BookPrice', 'Your price for each Awards Book, to families', 0.5, '£', 'Suggested £10.')}</div>
      <div>${num('o2Group', 'Children per coach')}${num('o2SessHrs', 'Coach hours paid per session', 0.25)}${num('o2Hall', 'Hall hire per session', 1, '£', 'Leave at 0 if the hall is free.')}${num('o2Overheads', 'Admin, equipment and insurance (% of fees)')}</div></div></div>`;
}
export function planRead(){ const p = {...D.PLAN_DEFAULTS}; document.querySelectorAll('#pl_form [data-k]').forEach(el => { p[el.dataset.k] = el.type === 'checkbox' ? el.checked : Math.max(0, parseFloat(el.value) || 0); }); return p; }
export function planResults(p){
  const R = planCalc(p), y1 = R.y1, y2 = R.y2;
  const money = v => gbp(Math.round(v * 100) / 100), sign = v => `<b style="color:${v >= 0 ? 'var(--ok)' : 'var(--red)'}">${v < 0 ? '−' : ''}£${Math.abs(Math.round(v)).toLocaleString('en-GB')}</b>`;
  const block = (t, a, b) => !a ? '' : `<tr><td colspan="3"><b>${t}</b> <small>· ${a.n} children</small></td></tr>` + ['inc', 'cost'].map(k => a[k].map((x, i) => `<tr><td>${esc(x[0])}<br><small style="color:var(--muted)">${esc(x[1])}</small></td><td>${money(x[2] * (k === 'cost' ? -1 : 1))}</td><td>${money(b[k][i][2] * (k === 'cost' ? -1 : 1))}</td></tr>`).join('')).join('')
    + `<tr><td><b>${t}: profit before licence</b></td><td>${sign(a.P)}</td><td>${sign(b.P)}</td></tr>`;
  const bandEl = document.getElementById('pl_band'); if (bandEl) bandEl.innerHTML = `Band <b>${esc(R.band.short)}</b>: ${gbp(R.band.price)} a year${R.disc ? `, less ${gbp(R.disc)} multi-pathway discount` : ''}, + VAT.`;
  const out = document.getElementById('pl_out'); if (!out) return R;
  out.innerHTML = `<div class="grid g4" style="margin-bottom:14px"><div class="card stat"><b>${sign(y1.P)}</b><span>Profit, year 1</span></div><div class="card stat"><b>${sign(y2.P)}</b><span>Profit, later years</span></div>
    <div class="card stat"><b>${gbp(Math.round(y1.I))}</b><span>Income, year 1</span></div><div class="card stat"><b>${gbp(y1.lic)}</b><span>NGL licence${p.vatRegistered ? ' (VAT reclaimed)' : ' incl. VAT'}</span></div></div>
    <table><tr><th></th><th>Year 1</th><th>Later years</th></tr>${block('Option 1: Teacher-led', y1.o1, y2.o1)}${block('Option 2: After-school club', y1.o2, y2.o2)}
      <tr><td>NGL Schools Club Licence, ${esc(R.band.short)}<br><small style="color:var(--muted)">${gbp(R.licNet)}${R.licVat ? ` + ${gbp(R.licVat)} VAT` : ' (VAT reclaimed)'}</small></td><td>${money(-y1.lic)}</td><td>${money(-y2.lic)}</td></tr>
      <tr><td><b>Total income</b></td><td>${money(y1.I)}</td><td>${money(y2.I)}</td></tr><tr><td><b>Total costs</b></td><td>${money(-y1.C)}</td><td>${money(-y2.C)}</td></tr>
      <tr><td><b>Profit</b></td><td>${sign(y1.P)}</td><td>${sign(y2.P)}</td></tr></table>
    <p class="lead" style="font-size:13px;margin-top:10px">NGL prices are live: books ${gbp(D.shopItem('book').price)}, certificates ${gbp(D.shopItem('cert').price)}, Graduation ${gbp(D.GRAD_NGL_FEE)} + VAT a graduate. Everything else is your own estimate. This is a planning guide, not financial advice.</p>`;
  return R;
}
export const planPrint = () => { const p = planRead(); planResults(p); printHTML(`<div class="recsheet"><div class="rs-head"><b>NGL Schools profit plan</b><span>${esc(S.club.name || '')}</span><small>${new Date().toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})}</small></div>${document.getElementById('pl_out').innerHTML}</div>`, 'NGL Schools profit plan'); };

// ---------- Secondary planner (lesson builder copied from the Schools hub) ----------
export const secStart = () => ({...D.SEC_DEFAULTS, ...(S.club.secPlan || {}), ...(UI.sec || {})});
export function secRead(){ const p = {...D.SEC_DEFAULTS}; document.querySelectorAll('#sec_form [data-k]').forEach(el => { const k = el.dataset.k;
  p[k] = el.type === 'date' ? el.value : el.tagName === 'SELECT' && isNaN(el.value) ? el.value : (el.tagName === 'SELECT' ? +el.value : Math.max(0, parseFloat(el.value) || 0)); }); return p; }
function secForm(p){
  const sel = (k, label, opts) => `<label class="field"><span>${label}</span><select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(p[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const num = (k, label, note) => `<label class="field"><span>${label}</span><input data-k="${k}" type="number" min="0" value="${esc(p[k])}">${note ? `<small style="color:var(--muted)">${note}</small>` : ''}</label>`;
  return `<div class="grid g2"><div class="card"><h2>1. The term</h2><label class="field"><span>Term start date (the first lesson)</span><input data-k="termStart" type="date" value="${esc(p.termStart || '')}"><small style="color:var(--muted)">One lesson a week from this date. If you miss a week, move the date on a week.</small></label>
    ${sel('level', 'Level', [['all', 'All Levels (mixed class)'], ...D.SEC_LEVELS.map(n => [n, 'Level ' + n])])}
    ${p.level === 'all' ? '' : sel('book', 'Awards Book', Object.entries(D.SEC_BOOKS).filter(([, b]) => !b.soon).map(([k, b]) => [k, b.name]))}
    ${num('lessons', 'Lessons this term', 'Includes a Performance routine lesson and an assessment lesson at the end.')}${num('mins', 'Lesson length (minutes)')}${num('warm', 'Warm-up (minutes)')}${num('cool', 'Cool-down (minutes)')}${num('classSize', 'Pupils in the class')}</div>
    <div class="card"><h2>2. The school’s equipment</h2><p class="lead" style="font-size:13px">Physical prep runs in every school. Tell us what the school has and the plan adapts.</p>${Object.entries(D.SEC_EQUIP).map(([k, e]) => sel(k, e.label, e.opts)).join('')}</div></div>`;
}
// Readable label on any colour (WCAG AA 4.5:1): navy or white text, and if neither passes, a deeper shade with white
const lum = rgb => rgb.map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
const hexRgb = hex => [0, 2, 4].map(i => parseInt(hex.replace('#', '').slice(i, i + 2), 16));
function readable(hex){
  let rgb = hexRgb(hex); const navy = lum([27, 24, 64]);
  if (ratio(lum(rgb), navy) >= 4.5) return `background:${hex};color:#1b1840`;
  while (ratio(lum(rgb), 1) < 4.5) rgb = rgb.map(v => Math.round(v * 0.9));
  return `background:rgb(${rgb.join(',')});color:#fff`;
}
const lvlTag = lv => `<span class="pill" style="${readable(D.SEC_LVL_COL[lv])};margin-right:6px">L${lv}</span>`;
const appChip = ap => `<span class="pill" style="${readable(D.SEC_APP[ap].col)}">${D.SEC_APP[ap].name}</span>`;
export function secOut(p){
  const R = D.secCalc(p), t = D.secToday(p);
  const today = t.key === 'on' ? `Lesson ${t.n} of ${t.total} today` : t.key === 'before' ? `The term starts on ${date(p.termStart)}.` : t.key === 'after' ? `All ${t.total} lessons this term are done. Set the next term’s start date.` : 'Add the term start date and this prints the right lesson each week.';
  const lesson = l => { let body;
    if (l.perf) body = `<p class="lead">Practise the Performance routines (the same routines as the clubs’ NGL Recreational competitions).</p><ul>${D.secRoutineAps(p).map(ap => `<li><b>${D.SEC_APP[ap].name}:</b> ${esc(R.book.routines[ap])}</li>`).join('')}</ul>`;
    else if (l.assess) body = `<p class="lead" style="margin:0">Rotate through the stations and assess each pupil on ${R.all ? 'the skills for their own level' : `the Level ${p.level} skills`}. Sign off every skill shown in the pupil’s Awards Book.</p>`;
    else if (R.all) body = `<div class="grid g3">${l.st.map(s => `<div class="card" style="background:var(--wash)">${appChip(s.ap)}${s.levels.map(x => `<div style="margin-top:6px;font-size:14px">${lvlTag(x.lv)}<b>${esc(x.focus.join('; '))}</b></div>`).join('')}</div>`).join('')}</div>`;
    else body = `<div class="grid g3">${l.st.map(s => `<div class="card" style="background:var(--wash)">${appChip(s.ap)}<ul style="margin:8px 0 0;padding-left:18px;font-size:14px">${s.focus.map(x => `<li><b>${esc(x)}</b></li>`).join('')}${s.recap.length ? `<li style="color:var(--muted)">Recap: ${esc(s.recap.join('; '))}</li>` : ''}</ul></div>`).join('')}</div>`;
    return `<div class="card" style="margin-bottom:12px"><div class="flow-hrow"><h3 style="margin:0">Lesson ${l.n} · ${esc(l.title)}</h3><small>${l.assess || l.perf ? p.mins + ' min' : `Warm-up ${p.warm} min · ${R.st.length} stations × ${R.rot} min · cool-down ${p.cool} min`}</small></div><div style="margin-top:8px">${body}</div></div>`; };
  const el = document.getElementById('sec_out'); const html = `<div class="card" style="margin-bottom:12px"><div class="flow-hrow"><div><h2 style="margin:0">${esc(D.secLevelName(p))} · ${R.lessons.length} lessons</h2><p class="lead" style="margin:4px 0 0">${R.st.length} stations: ${R.st.map(a => D.SEC_APP[a].name).join(', ')}. Groups of about ${R.group}, ${R.rot} minutes at each.</p></div>
    <button class="btn" data-act="sch-sec-today" ${t.key === 'on' ? '' : 'disabled'}>Print today’s class plan</button></div><p class="lead" style="font-size:13px;margin:8px 0 0">${esc(today)}</p>${R.notes.length ? `<ul>${R.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>${R.lessons.map(lesson).join('')}`;
  if (el) el.innerHTML = html; return html;
}
export function secPrint(only){
  const p = secRead(), R = D.secCalc(p), one = only ? R.lessons.find(l => l.n === only) : null;
  const rows = (one ? [one] : R.lessons).map(l => { let d;
    if (l.perf) d = D.secRoutineAps(p).map(ap => `<b>${D.SEC_APP[ap].name}:</b> ${esc(R.book.routines[ap])}`).join('<br>');
    else if (l.assess) d = `Assess and sign off ${R.all ? 'the skills for each pupil’s own level' : `the Level ${p.level} skills`} in each pupil’s Awards Book.`;
    else if (R.all) d = l.st.map(s => `<b>${D.SEC_APP[s.ap].name}:</b> ${s.levels.map(x => `L${x.lv} ${esc(x.focus.join('; '))}`).join(' · ')}`).join('<br>');
    else d = l.st.map(s => `<b>${D.SEC_APP[s.ap].name}:</b> ${esc(s.focus.join('; '))}${s.recap.length ? ` (recap: ${esc(s.recap.join('; '))})` : ''}`).join('<br>');
    return `<tr><td><b>Lesson ${l.n}</b><br><small>${esc(l.title)}</small></td><td>${d}</td></tr>`; }).join('');
  let order = ''; if (one && !one.perf && !one.assess) { const n = R.st.length; let t = p.warm, r = [`<tr><td><b>0–${p.warm} min</b></td><td colspan="${n}"><b>Warm-up</b> together</td></tr>`];
    for (let k = 0; k < n; k++) { r.push(`<tr><td><b>${t}–${t + R.rot} min</b><br><small>Rotation ${k + 1}</small></td>${R.st.map((_, gi) => `<td>${D.SEC_APP[R.st[(gi + k) % n]].name}</td>`).join('')}</tr>`); t += R.rot; }
    r.push(`<tr><td><b>${t}–${t + p.cool} min</b></td><td colspan="${n}"><b>Cool-down</b> and stretch</td></tr>`);
    order = `<h3>Running order</h3><table><tr><th>Time</th>${R.st.map((_, gi) => `<th>Group ${gi + 1}</th>`).join('')}</tr>${r.join('')}</table><h3>Skills at each station</h3>`; }
  printHTML(`<div class="recsheet"><div class="rs-head"><b>NGL Schools Secondary · ${esc(D.secLevelName(p))}${one ? ' · Lesson ' + one.n : ''}</b><span>${esc(R.book.name)}</span><small>${esc(S.club.name || '')}</small></div>
    <p>${R.lessons.length} lessons. ${p.mins}-minute lessons: warm-up ${p.warm} min, ${R.st.length} stations × ${R.rot} min, cool-down ${p.cool} min.</p>${order}<table>${rows}</table></div>`, 'NGL Schools Secondary plan');
}

// ---------- programme (routines, skills, videos) ----------
function programme(){
  const app = UI.app, L = UI.lvl, locked = !licensed() && L > 1;
  const vids = app === 'floor' ? [[D.SCH_LEVEL_VIDEOS.floor[L - 1], 'Level ' + L + ' floor routine']] : app === 'bench' ? [[D.SCH_LEVEL_VIDEOS.bench[L - 1], 'Level ' + L + ' bench routine']]
    : [[D.SCH_LEVEL_VIDEOS.block[L - 1], D.SCH_BLOCK_CAPTIONS[L - 1]], [D.SCH_LEVEL_VIDEOS.spring[L - 1], D.SCH_SPRING_CAPTIONS[L - 1]]];
  const skills = app === 'floor' ? D.SCH_FLOOR_SKILLS[L - 1] : app === 'bench' ? D.SCH_BENCH_SKILLS[L - 1] : null;
  return `<p class="lead">${licensed() ? 'All six levels across Floor, Bench and Vault.' : 'Level 1 is open as a sample. Your Schools Club Licence opens all six levels.'}</p>
    <div class="chips">${[['floor', 'Floor'], ['bench', 'Bench'], ['vault', 'Vault']].map(([k, n]) => `<button class="chip ${k === app ? 'on' : ''}" data-act="sch-app" data-v="${k}">${n}</button>`).join('')}</div>
    <div class="chips" style="margin:10px 0 14px">${[1, 2, 3, 4, 5, 6].map(n => `<button class="chip ${n === L ? 'on' : ''}" data-act="sch-lvl" data-v="${n}">${!licensed() && n > 1 ? '🔒 ' : ''}Level ${n}</button>`).join('')}</div>
    ${locked ? `<div class="card empty"><b>Level ${L} unlocks with your Schools Club Licence.</b><br><a href="#/programmes/schools/licence">See the licence</a></div>`
      : `<div class="grid g2">${vids.map(([id, cap]) => `<div class="card"><div class="vidbox"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1" title="${esc(cap)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div><p class="lead" style="margin:8px 0 0">${esc(cap)}</p></div>`).join('')}</div>
        ${skills ? `<div class="card" style="margin-top:14px"><h3>Level ${L} ${app} skills</h3><ol>${skills.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}`}`;
}

// ---------- the six tabs ----------
const tabs = {
  async overview(p){
    const n = childrenTotal(), band = bandForCount(Math.max(1, n));
    return `<div class="grid g4" style="margin-bottom:16px"><div class="card stat"><b>${schools().length}</b><span>Schools</span></div><div class="card stat"><b>${n}</b><span>Children taking part</span></div>
      <div class="card stat"><b>${esc(band.short)}</b><span>Licence band for ${n} children</span></div><div class="card stat"><b>${(S.club.schoolEvents || []).filter(e => e.date >= todayISO()).length}</b><span>Graduations coming up</span></div></div>
      <div class="card"><div class="flow-hrow"><h2 style="margin:0">Your schools</h2><button class="btn sm" data-act="sch-school">Add a school</button></div>
      ${schools().length ? `<table style="margin-top:8px"><tr><th>School</th><th>Children</th><th></th></tr>${schools().map(s => `<tr><td>${esc(s.name)}</td><td>${parseInt(s.children) || 0}</td><td style="text-align:right"><button class="btn sm ghost" data-act="sch-school" data-id="${esc(s.id)}">Edit</button></td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${n}</b></td><td></td></tr></table>`
        : '<p class="empty">No schools yet. Add the schools you work with and how many children take part at each: your total sets your licence band.</p>'}
      <p class="lead" style="font-size:13px;margin:10px 0 0">Just numbers, no names. Your schools are also used for Graduations.</p></div>
      ${licensed() && band.price > (bandForCount(1).price) && S.lic.band && !S.lic.band.includes(band.short) ? `<div class="card attn" style="margin-top:16px"><b>Your schools now have ${n} children, which is in the ${esc(band.short)} band.</b> Please move up a band in Licence.</div>` : ''}
      <div class="grid g3" style="margin-top:16px"><a class="card tile" href="#/programmes/schools/teach">${ic('plan', p.c)}<div><b>The programme</b><br><small style="color:var(--muted)">Floor, Bench and Vault, Levels 1–6, with videos</small></div></a>
        <a class="card tile" href="#/programmes/schools/teach/profit">${ic('table', p.c)}<div><b>Profit planner</b><br><small style="color:var(--muted)">What NGL Schools could earn your club</small></div></a>
        <a class="card tile" href="#/programmes/schools/compete">${ic('comp', p.c)}<div><b>Graduations</b><br><small style="color:var(--muted)">Add events and order medals</small></div></a></div>`;
  },
  async teach(p, sub){
    const pills = `<div class="paths" style="margin-bottom:14px">${[['', 'The programme'], ['secondary', 'Secondary planner'], ['profit', 'Profit planner']].map(([k, l]) => `<a class="${(sub || '') === k ? 'on y' : 'y'}" style="--c:var(--sch)" href="#/programmes/schools/teach${k ? '/' + k : ''}">${l}</a>`).join('')}<a style="--c:var(--sch)" href="${PROSPECTUS}" target="_blank" rel="noopener">Prospectus for schools ↗</a></div>`;
    if (sub === 'profit') { const pl = planStart();
      return pills + `<div class="card"><h2>What NGL Schools could earn your club</h2><p class="lead">Change any number and the profit updates straight away. We’ve started you with NGL’s suggested figures${childrenTotal() ? ' and the children in your schools' : ''}.</p>
        <div class="btn-row"><button class="btn" data-act="sch-plan-save">Save my numbers</button><button class="btn ghost" data-act="sch-plan-print">Print or save as PDF</button><button class="btn ghost" data-act="sch-plan-reset">Reset to NGL’s figures</button></div></div>
        <div id="pl_form" style="margin-top:16px">${planInputs(pl)}</div><div class="card" style="margin-top:16px"><h2>Your profit and loss</h2><div id="pl_out"></div></div>`; }
    if (sub === 'secondary') { if (!licensed()) return pills + `<div class="card"><h2>Plan secondary school lessons in minutes</h2><p class="lead">The Secondary planner builds a full block of PE lessons from the NGL Schools Secondary Awards Books, adapted to the equipment each school has. It opens with your Schools Club Licence.</p><a class="btn" href="#/programmes/schools/licence">See the licence</a></div>`;
      const sp = secStart();
      return pills + `<div class="card"><h2>Your secondary lesson plan</h2><p class="lead">Choose All Levels for a mixed class, or one level, and tell us what equipment the school has. The planner builds the term’s lessons from the Awards Book skills, ending with the Performance routines and an assessment.</p>
        <div class="btn-row"><button class="btn" data-act="sch-sec-print">Print the term’s lesson plans</button><button class="btn ghost" data-act="sch-sec-save">Save my settings</button><button class="btn ghost" data-act="sch-sec-reset">Reset</button></div></div>
        <div id="sec_form" style="margin-top:16px">${secForm(sp)}</div><div id="sec_out" style="margin-top:16px">${secOut(sp)}</div>`; }
    return pills + programme();
  },
  async awards(p){
    return `<div class="grid g2"><div class="card"><h2>NGL Schools Awards Book</h2><p class="lead">Six progressive levels across Floor, Bench and Vault. Each child keeps one book for their whole time at school, with Bronze, Silver and Gold certificates all year.</p>
      <p><b>Awards Book ${gbp(D.shopItem('book').price)}</b> (RRP ${D.shopItem('book').rrp}) · <b>Certificates ${gbp(D.shopItem('cert').price)}</b> each (three per level) · <b>T-shirts ${gbp(D.shopItem('tshirt').price)}</b></p>
      ${licensed() ? '<a class="btn" href="#/shop">Order in the shop</a>' : '<span class="pill">Ordering opens once your Schools licence is live</span>'}</div>
      <div class="card"><h2>How awards work</h2><ul><li>Pupils work through Levels 1 to 6 on Floor, Bench and Vault.</li><li>Bronze, Silver and Gold certificates mark progress within each level.</li><li>Each programme finishes with a Graduation: see Compete.</li></ul></div></div>`;
  },
  async compete(p){
    if (!licensed()) return `<div class="card"><h2>Graduations</h2><p class="lead">Each programme finishes with a Graduation, added here and shown straight away in your families’ Schools family app. Graduations open with your Schools Club Licence.</p><a class="btn" href="#/programmes/schools/licence">See the licence</a></div>`;
    const ev = S.club.schoolEvents || [], up = ev.filter(e => (e.date || '') >= todayISO()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    return `<div class="card"><div class="flow-hrow"><div><h2 style="margin:0">Graduations</h2><p class="lead" style="margin:4px 0 0">Families pay £${D.GRAD_FAMILY_PRICE} a gymnast including one spectator; extra spectators £${D.GRAD_EXTRA_SPECTATOR}. You keep £${D.GRAD_CLUB_KEEPS}; NGL charges £${D.GRAD_NGL_FEE} + VAT, medal included.</p></div><button class="btn sm" data-act="sch-grad">Add a Graduation</button></div>
      ${up.length ? up.map(e => `<div class="row"><div class="grow"><b>${esc(e.title || 'NGL Schools Graduation')}</b><small>${date(e.date)}${e.time ? ' · ' + esc(e.time) : ''}${e.venue ? ' · ' + esc(e.venue) : ''} · ${e.schoolName ? 'For ' + esc(e.schoolName) : 'For all your schools'}${e.medals ? ' · ' + e.medals + ' medals ordered' : ''}</small></div>
        <button class="btn sm" data-act="sch-medals" data-id="${esc(e.id)}">Order medals</button><button class="btn sm ghost" data-act="sch-grad" data-id="${esc(e.id)}">Edit</button></div>`).join('') : '<p class="empty">No upcoming Graduations yet.</p>'}</div>`;
  },
  async families(p){
    const code = S.lic.code;
    return `<div class="card"><h2>Schools family app</h2><p class="lead">One club code for all your Schools families: they watch the routines, follow the programme at home and see your Graduations. No pupil details are stored.</p>
      ${licensed() ? (code ? `<p style="font:900 28px var(--cond);color:var(--navy)">${esc(code)}</p><div class="btn-row"><button class="btn" data-act="rec-copy" data-v="${esc(appLink('?code=' + encodeURIComponent(code)))}">Copy family link</button><button class="btn ghost" data-act="fam-qr" data-code="${esc(code)}" data-n="Schools">QR code</button><a class="btn ghost" href="${esc(appLink('?code=' + encodeURIComponent(code)))}" target="_blank" rel="noopener">Open ↗</a></div>`
        : '<p class="lead">Your family code is created when your licence switches on. In the sandbox it appears after the switch-over.</p>') : '<span class="pill">The family app opens with your Schools licence</span>'}</div>`;
  },
  async licence(p){
    const L = S.lic, n = childrenTotal(), suggest = bandForCount(Math.max(1, n));
    if (licensed()) return `<div class="card" style="border-left:4px solid var(--sch)"><h2>Licence live ${pill('Live', 'ok')}</h2><p class="lead" style="margin:0">${esc(L.band || '')}${L.renews ? ' · renews ' + date(L.renews) : ''}. The programme, Secondary planner, Graduations, family code and ordering at club prices.</p></div>`;
    return `<div class="card"><h2>Start your Schools Club Licence</h2><p class="lead">One yearly licence for your club, priced by how many Schools gymnasts you coach. No names or pupil details needed.${n ? ` Your schools have <b>${n} children</b>, so your band is <b>${esc(suggest.short)}</b>.` : ''}</p>
      <table><tr><th>Schools gymnasts</th><th>A year (+ VAT)</th><th></th></tr>${D.SCHOOLS_BANDS.map(b => `<tr ${b === suggest && n ? 'style="background:#fff8d6"' : ''}><td>${esc(b.label)}</td><td><b>${gbp(b.price)}</b></td><td style="text-align:right"><button class="btn sm" data-act="sch-buy" data-band="${b.key}">Choose</button></td></tr>`).join('')}</table>
      <p class="lead" style="font-size:13px;margin:10px 0 0">Prices exclude VAT (20%). Runs for 12 months. 5% off if it isn’t your club’s most expensive NGL licence.</p></div>`;
  }
};

export default { async render(p, tab, sub){ await ready(); return (tabs[tab] || tabs.overview)(p, sub); } };
