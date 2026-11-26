// NGL Admin · Group purchasing. The admin part of GYMNASTICS-RESULTS/ngl-group-order.html (?admin=1), copied word for word:
// the same products, bands, minimum, VAT, set-up and delivery fees, order rounds (close on the last day of Feb, May, Aug, Nov),
// countdown and live order board, supplier totals by product, colour and size, every order, the two CSV downloads, and
// "After the order closes": final prices, one invoice per club, Mark paid, Send to printer. Only the shell, look and data layer changed.
// Data (same names as the old saadi-rotation collections, now in the staging database):
//   ngl_groupbuy_orders/{auto id}            one order per club per product (the club's Shop writes these; this screen reads and updates status)
//   ngl_groupbuy_rounds/{round}_{product}    live totals {shirts, orders, updatedAt} for the order board
//   Storage groupbuy/{round}/{order id}/front-logo.* and back-logo.*
// Emails (EmailJS, same service as the live hubs): in the sandbox, invoices go to the signed-in admin instead of the club,
// with [SANDBOX TEST] in the subject, and nothing is emailed to the printer. ?demo: sample data in memory; nothing is written or emailed.
import { fb } from '../firebase.js';
import { MODE } from '../data.js';
import { ENV, EMAILJS } from '../config.js';
import { esc, toast } from '../ui.js';

const DEMO = MODE === 'demo', SANDBOX = ENV !== 'live';
const OLD = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/';

/* ======================= SETTINGS: change products, prices and bands here (copied from ngl-group-order.html) ======================= */
// Each product has its own bands: price per item (front logo included) by the TOTAL number of that
// product ordered by all clubs in the round. price: null shows "£TBC". The first band is the starting
// price, the most anyone can pay.
export const PRODUCTS = [
  { id:'JC001', name:'Staff T-shirt', full:'NGL Staff T-shirt · AWDis Cool T (JC001)', unit:'shirt', units:'shirts', shape:'tee',
    blurb:'Sports style · your club logo',
    points:['Lightweight, quick-drying sports fabric','<b>Included:</b> your club logo on the front, left chest','<b>Optional extra:</b> two lines of text or a logo across the back','Adult sizes XS to 5XL, and children’s sizes 3/4 to 12/13 (no VAT on children’s sizes)', 'All 52 AWDis Cool T colours'],
    photo:OLD + 'images/groupbuy/ngl-tshirt-front-back.jpg', caption:'Example: front logo position, and two lines on the back',
    bands:[{from:1,price:8.20},{from:100,price:7.36},{from:200,price:6.31},{from:500,price:5.45}],   // supplier 7.45 / 6.69 / 5.74 / 4.95 plus 10% NGL margin (Nov 2026)
    backPrice:{text:2.00, logo:2.65}, sleevePrice:null, sleeve:false,
    sizes:['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],
    kidsSizes:['3/4','5/6','7/8','9/11','12/13'],   // children's Cool T (JC001J), same price, no VAT
    colourHint:'All 52 colours. Click a colour to see the real shirt.',
    // [name, swatch colour, second colour (two-tone), maker's colour code for the product photos]
    img: (code, side) => `https://catalogue.fullcollection.com/storage/phoenix/2026/Phoenix%20All%20Images/Just%20Cool/Product%20Images/JC001/ProductCarouselMain/JC001%20${code}%20${side}.jpg`,
    colours:[
      ['French Navy', '#0d1626', null, 'FNA'],['Jet Black', '#171c21', null, 'JBK'],['Arctic White', '#ffffff', null, 'ACW'],['Desert Sand', '#c8b48a', null, 'DSN'],
      ['Vanilla', '#f0e8d6', null, 'VAN'],['Hawaiian Blue', '#2fb8d9', null, 'HWB'],['Sky Blue', '#8bd8eb', null, 'SKY'],['Airforce Blue', '#31637f', null, 'AIR'],
      ['Seafoam', '#61bbaa', null, 'SEF'],['Ink Blue', '#173f61', null, 'IKB'],['Reflex Blue', '#0034cd', null, 'RBL'],['Oxford Navy', '#141c3c', null, 'OXN'],
      ['Royal Blue', '#1f4fd0', null, 'ROY'],['Cornflower', '#49a9ed', null, 'COR'],['Sapphire Blue', '#1e9fe0', null, 'SAP'],['Turquoise Blue', '#14b3c4', null, 'TUR'],
      ['Digital Lavender', '#9a90f0', null, 'DTL'],['Magenta Magic', '#a03cc8', null, 'MMG'],['Plum', '#4a1f4f', null, 'PLU'],['Purple', '#4b2a8c', null, 'PUR'],
      ['Melon Green', '#b7eda4', null, 'MEL'],['Mint', '#9ef5d9', null, 'MIN'],['Sour Green', '#3ee8a0', null, 'SOU'],['Earthy Green', '#476240', null, 'ERG'],
      ['Jade', '#059967', null, 'JAD'],['Bottle Green', '#0f3d1f', null, 'BOT'],['Kelly Green', '#1fa22e', null, 'KEL'],['Lime Green', '#8ee000', null, 'LIM'],
      ['Combat Green', '#3b4a2e', null, 'CBG'],['Olive Green', '#5b5a2e', null, 'OLI'],['Citrus', '#c2fa0f', null, 'CIT'],['Electric Green', '#7dff26', null, 'ELG'],
      ['Ash', '#e1e6e1', null, 'ASH'],['Charcoal', '#3a3f44', null, 'CHA'],['Heather Grey', '#9ca6a6', null, 'HEA'],['Hot Chocolate', '#3e2723', null, 'HOC'],
      ['Fire Red', '#e0102e', null, 'FIR'],['Red Hot Chilli', '#a3142e', null, 'RHC'],['Burgundy', '#6e1d2e', null, 'BUR'],['Baby Pink', '#ffc2e6', null, 'BPI'],
      ['Dusty Pink', '#ce6ead', null, 'DYP'],['Hot Pink', '#f02aa8', null, 'HPK'],['Hyper Pink', '#ff12ff', null, 'HYP'],['Electric Pink', '#ff47ff', null, 'EPI'],
      ['Peach Sorbet', '#ff8791', null, 'PES'],['Orange Crush', '#ff6308', null, 'OCR'],['Orange Flame', '#ff3b24', null, 'ORF'],['Electric Orange', '#ff6600', null, 'EOR'],
      ['Sherbet Lemon', '#fff25c', null, 'SHL'],['Sun Yellow', '#ffe000', null, 'SNY'],['Gold', '#ff9600', null, 'GOL'],['Electric Yellow', '#cffa03', null, 'EYL']] },
  { id:'LV874', name:'Quarter Zip', full:'NGL Staff Quarter Zip · Finden + Hales LV874', unit:'quarter zip', units:'quarter zips', shape:'zip',
    blurb:'Long sleeve · your club logo',
    points:['Warm, smart quarter-zip sweatshirt','<b>Included:</b> your club logo on the front, left chest','<b>Optional extras:</b> two lines of text or a logo across the back, and a line of text down the left sleeve','Adult sizes XXS to 3XL (chest 32 to 52 inches)'],
    photo:OLD + 'images/groupbuy/ngl-quarter-zip-side-front-back.jpg', caption:'Example: sleeve text, front logo position, and the back',
    bands:[{from:1,price:19.20},{from:100,price:18.36},{from:200,price:17.31},{from:500,price:16.45}],   // supplier 17.45 / 16.69 / 15.74 / 14.95 plus 10% NGL margin (Nov 2026)
    backPrice:{text:2.00, logo:2.65}, sleevePrice:2.65, sleeve:true,
    sizes:['XXS','XS','S','M','L','XL','XXL','3XL'],
    chest:{XXS:'32/34',XS:'34/36',S:'36/38',M:'38/40',L:'42',XL:'44/46',XXL:'48','3XL':'50/52'},   // chest to fit, inches
    colourHint:'Finden + Hales LV874. Click a colour to see the real top.',
    img: (code, side) => `https://catalogue.fullcollection.com/storage/phoenix/2026/Phoenix%20All%20Images/Finden%20%26%20Hales/Product%20Images/LV874/ProductCarouselMain/LV874%20${code}%20${side}.jpg`,
    colours:[
      ['Black', '#000000', null, 'BLK'],['Black/Emerald', '#000000', '#1c8b38', 'BK%252fEM'],['Black/Gold', '#000000', '#ffa312', 'BK%252fGO'],['Black/Gunmetal', '#000000', '#445156', 'BK%252fGT'],
      ['Black/Red', '#000000', '#f5002f', 'BK%252fRD'],['Black/White', '#000000', '#ffffff', 'BK%252fWH'],['Navy', '#0c184a', null, 'NAV'],['Navy/Royal Blue', '#0c184a', '#0746d9', 'NV%252fRY'],
      ['Navy/Sky Blue', '#0c184a', '#75cfff', 'NV%252fSK'],['Navy/White', '#0c184a', '#ffffff', 'NV%252fWH'],['Burgundy', '#8b2332', null, 'BG_BG']] }
];
export const MIN_TOTAL = 50;      // each product's order goes ahead once all clubs together reach this many
export const VAT_RATE = 0.20;     // on adult garments, and the adult share of set-up and delivery; children's sizes are zero-rated
export const SETUP_FEE = 25;      // one-off logo set-up per club, first order only
export const DELIVERY_FEE = 20;   // delivery to each club, once per club per order round
export const CLOSE_MONTHS = [2,5,8,11];  // orders close on the last day of Feb, May, Aug and Nov at 11:59pm
/* ================================================================================================ */

const money = p => p == null ? '£TBC' : '£' + Number(p).toFixed(2);
const fmtDate = d => d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
const prodOf = id => PRODUCTS.find(p => p.id === id) || PRODUCTS[0];
const plural = (p, n) => n === 1 ? p.unit : p.units;
const allSizes = p => p.sizes.concat(p.kidsSizes || []);
const isKid = (p, z) => (p.kidsSizes || []).includes(z);

/* ---------- order rounds ---------- */
function closeOf(y, m){ return new Date(y, m, 0, 23, 59, 59); }   // last day of month m (1-12)
export function roundFor(now = new Date()){
  for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++)
    for (const m of CLOSE_MONTHS){ const c = closeOf(y, m); if (c >= now) return { id:`${y}-${String(m).padStart(2,'0')}`, close:c }; }
}
function roundsAround(n = 4){   // the next round, the open one and earlier ones, for the admin list
  const out = []; let r = roundFor(); out.push(roundFor(new Date(r.close.getTime() + 1000)), r);
  for (let i = 0; i < n; i++){ const [y, m] = r.id.split('-').map(Number); const pm = CLOSE_MONTHS[(CLOSE_MONTHS.indexOf(m) + 3) % 4]; const py = pm > m ? y - 1 : y;
    r = { id:`${py}-${String(pm).padStart(2,'0')}`, close:closeOf(py, pm) }; out.push(r); }
  return out;
}
let ROUND = roundFor();
function bandIndex(p, n){ let i = 0; p.bands.forEach((b, k) => { if (n >= b.from) i = k; }); return i; }

