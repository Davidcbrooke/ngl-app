import api from '../data.js';
import { esc, gbp, date, ic, pill, path } from '../ui.js';
import { PATHWAYS } from '../config.js';

const CHECK = [
  ['reg', 'Register your club', 'Done: welcome to the NGL', '#/club'],
  ['res', 'Reserve competition places', 'No payment until the JustGo link arrives', '#/competitions'],
  ['rules', 'Read the 2027 rules', 'Rules & resources, one click from the menu', '#/rules'],
  ['music', 'Upload floor music', 'One MP3 per gymnast before each competition', '#/competitions/music'],
  ['lic', 'Choose your programmes', 'Explore any programme free; a licence unlocks it', '#/programmes'],
  ['par', 'Share with parents', 'One link and QR code for each programme', '#/club']
];

export default async function home(){
  const [c, lic, comps, orders, music] = await Promise.all([api.club(), api.licences(), api.competitions(), api.orders(), api.music()]);
  const unpaid = orders.filter(o => o.status === 'awaiting-payment'), due = unpaid.reduce((a, o) => a + o.total, 0);
  const mine = comps.filter(x => x.reserved), places = mine.reduce((a, x) => a + x.reserved, 0), next = mine[0];
  const musicDue = music.map(m => ({...m, missing: m.gymnasts.filter(g => !g.file).length})).filter(m => m.missing);
  const needMusic = musicDue.reduce((a, m) => a + m.missing, 0), mc = musicDue[0];
  const nextAny = next || comps[0], buy = mine.find(x => x.buyBy);
  const done = Object.assign({reg: 1, res: mine.length ? 1 : 0}, JSON.parse(localStorage.ngl_done || '{}'));
  const n = CHECK.filter(x => done[x[0]]).length;
  const live = PATHWAYS.filter(p => ['live', 'waived'].includes(lic[p.k].status));
  const attn = [
    unpaid.length && [`${unpaid.length} order${unpaid.length > 1 ? 's' : ''} awaiting payment`, `${gbp(due)} · pay by card or bank transfer`, '#/shop/orders', 'Pay now', 1],
    needMusic && [`${needMusic} gymnast${needMusic === 1 ? '' : 's'} need${needMusic === 1 ? 's' : ''} floor music`, `${esc(mc.ev.title)} · by ${date(mc.ev.deadline, {day:'numeric', month:'short'})}${musicDue.length > 1 ? ' · and ' + (musicDue.length - 1) + ' more' : ''}`, '#/competitions/music', 'Upload'],
    buy && [`Buy your places on JustGo`, `${esc(buy.name)} · buy by ${date(buy.buyBy)}`, '#/competitions/places', 'View'],
    !mine.length && ['Reserve places for 2027', 'Competitions are filling fast: reserving is free', '#/competitions', 'Reserve']
  ].filter(Boolean);
  return `<h1>Welcome, ${esc(c.name)}</h1><p class="lead">Everything your club does with the NGL, in one place.</p>
  <div class="grid g4" style="margin-bottom:16px">
    <a class="card stat" href="#/shop/orders"><b>${gbp(due)}</b><span>Awaiting payment · ${unpaid.length} order${unpaid.length === 1 ? '' : 's'}</span></a>
    <a class="card stat" href="#/competitions/places"><b>${places}</b><span>Competition places reserved</span></a>
    <a class="card stat" href="#/competitions"><b>${date(nextAny.date, {day:'numeric', month:'short'})}</b><span>${next ? 'Your next' : 'Next'}: ${esc(nextAny.name)}</span></a>
    <a class="card stat" href="#/programmes"><b>${live.length}</b><span>Programmes active</span></a></div>
  <div class="grid g2">
    <div class="card attn"><h2>Needs your attention</h2>${attn.length ? '' : '<p class="empty">All done. Nothing needs you right now.</p>'}${attn.map(a => `<div class="row"><div class="grow"><b>${a[0]}</b><small>${a[1]}</small></div><a class="btn sm ${a[4] ? '' : 'ghost'}" href="${a[2]}">${a[3]}</a></div>`).join('')}</div>
    <div class="card check"><h2>Getting started</h2><div class="prog"><i style="width:${n / CHECK.length * 100}%"></i></div><small style="color:var(--muted)">${n} of ${CHECK.length} done</small>
      ${CHECK.map(x => `<a class="row ${done[x[0]] ? 'done' : ''}" href="${x[3]}" data-tick="${x[0]}"><div class="tick">✓</div><div class="grow"><b>${x[1]}</b><small>${x[2]}</small></div><span style="color:var(--muted)">›</span></a>`).join('')}</div></div>
  <h2 style="margin-top:24px">Your programmes</h2>
  <div class="grid g4">${PATHWAYS.slice(0, 4).map(p => `<a class="card tile" href="#/programmes/${p.k}">${ic('prog', p.c)}<div><b>${p.n}</b><br>${pill(lic[p.k].label, ['live', 'waived'].includes(lic[p.k].status) ? 'ok' : '')}</div></a>`).join('')}</div>`;
}
