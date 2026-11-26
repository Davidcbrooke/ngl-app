// Shop · Group buying (#/shop/groupbuy): the club's quarterly order of staff kit with its logo.
// Copied from GYMNASTICS-RESULTS/ngl-group-order.html (the form the old Club Hub embedded): the same wording, products,
// maker's photos, colours, sizes, prices, rules, live order board and countdown. What changed (agreed with Dave, 26 Nov 2026):
//   - the club is signed in: club name, contact, email, phone and delivery address come from its account (and can be changed here);
//   - the order carries clubId (the club's login uid), so NGL Admin can turn the invoice into an app order;
//   - no payment now, and no bank transfer: when the round closes and the final price is known, the club pays by card in Shop & orders.
// Settings (products, bands, minimum, VAT, fees, rounds) come from js/admin/groupbuy.js, so there is one copy.
// Writes go through the data layer: api.groupbuyPlace (order + round totals in one batch, then the logos), api.groupbuyBoard, api.groupbuyMine.
import api from '../data.js';
import { esc, toast } from '../ui.js';
import { PRODUCTS, MIN_TOTAL, VAT_RATE, SETUP_FEE, DELIVERY_FEE, roundFor, prodOf, isKid, bandIndex } from '../admin/groupbuy.js';

const money = p => p == null ? '£TBC' : '£' + Number(p).toFixed(2);
const fmtDate = d => d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
const plural = (p, n) => n === 1 ? p.unit : p.units;
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
const CONTACT = 'admin@nationalgymnasticsleague.co.uk';

/* ---------- state: kept while the club moves around the app ---------- */
const blank = () => ({ pid:PRODUCTS[0].id, ci:0, sizes:{}, setup:'first', back:'none', line1:'', line2:'', sleeve:'none', sleeveLine:'', notes:'', agree:false,
  front:null, frontUrl:'', backFile:null, backUrl:'', err:'', busy:false, done:null });
let S = blank(), CLUB = null, ME = { club:'', contact:'', email:'', phone:'', a1:'', a2:'', town:'', pc:'' }, ROUND = roundFor();
const B = { totals:{}, err:'', off:null, round:'' };
let MINE = [];
const P = () => prodOf(S.pid), COL = () => P().colours[S.ci] || P().colours[0];
const onScreen = () => document.getElementById('gboRoot');

// The account's delivery address (one line from the Shop checkout, or the one saved from the last group order) into the form's fields
function addressOf(c){
  if (c.groupbuyAddress) return c.groupbuyAddress;
  const parts = String(c.deliveryAddress || '').split(/\n|,/).map(x => x.trim()).filter(Boolean);
  if (parts[0] && c.name && parts[0].toLowerCase() === String(c.name).toLowerCase()) parts.shift();
  const pc = parts.length && /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(parts[parts.length - 1]) ? parts.pop() : '';
  const town = parts.length > 1 ? parts.pop() : '';
  return { line1:parts.shift() || '', line2:parts.join(', '), town, postcode:pc };
}
function fromAccount(c){
  const a = addressOf(c);
  ME = { club:c.name || '', contact:c.contact || '', email:c.email || '', phone:c.phone || '', a1:a.line1 || '', a2:a.line2 || '', town:a.town || '', pc:a.postcode || '' };
}

/* ---------- prices (copied) ---------- */
const sizesNow = () => Object.fromEntries(Object.entries(S.sizes).filter(([z, n]) => n > 0 && [...P().sizes, ...(P().kidsSizes || [])].includes(z)));
const qtyNow = () => Object.values(sizesNow()).reduce((a, b) => a + b, 0);
const setupNow = () => S.setup === 'first' ? SETUP_FEE : 0;
// Adult garments carry VAT; children's sizes don't. Set-up and delivery take VAT in proportion to the adult share.
function priceOrder(p, sizes, back, sleeveOn, setup, unit){
  const sz = Object.entries(sizes), kid = sz.filter(([z]) => isKid(p, z)).reduce((a, [, n]) => a + n, 0), adult = sz.reduce((a, [, n]) => a + n, 0) - kid;
  const extra = (back !== 'none' ? p.backPrice[back] : 0) + (sleeveOn ? p.sleevePrice : 0), each = unit + extra;
  const adultNet = adult * each, kidNet = kid * each, share = adultNet + kidNet ? adultNet / (adultNet + kidNet) : 1;
  const fees = setup + DELIVERY_FEE, net = adultNet + kidNet + fees, vat = VAT_RATE * (adultNet + fees * share);
  return { adult, kid, each, net, vat, total: net + vat };
}