/* ---------- After the order closes: settings (copied) ---------- */
const PRINTER_EMAIL = 'printedclothingltd@outlook.com';
const PAY_DAYS = 7;
const SELLER = { name:'SAADI Gymnastics trading as National Gymnastics League', lines:['66 Waveney Road', 'Harpenden', 'Hertfordshire', 'AL5 4QZ'], email:'admin@nationalgymnasticsleague.co.uk',
  bank:{ accountName:'National Gymnastics League', sortCode:'60-84-64', accountNumber:'93416867' } };
const gbp = n => '£' + (Math.round(n * 100) / 100).toFixed(2);
const live = o => o.status !== 'cancelled';
const ALL_SIZES = [...new Set(PRODUCTS.flatMap(allSizes))];

/* ---------- state ---------- */
let FS = null, DB = null, ST = null, STG = null, LIVE = !DEMO, ME = {name:'', email:''};
const S = { loaded:null, round:ROUND.id, orders:[], loadedRound:null, err:'', board:{}, boardErr:'', msg:'', busy:false, subs:null };
let ORDERS = [], BILLS = [];
const onScreen = () => !!document.getElementById('gbRoot');
const redraw = () => window.NGL_RENDER && window.NGL_RENDER();
const nowTS = () => { const d = new Date(); return { toDate: () => d }; };
const TS = () => LIVE ? FS.serverTimestamp() : nowTS();

