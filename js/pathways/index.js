// One model for every pathway (DESIGN.md 6a): the same six tabs, same order, same names.
// Each pathway module supplies the content; anything it doesn't supply yet shows the standard "Coming" card.
import { esc, ic } from '../ui.js';

export const PTABS = [
  ['overview', 'Overview', 'home'],
  ['teach', 'Teach', 'plan'],
  ['awards', 'Awards', 'book'],
  ['compete', 'Compete', 'comp'],
  ['families', 'Families', 'fam'],
  ['licence', 'Licence', 'club']
];

export const coming = (p, tab, text, today) => `<div class="card" style="text-align:center;padding:36px 20px">${ic(PTABS.find(t => t[0] === tab)[2], p.c)}
  <h2 style="margin-top:12px">${esc(p.n)}: ${esc(PTABS.find(t => t[0] === tab)[1])}</h2>
  <p class="lead">${text || 'Coming soon.'}</p>${today ? `<a class="btn ghost" href="${today}" target="_blank" rel="noopener">Use it in today’s hub ↗</a>` : ''}</div>`;

// Licence status banner shown at the top of every pathway tab
export function licenceBanner(p, L){
  if (['live', 'waived'].includes(L.status)) return '';
  if (L.status === 'soon') return `<div class="card" style="border-left:4px solid ${p.c};margin-bottom:16px"><div class="row" style="border:0"><div class="grow"><b>${esc(p.n)} is ${esc(L.label.toLowerCase())}</b><small>Register interest and we’ll tell you first.</small></div><button class="btn sm ghost" disabled title="Coming soon">Register interest</button></div></div>`;
  return `<div class="card" style="border-left:4px solid ${p.c};margin-bottom:16px"><div class="row" style="border:0"><div class="grow"><b>You’re exploring ${esc(p.n)}</b><small>See everything first; a licence unlocks it all. ${esc(L.price || '')}</small></div><a class="btn sm" href="#/programmes/${p.k}/licence">See licence</a></div></div>`;
}

// Load an old-style script (sets a global) once
const loaded = {};
export const loadScript = src => loaded[src] || (loaded[src] = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); };
  document.head.appendChild(s);
}));

// Print a block of HTML on its own (term calendars, QR posters). The app is hidden while printing.
export function printHTML(html, title){
  let pa = document.getElementById('printArea');
  if (!pa) { pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
  pa.innerHTML = html; document.body.classList.add('printing');
  const t = document.title; if (title) document.title = title;
  const imgs = [...pa.querySelectorAll('img')].filter(i => !i.complete);
  let done = false; const go = () => { if (done) return; done = true;
    pa.querySelectorAll('[data-fit]').forEach(el => { let f = parseFloat(getComputedStyle(el).fontSize), k = 0; while (el.scrollHeight > el.clientHeight + 1 && k++ < 14) { f *= .94; el.style.fontSize = f + 'px'; } });
    window.print(); document.title = t; document.body.classList.remove('printing'); };
  if (!imgs.length) go(); else { Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(go); setTimeout(go, 4000); }
}
