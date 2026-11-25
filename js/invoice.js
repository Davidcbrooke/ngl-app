// Receipt: one layout for every programme, for paid orders. Shown full-screen; "Download PDF" uses
// the browser's print-to-PDF, with print styles that show only the receipt.
import { INVOICE, BRAND, EMAILJS, ENV } from './config.js';
import { esc, gbp, date, path } from './ui.js';

const total = o => (o.lines || []).reduce((a, l) => a + l.qty * l.unit, 0);

export function invoiceHTML(o, c){
  const paid = o.status === 'paid' || o.status === 'sent';
  const prog = (path(o.path) || {n: 'NGL'}).n;
  return `<div class="inv">
  <div class="inv-bar"><i style="background:var(--pre)"></i><i style="background:var(--sch)"></i><i style="background:var(--rec)"></i><i style="background:var(--gen)"></i><i style="background:var(--perf)"></i><i style="background:var(--uni)"></i><i style="background:var(--mas)"></i></div>
  <div class="inv-top"><img src="${BRAND}ngl-logo-full.png" alt="National Gymnastics League"><div style="text-align:right"><div class="inv-h">${paid ? 'Receipt' : 'Order'}</div><div class="inv-no">${esc(o.id)}</div>${paid ? '<div class="inv-paid">Paid</div>' : ''}</div></div>
  <div class="inv-cols">
    <div><div class="inv-l">From</div><b>${esc(INVOICE.name)}</b><br>${INVOICE.address.map(esc).join('<br>')}<br>${esc(INVOICE.email)}</div>
    <div><div class="inv-l">Bill to</div><b>${esc(c.name)}</b><br>${c.contact ? esc(c.contact) + '<br>' : ''}${esc(c.email || '')}${c.bgNumber ? '<br>BG club no. ' + esc(c.bgNumber) : ''}</div>
    ${o.delivery ? `<div><div class="inv-l">Deliver to</div>${esc(o.delivery).replace(/\n/g, '<br>')}</div>` : ''}
    <div><div class="inv-l">Order date</div>${date(o.placedAt)}${paid ? `<div class="inv-l" style="margin-top:8px">Paid</div>${date(o.paidAt || o.placedAt)}` : ''}</div>
  </div>
  <table class="inv-t"><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead>
  <tbody>${(o.lines || []).map(l => `<tr><td>${esc(l.n)}${l.k && l.k !== 'postage' ? ` <small>(${esc(prog)})</small>` : ''}</td><td class="n">${l.qty}</td><td class="n">${gbp(l.unit)}</td><td class="n">${gbp(l.qty * l.unit)}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="3" class="n">Books, medals and t-shirts carry no VAT.</td><td></td></tr><tr class="inv-tot"><td colspan="3" class="n">${paid ? 'Total paid' : 'Total due'}</td><td class="n">${gbp(total(o))}</td></tr></tfoot></table>
  ${paid ? `<p class="inv-note">Paid online${o.paidAt ? ' on ' + date(o.paidAt) : ''}. Thank you.</p>` : '<p class="inv-note" style="color:var(--red)">Not paid yet: finish payment in Shop &amp; orders.</p>'}
  <div class="inv-foot">${esc(INVOICE.name)} · Company no. ${esc(INVOICE.company)} · VAT no. ${esc(INVOICE.vat)}</div></div>`;
}

export function showInvoice(o, c){
  const bg = document.createElement('div'); bg.className = 'inv-screen';
  bg.innerHTML = `<div class="inv-tools"><button class="btn" data-print>Download PDF</button><button class="btn ghost" data-shut>Close</button></div>${invoiceHTML(o, c)}`;
  bg.querySelector('[data-print]').onclick = () => { const t = document.title; document.title = 'NGL receipt ' + o.id; window.print(); document.title = t; };
  bg.querySelector('[data-shut]').onclick = () => bg.remove();
  document.body.appendChild(bg);
}

// Email version: inline styles only (email apps ignore stylesheets).
function emailHTML(o, c){
  const td = 'padding:8px 10px;border-bottom:1px solid #e4e3ee;font-size:14px;color:#1b1840;', tot = total(o);
  const bar = ['#e84187','#fbd43a','#e8822f','#0073b3','#00aeb7','#6ba526','#8f286b'].map(x => `<td style="height:6px;background:${x}"></td>`).join('');
  return `<div style="font-family:Roboto,Arial,Helvetica,sans-serif;background:#f4f4f9;padding:20px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bar}</tr></table></td></tr>
<tr><td style="background:#28225c;padding:18px 24px;color:#fff;font-size:20px;font-weight:bold">National Gymnastics League · Receipt ${esc(o.id)}</td></tr>
<tr><td style="padding:24px"><p style="margin:0 0 14px;font-size:15px;color:#1b1840">Hello${c.contact ? ' ' + esc(c.contact.split(' ')[0]) : ''},</p>
<p style="margin:0 0 18px;font-size:15px;color:#1b1840">Thank you for your order. Your receipt for <b>${esc(o.id)}</b> is below.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px"><tr style="background:#28225c;color:#fff;font-size:11px"><td style="padding:8px 10px">ITEM</td><td align="right" style="padding:8px 10px">QTY</td><td align="right" style="padding:8px 10px">AMOUNT</td></tr>
${(o.lines || []).map(l => `<tr><td style="${td}">${esc(l.n)}</td><td align="right" style="${td}">${l.qty}</td><td align="right" style="${td}">${gbp(l.qty * l.unit)}</td></tr>`).join('')}
<tr style="font-size:16px;font-weight:bold;color:#28225c"><td colspan="2" align="right" style="padding:10px">Total paid</td><td align="right" style="padding:10px">${gbp(tot)}</td></tr></table>
<p style="margin:18px 0 0;font-size:13px;color:#5f5b80">You can download a PDF copy at any time from Shop &amp; orders in your Club Hub.</p></td></tr>
<tr><td style="padding:14px 24px;background:#f4f4f9;text-align:center;font-size:11px;color:#5f5b80">${esc(INVOICE.name)} · Company no. ${esc(INVOICE.company)} · VAT no. ${esc(INVOICE.vat)}</td></tr></table></div>`;
}
// Emails the receipt of a PAID order through EmailJS. Made-up test addresses (example.com etc.) are skipped so nothing bounces.
export async function emailInvoice(o, c){
  if (!c.email) throw new Error('No email address on your club account.');
  if (!['paid', 'sent'].includes(o.status)) throw new Error('This order isn’t paid yet.');
  if (/@example\.(com|org|net)$/i.test(c.email)) return 'skipped';
  const sandbox = ENV === 'sandbox' ? '[SANDBOX TEST] ' : '';
  const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({service_id: EMAILJS.serviceId, template_id: EMAILJS.templateId, user_id: EMAILJS.publicKey,
      template_params: {to_email: c.email, to_name: c.contact || c.name || '', subject: `${sandbox}NGL receipt ${o.id}: ${gbp(total(o))}`, invoice_html: emailHTML(o, c)}})});
  if (!r.ok) throw new Error('Email failed (' + r.status + ')');
  return 'sent';
}
