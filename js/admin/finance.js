// NGL Admin · NGL P&L. One P&L for the season that fills itself in:
//   Forecast = Club Hub reservations (reserved + bought, plus places booked by clubs not yet registered),
//   Actual   = JustGo sales (the "Sync NGL sales" bookmark) and paid orders in the app.
// The sums and assumptions are copied from GYMNASTICS-RESULTS/NGL_Finance.html (PNL_DEFAULTS, pnlPrice, pnlRow,
// medalCount, isNewHost, compPieces, per-pathway overrides, the JustGo matching and bookedRow, the annual lines);
// only the look and the data layer change.
// Data: competitions, reservations, pendingPlaces, orders, justgoSales/summary (map edits saved with merge),
//   finance/settings (same shape as the old ngl_finance/settings), finance/actuals {comps:{compId:{line:£}}, targets:{key:£}}.
// ?demo: sample data in memory; nothing is ever written.
import { MODE, iso } from '../data.js';
import { fb } from '../firebase.js';
import { PATHWAYS } from '../config.js';
import { esc, toast } from '../ui.js';

const FINANCE = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Finance.html';
const DEMO = MODE === 'demo';
const PK = PATHWAYS.map(p => p.k);
const PN = k => (PATHWAYS.find(p => p.k === k) || {n: k}).n;
const PC = k => (PATHWAYS.find(p => p.k === k) || {c: 'var(--line)'}).c;

/* ===== Assumptions: copied from NGL_Finance.html ===== */
const PNL_DEFAULTS = {
  rec2:20, rec4:30, genGirls:40, genBoys:50, perfGirls:45, perfBoys:55, schools:0,
  specPerGym:1.5, specPrice:6,
  venueHourly:100, venueHours:4, opsMgr:200, camRate:40, camCount:2, judgeRate:50, judgeCount:2, elevien:185,
  medalPrice:1.5, subdivisions:8, defaultPieces:4, aaMedals:0, recAllMedal:1, cardFee:1, hostKit:60, hostPay2:7.5, hostPay4:10,
  over:{},
  annual:[ {id:'a_opsmgr', name:'National Ops Manager salary', type:'cost', amount:500, basis:'month'} ],
  custom:[],
  gbRebate:10, gbMargin:10, mediaFrom:2027, mediaTake:20, mediaPrice:15, mediaCostPer:1, mediaFixed:500
};
const MAX_JUDGES = 2;
// League-wide lines added once to saved settings (same as the old tool, so the figures agree)
const MIGRATIONS = [
  {flag:'m_merch', lines:[
    {id:'a_merch_inc', name:'Merchandise sales', type:'income', amount:1000, basis:'year'},
    {id:'a_merch_cost', name:'Merchandise stock', type:'cost', amount:500, basis:'year'} ]},
  {flag:'m_recops', over:{recreational:{opsMgr:0}}}
];
const PNL_FIELDS = [
  ['Entry fees (per gymnast)', [['rec2','Recreational 2 piece'],['rec4','Recreational 3+ piece'],['genGirls','General League girls'],['genBoys','General League boys'],['perfGirls','Performance girls'],['perfBoys','Performance boys'],['schools','Schools']]],
  ['Spectators', [['specPerGym','Spectators per gymnast'],['specPrice','Ticket price']]],
  ['Costs per competition', [['venueHourly','Venue hire per hour (non-SAADI)'],['venueHours','Venue hours'],['opsMgr','National Ops Manager'],['camRate','Camera operator rate'],['camCount','Camera operators'],['judgeRate','Remote judge rate'],['judgeCount','Remote judges (max 2)'],['elevien','Elevien']]],
  ['Medals', [['medalPrice','Price per medal'],['subdivisions','Sub-divisions per competition'],['defaultPieces','Apparatus if not set on competition'],['aaMedals','All-around medals (1 yes, 0 no)'],['recAllMedal','Recreational: every gymnast medals on every piece (1 yes, 0 no)']]],
  ['Per gymnast costs', [['cardFee','Card payment fee']]],
  ['Host clubs', [['hostKit','NGL Team t-shirts, one-off per new host club (4 shirts)'],['hostPay2','Recreational host payment per gymnast, 2 piece'],['hostPay4','Recreational host payment per gymnast, 3+ piece']]]
];
const FIELD_PATHS = { rec2:['recreational'], rec4:['recreational'], genGirls:['general'], genBoys:['general'], perfGirls:['performance'], perfBoys:['performance'], schools:['schools'],
  recAllMedal:['recreational'], hostPay2:['recreational'], hostPay4:['recreational'] };
const MONEY_FIELDS = new Set(['rec2','rec4','genGirls','genBoys','perfGirls','perfBoys','schools','specPrice','venueHourly','opsMgr','camRate','judgeRate','elevien','medalPrice','cardFee','hostKit','hostPay2','hostPay4']);
const fresh = () => JSON.parse(JSON.stringify(PNL_DEFAULTS));
function normalise(x){
  const a = Object.assign(fresh(), x || {}); if (!Array.isArray(a.custom)) a.custom = []; if (!Array.isArray(a.annual)) a.annual = fresh().annual;
  delete a.medals;
  if (!a.over || typeof a.over !== 'object') a.over = {};
  MIGRATIONS.forEach(m => { if (a[m.flag]) return; if (m.over) Object.entries(m.over).forEach(([k, v]) => { a.over[k] = Object.assign({}, v, a.over[k] || {}); });
    (m.lines || []).forEach(l => { if (!a.annual.some(x => x.id === l.id)) a.annual.push(Object.assign({}, l)); }); a[m.flag] = true; });
  return a;
}

