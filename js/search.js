// Search across the whole Club Hub: screens, rules, help answers.
import { RULES, FAQ } from './data.js';
import { esc, svg } from './ui.js';

const SCREENS = [
  ['Home', '#/home', 'Home', 'dashboard attention'],
  ['Reserve competition places', '#/competitions', 'Competitions', 'book enter entry calendar dates'],
  ['My reserved places', '#/competitions/places', 'Competitions', 'reservations justgo buy waiting list'],
  ['Floor music upload', '#/competitions/music', 'Competitions', 'mp3 floor music'],
  ['Results and league tables', '#/competitions/results', 'Competitions', 'scores national league table training league'],
  ['Shop', '#/shop', 'Shop & orders', 'order buy books medals certificates passports kit'],
  ['Orders, payments and receipts', '#/shop/orders', 'Shop & orders', 'invoice pay card bank receipt apple google'],
  ['Lesson plans', '#/programmes/recreational', 'Programmes', 'plans warm-ups stations'],
  ['Pre-School', '#/programmes/preschool', 'Programmes', 'somi flic passport this week'],
  ['Pre-School term planner', '#/programmes/preschool/teach', 'Programmes', 'term dates calendar print somi flic'],
  ['Pre-School lesson plans', '#/programmes/preschool/teach/plans', 'Programmes', 'plans pdf instagram post caption seasonal'],
  ['Pre-School passports and medals', '#/programmes/preschool/awards', 'Programmes', 'passport book medals countries poster'],
  ['Pre-School family app', '#/programmes/preschool/families', 'Programmes', 'parents qr poster flyer link'],
  ['Pre-School licence and packs', '#/programmes/preschool/licence', 'Programmes', 'price bands lesson plan pack seasonal'],
  ['Schools', '#/programmes/schools', 'Programmes', 'graduation profit planner'],
  ['Recreational', '#/programmes/recreational', 'Programmes', 'this fortnight ruby pink teal indigo'],
  ['Run your class (Recreational)', '#/programmes/recreational/teach', 'Programmes', 'rotations warm-up cool-down coach tablet'],
  ['Recreational lesson plan', '#/programmes/recreational/teach/plan', 'Programmes', 'stations fortnight set-up photos skills ladder print'],
  ['Recreational warm-ups', '#/programmes/recreational/teach/warmups', 'Programmes', 'pulse mobility strength'],
  ['Recreational club plan', '#/programmes/recreational/teach/club', 'Programmes', 'term apparatus weeks class length build'],
  ['Recreational award books', '#/programmes/recreational/awards', 'Programmes', 'ruby pink teal indigo levels assessment sheet'],
  ['Recreational competition routines', '#/programmes/recreational/compete', 'Programmes', 'routines floor vault beam bars rules'],
  ['General League', '#/programmes/general', 'Programmes', 'skills book training league family hub'],
  ['Licences and renewals', '#/club', 'My club', 'licence price cost renew band'],
  ['Family codes for parents', '#/club', 'My club', 'parents app code qr'],
  ['Club details and password', '#/club', 'My club', 'password login email bg number'],
  ['Club Support partner offers', '#/help', 'Help', 'partners discount hr coaching safeguarding'],
  ['Contact NGL', '#/help', 'Help', 'email chat call dave']
];
const INDEX = [
  ...SCREENS.map(([t, go, where, words]) => ({t, go, where, words})),
  ...RULES.flatMap(g => g.items.map(r => ({t: r.t, go: r.url || r.route || '#/rules', where: 'Rules & resources', words: 'rules ' + g.group + ' ' + r.d, ext: !!r.url}))),
  ...FAQ.map(f => ({t: f.q, go: '#/help/' + f.id, where: 'Help', words: f.a}))
];

export function SEARCH(input, box){
  const close = () => box.classList.remove('open');
  input.addEventListener('input', () => {
    const v = input.value.trim().toLowerCase();
    if (!v) return close();
    const words = v.split(/\s+/);
    const hits = INDEX.map(x => {
      const hay = (x.t + ' ' + x.words).toLowerCase();
      const score = words.every(w => hay.includes(w)) ? (x.t.toLowerCase().includes(v) ? 2 : 1) : 0;
      return {...x, score};
    }).filter(x => x.score).sort((a, b) => b.score - a.score).slice(0, 8);
    box.innerHTML = hits.length ? hits.map(x => `<a href="${esc(x.go)}" ${x.ext ? 'target="_blank" rel="noopener"' : ''}>${svg(x.where === 'Rules & resources' ? 'rules' : x.where === 'Help' ? 'help' : 'prog')}<span>${esc(x.t)}</span><small>${esc(x.where)}${x.ext ? ' · PDF' : ''}</small></a>`).join('')
      : '<div style="padding:10px;color:var(--muted)">No match. Try "rules", "music" or "receipt".</div>';
    box.classList.add('open');
  });
  box.addEventListener('click', () => { input.value = ''; close(); });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) close(); });
  document.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); } if (e.key === 'Escape') { close(); input.blur(); } });
}
