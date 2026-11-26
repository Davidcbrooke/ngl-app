// NGL Admin · Judging. Copied from the admin part of GYMNASTICS-RESULTS/ngl-judging-pathway.html (?admin=1): the same
// applications list, stats, Accept / Edit / Decline with the judge's notification, Registered Judges with the tier and
// qualification override, Delete judge, Email All Judges / Copy Emails, and Manage Resources. Same wording and logic;
// only the shell, look and data layer change. The judge-facing pages (register, My Pathway, quiz, calendar) stay live.
// Data (same names and document ids as the live judging app, so Staffing keeps working):
//   ngl_judges/{judge uid}, ngl_judging_assignments/{id}, ngl_judge_notifications/{id}, ngl_resources/{id},
//   resource files in Storage at resources/{timestamp}-{file name}.
// Routes: #/admin/judging (applications), #/admin/judging/judges, #/admin/judging/resources.
// ?demo keeps every change in memory and never writes.
import { fb } from '../firebase.js';
import { MODE } from '../data.js';
import { ENV, RULES_BASE } from '../config.js';
import { esc, pill, modal as uiModal, toast, tabs } from '../ui.js';

// The shared dialog, named after its heading for screen readers
function modal(html){
  const m = uiModal(html), d = m.querySelector('.modal'), h = m.querySelector('h2');
  if (d && h) { h.id = 'jdDlgTitle'; d.setAttribute('aria-labelledby', 'jdDlgTitle'); }
  return m;
}

const COLL = {
  judges: 'ngl_judges',                        // Judging Pathway profiles, id = the judge's login uid
  assignments: 'ngl_judging_assignments',      // applications and bookings (Staffing reads the confirmed ones)
  notifications: 'ngl_judge_notifications',    // messages the judge sees on their Pathway profile
  resources: 'ngl_resources'                   // documents and links on the judges' Resources tab
};
const LIVE_TOOLS = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/';
const PATHWAY_URL = LIVE_TOOLS + 'ngl-judging-pathway.html';
const LIVE = MODE !== 'demo';

// ══ ROLE DEFINITIONS ══ (icons dropped: the app uses no emoji)
const ROLES = {
  shadow:       { label: 'Shadow' },
  second_judge: { label: 'Second Judge' },
  judge:        { label: 'Main Judge' }
};
// ══ TIER DEFINITIONS (simplified 3-tier pathway) ══
const TIERS = {
  1: { name: 'Apprentice Judge' },
  2: { name: 'Club Judge' },
  3: { name: 'Senior Judge' }
};
const SENIOR_QUALS = ['Regional Judge', 'National Judge', 'Brevet'];
const SHADOWS_TO_UNLOCK_JUNIOR = 3;

// ══ QUALIFICATIONS ══
const QUAL_LEVELS = ['None', 'Club Judge', 'Regional Judge', 'National Judge', 'Brevet'];
const QUAL_DISCIPLINES = ['Not Discipline-Specific', 'WAG (Girls)', 'MAG (Boys)'];
const QUAL_RANK = { 'None': 1, 'Club Judge': 2, 'Regional Judge': 3, 'National Judge': 3, 'Brevet': 3 };
const RES_CATEGORIES = ['Rules & Handbooks', 'BG Courses & Links', 'Templates & Forms', 'Other'];

function highestLevelOfRows(rows){
  let best = 'None';
  rows.forEach(r => { if ((QUAL_RANK[r.level] || 1) > (QUAL_RANK[best] || 1)) best = r.level; });
  return best;
}
// Reads a profile's qualifications as an array, falling back to the old single-string field
// so accounts created before multi-qualification support still work.
function getQualifications(profile){
  if (Array.isArray(profile.qualifications) && profile.qualifications.length) return profile.qualifications;
  if (profile.qualification && profile.qualification !== 'None') return [{ discipline: 'Not Discipline-Specific', level: profile.qualification }];
  return [];
}
const highestQualLevel = profile => highestLevelOfRows(getQualifications(profile));
function formatQualifications(profile){
  const quals = getQualifications(profile);
  if (!quals.length) return 'None';
  return quals.map(q => q.discipline && q.discipline !== 'Not Discipline-Specific' ? q.level + ' (' + q.discipline.split(' ')[0] + ')' : q.level).join(', ');
}
// Tier is driven by BG qualification, with one experience-based route to Club Judge for those with no qualification yet.
function calcTier(profile, shadowCount){
  const qual = highestQualLevel(profile);
  let qualTier = 1;
  if (qual === 'Club Judge') qualTier = 2;
  if (SENIOR_QUALS.includes(qual)) qualTier = 3;
  let expTier = 1;
  if (shadowCount >= SHADOWS_TO_UNLOCK_JUNIOR) expTier = 2;
  const num = Math.max(qualTier, expTier);
  return { num, ...TIERS[num] };
}
function getJudgeTier(judge){
  const mine = S.assigns.filter(a => a.judgeUid === judge.uid && a.status === 'confirmed');
  const shadowCount = new Set(mine.filter(a => a.role === 'shadow').map(a => a.compId)).size + (judge.priorShadowed || 0);
  return calcTier(judge, shadowCount);
}

