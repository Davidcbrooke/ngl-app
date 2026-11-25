import api from '../data.js';
import { esc, date, dot, pill, tabs, head, ic } from '../ui.js';

const SUB = [['', 'All competitions'], ['places', 'My places'], ['music', 'Floor music'], ['results', 'Results & league tables']];

export default async function competitions([sub = '']){
  const comps = await api.competitions();
  let body;
  if (sub === 'places') {
    const mine = comps.filter(c => c.reserved || c.waiting);
    body = `<p class="lead">These are reservations, not entries. We email a private JustGo link to buy your places up to 5 months before; places not bought by 3 months before go to the waiting list.</p>
    <div class="card"><table><tr><th>Competition</th><th>Date</th><th>Places</th><th>Buy on JustGo by</th><th>Ref</th></tr>
    ${mine.map(c => `<tr><td>${dot(c.path)} <b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.who)}</small></td><td>${date(c.date)}</td><td>${c.waiting ? pill('Waiting list', 'warn') : c.reserved}</td><td>${c.buyBy ? date(c.buyBy) : '–'}</td><td>${esc(c.ref || '')}</td></tr>`).join('')}</table></div>`;
  } else if (sub === 'music') {
    const m = await api.music(), c = comps.find(x => x.id === m.comp);
    body = `<div class="card"><h2>${esc(c.name)} · ${date(c.date, {day:'numeric', month:'short'})}</h2><p class="lead">MP3 only, up to 15MB, no voice-over or lyrics. Upload by ${date(c.musicBy)}. Uploading again replaces the old file.</p>
    ${m.gymnasts.map(g => `<div class="row"><div class="grow"><b>${esc(g.n)}</b><small>Level ${g.level} · ${g.file ? 'Uploaded: ' + esc(g.file) : 'Music needed'}</small></div><button class="btn sm ${g.file ? 'ghost' : ''}" disabled title="Sample data">${g.file ? 'Replace' : 'Upload'}</button></div>`).join('')}</div>`;
  } else if (sub === 'results') {
    body = `<div class="grid g3">${[
      ['table', '2027 National League Table', 'Live all season', 'var(--gen)', 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/'],
      ['comp', '2026 results', 'Every competition and the Finals', 'var(--red)', 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/'],
      ['fam', 'Training League', '13 challenges · NGL Profile Cards', 'var(--perf)', 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/']
    ].map(x => `<div class="card tile">${ic(x[0], x[3])}<div><b>${x[1]}</b><br><small style="color:var(--muted)">${x[2]}</small><br><a class="btn sm ghost" style="margin-top:8px" href="${x[4]}" target="_blank" rel="noopener">Open</a></div></div>`).join('')}</div>`;
  } else {
    body = `<div class="card"><table><tr><th>Date</th><th>Competition</th><th></th><th></th></tr>${comps.map(c => `<tr><td><b>${date(c.date)}</b></td><td>${dot(c.path)} <b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.where)} · ${esc(c.who)}</small></td>
      <td>${c.waiting ? pill('Waiting list', 'warn') : c.reserved ? pill(c.reserved + ' reserved', 'ok') : ''}</td>
      <td style="text-align:right">${c.reserved || c.waiting ? '<a class="btn sm ghost" href="#/competitions/places">Details</a>' : '<button class="btn sm" disabled title="Sample data">Reserve places</button>'}</td></tr>`).join('')}</table></div>
    <p class="lead" style="margin-top:14px">Reserve with no payment. Not sure which competition? <a href="#/help/level">Which level should my gymnast enter?</a></p>`;
  }
  return head('Competitions', 'Every pathway’s competitions, reserved and managed in one place.') + tabs(SUB, sub, '#/competitions') + body;
}
