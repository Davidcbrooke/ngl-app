// NGL Rotation Planner (club tool). Ported word for word from GYMNASTICS-RESULTS/NGL_Rotation_Planner.html
// (served today at club.nationalgymnasticsleague.co.uk/rotation-planner/): the same wording, features and logic.
// Only the shell, look and data layer changed:
//   - Routes: #/tools/rotation (Weekly Planner), /groups (Groups & Locations), /totals (Weekly Totals),
//     /recreational, /admin (NGL team with Rotation Planner access) and /screen (the full-screen live gym screen,
//     which covers the app's menu and top bar). Its own login, sign-up and Sign Out are gone: the app has one sign-in.
//   - Data (this app's Firestore): the plan on the club's own doc clubs/{uid}.rotaJson (+ rotaUpdatedAt), exactly what
//     NGL Admin → Rotation Planner clubs reads and imports; the public copy families and the stream page read at
//     rotaLive/{uid} = {json, clubName, term, updatedAt}; sponsor logos rotaSponsors/{id} = {id, image, name, w, h, addedAt};
//     ideas rotaFeedback/{id} = {message, name, clubName, email, uid, submittedAt, status}.
//   - Recreational licence = clubs/{uid}.licences.recreational.status 'live'; term = clubs/{uid}.recTerm (the club plan);
//     Pre-School term plan = clubs/{uid}.plans.preschool (engine: preschool/data.js, window.NGLPS).
//   - ?demo: a realistic sample club, every change in memory, nothing is ever written.
//   - No emoji (DESIGN.md): icons are line SVGs. Native confirm()/alert() are app dialogs with the same words.
import { fb } from '../firebase.js';
import api, { MODE } from '../data.js';
import { esc, toast, modal, head } from '../ui.js';
import { APPACTS } from '../admin-registry.js';
import { loadScript } from '../pathways/index.js';

const LIVE_DB = MODE !== 'demo';
const BASE = '#/tools/rotation';
// Public links use the NGL address, not GitHub (the public stream page reads rotaLive)
const NGL_ROTA_URL = 'https://club.nationalgymnasticsleague.co.uk/rotation-planner/';
const PS_BASE = 'preschool/';            // the app's own copy of the Pre-School data, posts and medals
const SDK = '10.12.2';                   // same Firebase SDK version as js/firebase.js
const QR_JS = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
const SLUG = {planner: '', settings: 'groups', totals: 'totals', rec: 'recreational', admin: 'admin', live: 'screen'};
const TAB_OF = {'': 'planner', planner: 'planner', groups: 'settings', totals: 'totals', recreational: 'rec', admin: 'admin', screen: 'live'};

const ICON = {
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  save: '<path d="M5 3h11l4 4v14H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  belloff: '<path d="M6 16V11a6 6 0 0 1 9-5.2M18 11v5l2 2H4"/><path d="M10 20a2 2 0 0 0 4 0M3 3l18 18"/>',
  stream: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  exit: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'
};
const svg = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

// ================================================================
// CONSTANTS (as the original)
// ================================================================
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SWATCH_COLOURS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e8c','#795548','#607d8b','#c9a227','#1a2a4a'];
const LOC_COLOURS = {'Floor':'#4a90d9','Bars':'#7b68ee','Beam':'#e8914f','Vault':'#5cb85c','Tumble / Track':'#d9534f','Pommel / Rings':'#9b59b6','Rooms':'#f39c12','Other':'#95a5a6'};
const CAT_ORDER = ['Floor','Bars','Beam','Vault','Tumble / Track','Pommel / Rings','Rooms','Other'];
let PX_PER_MIN = 14; // recalculated dynamically based on screen size
function getTimelineWidth(){
  // in live view the timeline only owns the left-hand panel, so size it from that
  const c = document.getElementById('tlContainer');
  if(liveMode && c && c.clientWidth > 0) return c.clientWidth;
  return window.innerWidth || 1280;
}
function calcPxPerMin(){
  const screenW = getTimelineWidth();
  const lblW = calcLabelWidth();
  const availW = screenW - lblW - 20;
  // aim to fit ~1 hour visible at once on screen — bigger, more readable blocks
  const targetMinutesVisible = screenW < 700 ? 45 : screenW < 1100 ? 75 : 90;
  return Math.max(6, availW / targetMinutesVisible);
}
function calcLabelWidth(){
  const screenW = getTimelineWidth();
  return screenW < 700 ? 110 : screenW < 1100 ? 150 : 180;
}
const NO_CONFLICT = ['TBC'];

// ================================================================
// STATE
// ================================================================
let currentClubId = null;
let DATA = { groups:[], locations:[], sessions:{} };
let CLUB = {};            // the club's account record (clubs/{uid})
let currentWeek = 'A';
let liveMode = false;
let liveTimer = null;
let lastSaveTime = 0;
let saveTimer = null;
let editingSession = null, editingGroup = null, editingLocation = null;
let selectedGroupColour = SWATCH_COLOURS[0];
let selectedLocColour = '#4a90d9';
let mobDayIdx = 1;
let sponsorList = [];
let totalsSortCol = null, totalsSortDir = 'desc';
const S = {loaded: null, tab: 'planner', err: '', admin: null, canAdmin: false, status: '', unsub: null,
  adminClubs: null, demoFeedback: null, mounted: null, lastJson: '', syncToast: false};

const wired = () => location.hash.startsWith('#/tools');
// Change tab: a real address when the route is wired into the app; otherwise (the test harness) redraw in place
function go(tab){
  if (wired()) { const h = BASE + (SLUG[tab] ? '/' + SLUG[tab] : ''); if (location.hash !== h) { location.hash = h; return; } }
  S.tab = tab; draw();
}
function draw(){ const r = document.getElementById('rpRoot'); if (!r) return; r.className = 'rotp' + (S.tab === 'live' ? ' rp-on-live' : ''); r.innerHTML = body(); mount(); }

// ================================================================
// SAMPLE DATA (?demo): a club with squads, a Pre-School class and Recreational classes
// ================================================================
const isoDay = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
function demoMondayWeeksAgo(n){ const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7 - 7 * n); return isoDay(d); }
function demoClub(c){
  const y = new Date().getFullYear(), st = demoMondayWeeksAgo(4);
  return {...c, name: c.name || 'SAADI Gymnastics', contact: c.contact || 'Dave Brooke', email: c.email || 'demo@club.example',
    licences: {recreational: {status: 'live'}},
    recTerm: {start: st, weeks: 14, halfTerm: '', classLen: 60, pieces: {VT: 'table', BM: 'beam', BA: 'bars', FT: 'fasttrack'}},
    plans: {preschool: {club: c.name || 'SAADI Gymnastics', startWeek: 1, seasonal: false, terms: [{name: 'This term ' + y, start: st, weeks: 14, half: 7}]}}};
}
function demoData(){
  const L = [['MAIN FLOOR','Floor','#4a90d9'], ['SPRUNG FLOOR 2','Floor','#3498db'], ['BARS PITSIDE','Bars','#7b68ee'], ['LOW BARS','Bars','#9b59b6'],
    ['BEAM ROW','Beam','#e8914f'], ['VAULT RUNWAY','Vault','#5cb85c'], ['TUMBLE TRACK','Tumble / Track','#d9534f'], ['DANCE STUDIO','Rooms','#f39c12'],
    ['PRE-SCHOOL ROOM','Rooms','#e91e8c'], ['CONDITIONING AREA','Other','#95a5a6']].map(([name, category, colour], i) => ({id: 'loc' + i, name, category, colour}));
  const G = [
    {id: 'g_p1', name: 'WAG Pearl 1', section: 'squad', colour: '#e74c3c', days: ['Monday','Wednesday','Friday','Saturday']},
    {id: 'g_p2', name: 'WAG Pearl 2', section: 'squad', colour: '#3498db', days: ['Monday','Wednesday','Friday']},
    {id: 'g_mag', name: 'MAG Development', section: 'squad', colour: '#2ecc71', days: ['Tuesday','Thursday']},
    {id: 'g_tum', name: 'Tumbling Squad', section: 'squad', colour: '#9b59b6', days: ['Tuesday','Thursday']},
    {id: 'g_pre', name: 'Pre-School Tots', section: 'recreational', colour: '#e91e8c', days: ['Wednesday','Saturday'], preschool: true}
  ];
  // a run of sessions, one after the other: [location, minutes, week B location, activity]
  const block = (start, list) => { let t = start; return list.map(([location, d, locationB, title]) => { const s = {location, start_min: t, duration: d, title: title || ''}; if (locationB) s.locationB = locationB; t += d; return s; }); };
  const p1 = st => block(st, [['CONDITIONING AREA', 20, '', 'Warm-up'], ['BARS PITSIDE', 45], ['BEAM ROW', 45], ['VAULT RUNWAY', 30, 'TUMBLE TRACK'], ['MAIN FLOOR', 40]]);
  const p2 = st => block(st, [['DANCE STUDIO', 20, '', 'Warm-up'], ['MAIN FLOOR', 45], ['VAULT RUNWAY', 30, 'TUMBLE TRACK'], ['BARS PITSIDE', 45], ['BEAM ROW', 40]]);
  const mag = st => block(st, [['SPRUNG FLOOR 2', 15, '', 'Warm-up'], ['MAIN FLOOR', 45], ['LOW BARS', 45, '', 'Parallel bars'], ['VAULT RUNWAY', 30], ['CONDITIONING AREA', 15, '', 'Strength & Conditioning']]);
  const tum = st => block(st, [['SPRUNG FLOOR 2', 15, '', 'Warm-up'], ['TUMBLE TRACK', 45], ['MAIN FLOOR', 45]]);
  const sessions = {}; DAYS.forEach(d => sessions[d] = {});
  ['Monday','Wednesday','Friday'].forEach(d => { sessions[d].g_p1 = p1(16 * 60 + 30); sessions[d].g_p2 = p2(16 * 60 + 30); });
  sessions.Saturday.g_p1 = p1(9 * 60);
  ['Tuesday','Thursday'].forEach(d => { sessions[d].g_mag = mag(17 * 60); sessions[d].g_tum = tum(18 * 60); });
  sessions.Wednesday.g_pre = block(10 * 60, [['PRE-SCHOOL ROOM', 45, '', 'Around the World with Somi & Flic']]);
  sessions.Saturday.g_pre = block(9 * 60, [['PRE-SCHOOL ROOM', 45, '', 'Around the World with Somi & Flic']]);
  return {groups: G, locations: L, sessions, rec: {classes: [
    {id: 'rc1', days: ['Monday','Tuesday','Wednesday','Thursday'], start: 16 * 60, groups: 3},
    {id: 'rc2', days: ['Monday','Wednesday'], start: 17 * 60, groups: 6},
    {id: 'rc3', days: ['Saturday'], start: 10 * 60, groups: 6, names: ['Ruby', 'Pink', '', '', '', '']}]}};
}
const DEMO_SPONSORS = [{id: 'demo-justgo', image: 'img/brand/justgo-logo-white.png', name: 'JustGo', w: 240, h: 40}];
const demoFeedbackList = () => [
  {id: 'fb1', message: 'Could the live screen show the coach’s name for each group?', name: 'Jo Evans', clubName: 'Riverside Gym Academy', email: 'office@riverside.example', uid: 'demo-riverside', submittedAt: new Date(Date.now() - 864e5).toISOString(), status: 'new'},
  {id: 'fb2', message: 'Loving the Final goes announcement. The gymnasts move much quicker now.', name: 'Sam Patel', clubName: 'Northgate Gymnastics Club', email: 'info@northgate.example', uid: 'demo-northgate', submittedAt: new Date(Date.now() - 9 * 864e5).toISOString(), status: 'read'}];

// ================================================================
// NGL RECREATIONAL: groups built from the club plan (Programmes → Recreational)
// ================================================================
const REC_RULES = {45:{warm:8, cool:4}, 60:{warm:10, cool:5}, 75:{warm:10, cool:5}};
const REC_WEEK_A = ['FF','VT','BM'], REC_WEEK_B = ['BF','BA','FT'];
const REC_PIECES = {FF:'Forward floor', BF:'Backward floor', VT:'Vault', BM:'Beam', BA:'Bars', FT:'Fast Track'};
const REC_COLOURS = [['Orange','#F28C28'],['Yellow','#F5C518'],['Blue','#2F80ED'],['Red','#E5383B'],['Green','#2EAD5B'],['Purple','#8E44AD']];
const REC_LOCS = [['FLOOR','#4a90d9'],['FORWARD FLOOR','#4a90d9'],['BACKWARD FLOOR','#2c6fb8'],['VAULT','#5cb85c'],['BEAM','#e8914f'],['BARS','#7b68ee'],['FAST TRACK','#d9534f']];
const REC_MAP = {warm:'FLOOR', FF:'FORWARD FLOOR', BF:'BACKWARD FLOOR', VT:'VAULT', BM:'BEAM', BA:'BARS', FT:'FAST TRACK'};
const REC_MAX = 3;   // groups per rotation

// The club's Recreational licence (was CLUB.rec {status:'active', expires} on the old hub)
function recActive(){ const r = CLUB && CLUB.licences && CLUB.licences.recreational; return !!(r && r.status === 'live'); }
function recTerm(){
  const t = (CLUB && CLUB.recTerm) || {};
  return {start:t.start || '', weeks:+t.weeks || 14, halfTerm:t.halfTerm || '', classLen:+t.classLen || 60,
    pieces:Object.assign({VT:'table', BM:'beam', BA:'bars', FT:'fasttrack'}, t.pieces || {})};
}
const _mon = x => { const d = new Date(x); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; };  // weeks run Monday to Sunday
// Which week of the club's term is it? Half term doesn't count.
function recWeekInfo(t, today){
  today = today || new Date();
  if(!t.start) return {letter:null, label:'Add your term dates in your club plan to switch weeks automatically'};
  const day = 86400000, start = _mon(t.start + 'T00:00:00');
  let wk = Math.floor((today - start) / (7 * day)) + 1;
  if(t.halfTerm){
    const hw = Math.floor((new Date(t.halfTerm + 'T00:00:00') - start) / (7 * day)) + 1;
    if(wk === hw) return {letter:null, label:'Half term'};
    if(wk > hw) wk -= 1;
  }
  if(wk < 1) return {letter:'A', label:'Term starts ' + start.toLocaleDateString('en-GB', {day:'numeric', month:'long'})};
  if(wk > t.weeks) return {letter:null, label:'Term has finished'};
  if(wk > t.weeks - 2) return {letter: wk === t.weeks - 1 ? 'A' : 'B', label:`Week ${wk} of ${t.weeks} (assessment)`};
  return {letter: (wk - 1) % 2 === 0 ? 'A' : 'B', label:`Week ${wk} of ${t.weeks}`};
}
function recSettings(){
  DATA.rec = DATA.rec || {};
  DATA.rec.classes = DATA.rec.classes || [];
  DATA.rec.map = Object.assign({...REC_MAP}, DATA.rec.map || {});
  if(!DATA.rec.map.cool) DATA.rec.map.cool = DATA.rec.map.warm;
  return DATA.rec;
}
function recEnsureLocations(){
  const have = new Set(DATA.locations.map(l => l.name));
  REC_LOCS.forEach(([n, c]) => { if(!have.has(n)) DATA.locations.push({id:genId(), name:n, category:n.includes('FLOOR') ? 'Floor' : 'Other', colour:c}); });
}
// Rebuild the Recreational groups and their sessions. Rotation A = Rotation Week A apparatus
// in Week A; Rotation B does the other set, and they swap each week (stored as locationB).
function applyRec(){
  DATA.groups = DATA.groups || []; DATA.sessions = DATA.sessions || {};
  const old = new Set(DATA.groups.filter(g => g.rec).map(g => g.id));
  DATA.groups = DATA.groups.filter(g => !g.rec);
  DAYS.forEach(d => { DATA.sessions[d] = DATA.sessions[d] || {}; old.forEach(id => delete DATA.sessions[d][id]); });
  if(!recActive()) return;
  const R = recSettings(); if(!R.classes.length) return;
  recEnsureLocations();
  const t = recTerm(), map = R.map;
  const has = c => !['VT','BM','BA'].includes(c) || t.pieces[c] !== 'none';
  const setA = REC_WEEK_A.filter(has), setB = REC_WEEK_B.filter(has);
  const rots = (set, j, start, len, rl) => {
    const teach = len - rl.warm - rl.cool, n = set.length, base = Math.floor(teach / n), out = [];
    let at = start + rl.warm;
    for(let r = 0; r < n; r++){ const d = r === n - 1 ? teach - base * (n - 1) : base; out.push({code:set[(j + r) % n], at, d}); at += d; }
    return out;
  };
  R.classes.slice().sort((a, b) => a.start - b.start).forEach(c => cDays(c).forEach(day => {
    const len = cLen(c, t), rl = cRule(c, t);
    for(let gi = 0; gi < Math.min(6, +c.groups || 0); gi++){
      const [cname, hex] = REC_COLOURS[gi], rotA = gi < REC_MAX, j = rotA ? gi : gi - REC_MAX;
      // one row per colour: every class's Orange group sits on the Orange row, one after the other
      const id = `rec_${gi}`;
      let g = DATA.groups.find(x => x.id === id);
      if(!g){ g = {id, name:cname, section:'recreational', colour:hex, days:[], rec:true, rotation:rotA ? 'A' : 'B'}; DATA.groups.push(g); }
      if(!g.days.includes(day)) g.days.push(day);
      const nm = (c.names && c.names[gi]) || '';
      const pat = recPattern(gi, has);
      const wk1 = pat ? rots(pat.A, 0, c.start, len, rl) : rots(rotA ? setA : setB, j, c.start, len, rl);
      const wk2 = pat ? rots(pat.B, 0, c.start, len, rl) : rots(rotA ? setB : setA, j, c.start, len, rl);
      const warmLoc = (R.warmBy && R.warmBy[gi]) || map.warm, coolLoc = map.cool || map.warm;
      const L = [{location:warmLoc, start_min:c.start, duration:rl.warm, title:nm ? nm + ' · Warm-up' : 'Warm-up', shared:true}];
      for(let r = 0; r < Math.max(wk1.length, wk2.length); r++){
        const a = wk1[r] || wk1[wk1.length - 1], b = wk2[r] || wk2[wk2.length - 1];
        // when the two weeks have different numbers of rotations (no bars, say) the timings differ: keep week 1's
        const s = {location:map[a.code], start_min:a.at, duration:a.d, title:''};
        if(map[b.code] !== map[a.code]) s.locationB = map[b.code];
        L.push(s);
      }
      L.push({location:coolLoc, start_min:c.start + len - rl.cool, duration:rl.cool, title:'Cool-down', shared:true});
      DATA.sessions[day][id] = (DATA.sessions[day][id] || []).concat(L).sort((a, b) => a.start_min - b.start_min);
    }
  }));
  const recG = DATA.groups.filter(g => g.rec).sort((a, b) => a.id.localeCompare(b.id));
  DATA.groups = DATA.groups.filter(g => !g.rec).concat(recG);
  recG.forEach(g => g.days.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)));
}
// The club's own rotation pattern for a group (Week A and Week B), if it has set one
function recPattern(gi, has){
  const p = DATA.rec && DATA.rec.pattern && DATA.rec.pattern[gi];
  if(!p || !Array.isArray(p.A) || !Array.isArray(p.B)) return null;
  const A = p.A.filter(c => REC_PIECES[c] && (!has || has(c))), B = p.B.filter(c => REC_PIECES[c] && (!has || has(c)));
  return A.length && B.length ? {A, B} : null;
}
// The NGL standard pattern, for filling in the grid
function recStdPattern(gi){
  const rotA = gi < REC_MAX, j = rotA ? gi : gi - REC_MAX, turn = set => set.map((_, r) => set[(j + r) % set.length]);
  return {A:turn(rotA ? REC_WEEK_A : REC_WEEK_B), B:turn(rotA ? REC_WEEK_B : REC_WEEK_A)};
}
const REC_KEYS = [['FORWARD','FF'],['BACKWARD','BF'],['VAULT','VT'],['BEAM','BM'],['BAR','BA'],['FAST','FT'],['TRACK','FT'],['TRAMP','FT']];
const recCodeOf = loc => { const u = String(loc || '').toUpperCase(); const k = REC_KEYS.find(([w]) => u.includes(w)); return k ? k[1] : null; };
// Rows brought across from the old planner that are named after a colour (ORANGE, YELLOW…)
function recOldColourRows(){
  return REC_COLOURS.map(([n], gi) => ({gi, g:DATA.groups.find(g => !g.rec && String(g.name).trim().toUpperCase() === n.toUpperCase())})).filter(x => x.g);
}
// Read the pattern, warm-up areas and piece locations from those rows
function recCopyFromRows(){
  const R = recSettings(), found = recOldColourRows(); let n = 0;
  R.pattern = R.pattern || {}; R.warmBy = R.warmBy || {};
  found.forEach(({gi, g}) => {
    const day = DAYS.find(d => (DATA.sessions[d] && DATA.sessions[d][g.id] || []).length); if(!day) return;
    const L = DATA.sessions[day][g.id].slice().sort((a, b) => a.start_min - b.start_min);
    let i = 0; while(i < L.length && !recCodeOf(L[i].location)) i++;
    if(i >= L.length) return;
    if(i > 0) R.warmBy[gi] = L[i - 1].location;
    const A = [], B = [];
    for(; i < L.length && A.length < 3 && recCodeOf(L[i].location); i++){
      const s = L[i], a = recCodeOf(s.location), b = recCodeOf(s.locationB || s.location);
      A.push(a); B.push(b); R.map[a] = s.location; if(s.locationB) R.map[b] = s.locationB;
    }
    if(i < L.length && !recCodeOf(L[i].location) && L[i].start_min === L[i - 1].start_min + L[i - 1].duration) R.map.cool = L[i].location;
    if(A.length){ R.pattern[gi] = {A, B}; n++; }
  });
  const w = Object.values(R.warmBy); if(w.length) R.map.warm = w[0];
  return n;
}
// A class can have its own length and warm-up/cool-down (a 45-minute pre-school class, say); otherwise the club plan's
function cLen(c, t){ return +(c && c.len) || (t || recTerm()).classLen; }
function cRule(c, t){ const L = cLen(c, t), d = REC_RULES[L] || REC_RULES[60];
  return {warm:c && c.warm != null && c.warm !== '' ? +c.warm : d.warm, cool:c && c.cool != null && c.cool !== '' ? +c.cool : d.cool}; }
