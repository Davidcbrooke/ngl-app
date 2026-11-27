// NGL Admin · Ticket sales. Copied from GYMNASTICS-RESULTS/NGL_Ticket_Sales.html (same wording, matching and sums);
// only the look and the data layer change. Gymnasts and spectators sold on JustGo per competition, and gymnast places left.
// Data: competitions (maxPlaces, time, where), justgoSales/summary (written by the "Sync NGL sales" bookmark: events, map, syncedAt),
// and club names from reservations (to turn JustGo's "Person-Club" booker into a club).
import { MODE } from '../data.js';
import { fb } from '../firebase.js';
import { esc } from '../ui.js';

const FINANCE = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Finance.html';
const ACC = {preschool: '#E8559A', schools: '#F8D438', recreational: '#E88230', general: '#0071B3', performance: '#01AFB8', university: '#3BAA4A', masters: '#7A4C9E'};
const UI = {past: false};

function pathway(c){ if (c.pathway && ACC[c.pathway]) return c.pathway; return (((c.name || '') + ' ' + (c.level || '')).toLowerCase().includes('rec')) ? 'recreational' : 'general'; }
const cap = c => (typeof c.maxPlaces === 'number' && !isNaN(c.maxPlaces)) ? c.maxPlaces : null;
/* JustGo's "booked by" is "Person name-Club name" when a club buys: match it to a club name from Club Hub reservations */
export const norm = t => String(t || '').toLowerCase().replace(/gymnastics?|club|academy|ltd|limited|c\.i\.c|cic|community|centre|center|the|&|and/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
export function clubOf(b, CLUBS){
  const nb = ' ' + norm(b) + ' ';
  const hit = CLUBS.filter(c => c.n && nb.includes(' ' + c.n + ' ')).sort((a, b) => b.n.length - a.n.length)[0];
  if (hit) return hit.name;
  return b.includes('-') ? b.replace(/^[^-]*-/, '').trim() : b + ' (individual)';
}
/* Same matching as NGL Finance: a saved match first, otherwise by date and name */
export function autoMatch(e, comps){
  const same = comps.filter(c => c.date === e.date); if (!same.length) return '';
  if (same.length === 1) return same[0].id;
  const n = (e.name || '').toUpperCase();
  const score = c => { const m = (c.name || '').toUpperCase(); let k = 0;
    if (/6-8|9-11/.test(n) && /6-8|9-11/.test(m)) k += 3; if (/12-14|15\+/.test(n) && /12-14|15\+/.test(m)) k += 3;
    const lv = n.match(/LEVEL ([ABC])/); if (lv && new RegExp('LEVEL ' + lv[1]).test(m)) k += 3;
    ['EAST', 'WEST', 'IRELAND', 'SOUTH', 'NORTH', 'FLOOR', 'VAULT', 'BOYS', 'MEN', 'WOMEN', 'RUBY', 'TEAL', 'MINI'].forEach(w => { if (n.includes(w) && m.includes(w)) k++; });
    return k; };
  return same.slice().sort((a, b) => score(b) - score(a))[0].id;
}
function dayLabel(d){ return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}); }
function ago(iso){ const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 36) return h + ' hours ago'; return Math.round(h / 24) + ' days ago'; }

