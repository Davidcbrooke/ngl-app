// Buttons that do something (data-act="…"): reserve places, basket, checkout,
// edit club details, sign out. Every write goes through the data layer.
import api from './data.js';
import { modal, toast, esc, gbp } from './ui.js';
import { showInvoice, emailInvoice } from './invoice.js';
import { ADM } from './admin-actions.js';
import { PS } from './pathways/preschool-actions.js';
import { REC } from './pathways/rec-actions.js';
import { SCH } from './pathways/schools-actions.js';
import { GL } from './pathways/general-actions.js';
import { APPACTS } from './admin-registry.js';
import { GBO } from './shop/groupbuy-order.js';
import { postageFor } from './prices.js';

const rerender = () => window.NGL_RENDER && window.NGL_RENDER();
export const basket = {
  get(){ try { return JSON.parse(sessionStorage.ngl_basket || '[]'); } catch { return []; } },
  set(b){ sessionStorage.ngl_basket = JSON.stringify(b.filter(l => l.qty > 0)); }
};
// Prices, postage bands and VAT come from NGL's price list (prices.json, copied in js/prices.js)
export const totals = lines => { const items = lines.reduce((a, l) => a + l.qty * l.unit, 0), qty = lines.reduce((a, l) => a + l.qty, 0);
  const post = postageFor(qty); return {items, post, total: items + post, qty}; };

