// NGL Admin · Projected P&L. Club Licences, books and medals: 10-year projection.
// Copied from GYMNASTICS-RESULTS/NGL_Projection.html: the same wording, variables, defaults, maths (model),
// chart, table, CSV and scenarios. Only the look and the data layer change.
// Data: finance/projection, one doc, same shape as the old ngl_finance/projection:
//   {current: 'Base case', scenarios: {'<name>': {firstYear, maxClubs, hosting, growth[10], oncost, orders, postIn, postOut,
//    mktMin, mktPct, paths:{preschool|schools|recreational:{…}}, mm:{…}, roles:[{name, pay[10]}]}}}
// ?demo: scenarios kept in memory on this page; nothing is ever written.
import { MODE } from '../data.js';
import { fb } from '../firebase.js';
import { PATHWAYS } from '../config.js';
import { esc, toast } from '../ui.js';

const DEMO = MODE === 'demo';
const N = 10;
const gbp = n => (n < -0.5 ? "-" : "") + "£" + Math.round(Math.abs(n)).toLocaleString("en-GB");
const num = (n, d=0) => (+n).toLocaleString("en-GB", {minimumFractionDigits:d, maximumFractionDigits:d});
const pct = n => (Math.round(n*1000)/10).toLocaleString("en-GB") + "%";
const $r = s => document.querySelector('#pjRoot ' + s);

// Chart colours (app palette: navy, Performance teal, Recreational orange, red)
const NAVY = '#28225c', TEAL = '#00aeb7', ORANGE = '#e8822f', BAD = '#c6152e', MUTED = '#5f5b80', GRID = '#e4e3ee';
const pc = k => PATHWAYS.find(p => p.k === k).c;
const PATHS = [
  {k:'preschool', name:'Pre-School', c:pc('preschool'), dark:false},
  {k:'schools', name:'Schools', c:pc('schools'), dark:true},
  {k:'recreational', name:'Recreational', c:pc('recreational'), dark:true}
];
/* Default figures (agreed Oct 2026 with Dave) */
function defaults(){
  return {
    firstYear: 2027, maxClubs: 300, hosting: 3000,
    growth: [0, 1, 1, 1, 1, 1, 0.2, 0.2, 0.2, 0.2],
    oncost: 0.16, orders: 3, postIn: 8, postOut: 10, mktMin: 6000, mktPct: 0.03,
    paths: {
      preschool:    {y1:10, share:1,   gyms:50,  fee:400,  disc:0.05, bookPrice:5, bookCost:2.5, buyBook:0.95, booksNew:1, booksYear:0,    stay:2, medalPrice:2, medalCost:1,   medalsPer:10, buyMedal:0.5, poster:15},
      schools:      {y1:10, share:0.3, gyms:200, fee:750,  disc:0.05, bookPrice:5, bookCost:2.5, buyBook:0.95, booksNew:1, booksYear:0,    stay:3, medalPrice:5, medalCost:1.5, medalsPer:1,  buyMedal:0.5, poster:0},
      recreational: {y1:10, share:1,   gyms:300, fee:1250, disc:0,    bookPrice:5, bookCost:2.5, buyBook:0.95, booksNew:0, booksYear:0.75, stay:0, medalPrice:3, medalCost:1.5, medalsPer:3,  buyMedal:0.5, poster:0}
    },
    // Merchandise (Group Buying rebate + NGL t-shirts sold to clubs) and media (competition routine videos), added Nov 2026
    mm: {gbShare:0.3, gbOrders:4, gbSpend:350, gbRebate:0.10, gbMargin:0.10, tsBuy:0.1, tsPrice:12, tsCost:10,
         mGyms:1383, mGrowth:0.1, mTake:0.2, mPrice:15, mCostPer:1, mFixed:500},
    roles: [
      {name:'Dave',                     pay:[24000, 36000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000]},
      {name:'Second member of staff',   pay:[0, 0, 36000, 36000, 36000, 36000, 36000, 36000, 36000, 36000]},
      {name:'Packing (part-time)',      pay:[0, 0, 0, 0, 24000, 24000, 24000, 24000, 24000, 24000]}
    ]
  };
}
const DEF_NAME = "Base case";
let ST = null, LOADED = false, unsub = null, saveTimer = null, lastWrite = 0, noSave = false, varsHidden = false, lastRows = null, saveText = '';
const S = () => ST.scenarios[ST.current];

