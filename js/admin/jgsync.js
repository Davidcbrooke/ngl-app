// "Sync NGL sales" bookmark on MyBG opens the Club Hub with ?jgsync=1 and posts the JustGo ticket totals here.
// Saved to justgoSales/summary (events merged by JustGo reference, same as NGL Finance did), then Booked places are rebuilt.
import { fb } from '../firebase.js';
import { toast } from '../ui.js';
const MYBG = 'https://mybg.british-gymnastics.org';
let ON = false;
export function listen(){
  if (ON || !window.opener) return; ON = true;
  window.addEventListener('message', async ev => {
    if (ev.origin !== MYBG || !ev.data || ev.data.type !== 'ngl-jg-sales') return;
    const events = {}; (ev.data.events || []).forEach(x => { if (/^EV\d{6}$/.test(x.ref)) events[x.ref] = x; });
    try {
      const {fs, D} = await fb();
      await fs.setDoc(fs.doc(D, 'justgoSales', 'summary'), {events, syncedAt: ev.data.at || new Date().toISOString()}, {merge: true});
      let booked = 0; try { booked = (await (await import('./bought.js')).syncBought()).n; } catch (e) { console.warn('Booked not rebuilt', e); }
      ev.source.postMessage({type: 'ngl-jg-saved', count: Object.keys(events).length, matched: booked}, ev.origin);
      toast('JustGo sales saved: ' + Object.keys(events).length + ' events');
      location.hash = '#/admin/sales';
    } catch (e) { console.error(e); toast('Couldn’t save the JustGo sales: ' + (e.code || e.message), false); }
  });
  window.opener.postMessage('ngl-jg-ready', MYBG);
}
