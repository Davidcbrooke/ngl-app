// Parents in the one NGL app. One code box for every programme: the code is LOOKED UP (familyCodes/{CODE}),
// never guessed from its format, so a code can only mean one programme at one club.
//   familyCodes/{CODE} = {programme: 'preschool'|'schools'|'recreational', clubId, clubName, status: 'active'|'inactive',
//                         expires?, key? (Recreational content), term? (Recreational), plan? (Pre-School term plan), season?}
// The phone keeps a list of the family's codes (localStorage 'ngl.family') and re-checks each one every time the app opens,
// so a code whose licence has lapsed locks again. General League needs no code.
// Each programme is its own module: js/family/<programme>.js
//   export default async function render(ctx) -> HTML   ctx = {code, doc, clubName, parts, demo}
//   export function after(ctx)  (optional: runs after the HTML is on screen)
// Modules handle their own events with document listeners guarded to #famPage, and redraw with window.NGL_FAMILY_RENDER().
import { esc, toast } from '../ui.js';
import { BRAND } from '../config.js';
import { MODE } from '../data.js';

export const PROGRAMMES = {
  preschool:    {n: 'Pre-School',     c: '#E84187', fg: '#fff'},
  schools:      {n: 'Schools',        c: '#F8D438', fg: '#28225c'},
  recreational: {n: 'Recreational',   c: '#E88230', fg: '#fff'},
  general:      {n: 'General League', c: '#0071B3', fg: '#fff'}
};
const DEMO_CODES = {
  'SAADI-P2K4': {programme: 'preschool', clubId: 'demo', clubName: 'SAADI Gymnastics', status: 'active'},
  'SAADI-7K4P': {programme: 'schools', clubId: 'demo', clubName: 'SAADI Gymnastics', status: 'active', season: '2026/27'},
  'SAADI-R9TQ': {programme: 'recreational', clubId: 'demo', clubName: 'SAADI Gymnastics', status: 'active', key: 'demo'}
};
const LS = 'ngl.family';
const DOCS = {};
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (_) { return []; } };
const save = list => { try { localStorage.setItem(LS, JSON.stringify(list)); localStorage.setItem('ngl.who', 'parent'); } catch (_) {} };
export const familyCodes = () => load();
// Sample data (?demo&family): one code for each programme
export function seedDemo(){ if (!load().length) save(Object.entries(DEMO_CODES).map(([code, d]) => ({code, programme: d.programme, clubName: d.clubName}))); }
export const isParent = () => { try { return localStorage.getItem('ngl.who') === 'parent' && load().length > 0; } catch (_) { return false; } };

// Tidy what the parent typed: capitals, no spaces, a dash after the club part if they left it out (as the Schools app did)
export function tidy(raw){
  let c = String(raw || '').toUpperCase().replace(/\s+/g, '');
  if (!c.includes('-') && /^[A-Z]{2,10}[2-9A-Z]{4}$/.test(c)) c = c.slice(0, -4) + '-' + c.slice(-4);
  return c.slice(0, 16);
}
const toDate = v => v && v.toDate ? v.toDate() : v ? new Date(v) : null;
const live = d => d && d.status === 'active' && (!d.expires || toDate(d.expires) > new Date());

async function lookup(code){
  if (MODE === 'demo') return DEMO_CODES[code] || null;
  const { fb } = await import('../firebase.js'); const {fs, D} = await fb();
  const s = await fs.getDoc(fs.doc(D, 'familyCodes', code));
  return s.exists() ? s.data() : null;
}

// Pre-School links from before (…/preschool/#p=…) still work: the term plan is inside the link
function preschoolLink(raw){
  const m = /#p=([A-Za-z0-9_-]+)/.exec(String(raw || '')); if (!m) return null;
  try { const plan = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); return {programme: 'preschool', clubName: plan.club || '', status: 'active', plan, link: true}; }
  catch (_) { return null; }
}

// Arriving from an old family site (or a club's QR code): ?code=X (or ?codes=X,Y), ?p=<old Pre-School plan>, and
// ?carry=<what the old site saved on the phone> (Recreational progress, chosen book and colour, Pre-School book).
// Only these keys are ever copied in, and a phone's own newer data is never overwritten.
const CARRY_KEYS = ['nglrec-progress', 'nglrec-book', 'nglrec-level', 'nglrec-colour', 'nglrec-tab', 'ngl-ps-book'];
const b64 = s => decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/'))));
export function hasArrival(q){ return ['code', 'codes', 'p', 'carry'].some(k => q.has(k)); }
export async function arrive(q){
  if (q.has('carry')) { try { const c = JSON.parse(b64(q.get('carry')));
    CARRY_KEYS.forEach(k => { if (c[k] != null && localStorage.getItem(k) == null) localStorage.setItem(k, typeof c[k] === 'string' ? c[k] : JSON.stringify(c[k])); }); } catch (e) { console.warn('Carried data not read', e); } }
  const raws = [...(q.get('codes') || '').split(','), q.get('code') || ''].map(s => s.trim()).filter(Boolean);
  if (q.has('p')) raws.push('#p=' + q.get('p'));
  let last = '', errs = [];
  for (const raw of raws) { try { last = await addCode(raw); } catch (e) { errs.push(e.message); } }
  try { localStorage.removeItem('ngl.pending'); } catch (_) {}
  history.replaceState(null, '', location.pathname + (location.search.includes('demo') ? '?demo' + (q.has('family') ? '&family' : '') : '') + (last ? '#/family/' + last : location.hash));
  if (errs.length && !last) toast(errs[0], false);
  return !!last || isParent();
}
// Check one code and keep it on the phone; returns its programme
async function addCode(raw){
  let code = tidy(raw), doc = preschoolLink(raw);
  if (doc) code = 'LINK-' + Math.abs([...String(raw)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7)).toString(36).toUpperCase();
  else {
    try { doc = await lookup(code); } catch (e) { console.error(e); throw new Error('Couldn’t check the code. Check your internet connection and try again.'); }
    if (!doc) throw new Error('We couldn’t find that code. Check it with your club: it looks like SAADI-7K4P.');
    if (!live(doc)) throw new Error(`The code for ${doc.clubName || 'your club'} isn’t active at the moment. Your club can switch it on.`);
  }
  const list = load().filter(x => x.code !== code);
  list.unshift({code, programme: doc.programme, clubName: doc.clubName || '', doc: doc.link ? doc : undefined});
  save(list); DOCS[code] = doc;
  return doc.programme;
}

