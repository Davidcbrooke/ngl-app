// NGL Admin · Rotation Planner clubs. Copied word for word from GYMNASTICS-RESULTS/NGL_Admin.html:
// the same three counts, the Registered Clubs table (Club Hub clubs plus clubs still on the old planner),
// "Show every Club Hub club", Import Data (paste JSON) and View. Only the shell, look and data layer changed:
// - Club Hub clubs: Firestore clubs/{uid} (name, contact, email, source, createdAt, rotaJson); Import writes
//   rotaJson + rotaUpdatedAt (merge), exactly as before. Same collection, now on this app's database.
// - Old planner clubs: the Rotation Planner's Realtime Database (saadi-rotation, clubs/{uid}/profile and /rota).
//   READ ONLY here: this app never writes to it. It needs the live NGL Admin sign-in, so in the sandbox it is
//   usually refused and the screen says so.
// - The separate "Sign in to the NGL Club Hub database" form is gone: this app has one sign-in.
// ?demo keeps every change in memory and never writes.
import { fb } from '../firebase.js';
import { MODE } from '../data.js';
import { esc, toast, modal } from '../ui.js';

const OLD_DB_URL = 'https://saadi-rotation-default-rtdb.europe-west1.firebasedatabase.app';   // old Rotation Planner database (read only)
const LIVE = MODE !== 'demo';
const S = { clubs: [], showAll: false, loaded: null, loading: false, err: '', oldNote: '', importing: null };
const redraw = () => document.getElementById('roRoot') && window.NGL_RENDER && window.NGL_RENDER();
const toDate = v => !v ? null : v.toDate ? v.toDate() : new Date(v);
function parseRota(j){ try { return j ? (typeof j === 'string' ? JSON.parse(j) : j) : null; } catch (e) { return null; } }

/* ---------- sample data (?demo) ---------- */
const ago = n => new Date(Date.now() - n * 864e5);
const rota = (groups, locs, perDay) => ({
  groups: groups.map((name, i) => ({id: 'g' + i, name})), locations: locs.map((name, i) => ({id: 'l' + i, name})),
  sessions: Object.fromEntries(Object.entries(perDay).map(([d, n]) => [d, {[groups[0] || 'All']: Array.from({length: n}, (_, k) => ({id: d + k}))}]))
});
function demoClubs(){
  return [
    {uid: 'demo-saadi', store: 'hub', name: 'SAADI Gymnastics', contact: 'Dave Brooke', email: 'dave@saadi.example', created: ago(3), source: 'rotations',
      rota: rota(['Ruby', 'Pink', 'Squad A', 'Squad B'], ['Main floor', 'Vault runway', 'Bars area', 'Beam room'], {mon: 6, wed: 5, sat: 8})},
    {uid: 'demo-riverside', store: 'hub', name: 'Riverside Gym Academy', contact: 'Jo Evans', email: 'office@riverside.example', created: ago(12), source: 'rotations',
      rota: rota(['Development', 'Competitive'], ['Sports hall', 'Annexe'], {tue: 4, thu: 4})},
    {uid: 'demo-northgate', store: 'hub', name: 'Northgate Gymnastics Club', contact: 'Sam Patel', email: 'info@northgate.example', created: ago(40), source: 'rotations', rota: null},
    {uid: 'demo-oakfield', store: 'hub', name: 'Oakfield Tumblers', contact: 'Priya Shah', email: 'hello@oakfield.example', created: ago(75), source: 'clubhub', rota: null},
    {uid: 'demo-old-1', store: 'old', name: 'Hillcrest Gymnastics', contact: 'Chris Lowe', email: 'chris@hillcrest.example', created: ago(210), source: 'rotations',
      rota: rota(['Recreational'], ['Hall'], {fri: 3})}
  ];
}

/* ---------- data ---------- */
/* Old planner registrations still in the Realtime Database (read only). Same request as before, without the
   old project's sign-in token, which this app doesn't have. */
