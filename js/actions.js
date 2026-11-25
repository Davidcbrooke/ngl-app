// Buttons that do something (data-act="…"): reserve places, basket, checkout,
// edit club details, sign out. Every write goes through the data layer.
import api from './data.js';
import { modal, toast, esc, gbp } from './ui.js';
import { showInvoice } from './invoice.js';

const rerender = () => window.NGL_RENDER && window.NGL_RENDER();
export const basket = {
  get(){ try { return JSON.parse(sessionStorage.ngl_basket || '[]'); } catch { return []; } },
  set(b){ sessionStorage.ngl_basket = JSON.stringify(b.filter(l => l.qty > 0)); }
};
const POSTAGE = qty => qty <= 20 ? 4 : qty <= 100 ? 8 : 12;   // same bands as the Skills Book checkout
export const totals = lines => { const items = lines.reduce((a, l) => a + l.qty * l.unit, 0), qty = lines.reduce((a, l) => a + l.qty, 0);
  const post = qty ? POSTAGE(qty) : 0; return {items, post, total: items + post, qty}; };

const ACT = {
  async signout(){ await api.signOut(); },

  async reserve(b){
    const comps = await api.competitions(), c = comps.find(x => x.id === b.dataset.comp);
    const m = modal(`<h2>Reserve places</h2><p class="lead"><b>${esc(c.name)}</b><br>${esc(c.where)} · ${esc(c.who)}</p>
      <form><label class="field"><span>How many gymnast places?</span><input id="n" type="number" min="1" max="200" value="10" required></label>
      <p class="lead" style="font-size:14px">No payment now. We email a private JustGo link to buy your places up to 5 months before; places not bought by 3 months before go to the waiting list.</p>
      <p class="err" id="err"></p><div class="btn-row"><button class="btn">Reserve</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const btn = m.querySelector('.btn'); btn.disabled = true;
      try { const ref = await api.reserve(c.id, m.querySelector('#n').value); m.remove(); toast('Reserved. Your reference is ' + ref); location.hash = '#/competitions/places'; rerender(); }
      catch (x) { m.querySelector('#err').textContent = x.message.startsWith('Sample') ? x.message : 'Couldn’t reserve. Please try again.'; console.error(x); btn.disabled = false; } });
  },

  async add(b){
    const p = (await api.products()).find(x => x.k === b.dataset.prod), bk = basket.get(), line = bk.find(l => l.k === p.k);
    if (line) line.qty += 10; else bk.push({k: p.k, n: p.n, path: p.path, unit: p.price, qty: 10});
    basket.set(bk); toast(`${p.n} added to your basket`); rerender();
  },
  async inc(b){ const bk = basket.get(), l = bk.find(x => x.k === b.dataset.prod); l.qty += Number(b.dataset.by); basket.set(bk); rerender(); },

  async checkout(){
    const lines = basket.get(), t = totals(lines), c = await api.club();
    const m = modal(`<h2>Place your order</h2>
      <table>${lines.map(l => `<tr><td>${l.qty} × ${esc(l.n)}</td><td style="text-align:right">${gbp(l.qty * l.unit)}</td></tr>`).join('')}
      <tr><td>Postage</td><td style="text-align:right">${gbp(t.post)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${gbp(t.total)}</b></td></tr></table>
      <form><label class="field"><span>Deliver to</span><textarea id="addr" rows="3" required placeholder="Club name, street, town, postcode">${esc(c.deliveryAddress || '')}</textarea></label>
      <p class="err" id="err"></p><div class="btn-row"><button class="btn">Place order: pay by card or bank transfer</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const btn = m.querySelector('.btn'); btn.disabled = true;
      const addr = m.querySelector('#addr').value.trim();
      try {
        const all = [...lines, {k: 'postage', n: 'Postage', unit: t.post, qty: 1}];
        const o = await api.placeOrder(all, addr); api.updateClub({deliveryAddress: addr}).catch(() => {});
        basket.set([]); m.remove();
        modal(`<h2>Order ${esc(o.id)} placed</h2><p class="lead">${gbp(o.total)}. Pay now by card, or by bank transfer quoting <b>${esc(o.id)}</b>. We post it as soon as payment arrives.</p>
          <div class="btn-row"><button class="btn" data-act="pay" data-order="${esc(o.id)}">Pay by card</button><a class="btn ghost" href="#/shop/orders/${esc(o.id)}" data-close>View order</a></div>`);
        rerender();
      } catch (x) { m.querySelector('#err').textContent = x.message.startsWith('Sample') ? x.message : 'Couldn’t place the order. Please try again.'; console.error(x); btn.disabled = false; } });
  },

  async 'edit-club'(){
    const c = await api.club();
    const m = modal(`<h2>Club details</h2><form>
      <label class="field"><span>Club name</span><input id="name" required value="${esc(c.name)}"></label>
      <label class="field"><span>Main contact</span><input id="contact" required value="${esc(c.contact)}"></label>
      <label class="field"><span>BG club number</span><input id="bg" value="${esc(c.bgNumber || '')}"></label>
      <label class="field"><span>Phone</span><input id="phone" type="tel" value="${esc(c.phone || '')}"></label>
      <p class="err" id="err"></p><div class="btn-row"><button class="btn">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    const v = id => m.querySelector('#' + id).value.trim();
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault();
      try { await api.updateClub({name: v('name'), contact: v('contact'), bgNumber: v('bg'), phone: v('phone')}); m.remove(); toast('Saved'); location.reload(); }
      catch (x) { m.querySelector('#err').textContent = x.message.startsWith('Sample') ? x.message : 'Couldn’t save. Please try again.'; console.error(x); } });
  },

  async pay(b){
    const label = b.textContent; b.disabled = true; b.textContent = 'Opening secure checkout…';
    try { await api.payByCard(b.dataset.order); }
    catch (x) { b.disabled = false; b.textContent = label; toast(x.message, false); }
  },
  async invoice(b){
    const [o, c] = await Promise.all([api.order(b.dataset.order), api.club()]);
    if (o) showInvoice(o, c); else toast('Couldn’t open that invoice.', false);
  },

  async 'reset-pw'(){
    const c = await api.club();
    try { await api.reset(c.email); toast('We’ve emailed a reset link to ' + c.email); } catch (x) { toast('Couldn’t send the email. Please try again.', false); }
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const f = ACT[b.dataset.act]; if (!f) return;
  e.preventDefault(); f(b);
});
