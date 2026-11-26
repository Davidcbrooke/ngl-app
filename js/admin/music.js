// NGL Admin · Floor music and the Competition music player.
// Copied from GYMNASTICS-RESULTS/NGL_Music_Admin.html: same wording, features, logic and behaviour
// (running order by session and floor rotation, paste floor order, drag and drop, absences, admin uploads,
// zip per rotation, publish to the Club Hub, club emails, gymnast introductions (ElevenLabs), and the Play tab:
// offline player from IndexedDB, announcements, built-in walk on / medal / closing tracks, background playlist,
// Spotify fallback, controller view, keyboard Space/S/K/R/arrows, fades, backup zip).
// Only the shell, the look and the data layer change:
//   musicEvents/{compId}   same fields as before (status, deadline, clubs, levels, gymClub, rot, nrot, floorOrderAt, absent, intros, links, order)
//   musicEvents/_builtin   built-in tracks, background playlist and shared announcements (same fields as before)
//   musicComps/{compId}    {json, updatedAt}: the Elevien import (was ngl-music-comps.js). Without one, gymnasts come from musicEntries.
//   musicEntries/{compId}_{clubId}  written on Publish, one per club with a Club Hub account (what the club's Floor music screen reads)
//   musicUploads/{compId}_{gymnastId}  club uploads (data.js uploadMusic) and NGL admin uploads
//   Storage music/{compId}/{clubId|admin}/…  same paths as before.
// ?demo: sample competition in memory, generated tones as music, nothing is written to the database or Storage.
import { fb } from '../firebase.js';
import { MODE, CALENDAR } from '../data.js';

const LIVE = MODE !== 'demo';
const SV = '10.12.2';
const CLUB_HUB = location.origin + location.pathname + '#/competitions/music';   // the one NGL app
const GHOST = () => { const i = document.createElement('input'); i.className = 'mu-hidden'; return i; };   // stands in when the screen isn't open
const $ = s => document.querySelector(s) || GHOST();
const onScreen = () => !!document.getElementById('muRoot');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
function toast(m){ const t = document.createElement('div'); t.className = 'toast mu-toast'; t.textContent = m; (document.fullscreenElement || document.body).appendChild(t); setTimeout(() => t.remove(), 3500); }
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const plainObj = v => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Blob);
function mergeDeep(a, b){ for (const k in b) { if (plainObj(b[k]) && plainObj(a[k])) mergeDeep(a[k], b[k]); else a[k] = clone(b[k]); } return a; }

/* JSZip: loaded straight away, so the zip and backup still work if the hall Wi-Fi drops later */
let ZIPP = null;
const loadZip = () => window.JSZip ? Promise.resolve(window.JSZip) : (ZIPP = ZIPP || new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  s.onload = () => res(window.JSZip); s.onerror = e => { ZIPP = null; rej(e); }; document.head.appendChild(s); }));
loadZip().catch(() => {});

/* ---------- data layer ---------- */
let FS = null, DB = null, ST = null, STG = null, ME = {};
async function storage(){
  if (STG) return STG;
  const [st, app] = await Promise.all([import(`https://www.gstatic.com/firebasejs/${SV}/firebase-storage.js`), import(`https://www.gstatic.com/firebasejs/${SV}/firebase-app.js`)]);
  ST = st; STG = st.getStorage(app.getApp()); return STG;
}
async function putFile(path, blob, meta, onProg){
  if (!LIVE) return URL.createObjectURL(blob);
  await storage(); const ref = ST.ref(STG, path), task = ST.uploadBytesResumable(ref, blob, meta);
  await new Promise((res, rej) => task.on('state_changed', s => onProg && onProg(s), rej, res));
  return ST.getDownloadURL(ref);
}
async function delFile(path){ if (!LIVE || !path) return; await storage(); await ST.deleteObject(ST.ref(STG, path)); }
const DEMO = {events: {}, uploads: {}, entries: {}};
async function evSet(data, id){
  id = id || D.compKey;
  if (!LIVE) { DEMO.events[id] = mergeDeep(DEMO.events[id] || {}, data); if (D && id === D.compKey) setTimeout(() => onEv(clone(DEMO.events[id])), 0); return; }
  await FS.setDoc(FS.doc(DB, 'musicEvents', id), data, {merge: true});
}
async function entrySet(id, data){
  if (!LIVE) { DEMO.entries[id] = mergeDeep(DEMO.entries[id] || {}, data); return; }
  await FS.setDoc(FS.doc(DB, 'musicEntries', id), {...data, updatedAt: FS.serverTimestamp()}, {merge: true});
}

/* ---------- competitions: from the competitions list, with entries from the Elevien import (musicComps) or the Club Hub entries ---------- */
let COMPS = [], ACCOUNTS = [], ENTRIES = [], LOADED = null, FORCE = false, ELEV_AT = null;
const UI = {tab: 'order', route: null, playonly: false};
let D = null, G = {}, SESS = [], FO = {}, NROT = 4;
let EV = null, UP = {}, ORDER = {}, ROT = {}, ABS = {}, INTROS = {}, UNSUB = [];
const bibTag = id => G[id] && G[id].bib ? `<span class="mu-bib" title="Elevien gymnast number">${esc(G[id].bib)}</span>` : '';
const clubName = k => D.clubs[k]?.name || k;
const orderFor = L => { const ids = L.gymnasts.map(g => g[0]); const o = (ORDER[L.id] || []).filter(id => ids.includes(id)); return [...o, ...ids.filter(id => !o.includes(id))]; };
const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'});
const longDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}) : (d || '');
const deadline = () => ($('#muDlInput').value || '').trim() || (EV && EV.deadline) || D.deadline || '';
const isoOf = v => v && v.toDate ? v.toDate().toISOString() : v || '';

function fromEntries(ents){
  const clubs = {}, byL = {};
  ents.forEach(e => { const a = ACCOUNTS.find(x => x.uid === e.clubId);
    clubs[e.clubId] = {name: e.clubName || (a && a.name) || e.clubId, bg: a ? a.bg : '', uid: e.clubId};
    (e.gymnasts || []).forEach(g => { const k = String(g.level ?? '').replace(/^level\s*/i, '').trim() || '?'; (byL[k] = byL[k] || []).push([g.id, g.n, e.clubId, '']); }); });
  const levels = Object.keys(byL).sort((a, b) => a.localeCompare(b, 'en', {numeric: true})).map(k => ({id: k, name: /^\d+$/.test(k) ? 'Level ' + k : k, gymnasts: byL[k]}));
  return {clubs, levels};
}
function buildComp(c, el, ents){
  const base = el ? {clubs: el.clubs || {}, levels: el.levels || [], floorRotations: el.floorRotations, floorOrder: el.floorOrder || {}} : fromEntries(ents);
  return {compKey: c.id, title: c.name || (el && el.title) || c.id, date: c.date || (el && el.date) || '',
    deadline: (el && el.deadline) || (c.musicBy ? longDate(c.musicBy) : '') || (ents[0] && longDate(ents[0].deadline)) || '', ...base};
}
const MUSIC_COMPS_URL = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-music-comps.js';
async function loadLists(){
  let cal = [], el = {};
  if (LIVE) {
    const f = await fb(); FS = f.fs; DB = f.D; storage().catch(() => {});
    const get = (coll, what) => FS.getDocs(FS.collection(DB, coll)).catch(e => { console.warn(what, e); return null; });
    const [cs, mc, me, cl, pp] = await Promise.all([get('competitions', 'competitions'), get('musicComps', 'Elevien entries'), get('musicEntries', 'Club Hub entries'),
      get('clubs', 'club accounts'), get('pendingPlaces', 'Reservation emails not readable')]);
    cal = cs && cs.size ? cs.docs.map(d => ({id: d.id, ...d.data()})) : CALENDAR.slice();
    (mc ? mc.docs : []).forEach(d => { try { el[d.id] = JSON.parse(d.data().json); const at = isoOf(d.data().updatedAt) || el[d.id].updatedAt; if (at && (!ELEV_AT || at > ELEV_AT)) ELEV_AT = at; } catch (e) { console.warn('Elevien entries for ' + d.id + " couldn't be read", e); } });
    // The Elevien import ("ask Claude to update from Elevien") publishes ngl-music-comps.js on the results site, as for the old tool.
    // Read it too, so both tools stay in step; whichever copy is newer wins. (Offline: skipped, the saved copy is used.)
    try { const r = await fetch(MUSIC_COMPS_URL + '?v=' + Date.now(), {cache: 'no-store'});
      if (r.ok) { const t = await r.text(), k = t.indexOf('{', t.indexOf('NGL_MUSIC_COMPS')), j = JSON.parse(t.slice(k, t.lastIndexOf('}') + 1));
        (j.comps || []).forEach(c => { const cur = el[c.compKey]; if (c.compKey && (!cur || String(j.updatedAt || '') > String(cur.updatedAt || ''))) el[c.compKey] = {...c, updatedAt: j.updatedAt}; });
        if (j.updatedAt && (!ELEV_AT || j.updatedAt > ELEV_AT)) ELEV_AT = j.updatedAt; } }
    catch (e) { console.warn('Elevien file not loaded', e); }
    ENTRIES = (me ? me.docs : []).map(d => d.data());
    ACCOUNTS = (cl ? cl.docs : []).map(d => ({uid: d.id, name: d.data().name || '', bg: String(d.data().bgNumber || '').replace(/^BG/i, '').trim(), email: d.data().email || ''})).sort((a, b) => a.name.localeCompare(b.name));
    /* Emails clubs gave when reserving competition places before they had a Club Hub account (pendingPlaces). Matched by club name. */
    const m = {};
    (pp ? pp.docs : []).forEach(d => { const c = d.data(), k = clubKeyName(c.clubName), e = String(c.email || '').trim(), at = isoOf(c.createdAt);
      if (!k || !e.includes('@')) return;
      if (!m[k] || String(at) > String(m[k].bookedAt || '')) m[k] = {email: e, club: c.clubName, bookedAt: at}; });
    BOOK = m;
  } else ({cal, el} = demoData());
  const ids = [...new Set([...cal.filter(c => c.status !== 'hidden').map(c => c.id), ...Object.keys(el)])];
  COMPS = ids.map(id => buildComp(cal.find(c => c.id === id) || {id, name: el[id] && el[id].title, date: el[id] && el[id].date}, el[id], ENTRIES.filter(e => e.compId === id)));
}
function pickComp(want){
  const today = new Date().toISOString().slice(0, 10), has = c => c.levels.some(L => L.gymnasts.length);
  let k = want; try { if (!k) k = localStorage.getItem('nglmusic:comp'); } catch (_) {}
  let d = COMPS.find(c => c.compKey === k);
  if (!d) d = COMPS.filter(c => c.date >= today && has(c)).sort((a, b) => a.date.localeCompare(b.date))[0] || COMPS.filter(has)[0] || COMPS[0];
  return d;
}
function openComp(d){
  UNSUB.forEach(f => { try { f(); } catch (_) {} }); UNSUB = [];
  if (PL) { Object.values(PL.objUrls || {}).forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} }); }
  try { audio.pause(); } catch (_) {} try { bgStopTimer(); bgAudio.pause(); BG.want = false; } catch (_) {}
  D = d; G = {}; D.levels.forEach(L => L.gymnasts.forEach(([id, name, club, bib]) => G[id] = {id, name, club, bib: bib || '', level: L.id}));
  EV = null; UP = {}; ORDER = {}; ROT = {}; ABS = {}; INTROS = {};
  NROT = D.floorRotations || 4; FO = D.floorOrder || {};
  SESS = []; D.levels.forEach(L => { const lab = L.session || L.name; let s = SESS.find(x => x.label === lab);
    if (!s) { s = {key: 's' + (SESS.length + 1), label: lab, levels: []}; SESS.push(s); } s.levels.push(L.id); });
  PL = freshPL();
  watch();
}
function onEv(d){
  EV = d || null; ORDER = (EV && EV.order) || {}; ROT = (EV && EV.rot) || {}; INTROS = (EV && EV.intros) || {}; ABS = (EV && EV.absent) || {};
  const dl = $('#muDlInput'); if (!dl.dataset.touched) dl.value = (EV && EV.deadline) || D.deadline || '';
  renderDiff(); render(); renderClubs(); renderPlayer(); renderIntroPanel(); applyElevienOrder();
}
function onUp(list){ UP = {}; list.forEach(u => UP[u.gymnastId] = u); renderDiff(); render(); renderClubs(); renderPlayer(); }
function watch(){
  if (!LIVE) { setTimeout(() => { onEv(clone(DEMO.events[D.compKey]) || null); onUp(Object.values(DEMO.uploads).filter(u => u.compId === D.compKey)); }, 0); return; }
  UNSUB.push(FS.onSnapshot(FS.doc(DB, 'musicEvents', D.compKey), d => onEv(d.exists() ? d.data() : null), e => err(e, 'the competition')));
  UNSUB.push(FS.onSnapshot(FS.query(FS.collection(DB, 'musicUploads'), FS.where('compId', '==', D.compKey)), s => onUp(s.docs.map(d => d.data())), e => err(e, 'uploads')));
}
function err(e, what){ console.error(e); toast(e && e.code === 'permission-denied' ? `The database blocked ${what}. Add the music rules to the Club Hub database.` : `Couldn't load ${what}.`); }

/* what has changed in Elevien since the entries were last published to the Club Hub */
function renderDiff(){
  if (!D) return;
  if (!EV || !EV.gymClub) { $('#muDiffTop').innerHTML = ''; $('#muDiffNote').innerHTML = ''; return; }
  const pubNames = {}; (EV.levels || []).forEach(L => (L.gymnasts || []).forEach(g => pubNames[g.id] = g.name));
  const added = Object.keys(G).filter(id => !(id in EV.gymClub)), gone = Object.keys(EV.gymClub).filter(id => !G[id]);
  const moved = Object.keys(G).filter(id => (id in EV.gymClub) && EV.gymClub[id] !== G[id].club);
  if (!added.length && !gone.length && !moved.length) { $('#muDiffTop').innerHTML = ''; $('#muDiffNote').innerHTML = `<span class="mu-st saved">NGL Club Hub is up to date with Elevien</span>`; return; }
  const list = (ids, f) => ids.slice(0, 6).map(f).join(', ') + (ids.length > 6 ? ` and ${ids.length - 6} more` : '');
  const html = `<div class="mu-note mu-noteb"><b>Changed in Elevien since you last published:</b>
    ${added.length ? ` ${added.length} new (${esc(list(added, id => G[id].name))}).` : ''}
    ${gone.length ? ` ${gone.length} withdrawn (${esc(list(gone, id => pubNames[id] || id))})${gone.some(id => UP[id]) ? ', some already uploaded music' : ''}.` : ''}
    ${moved.length ? ` ${moved.length} changed club.` : ''}
    New gymnasts start in "Not in a rotation yet". <b>Publish again</b> on the Clubs tab so clubs see the change.</div>`;
  $('#muDiffTop').innerHTML = html; $('#muDiffNote').innerHTML = html;
}