/* ===== The competition sums (same maths as NGL_Finance.html) ===== */
let A = fresh(), ALL = [];
function compPathway(c){
  if (c.pathway && PK.includes(c.pathway)) return c.pathway;
  return ((c.name || '') + ' ' + (c.level || '')).toLowerCase().includes('rec') ? 'recreational' : 'general';
}
const hasMax = c => typeof c.maxPlaces === 'number' && !isNaN(c.maxPlaces);
const overFor = path => (A.over && A.over[path]) || {};
const effFor = path => Object.assign({}, A, overFor(path));
const eff = c => effFor(compPathway(c));
const venueKey = c => (c.venue || '').trim().toLowerCase();
function isNewHost(c){
  if (!venueKey(c) || /saadi/i.test(c.venue || '')) return false;
  const first = ALL.filter(x => venueKey(x) === venueKey(c)).sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.id).localeCompare(String(b.id)))[0];
  return first && first.id === c.id;
}
function compPieces(c, P){ P = P || eff(c); const m = /^(\d)piece$/.exec(c.apparatus || ''); return m ? parseInt(m[1], 10) : (P.defaultPieces || 4); }
function medalCount(c, gymnasts, P){
  P = P || eff(c);
  if (P.recAllMedal && compPathway(c) === 'recreational') return gymnasts * (compPieces(c, P) + (P.aaMedals ? 1 : 0));
  const subs = Math.max(1, P.subdivisions || 1), per = gymnasts / subs;
  return Math.round(subs * (compPieces(c, P) + (P.aaMedals ? 1 : 0)) * Math.min(3, per));
}
function pnlPrice(c){
  const A = eff(c), path = compPathway(c);
  const pieces = parseInt((/^(\d)piece$/.exec(c.apparatus || '') || [])[1] || '0', 10), g = c.gender;
  if (path === 'recreational') return pieces && pieces <= 2 ? [A.rec2, ''] : [A.rec4, pieces ? '' : 'Apparatus not set, priced as 3+ piece'];
  if (path === 'general' || path === 'performance') {
    const girls = path === 'general' ? A.genGirls : A.perfGirls, boys = path === 'general' ? A.genBoys : A.perfBoys;
    if (g === 'girls') return [girls, '']; if (g === 'boys') return [boys, ''];
    return [(girls + boys) / 2, g === 'both' ? 'Mixed, average of girls and boys price' : 'Gender not set, average price used'];
  }
  if (path === 'schools') return [A.schools, A.schools ? '' : 'No Schools price set'];
  return [0, 'Pathway not yet priced'];
}
const isFixed = l => l.basis === 'month' || l.basis === 'year';
const yearAmt = l => (parseFloat(l.amount) || 0) * (l.basis === 'month' ? 12 : 1);
function pnlRow(c, gymnasts){
  const P = eff(c), [price, note] = pnlPrice(c);
  const entry = gymnasts * price, spec = gymnasts * P.specPerGym * P.specPrice;
  const saadi = /saadi/i.test(c.venue || ''), rec = compPathway(c) === 'recreational';
  const venue = saadi ? 0 : P.venueHourly * P.venueHours;
  const hostPay = rec && !saadi ? gymnasts * (compPieces(c, P) <= 2 ? P.hostPay2 : P.hostPay4) : 0;
  const ops = P.opsMgr, cams = P.camRate * P.camCount, judges = P.judgeRate * Math.min(MAX_JUDGES, P.judgeCount), elev = P.elevien;
  const medalN = medalCount(c, gymnasts, P), med = medalN * P.medalPrice, card = gymnasts * P.cardFee, kit = isNewHost(c) ? P.hostKit : 0;
  const lines = {}; let otherInc = 0, otherCost = 0;
  A.custom.forEach(l => {
    if (isFixed(l)) return;
    if (l.path === '__saadi' && !saadi) return;
    if (l.path === '__away' && saadi) return;
    if (l.path && l.path.indexOf('__') !== 0 && l.path !== compPathway(c)) return;
    const amt = (parseFloat(l.amount) || 0) * (l.basis === 'gymnast' ? gymnasts : 1);
    lines['x_' + l.id] = amt; if (l.type === 'income') otherInc += amt; else otherCost += amt;
  });
  return {gymnasts, price, note, entry, spec, specN: gymnasts * P.specPerGym, otherInc, jgOther: 0, venue, ops, cams, judges, elev, med, medalN, card, kit, hostPay, lines, otherCost};
}

/* ===== JustGo matching: same as NGL_Finance.html and Ticket sales ===== */
function autoMatch(e, comps){
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
const matchOf = ref => { const JG = S.data.JG; return (JG.map && ref in JG.map) ? JG.map[ref] : autoMatch(JG.events[ref] || {}, ALL); };
function jgFor(c){
  const evs = Object.values(S.data.JG.events || {}).filter(e => matchOf(e.ref) === c.id); if (!evs.length) return null;
  const t = {gymnasts: 0, spectators: 0, gymInc: 0, specInc: 0, otherInc: 0, income: 0, refs: []};
  evs.forEach(e => { ['gymnasts', 'spectators', 'gymInc', 'specInc', 'otherInc', 'income'].forEach(k => t[k] += +e[k] || 0); t.refs.push(e.ref); });
  return t;
}
function ago(iso){ const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 36) return h + ' hours ago'; return Math.round(h / 24) + ' days ago'; }

/* ===== Lines shown in the P&L ===== */
const COSTS = [['venue', 'Venue hire', 'non-SAADI venues'], ['ops', 'National Ops Manager', 'per competition'], ['cams', 'Camera operators'], ['judges', 'Remote judges'], ['elev', 'Elevien'],
  ['med', 'Medals'], ['card', 'Card payment fees', 'per gymnast'], ['kit', 'Host club t-shirts', 'one-off per new host club'], ['hostPay', 'Host club payments', 'Recreational, not at SAADI']];
const perCompLines = type => A.custom.filter(l => !isFixed(l) && (type === 'income' ? l.type === 'income' : l.type !== 'income'));
const LIC_ALWAYS = ['preschool', 'schools', 'recreational'], SHOP_ALWAYS = ['preschool', 'schools', 'recreational', 'general'];
const isLicence = o => ['licence', 'pack'].includes(o.kind);

