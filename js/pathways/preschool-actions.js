// Pre-School buttons (data-act="ps-…"): captions, family link, QR posters, term calendar, saving the plan, buying.
import api from '../data.js';
import { modal, toast, esc, gbp } from '../ui.js';
import { loadScript, printHTML } from './index.js';
import ps from './preschool.js';

const rerender = () => window.NGL_RENDER && window.NGL_RENDER();
const H = () => ps.helpers();
const P2 = n => String(n).padStart(2, '0');

async function copy(text, done){
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch (_) { modal(`<h2>Copy this</h2><textarea rows="12" style="width:100%;font:inherit">${esc(text)}</textarea><div class="btn-row"><button class="btn" data-close>Done</button></div>`); }
}

// Read the planner form back into the plan before any action that needs it
function readForm(){
  const c = H().cfg(), q = s => document.querySelector(s); if (!q('#psStart')) return c;
  c.club = q('#psClub').value; c.startWeek = +q('#psStart').value || 1; c.seasonal = !!q('#psSeas').checked;
  document.querySelectorAll('.ps-term').forEach(el => { const t = c.terms[+el.dataset.ti];
    el.querySelectorAll('input').forEach(i => { t[i.dataset.f] = i.type === 'number' ? (+i.value || 0) : i.value; }); });
  return c;
}

// One-page term calendar (A4 landscape) for the gym wall
function termCal(ti){
  const {P, cfg, IMG, S} = H(), c = cfg(), rows = P.plan(c).filter(r => r.termIndex === ti), t = c.terms[ti] || {};
  const dd = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'});
  const tiles = []; rows.forEach((r, i) => { if (i && (P.parse(r.date) - P.parse(rows[i - 1].date)) > 8 * 864e5) tiles.push({brk: true}); tiles.push(r); });
  const n = tiles.length, cols = n <= 12 ? 4 : 5, rws = Math.ceil(n / cols), tileH = Math.floor(152 / rws), fs = rws <= 2 ? 10.5 : rws === 3 ? 8.6 : 7.6;
  const book = (b, col) => `<div class="pc-b"><img src="${IMG}medal${P2(b.country.n)}.png" alt=""><div><b style="color:${col}">${esc(b.country.name)}</b><span>${b.skills.map(esc).join('<br>')}</span></div></div>`;
  const tile = r => r.brk ? `<div class="pc-t pc-brk" data-fit style="height:${tileH}mm;font-size:${fs}pt"><b>Half term</b><span>No classes</span></div>`
    : `<div class="pc-t${r.newLevel ? ' nl' : ''}" data-fit style="height:${tileH}mm;font-size:${fs}pt"><div class="pc-h"><span>Week ${r.week}</span><span>${dd(r.date)}</span></div>
      <div class="pc-th"><img src="${IMG}post_${r.theme.file}.jpg" alt=""><b>${esc(r.theme.name)}</b>${r.seasonal ? '<i>Seasonal</i>' : ''}</div>
      ${r.seasonal ? '<div class="pc-sea">A themed class. No new passport skills.</div>' : book(r.b1, '#c2185b') + book(r.b2, '#28225c')}</div>`;
  const bar = ['#e84187', '#fbd43a', '#e8822f', '#0073b3', '#00aeb7', '#6ba526', '#8f286b'].map(x => `<i style="flex:1;background:${x}"></i>`).join('');
  const f = rows.find(r => !r.seasonal), l = [...rows].reverse().find(r => !r.seasonal);
  return `<div class="pc"><div class="pc-bar">${bar}</div>
    <div class="pc-head"><img src="${IMG}logo.png" alt="NGL Pre-School"><div><div class="pc-k">Around the World with Somi &amp; Flic · Term calendar</div>
      <div class="pc-ti">${esc(t.name || 'Term ' + (ti + 1))}</div><div class="pc-s">${esc(c.club || S.club.name || '')}${rows.length ? ` · ${dd(rows[0].date)} to ${dd(rows[rows.length - 1].date)}` : ''}${f ? ` · programme weeks ${f.w}–${l.w}` : ''}</div></div></div>
    <div class="pc-grid" style="grid-template-columns:repeat(${cols},1fr)">${tiles.map(tile).join('')}</div>
    <div class="pc-key">Each week: the lesson plan theme, then the two sticker skills for Book 1 and Book 2. A pink border marks the start of a new country.</div>
    <div class="pc-foot"><div><b>NGL Pre-School</b> · Exclusively for British Gymnastics Clubs</div><div class="r">OFFICIAL SPONSOR <img src="${IMG}justgo-logo-white.png" alt="JustGo"></div></div></div>`;
}

function qrPoster(kind){
  const {cfg, familyLink, IMG, S} = H(), club = esc(cfg().club || S.club.name || 'our club');
  const q = window.qrcode(0, 'M'); q.addData(familyLink()); q.make(); const qr = q.createSvgTag({cellSize: 4, margin: 2, scalable: true});
  const one = size => `<div class="qp ${size}"><div class="qp-head"><img src="${IMG}logo.png" alt="NGL Pre-School"><div class="qp-brand">Around the World with Somi &amp; Flic</div></div>
    <div class="qp-body"><div class="qp-club">${club}</div><h1>Follow your child’s journey around the world</h1>
      <p class="qp-lead">This week’s country and theme, their two sticker skills and fun ideas to try at home, on your phone.</p>
      <div class="qp-qr">${qr}</div><ol class="qp-steps"><li><b>Scan</b> with your phone camera</li><li><b>Pick</b> Book 1 or Book 2</li><li><b>Add</b> it to your home screen</li></ol>
      <p class="qp-alt">No camera? Ask a coach for the family link.</p></div>
    <div class="qp-foot">We don’t ask for, or store, any details about you or your child.</div></div>`;
  return kind === 'flyer' ? `<div class="qposter">${one('a5')}<div class="qp-cut">✂ cut here</div>${one('a5')}</div>` : `<div class="qposter">${one('a4')}</div>`;
}