/* Emails clubs gave when reserving competition places. Used when a club has no NGL Club Hub account yet. Matched by club name. */
let BOOK = {};
const clubKeyName = n => String(n || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ')
  .split(/\s+/).filter(w => w && !['gymnastics', 'gymnastic', 'gym', 'club', 'the', 'academy', 'of', 'and', 'gc', 'ltd'].includes(w)).join(' ');
const bookingFor = k => BOOK[clubKeyName(D.clubs[k].name)] || null;

/* ---------- sessions and floor rotations ----------
   A session = the levels that compete together (from each level's `session` label).
   Each session has NROT floor rotations. EV.rot[sessionKey][1..NROT] = ordered gymnast ids,
   EV.absent[id] = true. Anyone not placed in a rotation sits in "Not in a rotation yet". */
/* each session can have its own number of floor rotations (set when the Elevien programme is loaded) */
const nrotOf = s => (s && EV && EV.nrot && +EV.nrot[s.key]) || NROT;
const sessName = s => s.label.split(' (')[0];
const sessDesc = s => s.levels.map(id => D.levels.find(L => L.id === id).name).join(' & ');
const sessOf = id => SESS.find(s => s.levels.includes(G[id].level));
const sessIds = s => s.levels.flatMap(lid => orderFor(D.levels.find(L => L.id === lid)));
function rotOf(s){
  const all = sessIds(s), raw = ROT[s.key] || {}, used = new Set(), out = {};
  for (let r = 1; r <= nrotOf(s); r++) { out[r] = (raw[r] || []).filter(id => all.includes(id) && !used.has(id)); out[r].forEach(id => used.add(id)); }
  out.u = all.filter(id => !used.has(id)); return out;
}
const rotName = r => r === 'u' ? 'Not in a rotation yet' : 'Rotation ' + r;
async function saveRot(s, o){
  if (!EV) { toast('Publish the entries to the NGL Club Hub first (Clubs tab).'); return; }
  const clean = {}; for (let r = 1; r <= nrotOf(s); r++) clean[r] = o[r];
  ROT[s.key] = clean; render(); renderPlayer(); $('#muSaveState').textContent = 'Saving…';
  try { await evSet({rot: {[s.key]: clean}}); $('#muSaveState').textContent = 'Saved'; }
  catch (e) { err(e, 'the running order'); $('#muSaveState').textContent = 'Not saved'; }
}
function moveTo(id, r, beforeId, after){
  const s = sessOf(id), o = rotOf(s);
  for (let k = 1; k <= nrotOf(s); k++) o[k] = o[k].filter(x => x !== id);
  if (r !== 'u') { const arr = o[r]; let i = beforeId ? arr.indexOf(beforeId) : -1; if (i > -1 && after) i++; if (i < 0) arr.push(id); else arr.splice(i, 0, id); }
  saveRot(s, o);
}
async function setAbsent(id, on){
  if (!EV) { toast('Publish the entries to the NGL Club Hub first (Clubs tab).'); return; }
  ABS[id] = on; render(); renderPlayer();
  try { await evSet({absent: {[id]: on}}); } catch (e) { err(e, 'the absence'); }
}
const rotSelect = (id, cur) => `<select data-rot="${id}" aria-label="Rotation for ${esc(G[id].name)}" class="mu-rsel">
  <option value="u"${cur === 'u' ? ' selected' : ''}>No rotation</option>${Array.from({length: nrotOf(sessOf(id))}, (_, i) => `<option value="${i + 1}"${String(cur) === String(i + 1) ? ' selected' : ''}>Rotation ${i + 1}</option>`).join('')}</select>`;
const upLabel = id => `<label class="btn sm ghost mu-uplbl">${UP[id] ? 'Replace' : 'Upload'}<input type="file" accept=".mp3,audio/mpeg" data-aup="${id}" hidden></label>`;

/* ---------- running order ---------- */
function render(){
  if (!D) return;
  if (!Object.keys(G).length) {   // no entries yet
    $('#muTally').innerHTML = '';
    $('#muLevels').innerHTML = `<div class="card mu-panel"><h3>No entries yet</h3><p>Elevien has no gymnasts entered for ${esc(D.title)} yet. Once entries are in, ask Claude to update the competitions from Elevien.</p></div>`;
    return; }
  const all = Object.keys(G).length, have = Object.keys(UP).filter(id => G[id]).length;
  $('#muTally').innerHTML = `<div><b>${have}/${all}</b><span>Music uploaded</span></div>` +
    D.levels.map(L => { const n = L.gymnasts.filter(g => UP[g[0]]).length; return `<div style="border-left-color:${n === L.gymnasts.length ? 'var(--ok)' : 'var(--red)'}"><b>${n}/${L.gymnasts.length}</b><span>${esc(L.name)}</span></div>`; }).join('') +
    `<div style="border-left-color:${EV && EV.status === 'open' ? 'var(--ok)' : 'var(--red)'}"><b>${EV ? (EV.status === 'open' ? 'Open' : 'Closed') : 'Not published'}</b><span>NGL Club Hub uploads</span></div>`;
  $('#muLevels').innerHTML = SESS.map(s => {
    const o = rotOf(s), ids = sessIds(s), n = ids.filter(id => UP[id]).length;
    const blocks = (o.u.length ? [['u', o.u]] : []).concat(Array.from({length: nrotOf(s)}, (_, i) => [i + 1, o[i + 1]]));
    return `<section class="mu-lv"><header class="mu-lvh"><h2>${esc(sessName(s))} session<small class="${n < ids.length ? 'gap' : ''}">${esc(sessDesc(s))} · ${n}/${ids.length} music uploaded</small><small style="display:block">${foLine(s)}</small></h2></header>
      ${o.u.length ? `<div class="mu-note">${o.u.length} gymnast${o.u.length > 1 ? "s aren't" : " isn't"} in a floor rotation yet. Use <b>Paste floor order</b> on each rotation, choose a rotation for each gymnast, or drag them into place.</div>` : ''}` +
      blocks.map(([r, list]) => { const up = list.filter(id => UP[id]).length, ab = list.filter(id => ABS[id]).length;
        return `<div class="mu-rot" data-s="${s.key}" data-r="${r}">
          <div class="mu-rh"><b>${rotName(r)}</b><small>${list.length} gymnast${list.length === 1 ? '' : 's'} · ${up} with music${ab ? ` · ${ab} absent` : ''}</small>
            ${r !== 'u' ? `<span class="mu-rhb"><button class="btn sm ghost" data-act="mu-paste" data-sr="${s.key}|${r}">Paste floor order</button><button class="btn sm" data-act="mu-zip" data-sr="${s.key}|${r}">Download</button></span>` : ''}</div>
          <div class="mu-tablewrap"><table class="mu-tbl"><tbody>` +
          (list.length ? list.map((id, i) => { const g = G[id], u = UP[id];
            return `<tr class="${u ? 'mu-ok' : ''} ${ABS[id] ? 'mu-abs' : ''}" draggable="true" data-id="${id}">
              <td class="mu-grip" title="Drag to move">&#10303;</td><td class="mu-n">${r === 'u' ? '–' : i + 1}</td>
              <td><span class="mu-fl"></span>${bibTag(id)}<span class="mu-who">${esc(g.name)}</span> <span class="mu-lvb">${esc(g.level)}</span>${ABS[id] ? ' <span class="mu-st none">Absent</span>' : ''}<br><span class="mu-club">${esc(clubName(g.club))}</span></td>
              <td>${u ? `<audio controls preload="none" src="${esc(u.url)}"></audio>` : `<span class="mu-club" style="color:var(--red)">Not uploaded</span>`}${upLabel(id)}<button class="btn sm ghost mu-introbtn" data-act="mu-intro" data-id="${id}" title="${INTROS[id] ? 'Introduction made' : 'No introduction yet'}">Intro${INTROS[id] ? ' ✓' : ''}</button>${u && u.uploadedBy === 'admin' ? `<span class="mu-club"> · added by NGL</span>` : ''}</td>
              <td style="white-space:nowrap"><label class="mu-club"><input type="checkbox" data-abs="${id}" ${ABS[id] ? 'checked' : ''}> Absent</label></td>
              <td>${rotSelect(id, r)}</td>
              <td class="mu-mv">${r !== 'u' ? `<button class="btn sm ghost" data-act="mu-mv" data-mv="${id}|-1" aria-label="Move up">&uarr;</button> <button class="btn sm ghost" data-act="mu-mv" data-mv="${id}|1" aria-label="Move down">&darr;</button>` : ''}</td></tr>`;
          }).join('') : `<tr class="mu-empty"><td colspan="7">Empty. Drag gymnasts here, or paste the floor order.</td></tr>`) +
          `</tbody></table></div></div>`; }).join('') + `</section>`;
  }).join('');
}
function moveRow(b){
  const [id, d] = b.dataset.mv.split('|'), s = sessOf(id), o = rotOf(s);
  for (let r = 1; r <= nrotOf(s); r++) { const i = o[r].indexOf(id); if (i < 0) continue; const j = i + +d; if (j < 0 || j >= o[r].length) return; [o[r][i], o[r][j]] = [o[r][j], o[r][i]]; saveRot(s, o); return; }
}
/* drag and drop: rows in the running order and in the player queue */
let DRAG = null;
const inRoot = e => e.target && e.target.closest && e.target.closest('#muRoot');
document.addEventListener('dragstart', e => { if (!inRoot(e)) return; const tr = e.target.closest('[data-id][draggable]'); if (!tr) return; DRAG = tr.dataset.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', DRAG); } catch (_) {} tr.classList.add('mu-dragging'); });
document.addEventListener('dragend', () => { if (!DRAG && !document.querySelector('#muRoot .mu-dragging')) return; DRAG = null; document.querySelectorAll('#muRoot .mu-dragging,#muRoot .mu-dropb,#muRoot .mu-dropa,#muRoot .mu-dropz').forEach(x => x.classList.remove('mu-dragging', 'mu-dropb', 'mu-dropa', 'mu-dropz')); });
function dropTarget(e){
  if (!inRoot(e)) return null;
  const zone = e.target.closest('[data-r]'); if (!zone || !DRAG) return null;
  const row = e.target.closest('[data-id]'), s = SESS.find(x => x.key === zone.dataset.s);
  if (!s || sessOf(DRAG) !== s) return {bad: true};
  let after = false; if (row) { const rc = row.getBoundingClientRect(); after = e.clientY > rc.top + rc.height / 2; }
  return {zone, row, s, r: zone.dataset.r === 'u' ? 'u' : +zone.dataset.r, after};
}
document.addEventListener('dragover', e => { const t = dropTarget(e); if (!t || t.bad) return; e.preventDefault();
  document.querySelectorAll('#muRoot .mu-dropb,#muRoot .mu-dropa,#muRoot .mu-dropz').forEach(x => x.classList.remove('mu-dropb', 'mu-dropa', 'mu-dropz'));
  if (t.row && t.row.dataset.id !== DRAG) t.row.classList.add(t.after ? 'mu-dropa' : 'mu-dropb'); else if (!t.row) t.zone.classList.add('mu-dropz'); });
document.addEventListener('drop', e => { const t = dropTarget(e); if (!t) return; e.preventDefault();
  if (t.bad) { toast('Gymnasts can only move within their own session.'); return; }
  const before = t.row && t.row.dataset.id !== DRAG ? t.row.dataset.id : null;
  if (t.row && !before) return;
  moveTo(DRAG, t.r, before, t.after); });

/* paste a rotation's floor order: names matched loosely within the session */
const key = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
function pasteDlg(s, r){
  openDlg(`${sessName(s)} session · Rotation ${r}: floor order`, `<p class="mu-dlgp">Copy the floor start list for this rotation from Elevien and paste it here, one gymnast per line. Club names, numbers and other text on each line are ignored. This replaces Rotation ${r}; anyone already in it who isn't in your list goes back to "Not in a rotation yet".</p><textarea id="muPasteBox" class="mu-ta" aria-label="Floor order"></textarea><div id="muPasteRes" style="font-size:13px;margin-top:8px"></div>`,
    [{l: 'Cancel'}, {l: 'Apply order', cls: 'primary', fn: () => {
      const lines = $('#muPasteBox').value.split(/\n/).map(x => x.trim()).filter(Boolean);
      const pool = sessIds(s).map(id => ({id, k: key(G[id].name)})), used = new Set(), out = [], miss = [];
      lines.forEach(line => { const lk = key(line); const m = pool.filter(p => !used.has(p.id) && lk.includes(p.k)).sort((a, b) => b.k.length - a.k.length)[0];
        if (m) { used.add(m.id); out.push(m.id); } else if (/[a-z]{3,}/i.test(line)) miss.push(line); });
      if (!out.length) { $('#muPasteRes').innerHTML = `<span style="color:var(--red)">No names matched gymnasts in the ${esc(sessName(s))} session.</span>`; return false; }
      const o = rotOf(s); for (let k = 1; k <= nrotOf(s); k++) if (k !== r) o[k] = o[k].filter(id => !used.has(id));
      o[r] = out; saveRot(s, o);
      toast(`${out.length} placed in Rotation ${r}` + (miss.length ? `; ${miss.length} line${miss.length > 1 ? 's' : ''} didn't match: ${miss.slice(0, 3).join(', ')}${miss.length > 3 ? '…' : ''}` : ''));
    }}]);
}

/* ---------- running order from the Elevien floor schedule ----------
   The Elevien import puts each session's floor order into D.floorOrder[session label] = {at, rotations}.
   The first time this page sees a new "at" for a session, it replaces that session's floor rotations with it.
   Changes made here afterwards (drag, move) stay until the next Elevien update. */
let foBusy = false;
async function applyElevienOrder(){
  if (!EV || foBusy) return; foBusy = true;
  const done = [];
  try {
    for (const s of SESS) { const f = FO[s.label]; if (!f || !f.rotations) continue;
      if ((EV.floorOrderAt || {})[s.key] === f.at) continue;
      const ids = new Set(sessIds(s)), clean = {};
      f.rotations.forEach((r, i) => clean[i + 1] = r.filter(id => ids.has(id)));
      EV.floorOrderAt = {...(EV.floorOrderAt || {}), [s.key]: f.at};
      await evSet({rot: {[s.key]: clean}, nrot: {[s.key]: f.rotations.length}, floorOrderAt: {[s.key]: f.at}});
      done.push(sessName(s));
    }
  } catch (e) { err(e, 'the running order'); }
  foBusy = false;
  if (done.length) toast(`Running order updated from the Elevien floor schedule: ${done.join(' and ')} session${done.length > 1 ? 's' : ''}.`);
}
const foLine = s => { const f = FO[s.label]; return f ? `Floor order from the Elevien schedule, ${esc(new Date(f.at).toLocaleString('en-GB', {dateStyle: 'medium', timeStyle: 'short'}))}` : 'No Elevien floor schedule yet: ask Claude to update from Elevien once the schedule is set'; };

/* ---------- gymnast introductions (ElevenLabs) ----------
   Each intro is made once with the NGL ElevenLabs account and stored next to the music:
   Storage music/<comp>/admin/intro-<id>.mp3, and musicEvents.intros[id] = {url, path, text, voice, at}.
   The ElevenLabs key stays on this laptop only (localStorage), typed in by Dave. */
const EL = (() => { try { return Object.assign({key: '', voice: '', tpl: 'On the floor, from {club}, {name}.'}, JSON.parse(localStorage.getItem('nglmusic:elevenlabs') || '{}')); } catch (_) { return {key: '', voice: '', tpl: 'On the floor, from {club}, {name}.'}; } })();
const elSave = () => { try { localStorage.setItem('nglmusic:elevenlabs', JSON.stringify(EL)); } catch (_) {} };
const introsOn = () => { try { return localStorage.getItem('nglmusic:introsOn') !== '0'; } catch (_) { return true; } };
const sayClub = n => String(n || '').replace(/\s+(Ltd|Limited|C\.?I\.?C\.?)\.?$/i, '').replace(/\s*&\s*/g, ' and ').trim();
const introText = id => { const g = G[id]; return (INTROS[id] && INTROS[id].custom) || EL.tpl.replace(/\{club\}/g, sayClub(clubName(g.club))).replace(/\{name\}/g, g.name); };
const IK = id => 'intro:' + id;
/* ElevenLabs' own ready-made voices: used when the key isn't allowed to list voices */
const EL_DEFAULT = [['JBFqnCBsd6RMkjVDRZzb', 'George · British · male'], ['onwK4e9ZLuTAKqWW03F9', 'Daniel · British · male'], ['Xb7hH8MSUJpSbSDYk0k2', 'Alice · British · female'], ['pFZP5JQG7iQjIQuC4Bku', 'Lily · British · female'], ['XB0fDUnXU5powFXDhCwa', 'Charlotte · female'], ['nPczCjzI2devNBz1zQrb', 'Brian · American · male']];
const elMsg = async r => { try { const j = await r.json(); const d = j.detail || j; return (typeof d === 'string' ? d : (d.message || d.status || '')) || ('error ' + r.status); } catch (_) { return 'error ' + r.status; } };
async function elVoices(){
  const r = await fetch('https://api.elevenlabs.io/v1/voices', {headers: {'xi-api-key': EL.key}});
  if (!r.ok) { const m = await elMsg(r); const e = new Error(m); e.status = r.status; throw e; }
  return (await r.json()).voices || [];
}
async function elSpeak(text){
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(EL.voice)}?output_format=mp3_44100_128`, {method: 'POST',
    headers: {'xi-api-key': EL.key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
    body: JSON.stringify({text, model_id: 'eleven_multilingual_v2', voice_settings: {stability: 0.55, similarity_boost: 0.75}})});
  if (r.status === 429) throw new Error('busy');
  if (!r.ok) { const m = await elMsg(r); throw new Error(/invalid api key|invalid_api_key/i.test(m) ? 'key' : m); }
  return new Blob([await r.arrayBuffer()], {type: 'audio/mpeg'});
}
async function makeIntro(id, custom){
  const text = custom || introText(id), blob = await elSpeak(text);
  const path = `music/${D.compKey}/admin/intro-${id}.mp3`;
  const url = await putFile(path, blob, {contentType: 'audio/mpeg', customMetadata: {gymnast: G[id].name, kind: 'intro'}});
  const rec = {url, path, text, voice: EL.voice, at: new Date().toISOString()};
  if (custom) rec.custom = custom; else if (INTROS[id] && INTROS[id].custom && INTROS[id].custom === text) rec.custom = text;
  await evSet({intros: {[id]: rec}});
  INTROS[id] = rec;
  try { const c = {k: TK(IK(id)), id: IK(id), url, blob, savedAt: Date.now()}; await PDB.put('tracks', c); PL.cache[IK(id)] = c; if (PL.objUrls[IK(id)]) { URL.revokeObjectURL(PL.objUrls[IK(id)]); delete PL.objUrls[IK(id)]; } } catch (_) {}
  return rec;
}
/* gymnasts placed in a floor rotation (not withdrawn or unplaced ones), in running order */
const allIds = () => SESS.flatMap(s => { const o = rotOf(s); return Array.from({length: nrotOf(s)}, (_, i) => o[i + 1]).flat(); });
const introNeeded = id => !INTROS[id] || INTROS[id].text !== introText(id);
function renderIntroPanel(){
  if (!D || !onScreen()) return;
  const ids = allIds(), have = ids.filter(id => INTROS[id]).length, todo = ids.filter(introNeeded).length;
  $('#muIntroState').innerHTML = `<b>${have} of ${ids.length}</b> gymnasts have an introduction.` + (todo ? ` ${todo} to make.` : ` <span style="color:var(--ok)">All done.</span>`);
  $('#muElKeyRow').classList.toggle('mu-hidden', !!EL.key); $('#muElSetRow').classList.toggle('mu-hidden', !EL.key);
  $('#muIntroOn').checked = introsOn();
  $('#muIntroGo').disabled = !EL.key || !EL.voice || !todo || !!PL.introBusy;
}
async function fillVoices(){
  const sel = $('#muElVoice'); sel.innerHTML = `<option value="">Loading voices…</option>`;
  $('#muIntroMsg').textContent = '';
  try { const vs = await elVoices();
    sel.innerHTML = vs.map(v => `<option value="${esc(v.voice_id)}">${esc(v.name)}${v.labels && v.labels.accent ? ` · ${esc(v.labels.accent)}` : ''}${v.labels && v.labels.gender ? ` · ${esc(v.labels.gender)}` : ''}</option>`).join('');
    if (EL.voice && vs.some(v => v.voice_id === EL.voice)) sel.value = EL.voice; else { EL.voice = sel.value; elSave(); }
  } catch (e) {
    if (/invalid api key|invalid_api_key/i.test(e.message)) { sel.innerHTML = `<option value="">Key not accepted</option>`; $('#muIntroMsg').textContent = "ElevenLabs says this API key isn't valid. Remove it, copy the key again and add it."; }
    else if (e.status) { /* key works but can't list voices (no Voices permission): offer ElevenLabs' ready-made voices */
      sel.innerHTML = EL_DEFAULT.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('');
      if (EL.voice && EL_DEFAULT.some(v => v[0] === EL.voice)) sel.value = EL.voice; else { EL.voice = sel.value; elSave(); }
      $('#muIntroMsg').textContent = `ElevenLabs wouldn't list your voices (${e.message}), so these are its ready-made voices. To see your own, give the key the Voices permission.`; }
    else { sel.innerHTML = `<option value="">Couldn't reach ElevenLabs</option>`; $('#muIntroMsg').textContent = "Couldn't reach ElevenLabs. Check the internet connection, then remove and add the key again."; }
  }
  renderIntroPanel();
}
async function introSample(){
  if (!EL.key || !EL.voice) return;
  const id = allIds()[0]; if (!id) return;
  try { const b = await elSpeak(introText(id)); const u = URL.createObjectURL(b); const a = new Audio(u); a.onended = () => URL.revokeObjectURL(u); a.play(); }
  catch (e) { $('#muIntroMsg').textContent = e.message === 'key' ? "ElevenLabs says this API key isn't valid." : `ElevenLabs said: ${e.message}`; }
}
async function generateIntros(){
  const ids = allIds().filter(introNeeded); if (!ids.length) return;
  PL.introBusy = true; renderIntroPanel(); let ok = 0, failed = 0;
  for (let i = 0; i < ids.length; i++) {
    $('#muIntroGo').textContent = `Making ${i + 1} of ${ids.length}…`; $('#muIntroBar').style.width = (i / ids.length * 100) + '%';
    try { await makeIntro(ids[i]); ok++; }
    catch (e) { console.warn(ids[i], e); failed++;
      if (e.message === 'key') { toast("ElevenLabs didn't accept the API key."); break; }
      if (/quota|credit/i.test(e.message)) { toast('ElevenLabs says the account is out of credits.'); break; }
      $('#muIntroMsg').textContent = `ElevenLabs said: ${e.message}`; if (failed >= 3 && !ok) break;
      if (e.message === 'busy') { await new Promise(r => setTimeout(r, 3000)); i--; failed--; continue; } }
  }
  PL.introBusy = false; $('#muIntroGo').textContent = 'Make introductions'; $('#muIntroBar').style.width = '100%';
  renderIntroPanel(); render(); renderPlayer();
  toast(`${ok} introduction${ok === 1 ? '' : 's'} made` + (failed ? `, ${failed} failed: press Make introductions again` : '') + '.');
}
function introDlg(id){
  const g = G[id], cur = INTROS[id];
  openDlg(`Introduction · ${g.name}`, `<p class="mu-dlgp">Change the spelling to fix how a name is said (for example "Roz-kov-ska"). Only the sound changes; the name on screen stays the same.</p>
    <input id="muIntroTxt" class="mu-in" aria-label="Introduction wording" value="${esc(cur && cur.custom || introText(id))}">
    ${cur ? `<audio controls src="${esc(cur.url)}" style="width:100%;margin-top:10px"></audio>` : `<p style="margin:10px 0 0;font-size:14px">No introduction made yet.</p>`}
    <p id="muIntroRes" style="margin:8px 0 0;font-size:14px"></p>`,
    [{l: 'Close'}, {l: cur ? 'Make again' : 'Make it', cls: 'primary', fn: () => {
      if (!EL.key || !EL.voice) { $('#muIntroRes').textContent = 'Add the ElevenLabs key and choose a voice on the Play tab first.'; return false; }
      const t = $('#muIntroTxt').value.trim(); if (!t) return false;
      $('#muIntroRes').textContent = 'Making it…';
      makeIntro(id, t === introText(id) && !(cur && cur.custom) ? null : t).then(() => { toast(`Introduction made for ${g.name}.`); render(); renderPlayer(); renderIntroPanel(); })
        .catch(e => toast(e.message === 'key' ? "ElevenLabs didn't accept the API key." : `Couldn't make it: ${e.message}`));
    }}]);
}
function introSrc(id){
  const c = PL.cache[IK(id)], u = INTROS[id]; if (!u) return null;
  if (c && c.url === u.url) { if (!PL.objUrls[IK(id)]) PL.objUrls[IK(id)] = URL.createObjectURL(c.blob); return PL.objUrls[IK(id)]; }
  return u.url;
}
async function saveIntros(){
  const ids = allIds().filter(id => INTROS[id] && !(PL.cache[IK(id)] && PL.cache[IK(id)].url === INTROS[id].url)); let n = 0;
  for (const id of ids) { try { const r = await fetch(INTROS[id].url); if (!r.ok) continue; const blob = await r.blob();
    const c = {k: TK(IK(id)), id: IK(id), url: INTROS[id].url, blob, savedAt: Date.now()}; await PDB.put('tracks', c); PL.cache[IK(id)] = c; n++; } catch (_) {} }
  return n;
}

/* ---------- NGL admin uploads a track for a gymnast (e.g. a club emailed it) ----------
   Same Storage path and musicUploads record the NGL Club Hub uses, so the club sees it as done. */
const ADMIN_MAX_MB = 15;
async function adminUpload(inp){
  const id = inp.dataset.aup, f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
  const g = G[id];
  if (!/\.mp3$/i.test(f.name) && f.type !== 'audio/mpeg') { toast('Please choose an MP3 file.'); return; }
  if (f.size > ADMIN_MAX_MB * 1048576) { toast(`That file is over ${ADMIN_MAX_MB}MB. Please export a smaller MP3.`); return; }
  if (!EV) { toast('Publish the entries to the NGL Club Hub first (Clubs tab).'); return; }
  if (UP[id] && !confirm(`Replace the music for ${g.name}? The current file will be overwritten.`)) return;
  if (PL.playing && PL.playing.id === id) { toast('That music is playing. Fade it out first.'); return; }
  const m = accountFor(g.club), owner = m.a ? m.a.uid : 'admin';
  const path = `music/${D.compKey}/${owner}/${id}.mp3`;
  $('#muSaveState').textContent = `Uploading ${g.name}…`; toast(`Uploading music for ${g.name}…`);
  try {
    const url = await putFile(path, f, {contentType: 'audio/mpeg', customMetadata: {club: clubName(g.club), gymnast: g.name, by: 'NGL admin'}},
      sn => { $('#muSaveState').textContent = `Uploading ${g.name}… ${Math.round(sn.bytesTransferred / sn.totalBytes * 100)}%`; });
    const rec = {compId: D.compKey, gymnastId: id, gymnastName: g.name, level: g.level,
      clubKey: g.club, clubName: m.a ? m.a.name : clubName(g.club), clubId: owner, fileName: f.name, size: f.size, path, url,
      uploadedBy: 'admin', adminEmail: ME.email || ''};
    if (LIVE) await FS.setDoc(FS.doc(DB, 'musicUploads', `${D.compKey}_${id}`), {...rec, uploadedAt: FS.serverTimestamp()});
    else { DEMO.uploads[`${D.compKey}_${id}`] = rec; setTimeout(() => onUp(Object.values(DEMO.uploads).filter(u => u.compId === D.compKey)), 0); }
    // keep the player's saved copy in step straight away, so it works offline too
    try { const meas = await measure(f); const r2 = {k: TK(id), id, url, fileName: f.name, blob: f, savedAt: Date.now(), ...meas};
      await PDB.put('tracks', r2); PL.cache[id] = r2; if (PL.objUrls[id]) { URL.revokeObjectURL(PL.objUrls[id]); delete PL.objUrls[id]; } } catch (_) {}
    $('#muSaveState').textContent = 'Saved'; toast(`Music added for ${g.name}.`); renderPlayer();
  } catch (er) {
    console.error(er); $('#muSaveState').textContent = 'Not saved';
    toast(/unauthori[sz]ed|permission/i.test(er.code || er.message || '') ? 'Admin uploads are blocked by the database rules.' : 'The upload failed. Check the connection and try again.');
  }
}

/* ---------- zip download (one rotation, in floor order) ---------- */
const safe = s => s.replace(/[\\/:*?"<>|]/g, '').trim();
async function blobFor(id){ const c = PL.cache[id], u = UP[id]; if (c && u && c.url === u.url && !c.bad) return c.blob; const r = await fetch(u.url); if (!r.ok) throw 0; return r.blob(); }
function saveBlob(blob, name){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
async function downloadZip(s, r){
  const ids = rotOf(s)[r], missing = ids.filter(id => !UP[id]);
  if (!ids.length) { toast('This rotation is empty.'); return; }
  if (missing.length && !confirm(`${missing.length} gymnast${missing.length > 1 ? 's have' : ' has'} no music yet. Download the rest anyway? Missing gymnasts keep their number so the order stays right.`)) return;
  let JSZip; try { JSZip = await loadZip(); } catch (_) { toast("The zip tool couldn't load. Check the connection."); return; }
  const zip = new JSZip();
  toast('Preparing the zip…'); let failed = 0;
  for (let i = 0; i < ids.length; i++) { const id = ids[i]; if (!UP[id]) continue;
    try { zip.file(`${String(i + 1).padStart(2, '0')} - ${safe(G[id].name)} - ${safe(clubName(G[id].club))}${ABS[id] ? ' (ABSENT)' : ''}.mp3`, await blobFor(id)); } catch (_) { failed++; } }
  zip.file('Running order.txt', ids.map((id, i) => `${String(i + 1).padStart(2, '0')}  ${G[id].name}  (${clubName(G[id].club)})${UP[id] ? '' : '  NO MUSIC'}${ABS[id] ? '  ABSENT' : ''}`).join('\r\n'));
  if (failed && failed === ids.length - missing.length) { toast("The browser couldn't fetch the files. The storage bucket needs its CORS setting."); return; }
  const blob = await zip.generateAsync({type: 'blob'});
  saveBlob(blob, `${D.title} - ${sessName(s)} rotation ${r} floor music.zip`);
  if (failed) toast(`${failed} file${failed > 1 ? 's' : ''} couldn't be downloaded.`);
}

/* ---------- publish + clubs ---------- */
async function publish(){
  const doc = {title: D.title, date: D.date, deadline: deadline(), status: 'open',
    clubs: Object.fromEntries(Object.entries(D.clubs).map(([k, c]) => [k, {name: c.name, bg: c.bg || ''}])),
    levels: D.levels.map(L => ({id: L.id, name: L.name, session: L.session || '', gymnasts: L.gymnasts.map(([id, name, club]) => ({id, name, club}))})),
    gymClub: Object.fromEntries(Object.values(G).map(g => [g.id, g.club])),   // lets the database rules check each upload
    publishedAt: new Date().toISOString()};
  try {
    await evSet(doc);
    // What each club's Floor music screen reads: one entry per club with a Club Hub account
    const done = new Set();
    for (const k of Object.keys(D.clubs)) { const m = accountFor(k); if (!m.a) continue; const mine = Object.values(G).filter(g => g.club === k); if (!mine.length) continue;
      const id = `${D.compKey}_${m.a.uid}`; done.add(id);
      await entrySet(id, {compId: D.compKey, clubId: m.a.uid, clubName: m.a.name || D.clubs[k].name, title: D.title, date: D.date, deadline: doc.deadline,
        gymnasts: mine.map(g => ({id: g.id, n: g.name, level: g.level})), status: 'open'}); }
    for (const e of ENTRIES.filter(x => x.compId === D.compKey && !done.has(`${D.compKey}_${x.clubId}`))) await entrySet(`${D.compKey}_${e.clubId}`, {status: 'closed', gymnasts: []});
    toast('Published. Clubs will see a Floor music tab in the NGL Club Hub.');
  } catch (e) { err(e, 'publishing'); }
}
async function closeUploads(){
  if (!EV) return toast('Nothing published yet.');
  const open = EV.status !== 'open';
  if (!open && !confirm('Close uploads? Clubs will no longer see the Floor music tab. Music already uploaded is kept.')) return;
  try { await evSet({status: open ? 'open' : 'closed'});
    for (const k of Object.keys(D.clubs)) { const m = accountFor(k); if (m.a) await entrySet(`${D.compKey}_${m.a.uid}`, {status: open ? 'open' : 'closed'}); }
    toast(open ? 'Uploads reopened' : 'Uploads closed'); }
  catch (e) { err(e, 'changing the status'); }
}
function accountFor(k){
  const link = EV && EV.links && EV.links[k];
  if (link) return {a: ACCOUNTS.find(x => x.uid === link), how: 'linked'};
  const c = D.clubs[k] || {};
  if (c.uid) return {a: ACCOUNTS.find(x => x.uid === c.uid) || {uid: c.uid, name: c.name, bg: c.bg || '', email: ''}, how: 'bg'};   // entered for this club in the Club Hub
  const bg = String(c.bg || '').replace(/^BG/i, '').trim(), a = bg && ACCOUNTS.find(x => x.bg === bg);
  return a ? {a, how: 'bg'} : {a: null};
}
function renderClubs(){
  if (!D) return;
  $('#muCloseBtn').textContent = EV && EV.status !== 'open' ? 'Reopen uploads' : 'Close uploads';
  $('#muPubState').textContent = EV ? `Published${EV.publishedAt ? ' ' + new Date(EV.publishedAt).toLocaleString('en-GB') : ''}. Uploads are ${EV.status === 'open' ? 'open' : 'closed'}. Publish again after any entry changes.` : "Not published yet. Clubs upload in the NGL Club Hub's Floor music tab once you publish.";
  $('#muClubList').innerHTML = Object.entries(D.clubs).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, c]) => {
    const mine = Object.values(G).filter(g => g.club === k), done = mine.filter(g => UP[g.id]).length, m = accountFor(k);
    return `<div class="mu-crow"><div><span class="c">${esc(c.name)}</span> <span class="m">BG ${esc(c.bg || '?')}</span><br>
        <span class="m ${done < mine.length ? 'gap' : ''}">${done}/${mine.length} uploaded</span> ·
        ${m.a ? `<span class="m" style="color:var(--ok)">NGL Club Hub: ${esc(m.a.name)}${m.how === 'linked' ? ' (linked by hand)' : ''}</span>` : `<span class="m gap">No matching NGL Club Hub account</span>${bookingFor(k) ? `<br><span class="m">Reservation email: ${esc(bookingFor(k).email)}</span>` : ''}`}</div>
      <div><select data-link="${esc(k)}" aria-label="Link ${esc(c.name)} to an NGL Club Hub account" class="mu-sel">
        <option value="">${m.a ? 'Change link…' : 'Link to account…'}</option>${ACCOUNTS.map(a => `<option value="${esc(a.uid)}">${esc(a.name)}${a.bg ? ' (' + esc(a.bg) + ')' : ''}</option>`).join('')}</select></div>
      <div class="mu-crowb"><button class="btn sm ${done < mine.length ? '' : 'ghost'}" data-act="mu-email" data-k="${esc(k)}" data-how="send" title="${m.a && m.a.email ? 'Opens an email to ' + esc(m.a.email) : bookingFor(k) ? 'Opens an email to their reservation address, ' + esc(bookingFor(k).email) : 'No email address on file, so add it yourself'}">Send email</button><button class="btn sm ghost" data-act="mu-email" data-k="${esc(k)}" data-how="copy">Copy</button></div></div>`;
  }).join('');
}
async function linkClub(sel){
  const k = sel.dataset.link, uid = sel.value; if (!k || !uid) return;
  if (!EV) { toast('Publish the entries first.'); sel.value = ''; return; }
  try { await evSet({links: {[k]: uid}}); toast('Club linked'); }
  catch (er) { err(er, 'linking the club'); }
}
async function emailClub(b){
  const k = b.dataset.k;
  const mine = Object.values(G).filter(g => g.club === k), miss = mine.filter(g => !UP[g.id]), m = accountFor(k);
  const text = `Hi,\n\nPlease upload floor music for your gymnasts competing at ${D.title} by ${deadline()}.\n\n` +
    (m.a ? `Log in to the NGL Club Hub and open the Floor music tab:\n${CLUB_HUB}\n${m.a.email ? `Your login is this email address: ${m.a.email}\n` : ''}\n` : `Register your club (free) or log in to the NGL Club Hub, then open the Floor music tab:\n${CLUB_HUB}\n${bookingFor(k) ? `Please register with this email address: ${bookingFor(k).email} (the one you used to reserve your places).\n` : ''}Use your British Gymnastics club number ${D.clubs[k].bg || ''} when you register so your gymnasts appear.\n\n`) +
    (miss.length ? `Still needed:\n${miss.map(g => `- ${g.name} (Level ${g.level})`).join('\n')}\n\n` : `All your music is in, thank you.\n\n`) +
    `MP3 files only, up to 15MB each.\n\nThanks,\nNational Gymnastics League`;
  if (b.dataset.how === 'send') {
    const to = (m.a && m.a.email) || (bookingFor(k) || {}).email || '';
    location.href = `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent('NGL Music Upload')}&body=${encodeURIComponent(text)}`;
    if (!to) toast('No email address on file for this club, so add it yourself.');
    return;
  }
  try { await navigator.clipboard.writeText(text); toast('Email copied. Paste it into a new message.'); }
  catch (_) { openDlg('Email to club', `<textarea class="mu-ta" aria-label="Email">${esc(text)}</textarea>`, [{l: 'Close', cls: 'primary'}]); }
}

/* ---------- Play tab: offline competition player ----------
   Music is saved into this browser's IndexedDB (per laptop) so it plays without internet.
   A saved copy is reused only while its Storage URL matches the upload record, so a
   replaced file is fetched again. Levels are matched down (never boosted).
   The queue is one floor rotation of one session, in floor order; absent gymnasts are skipped. */
const PDB = (() => { let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open(LIVE ? 'ngl-music-player-hub' : 'ngl-music-player-demo', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('tracks', {keyPath: 'k'}); d.createObjectStore('ann', {keyPath: 'k'}); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (st, mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(st, mode), o = t.objectStore(st); const out = fn(o); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
  return {get: (st, k) => tx(st, 'readonly', o => o.get(k)), put: (st, v) => tx(st, 'readwrite', o => o.put(v)), del: (st, k) => tx(st, 'readwrite', o => o.delete(k)), all: st => tx(st, 'readonly', o => o.getAll())};
})();
const freshPL = () => ({introed: {}, sess: null, rot: 1, cur: null, played: {}, cache: {}, ann: [], playing: null, fading: false, vol: 1, objUrls: {}, wake: null, ready: false});
let PL = null;
const TK = id => `${D.compKey}:${id}`;
const fmtT = s => !isFinite(s) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const audio = new Audio(); audio.preload = 'auto';
/* Built-in background playlist: its own player, so it can sit underneath and come back where it left off */
const bgAudio = new Audio(); bgAudio.preload = 'auto';
const BG = {list: [], recs: {}, order: [], pos: 0, want: false, fading: false, timer: null, saving: false};
function plSave(){ try { localStorage.setItem('nglplay2:' + D.compKey, JSON.stringify({sess: PL.sess, rot: PL.rot, cur: PL.cur, played: PL.played, vol: PL.vol})); } catch (_) {} }
function plLoad(){ try { const o = JSON.parse(localStorage.getItem('nglplay2:' + D.compKey) || 'null'); if (o) { PL.sess = o.sess; PL.rot = o.rot || 1; PL.cur = o.cur || null; PL.played = o.played || {}; PL.vol = o.vol ?? 1; } } catch (_) {} }
async function plInit(){
  if (PL.ready || !SESS.length) return; PL.ready = true; plLoad();
  const mine = PL;
  if (!SESS.some(s => s.key === PL.sess)) PL.sess = SESS[0].key;
  // Only check the top end once the competition data (rotation counts) has loaded, or a saved Rotation 5/6 resets to 1.
  if (!(PL.rot >= 1) || (EV && PL.rot > nrotOf(SESS.find(s => s.key === PL.sess)))) PL.rot = 1;
  $('#muVol').value = Math.round(PL.vol * 100);
  try { (await PDB.all('tracks')).forEach(t => { if (t.k.startsWith(D.compKey + ':')) mine.cache[t.id] = t; }); } catch (e) { console.warn(e); }
  try { const all = await PDB.all('ann'); mine.ann = all.filter(a => !a.slot && !a.bg).sort((a, b) => a.order - b.order); mine.special = {}; mine.builtinRecs = {};
    all.filter(a => a.slot).forEach(a => { if (a.builtin) mine.builtinRecs[a.slot] = a; else mine.special[a.slot] = a; });
    BG.recs = {}; all.filter(a => a.bg).forEach(a => { BG.recs[a.k] = a; }); } catch (_) { mine.ann = []; mine.special = {}; mine.builtinRecs = {}; }
  if (mine !== PL) return;   // the competition changed meanwhile
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}
  renderPlayer(); renderAnn(); renderSlots();
  ensureBuiltins();   // built-in tracks (Walk On and Rotation Music): shown straight away, saved on this laptop in the background
}
function status(id){
  const u = UP[id], c = PL.cache[id];
  if (!u) return 'none';
  if (c && c.url === u.url) return c.bad ? 'bad' : 'saved';
  return 'online';
}
const ST_TXT = {saved: 'On laptop', online: 'Online only', none: 'No music', bad: 'Check file'};
const curSess = () => SESS.find(s => s.key === PL.sess) || SESS[0];
const queue = () => rotOf(curSess())[PL.rot] || [];
const wantIntro = id => !!(id && introsOn() && INTROS[id] && !PL.introed[id] && !PL.played[id]);
const firstUp = (ids, from = 0) => { for (let i = from; i < ids.length; i++) if (!ABS[ids[i]] && !PL.played[ids[i]]) return ids[i]; for (let i = from; i < ids.length; i++) if (!ABS[ids[i]]) return ids[i]; return null; };
function nextAfter(id){ const ids = queue(), i = ids.indexOf(id); for (let j = i + 1; j < ids.length; j++) if (!ABS[ids[j]]) return ids[j]; return null; }
function renderPlayer(){
  if (!PL || !PL.ready || !SESS.length) return;
  const s = curSess(), ids = queue();
  if (!PL.playing && !ids.includes(PL.cur)) PL.cur = firstUp(ids) || ids[0] || null;
  if (!onScreen()) return;
  $('#muSessChips').innerHTML = SESS.map(x => `<button class="mu-chip" data-act="mu-ps" data-ps="${x.key}" aria-pressed="${x.key === PL.sess}">${esc(sessName(x))} <small>${esc(sessDesc(x))}</small></button>`).join('') +
    `<span style="width:12px"></span>` + Array.from({length: nrotOf(s)}, (_, i) => { const q = rotOf(s)[i + 1], done = q.filter(id => PL.played[id] || ABS[id]).length;
      return `<button class="mu-chip" data-act="mu-pr" data-pr="${i + 1}" aria-pressed="${PL.rot === i + 1}">Rotation ${i + 1} <small>${done}/${q.length}</small></button>`; }).join('');
  const isAnn = PL.playing && (PL.playing.kind === 'ann' || PL.playing.kind === 'sp'), cur = PL.playing && (PL.playing.kind === 'gym' || PL.playing.kind === 'intro') ? PL.playing.id : PL.cur, g = cur && G[cur];
  const pos = cur ? ids.indexOf(cur) : -1;
  let now;
  if (isAnn) now = `<div class="lbl">Now playing${PL.playing.kind === 'sp' ? ' on Spotify' : ''} · ${PL.playing.slot === 'walkon' ? 'walk on and rotation music' : PL.playing.slot === 'awards' ? 'medal ceremony music' : PL.playing.slot === 'closing' ? 'closing out music' : 'announcement'}</div><div class="nm">${esc(PL.playing.name)}</div><div class="cl">&nbsp;</div>`;
  else if (!g) now = `<div class="lbl">${esc(sessName(s))} session · Rotation ${PL.rot}</div><div class="nm">No gymnasts in this rotation</div><div class="cl">Set the floor order on the Running order tab.</div>`;
  else { const stt = status(cur);
    now = `<div class="lbl">${PL.playing ? (PL.playing.kind === 'intro' ? 'Now playing · introduction' : 'Now playing') : (wantIntro(cur) ? 'Ready for introduction' : (PL.introed[cur] && INTROS[cur] ? 'Introduced · Space for music' : 'Ready'))} · ${esc(sessName(s))} · Rotation ${PL.rot} · ${pos + 1} of ${ids.length}</div>
      <div class="nm">${g.bib ? `<span class="mu-bigbib">${esc(g.bib)}</span>` : ''}${esc(g.name)}</div><div class="cl">${esc(clubName(g.club))} · Level ${esc(g.level)} <span class="mu-st ${stt}">${ST_TXT[stt]}</span>${ABS[cur] ? ' <span class="mu-st none">Marked absent</span>' : ''}${PL.cache[cur] && PL.cache[cur].gainDb < -0.5 ? ` <span style="font-size:13px;opacity:.75">level ${PL.cache[cur].gainDb.toFixed(0)} dB</span>` : ''}</div>`; }
  $('#muNow').innerHTML = now + `<div class="row"><div class="mu-pbar" role="slider" aria-label="Position in the music" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="muTBar"></i></div><div class="tm" id="muTTime">0:00</div></div>`;
  const nx = cur ? nextAfter(cur) : null;
  $('#muNextUp').innerHTML = nx ? `<span class="mu-nxl">Next up</span><br>${bibTag(nx)}<b>${esc(G[nx].name)}</b> <span class="mu-club">${esc(clubName(G[nx].club))} · Level ${esc(G[nx].level)}</span> <span class="mu-st ${status(nx)}">${ST_TXT[status(nx)]}</span>`
                            : `<span class="mu-nxl">END OF ROTATION ${PL.rot}${PL.rot < nrotOf(s) ? ` · choose Rotation ${PL.rot + 1} when floor is ready` : ''}</span>`;
  const q = $('#muQueue'); q.dataset.s = s.key; q.dataset.r = PL.rot;
  q.innerHTML = ids.length ? ids.map((id, i) => { const st = status(id);
    return `<div class="mu-qr ${id === cur ? 'cur' : ''} ${PL.played[id] ? 'done' : ''} ${ABS[id] ? 'abs' : ''}" data-id="${id}" draggable="true" data-qid="${id}">
      <span class="mu-grip" title="Drag to move">&#10303;</span><span class="n">${i + 1}</span>
      <span class="qn">${bibTag(id)}<b>${esc(G[id].name)}</b> <span class="mu-club">${esc(clubName(G[id].club))} · ${esc(G[id].level)}</span>${PL.played[id] ? ' <span class="mu-club">· played</span>' : ''}${ABS[id] ? ' <span class="mu-st none">Absent</span>' : ''}</span>
      <span class="mu-st ${st}">${ST_TXT[st]}</span>
      <span class="qc"><button class="btn sm ghost" data-act="mu-qabs" data-id="${id}">${ABS[id] ? 'Present' : 'Absent'}</button>${rotSelect(id, PL.rot)}${upLabel(id)}</span></div>`; }).join('')
    : `<div class="mu-qr mu-qempty">No gymnasts in this rotation yet. Drag them here from another rotation's list, or set the floor order on the Running order tab.</div>`;
  renderDeck();
  $('#muGo').disabled = !!PL.playing;
  $('#muGo').innerHTML = (cur && wantIntro(cur) ? '&#9654; Introduce' : '&#9654; Play music') + '<kbd>Space</kbd>';
  prepState(); tick(); updPause();
}
function prepState(){
  if (!onScreen() || !PL) return;
  const ids = Object.keys(G).filter(id => UP[id]), saved = ids.filter(id => status(id) === 'saved').length, bad = ids.filter(id => status(id) === 'bad').length;
  const all = Object.keys(G).length, none = all - ids.length;
  $('#muPrepState').innerHTML = `<b>${saved} of ${ids.length}</b> uploaded tracks saved on this laptop.` +
    (ids.length - saved - bad ? ` <span style="color:var(--warn)">${ids.length - saved - bad} still to save.</span>` : (ids.length ? ` <span style="color:var(--ok)">Nothing left to save.</span>` : '')) +
    (bad ? ` <span style="color:var(--red)">${bad} file${bad > 1 ? 's need' : ' needs'} checking (silent, very short or unreadable): listen to it and ask the club to upload again if it's wrong.</span>` : '') +
    (none ? ` ${none} gymnast${none > 1 ? 's have' : ' has'} no music uploaded.` : '') +
    (PL.saveMsg ? `<br><span style="color:var(--red)">${esc(PL.saveMsg)}</span>` : '');
  if (!PL.prepping) $('#muPrepBar').style.width = ids.length ? (saved / ids.length * 100) + '%' : '0';
}
async function measure(blob){
  const Ctx = window.AudioContext || window.webkitAudioContext, ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    let sum = 0, n = 0; const step = Math.max(1, Math.floor(buf.sampleRate / 4000));
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += step) { const v = d[i]; if (Math.abs(v) > 0.003) { sum += v * v; n++; } } }
    const rms = n ? 10 * Math.log10(sum / n) : -99, target = -18;
    if (buf.duration < 5 || rms < -60) return {bad: true, duration: buf.duration, gainDb: 0};
    return {duration: buf.duration, gainDb: Math.min(0, target - rms)};
  } catch (_) { return {bad: true, duration: 0, gainDb: 0}; }
  finally { try { ctx.close(); } catch (_) {} }
}
async function prepareAll(){
  const ids = Object.keys(G).filter(id => UP[id] && status(id) !== 'saved' && status(id) !== 'bad');
  if (!ids.length) { const ni = await saveIntros().catch(() => 0); await ensureBuiltins().catch(() => {}); await bgSaveAll().catch(() => {}); await annSaveAll().catch(() => {}); toast(ni ? `${ni} introduction${ni > 1 ? 's' : ''} saved on this laptop.` : 'Everything uploaded is already saved on this laptop.'); return; }
  PL.prepping = true; PL.saveErr = null; $('#muPrepBtn').disabled = true; let ok = 0, failed = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i], u = UP[id];
    $('#muPrepBtn').textContent = `Saving ${i + 1} of ${ids.length}…`; $('#muPrepBar').style.width = (i / ids.length * 100) + '%';
    try {
      const r = await fetch(u.url); if (!r.ok) throw new Error(r.status); const blob = await r.blob();
      const m = await measure(blob);
      const rec = {k: TK(id), id, url: u.url, fileName: u.fileName || '', blob, savedAt: Date.now(), ...m};
      await PDB.put('tracks', rec); PL.cache[id] = rec; if (PL.objUrls[id]) { URL.revokeObjectURL(PL.objUrls[id]); delete PL.objUrls[id]; }
      ok++;
    } catch (e) { console.warn(id, e); failed++; if (!PL.saveErr) PL.saveErr = e; }
  }
  const ni = await saveIntros().catch(() => 0);
  await ensureBuiltins().catch(() => {});   // the built-in walk on, medal and closing tracks too
  await bgSaveAll().catch(() => {});        // and the built-in background playlist
  await annSaveAll().catch(() => {});       // and the shared announcements
  PL.prepping = false; $('#muPrepBtn').disabled = false; $('#muPrepBtn').textContent = 'Save all music to this laptop';
  renderPlayer();
  const why = (() => { const e = PL.saveErr; if (!e) return '';
    if (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '')) return 'This browser has run out of storage space for saved music. Use Chrome or Edge on the competition laptop, with plenty of free disk space.';
    if (e instanceof TypeError) return "The browser couldn't download the music files (blocked by the storage bucket's settings).";
    if (/^\d+$/.test(e.message || '')) return `The music server answered ${e.message}.`;
    return `${e.name || 'Error'}: ${e.message || e}`; })();
  PL.saveMsg = failed ? `${ok} saved, ${failed} not saved. ${why}` : ''; prepState();
  toast(`${ok} track${ok === 1 ? '' : 's'} saved` + (failed ? `, ${failed} not saved. ${why}` : '') + '.');
}
function srcFor(id){
  const c = PL.cache[id], u = UP[id];
  if (c && u && c.url === u.url && !c.bad) { if (!PL.objUrls[id]) PL.objUrls[id] = URL.createObjectURL(c.blob); return {src: PL.objUrls[id], gain: Math.pow(10, (c.gainDb || 0) / 20), local: true}; }
  return u ? {src: u.url, gain: 1, local: false} : null;
}
function startAudio(src, gain){
  try { SP.ctl && SP.ctl.pause(); } catch (_) {} bgDuck();
  audio.pause(); PL.fading = false; PL.paused = false; audio.src = src; audio.currentTime = 0; PL.gain = gain;
  audio.volume = Math.min(1, PL.vol * gain);
  return audio.play();
}
async function play(){
  if (PL.playing) { toast('Music is already playing. Press S to stop it.'); return; }
  const id = PL.cur; if (!id) return;
  if (ABS[id] && !confirm(`${G[id].name} is marked absent. Play their music anyway?`)) return;
  if (wantIntro(id)) { const src = introSrc(id);
    PL.playing = {kind: 'intro', id};
    try { await startAudio(src, 1); requestWake(); } catch (e) { PL.playing = null; PL.introed[id] = true; toast("Couldn't play the introduction. Press Space for the music."); }
    renderPlayer(); return; }
  const s = srcFor(id);
  if (!s) { toast(`No music uploaded for ${G[id].name}.`); return; }
  PL.playing = {kind: 'gym', id, local: s.local};
  try { await startAudio(s.src, s.gain); requestWake(); }
  catch (e) {
    // The saved copy failed and the error handler has already switched to the online copy: keep tracking it so Stop/Pause still work.
    if (PL.playing && PL.playing.kind === 'gym' && PL.playing.id === id && PL.playing.fallback) { renderPlayer(); return; }
    PL.playing = null; toast("Couldn't start the music. Press Space to try again, or use the backup."); }
  renderPlayer();
}
async function playAnn(k){
  if (PL.playing) { toast('Music is already playing. Press S to stop it first.'); return; }
  const a = PL.ann.find(x => x.k === k) || Object.values(PL.special || {}).find(x => x && x.k === k); if (!a) return;
  if (!PL.objUrls['ann:' + k] && a.blob) PL.objUrls['ann:' + k] = URL.createObjectURL(a.blob);
  const src = PL.objUrls['ann:' + k] || a.url;   // a built-in track not yet saved on this laptop plays online
  if (!src) { toast("That track isn't on this laptop yet. Connect to the internet and press Save all music."); return; }
  PL.playing = {kind: 'ann', k, name: a.name, slot: a.slot || ''};
  try { await startAudio(src, 1); requestWake(); if (BUILTIN[a.slot]) fadeIn(4000); } catch (_) { PL.playing = null; toast("Couldn't play that track."); }
  renderPlayer(); renderSlots();
}
function finish(advance){
  const p = PL.playing; PL.playing = null; PL.fading = false; PL.paused = false; audio.pause();
  stopFadeIn(); clearInterval(PL.fadeTimer); clearTimeout(PL.fadeSafety);
  if (p && p.kind === 'ann') renderSlots();   // swap "Fade out" back to "Play"
  if (p && p.kind === 'intro') { PL.introed[p.id] = true; plSave(); renderPlayer(); return; }
  if (p && p.kind === 'gym') { PL.played[p.id] = true; if (advance) { const nx = nextAfter(p.id); PL.cur = nx || p.id; } }
  plSave(); renderPlayer();
}
/* Pause / resume: holds the music (gymnast or announcement) exactly where it is */
function togglePause(){
  if (PL.playing && PL.playing.kind === 'sp') { try { SP.ctl.togglePlay(); } catch (_) {} PL.paused = !PL.paused; updPause(); return; }
  if (!PL.playing || PL.fading) return;
  if (PL.paused) { PL.paused = false; if (!PL.fadeInTimer) audio.volume = Math.min(1, PL.vol * (PL.gain || 1)); audio.play().catch(() => toast("Couldn't resume. Press Restart (R) instead.")); }
  else { PL.paused = true; stopFadeIn(); audio.pause(); }
  updPause();
}
function updPause(){
  if (!onScreen()) return;
  const b = $('#muPause');
  b.disabled = !PL.playing || PL.fading;
  b.classList.toggle('on', !!PL.paused);
  const fb = $('#muFade'); const f = !!(PL.fading && PL.playing); fb.classList.toggle('mu-fading', f); fb.innerHTML = f ? 'Stopping&hellip;<kbd>S</kbd>' : 'Stop<kbd>S</kbd>';
  b.innerHTML = PL.paused ? '&#9654; Resume<kbd>K</kbd>' : '&#10073;&#10073; Pause<kbd>K</kbd>';
  const lbl = document.querySelector('#muNow .lbl');
  if (lbl && PL.playing) { lbl.textContent = lbl.textContent.replace(/^(Now playing|Paused)/, PL.paused ? 'Paused' : 'Now playing'); }
}
/* Fades run on an ordinary timer, not requestAnimationFrame: Chrome pauses animation frames when its window is
   covered by another window, which left Stop stuck at full volume. A safety timeout always ends the fade. */
