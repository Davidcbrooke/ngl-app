import api from '../data.js';
import { esc, gbp, date, dot, pill, tabs, head, ic, path } from '../ui.js';
import { basket, totals } from '../actions.js';

export default async function shop([sub = '']){
  const [orders, products, lic] = await Promise.all([api.orders(), api.products(), api.licences()]);
  let body;
  if (sub === 'orders') {
    const due = orders.filter(o => o.status === 'awaiting-payment').reduce((a, o) => a + o.total, 0);
    body = !orders.length ? `<div class="card empty">No orders yet. <a href="#/shop">Go to the shop</a></div>` :
    `<div class="grid g4" style="margin-bottom:16px"><div class="card stat"><b>${gbp(due)}</b><span>Awaiting payment</span></div></div>
    <div class="card"><table><tr><th>Date</th><th>Ref</th><th>Programme</th><th>Details</th><th>Total</th><th>Status</th><th></th></tr>
    ${orders.map(o => { const unpaid = o.status === 'awaiting-payment';
      return `<tr><td>${date(o.date, {day:'numeric', month:'short'})}</td><td><b>${esc(o.id)}</b></td><td>${dot(o.path)} ${esc((path(o.path) || {n: ''}).n)}</td><td>${esc(o.details)}</td><td>${gbp(o.total)}</td>
      <td>${pill(unpaid ? 'Awaiting payment' : o.status === 'sent' ? 'Sent' : 'Paid', unpaid ? 'red' : 'ok')}</td><td style="white-space:nowrap">${unpaid ? '<button class="btn sm" disabled title="Card payment is connected in the Shop stage">Pay by card</button> ' : ''}<button class="btn sm ghost" disabled title="Invoices come in the Shop stage">Invoice</button></td></tr>`; }).join('')}</table></div>
    <p class="lead" style="margin-top:12px">Pay by card, or by bank transfer using the order reference.</p>`;
  } else {
    const bk = basket.get(), t = totals(bk);
    body = `<div class="grid" style="grid-template-columns:1fr 300px;align-items:start"><div class="grid g3">${products.map(p => { const c = p.path ? path(p.path).c : 'var(--navy)';
      const locked = p.needs && !['live', 'waived'].includes(lic[p.needs].status);
      return `<div class="card ${locked ? 'lock' : ''}">${ic('book', c)}<p style="margin:10px 0 2px"><b>${esc(p.n)}</b></p><small style="color:var(--muted)">${esc(p.d)}</small>
      <p style="margin:8px 0 0"><b>${p.price != null ? gbp(p.price) + ' each' : 'Ordered quarterly'}</b></p>
      ${locked ? `<small style="color:var(--muted)">Needs a ${esc(path(p.needs).n)} licence · <a href="#/programmes/${p.needs}">Explore</a></small>`
        : p.price == null ? '<small style="color:var(--muted)">Next round opens soon</small>' : `<button class="btn sm" style="margin-top:8px" data-act="add" data-prod="${p.k}">Add 10 to basket</button>`}</div>`; }).join('')}</div>
    <div class="card basket"><h2>Your basket</h2>${bk.length ? bk.map(l => `<div class="row"><div class="grow"><b>${esc(l.n)}</b><small>${gbp(l.unit)} each</small></div>
      <div class="qty"><button data-act="inc" data-prod="${l.k}" data-by="-1" aria-label="One fewer">−</button><b>${l.qty}</b><button data-act="inc" data-prod="${l.k}" data-by="1" aria-label="One more">+</button></div></div>`).join('') +
      `<div class="row"><div class="grow">Postage</div><b>${gbp(t.post)}</b></div><div class="row"><div class="grow"><b>Total</b></div><b>${gbp(t.total)}</b></div>
      <button class="btn" style="width:100%;justify-content:center;margin-top:10px" data-act="checkout">Place order</button>` : '<p class="empty">Your basket is empty.</p>'}</div></div>`;
  }
  return head('Shop & orders', 'One shop for every programme. Pay by card or bank transfer.') + tabs([['', 'Shop'], ['orders', 'Orders & invoices']], sub, '#/shop') + body;
}
