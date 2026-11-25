// Invoice: one layout for every programme. Shown full-screen; "Download PDF" uses the
// browser's print-to-PDF, with print styles that show only the invoice.
import { INVOICE, BRAND } from './config.js';
import { esc, gbp, date, path } from './ui.js';

const total = o => (o.lines || []).reduce((a, l) => a + l.qty * l.unit, 0);
export const due = o => { const d = new Date(o.placedAt + 'T12:00'); d.setDate(d.getDate() + INVOICE.termsDays); return d.toISOString().slice(0, 10); };

export function invoiceHTML(o, c){
  const paid = o.status === 'paid' || o.status === 'sent', B = INVOICE.bank;
  const prog = (path(o.path) || {n: 'NGL'}).n;
  return `<div class="inv">
  <div class="inv-bar"><i style="background:var(--pre)"></i><i style="background:var(--sch)"></i><i style="background:var(--rec)"></i><i style="background:var(--gen)"></i><i style="background:var(--perf)"></i><i style="background:var(--uni)"></i><i style="background:var(--mas)"></i></div>
  <div class="inv-top"><img src="${BRAND}ngl-logo-full.png" alt="National Gymnastics League"><div style="text-align:right"><div class="inv-h">Invoice</div><div class="inv-no">${esc(o.id)}</div>${paid ? '<div class="inv-paid">Paid</div>' : ''}</div></div>
  <div class="inv-cols">
    <div><div class="inv-l">From</div><b>${esc(INVOICE.name)}</b><br>${INVOICE.address.map(esc).join('<br>')}<br>${esc(INVOICE.email)}</div>
    <div><div class="inv-l">Bill to</div><b>${esc(c.name)}</b><br>${c.contact ? esc(c.contact) + '<br>' : ''}${esc(c.email || '')}${c.bgNumber ? '<br>BG club no. ' + esc(c.bgNumber) : ''}</div>
    ${o.delivery ? `<div><div class="inv-l">Deliver to</div>${esc(o.delivery).replace(/\n/g, '<br>')}</div>` : ''}
    <div><div class="inv-l">Invoice date</div>${date(o.placedAt)}<div class="inv-l" style="margin-top:8px">${paid ? 'Paid' : 'Payment due'}</div>${paid ? date(o.paidAt || o.placedAt) : date(due(o))}</div>
  </div>
  <table class="inv-t"><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead>
  <tbody>${(o.lines || []).map(l => `<tr><td>${esc(l.n)}${l.k && l.k !== 'postage' ? ` <small>(${esc(prog)})</small>` : ''}</td><td class="n">${l.qty}</td><td class="n">${gbp(l.unit)}</td><td class="n">${gbp(l.qty * l.unit)}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="3" class="n">Books, medals and t-shirts carry no VAT.</td><td></td></tr><tr class="inv-tot"><td colspan="3" class="n">${paid ? 'Total paid' : 'Total due'}</td><td class="n">${gbp(total(o))}</td></tr></tfoot></table>
  ${paid ? `<p class="inv-note">Paid ${o.paidBy === 'card' ? 'by card' : ''}${o.paidAt ? ' on ' + date(o.paidAt) : ''}. Thank you.</p>` : `<div class="inv-pay"><div class="inv-l">How to pay</div>
    <p><b>By card:</b> open this order in your Club Hub (Shop &amp; orders) and choose Pay by card.</p>
    <p><b>By bank transfer</b> within ${INVOICE.termsDays} days: ${esc(B.accountName)} · sort code ${esc(B.sortCode)} · account ${esc(B.accountNumber)} · reference <b>${esc(o.id)}</b></p></div>`}
  <div class="inv-foot">${esc(INVOICE.name)} · Company no. ${esc(INVOICE.company)} · VAT no. ${esc(INVOICE.vat)}</div></div>`;
}

export function showInvoice(o, c){
  const bg = document.createElement('div'); bg.className = 'inv-screen';
  bg.innerHTML = `<div class="inv-tools"><button class="btn" data-print>Download PDF</button><button class="btn ghost" data-shut>Close</button></div>${invoiceHTML(o, c)}`;
  bg.querySelector('[data-print]').onclick = () => { const t = document.title; document.title = 'NGL invoice ' + o.id; window.print(); document.title = t; };
  bg.querySelector('[data-shut]').onclick = () => bg.remove();
  document.body.appendChild(bg);
}
