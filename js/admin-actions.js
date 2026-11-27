// NGL Admin buttons (data-act="adm-…"). Every write goes through admin-data.js; the database rules check it's an admin.
import adm from './admin-data.js';
import { PATHWAYS } from './config.js';
import { modal, toast, esc, date } from './ui.js';

const rerender = () => window.NGL_RENDER && window.NGL_RENDER();
const fail = x => { console.error(x); toast(String(x.message || '').startsWith('Sample') ? x.message : 'Couldn’t save. Please try again.', false); };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const yearOn = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };

export const ADM = {
  async 'adm-test'(b){ try { await adm.markTest(b.dataset.order, !!b.dataset.on); toast(b.dataset.order + (b.dataset.on ? ' left out of the totals (test)' : ' counted again')); rerender(); } catch (x) { fail(x); } },
  async 'adm-sent'(b){ try { await adm.markSent(b.dataset.order); toast(b.dataset.order + ' marked as posted'); rerender(); } catch (x) { fail(x); } },

  async 'adm-lic'(b){
    const {club, path, to} = b.dataset, p = PATHWAYS.find(x => x.k === path);
    if (to === 'off') { try { await adm.setLicence(club, path, {status: 'explore', label: 'Explore free'}); toast(p.n + ' licence switched off'); rerender(); } catch (x) { fail(x); } return; }
    const m = modal(`<h2>Switch on ${esc(p.n)}</h2><form>
      <label class="field"><span>Band</span><input id="band" placeholder="e.g. 50–99 gymnasts"></label>
      <label class="field"><span>Renews on</span><input id="renews" type="date" required value="${yearOn()}"></label>
      <label class="field"><span>Note (optional)</span><input id="note" placeholder="e.g. Trial until Easter"></label>
      <div class="btn-row"><button class="btn">Switch on</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const v = id => m.querySelector('#' + id).value.trim();
      try { await adm.setLicence(club, path, {status: 'live', label: 'Licence live', band: v('band'), renews: v('renews'), note: v('note'), setBy: 'admin'}); m.remove(); toast(p.n + ' licence switched on'); rerender(); } catch (x) { fail(x); } });
  },

  async 'adm-team-remove'(b){
    const m = modal(`<h2>Remove ${esc(b.dataset.name)}?</h2><p>They lose access to every NGL Admin app straight away. You can invite them again later.</p><div class="btn-row"><button class="btn" id="rmYes">Remove access</button><button class="btn ghost" type="button" data-close>Cancel</button></div>`);
    m.querySelector('#rmYes').addEventListener('click', async () => { try { await adm.removeMember(b.dataset.email); m.remove(); toast('Access removed'); rerender(); } catch (x) { fail(x); } });
  },

  async 'adm-attach'(b){
    const sel = document.getElementById('att-' + b.dataset.key), id = sel && sel.value; if (!id) return toast('Choose the club first.', false);
    try { const club = (await adm.clubs()).find(c => c.id === id); const n = await adm.attachPending(b.dataset.ids.split(','), club);
      toast(`${n} booking${n === 1 ? '' : 's'} attached to ${club.name}`); rerender(); } catch (x) { fail(x); }
  },

  async 'adm-res'(b){
    const lbl = {bought: 'marked bought on JustGo', waiting: 'moved to the waiting list', reserved: 'given places'};
    try { await adm.setReservation(b.dataset.id || b.dataset.ref, b.dataset.to); toast(b.dataset.ref + ' ' + lbl[b.dataset.to]); rerender(); } catch (x) { fail(x); }
  },

  // Booking: who sees the Book and pay button (the JustGo Events link) in the Club Hub
  async 'adm-booking'(b){
    const c = (await adm.calendar()).find(x => x.id === b.dataset.comp) || {}, now = c.booking || (/^https:\/\//.test(c.justgoUrl || '') ? 'reserved' : 'closed');
    const opt = (v, t, d) => `<label class="row" style="gap:10px;cursor:pointer"><input type="radio" name="bk" value="${v}" ${now === v ? 'checked' : ''} style="width:auto"><div class="grow"><b>${t}</b><small>${d}</small></div></label>`;
    const m = modal(`<h2>Booking: ${esc(c.name || '')}</h2><form>
      ${opt('closed', 'Not open yet', 'Clubs can reserve places for free. Nobody can buy yet.')}
      ${opt('reserved', 'Reserved clubs now, everyone 3 months before', 'Clubs with reserved places can buy now. From ' + date(c.date ? (d => (d.setMonth(d.getMonth() - 3), d.toISOString().slice(0, 10)))(new Date(c.date + 'T12:00')) : '') + ' it goes on general sale automatically.')}
      ${opt('open', 'Open to all clubs', 'Every club sees Open now and Buy now.')}
      <label class="field"><span>JustGo Events link</span><input id="url" type="url" value="${esc(c.justgoUrl || '')}" placeholder="https://…"></label>
      <div class="btn-row"><button class="btn">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault();
      const booking = m.querySelector('[name=bk]:checked').value, justgoUrl = m.querySelector('#url').value.trim();
      if (booking !== 'closed' && !/^https:\/\//.test(justgoUrl)) return toast('Add the JustGo Events link first (starting https://).', false);
      try { await adm.saveComp({id: c.id, booking, justgoUrl}); m.remove(); toast(booking === 'closed' ? 'Not open yet' : booking === 'reserved' ? 'Open now for clubs that reserved' : 'Open to all clubs'); rerender(); } catch (x) { fail(x); } });
  },

  async 'adm-import-cal'(){ try { await adm.importCalendar(); toast('Calendar saved to the database'); rerender(); } catch (x) { fail(x); } },

  async 'adm-comp'(b){
    const cal = await adm.calendar(), c = cal.find(x => x.id === b.dataset.comp) || {};
    const m = modal(`<h2>${c.id ? 'Edit' : 'Add a'} competition</h2><form>
      <label class="field"><span>Name</span><input id="name" required value="${esc(c.name || '')}" placeholder="General League · East Region"></label>
      <label class="field"><span>Pathway</span><select id="path">${PATHWAYS.map(p => `<option value="${p.k}" ${p.k === (c.path || 'general') ? 'selected' : ''}>${esc(p.n)}</option>`).join('')}</select></label>
      <label class="field"><span>Date</span><input id="date" type="date" required value="${esc(c.date || '')}"></label>
      <label class="field"><span>Venue</span><input id="where" required value="${esc(c.where || '')}" placeholder="Club name, town (or TBC)"></label>
      <label class="field"><span>Who it’s for</span><input id="who" required value="${esc(c.who || '')}" placeholder="Girls Levels 1–4"></label>
      <label class="field"><span>Maximum gymnast places (optional: clubs see places left and “Fully reserved”)</span><input id="maxPlaces" type="number" min="1" value="${c.maxPlaces == null ? '' : esc(c.maxPlaces)}"></label>
      <label class="field"><span>Floor music deadline (optional)</span><input id="musicBy" type="date" value="${esc(c.musicBy || '')}"></label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="hidden" ${c.status === 'hidden' ? 'checked' : ''} style="width:auto"> Hide from clubs</label>
      <div class="btn-row"><button class="btn">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const v = id => m.querySelector('#' + id).value.trim();
      const rec = {id: c.id || slug(v('date') + '-' + v('name')), name: v('name'), path: v('path'), date: v('date'), where: v('where'), who: v('who'),
        musicBy: v('musicBy'), maxPlaces: v('maxPlaces') ? Number(v('maxPlaces')) : null, status: m.querySelector('#hidden').checked ? 'hidden' : 'open'};
      try { await adm.saveComp(rec); m.remove(); toast('Competition saved'); rerender(); } catch (x) { fail(x); } });
  },

  async 'adm-entry'(b){
    const [cal, clubs] = await Promise.all([adm.calendar(), adm.clubs()]), comp = cal.find(x => x.id === b.dataset.comp);
    const existing = b.dataset.club ? (await adm.musicEntries(comp.id)).find(e => e.clubId === b.dataset.club) : null;
    const m = modal(`<h2>Gymnasts needing floor music</h2><p class="lead">${esc(comp.name)}</p><form>
      <label class="field"><span>Club</span><select id="club" required>${existing ? '' : '<option value="">Choose a club…</option>'}${clubs.map(x => `<option value="${esc(x.id)}" ${existing && existing.clubId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field"><span>One gymnast per line: name, level</span><textarea id="list" rows="8" required placeholder="Amelia R, 1&#10;Isla T, 1&#10;Grace W, 2">${existing ? (existing.gymnasts || []).map(g => esc(g.n) + ', ' + esc(g.level)).join('\n') : ''}</textarea></label>
      <p class="lead" style="font-size:13px">Paste straight from the JustGo start list. The club sees these names in Competitions → Floor music.</p>
      <p class="err" id="err"></p><div class="btn-row"><button class="btn">Save list</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault();
      const club = clubs.find(x => x.id === m.querySelector('#club').value), old = existing ? existing.gymnasts || [] : [];
      const gymnasts = m.querySelector('#list').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const [n, level] = l.split(/[,\t]/).map(x => (x || '').trim());
        const keep = old.find(g => g.n.toLowerCase() === n.toLowerCase());          // keep ids so existing uploads stay matched
        return {id: keep ? keep.id : 'g' + Math.random().toString(36).slice(2, 9), n, level: level || ''};
      });
      if (!club || !gymnasts.length) { m.querySelector('#err').textContent = 'Choose a club and add at least one gymnast.'; return; }
      try { await adm.saveMusicEntry(comp, club, gymnasts); m.remove(); toast(`${gymnasts.length} gymnasts saved for ${club.name}`); rerender(); } catch (x) { fail(x); } });
  }
};

// Club search box and competition picker on the admin screens
document.addEventListener('input', e => { const f = e.target.closest('[data-filter]'); if (!f) return; const q = f.value.toLowerCase();
  document.querySelectorAll(f.dataset.filter).forEach(r => { r.hidden = !!q && !r.dataset.text.includes(q); }); });
document.addEventListener('change', e => { const s = e.target.closest('select[data-go]'); if (s) location.hash = s.dataset.go + s.value; });

// Team access: each tick saves straight away; the invite form makes their login and emails a set-password link
document.addEventListener('change', async e => {
  const cb = e.target.closest && e.target.closest('input[data-team]'); if (!cb) return;
  const row = [...document.querySelectorAll(`input[data-team="${CSS.escape(cb.dataset.team)}"]`)];
  try { await adm.setAccess(cb.dataset.team, row.filter(x => x.checked).map(x => x.dataset.app)); toast('Access updated'); }
  catch (x) { cb.checked = !cb.checked; fail(x); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'teamAdd') return; e.preventDefault();
  const name = document.getElementById('tName').value.trim(), email = document.getElementById('tEmail').value.trim().toLowerCase();
  const picked = [...document.querySelectorAll('input[name=tApp]:checked')].map(x => x.value);
  if (!picked.length) return toast('Tick at least one app they can open.', false);
  const btn = e.target.querySelector('button'); btn.disabled = true;
  try { if ((await adm.team()).some(u => u.email === email)) { btn.disabled = false; return toast('They’re already on the team.', false); }
    await adm.invite(name, email, picked); toast(`Invite sent to ${name}`); rerender(); }
  catch (x) { btn.disabled = false; fail(x); }
});

// NGL Admin staff login (the "This is for NGL admin staff only" screen): each person uses their own NGL admin account
document.addEventListener('submit', async e => {
  if (!e.target || e.target.id !== 'admGate') return;
  e.preventDefault();
  const f = e.target, err = f.querySelector('#agErr'), btn = f.querySelector('.btn'), email = f.querySelector('#agEmail').value.trim(), pw = f.querySelector('#agPw').value;
  btn.disabled = true; err.textContent = '';
  try {
    const { default: api } = await import('./data.js'), { fb, authMessage } = await import('./firebase.js');
    if (api.mode === 'demo') { err.textContent = 'Sample data: no login needed.'; btn.disabled = false; return; }
    const { auth, A } = await fb();
    try { await api.signIn(email, pw); }
    catch (x) { err.textContent = authMessage(x); btn.disabled = false; return; }
    if (!(await api.adminMe())) { await auth.signOut(A); err.textContent = 'That login isn’t on the NGL admin team. Ask Dave to add you in NGL Admin › Team.'; btn.disabled = false; return; }
    location.hash = '#/admin'; location.reload();
  } catch (x) { console.error(x); err.textContent = 'Couldn’t log in. Please try again.'; btn.disabled = false; }
});
