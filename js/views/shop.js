import api from '../data.js';
import { esc, gbp, date, dot, pill, tabs, head, ic, path } from '../ui.js';

export default async function shop([sub = '']){
  const [orders, products, lic] = await Promise.all([api.orders(), api.products(), api.licences()]);
  let body;
  if (sub === 'orders') {
    const due = orders.filter(o => o.status === 'awaiting-payment').reduce((a, o) => a + o.total, 0);
    body = `<div class="grid g4" style="margin-bottom:16px"><div class="card stat"><b>${gbp(due)}</b><span>Awaiting payment</span></div></div>
    <div class="card"><table><tr><th>Date</th><th>Ref</th><th>Programme</th><th>Details</th><th>Total</th><th>Status</th><th></th></tr>
    ${orders.map(o => { const unpaid = o.status === 'awaiting-payment';
      return `<tr><td>${date(o.date, {day:'numeric', month:'short'})}</td><td><b>${esc(o.id)}</b></td><td>${dot(o.path)} ${esc(path(o.path).n)}</td><td>${esc(o.details)}</td><td>${gbp(o.total)}</td>
      <td>${pill(unpaid ? 'Awaiting payment' : 'Paid', unpaid ? 'red' : 'ok')}</td><td style="white-space:nowrap">${unpaid ? '<button class="btn sm" disabled title="Sample data">Pay by card</button> ' : ''}<button class="btn sm ghost" disabled title="Sample data">Invoice</button></td></tr>`; }).join('')}</table></div>
    <p class="lead" style="margin-top:12px">Pay by card, or by bank transfer using the order reference.</p>`;
  } else {
    body = `<div class="grid g4">${products.map(p => { const c = p.path ? path(p.path).c : 'var(--navy)';
      const locked = p.needs && !['live', 'waived'].includes(lic[p.needs].status);
      return `<div class="card ${locked ? 'lock' : ''}">${ic('book', c)}<p style="margin:10px 0 2px"><b>${esc(p.n)}</b></p><small style="color:var(--muted)">${esc(p.d)}</small>
      <p style="margin:8px 0 0"><b>${p.price != null ? gbp(p.price) : 'Quarterly'}</b></p>
      ${locked ? `<small style="color:var(--muted)">Needs a ${esc(path(p.needs).n)} licence</small>` : '<button class="btn sm" style="margin-top:8px" disabled title="Sample data">Add to basket</button>'}</div>`; }).join('')}</div>`;
  }
  return head('Shop & orders', 'One shop for every programme. Pay by card or bank transfer.') + tabs([['', 'Shop'], ['orders', 'Orders & invoices']], sub, '#/shop') + body;
}
