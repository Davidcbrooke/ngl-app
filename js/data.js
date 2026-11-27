// Data layer. Every screen asks this file for data, never Firebase directly,
// so the sandbox (sample data) and live (Firebase) run exactly the same screens.
import { RULES_BASE, CARD_PAY_URL, ADMIN_EMAILS, ENV } from './config.js';
import { fb } from './firebase.js';
import PRICES from './prices.js';

// Sample data when the address has ?demo. Since switch-over the database is the LIVE one, so any other address
// (the old sandbox link, local tests) shows sample data only; ?db on another address is a deliberate exception for Dave/Claude.
const Q0 = new URLSearchParams(location.search);
const demoInvites = [{id: 'demo0', name: 'Priya Shah', email: 'priya@example.com', at: '2026-11-20'}];
export const MODE = Q0.has('demo') || (ENV !== 'live' && !Q0.has('db')) ? 'demo' : 'firebase';

const demo = {
  club: {name:'SAADI Gymnastics', contact:'Dave Brooke', email:'demo@club.example', bgNumber:'BG123456',
    schoolsList: [{id:'s1', name:'Redbourn Primary School', children:140}, {id:'s2', name:'Harpenden Junior School', children:165}],
    schoolEvents: [{id:'e1', title:'NGL Schools Graduation', date:'2027-07-10', time:'10:00', venue:'SAADI Gymnastics, Harpenden', schoolName:'', medals:0}]},
  licences: {
    preschool:   {status:'live', label:'Licence live', renews:'2027-09-01', band:'25–49 Pre-School gymnasts', packs:{pack2:true}},
    schools:     {status:'live', label:'Licence live', renews:'2027-10-25', band:'250–399 gymnasts', code:'SAADI-7K4P'},
    recreational:{status:'live', label:'Licence live', renews:'2027-04-02', band:'100–249 gymnasts', code:'SAADI-R9TQ'},
    general:     {status:'waived', label:'Fee waived for 2027'},
    performance: {status:'soon', label:'Coming 2027'},
    university:  {status:'soon', label:'Coming soon'},
    masters:     {status:'soon', label:'Coming soon'}
  },
  competitions: [
    {id:'c1', date:'2027-02-07', path:'general', name:'General League · East Region', where:'SAADI Gymnastics, Harpenden', who:'Girls Levels 1–4', reserved:12, ref:'NGL-7Q2K', buyBy:'2026-11-07', musicBy:'2027-01-24', booking:'reserved', justgoUrl:'demo:justgo'},
    {id:'c2', date:'2027-02-14', path:'general', name:'General League · East Region', where:'SAADI Gymnastics, Harpenden', who:'Boys Levels 1–4', reserved:6, ref:'NGL-8M4D', buyBy:'2026-11-14', maxPlaces:80, taken:74},
    {id:'c3', date:'2027-02-21', path:'general', name:'General League · West Midlands', where:'TBC', who:'Girls & Boys', booking:'open', justgoUrl:'demo:justgo', maxPlaces:100, taken:100},
    {id:'c4', date:'2027-03-13', path:'recreational', name:'Recreational · Ruby & Pink', where:'Redbourn', who:'Every gymnast medals', reserved:30, ref:'NGL-3RP9', buyBy:'2026-12-13'},
    {id:'c5', date:'2027-04-24', path:'performance', name:'Performance League Grades', where:'TBC', who:'Classic Challenge preparation', waiting:true},
    {id:'c6', date:'2027-10-24', path:'general', name:'NGL National Finals 2027', where:'TBC', who:'By qualification', waiting:true}
  ],
  // Floor music: one entry per competition the club has gymnasts in (from the start lists)
  music: [{ev: {id: 'c1', title: 'General League · East Region', date: '2027-02-07', deadline: '2027-01-24'},
    gymnasts: [{id: 'g1', n: 'Amelia R', level: 1, file: 'amelia-floor.mp3'}, {id: 'g2', n: 'Isla T', level: 1}, {id: 'g3', n: 'Grace W', level: 2}, {id: 'g4', n: 'Ruby K', level: 2}]}],
  orders: [
    {id:'ORD-R2M6F', date:'2026-11-24', path:'recreational', details:'40 books, 200 medals', total:800, status:'awaiting-payment'},
    {id:'ORD-G2X9B', date:'2026-11-23', path:'schools', details:'Graduation: 64 graduates', total:320, status:'awaiting-payment'},
    {id:'ORD-P8W2D', date:'2026-11-20', path:'schools', details:'120 books, 300 certificates', total:642, status:'awaiting-payment'},
    {id:'ORD-K3M7Q', date:'2026-10-26', path:'schools', details:'Schools Club Licence 250–399', total:950, status:'paid'},
    {id:'ORD-R7Y3J', date:'2026-09-26', path:'recreational', details:'190 medals, 12 t-shirts', total:619, status:'paid'}
  ],
  // Prices to clubs: NGL's price list (prices.json, copied in js/prices.js), plus Group Buying, which is priced per round
  products: [...PRICES.products,
    {k:'kit', path:null, n:'Group Buying: staff kit', d:'Your logo, ordered every quarter', price:null}]
};

