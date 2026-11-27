// NGL admin data layer. Only verified NGL admin emails can use these: the database rules
// (firestore.rules, isAdmin) refuse everyone else, whatever the screen shows.
import { MODE, CALENDAR, demo, DEFAULT_LICENCES, iso } from './data.js';
import { fb, inviteLogin } from './firebase.js';
import { ADMIN_EMAILS } from './config.js';

const SAMPLE = 'Sample data: nothing is saved.';
const demoClubs = [
  {id: 'demo', ...demo.club, createdAt: '2026-04-02', licences: demo.licences},
  {id: 'c2', name: 'Northgate Gymnastics Club', contact: 'Sam Patel', email: 'info@northgate.example', bgNumber: 'BG204511', createdAt: '2026-09-21',
   licences: {...DEFAULT_LICENCES, schools: {status: 'live', label: 'Licence live', band: '50–99 gymnasts', renews: '2027-09-21'}}},
  {id: 'c3', name: 'Riverside Gym Academy', contact: 'Jo Evans', email: 'office@riverside.example', createdAt: '2026-11-24', licences: DEFAULT_LICENCES}
];
const demoOrders = demo.orders.map(o => ({...o, clubId: 'demo', clubName: demo.club.name, status: o.status === 'paid' && o.id === 'ORD-K3M7Q' ? 'sent' : o.status}));
const demoRes = demo.competitions.filter(c => c.reserved || c.waiting).map(c => ({id: c.ref || 'W-' + c.id, ref: c.ref, compId: c.id, clubId: 'demo', clubName: demo.club.name,
  places: c.reserved || 6, status: c.waiting ? 'waiting' : 'reserved', date: '2026-10-01'}));

const demoPending = [{id: 'P-SEGC1', clubName: 'SEGC', nameKey: 'segc', email: '', compId: 'c1', places: 30, status: 'reserved', ref: 'P-SEGC1'},
  {id: 'P-RAANS1', clubName: 'Raans Gymnastics', nameKey: 'raans', email: '', compId: 'c2', places: 15, status: 'reserved', ref: 'P-RAANS1'}];
// Club names compared without 'gymnastics', 'club', 'academy' and so on (same as the data move)
export const nameKey = n => String(n || '').toLowerCase().replace(/&/g, 'and').replace(/\b(gymnastics?|gym|club|academy|ltd|limited|c\.?i\.?c\.?|and|tumbling|trampoline|the)\b/g, '').replace(/[^a-z0-9]/g, '');

const demoTeam = [{email: 'admin@nationalgymnasticsleague.co.uk', name: 'Dave Brooke', owner: true, sections: []},
  {email: 'christine@example.com', name: 'Christine', owner: false, sections: ['competitions', 'sales', 'music', 'clubs']},
  {email: 'judge.lead@example.com', name: 'Sam Taylor', owner: false, sections: ['judging', 'staffing']}];
const ownersFirst = (a, b) => (b.owner - a.owner) || String(a.name || a.email).localeCompare(String(b.name || b.email));

const demoAdmin = {
  async team(){ return demoTeam; },
  async setAccess(){ throw new Error(SAMPLE); }, async invite(){ throw new Error(SAMPLE); }, async removeMember(){ throw new Error(SAMPLE); },
  async pending(){ return demoPending; },
  async attachPending(){ throw new Error(SAMPLE); },
  async clubs(){ return demoClubs; },
  async orders(){ return demoOrders; },
  async reservations(){ return demoRes; },
  async calendar(){ return CALENDAR; },
  async musicEntries(compId){ return compId === 'c1' ? [{clubId: 'demo', clubName: demo.club.name, compId, gymnasts: demo.music[0].gymnasts}] : []; },
  async musicUploads(compId){ return compId === 'c1' ? [{clubId: 'demo', clubName: demo.club.name, gymnastId: 'g1', gymnastName: 'Amelia R', level: 1, fileName: 'amelia-floor.mp3', url: '#'}] : []; },
  async setLicence(){ throw new Error(SAMPLE); }, async markSent(){ throw new Error(SAMPLE); },
  async saveComp(){ throw new Error(SAMPLE); }, async setReservation(){ throw new Error(SAMPLE); }, async syncPlaces(){ return 0; },
  async saveMusicEntry(){ throw new Error(SAMPLE); }, async importCalendar(){ throw new Error(SAMPLE); }
};

