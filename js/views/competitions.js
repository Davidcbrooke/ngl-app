import api from '../data.js';
import { esc, date, dot, pill, tabs, head, ic } from '../ui.js';

const SUB = [['', 'All competitions'], ['places', 'My places'], ['music', 'Floor music'], ['results', 'Results & league tables']];
const RESULTS = [
  ['table', '2027 league table', 'Live results and the National League Table for the 2027 season', 'var(--gen)', 'https://www.nationalgymnasticsleague.co.uk/2027-season-results-and-league-table'],
  ['comp', '2026 results', 'Last season’s results, league table and National Qualifiers', 'var(--red)', 'https://www.nationalgymnasticsleague.co.uk/resultsandleaguetable'],
  ['fam', 'Training League', '13 challenges filmed in training · NGL Profile Cards', 'var(--perf)', 'https://www.nationalgymnasticsleague.co.uk/training-league']
];

export default async function competitions([sub = '']){
  const comps = await api.competitions();
  let body;
  if (sub === 'places') {
    const mine = comps.filter(c => c.reserved || c.waiting);
    body = !mine.length ? `<div class="card empty">No places reserved yet. <a href="#/competitions">See all competitions</a></div>` :
    `<p class="lead">These are reservations, not entries. We email a private JustGo link to buy your places up to 5 months before; places not bought by 3 months before go to the waiting list. You can change or cancel a reservation until then.</p>
    <div class="card"><table><tr><th>Competition</th><th>Date</th><th>Places</th><th>Buy on JustGo by</th><th>Ref</th><th></th></tr>
    ${mine.map(c => `<tr><td>${dot(c.path)} <b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.where)} · ${esc(c.who)}</small></td><td>${date(c.date)}</td>
      <td>${c.waiting ? pill('Waiting list', 'warn') : c.reserved}</td><td>${c.buyBy ? date(c.buyBy) : '–'}</td><td>${esc(c.ref || '')}</td>
      <td style="white-space:nowrap"><button class="btn sm ghost" data-act="ics" data-comp="${c.id}">Add to calendar</button>${c.ref && !c.waiting ? ` <button class="btn sm ghost" data-act="change-res" data-comp="${c.id}">Change</button>` : ''}</td></tr>`).join('')}</table></div>
    <div class="btn-row"><button class="btn ghost" data-act="ics" data-comp="all">Add all to my calendar</button></div>`;
  } else if (sub === 'music') {
    const music = await api.music();
    body = !music.length ? `<div class="card empty">Nothing to upload yet. Once your places are bought on JustGo and the start lists are out, every gymnast who needs floor music appears here.</div>` :
    `<p class="lead">MP3 only, up to 15MB, no voice-over or lyrics. We play it in the floor running order on the day. Uploading again replaces the old file.</p>` +
    music.map(m => { const done = m.gymnasts.filter(g => g.file).length;
      return `<div class="card" style="margin-bottom:16px"><div class="row" style="border:0;padding-top:0"><div class="grow"><h2 style="margin:0">${esc(m.ev.title)}</h2><small>${date(m.ev.date)} · upload by ${date(m.ev.deadline)}</small></div>${pill(done + ' of ' + m.gymnasts.length + ' uploaded', done === m.gymnasts.length ? 'ok' : 'red')}</div>
      ${m.gymnasts.map(g => `<div class="row"><div class="grow"><b>${esc(g.n)}</b><small>Level ${esc(g.level)} · ${g.file ? '✓ ' + esc(g.file) : 'Music needed'}</small>
        ${g.url ? `<audio controls preload="none" src="${esc(g.url)}" style="height:32px;margin-top:6px;max-width:100%"></audio>` : ''}<div class="upbar" id="up-${esc(m.ev.id)}-${esc(g.id)}" hidden><i></i></div></div>
        <label class="btn sm ${g.file ? 'ghost' : ''}" style="cursor:pointer">${g.file ? 'Replace' : 'Upload MP3'}<input type="file" accept="audio/mpeg,.mp3" hidden data-music="${esc(m.ev.id)}" data-gym="${esc(g.id)}"></label></div>`).join('')}</div>`; }).join('');
  } else if (sub === 'results') {
    body = `<div class="grid g3">${RESULTS.map(x => `<a class="card tile" href="${x[4]}" target="_blank" rel="noopener">${ic(x[0], x[3])}<div><b>${x[1]} ↗</b><br><small style="color:var(--muted)">${x[2]}</small></div></a>`).join('')}</div>
    <p class="lead" style="margin-top:14px">Share these with parents: <a href="#/club">My club → Family codes</a> has a link and QR code for the General League Family Hub.</p>`;
  } else {
    body = `<div class="card"><table><tr><th>Date</th><th>Competition</th><th></th><th></th></tr>${comps.map(c => `<tr><td><b>${date(c.date)}</b></td><td>${dot(c.path)} <b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.where)} · ${esc(c.who)}</small></td>
      <td>${c.waiting ? pill('Waiting list', 'warn') : c.reserved ? pill(c.reserved + ' reserved', 'ok') : ''}</td>
      <td style="text-align:right">${c.reserved || c.waiting ? '<a class="btn sm ghost" href="#/competitions/places">My places</a>' : `<button class="btn sm" data-act="reserve" data-comp="${c.id}">Reserve places</button>`}</td></tr>`).join('')}</table></div>
    <p class="lead" style="margin-top:14px">Reserving is free. Not sure which competition? <a href="#/help/level">Which level should my gymnast enter?</a></p>`;
  }
  return head('Competitions', 'Every pathway’s competitions, reserved and managed in one place.') + tabs(SUB, sub, '#/competitions') + body;
}
