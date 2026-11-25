// Programmes: one pathway switcher; each pathway's own tools sit inside it.
// Each tool will be moved in from today's hub, one at a time (see README).
import api from '../data.js';
import { PATHWAYS } from '../config.js';
import { esc, ic, tabs, head } from '../ui.js';

const TOOLS = {
  preschool:   [['plans', 'Lesson plans', 'plan'], ['planner', 'Term planner', 'plan'], ['passports', 'Passports & medals', 'book'], ['family', 'Family app', 'fam']],
  schools:     [['schools', 'Your schools', 'prog'], ['profit', 'Profit planner', 'table'], ['awards', 'Awards & certificates', 'book'], ['graduations', 'Graduations', 'comp'], ['family', 'Family app', 'fam']],
  recreational:[['plan', 'Club plan', 'plan'], ['run', 'Run your class', 'plan'], ['books', 'Award books', 'book'], ['rotations', 'Class rotations', 'table'], ['family', 'Family app', 'fam']],
  general:     [['book', 'Skills Book', 'book'], ['training', 'Training League', 'table'], ['family', 'Family Hub', 'fam']]
};
// Where each tool lives today, until it is moved in.
const TODAY = {
  preschool: 'https://club.nationalgymnasticsleague.co.uk/preschool/club/?demo',
  schools: 'https://nglschools.co.uk/club/',
  recreational: 'https://nglrecreational.co.uk/',
  general: 'https://club.nationalgymnasticsleague.co.uk/general/?demo'
};

export default async function programmes([k = 'recreational', t]){
  const lic = await api.licences(), p = PATHWAYS.find(x => x.k === k) || PATHWAYS[2], L = lic[p.k], tools = TOOLS[p.k] || [];
  const tool = tools.find(x => x[0] === t) || tools[0];
  const sw = `<div class="paths">${PATHWAYS.map(x => `<a class="${x.k === p.k ? 'on' : ''} ${x.yellow ? 'y' : ''}" style="--c:${x.c}" href="#/programmes/${x.k}"><span class="dot"></span>${esc(x.n)}</a>`).join('')}</div>`;
  if (!tools.length) return head('Programmes', 'Your awards schemes, lesson plans and family apps. Choose a pathway.') + sw +
    `<div class="card" style="text-align:center;padding:40px"><h2>${esc(p.n)}: ${esc(L.label)}</h2><p class="lead">Register interest and we’ll tell you first.</p><button class="btn" disabled title="Sample data">Register interest</button></div>`;
  const banner = L.status === 'explore' ? `<div class="card" style="border-left:4px solid ${p.c};margin-bottom:16px"><div class="row"><div class="grow"><b>You’re exploring ${esc(p.n)}</b><small>See everything first; a licence unlocks it all. ${esc(L.price || '')}</small></div><a class="btn sm" href="#/club">Start licence</a></div></div>` : '';
  return head('Programmes', 'Your awards schemes, lesson plans and family apps. Choose a pathway.') + sw +
    tabs(tools.map(x => [x[0], x[1]]), tool[0], '#/programmes/' + p.k, p.c) + banner +
    `<div class="card"><div class="tile">${ic(tool[2], p.c)}<div><h2>${esc(tool[1])}</h2>
    <p class="lead">Being moved in from today’s ${esc(p.n)} hub. Until then it still works there, unchanged.</p>
    <a class="btn sm ghost" href="${TODAY[p.k]}" target="_blank" rel="noopener">See it in today’s hub ↗</a></div></div></div>`;
}