/* ===== Model (unchanged from NGL_Projection.html) ===== */
function model(D){
  const z = () => Array(N).fill(0), out = {paths:{}, years:[...Array(N)].map((_,t)=>D.firstYear+t)};
  const T = {lic:z(), gyms:z(), licInc:z(), bookInc:z(), medalInc:z(), inc:z(), gp:z()};
  for(const P of PATHS){
    const p = D.paths[P.k], cap = D.maxClubs * p.share, r = {lic:z(), newLic:z(), gyms:z(), newG:z(), books:z(), medals:z(), licInc:z(), bookInc:z(), medalInc:z(), inc:z(), bookCost:z(), medalCost:z(), posterCost:z(), gp:z()};
    for(let t=0;t<N;t++){
      r.lic[t] = t===0 ? Math.min(p.y1, cap) : Math.min(r.lic[t-1]*(1+(+D.growth[t]||0)), cap);
      r.newLic[t] = t===0 ? r.lic[t] : r.lic[t]-r.lic[t-1];
      r.gyms[t] = r.lic[t]*p.gyms;
      r.newG[t] = t===0 ? r.gyms[t] : (r.gyms[t]-r.gyms[t-1]) + (p.stay ? r.gyms[t-1]/p.stay : 0);
      r.books[t] = (r.newG[t]*p.booksNew + r.gyms[t]*p.booksYear) * p.buyBook;
      r.medals[t] = r.gyms[t]*p.buyMedal*p.medalsPer;
      r.licInc[t] = r.lic[t]*p.fee*(1-p.disc);
      r.bookInc[t] = r.books[t]*p.bookPrice;
      r.medalInc[t] = r.medals[t]*p.medalPrice;
      r.inc[t] = r.licInc[t]+r.bookInc[t]+r.medalInc[t];
      r.bookCost[t] = r.books[t]*p.bookCost;
      r.medalCost[t] = r.medals[t]*p.medalCost;
      r.posterCost[t] = r.newLic[t]*p.poster;
      r.gp[t] = r.inc[t]-r.bookCost[t]-r.medalCost[t]-r.posterCost[t];
      for(const k of Object.keys(T)) T[k][t] += r[k][t];
    }
    out.paths[P.k] = r;
  }
  const clubs = z(), postIn = z(), totalInc = z(), staff = z(), post = z(), mkt = z(), host = z(), costs = z(), net = z(), cum = z();
  const mm = D.mm, X = {gbSpend:z(), gbInc:z(), ts:z(), tsInc:z(), tsCost:z(), merchGp:z(), mGyms:z(), vids:z(), mInc:z(), mCost:z(), mediaGp:z(), inc:z(), gp:z()};
  for(let t=0;t<N;t++){
    clubs[t] = Math.max(...PATHS.map(P=>out.paths[P.k].lic[t]));
    X.gbSpend[t] = clubs[t]*mm.gbShare*mm.gbOrders*mm.gbSpend;
    const gbCost = X.gbSpend[t]/(1+(mm.gbMargin||0));   // club spend includes the NGL margin; the rebate is on the supplier price
    X.gbInc[t] = gbCost*mm.gbRebate + (X.gbSpend[t]-gbCost);
    X.ts[t] = T.gyms[t]*mm.tsBuy; X.tsInc[t] = X.ts[t]*mm.tsPrice; X.tsCost[t] = X.ts[t]*mm.tsCost;
    X.merchGp[t] = X.gbInc[t] + X.tsInc[t] - X.tsCost[t];
    X.mGyms[t] = mm.mGyms*Math.pow(1+mm.mGrowth, t); X.vids[t] = X.mGyms[t]*mm.mTake;
    X.mInc[t] = X.vids[t]*mm.mPrice; X.mCost[t] = X.vids[t]*mm.mCostPer + (X.mInc[t] ? mm.mFixed : 0);
    X.mediaGp[t] = X.mInc[t] - X.mCost[t];
    X.inc[t] = X.gbInc[t] + X.tsInc[t] + X.mInc[t]; X.gp[t] = X.merchGp[t] + X.mediaGp[t];
    postIn[t] = T.lic[t]*D.orders*D.postIn;
    totalInc[t] = T.inc[t]+postIn[t]+X.inc[t];
    staff[t] = D.roles.reduce((a,r)=>a+(+r.pay[t]||0),0)*(1+D.oncost);
    post[t] = T.lic[t]*D.orders*D.postOut;
    mkt[t] = Math.max(D.mktMin, totalInc[t]*D.mktPct);
    host[t] = D.hosting;
    costs[t] = staff[t]+post[t]+mkt[t]+host[t];
    net[t] = T.gp[t]+postIn[t]+X.gp[t]-costs[t];
    cum[t] = (t?cum[t-1]:0)+net[t];
  }
  Object.assign(out, {T, X, clubs, postIn, totalInc, staff, post, mkt, host, costs, net, cum});
  return out;
}
const sum = a => a.reduce((x,y)=>x+y,0);