function stopFadeIn(){ clearInterval(PL.fadeInTimer); PL.fadeInTimer = null; }
function fadeIn(ms){
  stopFadeIn(); const target = Math.min(1, PL.vol * (PL.gain || 1)), t0 = performance.now(); audio.volume = 0;
  PL.fadeInTimer = setInterval(() => { if (!PL.playing || PL.fading || PL.paused) { stopFadeIn(); return; }
    const f = Math.min(1, (performance.now() - t0) / ms); audio.volume = target * f; if (f >= 1) stopFadeIn(); }, 40);
}
function fadeOut(){
  if (PL.playing && PL.playing.kind === 'sp') { spSlotStop(true); return; }
  if (!PL.playing) return;
  if (PL.fading) { clearInterval(PL.fadeTimer); clearTimeout(PL.fadeSafety); finish(true); bgBack(); return; }   // pressed again while fading: stop now
  stopFadeIn();
  if (PL.paused) { finish(true); bgBack(); return; }   // already silent: just stop
  PL.fading = true; updPause(); renderSlots();   // the Fade out buttons turn dark while it fades
  const v0 = audio.volume, t0 = performance.now(), dur = BUILTIN[PL.playing.slot] ? 5000 : 2500;
  const done = () => { clearInterval(PL.fadeTimer); clearTimeout(PL.fadeSafety); if (PL.fading) { finish(true); bgBack(); } };
  clearInterval(PL.fadeTimer); clearTimeout(PL.fadeSafety);
  PL.fadeTimer = setInterval(() => { if (!PL.fading) { clearInterval(PL.fadeTimer); return; }
    const f = Math.min(1, (performance.now() - t0) / dur); audio.volume = v0 * (1 - f); if (f >= 1) done(); }, 40);
  PL.fadeSafety = setTimeout(done, dur + 1500);
}
function restart(){
  if (PL.playing && PL.playing.kind === 'sp') { try { SP.ctl.seek(0); SP.ctl.resume(); } catch (_) {} PL.paused = false; updPause(); return; }
  if (!PL.playing) { play(); return; }
  stopFadeIn(); clearInterval(PL.fadeTimer); clearTimeout(PL.fadeSafety);
  PL.fading = false; PL.paused = false; audio.currentTime = 0; audio.volume = Math.min(1, PL.vol * (PL.gain || 1)); audio.play().catch(() => {});
  updPause();
}
function move(d){
  if (PL.playing) { toast('Stop the music before moving on.'); return; }
  const ids = queue(); let i = ids.indexOf(PL.cur);
  for (let j = i + d; j >= 0 && j < ids.length; j += d) { if (!ABS[ids[j]]) { PL.cur = ids[j]; delete PL.introed[PL.cur]; break; } }
  plSave(); renderPlayer(); document.querySelector('#muQueue .mu-qr.cur')?.scrollIntoView({block: 'nearest'});
}
function tick(){
  const b = document.getElementById('muTBar'), t = document.getElementById('muTTime'); if (!b || !t || !PL) return;
  const d = audio.duration, c = audio.currentTime;
  if (PL.playing && isFinite(d)) { b.style.width = (c / d * 100) + '%'; t.textContent = `${fmtT(c)} / ${fmtT(d)}`; b.parentElement.setAttribute('aria-valuenow', Math.round(c / d * 100)); }
  else { b.style.width = '0'; const cd = PL.cache[PL.cur]; t.textContent = cd && cd.duration ? fmtT(cd.duration) : '0:00'; }
}
audio.addEventListener('timeupdate', tick);
/* Click or drag on the time bar to jump to that point in the music */
(function(){ let drag = false;
  const seekTo = e => { const bar = document.querySelector('#muNow .mu-pbar'); const d = audio.duration;
    if (!bar || !PL || !PL.playing || !isFinite(d) || !d) return; const r = bar.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); audio.currentTime = f * d; tick(); };
  document.addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('#muNow .mu-pbar'))) return; drag = true; seekTo(e); e.preventDefault(); });
  document.addEventListener('pointermove', e => { if (drag) seekTo(e); });
  document.addEventListener('pointerup', () => { drag = false; });
})();
audio.addEventListener('ended', () => { if (PL && PL.playing) { const kind = PL.playing.kind; finish(true); if (kind === 'ann' || (kind !== 'intro' && spAutoOn())) bgBack(); } });
function spAutoOn(){ try { return localStorage.getItem('nglmusic:spAuto') === '1'; } catch (_) { return false; } }
audio.addEventListener('error', () => {
  const p = PL && PL.playing; if (!p) return;
  if (p.kind === 'gym' && p.local && UP[p.id] && navigator.onLine) { p.local = false; p.fallback = true; startAudio(UP[p.id].url, 1).catch(() => {}); toast('Saved copy failed, playing the online copy.'); return; }
  PL.playing = null; renderPlayer(); toast("This music won't play. Use the backup copy for this gymnast.");
});
const playVisible = () => onScreen() && UI.tab === 'play';
async function requestWake(){ try { if ('wakeLock' in navigator && !PL.wake) { PL.wake = await navigator.wakeLock.request('screen'); PL.wake.addEventListener('release', () => PL.wake = null); } } catch (_) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && playVisible()) requestWake(); });
// Only stop someone leaving while music is actually playing (a stray close mid-routine); otherwise leave freely.
window.addEventListener('beforeunload', e => { if (PL && PL.playing) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', e => {
  if (!playVisible() || !PL || $('#muDlg').open || document.querySelector('.modal-bg')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  const k = e.key;
  if (k === ' ' || k === 'Spacebar') { e.preventDefault(); e.stopPropagation(); play(); }
  else if (k === 's' || k === 'S' || k === 'f' || k === 'F') { e.preventDefault(); fadeOut(); }
  else if (k === 'k' || k === 'K') { e.preventDefault(); togglePause(); }
  else if (k === 'r' || k === 'R') { e.preventDefault(); restart(); }
  else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'n' || k === 'N') { e.preventDefault(); move(1); }
  else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'p' || k === 'P') { e.preventDefault(); move(-1); }
}, true);
// buttons must not keep focus, or Space would also "click" the focused button
document.addEventListener('mouseup', e => { if (!(e.target.closest && e.target.closest('#muTab-play'))) return; const b = e.target.closest('button'); if (b) setTimeout(() => b.blur(), 0); });
// clicking the Spotify player moves the keyboard into it; take the keyboard back so Space/S/K/R keep working
window.addEventListener('blur', () => setTimeout(() => { const a = document.activeElement;
  if (a && a.tagName === 'IFRAME' && playVisible()) { a.blur(); window.focus(); } }, 400));
