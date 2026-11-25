// NGL Club Hub: the app shell. One menu, one search, hash routes (#/section/sub)
// so every screen has its own link that can be shared or bookmarked.
import { ENV } from './config.js';
import api from './data.js';
import { svg, esc } from './ui.js';
import { SEARCH } from './search.js';
import home from './views/home.js';
import competitions from './views/competitions.js';
import rules from './views/rules.js';
import programmes from './views/programmes.js';
import shop from './views/shop.js';
import club from './views/club.js';
import help from './views/help.js';

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

async function render(){
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const key = NAV.some(n => n[0] === parts[0]) ? parts[0] : 'home';
  const unpaid = (await api.orders()).filter(o => o.status === 'awaiting-payment').length;
  $('#nav').innerHTML = NAV.map(([k, l, i]) => {
    const badge = (k === 'shop' && unpaid) ? `<span class="badge">${unpaid}</span>` : '';
    return `<a href="#/${k}" class="${k === key ? 'on' : ''}" ${k === key ? 'aria-current="page"' : ''}>${svg(i)}<span>${l}</span>${badge}</a>`;
  }).join('');
  const view = NAV.find(n => n[0] === key)[3];
  $('#page').innerHTML = await view(parts.slice(1));
  document.title = (key === 'home' ? '' : NAV.find(n => n[0] === key)[1] + ' · ') + 'NGL Club Hub';
}

async function start(){
  const c = await api.club(), lic = await api.licences();
  const live = Object.entries(lic).filter(([, v]) => v.status === 'live' || v.status === 'waived').length;
  $('#clubCard').innerHTML = `<b>${esc(c.name)}</b><span>${live} programmes active</span>`;
  $('#who').innerHTML = `<span>${esc(c.contact)}</span><div class="av">${esc(c.contact.split(' ').map(w => w[0]).join(''))}</div>`;
  if (ENV === 'sandbox') $('#sandbox').hidden = false;
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  SEARCH($('#q'), $('#res'));
  // Getting started ticks (saved on this device for now)
  document.addEventListener('click', e => { const a = e.target.closest('[data-tick]'); if (a) { const d = JSON.parse(localStorage.ngl_done || '{}'); d[a.dataset.tick] = 1; localStorage.ngl_done = JSON.stringify(d); } });
  render();
}
start();
