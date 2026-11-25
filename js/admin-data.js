// NGL admin data layer. Only verified NGL admin emails can use these: the database rules
// (firestore.rules, isAdmin) refuse everyone else, whatever the screen shows.
import { MODE, CALENDAR, demo, DEFAULT_LICENCES, iso } from './data.js';
import { fb } from './firebase.js';

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

const demoAdmin = {
  async clubs(){ return demoClubs; },
  async orders(){ return demoOrders; },
  async reservations(){ return demoRes; },
  async calendar(){ return CALENDAR; },
  async musicEntries(compId){ return compId === 'c1' ? [{clubId: 'demo', clubName: demo.club.name, compId, gymnasts: demo.music[0].gymnasts}] : []; },
  async musicUploads(compId){ return compId === 'c1' ? [{clubId: 'demo', clubName: demo.club.name, gymnastId: 'g1', gymnastName: 'Amelia R', level: 1, fileName: 'amelia-floor.mp3', url: '#'}] : []; },
  async setLicence(){ throw new Error(SAMPLE); }, async markSent(){ throw new Error(SAMPLE); },
  async saveComp(){ throw new Error(SAMPLE); }, async setReservation(){ throw new Error(SAMPLE); },
  async saveMusicEntry(){ throw new Error(SAMPLE); }, async importCalendar(){ throw new Error(SAMPLE); }
};

const all = async coll => { const {fs, D} = await fb(); const q = await fs.getDocs(fs.collection(D, coll)); return q.docs.map(d => ({id: d.id, ...d.data()})); };
const fbAdmin = {
  async clubs(){
    return (await all('clubs')).map(c => ({...c, createdAt: c.createdAt ? iso(c.createdAt) : '', licences: {...DEFAULT_LICENCES, ...(c.licences || {})}}))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  async orders(){
    return (await all('orders')).map(o => ({...o, date: iso(o.createdAt), paidAt: o.paidAt ? iso(o.paidAt) : null, sentAt: o.sentAt ? iso(o.sentAt) : null}))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  async reservations(){ return (await all('reservations')).map(r => ({...r, date: r.createdAt ? iso(r.createdAt) : ''})).filter(r => r.status !== 'cancelled'); },
  async calendar(){ const list = await all('competitions'); return (list.length ? list : CALENDAR).sort((a, b) => String(a.date).localeCompare(String(b.date))); },
  async calendarIsSaved(){ return (await all('competitions')).length > 0; },
  async importCalendar(){ const {fs, D} = await fb(); for (const c of CALENDAR) await fs.setDoc(fs.doc(D, 'competitions', c.id), {...c, status: 'open'}); },
  async saveComp(c){ const {fs, D} = await fb(); const {id, ...rest} = c; await fs.setDoc(fs.doc(D, 'competitions', id), rest, {merge: true}); },
  async setLicence(clubId, path, lic){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'clubs', clubId), {['licences.' + path]: lic}); },
  async markSent(orderId){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'orders', orderId), {status: 'sent', sentAt: fs.serverTimestamp()}); },
  async setReservation(ref, status){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'reservations', ref), {status, [status + 'At']: fs.serverTimestamp()}); },
  async musicEntries(compId){ const {fs, D} = await fb(); const q = await fs.getDocs(fs.query(fs.collection(D, 'musicEntries'), fs.where('compId', '==', compId))); return q.docs.map(d => d.data()); },
  async musicUploads(compId){ const {fs, D} = await fb(); const q = await fs.getDocs(fs.query(fs.collection(D, 'musicUploads'), fs.where('compId', '==', compId))); return q.docs.map(d => d.data()); },
  async saveMusicEntry(comp, club, gymnasts){
    const {fs, D} = await fb();
    await fs.setDoc(fs.doc(D, 'musicEntries', comp.id + '_' + club.id), {compId: comp.id, clubId: club.id, clubName: club.name, title: comp.name,
      date: comp.date, deadline: comp.musicBy || comp.date, gymnasts, status: 'open', updatedAt: fs.serverTimestamp()});
  }
};

export default MODE === 'demo' ? demoAdmin : fbAdmin;
