// Programmes: the pathway switcher, then the same six tabs for every pathway (DESIGN.md 6a).
import api from '../data.js';
import { PATHWAYS } from '../config.js';
import { esc, tabs, head } from '../ui.js';
import { PTABS, licenceBanner } from '../pathways/index.js';
import preschool from '../pathways/preschool.js';
import recreational from '../pathways/recreational.js';
import standard from '../pathways/standard.js';

const MODULES = {preschool, recreational};

export default async function programmes([k = 'preschool', tab = 'overview', sub]){
  const lic = await api.licences(), p = PATHWAYS.find(x => x.k === k) || PATHWAYS[0], L = lic[p.k] || {};
  const t = PTABS.some(x => x[0] === tab) ? tab : 'overview';
  const sw = `<div class="paths">${PATHWAYS.map(x => `<a class="${x.k === p.k ? 'on' : ''} ${x.yellow ? 'y' : ''}" style="--c:${x.c}" href="#/programmes/${x.k}">
    <span class="dot"></span>${esc(x.n)}</a>`).join('')}</div>`;
  let body;
  try { body = await (MODULES[p.k] || standard).render(p, t, sub); }
  catch (e) { console.error(e); body = `<div class="card empty">This section couldn’t load just now. Check your connection and try again.</div>`; }
  return head('Programmes', 'Your awards schemes, lesson plans and family apps. Choose a pathway.') + sw +
    tabs(PTABS.map(x => [x[0] === 'overview' ? '' : x[0], x[1]]), t === 'overview' ? '' : t, '#/programmes/' + p.k, p.c) +
    (t === 'licence' ? '' : licenceBanner(p, L)) + body;
}