/* ===== Outputs: headline figures, chart, table ===== */
function cardsHtml(M){
  const full = M.net[N-1], tot = sum(M.net), payback = M.cum.findIndex(v=>v>=0);
  const c = (v,k,neg,id) => `<div class="card stat pj-card"><b${id ? ` id="${id}"` : ''}${neg?' class="pj-neg"':''}>${v}</b><span>${k}</span></div>`;
  return c(gbp(sum(M.totalInc)), "Total income over 10 years", false, 'pjInc10') +
    c(gbp(tot), "Net profit over 10 years", tot<0, 'pjNet10') +
    c(gbp(M.net[0]), `Net profit in ${M.years[0]} (year 1)`, M.net[0]<0, 'pjNet1') +
    c(gbp(full), `Net profit in ${M.years[N-1]} (year 10)`, full<0, 'pjNetLast') +
    c(num(M.T.lic[N-1]) + " licences", `${num(M.clubs[N-1])} clubs at least, by ${M.years[N-1]}`, false, 'pjLic') +
    c(payback<0 ? "Not within 10 years" : (payback===0 ? "Year 1" : M.years[payback]), "Cumulative profit turns positive", false, 'pjPayback');
}
function capInfo(D, M){
  const cap = PATHS.reduce((a,P)=>a + D.maxClubs*D.paths[P.k].share, 0);
  const at = M.T.lic.findIndex(v => v >= cap - 1e-6);
  return {cap, at};
}
function niceStep(raw){ const p = Math.pow(10, Math.floor(Math.log10(raw||1))); const f = raw/p; return (f<=1?1:f<=2?2:f<=5?5:10)*p; }
function axisMoney(v){ const a=Math.abs(v); return (v<0?"-":"")+"£"+(a>=1e6?(a/1e6).toLocaleString("en-GB",{maximumFractionDigits:1})+"m":a>=1e3?Math.round(a/1e3)+"k":a); }
function chartHtml(M){
  const D = S(), C = capInfo(D, M);
  let Bm = model(defaults());
  if(Bm.totalInc.every((v,t)=>Math.abs(v-M.totalInc[t])<0.5) && Bm.net.every((v,t)=>Math.abs(v-M.net[t])<0.5)) Bm = null;   // default figures, drawn as outlines for comparison
  const W=1100, H=320, L=70, R=60, Tp=16, B=36, iw=W-L-R, ih=H-Tp-B;
  const maxV = Math.max(1, ...M.totalInc, ...M.net, ...(Bm ? Bm.totalInc : [])), minV = Math.min(0, ...M.net, ...(Bm ? Bm.net : []));
  const step = niceStep((maxV-minV)/5), top = Math.ceil(maxV/step)*step, bot = Math.floor(minV/step)*step;
  const y = v => Tp + ih*(top-v)/(top-bot);
  const maxL = Math.max(1, ...M.T.lic, C.cap), lstep = niceStep(maxL/5), ltop = Math.ceil(maxL/lstep)*lstep;
  const yl = v => Tp + ih*(1 - v/ltop);
  const gw = iw/N, bw = Math.min(34, gw*0.34);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and net profit by year">`;
  for(let v=bot; v<=top+1e-6; v+=step){ s += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="${v===0?'#9a97b8':GRID}"/><text x="${L-8}" y="${y(v)+4}" font-size="12" text-anchor="end" fill="${MUTED}">${axisMoney(v)}</text>`; }
  for(let v=0; v<=ltop+1e-6; v+=lstep) s += `<text x="${W-R+8}" y="${yl(v)+4}" font-size="12" fill="${ORANGE}">${num(v)}</text>`;
  M.years.forEach((yr,t)=>{
    const cx = L + gw*t + gw/2;
    const bar = (v, x, col, lab) => { const y0=y(Math.max(v,0)), h=Math.abs(y(v)-y(0)); return `<rect x="${x}" y="${y0}" width="${bw}" height="${Math.max(h,0.5)}" fill="${col}" rx="2"><title>${yr} ${lab}: ${gbp(v)}</title></rect>`; };
    s += bar(M.totalInc[t], cx-bw-2, NAVY, 'income') + bar(M.net[t], cx+2, M.net[t]<0?BAD:TEAL, 'net profit');
    if(Bm){ const ob = (v, x, lab) => `<rect x="${x}" y="${y(Math.max(v,0))}" width="${bw}" height="${Math.max(Math.abs(y(v)-y(0)),0.5)}" fill="none" stroke="#8a87a8" stroke-width="1.5" stroke-dasharray="4 3" rx="2"><title>${yr} ${lab} with the default figures: ${gbp(v)}</title></rect>`;
      s += ob(Bm.totalInc[t], cx-bw-2, 'income') + ob(Bm.net[t], cx+2, 'net profit'); }
    s += `<text x="${cx}" y="${H-12}" font-size="12" text-anchor="middle" fill="${MUTED}">${yr}</text>`;
  });
  s += `<line x1="${L}" x2="${W-R}" y1="${yl(C.cap)}" y2="${yl(C.cap)}" stroke="${ORANGE}" stroke-width="1.5" stroke-dasharray="6 5" opacity=".8"/><text x="${W-R-6}" y="${yl(C.cap)-6}" font-size="12" text-anchor="end" fill="#a65a00">Licence cap: ${num(C.cap)}</text>`;
  s += `<polyline fill="none" stroke="${ORANGE}" stroke-width="3" points="${M.T.lic.map((v,t)=>`${L+gw*t+gw/2},${yl(v)}`).join(' ')}"/>`;
  M.T.lic.forEach((v,t)=>{ s += `<circle cx="${L+gw*t+gw/2}" cy="${yl(v)}" r="4" fill="${ORANGE}"><title>${M.years[t]}: ${num(v)} licences</title></circle>`; });
  s += `</svg>`;
  const capTxt = C.at >= 0 && C.at < N-1
    ? `Licences reach the cap in ${M.years[C.at]}: ${num(D.maxClubs)} clubs × each pathway’s share = ${num(C.cap)} licences. From then on licences stay flat, so the growth figures for ${M.years[C.at+1]}–${M.years[N-1]} have no effect. To keep growing, raise “Most clubs NGL expects to sign up” or a pathway’s “Share of clubs”.`
    : C.at === N-1 ? `Licences reach the cap of ${num(C.cap)} in ${M.years[N-1]}.` : `Licences stay under the cap of ${num(C.cap)} for all ten years.`;
  const growth = C.at >= 0 && C.at < N-1 ? `Licences hit the cap in ${M.years[C.at]}, so growth after that year has no effect.` : '';
  return {svg: s, cap: esc(capTxt) + (Bm ? ` <span class="pj-ghost">Dashed outlines show the default figures, for comparison.</span>` : ''), growth};
}

function tableRows(M){
  const D = S(), rows = [];
  const R = (label, arr, opt={}) => rows.push({label, arr, ...opt});
  for(const P of PATHS){
    const r = M.paths[P.k];
    rows.push({band:P});
    R('Licences', r.lic, {fmt:'n1', total:false});
    R('New licences this year', r.newLic, {fmt:'n1', sub:true, cls:'i'});
    R('Gymnasts', r.gyms, {fmt:'n', total:false});
    R('New gymnasts (growth and replacing leavers)', r.newG, {fmt:'n', sub:true, cls:'i'});
    R('Books sold', r.books, {fmt:'n'}); R('Medals sold', r.medals, {fmt:'n'});
    R('Club Licence fees', r.licInc); R('Book sales', r.bookInc); R('Medal sales', r.medalInc);
    R('Income', r.inc, {cls:'b t'});
    R('Book costs', r.bookCost.map(v=>-v)); R('Medal costs', r.medalCost.map(v=>-v));
    if(sum(r.posterCost)) R('Posters for new clubs', r.posterCost.map(v=>-v));
    R(`${P.name} profit`, r.gp, {cls:'b t'});
  }
  rows.push({band:{name:'Merchandise and media', c:'var(--red)'}});
  R('Group Buying: what clubs spend', M.X.gbSpend, {sub:true, cls:'i', total:true});
  R('Group Buying rebate and margin', M.X.gbInc);
  R('NGL t-shirts sold to clubs', M.X.ts, {fmt:'n'});
  R('NGL t-shirt sales', M.X.tsInc); R('NGL t-shirt costs', M.X.tsCost.map(v=>-v));
  R('Merchandise profit', M.X.merchGp, {cls:'b t'});
  R('Competing gymnasts', M.X.mGyms, {fmt:'n', total:false});
  R('Routine video packs sold', M.X.vids, {fmt:'n'});
  R('Media sales', M.X.mInc); R('Media costs (delivery, storage, kit)', M.X.mCost.map(v=>-v));
  R('Media profit', M.X.mediaGp, {cls:'b t'});
  rows.push({band:{name:'All pathways', c:'var(--navy)'}});
  R('Licences (all three pathways)', M.T.lic, {fmt:'n1', total:false});
  R('Clubs, at least', M.clubs, {fmt:'n1', total:false, cls:'i'});
  R('Gymnasts', M.T.gyms, {fmt:'n', total:false});
  R('Club Licence fees', M.T.licInc); R('Book sales', M.T.bookInc); R('Medal sales', M.T.medalInc);
  R('Postage charged to clubs', M.postIn);
  R('Merchandise and media income', M.X.inc);
  R('Total income', M.totalInc, {cls:'b t'});
  R('Profit from licences, books and medals', M.T.gp);
  R('Profit from merchandise and media', M.X.gp);
  rows.push({head:'Running costs'});
  D.roles.forEach(ro => R(`Salary: ${ro.name}`, ro.pay.map(v=>-(+v||0)), {sub:true, cls:'i'}));
  R('Staff costs (salaries and on-costs)', M.staff.map(v=>-v));
  R('Postage and packing', M.post.map(v=>-v));
  R('Marketing', M.mkt.map(v=>-v));
  R('Hub, hosting and admin', M.host.map(v=>-v));
  R('Total running costs', M.costs.map(v=>-v), {cls:'b t'});
  R('NET PROFIT', M.net, {cls:'net'});
  R('Net margin', M.net.map((v,t)=>M.totalInc[t]?v/M.totalInc[t]:0), {fmt:'pct', totalVal: sum(M.totalInc)?sum(M.net)/sum(M.totalInc):0});
  R('Cumulative net profit', M.cum, {cls:'b', total:false});
  return rows;
}
function tableHtml(M){
  const rows = tableRows(M);
  const f = (v, fmt) => fmt==='n1' ? num(v,1) : fmt==='n' ? num(v) : fmt==='pct' ? pct(v) : (Math.abs(v) < 0.5 ? '–' : gbp(v));
  let h = `<thead><tr><th>£</th>${M.years.map(y=>`<th>${y}</th>`).join('')}<th class="tot">10 years</th></tr></thead><tbody>`;
  for(const r of rows){
    if(r.band){ h += `<tr class="band${r.band.dark?' dark':''}" style="--c:${r.band.c}"><td>${esc(r.band.name.toUpperCase())}</td>${'<td></td>'.repeat(N+1)}</tr>`; continue; }
    if(r.head){ h += `<tr class="b hd"><td>${esc(r.head)}</td>${'<td></td>'.repeat(N+1)}</tr>`; continue; }
    const tv = r.totalVal !== undefined ? r.totalVal : (r.total===false ? null : sum(r.arr));
    const money = !r.fmt;
    h += `<tr class="${r.cls||''}${r.sub?' sub':''}"><td>${esc(r.label)}</td>${r.arr.map(v=>`<td class="${money&&v<-0.5?'neg':''}">${f(v,r.fmt)}</td>`).join('')}<td class="tot ${money&&tv<-0.5?'neg':''}">${tv===null?'':f(tv,r.fmt)}</td></tr>`;
  }
  lastRows = {rows, years:M.years};
  return h + '</tbody>';
}

/* ===== Variables ===== */
const PV = [
  ['y1', 'Licences in year 1', 'n', ''],
  ['share', 'Share of clubs running this pathway', 'pct', 'Licences stop growing at this share of the most clubs'],
  ['gyms', 'Gymnasts per licence', 'n', ''],
  ['fee', 'Club Licence fee per year', 'gbp', 'Band for that number of gymnasts'],
  ['disc', 'Multi-pathway discount', 'pct', '5% off every licence except the club’s dearest'],
  ['bookPrice', 'Book: price to clubs', 'gbp', ''],
  ['bookCost', 'Book: cost to NGL', 'gbp', 'Print cost'],
  ['buyBook', 'Gymnasts who buy the book', 'pct', ''],
  ['booksNew', 'Books per new gymnast', 'n', 'Schools and Pre-School: 1 for their time'],
  ['booksYear', 'Books per gymnast per year', 'n', 'Recreational: 1 every 4 terms = 0.75'],
  ['stay', 'Average years a gymnast stays', 'n', 'Sets how many new gymnasts join each year (0 = not used)'],
  ['medalPrice', 'Medal: price to clubs', 'gbp', ''],
  ['medalCost', 'Medal: cost to NGL', 'gbp', ''],
  ['medalsPer', 'Medals per gymnast per year', 'n', ''],
  ['buyMedal', 'Gymnasts who buy medals', 'pct', ''],
  ['poster', 'A1 poster per new licence (cost)', 'gbp', 'Pre-School only']
];
const MV = [
  ['gbShare', 'Group Buying: share of clubs ordering', 'pct', 'Of licensed clubs, each order round'],
  ['gbOrders', 'Group Buying: order rounds per year', 'n', 'Quarterly = 4'],
  ['gbSpend', 'Group Buying: average club spend per round', 'gbp', 'Garments, before VAT'],
  ['gbRebate', 'Group Buying: supplier rebate', 'pct', 'Agreed 10% on all clothing'],
  ['gbMargin', 'Group Buying: NGL margin on supplier price', 'pct', '10% added to the t-shirt and quarter zip prices'],
  ['tsBuy', 'NGL t-shirts: share of gymnasts buying a year', 'pct', ''],
  ['tsPrice', 'NGL t-shirt: price to clubs', 'gbp', ''],
  ['tsCost', 'NGL t-shirt: cost to NGL', 'gbp', ''],
  ['mGyms', 'Media: competing gymnasts in year 1', 'n', '2027 bookings: 1,383 places'],
  ['mGrowth', 'Media: yearly growth in gymnasts', 'pct', ''],
  ['mTake', 'Media: families who buy the video pack', 'pct', ''],
  ['mPrice', 'Media: price per gymnast per competition', 'gbp', 'Floor (and beam where filmed)'],
  ['mCostPer', 'Media: cost per pack', 'gbp', 'Clip cutting, storage, delivery'],
  ['mFixed', 'Media: fixed cost per year', 'gbp', 'Cameras, storage plan']
];
const GV = [
  ['firstYear', 'First licence year', 'yr', 'Licence year from September'],
  ['maxClubs', 'Most clubs NGL expects to sign up', 'n', 'BG lists about 1,000 clubs across all disciplines'],
  ['hosting', 'Hub, hosting and admin per year', 'gbp', 'Firebase, domains, Squarespace, Brevo, Workspace, accounts, insurance']
];
const CV = [
  ['oncost', 'Employer on-costs on salaries', 'pct', 'National Insurance and pension'],
  ['orders', 'Supply orders per licence per year', 'n', 'One a term'],
  ['postIn', 'Postage charged to the club per order', 'gbp', 'Hub scale: £4 / £8 / £12'],
  ['postOut', 'Postage and packing cost per order', 'gbp', 'Courier parcel plus box'],
  ['mktMin', 'Marketing: minimum per year', 'gbp', ''],
  ['mktPct', 'Marketing: share of income', 'pct', 'Spend whichever is larger']
];
function inp(path, val, kind, label){
  const shown = kind==='pct' ? +(val*100).toFixed(4) : val;
  const step = kind==='pct' ? 1 : kind==='gbp' ? 0.5 : kind==='yr' ? 1 : 0.05;
  const box = `<input class="pj-num" type="number" inputmode="decimal" step="${step}" data-path="${path}" data-kind="${kind}" value="${shown}" aria-label="${esc(label)}">`;
  return kind==='gbp' ? `<span class="pj-unit pre"><span>£</span>${box}</span>` : kind==='pct' ? `<span class="pj-unit suf">${box}<span>%</span></span>` : box;
}
function varsHtml(growth = ''){
  const D = S();
  const lab = (l, n) => `${esc(l)}${n?`<small>${esc(n)}</small>`:''}`;
  const simple = (list, pre = '', src = D) => list.map(([k,l,kind,n])=>`<div class="pj-vrow"><label>${lab(l, n)}</label>${inp(pre + k, src[k], kind, l)}</div>`).join('');
  let h = `<div class="pj-vgrid"><div class="pj-vbox"><h3>General</h3>${simple(GV)}</div><div class="pj-vbox"><h3>Running costs</h3>${simple(CV)}</div></div>`;
  h += `<div class="pj-vbox"><h3>Merchandise and media</h3><div class="pj-vgrid in">${simple(MV, 'mm.', D.mm)}</div></div>`;
  h += `<div class="pj-vbox"><h3>Licence growth on the year before</h3><div class="pj-yrs"><table class="pj-vt"><thead><tr><th></th>${[...Array(N)].map((_,t)=>`<th>${D.firstYear+t}</th>`).join('')}</tr></thead><tbody><tr><td class="lab">Growth<small>100% = doubles</small></td>${D.growth.map((g,t)=>`<td>${t===0?'<span class="pj-hint">start</span>':inp(`growth.${t}`, g, 'pct', `Growth ${D.firstYear+t}`)}</td>`).join('')}</tr></tbody></table></div><p id="pjGrowthNote" class="pj-capnote warn">${esc(growth)}</p></div>`;
  h += `<div class="pj-vbox"><h3>Per pathway</h3><div class="pj-yrs"><table class="pj-vt"><thead><tr><th></th>${PATHS.map(P=>`<th class="p${P.dark?' dark':''}" style="background:${P.c}">${P.name}</th>`).join('')}</tr></thead><tbody>` +
    PV.map(([k,l,kind,n])=>`<tr><td class="lab">${lab(l, n)}</td>${PATHS.map(P=>`<td>${inp(`paths.${P.k}.${k}`, D.paths[P.k][k], kind, `${P.name}: ${l}`)}</td>`).join('')}</tr>`).join('') + `</tbody></table></div></div>`;
  h += `<div class="pj-vbox"><h3>Staff salaries by year</h3><div class="pj-yrs"><table class="pj-vt"><thead><tr><th>Role</th>${[...Array(N)].map((_,t)=>`<th>${D.firstYear+t}</th>`).join('')}<th></th></tr></thead><tbody>` +
    D.roles.map((r,i)=>`<tr><td class="lab"><input class="pj-role" data-role="${i}" value="${esc(r.name)}" aria-label="Role name"></td>${r.pay.map((v,t)=>`<td>${inp(`roles.${i}.pay.${t}`, v, 'gbp', `${r.name} ${D.firstYear+t}`)}</td>`).join('')}<td><button class="btn sm ghost pj-x" data-act="pj-del-role" data-i="${i}" title="Remove this role" aria-label="Remove ${esc(r.name)}">&#x2715;</button></td></tr>`).join('') +
    `</tbody></table></div><div class="btn-row pj-addrole"><button class="btn sm ghost" data-act="pj-add-role">Add a role</button> <span class="pj-hint">Employer on-costs are added on top.</span></div></div>`;
  return h;
}
function setPath(obj, path, v){ const ks = path.split('.'); let o = obj; for(let i=0;i<ks.length-1;i++) o = o[ks[i]]; o[ks[ks.length-1]] = v; }

/* ===== Scenarios ===== */
const scenOptions = () => Object.keys(ST.scenarios).map(n=>`<option${n===ST.current?' selected':''}>${esc(n)}</option>`).join('');

/* ===== Save / load ===== */
function normalise(st){
  const d = defaults();
  if(!st || !st.scenarios || !Object.keys(st.scenarios).length) return {current: DEF_NAME, scenarios: {[DEF_NAME]: d}};
  for(const [n, sc] of Object.entries(st.scenarios)){
    const m = Object.assign(defaults(), sc);
    m.paths = {}; for(const P of PATHS) m.paths[P.k] = Object.assign({}, d.paths[P.k], (sc.paths||{})[P.k]);
    m.mm = Object.assign({}, d.mm, sc.mm||{});
    m.growth = [...Array(N)].map((_,t)=> (sc.growth||[])[t] ?? d.growth[t]);
    m.roles = (sc.roles || d.roles).map(r=>({name:r.name||'Role', pay:[...Array(N)].map((_,t)=> +((r.pay||[])[t]||0))}));
    st.scenarios[n] = m;
  }
  if(!st.scenarios[st.current]) st.current = Object.keys(st.scenarios)[0];
  return st;
}
const setSave = t => { saveText = t; const el = document.getElementById('pjSaveState'); if (el) el.textContent = t; };
function save(){
  setSave("Saving…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    if(DEMO){ setSave("Saved (demo)"); return; }
    if(noSave){ setSave("Not saved"); toast("Couldn’t load saved scenarios (needs Finance access).", false); return; }
    try{ lastWrite = Date.now(); const {fs, D: db} = await fb(); await fs.setDoc(fs.doc(db, 'finance', 'projection'), JSON.parse(JSON.stringify(ST))); setSave("Saved"); }
    catch(err){ console.error(err); setSave("Not saved"); toast(err.code==="permission-denied" ? "The database blocked saving: this needs Finance access." : "Couldn’t save. Check your connection.", false); }
  }, 600);
}
async function load(){
  if (LOADED) return;
  if (DEMO) { ST = normalise(null); LOADED = true; return; }
  try {
    const {fs, D: db} = await fb(), ref = fs.doc(db, 'finance', 'projection');
    await new Promise((res, rej) => { let first = true;
      unsub = fs.onSnapshot(ref, snap => {
        if (first) { first = false; ST = normalise(snap.exists() ? snap.data() : null); LOADED = true; noSave = false; res(); if (!snap.exists()) save(); return; }
        if (!document.getElementById('pjRoot')) { unsub && unsub(); unsub = null; LOADED = false; return; }   // left the screen: stop listening, load fresh next time
        if (snap.metadata.hasPendingWrites || Date.now()-lastWrite < 1500) return;
        const a = document.activeElement; if (snap.exists() && a && a.closest && a.closest('#pjVars')) return;   // don't redraw while someone is typing
        ST = normalise(snap.exists() ? snap.data() : null); renderAll();
      }, err => { if (first) { first = false; rej(err); } else console.error(err); });
    });
  } catch (err) {
    console.error(err); toast("Couldn’t load saved scenarios (needs Finance access).", false);
    ST = normalise(null); noSave = true;   // show the default figures, but never save over scenarios we couldn't read
  }
}

