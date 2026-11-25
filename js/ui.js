// Small shared helpers: icons, formatting, building blocks used by every screen.
import { PATHWAYS } from './config.js';

const I = {
  home:'<path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/>',
  comp:'<path d="M8 4h8v4a4 4 0 0 1-8 0zM6 4H3v2a3 3 0 0 0 3 3M18 4h3v2a3 3 0 0 1-3 3M12 12v4M8 20h8M10 16h4v4h-4z"/>',
  rules:'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h8"/>',
  prog:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/>',
  shop:'<path d="M5 7h14l-1 13H6z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  club:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.5"/>',
  music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  table:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
  fam:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 8 0"/>',
  plan:'<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>'
};
export const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k] || I.rules}</svg>`;
export const ic = (k, c) => `<div class="ic" style="background:${c}">${svg(k)}</div>`;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const gbp = n => '£' + Number(n).toLocaleString('en-GB', {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2});
export const date = (iso, o = {day:'numeric', month:'short', year:'numeric'}) => new Date(iso + 'T12:00').toLocaleDateString('en-GB', o);
export const path = k => PATHWAYS.find(p => p.k === k);
export const dot = k => `<span class="dot" style="display:inline-block;background:${k ? path(k).c : 'var(--red)'}"></span>`;
export const pill = (text, kind = '') => `<span class="pill ${kind}">${esc(text)}</span>`;
export const tabs = (items, active, base, accent) => `<div class="sub" style="${accent ? '--c:' + accent : ''}">${items.map(([k, l]) =>
  `<a class="${k === active ? 'on' : ''}" href="${base}${k ? '/' + k : ''}">${esc(l)}</a>`).join('')}</div>`;
export const head = (title, lead) => `<h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}`;

// Pop-up dialog. Returns the dialog element; any [data-close] closes it.
export function modal(html){
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) bg.remove(); });
  document.body.appendChild(bg);
  const f = bg.querySelector('input,select,textarea,button'); if (f) f.focus();
  return bg;
}
export function toast(msg, ok = true){
  const t = document.createElement('div'); t.className = 'toast ' + (ok ? 'ok' : 'bad'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 4200);
}
