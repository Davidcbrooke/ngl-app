// General League buttons (data-act="gl-…"): rules filters, Skills Book quantity and purchase, Family Hub sharing.
import api from '../data.js';
import { toast } from '../ui.js';
import { loadScript } from './index.js';
import { UI, BOOK, postage, totalHTML, LINKS } from './general.js';

const redraw = () => window.NGL_RENDER && window.NGL_RENDER();
const qty = () => Math.max(1, parseInt((document.getElementById('glQty') || {}).value, 10) || UI.qty || 1);

export const GL = {
  'gl-gender'(b){ UI.gender = b.dataset.v; redraw(); },
  'gl-level'(b){ UI.level = b.dataset.v; redraw(); },
  'gl-qty'(b){ UI.qty = Math.max(1, qty() + +b.dataset.d); const i = document.getElementById('glQty'); if (i) i.value = UI.qty;
    const t = document.getElementById('glTotal'); if (t) t.innerHTML = totalHTML(UI.qty); },
  async 'gl-buy'(b){
    const q = qty(); UI.qty = q; b.disabled = true; b.textContent = 'Opening secure payment…';
    try { const c = await api.club();
      const o = await api.placeOrder([{k: 'gbook', path: 'general', n: 'General Skills Book', qty: q, unit: BOOK.price}, {k: 'postage', n: 'Postage', qty: 1, unit: postage(q)}], c.deliveryAddress || '', {kind: 'supplies'});
      await api.payByCard(o.id); }
    catch (x) { console.error(x); b.disabled = false; b.textContent = 'Buy now'; toast(x.message.startsWith('Sample') ? x.message : 'Couldn’t start the order. Please try again.', false); }
  },
  async 'gl-copy-msg'(){ const t = document.getElementById('glMsg'); try { await navigator.clipboard.writeText(t.value); toast('Message copied'); } catch (_) { t.select(); toast('Press Ctrl+C to copy.'); } }
};

document.addEventListener('input', e => { if (e.target.id === 'glQty') { UI.qty = qty(); const t = document.getElementById('glTotal'); if (t) t.innerHTML = totalHTML(UI.qty); } });
// Family Hub QR code, drawn once the screen is on
document.addEventListener('ngl:rendered', async () => {
  const el = document.getElementById('glQR'); if (!el) return;
  try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
    const q = window.qrcode(0, 'M'); q.addData(LINKS.parents); q.make(); el.innerHTML = q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); } catch (_) {}
});