// A class runs on one or more days (older saves had a single day)
function cDays(c){ return (c.days && c.days.length ? c.days : [c.day || 'Monday']).slice().sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)); }
function recGuard(groupId){
  const g = groupId && getGroupById(groupId);
  if(!g || !g.rec) return false;
  toast('This group is built from your Recreational classes');
  go('rec');
  return true;
}
// Week A / Week B follow the term dates for Recreational clubs
function recAutoWeek(quiet){
  if(!recActive() || !recSettings().classes.length) return;
  const wi = recWeekInfo(recTerm());
  if(!wi.letter || wi.letter === currentWeek) return;
  currentWeek = wi.letter;
  if(!quiet) setTimeout(() => toast('This week is ' + weekName(currentWeek) + ' (from your term dates)'), 400);
}
// Live screen label, matching the lesson plans: "Week 9 and 10, Rotation Week A" (assessment for the last two weeks).
// Falls back to "Rotation Week A" when there are no term dates, or the week shown has been switched by hand.
function liveWeekName(){
  const name = weekName(currentWeek);
  if(!recActive()) return name;
  const t = recTerm(); if(!t.start) return name;
  const wi = recWeekInfo(t); if(wi.letter !== currentWeek) return name;
  const m = /^Week (\d+) of (\d+)/.exec(wi.label || ''); if(!m) return name;
  const wk = +m[1], W = +m[2];
  if(wk > W - 2) return 'Assessment Week ' + (W - 1) + ' and ' + W + ', ' + name;
  const w1 = wk % 2 ? wk : wk - 1;
  return (w1 + 1 > W - 2 ? 'Week ' + w1 : 'Week ' + w1 + ' and ' + (w1 + 1)) + ', ' + name;
}
const recEsc = esc;