const all = async coll => { const {fs, D} = await fb(); const q = await fs.getDocs(fs.collection(D, coll)); return q.docs.map(d => ({id: d.id, ...d.data()})); };
const fbAdmin = {
  // NGL team: the two owner accounts plus adminUsers/{email}
  async team(){
    const docs = (await all('adminUsers')).map(d => ({email: d.id, name: d.name || '', owner: !!d.owner, sections: d.sections || []}));
    const owners = ADMIN_EMAILS.filter(e => !docs.some(d => d.email === e)).map(e => ({email: e, name: e.startsWith('admin@') ? 'NGL admin account' : 'Booking office', owner: true, sections: []}));
    return [...owners, ...docs].sort(ownersFirst);
  },
  async setAccess(email, sections){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'adminUsers', email), {sections, updatedAt: fs.serverTimestamp()}); },
  async invite(name, email, sections){ const {fs, D} = await fb();
    await fs.setDoc(fs.doc(D, 'adminUsers', email), {name, owner: false, sections, invitedAt: fs.serverTimestamp()});
    await inviteLogin(email); },
  async removeMember(email){ const {fs, D} = await fb(); await fs.deleteDoc(fs.doc(D, 'adminUsers', email)); },
  async clubs(){
    return (await all('clubs')).map(c => ({...c, createdAt: c.createdAt ? iso(c.createdAt) : '', licences: {...DEFAULT_LICENCES, ...(c.licences || {})}}))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  async orders(){
    return (await all('orders')).map(o => ({...o, date: iso(o.createdAt), paidAt: o.paidAt ? iso(o.paidAt) : null, sentAt: o.sentAt ? iso(o.sentAt) : null}))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  async reservations(){ return (await all('reservations')).map(r => ({...r, date: r.createdAt ? iso(r.createdAt) : ''})).filter(r => r.status !== 'cancelled'); },
  async pending(){ return (await all('pendingPlaces')).sort((a, b) => String(a.clubName).localeCompare(String(b.clubName))); },
  // Move waiting places onto a club: one reservation (same id), and the waiting record goes
  async attachPending(ids, club){
    const {fs, D} = await fb(), b = fs.writeBatch(D), list = (await all('pendingPlaces')).filter(p => ids.includes(p.id));
    list.forEach(p => { b.set(fs.doc(D, 'reservations', p.id), {clubId: club.id, clubName: club.name || '', compId: p.compId, places: p.places, status: p.status, ref: p.ref || p.id,
      createdAt: p.createdAt || fs.serverTimestamp(), attachedAt: fs.serverTimestamp(), attachedBy: 'admin', movedFrom: p.movedFrom || ''}); b.delete(fs.doc(D, 'pendingPlaces', p.id)); });
    await b.commit(); return list.length;
  },
  async calendar(){ const list = await all('competitions'); return (list.length ? list : CALENDAR).sort((a, b) => String(a.date).localeCompare(String(b.date))); },
  async calendarIsSaved(){ return (await all('competitions')).length > 0; },
  async importCalendar(){ const {fs, D} = await fb(); for (const c of CALENDAR) await fs.setDoc(fs.doc(D, 'competitions', c.id), {...c, status: 'open'}); },
  async saveComp(c){ const {fs, D} = await fb(); const {id, ...rest} = c; await fs.setDoc(fs.doc(D, 'competitions', id), rest, {merge: true}); },
  async setLicence(clubId, path, lic){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'clubs', clubId), {['licences.' + path]: lic}); },
  async markSent(orderId){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'orders', orderId), {status: 'sent', sentAt: fs.serverTimestamp()}); },
  // Places taken per competition, for clubs to see (compPlaces). Rebuilt from reservations + places waiting for a club to register.
  async syncPlaces(res, pend){ const {fs, D} = await fb(); const want = {};
    res.filter(r => ['reserved', 'bought'].includes(r.status) && r.compId).forEach(r => { const k = r.compId + '__' + r.clubId; want[k] = {compId: r.compId, clubId: r.clubId, places: (want[k] ? want[k].places : 0) + (Number(r.places) || 0)}; });
    pend.filter(p => p.status !== 'waiting' && p.compId).forEach(p => { const k = p.compId + '__pending-' + p.id; want[k] = {compId: p.compId, clubId: 'pending', places: Number(p.places) || 0}; });
    const have = {}; (await fs.getDocs(fs.collection(D, 'compPlaces'))).docs.forEach(d => { have[d.id] = d.data(); });
    const b = fs.writeBatch(D); let n = 0;
    Object.keys(want).forEach(k => { if (!have[k] || have[k].places !== want[k].places) { b.set(fs.doc(D, 'compPlaces', k), want[k]); n++; } });
    Object.keys(have).forEach(k => { if (!want[k]) { b.delete(fs.doc(D, 'compPlaces', k)); n++; } });
    if (n) await b.commit(); return n; },
  async setReservation(id, status){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'reservations', id), {status, [status + 'At']: fs.serverTimestamp()}); },
  async musicEntries(compId){ const {fs, D} = await fb(); const q = await fs.getDocs(fs.query(fs.collection(D, 'musicEntries'), fs.where('compId', '==', compId))); return q.docs.map(d => d.data()); },
  async musicUploads(compId){ const {fs, D} = await fb(); const q = await fs.getDocs(fs.query(fs.collection(D, 'musicUploads'), fs.where('compId', '==', compId))); return q.docs.map(d => d.data()); },
  async saveMusicEntry(comp, club, gymnasts){
    const {fs, D} = await fb();
    await fs.setDoc(fs.doc(D, 'musicEntries', comp.id + '_' + club.id), {compId: comp.id, clubId: club.id, clubName: club.name, title: comp.name,
      date: comp.date, deadline: comp.musicBy || comp.date, gymnasts, status: 'open', updatedAt: fs.serverTimestamp()});
  }
};

export default MODE === 'demo' ? demoAdmin : fbAdmin;