/* ---------- Sample data (?demo): judges at every tier, pending applications, confirmed and declined bookings ---------- */
const iso = (d, h = 10) => new Date(Date.now() - d * 864e5 + h * 36e5).toISOString();
const DEMO = {
  judges: [
    {uid:'demo-j1', name:'Sarah Collins', club:'Hitchin GC', email:'sarah@example.com', phone:'07700 900504', qualifications:[{discipline:'WAG (Girls)', level:'Regional Judge'}], qualification:'Regional Judge', priorShadowed:0, priorSecondJudged:0, createdAt:iso(60)},
    {uid:'demo-j2', name:'Priya Shah', club:'Luton Gym Club', email:'priya@example.com', phone:'07700 900111', qualifications:[{discipline:'WAG (Girls)', level:'National Judge'}, {discipline:'MAG (Boys)', level:'Club Judge'}], qualification:'National Judge', priorShadowed:0, priorSecondJudged:0, createdAt:iso(45)},
    {uid:'demo-j3', name:'Tom Ellis', club:'Watford GC', email:'tom@example.com', phone:'07700 900222', qualifications:[{discipline:'Not Discipline-Specific', level:'Club Judge'}], qualification:'Club Judge', priorShadowed:0, priorSecondJudged:2, createdAt:iso(30)},
    {uid:'demo-j4', name:'Megan Hart', club:'SAADI Gymnastics', email:'megan@example.com', phone:'07700 900333', qualifications:[], qualification:'None', priorShadowed:1, priorSecondJudged:0, createdAt:iso(20)},
    {uid:'demo-j5', name:'Lily Moss', club:'Northgate Gymnastics Club', email:'lily@example.com', phone:'07700 900666', qualifications:[], qualification:'None', priorShadowed:0, priorSecondJudged:0, createdAt:iso(6)},
    {uid:'demo-j6', name:'Chloe Grant', club:'Herts Academy', email:'chloe@example.com', phone:'07700 900444', qualifications:[{discipline:'MAG (Boys)', level:'Regional Judge'}], qualification:'Regional Judge', priorShadowed:0, priorSecondJudged:0, createdAt:iso(14)},
    {uid:'demo-j7', name:'Ben Okafor', club:'Riverside Gym Academy', email:'ben@example.com', phone:'07700 900777', qualification:'Club Judge', priorShadowed:0, priorSecondJudged:0, createdAt:iso(400)}   // older account: single qualification field
  ],
  assigns: [
    {id:'demo-a1', judgeUid:'demo-j1', judgeName:'Sarah Collins', compId:'c1', compName:'General League · East Region', compDate:'2027-02-07', compVenue:'SAADI Gymnastics, Harpenden', discipline:'WAG', piece:'Vault', role:'judge', status:'confirmed', judgingMode:'in person', quotedFee:75, confirmedTime:'09:00', payment:75, assignedAt:iso(25), confirmedAt:iso(24)},
    {id:'demo-a2', judgeUid:'demo-j2', judgeName:'Priya Shah', compId:'c1', compName:'General League · East Region', compDate:'2027-02-07', compVenue:'SAADI Gymnastics, Harpenden', discipline:'WAG', piece:'Beam', role:'judge', status:'pending', judgingMode:'remote', quotedFee:50, assignedAt:iso(3)},
    {id:'demo-a3', judgeUid:'demo-j3', judgeName:'Tom Ellis', compId:'c1', compName:'General League · East Region', compDate:'2027-02-07', compVenue:'SAADI Gymnastics, Harpenden', discipline:'WAG', piece:'Uneven Bars', role:'second_judge', status:'pending', assignedAt:iso(2)},
    {id:'demo-a4', judgeUid:'demo-j4', judgeName:'Megan Hart', compId:'c1', compName:'General League · East Region', compDate:'2027-02-07', compVenue:'SAADI Gymnastics, Harpenden', discipline:'WAG', piece:'Beam', role:'shadow', status:'pending', assignedAt:iso(1)},
    {id:'demo-a5', judgeUid:'demo-j6', judgeName:'Chloe Grant', compId:'c2', compName:'General League · East Region', compDate:'2027-02-14', compVenue:'SAADI Gymnastics, Harpenden', discipline:'MAG', piece:'Floor', role:'judge', status:'pending', assignedAt:iso(4)},
    {id:'demo-a6', judgeUid:'demo-j4', judgeName:'Megan Hart', compId:'ngl-2026-finals-a', compName:'NGL National Finals: Level A', compDate:'2026-11-22', compVenue:'', discipline:'WAG', piece:'Floor', role:'shadow', status:'confirmed', confirmedTime:'08:30', payment:0, assignedAt:iso(40), confirmedAt:iso(38)},
    {id:'demo-a7', judgeUid:'demo-j3', judgeName:'Tom Ellis', compId:'ngl-2026-finals-bc', compName:'NGL National Finals: Levels B and C', compDate:'2026-11-22', compVenue:'', discipline:'WAG', piece:'Vault', role:'second_judge', status:'confirmed', confirmedTime:'13:30', payment:50, assignedAt:iso(42), confirmedAt:iso(39)},
    {id:'demo-a8', judgeUid:'demo-j5', judgeName:'Lily Moss', compId:'c3', compName:'General League · West Midlands', compDate:'2027-02-21', compVenue:'TBC', discipline:'WAG', piece:'Floor', role:'shadow', status:'declined', assignedAt:iso(5), declinedAt:iso(4)},
    {id:'demo-a9', judgeUid:'demo-j7', judgeName:'Ben Okafor', compId:'c2', compName:'General League · East Region', compDate:'2027-02-14', compVenue:'SAADI Gymnastics, Harpenden', discipline:'MAG', piece:'Rings', role:'second_judge', status:'pending', assignedAt:iso(0, 9)}
  ],
  resources: [
    {id:'demo-r1', title:'NGL 2027 WAG Rules', description:'General League Levels 1 to 4', category:'Rules & Handbooks', type:'file', url:RULES_BASE + 'NGL_General_League_WAG_Rules_2027.pdf', createdAt:iso(30)},
    {id:'demo-r2', title:'WAG Element Book 2027', description:'Uncoded and common coded elements', category:'Rules & Handbooks', type:'file', url:RULES_BASE + 'NGL_General_League_WAG_Element_Guide_2027.pdf', createdAt:iso(28)},
    {id:'demo-r3', title:'British Gymnastics judging courses', description:'Club, Regional and National judge courses', category:'BG Courses & Links', type:'link', url:'https://www.british-gymnastics.org/', createdAt:iso(20)}
  ],
  notifications: []
};