const ACT = {
  // Judging: invite a coach or member of staff to the Judging Pathway (their own login, linked to this club)
  async 'judge-invite'(){
    const m = modal(`<h2>Invite a judge</h2><p class="lead">They get a link to register on the NGL Judging Pathway with your club filled in. They use their own login and only see the judge screens.</p><form>
      <label class="field"><span>Name</span><input id="jn" required autocomplete="off"></label>
      <label class="field"><span>Email</span><input id="je" type="email" required autocomplete="off"></label>
      <div class="btn-row"><button class="btn">Create invite</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault();
      try { const inv = await api.inviteJudge(m.querySelector('#jn').value.trim(), m.querySelector('#je').value.trim()); m.remove(); await showInvite(inv); rerender(); }
      catch (x) { toast(x.message, false); } });
  },
  async 'judge-link'(b){ const inv = (await api.judgeInvites()).find(i => i.id === b.dataset.id); if (inv) await showInvite(inv); },
  // Book and pay: the competition's event on JustGo Events (only offered when NGL has opened booking to this club)
  async book(b){
    const c = (await api.competitions()).find(x => x.id === b.dataset.comp);
    if (!c || !c.justgoUrl) return toast('Booking isn’t open for this competition yet.', false);
    if (c.justgoUrl.startsWith('demo:')) return toast('Sample data: in the real Club Hub this opens the competition on JustGo Events to pay.');
    window.open(c.justgoUrl, '_blank', 'noopener');
  },
  // QR code for a family link (the one NGL app + the club's code); printable for the noticeboard
  async 'fam-qr'(b){
    const { appLink } = await import('./config.js'), { loadScript } = await import('./pathways/index.js');
    const code = b.dataset.code || '', link = code ? appLink('?code=' + encodeURIComponent(code)) : appLink('#/family/general');
    try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'); } catch (_) { return toast('Couldn’t load the QR code maker. Check your connection.', false); }
    const q = window.qrcode(0, 'M'); q.addData(link); q.make();
    const m = modal(`<h2>${esc(b.dataset.n || 'Family')} family link</h2><div style="max-width:240px;margin:8px auto">${q.createSvgTag({cellSize: 6, margin: 2, scalable: true})}</div>
      <p style="text-align:center;margin:4px 0 2px">Scan to open the NGL app${code ? `, then your club’s code is added for you: <b>${esc(code)}</b>` : ''}</p>
      <p style="text-align:center;font-size:13px;color:var(--muted);word-break:break-all">${esc(link)}</p>
      <div class="btn-row" style="justify-content:center"><button class="btn" data-print>Print</button><button class="btn ghost" data-close>Close</button></div>`);
    m.querySelector('[data-print]').addEventListener('click', () => window.print());
  },
  async signout(){ await api.signOut(); },

  async reserve(b){
    const comps = await api.competitions(), c = comps.find(x => x.id === b.dataset.comp);
    const { placesLeft } = await import('./views/competitions.js'), left = placesLeft(c), wait = !!b.dataset.wait || left === 0;
    const m = modal(`<h2>${wait ? 'Join the waiting list' : 'Reserve places'}</h2><p class="lead"><b>${esc(c.name)}</b><br>${esc(c.where)} · ${esc(c.who)}</p>
      ${wait ? '<p class="lead" style="font-size:14px"><b>This competition is fully reserved.</b> Join the waiting list and we’ll offer you places if any come free.</p>'
        : left != null ? `<p class="lead" style="font-size:14px"><b>${left} place${left === 1 ? '' : 's'} left.</b> Need more? Reserve what’s left and join the waiting list for the rest.</p>` : ''}
      <form><label class="field"><span>How many gymnast places?</span><input id="n" type="number" min="1" max="${wait || left == null ? 200 : left}" value="${wait || left == null ? 10 : Math.min(10, left)}" required></label>
      <p class="lead" style="font-size:14px">No payment now. When the competition opens you’ll see <b>Buy now</b> here; places not bought by 3 months before go to the waiting list.</p>
      <p class="err" id="err"></p><div class="btn-row"><button class="btn">${wait ? 'Join waiting list' : 'Reserve'}</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const btn = m.querySelector('.btn'); btn.disabled = true;
      try { const ref = await api.reserve(c.id, m.querySelector('#n').value, wait); m.remove(); toast((wait ? 'You’re on the waiting list. Reference ' : 'Reserved. Your reference is ') + ref); location.hash = '#/competitions/places'; rerender(); }
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
      <p class="lead" style="font-size:13px;margin:0">Pay by card, Apple Pay or Google Pay, or <b>Pay by bank</b> straight from your banking app. Stripe emails your receipt.</p>
      <p class="err" id="err"></p><div class="btn-row"><button class="btn">Continue to secure payment</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const btn = m.querySelector('.btn'); btn.disabled = true;
      const addr = m.querySelector('#addr').value.trim();
      try {
        const all = [...lines, {k: 'postage', n: 'Postage', unit: t.post, qty: 1}];
        const o = await api.placeOrder(all, addr); api.updateClub({deliveryAddress: addr}).catch(() => {});
        basket.set([]); m.remove();
        try { await api.payByCard(o.id); }                     // straight to Stripe: card or Pay by bank
        catch (x) { toast(x.message, false); location.hash = '#/shop/orders/' + o.id; }
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
    const label = b.textContent; b.disabled = true; b.textContent = 'Opening secure payment…';
    try { await api.payByCard(b.dataset.order); }
    catch (x) { b.disabled = false; b.textContent = label; toast(x.message, false); }
  },
  async invoice(b){
    const [o, c] = await Promise.all([api.order(b.dataset.order), api.club()]);
    if (o) showInvoice(o, c); else toast('Couldn’t open that receipt.', false);
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
      toast(r === 'sent' ? 'Receipt emailed to ' + c.email : 'Test address: no email sent.'); }
    catch (x) { console.error(x); toast(x.message.includes('paid') ? x.message : 'Couldn’t send the email. Please try again.', false); }
    b.disabled = false; b.textContent = label;
  },

  async verify(){ try { await api.sendVerify(); toast('Check your inbox for the link, then log out and in again.'); } catch (x) { toast('Couldn’t send it. Please try again.', false); } },

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
  const f = ACT[b.dataset.act] || ADM[b.dataset.act] || PS[b.dataset.act] || REC[b.dataset.act] || SCH[b.dataset.act] || GL[b.dataset.act] || GBO[b.dataset.act] || APPACTS[b.dataset.act]; if (!f) return;
  e.preventDefault(); f(b);
});

// The invite: a link to copy, or an email from the club's own mail app (nothing is sent by NGL)
async function showInvite(inv){
  const { inviteLink } = await import('./views/judging.js'), c = await api.club(), u = await api.user();
  const link = inviteLink({id: u.uid, name: c.name}, inv);
  const body = `Hi ${inv.name.split(' ')[0]},\n\nWe'd like you to join the NGL Judging Pathway for ${c.name}. You can learn and qualify step by step (the Elevien academy, quizzes and shadowing), and judge NGL competitions, including from home.\n\nRegister here (it takes two minutes):\n${link}\n\nThanks!`;
  const m = modal(`<h2>Invite for ${esc(inv.name)}</h2><p class="lead">Send ${esc(inv.name.split(' ')[0])} this link. It opens the Judging Pathway with your club filled in.</p>
    <p style="word-break:break-all;font-size:14px;background:var(--bg,#f4f4f8);padding:10px;border-radius:10px">${esc(link)}</p>
    <div class="btn-row"><button class="btn" data-copy>Copy link</button><a class="btn ghost" href="mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent('Join the NGL Judging Pathway')}&body=${encodeURIComponent(body)}">Email it</a><button class="btn ghost" data-close>Close</button></div>`);
  m.querySelector('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (_) { toast('Select the link and copy it', false); } });
}
