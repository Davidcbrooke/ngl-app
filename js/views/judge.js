// Judges in the one NGL app: the judge-facing NGL Judging Pathway, copied from GYMNASTICS-RESULTS/ngl-judging-pathway.html.
// Same wording, features and logic: register / sign in, My Pathway (profile card, tier, apparatus experience, next tier,
// Fun Quiz personal bests, notifications, my assignments with + My Calendar and Withdraw / Cancel), Judge a Competition
// (role, discipline and piece, remote or in person, fees), Fun Quiz, Judging Calendar and Resources.
// Only the shell, look and data layer change: the app's login (same Firebase project as the app), app styles, no emoji.
// The admin part (?admin=1) is NGL Admin > Judging (js/admin/judging.js).
// Shown when localStorage 'ngl.who' is 'judge' (Welcome > Judge), for a login with a judge profile and no club, or ?demo&judge.
// Routes: #/judge (My Pathway), #/judge/signup, #/judge/quiz, #/judge/calendar, #/judge/resources.
import { esc, toast, modal as uiModal } from '../ui.js';
import { BRAND } from '../config.js';
import * as J from '../judge/data.js';
import { QUIZ_BANKS } from '../judge/quiz-bank.js';

const S = J.S;
export const hasProfile = J.hasProfile;
export function remember(){ try { localStorage.setItem('ngl.who', 'judge'); } catch (_) {} }

// ══ APPARATUS DEFINITIONS ══
const WAG_PIECES = ['Vault', 'Uneven Bars', 'Beam', 'Floor'];
const MAG_PIECES = ['Floor', 'Pommel Horse', 'Rings', 'Vault', 'Parallel Bars', 'High Bar'];
// ══ ROLE DEFINITIONS ══ (icons dropped: the app uses no emoji)
const ROLES = {
  shadow:       { label: 'Shadow' },
  second_judge: { label: 'Second Judge' },
  judge:        { label: 'Main Judge' }
};
// which roles each tier may apply for (main judge for Club Judge is admin discretion at confirm time)
const ROLES_BY_TIER = { 1: ['shadow'], 2: ['shadow', 'second_judge', 'judge'], 3: ['shadow', 'second_judge', 'judge'] };
// ══ TIER DEFINITIONS (simplified 3-tier pathway) ══
const TIERS = { 1: { name: 'Apprentice Judge' }, 2: { name: 'Club Judge' }, 3: { name: 'Senior Judge' } };
const SENIOR_QUALS = ['Regional Judge', 'National Judge', 'Brevet'];
const SHADOWS_TO_UNLOCK_JUNIOR = 3;
const QUAL_LEVELS = ['None', 'Club Judge', 'Regional Judge', 'National Judge', 'Brevet'];
const QUAL_DISCIPLINES = ['Not Discipline-Specific', 'WAG (Girls)', 'MAG (Boys)'];
const QUAL_RANK = { 'None': 1, 'Club Judge': 2, 'Regional Judge': 3, 'National Judge': 3, 'Brevet': 3 };
const NEW_ROW = () => ({ discipline: 'Not Discipline-Specific', level: 'None' });
const QUAL_STATE = { register: [NEW_ROW()], completeProfile: [], editProfile: [] };

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
function calcSpecialism(count){
  if (count >= 5) return { tier: 'Expert', pct: 100 };
  if (count >= 3) return { tier: 'Skilled', pct: Math.min(100, (count / 5) * 100) };
  if (count >= 1) return { tier: 'Developing', pct: Math.min(100, (count / 5) * 100) };
  return { tier: 'New', pct: 0 };
}
// My counts: confirmed bookings (one per competition) plus what the judge did before NGL
function myCounts(){
  const uid = S.user ? S.user.uid : '', p = S.profile || {};
  const mine = S.assigns.filter(a => a.judgeUid === uid && a.status === 'confirmed');
  const shadowCount = new Set(mine.filter(a => a.role === 'shadow').map(a => a.compId)).size + (p.priorShadowed || 0);
  const secondCount = new Set(mine.filter(a => a.role === 'second_judge').map(a => a.compId)).size + (p.priorSecondJudged || 0);
  const judgeAssignments = mine.filter(a => (a.role || 'judge') === 'judge');
  const judgeCount = new Set(judgeAssignments.map(a => a.compId)).size;
  return { shadowCount, secondCount, judgeAssignments, judgeCount };
}

// ══ SIGN-UP TO JUDGE: remote or in person, and the fee ══
const PIECE_MODES = {
  'Vault':       { mode: 'in person', fee: 75 },
  'Uneven Bars': { mode: 'in person', fee: 75 },
  'Beam':        { mode: 'remote',    fee: 50 },
  'Floor':       { mode: 'remote',    fee: 50 }
};
// Mode and fee rules currently cover Main Judge bookings on the WAG pieces only.
function pieceInfo(role, piece, discipline){
  if (role !== 'judge' || discipline !== 'WAG') return null;
  return PIECE_MODES[piece] || null;
}
const pieceInfoText = info => info.mode === 'remote'
  ? 'Remote judging — £50 per competition (2 competitions in the day).'
  : 'In-person judging — £75 per competition (£150 for the whole event).';
const piecesFor = discipline => discipline === 'MAG' ? MAG_PIECES : WAG_PIECES;

/* ---------- small building blocks ---------- */
const ICON = {
  1: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3.5 2.3 8.5 2.3 12 0v-5M22 9v5"/>',
  2: '<circle cx="12" cy="15" r="5"/><path d="M8.5 3l3.5 7 3.5-7M12 13v4"/>',
  3: '<path d="M8 4h8v4a4 4 0 0 1-8 0zM6 4H3v2a3 3 0 0 0 3 3M18 4h3v2a3 3 0 0 1-3 3M12 12v4M8 20h8M10 16h4v4h-4z"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>', bad: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'
};
const ic = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;
const STATUS_PILL = { pending: ['Pending', 'warn'], confirmed: ['Confirmed', 'ok'], declined: ['Declined', 'red'] };
const statusPill = s => { const [t, k] = STATUS_PILL[s] || [s, '']; return `<span class="pill ${k}">${esc(t)}</span>`; };
const dateBadge = iso => { const d = iso ? new Date(iso + 'T00:00:00') : null;
  return `<div class="jg-date"><b>${d ? d.getDate() : '-'}</b><span>${d ? d.toLocaleString('en-GB', { month: 'short' }).toUpperCase() : ''}</span></div>`; };
function modal(html){
  const m = uiModal(html), d = m.querySelector('.modal'), h = m.querySelector('h2');
  if (d && h) { h.id = 'jgDlgTitle'; d.setAttribute('aria-labelledby', 'jgDlgTitle'); }
  return m;
}
// A yes/no dialog in place of the browser's confirm(): same question, app look.
function ask(title, body, yes, fn){
  const m = modal(`<div class="jg-dlg"><h2>${esc(title)}</h2>${body}
    <div class="btn-row"><button class="btn" id="jgYes">${esc(yes)}</button><button class="btn ghost" type="button" data-close>Cancel</button></div></div>`);
  const btn = m.querySelector('#jgYes');
  btn.addEventListener('click', async () => { btn.disabled = true; try { await fn(); m.remove(); if (dirty) setTimeout(changed, 0); } catch (e) { btn.disabled = false; } });
  return m;
}
const field = (id, label, type = 'text', extra = '', req = false) =>
  `<label class="field"><span>${label}${req ? ' <i class="jg-req">*</i>' : ''}</span><input id="${id}" type="${type}" ${extra}></label>`;