// ---------- data ----------
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function demoData(){
  const comps = [
    {id: 'r1-a', name: 'NGL Round 1: Level A', date: plus(30), time: '09:00', venue: 'Harpenden', maxPlaces: 120, pathway: 'general'},
    {id: 'r1-bc', name: 'NGL Round 1: Level B and C', date: plus(30), time: '13:30', venue: 'Harpenden', maxPlaces: 120, pathway: 'general'},
    {id: 'rec-1', name: 'NGL Recreational Competition', date: plus(58), time: '10:00', venue: 'Milton Keynes', maxPlaces: 80, pathway: 'recreational'}];
  const JG = {syncedAt: new Date(Date.now() - 5 * 3600e3).toISOString(), map: {}, events: {
    E1: {ref: 'E1', date: plus(30), name: 'NGL ROUND 1 LEVEL A', gymnasts: 104, spectators: 212, bookers: {'Jo Smith-SAADI Gymnastics': 36, 'Sam Patel-Northgate Gymnastics Club': 40, 'Kim Lee-Riverside Gym Academy': 28}},
    E2: {ref: 'E2', date: plus(30), name: 'NGL ROUND 1 LEVEL B AND C', gymnasts: 61, spectators: 140, bookers: {'Jo Smith-SAADI Gymnastics': 25, 'Sam Patel-Northgate Gymnastics Club': 36}},
    E3: {ref: 'E3', date: plus(58), name: 'NGL RECREATIONAL', gymnasts: 22, spectators: 30, bookers: {'Alex Day-Riverside Gym Academy': 22}},
    E4: {ref: 'E4', date: plus(75), name: 'NGL SPRING SHOWCASE', gymnasts: 8, spectators: 0, bookers: {}}}};
  const CLUBS = ['SAADI Gymnastics', 'Northgate Gymnastics Club', 'Riverside Gym Academy'];
  return {comps, JG, CLUBS};
}
async function liveData(){
  const {fs, D} = await fb();
  const [cs, jg, rs] = await Promise.all([
    fs.getDocs(fs.collection(D, 'competitions')),
    fs.getDoc(fs.doc(D, 'justgoSales', 'summary')).catch(e => { if (e.code === 'permission-denied') throw e; return null; }),
    fs.getDocs(fs.collection(D, 'reservations')).catch(() => null)]);
  const comps = cs.docs.map(d => { const x = d.data(); return {id: d.id, name: x.name || '', date: x.date || '', time: x.time || '', venue: x.where || x.venue || '', maxPlaces: x.maxPlaces, pathway: x.path || x.pathway || '', level: x.level || ''}; });
  const x = jg && jg.exists() ? jg.data() : {};
  const JG = {events: x.events || {}, map: x.map || {}, syncedAt: x.syncedAt || null};
  const names = {}; (rs ? rs.docs : []).forEach(d => { const c = String(d.data().clubName || '').trim(); if (c) names[c] = 1; });
  (x.clubNames || []).forEach(c => { if (c) names[c] = 1; });
  return {comps, JG, CLUBS: Object.keys(names)};
}