/* ===== Drawing (outputs redraw as you type; the variables only when needed) ===== */
function renderOut(){
  if (!document.getElementById('pjRoot')) return;
  const M = model(S()), C = chartHtml(M);
  $r('#pjCards').innerHTML = cardsHtml(M);
  $r('#pjChart').innerHTML = C.svg; $r('#pjCapNote').innerHTML = C.cap;
  const g = $r('#pjGrowthNote'); if (g) g.textContent = C.growth;
  $r('#pjPl').innerHTML = tableHtml(M);
}
function renderVars(){
  if (!document.getElementById('pjRoot')) return;
  const a = document.activeElement, keep = a && a.closest && a.closest('#pjVars') && (a.dataset.path ? `[data-path="${a.dataset.path}"]` : a.dataset.role !== undefined ? `[data-role="${a.dataset.role}"]` : null);
  $r('#pjVars').innerHTML = varsHtml(chartHtml(model(S())).growth);
  if (keep) { const el = $r('#pjVars ' + keep); if (el) el.focus(); }
}
function renderScen(){
  const s = $r('#pjScen'); if (!s) return;
  s.innerHTML = scenOptions();
  const d = $r('[data-act="pj-del"]'); d.disabled = Object.keys(ST.scenarios).length < 2;
}
function renderAll(){ renderScen(); renderVars(); renderOut(); }

