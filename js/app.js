// NGL Club Hub: the app shell. One menu, one search, hash routes (#/section/sub)
// so every screen has its own link that can be shared or bookmarked.
import { ENV } from './config.js';
import api, { MODE } from './data.js';
import { showAuth } from './views/auth.js';
import { needGate, showGate, showWelcome } from './views/welcome.js';
import './actions.js';
import { svg, esc, toast } from './ui.js';
import { SEARCH } from './search.js';
import home from './views/home.js';
import competitions from './views/competitions.js';
import rules from './views/rules.js';
import programmes from './views/programmes.js';
import shop from './views/shop.js';
import club from './views/club.js';
import help from './views/help.js';
import admin from './views/admin.js';

const NAV = [
  ['home', 'Home', 'home', home],
  ['competitions', 'Competitions', 'comp', competitions],
  ['rules', 'Rules & resources', 'rules', rules],
  ['programmes', 'Programmes', 'prog', programmes],
  ['shop', 'Shop & orders', 'shop', shop],
  ['club', 'My club', 'club', club],
  ['help', 'Help', 'help', help]
];
const $ = s => document.querySelector(s);
const CTX = {isAdmin: false, admin: null, needsVerify: false, staffOnly: false};

// Only the newest screen request is drawn: if a club clicks again while a slow screen is
// still loading, the older one is dropped instead of replacing the screen they asked for.
let RENDER_SEQ = 0;
async function render(){
  const my = ++RENDER_SEQ, stale = () => my !== RENDER_SEQ;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let key = parts[0] === 'admin' ? 'admin' : NAV.some(n => n[0] === parts[0]) ? parts[0] : 'home';
  if (CTX.staffOnly && !['admin', 'help'].includes(key)) key = 'admin';   // NGL team login with no club
  const unpaid = CTX.staffOnly ? 0 : (await api.orders()).filter(o => o.status === 'awaiting-payment').length;
  if (stale()) return;
  $('#nav').innerHTML = NAV.filter(n => !CTX.staffOnly || n[0] === 'help').map(([k, l, i]) => {
    const badge = (k === 'shop' && unpaid) ? `<span class="badge">${unpaid}</span>` : '';
    return `<a href="#/${k}" class="${k === key ? 'on' : ''}" ${k === key ? 'aria-current="page"' : ''}>${svg(i)}<span>${l}</span>${badge}</a>`;
  }).join('') + (CTX.isAdmin ? `<a href="#/admin" class="admin-link ${key === 'admin' ? 'on' : ''}">${svg('club')}<span>NGL Admin</span></a>` : '');
  const view = key === 'admin' ? admin : NAV.find(n => n[0] === key)[3];
  const html = await view(key === parts[0] ? parts.slice(1) : [], CTX);
  if (stale()) return;
  $('#page').innerHTML = html;
  document.dispatchEvent(new CustomEvent('ngl:rendered'));
  document.title = (key === 'home' ? '' : (key === 'admin' ? 'NGL Admin' : NAV.find(n => n[0] === key)[1]) + ' · ') + 'NGL Club Hub';
}

async function start(){
  if (needGate()) return showGate();                 // phones: download the app first
  // Parents: ?demo&family shows the family side with sample codes; a parent's own codes open it straight away
  const fam = await import('./views/family.js');
  if (MODE === 'demo' && new URLSearchParams(location.search).has('family')) { fam.seedDemo(); return fam.showFamily(); }
  if (MODE === 'firebase') {
    let u = null;
    try { u = await api.user(); } catch (e) { console.error(e); }
    if (!u) { let who = ''; try { who = localStorage.getItem('ngl.who') || ''; } catch (_) {}
      if (fam.isParent()) return fam.showFamily();
      return who === 'club' ? showAuth() : showWelcome(); }   // first screen: Club or Parent
  }
  const c = await api.club(), lic = await api.licences();
  let claimed = 0; try { claimed = await api.claimPending(); } catch (e) { console.warn('Earlier places not brought in', e.code || e); }
  CTX.admin = await api.adminMe(); CTX.isAdmin = !!CTX.admin; CTX.needsVerify = await api.needsVerify(); CTX.staffOnly = !!c.none && CTX.isAdmin;   // an NGL team login with no club (a brand-new club whose account is still saving is not)
  const live = Object.entries(lic).filter(([, v]) => v.status === 'live' || v.status === 'waived').length;
  $('#clubCard').innerHTML = CTX.staffOnly ? `<b>NGL team</b><span>${esc(c.email)}</span>` : `<b>${esc(c.name)}</b><span>${live} programme${live === 1 ? '' : 's'} active</span>`;
  const who = CTX.staffOnly ? ((CTX.admin && CTX.admin.name) || c.email) : (c.contact || c.name || '');
  $('#who').innerHTML = `<span>${esc(who)}</span><div class="av">${esc(who.split(' ').map(w => w[0]).join('').slice(0, 2))}</div><button class="btn sm ghost" data-act="signout">${MODE === 'demo' ? 'Leave sample data' : 'Log out'}</button>`;
  if (ENV === 'sandbox') { $('#sandbox').hidden = false; $('#sandbox').textContent = 'SANDBOX · ' + (MODE === 'demo' ? 'sample data' : 'test database'); }
  window.NGL_RENDER = render;
  window.NGL_ONHASH = () => { render(); window.scrollTo(0, 0); };
  window.addEventListener('hashchange', window.NGL_ONHASH);
  SEARCH($('#q'), $('#res'));
  // Getting started ticks (saved on this device for now)
  document.addEventListener('click', e => { const a = e.target.closest('[data-tick]'); if (a) { const d = JSON.parse(localStorage.ngl_done || '{}'); d[a.dataset.tick] = 1; localStorage.ngl_done = JSON.stringify(d); } });
  render();
  if (claimed) setTimeout(() => toast(`We’ve added ${claimed} competition booking${claimed === 1 ? '' : 's'} your club made before joining. See Competitions → My places.`), 600);
}
start();

// Offline support (sw.js): the app and the music player still open on a reload without internet.
// Skipped in automated tests unless the address has ?sw.
if ('serviceWorker' in navigator && (!navigator.webdriver || new URLSearchParams(location.search).has('sw'))) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(reg => {
    let t = null;
    const send = () => { clearTimeout(t); t = setTimeout(() => { if (reg.active) reg.active.postMessage({cache: [location.href.split('#')[0], ...performance.getEntriesByType('resource').map(e => e.name)]}); }, 1500); };
    send(); document.addEventListener('ngl:rendered', send);
  }).catch(e => console.warn('Offline support not available', e));
}