/* ---------- sample data (?demo): the open round, and the last closed round with invoices at every stage ---------- */
let DEMO_ORDERS = null;
function demoOrders(){
  const rs = roundsAround(), R0 = rs[1], R1 = rs[2], rid = R1.id.replace('-', ''), day = 864e5, now = Date.now();
  const at = ms => { const d = new Date(ms); return { toDate: () => d }; };
  const before = (r, days) => at(r.close.getTime() - 60 * day + days * day);
  const addr = (line1, town, postcode) => ({ line1, line2:'', town, postcode });
  const SAADI = { club:'SAADI Gymnastics', contactName:'Dave Brooke', email:'dave@saadi.example', phone:'01582 000000', address:addr('Unit 4, Harpenden Road', 'Redbourn', 'AL3 7PP') };
  const RIV = { club:'Riverside Gym Academy', contactName:'Sam Patel', email:'sam@riverside.example', phone:'', address:addr('12 Mill Lane', 'Bedford', 'MK40 1AB') };
  const NOR = { club:'Northgate Gymnastics Club', contactName:'Jo Evans', email:'jo@northgate.example', phone:'07700 900123', address:addr('Northgate Leisure Centre', 'Luton', 'LU1 2CD') };
  const HIL = { club:'Hillside Gymnastics', contactName:'Chris Lee', email:'chris@hillside.example', phone:'', address:addr('The Old School, Hill Street', 'Stevenage', 'SG1 3EF') };
  const OAK = { club:'Oakwood Gymnastics', contactName:'Priya Shah', email:'priya@oakwood.example', phone:'07700 900456', address:addr('Oakwood Park', 'St Albans', 'AL1 4GH') };
  const o = (id, round, club, product, colour, sizes, extra = {}) => { const p = prodOf(product), qty = Object.values(sizes).reduce((a, b) => a + b, 0);
    const back = extra.back || { type:'none', line1:'', line2:'', logoPath:'' }, sleeve = extra.sleeve || { type:'none', text:'' };
    return { id, ref:'NGL-' + round.id.replace('-', '') + '-' + id.slice(0, 5).toUpperCase(), round:round.id, product, productName:p.name, ...club, colour, sizes, qty,
      logoPath:`groupbuy/${round.id}/${id}/front-logo.png`, back, sleeve, notes:extra.notes || '',
      startPrice:p.bands[0].price, backPrice:back.type === 'none' ? 0 : p.backPrice[back.type], sleevePrice:sleeve.type === 'text' ? p.sleevePrice : 0,
      setupFee:extra.setup ? SETUP_FEE : 0, deliveryFee:DELIVERY_FEE, kidsQty:Object.entries(sizes).filter(([z]) => isKid(p, z)).reduce((a, [, n]) => a + n, 0),
      status:extra.status || 'placed', createdAt:extra.createdAt, ...(extra.inv || {}) }; };
  const inv = (n, ms) => ({ invoiceNo:`GB${rid}-${String(n).padStart(2, '0')}`, invoicedAt:at(ms) });
  return [
    // the open round: 66 t-shirts (minimum reached), 30 quarter zips (below the minimum)
    o('d0a1saadi', R0, SAADI, 'JC001', 'French Navy', {S:4, M:6, L:5, XL:3}, { back:{ type:'text', line1:'COACH', line2:'SAADI GYMNASTICS', logoPath:'' }, createdAt:at(now - 2 * 36e5) }),
    o('d0b2river', R0, RIV, 'JC001', 'French Navy', {M:10, L:8, '9/11':6, '12/13':4}, { setup:true, notes:'Please deliver after 4pm', createdAt:at(now - 5 * 36e5) }),
    o('d0c3north', R0, NOR, 'JC001', 'Royal Blue', {XS:2, S:5, M:7, L:4, '2XL':2}, { setup:true, back:{ type:'logo', line1:'', line2:'', logoPath:`groupbuy/${R0.id}/d0c3north/back-logo.png` }, createdAt:at(now - 8 * 36e5) }),
    o('d0d4saadi', R0, SAADI, 'LV874', 'Navy/White', {S:3, M:4, L:3, XL:2}, { sleeve:{ type:'text', text:'EVERY SPORT STARTS HERE' }, createdAt:at(now - 11 * 36e5) }),
    o('d0e5hills', R0, HIL, 'LV874', 'Black', {M:6, L:6, XL:4, XXL:2}, { setup:true, back:{ type:'text', line1:'COACH', line2:'HILLSIDE', logoPath:'' }, createdAt:at(now - 14 * 36e5) }),
    // the last closed round: 120 t-shirts (£7.36 band), 55 quarter zips; one invoice at each stage
    o('d1a1river', R1, RIV, 'JC001', 'Hawaiian Blue', {S:8, M:12, L:10}, { setup:true, createdAt:before(R1, 10) }),
    o('d1b2saadi', R1, SAADI, 'JC001', 'Jet Black', {S:10, M:20, L:15, XL:5}, { back:{ type:'text', line1:'COACH', line2:'SAADI GYMNASTICS', logoPath:'' }, status:'invoiced', inv:inv(5, now - 2 * day), createdAt:before(R1, 20) }),
    o('d1c3north', R1, NOR, 'JC001', 'Fire Red', {'5/6':10, '7/8':15, '9/11':15}, { setup:true, status:'paid', inv:{ ...inv(2, now - 9 * day), paidAt:at(now - 4 * day) }, createdAt:before(R1, 30) }),
    o('d1d4hills', R1, HIL, 'LV874', 'Navy', {M:10, L:10, XL:5}, { status:'invoiced', inv:inv(1, now - 10 * day), createdAt:before(R1, 40) }),
    o('d1e5oakwd', R1, OAK, 'LV874', 'Black/Red', {S:10, M:10, L:10}, { setup:true, sleeve:{ type:'text', text:'OAKWOOD COACH' }, status:'sent', inv:{ ...inv(3, now - 12 * day), paidAt:at(now - 8 * day), sentToPrinterAt:at(now - 7 * day) }, createdAt:before(R1, 50) })
  ];
}

/* ---------- data ---------- */
async function connect(){
  if (DEMO) { DEMO_ORDERS = demoOrders(); return; }
  try { const { fs, D } = await fb(); FS = fs; DB = D; }
  catch (e) { console.error(e); LIVE = false; S.err = 'Couldn’t connect to the database (' + (e.code || e.message) + ').'; return; }
  subscribeBoard();
}
// Live board: one totals doc per product per round, e.g. ngl_groupbuy_rounds/2026-11_JC001
function subscribeBoard(){
  if (S.subs) S.subs.forEach(u => u());
  const rid = ROUND.id;
  S.subs = PRODUCTS.map(p => FS.onSnapshot(FS.doc(DB, 'ngl_groupbuy_rounds', `${rid}_${p.id}`), s => {
    const d = s.exists() ? s.data() : {}; S.board[p.id] = { n:d.shirts || 0, orders:d.orders || 0 }; S.boardErr = ''; drawBoard(); },
    e => { console.warn(e); S.boardErr = 'The live totals can’t be loaded just now. You can still place your order.'; drawBoard(); }));
}
function demoBoard(){
  PRODUCTS.forEach(p => { const mine = DEMO_ORDERS.filter(o => o.round === ROUND.id && o.product === p.id);
    S.board[p.id] = { n:mine.reduce((a, o) => a + o.qty, 0), orders:mine.length }; });
}
async function loadRound(){
  if (LIVE || DEMO) S.err = '';
  let raw = [];
  try {
    if (DEMO) raw = DEMO_ORDERS.filter(o => o.round === S.round).map(o => ({ ...o }));
    else if (LIVE) { const snap = await FS.getDocs(FS.query(FS.collection(DB, 'ngl_groupbuy_orders'), FS.where('round', '==', S.round)));
      raw = snap.docs.map(d => ({ id:d.id, ...d.data() })); }
  } catch (e) { console.warn(e); S.err = `Couldn’t load the orders (${e.code || e.message}).`; ORDERS = []; S.loadedRound = S.round; return; }
  ORDERS = raw.map(o => { const t = o.createdAt?.toDate ? o.createdAt.toDate() : null; return { ...o, t, when: t ? t.toLocaleString('en-GB') : '' }; }).sort((a, b) => (b.t || 0) - (a.t || 0));
  S.loadedRound = S.round;
}
async function storage(){
  if (STG) return STG;
  const [st, app] = await Promise.all([import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'), import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js')]);
  ST = st; STG = st.getStorage(app.getApp()); return STG;
}
async function logoURL(path){ if (DEMO || !path) return ''; await storage(); return ST.getDownloadURL(ST.ref(STG, path)); }