// One competition: forecast (reserved places) and actual (sold on JustGo, with any typed actual costs)
function compFigures(c){
  const D = S.data, reserved = D.places[c.id] || 0;
  const F = pnlRow(c, reserved);
  const s = jgFor(c), B = pnlRow(c, s ? s.gymnasts : 0);
  if (s) { B.entry = s.gymInc; B.spec = s.specInc; B.specN = s.spectators; B.jgOther = s.otherInc; }
  else B.specN = 0;
  const ov = (D.actuals.comps || {})[c.id] || {}, typed = {};
  [...COSTS.map(x => x[0]), ...perCompLines('cost').map(l => 'x_' + l.id)].forEach(k => {
    if (ov[k] === undefined || ov[k] === null || ov[k] === '' || isNaN(+ov[k])) return;
    typed[k] = true; if (k.startsWith('x_')) B.lines[k] = +ov[k]; else B[k] = +ov[k]; });
  const tot = R => { R.income = R.entry + R.spec + R.jgOther + perCompLines('income').reduce((a, l) => a + (R.lines['x_' + l.id] || 0), 0);
    R.costs = COSTS.reduce((a, [k]) => a + R[k], 0) + perCompLines('cost').reduce((a, l) => a + (R.lines['x_' + l.id] || 0), 0); R.profit = R.income - R.costs; };
  tot(F); tot(B);
  return {c, F, B, s, typed, reserved, sold: s ? s.gymnasts : 0};
}

function seasonOf(date){ const d = new Date(date + 'T12:00'); return d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(); }
const currentSeason = () => String(seasonOf(new Date().toISOString().slice(0, 10)));
const inLicYear = (dateIso, season) => !!dateIso && String(seasonOf(dateIso.slice(0, 10))) === String(season);
const orderNet = o => Array.isArray(o.lines) && o.lines.length ? o.lines.filter(l => l.k !== 'vat').reduce((a, l) => a + (+l.qty || 0) * (+l.unit || 0), 0) : (+o.total || 0);

function model(season){
  const D = S.data;
  const list = ALL.filter(c => (c.date || '').startsWith(season)).sort((a, b) => (a.date + (a.time || '') + a.name).localeCompare(b.date + (b.time || '') + b.name));
  const rows = list.map(compFigures);
  const sum = (side, k) => rows.reduce((a, r) => a + (r[side][k] || 0), 0);
  const orders = D.orders.filter(o => ['paid', 'sent'].includes(o.status) && inLicYear(o.paidAt || o.date, season));
  const T = D.actuals.targets || {}, tk = (g, k) => `${season}_${g}_${k}`;
  const inc = [], cost = [];
  inc.push({label: 'Entry fees', sub: `${sum('F', 'gymnasts')} reserved · ${sum('B', 'gymnasts')} sold on JustGo`, f: sum('F', 'entry'), a: sum('B', 'entry'), id: 'entry'});
  inc.push({label: 'Spectator tickets', sub: `${Math.round(sum('F', 'specN'))} expected · ${sum('B', 'specN')} sold`, f: sum('F', 'spec'), a: sum('B', 'spec'), id: 'spec'});
  if (sum('B', 'jgOther')) inc.push({label: 'Other JustGo sales', sub: 'e.g. t-shirts', f: 0, a: sum('B', 'jgOther'), id: 'jgOther'});
  perCompLines('income').forEach(l => inc.push({label: l.name || 'Other income', sub: l.basis === 'gymnast' ? 'per gymnast' : 'per competition', f: rows.reduce((a, r) => a + (r.F.lines['x_' + l.id] || 0), 0), a: rows.reduce((a, r) => a + (r.B.lines['x_' + l.id] || 0), 0)}));
  const lic = {}, shop = {};
  orders.forEach(o => { const p = (isLicence(o) ? o.licPath : '') || o.path || 'general', m = isLicence(o) ? lic : shop; m[p] = (m[p] || 0) + orderNet(o); });
  const orderRows = (group, label, always, m) => PK.filter(k => always.includes(k) || m[k] || T[tk(group, k)] != null).map(k => ({label: `${label}: ${PN(k)}`, path: k, f: +T[tk(group, k)] || 0, a: m[k] || 0, target: tk(group, k), tval: T[tk(group, k)]}));
  const licRows = orderRows('lic', 'Licences', LIC_ALWAYS, lic), shopRows = orderRows('shop', 'Shop', SHOP_ALWAYS, shop);
  COSTS.forEach(([k, label, sub]) => { const n = rows.filter(r => r.typed[k]).length;
    cost.push({label, sub: k === 'med' ? `${sum('F', 'medalN')} forecast · ${sum('B', 'medalN')} for sold places` : sub, f: sum('F', k), a: sum('B', k), typed: n}); });
  perCompLines('cost').forEach(l => cost.push({label: l.name || 'Other cost', sub: l.basis === 'gymnast' ? 'per gymnast' : 'per competition', f: rows.reduce((a, r) => a + (r.F.lines['x_' + l.id] || 0), 0), a: rows.reduce((a, r) => a + (r.B.lines['x_' + l.id] || 0), 0), typed: rows.filter(r => r.typed['x_' + l.id]).length}));
  const league = [...A.annual.map(l => ({...l, src: 'annual'})), ...A.custom.filter(isFixed).map(l => ({...l, src: 'custom'}))];
  const lInc = league.filter(l => l.type === 'income'), lCost = league.filter(l => l.type !== 'income');
  const s = arr => arr.reduce((a, r) => ({f: a.f + r.f, a: a.a + r.a}), {f: 0, a: 0});
  const lw = arr => arr.map(l => ({label: l.name || (l.type === 'income' ? 'Income' : 'Cost'), sub: `${gbp(+l.amount || 0)} per ${l.basis === 'month' ? 'month' : 'year'}`, f: yearAmt(l), a: yearAmt(l)}));
  const compInc = s(inc), compCost = s(cost), licT = s(licRows), shopT = s(shopRows), lwInc = s(lw(lInc)), lwCost = s(lw(lCost));
  const TI = {f: compInc.f + licT.f + shopT.f + lwInc.f, a: compInc.a + licT.a + shopT.a + lwInc.a};
  const TC = {f: compCost.f + lwCost.f, a: compCost.a + lwCost.a};
  return {list, rows, inc, cost, licRows, shopRows, lInc: lw(lInc), lCost: lw(lCost), league, TI, TC, NET: {f: TI.f - TC.f, a: TI.a - TC.a}, compInc, compCost, orders};
}