async function checkout(lines, delivery, extra, label){
  try { const o = await api.placeOrder(lines, delivery, extra); toast(label + ': opening secure payment…'); await api.payByCard(o.id); }
  catch (x) { console.error(x); toast(x.message.startsWith('Sample') ? x.message : 'Couldn’t start the order. Please try again.', false); }
}

export const PS = {
  async 'ps-caption'(b){ const {P, captionFor} = H(); const k = b.dataset.n;
    const t = k[0] === 's' ? P.SEASONAL.find(x => x.file === k.slice(1)) : P.THEMES.find(x => x.n === +k);
    copy(captionFor(t), 'Caption copied. Paste it into Instagram with the post.'); },
  async 'ps-copy'(){ copy(H().familyLink(), 'Family link copied'); },
  async 'ps-qr'(b){ try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'); } catch (_) { return toast('Couldn’t load the QR code maker. Check your connection.', false); }
    readForm(); printHTML(qrPoster(b.dataset.kind), 'NGL Pre-School family app ' + b.dataset.kind); },
  async 'ps-cal'(b){ const c = readForm(); const list = b.dataset.ti === 'all' ? c.terms.map((t, i) => i).filter(i => c.terms[i].start && c.terms[i].weeks > 0) : [+b.dataset.ti];
    printHTML(list.map(termCal).join(''), 'NGL Pre-School term calendar'); },
  async 'ps-term-add'(){ const c = readForm(), last = c.terms[c.terms.length - 1];
    let start = ''; if (last && last.start) { const d = new Date(last.start + 'T12:00'); d.setDate(d.getDate() + (last.weeks + 3) * 7); start = d.toISOString().slice(0, 10); }
    c.terms.push({name: 'Term ' + (c.terms.length + 1), start, weeks: 12, half: 6}); rerender(); },
  async 'ps-term-del'(b){ const c = readForm(); c.terms.splice(+b.dataset.ti, 1); rerender(); },
  async 'ps-save'(){ const c = readForm(); localStorage.ngl_ps_plan = JSON.stringify(c);
    try { if (api.mode !== 'demo') { await api.updateClub({plans: {preschool: c}}); const code = S.lic && S.lic.code; if (code && api.syncFamilyPlan) await api.syncFamilyPlan(code, c); } toast('Plan saved. Your family link now follows it.'); }
    catch (x) { console.error(x); toast('Saved on this device, but not to your club account. Please try again.', false); }
    rerender(); },
  async 'ps-buy'(b){
    const {BANDS} = H(), band = BANDS.find(x => x.k === b.dataset.band), c = await api.club(), vat = Math.round(band.price * 20) / 100;
    const m = modal(`<h2>Start your Pre-School licence</h2>
      <table><tr><td>Pre-School Club Licence: ${esc(band.label)} (12 months)</td><td style="text-align:right">${gbp(band.price)}</td></tr>
      <tr><td>VAT (20%)</td><td style="text-align:right">${gbp(vat)}</td></tr><tr><td>A1 Around the World poster, postage included</td><td style="text-align:right">Free</td></tr>
      <tr><td><b>Total</b></td><td style="text-align:right"><b>${gbp(band.price + vat)}</b></td></tr></table>
      <form><label class="field"><span>Where should we post your poster?</span><textarea id="addr" rows="3" required placeholder="Club name, street, town, postcode">${esc(c.deliveryAddress || '')}</textarea></label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0 10px"><input type="checkbox" required style="width:auto;margin-top:4px"><span>We have ${esc(band.label.replace(' Pre-School gymnasts', ''))} Pre-School gymnasts. We’ll move up a band if that changes.</span></label>
      <div class="btn-row"><button class="btn">Continue to secure payment</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const addr = m.querySelector('#addr').value.trim(); m.remove();
      checkout([{k: 'licence', path: 'preschool', n: `Pre-School Club Licence: ${band.label} (12 months)`, qty: 1, unit: band.price}, {k: 'vat', n: 'VAT (20%)', qty: 1, unit: vat},
        {k: 'poster', n: 'A1 Around the World poster (free with the licence)', qty: 1, unit: 0}], addr, {kind: 'licence', licPath: 'preschool', band: band.label}, 'Pre-School licence'); });
  },
  async 'ps-pack'(b){
    const {PACKS} = H(), [n, , price] = PACKS[b.dataset.pack], vat = Math.round(price * 20) / 100;
    checkout([{k: 'pack', path: 'preschool', n, qty: 1, unit: price}, {k: 'vat', n: 'VAT (20%)', qty: 1, unit: vat}], '', {kind: 'pack', licPath: 'preschool', pack: b.dataset.pack}, n);
  }
};

// Live preview: changing the start week or seasonal box redraws the planner straight away
document.addEventListener('change', e => { if (e.target.closest('#psStart, #psSeas')) { readForm(); rerender(); } });