export async function openFamily(raw){
  if (!raw) throw new Error('Enter the code your club gave you.');
  const prog = await addCode(raw);
  location.hash = '#/family/' + prog;
  showFamily();
}

let CHECKED = false;
async function recheck(){
  if (CHECKED) return; CHECKED = true;
  const list = load(), keep = [];
  for (const x of list) {
    if (x.doc && x.doc.link) { DOCS[x.code] = x.doc; keep.push(x); continue; }
    try { const d = await lookup(x.code); if (live(d)) { DOCS[x.code] = d; keep.push({...x, clubName: d.clubName || x.clubName}); } else toast(`The ${PROGRAMMES[x.programme] ? PROGRAMMES[x.programme].n : ''} code for ${x.clubName} isn’t active any more.`, false); }
    catch (_) { keep.push(x); }   // offline: keep it, check next time
  }
  save(keep);
}

export async function showFamily(){
  const root = document.getElementById('authRoot'); document.querySelector('.app').hidden = true; root.hidden = false;
  await recheck();
  const list = load();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const mine = [...new Set(list.map(x => x.programme))];
  let prog = parts[0] === 'family' && PROGRAMMES[parts[1]] ? parts[1] : (mine[0] || 'general');
  const entry = list.find(x => x.programme === prog), P = PROGRAMMES[prog];
  const tabs = [...mine, ...(mine.includes('general') ? [] : ['general'])];
  root.innerHTML = `<div class="fam" style="--pc:${P.c};--pf:${P.fg}">
    <header class="fam-top"><img src="${BRAND}ngl-logo-full.png" alt="NGL"><div class="grow"><b>${esc(entry ? entry.clubName : 'NGL families')}</b><small>${esc(P.n)}</small></div>
      <button class="btn sm ghost" data-fam="add">Add a code</button></header>
    <nav class="fam-tabs">${tabs.map(k => `<a href="#/family/${k}" class="${k === prog ? 'on' : ''}" style="--c:${PROGRAMMES[k].c}">${esc(PROGRAMMES[k].n)}</a>`).join('')}</nav>
    <main id="famPage" class="fam-page"><p class="empty">Loading…</p></main>
    <footer class="fam-foot">${list.map(x => `<span>${esc(PROGRAMMES[x.programme] ? PROGRAMMES[x.programme].n : x.programme)}: ${x.code.startsWith('LINK-') ? 'Pre-School link' : esc(x.code)}</span>`).join(' · ')}
      <br><a href="#" data-fam="switch">I’m a club</a> · <a href="#" data-fam="forget">Remove my codes</a></footer></div>`;
  root.querySelectorAll('[data-fam]').forEach(b => b.addEventListener('click', async e => { e.preventDefault();
    const w = await import('./welcome.js');
    if (b.dataset.fam === 'add') w.showParent();
    if (b.dataset.fam === 'switch') { try { localStorage.setItem('ngl.who', 'club'); } catch (_) {} location.hash = ''; location.reload(); }
    if (b.dataset.fam === 'forget') { if (!confirm('Remove your family codes from this phone?')) return; try { localStorage.removeItem(LS); localStorage.removeItem('ngl.who'); } catch (_) {} location.hash = ''; w.showWelcome(); }
  }));
  const ctx = {code: entry && entry.code, doc: entry ? (DOCS[entry.code] || entry.doc || {}) : {}, clubName: entry ? entry.clubName : '', parts: parts.slice(2), demo: MODE === 'demo'};
  const page = document.getElementById('famPage');
  try { const m = await import(`../family/${prog}.js`); page.innerHTML = await m.default(ctx); if (m.after) m.after(ctx); }
  catch (e) { console.error(e); page.innerHTML = `<div class="card empty">This part of the app couldn’t load. ${e && e.message && /Failed to fetch|import/i.test(e.message) ? 'It’s still being moved into the new app.' : 'Please try again.'}</div>`; }
}
window.NGL_FAMILY_RENDER = showFamily;
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/family') && document.querySelector('.fam')) showFamily(); });
