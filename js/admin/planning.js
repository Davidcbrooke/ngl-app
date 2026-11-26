// NGL Admin · Competition planning. Copied word for word from GYMNASTICS-RESULTS/NGL_Comp_Planning.html:
// the same standard jobs, wording, due dates, ticks, notes, "not needed", step buttons, edit mode with drag and drop,
// add job, "Due this week and overdue" and the summary for the hub. Only the shell, look and data layer changed:
// plans live in compPlans/{competition id} (template compPlans/_template, summary compPlans/_summary).
// ?demo keeps every change in memory and never writes.
import { fb } from '../firebase.js';
import { MODE } from '../data.js';
import { esc, toast } from '../ui.js';

const LIVE_TOOLS = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/';
const CONFIG = {
  seasons: ['2026', '2027'],
  standaloneComps: [
    {id:'ngl-2026-recreational', name:'NGL Recreational Competition', date:'2026-10-25', pathway:'recreational'},
    {id:'ngl-2026-finals-a', name:'NGL National Finals: Level A', date:'2026-11-22', order:1},
    {id:'ngl-2026-finals-bc', name:'NGL National Finals: Levels B and C', date:'2026-11-22', order:2}
  ]
};

/* The standard jobs (used until the list is edited on this page; the edited list is saved as compPlans/_template).
   days = days before the competition (negative = after it). music: only for competitions with floor music.
   steps: buttons in order of priority; each click is recorded. */
