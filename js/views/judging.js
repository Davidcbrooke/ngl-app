// Judging (club side). The Judging Pathway itself stays outside the Club Hub: a judge has their own login and only sees
// the judge screens (#/judge), never the club's hub. Here the club sees why NGL judging matters, which of its people are
// judges, and invites staff: the invite link opens the Judging Pathway with the club filled in (clubId on the judge's profile).
import api from '../data.js';
import { appLink } from '../config.js';
import { esc, pill, head, ic, date } from '../ui.js';
if (!document.querySelector('link[data-jw-css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/judging-club.css'; l.dataset.jwCss = '1'; document.head.appendChild(l); }

const WHY = [
  ['fam', 'Bring judges back', 'Many qualified judges stopped because a competition meant a whole day away. NGL makes it easy to come back and to start.'],
  ['table', 'Judge from home', 'Remote judging: judge a piece from video at home, at a time that suits you, on the same scoring screens as on the day.'],
  ['comp', 'The same judges, the same piece', 'Our vision: the same small group of judges judges the same piece at every competition across the country, so a score means the same everywhere.'],
  ['book', 'Raise capability', 'Learn through the Elevien academy, practise with the NGL judging quizzes, then shadow and second-judge before judging on your own.']
];

export default async function judging(){
  const [judges, invites] = await Promise.all([api.clubJudges(), api.judgeInvites()]);
  const reg = new Set(judges.map(j => String(j.email || '').toLowerCase()));
  const waiting = invites.filter(i => !reg.has(String(i.email || '').toLowerCase()));
  const why = `<div class="grid g4 jw-why">${WHY.map(w => `<div class="card">${ic(w[0], 'var(--perf)')}<b>${w[1]}</b><small>${w[2]}</small></div>`).join('')}</div>`;
  const list = !judges.length && !waiting.length ? `<div class="card empty">No judges from your club yet. Invite a coach or member of staff: they register on the Judging Pathway with their own login, linked to your club.</div>` :
    `<div class="card"><table><tr><th>Judge</th><th>Qualification</th><th>Status</th></tr>
    ${judges.map(j => `<tr><td><b>${esc(j.name)}</b><br><small style="color:var(--muted)">${esc(j.email || '')}</small></td><td>${esc(j.qualification || 'None yet')}</td><td>${pill('Registered', 'ok')}</td></tr>`).join('')}
    ${waiting.map(i => `<tr><td><b>${esc(i.name)}</b><br><small style="color:var(--muted)">${esc(i.email)}</small></td><td>–</td><td>${pill('Invited' + (i.at ? ' ' + date(i.at) : ''), 'warn')} <button class="btn sm ghost" data-act="judge-link" data-id="${esc(i.id)}">Invite link</button></td></tr>`).join('')}</table></div>`;
  return head('Judging', 'The NGL Judging Pathway: more judges, judging from home, and the same high standard everywhere.') +
    `<div class="card jw-hero"><p><b>Why we’re doing this.</b> Competitions only work with enough good judges, and every club feels the shortage. The NGL Judging Pathway encourages judges back into the sport, makes it easier to judge by judging from home, and builds consistency: the same few judges marking the same piece across the country. Capability grows step by step through the Elevien academy, the NGL quizzes and shadowing.</p>
     <p><b>How it works for your club.</b> Invite your coaches or staff below. Each judge gets their own Judging Pathway login: they see the judge screens only (register, qualifications and quizzes, apply to judge, their calendar), never your Club Hub.</p></div>
    ${why}
    <div class="row" style="border:0;margin:18px 0 8px;padding:0"><h2 class="grow" style="margin:0">Your club’s judges</h2><button class="btn" data-act="judge-invite">Invite a judge</button></div>
    ${list}`;
}

// The invite link: opens the app on the Judging Pathway's register screen with the club and the person filled in
export const inviteLink = (club, inv) => appLink('?judge=invite&jc=' + encodeURIComponent(club.id || '') + '&jn=' + encodeURIComponent(club.name || '') +
  '&je=' + encodeURIComponent(inv.email || '') + '&jp=' + encodeURIComponent(inv.name || ''));
