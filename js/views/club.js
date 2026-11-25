import api from '../data.js';
import { PATHWAYS } from '../config.js';
import { esc, date, pill, head } from '../ui.js';

export default async function club(){
  const [c, lic] = await Promise.all([api.club(), api.licences()]);
  const codes = PATHWAYS.filter(p => lic[p.k].code);
  return head('My club', 'Your details, licences and the codes you share with parents.') +
  `<div class="grid g2"><div class="card"><h2>Licences</h2>${PATHWAYS.map(p => { const L = lic[p.k], on = ['live', 'waived'].includes(L.status);
    return `<div class="row"><span class="dot" style="background:${p.c}"></span><div class="grow"><b>${esc(p.n)}</b><small>${L.renews ? 'Renews ' + date(L.renews) + ' · ' + esc(L.band) : esc(L.price || L.label)}</small></div>${pill(L.label, on ? 'ok' : '')}</div>`; }).join('')}
    <p class="lead" style="margin:12px 0 0">One licence per programme, priced by gymnast numbers; 5% off every extra programme. <a href="https://club.nationalgymnasticsleague.co.uk/licences.html" target="_blank" rel="noopener">All licence fees ↗</a></p></div>
  <div><div class="card" style="margin-bottom:16px"><h2>Family codes</h2>
    ${codes.map(p => `<div class="row"><span class="dot" style="background:${p.c}"></span><div class="grow"><b>${esc(p.n)} · ${esc(lic[p.k].code)}</b><small>Live</small></div><button class="btn sm ghost" disabled title="Sample data">Link & QR</button></div>`).join('')}
    <div class="row"><span class="dot" style="background:var(--gen)"></span><div class="grow"><b>General League Family Hub</b><small>Results, league table, Training League</small></div><button class="btn sm ghost" disabled title="Sample data">Link & QR</button></div></div>
  <div class="card"><h2>Club details</h2><div class="row"><div class="grow"><b>${esc(c.name)}</b><small>BG club no. ${esc(c.bgNumber)} · ${esc(c.contact)}</small></div><button class="btn sm ghost" disabled title="Sample data">Edit</button></div>
    <div class="row"><div class="grow"><b>Login</b><small>${esc(c.email)} · one login for everything</small></div><button class="btn sm ghost" disabled title="Sample data">Change password</button></div></div></div></div>`;
}