/* ===== Screen ===== */
export default async function projection(me, parts = []){
  await load();
  const M = model(S()), C = chartHtml(M), n = Object.keys(ST.scenarios).length;
  return `<div id="pjRoot" class="pj-root">
  ${DEMO ? '<p class="note">Sample data: scenarios you save stay on this page and aren’t saved to the database.</p>' : ''}
  <div class="card pj-bar">
    <label class="field pj-scen"><span>Scenario</span><select id="pjScen" aria-label="Scenario">${scenOptions()}</select></label>
    <label class="field pj-new"><span>New scenario name</span><input id="pjNewName" placeholder="New scenario name" aria-label="New scenario name" autocomplete="off"></label>
    <div class="pj-barbtns"><button class="btn sm" data-act="pj-save-as">Save as new</button><button class="btn sm ghost" data-act="pj-del"${n < 2 ? ' disabled' : ''}>Delete</button>
    <span id="pjSaveState" class="pj-save" aria-live="polite">${esc(saveText)}</span></div>
    <a class="btn sm ghost pj-live" href="#/admin/finance">← NGL P&amp;L</a>
  </div>
  <h2 class="pj-h">Projected P&amp;L</h2>
  <p class="lead pj-sub">Club Licences, books and medals: 10-year projection</p>
  <p class="lead">Change any yellow box under <b>Variables</b> and every figure updates straight away. Scenarios are saved for everyone with Finance access.</p>
  <div class="pj-cards" id="pjCards">${cardsHtml(M)}</div>
  <div class="card pj-card-p"><div class="pj-ph"><h2>Income and net profit by year</h2></div>
    <div class="pj-chartwrap"><div id="pjChart" class="pj-chart">${C.svg}</div></div><p id="pjCapNote" class="pj-capnote">${C.cap}</p>
    <div class="pj-legend"><span><i style="background:${NAVY}"></i>Total income</span><span><i style="background:${TEAL}"></i>Net profit</span><span><i class="ln" style="background:${ORANGE}"></i>Licences (right scale)</span></div></div>
  <div class="card pj-card-p"><div class="pj-ph"><h2>Variables</h2><button class="btn sm ghost" data-act="pj-reset">Reset this scenario to the default figures</button><button class="btn sm ghost" data-act="pj-toggle">${varsHidden ? 'Show' : 'Hide'}</button></div>
    <div id="pjVars" class="pj-vars"${varsHidden ? ' hidden' : ''}>${varsHtml(C.growth)}</div></div>
  <div class="card pj-card-p"><div class="pj-ph"><h2>10-year P&amp;L</h2><button class="btn sm ghost" data-act="pj-csv">Export CSV</button></div>
    <div class="pj-wrap"><table class="pj-pl" id="pjPl">${tableHtml(M)}</table></div>
    <p class="pj-hint">Licences grow by the yearly growth rate until they reach the most clubs expected times the share of clubs running each pathway. One club can hold licences in several pathways. Schools and Pre-School gymnasts buy one book for their time (new gymnasts each year = growth plus replacing leavers); Recreational gymnasts buy one every 4 terms. Postage is charged to clubs on each supply order; the cost of posting is a running cost. Pre-School Lesson Plan Packs and the Seasonal Pack are not included. NGL is not VAT registered.</p></div>
</div>`;
}