function chooseChip(b){
  if (PL.playing) { toast('Stop the music before changing session or rotation.'); return; }
  if (b.dataset.ps) { PL.sess = b.dataset.ps; PL.rot = 1; } else PL.rot = +b.dataset.pr;
  PL.cur = firstUp(queue()); plSave(); renderPlayer();
}
// choose a gymnast by clicking her row in the queue (not the buttons, rotation box or Upload in it)
document.addEventListener('click', e => {
  const r = e.target.closest && e.target.closest('#muQueue [data-qid]'); if (!r) return;
  if (e.target.closest('select,label,input,button')) return;
  if (PL.playing) { toast('Stop the music before choosing another gymnast.'); return; }
  PL.cur = r.dataset.qid; plSave(); renderPlayer();
});
function resetSess(){ if (PL.playing) return; if (!confirm(`Clear the 'played' ticks for Rotation ${PL.rot} and go back to its first gymnast?`)) return; queue().forEach(id => { delete PL.played[id]; delete PL.introed[id]; }); PL.cur = firstUp(queue()); plSave(); renderPlayer(); }
function fullScreen(){ const st = $('#muStage'); if (document.fullscreenElement) document.exitFullscreen(); else if (st.requestFullscreen) st.requestFullscreen().catch(() => toast("Full screen isn't allowed here. Use 'Open in new tab' first.")); }
document.addEventListener('fullscreenchange', () => { $('#muFsBtn').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });

/* background music: Spotify playlist, paused whenever the player starts a track */
const SP = {ctl: null, api: null, uri: null, started: false};
function spResume(){ if (!SP.ctl) return; try { SP.started ? SP.ctl.resume() : SP.ctl.play(); } catch (_) {} }
function spUri(v){ const m = String(v || '').match(/(playlist|album|track|artist)[\/:]([A-Za-z0-9]{10,})/); return m ? `spotify:${m[1]}:${m[2]}` : null; }
function spRender(){
  let link = ''; try { link = localStorage.getItem('ngl_sp_link') || ''; } catch (_) {}
  SP.uri = spUri(link); $('#muSpLink').value = link; $('#muSpClear').classList.toggle('mu-hidden', !SP.uri);
  const box = $('#muSpBox'); box.innerHTML = ''; SP.ctl = null;
  if (!SP.uri || !onScreen()) return;
  const el = document.createElement('div'); box.appendChild(el);
  const make = api => api.createController(el, {uri: SP.uri, width: '100%', height: 232}, c => { SP.ctl = c; SP.started = false;
    c.addListener('playback_update', e => { if (e && e.data && !e.data.isPaused) SP.started = true; spSlotUpdate(e && e.data);
      const p = !(e && e.data) || !!e.data.isPaused; if (p !== SP.isPaused) { SP.isPaused = p; renderDeck(); } }); renderDeck(); });
  if (SP.api) make(SP.api);
  else { window.onSpotifyIframeApiReady = api => { SP.api = api; make(api); };
    if (!document.getElementById('spApi')) { const sc = document.createElement('script'); sc.id = 'spApi'; sc.src = 'https://open.spotify.com/embed/iframe-api/v1'; sc.async = true; document.body.appendChild(sc); } }
}
function spSave(){ const v = $('#muSpLink').value.trim(); if (!spUri(v)) { toast("That doesn't look like a Spotify playlist link."); return; }
  try { localStorage.setItem('ngl_sp_link', v); } catch (_) {} spRender(); }
function spClear(){ try { localStorage.removeItem('ngl_sp_link'); } catch (_) {} spRender(); }

/* announcements: shared by every laptop and browser. Files in Firebase storage, list in Firestore musicEvents/_builtin.ann,
   and a copy saved on each laptop so they play offline. Ones added before sharing existed are shared the next time the page opens online. */