/* ---------- state ---------- */
const S = { loaded:null, assigns:[], judges:[], resources:[], errs:[], search:'', filter:'pending', resType:'file', qual:[], qualUid:null };
let FS = null, DB = null;
const onScreen = () => !!document.getElementById('jdRoot');
const now = () => new Date().toISOString();
const showErr = m => { if (!S.errs.includes(m)) S.errs.push(m); };
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '';
const roleLabel = a => ROLES[a.role] ? ROLES[a.role].label : '';
const STATUS_PILL = {pending:['Pending', 'warn'], confirmed:['Confirmed', 'ok'], declined:['Declined', 'red']};
const statusPill = s => pill(...(STATUS_PILL[s] || [s, '']));
const RES_ICON = {
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>'
};
const resIcon = t => `<span class="jd-resic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${RES_ICON[t === 'link' ? 'link' : 'file']}</svg></span>`;

/* ---------- data ---------- */
async function loadAllJudges(){
  if (!LIVE) { S.judges = DEMO.judges.map(j => ({...j})); return; }
  const snap = await FS.getDocs(FS.collection(DB, COLL.judges));
  S.judges = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}
// Live lists: applications and resources update as they change (same as the original); judges load once and after each change.
function listen(coll, key){
  return new Promise(res => {
    let first = true;
    FS.onSnapshot(FS.collection(DB, coll), snap => {
      S[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (first) { first = false; res(); } else refresh();
    }, e => { console.error(e); showErr(`Couldn't read ${coll} (${e.code || e.message}).`); if (first) { first = false; res(); } });
  });
}
async function load(){
  if (!LIVE) {
    S.judges = DEMO.judges.map(j => ({...j})); S.assigns = DEMO.assigns.map(a => ({...a})); S.resources = DEMO.resources.map(r => ({...r}));
    return;
  }
  try { const {fs, D} = await fb(); FS = fs; DB = D; }
  catch (e) { console.error(e); showErr('Couldn\'t connect to the database (' + (e.code || e.message) + ').'); return; }
  await Promise.all([
    loadAllJudges().catch(e => { console.error(e); showErr(`Couldn't read ${COLL.judges} (${e.code || e.message}).`); }),
    listen(COLL.assignments, 'assigns'),
    listen(COLL.resources, 'resources')
  ]);
}
const notify = async rec => { if (LIVE) await FS.addDoc(FS.collection(DB, COLL.notifications), rec); else DEMO.notifications.push(rec); };
async function updateAssign(id, patch){
  if (LIVE) await FS.updateDoc(FS.doc(DB, COLL.assignments, id), patch);
  else { const a = S.assigns.find(x => x.id === id); Object.assign(a, patch); }
}

/* ---------- screen ---------- */
function statsHTML(){
  const A = S.assigns;
  return `<div class="card stat"><b>${A.filter(a => (a.status || 'pending') === 'pending').length}</b><span>Pending</span></div>
    <div class="card stat"><b>${A.filter(a => a.status === 'confirmed').length}</b><span>Confirmed</span></div>
    <div class="card stat"><b>${S.judges.length}</b><span>Registered Judges</span></div>
    <div class="card stat jd-total"><b>${A.length}</b><span>Total Applications</span></div>`;
}
const tierPill = tier => tier ? `<span class="jd-tier t${tier.num}">${esc(tier.name)}</span>` : '';

function appListHTML(){
  const search = S.search.toLowerCase(), filter = S.filter;
  let rows = [...S.assigns].sort((a, b) => (b.assignedAt || '').localeCompare(a.assignedAt || ''));
  if (filter) rows = rows.filter(a => (a.status || 'pending') === filter);
  if (search) rows = rows.filter(a => (a.judgeName || '').toLowerCase().includes(search) || (a.compName || '').toLowerCase().includes(search));
  if (!rows.length) return '<p class="empty">No applications match this filter.</p>';
  return rows.map(a => {
    const status = a.status || 'pending';
    const judge = S.judges.find(j => j.uid === a.judgeUid);
    const tier = judge ? getJudgeTier(judge) : null;
    const actions = status === 'pending'
      ? `<button class="btn sm" data-act="jd-accept" data-id="${esc(a.id)}">Accept</button><button class="btn sm ghost" data-act="jd-decline" data-id="${esc(a.id)}">Decline</button>`
      : status === 'confirmed'
        ? `<span class="jd-meta">£${esc(a.payment != null ? a.payment : 50)} · ${esc(a.confirmedTime || '')}</span><button class="btn sm ghost" data-act="jd-accept" data-id="${esc(a.id)}">Edit</button>`
        : '<span class="jd-meta">Declined</span>';
    return `<div class="jd-row" data-id="${esc(a.id)}">
      <div><b>${esc(a.judgeName)}</b><div class="jd-meta">${tierPill(tier)}</div></div>
      <div>${esc(a.compName)}<div class="jd-meta">${fmtDate(a.compDate)}</div></div>
      <div>${esc(roleLabel(a))} · ${esc(a.piece)} <span class="jd-meta">(${esc(a.discipline)})</span>${a.judgingMode ? ` <span class="pill">${esc(a.judgingMode)}</span>` : ''}</div>
      <div>${statusPill(status)}</div>
      <div class="jd-acts">${actions}</div></div>`;
  }).join('');
}
function applicationsHTML(){
  return `<div class="card jd-card"><div class="jd-toolbar">
      <label class="jd-search"><span class="sr">Search</span><input type="search" id="jdSearch" placeholder="Search judge or competition…" value="${esc(S.search)}" aria-label="Search judge or competition"></label>
      <label><span class="sr">Show</span><select id="jdFilter" aria-label="Which applications">
        ${[['pending', 'Pending only'], ['confirmed', 'Confirmed only'], ['declined', 'Declined only'], ['', 'All applications']].map(([v, l]) => `<option value="${v}" ${S.filter === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <div id="jdAppList">${appListHTML()}</div></div>`;
}

function judgeListHTML(){
  if (!S.judges.length) return '<p class="empty">No judges registered yet.</p>';
  return [...S.judges].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(j => {
    const tier = getJudgeTier(j);
    return `<div class="jd-row jd-jrow" data-uid="${esc(j.uid)}">
      <div><b>${esc(j.name || '')}</b><div class="jd-meta">${esc(j.email || '')}${j.club ? ' · ' + esc(j.club) : ''}</div></div>
      <div>${tierPill(tier)}<div class="jd-meta">BG: ${esc(formatQualifications(j))}</div></div>
      <div class="jd-acts"><button class="btn sm ghost" data-act="jd-qual" data-uid="${esc(j.uid)}">Edit Qualification</button>
        <button class="btn sm ghost jd-danger" data-act="jd-del-judge" data-uid="${esc(j.uid)}">Delete</button></div></div>`;
  }).join('');
}
function judgesHTML(){
  return `<div class="card jd-card"><h2>Registered Judges</h2><p class="lead jd-sub">Override a judge's qualification if it changes</p><div id="jdJudgeList">${judgeListHTML()}</div></div>`;
}

function resListHTML(){
  if (!S.resources.length) return '<p class="empty">No resources yet.</p>';
  return S.resources.map(r => `<div class="jd-res">${resIcon(r.type)}<div class="grow"><b>${esc(r.title)}</b><small>${esc(r.category || '')}</small></div>
    ${r.url ? `<a class="btn sm ghost" href="${esc(r.url)}" target="_blank" rel="noopener">${r.type === 'link' ? 'Open' : 'Download'}</a>` : ''}
    <button class="btn sm ghost" data-act="jd-del-res" data-id="${esc(r.id)}">Delete</button></div>`).join('');
}
function resourcesHTML(){
  const f = S.resType === 'file';
  return `<div class="card jd-card"><h2>Manage Resources</h2><p class="lead jd-sub">Upload documents or add links for judges to access</p>
    <form id="jdResForm" novalidate>
      <div class="jd-seg" role="group" aria-label="Resource type"><button type="button" class="${f ? 'on' : ''}" aria-pressed="${f}" data-act="jd-restype" data-t="file">Upload Document</button><button type="button" class="${f ? '' : 'on'}" aria-pressed="${!f}" data-act="jd-restype" data-t="link">Add Link</button></div>
      <label class="field"><span>Title</span><input id="jdResTitle" placeholder="e.g. NGL 2027 WAG Rules"></label>
      <label class="field"><span>Description</span><input id="jdResDesc" placeholder="Short description shown to judges"></label>
      <label class="field"><span>Category</span><select id="jdResCat">${RES_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>
      <label class="field" id="jdResFileF" ${f ? '' : 'hidden'}><span>File</span><input type="file" id="jdResFile"></label>
      <label class="field" id="jdResLinkF" ${f ? 'hidden' : ''}><span>URL</span><input type="text" id="jdResLink" placeholder="https://..."></label>
      <div class="btn-row"><button class="btn" id="jdResAdd">+ Add Resource</button></div></form>
    <div id="jdResList" class="jd-reslist">${resListHTML()}</div>
    <p class="lead jd-note">Judges see these on the Resources tab of the <a href="${PATHWAY_URL}" target="_blank" rel="noopener">Judging Pathway</a>.</p></div>`;
}

const SUB = [['', 'Applications'], ['judges', 'Registered Judges'], ['resources', 'Manage Resources']];
function view(sub){
  return `<div class="jd" id="jdRoot">
    ${S.errs.length ? `<div class="card attn jd-err">${S.errs.map(esc).join('<br>')}</div>` : ''}
    ${LIVE ? '' : '<p class="jd-demo">Sample data: nothing here is saved and no judge is notified.</p>'}
    <div class="jd-head"><div class="grow"><h2>Judging Applications</h2><p class="lead">Review, accept, and confirm judges for each competition</p></div>
      <div class="jd-headbtns"><button class="btn sm ghost" data-act="jd-email-all">Email All Judges</button><button class="btn sm ghost" data-act="jd-copy-emails">Copy Emails</button>
        <a class="btn sm ghost" href="#/admin/staffing">Staffing</a></div></div>
    <div class="grid g4 jd-stats" id="jdStats">${statsHTML()}</div>
    ${tabs(SUB, sub, '#/admin/judging')}
    ${sub === 'judges' ? judgesHTML() : sub === 'resources' ? resourcesHTML() : applicationsHTML()}</div>`;
}
// Live updates without redrawing the whole page (keeps focus in the search box and any open dialog)
function refresh(){
  if (!onScreen()) return;
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('jdStats', statsHTML()); set('jdAppList', appListHTML()); set('jdJudgeList', judgeListHTML()); set('jdResList', resListHTML());
}

/* ---------- dialogs ---------- */
function qualRowsHTML(){
  const rows = S.qual;
  return rows.map((row, i) => `<div class="jd-qrow">
      <label class="field"><span>${i === 0 ? 'Discipline' : '<span class="sr">Discipline</span>'}</span><select data-jq="${i}" data-f="discipline" aria-label="Discipline ${i + 1}">${QUAL_DISCIPLINES.map(d => `<option value="${esc(d)}" ${row.discipline === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
      <label class="field"><span>${i === 0 ? 'Qualification' : '<span class="sr">Qualification</span>'}</span><select data-jq="${i}" data-f="level" aria-label="Qualification ${i + 1}">${QUAL_LEVELS.map(l => `<option value="${esc(l)}" ${row.level === l ? 'selected' : ''}>${l === 'None' ? 'None yet' : esc(l)}</option>`).join('')}</select></label>
      ${rows.length > 1 ? `<button type="button" class="btn sm ghost jd-qx" data-act="jd-qdel" data-i="${i}" aria-label="Remove this qualification">Remove</button>` : ''}</div>`).join('')
    + '<button type="button" class="btn sm ghost" data-act="jd-qadd">+ Add Another Qualification</button>';
}
const drawQualRows = () => { const el = document.getElementById('jdQualRows'); if (el) el.innerHTML = qualRowsHTML(); };

// A yes/no dialog in place of the browser's confirm(): same question, app look.
function ask(title, body, yes, fn){
  const m = modal(`<div class="jd-dlg"><h2>${esc(title)}</h2>${body}<p class="err" id="jdAskErr"></p>
    <div class="btn-row"><button class="btn" id="jdYes">${esc(yes)}</button><button class="btn ghost" type="button" data-close>Cancel</button></div></div>`);
  const btn = m.querySelector('#jdYes');
  btn.addEventListener('click', async () => { btn.disabled = true; try { await fn(); m.remove(); } catch (e) { btn.disabled = false; } });
  return m;
}

/* ---------- emails (mailto with everyone BCC'd, same pattern as the booking system) ---------- */
function getAllJudgeEmails(){ return [...new Set(S.judges.map(j => (j.email || '').trim()).filter(Boolean))]; }
const testAddress = e => /@example\.(com|org|net)$/i.test(e);

/* ---------- buttons (data-act="jd-…"): the app shell sends clicks here ---------- */
export const JD = {
  'jd-accept'(b){
    const a = S.assigns.find(x => x.id === b.dataset.id); if (!a) return;
    const isEdit = a.status === 'confirmed';
    const summary = a.judgeName + ' — ' + roleLabel(a) + ': ' + a.piece + ' (' + a.discipline + ')' + (a.judgingMode ? ' — ' + a.judgingMode + ' judging' : '') + ' at ' + a.compName;
    const pay = (isEdit && a.payment != null) ? a.payment : (a.quotedFee != null ? a.quotedFee : 50);
    const m = modal(`<div class="jd-dlg"><h2>${isEdit ? 'Edit Judge Booking' : 'Confirm Judge Booking'}</h2><p class="lead" id="jdAcceptSum">${esc(summary)}</p>
      <form id="jdAcceptForm" data-id="${esc(a.id)}" novalidate>
        <label class="field"><span>Confirmed Time <span class="req">*</span></span><input id="jdTime" placeholder="e.g. 09:00 – 10:30" value="${esc(isEdit ? (a.confirmedTime || '') : '')}" autocomplete="off"></label>
        <label class="field"><span>Payment (£)</span><input id="jdPay" type="number" min="0" value="${esc(pay)}"></label>
        <p class="jd-hint">The judge will see this time and payment in a notification on their Pathway profile.</p>
        <p class="err" id="jdAcceptErr"></p>
        <div class="btn-row"><button class="btn" id="jdAcceptBtn">${isEdit ? 'Save & Notify Judge' : 'Confirm & Notify Judge'}</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form></div>`);
    m.querySelector('#jdTime').focus();
  },
  'jd-decline'(b){
    const a = S.assigns.find(x => x.id === b.dataset.id); if (!a) return;
    ask('Decline application', `<p>Decline ${esc(a.judgeName)}'s application to judge ${esc(a.piece)} at ${esc(a.compName)}?</p>`, 'Decline', async () => {
      try {
        await updateAssign(a.id, { status: 'declined', declinedAt: now() });
        await notify({ judgeUid: a.judgeUid, type: 'declined',
          message: 'Your application to judge ' + a.piece + ' at ' + a.compName + " wasn't accepted this time. Check the calendar for other competitions to apply for.",
          createdAt: now() });
        toast('Application declined');
        if (!LIVE) refresh();
      } catch (e) { console.error(e); toast('Could not decline this application: ' + e.message, false); throw e; }
    });
  },
  'jd-qual'(b){
    const j = S.judges.find(x => x.uid === b.dataset.uid); if (!j) return;
    const existing = getQualifications(j);
    S.qualUid = j.uid; S.qual = existing.length ? existing.map(q => ({...q})) : [{ discipline: 'Not Discipline-Specific', level: 'None' }];
    const m = modal(`<div class="jd-dlg"><h2>Update Qualification</h2><p class="lead">${esc(j.name + ' — currently ' + formatQualifications(j))}</p>
      <div class="jd-qlabel">British Gymnastics Qualification(s)</div><div id="jdQualRows">${qualRowsHTML()}</div>
      <div class="btn-row"><button class="btn" data-act="jd-qsave">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></div>`);
    m.querySelector('select').focus();
  },
  'jd-qadd'(){ S.qual.push({ discipline: 'Not Discipline-Specific', level: 'None' }); drawQualRows(); },
  'jd-qdel'(b){ S.qual.splice(+b.dataset.i, 1); if (!S.qual.length) S.qual.push({ discipline: 'Not Discipline-Specific', level: 'None' }); drawQualRows(); },
  async 'jd-qsave'(b){
    const uid = S.qualUid, qualifications = S.qual.filter(r => r.level !== 'None'), qualification = highestLevelOfRows(S.qual);
    b.disabled = true;
    try {
      if (LIVE) { await FS.updateDoc(FS.doc(DB, COLL.judges, uid), { qualifications, qualification }); await loadAllJudges(); }
      else Object.assign(S.judges.find(j => j.uid === uid), { qualifications, qualification });
      b.closest('.modal-bg').remove(); toast('Qualification updated'); refresh();
    } catch (e) { console.error(e); b.disabled = false; toast('Could not update qualification: ' + e.message, false); }
  },
  'jd-del-judge'(b){
    const uid = b.dataset.uid, j = S.judges.find(x => x.uid === uid), name = j ? j.name : 'this judge';
    ask('Delete ' + name + '’s pathway profile?', `<p>This removes their pathway profile, competition applications and notifications.</p>
      <p class="jd-warn"><b>Important:</b> this does NOT delete their login (email/password). That has to be removed separately in the Firebase Console (Authentication tab) if you want to free up their email address for re-registration.</p>`, 'Delete', async () => {
      try {
        if (LIVE) {
          await FS.deleteDoc(FS.doc(DB, COLL.judges, uid));
          const assignSnap = await FS.getDocs(FS.query(FS.collection(DB, COLL.assignments), FS.where('judgeUid', '==', uid)));
          await Promise.all(assignSnap.docs.map(d => FS.deleteDoc(FS.doc(DB, COLL.assignments, d.id))));
          const notifSnap = await FS.getDocs(FS.query(FS.collection(DB, COLL.notifications), FS.where('judgeUid', '==', uid)));
          await Promise.all(notifSnap.docs.map(d => FS.deleteDoc(FS.doc(DB, COLL.notifications, d.id))));
          await loadAllJudges();
        } else {
          S.judges = S.judges.filter(x => x.uid !== uid); S.assigns = S.assigns.filter(a => a.judgeUid !== uid);
          DEMO.notifications = DEMO.notifications.filter(n => n.judgeUid !== uid);
        }
        toast(name + ' deleted'); refresh();
      } catch (e) { console.error(e); toast('Could not delete this judge: ' + e.message, false); throw e; }
    });
  },
  'jd-email-all'(){
    const all = getAllJudgeEmails();
    if (!all.length) { toast('No judge emails found yet.', false); return; }
    // Sandbox rule: made-up test addresses (example.com etc.) are left out, and the subject is marked as a test.
    const emails = all.filter(e => !testAddress(e));
    if (!emails.length) { toast('No judge emails found yet (example.com test addresses are skipped).', false); return; }
    const subject = encodeURIComponent((ENV === 'sandbox' ? '[SANDBOX TEST] ' : '') + 'NGL Judging Pathway');
    window.location.href = 'mailto:?bcc=' + encodeURIComponent(emails.join(';')) + '&subject=' + subject;
  },
  async 'jd-copy-emails'(){
    const emails = getAllJudgeEmails();
    if (!emails.length) { toast('No judge emails found yet.', false); return; }
    const list = emails.join('; ');
    try {
      await navigator.clipboard.writeText(list);
      toast('Copied ' + emails.length + ' judge email address' + (emails.length === 1 ? '' : 'es') + ' to the clipboard.');
    } catch (e) {
      modal(`<div class="jd-dlg"><h2>Judge email addresses</h2><p>Could not copy automatically. Here are the addresses:</p>
        <label class="field"><span>Addresses</span><textarea rows="6" readonly>${esc(list)}</textarea></label>
        <div class="btn-row"><button class="btn ghost" type="button" data-close>Close</button></div></div>`);
    }
  },
  'jd-restype'(b){
    S.resType = b.dataset.t === 'link' ? 'link' : 'file';
    document.querySelectorAll('#jdResForm [data-act=jd-restype]').forEach(x => { const on = x.dataset.t === S.resType; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    document.getElementById('jdResFileF').hidden = S.resType !== 'file';
    document.getElementById('jdResLinkF').hidden = S.resType !== 'link';
  },
  'jd-del-res'(b){
    const r = S.resources.find(x => x.id === b.dataset.id); if (!r) return;
    ask('Remove this resource?', `<p>${esc(r.title)}</p>`, 'Remove', async () => {
      try {
        if (LIVE) await FS.deleteDoc(FS.doc(DB, COLL.resources, r.id));
        else { S.resources = S.resources.filter(x => x.id !== r.id); refresh(); }
        toast('Resource removed');
      } catch (e) { console.error(e); toast('Error removing: ' + e.message, false); throw e; }
    });
  }
};

/* Accept / edit a booking: writes the booking, then the judge's notification (same message as before) */
async function confirmAccept(form){
  const id = form.dataset.id, err = form.querySelector('#jdAcceptErr'), btn = form.querySelector('#jdAcceptBtn');
  const confirmedTime = form.querySelector('#jdTime').value.trim();
  const payment = parseFloat(form.querySelector('#jdPay').value) || 0;
  err.textContent = '';
  if (!confirmedTime) { err.textContent = 'Please enter a confirmed time.'; form.querySelector('#jdTime').focus(); return; }
  const a = S.assigns.find(x => x.id === id); if (!a) return;
  const isEdit = a.status === 'confirmed';
  const rl = ROLES[a.role] ? ROLES[a.role].label : 'Judge';
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (isEdit) await updateAssign(id, { confirmedTime, payment, updatedAt: now() });
    else await updateAssign(id, { status: 'confirmed', confirmedTime, payment, confirmedAt: now() });
    await notify({ judgeUid: a.judgeUid, type: 'confirmed',
      message: (isEdit ? 'Booking updated: your ' + rl + ' booking for ' : "You're booked! You've been confirmed as " + rl + ' for ') +
        a.piece + ' (' + a.discipline + ')' + (a.judgingMode ? ', ' + a.judgingMode + ' judging,' : '') + ' at ' + a.compName +
        '. Time: ' + confirmedTime + '. Payment: £' + payment + '.',
      createdAt: now() });
    form.closest('.modal-bg').remove();
    toast(isEdit ? 'Booking updated and judge notified' : 'Booking confirmed and judge notified');
    if (!LIVE) refresh();
  } catch (e) {
    console.error(e); btn.disabled = false; btn.textContent = isEdit ? 'Save & Notify Judge' : 'Confirm & Notify Judge';
    err.textContent = 'Could not confirm this application: ' + e.message;
  }
}

async function addResource(form){
  const title = form.querySelector('#jdResTitle').value.trim(), description = form.querySelector('#jdResDesc').value.trim(), category = form.querySelector('#jdResCat').value;
  if (!title) { toast('Please enter a title.', false); return; }
  const btn = form.querySelector('#jdResAdd'), done = () => { btn.disabled = false; btn.textContent = '+ Add Resource'; };
  btn.disabled = true; btn.textContent = 'Adding…';
  try {
    let url = '';
    if (S.resType === 'link') {
      url = form.querySelector('#jdResLink').value.trim();
      if (!url) { toast('Please enter a URL.', false); done(); return; }
    } else {
      const file = form.querySelector('#jdResFile').files[0];
      if (!file) { toast('Please choose a file.', false); done(); return; }
      if (LIVE) {
        const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
        const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const fileRef = st.ref(st.getStorage(getApp()), 'resources/' + Date.now() + '-' + file.name);
        await st.uploadBytes(fileRef, file);
        url = await st.getDownloadURL(fileRef);
      } else url = URL.createObjectURL(file);
    }
    const rec = { title, description, category, type: S.resType, url, createdAt: now() };
    if (LIVE) await FS.addDoc(FS.collection(DB, COLL.resources), rec);
    else { S.resources.push({ id: 'demo-r' + Date.now(), ...rec }); refresh(); }
    ['#jdResTitle', '#jdResDesc', '#jdResFile', '#jdResLink'].forEach(s => { form.querySelector(s).value = ''; });
    toast('Resource added');
  } catch (e) { console.error(e); toast('Could not add resource: ' + e.message, false); }
  done();
}

/* Forms, search and filter: document-level listeners, only for this app's elements */
document.addEventListener('submit', e => {
  if (e.target.id === 'jdAcceptForm') { e.preventDefault(); confirmAccept(e.target); }
  else if (e.target.id === 'jdResForm') { e.preventDefault(); addResource(e.target); }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'jdSearch') return;
  S.search = e.target.value; const el = document.getElementById('jdAppList'); if (el) el.innerHTML = appListHTML();
});
document.addEventListener('change', e => {
  if (e.target.id === 'jdFilter') { S.filter = e.target.value; const el = document.getElementById('jdAppList'); if (el) el.innerHTML = appListHTML(); return; }
  const q = e.target.dataset && e.target.dataset.jq;
  if (q !== undefined && S.qual[+q]) S.qual[+q][e.target.dataset.f] = e.target.value;
});

/* The screen: #/admin/judging[/judges|/resources] */
export default async function judging(me = {}, parts = []){
  if (!S.loaded) S.loaded = load();
  await S.loaded;
  const sub = ['judges', 'resources'].includes(parts && parts[0]) ? parts[0] : '';
  return view(sub);
}