/* ---------- screen ---------- */
function boardRows(){
  return PRODUCTS.map(p => {
    const { n = 0, orders = 0 } = S.board[p.id] || {}, i = bandIndex(p, n), nb = p.bands[i + 1];
    const top = p.bands[p.bands.length - 1].from * 1.08, pos = x => Math.min(100, Math.sqrt(x / top) * 100);   // square-root scale keeps early bands readable
    return `<div class="gb-brow" data-pid="${p.id}">
    <div class="gb-tile"><div class="l">Product</div><div class="v" style="font-size:22px">${esc(p.name)}</div><div class="s">${esc(p.blurb)}</div></div>
    <div class="gb-tile"><div class="l">Number ordered</div><div class="v" data-b="qty">${n.toLocaleString('en-GB')}</div><div class="s">${esc(plural(p, n))} · from ${orders} order${orders === 1 ? '' : 's'}</div></div>
    <div class="gb-tile now"><div class="l">Current price</div><div class="v" data-b="now">${money(p.bands[i].price)}</div><div class="s">per ${esc(p.unit)}, front logo</div></div>
    <div class="gb-tile next"><div class="l">Price at next band</div><div class="v" data-b="next">${nb ? money(nb.price) : 'Best price'}</div><div class="s" data-b="nexts">${nb ? `at ${nb.from} · ${nb.from - n} to go` : 'Top band reached'}</div></div>
  </div>
  <div class="gb-prog"><div class="gb-pbar"><div class="fill" style="width:${pos(n)}%"></div></div><div class="gb-ticks">${p.bands.slice(1).map(b => `<span class="gb-tick ${n >= b.from ? 'hit' : ''}" style="left:${pos(b.from)}%"><b>${b.from}</b>${money(b.price)}</span>`).join('')}</div></div>
  <p class="gb-minline ${n >= MIN_TOTAL ? 'ok' : ''}" data-b="min">${n >= MIN_TOTAL ? `&#10003; Minimum of ${MIN_TOTAL} reached: this order is going ahead` : `<b>${MIN_TOTAL - n} more ${esc(p.units)}</b> needed across all clubs for this order to go ahead (minimum ${MIN_TOTAL})`}</p>`; }).join('');
}
function drawBoard(){ const el = document.getElementById('gbBoardRows'); if (el) el.innerHTML = boardRows();
  const er = document.getElementById('gbBoardErr'); if (er) { er.textContent = S.boardErr; er.hidden = !S.boardErr; } }

const hex = (p, n) => { const c = p.colours.find(x => x[0] === n) || [, '#ccc']; return c[2] ? `linear-gradient(180deg,${c[1]} 50%,${c[2]} 50%)` : c[1]; };
function totals(pid){ const t = {}; ORDERS.filter(o => (o.product || 'JC001') === pid).forEach(o => { const s = t[o.colour] ||= {}; Object.entries(o.sizes || {}).forEach(([z, n]) => s[z] = (s[z] || 0) + n); }); return t; }
function totalsHTML(){
  return PRODUCTS.map(p => {
    const t = totals(p.id), cols = Object.keys(t), mine = ORDERS.filter(o => (o.product || 'JC001') === p.id);
    const tot = mine.reduce((a, o) => a + (o.qty || 0), 0), backs = mine.filter(o => o.back?.type && o.back.type !== 'none').reduce((a, o) => a + o.qty, 0), sleeves = mine.filter(o => o.sleeve?.type === 'text').reduce((a, o) => a + o.qty, 0);
    return `<h4 class="gb-h4">${esc(p.name)}</h4>` + (cols.length ? `<div class="gb-scroll"><table class="gb-t" data-totals="${p.id}"><thead><tr><th>Colour</th>${allSizes(p).map(z => `<th class="n">${z}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>
      ${cols.map(c => `<tr data-colour="${esc(c)}"><td><span class="gb-dot" style="background:${hex(p, c)}"></span>${esc(c)}</td>${allSizes(p).map(z => `<td class="n">${t[c][z] || ''}</td>`).join('')}<td class="n"><b>${allSizes(p).reduce((a, z) => a + (t[c][z] || 0), 0)}</b></td></tr>`).join('')}
      <tr class="gb-all"><td><b>All colours</b></td>${allSizes(p).map(z => `<td class="n"><b>${cols.reduce((a, c) => a + (t[c][z] || 0), 0) || ''}</b></td>`).join('')}<td class="n"><b>${tot}</b></td></tr></tbody></table></div>
      <p class="gb-hint" data-sum="${p.id}">${mine.length} order${mine.length === 1 ? '' : 's'} · ${tot} ${plural(p, tot)} · ${backs} with a back print${p.sleeve ? ` · ${sleeves} with sleeve text` : ''} · price band: ${money(p.bands[bandIndex(p, tot)].price)} each</p>`
      : '<p class="gb-hint">No orders yet.</p>');
  }).join('');
}
function ordersHTML(){
  if (!ORDERS.length) return '';
  return `<div class="gb-scroll"><table class="gb-t" id="gbOrderList"><thead><tr><th>Ref</th><th>Product</th><th>Club</th><th>Colour</th><th>Sizes</th><th class="n">Qty</th><th>Extras</th><th>Logos</th><th>Deliver to</th><th>Contact</th></tr></thead><tbody>
    ${ORDERS.map(o => { const p = prodOf(o.product || 'JC001'); const ex = [o.back?.type === 'text' ? 'Back: ' + [o.back.line1, o.back.line2].filter(Boolean).join(' / ') : o.back?.type === 'logo' ? 'Back: logo' : '', o.sleeve?.type === 'text' ? 'Sleeve: ' + o.sleeve.text : ''].filter(Boolean);
      return `<tr><td>${esc(o.ref)}<br><small class="gb-hint">${esc(o.when)}</small></td><td>${esc(p.name)}</td><td><b>${esc(o.club)}</b>${o.notes ? `<br><small class="gb-hint">${esc(o.notes)}</small>` : ''}</td>
      <td><span class="gb-dot" style="background:${hex(p, o.colour)}"></span>${esc(o.colour)}</td>
      <td>${Object.entries(o.sizes || {}).map(([z, n]) => `${esc(z)} ${n}`).join(', ')}</td><td class="n"><b>${o.qty}</b></td>
      <td>${ex.length ? ex.map(esc).join('<br>') : '–'}</td>
      <td><a href="#" data-act="gb-logo" data-path="${esc(o.logoPath)}">Front</a>${o.back?.logoPath ? ` · <a href="#" data-act="gb-logo" data-path="${esc(o.back.logoPath)}">Back</a>` : ''}</td>
      <td>${esc([o.address?.line1, o.address?.line2, o.address?.town, o.address?.postcode].filter(Boolean).join(', '))}</td>
      <td>${esc(o.contactName)}<br><a href="mailto:${esc(o.email)}">${esc(o.email)}</a>${o.phone ? '<br>' + esc(o.phone) : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
}

function finalBands(){   // per product: total ordered, whether the minimum is met, and the final price
  const out = {};
  PRODUCTS.forEach(p => { const n = ORDERS.filter(o => live(o) && (o.product || 'JC001') === p.id).reduce((a, o) => a + (o.qty || 0), 0);
    out[p.id] = { n, ok: n >= MIN_TOTAL, price: p.bands[bandIndex(p, n)].price }; });
  return out;
}
function clubBills(){   // one invoice per club (same email), combining all its orders that are going ahead
  const F = finalBands(), by = {};
  ORDERS.filter(o => live(o) && F[o.product || 'JC001'].ok).forEach(o => { const k = (o.email || o.club).toLowerCase(); (by[k] ||= { key:k, club:o.club, contact:o.contactName, email:o.email, phone:o.phone, orders:[] }).orders.push(o); });
  const rid = S.round.replace('-', '');
  return Object.values(by).sort((a, b) => a.club.localeCompare(b.club)).map((c, i) => {
    const lines = [];
    c.orders.forEach(o => { const p = prodOf(o.product || 'JC001'), f = F[p.id].price, kid = Object.entries(o.sizes || {}).filter(([z]) => isKid(p, z)).reduce((a, [, n]) => a + n, 0), adult = o.qty - kid;
      [[adult, p.kidsSizes ? 'adult sizes' : '', VAT_RATE], [kid, 'children’s sizes, no VAT', 0]].filter(g => g[0]).forEach(([q, lab, r]) => {
        lines.push({ d:`${q} × ${p.name} (${p.id}), ${o.colour}${lab ? ', ' + lab : ''}, club logo left chest · ${o.ref}`, q, u:f, r });
        if (o.back?.type && o.back.type !== 'none') lines.push({ d:`Back print: ${o.back.type === 'text' ? 'two lines of text' : 'logo'}${lab ? ' (' + lab + ')' : ''}`, q, u:p.backPrice[o.back.type], r });
        if (o.sleeve?.type === 'text') lines.push({ d:`Sleeve text, left sleeve${lab ? ' (' + lab + ')' : ''}`, q, u:p.sleevePrice, r }); }); });
    const goods = lines.reduce((a, l) => a + l.q * l.u, 0), adultGoods = lines.filter(l => l.r).reduce((a, l) => a + l.q * l.u, 0), sh = goods ? adultGoods / goods : 1;
    if (c.orders.some(o => o.setupFee)) lines.push({ d:'Logo set-up (one-off, first order)', q:1, u:SETUP_FEE, r:VAT_RATE * sh });
    lines.push({ d:'Delivery to your club', q:1, u:DELIVERY_FEE, r:VAT_RATE * sh });
    const net = lines.reduce((a, l) => a + l.q * l.u, 0), vat = lines.reduce((a, l) => a + l.q * l.u * l.r, 0);
    const st = c.orders.map(o => o.status || 'placed'), stage = st.every(s => s === 'sent') ? 'sent' : st.every(s => s === 'paid' || s === 'sent') ? 'paid' : st.every(s => s !== 'placed') ? 'invoiced' : 'placed';
    const inv = c.orders.find(o => o.invoiceNo);
    return Object.assign(c, { lines, net, vat, total: net + vat, part: sh > 0 && sh < 1, stage, no: inv ? inv.invoiceNo : `GB${rid}-${String(i + 1).padStart(2, '0')}`,
      invoicedAt: inv && inv.invoicedAt?.toDate ? inv.invoicedAt.toDate() : null });
  });
}
function invoiceHTML(c){
  const issued = c.invoicedAt || new Date(), due = new Date(issued.getTime() + PAY_DAYS * 864e5), d = x => x.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  const td = 'padding:8px 10px;border-bottom:1px solid #e3e6ef;font-size:14px', a = c.orders[0].address || {};
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#16213a;max-width:680px;margin:0 auto">
  <div style="background:#14254a;color:#fff;padding:18px 22px;border-bottom:5px solid #c6152e"><div style="font-size:22px;font-weight:bold">Invoice ${esc(c.no)}</div><div style="font-size:14px;opacity:.85">NGL group order · staff kit</div></div>
  <table style="width:100%;margin:16px 0;font-size:14px"><tr><td style="vertical-align:top"><b>From</b><br>${esc(SELLER.name)}<br>${SELLER.lines.map(esc).join('<br>')}<br>${esc(SELLER.email)}</td>
  <td style="vertical-align:top"><b>To</b><br>${esc(c.club)}<br>${esc(c.contact || '')}<br>${esc([a.line1, a.line2, a.town, a.postcode].filter(Boolean).join(', '))}<br>${esc(c.email)}</td>
  <td style="vertical-align:top;text-align:right"><b>Date</b> ${d(issued)}<br><b>Due</b> ${d(due)}</td></tr></table>
  <table style="width:100%;border-collapse:collapse"><tr style="background:#f1f3f8"><th style="${td};text-align:left">Item</th><th style="${td};text-align:right">Qty</th><th style="${td};text-align:right">Each</th><th style="${td};text-align:right">Amount</th></tr>
  ${c.lines.map(l => `<tr><td style="${td}">${esc(l.d)}</td><td style="${td};text-align:right">${l.q}</td><td style="${td};text-align:right">${gbp(l.u)}</td><td style="${td};text-align:right">${gbp(l.q * l.u)}</td></tr>`).join('')}
  <tr><td colspan="3" style="${td};text-align:right">Subtotal</td><td style="${td};text-align:right">${gbp(c.net)}</td></tr>
  ${c.vat ? `<tr><td colspan="3" style="${td};text-align:right">VAT at ${Math.round(VAT_RATE * 100)}%${c.lines.some(l => !l.r) ? ' (adult sizes only' + (c.part ? '; set-up and delivery in proportion' : '') + ')' : ''}</td><td style="${td};text-align:right">${gbp(c.vat)}</td></tr>` : ''}
  <tr><td colspan="3" style="${td};text-align:right;font-weight:bold;font-size:16px">Total due</td><td style="${td};text-align:right;font-weight:bold;font-size:16px">${gbp(c.total)}</td></tr></table>
  <div style="margin:18px 0;padding:14px 16px;background:#fff4f5;border-left:4px solid #c6152e;font-size:14px"><b>Please pay within ${PAY_DAYS} days by bank transfer</b> (by ${d(due)})<br>
  ${esc(SELLER.bank.accountName)} · Sort code ${SELLER.bank.sortCode} · Account ${SELLER.bank.accountNumber}<br>Payment reference: <b>${esc(c.no)}</b></div>
  <p style="font-size:13px;color:#5d6782">Prices are the final group price for this order round, reached by all clubs ordering together. Your kit goes to print once payment is received.</p></div>`;
}
async function printerHTML(c){
  const link = async p => { try { return await logoURL(p); } catch (e){ return ''; } };
  const a = c.orders[0].address || {}, td = 'padding:6px 8px;border:1px solid #d6dbe6;font-size:14px';
  const blocks = await Promise.all(c.orders.map(async o => { const p = prodOf(o.product || 'JC001'), fl = await link(o.logoPath), bl = o.back?.logoPath ? await link(o.back.logoPath) : '';
    const sizes = allSizes(p).filter(z => o.sizes?.[z]);
    return `<h3 style="margin:18px 0 6px">${esc(p.id)} ${esc(p.name)} · ${esc(o.colour)} · ${o.qty} in total <span style="font-weight:normal;color:#5d6782">(${esc(o.ref)})</span></h3>
    <table style="border-collapse:collapse"><tr>${sizes.map(z => `<th style="${td};background:#f1f3f8">${isKid(p, z) ? 'Kids ' + z : z}</th>`).join('')}</tr><tr>${sizes.map(z => `<td style="${td};text-align:center">${o.sizes[z]}</td>`).join('')}</tr></table>
    <p style="font-size:14px;margin:8px 0">Front: club logo, left chest · ${fl ? `<a href="${fl}">download logo</a>` : 'logo link unavailable'}<br>
    Back: ${o.back?.type === 'text' ? `two lines of text: <b>${esc(o.back.line1 || '')}</b> / <b>${esc(o.back.line2 || '')}</b>` : o.back?.type === 'logo' ? `large logo · ${bl ? `<a href="${bl}">download back logo</a>` : 'link unavailable'}` : 'plain'}
    ${p.sleeve ? `<br>Left sleeve: ${o.sleeve?.type === 'text' ? `<b>${esc(o.sleeve.text)}</b>` : 'plain'}` : ''}${o.notes ? `<br>Club notes: ${esc(o.notes)}` : ''}</p>`; }));
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#16213a;max-width:680px">
  <p>Hi, here is an NGL group order for <b>${esc(c.club)}</b>. Please invoice the NGL for it as agreed.</p>
  ${c.orders.some(o => o.setupFee) ? '<p><b>First order for this club:</b> includes the one-off logo set-up.</p>' : ''}
  ${blocks.join('')}
  <h3 style="margin:18px 0 6px">Deliver to</h3><p style="font-size:14px">${esc(c.club)}<br>FAO ${esc(c.contact || '')}${c.phone ? ' · ' + esc(c.phone) : ''}<br>${esc([a.line1, a.line2, a.town, a.postcode].filter(Boolean).join(', '))}</p>
  <p style="font-size:13px;color:#5d6782">Order reference ${esc(c.no)} · National Gymnastics League · ${esc(SELLER.email)}</p></div>`;
}

/* Emails go through EmailJS, as before. Sandbox: never to a club or the printer (see top of file). Returns where it went. */
async function sendEmail(to, toName, subject, html){
  if (DEMO) return 'demo';
  if (SANDBOX) { if (!ME.email || /@example\.(com|org|net)$/i.test(ME.email)) return 'skipped'; subject = '[SANDBOX TEST] ' + subject + ' (for ' + to + ')'; to = ME.email; }
  const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ service_id:EMAILJS.serviceId, template_id:EMAILJS.templateId, user_id:EMAILJS.publicKey, template_params:{ to_email:to, to_name:toName, subject, invoice_html:html } }) });
  if (!r.ok) throw new Error('Email failed: ' + r.status + ' ' + (await r.text()));
  return SANDBOX ? 'you' : 'sent';
}
async function setStage(c, status, extra = {}){
  if (!LIVE) { c.orders.forEach(o => { const d = DEMO_ORDERS && DEMO_ORDERS.find(x => x.id === o.id); if (d) Object.assign(d, { status }, extra); }); return; }
  const b = FS.writeBatch(DB); c.orders.forEach(o => b.update(FS.doc(DB, 'ngl_groupbuy_orders', o.id), Object.assign({ status }, extra))); await b.commit();
}
async function doInvoice(c){
  if (!c.invoicedAt) c.invoicedAt = new Date();
  const went = await sendEmail(c.email, c.contact || c.club, `NGL group order invoice ${c.no} – ${gbp(c.total)}`, invoiceHTML(c));
  if (c.stage === 'placed') await setStage(c, 'invoiced', { invoiceNo:c.no, invoicedAt:TS(), invoiceTotal:Math.round(c.total * 100) / 100 });
  return went;
}
async function doPrinter(c){
  const went = SANDBOX || DEMO ? 'off' : await sendEmail(PRINTER_EMAIL, 'Printed Clothing', `NGL group order ${c.no} – ${c.club} – ${c.orders.reduce((a, o) => a + o.qty, 0)} garments`, await printerHTML(c));
  await setStage(c, 'sent', { sentToPrinterAt:TS() });
  return went;
}
const invMsg = (c, went) => went === 'sent' ? `Invoice ${c.no} emailed to ${c.email}.` : went === 'you' ? `Invoice ${c.no} emailed to you (${ME.email}) instead of ${c.email}: sandbox test.`
  : `Invoice ${c.no} marked as emailed. ${DEMO ? 'Sample data' : 'Sandbox'}: nothing was sent (it would go to ${c.email}).`;
const printMsg = (c, went) => went === 'sent' ? `${c.club}'s order sent to ${PRINTER_EMAIL}.` : `${c.club}'s order marked as sent. ${DEMO ? 'Sample data' : 'Sandbox'}: nothing was emailed to ${PRINTER_EMAIL}.`;

function closeHTML(){
  const r = roundsAround().find(x => x.id === S.round), closed = r && r.close < new Date(), F = finalBands();
  BILLS = clubBills();
  const stageTxt = { placed:'Not invoiced', invoiced:'Invoiced, awaiting payment', paid:'Paid', sent:'Sent to printer' };
  const overdue = c => c.stage === 'invoiced' && c.invoicedAt && new Date() > new Date(c.invoicedAt.getTime() + PAY_DAYS * 864e5);
  const dis = x => x || S.busy ? 'disabled' : '';
  return `<h3>After the order closes</h3>
    <p class="gb-hint" style="margin:0 0 10px">${closed ? 'This order round has closed.' : `This round closes ${r ? fmtDate(r.close) : ''}. Invoicing opens then; below is how it would look if it closed now.`}</p>
    <div class="gb-steps">
      <div><b>1. Final prices</b>${PRODUCTS.map(p => `<div class="gb-p ${F[p.id].ok ? 'ok' : 'no'}" data-final="${p.id}">${esc(p.name)}: <b>${F[p.id].n}</b> ordered · ${F[p.id].ok ? `final price <b>${gbp(F[p.id].price)}</b>` : `below the minimum of ${MIN_TOTAL}: not going ahead`}</div>`).join('')}</div>
      <div><b>2. Invoices</b><span>Emailed to each club, pay within ${PAY_DAYS} days by bank transfer</span><button class="btn sm" data-act="gb-inv-all" id="gbInvAll" ${dis(!(closed && BILLS.some(c => c.stage === 'placed')))}>Email all invoices</button></div>
      <div><b>3. Payment</b><span>Tick each club off as the money arrives</span></div>
      <div><b>4. Printer</b><span>Each paid club's order goes to ${PRINTER_EMAIL}</span><button class="btn sm" data-act="gb-print-all" id="gbPrintAll" ${dis(!BILLS.some(c => c.stage === 'paid'))}>Send all paid orders</button></div>
    </div>
    ${PRODUCTS.some(p => !F[p.id].ok && F[p.id].n) ? `<p class="gb-err">Orders for a product below the minimum are left out of the invoices. Let those clubs know it isn't going ahead this round.</p>` : ''}
    ${BILLS.length ? `<div class="gb-scroll"><table class="gb-t" id="gbBills"><thead><tr><th>Invoice</th><th>Club</th><th class="n">Items</th><th class="n">Total</th><th>Status</th><th></th></tr></thead><tbody>
    ${BILLS.map((c, i) => `<tr data-bill="${esc(c.no)}"><td>${esc(c.no)}</td><td><b>${esc(c.club)}</b><br><small class="gb-hint">${esc(c.email)}</small></td><td class="n">${c.orders.reduce((a, o) => a + o.qty, 0)}</td>
      <td class="n"><b class="gb-tot">${gbp(c.total)}</b>${c.vat ? `<br><small class="gb-hint">${gbp(c.net)} + ${gbp(c.vat)} VAT</small>` : ''}</td>
      <td><span class="gb-st ${c.stage}${overdue(c) ? ' late' : ''}">${overdue(c) ? 'Overdue' : stageTxt[c.stage]}</span></td>
      <td class="gb-act"><button class="btn sm ghost" data-act="gb-cl" data-cl="view" data-i="${i}">View invoice</button>
        ${c.stage === 'placed' ? `<button class="btn sm" data-act="gb-cl" data-cl="inv" data-i="${i}" ${dis(!closed)}>Email invoice</button>` : ''}
        ${c.stage === 'invoiced' ? `<button class="btn sm ghost" data-act="gb-cl" data-cl="inv" data-i="${i}" ${dis()}>Resend</button><button class="btn sm" data-act="gb-cl" data-cl="paid" data-i="${i}" ${dis()}>Mark paid</button>` : ''}
        ${c.stage === 'paid' ? `<button class="btn sm" data-act="gb-cl" data-cl="print" data-i="${i}" ${dis()}>Send to printer</button><button class="btn sm ghost" data-act="gb-cl" data-cl="unpaid" data-i="${i}" ${dis()}>Undo paid</button>` : ''}
        ${c.stage === 'sent' ? `<button class="btn sm ghost" data-act="gb-cl" data-cl="print" data-i="${i}" ${dis()}>Resend to printer</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="gb-hint">No orders to invoice yet.</p>'}
    <p class="gb-hint gb-msg" id="gbMsg" aria-live="polite">${esc(S.msg)}</p>`;
}

function view(){
  const rs = roundsAround();
  const note = DEMO ? 'Sample data: nothing here is saved or emailed.'
    : SANDBOX ? `Sandbox: invoices are emailed to you (${ME.email || 'your NGL Admin email'}), not to the club, with [SANDBOX TEST] in the subject. Nothing is emailed to the printer; orders are only marked as sent.` : '';
  return `<div class="gb-root" id="gbRoot">
  <div class="gb-hero"><span class="gb-kick">Group purchasing · Quarterly order</span>
    <h2>The more clubs order, the less everyone pays</h2>
    <p>Standard NGL staff kit with your club's logo: a t-shirt and a quarter zip. Every club's order is added together, and when the total passes each band, the price comes down for <b>everyone</b> in that order.</p></div>
  ${note ? `<div class="card attn gb-sandbox">${esc(note)}</div>` : ''}
  <section class="gb-countdown" aria-label="Time left to order">
    <div class="gb-cdl"><span class="k">This order closes in</span><span class="d">${esc(fmtDate(ROUND.close))} at 11:59pm</span></div>
    <div class="gb-cdt" id="gbCd" role="timer" aria-live="off">
      <div><b id="gbCdD">–</b><span>days</span></div><div><b id="gbCdH">–</b><span>hours</span></div><div><b id="gbCdM">–</b><span>mins</span></div><div><b id="gbCdS">–</b><span>secs</span></div>
    </div>
  </section>
  <section class="gb-board" aria-labelledby="gbBoardTitle">
    <div class="gb-bhead"><span class="gb-live" id="gbBoardTitle"><i aria-hidden="true"></i>Live order board</span><span class="gb-closes">Order closes <b>${esc(fmtDate(ROUND.close))}</b></span></div>
    <div id="gbBoardRows">${boardRows()}</div>
    <p class="gb-bnote">Each product has its own bands. The final price is fixed when the order closes, and every club pays the same price. Prices exclude VAT, which applies to adult sizes only.</p>
    <p class="gb-berr" id="gbBoardErr" ${S.boardErr ? '' : 'hidden'}>${esc(S.boardErr)}</p>
  </section>
  <div class="card gb-admin">
    <h2>Group orders</h2>
    <p class="gb-hint">Signed in as ${esc(ME.name || ME.email || 'NGL Admin')}</p>
    <div class="gb-tool">
      <label class="gb-roundpick">Order round <select id="gbRound">${rs.map(r => `<option value="${r.id}" ${r.id === S.round ? 'selected' : ''}>Closes ${r.close.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}${r.id === ROUND.id ? ' (open now)' : ''}</option>`).join('')}</select></label>
      <button class="btn sm" data-act="gb-csv" type="button">Download orders (CSV)</button>
      <button class="btn sm ghost" data-act="gb-supplier" type="button">Download supplier sheet (CSV)</button>
    </div>
    ${S.err ? `<p class="gb-err">${esc(S.err)}</p>` : `
    <div class="gb-close" id="gbClose">${closeHTML()}</div>
    <h3>Supplier totals: product, colour and size</h3>
    <div id="gbTotals">${totalsHTML()}</div>
    <h3 style="margin-top:18px">Every order</h3>
    <div id="gbOrders">${ordersHTML()}</div>`}
  </div>
  <p class="gb-ftr">National Gymnastics League · Group purchasing · Exclusively for British Gymnastics clubs</p></div>`;
}

/* ---------- countdown (every second, while the screen is open) ---------- */
function countdown(){
  if (!onScreen()) return;
  const ms = ROUND.close - new Date();
  if (ms <= 0){ ROUND = roundFor(); if (LIVE) subscribeBoard(); else if (DEMO) demoBoard(); redraw(); return; }   // the next order round opens straight away
  const t = Math.floor(ms / 1000), pad = n => String(n).padStart(2, '0'), set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('gbCdD', Math.floor(t / 86400)); set('gbCdH', pad(Math.floor(t / 3600) % 24));
  set('gbCdM', pad(Math.floor(t / 60) % 60)); set('gbCdS', pad(t % 60));
  const cd = document.getElementById('gbCd'); if (cd) cd.classList.toggle('urgent', ms < 3 * 864e5);
}
setInterval(countdown, 1000);
document.addEventListener('ngl:rendered', countdown);

/* ---------- exports ---------- */
function csv(name, rows){
  const t = rows.map(r => r.map(v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + t], { type:'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- buttons (data-act="gb-…"): the app shell sends clicks here ---------- */
const setMsg = t => { S.msg = t; const m = document.getElementById('gbMsg'); if (m) m.textContent = t; };
async function act(b, fn){
  if (S.busy) return; S.busy = true; b.disabled = true;
  try { await fn(); await loadRound(); }
  catch (err){ console.error(err); setMsg('Something went wrong: ' + (err.message || err)); }
  S.busy = false; redraw();
}
export const GB = {
  'gb-csv'(){ csv(`ngl-group-orders-${S.round}.csv`, [
    ['Ref','Placed','Product','Club','Contact','Email','Phone','Colour',...ALL_SIZES,'Total','Back','Back line 1','Back line 2','Sleeve text','Logo set-up','Delivery','Address 1','Address 2','Town','Postcode','Notes','Status'],
    ...ORDERS.map(o => [o.ref, o.when, prodOf(o.product).name, o.club, o.contactName, o.email, o.phone, o.colour, ...ALL_SIZES.map(z => o.sizes?.[z] || ''), o.qty, o.back?.type, o.back?.line1, o.back?.line2, o.sleeve?.text, o.setupFee ? 'Yes' : '', o.deliveryFee || '', o.address?.line1, o.address?.line2, o.address?.town, o.address?.postcode, o.notes, o.status])]); },
  'gb-supplier'(){ const rows = [['Product','Colour',...ALL_SIZES,'Total']];
    PRODUCTS.forEach(p => { const t = totals(p.id); Object.entries(t).forEach(([c, s]) => rows.push([p.name, c, ...ALL_SIZES.map(z => s[z] || ''), ALL_SIZES.reduce((a, z) => a + (s[z] || 0), 0)])); });
    csv(`ngl-supplier-${S.round}.csv`, rows); },
  async 'gb-logo'(a){
    if (DEMO) { toast('Sample data: there are no logo files to open.'); return; }
    const w = window.open('', '_blank');
    try { const u = await logoURL(a.dataset.path); if (w) w.location = u; else location.href = u; }
    catch (err){ if (w) w.close(); toast('Couldn’t open that logo: ' + (err.code || err.message), false); } },
  'gb-cl'(b){
    const c = BILLS[+b.dataset.i], k = b.dataset.cl; if (!c) return;
    if (k === 'view'){ const w = window.open('', '_blank'); if (w){ w.document.write(`<title>Invoice ${esc(c.no)}</title><body style="margin:24px">${invoiceHTML(c)}<p style="text-align:center"><button onclick="print()">Print or save as PDF</button></p></body>`); w.document.close(); } return; }
    return act(b, async () => {
      if (k === 'inv'){ setMsg('Emailing the invoice…'); setMsg(invMsg(c, await doInvoice(c))); }
      if (k === 'paid'){ await setStage(c, 'paid', { paidAt:TS() }); setMsg(`${c.club} marked as paid.`); }
      if (k === 'unpaid'){ await setStage(c, 'invoiced'); setMsg(''); }
      if (k === 'print'){ setMsg('Sending the order to the printer…'); setMsg(printMsg(c, await doPrinter(c))); }
    });
  },
  'gb-inv-all'(b){ const todo = BILLS.filter(x => x.stage === 'placed'); if (!todo.length || !confirm(`Email ${todo.length} invoice${todo.length === 1 ? '' : 's'} now?`)) return;
    return act(b, async () => { let n = 0, went = 'sent'; for (const x of todo){ setMsg(`Emailing invoice ${++n} of ${todo.length}…`); went = await doInvoice(x); }
      setMsg(`${todo.length} invoices emailed.` + (went === 'sent' ? '' : went === 'you' ? ` Sandbox test: they went to you (${ME.email}), not the clubs.` : ` ${DEMO ? 'Sample data' : 'Sandbox'}: nothing was sent.`)); }); },
  'gb-print-all'(b){ const todo = BILLS.filter(x => x.stage === 'paid'); if (!todo.length || !confirm(`Send ${todo.length} paid order${todo.length === 1 ? '' : 's'} to ${PRINTER_EMAIL}?`)) return;
    return act(b, async () => { let n = 0, went = 'sent'; for (const x of todo){ setMsg(`Sending order ${++n} of ${todo.length}…`); went = await doPrinter(x); }
      setMsg(`${todo.length} orders sent to the printer.` + (went === 'sent' ? '' : ` ${DEMO ? 'Sample data' : 'Sandbox'}: nothing was emailed to ${PRINTER_EMAIL}; they are marked as sent.`)); }); }
};

document.addEventListener('change', async e => {
  if (!(e.target.closest && e.target.closest('#gbRoot')) || e.target.id !== 'gbRound') return;
  S.round = e.target.value; S.msg = ''; await loadRound(); redraw();
});

/* The screen: #/admin/groupbuy */
export default async function groupbuy(me = {}, parts = []){
  ME = { name:(me && me.name) || '', email:(me && me.email) || '' };
  if (!S.loaded) S.loaded = connect();
  await S.loaded;
  if (DEMO) demoBoard();
  if (S.loadedRound !== S.round) await loadRound();
  return view();
}