function annShared(){ return PL.ann.filter(a => a.url).map((a, i) => ({k: a.k, name: a.name, url: a.url, path: a.path || '', order: i})); }
async function annPublish(){
  const list = annShared();
  try { await evSet({ann: list}, '_builtin'); if (PL.bcfg) PL.bcfg.ann = list;
    PL.ann.forEach(a => { if (a.url && !a.pub) { a.pub = true; PDB.put('ann', a).catch(() => {}); } }); return true; }
  catch (e) { console.warn(e); toast("Couldn't share the announcements just now (offline?). They'll be shared next time this page opens online."); return false; }
}
async function annUpload(a){
  if (!a.blob || a.url || !navigator.onLine || !LIVE) return false;   // sample data: stays on this laptop
  const path = 'music/finals2026/admin/ann-' + a.k + '.mp3';
  a.url = await putFile(path, a.blob, {contentType: 'audio/mpeg'});   // the storage rules only accept audio/mpeg; browsers play the file whatever its label
  a.path = path; await PDB.put('ann', a); return true;
}
async function annSync(cfg){
  if (!cfg || !Object.keys(cfg).length) return;   // offline: keep what's on this laptop
  const shared = Array.isArray(cfg.ann) ? cfg.ann : [], byK = new Map(shared.map(s => [s.k, s]));
  PL.ann.filter(a => a.pub && !byK.has(a.k)).forEach(a => { PDB.del('ann', a.k).catch(() => {}); });   // removed on another laptop
  PL.ann = PL.ann.filter(a => !(a.pub && !byK.has(a.k)));
  for (const s of shared) { let a = PL.ann.find(x => x.k === s.k);   // added on another laptop
    if (!a) { a = {k: s.k, name: s.name, url: s.url, path: s.path, pub: true, order: s.order}; PL.ann.push(a); PDB.put('ann', a).catch(() => {}); }
    else { a.name = s.name; a.order = s.order; a.pub = true; if (a.url !== s.url) { a.url = s.url; a.blob = null; } } }
  let changed = false;
  for (const a of PL.ann.filter(x => !x.url && x.blob)) { try { if (await annUpload(a)) changed = true; } catch (e) { console.warn('Announcement not shared yet', a.name, e); } }   // only on this browser: share it
  PL.ann.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (changed) await annPublish();
  renderAnn(); annSaveAll();
}
async function annSaveAll(){
  if (!navigator.onLine) return;
  for (const a of PL.ann.filter(x => x.url && !x.blob)) {
    try { const r = await fetch(a.url); if (!r.ok) throw new Error(r.status); a.blob = await r.blob(); await PDB.put('ann', a); }
    catch (e) { console.warn('Announcement not saved on this laptop yet', a.name, e); } }
  renderAnn();
}
function renderAnn(){
  if (!onScreen() || !PL) return;
  $('#muAnnList').innerHTML = PL.ann.length ? PL.ann.map((a, i) => `<div class="mu-ann"><span class="t">${esc(a.name)}<br><small>${
        a.url ? (a.blob ? 'Shared with every laptop · saved on this laptop' : 'Shared with every laptop · not saved on this laptop yet') : 'Only on this laptop: it will be shared when this page is online'}</small></span>
      <button class="btn sm" data-act="mu-annp" data-k="${a.k}">&#9654; Play</button>
      <button class="btn sm ghost" data-act="mu-annu" data-i="${i}" aria-label="Move up">&uarr;</button>
      <button class="btn sm ghost" data-act="mu-annx" data-k="${a.k}">Remove</button></div>`).join('')
    : `<p style="margin:0">None added yet. Add the safety and welcome tracks here.</p>`;
  renderAnnDeck();
}
/* the small announcement player on the controller */
function renderAnnDeck(){
  if (!onScreen() || !PL) return; const el = $('#muAnnDeck'); const p = PL.playing;
  el.innerHTML = `<span class="mu-albl">Announcements</span>` + (PL.ann.length ? PL.ann.map(a => { const on = !!(p && p.kind === 'ann' && p.k === a.k);
      return on ? `<button class="mu-abtn on${PL.fading ? ' mu-fading' : ''}" data-act="mu-ak" data-k="${a.k}" title="Fade out">${PL.fading ? 'Fading out&hellip;' : '&#9724; ' + esc(a.name)}</button>`
                : `<button class="mu-abtn" data-act="mu-ak" data-k="${a.k}" title="${esc(a.name)}">&#9654; ${esc(a.name)}</button>`; }).join('')
    : `<span style="color:var(--muted);font-size:13px">None yet: add them in Setup view.</span>`);
}
async function annAdd(inp){
  const files = [...inp.files]; inp.value = ''; let up = false;
  for (const f of files) { const k = 'a' + Date.now() + Math.random().toString(36).slice(2, 6);
    const rec = {k, name: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), blob: f, order: (PL.ann.at(-1)?.order || 0) + 1};
    try { await PDB.put('ann', rec); PL.ann.push(rec); } catch (_) { toast("Couldn't save that file on this laptop."); continue; }
    renderAnn();
    try { if (await annUpload(rec)) up = true; } catch (er) { console.warn(er); toast("Saved on this laptop, but couldn't share it yet. It will be shared next time this page opens online."); } }
  if (up && await annPublish()) toast('Announcement added for every laptop.');
  renderAnn();
}
async function annRemove(k){
  const a = PL.ann.find(x => x.k === k); if (!a) return;
  if (!confirm(a.url ? 'Remove this announcement from every laptop?' : 'Remove this announcement from this laptop?')) return;
  await PDB.del('ann', a.k).catch(() => {}); PL.ann = PL.ann.filter(x => x !== a); renderAnn();
  if (a.url) { await annPublish(); if (a.path) { try { await delFile(a.path); } catch (_) {} } }
}
function annUp(i){
  if (i < 1) return; [PL.ann[i - 1], PL.ann[i]] = [PL.ann[i], PL.ann[i - 1]]; PL.ann.forEach((a, j) => { a.order = j; PDB.put('ann', a).catch(() => {}); }); renderAnn();
  if (PL.ann.some(a => a.url)) annPublish();
}
/* walk-on and awards: one track each, kept with the announcements on this laptop */
const SLOTS = [{slot: 'walkon', label: 'Walk On and Rotation Music', hint: 'Upbeat, 4/4 beat for marching on and between rotations'}, {slot: 'awards', label: 'Medal Ceremony Music', hint: 'For the medal ceremony'}, {slot: 'closing', label: 'Closing Out Music', hint: 'To close the competition'}];
/* Built-in tracks: the same on every laptop, stored with the gymnast music in NGL's Firebase storage (not on GitHub).
   A laptop can still pick its own track (that choice wins until "Use built-in" is pressed).
   The track's name and link live in Firestore musicEvents/_builtin (sign-in only), never in this public file. */
const BUILTIN = {walkon: true, awards: true, closing: true};
async function builtinCfg(){
  if (PL.bcfg) return PL.bcfg;
  try { if (LIVE) { const d = await FS.getDoc(FS.doc(DB, 'musicEvents', '_builtin')); PL.bcfg = d.exists() ? d.data() : {}; } else PL.bcfg = clone(DEMO.events._builtin) || {}; }
  catch (e) { console.warn("Built-in tracks: couldn't read the settings (offline?)", e); return {}; }
  return PL.bcfg;
}
async function ensureBuiltins(){
  const mine = PL;
  PL.special = PL.special || {}; PL.builtinRecs = PL.builtinRecs || {};
  const cfg = await builtinCfg(); if (mine !== PL) return;
  bgSetList(cfg);
  annSync(cfg).catch(e => console.warn('Announcements not synced', e));
  for (const slot of Object.keys(BUILTIN)) {
    const saved = PL.builtinRecs[slot];
    const b = (cfg[slot] && cfg[slot].url) ? cfg[slot] : (saved ? {name: saved.name, url: saved.url} : null);   // offline: use the copy already on this laptop
    if (!b) continue;
    const cur = PL.special[slot];
    if (cur && !cur.builtin && cur.override) continue;                          // this laptop chose its own track
    if (cur && !cur.builtin) { PDB.del('ann', cur.k).catch(() => {}); if (PL.objUrls['ann:' + cur.k]) { URL.revokeObjectURL(PL.objUrls['ann:' + cur.k]); delete PL.objUrls['ann:' + cur.k]; } }  // older walk-on picks give way to the built-in track
    let rec = PL.builtinRecs[slot];
    if (!rec || rec.url !== b.url) rec = {k: 'builtin-' + slot, slot, name: b.name, url: b.url, builtin: true, order: 0};
    PL.builtinRecs[slot] = rec; PL.special[slot] = rec; renderSlots();
    if (!rec.blob && navigator.onLine) {
      try { const r = await fetch(b.url); if (!r.ok) throw new Error(r.status); rec.blob = await r.blob(); rec.savedAt = Date.now(); await PDB.put('ann', rec); }
      catch (e) { console.warn('Built-in track not saved yet', e); }
      renderSlots();
    }
  }
}
/* Background playlist (built in): the track list lives in Firestore musicEvents/_builtin.bg, the files in Firebase storage */
const BGK = t => 'bgtrack-' + t.n;
function bgSetList(cfg){
  const t = cfg && cfg.bg && Array.isArray(cfg.bg.tracks) ? cfg.bg.tracks : null;
  BG.list = t ? t.slice() : Object.values(BG.recs).map(r => ({n: r.n, name: r.name, url: r.url})).sort((a, b) => a.n - b.n);   // offline: the copies on this laptop
  BG.title = (cfg && cfg.bg && cfg.bg.name) || BG.title || 'Background playlist';
  if (t) { const keep = new Set(t.map(BGK)); Object.keys(BG.recs).forEach(k => { if (!keep.has(k)) { PDB.del('ann', k).catch(() => {}); delete BG.recs[k]; } }); }   // tracks taken off the list
  if (BG.order.length !== BG.list.length) bgShuffle();
  renderDeck(); bgState();
}
function bgShuffle(){ BG.order = BG.list.map((_, i) => i); for (let i = BG.order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [BG.order[i], BG.order[j]] = [BG.order[j], BG.order[i]]; } BG.pos = 0; }
function bgOn(){ return BG.list.length > 0; }
function bgSaved(){ return BG.list.filter(t => { const r = BG.recs[BGK(t)]; return r && r.blob && r.url === t.url; }).length; }
const BGURLS = {};
function bgSrc(t){ const k = BGK(t), r = BG.recs[k];
  if (r && r.blob && r.url === t.url) { if (!BGURLS[k]) BGURLS[k] = URL.createObjectURL(r.blob); return BGURLS[k]; }
  return navigator.onLine ? t.url : null; }
function bgNow(){ return BG.list[BG.order[BG.pos]]; }
function bgVol(){ return Math.min(1, PL ? PL.vol : 1); }
function bgStopTimer(){ clearInterval(BG.timer); BG.timer = null; }
function bgRamp(to, ms, then){ bgStopTimer(); const v0 = bgAudio.volume, t0 = performance.now();
  BG.timer = setInterval(() => { const f = Math.min(1, (performance.now() - t0) / ms); bgAudio.volume = Math.max(0, Math.min(1, v0 + (to - v0) * f)); if (f >= 1) { bgStopTimer(); then && then(); } }, 40); }
function bgLoad(){   // put the current track in the player, skipping any that aren't on this laptop when offline
  for (let n = 0; n < BG.list.length; n++) { const t = bgNow(), src = t && bgSrc(t);
    if (src) { if (bgAudio.dataset.k !== BGK(t)) { bgAudio.src = src; bgAudio.dataset.k = BGK(t); } return true; }
    BG.pos = (BG.pos + 1) % BG.list.length; }
  return false; }
function bgPlay(){
  if (!bgOn()) return;
  if (PL.playing) { toast('Other music is playing. Stop or fade it out first.'); return; }
  try { SP.ctl && SP.ctl.pause(); } catch (_) {}
  if (!bgLoad()) { toast("The background music isn't saved on this laptop yet. Connect to the internet and press Save all music."); return; }
  BG.want = true; BG.fading = false; bgAudio.volume = 0;
  bgAudio.play().then(() => bgRamp(bgVol(), 3000)).catch(() => { BG.want = false; toast("Couldn't play the background music."); renderDeck(); });
  renderDeck();
}
function bgFadeOut(){
  if (BG.fading) { bgStopTimer(); bgAudio.pause(); BG.fading = false; BG.want = false; renderDeck(); return; }   // pressed again: stop now
  BG.want = false; if (bgAudio.paused) { renderDeck(); return; }
  BG.fading = true; renderDeck();
  bgRamp(0, 4000, () => { bgAudio.pause(); BG.fading = false; renderDeck(); });
}
function bgSkip(){ if (!bgOn()) return; const was = !bgAudio.paused;
  const go = () => { BG.pos = (BG.pos + 1) % BG.list.length; if (!BG.pos) bgShuffle(); bgAudio.dataset.k = ''; bgLoad();
    if (was) { bgAudio.volume = 0; bgAudio.play().then(() => bgRamp(bgVol(), 1500)).catch(() => {}); } renderDeck(); };
  was ? bgRamp(0, 700, go) : go(); }
function bgDuck(){ if (!bgAudio.paused) { BG.fading = false; bgRamp(0, 700, () => { bgAudio.pause(); renderDeck(); }); } }   // other music starting: get out of the way
function bgBack(){   // other music has finished: bring the background back if it was on
  if (bgOn()) { if (BG.want && !PL.playing && bgLoad()) { bgAudio.volume = 0; bgAudio.play().then(() => bgRamp(bgVol(), 3000)).catch(() => {}); renderDeck(); } return; }
  spResume(); }
bgAudio.addEventListener('ended', () => { BG.pos = (BG.pos + 1) % BG.list.length; if (!BG.pos) bgShuffle(); bgAudio.dataset.k = '';
  if (BG.want && !(PL && PL.playing) && bgLoad()) { bgAudio.volume = bgVol(); bgAudio.play().catch(() => {}); } renderDeck(); });
bgAudio.addEventListener('play', () => renderDeck()); bgAudio.addEventListener('pause', () => renderDeck());
bgAudio.addEventListener('error', () => { if (BG.want && !(PL && PL.playing)) { toast("A background track wouldn't play, skipping it."); bgSkip(); } });
async function bgSaveAll(){
  if (!bgOn() || BG.saving || !navigator.onLine) return; BG.saving = true; let bad = 0;
  for (const t of BG.list) { const k = BGK(t), r = BG.recs[k]; if (r && r.blob && r.url === t.url) continue;
    try { const res = await fetch(t.url); if (!res.ok) throw new Error(res.status); const rec = {k, bg: true, n: t.n, name: t.name, url: t.url, blob: await res.blob(), savedAt: Date.now()};
      await PDB.put('ann', rec); BG.recs[k] = rec; }
    catch (e) { console.warn('Background track not saved', t.name, e); bad++; if (e && e.name === 'QuotaExceededError') break; }
    bgState(); renderDeck(); }
  BG.saving = false; bgState(); renderDeck();
  if (bad) toast(`${bad} background track${bad > 1 ? 's' : ''} not saved. Press Save all music again.`);
}
function bgState(){ if (!onScreen()) return; const el = $('#muBgState');
  if (!bgOn()) { el.innerHTML = 'No built-in playlist yet: the Spotify playlist below is used instead.'; return; }
  const n = BG.list.length, sv = bgSaved();
  el.innerHTML = `<b>Built in: ${esc(BG.title)}</b> · ${n} tracks, played in a shuffled order · ` +
    (sv === n ? `<span style="color:var(--ok)">all saved on this laptop</span>` : `<span style="color:var(--warn)">${sv} of ${n} saved on this laptop${BG.saving ? ' (saving…)' : ': press Save all music'}</span>`) +
    `. It fades down when other music starts and comes back when that music is stopped.`; }

/* Music deck: the four one-tap tiles above the gymnast player */
function renderDeck(){
  if (!onScreen() || !PL) return;
  renderAnnDeck();
  const el = $('#muDeck');
  const p = PL.playing;
  const tile = (c, title, sub, on, btn) => `<div class="mu-tile${on ? ' on' : ''}" style="--c:${c}"><div class="tx"><b>${title}</b><small>${sub}</small></div>${btn}</div>`;
  const fadeBtn = (dk, fading) => fading ? `<button class="mu-tbtn mu-fading" data-act="mu-dk" data-dk="${dk}" title="Tap again to stop straight away">Fading out&hellip;</button>` : `<button class="mu-tbtn stop" data-act="mu-dk" data-dk="${dk}">&#9724; Fade out</button>`;
  const slotTile = (slot, c, title) => { const a = (PL.special || {})[slot], on = !!(p && a && p.k === a.k);
    const sub = !a ? 'Not set up: see Setup view' : on ? (p.kind === 'sp' ? 'Playing on Spotify · ' : PL.fading ? 'Fading out · ' : 'Playing · ') + esc(a.name) : esc(a.name);
    const btn = !a ? `<button class="mu-tbtn" disabled>&#9654; Play</button>` : on ? fadeBtn('fade', PL.fading) : `<button class="mu-tbtn" data-act="mu-dk" data-dk="slot" data-slot="${slot}">&#9654; Play</button>`;
    return tile(c, title, sub, on, btn); };
  let bg;
  if (bgOn()) { const t = bgNow(), playing = !bgAudio.paused, sv = bgSaved(), n = BG.list.length;
    const sub = BG.fading ? 'Fading out · ' + esc(t ? t.name : '') : playing ? 'Playing · ' + esc(t ? t.name : '')
      : BG.want && p ? 'Paused for the other music, comes back after'
      : `${n} tracks · ` + (sv === n ? 'saved on this laptop' : `${sv} of ${n} saved` + (BG.saving ? ' (saving…)' : ''));
    bg = tile('#00AEB7', 'Background music', sub, playing || (BG.want && !!p),
      playing ? `<div class="btns"><button class="mu-tbtn skip" data-act="mu-dk" data-dk="bgskip" title="Next track" aria-label="Next track">&#9197;</button>${fadeBtn('bgfade', BG.fading)}</div>`
              : `<button class="mu-tbtn" data-act="mu-dk" data-dk="bgplay">&#9654; Play</button>`); }
  else { const spOn = !!(SP.ctl && SP.isPaused === false && !(p && p.kind === 'sp'));
    bg = tile('#00AEB7', 'Background music', !SP.ctl ? 'Not set up: see Setup view' : spOn ? 'Playing · Spotify playlist' : 'Spotify playlist',
      spOn, !SP.ctl ? `<button class="mu-tbtn" disabled>&#9654; Play</button>`
        : spOn ? `<button class="mu-tbtn stop" data-act="mu-dk" data-dk="sppause">&#10073;&#10073; Pause</button>` : `<button class="mu-tbtn" data-act="mu-dk" data-dk="spplay">&#9654; Play</button>`); }
  el.innerHTML = bg +
    slotTile('walkon', '#0073B3', 'Walk on &amp; rotation') +
    slotTile('awards', '#8F286B', 'Medal ceremony') +
    slotTile('closing', '#28225C', 'Closing out');
}
function deckTap(b){
  const k = b.dataset.dk; setTimeout(() => b.blur(), 0);
  if (k === 'slot') playSlot(b.dataset.slot);
  if (k === 'fade') fadeOut();
  if (k === 'bgplay') bgPlay();
  if (k === 'bgfade') bgFadeOut();
  if (k === 'bgskip') bgSkip();
  if (k === 'spplay') { if (PL.playing) { toast('Other music is playing. Stop or fade it out first.'); return; } spResume(); }
  if (k === 'sppause') { try { SP.ctl.pause(); } catch (_) {} }
}
function setCtrl(on){ document.getElementById('muRoot')?.classList.toggle('mu-ctrl', on); $('#muCtrlBtn').textContent = on ? 'Setup view' : 'Controller view';
  try { localStorage.setItem('nglmusic:ctrl', on ? '1' : '0'); } catch (_) {} }