/* ---------- live board and countdown ---------- */
function boardRows(){
  return PRODUCTS.map(p => {
    const { n = 0, orders = 0 } = B.totals[p.id] || {}, i = bandIndex(p, n), nb = p.bands[i + 1];
    const top = p.bands[p.bands.length - 1].from * 1.08, pos = x => Math.min(100, Math.sqrt(x / top) * 100);   // square-root scale keeps early bands readable
    return `<div class="gb-brow" data-pid="${p.id}">
    <div class="gb-tile"><div class="l">Product</div><div class="v" style="font-size:22px">${esc(p.name)}</div><div class="s">${esc(p.blurb)}</div></div>
    <div class="gb-tile"><div class="l">Number ordered</div><div class="v" data-b="qty">${n.toLocaleString('en-GB')}</div><div class="s" data-b="orders">${esc(plural(p, n))} · from ${orders} order${orders === 1 ? '' : 's'}</div></div>
    <div class="gb-tile now"><div class="l">Current price</div><div class="v" data-b="now">${money(p.bands[i].price)}</div><div class="s">per ${esc(p.unit)}, front logo</div></div>
    <div class="gb-tile next"><div class="l">Price at next band</div><div class="v" data-b="next">${nb ? money(nb.price) : 'Best price'}</div><div class="s" data-b="nexts">${nb ? `at ${nb.from} · ${nb.from - n} to go` : 'Top band reached'}</div></div>
  </div>
  <div class="gb-prog"><div class="gb-pbar"><div class="fill" style="width:${pos(n)}%"></div></div><div class="gb-ticks">${p.bands.slice(1).map(b => `<span class="gb-tick ${n >= b.from ? 'hit' : ''}" style="left:${pos(b.from)}%"><b>${b.from}</b>${money(b.price)}</span>`).join('')}</div></div>
  <p class="gb-minline ${n >= MIN_TOTAL ? 'ok' : ''}" data-b="min">${n >= MIN_TOTAL ? `&#10003; Minimum of ${MIN_TOTAL} reached: this order is going ahead` : `<b>${MIN_TOTAL - n} more ${esc(p.units)}</b> needed across all clubs for this order to go ahead (minimum ${MIN_TOTAL})`}</p>`; }).join('');
}
function drawBoard(){
  const el = document.getElementById('gboBoardRows'); if (el) el.innerHTML = boardRows();
  const er = document.getElementById('gboBoardErr'); if (er) { er.textContent = B.err; er.hidden = !B.err; }
}
async function watchBoard(){
  if (B.round === ROUND.id) return;
  if (B.off) B.off();
  B.round = ROUND.id; B.totals = {};
  try { B.off = await api.groupbuyBoard(ROUND.id, (t, e) => { if (e || !t) B.err = 'The live totals can’t be loaded just now. You can still place your order.'; else { B.totals = t; B.err = ''; } drawBoard(); }); }
  catch (e) { console.warn(e); B.err = 'The live totals can’t be loaded just now. You can still place your order.'; }
}
function countdown(){
  if (!onScreen()) return;
  const ms = ROUND.close - new Date();
  if (ms <= 0){ ROUND = roundFor(); B.round = ''; watchBoard().then(paint); return; }   // the next order round opens straight away
  const t = Math.floor(ms / 1000), pad = n => String(n).padStart(2, '0'), set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('gboCdD', Math.floor(t / 86400)); set('gboCdH', pad(Math.floor(t / 3600) % 24));
  set('gboCdM', pad(Math.floor(t / 60) % 60)); set('gboCdS', pad(t % 60));
  const cd = document.getElementById('gboCd'); if (cd) cd.classList.toggle('urgent', ms < 3 * 864e5);
}
setInterval(countdown, 1000);
document.addEventListener('ngl:rendered', countdown);

/* ---------- garment preview (copied): the maker's photo of the chosen colour, or a drawing if it can't load ---------- */
const SHAPES = {
  tee: { body:'M100 38 L60 52 L18 92 L44 128 L70 110 L70 268 L230 268 L230 110 L256 128 L282 92 L240 52 L200 38 C190 58 172 68 150 68 C128 68 110 58 100 38 Z',
         neckF:'M100 38 C110 58 128 68 150 68 C172 68 190 58 200 38', neckB:'M104 40 C118 50 134 54 150 54 C166 54 182 50 196 40', logo:[168,86] },
  zip: { body:'M108 34 L66 46 L40 72 L20 252 L50 258 L72 126 L72 272 L228 272 L228 126 L250 258 L280 252 L260 72 L234 46 L192 34 L192 22 L108 22 Z',
         neckF:'M108 22 L108 40 C122 50 136 54 150 54 C164 54 178 50 192 40 L192 22', neckB:'M108 22 L192 22', logo:[168,92], zip:true }
};
function garmentSvg(side){
  const sh = SHAPES[P().shape], [ , c, c2] = COL(), ink = lum(c) > 0.6 ? '#14254a' : '#ffffff', edge = lum(c) > 0.85 ? '#c9cedb' : 'rgba(0,0,0,.18)';
  let art = '';
  if (side === 'front'){
    const [x, y] = sh.logo;
    art = S.frontUrl ? `<image href="${S.frontUrl}" x="${x}" y="${y}" width="40" height="40" preserveAspectRatio="xMidYMid meet"/>`
                     : `<rect x="${x}" y="${y}" width="40" height="40" rx="6" fill="none" stroke="${ink}" stroke-dasharray="4 3" opacity=".7"/><text x="${x + 20}" y="${y + 24}" font-size="10" font-family="Roboto" font-weight="700" fill="${ink}" text-anchor="middle" opacity=".8">LOGO</text>`;
    if (sh.zip) art += `<path d="M150 46 L150 118" stroke="rgba(0,0,0,.35)" stroke-width="3"/><rect x="146" y="112" width="8" height="12" rx="2" fill="#9aa1ad"/>`;
    if (P().sleeve && S.sleeve === 'text'){   // wearer's left sleeve = viewer's right
      const t = (S.sleeveLine || 'SLEEVE TEXT').toUpperCase(), fs = Math.min(13, 150 / Math.max(6, t.length) * 1.75);
      art += `<text transform="translate(250 92) rotate(83.5)" font-family="Roboto Condensed,Roboto" font-weight="800" font-size="${fs}" fill="${ink}">${esc(t)}</text>`;
    }
  } else if (S.back === 'text'){
    const l1 = (S.line1 || 'LINE ONE').toUpperCase(), l2 = (S.line2 || 'LINE TWO').toUpperCase();
    const fit = t => Math.min(26, 150 / Math.max(4, t.length) * 1.6);
    art = `<text x="150" y="108" font-family="Roboto Condensed,Roboto" font-weight="800" font-size="${fit(l1)}" fill="${ink}" text-anchor="middle">${esc(l1)}</text>
           <text x="150" y="${108 + fit(l1) * .2 + fit(l2) + 4}" font-family="Roboto Condensed,Roboto" font-weight="800" font-size="${fit(l2)}" fill="${ink}" text-anchor="middle">${esc(l2)}</text>`;
  } else if (S.back === 'logo'){
    art = S.backUrl ? `<image href="${S.backUrl}" x="95" y="84" width="110" height="80" preserveAspectRatio="xMidYMid meet"/>`
                    : `<rect x="95" y="84" width="110" height="80" rx="8" fill="none" stroke="${ink}" stroke-dasharray="5 4" opacity=".7"/><text x="150" y="129" font-size="12" font-family="Roboto" font-weight="700" fill="${ink}" text-anchor="middle" opacity=".8">BACK LOGO</text>`;
  }
  return `<path d="${sh.body}" fill="${c}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>
          <path d="${side === 'front' ? sh.neckF : sh.neckB}" fill="none" stroke="${edge}" stroke-width="${sh.zip ? 3 : 5}" stroke-linecap="round"/>
          <path d="M${sh.zip ? 72 : 70} ${sh.zip ? 126 : 110} V268 M${sh.zip ? 228 : 230} ${sh.zip ? 126 : 110} V268" stroke="rgba(0,0,0,.06)" stroke-width="2"/>
          ${c2 && sh.zip ? `<path d="M108 22 L192 22 L192 40 C178 50 164 54 150 54 C136 54 122 50 108 40 Z" fill="${c2}" stroke="${edge}" stroke-width="1.5"/>
            <path d="M21 242 L51 248 L50 258 L20 252 Z M279 242 L249 248 L250 258 L280 252 Z" fill="${c2}" stroke="${edge}" stroke-width="1.5"/>` : ''}${art}`;
}
// The photo shows once it has loaded; until then (or if it can't load) the drawing shows
const shotLoaded = 'this.hidden=false;this.nextElementSibling.style.display=\'none\'', shotFailed = 'this.hidden=true;this.nextElementSibling.style.display=\'\'';
function viewHTML(side, label){
  const code = COL()[3], url = code && P().img ? P().img(code, side.toUpperCase()) : '';
  return `<div class="gbo-view">${url ? `<img class="gbo-shot" src="${esc(url)}" alt="${esc(COL()[0] + ' ' + P().name.toLowerCase() + ', ' + side)}" hidden onload="${shotLoaded}" onerror="${shotFailed}">` : ''}<svg data-side="${side}" viewBox="0 0 300 300" role="img" aria-label="${label}">${garmentSvg(side)}</svg><span>${label}</span></div>`;
}
const redrawGarment = () => document.querySelectorAll('#gboRoot svg[data-side]').forEach(s => { s.innerHTML = garmentSvg(s.dataset.side); });

/* ---------- the form ---------- */
function summaryHTML(){
  const p = P(), setup = setupNow(), sleeveOn = p.sleeve && S.sleeve !== 'none', col = COL()[0];
  const r = priceOrder(p, sizesNow(), S.back, sleeveOn, setup, p.bands[0].price);
  return `
    ${r.adult || !r.kid ? `<div class="ln"><span>${r.adult} × ${esc(col)} ${esc(p.name.toLowerCase())}${p.kidsSizes ? ', adult sizes' : ''}, front logo</span><span>${money(p.bands[0].price)} each</span></div>` : ''}
    ${r.kid ? `<div class="ln"><span>${r.kid} × ${esc(col)} ${esc(p.name.toLowerCase())}, children’s sizes (no VAT)</span><span>${money(p.bands[0].price)} each</span></div>` : ''}
    ${S.back !== 'none' ? `<div class="ln"><span>Back print: ${S.back === 'text' ? 'two lines of text' : 'logo'}</span><span>+${money(p.backPrice[S.back])} each</span></div>` : ''}
    ${sleeveOn ? `<div class="ln"><span>Sleeve text</span><span>+${money(p.sleevePrice)} each</span></div>` : ''}
    ${setup ? `<div class="ln"><span>Logo set-up (first order only)</span><span>${money(setup)}</span></div>` : ''}
    <div class="ln"><span>Delivery to your club</span><span>${money(DELIVERY_FEE)}</span></div>
    <div class="ln sub"><span>Subtotal</span><span>${money(r.net)}</span></div>
    <div class="ln"><span>VAT at 20%${r.kid ? ' (adult sizes only)' : ''}</span><span>${money(r.vat)}</span></div>
    <div class="ln tot"><span>Most you will pay</span><span id="gboMost">${money(r.total)}</span></div>
    <div class="gbo-hint">This is today's price. If the total for all clubs passes the next band before the order closes, your price comes down.${p.kidsSizes ? ' Children’s sizes are VAT free.' : ''}</div>`;
}
const qtyText = () => { const q = qtyNow(); return `${q} ${plural(P(), q)}`; };
const drawTotals = () => { const q = document.getElementById('gboQty'), s = document.getElementById('gboSummary'); if (q) q.textContent = qtyText(); if (s) s.innerHTML = summaryHTML(); };

const field = (k, label, type = 'text', attrs = '') => `<label class="gbo-f">${label}<input type="${type}" data-f="${k}" value="${esc(ME[k])}" ${attrs}></label>`;
const opt = (name, value, on, title, small, price = '') => `<label class="gbo-opt"><input type="radio" name="gbo-${name}" value="${value}" ${on ? 'checked' : ''}><span><b>${title}</b>${small ? `<small>${small}</small>` : ''}</span>${price ? `<span class="gbo-price">${price}</span>` : ''}</label>`;
const drop = (which, title, hint) => { const f = which === 'front' ? S.front : S.backFile, url = which === 'front' ? S.frontUrl : S.backUrl;
  return `<label class="gbo-drop ${f ? 'has' : ''}"><span class="thumb" ${url ? `style="background-image:url('${url}')"` : ''}>${url ? '' : f ? 'PDF' : 'Logo'}</span><span><span class="t">${f ? esc(f.name) : title}</span><br><span class="gbo-hint" style="margin:0">${hint}</span></span><input type="file" data-file="${which}" accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf"></label>`; };

function formHTML(){
  const p = P(), col = COL(), steps = [];
  const step = (title, body, id = '') => steps.push({ title, body, id });
  step('Choose your product', `<div class="gbo-prods" role="radiogroup" aria-label="Product">${PRODUCTS.map(x => `<button type="button" class="gbo-pc" role="radio" aria-checked="${x.id === p.id}" data-act="gbo-prod" data-pid="${x.id}"><img src="${esc(x.photo)}" alt=""><b>${esc(x.name)}</b><small>${money(x.bands[0].price)} each, dropping to ${money(x.bands[x.bands.length - 1].price)}. Logo included</small></button>`).join('')}</div>`);
  step('Your club', `<div class="gbo-row2">${field('club', 'Club name', 'text', 'autocomplete="organization" maxlength="120" required')}${field('contact', 'Your name', 'text', 'autocomplete="name" maxlength="120" required')}${field('email', 'Email', 'email', 'autocomplete="email" maxlength="160" required')}${field('phone', 'Phone', 'tel', 'autocomplete="tel" maxlength="40"')}</div>
    <p class="gbo-hint">From your club account. Change anything here for this order.</p>`);
  step('Colour', `<div class="gbo-swatches" role="radiogroup" aria-label="T-shirt colour">${p.colours.map(([n, c, c2], i) => `<button type="button" class="gbo-sw" role="radio" aria-checked="${i === S.ci}" aria-label="${esc(n)}" title="${esc(n)}" data-act="gbo-colour" data-i="${i}" style="background:${c2 ? `linear-gradient(180deg,${c} 50%,${c2} 50%)` : c};--ck:${lum(c) > 0.6 ? '#14254a' : '#fff'}"></button>`).join('')}</div>
    <div class="gbo-colname" id="gboColName">${esc(col[0])}</div><p class="gbo-hint">${esc(p.colourHint)}</p>`);
  const box = z => `<label class="gbo-sz ${S.sizes[z] ? 'on' : ''}"><b>${z}</b>${p.chest ? `<small class="chest">${p.chest[z]}"</small>` : isKid(p, z) ? '<small class="chest">years</small>' : ''}<input type="number" min="0" max="500" step="1" inputmode="numeric" value="${S.sizes[z] || 0}" data-size="${esc(z)}" aria-label="How many ${z}${isKid(p, z) ? ' years' : ''}"></label>`;
  step('Sizes and how many', `<div class="gbo-sizes">${p.kidsSizes ? `<div class="gbo-szgrp">Adult sizes <small>+ VAT</small></div>${p.sizes.map(box).join('')}<div class="gbo-szgrp">Children’s sizes <small>no VAT</small></div>${p.kidsSizes.map(box).join('')}` : p.sizes.map(box).join('')}</div>
    <div class="gbo-total" id="gboQty">${qtyText()}</div><p class="gbo-hint">Want a second colour or the other product? Place a separate order for it.</p>`);
  step('Your logo (front, left chest)', `${drop('front', 'Upload your club logo', 'Vector artwork (PDF or SVG) is best, or a high-resolution PNG. Up to 10 MB.')}
    <div class="gbo-choice" style="margin-top:10px">${opt('setup', 'first', S.setup === 'first', 'Our first group order', 'One-off logo set-up, first order only', money(SETUP_FEE))}${opt('setup', 'repeat', S.setup === 'repeat', 'We’ve ordered before, same logo', 'No set-up charge')}</div>`);
  step('The back (optional extra)', `<div class="gbo-choice">${opt('back', 'none', S.back === 'none', 'Plain back', 'Front logo only')}${opt('back', 'text', S.back === 'text', 'Two lines of text', 'For example COACH, or your club name', '+' + money(p.backPrice.text) + ' each')}${opt('back', 'logo', S.back === 'logo', 'A logo', 'A large logo across the back', '+' + money(p.backPrice.logo) + ' each')}</div>
    ${S.back === 'text' ? `<div class="gbo-backbox"><div class="gbo-row2"><label class="gbo-f">Line 1<input type="text" data-s="line1" value="${esc(S.line1)}" maxlength="24" placeholder="e.g. COACH"></label><label class="gbo-f">Line 2<input type="text" data-s="line2" value="${esc(S.line2)}" maxlength="24" placeholder="e.g. SAADI GYMNASTICS"></label></div></div>` : ''}
    ${S.back === 'logo' ? `<div class="gbo-backbox">${drop('back', 'Upload the back logo', 'PNG, JPG, SVG or PDF, up to 10 MB')}</div>` : ''}`);
  if (p.sleeve) step('The sleeve (optional extra)', `<div class="gbo-choice">${opt('sleeve', 'none', S.sleeve === 'none', 'Plain sleeve', '')}${opt('sleeve', 'text', S.sleeve === 'text', 'Text down the left sleeve', 'One line, for example EVERY SPORT STARTS HERE', '+' + money(p.sleevePrice) + ' each')}</div>
    ${S.sleeve === 'text' ? `<div class="gbo-backbox"><label class="gbo-f">Sleeve text<input type="text" data-s="sleeveLine" value="${esc(S.sleeveLine)}" maxlength="28" placeholder="e.g. EVERY SPORT STARTS HERE"></label></div>` : ''}`);
  step('Delivery address', `<p class="gbo-hint" style="margin:-2px 0 10px">Delivered straight to your club: <b>${money(DELIVERY_FEE)}</b> per club, charged once per order round even if you place more than one order.</p>
    <div class="gbo-stack">${field('a1', 'Address line 1', 'text', 'autocomplete="address-line1" maxlength="120" required')}${field('a2', 'Address line 2', 'text', 'autocomplete="address-line2" maxlength="120"')}
      <div class="gbo-row2">${field('town', 'Town or city', 'text', 'autocomplete="address-level2" maxlength="80" required')}${field('pc', 'Postcode', 'text', 'autocomplete="postal-code" maxlength="10" required')}</div>
      <label class="gbo-f">Notes (optional)<textarea data-s="notes" rows="2" maxlength="500" placeholder="Anything we should know, e.g. a different colour">${esc(S.notes)}</textarea></label></div>`);
  step('Check and place your order', `<div class="gbo-summary" id="gboSummary">${summaryHTML()}</div>
    <label class="gbo-agree"><input type="checkbox" data-s="agree" ${S.agree ? 'checked' : ''}><span>I understand my order is placed now but goes to print only after the order closes on <b>${fmtDate(ROUND.close)}</b>. We'll invoice you at the final price, which will be no higher than today's, and we agree to pay it. If fewer than ${MIN_TOTAL} of this product are ordered across all clubs, the order won't go ahead and we won't be charged.</span></label>
    <button class="btn gbo-go" type="button" data-act="gbo-place" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Placing your order…' : 'Place order'}</button>
    <p class="gbo-hint gbo-nopay">No payment now. You'll pay by card when the round closes and the final price is known.</p>
    <p class="gbo-err" id="gboErr" role="alert">${esc(S.err)}</p>`);
  return `<div class="gbo-form" id="gboForm">${steps.map((s, i) => `<div class="gbo-step"><span class="gbo-num">${i + 1}</span><div><h3>${s.title}</h3>${s.body}</div></div>`).join('')}</div>`;
}
function doneHTML(){
  const d = S.done;
  return `<div class="gbo-done" id="gboDone"><h2>Order placed. Thank you!</h2><p>Your reference is</p><div class="ref">${esc(d.ref)}</div>
    <p>${d.qty} × ${esc(d.colour)} ${esc(d.units)} for <b>${esc(d.club)}</b>.<br>The order closes on <b>${fmtDate(d.close)}</b>. We'll then email your invoice at the final price. You'll pay by card when the round closes and the final price is known: open <a href="#/shop/orders">Shop &amp; orders</a> and choose Finish payment within 7 days, and your kit goes to print as soon as we receive payment.</p>
    ${d.logoErr ? `<p class="gbo-err">Your order is placed, but your logo didn’t upload. Please email it to ${CONTACT} and quote your reference.</p>` : ''}
    ${d.sample ? '<p class="gbo-hint">Sample data: nothing was saved. It is counted on the board above until you reload the page.</p>' : ''}
    <p class="gbo-hint">Keep your reference. If anything needs changing, email ${CONTACT} and quote it.</p>
    <button class="btn gbo-go" type="button" style="max-width:320px" data-act="gbo-again">Place another order</button></div>`;
}
function mineHTML(){
  const list = MINE.filter(o => o.round === ROUND.id);
  if (!list.length) return '';
  const st = { placed:'Placed', invoiced:'Invoiced: pay in Shop & orders', paid:'Paid', sent:'Gone to print', cancelled:'Cancelled' };
  return `<div class="card gbo-mine" id="gboMine"><h2>Your orders this round</h2><table><tr><th>Reference</th><th>Product</th><th>Colour</th><th>Qty</th><th>Status</th></tr>
    ${list.map(o => `<tr data-ref="${esc(o.ref)}"><td><b>${esc(o.ref)}</b></td><td>${esc(prodOf(o.product).name)}</td><td>${esc(o.colour)}</td><td>${o.qty}</td><td>${esc(st[o.status] || o.status)}</td></tr>`).join('')}</table></div>`;
}

function view(){
  const p = P();
  return `<div class="gbo-root" id="gboRoot">
  <div class="gb-hero"><span class="gb-kick">Group purchasing · Quarterly order</span>
    <h2>The more clubs order, the less everyone pays</h2>
    <p>Standard NGL staff kit with your club's logo: a t-shirt and a quarter zip. Every club's order is added together, and when the total passes each band, the price comes down for <b>everyone</b> in that order.</p></div>
  <section class="gb-countdown" aria-label="Time left to order">
    <div class="gb-cdl"><span class="k">This order closes in</span><span class="d">${esc(fmtDate(ROUND.close))} at 11:59pm</span></div>
    <div class="gb-cdt" id="gboCd" role="timer" aria-live="off">
      <div><b id="gboCdD">–</b><span>days</span></div><div><b id="gboCdH">–</b><span>hours</span></div><div><b id="gboCdM">–</b><span>mins</span></div><div><b id="gboCdS">–</b><span>secs</span></div>
    </div>
  </section>
  <section class="gb-board" aria-labelledby="gboBoardTitle">
    <div class="gb-bhead"><span class="gb-live" id="gboBoardTitle"><i aria-hidden="true"></i>Live order board</span><span class="gb-closes">Order closes <b>${esc(fmtDate(ROUND.close))}</b></span></div>
    <div id="gboBoardRows">${boardRows()}</div>
    <p class="gb-bnote">Each product has its own bands. The final price is fixed when the order closes, and every club pays the same price. Prices exclude VAT, which applies to adult sizes only.</p>
    <p class="gb-berr" id="gboBoardErr" ${B.err ? '' : 'hidden'}>${esc(B.err)}</p>
  </section>
  <div class="gbo-howto">
    <div class="gbo-how" style="--c:var(--pre)"><b>1. Place your order</b><span>Colour, sizes, your logo and delivery address.</span></div>
    <div class="gbo-how" style="--c:var(--gen)"><b>2. Watch the price drop</b><span>As other clubs order, the total climbs through the bands.</span></div>
    <div class="gbo-how" style="--c:var(--perf)"><b>3. Order closes</b><span>This order closes on ${ROUND.close.toLocaleDateString('en-GB', { day:'numeric', month:'long' })}, and the final price is fixed then.</span></div>
    <div class="gbo-how" style="--c:var(--uni)"><b>4. Pay and we print</b><span>We email your invoice at the final price. Pay by card in Shop &amp; orders within 7 days and your order goes to print.</span></div>
  </div>
  <div class="gbo-grid">
    <aside class="card gbo-prod">
      <div class="gbo-views" id="gboViews">${viewHTML('front', 'Front')}${viewHTML('back', 'Back')}</div>
      <h3 class="gbo-pname">${esc(p.full)}</h3>
      <ul>${p.points.map(t => `<li>${t}</li>`).join('')}</ul>
      <figure class="gbo-photo"><img src="${esc(p.photo)}" alt="${esc(p.caption)}"><figcaption>${esc(p.caption)}</figcaption></figure>
    </aside>
    <section class="card gbo-card" id="gboCard">${S.done ? doneHTML() : formHTML()}</section>
  </div>
  ${mineHTML()}
  <p class="gb-ftr">National Gymnastics League · Group purchasing · Exclusively for British Gymnastics clubs</p></div>`;
}
// Redraw this screen in place (keeps the club's typing; the rest of the app isn't redrawn)
function paint(){ const r = onScreen(); if (!r) return; const y = window.scrollY; r.outerHTML = view(); window.scrollTo(0, y); countdown(); }

/* ---------- typing, ticking and files (inside #gboRoot) ---------- */
document.addEventListener('input', e => {
  const t = e.target; if (!t.closest || !t.closest('#gboRoot')) return;
  if (t.dataset.size) { S.sizes[t.dataset.size] = Math.max(0, Math.floor(+t.value || 0)); t.closest('.gbo-sz').classList.toggle('on', +t.value > 0); drawTotals(); }
  else if (t.dataset.f) ME[t.dataset.f] = t.value;
  else if (t.dataset.s && t.type !== 'checkbox') { S[t.dataset.s] = t.value; if (['line1', 'line2', 'sleeveLine'].includes(t.dataset.s)) redrawGarment(); }
});
document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.size && t.value === '0' && t.closest('#gboRoot')) t.select(); });
document.addEventListener('change', e => {
  const t = e.target; if (!t.closest || !t.closest('#gboRoot')) return;
  if (t.type === 'checkbox' && t.dataset.s === 'agree') { S.agree = t.checked; return; }
  if (t.type === 'radio' && t.name.startsWith('gbo-')) { S[t.name.slice(4)] = t.value; S.err = ''; paint(); return; }
  if (t.dataset.file) pickFile(t.dataset.file, t);
});
function pickFile(which, inp){
  const f = inp.files[0]; if (!f) return;
  if (f.size > 10 * 1024 * 1024){ inp.value = ''; return showErr('That file is over 10 MB. Please choose a smaller one.'); }
  if (!/\.(png|jpe?g|svg|pdf)$/i.test(f.name)){ inp.value = ''; return showErr('Please upload a PNG, JPG, SVG or PDF file.'); }
  const set = (file, url) => { if (which === 'front') { S.front = file; S.frontUrl = url; } else { S.backFile = file; S.backUrl = url; } S.err = ''; paint(); };
  if (/pdf$/i.test(f.name)) return set(f, '');
  const r = new FileReader(); r.onload = () => set(f, r.result); r.readAsDataURL(f);
}
function showErr(m){ S.err = m; const el = document.getElementById('gboErr'); if (el) el.textContent = m; }