/* ===== Formatting ===== */
const gbp = n => (n < 0 ? '-' : '') + '£' + Math.round(Math.abs(n)).toLocaleString('en-GB');
const diffCell = (d, good) => { const r = Math.round(d); if (!r) return '<td class="fn-n fn-d">–</td>';
  return `<td class="fn-n fn-d ${(r > 0) === good ? 'fn-up' : 'fn-down'}">${r > 0 ? '+' : '-'}£${Math.abs(r).toLocaleString('en-GB')}</td>`; };
const fmtDate = d => new Date(d + 'T12:00').toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});

/* ===== Data ===== */
const S = {data: null, at: 0, season: null, setPath: 'all', setOpen: false, refocus: null, saving: null};
function demoData(){
  const comps = [
    {id: 'f-gl-east', name: 'General League · East Region', date: '2027-02-07', time: '09:00', venue: 'SAADI Gymnastics, Harpenden', pathway: 'general', gender: 'girls', apparatus: '4piece', maxPlaces: 120},
    {id: 'f-rec-ruby', name: 'Recreational · Ruby & Pink', date: '2027-03-13', time: '10:00', venue: 'Redbourn Leisure Centre', pathway: 'recreational', apparatus: '2piece', maxPlaces: 80},
    {id: 'f-perf', name: 'Performance League Grades', date: '2027-04-24', time: '09:30', venue: 'Stevenage Arena', pathway: 'performance', gender: 'both', maxPlaces: 40},
    {id: 'f-rec-teal', name: 'Recreational · Teal & Indigo', date: '2027-06-12', time: '10:00', venue: 'Redbourn Leisure Centre', pathway: 'recreational', apparatus: '4piece', maxPlaces: 80}];
  const res = [
    {compId: 'f-gl-east', places: 40, status: 'reserved'}, {compId: 'f-gl-east', places: 30, status: 'bought'}, {compId: 'f-gl-east', places: 10, status: 'waiting'},
    {compId: 'f-rec-ruby', places: 30, status: 'reserved'}, {compId: 'f-rec-ruby', places: 10, status: 'cancelled'},
    {compId: 'f-perf', places: 16, status: 'reserved'}, {compId: 'f-rec-teal', places: 20, status: 'reserved'}];
  const pend = [{compId: 'f-gl-east', places: 20, status: 'reserved'}];
  const JG = {syncedAt: new Date(Date.now() - 5 * 3600e3).toISOString(), map: {}, events: {
    EV000101: {ref: 'EV000101', date: '2027-02-07', name: 'NGL GENERAL LEAGUE EAST REGION', gymnasts: 72, spectators: 100, gymInc: 2880, specInc: 600, otherInc: 120, income: 3600},
    EV000102: {ref: 'EV000102', date: '2027-03-13', name: 'NGL RECREATIONAL RUBY AND PINK', gymnasts: 24, spectators: 30, gymInc: 480, specInc: 180, otherInc: 0, income: 660},
    EV000103: {ref: 'EV000103', date: '2027-04-25', name: 'NGL PERFORMANCE GRADES (MOVED)', gymnasts: 10, spectators: 12, gymInc: 500, specInc: 72, otherInc: 0, income: 572}}};
  const orders = [
    {id: 'ORD-K3M7Q', status: 'sent', kind: 'licence', licPath: 'schools', path: 'schools', total: 1140, date: '2026-10-26', paidAt: '2026-10-26', lines: [{k: 'licence', qty: 1, unit: 950}, {k: 'vat', qty: 1, unit: 190}]},
    {id: 'ORD-R7Y3J', status: 'sent', path: 'recreational', total: 619, date: '2026-09-26', paidAt: '2026-09-26'},
    {id: 'ORD-P2S8L', status: 'paid', kind: 'licence', licPath: 'preschool', path: 'preschool', total: 300, date: '2026-11-10', paidAt: '2026-11-10', lines: [{k: 'licence', qty: 1, unit: 250}, {k: 'vat', qty: 1, unit: 50}]},
    {id: 'ORD-G4B1K', status: 'paid', kind: 'supplies', path: 'general', total: 168, date: '2026-11-20', paidAt: '2026-11-20', lines: [{k: 'gbook', qty: 40, unit: 4}, {k: 'postage', qty: 1, unit: 8}]},
    {id: 'ORD-R2M6F', status: 'awaiting-payment', path: 'recreational', total: 800, date: '2026-11-24'},
    {id: 'ORD-OLD01', status: 'sent', kind: 'licence', licPath: 'schools', path: 'schools', total: 500, date: '2026-06-10', paidAt: '2026-06-10'}];
  return {comps, res, pend, JG, orders, settings: null, actuals: {comps: {}, targets: {}}};
}
async function liveData(){
  const {fs, D} = await fb();
  const soft = p => p.catch(e => { console.warn('NGL P&L: not read', e.code || e); return null; });
  const [cs, rs, ps, jg, os, st, ac] = await Promise.all([
    fs.getDocs(fs.collection(D, 'competitions')), soft(fs.getDocs(fs.collection(D, 'reservations'))), soft(fs.getDocs(fs.collection(D, 'pendingPlaces'))),
    soft(fs.getDoc(fs.doc(D, 'justgoSales', 'summary'))), soft(fs.getDocs(fs.collection(D, 'orders'))),
    soft(fs.getDoc(fs.doc(D, 'finance', 'settings'))), soft(fs.getDoc(fs.doc(D, 'finance', 'actuals')))]);
  const comps = cs.docs.map(d => { const x = d.data(); return {id: d.id, name: x.name || '', date: x.date || '', time: x.time || '', venue: x.where || x.venue || '',
    maxPlaces: x.maxPlaces, pathway: x.path || x.pathway || '', level: x.level || '', gender: x.gender || '', apparatus: x.apparatus || ''}; });
  const docs = q => q ? q.docs.map(d => ({id: d.id, ...d.data()})) : [];
  const x = jg && jg.exists() ? jg.data() : {};
  const orders = docs(os).map(o => ({...o, date: o.createdAt ? iso(o.createdAt) : '', paidAt: o.paidAt ? iso(o.paidAt) : null}));
  const a = ac && ac.exists() ? ac.data() : {};
  return {comps, res: docs(rs), pend: docs(ps), JG: {events: x.events || {}, map: x.map || {}, syncedAt: x.syncedAt || null}, orders,
    settings: st && st.exists() ? st.data() : null, actuals: {comps: a.comps || {}, targets: a.targets || {}}};
}
async function load(force){
  if (S.data && !force && Date.now() - S.at < 5 * 60e3) return;
  const d = DEMO ? demoData() : await liveData();
  const places = {}; [...d.res, ...d.pend].forEach(r => { if (['reserved', 'bought'].includes(r.status)) places[r.compId] = (places[r.compId] || 0) + (+r.places || 0); });
  S.data = {...d, places}; S.at = Date.now();
  A = normalise(d.settings); ALL = d.comps;
}

