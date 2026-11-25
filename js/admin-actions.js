// NGL Admin buttons (data-act="adm-…"). Every write goes through admin-data.js; the database rules check it's an admin.
import adm from './admin-data.js';
import { PATHWAYS } from './config.js';
import { modal, toast, esc } from './ui.js';

const rerender = () => window.NGL_RENDER && window.NGL_RENDER();
const fail = x => { console.error(x); toast(String(x.message || '').startsWith('Sample') ? x.message : 'Couldn’t save. Please try again.', false); };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const yearOn = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };

export const ADM = {
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

  async 'adm-attach'(b){
    const sel = document.getElementById('att-' + b.dataset.key), id = sel && sel.value; if (!id) return toast('Choose the club first.', false);
    try { const club = (await adm.clubs()).find(c => c.id === id); const n = await adm.attachPending(b.dataset.ids.split(','), club);
      toast(`${n} booking${n === 1 ? '' : 's'} attached to ${club.name}`); rerender(); } catch (x) { fail(x); }
  },

  async 'adm-res'(b){
    const lbl = {bought: 'marked bought on JustGo', waiting: 'moved to the waiting list', reserved: 'given places'};
    try { await adm.setReservation(b.dataset.ref, b.dataset.to); toast(b.dataset.ref + ' ' + lbl[b.dataset.to]); rerender(); } catch (x) { fail(x); }
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
      <label class="field"><span>Floor music deadline (optional)</span><input id="musicBy" type="date" value="${esc(c.musicBy || '')}"></label>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="hidden" ${c.status === 'hidden' ? 'checked' : ''} style="width:auto"> Hide from clubs</label>
      <div class="btn-row"><button class="btn">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>`);
    m.querySelector('form').addEventListener('submit', async e => { e.preventDefault(); const v = id => m.querySelector('#' + id).value.trim();
      const rec = {id: c.id || slug(v('date') + '-' + v('name')), name: v('name'), path: v('path'), date: v('date'), where: v('where'), who: v('who'),
        musicBy: v('musicBy'), status: m.querySelector('#hidden').checked ? 'hidden' : 'open'};
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