const PHASES = [
  [84, '3 months or more before'], [56, '2 to 3 months before'], [29, '1 to 2 months before'],
  [8, '1 to 4 weeks before'], [1, 'The week before'], [0, 'Competition day'], [-9999, 'After the competition']
];
const phaseOf = days => PHASES.findIndex(([min]) => days >= min);
const BOOKING_ADMIN = LIVE_TOOLS + 'ngl-booking-system.html?admin=1', CLUBHUB_ADMIN = '#/admin/clubs';
const STAFFING = '#/admin/staffing', MUSIC_ADMIN = LIVE_TOOLS + 'NGL_Music_Admin.html', JUDGING = LIVE_TOOLS + 'ngl-judging-pathway.html?admin=1';
const DEFAULT_TASKS = [
  {id:'venue',     days:120, t:'Confirm the date, venue and session times', w:'Check the competition calendar and the venue booking match.'},
  {id:'elevien',   days:112, t:'Set up the competition in Elevien', w:'Events, levels, apparatus and session start times.'},
  {id:'bookings',  days:112, t:'Open reservations to clubs', w:'Clubs reserve places in the NGL Club Hub; check the competition shows on the season calendar.', steps:[{l:'Open bookings admin', u:BOOKING_ADMIN}]},
  {id:'mlink',     days:120, t:'Email clubs their MyBG booking link', w:'Paste the private MyBG link for each competition that day, check the preview, send a test, then Send. Each club gets its own email with its places.', steps:[{l:'Open the email', u:BOOKING_ADMIN + '&mail={comp}&tpl=open'}]},
  {id:'mremind',   days:97,  t:'Reminder: one week to the booking deadline', w:'Same email screen, second template. Goes to every club with reserved places.', steps:[{l:'Open the reminder', u:BOOKING_ADMIN + '&mail={comp}&tpl=remind'}]},
  {id:'buy',       days:90,  t:'Reservation deadline: clubs buy their places', w:'Reserved places must be bought 3 months before. Chase anyone who reserved but hasn\'t bought on JustGo.', steps:[{l:'See who hasn\'t bought', u:BOOKING_ADMIN}]},
  {id:'release',   days:89,  t:'Fill any places that weren\'t bought', w:'Work down the list in order. Stop as soon as the places are filled.',
    steps:[{l:'1. Email the waiting list', u:BOOKING_ADMIN + '&mail={comp}&tpl=waitlist'}, {l:'2. Email every club with an NGL Club Hub account', u:BOOKING_ADMIN + '&mail={comp}&tpl=hub'}, {l:'3. Social media post', u:'https://www.instagram.com/national_gymnastics_league/'}, {l:'4. Email all British Gymnastics clubs (Brevo)', u:'https://app.brevo.com/'}]},
  {id:'judges',    days:84,  t:'Book the judges', w:'2 remote judges from the Judging Pathway, plus attending clubs\' judges for the other pieces.', steps:[{l:'Open Judging', u:JUDGING}]},
  {id:'staff',     days:75,  t:'Fill the staffing board', w:'Competition manager, floor manager, scoring, announcer, music, runners, camera operators.', steps:[{l:'Open Staffing', u:STAFFING}]},
  {id:'medals',    days:70,  t:'Order medals and awards', w:'Allow for every level and age group, plus spares.'},
  {id:'firstaid',  days:70,  t:'Confirm first aid cover'},
  {id:'addgym',    days:60,  t:'Add all gymnasts to Elevien', w:'Every gymnast from the bought places, in the right level and age group.'},
  {id:'musicopen', days:60,  music:true, t:'Floor music uploads', w:'Ask Claude to update from Elevien, then Publish entries to the NGL Club Hub and set the upload deadline.', steps:[{l:'Open Floor music', u:MUSIC_ADMIN}]},
  {id:'spectator', days:60,  t:'Send the spectator email with the live results link', w:'For clubs to forward to their families: date, venue, timings and the live results link.'},
  {id:'chase',     days:45,  t:'Chase changes', w:'Withdrawals, swaps and level changes made in Elevien; missing floor music.'},
  {id:'jnames',    days:30,  t:'Request judges\' names', w:'From every club providing a judge.'},
  {id:'cnames',    days:30,  t:'Request coaches\' names', w:'One coach for every group a club has gymnasts in.'},
  {id:'schedule',  days:21,  t:'Build and publish the Elevien schedule', w:'Groups by club, rotations and bib numbers. Publish it in Elevien.'},
  {id:'update',    days:21,  music:true, t:'Ask Claude to update from Elevien', w:'Pulls the final entries and the floor order into the music player.'},
  {id:'rotations', days:14,  t:'Prepare the rotations', w:'Ask Claude for the rotation sheets and gymnast numbers PDF from the Elevien schedule.'},
  {id:'programme', days:14,  t:'Prepare the programme', w:'Timings, groups, running order, sponsors and the QR code for live results.'},
  {id:'intros',    days:14,  music:true, t:'Make the gymnast introductions', w:'Floor music, Play tab: Make introductions. Listen for any names said wrongly.', steps:[{l:'Open Floor music', u:MUSIC_ADMIN + '#play'}]},
  {id:'roles',     days:10,  t:'Who\'s doing what sheet', w:'Group coaches, judges, cameras, runners, announcer and music.'},
  {id:'pack',      days:10,  t:'Send clubs the competition pack', w:'Timings, groups and starting pieces, coaches needed, arrival and parking.'},
  {id:'seating',   days:10,  t:'Floor and seating plan'},
  {id:'announce',  days:7,   t:'Record the announcements', w:'Welcome and safety, march-in by region, with the NGL anthem.'},
  {id:'print',     days:5,   t:'Print everything', w:'Programmes, bib numbers, rotation sheets, roles sheet, judges\' sheets, signs and QR codes.'},
  {id:'medalsort', days:3,   t:'Count the medals and sort them into podium order'},
  {id:'laptop',    days:1,   music:true, t:'Prepare the music laptop', w:'Save all music to this laptop, test the player and intros, export the backup to a USB stick.'},
  {id:'kit',       days:1,   t:'Test scoring devices and cameras', w:'Elevien tablets for every judge, cameras on the filmed pieces, Wi-Fi in the hall.'},
  {id:'setup',     days:1,   t:'Set up the hall', w:'Apparatus, judges\' tables, scoring desk, sound system, registration desk.'},
  {id:'reg',       days:0,   t:'Registration desk and lanyards', w:'Staff, coaches and judges signed in; group coaches given their sheets.'},
  {id:'run',       days:0,   t:'Run the competition', w:'Announcements, march-in, rotations, presentations.'},
  {id:'results',   days:-1,  t:'Check and publish the results', w:'League table and National Qualifiers updated.'},
  {id:'social',    days:-2,  t:'Results post on social media'},
  {id:'thanks',    days:-3,  t:'Thank clubs, judges and volunteers; pay the remote judges', w:'Remote judges £50 each.'},
  {id:'debrief',   days:-7,  t:'Debrief: what to change next time', w:'Add notes here so the next competition benefits.'}
].map((t, i) => ({...t, pos:i}));
let TEMPLATE = DEFAULT_TASKS.map(t => ({...t}));
/* Standard jobs added after the list was first edited and saved: they join a saved list once (unless already there or deleted since). */
const ADDED_LATER = ['mlink', 'mremind'];
function addNewStd(list, seen){
  const have = new Set(list.map(t => t.id)), was = new Set(seen || []);
  const add = DEFAULT_TASKS.filter(t => ADDED_LATER.includes(t.id) && !have.has(t.id) && !was.has(t.id)).map(t => ({...t}));
  return add.length ? list.concat(add).sort((a, b) => b.days - a.days || (a.pos ?? 0) - (b.pos ?? 0)) : list;
}

/* Links saved by the old tool (relative to GYMNASTICS-RESULTS) still work: Staffing and Club Hub admin open in this app,
   every other old tool opens live in a new tab. */