/* ===== Saving (never in sample data) ===== */
let setTimer = null;
function saveSettings(){
  if (DEMO) return; clearTimeout(setTimer);
  setTimer = setTimeout(async () => { try { const {fs, D} = await fb(); await fs.setDoc(fs.doc(D, 'finance', 'settings'), JSON.parse(JSON.stringify(A))); }
    catch (e) { console.error(e); toast(e.code === 'permission-denied' ? 'The database blocked saving the settings.' : 'Couldn’t save. Check your connection.', false); } }, 500);
}
async function saveActual(path, value){   // path: ['comps', compId, line] or ['targets', key]; value null removes it
  if (DEMO) return;
  try { const {fs, D} = await fb(); const v = value === null ? fs.deleteField() : value;
    const body = path[0] === 'comps' ? {comps: {[path[1]]: {[path[2]]: v}}} : {targets: {[path[1]]: v}};
    await fs.setDoc(fs.doc(D, 'finance', 'actuals'), body, {merge: true}); }
  catch (e) { console.error(e); toast('Couldn’t save that figure. Check your connection.', false); }
}
async function saveMatch(ref, compId){
  if (DEMO) return;
  try { const {fs, D} = await fb(); await fs.setDoc(fs.doc(D, 'justgoSales', 'summary'), {map: {[ref]: compId}}, {merge: true}); toast('Match saved'); }
  catch (e) { console.error(e); toast('Couldn’t save the match.', false); }
}

/* ===== Screen ===== */
export default async function finance(me, parts = []){
  try { await load(); }
  catch (e) { console.error(e); return `<div class="card empty">${e.code === 'permission-denied' ? 'You need NGL P&L access to see this. Ask Dave to tick it for you in NGL Admin → Team.' : 'Couldn’t load the P&L. Check your connection and refresh.'}</div>`; }
  const years = [...new Set([...ALL.map(c => (c.date || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)), currentSeason()])].sort();
  if (!S.season || !years.includes(S.season)) S.season = currentSeason();
  const m = model(S.season), compId = parts[0];
  const comp = compId && ALL.find(c => c.id === compId);
  const body = compId ? (comp ? compPage(comp) : '<div class="card empty">Competition not found. <a href="#/admin/finance">Back to the season P&L</a></div>') : seasonPage(m);
  return `<div id="fnRoot" class="fn-root">${DEMO ? '<p class="note">Sample data: figures you type stay on this page and aren’t saved.</p>' : ''}${syncCard()}${body}</div>`;
}

function syncCard(){
  const JG = S.data.JG, old = !JG.syncedAt || (Date.now() - new Date(JG.syncedAt)) > 2 * 864e5;
  const t = JG.syncedAt
    ? `Sales last synced from JustGo <b>${ago(JG.syncedAt)}</b> (${new Date(JG.syncedAt).toLocaleString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}). ${old ? 'To update, open MyBG Event Management and run the <b>Sync NGL sales</b> bookmark. ' : ''}<a href="${FINANCE}" target="_blank" rel="noopener">Sync instructions in Finance</a>`
    : `No JustGo sales synced yet. Open MyBG Event Management and run the <b>Sync NGL sales</b> bookmark. <a href="${FINANCE}" target="_blank" rel="noopener">Instructions in Finance</a>`;
  return `<div class="card fn-sync ${old ? 'old' : ''}" id="fnSync">${t}${DEMO ? '' : ' <button class="btn sm ghost" data-act="fn-refresh">Refresh figures</button>'}</div>`;
}

const tr = (r, good = true, cls = '') => `<tr class="${cls}"><td class="fn-l"><b>${esc(r.label)}</b>${r.typed ? ` <span class="pill warn">${r.typed} typed</span>` : ''}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</td>
  <td class="fn-n">${r.target ? `<label class="fn-tgt"><span class="sr">Target for ${esc(r.label)}</span>£<input type="number" min="0" step="1" inputmode="decimal" data-ft="${esc(r.target)}" value="${r.tval == null ? '' : esc(r.tval)}" placeholder="target"></label>` : gbp(r.f)}</td>
  <td class="fn-n">${gbp(r.a)}</td>${diffCell(r.a - r.f, good)}</tr>`;
const tot = (label, v, good = true, cls = 'fn-tot') => `<tr class="${cls}"><td class="fn-l"><b>${label}</b></td><td class="fn-n">${gbp(v.f)}</td><td class="fn-n">${gbp(v.a)}</td>${diffCell(v.a - v.f, good)}</tr>`;
const sec = t => `<tr class="fn-sec"><td colspan="4">${t}</td></tr>`;
const thead = (a = 'Forecast', b = 'Actual') => `<thead><tr><th></th><th class="fn-n">${a}</th><th class="fn-n">${b}</th><th class="fn-n">Difference</th></tr></thead>`;

