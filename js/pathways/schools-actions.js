// Schools buttons (data-act="sch-…"): schools list, Graduations and medals, the two planners, the licence.
import api from '../data.js';
import { modal, toast, esc, gbp } from '../ui.js';
import * as D from './schools-data.js';
import { UI, state, planRead, planResults, planPrint, planStart, secRead, secOut, secPrint, secStart } from './schools.js';

const redraw = () => window.NGL_RENDER && window.NGL_RENDER();
const fail = x => { console.error(x); toast(String(x.message || '').startsWith('Sample') ? x.message : 'Couldn’t save. Please try again.', false); };
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
async function checkout(lines, extra, label){
  try { const o = await api.placeOrder(lines, '', extra); toast(label + ': opening secure payment…'); await api.payByCard(o.id); } catch (x) { fail(x); }
}

export const SCH = {
  'sch-app'(b){ UI.app = b.dataset.v; redraw(); },
  'sch-lvl'(b){ UI.lvl = +b.dataset.v; redraw(); },

  'sch-school'(b){
    const S = state(), list = [...(S.club.schoolsList || [])], sc = list.find(s => s.id === b.dataset.id);
    const m = modal(`<h2>${sc ? 'Edit school' : 'Add a school'}</h2><form><label class="field"><span>School name</span><input id="sn" required value="${esc(sc ? sc.name : '')}"></label>
      <label class="field"><span>How many children take part at this school?</span><input id="sc" type="number" min="0" max="5000" required value="${sc ? parseInt(sc.children) || 0 : ''}"></label>
      <p class="lead" style="font-size:13px">Just the number, no names. Your total across all schools sets your licence band.</p>
      <div class="btn-row"><button class="btn">${sc ? 'Save' : 'Add school'}</button>${sc ? '<button class="btn ghost" type="button" data-del>Remove</button>' : ''}<button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    const save = async next => { try { await api.updateClub({schoolsList: next}); m.remove(); toast('Schools updated'); redraw(); } catch (x) { fail(x); } };
    m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const name = m.querySelector('#sn').value.trim(), children = Math.max(0, parseInt(m.querySelector('#sc').value) || 0);
      save(sc ? list.map(s => s.id === sc.id ? {...s, name, children} : s) : [...list, {id: uid(), name, children}]); });
    const del = m.querySelector('[data-del]'); if (del) del.addEventListener('click', () => save(list.filter(s => s.id !== sc.id)));
  },

  'sch-grad'(b){
    const S = state(), evs = [...(S.club.schoolEvents || [])], ev = evs.find(e => e.id === b.dataset.id) || {};
    const m = modal(`<h2>${ev.id ? 'Edit Graduation' : 'Add a Graduation'}</h2><form>
      <label class="field"><span>Event name</span><input id="gt" required value="${esc(ev.title || 'NGL Schools Graduation')}"></label>
      <label class="field"><span>Who is it for?</span><select id="gs"><option value="">All our schools</option>${(S.club.schoolsList || []).map(s => `<option value="${esc(s.id)}" ${ev.schoolId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <div class="grid g2"><label class="field"><span>Date</span><input id="gd" type="date" required min="${today()}" value="${esc(ev.date || '')}"></label><label class="field"><span>Start time</span><input id="gtm" type="time" value="${esc(ev.time || '10:00')}"></label></div>
      <label class="field"><span>Venue</span><input id="gv" required value="${esc(ev.venue || S.club.name || '')}"></label>
      <label class="field"><span>How families book (optional link)</span><input id="gb" type="url" value="${esc(ev.bookingUrl || '')}" placeholder="https://… your club’s booking page"></label>
      <p class="lead" style="font-size:13px">Families pay £${D.GRAD_FAMILY_PRICE} a gymnast including one spectator; extra spectators £${D.GRAD_EXTRA_SPECTATOR}. NGL charges £${D.GRAD_NGL_FEE} + VAT a graduate, medal included.</p>
      <div class="btn-row"><button class="btn">${ev.id ? 'Save changes' : 'Publish Graduation'}</button>${ev.id ? '<button class="btn ghost" type="button" data-del>Delete</button>' : ''}<button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    const save = async next => { try { await api.updateClub({schoolEvents: next});
      try { await api.syncFamilyEvents(next); } catch (x) { console.warn('Graduations not yet shown to families', x); toast('Saved. Families will see it once you’re back online.', false); }   // the parents' copy
      m.remove(); toast('Graduations updated'); redraw(); } catch (x) { fail(x); } };
    m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const g = id => m.querySelector(id).value.trim(), sid = g('#gs'), school = (S.club.schoolsList || []).find(s => s.id === sid);
      const d = {id: ev.id || uid(), title: g('#gt'), schoolId: sid, schoolName: school ? school.name : '', date: g('#gd'), time: g('#gtm'), venue: g('#gv'), bookingUrl: g('#gb'), medals: ev.medals || 0};
      save(ev.id ? evs.map(x => x.id === ev.id ? d : x) : [...evs, d]); });
    const del = m.querySelector('[data-del]'); if (del) del.addEventListener('click', () => save(evs.filter(x => x.id !== ev.id)));
  },

  'sch-medals'(b){
    const S = state(), ev = (S.club.schoolEvents || []).find(e => e.id === b.dataset.id);
    const m = modal(`<h2>Order Graduation medals</h2><p class="lead">${esc(ev.title)} · ${esc(ev.date)}</p><form>
      <label class="field"><span>How many gymnasts are graduating?</span><input id="mq" type="number" min="1" max="2000" value="20" required></label>
      <label class="field"><span>Extra spectator tickets sold</span><input id="ms" type="number" min="0" max="10000" value="0"></label><div id="msum"></div>
      <div class="btn-row"><button class="btn">Continue to secure payment</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    const vals = () => { const n = Math.max(0, parseInt(m.querySelector('#mq').value || '0')), s = Math.max(0, parseInt(m.querySelector('#ms').value || '0')), net = n * D.GRAD_NGL_FEE + s * D.GRAD_NGL_SPECTATOR; return {n, s, net, vat: Math.round(net * 20) / 100}; };
    const upd = () => { const v = vals(); m.querySelector('#msum').innerHTML = `<table><tr><td>${v.n} graduates × ${gbp(D.GRAD_NGL_FEE)} (medal and place)</td><td style="text-align:right">${gbp(v.n * D.GRAD_NGL_FEE)}</td></tr>${v.s ? `<tr><td>${v.s} extra spectators × ${gbp(D.GRAD_NGL_SPECTATOR)}</td><td style="text-align:right">${gbp(v.s * D.GRAD_NGL_SPECTATOR)}</td></tr>` : ''}<tr><td>VAT (20%)</td><td style="text-align:right">${gbp(v.vat)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${gbp(v.net + v.vat)}</b></td></tr></table>`; };
    m.querySelectorAll('input').forEach(i => i.addEventListener('input', upd)); upd();
    m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const v = vals(); if (!v.n) return; m.remove();
      const lines = [{k: 'graduation', path: 'schools', n: `Graduation medals and places: ${ev.title} (${ev.date})`, qty: v.n, unit: D.GRAD_NGL_FEE}];
      if (v.s) lines.push({k: 'spectator', path: 'schools', n: 'Extra spectator tickets', qty: v.s, unit: D.GRAD_NGL_SPECTATOR});
      lines.push({k: 'vat', n: 'VAT (20%)', qty: 1, unit: v.vat});
      checkout(lines, {kind: 'graduation', eventId: ev.id}, 'Graduation medals'); });
  },

  // Profit planner
  async 'sch-plan-save'(){ try { await api.updateClub({projection: planRead()}); toast('Saved. Your numbers will be here next time.'); } catch (x) { fail(x); } },
  'sch-plan-print'(){ planPrint(); },
  async 'sch-plan-reset'(){ const S = state(); delete S.club.projection; redraw(); toast('Reset to NGL’s figures. Press Save to keep them.'); },

  // Secondary planner
  async 'sch-sec-save'(){ try { await api.updateClub({secPlan: secRead()}); toast('Saved. Your settings will be here next time.'); } catch (x) { fail(x); } },
  'sch-sec-reset'(){ UI.sec = {...D.SEC_DEFAULTS}; redraw(); },
  'sch-sec-print'(){ secPrint(); },
  'sch-sec-today'(){ const t = D.secToday(secRead()); if (t.key === 'on') secPrint(t.n); },

  'sch-buy'(b){
    const band = D.SCHOOLS_BANDS.find(x => x.key === b.dataset.band), vat = Math.round(band.price * 20) / 100;
    const m = modal(`<h2>Start your Schools Club Licence</h2><table><tr><td>NGL Schools Club Licence: ${esc(band.label)} (12 months)</td><td style="text-align:right">${gbp(band.price)}</td></tr><tr><td>VAT (20%)</td><td style="text-align:right">${gbp(vat)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${gbp(band.price + vat)}</b></td></tr></table>
      <form><label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input type="checkbox" required style="width:auto;margin-top:4px"><span>We coach ${esc(band.short)} Schools gymnasts. We’ll move up a band if that changes.</span></label>
      <div class="btn-row"><button class="btn">Continue to secure payment</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', e => { e.preventDefault(); m.remove();
      checkout([{k: 'licence', path: 'schools', n: `NGL Schools Club Licence: ${band.label} (12 months)`, qty: 1, unit: band.price}, {k: 'vat', n: 'VAT (20%)', qty: 1, unit: vat}], {kind: 'licence', licPath: 'schools', band: band.label}, 'Schools licence'); });
  }
};

// Live recalculation as numbers change, and the first calculation when a planner opens
document.addEventListener('input', e => {
  if (e.target.closest('#pl_form [data-k]')) planResults(planRead());
  if (e.target.closest('#sec_form input[data-k]')) { UI.sec = secRead(); secOut(UI.sec); }
});
document.addEventListener('change', e => {
  if (e.target.closest('#pl_form [data-k]')) planResults(planRead());
  if (e.target.closest('#sec_form select[data-k]')) { UI.sec = secRead(); if (e.target.dataset.k === 'level') redraw(); else secOut(UI.sec); }
});
document.addEventListener('ngl:rendered', () => { if (document.getElementById('pl_out')) planResults(planRead()); });
