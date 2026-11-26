import api from '../data.js';
import { esc, gbp, date, dot, pill, tabs, head, ic, path } from '../ui.js';
import { basket, totals } from '../actions.js';

const TABS = [['', 'Shop'], ['groupbuy', 'Group buying'], ['orders', 'Orders & receipts']];
const LEAD = 'One shop for every programme. Pay securely when you order.';

export default async function shop([sub = '', id, ...rest]){
  if (sub === 'orders' && id) return orderPage(id);
  // Group buying: staff kit with the club's logo, ordered every quarter (js/shop/groupbuy-order.js)
  if (sub === 'groupbuy') { const [m, c] = await Promise.all([import('../shop/groupbuy-order.js'), api.club()]);
    return head('Shop & orders', LEAD) + tabs(TABS, sub, '#/shop') + await m.default(c, [id, ...rest].filter(Boolean)); }
  const [orders, products, lic] = await Promise.all([api.orders(), api.products(), api.licences()]);
  let body;
  if (sub === 'orders') {
    const owed = orders.filter(o => o.status === 'awaiting-payment').reduce((a, o) => a + o.total, 0);
    body = !orders.length ? `<div class="card empty">No orders yet. <a href="#/shop">Go to the shop</a></div>` :
    `<div class="grid g4" style="margin-bottom:16px"><div class="card stat"><b>${gbp(owed)}</b><span>Not paid yet</span></div></div>
    <div class="card"><table><tr><th>Date</th><th>Ref</th><th>Programme</th><th>Details</th><th>Total</th><th>Status</th><th></th></tr>
    ${orders.map(o => { const unpaid = o.status === 'awaiting-payment';
      return `<tr><td>${date(o.date, {day:'numeric', month:'short'})}</td><td><a href="#/shop/orders/${esc(o.id)}"><b>${esc(o.id)}</b></a></td><td>${dot(o.path)} ${esc((path(o.path) || {n: ''}).n)}</td><td>${esc(o.details)}</td><td>${gbp(o.total)}</td>
      <td>${pill(unpaid ? 'Not paid' : o.status === 'sent' ? 'Sent' : 'Paid', unpaid ? 'red' : 'ok')}</td><td style="white-space:nowrap">${unpaid ? `<button class="btn sm" data-act="pay" data-order="${esc(o.id)}">Finish payment</button>` : `<button class="btn sm ghost" data-act="invoice" data-order="${esc(o.id)}">Receipt</button>`}</td></tr>`; }).join('')}</table></div>
    <p class="lead" style="margin-top:12px">You pay when you order: card, Apple Pay, Google Pay or Pay by bank. Stripe emails each receipt.</p>`;
  } else {
    const bk = basket.get(), t = totals(bk);
    body = `<div class="grid" style="grid-template-columns:1fr 300px;align-items:start"><div class="grid g3">${products.map(p => { const c = p.path ? path(p.path).c : 'var(--navy)';
      const locked = p.needs && !['live', 'waived'].includes(lic[p.needs].status);
      return `<div class="card ${locked ? 'lock' : ''}">${ic('book', c)}<p style="margin:10px 0 2px"><b>${esc(p.n)}</b></p><small style="color:var(--muted)">${esc(p.d)}</small>
      <p style="margin:8px 0 0"><b>${p.price != null ? gbp(p.price) + ' each' : 'Ordered quarterly'}</b></p>
      ${p.k === 'kit' ? '<a class="btn sm" style="margin-top:8px" href="#/shop/groupbuy">Order staff kit</a>' : locked ? `<small style="color:var(--muted)">Needs a ${esc(path(p.needs).n)} licence · <a href="#/programmes/${p.needs}">Explore</a></small>`
        : p.price == null ? '<small style="color:var(--muted)">Next round opens soon</small>' : `<button class="btn sm" style="margin-top:8px" data-act="add" data-prod="${p.k}">Add 10 to basket</button>`}</div>`; }).join('')}</div>
    <div class="card basket"><h2>Your basket</h2>${bk.length ? bk.map(l => `<div class="row"><div class="grow"><b>${esc(l.n)}</b><small>${gbp(l.unit)} each</small></div>
      <div class="qty"><button data-act="inc" data-prod="${l.k}" data-by="-1" aria-label="One fewer">−</button><b>${l.qty}</b><button data-act="inc" data-prod="${l.k}" data-by="1" aria-label="One more">+</button></div></div>`).join('') +
      `<div class="row"><div class="grow">Postage</div><b>${gbp(t.post)}</b></div><div class="row"><div class="grow"><b>Total</b></div><b>${gbp(t.total)}</b></div>
      <button class="btn" style="width:100%;justify-content:center;margin-top:10px" data-act="checkout">Place order</button>` : '<p class="empty">Your basket is empty.</p>'}</div></div>`;
  }
  return head('Shop & orders', LEAD) + tabs(TABS, sub, '#/shop') + body;
}

