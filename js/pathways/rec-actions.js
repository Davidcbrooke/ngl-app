// Recreational buttons (data-act="rec-…"). Screen state lives in recreational.js (UI); each action updates it and redraws.
import api from '../data.js';
import { modal, toast, esc, gbp } from '../ui.js';
import rec, { UI, BANDS, recPrint, recSheet } from './recreational.js';
import { vatOn } from '../prices.js';

const redraw = () => { window.NGL_RENDER && window.NGL_RENDER(); window.scrollTo(0, 0); };
const go = hash => { if (location.hash === hash) redraw(); else location.hash = hash; };

export const REC = {
  'rec-grp'(b){ const i = +b.dataset.i; UI.group = UI.group.includes(i) ? (UI.group.length > 1 ? UI.group.filter(x => x !== i) : UI.group) : [...UI.group, i].sort(); rec.saveGroup(); window.NGL_RENDER(); },
  'rec-block'(b){ UI.block = +b.dataset.v; UI.pstep = 'app'; go('#/programmes/recreational/teach/plan'); },
  'rec-piece'(b){ UI.piece = b.dataset.v; UI.pstep = 'setup'; redraw(); },
  'rec-pstep'(b){ UI.pstep = b.dataset.v; redraw(); },
  'rec-open'(b){ UI.block = +b.dataset.block; UI.piece = b.dataset.piece; UI.pstep = 'setup'; go('#/programmes/recreational/teach/plan'); },
  'rec-warm-from'(b){ UI.block = +b.dataset.v; UI.wstep = 'show'; go('#/programmes/recreational/teach/warmups'); },
  'rec-wblock'(b){ UI.block = +b.dataset.v; UI.wstep = 'show'; redraw(); },
  'rec-wstep'(b){ UI.wstep = b.dataset.v; redraw(); },
  'rec-book'(b){ UI.book = +b.dataset.v; window.NGL_RENDER(); },

  // Run your class
  'rec-run-set'(b){ const k = b.dataset.k, v = b.dataset.v; UI.run[k] = ['block', 'gi'].includes(k) ? +v : v; if (k === 'day') UI.run.cls = null; rec.saveRun(); window.NGL_RENDER(); },
  'rec-run-start'(){ UI.rstep = 'go'; UI.ri = 0; redraw(); },
  'rec-run-go'(b){ UI.ri = +b.dataset.v; redraw(); },
  'rec-run-next'(){ const n = document.querySelectorAll('.runprog .rpn').length; if (UI.ri >= n - 1) { UI.rstep = 'pick'; toast('Class finished. Well done!'); } else UI.ri++; redraw(); },
  'rec-run-exit'(){ UI.rstep = 'pick'; redraw(); },

  // Club plan builder
  'rec-cp-start'(){ UI.cstep = 1; UI.cdraft = null; redraw(); },
  'rec-cp-cancel'(){ UI.cstep = 0; redraw(); },
  'rec-cp-step'(b){ const s = document.getElementById('cpStart'), h = document.getElementById('cpHalf');
    if (s && UI.cdraft) { UI.cdraft.start = s.value; UI.cdraft.halfTerm = h ? h.value : ''; }
    UI.cstep = +b.dataset.n; redraw(); },
  'rec-cp-set'(b){ const d = UI.cdraft, k = b.dataset.k, v = b.dataset.v; if (['VT', 'BM', 'BA', 'FT'].includes(k)) d.pieces[k] = v; else d[k] = +v; window.NGL_RENDER(); },
  async 'rec-cp-save'(b){ const t = Object.assign({}, UI.cdraft, {custom: true}); b.disabled = true;
    try { await api.updateClub({recTerm: t}); rec.reset(); UI.cstep = 0; toast('Club plan saved. Coaches now see your plan.'); redraw(); }
    catch (x) { console.error(x); b.disabled = false; toast(x.message.startsWith('Sample') ? x.message : 'Couldn’t save. Please try again.', false); } },

  // Printing, photos, sharing
  'rec-print'(b){ recPrint(b.dataset.scope, b.dataset.arg); },
  'rec-sheet'(b){ recSheet(+b.dataset.level); },
  async 'rec-photo'(b){ const m = modal(`<img data-img="${esc(b.dataset.imgId)}" alt="Station set-up" style="width:100%;border-radius:12px"><div class="btn-row"><button class="btn" data-close>Close</button></div>`); await rec.hydrate(m); },
  async 'rec-copy'(b){ try { await navigator.clipboard.writeText(b.dataset.v); toast('Family link copied'); } catch (_) { toast('Press and hold the link to copy it.'); } },

  // Licence: straight to secure payment, switches on automatically when paid
  async 'rec-buy'(b){
    const band = BANDS.find(x => x.k === b.dataset.band), vat = vatOn(band.price);
    const m = modal(`<h2>Start your Recreational licence</h2><table><tr><td>Recreational Club Licence: ${esc(band.label)} (12 months)</td><td style="text-align:right">${gbp(band.price)}</td></tr>
      <tr><td>VAT (20%)</td><td style="text-align:right">${gbp(vat)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${gbp(band.price + vat)}</b></td></tr></table>
      <form><label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input type="checkbox" required style="width:auto;margin-top:4px"><span>We have ${esc(band.label.replace(' recreational gymnasts', ''))} recreational gymnasts. We’ll move up a band if that changes.</span></label>
      <div class="btn-row"><button class="btn">Continue to secure payment</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); m.remove();
      try { const o = await api.placeOrder([{k: 'licence', path: 'recreational', n: `Recreational Club Licence: ${band.label} (12 months)`, qty: 1, unit: band.price}, {k: 'vat', n: 'VAT (20%)', qty: 1, unit: vat}], '',
          {kind: 'licence', licPath: 'recreational', band: band.label}); toast('Opening secure payment…'); await api.payByCard(o.id); }
      catch (x) { console.error(x); toast(x.message.startsWith('Sample') ? x.message : 'Couldn’t start the order. Please try again.', false); } });
  }
};

// Term dates in the club plan builder keep their value while moving between steps
document.addEventListener('change', e => { const i = e.target.closest('[data-cp]'); if (i && UI.cdraft) { UI.cdraft[i.dataset.cp] = i.value; if (i.dataset.cp === 'start') window.NGL_RENDER(); } });
// Station photos load after each screen is drawn
document.addEventListener('ngl:rendered', () => { const pg = document.getElementById('page'); if (pg && pg.querySelector('img[data-img]')) rec.hydrate(pg); });
