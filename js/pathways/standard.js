// The other pathways on the same six-tab model. Until each one's tools are moved in (one at a time,
// like Pre-School), every tab says what it holds and links to where it works today. Compete is already live
// for every pathway: it lists that pathway's competitions from the shared calendar.
import api from '../data.js';
import { esc, date, pill } from '../ui.js';
import { coming } from './index.js';

const DEF = {
  performance: {overview: 'Classic Challenge and Grades preparation competitions for gymnasts training over 10 hours a week. Coming 2027.'},
  university: {overview: 'University League competitions for students. Coming soon.'},
  masters: {overview: 'NGL Masters competitions for adult gymnasts. Coming soon.'}
};

export default {
  async render(p, tab){
    const d = DEF[p.k] || {};
    if (tab === 'compete') {
      const comps = (await api.competitions()).filter(c => c.path === p.k);
      return `<div class="card">${comps.length ? `<table><tr><th>Date</th><th>Competition</th><th></th><th></th></tr>${comps.map(c => `<tr><td><b>${date(c.date)}</b></td><td><b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.where)} · ${esc(c.who)}</small></td>
        <td>${c.waiting ? pill('Waiting list', 'warn') : c.reserved ? pill(c.reserved + ' reserved', 'ok') : ''}</td>
        <td style="text-align:right">${c.reserved || c.waiting ? '<a class="btn sm ghost" href="#/competitions/places">My places</a>' : `<button class="btn sm" data-act="reserve" data-comp="${c.id}">Reserve places</button>`}</td></tr>`).join('')}</table>`
        : `<p class="empty">No ${esc(p.n)} competitions on the calendar yet.</p>`}</div>
        <p class="lead" style="margin-top:12px"><a href="#/rules">Rules & resources</a> · <a href="#/competitions/results">Results & league tables</a></p>`;
    }
    const text = d[tab] || (tab === 'overview' ? '' : 'Coming with the launch of this pathway.');
    return coming(p, tab, esc(text) + (d.today ? '<br><br>Being moved into the new Club Hub; until then it works in today’s hub.' : ''), d.today);
  }
};
