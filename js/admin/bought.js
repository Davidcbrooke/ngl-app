// Booked places per club: from the JustGo sales ("Sync NGL sales" bookmark -> justgoSales/summary). JustGo's "booked by" is
// "Person-Club"; it is matched to a registered club by name, the same way Ticket Sales does. Each club then sees "Booked · N places".
// Rows: compBought/{compId}__{clubId} = {compId, clubId, places}. Rebuilt after every sync and when Ticket Sales or Competitions opens.
import { fb } from '../firebase.js';
import { norm, clubOf, autoMatch } from './sales.js';

export async function syncBought(){
  const {fs, D} = await fb();
  const [cs, jg, cl, have] = await Promise.all([fs.getDocs(fs.collection(D, 'competitions')), fs.getDoc(fs.doc(D, 'justgoSales', 'summary')),
    fs.getDocs(fs.collection(D, 'clubs')), fs.getDocs(fs.collection(D, 'compBought'))]);
  if (!jg.exists()) return 0;
  const comps = cs.docs.map(d => ({id: d.id, ...d.data()})), x = jg.data(), events = x.events || {}, map = x.map || {};
  const clubs = cl.docs.map(d => ({id: d.id, name: d.data().name || ''})).filter(c => c.name);
  const CLUBS = clubs.map(c => ({name: c.name, n: norm(c.name)})), idOf = {}; clubs.forEach(c => { idOf[c.name] = c.id; });
  const want = {};
  Object.values(events).forEach(e => { const compId = (e.ref in map) ? map[e.ref] : autoMatch(e, comps); if (!compId) return;
    Object.entries(e.bookers || {}).forEach(([b, q]) => { const id = idOf[clubOf(b, CLUBS)]; if (!id) return;
      const k = compId + '__' + id; want[k] = {compId, clubId: id, places: (want[k] ? want[k].places : 0) + (+q || 0)}; }); });
  const old = {}; have.docs.forEach(d => { old[d.id] = d.data(); });
  const b = fs.writeBatch(D); let n = 0;
  Object.keys(want).forEach(k => { if (!old[k] || old[k].places !== want[k].places) { b.set(fs.doc(D, 'compBought', k), want[k]); n++; } });
  Object.keys(old).forEach(k => { if (!want[k]) { b.delete(fs.doc(D, 'compBought', k)); n++; } });
  if (n) await b.commit();
  return n;
}
