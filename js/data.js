// Data layer. Every screen asks this file for data, never Firebase directly,
// so the sandbox (sample data) and live (Firebase) run exactly the same screens.
import { RULES_BASE, CARD_PAY_URL } from './config.js';
import { fb } from './firebase.js';

// Sample data when the address has ?demo, otherwise the staging database.
export const MODE = new URLSearchParams(location.search).has('demo') ? 'demo' : 'firebase';

const demo = {
  club: {name:'SAADI Gymnastics', contact:'Dave Brooke', email:'demo@club.example', bgNumber:'BG123456'},
  licences: {
    preschool:   {status:'explore', label:'Explore free', price:'from £150 a year + VAT'},
    schools:     {status:'live', label:'Licence live', renews:'2027-10-25', band:'250–399 gymnasts', code:'SAADI-7K4P'},
    recreational:{status:'live', label:'Licence live', renews:'2027-04-02', band:'100–249 gymnasts', code:'SAADI-R9TQ'},
    general:     {status:'waived', label:'Fee waived for 2027'},
    performance: {status:'soon', label:'Coming 2027'},
    university:  {status:'soon', label:'Coming soon'},
    masters:     {status:'soon', label:'Coming soon'}
  },
  competitions: [
    {id:'c1', date:'2027-02-07', path:'general', name:'General League · East Region', where:'SAADI Gymnastics, Harpenden', who:'Girls Levels 1–4', reserved:12, ref:'NGL-7Q2K', buyBy:'2026-11-07', musicBy:'2027-01-24'},
    {id:'c2', date:'2027-02-14', path:'general', name:'General League · East Region', where:'SAADI Gymnastics, Harpenden', who:'Boys Levels 1–4', reserved:6, ref:'NGL-8M4D', buyBy:'2026-11-14'},
    {id:'c3', date:'2027-02-21', path:'general', name:'General League · West Midlands', where:'TBC', who:'Girls & Boys'},
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
  // Prices to clubs, from context/03 (physical products table)
  products: [
    {k:'gbook', path:'general', n:'General Skills Book', d:'Levels 1–4 · RRP £8', price:4},
    {k:'recbook', path:'recreational', n:'Recreational award books', d:'Ruby, Pink, Teal, Indigo · RRP £10', price:5, needs:'recreational'},
    {k:'recmedal', path:'recreational', n:'Recreational medals', d:'Every gymnast medals · RRP £5', price:3, needs:'recreational'},
    {k:'schbook', path:'schools', n:'Schools Awards Books', d:'One book for the whole programme · RRP £10', price:5, needs:'schools'},
    {k:'schcert', path:'schools', n:'Schools certificates', d:'Bronze, Silver and Gold', price:0.1, needs:'schools'},
    {k:'pspass', path:'preschool', n:'Pre-School passports', d:'Book 1 and Book 2 · RRP £10', price:5, needs:'preschool'},
    {k:'psmedal', path:'preschool', n:'Pre-School country medals', d:'20 countries · RRP £4', price:2, needs:'preschool'},
    {k:'tshirt', path:'recreational', n:'Children’s NGL t-shirt', d:'RRP £17–20', price:12, needs:'recreational'},
    {k:'kit', path:null, n:'Group Buying: staff kit', d:'Your logo, ordered every quarter', price:null}
  ]
};

export const RULES = [
  {group:'General League', path:'general', items:[
    {t:'Girls (WAG) rules 2027', d:'Levels 1–4: competition rules and common deductions', url:RULES_BASE + 'NGL_General_League_WAG_Rules_2027.pdf'},
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
const CALENDAR = demo.competitions.map(({reserved, ref, buyBy, waiting, ...c}) => c);
const PRODUCTS = demo.products;
const DEFAULT_LICENCES = {
  preschool:   {status:'explore', label:'Explore free', price:'from £150 a year + VAT'},
  schools:     {status:'explore', label:'Explore free', price:'from £150 a year + VAT'},
  recreational:{status:'explore', label:'Explore free', price:'from £200 a year + VAT'},
  general:     {status:'waived', label:'Fee waived for 2027'},
  performance: {status:'soon', label:'Coming 2027'},
  university:  {status:'soon', label:'Coming soon'},
  masters:     {status:'soon', label:'Coming soon'}
};
const code = p => p + '-' + Array.from(crypto.getRandomValues(new Uint8Array(5)), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
const iso = d => (d && d.toDate ? d.toDate() : d instanceof Date ? d : new Date(d || Date.now())).toISOString().slice(0, 10);
const minusMonths = (isoDate, m) => { const d = new Date(isoDate + 'T12:00'); d.setMonth(d.getMonth() - m); return iso(d); };

// ---------- Sample-data backend ----------
const demoApi = {
  mode: 'demo',
  async user(){ return {uid: 'demo', email: demo.club.email}; },
  async club(){ return demo.club; },
  async licences(){ return demo.licences; },
  async competitions(){ return demo.competitions; },
  async music(){ return demo.music; },
  async orders(){ return demo.orders; },
  async order(id){ const o = demo.orders.find(x => x.id === id); if (!o) return null;
    return {...o, lines: o.lines || [{n: o.details, qty: 1, unit: o.total}], delivery: 'SAADI Gymnastics, Redbourn, AL3 7PP', placedAt: o.date, paidAt: o.status === 'paid' ? o.date : null}; },
  async payByCard(){ throw new Error('Sample data: nothing is charged.'); },
  async products(){ return demo.products; },
  async reserve(){ throw new Error('Sample data: nothing is saved. Remove ?demo from the address to use the test database.'); },
  async changeReservation(){ throw new Error('Sample data: nothing is saved.'); },
  async uploadMusic(){ throw new Error('Sample data: nothing is uploaded.'); },
  async placeOrder(){ throw new Error('Sample data: nothing is saved.'); },
  async updateClub(){ throw new Error('Sample data: nothing is saved.'); },
  async signOut(){ location.replace(location.pathname); }
};

// ---------- Staging database backend ----------
let CLUB = null;
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
    CLUB = {email: u.email, ...(snap.exists() ? snap.data() : {name: 'Your club', contact: ''})};
    return CLUB;
  },
  async licences(){ const c = await this.club(); return {...DEFAULT_LICENCES, ...(c.licences || {})}; },
  async reservations(){
    const {fs, A, D} = await fb();
    const q = await fs.getDocs(fs.query(fs.collection(D, 'reservations'), fs.where('clubId', '==', A.currentUser.uid)));
    return q.docs.map(d => ({id: d.id, ...d.data()})).filter(r => r.status !== 'cancelled');
  },
  async competitions(){
    const res = await this.reservations();
    return CALENDAR.map(c => { const r = res.find(x => x.compId === c.id);
      return r ? {...c, reserved: r.status === 'waiting' ? 0 : r.places, waiting: r.status === 'waiting', ref: r.ref, buyBy: minusMonths(c.date, 3)} : c; });
  },
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
    const {fs, D} = await fb();
    await fs.updateDoc(fs.doc(D, 'reservations', ref), places > 0 ? {places: Number(places), changedAt: fs.serverTimestamp()} : {status: 'cancelled', cancelledAt: fs.serverTimestamp()});
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
  async products(){ return PRODUCTS; },
  async reserve(compId, places){
    const {fs, A, D} = await fb(), c = await this.club();
    const ref = code('NGL');
    await fs.setDoc(fs.doc(D, 'reservations', ref), {clubId: A.currentUser.uid, clubName: c.name || '', compId, places: Number(places), status: 'reserved', ref, createdAt: fs.serverTimestamp()});
    return ref;
  },
  async placeOrder(lines, delivery){
    const {fs, A, D} = await fb(), c = await this.club();
    const id = code('ORD'), total = lines.reduce((a, l) => a + l.qty * l.unit, 0);
    const paths = [...new Set(lines.map(l => l.path).filter(Boolean))];
    await fs.setDoc(fs.doc(D, 'orders', id), {clubId: A.currentUser.uid, clubName: c.name || '', path: paths.length === 1 ? paths[0] : 'general',
      details: lines.map(l => `${l.qty} × ${l.n}`).join(', '), lines, total, delivery, status: 'awaiting-payment', createdAt: fs.serverTimestamp()});
    return {id, total};
  },
  async updateClub(fields){
    const {fs, A, D} = await fb();
    await fs.setDoc(fs.doc(D, 'clubs', A.currentUser.uid), fields, {merge: true});
    CLUB = null;
  },
  // Account
  async signIn(email, pw){ const {auth, A} = await fb(); CLUB = null; return auth.signInWithEmailAndPassword(A, email, pw); },
  async register(d){
    const {auth, fs, A, D} = await fb(); CLUB = null;
    const cred = await auth.createUserWithEmailAndPassword(A, d.email, d.password);
    await fs.setDoc(fs.doc(D, 'clubs', cred.user.uid), {name: d.name, contact: d.contact, email: d.email, bgNumber: d.bgNumber || '', phone: d.phone || '', createdAt: fs.serverTimestamp()});
    return cred;
  },
  async reset(email){ const {auth, A} = await fb(); return auth.sendPasswordResetEmail(A, email); },
  async signOut(){ const {auth, A} = await fb(); CLUB = null; window.removeEventListener('hashchange', window.NGL_ONHASH); await auth.signOut(A); location.replace(location.pathname); }
};

const api = MODE === 'demo' ? demoApi : fbApi;
export default api;