const OLD_CLUBHUB = 'https://club.nationalgymnasticsleague.co.uk/#admin';
function linkOf(u){
  u = String(u || '#').trim();
  if (u === OLD_CLUBHUB) return CLUBHUB_ADMIN;
  if (u === '#' || /^(https?:|mailto:|#)/i.test(u)) return u;
  u = u.replace(/^\.\//, '');
  if (/^NGL_Staffing_Admin\.html/i.test(u)) return STAFFING;
  return LIVE_TOOLS + u;
}

const day = 864e5, today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const toDate = v => { const d = v && v.toDate ? v.toDate() : new Date(String(v).length === 10 ? v + 'T00:00:00' : v); d.setHours(0, 0, 0, 0); return d; };
const fmt = d => d.toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'});
const fmtY = d => d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
const rel = n => n === 0 ? 'On the day' : n < 0 ? `${-n} day${n === -1 ? '' : 's'} after` : n % 7 === 0 && n >= 14 ? `${n / 7} weeks before` : `${n} day${n === 1 ? '' : 's'} before`;
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let FS = null, DB = null, LIVE = MODE !== 'demo', ME = {name:'', email:''};
const S = { comps:[], plans:{}, cur:null, showDone:true, edit:false, editing:null, bookings:null, errs:[], loaded:null, part:undefined };

/* Sample data (?demo): three competitions, a few reservations (one on the waiting list) and some jobs already ticked */
const plus = n => isoLocal(new Date(today.getTime() + n * day));
const DEMO_COMPS = [
  {id:'demo-gl-east', name:'General League · East Region (example)', date:plus(30), venue:'SAADI Gymnastics, Harpenden', pathway:'general'},
  {id:'demo-rec', name:'Recreational · Ruby & Pink (example)', date:plus(60), venue:'Redbourn', pathway:'recreational'},
  {id:'demo-gl-west', name:'General League · West Midlands (example)', date:plus(100), venue:'TBC', pathway:'general'}
];
const DEMO_RES = [
  {compId:'demo-gl-east', club:'SAADI Gymnastics', waitlist:false},
  {compId:'demo-gl-east', club:'Riverside Gym Academy', waitlist:false},
  {compId:'demo-gl-east', club:'Northgate Gymnastics Club', waitlist:true},
  {compId:'demo-gl-west', club:'SAADI Gymnastics', waitlist:false}
];
function demoPlans(){
  /* every job due before today is ticked (by Dave or Christine, on its due date), except the few left to show as overdue */
  const ticked = (inDays, leave) => { const done = {};
    DEFAULT_TASKS.filter(t => inDays - t.days < 0 && !leave.includes(t.id)).forEach((t, i) =>
      done[t.id] = {by: i % 2 ? 'Christine' : 'Dave Brooke', at: today.getTime() + (inDays - t.days) * day + 10 * 36e5});
    return done; };
  const ago = n => ({by:'Christine', at:today.getTime() - n * day + 10 * 36e5});
  return {
    'demo-gl-east': { done: ticked(30, ['release', 'staff', 'medals', 'firstaid']), skip: {firstaid:true},
      notes: {venue:'Hall booked 8am to 6pm. Doors open 8.30.', judges:'Two remote judges confirmed from the Judging Pathway.'},
      steps: {mlink:{0:ago(90)}, mremind:{0:ago(67)}, bookings:{0:ago(82)}} },
    'demo-rec': { done: ticked(60, ['judges']), steps: {mlink:{0:ago(60)}} },
    'demo-gl-west': { done: ticked(100, []), steps: {mlink:{0:ago(20)}},
      extra: [{id:'xdemo1', t:'Confirm parking with the leisure centre', days:21, pos:999}] }
  };
}

const hasMusic = c => !/recreational/i.test(c.name + ' ' + (c.pathway || ''));
/* one competition's jobs: the standard list (minus any removed for this competition) plus its own extra jobs */
function tasksFor(c){
  const p = S.plans[c.id] || {};
  return TEMPLATE.filter(t => !t.music || hasMusic(c)).map(t => ({...t, std:true})).concat((p.extra || []).map(x => ({...x, extra:true})))
    .map(t => { const due = new Date(toDate(c.date).getTime() - t.days * day);
      const done = p.done && p.done[t.id], na = p.skip && p.skip[t.id], stepsDone = (p.steps || {})[t.id] || {};
      const left = Math.round((due - today) / day);
      /* once a competition has happened, only the after-the-competition jobs can still be late */
      const over = toDate(c.date) < today && t.days >= 0;
      const st = done ? 'ok' : na ? 'na' : over ? '' : left < 0 ? 'late' : left <= 7 ? 'soon' : '';
      return {...t, due, done, na, left, st, stepsDone, note:(p.notes || {})[t.id] || ''}; })
    .sort((a, b) => b.days - a.days || (a.pos ?? 999) - (b.pos ?? 999));
}
const counts = c => { const ts = tasksFor(c).filter(t => !t.na); return {all:ts.length, done:ts.filter(t => t.done).length, late:ts.filter(t => t.st === 'late').length, soon:ts.filter(t => t.st === 'soon').length}; };
const upcoming = () => S.comps.filter(c => toDate(c.date) >= new Date(today.getTime() - 14 * day));
const curComp = () => S.comps.find(x => x.id === S.cur);
const who = () => ME.name || ME.email || '';
const onScreen = () => !!document.getElementById('plRoot');
const redraw = () => window.NGL_RENDER && window.NGL_RENDER();

const DEL = '__delete__';   // a value of DEL removes that entry
/* A small summary for the Admin Hub tile: the due date of every job still to do (not done, not "not needed").
   The hub counts the ones whose date has passed, so the number stays right day by day without opening this page. */
let sumTimer = null;
function saveSummary(){
  if (!LIVE) return; clearTimeout(sumTimer);
  sumTimer = setTimeout(async () => {
    const items = S.comps.flatMap(c => { const past = toDate(c.date) < today;
      return tasksFor(c).filter(t => !t.done && !t.na && !(past && t.days >= 0)).map(t => isoLocal(t.due)); }).sort();
    try { await FS.setDoc(FS.doc(DB, 'compPlans', '_summary'), {due:items, updatedAt:FS.serverTimestamp()}); }
    catch (e) { console.error('summary', e); }
  }, 1500);
}
async function save(c, patch){
  const p = S.plans[c.id] = S.plans[c.id] || {}, out = {};
  for (const k in patch) { const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) { p[k] = Object.assign({}, p[k]); out[k] = {};
      for (const j in v) { if (v[j] === DEL) { delete p[k][j]; out[k][j] = LIVE ? FS.deleteField() : null; }
        else if (v[j] && typeof v[j] === 'object' && !Array.isArray(v[j]) && k === 'steps') { p[k][j] = Object.assign({}, p[k][j], v[j]); out[k][j] = v[j]; }
        else { p[k][j] = v[j]; out[k][j] = v[j]; } } }
    else { p[k] = v; out[k] = v; } }
  redraw();
  if (!LIVE) return;
  try { await FS.setDoc(FS.doc(DB, 'compPlans', c.id), Object.assign({compId:c.id, compName:c.name, updatedAt:FS.serverTimestamp()}, out), {merge:true}); }
  catch (e) { console.error(e); toast(/permission/i.test(e.code || e.message) ? 'The database blocked that change.' : 'Not saved: check the connection.', false); }
  saveSummary();
}
async function saveTemplate(){
  saveSummary();
  TEMPLATE.sort((a, b) => b.days - a.days || a.pos - b.pos).forEach((t, i) => t.pos = i);
  redraw();
  if (!LIVE) return;
  try { await FS.setDoc(FS.doc(DB, 'compPlans', '_template'), {tasks:TEMPLATE, seen:[...new Set(TEMPLATE.map(t => t.id).concat(ADDED_LATER))], updatedAt:FS.serverTimestamp(), by:ME.email || ''}); }
  catch (e) { console.error(e); toast('The standard list wasn\'t saved: check the connection.', false); }
}

/* ---------- screen ---------- */
function listHTML(){
  const up = upcoming(), past = S.comps.filter(c => !up.includes(c)).reverse();
  const row = c => { const n = counts(c), dd = Math.round((toDate(c.date) - today) / day);
    return `<button class="pl-cbtn" data-act="pl-comp" data-c="${esc(c.id)}" aria-pressed="${c.id === S.cur}"><b>${esc(c.name)}${n.late ? `<span class="pl-flag">${n.late} late</span>` : ''}</b>
      <span>${fmt(toDate(c.date))} · ${dd > 0 ? `${dd} days to go` : dd === 0 ? 'Today' : 'Finished'} · ${n.done}/${n.all} done</span><div class="pl-bar"><i style="width:${n.all ? n.done / n.all * 100 : 0}%"></i></div></button>`; };
  return `<aside class="card pl-side"><h2>Competitions</h2>` + (up.map(row).join('') || '<div class="empty">No competitions coming up.</div>') +
    (past.length ? `<details class="pl-past" ${past.some(c => c.id === S.cur) ? 'open' : ''}><summary>Past competitions (${past.length})</summary>${past.map(row).join('')}</details>` : '') + '</aside>';
}
function weekHTML(){
  const items = upcoming().flatMap(c => tasksFor(c).filter(t => t.st === 'late' || t.st === 'soon').map(t => ({...t, c}))).sort((a, b) => a.due - b.due);
  return '<div class="card pl-week" id="plWeek"><h2>Due this week and overdue</h2>' + (items.length ? items.slice(0, 12).map(t =>
    `<div class="pl-wrow ${t.st}"><span class="d">${t.left < 0 ? `${-t.left}d late` : t.left === 0 ? 'Today' : fmt(t.due)}</span><span><b>${esc(t.t)}</b> <span class="c">· ${esc(t.c.name)}</span></span></div>`).join('') +
    (items.length > 12 ? `<p class="pl-more-n">and ${items.length - 12} more: open each competition to see them.</p>` : '')
    : '<p class="pl-clear">Nothing due in the next 7 days.</p>') + '</div>';
}
/* "Fill any places that weren't bought": say plainly whether there's a waiting list, and send each email straight from the booking system's mailer. */
function waitInfo(c){
  if (!c || !S.bookings) return null;
  const grp = S.comps.filter(x => x.date === c.date && String(x.venue || '').trim().toLowerCase() === String(c.venue || '').trim().toLowerCase()).map(x => x.id);
  const ids = new Set(grp.length ? grp : [c.id]);
  const wl = S.bookings.filter(b => ids.has(b.compId) && b.waitlist);
  return { n: wl.length, clubs: [...new Set(wl.map(b => b.club).filter(Boolean))] };
}
function releaseSteps(t, c){
  const wi = waitInfo(c), steps = (t.steps || []).map(x => ({...x})), done = {...t.stepsDone};
  if (steps[0]) steps[0].u = BOOKING_ADMIN + '&mail={comp}&tpl=waitlist';
  if (steps[1]) { steps[1].u = BOOKING_ADMIN + '&mail={comp}&tpl=hub'; steps[1].l = '2. Email every club with an NGL Club Hub account'; }
  let note = '';
  if (wi && steps[0]) {
    if (wi.n) { steps[0].l = `1. Email the waiting list (${wi.clubs.length} club${wi.clubs.length === 1 ? '' : 's'})`;
      note = `<div class="pl-wlnote yes"><b>Waiting list: ${wi.clubs.length} club${wi.clubs.length === 1 ? '' : 's'}</b> ${esc(wi.clubs.join(', '))}. Email them first.</div>`; }
    else { steps[0].l = '1. No waiting list'; steps[0].u = '#'; steps[0].skip = true; if (!done[0]) done[0] = {skip:true};
      note = '<div class="pl-wlnote no"><b>No waiting list</b> for this competition, so go straight to step 2: email every club with an NGL Club Hub account.</div>'; }
  }
  return { steps, done, note };
}
const stepsHTML = (t0, c) => { if (!(t0.steps || []).length) return '';
  let t = t0, note = '';
  if (t0.id === 'release') { const r = releaseSteps(t0, c); t = {...t0, steps:r.steps, stepsDone:r.done}; note = r.note; }
  return note + `<div class="pl-steps">${t.steps.map((st, i) => { const d = t.stepsDone[i];
    if (st.skip) return `<span class="pl-step skip">${esc(st.l)}</span>`;
    const next = !t.done && !d && t.steps.slice(0, i).every((_, k) => t.stepsDone[k]);
    const href = linkOf(String(st.u || '#').replace('{comp}', encodeURIComponent(c ? c.id : '')));
    const out = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
    return `<a class="pl-step ${d ? 'did' : ''} ${next ? 'next' : ''}" href="${esc(href)}"${out} data-step="${esc(t.id)}|${i}">${esc(st.l)}${d && d.at ? ` <small>done ${fmt(new Date(d.at))}</small>` : ''}</a>`; }).join('')}</div>`; };
function editForm(t){
  return `<div class="pl-ef" data-ef="${esc(t.id)}">
    <label>Job<input type="text" id="plEfT" value="${esc(t.t)}"></label>
    <label>Details<input type="text" id="plEfW" value="${esc(t.w || '')}"></label>
    <div class="pl-efrow"><label>Days before<input type="number" id="plEfD" value="${t.days}" style="width:90px"></label>
      ${t.std ? `<label class="ck"><input type="checkbox" id="plEfM" ${t.music ? 'checked' : ''}> Floor music competitions only</label>` : ''}</div>
    <label>Buttons, in order of priority: one per line as <i>Label | link</i><textarea id="plEfS">${esc((t.steps || []).map(x => x.l + ' | ' + (x.u || '')).join('\n'))}</textarea></label>
    <div class="pl-efrow"><button class="btn sm" data-act="pl-ef-save" data-id="${esc(t.id)}">Save</button><button class="btn sm ghost" data-act="pl-ef-cancel">Cancel</button>
      <button class="btn sm ghost pl-del" data-act="pl-ef-del" data-id="${esc(t.id)}">${t.std ? 'Delete from the standard list' : 'Delete'}</button></div>
    ${t.std ? '<p class="pl-hint">This is a standard job: changes apply to every competition.</p>' : ''}</div>`;
}
function compHTML(){
  const c = curComp(); if (!c) return '<div class="card empty">Choose a competition.</div>';
  const ts = tasksFor(c), n = counts(c), dd = Math.round((toDate(c.date) - today) / day);
  const chip = (cls, txt) => `<span class="pill ${cls}">${txt}</span>`;
  let html = `<div class="card pl-head"><h2>${esc(c.name)}</h2><p>${fmtY(toDate(c.date))}${c.venue ? ` · ${esc(c.venue)}` : ''} · ${dd > 0 ? `${dd} days to go` : dd === 0 ? 'Today' : 'Finished'}</p>
    <div class="pl-chips">${chip('ok', `${n.done} of ${n.all} done`)}${n.late ? chip('red', `${n.late} overdue`) : ''}${n.soon ? chip('warn', `${n.soon} due this week`) : ''}${hasMusic(c) ? '' : chip('', 'No floor music jobs (Recreational)')}</div></div>
    <div class="pl-tools"><label><input type="checkbox" id="plShowDone" ${S.showDone ? 'checked' : ''}> Show finished jobs</label>
      ${n.late && !S.edit ? `<span id="plLateAll"><button class="btn sm ghost" data-act="pl-tick-late">Mark all ${n.late} overdue jobs as done</button></span>` : ''}
      <button class="btn sm ${S.edit ? '' : 'ghost'} pl-editmode" data-act="pl-edit-mode" id="plEditMode">${S.edit ? 'Finish editing' : 'Edit the list'}</button></div>
    ${S.edit ? '<p class="pl-editnote">Drag jobs to move them (dropping a job beside another gives it that job\'s timing), or click Edit on any job. Standard jobs are the same for every competition; jobs you add can be just for this one.</p>' : ''}`;
  html += PHASES.map(([min, name], pi) => { const list = ts.filter(t => phaseOf(t.days) === pi && (S.edit || S.showDone || (!t.done && !t.na)));
    if (!list.length && !S.edit) return '';
    return `<div class="card pl-phase"><h3>${esc(name)}</h3><div class="pl-list" data-phase="${pi}">` + list.map(t => S.editing === t.id ? editForm(t) : `
      <div class="pl-task ${t.done ? 'done' : ''} ${t.na ? 'na' : ''}" data-t="${esc(t.id)}" ${S.edit ? 'draggable="true"' : ''}>
        ${S.edit ? '<span class="pl-grip" title="Drag to move">&#10303;</span>' : `<input type="checkbox" data-done="${esc(t.id)}" ${t.done ? 'checked' : ''} ${t.na ? 'disabled' : ''} aria-label="Done: ${esc(t.t)}">`}
        <div class="t"><b>${esc(t.t)}</b>${t.extra ? ' <span class="pl-tag">This competition only</span>' : ''}${t.music ? ' <span class="pl-tag">Floor music</span>' : ''}${t.w ? `<span class="w">${esc(t.w)}</span>` : ''}</div>
        <div class="when"><b>${fmt(t.due)}</b>${esc(rel(t.days))}<br>${t.done ? '<span class="pill ok">Done</span>' : t.na ? '<span class="pill">Not needed</span>' : t.st === 'late' ? `<span class="pill red">${-t.left} day${t.left === -1 ? '' : 's'} late</span>` : t.st === 'soon' ? `<span class="pill warn">${t.left === 0 ? 'Due today' : `Due in ${t.left} day${t.left === 1 ? '' : 's'}`}</span>` : ''}</div>
        ${S.edit ? '' : stepsHTML(t, c)}
        ${t.note && !S.edit ? `<div class="pl-note">${esc(t.note)}</div>` : ''}
        <div class="pl-more">${S.edit ? `<button data-act="pl-edit" data-id="${esc(t.id)}">Edit</button>` : `${t.done ? `Done by ${esc(t.done.by || '')}${t.done.at ? ` on ${fmt(new Date(t.done.at))}` : ''} · ` : ''}<button data-act="pl-note" data-id="${esc(t.id)}">${t.note ? 'Edit note' : 'Add a note'}</button> · <button data-act="pl-na" data-id="${esc(t.id)}">${t.na ? 'Needed after all' : 'Not needed for this competition'}</button>`}</div>
      </div>`).join('') + (S.edit && !list.length ? `<div class="pl-dropempty" data-phase-empty="${pi}">Drop a job here</div>` : '') + '</div></div>'; }).join('');
  html += `<div class="card pl-add"><input type="text" id="plNewT" placeholder="Add a job" aria-label="New job">
    <input type="number" id="plNewD" value="7" min="-60" max="365" style="width:90px" aria-label="Days before the competition"><span class="pl-daysb">days before</span>
    <select id="plNewScope" aria-label="Which competitions"><option value="one">This competition only</option><option value="all">Every competition</option></select>
    <button class="btn" data-act="pl-add">Add job</button></div>`;
  return html;
}
function view(){
  return `<div class="pl-root" id="plRoot"><p class="lead">Every job for each competition, with its due date</p>
    ${S.errs.length ? `<div class="card attn pl-err">${S.errs.map(esc).join('<br>')}</div>` : ''}
    <div class="pl-grid">${listHTML()}<section class="pl-main">${weekHTML()}<div id="plComp">${compHTML()}</div></section></div></div>`;
}

/* ---------- editing ---------- */
function findTask(c, id){ const std = TEMPLATE.find(t => t.id === id); if (std) return {std:true, t:std}; const ex = ((S.plans[c.id] || {}).extra || []).find(t => t.id === id); return ex ? {std:false, t:ex} : null; }
function updateTask(c, id, fn){
  const f = findTask(c, id); if (!f) return;
  if (f.std) { fn(f.t); saveTemplate(); }
  else { const ex = ((S.plans[c.id] || {}).extra || []).map(x => ({...x})); const t = ex.find(x => x.id === id); fn(t); save(c, {extra:ex}); }
}
function removeTask(c, id){
  const f = findTask(c, id); if (!f) return;
  if (f.std) { TEMPLATE = TEMPLATE.filter(t => t.id !== id); saveTemplate(); }
  else save(c, {extra:((S.plans[c.id] || {}).extra || []).filter(x => x.id !== id)});
}
const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };

/* Buttons (data-act="pl-…"): the app shell sends clicks here */
export const PL = {
  'pl-comp'(b){ S.cur = b.dataset.c; S.editing = null; try { localStorage.setItem('nglplan:cur', S.cur); } catch (_) {} redraw(); window.scrollTo({top:0, behavior:'smooth'}); },
  'pl-edit-mode'(){ S.edit = !S.edit; S.editing = null; redraw(); },
  'pl-edit'(b){ S.editing = b.dataset.id; Promise.resolve(redraw()).then(() => { const f = document.getElementById('plEfT'); if (f) f.focus(); }); },
  'pl-ef-cancel'(){ S.editing = null; redraw(); },
  'pl-ef-save'(b){ const c = curComp(); if (!c) return;
    const id = b.dataset.id, t = val('plEfT').trim(); if (!t) { toast('The job needs a name.', false); return; }
    const w = val('plEfW').trim(), d = parseInt(val('plEfD'), 10), mEl = document.getElementById('plEfM'), m = mEl ? mEl.checked : false;
    const steps = val('plEfS').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const k = l.lastIndexOf('|'); return k > 0 ? {l:l.slice(0, k).trim(), u:l.slice(k + 1).trim()} : {l, u:''}; });
    S.editing = null;
    updateTask(c, id, x => { x.t = t; x.w = w; if (!isNaN(d)) x.days = d; if (findTask(c, id).std) { if (m) x.music = true; else delete x.music; } x.steps = steps; });
    toast('Saved'); },
  'pl-ef-del'(b){ const c = curComp(); if (!c) return; const id = b.dataset.id;
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Click again to delete'; return; }
    S.editing = null; removeTask(c, id); toast('Deleted'); },
  'pl-note'(b){ const c = curComp(); if (!c) return; const id = b.dataset.id, row = b.closest('.pl-task'); if (!row || row.querySelector('textarea')) return;
    const ta = document.createElement('textarea'); ta.value = ((S.plans[c.id] || {}).notes || {})[id] || ''; ta.setAttribute('aria-label', 'Note');
    row.appendChild(ta); ta.focus(); ta.addEventListener('blur', () => { const v = ta.value.trim(); save(c, {notes:{[id]: v || DEL}}); }); },
  'pl-na'(b){ const c = curComp(); if (!c) return; const id = b.dataset.id, on = !(((S.plans[c.id] || {}).skip || {})[id]); save(c, {skip:{[id]: on ? true : DEL}}); },
  'pl-tick-late'(){ const el = document.getElementById('plLateAll'); if (el) el.innerHTML = 'Sure? <button class="btn sm" data-act="pl-tick-late-yes">Yes, mark them done</button> <button class="btn sm ghost" data-act="pl-tick-late-no">Cancel</button>'; },
  'pl-tick-late-no'(){ redraw(); },
  'pl-tick-late-yes'(){ const c = curComp(); if (!c) return; const done = {}; tasksFor(c).filter(t => t.st === 'late').forEach(t => done[t.id] = {by:who(), at:Date.now()}); save(c, {done}); toast('Overdue jobs marked as done'); },
  'pl-add'(){ const c = curComp(); if (!c) return; const t = val('plNewT').trim(), d = parseInt(val('plNewD'), 10); if (!t) { toast('Type the job first.', false); return; }
    const days = isNaN(d) ? 7 : d, job = {id:'x' + Date.now().toString(36), t, days, pos:999};
    if (val('plNewScope') === 'all') { TEMPLATE.push(job); saveTemplate(); toast('Added to every competition'); }
    else { const p = S.plans[c.id] || {}; save(c, {extra:(p.extra || []).concat([job])}); toast('Added to this competition'); } }
};