// ---------- screen ----------
export default async function sales(){
  let data;
  try { data = MODE === 'demo' ? demoData() : await liveData(); }
  catch (e) { console.error(e); return `<div class="card empty">${e.code === 'permission-denied' ? 'You need Ticket sales or Finance access to see ticket sales.' : 'Couldn’t load ticket sales.'}</div>`; }
  const {comps, JG} = data, CLUBS = data.CLUBS.map(name => ({name, n: norm(name)}));
  const matchOf = ref => (JG.map && ref in JG.map) ? JG.map[ref] : autoMatch(JG.events[ref] || {}, comps);
  const today = new Date().toISOString().slice(0, 10);
  const sold = {}, unmatched = [];
  Object.values(JG.events || {}).forEach(e => { const id = matchOf(e.ref);
    if (!id || !comps.some(c => c.id === id)) { if (e.date >= today) unmatched.push(e); return; }
    const s = sold[id] = sold[id] || {g: 0, s: 0, clubs: {}}; s.g += +e.gymnasts || 0; s.s += +e.spectators || 0;
    Object.entries(e.bookers || {}).forEach(([b, q]) => { const c = clubOf(b, CLUBS); s.clubs[c] = (s.clubs[c] || 0) + (+q || 0); }); });
  const list = comps.filter(c => c.date && (UI.past || c.date >= today)).sort((a, b) => (a.date + (a.time || '') + a.name).localeCompare(b.date + (b.time || '') + b.name));

  let tg = 0, ts = 0, tl = 0, html = '', last = '';
  list.forEach(c => {
    const s = sold[c.id] || {g: 0, s: 0, clubs: {}}, mx = cap(c), left = mx == null ? null : Math.max(0, mx - s.g);
    tg += s.g; ts += s.s; if (left != null) tl += left;
    if (c.date !== last) { html += `<h3 class="ts-day">${dayLabel(c.date)}</h3>`; last = c.date; }
    const pct = mx ? Math.min(100, Math.round(s.g / mx * 100)) : 0;
    const cls = left == null ? '' : left === 0 ? 'full' : left <= Math.max(5, mx * 0.1) ? 'low' : '';
    html += `<div class="card ts-comp" style="--c:${ACC[pathway(c)]}">
      <div class="ts-nm"><b>${esc(c.name)}</b><small>${esc([c.time, c.venue].filter(Boolean).join(' · '))}</small></div>
      <div class="ts-gy"><b>${s.g}</b>${mx != null ? ` of ${mx}` : ''} gymnasts<div class="ts-bar"><i style="width:${pct}%"></i></div></div>
      <div class="ts-num"><b>${s.s}</b><span>spectators</span></div>
      <div class="ts-num ts-left ${cls}"><b>${left == null ? '–' : left === 0 ? 'Full' : left}</b><span>${left == null ? 'no limit set' : left === 0 ? 'no places left' : 'places left'}</span></div>
      ${Object.keys(s.clubs).length ? `<div class="ts-clubs"><span class="lbl">Clubs booked</span>${Object.entries(s.clubs).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n, q]) => `<span>${esc(n)}<b>${q}</b></span>`).join('')}</div>` : (s.g ? '' : `<div class="ts-clubs"><span class="lbl">No clubs booked yet</span></div>`)}
    </div>`;
  });
  const old = !JG.syncedAt || (Date.now() - new Date(JG.syncedAt)) > 2 * 864e5;
  const sync = JG.syncedAt
    ? `Sales last synced from JustGo <b>${ago(JG.syncedAt)}</b> (${new Date(JG.syncedAt).toLocaleString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}). ${old ? 'To update, open MyBG Event Management and run the <b>Sync NGL sales</b> bookmark. ' : ''}<a href="${FINANCE}" target="_blank" rel="noopener">Sync instructions in Finance</a>`
    : `No JustGo sales synced yet. Open MyBG Event Management and run the <b>Sync NGL sales</b> bookmark. <a href="${FINANCE}" target="_blank" rel="noopener">Instructions in Finance</a>`;
  return `<div class="card ts-sync ${old ? 'old' : ''}">${sync}</div>
  <div class="grid g3" style="margin:14px 0"><div class="card stat"><b>${tg}</b><span>gymnasts sold</span></div><div class="card stat"><b>${ts}</b><span>spectator tickets sold</span></div><div class="card stat"><b>${tl}</b><span>gymnast places left</span></div></div>
  <label class="ts-ctl"><input type="checkbox" id="tsPast" ${UI.past ? 'checked' : ''}> Show past competitions</label>
  ${html || `<p class="empty">No ${UI.past ? '' : 'upcoming '}competitions.</p>`}
  ${unmatched.length ? `<div class="card ts-unm"><b>JustGo events not matched to a competition</b> (their sales aren't counted above). Match them in <a href="${FINANCE}" target="_blank" rel="noopener">Finance › Competitions › JustGo sales</a>.<ul>${
    unmatched.sort((a, b) => a.date.localeCompare(b.date)).map(e => `<li>${esc(e.date)} · ${esc(e.name)}: ${+e.gymnasts || 0} gymnasts, ${+e.spectators || 0} spectators</li>`).join('')}</ul></div>` : ''}`;
}

document.addEventListener('change', e => { if (e.target.id === 'tsPast') { UI.past = e.target.checked; window.NGL_RENDER && window.NGL_RENDER(); } });