const gate = (title, text) => `<div class="card jg-gate"><b>${esc(title)}</b>${esc(text)}</div>`;

// ══ QUALIFICATION ROWS (shared: registration, finish setting up, edit my profile) ══
function qualRowsHTML(key){
  const rows = QUAL_STATE[key];
  return rows.map((row, i) => `<div class="jg-qrow">
      <label class="field"><span>${i === 0 ? 'Discipline' : '<span class="sr">Discipline</span>'}</span><select data-jq="${key}" data-i="${i}" data-f="discipline" aria-label="Discipline ${i + 1}">${QUAL_DISCIPLINES.map(d => `<option value="${esc(d)}" ${row.discipline === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
      <label class="field"><span>${i === 0 ? 'Qualification' : '<span class="sr">Qualification</span>'}</span><select data-jq="${key}" data-i="${i}" data-f="level" aria-label="Qualification ${i + 1}">${QUAL_LEVELS.map(l => `<option value="${esc(l)}" ${row.level === l ? 'selected' : ''}>${l === 'None' ? 'None yet' : esc(l)}</option>`).join('')}</select></label>
      ${rows.length > 1 ? `<button type="button" class="btn sm ghost jg-qx" data-jg="qdel" data-k="${key}" data-i="${i}" aria-label="Remove this qualification">Remove</button>` : ''}</div>`).join('')
    + `<button type="button" class="btn sm ghost" data-jg="qadd" data-k="${key}">+ Add Another Qualification</button>`;
}
const drawQual = key => { const el = document.getElementById('jgQual-' + key); if (el) el.innerHTML = qualRowsHTML(key); if (key === 'register') togglePriorExperience(); };
function togglePriorExperience(){
  const el = document.getElementById('jgPrior'); if (el) el.hidden = highestLevelOfRows(QUAL_STATE.register) !== 'None';
}

/* ---------- My Pathway ---------- */
const heroHTML = () => `<section class="jg-hero"><div class="jg-kicker">National Gymnastics League · Judging Pathway</div>
  <h1>From First Shadow to <em>Paid Judging.</em></h1>
  <p>One route from never having judged before, to getting paid £50 to judge from home on a Sunday — built on real competition experience, alongside your British Gymnastics qualifications.</p></section>`;
const whyHTML = () => `<div class="jg-why">${[
  ['Apprentice Judge', 'Start your judging journey', 'New to judging? No qualification needed to begin. Shadow real NGL competitions, learn from qualified judges, and build toward your first BG qualification — completely free.'],
  ['Club Judge', 'Turn your qualification into experience — and paid work', 'Already BG Club Judge qualified? Get second-judging (and sometimes main-judging) experience at real competitions, build toward Regional level, and pick up paid remote bookings when a Senior Judge isn\'t available.'],
  ['Senior Judge', 'Get paid to judge from home', 'Regional qualified or above? You\'re first in line for remote judging bookings from clubs — £50 per competition, judging live from wherever you are, on your own schedule.']]
  .map(([t, h, p]) => `<div class="card jg-whycard"><div class="jg-wt">${t}</div><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>`;
const pathwayHTML = () => `<div class="jg-eyebrow">The Journey</div><h2 class="jg-sec">The NGL Judging Pathway</h2>
  <p class="jg-secsub">Three tiers. Earned by doing the job — or unlocked instantly with a British Gymnastics qualification.</p>
  <div class="jg-pw">${[
    [1, '1. Apprentice Judge', 'No qualification needed', ['Everyone starts here', 'Shadow real competitions', 'Shadow 3+ to unlock Club Judge']],
    [2, '2. Club Judge', 'BG Club Judge, or 3+ shadows', ['Second-judge real competitions', 'Main-judge when approved by NGL', 'Eligible for paid remote judging']],
    [3, '3. Senior Judge', 'BG Regional Judge or above', ['Main-judge any competition', 'First priority for paid remote judging', '£50 per Sunday competition']]]
    .map(([n, t, u, li]) => `<div class="jg-pwcard"><span class="jg-pwi">${ic(n)}</span><b>${t}</b><small>${u}</small><ul>${li.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>`;

let authMode = (() => { try { return localStorage.getItem('ngl.judgeInvite') ? 'register' : 'login'; } catch (_) { return 'login'; } })();   // a club's invite opens on Register
function authHTML(){
  const reg = authMode === 'register';
  return `<div class="card jg-auth"><div class="jg-cardhead"><h2>Join the NGL Judging Pathway</h2><p>Register once, judge forever</p></div>
    <div class="jg-seg" role="tablist"><button type="button" role="tab" aria-selected="${!reg}" class="${reg ? '' : 'on'}" data-jg="mode" data-m="login" id="jgTabLogin">Sign In</button><button type="button" role="tab" aria-selected="${reg}" class="${reg ? 'on' : ''}" data-jg="mode" data-m="register" id="jgTabRegister">Register</button></div>
    ${reg ? `<form id="jgRegister" novalidate>
      ${field('jgRgName', 'Full Name', 'text', 'placeholder="e.g. Sam Taylor" autocomplete="name"', true)}
      ${field('jgRgClub', 'Club', 'text', 'placeholder="e.g. Northgate Gymnastics Club" autocomplete="organization"')}
      <div class="jg-two">${field('jgRgEmail', 'Email', 'email', 'placeholder="you@example.com" autocomplete="email"', true)}${field('jgRgPhone', 'Phone', 'tel', 'placeholder="07xxx xxxxxx" autocomplete="tel"', true)}</div>
      ${field('jgRgPassword', 'Password', 'password', 'placeholder="At least 6 characters" autocomplete="new-password"', true)}
      <div class="jg-qlabel">British Gymnastics Qualification(s)</div><div id="jgQual-register">${qualRowsHTML('register')}</div>
      <p class="jg-hint">Add one row per discipline if you're qualified in more than one. Your highest qualification sets your starting tier: none = Apprentice, Club Judge = Club Judge, Regional or above = Senior.</p>
      <div id="jgPrior" ${highestLevelOfRows(QUAL_STATE.register) === 'None' ? '' : 'hidden'}><div class="jg-two">
        ${field('jgRgPriorShadow', 'Shadowed Before?', 'number', 'min="0" value="0" inputmode="numeric"')}${field('jgRgPriorSecond', 'Second-Judged Before?', 'number', 'min="0" value="0" inputmode="numeric"')}</div>
        <p class="jg-hint">How many competitions have you already shadowed or second-judged (outside NGL)? This counts toward your tier.</p></div>
      <label class="field"><span>Photo</span><input type="file" id="jgRgPhoto" accept="image/*"></label><p class="jg-hint">Optional — you can add this later too.</p>
      <button class="btn jg-wide" id="jgBtnRegister">Join the Pathway →</button><p class="err" id="jgRegErr" role="alert"></p></form>`
    : `<form id="jgLogin" novalidate>
      ${field('jgLiEmail', 'Email', 'email', 'placeholder="you@example.com" autocomplete="email"', true)}
      ${field('jgLiPassword', 'Password', 'password', 'autocomplete="current-password"', true)}
      <button class="btn jg-wide" id="jgBtnLogin">Sign In →</button>
      <p class="jg-forgot"><a href="#" data-jg="forgot">Forgotten your password?</a></p><p class="err" id="jgLoginErr" role="alert"></p></form>`}</div>`;
}
function completeProfileHTML(){
  return `<div class="card jg-auth"><div class="jg-cardhead"><h2>Finish Setting Up Your Account</h2><p>Your login worked, but your profile didn't finish saving last time — just a couple of details and you're in</p></div>
    <form id="jgComplete" novalidate>
      ${field('jgCpName', 'Full Name', 'text', 'placeholder="e.g. Sam Taylor" autocomplete="name"', true)}
      ${field('jgCpClub', 'Club', 'text', 'placeholder="e.g. Northgate Gymnastics Club" autocomplete="organization"')}
      ${field('jgCpPhone', 'Phone', 'tel', 'placeholder="07xxx xxxxxx" autocomplete="tel"', true)}
      <div class="jg-qlabel">British Gymnastics Qualification(s)</div><div id="jgQual-completeProfile">${qualRowsHTML('completeProfile')}</div>
      <button class="btn jg-wide" id="jgBtnComplete">Finish Setup →</button><p class="err" id="jgCompleteErr" role="alert"></p>
      <button type="button" class="btn ghost jg-wide" data-jg="logout">Not you? Sign Out</button></form></div>`;
}

function passportHTML(){
  const p = S.profile, { shadowCount, secondCount, judgeAssignments, judgeCount } = myCounts();
  const allPieces = [...new Set([...WAG_PIECES, ...MAG_PIECES])];
  const tier = calcTier(p, shadowCount);
  const app = allPieces.map(piece => {
    const count = judgeAssignments.filter(a => a.piece === piece).length, s = calcSpecialism(count);
    return `<div class="jg-app"><b>${esc(piece)}</b><div class="jg-bar"><i style="width:${s.pct}%"></i></div><small>${s.tier}${count ? ' · ' + count + 'x' : ''}</small></div>`;
  }).join('');
  const best = k => p[k] != null ? esc(p[k]) + '%' : '—';
  return `<div class="jg-passport" id="jgPassport">
      <div class="jg-ptop"><div class="jg-pid">
        <label class="jg-avatar" title="Change photo">${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt="">` : ic('person')}
          <span class="jg-avedit">${ic('edit')}</span><input type="file" id="jgPhotoEdit" accept="image/*" class="sr" aria-label="Change your photo"></label>
        <div><div class="jg-pkicker">NGL Judging Pathway</div><div class="jg-pname" id="jgPpName">${esc(p.name || '—')}</div>
          <div class="jg-pclub">${esc(p.club || '')}</div><div class="jg-pqual" id="jgPpQual">BG: ${esc(formatQualifications(p))}</div></div></div>
        <div class="jg-rank t${tier.num}" id="jgRank">${ic(tier.num)}<span>${esc(tier.name)}</span></div></div>
      <div class="jg-pstats"><div><b id="jgStatShadow">${shadowCount}</b><span>Shadowed</span></div><div><b id="jgStatSecond">${secondCount}</b><span>2nd Judged</span></div><div><b id="jgStatJudged">${judgeCount}</b><span>Judged</span></div></div>
      <div class="jg-apptitle">Apparatus Experience</div><div class="jg-apps">${app}</div></div>
    <button class="btn ghost jg-wide" data-jg="edit-profile">Edit My Profile</button>
    ${progressHTML(tier.num, shadowCount)}
    <a href="https://academy.elevien.com/" target="_blank" rel="noopener" class="jg-feat">${ic('target', 'jg-featic')}<div class="grow"><b>Practise on Elevien Academy</b><small>Score real competition routines and get instant accuracy feedback against the official panel.</small></div><span>Open →</span></a>
    <a class="card jg-quizpb" href="#/judge/quiz"><div class="jg-cardhead"><h2>Fun Quiz — Personal Bests</h2><p>Based on the NGL 2027 rules</p></div>
      <div class="jg-pbs"><div><b id="jgPbWag">${best('quizBestWag')}</b><span>Girls (WAG)</span></div><div><b id="jgPbMag">${best('quizBestMag')}</b><span>Boys (MAG)</span></div></div></a>
    <div class="card jg-list"><div class="jg-cardhead"><h2>Notifications</h2><p>Booking confirmations from NGL</p></div><div id="jgNotifs">${notificationsHTML()}</div></div>
    <div class="card jg-list"><div class="jg-cardhead"><h2>My Upcoming Assignments</h2><p>Where you're on the panel</p></div><div id="jgMine">${myAssignmentsHTML()}</div></div>
    <button class="btn ghost jg-wide" data-jg="logout">Sign Out</button>`;
}
function progressHTML(tierNum, shadowCount){
  const item = (done, text) => `<div class="jg-pitem ${done ? 'done' : ''}"><span class="jg-tick">${done ? ic('ok') : ''}</span><span>${text}</span></div>`;
  let title, sub, list;
  if (tierNum >= 3) { title = 'Top of the Pathway'; sub = 'You\'ve reached Senior Judge — eligible for paid remote judging bookings.'; list = '<p class="empty">Nothing left to unlock. Keep judging!</p>'; }
  else if (tierNum === 1) {
    title = 'Next Tier: Club Judge'; sub = 'Get there with a BG Club Judge qualification, or through real experience.';
    list = item(shadowCount >= SHADOWS_TO_UNLOCK_JUNIOR, `Shadow ${SHADOWS_TO_UNLOCK_JUNIOR}+ competitions (${shadowCount}/${SHADOWS_TO_UNLOCK_JUNIOR})`) + item(false, 'Or gain a BG Club Judge qualification');
  } else { title = 'Next Tier: Senior Judge'; sub = 'Senior Judge always requires a BG qualification — there\'s no experience shortcut for this one.'; list = item(false, 'Gain a BG Regional Judge qualification (or above)'); }
  return `<div class="card jg-list" id="jgProgress"><div class="jg-cardhead"><h2>${title}</h2><p>${sub}</p></div><div class="jg-plist">${list}</div></div>`;
}
function notificationsHTML(){
  const notifs = [...S.notifs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (!notifs.length) return '<p class="empty">No notifications yet.</p>';
  return notifs.map(n => {
    const k = n.type === 'confirmed' ? 'ok' : n.type === 'declined' ? 'bad' : 'bell';
    const time = n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    return `<div class="jg-notif"><span class="jg-nic ${k}">${ic(k)}</span><div><div>${esc(n.message)}</div><small>${esc(time)}</small></div></div>`;
  }).join('');
}
function myAssignmentsHTML(){
  const mine = S.assigns.filter(a => a.judgeUid === S.user.uid).sort((a, b) => (a.compDate || '').localeCompare(b.compDate || ''));
  if (!mine.length) return '<p class="jg-note">No assignments yet — head to "Judge a Competition" to get on the panel.</p>';
  return mine.map(a => {
    const status = a.status || 'pending';
    const roleLabel = ROLES[a.role] ? ROLES[a.role].label : a.piece;
    const extra = status === 'confirmed' ? `<span>${esc(a.confirmedTime || '')}</span><span>£${esc(a.payment != null ? a.payment : 50)}</span>` : '<span>Awaiting admin confirmation</span>';
    return `<div class="jg-comp signed" data-id="${esc(a.id)}"><div class="jg-comphead">${dateBadge(a.compDate)}
      <div class="grow"><b>${esc(a.compName)}</b> ${statusPill(status)}<div class="jg-meta"><span>${esc(roleLabel)} · ${esc(a.piece)}${a.judgingMode ? ' · ' + esc(a.judgingMode) : ''}</span>${extra}</div></div>
      <div class="jg-acts">${status === 'confirmed' ? `<button class="btn sm" data-jg="ics" data-id="${esc(a.id)}">+ My Calendar</button>` : ''}
        <button class="btn sm ghost" data-jg="cancel" data-id="${esc(a.id)}">${status === 'confirmed' ? 'Cancel' : 'Withdraw'}</button></div></div></div>`;
  }).join('');
}

function pagePathway(){
  if (!S.user) return heroHTML() + whyHTML() + pathwayHTML() + authHTML();
  if (!S.profile) return heroHTML() + completeProfileHTML();
  return `<h1 class="jg-h1">My Pathway</h1>` + passportHTML() + `<details class="jg-about"><summary>About the NGL Judging Pathway</summary>${whyHTML()}${pathwayHTML()}</details>`;
}

/* ---------- Judge a Competition ---------- */
function pageSignup(){
  const head = `<div class="jg-eyebrow">2027 Season</div><h1 class="jg-h1">Judge a Competition</h1>
    <p class="jg-secsub">Pick a competition, choose the piece you'll judge, and it's added straight to the judging calendar.</p>
    <div class="card jg-how"><div class="jg-howt">Before you apply — how judging works (Girls / WAG)</div>
      <div class="jg-howgrid"><div><b>Beam &amp; Floor — remote judging</b><br>£50 per competition, with 2 competitions in the day.</div>
        <div><b>Vault &amp; Uneven Bars — in person</b><br>£75 per competition (£150 for the whole event).</div></div>
      <p class="jg-hint">Fees apply to Main Judge bookings. If you apply for more than one competition, please choose the same piece each time where you can — it keeps scoring consistent.</p></div>`;
  if (!S.user) return head + gate('Sign in to sign up', 'You need to join the NGL Judging Pathway before you can pick a competition. Head to the "My Pathway" tab to register or sign in.');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = S.comps.filter(c => new Date(c.date + 'T00:00:00') >= today).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!upcoming.length) return head + '<div class="card empty">No upcoming competitions on the calendar yet. Check back soon.</div>';
  const myTier = S.profile ? calcTier(S.profile, myCounts().shadowCount).num : 1;
  const allowedRoles = ROLES_BY_TIER[myTier] || ['shadow'];
  return head + `<div id="jgSignupList">${upcoming.map(c => {
    const mine = S.assigns.filter(a => a.judgeUid === S.user.uid && a.compId === c.id);
    const pills = mine.map(a => `<span class="jg-mypill">${esc(ROLES[a.role] ? ROLES[a.role].label : a.piece)} · ${esc(a.piece)} ${statusPill(a.status || 'pending')}
      <button type="button" data-jg="cancel" data-id="${esc(a.id)}" aria-label="Remove ${esc(a.piece)} from the judging calendar">×</button></span>`).join('');
    const disc = c.gender === 'both' ? `<label class="field"><span>Discipline</span><select id="jgDisc-${esc(c.id)}" data-comp="${esc(c.id)}" data-sel="disc"><option value="WAG">Girls (WAG)</option><option value="MAG">Boys (MAG)</option></select></label>` : '';
    const fixed = c.gender === 'boys' ? 'MAG' : 'WAG';
    return `<div class="jg-comp ${mine.length ? 'signed' : ''}" data-comp="${esc(c.id)}"><div class="jg-comphead">${dateBadge(c.date)}
        <div class="grow"><b>${esc(c.name)}</b><div class="jg-meta"><span>${ic('pin', 'jg-pin')} ${esc(c.venue || 'TBC')}</span><span>${esc(c.level || '')}</span></div>
        ${pills ? `<div class="jg-mypills">${pills}</div>` : ''}</div></div>
      <div class="jg-assign">
        <label class="field"><span>Role</span><select id="jgRole-${esc(c.id)}" data-comp="${esc(c.id)}" data-sel="role">${allowedRoles.map(r => `<option value="${r}">${ROLES[r].label}</option>`).join('')}</select></label>
        ${disc}
        <label class="field"><span>Piece</span><select id="jgPiece-${esc(c.id)}" data-comp="${esc(c.id)}" data-sel="piece">${piecesFor(fixed).map(p => `<option value="${p}">${p}</option>`).join('')}</select></label>
        <button class="btn" data-jg="apply" data-comp="${esc(c.id)}">Apply</button>
        <div class="jg-pinfo" id="jgInfo-${esc(c.id)}" hidden></div></div></div>`;
  }).join('')}</div>`;
}
function discOf(compId){
  const sel = document.getElementById('jgDisc-' + compId), comp = S.comps.find(c => c.id === compId) || {};
  return sel ? sel.value : (comp.gender === 'boys' ? 'MAG' : 'WAG');
}
function updatePieceInfo(compId){
  const el = document.getElementById('jgInfo-' + compId); if (!el) return;
  const role = document.getElementById('jgRole-' + compId), piece = document.getElementById('jgPiece-' + compId);
  const info = pieceInfo(role ? role.value : '', piece ? piece.value : '', discOf(compId));
  el.textContent = info ? pieceInfoText(info) : ''; el.hidden = !info;
}

/* ---------- Fun Quiz ---------- */
const Q = { type: null, order: [], index: 0, answers: [], view: 'menu', result: null };
function pageQuiz(){
  const head = `<div class="jg-eyebrow">Just for Fun</div><h1 class="jg-h1">NGL Judging Quiz</h1>
    <p class="jg-secsub">50 questions built from the actual NGL 2027 rules. Doesn't affect your tier — just a fun way to test your knowledge and beat your own best.</p>`;
  if (!S.user) return head + gate('Sign in to play', 'You need to join the NGL Judging Pathway to take the quiz and save your scores. Head to "My Pathway" to register or sign in.');
  if (!S.profile) return head + gate('Profile not found', 'Your login exists but no pathway profile is linked to it. Please sign out and register again, or contact an NGL admin.');
  if (Q.view === 'active') return head + quizQuestionHTML();
  if (Q.view === 'result') return head + quizResultHTML();
  const best = k => S.profile[k] != null ? esc(S.profile[k]) + '%' : '—';
  return head + [['wag', 'Girls Judging Quiz (WAG)', 'Vault, Bars, Beam &amp; Floor — General League Levels 1 to 4', 'quizBestWag'],
                 ['mag', 'Boys Judging Quiz (MAG)', 'Floor, Mushroom/Rings, Vault, Parallel Bars &amp; H.Bar — General League Levels 1 to 4', 'quizBestMag']]
    .map(([t, h, p, k]) => `<div class="card jg-qcard"><div class="jg-cardhead"><h2>${h}</h2><p>${p}</p></div>
      <div class="jg-qbody"><div><small>Personal Best</small><b id="jgMenuQuiz-${t}">${best(k)}</b></div><button class="btn" data-jg="quiz-start" data-t="${t}">Start →</button></div></div>`).join('');
}
function quizQuestionHTML(){
  const q = Q.order[Q.index], answered = Q.answers[Q.index] !== undefined, last = Q.index === Q.order.length - 1;
  return `<div class="card jg-quiz" id="jgQuiz"><div class="jg-qtop"><span class="pill">${Q.type === 'wag' ? 'Girls (WAG)' : 'Boys (MAG)'}</span>
      <span class="jg-meta" id="jgQuizProgress">Question ${Q.index + 1} of ${Q.order.length}</span></div>
    <div class="jg-bar light"><i style="width:${Math.round((Q.index / Q.order.length) * 100)}%"></i></div>
    <h2 class="jg-qq" id="jgQuizQ">${esc(q.q)}</h2>
    <div class="jg-opts">${q.options.map((opt, i) => {
      let cls = ''; if (answered) cls = i === Q.picked ? (Q.answers[Q.index] ? 'right' : 'wrong') : 'dim';
      return `<button class="jg-opt ${cls}" data-jg="quiz-pick" data-i="${i}" ${answered ? 'disabled' : ''}>${esc(opt)}</button>`; }).join('')}</div>
    ${answered ? `<p class="jg-fb ${Q.answers[Q.index] ? 'right' : 'wrong'}" id="jgQuizFb" role="status">${Q.answers[Q.index] ? 'Correct!' : 'Not quite — on to the next one.'}</p>
      <button class="btn jg-wide" data-jg="quiz-next" id="jgQuizNext">${last ? 'See My Result →' : 'Next Question →'}</button>` : ''}</div>`;
}
function quizResultHTML(){
  const r = Q.result;
  return `<div class="jg-passport jg-qres" id="jgQuizResult"><div class="jg-qresic">${ic(r.pct >= 90 ? 3 : r.pct >= 70 ? 'ok' : 1)}</div>
      <div class="jg-pkicker">${r.isNewBest ? 'New Personal Best!' : 'Personal Best: ' + esc(r.prevBest) + '%'}</div>
      <div class="jg-qpct" id="jgQuizPct">${r.pct}%</div><div class="jg-pclub">${r.correct} / ${r.total} correct</div></div>
    <button class="btn jg-wide" data-jg="quiz-start" data-t="${Q.type}">Retake Quiz</button>
    <button class="btn ghost jg-wide" data-jg="quiz-menu">Back to Quizzes</button>`;
}
async function submitQuiz(){
  const correct = Q.answers.filter(Boolean).length, total = Q.order.length, pct = Math.round((correct / total) * 100);
  const fieldName = Q.type === 'wag' ? 'quizBestWag' : 'quizBestMag';
  const prevBest = S.profile ? S.profile[fieldName] : null;
  const isNewBest = (prevBest == null) || (pct > prevBest);
  if (isNewBest && S.user && S.profile) {
    try { await J.updateProfile(S.user.uid, { [fieldName]: pct }); S.profile[fieldName] = pct; }
    catch (e) { /* non-critical, quiz is just for fun */ console.warn(e); }
  }
  Q.result = { correct, total, pct, isNewBest, prevBest }; Q.view = 'result';
}

/* ---------- Judging Calendar ---------- */
const openCal = new Set();
function pageCalendar(){
  const head = `<div class="jg-eyebrow">Live · Updates in Real Time</div><h1 class="jg-h1">Judging Calendar</h1><p class="jg-secsub">Tap a competition to see who's judging what.</p>`;
  if (!S.user) return head + gate('Sign in to see the calendar', 'Head to the "My Pathway" tab to register or sign in.');
  if (!S.comps.length) return head + '<div class="card empty">No competitions on the calendar yet.</div>';
  const sorted = [...S.comps].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return head + `<div id="jgCalList">${sorted.map(c => {
    const assigns = S.assigns.filter(a => a.compId === c.id && a.status === 'confirmed');
    const pieces = [...new Set(assigns.map(a => a.piece))], open = openCal.has(c.id);
    const groups = pieces.length ? pieces.map(p => `<div class="jg-calgroup"><div class="jg-caltitle">${esc(p)}</div>${assigns.filter(a => a.piece === p).map(j =>
      `<div class="jg-calrow">${ic('person', 'jg-pin')} ${esc(j.judgeName)} <span class="pill">${esc(ROLES[j.role] ? ROLES[j.role].label : 'Judge')}</span> <span class="jg-meta">(${esc(j.discipline)})</span></div>`).join('')}</div>`).join('')
      : '<p class="jg-note">No confirmed judges yet for this competition.</p>';
    return `<div class="jg-comp jg-cal ${open ? 'open' : ''}" id="jgCal-${esc(c.id)}"><button class="jg-comphead jg-calbtn" data-jg="cal" data-id="${esc(c.id)}" aria-expanded="${open}">${dateBadge(c.date)}
        <div class="grow"><b>${esc(c.name)}</b><div class="jg-meta"><span>${ic('pin', 'jg-pin')} ${esc(c.venue || 'TBC')}</span></div></div>
        <span class="jg-count">${assigns.length} confirmed judge${assigns.length !== 1 ? 's' : ''}</span></button>
      <div class="jg-reveal" ${open ? '' : 'hidden'}>${groups}</div></div>`;
  }).join('')}</div>`;
}

/* ---------- Resources ---------- */
function pageResources(){
  const head = `<div class="jg-eyebrow">Reference Library</div><h1 class="jg-h1">Judge Resources</h1><p class="jg-secsub">Practice tools, rulebooks, guides, and links to British Gymnastics courses.</p>
    <a href="https://academy.elevien.com/" target="_blank" rel="noopener" class="jg-feat">${ic('target', 'jg-featic')}<div class="grow"><b>Elevien Academy — Judge Training</b><small>Score real competition routines synced from Elevien, get instant accuracy feedback, and sharpen your eye.</small></div><span>Open →</span></a>`;
  if (!S.user) return head + gate('Sign in to see the resources', 'Head to the "My Pathway" tab to register or sign in.');
  if (!S.resources.length) return head + '<div class="card empty">No further resources added yet. Check back soon.</div>';
  const categories = [...new Set(S.resources.map(r => r.category || 'Other'))];
  return head + `<div id="jgResList">${categories.map(cat => `<h2 class="jg-restitle">${esc(cat)}</h2>` + S.resources.filter(r => (r.category || 'Other') === cat).map(r =>
    `<a class="jg-res" href="${esc(r.url)}" target="_blank" rel="noopener">${ic(r.type === 'link' ? 'link' : 'file', 'jg-resic')}<div class="grow"><b>${esc(r.title)}</b>${r.description ? `<small>${esc(r.description)}</small>` : ''}</div>
      <span class="jg-meta">${r.type === 'link' ? 'Open →' : 'Download ↓'}</span></a>`).join('')).join('')}</div>`;
}

/* ---------- the shell ---------- */
const TABS = [['', 'My Pathway', pagePathway], ['signup', 'Judge a Competition', pageSignup], ['quiz', 'Fun Quiz', pageQuiz], ['calendar', 'Judging Calendar', pageCalendar], ['resources', 'Resources', pageResources]];
const tabKey = () => { const p = location.hash.replace(/^#\/?/, '').split('/'); return p[0] === 'judge' && TABS.some(t => t[0] === p[1]) ? p[1] : ''; };

function drawShell(){
  const root = document.getElementById('authRoot'), k = tabKey();
  root.innerHTML = `<div class="jg">
    <header class="jg-top"><img src="${BRAND}ngl-logo-full.png" alt="NGL"><div class="grow"><b>Judging Pathway</b><small id="jgWho">${esc(S.profile ? S.profile.name : S.user ? S.user.email : 'Register · Judge · Level Up')}</small></div>
      ${S.user ? '<button class="btn sm ghost" data-jg="logout">Sign out</button>' : ''}</header>
    <nav class="jg-tabs" aria-label="Judging Pathway">${TABS.map(([t, l]) => `<a href="#/judge${t ? '/' + t : ''}" class="${t === k ? 'on' : ''}" ${t === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    <main id="jgPage" class="jg-page"></main>
    <footer class="jg-foot"><b>National Gymnastics League</b> · Judging Pathway<br>Register · Judge · Level Up
      <br><a href="#" data-jg="switch-club">I’m a club</a> · <a href="#" data-jg="switch-parent">I’m a parent</a></footer></div>`;
  root.hidden = false; document.querySelector('.app').hidden = true;
}
// A club's invite link (?judge=invite): the club and the person, kept on this device until they register
function invite(){ try { return JSON.parse(localStorage.getItem('ngl.judgeInvite') || 'null'); } catch (_) { return null; } }
// The judge's profile is linked to the inviting club (so the club sees them) while they keep the club name the invite gave
function inviteClub(club){ const i = invite(); return i && i.clubId && (!club || club.toLowerCase() === String(i.club).toLowerCase()) ? {clubId: i.clubId} : {}; }
function fillInvite(){ const i = invite(); if (!i) return; const set = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
  set('jgRgName', i.name); set('jgRgEmail', i.email); set('jgRgClub', i.club); set('jgCpClub', i.club); }
function drawPage(){
  const page = document.getElementById('jgPage'); if (!page) return;
  const k = tabKey();
  document.querySelectorAll('.jg-tabs a').forEach(a => { const on = a.getAttribute('href') === '#/judge' + (k ? '/' + k : ''); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const who = document.getElementById('jgWho'); if (who) who.textContent = S.profile ? S.profile.name : S.user ? S.user.email : 'Register · Judge · Level Up';
  page.innerHTML = (S.errs.length ? `<div class="card attn jg-err">${S.errs.map(esc).join('<br>')}</div>` : '')
    + (J.LIVE ? '' : '<p class="jg-demo">Sample data: nothing here is saved and nobody is emailed.</p>')
    + TABS.find(t => t[0] === k)[2]();
  if (k === 'signup') S.comps.forEach(c => updatePieceInfo(c.id));
  fillInvite();
  document.title = TABS.find(t => t[0] === k)[1] + ' · NGL Judging Pathway';
  document.dispatchEvent(new CustomEvent('ngl:rendered'));
}
// Live changes (a booking confirmed, a new notification): redraw, unless the judge is in the middle of something
let dirty = false;
function changed(){
  const a = document.activeElement, busy = document.querySelector('.modal-bg') || Q.view === 'active' || (a && a.closest && a.closest('#jgPage') && /INPUT|SELECT|TEXTAREA/.test(a.tagName));
  if (busy) { dirty = true; return; }
  dirty = false; drawPage();
}
J.watch(changed);
document.addEventListener('focusout', () => { if (dirty) setTimeout(changed, 50); });

let BOUND = false;
export async function showJudge(){
  remember();
  if (!document.querySelector('link[data-jg-css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/judge.css'; l.dataset.jgCss = '1'; document.head.appendChild(l); }
  if (!location.hash.startsWith('#/judge')) history.replaceState(null, '', location.pathname + location.search + '#/judge');
  const root = document.getElementById('authRoot'); root.hidden = false; document.querySelector('.app').hidden = true;
  if (!document.querySelector('.jg')) root.innerHTML = '<div class="auth"><div><div class="box"><h1>Judging Pathway</h1><p class="lead">Loading…</p></div></div></div>';
  await J.load();
  if (S.user && !S.profile) QUAL_STATE.completeProfile = [NEW_ROW()];
  drawShell(); drawPage();
  if (!BOUND) { BOUND = true; bind(root); }
}
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/judge') && document.querySelector('.jg')) { if (Q.view === 'result') Q.view = 'menu'; drawPage(); window.scrollTo(0, 0); } });

/* ---------- friendly sign-in errors (same wording as the live page) ---------- */
function friendlyAuthError(e){
  const c = e.code || '';
  if (c.includes('email-already-in-use')) return 'That email is already registered. Try signing in instead.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Email or password not recognised.';
  if (c.includes('weak-password')) return 'Password must be at least 6 characters.';
  return 'Something went wrong: ' + e.message;
}
const showErr = (id, msg, ok = false) => { const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.toggle('jg-okmsg', ok); } };
const val = id => (document.getElementById(id) || {}).value || '';
const intVal = id => parseInt(val(id)) || 0;

/* ---------- forms ---------- */
async function doRegister(f){
  const name = val('jgRgName').trim(), club = val('jgRgClub').trim(), email = val('jgRgEmail').trim(), phone = val('jgRgPhone').trim(), pw = val('jgRgPassword');
  const qualifications = QUAL_STATE.register.filter(r => r.level !== 'None');
  const highestQual = highestLevelOfRows(QUAL_STATE.register);
  const photoFile = (document.getElementById('jgRgPhoto').files || [])[0];
  const showPrior = highestQual === 'None';
  const priorShadowed = showPrior ? intVal('jgRgPriorShadow') : 0, priorSecondJudged = showPrior ? intVal('jgRgPriorSecond') : 0;
  showErr('jgRegErr', '');
  if (!name) return showErr('jgRegErr', 'Please enter your name.');
  if (!email || !email.includes('@')) return showErr('jgRegErr', 'Please enter a valid email.');
  if (!phone) return showErr('jgRegErr', 'Please enter a contact phone number.');
  if (!pw || pw.length < 6) return showErr('jgRegErr', 'Password must be at least 6 characters.');
  const btn = f.querySelector('#jgBtnRegister'); btn.disabled = true; btn.textContent = 'Joining the pathway…';
  let user = null;
  try {
    user = await J.createLogin(email, pw);
    let photoUrl = '';
    if (photoFile) { try { photoUrl = await J.uploadPhoto(user.uid, photoFile); } catch (e) { console.warn('Photo not uploaded', e.code || e); /* photo upload failing shouldn't block registration */ } }
    // A judge has a pathway profile only: no clubs/{uid} document is made
    const profile = { name, club, email, phone, qualifications, qualification: highestQual, photoUrl, priorShadowed, priorSecondJudged, createdAt: new Date().toISOString(), ...inviteClub(club) };
    await J.saveProfile(user.uid, profile);
    window.NGL_JUDGE_LASTERR = '';
    await showJudge();
  } catch (e) {
    console.error(e); window.NGL_JUDGE_LASTERR = e.code || e.message || String(e);
    if (user || await J.currentLogin()) {
      // The login was created but the profile write failed (flaky connection, closed tab, etc).
      // Don't show a misleading "registration failed" error — the account exists; send them
      // to the recovery form instead, which writes the profile for this same login.
      await J.load();
      QUAL_STATE.completeProfile = qualifications.length ? qualifications.map(q => ({ ...q })) : [NEW_ROW()];
      drawShell(); drawPage();
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('jgCpName', name); set('jgCpClub', club); set('jgCpPhone', phone);
      return;
    }
    showErr('jgRegErr', friendlyAuthError(e)); btn.disabled = false; btn.textContent = 'Join the Pathway →';
  }
}
async function completeProfile(f){
  if (!S.user) return;
  const name = val('jgCpName').trim(), club = val('jgCpClub').trim(), phone = val('jgCpPhone').trim();
  const qualifications = QUAL_STATE.completeProfile.filter(r => r.level !== 'None');
  showErr('jgCompleteErr', '');
  if (!name) return showErr('jgCompleteErr', 'Please enter your name.');
  if (!phone) return showErr('jgCompleteErr', 'Please enter a contact phone number.');
  const btn = f.querySelector('#jgBtnComplete'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const profile = { name, club, email: S.user.email || '', phone, qualifications, qualification: highestLevelOfRows(QUAL_STATE.completeProfile), photoUrl: '',
      priorShadowed: 0, priorSecondJudged: 0, createdAt: new Date().toISOString(), ...inviteClub(club) };
    await J.saveProfile(S.user.uid, profile);
    window.NGL_JUDGE_LASTERR = '';
    await showJudge();
  } catch (e) {
    console.error(e); window.NGL_JUDGE_LASTERR = e.code || e.message || String(e);
    showErr('jgCompleteErr', 'Could not save your profile: ' + e.message); btn.disabled = false; btn.textContent = 'Finish Setup →';
  }
}
async function doLogin(f){
  const email = val('jgLiEmail').trim(), pw = val('jgLiPassword');
  showErr('jgLoginErr', '');
  if (!email || !pw) return showErr('jgLoginErr', 'Please enter your email and password.');
  const btn = f.querySelector('#jgBtnLogin'); btn.disabled = true; btn.textContent = 'Signing in…';
  try { await J.signIn(email, pw); await showJudge(); }
  catch (e) { console.error(e); showErr('jgLoginErr', friendlyAuthError(e)); btn.disabled = false; btn.textContent = 'Sign In →'; }
}
async function doForgot(){
  const email = val('jgLiEmail').trim();
  if (!email) return showErr('jgLoginErr', 'Type your email address above, then click "Forgotten your password?" again.');
  try {
    await J.resetPassword(email);
    showErr('jgLoginErr', 'If there is an account for ' + email + ', we have emailed a link to reset your password. Check your junk folder too.', true);
  } catch (e) {
    showErr('jgLoginErr', (e.code || '').includes('invalid-email') ? 'That email address doesn’t look right.' : 'We couldn’t send the reset email. Please try again.');
  }
}

function openEditProfile(){
  if (!S.user || !S.profile) return;
  const p = S.profile, existing = getQualifications(p);
  QUAL_STATE.editProfile = existing.length ? existing.map(q => ({ ...q })) : [NEW_ROW()];
  const m = modal(`<div class="jg-dlg"><h2>Edit My Profile</h2><form id="jgEditForm" novalidate>
      ${field('jgEpName', 'Full Name', 'text', `value="${esc(p.name || '')}" autocomplete="name"`, true)}
      ${field('jgEpClub', 'Club', 'text', `value="${esc(p.club || '')}" autocomplete="organization"`)}
      ${field('jgEpPhone', 'Phone', 'tel', `value="${esc(p.phone || '')}" autocomplete="tel"`, true)}
      <div class="jg-qlabel">British Gymnastics Qualification(s)</div><div id="jgQual-editProfile">${qualRowsHTML('editProfile')}</div>
      <p class="err" id="jgEditErr" role="alert"></p>
      <div class="btn-row"><button class="btn" id="jgBtnSaveProfile">Save Changes</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form></div>`);
  m.querySelector('#jgEpName').focus();
}
async function saveMyProfile(f){
  if (!S.user) return;
  const name = val('jgEpName').trim(), club = val('jgEpClub').trim(), phone = val('jgEpPhone').trim();
  const qualifications = QUAL_STATE.editProfile.filter(r => r.level !== 'None'), qualification = highestLevelOfRows(QUAL_STATE.editProfile);
  showErr('jgEditErr', '');
  if (!name) return showErr('jgEditErr', 'Please enter your name.');
  if (!phone) return showErr('jgEditErr', 'Please enter a contact phone number.');
  const btn = f.querySelector('#jgBtnSaveProfile'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await J.updateProfile(S.user.uid, { name, club, phone, qualifications, qualification });
    Object.assign(S.profile, { name, club, phone, qualifications, qualification });
    f.closest('.modal-bg').remove(); toast('Profile saved'); drawPage();
  } catch (e) { console.error(e); showErr('jgEditErr', 'Could not save your profile: ' + e.message); btn.disabled = false; btn.textContent = 'Save Changes'; }
}
async function uploadPhoto(input){
  const file = input.files[0]; if (!file || !S.user) return;
  try {
    const photoUrl = await J.uploadPhoto(S.user.uid, file);
    await J.updateProfile(S.user.uid, { photoUrl });
    S.profile.photoUrl = photoUrl; toast('Photo saved'); drawPage();
  } catch (e) { console.error(e); toast('Could not upload photo: ' + e.message, false); }
}

async function signUpToJudge(compId){
  if (!S.user) return;
  if (!S.profile) { toast('Finish setting up your account on My Pathway first.', false); return; }
  const comp = S.comps.find(c => c.id === compId); if (!comp) return;
  const discipline = discOf(compId), piece = val('jgPiece-' + compId), role = val('jgRole-' + compId) || 'shadow';
  const already = S.assigns.find(a => a.judgeUid === S.user.uid && a.compId === compId && a.piece === piece && a.discipline === discipline && a.role === role && a.status !== 'declined');
  if (already) { toast("You've already applied for that role/piece at this competition.", false); return; }
  const info = pieceInfo(role, piece, discipline);
  const save = async () => {
    try {
      const doc_ = { judgeUid: S.user.uid, judgeName: S.profile.name, compId, compName: comp.name, compDate: comp.date, compVenue: comp.venue || '',
        discipline, piece, role, status: 'pending', assignedAt: new Date().toISOString() };
      if (info) { doc_.judgingMode = info.mode; doc_.quotedFee = info.fee; }
      await J.addAssignment(doc_);
      window.NGL_JUDGE_LASTERR = '';
      toast('Application sent. NGL will confirm it.');
      if (!J.LIVE) drawPage();
    } catch (e) { console.error(e); window.NGL_JUDGE_LASTERR = e.code || e.message; toast('Could not save your application: ' + e.message, false); throw e; }
  };
  if (info) ask('Apply to judge', `<p>You are applying to judge ${esc(piece)} at ${esc(comp.name)}.</p><p>${esc(pieceInfoText(info))}</p><p>Continue?</p>`, 'Continue', save);
  else save().catch(() => {});
}
function cancelAssignment(id){
  ask('Remove this from the judging calendar?', '', 'Remove', async () => {
    try { await J.deleteAssignment(id); toast('Removed'); setTimeout(drawPage, 0); }
    catch (e) { console.error(e); toast('Error removing: ' + e.message, false); throw e; }
  });
}
// ══ ICS DOWNLOAD ══
function downloadICS(assignmentId){
  const a = S.assigns.find(x => x.id === assignmentId); if (!a) return;
  const dateStr = (a.compDate || '').replace(/-/g, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NGL Judging Pathway//EN', 'BEGIN:VEVENT',
    'UID:' + a.id + '@ngl-judging-pathway', 'DTSTART:' + dateStr + 'T090000', 'DTEND:' + dateStr + 'T170000',
    'SUMMARY:' + (ROLES[a.role] ? ROLES[a.role].label : 'Judging') + ' – ' + a.piece + ' (' + a.discipline + ') at ' + a.compName,
    'LOCATION:' + (a.compVenue || ''), 'DESCRIPTION:NGL judging duty. Check the NGL Judging Pathway for full details.',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  link.download = 'NGL-Judging-' + (a.compName || 'event').replace(/\s+/g, '-') + '.ics';
  document.body.appendChild(link); link.click(); link.remove();
}

/* ---------- events (bound once to #authRoot; dialogs live on <body>, so those go on document) ---------- */
function bind(root){
  const inJudge = el => el.closest('.jg') || el.closest('.jg-dlg');
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-jg]'); if (!b || !inJudge(b)) return;
    const act = b.dataset.jg;
    if (b.tagName === 'A') e.preventDefault();
    if (act === 'mode') { authMode = b.dataset.m; if (authMode === 'register') QUAL_STATE.register = [NEW_ROW()]; drawPage(); const i = document.querySelector('#jgPage form input'); if (i) i.focus(); }
    else if (act === 'forgot') doForgot();
    else if (act === 'logout') { b.disabled = true; await J.signOut(); authMode = 'login'; Q.view = 'menu'; await showJudge(); }
    else if (act === 'qadd') { QUAL_STATE[b.dataset.k].push(NEW_ROW()); drawQual(b.dataset.k); }
    else if (act === 'qdel') { const k = b.dataset.k; QUAL_STATE[k].splice(+b.dataset.i, 1); if (!QUAL_STATE[k].length) QUAL_STATE[k].push(NEW_ROW()); drawQual(k); }
    else if (act === 'edit-profile') openEditProfile();
    else if (act === 'apply') signUpToJudge(b.dataset.comp);
    else if (act === 'cancel') cancelAssignment(b.dataset.id);
    else if (act === 'ics') downloadICS(b.dataset.id);
    else if (act === 'cal') { const id = b.dataset.id, box = document.getElementById('jgCal-' + id), open = !openCal.has(id);
      if (open) openCal.add(id); else openCal.delete(id);
      box.classList.toggle('open', open); b.setAttribute('aria-expanded', open); box.querySelector('.jg-reveal').hidden = !open; }
    else if (act === 'quiz-start') { Q.type = b.dataset.t; Q.order = QUIZ_BANKS[Q.type].slice(); Q.index = 0; Q.answers = []; Q.picked = null; Q.view = 'active'; drawPage(); document.getElementById('jgQuiz').scrollIntoView({ block: 'nearest' }); }
    else if (act === 'quiz-pick') { if (Q.answers[Q.index] !== undefined) return; const i = +b.dataset.i; Q.picked = i; Q.answers[Q.index] = i === Q.order[Q.index].correct; drawPage(); const n = document.getElementById('jgQuizNext'); if (n) n.focus(); }
    else if (act === 'quiz-next') { Q.index++; Q.picked = null; if (Q.index >= Q.order.length) await submitQuiz(); drawPage(); const h = document.getElementById('jgQuizQ') || document.getElementById('jgQuizResult'); if (h) h.scrollIntoView({ block: 'nearest' }); }
    else if (act === 'quiz-menu') { Q.view = 'menu'; drawPage(); }
    else if (act === 'switch-club' || act === 'switch-parent') {
      try { localStorage.setItem('ngl.who', act === 'switch-club' ? 'club' : ''); if (act === 'switch-parent') localStorage.removeItem('ngl.who'); } catch (_) {}
      if (S.user) await J.signOut();
      history.replaceState(null, '', location.pathname + (J.LIVE ? (new URLSearchParams(location.search).has('db') ? '?db' : '') : '?demo'));
      if (act === 'switch-club') location.reload(); else (await import('./welcome.js')).showParent();
    }
  });
  document.addEventListener('submit', e => {
    const f = e.target; if (!f.id || !f.id.startsWith('jg')) return; e.preventDefault();
    if (f.id === 'jgLogin') doLogin(f); else if (f.id === 'jgRegister') doRegister(f);
    else if (f.id === 'jgComplete') completeProfile(f); else if (f.id === 'jgEditForm') saveMyProfile(f);
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.jq) { const k = t.dataset.jq, r = QUAL_STATE[k] && QUAL_STATE[k][+t.dataset.i]; if (r) r[t.dataset.f] = t.value; if (k === 'register') togglePriorExperience(); return; }
    if (t.id === 'jgPhotoEdit') { uploadPhoto(t); return; }
    if (t.dataset && t.dataset.sel && t.closest('.jg')) {
      const id = t.dataset.comp;
      if (t.dataset.sel === 'disc') { const ps = document.getElementById('jgPiece-' + id); ps.innerHTML = piecesFor(t.value).map(p => `<option value="${p}">${p}</option>`).join(''); }
      updatePieceInfo(id);
    }
  });
}