export const RULES = [
  {group:'General League', path:'general', items:[
    {t:'General Girls rules 2027', d:'Levels 1–4: competition rules and common deductions', url:RULES_BASE + 'NGL_General_League_WAG_Rules_2027.pdf'},
    {t:'Boys (MAG) rules 2027', d:'Levels 1–4', url:RULES_BASE + 'NGL_General_League_MAG_Rules_2027.pdf'},
    {t:'WAG Element Book 2027', d:'Uncoded and common coded Bars, Beam and Floor elements', url:RULES_BASE + 'NGL_General_League_WAG_Element_Guide_2027.pdf'},
    {t:'FIG Code of Points 2025–2028', d:'The base for NGL rules, except where NGL changes are noted', url:RULES_BASE + 'FIG_WAG_Code_of_Points_2025-2028.pdf'}]},
  {group:'Recreational', path:'recreational', items:[
    {t:'Recreational competition rules', d:'Ruby, Pink, Teal and Indigo: the same four levels as the award books', url:null},
    {t:'Competition routines', d:'Video and written routines for every level', url:null}]},
  {group:'Schools', path:'schools', items:[
    {t:'Graduation guide', d:'How a Graduation runs and what gymnasts perform', url:null},
    {t:'Schools prospectus', d:'The 9-page prospectus to share with schools', url:null}]},
  {group:'Every competition', path:null, items:[
    {t:'Floor music rules', d:'MP3, up to 15MB, no voice-over or lyrics', route:'#/help/music'},
    {t:'Which level should we enter?', d:'Recreational 1–2 hrs a week, General League 2–10 hrs, Performance League 11+', route:'#/help/level'},
    {t:'Booking and the waiting list', d:'Reserve, buy on JustGo, the 3-month rule', route:'#/help/booking'}]}
];

export const FAQ = [
  {id:'rules', q:'Where are the competition rules?', a:'Rules & resources in the menu: every rule book, the element book and the Code of Points. Or type "rules" in the search bar.', go:'#/rules'},
  {id:'level', q:'Which level should my gymnast enter?', a:'Go by weekly training: Recreational 1–2 hours, General League 2–10 hours (girls’ Level 1 is for 2–5 hours), Performance League over 10 hours. The General Skills Book shows the right level from the skills a gymnast can already do.', go:'#/rules'},
  {id:'booking', q:'How do I enter a competition?', a:'Reserve places in Competitions (no payment). We email a private JustGo link up to 5 months before; buy by 3 months before or the places go to the waiting list.', go:'#/competitions'},
  {id:'music', q:'How do I upload floor music?', a:'Competitions → Floor music. One MP3 per gymnast, up to 15MB, no voice-over or lyrics.', go:'#/competitions/music'},
  {id:'results', q:'Where are the results and league tables?', a:'Competitions → Results & league tables. Share the Family Hub link so parents can follow them too.', go:'#/competitions/results'},
  {id:'licence', q:'What does a licence cost, and what do I get?', a:'My club → Licences shows every programme. Explore any programme before you buy; a licence unlocks the lesson plans, ordering at club prices and the family app.', go:'#/club'},
  {id:'pay', q:'How do I pay for an order?', a:'You pay when you order, through Stripe’s secure checkout: card, Apple Pay, Google Pay or Pay by bank from your banking app. Stripe emails your receipt and the order shows as Paid straight away. If you didn’t finish paying, open the order in Shop & orders and choose Finish payment.', go:'#/shop/orders'},
  {id:'parents', q:'What do I give parents?', a:'My club → Family codes: one link and QR code per programme.', go:'#/club'},
  {id:'judges', q:'How do my coaches become judges?', a:'Share the NGL Judging Pathway link; each judge registers themselves.', go:'#/help'},
  {id:'contact', q:'Who do I talk to?', a:'Chat with us, email admin@nationalgymnasticsleague.co.uk, or book a call with Dave.', go:'#/help'}
];