/* ---------- buttons (data-act="gbo-…"): js/actions.js sends clicks here ---------- */
export const GBO = {
  'gbo-prod'(b){ if (b.dataset.pid === S.pid) return; const name = COL()[0]; S.pid = b.dataset.pid;
    const i = P().colours.findIndex(c => c[0] === name); S.ci = i < 0 ? 0 : i;
    if (!P().sleeve) S.sleeve = 'none'; paint(); },
  'gbo-colour'(b){ S.ci = +b.dataset.i;
    document.querySelectorAll('#gboRoot .gbo-sw').forEach(x => x.setAttribute('aria-checked', x === b));
    const n = document.getElementById('gboColName'); if (n) n.textContent = COL()[0];
    const v = document.getElementById('gboViews'); if (v) v.innerHTML = viewHTML('front', 'Front') + viewHTML('back', 'Back');
    drawTotals(); },
  async 'gbo-place'(b){
    const p = P(), miss = [], v = k => String(ME[k] || '').trim();
    showErr('');
    if (!v('club')) miss.push('your club name'); if (!v('contact')) miss.push('your name');
    if (!/^\S+@\S+\.\S+$/.test(v('email'))) miss.push('a valid email address');
    if (!qtyNow()) miss.push('at least one ' + p.unit); if (!S.front) miss.push('your club logo');
    if (S.back === 'text' && !S.line1.trim() && !S.line2.trim()) miss.push('the text for the back');
    if (S.back === 'logo' && !S.backFile) miss.push('the back logo');
    if (p.sleeve && S.sleeve === 'text' && !S.sleeveLine.trim()) miss.push('the sleeve text');
    if (!v('a1') || !v('town') || !v('pc')) miss.push('the delivery address');
    if (!S.agree) miss.push('a tick to agree to pay the final price');
    if (miss.length) return showErr('Please add ' + miss.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.');
    S.busy = true; b.disabled = true; b.textContent = 'Placing your order…';
    try {
      const round = roundFor();                           // the order lands in whichever round is open right now
      const qty = qtyNow(), sleeveOn = p.sleeve && S.sleeve === 'text', sizes = sizesNow();
      const order = {
        round: round.id, product: p.id, productName: p.name, club: v('club'), contactName: v('contact'), email: v('email').toLowerCase(), phone: v('phone'),
        colour: COL()[0], sizes, qty,
        back: { type: S.back, line1: S.back === 'text' ? S.line1.trim() : '', line2: S.back === 'text' ? S.line2.trim() : '', logoPath: '' },
        sleeve: { type: sleeveOn ? 'text' : 'none', text: sleeveOn ? S.sleeveLine.trim() : '' },
        address: { line1: v('a1'), line2: v('a2'), town: v('town'), postcode: v('pc').toUpperCase() }, notes: S.notes.trim(),
        startPrice: p.bands[0].price, backPrice: S.back === 'none' ? 0 : p.backPrice[S.back], sleevePrice: sleeveOn ? p.sleevePrice : 0,
        setupFee: setupNow(), deliveryFee: DELIVERY_FEE,
        kidsQty: Object.entries(sizes).filter(([z]) => isKid(p, z)).reduce((a, [, n]) => a + n, 0),
        status: 'placed'
      };
      const r = await api.groupbuyPlace(order, { front: S.front, back: S.back === 'logo' ? S.backFile : null });
      // Remember the delivery address on the club account for next time (not with sample data)
      if (!r.sample) api.updateClub({ groupbuyAddress: order.address }).catch(() => {});
      S.done = { ref: r.ref, qty, colour: COL()[0], units: plural(p, qty), club: order.club, close: round.close, logoErr: r.logoErr, sample: r.sample };
      S.busy = false;
      try { MINE = await api.groupbuyMine(); } catch (e) { console.warn(e); }
      if (r.sample) B.totals = (await import('../admin/groupbuy.js')).demoOpenTotals();
      paint(); const c = document.getElementById('gboCard'); if (c) c.scrollIntoView({ behavior:'smooth', block:'start' });
    } catch (err){
      console.error(err); S.busy = false; b.disabled = false; b.textContent = 'Place order';
      showErr('Sorry, your order couldn’t be placed just now. Please try again, or email ' + CONTACT + '.\n(' + (err.code || err.message || 'error') + ')');
    }
  },
  'gbo-again'(){ S = blank(); paint(); const c = document.getElementById('gboCard'); if (c) c.scrollIntoView({ behavior:'smooth', block:'start' }); }
};

function loadCss(){
  [['admin-groupbuy', 'css/admin-groupbuy.css'], ['shop-groupbuy', 'css/shop-groupbuy.css']].forEach(([k, href]) => {
    if (document.querySelector(`link[data-admin-css="${k}"]`)) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.adminCss = k; document.head.appendChild(l); });
}

/* The screen: #/shop/groupbuy. club = the signed-in club's account (api.club()). */
export default async function groupbuyOrder(club, parts = []){
  loadCss();
  if (club && club !== CLUB) { CLUB = club; fromAccount(club); }
  ROUND = roundFor();
  await watchBoard();
  try { MINE = await api.groupbuyMine(); } catch (e) { console.warn(e); MINE = []; }
  return view();
}