const ctrlOn = () => { try { return localStorage.getItem('nglmusic:ctrl') === '1'; } catch (_) { return false; } };
function renderSlots(){
  renderDeck();
  if (!onScreen() || !PL) return;
  $('#muSpSlots').innerHTML = SLOTS.map(x => { const a = (PL.special || {})[x.slot];
    const what = !a ? x.hint : a.builtin ? `Built in · ${esc(a.name)} · ${a.blob ? 'saved on this laptop' : 'online (saving…)'}` : (a.spUri ? 'Spotify · ' : 'MP3 · ') + esc(a.name);
    const own = a && !a.builtin && BUILTIN[x.slot];
    return `<div class="mu-ann mu-slot"><span class="t"><b>${x.label}</b><br><small>${what}</small></span>
      ${a ? (PL.playing && PL.playing.k === a.k
              ? (PL.fading ? `<button class="btn sm mu-fading" data-act="mu-slfo" data-slot="${x.slot}">Fading out&hellip;</button>`
                           : `<button class="btn sm" data-act="mu-slfo" data-slot="${x.slot}">&#9724; Fade out</button>`)
              : `<button class="btn sm" data-act="mu-slp" data-slot="${x.slot}">&#9654; Play</button>`)
           + (a.builtin ? '' : `<button class="btn sm ghost" data-act="mu-slx" data-slot="${x.slot}">${own ? 'Use built-in' : 'Remove'}</button>`) : ''}
      <div class="mu-slrow">
        <input type="text" placeholder="Paste a Spotify track link" aria-label="Spotify track link for ${x.label}" data-sll="${x.slot}" class="mu-in">
        <button class="btn sm ghost" data-act="mu-sls" data-slot="${x.slot}">Use link</button>
        <label class="btn sm ghost">Or MP3<input type="file" accept="audio/*" hidden data-slf="${x.slot}"></label></div></div>`; }).join('');
}
async function saveSlot(rec){
  if (BUILTIN[rec.slot]) rec.override = true;   // chosen on purpose instead of the built-in track
  const old = (PL.special || {})[rec.slot];
  try { await PDB.put('ann', rec); PL.special = PL.special || {}; PL.special[rec.slot] = rec;
    if (old && PL.objUrls['ann:' + old.k]) { URL.revokeObjectURL(PL.objUrls['ann:' + old.k]); delete PL.objUrls['ann:' + old.k]; } }
  catch (_) { toast("Couldn't save that on this laptop."); }
  renderSlots();
}
function playSlot(slot){
  const a = (PL.special || {})[slot]; if (!a) return;
  if (!a.spUri) { playAnn(a.k); return; }
  if (PL.playing) { toast('Music is already playing. Press S to stop it first.'); return; }
  if (!SP.ctl) { toast("Spotify isn't ready. Add the background playlist below and sign in to Spotify in this browser."); return; }
  PL.playing = {kind: 'sp', k: a.k, name: a.name, slot}; PL.paused = false; SP.slotStarted = false;
  try { SP.ctl.loadUri(a.spUri); setTimeout(() => { try { SP.ctl.play(); } catch (_) {} }, 700); } catch (_) { PL.playing = null; toast("Couldn't play that Spotify track."); }
  renderPlayer(); updPause();
}
function spSlotUpdate(d){
  const p = PL && PL.playing; if (!p || p.kind !== 'sp' || !d) return;
  if (!d.isPaused && d.position > 0) SP.slotStarted = true;
  const b = document.getElementById('muTBar'), t = document.getElementById('muTTime');
  if (b && t && d.duration) { b.style.width = Math.min(100, d.position / d.duration * 100) + '%'; t.textContent = `${fmtT(d.position / 1000)} / ${fmtT(d.duration / 1000)}`; }
  if (SP.slotStarted && d.duration && d.position >= d.duration - 400) spSlotStop(spAutoOn());
}
/* stop the walk-on / awards track and put the background playlist back */
function spSlotStop(resume){
  if (!PL.playing || PL.playing.kind !== 'sp') return;
  PL.playing = null; PL.paused = false; SP.slotStarted = false;
  try { SP.ctl.pause(); SP.ctl.loadUri(SP.uri); SP.started = false; if (resume) setTimeout(() => { if (PL.playing) return; /* a gymnast or announcement started meanwhile */ try { SP.ctl.play(); } catch (_) {} }, 700); } catch (_) {}
  renderPlayer(); updPause();
}
function slotRemove(slot){
  const a = (PL.special || {})[slot]; if (!a || a.builtin) return;
  if (!BUILTIN[slot] && !confirm('Remove this track from this laptop?')) return;
  PDB.del('ann', a.k).catch(() => {}); delete PL.special[slot]; renderSlots();
  if (BUILTIN[slot]) { a.override = false; ensureBuiltins(); }   // back to the built-in track
}
async function slotLink(slot){
  const v = (document.querySelector(`#muRoot [data-sll="${slot}"]`) || {value: ''}).value.trim(), m = v.match(/track[\/:]([A-Za-z0-9]{10,})/);
  if (!m) { toast('Paste a Spotify link to a single song (it has /track/ in it).'); return; }
  let name = 'Spotify track'; try { const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/track/' + m[1])); if (r.ok) { const j = await r.json(); if (j.title) name = j.title; } } catch (_) {}
  saveSlot({k: 'slot-' + slot, slot, name, spUri: 'spotify:track:' + m[1], link: v, order: 0});
}

/* backup: every session and rotation in floor order, plus announcements, from saved copies where possible */
async function exportBackup(){
  let JSZip; try { JSZip = await loadZip(); } catch (_) { toast("The zip tool couldn't load. Check the connection."); return; }
  const zip = new JSZip(); let n = 0, failed = 0; toast('Preparing the backup…');
  Object.values(PL.special || {}).forEach(a => { if (a && a.blob) zip.file(`00 ${a.slot === 'walkon' ? 'Walk On and Rotation Music' : 'Medal Ceremony Music'} - ${safe(a.name)}.mp3`, a.blob); });
  PL.ann.filter(a => a.blob).forEach((a, i) => { zip.file(`00 Announcements/${String(i + 1).padStart(2, '0')} - ${safe(a.name)}.mp3`, a.blob); });
  for (const s of SESS) { const o = rotOf(s);
    for (const r of [...Array.from({length: nrotOf(s)}, (_, i) => i + 1), 'u']) { const ids = o[r]; if (!ids.length) continue;
      const dir = `${safe(sessName(s))} session/${r === 'u' ? 'Not in a rotation' : 'Rotation ' + r}`;
      for (let i = 0; i < ids.length; i++) { const id = ids[i]; if (!UP[id]) continue;
        try { zip.file(`${dir}/${String(i + 1).padStart(2, '0')} - ${safe(G[id].name)} - ${safe(clubName(G[id].club))}${ABS[id] ? ' (ABSENT)' : ''}.mp3`, await blobFor(id)); n++; } catch (_) { failed++; } }
      zip.file(`${dir}/Running order.txt`, ids.map((id, i) => `${String(i + 1).padStart(2, '0')}  ${G[id].name}  (${clubName(G[id].club)})${UP[id] ? '' : '  NO MUSIC'}${ABS[id] ? '  ABSENT' : ''}`).join('\r\n'));
    } }
  const blob = await zip.generateAsync({type: 'blob'});
  saveBlob(blob, `${D.title} - floor music backup.zip`);
  toast(`Backup ready: ${n} tracks` + (failed ? `, ${failed} couldn't be fetched` : '') + '.');
}

/* ---------- ui ---------- */
function showTab(t){
  if (UI.playonly) t = 'play';
  UI.tab = t;
  document.querySelectorAll('#muRoot .mu-tabs button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.tab === t)));
  ['order', 'clubs', 'play'].forEach(k => $('#muTab-' + k).classList.toggle('mu-hidden', k !== t));
  // keep the address in step without redrawing the screen (a redraw would interrupt nothing, but keeps the player still)
  if (/^#\/admin\/music(\/|$)/.test(location.hash)) { const h = '#/admin/music/' + (t === 'play' ? 'play/' : '') + D.compKey; try { history.replaceState(null, '', h); UI.route = location.hash; } catch (_) {} }
  if (t === 'play') { if (!PL.ready) plInit(); else { renderPlayer(); renderAnn(); renderSlots(); } requestWake(); }
}
let DLG = [];
function openDlg(t, body, btns){
  const dlg = $('#muDlg'); if (!dlg.showModal) return;
  $('#muDlgT').textContent = t; $('#muDlgB').innerHTML = body; const f = $('#muDlgF'); f.innerHTML = ''; DLG = btns;
  btns.forEach(b => { const el = document.createElement('button'); el.type = 'button'; el.className = 'btn ' + (b.cls === 'primary' ? '' : 'ghost'); el.textContent = b.l;
    el.onclick = () => { if (!b.fn || b.fn() !== false) dlg.close(); }; f.appendChild(el); });
  dlg.showModal();
}
function updDlg(){
  openDlg('Update from Elevien', `<p class="mu-dlgp" style="color:var(--ink)">Competitions and entries were last pulled from Elevien <b>${ELEV_AT ? esc(new Date(ELEV_AT).toLocaleString('en-GB', {dateStyle: 'medium', timeStyle: 'short'})) : 'not yet'}</b>.</p>
      <p class="mu-dlgp" style="color:var(--ink)">To pull the latest, ask Claude: <b>"Update the NGL competitions from Elevien."</b> New competitions are added, new or withdrawn gymnasts are updated, and the floor order is read from the Elevien competition schedule. Absences and uploaded music are kept.</p>
      <p class="mu-dlgp">Then click <b>Load latest</b> here: the floor rotations sort themselves into the Elevien order. Anything that has changed since you last published is listed at the top of the page, ready to publish to the NGL Club Hub.</p>`,
    [{l: 'Close'}, {l: 'Load latest', cls: 'primary', fn: () => { if (PL && PL.playing) { toast('Stop the music before changing competition.'); return false; } LOADED = null; FORCE = true; window.NGL_RENDER && window.NGL_RENDER(); }}]);
}

/* Buttons (data-act="mu-…"): the app shell sends clicks here */
export const MU = {
  'mu-tab'(b){ showTab(b.dataset.tab); },
  'mu-upd'(){ updDlg(); },
  'mu-mv'(b){ moveRow(b); },
  'mu-paste'(b){ const [sk, r] = b.dataset.sr.split('|'); pasteDlg(SESS.find(x => x.key === sk), +r); },
  'mu-zip'(b){ const [sk, r] = b.dataset.sr.split('|'); downloadZip(SESS.find(x => x.key === sk), +r); },
  'mu-intro'(b){ introDlg(b.dataset.id); },
  'mu-publish'(){ publish(); },
  'mu-close'(){ closeUploads(); },
  'mu-email'(b){ emailClub(b); },
  'mu-prep'(){ prepareAll(); },
  'mu-backup'(){ exportBackup(); },
  'mu-annp'(b){ playAnn(b.dataset.k); },
  'mu-annu'(b){ annUp(+b.dataset.i); },
  'mu-annx'(b){ annRemove(b.dataset.k); },
  'mu-ak'(b){ setTimeout(() => b.blur(), 0); const p = PL.playing; if (p && p.kind === 'ann' && p.k === b.dataset.k) fadeOut(); else playAnn(b.dataset.k); },
  'mu-dk'(b){ deckTap(b); },
  'mu-slp'(b){ playSlot(b.dataset.slot); },
  'mu-slfo'(){ fadeOut(); },
  'mu-slx'(b){ slotRemove(b.dataset.slot); },
  'mu-sls'(b){ slotLink(b.dataset.slot); },
  'mu-spsave'(){ spSave(); },
  'mu-spclear'(){ spClear(); },
  'mu-elkeysave'(){ const k = $('#muElKey').value.trim(); if (!k) return; EL.key = k; $('#muElKey').value = ''; elSave(); renderIntroPanel(); fillVoices(); },
  'mu-elforget'(){ EL.key = ''; elSave(); renderIntroPanel(); toast('ElevenLabs key removed from this laptop.'); },
  'mu-introgo'(){ generateIntros(); },
  'mu-introhear'(){ introSample(); },
  'mu-ctrl'(){ setCtrl(!document.getElementById('muRoot').classList.contains('mu-ctrl')); },
  'mu-ps'(b){ chooseChip(b); },
  'mu-pr'(b){ chooseChip(b); },
  'mu-reset'(){ resetSess(); },
  'mu-fs'(){ fullScreen(); },
  'mu-go'(){ play(); },
  'mu-pause'(){ togglePause(); },
  'mu-fade'(){ fadeOut(); },
  'mu-restart'(){ restart(); },
  'mu-prev'(){ move(-1); },
  'mu-next'(){ move(1); },
  'mu-qabs'(b){ setAbsent(b.dataset.id, !ABS[b.dataset.id]); }
};

/* Boxes, lists and sliders (the shell only handles clicks) */
document.addEventListener('change', e => {
  const t = e.target; if (!(t.closest && t.closest('#muRoot'))) return;
  if (t.closest('#muTab-play') && t.type === 'checkbox') setTimeout(() => t.blur(), 0);   // tick boxes must not keep focus, or Space would tick/untick them instead of playing
  if (t.id === 'muCompSel') {
    if (PL && PL.playing) { toast('Stop the music before changing competition.'); t.value = D.compKey; return; }
    try { localStorage.setItem('nglmusic:comp', t.value); } catch (_) {}
    const base = /^#\/admin\/musicplayer/.test(location.hash) ? '#/admin/musicplayer/' : UI.tab === 'play' ? '#/admin/music/play/' : '#/admin/music/';
    location.hash = base + encodeURIComponent(t.value); return; }
  if (t.dataset.abs) { setAbsent(t.dataset.abs, t.checked); return; }
  if (t.dataset.rot) { const v = t.value; moveTo(t.dataset.rot, v === 'u' ? 'u' : +v); t.blur(); return; }
  if (t.dataset.aup) { adminUpload(t); return; }
  if (t.dataset.link) { linkClub(t); return; }
  if (t.dataset.slf) { const f = t.files[0], slot = t.dataset.slf; if (!f) return; t.value = ''; saveSlot({k: 'slot-' + slot, slot, name: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), blob: f, order: 0}); return; }
  if (t.id === 'muAnnFile') { annAdd(t); return; }
  if (t.id === 'muElVoice') { EL.voice = t.value; elSave(); renderIntroPanel(); return; }
  if (t.id === 'muElTpl') { const v = t.value.trim(); if (!/\{name\}/.test(v)) { toast('The wording needs {name} in it.'); t.value = EL.tpl; return; } EL.tpl = v; elSave(); renderIntroPanel(); return; }
  if (t.id === 'muIntroOn') { try { localStorage.setItem('nglmusic:introsOn', t.checked ? '1' : '0'); } catch (_) {} renderPlayer(); return; }
  if (t.id === 'muSpAuto') { try { localStorage.setItem('nglmusic:spAuto', t.checked ? '1' : '0'); } catch (_) {} }
});
document.addEventListener('input', e => {
  const t = e.target; if (!(t.closest && t.closest('#muRoot'))) return;
  if (t.id === 'muDlInput') t.dataset.touched = '1';
  if (t.id === 'muVol') { PL.vol = t.value / 100; if (PL.playing && !PL.fading) audio.volume = Math.min(1, PL.vol * (PL.gain || 1)); if (!bgAudio.paused && !BG.timer) bgAudio.volume = bgVol(); plSave(); }
});
document.addEventListener('submit', e => { if (e.target.closest && e.target.closest('#muRoot')) e.preventDefault(); });

/* ---------- the screen ---------- */
function skeleton(){
  const today = new Date().toISOString().slice(0, 10), n = c => c.levels.reduce((a, L) => a + L.gymnasts.length, 0);
  const tab = UI.playonly ? 'play' : UI.tab, hid = t => t === tab ? '' : ' mu-hidden';
  return `<div class="mu-root${UI.playonly ? ' mu-playonly' : ''}${ctrlOn() ? ' mu-ctrl' : ''}" id="muRoot">
  <div class="mu-head"><p class="mu-ttl"><b id="muTitle">${esc(D.title)} floor music</b><small>Uploads, running order and downloads</small></p><span id="muSaveState" class="mu-save" aria-live="polite"></span>
    <label class="mu-csel"><span class="mu-sr">Competition</span><select id="muCompSel" aria-label="Competition">${COMPS.slice().sort((a, b) => a.date.localeCompare(b.date)).map(c =>
      `<option value="${esc(c.compKey)}" ${c.compKey === D.compKey ? 'selected' : ''}>${c.date < today ? '(past) ' : ''}${c.date ? esc(fmtDate(c.date)) : ''} · ${esc(c.title)} · ${n(c) ? n(c) + ' gymnasts' : 'no entries yet'}</option>`).join('')}</select></label>
    <button class="btn sm ghost" id="muUpdBtn" data-act="mu-upd">Update from Elevien</button></div>
  <div id="muDiffTop"></div>
  <div class="mu-tally" id="muTally"></div>
  <nav class="mu-tabs" role="tablist">
    <button role="tab" aria-selected="${tab === 'order'}" data-act="mu-tab" data-tab="order">Running order</button>
    <button role="tab" aria-selected="${tab === 'clubs'}" data-act="mu-tab" data-tab="clubs">Clubs</button>
    <button role="tab" aria-selected="${tab === 'play'}" data-act="mu-tab" data-tab="play">Play</button>
  </nav>
  <section id="muTab-order" class="${hid('order')}"><div id="muLevels"></div></section>
  <section id="muTab-clubs" class="${hid('clubs')}">
    <div class="card mu-panel">
      <h3>NGL Club Hub</h3>
      <p id="muPubState">Clubs upload in the NGL Club Hub's Floor music tab. Publish the entries to switch it on (and again after any entry changes).</p>
      <label class="mu-lbl">Upload deadline shown to clubs<input id="muDlInput" class="mu-in" style="width:min(320px,100%)"></label>
      <div class="mu-btns"><button class="btn" data-act="mu-publish">Publish entries to NGL Club Hub</button><button class="btn ghost" id="muCloseBtn" data-act="mu-close">Close uploads</button></div>
      <div id="muDiffNote" style="margin-top:10px"></div>
    </div>
    <div class="card mu-panel"><h3>Clubs</h3><p>A club sees its gymnasts automatically when its NGL Club Hub BG number matches Elevien's. Link any that don't.</p><div id="muClubList"></div></div>
  </section>
  <section id="muTab-play" class="${hid('play')}">
    <div class="mu-split">
      <div class="card mu-panel">
        <h3>1. Prepare this laptop</h3>
        <p id="muPrepState">Checking what's saved on this laptop…</p>
        <div class="mu-pbar" style="margin-bottom:10px"><i id="muPrepBar"></i></div>
        <div class="mu-btns">
          <button class="btn" id="muPrepBtn" data-act="mu-prep">Save all music to this laptop</button>
          <button class="btn ghost" id="muBackupBtn" data-act="mu-backup">Export backup (zip)</button>
        </div>
        <p style="margin:10px 0 0;font-size:13px">Do this the day before, then again on the morning if any music has changed. Once saved, the player works without internet.</p>
      </div>
      <div class="card mu-panel">
        <h3>2. Announcements</h3>
        <p>Shared with every laptop and browser (Chrome and Edge), and saved on each one so they play offline. Play them from the controller.</p>
        <div id="muAnnList"></div>
        <label class="btn ghost sm" style="margin-top:8px">Add announcement MP3<input type="file" id="muAnnFile" accept="audio/*" multiple hidden></label>
      </div>
      <div class="card mu-panel" id="muSpPanel">
        <h3>3. Walk On, Rotation, Medal Ceremony and Closing Out Music</h3>
        <p>All three tracks are built in on every laptop and fade in and out. Walk On and Rotation Music: as the gymnasts march on and between rotations. Medal Ceremony Music: for the medals. Closing Out Music: to close the competition.</p>
        <div id="muSpSlots"></div>
      </div>
      <div class="card mu-panel" id="muBgPanel">
        <h3>Background music</h3>
        <p id="muBgState" style="margin-bottom:10px"></p>
        <p>Spotify (only used if there is no built-in playlist): paste a Spotify playlist link. It pauses automatically when you play a gymnast or an announcement, and starts again when you press Stop.</p>
        <div class="mu-btns">
          <input id="muSpLink" class="mu-in" type="url" name="spotify-playlist" autocomplete="off" placeholder="https://open.spotify.com/playlist/…" aria-label="Spotify playlist link" style="flex:1;min-width:200px">
          <button class="btn sm" data-act="mu-spsave">Add playlist</button>
          <button class="btn sm ghost mu-hidden" id="muSpClear" data-act="mu-spclear">Remove</button>
        </div>
        <label class="mu-check"><input type="checkbox" id="muSpAuto" ${spAutoOn() ? 'checked' : ''}> Start the playlist again when a gymnast's music ends on its own</label>
        <div id="muSpBox" style="margin-top:10px"></div>
        <p style="margin:8px 0 0;font-size:12px">Sign in to Spotify in this browser first (open.spotify.com) so whole tracks play, not 30-second previews. Needs internet.</p>
      </div>
      <div class="card mu-panel" id="muIntroPanel">
        <h3>3. Gymnast introductions</h3>
        <p id="muIntroState"></p>
        <div class="mu-fullonly">
          <div id="muElKeyRow" class="mu-btns" style="margin-bottom:8px">
            <input id="muElKey" class="mu-in" type="password" autocomplete="new-password" placeholder="ElevenLabs API key" aria-label="ElevenLabs API key" style="flex:1;min-width:200px">
            <button class="btn sm" data-act="mu-elkeysave">Add key</button>
          </div>
          <div id="muElSetRow" class="mu-hidden" style="display:grid;gap:8px;margin-bottom:8px">
            <label class="mu-lbl" style="margin:0">Voice <select id="muElVoice" class="mu-in"></select></label>
            <label class="mu-lbl" style="margin:0">Wording <input id="muElTpl" class="mu-in" value="${esc(EL.tpl)}"></label>
            <p id="muIntroMsg" style="margin:0;font-size:13px;color:var(--red)"></p>
            <div class="mu-pbar"><i id="muIntroBar"></i></div>
            <div class="mu-btns"><button class="btn" id="muIntroGo" data-act="mu-introgo">Make introductions</button><button class="btn ghost sm" data-act="mu-introhear">Hear a sample</button><button class="btn ghost sm" data-act="mu-elforget">Remove key from this laptop</button></div>
          </div>
        </div>
        <label class="mu-check" style="font-size:14px"><input type="checkbox" id="muIntroOn" ${introsOn() ? 'checked' : ''}> Introduce each gymnast before her music</label>
        <p style="margin:8px 0 0;font-size:13px">Space plays the introduction; Space again starts the music once she's in position. Use {club} and {name} in the wording. Fix a name's pronunciation with the Intro button beside her on the Running order tab.</p>
      </div>
    </div>
    <div id="muStage">
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn sm" id="muCtrlBtn" data-act="mu-ctrl">${ctrlOn() ? 'Setup view' : 'Controller view'}</button></div>
      <div class="mu-deck" id="muDeck"></div>
      <div class="mu-annbar" id="muAnnDeck"></div>
      <div class="mu-gymlbl">Gymnast routines</div>
      <div class="mu-bar">
        <div class="mu-chips" id="muSessChips"></div>
        <label class="mu-vol">Volume <input type="range" id="muVol" min="0" max="100" value="100" aria-label="Volume"></label>
        <button class="btn ghost sm" data-act="mu-reset">Reset rotation</button>
        <button class="btn sm ghost" id="muFsBtn" data-act="mu-fs">${document.fullscreenElement ? 'Exit full screen' : 'Full screen'}</button>
      </div>
      <div class="mu-now" id="muNow"></div>
      <div class="mu-ctl">
        <button class="btn mu-go" id="muGo" data-act="mu-go">&#9654; Play<kbd>Space</kbd></button>
        <button class="btn mu-pause" id="muPause" data-act="mu-pause" disabled>&#10073;&#10073; Pause<kbd>K</kbd></button>
        <button class="btn mu-fadeb" id="muFade" data-act="mu-fade">Stop<kbd>S</kbd></button>
        <button class="btn mu-plain" id="muRestart" data-act="mu-restart">Restart<kbd>R</kbd></button>
        <button class="btn ghost" data-act="mu-prev">&larr; Previous</button>
        <button class="btn ghost" data-act="mu-next">Next &rarr;</button>
      </div>
      <div class="mu-nextup" id="muNextUp"></div>
      <div class="mu-q" id="muQueue"></div>
      <p class="mu-help">Space plays the selected gymnast. Absent gymnasts are skipped. Drag rows to change the order, or use the rotation box to move someone. While music is playing, Space does nothing, so a stray press can't stop a routine: use S to stop (the music fades out), or K to pause and resume. When a track finishes, the next gymnast is selected but doesn't start until you press Space.</p>
    </div>
  </section>
  <dialog id="muDlg" class="mu-dlg" aria-labelledby="muDlgT"><div class="mu-dh" id="muDlgT"></div><div class="mu-db" id="muDlgB"></div><div class="mu-df" id="muDlgF"></div></dialog>
</div>`;
}
function mount(){
  if (!onScreen() || !D) return;
  const dl = $('#muDlInput'); dl.value = (EV && EV.deadline) || D.deadline || '';
  renderDiff(); render(); renderClubs(); renderIntroPanel(); spRender(); bgState();
  if (EL.key) fillVoices();
  if (UI.tab === 'play' || UI.playonly) { if (!PL.ready) plInit(); else { $('#muVol').value = Math.round(PL.vol * 100); renderPlayer(); renderAnn(); renderSlots(); } requestWake(); }
}
document.addEventListener('ngl:rendered', () => { if (onScreen()) mount(); });

/* #/admin/music, #/admin/music/<competition>, #/admin/music/play[/<competition>]; #/admin/musicplayer opens the Play tab */
export default async function music(me = {}, parts = []){
  ME = me || {};
  /* "Competition music player" only (no Floor music tick): just the Play tab, no uploads or club settings */
  UI.playonly = !(ME.owner || (ME.sections || []).includes('music'));
  const play = parts[0] === 'play', want = decodeURIComponent((play ? parts[1] : parts[0]) || '');
  if (!LOADED) LOADED = loadLists();
  try { await LOADED; } catch (e) { console.error(e); LOADED = null;
    return `<div class="card empty">${e && e.code === 'permission-denied' ? 'You need Floor music or Competition music player access to open this.' : 'Couldn’t load the floor music. Check the connection and refresh the page.'}</div>`; }
  if (!COMPS.length) return '<div class="card empty">No competitions yet. Add them in NGL Admin → Competitions.</div>';
  const keep = PL && PL.playing && D;   // never switch competition while music is playing
  const d = keep ? COMPS.find(c => c.compKey === D.compKey) || D : pickComp(want);
  if (FORCE || !D || d.compKey !== D.compKey) { FORCE = false; openComp(d); }
  if (location.hash !== UI.route) { UI.route = location.hash; UI.tab = play ? 'play' : 'order'; }
  if (UI.playonly) UI.tab = 'play';
  return skeleton();
}

/* ---------- sample data (?demo): one competition with two sessions, 11 gymnasts, 7 with music, built-in tracks and an announcement ---------- */
function tone(freqs, secs, amp = 0.18){   // a small WAV (8 kHz, 8-bit) so the player really plays something
  const rate = 8000, n = Math.round(rate * secs), buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) { const t = i / rate, f = freqs[Math.floor(t * 2) % freqs.length], env = Math.min(1, t * 4, (secs - t) * 4);
    v.setUint8(44 + i, 128 + Math.round(127 * amp * env * Math.sin(2 * Math.PI * f * t))); }
  return URL.createObjectURL(new Blob([buf], {type: 'audio/wav'}));
}
function demoData(){
  const plus = k => { const d = new Date(); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
  const at = new Date(Date.now() - 2 * 864e5).toISOString();
  const el = {'demo-east': {compKey: 'demo-east', title: 'General League · East Region (example)', date: plus(30), deadline: longDate(plus(16)), floorRotations: 2,
    clubs: {saadi: {name: 'SAADI Gymnastics', bg: '40556'}, northgate: {name: 'Northgate Gymnastics Club', bg: '204511'}, riverside: {name: 'Riverside Gym Academy', bg: '91877'}},
    levels: [
      {id: '1', name: 'Level 1', session: 'Morning (Levels 1 and 2)', gymnasts: [['d101', 'Amelia Roberts', 'saadi', '11'], ['d102', 'Isla Thompson', 'northgate', '12'], ['d103', 'Grace Walker', 'riverside', '13'], ['d104', 'Ruby King', 'saadi', '14']]},
      {id: '2', name: 'Level 2', session: 'Morning (Levels 1 and 2)', gymnasts: [['d201', 'Freya Hughes', 'northgate', '21'], ['d202', 'Poppy Evans', 'saadi', '22'], ['d203', 'Evie Clarke', 'riverside', '23']]},
      {id: '3', name: 'Level 3', session: 'Afternoon (Level 3)', gymnasts: [['d301', 'Ava Morgan', 'saadi', '31'], ['d302', 'Sophie Turner', 'northgate', '32'], ['d303', 'Lily Ahmed', 'riverside', '33'], ['d304', 'Millie Shaw', 'saadi', '34']]}],
    floorOrder: {'Morning (Levels 1 and 2)': {at, rotations: [['d101', 'd102', 'd103', 'd104'], ['d201', 'd202', 'd203']]}, 'Afternoon (Level 3)': {at, rotations: [['d301', 'd302'], ['d303']]}}}};
  ELEV_AT = at;
  const cal = [{id: 'demo-east', name: 'General League · East Region (example)', date: plus(30)}, {id: 'demo-west', name: 'General League · West Midlands (example)', date: plus(100)}];
  ACCOUNTS = [{uid: 'demo', name: 'SAADI Gymnastics', bg: '40556', email: 'demo@club.example'}, {uid: 'c2', name: 'Northgate Gymnastics Club', bg: '204511', email: 'info@northgate.example'}];
  BOOK = {[clubKeyName('Riverside Gym Academy')]: {email: 'office@riverside.example', club: 'Riverside Gym Academy', bookedAt: at}};
  const E = el['demo-east'], gymClub = {};
  E.levels.forEach(L => L.gymnasts.forEach(g => { if (g[0] !== 'd304') gymClub[g[0]] = g[2]; }));   // Millie Shaw was added after publishing
  DEMO.events['demo-east'] = {title: E.title, date: E.date, deadline: E.deadline, status: 'open', clubs: E.clubs, gymClub, publishedAt: at, absent: {d203: true}, intros: {},
    levels: E.levels.map(L => ({id: L.id, name: L.name, session: L.session, gymnasts: L.gymnasts.filter(g => g[0] !== 'd304').map(([id, name, club]) => ({id, name, club}))}))};
  const owner = {saadi: 'demo', northgate: 'c2', riverside: 'admin'}, notes = [[523, 659], [440, 554], [392, 494], [349, 440], [330, 415], [294, 370], [262, 330]];
  ['d101', 'd102', 'd104', 'd201', 'd202', 'd301', 'd302'].forEach((id, i) => { const L = E.levels.find(x => x.gymnasts.some(g => g[0] === id)), g = L.gymnasts.find(x => x[0] === id);
    DEMO.uploads['demo-east_' + id] = {compId: 'demo-east', gymnastId: id, gymnastName: g[1], level: L.id, clubKey: g[2], clubName: E.clubs[g[2]].name, clubId: owner[g[2]],
      fileName: g[1].toLowerCase().replace(/\s+/g, '-') + '-floor.mp3', size: 96000, path: '', url: tone(notes[i], 12), uploadedBy: id === 'd302' ? 'admin' : ''}; });
  DEMO.events._builtin = {walkon: {name: 'NGL Walk On (example)', url: tone([392, 523, 659, 523], 10)}, awards: {name: 'NGL Medal Ceremony (example)', url: tone([523, 784], 10)},
    closing: {name: 'NGL Closing (example)', url: tone([659, 523, 392], 10)},
    bg: {name: 'NGL background (example)', tracks: [{n: 1, name: 'Background track 1 (example)', url: tone([220, 277, 330], 20, 0.1)}, {n: 2, name: 'Background track 2 (example)', url: tone([247, 311, 370], 20, 0.1)}]},
    ann: [{k: 'demoann1', name: 'Welcome and safety (example)', url: tone([600, 600, 450], 8), path: '', order: 0}]};
  return {cal, el};
}