/* ===== Buttons (the shell dispatches [data-act]) ===== */
let delTimer = null;
export const PJ = {
  'pj-toggle'(b){ varsHidden = !varsHidden; $r('#pjVars').hidden = varsHidden; b.textContent = varsHidden ? "Show" : "Hide"; },
  'pj-reset'(){ ST.scenarios[ST.current] = defaults(); renderAll(); save(); toast("Reset to the default figures"); },
  'pj-add-role'(){ S().roles.push({name:'New role', pay:Array(N).fill(0)}); renderVars(); renderOut(); save(); },
  'pj-del-role'(b){ S().roles.splice(+b.dataset.i, 1); renderVars(); renderOut(); save(); },
  'pj-save-as'(){
    const box = $r('#pjNewName'), n = box.value.trim();
    if(!n){ toast("Type a name for the new scenario first", false); box.focus(); return; }
    if(ST.scenarios[n]){ toast("A scenario with that name already exists", false); return; }
    ST.scenarios[n] = JSON.parse(JSON.stringify(S())); ST.current = n; box.value = '';
    renderAll(); save(); toast(`Saved as “${n}”`);
  },
  'pj-del'(btn){
    if(Object.keys(ST.scenarios).length < 2) return;
    if(btn.dataset.confirm !== ST.current){ btn.dataset.confirm = ST.current; btn.textContent = "Tap again to delete"; clearTimeout(delTimer); delTimer = setTimeout(()=>{ btn.dataset.confirm=''; btn.textContent='Delete'; }, 3000); return; }
    clearTimeout(delTimer); delete ST.scenarios[ST.current]; ST.current = Object.keys(ST.scenarios)[0]; btn.dataset.confirm=''; btn.textContent='Delete';
    renderAll(); save();
  },
  'pj-csv'(){
    if(!lastRows) return;
    const q = v => '"' + String(v).replace(/"/g,'""') + '"';
    const out = [[ST.current, ...lastRows.years, '10 years'].map(q).join(',')];
    for(const r of lastRows.rows){
      if(r.band){ out.push(q(r.band.name)); continue; }
      if(r.head){ out.push(q(r.head)); continue; }
      const tv = r.totalVal !== undefined ? r.totalVal : (r.total===false ? '' : sum(r.arr));
      const fx = v => v==='' ? '' : (r.fmt==='pct' ? (v*100).toFixed(1)+'%' : (r.fmt==='n1' ? v.toFixed(1) : Math.round(v)));
      out.push([q(r.label), ...r.arr.map(fx), fx(tv)].join(','));
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.join('\n')], {type:'text/csv'}));
    a.download = `NGL-Projected-PnL-${ST.current.replace(/[^\w-]+/g,'-')}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }
};

/* ===== Typing: every figure updates as you type (the variables themselves are not redrawn) ===== */
document.addEventListener('input', e => {
  const t = e.target; if (!(t.closest && t.closest('#pjVars')) || !ST) return;
  const D = S();
  if(t.dataset.role !== undefined){ D.roles[+t.dataset.role].name = t.value; renderOut(); save(); return; }
  if(!t.dataset.path) return;
  let v = parseFloat(t.value); if(isNaN(v)) v = 0;
  if(t.dataset.kind === 'pct') v = v/100;
  setPath(D, t.dataset.path, v);
  renderOut(); save();
});
document.addEventListener('change', e => {
  const t = e.target; if (!(t.closest && t.closest('#pjRoot')) || !ST) return;
  if (t.id === 'pjScen') { ST.current = t.value; renderAll(); save(); return; }
  if (t.dataset.path === 'firstYear') renderVars();   // the year headings in the variables
});
