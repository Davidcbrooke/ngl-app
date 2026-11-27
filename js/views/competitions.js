import api from '../data.js';
import { esc, date, dot, pill, tabs, head, ic } from '../ui.js';
if (!document.querySelector('link[data-comp-css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/competitions.css'; l.dataset.compCss = '1'; document.head.appendChild(l); }

const SUB = [['', 'Coming up'], ['places', 'My places'], ['music', 'Floor music'], ['results', 'Results & league tables']];

// The four stages a club goes through for every competition
const STAGES = [
  ['Coming up', 'See every NGL competition for your pathways', '#/competitions'],
  ['Reserve places, free', 'Tell us how many gymnasts. Nothing to pay', '#/competitions'],
  ['Buy now', 'Reserved your places? Buy them on JustGo Events as soon as they’re open', '#/competitions/places'],
  ['Upload floor music', 'One MP3 per gymnast once the start lists are out', '#/competitions/music']
];
const stages = () => `<div class="comp-stages">${STAGES.map((s, i) => `<a class="card comp-stage" href="${s[2]}"><span class="comp-num">${i + 1}</span><div><b>${s[0]}</b><small>${s[1]}</small></div></a>`).join('')}</div>`;

// Where a club is with one competition, and what it can do next.
// A club that reserved places can buy them as soon as NGL saves the competition's JustGo Events link ("Open now", Buy now).
// NGL Admin's Booking setting: 'closed' hides the link from everyone; 'reserved' (the default once a link is saved) = reserved clubs only;
// 'open' = every club can buy.
const hasLink = c => /^(https:\/\/|demo:)/.test(c.justgoUrl || '');
export const stageOf = c => c.booking || (hasLink(c) ? 'reserved' : 'closed');
export const canBuy = c => !c.bought && !c.waiting && hasLink(c) && ((c.reserved > 0 && stageOf(c) !== 'closed') || stageOf(c) === 'open');
// Places left (when NGL has set a maximum): maxPlaces minus places reserved by all clubs
export const placesLeft = c => typeof c.maxPlaces === 'number' && c.maxPlaces > 0 ? Math.max(0, c.maxPlaces - (c.taken || 0)) : null;
const waitBtn = c => `<button class="btn sm ghost" data-act="reserve" data-wait="1" data-comp="${esc(c.id)}">Join waiting list</button>`;
const buyBtn = c => `<button class="btn sm" data-act="book" data-comp="${esc(c.id)}">Buy now ↗</button>`;
export function bookingState(c){
  const mine = c.reserved > 0 && !c.waiting, b = stageOf(c);
  if (c.bought) return {pill: pill('Bought', 'ok'), act: `<a class="btn sm ghost" href="#/competitions/music">Floor music</a>`};
  if (canBuy(c) && (mine || placesLeft(c) !== 0)) return {pill: pill('Open now' + (mine ? ' · ' + c.reserved + ' reserved' : ''), 'ok'), act: buyBtn(c), open: true};
  if (mine) return {pill: pill(c.reserved + ' reserved · buy link coming soon', ''), act: `<a class="btn sm ghost" href="#/competitions/places">My places</a>`};
  if (c.waiting) return {pill: pill('On the waiting list', 'warn'), act: ''};
  const left = placesLeft(c);
  if (left === 0) return {pill: pill('Fully reserved', 'red'), act: waitBtn(c)};
  const lefts = left == null ? '' : ' · ' + left + ' place' + (left === 1 ? '' : 's') + ' left';
  if (b === 'reserved' && hasLink(c)) return {pill: pill('Clubs that reserved are buying now' + lefts, 'warn'), act: `<button class="btn sm ghost" data-act="reserve" data-comp="${esc(c.id)}">Reserve: next in line</button>`};
  return {pill: pill('Reserve now' + lefts, left != null && left <= 10 ? 'warn' : ''), act: `<button class="btn sm" data-act="reserve" data-comp="${esc(c.id)}">Reserve places, free</button>`};
}
// Top of the page: every competition this club reserved, with Buy now where it's open
function reservedPanel(comps){
  const mine = comps.filter(c => c.reserved > 0 && !c.waiting);
  if (!mine.length) return '';
  return `<div class="card comp-mine"><h2>Your reserved competitions</h2><p class="lead" style="margin:0 0 8px">Buy your reserved places on JustGo Events: <b>Buy now</b> takes you straight to the competition.</p>
    ${mine.map(c => { const st = bookingState(c); return `<div class="row"><div class="grow"><b>${dot(c.path)} ${esc(c.name)}</b><small>${date(c.date)} · ${esc(c.who)} · ${c.reserved} places${c.buyBy && !c.bought ? ' · buy by ' + date(c.buyBy) : ''}</small></div>${st.pill}${st.act}</div>`; }).join('')}</div>`;
}
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
    `<p class="lead">Reserving is free and holds your places. As soon as a competition is open, a <b>Buy now</b> button appears here and takes you straight to it on JustGo Events. Places not bought by the date shown go to the waiting list.</p>
    <div class="card"><table><tr><th>Competition</th><th>Date</th><th>Places</th><th>Booking</th><th>Book by</th><th></th></tr>
    ${mine.map(c => { const st = bookingState(c); return `<tr><td>${dot(c.path)} <b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.where)} · ${esc(c.who)}${c.ref ? ' · ref ' + esc(c.ref) : ''}</small></td><td>${date(c.date)}</td>
      <td>${c.waiting ? pill('Waiting list', 'warn') : c.reserved}</td><td>${st.pill}</td><td>${c.buyBy && !c.bought ? date(c.buyBy) : '–'}</td>
      <td style="white-space:nowrap">${st.open ? st.act + ' ' : ''}<button class="btn sm ghost" data-act="ics" data-comp="${c.id}">Add to calendar</button>${c.ref && !c.waiting && !c.bought ? ` <button class="btn sm ghost" data-act="change-res" data-comp="${c.id}">Change</button>` : ''}</td></tr>`; }).join('')}</table></div>
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
    body = stages() + reservedPanel(comps) + `<h2 style="margin:18px 0 8px">All competitions</h2><div class="card"><table><tr><th>Date</th><th>Competition</th><th>Booking</th><th></th></tr>${comps.map(c => { const st = bookingState(c); return `<tr><td><b>${date(c.date)}</b></td><td>${dot(c.path)} <b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.where)} · ${esc(c.who)}</small></td>
      <td>${st.pill}</td><td style="text-align:right;white-space:nowrap">${st.act}</td></tr>`; }).join('')}</table></div>
    <p class="lead" style="margin-top:14px">Reserving is free. Not sure which competition? <a href="#/help/level">Which level should my gymnast enter?</a></p>`;
  }
  return head('Competitions', 'See what’s coming up, reserve places for free, buy them when they’re open, then upload floor music.') + tabs(SUB, sub, '#/competitions') + body;
}
