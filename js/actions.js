// Buttons that do something (data-act="…"): reserve places, basket, checkout,
// edit club details, sign out. Every write goes through the data layer.
import api from './data.js';
import { modal, toast, esc, gbp } from './ui.js';
import { showInvoice, emailInvoice } from './invoice.js';

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
        const done = modal(`<h2>Order ${esc(o.id)} placed</h2><p class="lead">${gbp(o.total)}. Pay now by card, or by bank transfer quoting <b>${esc(o.id)}</b>. We post it as soon as payment arrives.</p>
          <div class="btn-row"><button class="btn" data-act="pay" data-order="${esc(o.id)}">Pay by card</button><a class="btn ghost" href="#/shop/orders/${esc(o.id)}" data-close>View order</a></div>
          <p class="lead" id="mailNote" style="font-size:13px;margin:12px 0 0">Emailing your invoice to ${esc(c.email || '')}…</p>`);
        api.order(o.id).then(full => emailInvoice(full, c)).then(r => { const n = done.querySelector('#mailNote'); if (n) n.textContent = r === 'sent' ? '✓ Invoice emailed to ' + c.email : 'Test address: no email sent.'; })
          .catch(e => { console.error(e); const n = done.querySelector('#mailNote'); if (n) n.textContent = 'We couldn’t email the invoice just now. You can email it again from the order page.'; });
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

  // Calendar file (.ics) for one competition or all reserved ones: opens in Google, Outlook or Apple Calendar.
  async ics(b){
    const comps = (await api.competitions()).filter(c => c.reserved || c.waiting), c0 = await api.club();
    const list = b.dataset.comp === 'all' ? comps : comps.filter(c => c.id === b.dataset.comp);
    const e = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const day = d => d.replace(/-/g, ''), next = d => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10).replace(/-/g, ''); };
    const ev = list.flatMap(c => ['BEGIN:VEVENT', 'UID:' + c.id + '-' + (c.ref || 'ngl') + '@nationalgymnasticsleague.co.uk', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;VALUE=DATE:' + day(c.date), 'DTEND;VALUE=DATE:' + next(c.date), 'SUMMARY:' + e('NGL: ' + c.name), 'LOCATION:' + e(c.where),
      'DESCRIPTION:' + e(`${c.who}. ${c.waiting ? 'Waiting list.' : c.reserved + ' places reserved (ref ' + c.ref + '). Buy on JustGo by ' + c.buyBy + '.'}`), 'END:VEVENT']);
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NGL Club Hub//EN', 'X-WR-CALNAME:' + e((c0.name || 'NGL') + ' competitions'), ...ev, 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], {type: 'text/calendar'}));
    a.download = (list.length === 1 ? 'NGL ' + list[0].name : 'NGL competitions').replace(/[^\w ]+/g, '').trim() + '.ics'; a.click();
    toast('Calendar file downloaded: open it to add to your calendar');
  },

  async 'change-res'(b){
    const c = (await api.competitions()).find(x => x.id === b.dataset.comp);
    const m = modal(`<h2>Change your reservation</h2><p class="lead"><b>${esc(c.name)}</b> · ref ${esc(c.ref)}</p>
      <form><label class="field"><span>Gymnast places</span><input id="n" type="number" min="1" max="200" value="${c.reserved}" required></label>
      <p class="err" id="err"></p><div class="btn-row"><button class="btn">Save</button><button class="btn ghost" type="button" data-cancel>Cancel reservation</button><button class="btn ghost" type="button" data-close>Close</button></div></form>`);
    const go = async places => { try { await api.changeReservation(c.ref, places); m.remove(); toast(places ? 'Reservation changed to ' + places + ' places' : 'Reservation cancelled'); rerender(); }
      catch (x) { console.error(x); m.querySelector('#err').textContent = x.message.startsWith('Sample') ? x.message : 'Couldn’t save. Please try again.'; } };
    m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); go(Number(m.querySelector('#n').value)); });
    m.querySelector('[data-cancel]').addEventListener('click', () => { if (m.querySelector('[data-cancel]').dataset.sure) go(0); else { const x = m.querySelector('[data-cancel]'); x.dataset.sure = 1; x.textContent = 'Tap again to cancel'; x.style.color = 'var(--red)'; } });
  },

  async 'email-invoice'(b){
    b.disabled = true; const label = b.textContent; b.textContent = 'Sending…';
    try { const [o, c] = await Promise.all([api.order(b.dataset.order), api.club()]); const r = await emailInvoice(o, c);
      toast(r === 'sent' ? 'Invoice emailed to ' + c.email : 'Test address: no email sent.'); }
    catch (x) { console.error(x); toast('Couldn’t send the email. Please try again.', false); }
    b.disabled = false; b.textContent = label;
  },

  async 'reset-pw'(){
    const c = await api.club();
    try { await api.reset(c.email); toast('We’ve emailed a reset link to ' + c.email); } catch (x) { toast('Couldn’t send the email. Please try again.', false); }
  }
};

// Floor music: picking a file uploads it straight away, with a progress bar.
document.addEventListener('change', async e => {
  const inp = e.target.closest('input[data-music]'); if (!inp || !inp.files[0]) return;
  const f = inp.files[0], compId = inp.dataset.music, gid = inp.dataset.gym;
  if (!/\.mp3$/i.test(f.name) && f.type !== 'audio/mpeg') { toast('Please choose an MP3 file.', false); inp.value = ''; return; }
  if (f.size > 15 * 1024 * 1024) { toast('That file is over 15MB. Please use a smaller MP3.', false); inp.value = ''; return; }
  const m = (await api.music()).find(x => x.ev.id === compId), g = m && m.gymnasts.find(x => x.id === gid);
  const bar = document.getElementById(`up-${compId}-${gid}`); if (bar) bar.hidden = false;
  try { await api.uploadMusic(compId, g, f, p => { if (bar) bar.firstElementChild.style.width = Math.round(p * 100) + '%'; }); toast('Music uploaded for ' + g.n); rerender(); }
  catch (x) { console.error(x); if (bar) bar.hidden = true; toast(x.message.startsWith('Sample') ? x.message : 'Upload failed. Please try again.', false); }
  inp.value = '';
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const f = ACT[b.dataset.act]; if (!f) return;
  e.preventDefault(); f(b);
});