/* Step buttons are real links (new tab for the live tools, in the app for #/ screens); each click is recorded. */
document.addEventListener('click', e => {
  const stp = e.target.closest && e.target.closest('#plRoot [data-step]'); if (!stp) return;
  const c = curComp(); if (!c) return;
  const [id, i] = stp.dataset.step.split('|'); if (stp.getAttribute('href') === '#') e.preventDefault();
  save(c, {steps:{[id]:{[i]:{by:who(), at:Date.now()}}}});
});
document.addEventListener('change', e => {
  if (!(e.target.closest && e.target.closest('#plRoot'))) return;
  const c = curComp();
  if (e.target.id === 'plShowDone') { S.showDone = e.target.checked; redraw(); return; }
  const d = e.target.dataset && e.target.dataset.done; if (!d || !c) return;
  if (e.target.checked) save(c, {done:{[d]:{by:who(), at:Date.now()}}});
  else save(c, {done:{[d]: DEL}});
});
let dragId = null;
const mine = (e, sel) => e.target.closest && e.target.closest('#plRoot') && e.target.closest(sel);
document.addEventListener('dragstart', e => { const r = mine(e, '.pl-task[draggable]'); if (!r) return; dragId = r.dataset.t; r.classList.add('pl-dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {} });
document.addEventListener('dragend', () => { if (!dragId && !document.querySelector('#plRoot .pl-dragging')) return; document.querySelectorAll('#plRoot .pl-dragging, #plRoot .pl-over').forEach(x => x.classList.remove('pl-dragging', 'pl-over')); dragId = null; });
document.addEventListener('dragover', e => { if (!dragId) return; const r = mine(e, '.pl-task[draggable], .pl-dropempty'); if (!r) return; e.preventDefault(); document.querySelectorAll('#plRoot .pl-over').forEach(x => x.classList.remove('pl-over')); r.classList.add('pl-over'); });
document.addEventListener('drop', e => {
  if (!dragId) return; const c = curComp(); if (!c) return;
  const r = mine(e, '.pl-task[draggable], .pl-dropempty'); if (!r) return; e.preventDefault();
  const ts = tasksFor(c), id = dragId; dragId = null;
  let days, pos;
  if (r.classList.contains('pl-dropempty')) { days = PHASES[+r.dataset.phaseEmpty][0]; if (days < -100) days = -1; pos = -1; }
  else { const tgt = ts.find(t => t.id === r.dataset.t); if (!tgt || tgt.id === id) return;
    const after = e.clientY > r.getBoundingClientRect().top + r.offsetHeight / 2;
    days = tgt.days; pos = (tgt.pos ?? 0) + (after ? 0.5 : -0.5); }
  updateTask(c, id, t => { t.days = days; t.pos = pos; });
  toast('Moved');
});

/* ---------- data ---------- */
const showErr = m => { if (!S.errs.includes(m)) S.errs.push(m); };
async function load(){
  let comps = [];
  if (LIVE) {
    try { const {fs, D} = await fb(); FS = fs; DB = D; }
    catch (e) { console.error(e); LIVE = false; showErr('Couldn\'t connect to the database (' + (e.code || e.message) + '). Ticks won\'t save until this is fixed.'); }
  }
  if (LIVE) {
    try { const snap = await FS.getDocs(FS.collection(DB, 'competitions'));
      comps = snap.docs.map(d => { const x = d.data(); return {id:d.id, name:x.name || x.title || 'Untitled competition', date:x.date || x.compDate || '', venue:x.where || x.venue || x.location || '', pathway:x.path || x.pathway || ''}; })
        .filter(c => c.date && CONFIG.seasons.some(y => String(toDate(c.date).getFullYear()) === y)); }
    catch (e) { console.error(e); showErr('Couldn\'t read the competitions (' + (e.code || e.message) + ').'); }
    try { const snap = await FS.getDocs(FS.collection(DB, 'reservations'));
      S.bookings = snap.docs.map(d => { const x = d.data(); return {compId:x.compId, club:x.clubName || '', waitlist:x.status === 'waiting'}; }); }
    catch (e) { console.warn('Bookings not loaded', e); S.bookings = null; }
    try { const snap = await FS.getDocs(FS.collection(DB, 'compPlans'));
      snap.docs.forEach(d => { const k = d.id; if (k === '_summary') return;
        if (k === '_template') { const t = d.data().tasks; if (Array.isArray(t) && t.length) TEMPLATE = addNewStd(t, d.data().seen); }
        else if (k[0] !== '_') S.plans[k] = d.data(); }); }
    catch (e) { console.error(e); showErr('Couldn\'t read the saved plans (' + (e.code || e.message) + '). Ticks won\'t save until this is fixed.'); }
  } else { comps = DEMO_COMPS.map(c => ({...c})); S.bookings = DEMO_RES.map(b => ({...b})); S.plans = demoPlans(); }
  const seen = new Set();
  S.comps = [...CONFIG.standaloneComps, ...comps].filter(c => !seen.has(c.id) && seen.add(c.id))
    .sort((a, b) => (toDate(a.date) - toDate(b.date)) || ((a.order || 0) - (b.order || 0)));
  let saved = null; try { saved = localStorage.getItem('nglplan:cur'); } catch (_) {}
  const next = upcoming()[0];
  S.cur = S.comps.some(c => c.id === saved) ? saved : (next || S.comps[0] || {}).id;
  saveSummary();
  if (LIVE) FS.onSnapshot(FS.collection(DB, 'compPlans'), sn => {
    sn.docChanges().forEach(ch => { const k = ch.doc.id; if (k === '_summary') return;
      if (k === '_template') { const t = ch.doc.data().tasks; if (Array.isArray(t) && t.length && !dragId && !S.editing) TEMPLATE = addNewStd(t, ch.doc.data().seen); }
      else if (k[0] !== '_') S.plans[k] = ch.doc.data(); });
    if (onScreen() && !S.editing && !dragId && (!document.activeElement || document.activeElement.tagName !== 'TEXTAREA')) redraw();
  }, e => console.error(e));
}

/* The screen: #/admin/planning, or #/admin/planning/<competition id> to open one competition */
export default async function planning(me = {}, parts = []){
  ME = {name:(me && me.name) || '', email:(me && me.email) || ''};
  if (!S.loaded) S.loaded = load();
  await S.loaded;
  const want = parts && parts[0];
  if (want !== S.part) { S.part = want; if (want && S.comps.some(c => c.id === want)) { S.cur = want; S.editing = null; } }
  return view();
}