function seasonPage(m){
  const years = [...new Set([...ALL.map(c => (c.date || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)), currentSeason()])].sort();
  const y = +S.season;
  const comps = m.rows.length ? `<div class="fn-wrap"><table class="fn-t fn-comps" id="fnComps"><thead><tr><th>Competition</th><th class="fn-n">Reserved</th><th class="fn-n">Sold</th><th class="fn-n">Forecast profit</th><th class="fn-n">Actual profit</th><th class="fn-n">Difference</th></tr></thead><tbody>
    ${m.rows.map(r => `<tr data-comp="${esc(r.c.id)}"><td class="fn-l"><a href="#/admin/finance/${esc(r.c.id)}" class="fn-clink"><span class="dot" style="display:inline-block;background:${PC(compPathway(r.c))}"></span> <b>${esc(r.c.name)}</b></a><small>${fmtDate(r.c.date)} · ${esc(r.c.venue || 'Venue TBC')}${Object.keys(r.typed).length ? ' · typed costs' : ''}</small></td>
      <td class="fn-n">${r.reserved}${hasMax(r.c) ? ` <small>of ${r.c.maxPlaces}</small>` : ''}</td><td class="fn-n">${r.sold}</td><td class="fn-n">${gbp(r.F.profit)}</td><td class="fn-n">${gbp(r.B.profit)}</td>${diffCell(r.B.profit - r.F.profit, true)}</tr>`).join('')}
    </tbody></table></div><p class="fn-hint">Open a competition for its own P&amp;L and to type actual costs.</p>` : `<p class="empty">No ${esc(S.season)} competitions yet. Add them in NGL Admin → Competitions.</p>`;
  return `<div class="fn-top"><label class="field fn-season"><span>Season</span><select id="fnSeason">${years.map(v => `<option${v === S.season ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="fn-kpis"><div class="card stat"><b id="fnProfitF">${gbp(m.NET.f)}</b><span>Forecast profit</span></div><div class="card stat"><b id="fnProfitA" class="${m.NET.a < 0 ? 'fn-neg' : ''}">${gbp(m.NET.a)}</b><span>Actual profit so far</span></div></div></div>
  <div class="card fn-card"><h2>P&amp;L ${esc(S.season)}</h2>
    <div class="fn-wrap"><table class="fn-t" id="fnPnl">${thead()}<tbody>
      ${sec('Competition income')}${m.inc.map(r => tr(r)).join('')}
      ${sec(`Licences and shop <small>paid orders, excluding VAT · Sept ${y - 1} to Aug ${y}</small>`)}${m.licRows.map(r => tr(r)).join('')}${m.shopRows.map(r => tr(r)).join('')}
      ${m.lInc.length ? sec('League-wide income') + m.lInc.map(r => tr(r)).join('') : ''}
      ${tot('Total income', m.TI)}
      ${sec('Competition costs')}${m.cost.map(r => tr(r, false)).join('')}
      ${m.lCost.length ? sec('League-wide costs') + m.lCost.map(r => tr(r, false)).join('') : ''}
      ${tot('Total costs', m.TC, false)}
      ${tot('Profit', m.NET, true, 'fn-tot fn-net')}
    </tbody></table></div>
    <p class="fn-hint">Forecast: Club Hub reservations (reserved and bought, plus places booked by clubs not registered yet; waiting lists left out) at the entry fees in Settings. Actual: gross sold on JustGo and paid orders. A competition with nothing sold yet still counts its fixed costs, as in Finance. Licence and shop forecasts are targets you type.</p></div>
  <div class="card fn-card"><h2>Competitions</h2>${comps}</div>
  ${unmatchedCard(m)}
  ${leagueCard(m)}
  ${settingsCard()}`;
}

function matchSelect(ref, sel){
  const list = ALL.filter(c => (c.date || '') >= String(+S.season - 1)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return `<select data-fm="${esc(ref)}" aria-label="P&amp;L competition for ${esc(ref)}"><option value="">Not in the P&amp;L</option>${list.map(c => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(c.date)} · ${esc(c.name)}</option>`).join('')}</select>`;
}
function unmatchedCard(){
  const evs = Object.values(S.data.JG.events || {}).filter(e => (e.date || '').startsWith(S.season) && !ALL.some(c => c.id === matchOf(e.ref)))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!evs.length) return '';
  return `<div class="card fn-card fn-unm" id="fnUnmatched"><h2>JustGo events not in the P&amp;L</h2><p class="fn-hint" style="margin-top:0">Their sales aren’t counted above. Choose the competition each one belongs to.</p>
    ${evs.map(e => `<div class="row fn-ev"><div class="grow"><b>${esc(e.name)}</b><small>${fmtDate(e.date)} · ${esc(e.ref)} · ${+e.gymnasts || 0} gymnasts, ${+e.spectators || 0} spectators · ${gbp(+e.income || 0)} gross</small></div>${matchSelect(e.ref, '')}</div>`).join('')}</div>`;
}
function leagueCard(m){
  const row = l => `<div class="fn-lw" data-lw="${esc(l.src)}|${esc(l.id)}">
    <select data-fa="${esc(l.src)}|${esc(l.id)}|type" aria-label="Income or cost"><option value="income"${l.type === 'income' ? ' selected' : ''}>Income</option><option value="cost"${l.type !== 'income' ? ' selected' : ''}>Cost</option></select>
    <input type="text" data-fa="${esc(l.src)}|${esc(l.id)}|name" value="${esc(l.name)}" placeholder="e.g. Sponsorship" aria-label="Name">
    <label class="fn-money">£<input type="number" min="0" step="1" inputmode="decimal" data-fa="${esc(l.src)}|${esc(l.id)}|amount" value="${esc(l.amount)}" aria-label="Amount"></label>
    <select data-fa="${esc(l.src)}|${esc(l.id)}|basis" aria-label="How often"><option value="month"${l.basis === 'month' ? ' selected' : ''}>per month</option><option value="year"${l.basis !== 'month' ? ' selected' : ''}>per year</option></select>
    <button class="btn sm ghost" data-act="fn-lw-del" data-id="${esc(l.src)}|${esc(l.id)}" aria-label="Remove ${esc(l.name || 'line')}">Remove</button></div>`;
  return `<div class="card fn-card" id="fnLeague"><h2>League-wide lines</h2><p class="fn-hint" style="margin-top:0">Salaries, merchandise and anything else not tied to one competition. Counted in Forecast and Actual for the whole season.</p>
    ${m.league.map(row).join('') || '<p class="empty">None yet.</p>'}
    <div class="btn-row"><button class="btn sm ghost" data-act="fn-lw-add" data-type="income">Add income line</button><button class="btn sm ghost" data-act="fn-lw-add" data-type="cost">Add cost line</button></div></div>`;
}
function settingsCard(){
  const pw = S.setPath === 'all' ? null : S.setPath, o = pw ? overFor(pw) : {}, E = pw ? effFor(pw) : A;
  const show = k => !FIELD_PATHS[k] || !pw || FIELD_PATHS[k].includes(pw);
  const used = PK.filter(k => ALL.some(c => compPathway(c) === k));
  return `<details class="card fn-card fn-set" id="fnSettings"${S.setOpen ? ' open' : ''}><summary><h2>Settings</h2><small>Entry fees, spectators, costs and medals used for every forecast</small></summary>
    <label class="field fn-setpath"><span>Figures for</span><select id="fnSetPath"><option value="all">All competitions</option>${used.map(k => `<option value="${k}"${pw === k ? ' selected' : ''}>${esc(PN(k))} only</option>`).join('')}</select></label>
    <p class="fn-hint">${pw ? `Changes here apply only to ${esc(PN(pw))} competitions. Highlighted figures differ from All competitions.` : 'Starting figures for every pathway. To change one pathway only, choose it above.'}</p>
    ${PNL_FIELDS.map(([title, fields]) => { const f = fields.filter(([k]) => show(k)); return f.length ? `<h3>${esc(title)}</h3><div class="fn-fields">${f.map(([k, label]) => { const ov = pw && k in o;
      return `<label class="fn-f ${ov ? 'ov' : ''}"><span>${esc(label)}</span><span class="fn-in">${MONEY_FIELDS.has(k) ? '£' : ''}<input type="number" min="0" step="${k === 'medalPrice' || k === 'cardFee' ? 0.05 : k === 'aaMedals' || k === 'recAllMedal' ? 1 : 0.5}"${k === 'judgeCount' ? ` max="${MAX_JUDGES}"` : ''}${k === 'aaMedals' || k === 'recAllMedal' ? ' max="1"' : ''} value="${esc(E[k])}" data-fs="${k}"></span>${ov ? `<button class="btn sm ghost" data-act="fn-undo" data-k="${k}">Use ${esc(String(A[k]))}</button>` : ''}</label>`; }).join('')}</div>` : ''; }).join('')}
  </details>`;
}

function compPage(c){
  const r = compFigures(c), {F, B} = r, ov = (S.data.actuals.comps || {})[c.id] || {};
  const left = hasMax(c) ? Math.max(0, c.maxPlaces - r.sold) : null;
  const evs = Object.values(S.data.JG.events || {}).filter(e => matchOf(e.ref) === c.id);
  const line = (label, f, a, good, sub) => `<tr><td class="fn-l"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</td><td class="fn-n">${gbp(f)}</td><td class="fn-n">${gbp(a)}</td>${diffCell(a - f, good)}</tr>`;
  const costRow = (k, label, sub) => { const typed = r.typed[k], calc = (() => { const s = r.s, base = pnlRow(c, s ? s.gymnasts : 0); return k.startsWith('x_') ? (base.lines[k] || 0) : base[k]; })();
    const f = k.startsWith('x_') ? (F.lines[k] || 0) : F[k], a = k.startsWith('x_') ? (B.lines[k] || 0) : B[k];
    return `<tr class="${typed ? 'fn-typed' : ''}" data-line="${k}"><td class="fn-l"><b>${esc(label)}</b>${typed ? ' <span class="pill warn">Typed</span>' : ''}${sub ? `<small>${esc(sub)}</small>` : ''}</td><td class="fn-n">${gbp(f)}</td>
      <td class="fn-n"><label class="fn-tgt ${typed ? 'on' : ''}"><span class="sr">Actual ${esc(label)}</span>£<input type="number" min="0" step="1" inputmode="decimal" data-fo="${esc(c.id)}|${k}" value="${typed ? esc(ov[k]) : ''}" placeholder="${Math.round(calc)}"></label>${typed ? `<button class="fn-undo" data-act="fn-clear" data-comp="${esc(c.id)}" data-k="${k}" aria-label="Use the calculated ${esc(label)}">Use ${gbp(calc)}</button>` : ''}</td>${diffCell(a - f, false)}</tr>`; };
  const P = eff(c), [price, note] = pnlPrice(c), flags = [note, hasMax(c) ? '' : 'No maximum places set on the competition'].filter(Boolean);
  return `<p style="margin:0 0 8px"><a href="#/admin/finance">← Season P&amp;L</a></p>
  <h2 class="fn-ch"><span class="dot" style="display:inline-block;background:${PC(compPathway(c))}"></span> ${esc(c.name)}</h2>
  <p class="lead">${fmtDate(c.date)}${c.time ? ' · ' + esc(c.time) : ''} · ${esc(c.venue || 'Venue TBC')} · ${esc(PN(compPathway(c)))} · ${gbp(price)} a gymnast${isNewHost(c) ? ' · new host club' : ''}</p>
  ${flags.length ? `<p class="note">${flags.map(esc).join(' · ')}</p>` : ''}
  <div class="grid g4 fn-stats"><div class="card stat"><b id="fnRes">${r.reserved}</b><span>reserved in the Club Hub</span></div><div class="card stat"><b id="fnSold">${r.sold}</b><span>sold on JustGo</span></div>
    <div class="card stat"><b id="fnLeft">${left == null ? '–' : left}</b><span>${left == null ? 'no maximum set' : `places left of ${c.maxPlaces}`}</span></div><div class="card stat"><b>${B.specN}</b><span>spectators sold (${Math.round(F.specN)} expected)</span></div></div>
  <div class="card fn-card"><h2>Competition P&amp;L</h2><div class="fn-wrap"><table class="fn-t" id="fnComp">${thead('Forecast', 'Actual')}<tbody>
    ${sec('Income')}${line('Entry fees', F.entry, B.entry, true, `${r.reserved} reserved · ${r.sold} sold`)}${line('Spectator tickets', F.spec, B.spec, true, `${Math.round(F.specN)} expected · ${B.specN} sold`)}
    ${B.jgOther ? line('Other JustGo sales', 0, B.jgOther, true) : ''}${perCompLines('income').map(l => line(l.name || 'Other income', F.lines['x_' + l.id] || 0, B.lines['x_' + l.id] || 0, true)).join('')}
    ${tot('Total income', {f: F.income, a: B.income})}
    ${sec('Costs <small>type an actual figure to replace the calculated one</small>')}
    ${COSTS.map(([k, label, sub]) => costRow(k, label, k === 'med' ? `${F.medalN} forecast · ${B.medalN} for sold places · £${P.medalPrice} each` : sub)).join('')}
    ${perCompLines('cost').map(l => costRow('x_' + l.id, l.name || 'Other cost', l.basis === 'gymnast' ? 'per gymnast' : 'per competition')).join('')}
    ${tot('Total costs', {f: F.costs, a: B.costs}, false)}
    ${tot('Profit', {f: F.profit, a: B.profit}, true, 'fn-tot fn-net')}
  </tbody></table></div></div>
  <div class="card fn-card"><h2>JustGo events</h2>${evs.length ? evs.map(e => `<div class="row fn-ev"><div class="grow"><b>${esc(e.name)}</b><small>${fmtDate(e.date)} · ${esc(e.ref)} · ${+e.gymnasts || 0} gymnasts, ${+e.spectators || 0} spectators · ${gbp(+e.income || 0)} gross</small></div>${matchSelect(e.ref, c.id)}</div>`).join('')
    : '<p class="empty">No JustGo sales matched to this competition yet. If its event is listed under “JustGo events not in the P&amp;L” on the season page, match it there.</p>'}</div>`;
}

/* ===== Buttons (the shell dispatches [data-act]) ===== */
export const FN = {
  'fn-refresh'(){ S.at = 0; redraw(); },
  'fn-clear'(b){ const o = S.data.actuals.comps[b.dataset.comp] || {}; delete o[b.dataset.k]; saveActual(['comps', b.dataset.comp, b.dataset.k], null); redraw(); },
  'fn-undo'(b){ if (A.over[S.setPath]) delete A.over[S.setPath][b.dataset.k]; saveSettings(); redraw(); },
  'fn-lw-add'(b){ const l = {id: 'a' + Date.now().toString(36), name: '', type: b.dataset.type, amount: 0, basis: 'month'}; A.annual.push(l); saveSettings(); S.refocus = ['data-fa', `annual|${l.id}|name`]; window.NGL_RENDER && window.NGL_RENDER(); },
  'fn-lw-del'(b){ const [src, id] = b.dataset.id.split('|'), arr = src === 'custom' ? A.custom : A.annual, l = arr.find(x => x.id === id);
    if (!confirm(`Remove "${(l && l.name) || 'this line'}"?`)) return;
    if (src === 'custom') A.custom = A.custom.filter(x => x.id !== id); else A.annual = A.annual.filter(x => x.id !== id); saveSettings(); redraw(); }
};

/* ===== Typing (inputs and selects: change events, so nothing redraws mid-number) ===== */
const FOCUS_ATTRS = ['data-fo', 'data-ft', 'data-fs', 'data-fa', 'data-fm'];
function redraw(){
  setTimeout(() => {   // after the browser has moved focus, so the field you tabbed to keeps it
    const a = document.activeElement, at = a && a.closest && a.closest('#fnRoot') && FOCUS_ATTRS.find(k => a.hasAttribute(k));
    S.refocus = at ? [at, a.getAttribute(at)] : S.refocus;
    window.NGL_RENDER && window.NGL_RENDER();
  }, 0);
}
document.addEventListener('ngl:rendered', () => {
  if (!S.refocus || !document.getElementById('fnRoot')) return;
  const [k, v] = S.refocus; S.refocus = null;
  const el = document.querySelector(`#fnRoot [${k}="${CSS.escape(v)}"]`); if (el) el.focus();
});
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
document.addEventListener('change', e => {
  const t = e.target; if (!(t.closest && t.closest('#fnRoot'))) return;
  if (t.id === 'fnSeason') { S.season = t.value; redraw(); return; }
  if (t.id === 'fnSetPath') { S.setPath = t.value; redraw(); return; }
  if (t.dataset.fs) { const k = t.dataset.fs, v = num(t.value);
    if (S.setPath === 'all') A[k] = v;
    else { A.over[S.setPath] = A.over[S.setPath] || {}; if (v === A[k]) delete A.over[S.setPath][k]; else A.over[S.setPath][k] = v; }
    saveSettings(); redraw(); return; }
  if (t.dataset.fo) { const [cid, k] = t.dataset.fo.split('|'), C = S.data.actuals.comps;
    if (t.value === '') { if (C[cid]) delete C[cid][k]; saveActual(['comps', cid, k], null); }
    else { C[cid] = C[cid] || {}; C[cid][k] = num(t.value); saveActual(['comps', cid, k], C[cid][k]); }
    redraw(); return; }
  if (t.dataset.ft) { const k = t.dataset.ft, T = S.data.actuals.targets;
    if (t.value === '') { delete T[k]; saveActual(['targets', k], null); } else { T[k] = num(t.value); saveActual(['targets', k], T[k]); }
    redraw(); return; }
  if (t.dataset.fa) { const [src, id, f] = t.dataset.fa.split('|'), l = (src === 'custom' ? A.custom : A.annual).find(x => x.id === id); if (!l) return;
    l[f] = f === 'amount' ? num(t.value) : t.value; saveSettings(); redraw(); return; }
  if (t.dataset.fm) { const ref = t.dataset.fm; S.data.JG.map = {...(S.data.JG.map || {}), [ref]: t.value}; saveMatch(ref, t.value); redraw(); return; }
});
document.addEventListener('toggle', e => { if (e.target.id === 'fnSettings') S.setOpen = e.target.open; }, true);
// A whole competition row opens its P&L
document.addEventListener('click', e => { const r = e.target.closest && e.target.closest('#fnComps tr[data-comp]'); if (!r || e.target.closest('a')) return; location.hash = '#/admin/finance/' + r.dataset.comp; });
