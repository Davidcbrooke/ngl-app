import { RULES } from '../data.js';
import { esc, ic, head, path } from '../ui.js';

export default async function rules(){
  return head('Rules & resources', 'Every rule book and guide, one click from anywhere. Or press <b>/</b> and search.') +
  `<div class="grid g2">${RULES.map(g => { const c = g.path ? path(g.path).c : 'var(--red)';
    return `<div class="card"><h2 style="display:flex;gap:10px;align-items:center"><span class="dot" style="background:${c}"></span>${esc(g.group)}</h2>
    ${g.items.map(r => `<div class="row">${ic('rules', c)}<div class="grow"><b>${esc(r.t)}</b><small>${esc(r.d)}</small></div>${
      r.url ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(r.url)}">Open PDF</a>` : r.route ? `<a class="btn sm ghost" href="${r.route}">Read</a>` : '<span class="pill">Adding soon</span>'}</div>`).join('')}</div>`; }).join('')}</div>`;
}