// One order, Stripe-style: status, timeline, lines, receipt, finish payment.
async function orderPage(id){
  const o = await api.order(id);
  if (!o) return head('Order not found') + `<div class="card empty">We can’t find order ${esc(id)}. <a href="#/shop/orders">Back to your orders</a></div>`;
  const unpaid = o.status === 'awaiting-payment', tot = (o.lines || []).reduce((a, l) => a + l.qty * l.unit, 0), gb = o.kind === 'groupbuy';
  const steps = [
    [gb ? 'Invoiced' : 'Order placed', date(o.placedAt), 1],
    ['Paid', o.paidAt ? date(o.paidAt) : unpaid ? 'Not paid yet' : '', !unpaid],
    [gb ? 'Sent to print' : 'Posted', o.sentAt ? date(o.sentAt) : gb ? 'Your kit goes to print as soon as payment arrives' : 'We post as soon as payment arrives', o.status === 'sent']
  ];
  return `<p style="margin:0 0 6px"><a href="#/shop/orders">← Orders & receipts</a></p>
  <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h1 style="margin:0">${esc(o.id)}</h1>${pill(unpaid ? 'Not paid' : o.status === 'sent' ? 'Sent' : 'Paid', unpaid ? 'red' : 'ok')}</div>
  <p class="lead">${gbp(tot)} · placed ${date(o.placedAt)}</p>
  <div class="grid" style="grid-template-columns:1fr 320px;align-items:start">
    <div class="card"><h2>Items</h2><table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
      ${(o.lines || []).map(l => `<tr><td>${esc(l.n)}</td><td>${l.qty}</td><td>${gbp(l.unit)}</td><td>${gbp(l.qty * l.unit)}</td></tr>`).join('')}
      <tr><td colspan="3"><b>Total</b></td><td><b>${gbp(tot)}</b></td></tr></table>
      ${o.delivery ? `<p class="lead" style="margin:14px 0 0"><b>Deliver to:</b> ${esc(o.delivery)}</p>` : ''}
      ${gb ? `<p class="lead" style="margin:10px 0 0">Group buying invoice ${esc(o.invoiceNo || '')}: the final price for this order round, reached by all clubs ordering together.</p>` : ''}</div>
    <div><div class="card" style="margin-bottom:16px"><h2>Payment</h2>
      ${unpaid ? `<button class="btn" style="width:100%;justify-content:center" data-act="pay" data-order="${esc(o.id)}">Finish payment: ${gbp(tot)}</button>
        <p class="lead" style="font-size:13px;margin:10px 0 0">Card, Apple Pay, Google Pay or Pay by bank. This order isn’t confirmed until it’s paid.</p>`
      : `<p class="lead" style="margin:0 0 10px">Paid. Thank you.</p>
      <button class="btn ghost" style="width:100%;justify-content:center" data-act="invoice" data-order="${esc(o.id)}">Receipt (PDF)</button>
      <button class="btn ghost" style="width:100%;justify-content:center;margin-top:10px" data-act="email-invoice" data-order="${esc(o.id)}">Email it to me</button>`}</div>
    <div class="card"><h2>Timeline</h2><ul class="timeline">${steps.map(s => `<li class="${s[2] ? 'done' : ''}"><div><b>${s[0]}</b><small>${esc(s[1])}</small></div></li>`).join('')}</ul></div></div></div>`;
}