// ---------- Shared NGL content (same for every club) ----------
// The competition calendar and products are NGL content; they will move into the
// database (competitions, products collections) when the admin screens are built.
export const CALENDAR = demo.competitions.map(({reserved, ref, buyBy, waiting, musicBy, ...c}) => c);
const PRODUCTS = demo.products;
const fromPrice = k => `from £${Math.min(...PRICES.licences[k].bands.map(b => b.price))} a year + VAT`;
const DEFAULT_LICENCES = {
  preschool:   {status:'explore', label:'Explore free', price:fromPrice('preschool')},
  schools:     {status:'explore', label:'Explore free', price:fromPrice('schools')},
  recreational:{status:'explore', label:'Explore free', price:fromPrice('recreational')},
  general:     {status:'waived', label:'Fee waived for 2027'},
  performance: {status:'soon', label:'Coming 2027'},
  university:  {status:'soon', label:'Coming soon'},
  masters:     {status:'soon', label:'Coming soon'}
};
// The order a club places (orders/{ORD-…}). Every line has a key k naming its entry in the price list (prices.json);
// the card-payments script recomputes every line, the VAT, the postage and the total from that list before charging.
export function orderDoc(lines, delivery = '', extra = {}){
  lines = lines.map(l => ({...l, qty: Math.round(Number(l.qty) || 0)}));
  const total = Math.round(lines.reduce((a, l) => a + l.qty * l.unit, 0) * 100) / 100;
  const paths = [...new Set(lines.map(l => l.path).filter(Boolean))];
  return {path: paths.length === 1 ? paths[0] : 'general', details: lines.filter(l => l.k !== 'vat').map(l => `${l.qty} × ${l.n}`).join(', '),
    lines, total, delivery, status: 'awaiting-payment', ...extra};
}
const code = p => p + '-' + Array.from(crypto.getRandomValues(new Uint8Array(5)), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
const iso = d => (d && d.toDate ? d.toDate() : d instanceof Date ? d : new Date(d || Date.now())).toISOString().slice(0, 10);
const minusMonths = (isoDate, m) => { const d = new Date(isoDate + 'T12:00'); d.setMonth(d.getMonth() - m); return iso(d); };

// Group buying (js/shop/groupbuy-order.js; settings and sample data live in js/admin/groupbuy.js, loaded when first needed)
const GB = () => import('./admin/groupbuy.js');
const LOGO_EXT = f => { const e = String(f && f.name || '').split('.').pop().toLowerCase(); return ['png', 'jpg', 'jpeg', 'svg', 'pdf'].includes(e) ? e : 'png'; };
const LOGO_TYPE = (f, e) => f.type || (e === 'svg' ? 'image/svg+xml' : e === 'pdf' ? 'application/pdf' : 'image/' + e);

// ---------- Sample-data backend ----------
const demoApi = {
  mode: 'demo',
  async user(){ return {uid: 'demo', email: demo.club.email}; },
  // Sample data shows the admin screens as an owner; ?demo&staff shows them as a team member with three apps ticked
  async adminMe(){ return new URLSearchParams(location.search).has('staff') ? {email: 'christine@example.com', name: 'Christine', owner: false, sections: ['competitions', 'sales', 'music']} : {email: 'admin@nationalgymnasticsleague.co.uk', name: 'Dave Brooke', owner: true, sections: []}; },
  async isAdmin(){ return true; },
  async needsVerify(){ return false; },
  async claimPending(){ return 0; },
  async club(){ return demo.club; },
  async licences(){ return demo.licences; },
  async competitions(){ return demo.competitions; },
  async music(){ return demo.music; },
  // The sample club's group-buying invoice (Shop & orders: Not paid · Finish payment) comes first
  async orders(){ return [...(await (await GB()).demoPayOrders()), ...demo.orders]; },
  async order(id){ const g = (await (await GB()).demoPayOrders()).find(x => x.id === id); if (g) return g;
    const o = demo.orders.find(x => x.id === id); if (!o) return null;
    return {...o, lines: o.lines || [{n: o.details, qty: 1, unit: o.total}], delivery: 'SAADI Gymnastics, Redbourn, AL3 7PP', placedAt: o.date, paidAt: o.status === 'paid' ? o.date : null}; },
  async payByCard(){ throw new Error('Sample data: nothing is charged.'); },
  async products(){ return demo.products; },
  async reserve(){ throw new Error('Sample data: nothing is saved. Remove ?demo from the address to use the test database.'); },
  async changeReservation(){ throw new Error('Sample data: nothing is saved.'); },
  async syncFamilyEvents(){},
  async syncFamilyPlan(){},
  async clubJudges(){ return [{name: 'Megan Hart', email: 'megan@example.com', qualification: 'Club'}, {name: 'Tom Ellis', email: 'tom@example.com', qualification: 'None'}]; },
  async judgeInvites(){ return demoInvites; },
  async inviteJudge(name, email){ const i = {id: 'demo' + demoInvites.length, name, email, at: new Date().toISOString().slice(0, 10)}; demoInvites.push(i); return i; },
  async uploadMusic(){ throw new Error('Sample data: nothing is uploaded.'); },
  async placeOrder(){ throw new Error('Sample data: nothing is saved.'); },
  // Group buying with sample data: the order is kept in memory only (it shows on the board and in NGL Admin until the page reloads)
  async groupbuyPlace(order){ const m = await GB(), id = 'demo' + Math.random().toString(36).slice(2, 9);
    const ref = 'NGL-' + order.round.replace('-', '') + '-' + id.slice(0, 5).toUpperCase();
    m.demoPlace({...order, id, ref, clubId: m.DEMO_CLUB_ID, logoPath: `groupbuy/${order.round}/${id}/front-logo.png`, createdAt: {toDate: () => new Date()}});
    return {id, ref, sample: true}; },
  async groupbuyMine(){ return (await GB()).demoGroupOrders(); },
  async groupbuyBoard(roundId, cb){ cb((await GB()).demoOpenTotals()); return () => {}; },
  async updateClub(){ throw new Error('Sample data: nothing is saved.'); },
  async signOut(){ location.replace(location.pathname); }
};

// ---------- Staging database backend ----------
let CLUB = null, ADMIN_ME;
const fbApi = {
  mode: 'firebase',
  async user(){
    const {auth, A} = await fb();
    return new Promise(res => { const off = auth.onAuthStateChanged(A, u => { off(); res(u); }); });
  },
  async club(){
    if (CLUB) return CLUB;
    const {fs, A, D} = await fb(), u = A.currentUser;
    const snap = await fs.getDoc(fs.doc(D, 'clubs', u.uid));
    CLUB = {email: u.email, ...(snap.exists() ? snap.data() : {name: 'Your club', contact: '', none: true})};   // none = an NGL team login with no club
    return CLUB;
  },
  async licences(){ const c = await this.club(); return {...DEFAULT_LICENCES, ...(c.licences || {})}; },
  // NGL owner (ADMIN_EMAILS) or team member (adminUsers/{email}, set in NGL Admin > Team). Email must be confirmed.
  async adminMe(){
    if (ADMIN_ME !== undefined) return ADMIN_ME;
    const {fs, A, D} = await fb(), u = A.currentUser; if (!u || !u.emailVerified) return (ADMIN_ME = null);
    const email = String(u.email).toLowerCase();
    if (ADMIN_EMAILS.includes(email)) return (ADMIN_ME = {email, name: '', owner: true, sections: []});
    try { const s = await fs.getDoc(fs.doc(D, 'adminUsers', email)); ADMIN_ME = s.exists() ? {email, name: s.data().name || '', owner: !!s.data().owner, sections: s.data().sections || []} : null; }
    catch (_) { ADMIN_ME = null; }
    return ADMIN_ME;
  },
  async isAdmin(){ return !!(await this.adminMe()); },
  async needsVerify(){ const {A} = await fb(), u = A.currentUser; return !!(u && !u.emailVerified); },
  // Places booked (on the old booking form) with this email before the club joined: brought in once the email is confirmed.
  async claimPending(){
    const {fs, A, D} = await fb(), u = A.currentUser; if (!u) return 0;
    if (!u.emailVerified) { await u.reload(); if (!u.emailVerified) return 0; await u.getIdToken(true); }
    const email = String(u.email).trim().toLowerCase();
    const q = await fs.getDocs(fs.query(fs.collection(D, 'pendingPlaces'), fs.where('email', '==', email)));
    if (q.empty) return 0;
    const c = await this.club(), b = fs.writeBatch(D);
    q.docs.forEach(d => { const p = d.data();
      b.set(fs.doc(D, 'reservations', d.id), {clubId: u.uid, clubName: c.name || '', compId: p.compId, places: p.places, status: p.status, ref: p.ref || d.id,
        createdAt: p.createdAt || fs.serverTimestamp(), claimedAt: fs.serverTimestamp(), movedFrom: p.movedFrom || ''});
      b.delete(d.ref); });
    await b.commit(); return q.size;
  },
  async sendVerify(){ const {auth, A} = await fb(); return auth.sendEmailVerification(A.currentUser); },
  // The competition calendar: from the database once NGL has added it, otherwise the built-in 2027 list.
  async calendar(){
    const {fs, D} = await fb(); const q = await fs.getDocs(fs.collection(D, 'competitions'));
    const list = q.docs.map(d => ({id: d.id, ...d.data()})).filter(c => c.status !== 'hidden');
    return (list.length ? list : CALENDAR).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  },
  async reservations(){
    const {fs, A, D} = await fb();
    const q = await fs.getDocs(fs.query(fs.collection(D, 'reservations'), fs.where('clubId', '==', A.currentUser.uid)));
    return q.docs.map(d => ({id: d.id, ...d.data()})).filter(r => r.status !== 'cancelled');
  },
  async competitions(){
    const [res, cal, taken] = await Promise.all([this.reservations(), this.calendar(), this.placesTaken().catch(() => ({}))]);
    return cal.map(c0 => { const c = {...c0, taken: taken[c0.id] || 0}, r = res.find(x => x.compId === c.id);
      return r ? {...c, reserved: r.status === 'waiting' ? 0 : r.places, waiting: r.status === 'waiting', bought: r.status === 'bought', ref: r.ref, buyBy: minusMonths(c.date, 3)} : c; });
  },
  // Places reserved by all clubs together, per competition (compPlaces: one row per club, places only, no names)
  async placesTaken(){ const {fs, D} = await fb(); const q = await fs.getDocs(fs.collection(D, 'compPlaces')); const t = {};
    q.docs.forEach(d => { const x = d.data(); t[x.compId] = (t[x.compId] || 0) + (Number(x.places) || 0); }); return t; },
  async setPlacesRow(compId, places){ const {fs, A, D} = await fb(), ref = fs.doc(D, 'compPlaces', compId + '__' + A.currentUser.uid);
    if (places > 0) await fs.setDoc(ref, {compId, clubId: A.currentUser.uid, places: Number(places)}); else await fs.deleteDoc(ref).catch(() => {}); },
  // Floor music. NGL admin adds musicEntries/{compId}_{clubId} from the start lists (gymnast id, name, level);
  // the club uploads one MP3 per gymnast to Storage music/{compId}/{clubId}/{gymnastId}.mp3 and a musicUploads record.
  async music(){
    const {fs, A, D} = await fb(), uid = A.currentUser.uid;
    const [ents, ups] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(D, 'musicEntries'), fs.where('clubId', '==', uid))),
      fs.getDocs(fs.query(fs.collection(D, 'musicUploads'), fs.where('clubId', '==', uid)))]);
    const up = Object.fromEntries(ups.docs.map(d => [d.id, d.data()]));
    return ents.docs.map(d => d.data()).filter(e => e.status !== 'closed').map(e => ({
      ev: {id: e.compId, title: e.title, date: e.date, deadline: e.deadline},
      gymnasts: (e.gymnasts || []).map(g => { const u = up[e.compId + '_' + g.id]; return {...g, file: u && u.fileName, url: u && u.url}; })
    })).sort((a, b) => String(a.ev.date).localeCompare(String(b.ev.date)));
  },
  async uploadMusic(compId, g, file, onProgress){
    const {fs, A, D} = await fb(), uid = A.currentUser.uid, c = await this.club();
    const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
    const {getApp} = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const path = `music/${compId}/${uid}/${g.id}.mp3`, ref = st.ref(st.getStorage(getApp()), path);
    const task = st.uploadBytesResumable(ref, file, {contentType: 'audio/mpeg', customMetadata: {club: c.name || '', gymnast: g.n}});
    await new Promise((res, rej) => task.on('state_changed', s => onProgress && onProgress(s.bytesTransferred / s.totalBytes), rej, res));
    const url = await st.getDownloadURL(ref);
    await fs.setDoc(fs.doc(D, 'musicUploads', compId + '_' + g.id), {clubId: uid, clubName: c.name || '', compId, gymnastId: g.id, gymnastName: g.n, level: g.level,
      fileName: file.name, size: file.size, path, url, uploadedAt: fs.serverTimestamp()});
  },
  async changeReservation(ref, places){
    const {fs, D} = await fb(), r = (await fs.getDoc(fs.doc(D, 'reservations', ref))).data() || {};
    await fs.updateDoc(fs.doc(D, 'reservations', ref), places > 0 ? {places: Number(places), changedAt: fs.serverTimestamp()} : {status: 'cancelled', cancelledAt: fs.serverTimestamp()});
    if (r.compId) await this.setPlacesRow(r.compId, places).catch(e => console.warn('places count', e));
  },
  async orders(){
    const {fs, A, D} = await fb();
    const q = await fs.getDocs(fs.query(fs.collection(D, 'orders'), fs.where('clubId', '==', A.currentUser.uid)));
    return q.docs.map(d => { const o = d.data();
      return {id: d.id, date: iso(o.createdAt), path: o.path, details: o.details, total: o.total, status: o.status, lines: o.lines}; })
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  async order(id){
    const {fs, D} = await fb(); const snap = await fs.getDoc(fs.doc(D, 'orders', id));
    if (!snap.exists()) return null; const o = snap.data();
    return {id, ...o, date: iso(o.createdAt), placedAt: iso(o.createdAt), paidAt: o.paidAt ? iso(o.paidAt) : null, sentAt: o.sentAt ? iso(o.sentAt) : null};
  },
  async payByCard(orderId){
    if (!CARD_PAY_URL) throw new Error('Payment isn’t available just now. Please try again shortly.');
    const {A} = await fb(), u = A.currentUser, token = await u.getIdToken();
    const r = await fetch(CARD_PAY_URL, {method: 'POST', headers: {'Content-Type': 'text/plain'},
      body: JSON.stringify({action: 'checkout', uid: u.uid, idToken: token, coll: 'orders', orderId, ret: location.href.split('#')[0] + '#/shop/orders/' + orderId})});
    const j = await r.json(); if (!j.ok) throw new Error(j.error || 'Card payment could not start.');
    location.href = j.url;
  },
  // Full Recreational programme (published by NGL): recContent/meta -> recShared/{key}/docs/*. Images come in chunks img0, img1, ...
  async recContent(){
    const {fs, D} = await fb();
    const meta = await fs.getDoc(fs.doc(D, 'recContent', 'meta')); if (!meta.exists()) return null;
    const key = meta.data().key, names = ['plan', 'warmups', 'book', 'competition', 'imgIndex', 'videos'];
    const snaps = await Promise.all(names.map(k => fs.getDoc(fs.doc(D, 'recShared', key, 'docs', k)))), c = {version: meta.data().version || ''};
    snaps.forEach((s, i) => { if (s.exists()) c[names[i]] = JSON.parse(s.data().json); });
    if (!c.plan) return null;
    const chunks = [...new Set(Object.values(c.imgIndex || {}))].sort((a, b) => a - b);
    c.images = []; await Promise.all(chunks.map(async n => { const s = await fs.getDoc(fs.doc(D, 'recShared', key, 'docs', 'img' + n)); c.images[n] = s.exists() ? JSON.parse(s.data().json) : {}; }));
    return c;
  },
  async products(){ return PRODUCTS; },
  async reserve(compId, places, waiting = false){
    const {fs, A, D} = await fb(), c = await this.club();
    const ref = code('NGL');
    await fs.setDoc(fs.doc(D, 'reservations', ref), {clubId: A.currentUser.uid, clubName: c.name || '', compId, places: Number(places), status: waiting ? 'waiting' : 'reserved', ref, createdAt: fs.serverTimestamp()});
    if (!waiting) await this.setPlacesRow(compId, places).catch(e => console.warn('places count', e));
    return ref;
  },
  async placeOrder(lines, delivery, extra = {}){
    const {fs, A, D} = await fb(), c = await this.club();
    const id = code('ORD'), doc = orderDoc(lines, delivery, extra);
    await fs.setDoc(fs.doc(D, 'orders', id), {clubId: A.currentUser.uid, clubName: c.name || '', ...doc, createdAt: fs.serverTimestamp()});
    return {id, total: doc.total};
  },
  // Group buying: one order per club per product per round (status 'placed'), plus the round's live totals, in one batch.
  // The logos upload straight after, to groupbuy/{round}/{order id}/front-logo.* and back-logo.* (storage.rules checks the order is the club's).
  async groupbuyPlace(order, files = {}){
    const {fs, A, D} = await fb(), uid = A.currentUser.uid;
    const ref1 = fs.doc(fs.collection(D, 'ngl_groupbuy_orders')), id = ref1.id, dir = `groupbuy/${order.round}/${id}/`;
    const ref = 'NGL-' + order.round.replace('-', '') + '-' + id.slice(0, 5).toUpperCase();
    const logoPath = dir + 'front-logo.' + LOGO_EXT(files.front), backLogoPath = order.back.type === 'logo' && files.back ? dir + 'back-logo.' + LOGO_EXT(files.back) : '';
    const doc = {...order, ref, clubId: uid, logoPath, back: {...order.back, logoPath: backLogoPath}, status: 'placed', createdAt: fs.serverTimestamp()};
    const b = fs.writeBatch(D);
    b.set(ref1, doc);
    b.set(fs.doc(D, 'ngl_groupbuy_rounds', `${order.round}_${order.product}`), {shirts: fs.increment(order.qty), orders: fs.increment(1), updatedAt: fs.serverTimestamp(), lastOrder: id}, {merge: true});
    await b.commit();
    let logoErr = null;
    try {
      const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
      const {getApp} = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'), S = st.getStorage(getApp());
      const up = (f, path) => st.uploadBytes(st.ref(S, path), f, {contentType: LOGO_TYPE(f, LOGO_EXT(f))});
      if (files.front) await up(files.front, logoPath);
      if (backLogoPath) await up(files.back, backLogoPath);
    } catch (e) { console.error(e); logoErr = e; }
    return {id, ref, logoErr};
  },
  async groupbuyMine(){
    const {fs, A, D} = await fb();
    const q = await fs.getDocs(fs.query(fs.collection(D, 'ngl_groupbuy_orders'), fs.where('clubId', '==', A.currentUser.uid)));
    return q.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 9e9) - ((a.createdAt && a.createdAt.seconds) || 9e9));
  },
  // Live order board: ngl_groupbuy_rounds/{round}_{product} (anyone can read). cb({JC001: {n, orders}, …}, error)
  async groupbuyBoard(roundId, cb){
    const {fs, D} = await fb(), {PRODUCTS} = await GB(), now = {};
    const offs = PRODUCTS.map(p => fs.onSnapshot(fs.doc(D, 'ngl_groupbuy_rounds', `${roundId}_${p.id}`),
      s => { const d = s.exists() ? s.data() : {}; now[p.id] = {n: d.shirts || 0, orders: d.orders || 0}; cb({...now}); }, e => { console.warn(e); cb(null, e); }));
    return () => offs.forEach(u => u());
  },
  // Graduations parents can see: familyEvents/{club uid}_{event id}, kept in step with clubs/{uid}.schoolEvents (medal counts stay private)
  async syncFamilyEvents(events){
    const {fs, A, D} = await fb(), uid = A.currentUser.uid, c = await this.club();
    const old = await fs.getDocs(fs.query(fs.collection(D, 'familyEvents'), fs.where('clubId', '==', uid)));
    const b = fs.writeBatch(D), keep = new Set((events || []).map(e => uid + '_' + e.id));
    old.docs.forEach(d => { if (!keep.has(d.id)) b.delete(d.ref); });
    (events || []).forEach(e => b.set(fs.doc(D, 'familyEvents', uid + '_' + e.id), {clubId: uid, clubName: c.name || '', programme: 'schools', title: e.title || '', schoolName: e.schoolName || '',
      date: e.date || '', time: e.time || '', venue: e.venue || '', bookingUrl: e.bookingUrl || '', updatedAt: fs.serverTimestamp()}));
    await b.commit();
  },
  // Pre-School: the term plan parents see lives on the club's family code (familyCodes/{code}.plan)
  async syncFamilyPlan(code, plan){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'familyCodes', code), {plan, updatedAt: fs.serverTimestamp()}); },
  // Judging (club side): judges whose profile carries this club's id, and the club's invites
  async clubJudges(){ const {fs, A, D} = await fb(); const q = await fs.getDocs(fs.query(fs.collection(D, 'ngl_judges'), fs.where('clubId', '==', A.currentUser.uid)));
    return q.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => String(a.name).localeCompare(String(b.name))); },
  async judgeInvites(){ const {fs, A, D} = await fb(); const q = await fs.getDocs(fs.query(fs.collection(D, 'judgeInvites'), fs.where('clubId', '==', A.currentUser.uid)));
    return q.docs.map(d => ({id: d.id, ...d.data()})); },
  async inviteJudge(name, email){ const {fs, A, D} = await fb(), c = await this.club(), r = fs.doc(fs.collection(D, 'judgeInvites'));
    const i = {clubId: A.currentUser.uid, clubName: c.name || '', name, email: email.toLowerCase(), at: new Date().toISOString().slice(0, 10)}; await fs.setDoc(r, i); return {id: r.id, ...i}; },
  async updateClub(fields){
    const {fs, A, D} = await fb();
    await fs.setDoc(fs.doc(D, 'clubs', A.currentUser.uid), fields, {merge: true});
    CLUB = null;
  },
  // Account
  async signIn(email, pw){ const {auth, A} = await fb(); CLUB = null; ADMIN_ME = undefined; return auth.signInWithEmailAndPassword(A, email, pw); },
  async register(d){
    const {auth, fs, A, D} = await fb(); CLUB = null; ADMIN_ME = undefined;
    const cred = await auth.createUserWithEmailAndPassword(A, d.email, d.password);
    await fs.setDoc(fs.doc(D, 'clubs', cred.user.uid), {name: d.name, contact: d.contact, email: d.email, bgNumber: d.bgNumber || '', phone: d.phone || '', createdAt: fs.serverTimestamp()});
    // Confirm-your-email link (made-up test addresses are skipped)
    if (!/@example\.com$/i.test(d.email)) auth.sendEmailVerification(cred.user).catch(e => console.warn('Verification email not sent', e.code || e));
    return cred;
  },
  async reset(email){ const {auth, A} = await fb(); return auth.sendPasswordResetEmail(A, email); },
  async signOut(){ const {auth, A} = await fb(); CLUB = null; window.removeEventListener('hashchange', window.NGL_ONHASH); await auth.signOut(A); location.replace(location.pathname); }
};

export { demo, DEFAULT_LICENCES, code, iso };
const api = MODE === 'demo' ? demoApi : fbApi;
export default api;