function renderRec(){
  if(!recActive()){
    return `<div class="rc-wrap"><div class="card rc-card"><h2>NGL Recreational</h2>
      <p>Clubs on the <b>NGL Recreational</b> programme can have their Recreational groups and rotations built here automatically from their club plan, switching Week A and Week B from their term dates.</p>
      <p>Your other classes work exactly as before on the Weekly Planner.</p>
      <p><a class="btn" href="#/programmes/recreational">Find out about NGL Recreational</a></p></div></div>`;
  }
  const R = recSettings(), t = recTerm(), rule = REC_RULES[t.classLen] || REC_RULES[60], wi = recWeekInfo(t);
  const locOpts = sel => DATA.locations.map(l => `<option ${l.name === sel ? 'selected' : ''}>${recEsc(l.name)}</option>`).join('');
  const used = ['FF','BF','VT','BM','BA','FT'].filter(c => !['VT','BM','BA'].includes(c) || t.pieces[c] !== 'none');
  const rows = R.classes.map(c => {
    const end = c.start + cLen(c, t), cr = cRule(c, t);
    const clash = R.classes.find(o => o !== c && cDays(o).some(d => cDays(c).includes(d)) && o.start < end && c.start < o.start + cLen(o, t));
    const hh = String(Math.floor(c.start / 60)).padStart(2, '0') + ':' + String(c.start % 60).padStart(2, '0');
    const id = esc(c.id);
    return `<div class="rc-slot" data-id="${id}">
      <div class="rc-f rc-daysf"><label>Days</label><div class="rc-days">${DAYS.map(d => `<button type="button" class="rc-day ${cDays(c).includes(d) ? 'on' : ''}" data-rc-day="${d}" aria-pressed="${cDays(c).includes(d)}">${d.slice(0,3)}</button>`).join('')}</div></div>
      <div class="rc-f"><label for="rcs_${id}">Class starts</label><input id="rcs_${id}" type="time" step="300" data-rc="start" value="${hh}"></div>
      <div class="rc-f"><label for="rcg_${id}">Groups</label><select id="rcg_${id}" data-rc="groups">${[1,2,3,4,5,6].map(n => `<option ${n === +c.groups ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <button class="rc-del" data-rc-del>Remove</button>
      <div class="rc-f"><label for="rcl_${id}">Length</label><select id="rcl_${id}" data-rc="len"><option value="">Club plan (${t.classLen} min)</option>${[30,45,60,75,90].map(n => `<option value="${n}" ${n === +c.len ? 'selected' : ''}>${n} min</option>`).join('')}</select></div>
      <div class="rc-f"><label for="rcw_${id}">Warm-up (min)</label><input id="rcw_${id}" type="number" min="0" max="30" data-rc="warm" value="${c.warm != null ? c.warm : ''}" placeholder="${cr.warm}"></div>
      <div class="rc-f"><label for="rcc_${id}">Cool-down (min)</label><input id="rcc_${id}" type="number" min="0" max="30" data-rc="cool" value="${c.cool != null ? c.cool : ''}" placeholder="${cr.cool}"></div>
      <div class="rc-names">${Array.from({length:+c.groups}, (_, gi) => `<span class="rc-g"><i style="background:${REC_COLOURS[gi][1]}"></i><input data-rc-name="${gi}" aria-label="${REC_COLOURS[gi][0]} group name" value="${recEsc((c.names && c.names[gi]) || '')}" placeholder="${REC_COLOURS[gi][0]}"><small>Rotation ${gi < REC_MAX ? 'A' : 'B'}</small></span>`).join('')}</div>
      <p class="rc-note">${fmtTime(c.start)} to ${fmtTime(end)} · warm-up ${cr.warm} min, cool-down ${cr.cool} min${clash ? ` <b class="rc-warn">Overlaps the ${fmtTime(clash.start)} class</b>` : ''}</p></div>`;
  }).join('');
  // Rotation pattern grid
  const nG = Math.max(0, ...R.classes.map(c => +c.groups || 0));
  const hasP = c => used.includes(c), cur = gi => recPattern(gi, hasP) || recStdPattern(gi);
  const pOpts = sel => `<option value="">–</option>` + used.map(c => `<option value="${c}" ${c === sel ? 'selected' : ''}>${REC_PIECES[c]}</option>`).join('');
  const warns = [];
  for(let gi = 0; gi < nG; gi++){
    const p = cur(gi), miss = used.filter(c => !p.A.includes(c) && !p.B.includes(c));
    if(miss.length) warns.push(`${REC_COLOURS[gi][0]} never goes on ${miss.map(c => REC_PIECES[c]).join(', ')}`);
  }
  ['A','B'].forEach((w, wix) => [0,1,2].forEach(r => {
    const seen = {};
    for(let gi = 0; gi < nG; gi++){ const c = cur(gi)[w][r]; if(!c) continue;
      if(seen[c] != null) warns.push(`Week ${wix + 1}, rotation ${r + 1}: ${REC_COLOURS[seen[c]][0]} and ${REC_COLOURS[gi][0]} are both on ${REC_PIECES[c]}`); else seen[c] = gi; }
  }));
  const oldRows = recOldColourRows(), custom = !!(R.pattern && Object.keys(R.pattern).length);
  const patCard = nG ? `<div class="card rc-card"><h2>Your rotation pattern</h2>
      <p>Which piece each group goes to in each rotation. ${custom ? 'This is <b>your club’s own pattern</b>.' : 'This is the <b>NGL standard pattern</b>. Change any box to match what your club runs.'} The Weekly Planner, the live screen and <b>Run your class</b> in the Hub all follow it.</p>
      <div class="rc-patwrap"><table class="rc-pat"><thead><tr><th>Group</th><th>Warm-up</th><th colspan="3">Week A</th><th colspan="3">Week B</th></tr>
        <tr class="rc-sub"><th></th><th></th><th>1st</th><th>2nd</th><th>3rd</th><th>1st</th><th>2nd</th><th>3rd</th></tr></thead><tbody>
        ${Array.from({length:nG}, (_, gi) => { const p = cur(gi); return `<tr><td><span class="rc-g"><i style="background:${REC_COLOURS[gi][1]}"></i>${REC_COLOURS[gi][0]}</span></td>
          <td><select data-rc-warm="${gi}" aria-label="${REC_COLOURS[gi][0]} warm-up area">${locOpts((R.warmBy && R.warmBy[gi]) || R.map.warm)}</select></td>
          ${['A','B'].map(w => [0,1,2].map(r => `<td class="${w === 'B' && r === 0 ? 'rc-wk2' : ''}"><select data-rc-pat="${gi}|${w}|${r}" aria-label="${REC_COLOURS[gi][0]}, Week ${w}, rotation ${r + 1}">${pOpts(p[w][r])}</select></td>`).join('')).join('')}</tr>`; }).join('')}
      </tbody></table></div>
      ${warns.length ? `<p class="rc-warn">${warns.map(recEsc).join('<br>')}</p>` : '<p class="rc-note">✓ Every group does every piece, and no two groups are on the same piece at the same time.</p>'}
      <div class="rc-btns">
        ${oldRows.length ? `<button class="btn" data-rc-copy>Copy from my ${oldRows.map(x => recEsc(x.g.name)).join(', ')} rows</button>` : ''}
        ${custom ? `<button class="btn ghost" data-rc-std>Go back to the NGL standard pattern</button>` : ''}
        ${oldRows.length && custom ? `<button class="btn ghost" data-rc-delold>Delete the old ${oldRows.length} colour rows</button>` : ''}
      </div></div>` : '';
  return `<div class="rc-wrap">
    <div class="card rc-card"><h2>Recreational classes</h2>
      <p>Add a line for each class time, and tick the days it runs. The first 3 groups go on <b>Rotation A</b> and the rest on <b>Rotation B</b>. Each week the two rotations swap apparatus, and each group starts on a different piece. Groups are coloured Orange, Yellow, Blue, Red, Green, Purple; add names if you like.</p>
      ${rows || '<p class="rc-note">No classes yet.</p>'}
      <button class="btn" data-rc-add>+ Add a class</button></div>
    ${patCard}
    <div class="card rc-card"><h2>From your club plan</h2>
      <p>Classes are <b>${t.classLen} minutes</b>: ${rule.warm} minutes warm-up, rotations, ${rule.cool} minutes cool-down. <b>This week:</b> ${recEsc(wi.label)}${wi.letter ? ` · ${weekName(wi.letter)}` : ''}.</p>
      <div class="rc-btns" style="margin:4px 0 10px"><button class="btn ghost" data-act="rp-recprint">Print term sheet</button><span class="rc-note">Both rotation weeks, class times and the term calendar on one page. Save it as a PDF for a back-up.</span></div>
      <p class="rc-note">Week A and Week B switch on their own from your term dates. To change class length, apparatus or term dates, update your club plan in <a href="#/programmes/recreational/teach">Programmes → Recreational</a>.</p></div>
    <div class="card rc-card"><h2>Where each piece is in your hall</h2>
      <p class="rc-note">Forward and backward floor run at the same time (one group from each rotation), so they need two areas of floor.</p>
      <div class="rc-map"><b>Warm-up</b><select data-rc-map="warm" aria-label="Warm-up">${locOpts(R.map.warm)}</select></div>
      <div class="rc-map"><b>Cool-down</b><select data-rc-map="cool" aria-label="Cool-down">${locOpts(R.map.cool)}</select></div>
      ${used.map(c => `<div class="rc-map"><b>${REC_PIECES[c]}</b><select data-rc-map="${c}" aria-label="${REC_PIECES[c]}">${locOpts(R.map[c])}</select></div>`).join('')}</div>
  </div>`;
}
function refreshRec(){ const v = document.getElementById('recView'); if (v) v.innerHTML = renderRec(); }
// ================================================================
// RECREATIONAL TERM SHEET: one A4 landscape page for the whole term
// ================================================================
function recPrintSheet(){
  const R = recSettings(), t = recTerm(), rule = REC_RULES[t.classLen] || REC_RULES[60];
  const used = ['FF','BF','VT','BM','BA','FT'].filter(c => !['VT','BM','BA'].includes(c) || t.pieces[c] !== 'none');
  const hasP = c => used.includes(c), cur = gi => { const s = recStdPattern(gi); return recPattern(gi, hasP) || {A:s.A.filter(hasP), B:s.B.filter(hasP)}; };
  const nG = Math.max(0, ...R.classes.map(c => +c.groups || 0));
  if(!R.classes.length || !nG){ toast('Add your Recreational classes first'); return; }
  const PCOL = {FF:'#4a90d9', BF:'#2c6fb8', VT:'#5cb85c', BM:'#e8914f', BA:'#7b68ee', FT:'#d9534f'};
  const nice = s => String(s || '').toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const nR = Math.max(...Array.from({length:nG}, (_, gi) => Math.max(cur(gi).A.length, cur(gi).B.length)));
  const teach = t.classLen - rule.warm - rule.cool, base = Math.floor(teach / nR);
  const slots = [['Warm-up', 0, rule.warm]];
  for(let r = 0, at = rule.warm; r < nR; r++){ const d = r === nR - 1 ? teach - base * (nR - 1) : base; slots.push(['Rotation ' + (r + 1), at, at + d]); at += d; }
  slots.push(['Cool-down', t.classLen - rule.cool, t.classLen]);
  const table = w => `<div class="wk"><div class="wkh"><span class="badge ${w}">Week ${w === 'A' ? 1 : 2}</span></div><table class="rot"><thead><tr><th>Group</th>${slots.map(([n, a, b]) => `<th>${n}<small>${a}–${b} min</small></th>`).join('')}</tr></thead><tbody>${
    Array.from({length:nG}, (_, gi) => { const p = cur(gi)[w];
      return `<tr><th><i style="background:${REC_COLOURS[gi][1]}"></i>${REC_COLOURS[gi][0]}</th><td class="wm">${recEsc(nice((R.warmBy && R.warmBy[gi]) || R.map.warm))}</td>${
        Array.from({length:nR}, (_, r) => p[r] ? `<td class="pc" style="background:${PCOL[p[r]]}">${REC_PIECES[p[r]]}</td>` : '<td class="wm">–</td>').join('')
      }<td class="wm">${recEsc(nice(R.map.cool || R.map.warm))}</td></tr>`; }).join('')}</tbody></table></div>`;
  // class times, grouped by the days they run
  const span = ds => { const ix = ds.map(d => DAYS.indexOf(d)); return ds.length > 2 && ix.every((x, i) => !i || x === ix[i - 1] + 1) ? ds[0] + ' to ' + ds[ds.length - 1] : ds.join(', '); };
  const byDays = {}; R.classes.slice().sort((a, b) => a.start - b.start).forEach(c => { const k = cDays(c).join(','); (byDays[k] = byDays[k] || []).push(c.start); });
  const times = Object.entries(byDays).sort((a, b) => DAYS.indexOf(a[0].split(',')[0]) - DAYS.indexOf(b[0].split(',')[0]))
    .map(([k, ss]) => `<tr><th>${recEsc(span(k.split(',')))}</th><td>${ss.map(hm).join(' &nbsp; ')}</td></tr>`).join('');
  const first = Math.min(...R.classes.map(c => c.start));
  const eg = slots.slice(1, -1).map(x => hm(first + x[1])).join(', ');
  // term calendar, Monday to Sunday weeks, half term skipped
  let cal = '', termLine = '';
  if(t.start){
    const day = 86400000, st = new Date(t.start + 'T00:00:00'), m0 = _mon(st);
    const hw = t.halfTerm ? Math.floor((new Date(t.halfTerm + 'T00:00:00') - m0) / (7 * day)) + 1 : 0;
    const fd = d => d.getDate() + ' ' + d.toLocaleDateString('en-GB', {month:'short'});
    const cells = [];
    for(let c = 1; c <= t.weeks + (hw ? 1 : 0); c++){
      const a = new Date(m0), b = new Date(m0); a.setDate(a.getDate() + 7 * (c - 1)); b.setDate(b.getDate() + 7 * (c - 1) + 6); const from = a < st ? st : a;
      if(c === hw){ cells.push(`<div class="cw ht"><b>HT</b><span>${fd(from)}–${fd(b)}</span><em>Half term</em></div>`); continue; }
      const wk = hw && c > hw ? c - 1 : c, as = wk > t.weeks - 2, L = as ? (wk === t.weeks - 1 ? 1 : 2) : ((wk - 1) % 2 === 0 ? 1 : 2);
      cells.push(`<div class="cw ${as ? 'as' : L === 1 ? 'A' : 'B'}"><b>Wk ${wk}</b><span>${fd(from)}–${fd(b)}</span><em>Week ${L === 1 ? 'A' : 'B'}${as ? ' · Assess' : ''}</em></div>`);
    }
    cal = `<div class="calh">Term calendar <small>which rotation week to use · the last two weeks are assessment · weeks run Monday to Sunday</small></div><div class="cal" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.join('')}</div>`;
    const mo = st.getMonth(), season = mo >= 8 ? 'Autumn' : mo <= 2 ? 'Spring' : 'Summer';
    termLine = `${season} term ${st.getFullYear()} · ${t.weeks} weeks from ${st.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'})} · `;
  }
  const club = recEsc((CLUB && CLUB.name) || 'Your club');
  const areas = used.map(c => { const loc = nice(R.map[c]); return `<div><i style="background:${PCOL[c]}"></i>${REC_PIECES[c]}${loc.toLowerCase() === REC_PIECES[c].toLowerCase() ? '' : ' · ' + recEsc(loc)}</div>`; }).join('');
  const w = window.open('', '_blank');
  if(!w){ toast('Allow pop-ups to print the term sheet', false); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${club} · Recreational term sheet</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Roboto+Condensed:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Roboto,Arial,sans-serif;color:#1e1a4c;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{width:297mm;height:210mm;padding:8mm 9mm 7mm;display:flex;flex-direction:column;gap:3mm;overflow:hidden}
.top{display:flex;align-items:center;gap:5mm;border-bottom:1.2mm solid #E88230;padding-bottom:2.5mm}.top img{height:14mm}
h1{font-family:'Roboto Condensed',Arial,sans-serif;font-weight:700;font-size:22pt;margin:0;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.top>div:nth-child(2){min-width:0}.top p{margin:1mm 0 0;font-size:9.5pt;color:#555}.top .r{margin-left:auto;text-align:right;font-size:8.5pt;color:#555}
.main{display:grid;grid-template-columns:1fr 64mm;gap:5mm;flex:1;min-height:0}.wk{margin-bottom:2mm}.wkh{margin-bottom:1mm}
.badge{font-family:'Roboto Condensed',Arial,sans-serif;font-weight:700;color:#fff;border-radius:2mm;padding:.5mm 3mm;font-size:12pt}.badge.A{background:#1e1a4c}.badge.B{background:#E88230}
table{border-collapse:separate;border-spacing:.8mm;width:100%}.rot{table-layout:fixed}.rot thead th:first-child{width:23mm}.rot thead th:nth-child(2),.rot thead th:last-child{width:22mm}.rot th,.rot td{font-size:8.6pt;padding:1.05mm 2mm;border-radius:1.2mm;text-align:left}
.rot thead th{background:#ece9f5;font-family:'Roboto Condensed',Arial,sans-serif;font-size:10pt}.rot thead small{display:block;font-family:Roboto,Arial,sans-serif;font-weight:400;font-size:7.4pt;color:#666}
.rot tbody th{width:23mm;font-family:'Roboto Condensed',Arial,sans-serif;font-size:10.5pt;background:#f6f5fa;white-space:nowrap}.rot tbody th i{display:inline-block;width:3.2mm;height:3.2mm;border-radius:50%;margin-right:1.6mm;vertical-align:-.5mm}
.wm{background:#f6f5fa;color:#555;width:22mm}.pc{color:#fff;font-weight:500;font-size:9pt!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
h2{font-family:'Roboto Condensed',Arial,sans-serif;font-size:12pt;margin:0 0 1mm}.box{background:#f6f5fa;border-radius:2mm;padding:2.5mm 3mm;margin-bottom:3mm;font-size:8.4pt;line-height:1.4}
.times th,.times td{font-size:8.6pt;padding:.8mm 1mm;text-align:left;vertical-align:top}.times td{font-weight:500;white-space:nowrap}
.key div{display:flex;align-items:center;gap:1.5mm;margin:.6mm 0}.key i{width:3.4mm;height:3.4mm;border-radius:.8mm;display:inline-block}
.calh{font-family:'Roboto Condensed',Arial,sans-serif;font-weight:600;font-size:12pt;margin-bottom:1mm}.calh small{font-family:Roboto,Arial,sans-serif;font-weight:400;font-size:8pt;color:#666}
.cal{display:grid;gap:.8mm}.cw{border-radius:1.4mm;padding:1.2mm 1mm;text-align:center;font-size:7pt;line-height:1.25;background:#f6f5fa}
.cw b{display:block;font-family:'Roboto Condensed',Arial,sans-serif;font-size:9.5pt}.cw span{display:block;color:#555}.cw em{display:block;font-style:normal;font-weight:500;margin-top:.4mm}
.cw.A{border-top:1.2mm solid #1e1a4c}.cw.B{border-top:1.2mm solid #E88230}.cw.as{background:#fff4d6;border-top:1.2mm solid #d9a521}.cw.ht{background:#e9e9e9;color:#777;border-top:1.2mm solid #aaa}
.foot{font-size:7.4pt;color:#777;display:flex;justify-content:space-between}
@media screen{body{background:#666}.pg{background:#fff;margin:10px auto;box-shadow:0 4px 20px rgba(0,0,0,.4)}}</style></head><body><div class="pg">
<div class="top"><img src="https://nglrecreational.co.uk/icons/rec-logo.png" alt="" onerror="this.remove()"><div><h1>${club} · Recreational class rotations</h1><p>${termLine}${t.classLen}-minute classes · ${nG} groups</p></div><div class="r">NGL Rotation Planner<br>Printed ${new Date().toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'})}</div></div>
<div class="main"><div>${table('A')}${table('B')}</div><div>
<h2>Class times</h2><div class="box"><table class="times">${times}</table></div>
<h2>Within each class</h2><div class="box">Warm-up ${rule.warm} min · ${nR} rotations of about ${base} min · cool-down ${rule.cool} min.<br>Example, ${hm(first)} class: rotations at ${eg}, cool-down ${hm(first + t.classLen - rule.cool)}.</div>
<h2>Apparatus and areas</h2><div class="box key">${areas}</div></div></div>
${cal}<div class="foot"><span>NGL Recreational · nglrecreational.co.uk</span><span>Choose “Save as PDF” in the print window to keep a copy.</span></div>
</div><script>
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { const i = document.querySelector('img'); const go = () => setTimeout(() => window.print(), 150); if(i && !i.complete){ i.onload = i.onerror = go; } else go(); });<\/script></body></html>`);
  w.document.close();
}
function recChanged(){ applyRec(); recAutoWeek(true); scheduleAutoSave(); refreshRec(); }
document.addEventListener('change', e => {
  const v = document.getElementById('recView'); if(!v || !v.contains(e.target)) return;
  const R = recSettings(), slot = e.target.closest('.rc-slot');
  if(e.target.dataset.rcMap){
    if(e.target.dataset.rcMap === 'warm' && R.warmBy) R.warmBy = {};   // one warm-up area for everyone again
    R.map[e.target.dataset.rcMap] = e.target.value; return recChanged(); }
  if(e.target.dataset.rcWarm != null){ R.warmBy = R.warmBy || {}; R.warmBy[e.target.dataset.rcWarm] = e.target.value; return recChanged(); }
  if(e.target.dataset.rcPat){
    const [gi, w, r] = e.target.dataset.rcPat.split('|'), t = recTerm();
    const has = c => !['VT','BM','BA'].includes(c) || t.pieces[c] !== 'none';
    const p = recPattern(+gi, has) || recStdPattern(+gi), np = {A:p.A.slice(), B:p.B.slice()};
    np[w][+r] = e.target.value; np[w] = np[w].filter(Boolean);
    R.pattern = R.pattern || {}; R.pattern[gi] = np; return recChanged();
  }
  if(!slot) return;
  const c = R.classes.find(x => x.id === slot.dataset.id); if(!c) return;
  if(e.target.dataset.rc === 'groups') c.groups = +e.target.value;
  else if(['len','warm','cool'].includes(e.target.dataset.rc)){ const k = e.target.dataset.rc, val = e.target.value; if(val === '') delete c[k]; else c[k] = Math.max(0, +val); }
  else if(e.target.dataset.rc === 'start'){ const [h, m] = e.target.value.split(':').map(Number); if(!isNaN(h)) c.start = h * 60 + (m || 0); }
  else if(e.target.dataset.rcName != null){ c.names = c.names || []; c.names[+e.target.dataset.rcName] = e.target.value.trim(); }
  recChanged();
});
document.addEventListener('click', async e => {
  const v = document.getElementById('recView'); if(!v || !v.contains(e.target)) return;
  const R = recSettings();
  const dayBtn = e.target.closest('[data-rc-day]');
  if(dayBtn){
    const c = R.classes.find(x => x.id === dayBtn.closest('.rc-slot').dataset.id); if(!c) return;
    const d = dayBtn.dataset.rcDay, cur = cDays(c);
    c.days = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
    if(!c.days.length) c.days = [d];   // a class needs at least one day
    delete c.day; return recChanged();
  }
  if(e.target.closest('[data-rc-copy]')){
    const n = recCopyFromRows(); recChanged();
    return toast(n ? `Copied the pattern for ${n} group${n === 1 ? '' : 's'}. Check the Weekly Planner, then delete the old rows.` : 'Couldn’t find a rotation in those rows', !!n);
  }
  if(e.target.closest('[data-rc-std]')){
    if(!await ask('Go back to the NGL standard pattern? Your own pattern will be cleared.', 'Go back')) return;
    delete R.pattern; delete R.warmBy; return recChanged();
  }
  if(e.target.closest('[data-rc-delold]')){
    const rows = recOldColourRows();
    if(!await ask(`Delete the old ${rows.map(x => x.g.name).join(', ')} rows from the Weekly Planner? Your Recreational groups built here stay.`, 'Delete')) return;
    const ids = new Set(rows.map(x => x.g.id));
    DATA.groups = DATA.groups.filter(g => !ids.has(g.id));
    DAYS.forEach(d => { if(DATA.sessions[d]) ids.forEach(id => delete DATA.sessions[d][id]); });
    recChanged(); return toast('Old rows deleted');
  }
  if(e.target.closest('[data-rc-add]')){
    const last = R.classes[R.classes.length - 1];
    R.classes.push({id:genId(), days:last ? cDays(last) : ['Monday','Tuesday','Wednesday','Thursday','Friday'], start:last ? last.start + cLen(last) : 16 * 60, groups:3});
    recChanged();
  }else if(e.target.closest('[data-rc-del]')){
    const id = e.target.closest('.rc-slot').dataset.id;
    if(!await ask('Remove this class and its groups?', 'Remove')) return;
    R.classes = R.classes.filter(c => c.id !== id); recChanged();
  }
});

// ================================================================
// BRING DATA ACROSS FROM THE OLD PLANNER (old login, or an export file). Reads only: nothing in the old planner changes.
// ================================================================
const SPONSOR_DB = 'https://saadi-rotation-default-rtdb.europe-west1.firebasedatabase.app';
const OLD_CONFIG = {apiKey:"AIzaSyDV7BuYhSjji9DQDjih5a6Ms7G-SVZpKw4", authDomain:"saadi-rotation.firebaseapp.com", databaseURL:SPONSOR_DB, projectId:"saadi-rotation"};
function openMoveModal(){
  const m = modal(`<div class="rp-dlg" id="rpMove"><h2>Bring your rotations across</h2>
      <p class="rc-note" style="color:var(--muted);font-size:13px">Copy your groups, sessions and locations from the old NGL Rotation Planner. Nothing in the old planner changes. This replaces what’s on this page now (your Recreational classes are kept).</p>
      <label class="field"><span>Old planner email</span><input type="email" id="mv_em" autocomplete="off"></label>
      <label class="field"><span>Old planner password</span><input type="password" id="mv_pw" autocomplete="off"></label>
      <div class="btn-row"><button class="btn" id="mv_go" data-act="rp-move-go">Bring across</button></div>
      <label class="field" style="margin-top:18px"><span style="font-weight:400;color:var(--muted)">Or choose an exported file (from the old planner’s Export button):</span><input type="file" id="mv_file" accept=".json,application/json"></label>
      <p class="err" id="mv_err" role="alert"></p>
      <div class="btn-row"><button class="btn ghost" data-close>Close</button></div></div>`);
  m.querySelector('#mv_file').addEventListener('change', async e => {
    try{ await moveIn(JSON.parse(await e.target.files[0].text())); }
    catch(x){ m.querySelector('#mv_err').textContent = 'That doesn’t look like a rotation planner file.'; }
  });
}
async function moveGo(btn){
  const m = document.getElementById('rpMove'), err = m.querySelector('#mv_err'); err.textContent = '';
  if (!LIVE_DB) { err.textContent = 'Sample data: nothing is brought across. Choose an exported file below to try it.'; return; }
  btn.disabled = true; btn.textContent = 'Bringing across…';
  try{
    const [appM, authM] = await Promise.all([import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`), import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-auth.js`)]);
    const app = appM.getApps().find(a => a.name === 'old') || appM.initializeApp(OLD_CONFIG, 'old'), A2 = authM.getAuth(app);
    const cred = await authM.signInWithEmailAndPassword(A2, m.querySelector('#mv_em').value.trim(), m.querySelector('#mv_pw').value);
    const tok = await cred.user.getIdToken();
    const r = await fetch(`${SPONSOR_DB}/clubs/${cred.user.uid}/rota.json?auth=${tok}`);
    const old = await r.json(); await authM.signOut(A2);
    if(!old || !Array.isArray(old.groups) || !old.groups.length){ err.textContent = 'That login worked, but there are no rotations saved in that account. Try another old login, or choose an exported file below.'; btn.disabled = false; btn.textContent = 'Bring across'; return; }
    await moveIn(old);
  }catch(e){ console.error(e); err.textContent = 'That email and password didn’t work for the old planner.'; }
  btn.disabled = false; btn.textContent = 'Bring across';
}
async function moveIn(old){
  if(!old || !Array.isArray(old.groups)) throw new Error('no data');
  if(DATA.groups.some(g => !g.rec) && !await ask('Replace the groups and sessions on this page with the ones from the old planner?', 'Replace')) return;
  const rec = DATA.rec;
  DATA = {groups:old.groups.filter(g => !g.rec), locations:old.locations || [], sessions:old.sessions || {}};
  if(rec) DATA.rec = rec;
  DAYS.forEach(d => { if(!DATA.sessions[d]) DATA.sessions[d] = {}; });
  applyRec(); scheduleAutoSave();
  const d = document.getElementById('rpMove'); if (d) d.closest('.modal-bg').remove();
  go('planner'); draw();
  toast(`Brought across ${DATA.groups.filter(g => !g.rec).length} groups`);
}

// ================================================================
// DATABASE (this app's Firestore; sample data never writes)
// ================================================================
function normalise(rota){
  DATA = rota && rota.groups ? rota : {groups:[], locations:[], sessions:{}};
  if(!DATA.sessions) DATA.sessions = {};
  if(!DATA.locations) DATA.locations = [];
  DAYS.forEach(d => { if(!DATA.sessions[d]) DATA.sessions[d] = {}; });
}
async function load(){
  S.err = '';
  try { S.admin = await api.adminMe(); } catch (_) { S.admin = null; }
  S.canAdmin = !!(S.admin && (S.admin.owner || (S.admin.sections || []).includes('rotation')));
  try {
    if (!LIVE_DB) { currentClubId = 'demo'; CLUB = demoClub(await api.club()); normalise(demoData()); sponsorList = DEMO_SPONSORS.slice(); }
    else {
      const {fs, A, D} = await fb(); currentClubId = A.currentUser.uid;
      const snap = await fs.getDoc(fs.doc(D, 'clubs', currentClubId));
      CLUB = snap.exists() ? snap.data() : {}; S.lastJson = CLUB.rotaJson || '';
      let rota = null; try { rota = CLUB.rotaJson ? JSON.parse(CLUB.rotaJson) : null; } catch (e) { console.warn('Rotation data unreadable', e); }
      normalise(rota);
      loadSponsors();
    }
  } catch (e) { console.error(e); S.err = 'Couldn’t load your rotations just now. Check your connection and try again.'; normalise(null); return; }
  applyRec(); recAutoWeek(false);
  if(recActive() && recSettings().classes.length) scheduleAutoSave();   // keeps the live screen up to date with the club plan
  mobDayIdx = DAYS.indexOf(getTodayName()); if(mobDayIdx < 0) mobDayIdx = 1;
}
async function dbPutRota(data){
  const {fs, D} = await fb(), json = JSON.stringify(data);
  S.lastJson = json;
  await fs.setDoc(fs.doc(D, 'clubs', currentClubId), {rotaJson: json, rotaUpdatedAt: fs.serverTimestamp()}, {merge: true});
  // public copy for the live screen link and the family app
  await fs.setDoc(fs.doc(D, 'rotaLive', currentClubId), {json, clubName: (CLUB && CLUB.name) || '', term: recActive() ? JSON.stringify(recTerm()) : '', updatedAt: fs.serverTimestamp()})
    .catch(e => console.warn('Live copy not saved', e));
}
function setStatus(t){ S.status = t; const el = document.getElementById('rpSaveStatus'); if (el) el.textContent = t; }
function scheduleAutoSave(){
  setStatus('Unsaved changes…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 2500);
}
async function saveNow(){
  clearTimeout(saveTimer);
  const btn = document.querySelector('[data-act="rp-save"]');
  if(btn){ btn.lastChild.textContent = ' Saving…'; btn.disabled = true; }
  lastSaveTime = Date.now();
  try{
    if (LIVE_DB) await dbPutRota(DATA);
    const n = new Date();
    setStatus(`Saved ${n.getHours()}:${String(n.getMinutes()).padStart(2,'0')}` + (LIVE_DB ? '' : ' (sample data: nothing is stored)'));
  }catch(e){ console.error(e); setStatus('Save failed'); }
  finally{ const b = document.querySelector('[data-act="rp-save"]'); if(b){ b.lastChild.textContent = ' Save'; b.disabled = false; } }
}
function startRealtimeListener(){
  if(!LIVE_DB || S.unsub) return;
  S.unsub = 'starting';
  fb().then(({fs, D}) => {
    if (S.unsub !== 'starting') return;
    S.unsub = fs.onSnapshot(fs.doc(D, 'clubs', currentClubId), snap => {
      if(snap.metadata.hasPendingWrites || Date.now() - lastSaveTime < 3000 || !snap.exists()) return;
      const c = snap.data(); CLUB = c;
      if(!c.rotaJson || c.rotaJson === S.lastJson) return;   // nothing new (the data we loaded or saved ourselves)
      let rota; try { rota = JSON.parse(c.rotaJson); } catch (e) { return; }
      S.lastJson = c.rotaJson;
      normalise(rota); applyRec();
      if(liveMode) renderTimeline(getTodayName()); else draw();
      toast('Updated by another user');
    }, err => console.warn('Sync stopped', err));
    if (!S.syncToast) { S.syncToast = true; toast('Live sync active'); }
  }).catch(e => { console.warn(e); S.unsub = null; });
}
function stopRealtimeListener(){ if (typeof S.unsub === 'function') S.unsub(); S.unsub = null; }

// ================================================================
// UTILITIES
// ================================================================
function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function fmtTime(m){ const h=Math.floor(m/60),mi=m%60,ap=h>=12?'pm':'am',hh=h>12?h-12:h===0?12:h; return hh+':'+(mi<10?'0':'')+mi+ap; }
function nowMinutes(){ const d=new Date(); return d.getHours()*60+d.getMinutes()+d.getSeconds()/60; }
function getTodayName(){ return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]; }
function isLight(hex){ if(!hex||!hex.startsWith('#')) return false; const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>150; }
function getGroupById(id){ return DATA.groups.find(g=>g.id===id); }
function getLocByName(name){ return DATA.locations.find(l=>l.name===name); }
// Display names for the two rotation weeks — internally they are still stored as 'A' and 'B'
function weekName(w){ return 'Rotation Week '+(w==='B'?'B':'A'); }
function getSessionLocation(s){ return currentWeek==='B'&&s.locationB?s.locationB:s.location; }
const escHtml = esc;
// The original's confirm(): the same question, in an app dialog. Resolves true when the club says yes.
function ask(msg, yes = 'Yes'){
  return new Promise(res => {
    const m = modal(`<div class="rp-dlg rp-ask"><p style="margin:0 0 6px;font-size:16px">${esc(msg)}</p><div class="btn-row"><button class="btn" data-yes>${esc(yes)}</button><button class="btn ghost" data-close>Cancel</button></div></div>`);
    let done = false; const fin = v => { if (done) return; done = true; res(v); };
    m.querySelector('[data-yes]').addEventListener('click', () => { m.remove(); fin(true); });
    new MutationObserver((_, o) => { if (!m.isConnected) { o.disconnect(); fin(false); } }).observe(document.body, {childList: true});
    m.querySelector('[data-yes]').focus();
  });
}
const closeDlg = id => { const d = document.getElementById(id); if (d) d.closest('.modal-bg').remove(); };
const dlgErr = (id, msg) => { const e = document.getElementById(id); if (e) e.textContent = msg; };

function getDayBounds(day){
  const sessions=DATA.sessions[day]||{};
  let min=Infinity,max=-Infinity;
  Object.values(sessions).forEach(arr=>arr.forEach(s=>{ min=Math.min(min,s.start_min); max=Math.max(max,s.start_min+s.duration); }));
  if(min===Infinity){min=8*60;max=20*60;}
  else{min=Math.min(min,8*60);max=Math.max(max,20*60);}
  return{min,max};
}
function getConflicts(day){
  if(!DATA.sessions||!DATA.sessions[day]) return new Set();
  const all=[];
  DATA.groups.forEach(g=>{ const sessions=(DATA.sessions[day]&&DATA.sessions[day][g.id])||[]; sessions.forEach((s,i)=>all.push({gid:g.id,idx:i,loc:getSessionLocation(s),s:s.start_min,e:s.start_min+s.duration,sh:!!s.shared})); });
  const keys=new Set();
  for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){
    const a=all[i],b=all[j];
    if((a.sh&&b.sh)||NO_CONFLICT.includes(a.loc)||NO_CONFLICT.includes(b.loc)||a.loc!==b.loc||a.s>=b.e||b.s>=a.e) continue;
    keys.add(`${a.gid}:${a.idx}`); keys.add(`${b.gid}:${b.idx}`);
  }
  return keys;
}

// ================================================================
// SCREEN: title, toolbar, sponsor band, tabs, then the tab
// ================================================================
const TABS = [['planner', 'Weekly Planner'], ['settings', 'Groups & Locations'], ['totals', 'Weekly Totals'], ['rec', 'Recreational']];
function sponsorBandHTML(id){
  if (!sponsorList.length) return '';
  const imgs = sponsorList.map(s => `<img src="${esc(s.image)}" alt="${esc(s.name || 'sponsor')}">`).join('');
  // a repeating marquee track: the full sponsor list several times for seamless looping; speed feels the same for any number
  return `<div class="rp-sponsors" id="${id}" aria-label="Sponsors"><div class="track" style="animation-duration:${Math.max(20, sponsorList.length * 8)}s">${imgs.repeat(6)}</div></div>`;
}
function body(){
  if (S.tab === 'live') return liveHTML();
  const tabs = TABS.concat(S.canAdmin ? [['admin', 'NGL Admin']] : []);
  const name = (CLUB && CLUB.name) || '';
  let content = '';
  if (S.err) content = `<div class="card empty">${esc(S.err)}</div>`;
  else if (S.tab === 'planner') content = plannerHTML();
  else if (S.tab === 'settings') content = settingsHTML();
  else if (S.tab === 'totals') content = `<div id="totalsContent">${weeklyTotalsHTML()}</div>`;
  else if (S.tab === 'rec') content = `<div id="recView">${renderRec()}</div>`;
  else if (S.tab === 'admin') content = adminHTML();
  const wk = w => `<button class="${currentWeek === w ? 'on' : ''}" data-act="rp-week" data-w="${w}" aria-pressed="${currentWeek === w}"><span class="rp-wkpre">Rotation </span>Week ${w}</button>`;
  return head('NGL Rotation Planner', `${name ? `<b>${esc(name)}</b> · ` : ''}Build your weekly session schedule once, then display it live on any screen in your gym. The planner automatically detects the current time and day — as the session progresses, the display moves in real time so coaches and gymnasts always know exactly where they should be.`)
    + sponsorBandHTML('sponsorBand')
    + `<div class="rp-bar">
        <button class="btn rp-golive" data-act="rp-golive">${svg('play')} Go Live</button>
        <button class="btn ghost" data-act="rp-save">${svg('save')}<span> Save</span></button>
        <span class="rp-status" id="rpSaveStatus" role="status">${esc(S.status)}</span>
        <div class="rp-week" role="group" aria-label="Rotation week">${wk('A')}${wk('B')}</div>
        <span class="rp-links"><a class="btn sm ghost" href="${NGL_ROTA_URL}guide/" target="_blank" rel="noopener">Instructions</a>
          <button class="btn sm ghost" data-act="rp-move">Bring data across</button>
          <button class="btn sm ghost" data-act="rp-profile">Profile</button></span>
      </div>`
    + `<div class="sub" role="tablist">${tabs.map(([k, l]) => `<a href="${BASE}${SLUG[k] ? '/' + SLUG[k] : ''}" data-act="rp-tab" data-tab="${k}" class="${S.tab === k ? 'on' : ''}" ${S.tab === k ? 'aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</div>`
    + content
    + `<button class="rp-fbbtn" data-act="rp-feedback">${svg('idea')} Got an idea?</button>`;
}

// ---------- Weekly Planner ----------
function plannerHTML(){
  return `<div class="rp-tw">${weekTableHTML()}</div>${mobDayHTML()}`;
}
function weekTableHTML(){
  const conf = {}; DAYS.forEach(d => conf[d] = getConflicts(d));
  const th = DAYS.map(d => {
    // count total sessions for this day across all groups
    const dayTotal = Object.values(DATA.sessions[d] || {}).reduce((t, arr) => t + (arr || []).length, 0);
    return `<th class="day-col">${d.slice(0,3)}${dayTotal > 0 ? ` <span class="rp-count">${dayTotal}</span>` : ''}</th>`;
  }).join('');
  return `<table class="week-table" id="weekTable"><thead><tr><th class="group-col">Group</th>${th}</tr></thead><tbody>${sectionHTML('squad', 'Squads', conf)}${sectionHTML('recreational', 'Recreational', conf)}</tbody></table>`;
}
function sectionHTML(section, label, conf){
  const groups = DATA.groups.filter(g => g.section === section);
  let h = `<tr class="section-header"><td colspan="8">${label}${section === 'recreational' ? ` — ${weekName(currentWeek)}` : ''}</td></tr>`;
  groups.forEach(group => {
    const gid = esc(group.id);
    h += `<tr><td class="group-cell" data-rp-dbl="${gid}" title="Double-click to edit" tabindex="0"><span class="gc-colour" style="background:${esc(group.colour)}"></span>${esc(group.name)}</td>`;
    DAYS.forEach(day => {
      const active = (group.days || DAYS).includes(day);
      if (!active) { h += '<td class="inactive-day"></td>'; return; }
      const sessions = (DATA.sessions[day] && DATA.sessions[day][group.id]) || [];
      let chips = sessions.map((s, idx) => {
        const loc = getLocByName(getSessionLocation(s)), bg = loc ? loc.colour : '#888';
        return `<div class="session-chip${conf[day].has(`${group.id}:${idx}`) ? ' conflict' : ''}" data-act="rp-sess" data-day="${day}" data-g="${gid}" data-i="${idx}" role="button" tabindex="0" style="background:${esc(bg)};${isLight(bg) ? 'color:#2b2b2b' : ''}">
          <span class="chip-time">${fmtTime(s.start_min)}</span><span class="chip-loc">${esc(getSessionLocation(s))}${s.title ? ' · ' + esc(s.title) : ''}</span><span class="chip-dur">${s.duration}m</span>${s.locationB ? `<span class="chip-wk">W${currentWeek}</span>` : ''}<span class="chip-del" data-act="rp-qdel" data-day="${day}" data-g="${gid}" data-i="${idx}" role="button" aria-label="Delete this session">✕</span></div>`;
      }).join('');
      chips += `<button class="add-btn" data-act="rp-sess" data-day="${day}" data-g="${gid}">+ Add session</button>`;
      // copy from another day button — only show if this group has no sessions today but has some on another day
      if (sessions.length === 0) {
        const daysWithSessions = DAYS.filter(od => od !== day && (DATA.sessions[od] && DATA.sessions[od][group.id] || []).length > 0);
        if (daysWithSessions.length > 0) chips += `<button class="add-btn" data-act="rp-copyday" data-from="${daysWithSessions[0]}" data-day="${day}" data-g="${gid}">↓ Copy from ${daysWithSessions[0].slice(0,3)}</button>`;
      }
      // clear day + copy block buttons — only show if sessions exist
      if (sessions.length > 0) {
        chips += `<button class="add-btn blk" data-act="rp-cblock" data-day="${day}" data-g="${gid}">Copy block to time</button>`;
        chips += `<button class="add-btn clr" data-act="rp-clear" data-day="${day}" data-g="${gid}">✕ Clear day</button>`;
      }
      h += `<td class="day-cell"><div class="session-chips">${chips}</div></td>`;
    });
    h += '</tr>';
  });
  h += `<tr class="add-row"><td colspan="8"><button class="add-group" data-act="rp-group" data-section="${section}">+ Add ${label === 'Squads' ? 'Squad' : label} group</button></td></tr>`;
  return h;
}
// ---------- phones: one day at a time ----------
function mobDayHTML(){
  const day = DAYS[mobDayIdx], isToday = day === getTodayName(), nowMin = nowMinutes();
  const wk = w => `<button class="${currentWeek === w ? 'on' : ''}" data-act="rp-mobwk" data-w="${w}" aria-pressed="${currentWeek === w}" aria-label="${weekName(w)}">${w}</button>`;
  let list = '', hasAny = false;
  ['squad','recreational'].forEach(section => {
    const groups = DATA.groups.filter(g => g.section === section && (g.days || DAYS).includes(day));
    if (!groups.length) return;
    list += `<div class="mob-section-label">${section === 'squad' ? 'Squads' : 'Recreational'}</div>`;
    groups.forEach(group => {
      const sessions = (DATA.sessions[day] && DATA.sessions[day][group.id]) || [];
      let rows = '';
      if (sessions.length) {
        rows = '<div class="mob-sessions">' + sessions.map(s => {
          const loc = (currentWeek === 'B' && s.locationB) ? s.locationB : s.location, locData = getLocByName(loc), bg = locData ? locData.colour : '#888';
          const isCurrent = isToday && nowMin >= s.start_min && nowMin < s.start_min + s.duration, isPast = isToday && nowMin >= s.start_min + s.duration;
          return `<div class="mob-session${isCurrent ? ' current' : ''}" style="background:${isCurrent ? bg + '22' : 'transparent'};opacity:${isPast ? '0.45' : '1'}">
            <span class="mob-session-dot" style="background:${esc(bg)}"></span><span class="mob-session-loc">${esc(loc)}${s.title ? ' · ' + esc(s.title) : ''}</span>
            <span class="mob-session-time">${fmtTime(s.start_min)}</span><span class="mob-session-dur">${s.duration}m</span>${isCurrent ? '<span class="mob-now">NOW</span>' : ''}</div>`;
        }).join('') + '</div>';
        hasAny = true;
      }
      list += `<div class="mob-group-card"><div class="mob-group-hdr"><span class="mob-group-colour" style="background:${esc(group.colour || '#888')}"></span><span class="mob-group-name">${esc(group.name)}</span><span class="mob-group-n">${sessions.length} session${sessions.length !== 1 ? 's' : ''}</span></div>${rows}</div>`;
    });
  });
  if (!hasAny && DATA.groups.length) list = `<div class="mob-empty">No sessions scheduled for ${day}</div>`;
  else if (!DATA.groups.length) list = '<div class="mob-empty">No groups set up yet.<br>Go to Groups &amp; Locations to get started.</div>';
  return `<div class="rp-mob" id="mobileDayView"><div class="rp-mob-nav"><button data-act="rp-mobday" data-by="-1" aria-label="Previous day">&#8592;</button>
      <div class="rp-mob-day" id="mobDayName">${day}<span id="mobWeekLabel">${weekName(currentWeek)}</span></div>
      <div class="rp-mob-wk">${wk('A')}${wk('B')}</div><button data-act="rp-mobday" data-by="1" aria-label="Next day">&#8594;</button></div>
    <div class="rp-mob-live"><a href="${NGL_ROTA_URL}live/?c=${encodeURIComponent(currentClubId || '')}" id="mobLiveLink" target="_blank" rel="noopener">View Live Rotation &#8594;</a></div>
    <div class="rp-mob-groups" id="mobGroups">${list}</div></div>`;
}

// ---------- Session dialog ----------
function locOptionsHTML(sel){
  // grouped by category, alphabetically within each
  const grouped = {};
  DATA.locations.forEach(l => { const cat = l.category || 'Other'; (grouped[cat] = grouped[cat] || []).push(l); });
  Object.values(grouped).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
  const orderedCats = [...CAT_ORDER.filter(c => grouped[c]), ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c))];
  return orderedCats.map(cat => `<optgroup label="${esc(cat)}">${grouped[cat].map(l => `<option value="${esc(l.name)}"${l.name === sel ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</optgroup>`).join('');
}
const timeOptions = sel => { let o = ''; for (let t = 6 * 60; t <= 22 * 60; t += 5) o += `<option value="${t}"${t === sel ? ' selected' : ''}>${fmtTime(t)}</option>`; return o; };
function openSessionModal(day, groupId, sessionIdx){
  if(recGuard(groupId)) return;
  editingSession = {day, groupId, sessionIdx};
  const group = getGroupById(groupId), isNew = sessionIdx === null;
  const s = isNew ? null : DATA.sessions[day][groupId][sessionIdx];
  const existing = (DATA.sessions[day] && DATA.sessions[day][groupId]) || [];
  const start = s ? s.start_min : existing.length ? existing[existing.length-1].start_min + existing[existing.length-1].duration : 16*60;
  const dur = s ? s.duration : 30;
  const activeDays = group.days || DAYS;
  const dayChecks = DAYS.map(d => { const dis = d === day || !activeDays.includes(d); return `<label class="day-check-lbl" style="opacity:${dis ? '0.4' : '1'}"><input type="checkbox" value="${d}"${dis ? ' disabled' : ''} aria-label="${d}">${d[0]}</label>`; }).join('');
  modal(`<div class="rp-dlg" id="sessionModal"><h2 id="smTitle">${isNew ? 'Add' : 'Edit'} Session — ${esc(group.name)} (${day})</h2>
    <label class="field"><span>Rotation Week A Location</span><select id="sm_loc">${DATA.locations.length ? locOptionsHTML(s ? s.location : '') : '<option value="TBC">TBC</option>'}</select></label>
    <label class="field"><span>Rotation Week B Location <small>(optional — leave blank if same every week)</small></span><select id="sm_locB"><option value="">— Same as Rotation Week A —</option>${locOptionsHTML(s && s.locationB || '')}</select></label>
    <div class="rp-row2"><label class="field"><span>Start time</span><select id="sm_start">${timeOptions(start)}</select></label>
      <label class="field"><span>Duration (mins)</span><input type="number" id="sm_dur" value="${dur}" min="5" max="240" step="5"></label></div>
    <div class="dur-chips">${[15,30,45,60,90,120].map(v => `<button type="button" class="dur-chip${v === dur ? ' active' : ''}" data-act="rp-dur" data-v="${v}">${v}</button>`).join('')}</div>
    <label class="field"><span>Activity (optional)</span><input type="text" id="sm_title" placeholder="e.g. Strength &amp; Conditioning" value="${esc(s ? s.title || '' : '')}"></label>
    ${isNew ? '' : `<div class="field"><label class="day-check-lbl"><input type="checkbox" id="sm_autoadjust" checked> Auto-adjust later sessions in this block</label>
      <p class="rp-note">If you change this session's time or duration, all later sessions for this group on this day will shift by the same amount.</p></div>`}
    <div class="field"><span>Also add to days</span><div class="day-checks" id="sm_days">${dayChecks}</div></div>
    <p class="err" id="sm_err" role="alert"></p>
    <div class="btn-row">${isNew ? '' : '<button class="btn ghost rp-danger" id="sm_del" data-act="rp-sess-del">Delete</button><span class="grow"></span>'}<button class="btn ghost" data-close>Cancel</button><button class="btn" data-act="rp-sess-save">Save</button></div></div>`);
}
function setDur(v){ const i = document.getElementById('sm_dur'); if (i) i.value = v; document.querySelectorAll('#sessionModal .dur-chip').forEach(c => c.classList.toggle('active', parseInt(c.textContent) === v)); }
function saveSession(){
  const {day, groupId, sessionIdx} = editingSession;
  const location = document.getElementById('sm_loc').value;
  const locationB = document.getElementById('sm_locB').value || null;
  const start_min = parseInt(document.getElementById('sm_start').value);
  const duration = parseInt(document.getElementById('sm_dur').value) || 30;
  const title = document.getElementById('sm_title').value.trim();
  if(!location){ dlgErr('sm_err', 'Please select a location.'); return; }
  if(!DATA.sessions) DATA.sessions = {};
  if(!DATA.sessions[day]) DATA.sessions[day] = {};
  if(!DATA.sessions[day][groupId]) DATA.sessions[day][groupId] = [];
  const session = {location, start_min, duration, title};
  if(locationB) session.locationB = locationB;
  let cascadeCount = 0;
  if(sessionIdx === null){
    DATA.sessions[day][groupId].push(session);
  } else {
    // detect change in timing to cascade to later sessions
    const original = DATA.sessions[day][groupId][sessionIdx];
    const delta = (start_min + duration) - (original.start_min + original.duration);
    const autoAdjust = document.getElementById('sm_autoadjust').checked;
    if(autoAdjust && delta !== 0){
      const sortedList = DATA.sessions[day][groupId].slice().sort((a, b) => a.start_min - b.start_min);
      const editedPos = sortedList.findIndex(x => x === original);
      sortedList.forEach((x, i) => { if(i > editedPos){ x.start_min += delta; cascadeCount++; } });
    }
    DATA.sessions[day][groupId][sessionIdx] = session;
  }
  DATA.sessions[day][groupId].sort((a, b) => a.start_min - b.start_min);
  // repeat days
  const repeatDays = [...document.querySelectorAll('#sm_days input:checked')].map(cb => cb.value);
  repeatDays.forEach(rd => { if(!DATA.sessions[rd]) DATA.sessions[rd] = {}; if(!DATA.sessions[rd][groupId]) DATA.sessions[rd][groupId] = []; DATA.sessions[rd][groupId].push({...session}); DATA.sessions[rd][groupId].sort((a, b) => a.start_min - b.start_min); });
  closeDlg('sessionModal'); draw(); scheduleAutoSave();
  let msg = 'Session saved';
  if(repeatDays.length) msg += ` + ${repeatDays.length} day(s)`;
  if(cascadeCount > 0) msg += ` · ${cascadeCount} later session(s) shifted`;
  toast(msg);
}
async function deleteSession(){
  const {day, groupId, sessionIdx} = editingSession;
  if(!await ask('Delete this session?', 'Delete')) return;
  DATA.sessions[day][groupId].splice(sessionIdx, 1);
  closeDlg('sessionModal'); draw(); scheduleAutoSave();
}

// ---------- Copy block dialog ----------
let copyBlockState = null, copyBlockTimes = [];
function openCopyBlockModal(day, groupId){
  if(recGuard(groupId)) return;
  const sessions = (DATA.sessions[day] && DATA.sessions[day][groupId]) || [];
  if(!sessions.length){ toast('No sessions to copy'); return; }
  const group = getGroupById(groupId);
  copyBlockState = {day, groupId, sessions: sessions.map(s => ({...s}))};
  copyBlockTimes = [];
  // default: suggest right after the block ends
  const lastEnd = Math.max(...sessions.map(s => s.start_min + s.duration));
  modal(`<div class="rp-dlg" id="copyBlockModal"><h2 id="cbTitle">Copy Rotation Block — ${esc(group.name)} (${day})</h2>
    <p class="rp-note">Duplicate this group's full rotation block to one or more new start times, keeping the same gaps between sessions.</p>
    <div class="field"><span>Add a start time</span><div class="rp-inline"><select id="cb_start" aria-label="Start time to add">${timeOptions(lastEnd)}</select><button class="btn ghost" data-act="rp-cb-add">+ Add</button></div></div>
    <div class="field"><span>Times to copy to</span><div id="cb_times_list" style="min-height:30px"></div></div>
    <div id="cb_preview" class="rp-preview"></div>
    <p class="err" id="cb_err" role="alert"></p>
    <div class="btn-row"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-act="rp-cb-do">Copy Block</button></div></div>`);
  renderCopyBlockTimes();
}
function renderCopyBlockTimes(){
  const wrap = document.getElementById('cb_times_list'); if (!wrap) return;
  wrap.innerHTML = copyBlockTimes.length === 0 ? '<span class="rp-note">No times added yet — pick a time above and click + Add</span>'
    : copyBlockTimes.map(t => `<span class="rp-time">${fmtTime(t)} <button data-act="rp-cb-rm" data-t="${t}" aria-label="Remove ${fmtTime(t)}">✕</button></span>`).join('');
  const {sessions} = copyBlockState;
  const originalStart = Math.min(...sessions.map(s => s.start_min));
  const sorted = sessions.slice().sort((a, b) => a.start_min - b.start_min);
  document.getElementById('cb_preview').innerHTML = copyBlockTimes.map(newStart => {
    const offset = newStart - originalStart;
    return `<div style="margin-bottom:4px">${sorted.map(s => `${fmtTime(s.start_min + offset)} ${esc(s.location)}`).join(' → ')}</div>`;
  }).join('');
}
function doCopyBlock(){
  if(copyBlockTimes.length === 0){ dlgErr('cb_err', 'Please add at least one time to copy to.'); return; }
  const {day, groupId, sessions} = copyBlockState;
  const originalStart = Math.min(...sessions.map(s => s.start_min));
  if(!DATA.sessions[day]) DATA.sessions[day] = {};
  if(!DATA.sessions[day][groupId]) DATA.sessions[day][groupId] = [];
  copyBlockTimes.forEach(newStart => {
    const offset = newStart - originalStart;
    DATA.sessions[day][groupId].push(...sessions.map(s => ({...s, start_min: s.start_min + offset})));
  });
  DATA.sessions[day][groupId].sort((a, b) => a.start_min - b.start_min);
  closeDlg('copyBlockModal'); draw(); scheduleAutoSave();
  toast(`Block copied to ${copyBlockTimes.length} time(s)`);
}
async function clearGroupDay(day, groupId){
  if(recGuard(groupId)) return;
  const count = (DATA.sessions[day] && DATA.sessions[day][groupId] || []).length;
  if(!await ask(`Clear all ${count} session(s) for this group on ${day}?`, 'Clear')) return;
  if(DATA.sessions[day]) DATA.sessions[day][groupId] = [];
  draw(); scheduleAutoSave();
  toast('Sessions cleared');
}
async function copyGroupDay(groupId, fromDay, toDay){
  if(recGuard(groupId)) return;
  const src = (DATA.sessions[fromDay] && DATA.sessions[fromDay][groupId]) || [];
  if(!src.length){ toast('No sessions to copy'); return; }
  if(!await ask(`Copy ${src.length} session(s) from ${fromDay} to ${toDay}?`, 'Copy')) return;
  if(!DATA.sessions[toDay]) DATA.sessions[toDay] = {};
  DATA.sessions[toDay][groupId] = src.map(s => ({...s}));
  draw(); scheduleAutoSave();
  toast(`Copied from ${fromDay} to ${toDay}`);
}
async function quickDel(day, groupId, idx){
  if(recGuard(groupId)) return;
  if(!await ask('Delete this session?', 'Delete')) return;
  DATA.sessions[day][groupId].splice(idx, 1);
  draw(); scheduleAutoSave();
}

// ---------- Group and location dialogs ----------
const swatchesHTML = (k, current) => SWATCH_COLOURS.map(c => `<button type="button" class="colour-swatch${c === current ? ' active' : ''}" style="background:${c}" data-act="rp-swatch" data-k="${k}" data-c="${c}" aria-label="Colour ${c}" aria-pressed="${c === current}"></button>`).join('');
function isPreGroup(g){ return g && (g.preschool === true || (g.preschool !== false && /pre[\s-]?school|tots|toddler/i.test(g.name || ''))); }
function openGroupModal(id = null, defaultSection = 'squad'){
  if(recGuard(id)) return;
  editingGroup = id;
  const g = id ? getGroupById(id) : null;
  selectedGroupColour = g ? g.colour : SWATCH_COLOURS[0];
  const ad = g ? (g.days || DAYS) : DAYS, sec = g ? g.section : defaultSection;
  modal(`<div class="rp-dlg" id="groupModal"><h2 id="gmTitle">${g ? 'Edit Group' : 'Add Group'}</h2>
    <label class="field"><span>Group name</span><input type="text" id="gm_name" placeholder="e.g. WAG Pearl 1" value="${esc(g ? g.name : '')}"></label>
    <label class="field"><span>Section</span><select id="gm_section"><option value="squad"${sec === 'squad' ? ' selected' : ''}>Squad</option><option value="recreational"${sec === 'recreational' ? ' selected' : ''}>Recreational</option></select></label>
    <div class="field"><label class="day-check-lbl" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="gm_pre"${g && isPreGroup(g) ? ' checked' : ''}>Pre-School class (show this week’s Pre-School theme and skills on the live screen)</label></div>
    <div class="field"><span>Colour</span><div class="colour-swatches" id="gm_swatches">${swatchesHTML('g', selectedGroupColour)}</div></div>
    <div class="field"><span>Active days</span><div class="day-checks" id="gm_days">${DAYS.map(d => `<label class="day-check-lbl"><input type="checkbox" value="${d}"${ad.includes(d) ? ' checked' : ''}>${d.slice(0,3)}</label>`).join('')}</div></div>
    <p class="err" id="gm_err" role="alert"></p>
    <div class="btn-row">${g ? '<button class="btn ghost rp-danger" id="gm_del" data-act="rp-group-del">Delete</button><span class="grow"></span>' : ''}<button class="btn ghost" data-close>Cancel</button><button class="btn" data-act="rp-group-save">Save</button></div></div>`);
  setTimeout(() => { const n = document.getElementById('gm_name'); if (n) n.focus(); }, 100);
}
function saveGroup(){
  const name = document.getElementById('gm_name').value.trim();
  if(!name){ dlgErr('gm_err', 'Please enter a group name.'); return; }
  const section = document.getElementById('gm_section').value;
  const days = [...document.querySelectorAll('#gm_days input:checked')].map(c => c.value);
  const pre = document.getElementById('gm_pre').checked;
  if(editingGroup){ const g = getGroupById(editingGroup); g.name = name; g.section = section; g.colour = selectedGroupColour; g.days = days; g.preschool = pre; }
  else{ DATA.groups.push({id:genId(), name, section, colour:selectedGroupColour, days, preschool:pre}); }
  closeDlg('groupModal'); draw(); scheduleAutoSave();
}
async function deleteGroup(){
  if(!await ask('Delete this group and all its sessions?', 'Delete')) return;
  DAYS.forEach(d => { if(DATA.sessions[d]) delete DATA.sessions[d][editingGroup]; });
  DATA.groups = DATA.groups.filter(g => g.id !== editingGroup);
  closeDlg('groupModal'); draw(); scheduleAutoSave();
}
function openLocationModal(id = null){
  editingLocation = id;
  const l = id ? DATA.locations.find(x => x.id === id) : null;
  selectedLocColour = l ? l.colour : LOC_COLOURS['Floor'];
  const cat = l ? l.category : 'Floor';
  modal(`<div class="rp-dlg" id="locationModal"><h2 id="lmTitle">${l ? 'Edit Location' : 'Add Location'}</h2>
    <label class="field"><span>Location name</span><input type="text" id="lm_name" placeholder="e.g. BARS PITSIDE" value="${esc(l ? l.name : '')}"></label>
    <label class="field"><span>Category</span><select id="lm_cat">${CAT_ORDER.map(c => `<option${c === cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <div class="field"><span>Colour</span><div class="colour-swatches" id="lm_swatches">${swatchesHTML('l', selectedLocColour)}</div></div>
    <p class="err" id="lm_err" role="alert"></p>
    <div class="btn-row">${l ? '<button class="btn ghost rp-danger" id="lm_del" data-act="rp-loc-del">Delete</button><span class="grow"></span>' : ''}<button class="btn ghost" data-close>Cancel</button><button class="btn" data-act="rp-loc-save">Save</button></div></div>`);
  document.getElementById('lm_cat').addEventListener('change', e => { selectedLocColour = LOC_COLOURS[e.target.value] || '#888'; document.getElementById('lm_swatches').innerHTML = swatchesHTML('l', selectedLocColour); });
  setTimeout(() => { const n = document.getElementById('lm_name'); if (n) n.focus(); }, 100);
}
function saveLocation(){
  const name = document.getElementById('lm_name').value.trim().toUpperCase();
  const category = document.getElementById('lm_cat').value;
  if(!name){ dlgErr('lm_err', 'Please enter a location name.'); return; }
  if(editingLocation){ const l = DATA.locations.find(x => x.id === editingLocation); l.name = name; l.category = category; l.colour = selectedLocColour; }
  else{ DATA.locations.push({id:genId(), name, category, colour:selectedLocColour}); }
  closeDlg('locationModal'); draw(); scheduleAutoSave();
}
async function deleteLocation(){
  if(!await ask('Delete this location?', 'Delete')) return;
  DATA.locations = DATA.locations.filter(l => l.id !== editingLocation);
  closeDlg('locationModal'); draw(); scheduleAutoSave();
}

// ---------- Groups & Locations ----------
function settingsHTML(){
  const gl = DATA.groups.length ? DATA.groups.map(g => `<div class="s-item"><span class="s-colour" style="background:${esc(g.colour)}"></span><span class="s-name">${esc(g.name)}</span><span class="s-sub">${esc(g.section)} · ${(g.days || DAYS).length === 7 ? 'All days' : (g.days || DAYS).map(d => d.slice(0,3)).join(', ')}</span><button class="s-edit" data-act="rp-group" data-g="${esc(g.id)}" aria-label="Edit ${esc(g.name)}">${svg('edit')}</button></div>`).join('')
    : '<p class="s-empty">No groups yet.</p>';
  const grouped = {};
  DATA.locations.forEach(l => { (grouped[l.category] = grouped[l.category] || []).push(l); });
  const ll = DATA.locations.length ? Object.entries(grouped).map(([cat, locs]) => `<div class="cat-label">${esc(cat)}</div>` + locs.map(l => `<div class="s-item"><span class="s-colour" style="background:${esc(l.colour)}"></span><span class="s-name">${esc(l.name)}</span><button class="s-edit" data-act="rp-loc" data-l="${esc(l.id)}" aria-label="Edit ${esc(l.name)}">${svg('edit')}</button></div>`).join('')).join('')
    : '<p class="s-empty">No locations yet.</p>';
  return `<div class="rp-settings" id="settingsView">
    <div class="card rp-panel"><div class="rp-panel-hdr"><h2>Groups</h2><button class="btn sm" data-act="rp-group">+ Add</button></div><div class="rp-panel-body"><div id="groupsList" class="s-list">${gl}</div></div></div>
    <div class="card rp-panel"><div class="rp-panel-hdr"><h2>Locations</h2><button class="btn sm ghost" data-act="rp-loc">+ Add</button></div><div class="rp-panel-body"><div id="locationsList" class="s-list">${ll}</div></div></div></div>`;
}

// ---------- Weekly Totals ----------
function weeklyTotalsHTML(){
  const squadGroups = DATA.groups.filter(g => g.section === 'squad');
  if(!squadGroups.length) return '<p style="color:var(--muted);font-style:italic">No squad groups set up yet.</p>';
  const usedCats = new Set();
  DATA.locations.forEach(l => { if(l.category) usedCats.add(l.category); });
  const categories = [...CAT_ORDER.filter(c => usedCats.has(c)), ...[...usedCats].filter(c => !CAT_ORDER.includes(c))];
  const catColours = LOC_COLOURS;
  function calcTotals(week){
    const prev = currentWeek; currentWeek = week;
    const totals = {};
    squadGroups.forEach(g => {
      totals[g.id] = {};
      categories.forEach(cat => { totals[g.id][cat] = 0; });
      DAYS.forEach(day => {
        (DATA.sessions[day] && DATA.sessions[day][g.id] || []).forEach(s => {
          const loc = getLocByName(getSessionLocation(s)), cat = loc ? loc.category : null;
          if(cat && Object.prototype.hasOwnProperty.call(totals[g.id], cat)) totals[g.id][cat] += s.duration;
        });
      });
    });
    currentWeek = prev; return totals;
  }
  // SVG donut chart for a single group
  function donutChart(group, tots){
    const total = Object.values(tots).reduce((a, b) => a + b, 0);
    if(!total) return `<svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="30" fill="none" stroke="#eee" stroke-width="12"/><text x="40" y="45" text-anchor="middle" font-size="9" fill="#767676">No data</text></svg>`;
    const r = 28, cx = 40, cy = 40, circ = 2 * Math.PI * r;
    let offset = 0, segments = '';
    categories.forEach(cat => {
      const mins = tots[cat] || 0; if(!mins) return;
      const pct = mins / total, dash = pct * circ, gap = circ - dash, col = catColours[cat] || '#888';
      segments += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="12" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${(-offset * circ).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(cat)}: ${mins}m</title></circle>`;
      offset += pct;
    });
    return `<svg viewBox="0 0 80 80" width="80" height="80" role="img" aria-label="${(total / 60).toFixed(1)} hours a week">${segments}<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#28225c">${(total / 60).toFixed(1)}h</text><text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="#5f5b80">total</text></svg>`;
  }
  const legend = () => `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px">${categories.map(c => `<span style="display:inline-flex;align-items:center;gap:5px;font-size:13px;color:#555"><span style="width:12px;height:12px;border-radius:2px;background:${catColours[c] || '#888'};flex-shrink:0;display:inline-block"></span>${esc(c)}</span>`).join('')}</div>`;
  function buildView(totals, label){
    let sorted = [...squadGroups];
    if(totalsSortCol === 'total') sorted.sort((a, b) => { const ta = Object.values(totals[a.id]).reduce((x, y) => x + y, 0), tb = Object.values(totals[b.id]).reduce((x, y) => x + y, 0); return totalsSortDir === 'desc' ? tb - ta : ta - tb; });
    else if(totalsSortCol) sorted.sort((a, b) => { const ta = totals[a.id][totalsSortCol] || 0, tb = totals[b.id][totalsSortCol] || 0; return totalsSortDir === 'desc' ? tb - ta : ta - tb; });
    const arrow = totalsSortDir === 'desc' ? ' ▼' : ' ▲';
    const sortChips = `<div class="rp-sortchips"><span style="font-size:13px;color:var(--muted);font-weight:600">Sort by:</span>
      <button class="totals-week-btn${!totalsSortCol ? ' active' : ''}" data-act="rp-sort" data-col="">Default</button>
      <button class="totals-week-btn${totalsSortCol === 'total' ? ' active' : ''}" data-act="rp-sort" data-col="total">Total${totalsSortCol === 'total' ? arrow : ''}</button>
      ${categories.map(c => `<button class="totals-week-btn${totalsSortCol === c ? ' active' : ''}" data-act="rp-sort" data-col="${esc(c)}">${esc(c)}${totalsSortCol === c ? arrow : ''}</button>`).join('')}</div>`;
    const cards = sorted.map(g => {
      const tots = totals[g.id], total = Object.values(tots).reduce((a, b) => a + b, 0);
      const catRows = categories.filter(c => tots[c] > 0).sort((a, b) => tots[b] - tots[a]).map(c => {
        const pct = Math.round((tots[c] / total) * 100);
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span style="width:10px;height:10px;border-radius:2px;background:${catColours[c] || '#888'};flex-shrink:0"></span>
          <span style="flex:1;font-size:13px;color:#555">${esc(c)}</span>
          <span style="font-size:13px;font-weight:700;color:var(--navy);min-width:30px;text-align:right">${tots[c]}m</span>
          <div style="width:60px;height:6px;background:#eee;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${catColours[c] || '#888'};border-radius:3px"></div></div>
          <span style="font-size:12px;color:var(--muted);min-width:28px">${pct}%</span></div>`;
      }).join('');
      return `<div class="rp-tcard" data-group="${esc(g.id)}"><div style="flex-shrink:0">${donutChart(g, tots)}<div style="text-align:center;font-size:12px;color:var(--muted);margin-top:4px">${(total / 60).toFixed(1)}h / week</div></div>
        <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="width:12px;height:12px;border-radius:50%;background:${esc(g.colour || '#888')};flex-shrink:0;display:inline-block"></span><span style="font-weight:700;color:var(--navy);font-size:15px">${esc(g.name)}</span></div>
        ${catRows || '<span style="font-size:13px;color:var(--muted)">No sessions this week</span>'}</div></div>`;
    }).join('');
    return `<h2>${esc(label)} — Apparatus Time</h2><p class="lead" style="font-size:14px;margin-bottom:16px">Minutes per squad group per apparatus category across the full week.</p>${legend()}${sortChips}<div class="rp-tcards">${cards}</div>`;
  }
  const hasWeekB = DATA.groups.some(g => DAYS.some(day => (DATA.sessions[day] && DATA.sessions[day][g.id] || []).some(s => s.locationB)));
  let html = '<div class="totals-wrap">';
  if(hasWeekB){
    html += `<div class="totals-week-toggle"><button class="totals-week-btn active" id="totals_weekA" data-act="rp-totwk" data-w="A">Rotation Week A</button><button class="totals-week-btn" id="totals_weekB" data-act="rp-totwk" data-w="B">Rotation Week B</button></div>
      <div id="totals_tableA">${buildView(calcTotals('A'), weekName('A'))}</div><div id="totals_tableB" style="display:none">${buildView(calcTotals('B'), weekName('B'))}</div>`;
  } else html += buildView(calcTotals(currentWeek), 'Weekly');
  return html + '</div>';
}

// ---------- Profile ----------
function openProfileModal(){
  modal(`<div class="rp-dlg" id="profileModal"><h2>Club Profile</h2>
    <p class="rp-note">Update your club details. These are visible to NGL administrators.</p>
    <label class="field"><span>Club name</span><input type="text" id="profile_club" placeholder="Your club name" value="${esc(CLUB.name || '')}"></label>
    <label class="field"><span>Contact name</span><input type="text" id="profile_contact" placeholder="Your name" value="${esc(CLUB.contact || '')}"></label>
    <label class="field"><span>Email address</span><input type="email" id="profile_email" placeholder="Your email" value="${esc(CLUB.email || '')}"></label>
    <p class="err" id="profile_err" role="alert"></p>
    <div class="btn-row"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-act="rp-profile-save">Save</button></div></div>`);
}
async function saveClubProfile(btn){
  const v = id => document.getElementById(id).value.trim();
  const clubName = v('profile_club'), contactName = v('profile_contact'), email = v('profile_email');
  if(!clubName){ dlgErr('profile_err', 'Please enter your club name.'); return; }
  btn.disabled = true;
  try{
    if (LIVE_DB) await api.updateClub({name: clubName, contact: contactName, email});
    CLUB = Object.assign(CLUB || {}, {name: clubName, contact: contactName, email});
    closeDlg('profileModal'); draw(); toast('Profile saved!');
  }catch(e){ btn.disabled = false; dlgErr('profile_err', 'Failed to save profile: ' + e.message); }
}

// ---------- Stream link ----------
async function qrSVG(text, cell = 6){
  await loadScript(QR_JS);
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({cellSize: cell, margin: 2, scalable: true});
}
async function showStreamLink(){
  const url = `${NGL_ROTA_URL}stream/?c=${encodeURIComponent(currentClubId || '')}`;
  const m = modal(`<div class="rp-dlg" id="streamModal" style="text-align:center"><h2>Your Live Streaming Link</h2>
    <p class="rp-note">Share this permanent link with parents, coaches or anyone who wants to follow the session live on their device. The link never changes.</p>
    <div class="rp-link"><span id="streamUrl">${esc(url)}</span><button class="btn sm" id="copyBtn" data-act="rp-copylink">Copy</button></div>
    <div class="rp-qr" id="streamQR"></div>
    <p class="rp-note">Works on any phone or tablet — no login needed</p>
    <div class="btn-row" style="justify-content:center"><button class="btn ghost" data-close>Close</button></div></div>`);
  try { m.querySelector('#streamQR').innerHTML = await qrSVG(url); } catch (e) { console.warn('QR code not made', e); }
}
function copyStreamLink(btn){
  const url = document.getElementById('streamUrl').textContent;
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  }).catch(() => { toast('Link: ' + url); });
}

// ---------- Feedback ----------
function openFeedback(){
  modal(`<div class="rp-dlg" id="feedbackModal"><div id="feedbackForm"><h2>Got an idea?</h2>
    <p class="rp-note">We're always improving the NGL Rotation Planner. Share your thoughts and we'll get back to you!</p>
    <p class="rp-resp">We aim to respond within 24 hours</p>
    <label class="field"><span>Your name (optional)</span><input type="text" id="fb_name" placeholder="Your name (optional)"></label>
    <label class="field"><span>Your idea</span><textarea id="fb_message" rows="5" placeholder="Tell us your idea or suggestion..."></textarea></label>
    <p class="err" id="fb_err" role="alert"></p>
    <div class="btn-row"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-act="rp-fb-send">Send idea →</button></div></div>
    <div id="feedbackSuccess" class="rp-ok" hidden><b>Thanks for your idea!</b><p class="rp-note">We'll review it and get back to you within 24 hours.</p>
      <div class="btn-row" style="justify-content:center"><button class="btn ghost" data-close>Close</button></div></div></div>`);
  setTimeout(() => { const t = document.getElementById('fb_message'); if (t) t.focus(); }, 100);
}
async function sendFeedback(btn){
  const message = document.getElementById('fb_message').value.trim();
  const name = document.getElementById('fb_name').value.trim();
  if(!message){ dlgErr('fb_err', 'Please enter your idea or suggestion.'); return; }
  const entry = {message, name: name || CLUB.contact || 'Anonymous', clubName: CLUB.name || 'Unknown club', email: CLUB.email || '', uid: currentClubId, submittedAt: new Date().toISOString(), status: 'new'};
  btn.disabled = true;
  try{
    if (LIVE_DB) { const {fs, D} = await fb(); await fs.addDoc(fs.collection(D, 'rotaFeedback'), entry); }
    else (S.demoFeedback = S.demoFeedback || demoFeedbackList()).unshift({id: genId(), ...entry});
    document.getElementById('feedbackForm').hidden = true;
    document.getElementById('feedbackSuccess').hidden = false;
  }catch(e){ console.error(e); btn.disabled = false; dlgErr('fb_err', 'Failed to send — please try again.'); }
}

// ================================================================
// SPONSOR BAND (NGL-controlled, global): rotaSponsors
// ================================================================
async function loadSponsors(){
  if (!LIVE_DB) return sponsorList;
  try{
    const {fs, D} = await fb(), snap = await fs.getDocs(fs.collection(D, 'rotaSponsors'));
    sponsorList = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(s => s && s.image);
  }catch(e){ console.warn('Sponsors not loaded', e); sponsorList = []; }
  ['sponsorBand', 'sponsorBandLive'].forEach(id => { const el = document.getElementById(id); if (el) el.outerHTML = sponsorBandHTML(id); });
  if (sponsorList.length && document.getElementById('rpRoot')) {
    if (S.tab === 'live') { const h = document.querySelector('#liveView .live-hdr'); if (h && !document.getElementById('sponsorBandLive')) { h.insertAdjacentHTML('beforebegin', sponsorBandHTML('sponsorBandLive')); renderTimeline(getTodayName()); } }
    else if (!document.getElementById('sponsorBand')) updateSponsorBands();
  }
  return sponsorList;
}

// ================================================================
// NGL ADMIN (in the tool, for the NGL team with Rotation Planner access): sponsors, ideas, club emails.
// The clubs table, Import Data and View are in NGL Admin → Rotation Planner clubs (js/admin/rotation.js).
// ================================================================
function adminHTML(){
  return `<div id="adminContent">
    <div class="card rp-panel" style="margin-bottom:16px"><div class="rp-panel-hdr"><h2>Sponsors (rotates every 10s on all club screens)</h2>
      <label class="btn sm rp-upload">+ Upload Sponsor PNG (recommended ~240×40px)<input type="file" id="sponsorUpload" accept="image/png,image/jpeg" aria-label="Upload sponsor logo"></label></div>
      <div class="rp-panel-body" id="sponsorsListWrap">${sponsorsAdminHTML()}</div></div>
    <div class="card rp-panel" style="margin-bottom:16px"><div class="rp-panel-hdr"><h2>Ideas &amp; Feedback</h2><button class="btn sm ghost" data-act="rp-fb-refresh">↻ Refresh</button></div>
      <div class="rp-panel-body" id="feedbackInbox"><p class="s-empty">Loading...</p></div></div>
    <div class="card rp-panel"><div class="rp-panel-hdr"><h2>All Clubs</h2><span class="btn-row" style="margin:0">
      <button class="btn sm ghost" data-act="rp-emailall" title="Open your email with all club emails in BCC">Email All</button><button class="btn sm ghost" data-act="rp-copyemails" title="Copy all emails to clipboard">Copy Emails</button></span></div>
      <div class="rp-panel-body"><p style="margin:0">Registered clubs, Import Data and View are in <a href="#/admin/rotation">NGL Admin → Rotation Planner clubs</a>.</p></div></div></div>`;
}
function sponsorsAdminHTML(){
  if(!sponsorList.length) return '<p class="s-empty">No sponsors uploaded yet.</p>';
  return `<div class="rp-spons">${sponsorList.map(s => `<div class="rp-spon"><div class="img"><img src="${esc(s.image)}" alt="${esc(s.name || 'sponsor')}"></div><small>${esc(s.name || 'sponsor')}</small>
    <button class="btn sm ghost rp-danger" data-act="rp-spon-del" data-id="${esc(s.id)}">✕ Remove</button></div>`).join('')}</div>`;
}
const refreshSponsorsAdmin = () => { const w = document.getElementById('sponsorsListWrap'); if (w) w.innerHTML = sponsorsAdminHTML(); };
async function loadFeedbackInbox(){
  const wrap = document.getElementById('feedbackInbox'); if(!wrap) return;
  try{
    let items;
    if (!LIVE_DB) items = S.demoFeedback = S.demoFeedback || demoFeedbackList();
    else { const {fs, D} = await fb(), snap = await fs.getDocs(fs.collection(D, 'rotaFeedback')); items = snap.docs.map(d => ({id: d.id, ...d.data()})); }
    items = items.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    if(!items.length){ wrap.innerHTML = '<p class="s-empty">No feedback yet.</p>'; return; }
    wrap.innerHTML = items.map(f => `<div class="rp-fb${f.status === 'new' ? ' new' : ''}"><div class="rp-fb-top">${f.status === 'new' ? '<span class="pill amber">NEW</span>' : ''}
        <strong style="color:var(--navy)">${esc(f.clubName || 'Unknown')}</strong><span style="font-size:13px;color:var(--muted)">${esc(f.name || '')}</span>
        <span class="when">${f.submittedAt ? new Date(f.submittedAt).toLocaleDateString('en-GB', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : ''}</span></div>
      <p>${esc(f.message)}</p>
      <div class="rp-fb-acts">${f.email ? `<a href="mailto:${esc(f.email)}?subject=${encodeURIComponent('Re: Your NGL Rotation Planner idea')}" style="font-size:13px;font-weight:600">↩ Reply to ${esc(f.email)}</a>` : ''}
        ${f.status === 'new' ? `<button class="btn sm ghost" data-act="rp-fb-read" data-id="${esc(f.id)}" style="margin-left:auto">Mark as read</button>` : '<span style="margin-left:auto;font-size:12px;color:var(--muted)">✓ Read</span>'}</div></div>`).join('');
  }catch(e){ wrap.innerHTML = `<p class="err">Failed to load: ${esc(e.message)}</p>`; }
}
async function markFeedbackRead(id){
  try{
    if (LIVE_DB) { const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'rotaFeedback', id), {status: 'read'}); }
    else { const f = (S.demoFeedback || []).find(x => x.id === id); if (f) f.status = 'read'; }
    loadFeedbackInbox();
  }catch(e){ toast('Failed: ' + e.message, false); }
}
async function uploadSponsor(input){
  const file = input.files[0];
  if(!file) return;
  // A Firestore document holds up to 1MB, so the logo (stored as a picture inside it) must be under 700KB
  if(file.size > 700 * 1024){ toast('Please use an image under 700KB.', false); input.value = ''; return; }
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file); });
  input.value = '';
  const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = dataUrl; });
  if(!img){ toast('That doesn’t look like a picture. Please use a PNG or JPG.', false); return; }
  // recommended: max 240x40 logical box, warn if wildly off
  if(img.height > 200 || img.width > 1200){
    if(!await ask(`This image is ${img.width}×${img.height}px. For best results sponsor logos should be small and wide (e.g. ~240×40px). It will be automatically scaled down to fit the band, but very large files may look blurry. Continue anyway?`, 'Continue')) return;
  }
  try{
    const id = genId(), doc = {id, image: dataUrl, name: file.name, w: img.width, h: img.height, addedAt: new Date().toISOString()};
    if (LIVE_DB) { const {fs, D} = await fb(); await fs.setDoc(fs.doc(D, 'rotaSponsors', id), doc); await loadSponsors(); }
    else sponsorList.push(doc);
    toast('Sponsor uploaded!');
    refreshSponsorsAdmin(); updateSponsorBands();
  }catch(err){ toast('Upload failed: ' + err.message, false); }
}
async function deleteSponsor(id){
  if(!await ask('Remove this sponsor?', 'Remove')) return;
  try{
    if (LIVE_DB) { const {fs, D} = await fb(); await fs.deleteDoc(fs.doc(D, 'rotaSponsors', id)); await loadSponsors(); }
    else sponsorList = sponsorList.filter(s => s.id !== id);
    toast('Sponsor removed');
    refreshSponsorsAdmin(); updateSponsorBands();
  }catch(e){ toast('Failed to remove: ' + e.message, false); }
}
function updateSponsorBands(){
  const b = document.getElementById('sponsorBand'), html = sponsorBandHTML('sponsorBand');
  if (b) { if (html) b.outerHTML = html; else b.remove(); }
  else if (html) { const bar = document.querySelector('#rpRoot .rp-bar'); if (bar) bar.insertAdjacentHTML('beforebegin', html); }
}
// collect deduplicated emails from all planner clubs
async function getClubEmails(){
  if (!LIVE_DB) return ['dave@saadi.example', 'office@riverside.example', 'info@northgate.example', 'chris@hillcrest.example'];
  if (!S.adminClubs) {
    const {fs, D} = await fb(), snap = await fs.getDocs(fs.collection(D, 'clubs'));
    S.adminClubs = snap.docs.map(d => d.data()).filter(c => c.source === 'rotations' || c.rotaJson);
  }
  return [...new Set(S.adminClubs.map(c => c.email ? String(c.email).trim().toLowerCase() : null).filter(Boolean))];
}
async function emailAllClubs(){
  let emails; try { emails = await getClubEmails(); } catch (e) { return toast('Couldn’t read the clubs: ' + e.message, false); }
  if(!emails.length){ toast('No club email addresses found.', false); return; }
  const subject = 'NGL Rotation Planner — Update from National Gymnastics League';
  window.location.href = 'mailto:?bcc=' + emails.join(';') + '&subject=' + encodeURIComponent(subject);
  toast(`Opening your email with ${emails.length} clubs in BCC`);
}
async function copyAllEmails(){
  let emails; try { emails = await getClubEmails(); } catch (e) { return toast('Couldn’t read the clubs: ' + e.message, false); }
  if(!emails.length){ toast('No club email addresses found.', false); return; }
  const text = emails.join('; ');
  navigator.clipboard.writeText(text).then(() => toast(`✓ ${emails.length} email address${emails.length !== 1 ? 'es' : ''} copied to clipboard`))
    .catch(() => modal(`<div class="rp-dlg"><h2>Copy these emails</h2><label class="field"><span>Ctrl+A, Ctrl+C</span><textarea rows="5" readonly>${esc(text)}</textarea></label><div class="btn-row"><button class="btn ghost" data-close>Close</button></div></div>`));
}
document.addEventListener('change', e => { if (e.target && e.target.id === 'sponsorUpload' && e.target.closest('#rpRoot')) uploadSponsor(e.target); });

// ================================================================
// LIVE VIEW (the gym screen): #/tools/rotation/screen
// ================================================================
function liveHTML(){
  return `<h1 class="rp-sr">NGL Rotation Planner live screen</h1>
  <div class="rp-live" id="liveView">
    ${sponsorBandHTML('sponsorBandLive')}
    <div class="live-hdr">
      <div class="live-clock" id="liveClockBig">--:--:--</div>
      <div class="live-day" id="liveDayLabel"></div>
      <button class="live-btn live-exit" data-act="rp-exit">${svg('exit')} Exit Live</button>
      <button class="live-btn" data-act="rp-stream" title="Get shareable streaming link">${svg('stream')} Stream</button>
      <button class="live-btn" id="rpFsBtn" data-act="rp-fs" title="Full screen" hidden>${svg('full')} Full screen</button>
      <button class="live-btn bell${bellEnabled ? '' : ' off'}" id="bellBtn" data-act="rp-bell" title="Toggle rotation bell alert" aria-label="${bellEnabled ? 'Bell alerts on' : 'Bell alerts off'}" aria-pressed="${bellEnabled}">${svg(bellEnabled ? 'bell' : 'belloff')}</button>
      <div class="live-qr" id="liveQR"><div class="q" id="liveQRImg" role="img" aria-label="QR code"></div><span>SCAN TO FOLLOW</span></div>
      <div class="live-logo"><img src="img/brand/ngl-logo-full.png" alt="NGL"></div>
    </div>
    <div class="live-body">
      <div class="tl-container" id="tlContainer"></div>
      <div class="live-side" id="liveSide">
        <div class="ls-clock" id="lsClock">
          <div class="ls-time" id="lsTime"><span id="lsHH">--</span><span class="ls-colon" id="lsColon">:</span><span id="lsMM">--</span></div>
          <div class="ls-secs" id="lsSecs">:--</div>
          <div class="ls-date" id="lsDate"></div>
        </div>
        <div class="ls-final" id="lsFinal"><div class="ls-head">Final goes · rotating in 1 minute</div><div class="go-grid" id="lsFinalBody"></div></div>
        <div class="ls-pre" id="lsPre"></div>
        <div class="ls-alert" id="lsAlert" role="alert"><div class="ls-head" id="lsAlertHead">Rotate now</div><div class="go-grid" id="lsAlertBody"></div></div>
      </div>
    </div>
  </div>`;
}
function enterLive(){
  liveMode = true;
  document.body.classList.add('rp-live-on');
  const day = getTodayName();
  const lbl = document.getElementById('liveDayLabel'); if (lbl) lbl.textContent = day + ' — ' + liveWeekName();
  // persistent QR for parents/coaches to scan
  const streamUrl = `${NGL_ROTA_URL}live/?c=${encodeURIComponent(currentClubId || '')}`;
  qrSVG(streamUrl, 3).then(s => { const q = document.getElementById('liveQRImg'); if (q) { q.innerHTML = s; document.getElementById('liveQR').style.display = 'flex'; } }).catch(e => console.warn('QR code not made', e));
  if (DATA.groups.some(isPreGroup) && !window.NGLPS) loadScript(PS_BASE + 'data.js').catch(e => console.warn('Pre-School data not loaded', e));
  renderTimeline(day);
  startLiveClock();
  fsButton();
  // re-render after fullscreen settles — 500ms gives TV displays time to switch resolution
  setTimeout(() => { if (liveMode) renderTimeline(getTodayName()); }, 500);
  setTimeout(() => { if (liveMode) renderTimeline(getTodayName()); }, 1200);
  window.addEventListener('resize', liveResizeHandler);
}
let liveResizeTimer = null;
function liveResizeHandler(){
  if(!liveMode) return;
  clearTimeout(liveResizeTimer);
  liveResizeTimer = setTimeout(() => { renderTimeline(getTodayName()); }, 300);
}
// Leave the live screen (Exit Live, or the club went to another screen)
function stopLive(){
  liveMode = false; clearInterval(liveTimer); liveTimer = null;
  window.removeEventListener('resize', liveResizeHandler);
  hideRotationAlert(); hideFinalGoes();
  document.body.classList.remove('rp-live-on');
  try{ if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); }catch(e){}
}
function exitLive(){ stopLive(); go('planner'); }
// Full screen: asked for on Go Live (a real click). Opened straight from a bookmark on the gym TV, this button asks instead.
function fsButton(){ const b = document.getElementById('rpFsBtn'); if (b) b.hidden = !!document.fullscreenElement || !document.documentElement.requestFullscreen; }
document.addEventListener('fullscreenchange', () => { fsButton(); if (liveMode) setTimeout(() => liveMode && renderTimeline(getTodayName()), 500); });

let lastAlertMin = -999, lastFinalGoes = -999;
function startLiveClock(){
  clearInterval(liveTimer);
  lastAlertMin = -999; lastFinalGoes = -999;
  function tick(){
    if (!document.getElementById('liveView')) { stopLive(); return; }
    const n = new Date();
    const ts = String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');
    document.getElementById('liveClockBig').textContent = ts;
    updateSideClock(n);
    updateNowLine();
    checkFlash();
    checkFinalGoes();
    checkPreschool();
    // re-render timeline every minute to show/hide groups as sessions start and end
    if(n.getSeconds() === 0) renderTimeline(getTodayName());
  }
  tick(); liveTimer = setInterval(tick, 1000);
}
function renderTimeline(day){
  const container = document.getElementById('tlContainer'); if (!container) return;
  sizeLiveSide();
  PX_PER_MIN = calcPxPerMin();
  container.innerHTML = '';
  const {min, max} = getDayBounds(day);
  const lblW = calcLabelWidth(); const width = (max - min) * PX_PER_MIN; const totalW = lblW + width;
  const conflicts = getConflicts(day);
  // only show groups that are currently active or starting within 15 minutes
  const nowMin = nowMinutes();
  const LOOKAHEAD = 15; // minutes before session starts to show the group
  const activeGroups = {squad:[], recreational:[]};
  ['squad','recreational'].forEach(section => {
    activeGroups[section] = DATA.groups.filter(g => {
      if(g.section !== section) return false;
      if(!(g.days || DAYS).includes(day)) return false;
      const sessions = (DATA.sessions[day] && DATA.sessions[day][g.id]) || [];
      if(!sessions.length) return false;
      // show if any session is currently running OR starting within LOOKAHEAD minutes
      return sessions.some(s => {
        const start = s.start_min, end = s.start_min + s.duration;
        return (nowMin >= start && nowMin < end) || (start > nowMin && start <= nowMin + LOOKAHEAD);
      });
    });
  });
  const totalGroups = activeGroups.squad.length + activeGroups.recreational.length;
  // fallback: if nothing active yet, show all groups that train today so screen isn't blank before the day starts
  if(totalGroups === 0){
    ['squad','recreational'].forEach(section => {
      activeGroups[section] = DATA.groups.filter(g => g.section === section && (g.days || DAYS).includes(day) && ((DATA.sessions[day] && DATA.sessions[day][g.id]) || []).length > 0);
    });
  }
  const totalGroups2 = activeGroups.squad.length + activeGroups.recreational.length;
  const sectionCount = (activeGroups.squad.length > 0 ? 1 : 0) + (activeGroups.recreational.length > 0 ? 1 : 0);
  // available height = screen height minus live header, sponsor band, ruler
  const hdr = document.querySelector('#liveView .live-hdr');
  const liveHdrH = hdr ? hdr.getBoundingClientRect().height : 80;
  const sb = document.getElementById('sponsorBandLive'); const sponsorH = sb ? sb.getBoundingClientRect().height : 0;
  const rulerH = 32, scrollbarH = 12, safetyMargin = 4;
  // separator height scales with available space — fewer pixels per group means smaller separators
  const sepH = totalGroups2 > 15 ? 18 : totalGroups2 > 10 ? 22 : 28;
  const sideEl = document.getElementById('liveSide');
  const stackedH = (window.matchMedia('(max-width:700px)').matches && sideEl) ? sideEl.getBoundingClientRect().height : 0;
  const availH = window.innerHeight - liveHdrH - sponsorH - stackedH - rulerH - (sectionCount * sepH) - scrollbarH - safetyMargin;
  // calculate row height — no hard minimum so it always fits everything on screen
  const rowH = Math.min(80, Math.max(18, Math.floor(availH / Math.max(totalGroups2, 1))));
  const outer = document.createElement('div'); outer.className = 'tl-scroll'; outer.id = 'tlScroll';
  const inner = document.createElement('div'); inner.className = 'tl-inner'; inner.style.width = totalW + 'px';
  // ruler
  const ruler = document.createElement('div'); ruler.className = 'tl-ruler'; ruler.style.width = totalW + 'px';
  const rSpc = document.createElement('div'); rSpc.className = 'tl-ruler-spc'; rSpc.style.width = lblW + 'px';
  const rTicks = document.createElement('div'); rTicks.className = 'tl-ruler-ticks'; rTicks.style.width = width + 'px';
  for(let t = min; t <= max; t += 30){ if(t === min) continue; const tick = document.createElement('div'); tick.className = 'tl-tick' + (t % 60 === 0 ? ' hour' : ''); tick.style.left = ((t - min) * PX_PER_MIN) + 'px'; tick.textContent = fmtTime(t); rTicks.appendChild(tick); }
  ruler.appendChild(rSpc); ruler.appendChild(rTicks); inner.appendChild(ruler);
  // now line
  const nowLine = document.createElement('div'); nowLine.className = 'tl-nowline'; nowLine.id = 'tlNowLine'; nowLine.style.left = lblW + 'px'; inner.appendChild(nowLine);
  // sections
  ['squad','recreational'].forEach(section => {
    const groups = activeGroups[section];
    if(!groups.length) return;
    const sep = document.createElement('div'); sep.className = 'tl-sep'; sep.style.width = totalW + 'px'; sep.style.height = sepH + 'px'; sep.style.fontSize = sepH < 22 ? '.6rem' : '.68rem';
    const hasWeekBInSection = groups.some(g => DAYS.some(d => (DATA.sessions[d] && DATA.sessions[d][g.id] || []).some(s => s.locationB)));
    sep.innerHTML = `<span>${section === 'squad' ? (hasWeekBInSection ? 'Squads — ' + weekName(currentWeek) : 'Squads') : 'Recreational — ' + liveWeekName()}</span>`; inner.appendChild(sep);
    groups.forEach(group => {
      const sessions = (DATA.sessions[day] && DATA.sessions[day][group.id]) || [];
      const row = document.createElement('div'); row.className = 'tl-row'; row.style.width = totalW + 'px'; row.style.height = rowH + 'px';
      const lbl = document.createElement('div'); lbl.className = 'tl-lbl'; lbl.style.width = lblW + 'px'; lbl.dataset.name = group.name;
      { // "Next: Vault · 5:30" under the group name, in the apparatus colour
        const cur = sessions.find(x => nowMin >= x.start_min && nowMin < x.start_min + x.duration);
        const nxt = locInfo(nextSessionFor(group, day, cur ? cur.start_min + cur.duration : nowMin));
        if(nxt && rowH >= 30){
          lbl.classList.add('has-next');
          const fs = rowH > 50 ? '.72rem' : rowH > 38 ? '.64rem' : '.56rem';
          lbl.innerHTML = `<span class="tl-name">${escHtml(group.name)}</span><span class="tl-next" style="font-size:${fs};background:${nxt.colour};color:${isLight(nxt.colour) ? '#1a1a1a' : '#fff'}">&#8594; ${escHtml(nxt.name)} ${fmtTime(nxt.start)}</span>`;
        } else lbl.textContent = group.name;
      }
      lbl.style.background = group.colour || '#28225c';
      lbl.style.color = isLight(group.colour || '#28225c') ? '#1a1a1a' : '#fff';
      lbl.style.borderRight = '2px solid rgba(0,0,0,.2)';
      lbl.style.fontSize = rowH > 50 ? '.85rem' : rowH > 38 ? '.75rem' : '.65rem';
      const track = document.createElement('div'); track.className = 'tl-track'; track.style.width = width + 'px'; track.style.height = rowH + 'px';
      track.style.backgroundImage = 'linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)';
      track.style.backgroundSize = `${PX_PER_MIN * 60}px 100%,${PX_PER_MIN * 30}px 100%,${PX_PER_MIN * 5}px 100%`;
      sessions.forEach((s, idx) => {
        const activeLoc = getSessionLocation(s), loc = getLocByName(activeLoc), bg = loc ? loc.colour : '#555';
        const block = document.createElement('div'); block.className = 'tl-block';
        if(conflicts.has(`${group.id}:${idx}`)) block.classList.add('conflict');
        block.style.left = ((s.start_min - min) * PX_PER_MIN) + 'px';
        block.style.width = Math.max(s.duration * PX_PER_MIN - 2, 28) + 'px';
        block.style.background = bg; block.style.color = isLight(bg) ? '#2b2b2b' : '#fff';
        block.style.fontSize = rowH > 50 ? '.85rem' : rowH > 38 ? '.72rem' : '.6rem';
        block.style.padding = rowH > 50 ? '0 10px' : '0 5px';
        block.dataset.startMin = s.start_min; block.dataset.endMin = s.start_min + s.duration; block.dataset.loc = activeLoc || '';
        block.innerHTML = `<span class="b-loc">${escHtml(activeLoc)}${s.title ? ' · ' + escHtml(s.title) : ''}</span><span class="b-t">${fmtTime(s.start_min)}</span>`;
        track.appendChild(block);
      });
      row.appendChild(lbl); row.appendChild(track); inner.appendChild(row);
    });
  });
  if (!totalGroups2) { const e = document.createElement('div'); e.className = 'tl-empty'; e.textContent = DATA.groups.length ? 'No sessions scheduled for ' + day : 'No groups set up yet. Go to Groups & Locations to get started.'; inner.appendChild(e); }
  outer.appendChild(inner); container.appendChild(outer);
  // fade zones — 10 mins each side, fixed in place over the scrolling content
  const fadeWidthPx = 10 * PX_PER_MIN;
  const fadeLeft = document.createElement('div'); fadeLeft.className = 'tl-fade-left'; fadeLeft.style.left = lblW + 'px'; fadeLeft.style.width = fadeWidthPx + 'px';
  container.appendChild(fadeLeft);
  const fadeRight = document.createElement('div'); fadeRight.className = 'tl-fade-right'; fadeRight.style.width = fadeWidthPx + 'px';
  container.appendChild(fadeRight);
  container.dataset.min = min; container.dataset.max = max; container.dataset.lblW = lblW;
  setTimeout(() => {
    const bufferPx = 10 * PX_PER_MIN, targetVis = lblW + bufferPx;
    const nowPx = lblW + (liveAnchor(nowMinutes()) - min) * PX_PER_MIN;
    outer.scrollLeft = Math.max(0, nowPx - targetVis);
    updateNowLine();
  }, 100);
}
function liveAnchor(nowMin){
  const day = getTodayName(), all = Object.values((DATA.sessions && DATA.sessions[day]) || {}).flat();
  const first = all.length ? Math.min(...all.map(s => s.start_min)) : null;
  return first != null && nowMin < first - 15 ? first - 10 : nowMin;
}
function updateNowLine(){
  if(!liveMode) return;
  const container = document.getElementById('tlContainer'); if (!container) return;
  const min = parseInt(container.dataset.min || 480), max = parseInt(container.dataset.max || 1200), lblW = parseInt(container.dataset.lblW || 200);
  const nowMin = nowMinutes(); const nowLine = document.getElementById('tlNowLine'); const outer = document.getElementById('tlScroll');
  if(!nowLine || !outer) return;
  if(nowMin >= min && nowMin <= max){
    nowLine.style.display = 'block';
    const nowPx = lblW + (nowMin - min) * PX_PER_MIN; nowLine.style.left = nowPx + 'px';
    // keep "now" just past the 10-min fade zone after the labels
    const targetVis = lblW + 10 * PX_PER_MIN;
    const anchorPx = lblW + (liveAnchor(nowMin) - min) * PX_PER_MIN;
    if(Math.abs((anchorPx - outer.scrollLeft) - targetVis) > 15) outer.scrollLeft = Math.max(0, anchorPx - targetVis);
  } else { nowLine.style.display = 'none'; }
  document.querySelectorAll('#tlContainer .tl-block').forEach(b => { const s = parseInt(b.dataset.startMin), e = parseInt(b.dataset.endMin); b.classList.toggle('dim', !(nowMin >= s && nowMin < e)); });
}

let bellEnabled = true; // sound defaults to on each time the page loads
let audioCtxBell = null;
// primes the AudioContext and the speech voice from a genuine click, so ringBell()/speakFinalGoes()
// called later from a timer (not a click) aren't silently blocked by the browser's autoplay policy
function unlockLiveAudio(){
  try{ bellOut(); }catch(e){}
  try{ if('speechSynthesis' in window){ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } }catch(e){}
}
function toggleBell(){
  bellEnabled = !bellEnabled;
  if(bellEnabled) unlockLiveAudio();
  const btn = document.getElementById('bellBtn');
  if (btn) { btn.innerHTML = svg(bellEnabled ? 'bell' : 'belloff'); btn.classList.toggle('off', !bellEnabled); btn.setAttribute('aria-pressed', bellEnabled); btn.setAttribute('aria-label', bellEnabled ? 'Bell alerts on' : 'Bell alerts off'); }
  toast(bellEnabled ? 'Bell alerts on' : 'Bell alerts off');
  if(bellEnabled) ringBell(); // test chime: unlocks audio on this click and lets you check the volume
}
// ---- Bell loudness settings (edit these two numbers) ----
const BELL_VOLUME  = 1.0; // 0 to 1 — 1 is the loudest the browser can make it
const BELL_REPEATS = 1;   // how many times the ding-dong plays each time the alert fires
// shared audio output for every sound: one context, with a compressor so we can drive the level hard
function bellOut(){
  if(!audioCtxBell) audioCtxBell = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = audioCtxBell;
  if(ctx.state === 'suspended') ctx.resume();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 10;
  comp.attack.value = 0.003; comp.release.value = 0.25;
  const master = ctx.createGain(); master.gain.value = BELL_VOLUME;
  comp.connect(master); master.connect(ctx.destination);
  return { ctx, comp, t0: ctx.currentTime + 0.05 };
}
function ringBell(){
  try{
    const { ctx, comp, t0 } = bellOut();
    for(let r = 0; r < BELL_REPEATS; r++){
      // ding-dong: two notes. Each is a full triangle wave plus a bright octave-up tone,
      // which carries much better across a noisy hall than a plain sine.
      [880, 660].forEach((freq, i) => {
        const start = t0 + r * 1.4 + i * 0.4;
        [['triangle', freq, 0.75], ['sine', freq * 2, 0.35]].forEach(([type, f, level]) => {
          const osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = type; osc.frequency.value = f;
          osc.connect(gain); gain.connect(comp);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(level, start + 0.02);
          gain.gain.setValueAtTime(level, start + 0.3);            // hold at full for a moment
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
          osc.start(start); osc.stop(start + 1.1);
        });
      });
    }
  }catch(e){ console.warn('Bell audio failed:', e); }
}
// ---- Right-hand panel: big digital clock ----
function updateSideClock(n){
  const hh = document.getElementById('lsHH'); if(!hh) return;
  hh.textContent = String(n.getHours()).padStart(2,'0');
  document.getElementById('lsMM').textContent = String(n.getMinutes()).padStart(2,'0');
  document.getElementById('lsSecs').textContent = ':' + String(n.getSeconds()).padStart(2,'0');
  document.getElementById('lsColon').classList.toggle('off', n.getSeconds() % 2 === 1);
  document.getElementById('lsDate').innerHTML = '<div>' + n.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'}) + '</div><div class="ls-week">' + liveWeekName() + '</div>';
}
// scale everything in the right-hand panel from its own width so it fills the space on any screen
function sizeLiveSide(){
  const p = document.getElementById('liveSide'); if(!p) return;
  const w = p.clientWidth, h = p.clientHeight; if(!w || !h) return;
  const stacked = window.matchMedia('(max-width:700px)').matches;
  p.style.setProperty('--ls-unit', (w / 100) + 'px');
  let f = stacked ? Math.min(w * 0.3, h * 0.6) : Math.min(w * 0.32, h * 0.34);
  p.style.setProperty('--ls-time', f + 'px');
  // safety net: if the digits are wider than the panel on this font, shrink to fit
  const t = document.getElementById('lsTime');
  const tw = t ? t.getBoundingClientRect().width : 0;
  if(tw > w * 0.9){ f = f * (w * 0.9) / tw; p.style.setProperty('--ls-time', f + 'px'); }
}
// ---- Right-hand panel: ROTATE NOW takes over the whole panel, then the clock returns ----
const ROTATE_ALERT_MS = 5 * 60 * 1000;   // the where-to-go boxes stay up for 5 minutes
const ROTATE_PULSE_MS = 20000;           // flash for the first 20 seconds, then hold still
// where a group goes next: the first session that starts at or after `fromMin`
function nextSessionFor(group, day, fromMin){
  const ss = ((DATA.sessions[day] && DATA.sessions[day][group.id]) || []).slice().sort((a, b) => a.start_min - b.start_min);
  return ss.find(x => x.start_min >= fromMin - 0.01) || null;
}
function locInfo(sess){
  if(!sess) return null;
  const name = getSessionLocation(sess) || '', loc = getLocByName(name);
  return { name, colour: loc ? loc.colour : '#555', start: sess.start_min };
}
// simple apparatus icons, picked from the location name
const APP_ICONS = {
  vault:'<path d="M8 40h48"/><path d="M14 40l4-16h28l4 16"/><path d="M18 24c0-4 4-6 14-6s14 2 14 6"/><path d="M24 40v12M40 40v12"/>',
  bars:'<path d="M14 56V8M50 56V8"/><path d="M8 16h48M8 32h48"/><path d="M8 56h12M44 56h12"/>',
  beam:'<path d="M4 26h56v7H4z"/><path d="M14 33l-4 21M50 33l4 21"/><path d="M8 54h8M48 54h8"/>',
  floor:'<rect x="6" y="10" width="52" height="44" rx="3"/><path d="M6 32h52M32 10v44"/><circle cx="32" cy="32" r="6"/>',
  tramp:'<ellipse cx="32" cy="28" rx="26" ry="8"/><path d="M8 30l4 22M56 30l-4 22M24 36l-2 16M40 36l2 16"/><path d="M32 4v12M27 9l5-5 5 5"/>',
  tumble:'<path d="M4 40h56v8H4z"/><path d="M12 30c6-14 14-14 20 0M32 30c6-14 14-14 20 0"/><path d="M48 22l4 8 6-4"/>',
  rings:'<path d="M18 4v26M46 4v26"/><circle cx="18" cy="40" r="10"/><circle cx="46" cy="40" r="10"/>',
  horse:'<path d="M6 34h52"/><path d="M10 34l4-10h36l4 10"/><path d="M22 24c0-6 4-8 4-8M42 24c0-6-4-8-4-8"/><path d="M18 34v20M46 34v20"/>',
  block:'<rect x="10" y="22" width="44" height="26" rx="3"/><path d="M10 34h44"/>',
  fwdfloor:'<rect x="6" y="14" width="52" height="36" rx="3"/><path d="M14 32h30M36 24l8 8-8 8"/>',
  bwdfloor:'<rect x="6" y="14" width="52" height="36" rx="3"/><path d="M50 32H20M28 24l-8 8 8 8"/>',
  warm:'<circle cx="32" cy="10" r="5"/><path d="M32 16v20M32 22l-14-8M32 22l14-8M32 36l-12 20M32 36l12 20"/>',
  other:'<path d="M32 6l7.5 15.5 17 2.4-12.3 12 2.9 17L32 45l-15.1 7.9 2.9-17-12.3-12 17-2.4z"/>'
};
function appIcon(name){
  const n = (name || '').toLowerCase();
  const k = /warm|cool|stretch|flex/.test(n) ? 'warm' : /forward/.test(n) ? 'fwdfloor' : /backward/.test(n) ? 'bwdfloor' : /vault|spring|table/.test(n) ? 'vault' : /bar/.test(n) ? 'bars' : /beam/.test(n) ? 'beam' : /tramp|dmt/.test(n) ? 'tramp'
          : /tumbl|track|rod|air/.test(n) ? 'tumble' : /ring/.test(n) ? 'rings' : /horse|pommel|mushroom/.test(n) ? 'horse'
          : /floor|mat/.test(n) ? 'floor' : /block|box|pit|conditioning/.test(n) ? 'block' : 'other';
  return APP_ICONS[k];
}
// fill a panel with one box per group, as big as the space allows
function renderGoGrid(bodyEl, sections){
  const items = [];
  sections.forEach(sec => sec.items.forEach(g => items.push(g)));
  const n = Math.max(items.length, 1);
  const W = bodyEl.clientWidth || bodyEl.parentElement.clientWidth, H = bodyEl.clientHeight || (bodyEl.parentElement.clientHeight * 0.85);
  let best = { cols:1, size:0 };
  for(let cols = 1; cols <= n; cols++){
    const rows = Math.ceil(n / cols), cw = W / cols, ch = H / rows;
    const size = Math.min(cw, ch * 1.25);          // boxes look best a little wider than tall
    if(size > best.size) best = { cols, size };
  }
  const rows = Math.ceil(n / best.cols);
  bodyEl.style.gridTemplateColumns = `repeat(${best.cols},1fr)`;
  bodyEl.style.gridTemplateRows = `repeat(${rows},1fr)`;
  const cell = Math.min(W / best.cols, H / rows);
  bodyEl.innerHTML = items.map(g => {
    const gc = g.colour || '#28225c', fg = isLight(gc) ? '#1a1a1a' : '#fff';
    const app = g.dest ? g.dest.name : '';
    const appFs = Math.max(14, Math.min(cell * 0.17, (W / best.cols) * 1.5 / Math.max(app.length, 4)));
    return `<div class="go-box" style="background:${gc};color:${fg}">
      <div class="gb-grp" style="font-size:${Math.max(12, cell * 0.09)}px">${escHtml(g.name)}</div>
      <svg viewBox="0 0 64 64" width="${cell * 0.42}" height="${cell * 0.42}" fill="none" stroke="${fg}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${appIcon(app)}</svg>
      <div class="gb-app" style="font-size:${appFs}px">${escHtml(app || '—')}</div>
      ${g.dest ? `<div class="gb-band" style="height:${Math.max(6, cell * 0.05)}px;background:${g.dest.colour || '#555'}"></div>` : ''}
    </div>`;
  }).join('');
  // shrink any apparatus name that is too long for its box
  bodyEl.querySelectorAll('.gb-app').forEach(t => {
    const box = t.parentElement; let f = parseFloat(t.style.fontSize);
    t.style.whiteSpace = t.textContent.includes(' ') ? 'normal' : 'nowrap';
    for(let i = 0; i < 40 && (t.scrollWidth > box.clientWidth * 0.92 || t.offsetHeight > box.clientHeight * 0.42); i++){ f *= 0.93; t.style.fontSize = f + 'px'; }
  });
}
function widenSide(on){
  const side = document.getElementById('liveSide'); if(!side) return;
  if(window.matchMedia('(max-width:700px)').matches) on = false;
  side.classList.toggle('wide', !!on);
}
function showRotationAlert(sections, holdMs, sinceMin){
  const el = document.getElementById('lsAlert'), bodyEl = document.getElementById('lsAlertBody');
  if(!el || !bodyEl) return;
  if(document.getElementById('lsFinal')?.classList.contains('show')) hideFinalGoes();
  widenSide(true);
  const hd = document.getElementById('lsAlertHead'); if(hd) hd.textContent = 'Rotate now';
  el.classList.remove('show', 'settled'); void el.offsetWidth; el.classList.add('show'); // restart the pop-in animation
  renderGoGrid(bodyEl, sections);
  clearTimeout(el._s);
  const since = sinceMin != null ? sinceMin : Math.floor(nowMinutes());
  const hold = holdMs != null ? holdMs : ROTATE_ALERT_MS;
  el._until = Date.now() + hold;
  el._s = setTimeout(() => { el.classList.add('settled'); if(hd) hd.textContent = 'Where to go · since ' + fmtTime(since); }, Math.min(ROTATE_PULSE_MS, hold));
  clearTimeout(el._t);
  el._t = setTimeout(hideRotationAlert, hold);
}
function hideRotationAlert(){
  const el = document.getElementById('lsAlert'); if(!el) return;
  clearTimeout(el._t); clearTimeout(el._s);
  el.classList.remove('show');
  if(!document.getElementById('lsFinal')?.classList.contains('show')) widenSide(false);
}
// ================================================================
// FINAL GOES — announced 1 minute before a group's session ends and it moves on
// ================================================================
const FINAL_GOES_LEAD    = 1;     // minutes before the rotation
const FINAL_GOES_MS      = 8000;  // how long the announcement stays on screen before the clock returns
const FINAL_GOES_SPOKEN  = true;  // also say "Final goes" out loud (only while the bell is on). false = screen + chime only
const FINAL_GOES_MAXGAP  = 5;     // a session only counts as "rotating" if the group's next one starts within this many minutes

/* ---------- Pre-School "this week" box ----------
   A group is Pre-School if it's ticked as a Pre-School class, or its name says so. During a Pre-School class the live
   screen shows the week's social post and both books' sticker skills, taken from the club's Pre-School term planner
   (Programmes → Pre-School). Across the screen when only Pre-School is on, and in the right-hand panel (so the timeline
   stays visible) when other classes are running too. Rotate-now and final-goes boxes always come first. */
let preShownFor = null;
function preWeek(){
  const P = window.NGLPS, plan = CLUB && ((CLUB.plans && CLUB.plans.preschool) || CLUB.preschoolPlan); if(!P || !plan) return null;
  const rows = P.plan(plan), today = P.iso(new Date()); let row = null;
  rows.forEach(r => { if(r.date <= today) row = r; });
  if(!row || (P.parse(today) - P.parse(row.date)) >= 7 * 86400000) return null;   // half term or holidays
  return row;
}
function preBoxHTML(r){
  const t = r.theme, p2 = n => String(n).padStart(2, '0'), e = esc;
  const book = (b, n) => `<div class="pp-b${n === 2 ? ' b2' : ''}"><img src="${PS_BASE}img/medal${p2(b.country.n)}.png" alt=""><div><h4>Book ${n} · ${e(b.country.name)}</h4>${b.skills.map(x => `<div>${e(x)}</div>`).join('')}</div></div>`;
  return `<img class="pp-img" src="${PS_BASE}img/post_${t.file}.jpg" alt="">
    <div class="pp-txt"><div class="pp-k">Pre-School · this week</div><div class="pp-t">${e(t.name)}</div>
      ${r.seasonal ? '<div class="pp-w">A seasonal themed class. No new passport skills this week.</div>' : `<div class="pp-w">Around the World with Somi &amp; Flic · week ${r.w} of 40</div>${book(r.b1, 1)}${book(r.b2, 2)}`}</div>`;
}
function hidePreschool(){ const el = document.getElementById('lsPre'); if(el && el.classList.contains('show')){ el.classList.remove('show', 'narrow'); const busy = ['lsAlert','lsFinal'].some(id => document.getElementById(id)?.classList.contains('show')); if(!busy) widenSide(false); } }
function checkPreschool(){
  const el = document.getElementById('lsPre'); if(!el || !liveMode) return;
  const day = getTodayName(), nowMin = nowMinutes();
  let start = null, others = false;
  DATA.groups.forEach(g => {
    const ss = (DATA.sessions[day] || {})[g.id] || []; if(!ss.length) return;
    const st = Math.min(...ss.map(x => +x.start_min)), en = Math.max(...ss.map(x => +x.start_min + (+x.duration || 0)));
    if(!(nowMin >= st && nowMin < en)) return;
    if(isPreGroup(g)){ if(start === null || st > start) start = st; } else others = true;
  });
  const busy = ['lsAlert','lsFinal'].some(id => document.getElementById(id)?.classList.contains('show'));
  if(start === null || busy){ if(start === null) preShownFor = null; hidePreschool(); return; }
  const r = preWeek(); if(!r){ hidePreschool(); return; }
  const key = start + '|' + r.date;
  if(preShownFor !== key || !el.classList.contains('show')){ el.innerHTML = preBoxHTML(r); preShownFor = key; el.classList.add('show'); }
  el.classList.toggle('narrow', others);
  widenSide(!others);
}
function checkFinalGoes(){
  if(!liveMode || !DATA || !DATA.groups) return;
  const day = getTodayName(), nowMin = nowMinutes();
  const ends = {}; // session end minute -> groups that move on at that time
  DATA.groups.forEach(g => {
    if(!(g.days || DAYS).includes(day)) return;
    const ss = (DATA.sessions[day] && DATA.sessions[day][g.id]) || [];
    ss.forEach(s => {
      const end = s.start_min + s.duration;
      // only when the group actually moves on to another session shortly after
      const nxt = ss.filter(x => x.start_min >= end && x.start_min <= end + FINAL_GOES_MAXGAP).sort((a, b) => a.start_min - b.start_min)[0];
      if(!nxt) return;
      (ends[end] = ends[end] || []).push(Object.assign({}, g, { dest: locInfo(nxt) }));
    });
  });
  Object.keys(ends).forEach(k => {
    const end = +k, from = end - FINAL_GOES_LEAD;
    if(nowMin >= from && nowMin < end && lastFinalGoes !== end){ lastFinalGoes = end; showFinalGoes(ends[k]); }
  });
}
function showFinalGoes(groups){
  const el = document.getElementById('lsFinal'), bodyEl = document.getElementById('lsFinalBody');
  if(!el || !bodyEl) return;
  const sorted = groups.slice().sort((a, b) => { if(a.section !== b.section) return a.section === 'squad' ? -1 : 1; return a.name.localeCompare(b.name); });
  const sections = [];
  const squads = sorted.filter(g => g.section === 'squad'), rec = sorted.filter(g => g.section !== 'squad');
  if(squads.length) sections.push({ label:'Squads', items:squads });
  if(rec.length) sections.push({ label:'Recreational', items:rec });
  hideRotationAlert();
  widenSide(true);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  renderGoGrid(bodyEl, sections);
  clearTimeout(el._t);
  el._t = setTimeout(hideFinalGoes, FINAL_GOES_MS);
  if(bellEnabled){ ringFinalChime(); if(FINAL_GOES_SPOKEN) setTimeout(speakFinalGoes, 900); }
}
function hideFinalGoes(){
  const el = document.getElementById('lsFinal'); if(!el) return;
  clearTimeout(el._t);
  el.classList.remove('show');
  if(!document.getElementById('lsAlert')?.classList.contains('show')) widenSide(false);
}
// two quick pings — clearly different from the ding-dong used for ROTATE NOW
function ringFinalChime(){
  try{
    const { ctx, comp, t0 } = bellOut();
    [0, 0.25].forEach(off => {
      const start = t0 + off;
      [['triangle', 1175, 0.75], ['sine', 2350, 0.3]].forEach(([type, f, level]) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = type; osc.frequency.value = f;
        osc.connect(gain); gain.connect(comp);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
        osc.start(start); osc.stop(start + 0.55);
      });
    });
  }catch(e){ console.warn('Final chime failed:', e); }
}
function speakFinalGoes(){
  try{
    if(!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance('Final goes');
    u.lang = 'en-GB'; u.rate = 0.9; u.pitch = 1; u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch(e){ console.warn('Speech failed:', e); }
}
// handy for testing: open the browser console (F12) while in Live mode and type previewFinalGoes()
window.previewFinalGoes = function(){ showFinalGoes((DATA.groups || []).slice(0, 4)); };
function checkFlash(){
  if(!liveMode) return;
  const nowMin = nowMinutes();
  const blocks = [...document.querySelectorAll('#tlContainer .tl-block')];
  blocks.forEach(b => { b.classList.toggle('flash', Math.abs(parseInt(b.dataset.startMin) - nowMin) < 1.5); });
  // backstop for the hide timer (timers can be held back when the screen is busy or in the background)
  const al = document.getElementById('lsAlert');
  if(al && al.classList.contains('show') && al._until && Date.now() > al._until + 2000) hideRotationAlert();
  // The most recent rotation in the last 5 minutes. Looking back (not only at the exact minute) means a
  // rotation is never missed if the screen's timer skipped a beat, or the page was reloaded just after it.
  const holdMin = ROTATE_ALERT_MS / 60000;
  let latest = null;
  blocks.forEach(b => { const st = parseInt(b.dataset.startMin); if(st <= nowMin + 0.02 && nowMin - st < holdMin && (latest === null || st > latest)) latest = st; });
  if(latest === null || latest === lastAlertMin) return;
  lastAlertMin = latest;
  const flashingGroups = [];
  blocks.forEach(b => {
    if(parseInt(b.dataset.startMin) !== latest) return;
    const row = b.closest('.tl-row'); if(!row) return;
    const lbl = row.querySelector('.tl-lbl');
    const gname = lbl ? (lbl.dataset.name || lbl.textContent) : '';
    if(!lbl || flashingGroups.find(g => g.name === gname)) return;
    const group = DATA.groups.find(g => g.name === gname);
    const loc = getLocByName(b.dataset.loc || '');
    flashingGroups.push({ name:gname, section:group ? group.section : 'squad', colour:group ? group.colour : '', dest: b.dataset.loc ? { name:b.dataset.loc, colour: loc ? loc.colour : '#555' } : null });
  });
  if(!flashingGroups.length) return;
  // squads first, then recreational, alphabetically within each
  flashingGroups.sort((a, b) => { if(a.section !== b.section) return a.section === 'squad' ? -1 : 1; return a.name.localeCompare(b.name); });
  const squads = flashingGroups.filter(g => g.section === 'squad'), rec = flashingGroups.filter(g => g.section === 'recreational');
  const parts = [];
  if(squads.length) parts.push({ label:'Squads', items:squads });
  if(rec.length) parts.push({ label:'Recreational', items:rec });
  const late = (nowMin - latest) * 60000;
  showRotationAlert(parts, Math.max(5000, ROTATE_ALERT_MS - late), latest);
  if(bellEnabled && late < 60000) ringBell();
}

// ================================================================
// MOUNT and CLEAN-UP: after the screen is on the page (the app sends ngl:rendered)
// ================================================================
function mount(){
  const root = document.getElementById('rpRoot');
  if (!root) { if (liveMode) stopLive(); stopRealtimeListener(); S.mounted = null; return; }
  if (S.tab === 'live') { if (!liveMode || !document.getElementById('tlContainer')?.firstChild) enterLive(); }
  else {
    if (liveMode) stopLive();
    if (S.tab === 'admin') loadFeedbackInbox();
  }
  startRealtimeListener();
  S.mounted = S.tab;
}
document.addEventListener('ngl:rendered', mount);
// Double-click a group name to edit it (Enter does the same from the keyboard)
document.addEventListener('dblclick', e => { const c = e.target.closest && e.target.closest('#rpRoot [data-rp-dbl]'); if (c) openGroupModal(c.dataset.rpDbl); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target; if (!t.closest || !t.closest('#rpRoot')) return;
  if (t.dataset && t.dataset.rpDbl) { e.preventDefault(); openGroupModal(t.dataset.rpDbl); }
  else if (t.matches && t.matches('.session-chip[data-act]')) { e.preventDefault(); t.click(); }
});

// ================================================================
// BUTTONS (data-act="rp-…"): registered with the app's click handler through APPACTS
// ================================================================
const num = v => v === undefined || v === '' ? null : +v;
export const RP = {
  'rp-tab'(b){ go(b.dataset.tab); },
  'rp-week'(b){ currentWeek = b.dataset.w; draw(); toast('Showing ' + weekName(currentWeek)); },
  'rp-mobwk'(b){ currentWeek = b.dataset.w; draw(); },
  'rp-mobday'(b){ mobDayIdx = (mobDayIdx + Number(b.dataset.by) + DAYS.length) % DAYS.length; draw(); },
  'rp-save'(){ saveNow(); },
  'rp-golive'(){
    // "Go Live" is a real click, so use it to unlock sound for later automatic alerts, and to go full screen
    if (bellEnabled) unlockLiveAudio();
    try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
    go('live');
  },
  'rp-exit'(){ exitLive(); },
  'rp-fs'(){ try { document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} if (bellEnabled) unlockLiveAudio(); },
  'rp-bell'(){ toggleBell(); },
  'rp-stream'(){ showStreamLink(); },
  'rp-copylink'(b){ copyStreamLink(b); },
  'rp-move'(){ openMoveModal(); },
  'rp-move-go'(b){ moveGo(b); },
  'rp-profile'(){ openProfileModal(); },
  'rp-profile-save'(b){ saveClubProfile(b); },
  'rp-feedback'(){ openFeedback(); },
  'rp-fb-send'(b){ sendFeedback(b); },
  // sessions
  'rp-sess'(b){ openSessionModal(b.dataset.day, b.dataset.g, num(b.dataset.i)); },
  'rp-qdel'(b){ quickDel(b.dataset.day, b.dataset.g, +b.dataset.i); },
  'rp-dur'(b){ setDur(+b.dataset.v); },
  'rp-sess-save'(){ saveSession(); },
  'rp-sess-del'(){ deleteSession(); },
  'rp-copyday'(b){ copyGroupDay(b.dataset.g, b.dataset.from, b.dataset.day); },
  'rp-clear'(b){ clearGroupDay(b.dataset.day, b.dataset.g); },
  'rp-cblock'(b){ openCopyBlockModal(b.dataset.day, b.dataset.g); },
  'rp-cb-add'(){ const t = parseInt(document.getElementById('cb_start').value); if (!copyBlockTimes.includes(t)) { copyBlockTimes.push(t); copyBlockTimes.sort((a, b) => a - b); } dlgErr('cb_err', ''); renderCopyBlockTimes(); },
  'rp-cb-rm'(b){ copyBlockTimes = copyBlockTimes.filter(x => x !== +b.dataset.t); renderCopyBlockTimes(); },
  'rp-cb-do'(){ doCopyBlock(); },
  // groups and locations
  'rp-group'(b){ openGroupModal(b.dataset.g || null, b.dataset.section || 'squad'); },
  'rp-group-save'(){ saveGroup(); },
  'rp-group-del'(){ deleteGroup(); },
  'rp-loc'(b){ openLocationModal(b.dataset.l || null); },
  'rp-loc-save'(){ saveLocation(); },
  'rp-loc-del'(){ deleteLocation(); },
  'rp-swatch'(b){
    if (b.dataset.k === 'g') selectedGroupColour = b.dataset.c; else selectedLocColour = b.dataset.c;
    b.parentElement.querySelectorAll('.colour-swatch').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b); });
  },
  // totals
  'rp-sort'(b){ const col = b.dataset.col || null; totalsSortDir = (totalsSortCol === col && totalsSortDir === 'desc') ? 'asc' : 'desc'; totalsSortCol = col; const t = document.getElementById('totalsContent'); if (t) t.innerHTML = weeklyTotalsHTML(); },
  'rp-totwk'(b){ const w = b.dataset.w; ['A', 'B'].forEach(x => { document.getElementById('totals_week' + x).classList.toggle('active', x === w); document.getElementById('totals_table' + x).style.display = x === w ? '' : 'none'; }); },
  // recreational
  'rp-recprint'(){ recPrintSheet(); },
  // NGL Admin
  'rp-fb-refresh'(){ loadFeedbackInbox(); },
  'rp-fb-read'(b){ markFeedbackRead(b.dataset.id); },
  'rp-spon-del'(b){ deleteSponsor(b.dataset.id); },
  'rp-emailall'(){ emailAllClubs(); },
  'rp-copyemails'(){ copyAllEmails(); }
};
Object.assign(APPACTS, RP);

let CSS = null;
const css = () => CSS || (CSS = new Promise(res => {
  if (document.querySelector('link[data-rp-css]')) return res();
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/rotation-planner.css'; l.dataset.rpCss = '1';
  l.onload = l.onerror = () => res(); document.head.appendChild(l); setTimeout(res, 4000);
}));
/* The screen: #/tools/rotation[/groups|/totals|/recreational|/admin|/screen]. Wired as a NAV entry 'tools'
   the app passes ['rotation', …]; the leading 'rotation' is optional. */
export default async function rotationPlanner(parts = []){
  parts = (parts || []).slice(); if (parts[0] === 'rotation') parts.shift();
  if (!S.loaded) S.loaded = load();
  await Promise.all([S.loaded, css()]);   // the live screen sizes itself from the page, so its styles must be in first
  let t = TAB_OF[parts[0] || ''] || 'planner';
  if (t === 'admin' && !S.canAdmin) t = 'planner';
  S.tab = t;
  return `<div id="rpRoot" class="rotp${t === 'live' ? ' rp-on-live' : ''}">${body()}</div>`;
}
// For tests and the console: the plan in memory, and a fresh load
export const _rp = {data: () => DATA, club: () => CLUB, week: () => currentWeek, live: () => liveMode, reload(){ S.loaded = null; } };
