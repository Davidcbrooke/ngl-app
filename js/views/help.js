import { FAQ } from '../data.js';
import { CONTACT_EMAIL } from '../config.js';
import { esc, head } from '../ui.js';

export default async function help([open = 'rules']){
  return head('Help', 'The questions clubs ask most, answered.') +
  `<div class="grid g2"><div class="card faq">${FAQ.map(f => `<details ${f.id === open ? 'open' : ''} id="faq-${f.id}"><summary>${esc(f.q)}</summary><p>${esc(f.a)} <a href="${f.go}">Go there →</a></p></details>`).join('')}</div>
  <div><div class="card" style="margin-bottom:16px"><h2>Talk to us</h2><p class="lead"><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p><a class="btn" href="mailto:${CONTACT_EMAIL}">Email us</a> <a class="btn ghost" href="https://calendar.google.com/calendar/appointments/schedules/AcZssZ1pa5emRK483nT6yVVO9pG6v13zlrOaVoitoINi0GNLdXv6FkVn97TjfmYGduvNPOcocQLt6F8B" target="_blank" rel="noopener">Book a call with Dave</a></div>
  <div class="card"><h2>Make your club better</h2><p class="lead">Be Better: partner offers under five pillars (Operate, Coach, Care, Grow, Connect), including JustGo, Matt Jackson Gymnastics Consultancy, Elevate Volunteering and FB Curves 3D Gym.</p><a class="btn ghost" href="#/better">See partner offers</a></div></div></div>`;
}