async function oldClubs(){
  const r = await fetch(`${OLD_DB_URL}/clubs.json`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function load(){
  S.err = ''; S.oldNote = '';
  if (!LIVE) { S.clubs = demoClubs(); return; }
  const list = [];
  try {
    const {fs, D} = await fb();
    const snap = await fs.getDocs(fs.collection(D, 'clubs'));
    snap.forEach(d => { const c = d.data(); if (!c.name && !c.email) return;
      list.push({uid: d.id, store: 'hub', name: c.name || '', contact: c.contact || '', email: c.email || '', created: toDate(c.createdAt), source: c.source || '', rota: parseRota(c.rotaJson)}); });
  } catch (e) {
    console.error(e);
    S.err = e.code === 'permission-denied' ? "This login can't read the Club Hub clubs. Sign in with an NGL admin account for the Club Hub."
      : 'Failed to load clubs. Check the connection and press Refresh.';
    S.clubs = []; return;
  }
  // Old planner registrations still in the Realtime Database (skipped if the same email is already in the Club Hub)
  try {
    const old = await oldClubs();
    if (old && typeof old === 'object' && !old.error) {
      const have = new Set(list.map(c => c.email.toLowerCase()).filter(Boolean));
      Object.entries(old).forEach(([uid, data]) => { const p = (data && data.profile) || {}; if (!p.clubName && !p.email) return;
        if (p.email && have.has(String(p.email).toLowerCase())) return;
        list.push({uid, store: 'old', name: p.clubName || '', contact: p.contactName || '', email: p.email || '', created: toDate(p.createdAt), source: 'rotations', rota: (data && data.rota) || null}); });
    }
  } catch (e) {
    console.warn('Old planner clubs not read', e);
    S.oldNote = 'Old planner clubs (the Rotation Planner’s old database) couldn’t be read here: that database needs the live NGL Admin sign-in. They still show in the live tool.';
  }
  S.clubs = list.sort((a, b) => (b.created || 0) - (a.created || 0));
}
async function reload(){ S.loading = true; redraw(); try { await load(); } finally { S.loading = false; redraw(); } }

/* ---------- screen ---------- */
const usesPlanner = c => c.source === 'rotations' || c.store === 'old' || !!(c.rota && (c.rota.groups || []).length);
const countSessions = r => Object.values((r && r.sessions) || {}).reduce((t, day) => t + Object.values(day || {}).reduce((t2, arr) => t2 + ((arr || []).length || 0), 0), 0);

function statsHTML(){
  const now = new Date(), list = S.clubs.filter(usesPlanner);
  const n = list.filter(c => c.created && c.created.getFullYear() === now.getFullYear() && c.created.getMonth() === now.getMonth()).length;
  const act = list.filter(c => c.rota && (c.rota.groups || []).length > 0).length;
  const card = (id, v, l) => `<div class="card stat ro-stat"><b id="${id}">${S.loading && !S.clubs.length ? '—' : v}</b><span>${l}</span></div>`;
  return `<div class="ro-stats">${card('roStatTotal', list.length, 'Registered Clubs')}${card('roStatNew', n, 'New This Month')}${card('roStatActive', act, 'Active (have sessions)')}</div>`;
}
function tableHTML(){
  if (S.loading) return '<div class="empty">Loading...</div>';
  if (S.err) return `<div class="empty ro-err">${esc(S.err)}</div>`;
  const list = S.showAll ? S.clubs : S.clubs.filter(usesPlanner);
  const toggle = `<label class="ro-showall"><input type="checkbox" id="roShowAll" ${S.showAll ? 'checked' : ''}> Show every Club Hub club (${S.clubs.length})</label>`;
  if (!list.length) return toggle + '<div class="empty">No clubs registered yet.</div>';
  const k = l => `<span class="ro-k">${l}</span>`;
  return toggle + `<div class="ro-tw"><table class="ro-table"><thead><tr>
    <th>Club Name</th><th>Contact</th><th>Email</th><th>Joined</th><th>Groups</th><th>Sessions</th><th>Actions</th>
  </tr></thead><tbody>${list.map(c => {
    const isNew = c.created && (Date.now() - c.created.getTime()) < 7 * 864e5;
    const tag = c.store === 'old' ? '<span class="pill amber">Old planner</span>' : (c.source !== 'rotations' && !usesPlanner(c) ? '<span class="pill">Club Hub only</span>' : '');
    return `<tr data-club="${esc(c.uid)}">
      <td class="ro-name"><strong>${esc(c.name) || '—'}</strong> ${isNew ? '<span class="pill warn">NEW</span>' : ''} ${tag}</td>
      <td>${k('Contact')}${esc(c.contact) || '—'}</td>
      <td class="ro-email">${k('Email')}${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</td>
      <td>${k('Joined')}${c.created ? c.created.toLocaleDateString('en-GB') : '—'}</td>
      <td class="ro-groups">${k('Groups')}${((c.rota && c.rota.groups) || []).length}</td>
      <td class="ro-sessions">${k('Sessions')}${countSessions(c.rota)}</td>
      <td class="ro-acts">${c.store === 'hub' ? `<button class="btn sm" data-act="ro-import" data-uid="${esc(c.uid)}">Import Data</button>` : ''}<button class="btn sm ghost" data-act="ro-view" data-uid="${esc(c.uid)}">View</button></td>
    </tr>`; }).join('')}</tbody></table></div>`;
}
function view(){
  return `<div class="ro-root" id="roRoot"><p class="lead">Registered clubs and data imports for the Rotation Planner</p>
    ${!LIVE ? '' : '<p class="ro-src">Club Hub clubs from this app’s database; old planner clubs read only from the Rotation Planner’s old database.</p>'}
    ${statsHTML()}
    <div class="card ro-panel"><div class="ro-hdr"><h2>Registered Clubs</h2>
      <span class="ro-hdr-acts"><button class="btn sm ghost" data-act="ro-refresh">↻ Refresh</button></span></div>
      ${S.oldNote && !S.loading ? `<p class="ro-note">${esc(S.oldNote)}</p>` : ''}
      <div id="roClubs">${tableHTML()}</div></div></div>`;
}

/* ---------- import and view ---------- */
const find = uid => S.clubs.find(x => x.uid === uid);
function openImport(uid, clubName){
  S.importing = uid;
  const m = modal(`<div class="ro-dlg" id="roImport"><h2 id="roImportTitle">Import Data for ${esc(clubName)}</h2>
    <label class="ro-lbl" for="roImportData">Paste JSON data (from SAADI v2 export or another club)</label>
    <textarea id="roImportData" placeholder='{"groups":[...],"locations":[...],"sessions":{}}'></textarea>
    <p class="ro-dlg-err" id="roImportErr" role="alert"></p>
    <div class="btn-row ro-dlg-acts"><button class="btn ghost" data-act="ro-import-cancel">Cancel</button><button class="btn" data-act="ro-import-do" id="roImportDo">Import Data</button></div></div>`);
  const ta = m.querySelector('textarea'); if (ta) ta.focus();
}
function closeImport(){ const d = document.getElementById('roImport'); if (d) d.closest('.modal-bg').remove(); S.importing = null; }
const importErr = msg => { const e = document.getElementById('roImportErr'); if (e) e.textContent = msg; const b = document.getElementById('roImportDo'); if (b) { delete b.dataset.sure; b.textContent = 'Import Data'; } };

export const RO = {
  'ro-refresh'(){ reload(); },
  'ro-import'(b){ const c = find(b.dataset.uid); if (c) openImport(c.uid, c.name || 'Club'); },
  'ro-import-cancel'(){ closeImport(); },
  async 'ro-import-do'(b){
    const raw = ((document.getElementById('roImportData') || {}).value || '').trim();
    if (!raw) { importErr('Please paste JSON data.'); return; }
    let data;
    try { data = JSON.parse(raw); } catch (e) { importErr('Invalid JSON. Please check the data and try again.'); return; }
    if (!data.groups || !data.locations) { importErr('Data missing groups or locations fields.'); return; }
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Yes, overwrite';
      const e = document.getElementById('roImportErr'); if (e) e.textContent = 'This will overwrite all existing data for this club. Are you sure?'; return; }
    const uid = S.importing, c = find(uid); if (!uid) return;
    b.disabled = true;
    if (LIVE) {
      try { const {fs, D} = await fb(); await fs.setDoc(fs.doc(D, 'clubs', uid), {rotaJson: JSON.stringify(data), rotaUpdatedAt: fs.serverTimestamp()}, {merge: true}); }
      catch (e) { b.disabled = false; importErr('Import failed: ' + e.message); return; }
      closeImport(); toast('Data imported successfully!'); reload();
    } else {
      if (c) c.rota = data;      // sample data: in memory only
      closeImport(); toast('Data imported successfully!'); redraw();
    }
  },
  'ro-view'(b){
    const c = find(b.dataset.uid); const r = c && c.rota;
    const groups = (r && r.groups) || [], locs = (r && r.locations) || [];
    modal(`<div class="ro-dlg" id="roView"><h2>${esc((c && c.name) || 'Club')}</h2>
      <p class="ro-viewline"><b>Groups:</b> ${esc(groups.map(g => g.name).join(', ') || 'none')}</p>
      <p class="ro-viewline"><b>Locations:</b> ${esc(locs.map(l => l.name).join(', ') || 'none')}</p>
      <div class="btn-row ro-dlg-acts"><button class="btn" data-close>OK</button></div></div>`);
  }
};

document.addEventListener('change', e => {
  if (e.target && e.target.id === 'roShowAll' && e.target.closest('#roRoot')) { S.showAll = e.target.checked; redraw(); }
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'roImportData') importErr(''); });

/* The screen: #/admin/rotation */
export default async function rotation(me = {}, parts = []){
  if (!S.loaded) S.loaded = load();
  await S.loaded;
  return view();
}
