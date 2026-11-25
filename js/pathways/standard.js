// The other pathways on the same six-tab model. Until each one's tools are moved in (one at a time,
// like Pre-School), every tab says what it holds and links to where it works today. Compete is already live
// for every pathway: it lists that pathway's competitions from the shared calendar.
import api from '../data.js';
import { esc, date, pill } from '../ui.js';
import { coming } from './index.js';

const DEF = {
  schools: {today: 'https://nglschools.co.uk/club/',
    overview: 'A ready-to-deliver gymnastics programme your club takes into local schools: you own the relationships, deliver the coaching and keep the income.',
    teach: 'Six progressive levels across Floor, Bench and Vault, plus the Profit planner and Secondary planner.',
    awards: 'The NGL Schools Awards Book with Bronze, Silver and Gold certificates all year.',
    families: 'One family app code for all your Schools families: routines, videos and events.',
    licence: 'One yearly Club Licence, banded by how many Schools gymnasts you coach. From £150 a year + VAT.'},
  recreational: {today: 'https://nglrecreational.co.uk/',
    overview: 'A complete recreational programme from first forward roll to Indigo: lesson plans, warm-ups, award books and competitions that line up.',
    teach: 'Your club plan, built around your apparatus and term length; Run your class on an iPad; warm-ups; class rotations.',
    awards: 'Four award books, Ruby to Indigo, 16 levels assessed at the end of each term, and medals.',
    families: 'One family app code so parents see this fortnight’s skills and where they lead.',
    licence: 'One yearly Club Licence, banded by how many Recreational gymnasts you have. From £200 a year + VAT.'},
  general: {today: 'https://club.nationalgymnasticsleague.co.uk/general/',
    overview: 'The NGL General League for gymnasts training 2–10 hours a week: compete locally, score nationally, qualify for the National Finals.',
    teach: 'The Training League: 13 conditioning challenges filmed in training that build every gymnast’s NGL Profile Card.',
    awards: 'The NGL General Skills Book: one book for Levels 1–4 with Bronze, Silver and Gold execution. £4 a book (RRP £8).',
    families: 'One Family Hub link for parents: results, the National League Table and the Training League.',
    licence: 'The General League Club Licence fee is waived for 2027 for every club on the NGL Club Hub.'},
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
