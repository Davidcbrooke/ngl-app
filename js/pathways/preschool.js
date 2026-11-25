// Pre-School: "Around the World with Somi & Flic". Built on the standard pathway model (DESIGN.md 6a).
// Programme data (countries, themes, skills, the planner) comes from the same data.js as today's Pre-School hub,
// and plans, posts and images are served from there too, so there is one source of truth until switch-over.
import api from '../data.js';
import { esc, gbp, date, pill, ic } from '../ui.js';
import { coming, loadScript, printHTML } from './index.js';

const BASE = 'https://club.nationalgymnasticsleague.co.uk/preschool/';
const IMG = BASE + 'img/', PLANS = BASE + 'plans/1Qes3TzvJrYQ/', SAMPLE = BASE + 'plans/sample/', FAMILY = BASE;
export const BANDS = [{k: 'xs', label: '1–24 Pre-School gymnasts', price: 150}, {k: 'sm', label: '25–49 Pre-School gymnasts', price: 250},
  {k: 's', label: '50–99 Pre-School gymnasts', price: 400}, {k: 'm', label: '100 or more Pre-School gymnasts', price: 750}];
export const PACKS = {pack2: ['Lesson Plan Pack 11–20', 'Weeks 11–20: Egypt to Brazil in Book 1, the Bahamas to Italy in Book 2.', 100],
  pack3: ['Lesson Plan Pack 21–30', 'Weeks 21–30: Australia to Japan in Book 1, India to Ireland in Book 2.', 100],
  pack4: ['Lesson Plan Pack 31–40', 'Weeks 31–40: Japan to Iceland in Book 1, Ireland to Spain in Book 2.', 100],
  seasonal: ['Seasonal Pack', 'Christmas, Easter, Summer, Halloween, Bonfire Night and Harvest, dropped into the right weeks by the planner.', 50]};
const P2 = n => String(n).padStart(2, '0');
const packOf = n => n <= 10 ? 1 : n <= 20 ? 2 : n <= 30 ? 3 : 4;
const PACKNAME = ['', 'Included with the licence', 'Lesson Plan Pack 11–20', 'Lesson Plan Pack 21–30', 'Lesson Plan Pack 31–40'];

let P = null, S = {cfg: null, lic: null, club: null};
async function ready(){
  if (!P) { await loadScript(BASE + 'data.js'); P = window.NGLPS; }
  const [lic, club] = await Promise.all([api.licences(), api.club()]);
  S.club = club; const L = lic.preschool || {}; const pk = L.packs || {};
  S.lic = {active: L.status === 'live', pack2: !!pk.pack2, pack3: !!pk.pack3, pack4: !!pk.pack4, seasonal: !!pk.seasonal, raw: L};
  return S;
}
const unlocked = t => t.seasonal ? (S.lic.active && S.lic.seasonal) : (t.n === 1 || (S.lic.active && (t.n <= 10 || S.lic['pack' + packOf(t.n)])));
const sample = t => t.n === 1 && !t.seasonal && !S.lic.active;
const planHref = t => (sample(t) ? SAMPLE : PLANS) + (t.seasonal ? 'NGL_PreSchool_' : 'NGL_PreSchool_Week_') + t.file + '.pdf';
const postHref = t => (sample(t) ? SAMPLE : PLANS) + 'NGL_PreSchool_Post_' + t.file + '.jpg';
const lockText = t => t.seasonal ? 'In the Seasonal Pack' : packOf(t.n) === 1 ? 'Unlocks with the licence' : 'In ' + PACKNAME[packOf(t.n)];

// ---------- the club's term plan ----------
function defaultCfg(){ const y = new Date().getFullYear(), sy = new Date().getMonth() >= 7 ? y : y - 1;
  return {club: S.club.name || '', startWeek: 1, seasonal: false, terms: [{name: `Autumn ${sy}`, start: `${sy}-09-07`, weeks: 14, half: 7},
    {name: `Spring ${sy + 1}`, start: `${sy + 1}-01-04`, weeks: 12, half: 6}, {name: `Summer ${sy + 1}`, start: `${sy + 1}-04-19`, weeks: 13, half: 6}]}; }
function cfg(){
  if (!S.cfg) { let c = S.club.plans && S.club.plans.preschool; if (!c) { try { c = JSON.parse(localStorage.ngl_ps_plan || 'null'); } catch (_) {} } S.cfg = c || defaultCfg(); }
  if (!S.lic.seasonal && api.mode !== 'demo') S.cfg.seasonal = false;
  return S.cfg;
}
const familyLink = () => FAMILY + '#p=' + P.encode(cfg());
function thisWeek(){ const rows = P.plan(cfg()), today = P.iso(new Date()); let i = -1; rows.forEach((r, k) => { if (r.date <= today) i = k; });
  const brk = P.breakNow(rows, today); return {rows, i: brk ? brk.next : (i < 0 ? 0 : i), started: i >= 0, brk}; }
const dd = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'});

function captionFor(t){
  const club = (cfg().club || S.club.name || '').trim(), tag = '#NGLPreSchool #AroundTheWorldWithSomiAndFlic #PreSchoolGymnastics #ItsAllConnected #EverySportStartsHere';
  if (t.seasonal) return `${t.name} week in Pre-School${club ? ' at ' + club : ''}! 🎉\n\nA special themed class this week with Somi and Flic. The passport journey carries on next week.\n\n${tag}`;
  const w = P.weekInfo(t.n), home = (t.home || []).slice(0, 3);
  return `This week in Pre-School${club ? ' at ' + club : ''}: ${t.name}! 🌍\n\nSomi and Flic are travelling to ${w.b1.country.name} (Book 1) and ${w.b2.country.name} (Book 2). This week’s sticker skills:\n${[...w.b1.skills, ...w.b2.skills].map(x => '⭐ ' + x).join('\n')}${home.length ? `\n\nTry at home:\n${home.map(x => '• ' + x).join('\n')}` : ''}\n\n${tag}`;
}
const planBtns = (t, wk) => unlocked(t)
  ? `<a class="btn sm" href="${planHref(t)}" target="_blank" rel="noopener">Lesson plan</a> <a class="btn sm ghost" href="${postHref(t)}" download="NGL_PreSchool_${wk ? 'Week_' + wk + '_' : ''}${t.file}_post.jpg">Instagram post</a> <button class="btn sm ghost" data-act="ps-caption" data-n="${t.seasonal ? 's' + t.file : t.n}">Copy caption</button>`
  : `<span class="pill">🔒 ${esc(lockText(t))}</span>`;

function weekCard(r){
  if (!r) return '';
  const t = r.theme, img = `<img class="ps-img" src="${IMG}post_${t.file}.jpg" alt="">`;
  if (r.seasonal) return `<div class="card ps-week">${img}<div><p class="kick">${esc(r.term)} · week ${r.week}</p><h2>${esc(t.name)} (Seasonal)</h2><p class="lead">No new passport skills this week. The journey carries on next week.</p>${planBtns(t, r.week)}</div></div>`;
  const book = (b, n) => `<h3 class="ps-bk">Book ${n} · ${esc(b.country.name)} <small>skills ${b.nos.join(' & ')}</small></h3><ul class="ps-sk">${b.skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`;
  return `<div class="card ps-week">${img}<div><p class="kick">${esc(r.term)} · week ${r.week} · programme week ${r.w} of 40</p><h2>${esc(t.name)}</h2>${book(r.b1, 1)}${book(r.b2, 2)}<div class="btn-row">${planBtns(t, r.week)}</div></div></div>`;
}

// ---------- the six tabs ----------
const tabs = {
  async overview(p){
    const {rows, i, started, brk} = thisWeek();
    return `${brk ? `<div class="card attn" style="margin-bottom:16px"><b>${brk.half ? 'Half term' : 'Holidays'}</b>: no classes this week. Classes restart ${P.parse(brk.back).toLocaleDateString('en-GB', {timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long'})}.</div>` : ''}
    <h2>${brk ? 'Next week' : started ? 'This week' : 'Your first week'}</h2>${weekCard(rows[i])}
    <div class="grid g3" style="margin-top:16px">
      <a class="card tile" href="#/programmes/preschool/teach">${ic('plan', p.c)}<div><b>Term planner</b><br><small style="color:var(--muted)">Your terms week by week, with both books’ skills</small></div></a>
      <a class="card tile" href="#/programmes/preschool/teach/plans">${ic('book', p.c)}<div><b>Lesson plans</b><br><small style="color:var(--muted)">40 weekly plans, the Seasonal Pack and a post for each</small></div></a>
      <a class="card tile" href="#/programmes/preschool/families">${ic('fam', p.c)}<div><b>Family app</b><br><small style="color:var(--muted)">One link so parents follow the theme and skills</small></div></a></div>`;
  },

  async teach(p, sub){
    const pills = `<div class="paths" style="margin-bottom:14px">${[['', 'Term planner'], ['plans', 'Lesson plans']].map(([k, l]) => `<a class="${(sub || '') === k ? 'on' : ''}" style="--c:${p.c}" href="#/programmes/preschool/teach${k ? '/' + k : ''}">${l}</a>`).join('')}</div>`;
    if (sub === 'plans') {
      const card = t => { const open = unlocked(t), w = t.seasonal ? null : P.weekInfo(t.n);
        return `<div class="card ps-plan ${open ? '' : 'lock'}"><div class="ps-th" style="background-image:url(${IMG}plan_${t.file}-thumb.jpg)"></div>
          <b>${t.seasonal ? '' : 'Week ' + t.n + ': '}${esc(t.name)}</b><small>${t.seasonal ? 'Seasonal Pack' : `${esc(w.b1.country.name)} ${w.b1.nos.join('&')} · ${esc(w.b2.country.name)} ${w.b2.nos.join('&')}`}</small>
          <div class="btn-row" style="margin-top:8px">${planBtns(t)}</div></div>`; };
      return pills + `<p class="lead">One plan for every week of the passport. Each teaches that week’s two Book 1 and two Book 2 sticker skills inside its theme.</p>
        <div class="ps-plans">${P.THEMES.map(card).join('')}</div><h2 style="margin-top:22px">Seasonal Pack</h2><div class="ps-plans">${P.SEASONAL.map(card).join('')}</div>`;
    }
    const c = cfg(), rows = P.plan(c), today = P.iso(new Date()); let cur = 0; rows.forEach((r, i) => { if (r.date <= today) cur = i; });
    const cc = b => `<img class="ps-medal" src="${IMG}medal${P2(b.country.n)}.png" alt=""> <b>${esc(b.country.name)}</b><br>${b.skills.map((s, k) => `<span class="ps-n">${b.nos[k]}</span>${esc(s)}`).join('<br>')}`;
    const tables = c.terms.map((t, ti) => { const tr = rows.filter(r => r.termIndex === ti); if (!tr.length) return '';
      const f = tr.find(r => !r.seasonal), l = [...tr].reverse().find(r => !r.seasonal);
      const open = tr.some(r => rows.indexOf(r) === cur) || (ti === 0 && !rows.some(r => r.date <= today));
      return `<details class="ps-det" ${open ? 'open' : ''}><summary><b>${esc(t.name || 'Term ' + (ti + 1))}</b> <small>· ${tr.length} weeks${f ? ` · programme weeks ${f.w}–${l.w}` : ''}</small></summary>
        <div class="btn-row" style="margin:6px 0 10px"><button class="btn sm" data-act="ps-cal" data-ti="${ti}">Print term calendar</button></div>
        <div class="ps-tbl"><table><tr><th>Wk</th><th>Week of</th><th>Lesson plan</th><th>Book 1</th><th>Book 2</th></tr>
        ${tr.map(r => `<tr class="${rows.indexOf(r) === cur ? 'now' : ''}"><td>${r.week}</td><td>${dd(r.date)}</td><td><b>${esc(r.theme.name)}</b>${r.seasonal ? ' <small>Seasonal</small>' : `<br><small>Week ${r.w}</small>`}</td>
          ${r.seasonal ? '<td colspan="2"><small>Seasonal week: no new passport skills.</small></td>' : `<td>${cc(r.b1)}</td><td>${cc(r.b2)}</td>`}</tr>`).join('')}</table></div></details>`; }).join('');
    return pills + `<p class="lead">Enter your term dates. The planner follows the 40 weeks of the passport and sets out the lesson plan and the Book 1 and Book 2 sticker skills for every week. Each term carries on from the last.</p>
    <div class="card"><div class="grid g3">
      <label class="field" style="margin:0"><span>Name parents will see</span><input id="psClub" value="${esc(c.club || '')}" placeholder="${esc(S.club.name || '')}"></label>
      <label class="field" style="margin:0"><span>Class starts at</span><select id="psStart">${P.THEMES.map(t => { const w = P.weekInfo(t.n); return `<option value="${t.n}" ${t.n === (c.startWeek || 1) ? 'selected' : ''}>Week ${t.n}: ${esc(t.name)} (${esc(w.b1.country.name)} / ${esc(w.b2.country.name)})</option>`; }).join('')}</select></label>
      <label class="field" style="margin:0"><span>Seasonal weeks</span><label style="display:flex;gap:8px;align-items:center;padding:10px 0"><input type="checkbox" id="psSeas" style="width:auto" ${c.seasonal ? 'checked' : ''} ${S.lic.seasonal || api.mode === 'demo' ? '' : 'disabled'}> Use the Seasonal Pack${S.lic.seasonal || api.mode === 'demo' ? '' : ' (add it first)'}</label></label></div>
      ${c.terms.map((t, i) => `<div class="ps-term" data-ti="${i}">
        <label class="field"><span>Term name</span><input data-f="name" value="${esc(t.name || '')}"></label>
        <label class="field"><span>First week</span><input type="date" data-f="start" value="${esc(t.start || '')}"></label>
        <label class="field"><span>Teaching weeks</span><input type="number" min="1" max="20" data-f="weeks" value="${t.weeks || ''}"></label>
        <label class="field"><span>Half term after week</span><input type="number" min="0" max="19" data-f="half" value="${t.half || 0}"></label>
        <button class="btn sm ghost" data-act="ps-term-del" data-ti="${i}" aria-label="Remove ${esc(t.name || 'term')}">Remove</button></div>`).join('')}
      <div class="btn-row"><button class="btn ghost" data-act="ps-term-add">Add a term</button><button class="btn" data-act="ps-save">Save plan</button>${tables ? '<button class="btn ghost" data-act="ps-cal" data-ti="all">Print the whole year</button>' : ''}</div></div>
    <div style="margin-top:16px">${tables || '<div class="card empty">Add a term to see the weekly plan.</div>'}</div>`;
  },

  async awards(p){
    const medals = P.COUNTRIES.map(c => `<div class="ps-m"><img src="${IMG}medal${P2(c.n)}.png" alt="" loading="lazy"><b>${c.n}. ${esc(c.name)}</b></div>`).join('');
    return `<div class="grid g2"><div class="card"><h2>The passport</h2><p class="lead">Book 1 (countries 1–10) and Book 2 (11–20), with a stamp page and eight skills for every country. Two stickers a week; a new country every four weeks; no assessment week.</p>
      <div class="ps-books">${['book-cover', 'book-france', 'book-england', 'book-china', 'book-back'].map(b => `<img src="${IMG}${b}.jpg" alt="" loading="lazy">`).join('')}</div></div>
      <div class="card"><h2>Order passports and medals</h2><p class="lead">Passports £5 each (RRP £10) · country medals £2 each (RRP £4). The A1 Around the World poster comes free with the licence.</p>
      ${S.lic.active ? `<a class="btn" href="#/shop">Order in the shop</a>` : `<p><span class="pill">Ordering opens once your Pre-School licence is live</span></p><a class="btn ghost" href="#/programmes/preschool/licence">See the licence</a>`}</div></div>
    <h2 style="margin-top:22px">20 country medals</h2><div class="ps-medals">${medals}</div>`;
  },

  async compete(p){
    return `<div class="card">${ic('comp', p.c)}<h2 style="margin-top:12px">Graduation</h2><p class="lead">Pre-School is an awards programme, not a competition. Every child who completes the passport graduates: a celebration at your club with medals, the A1 journey poster and families watching.</p>
      <p class="lead">Graduation dates and guides are added here as the 2027 programme launches.</p><a class="btn ghost" href="#/rules">Rules & resources</a></div>`;
  },

  async families(p){
    const link = familyLink();
    return `<div class="card"><h2>Family app</h2><p class="lead">Share one link with your Pre-School parents: by email, on your website or as a QR code by the poster. Parents choose Book 1 or Book 2 and see this week’s theme, their child’s two sticker skills, ideas to try at home and the journey so far. <b>No child details are stored.</b></p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><input id="psLink" readonly value="${esc(link)}" style="flex:1;min-width:240px;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit"><button class="btn" data-act="ps-copy">Copy link</button><a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Open ↗</a></div>
      <div class="btn-row"><button class="btn ghost" data-act="ps-qr" data-kind="poster">Print QR poster (A4)</button><button class="btn ghost" data-act="ps-qr" data-kind="flyer">Print flyers (2 per page)</button></div>
      <p class="lead" style="font-size:13px;margin:12px 0 0">The link holds your term plan. If you change your term dates in Teach, share the new link and print a new poster.</p></div>`;
  },

  async licence(p){
    const L = S.lic;
    const status = L.active ? `<div class="card" style="border-left:4px solid ${p.c};margin-bottom:16px"><h2>Licence live ${pill('Live', 'ok')}</h2><p class="lead" style="margin:0">${esc(L.raw.band || '')}${L.raw.renews ? ' · renews ' + date(L.raw.renews) : ''}. Lesson plans 1–10${L.pack2 ? ', 11–20' : ''}${L.pack3 ? ', 21–30' : ''}${L.pack4 ? ', 31–40' : ''}${L.seasonal ? ' and the Seasonal Pack' : ''} unlocked.</p></div>`
      : `<div class="card" style="margin-bottom:16px"><h2>Start your Pre-School licence</h2><p class="lead">The licence includes a free A1 Around the World poster, Lesson Plans 1–10, the term planner and the family app. An NGL Recreational or Schools licence doesn’t include Pre-School.</p>
        <table><tr><th>Pre-School gymnasts</th><th>A year (+ VAT)</th><th></th></tr>${BANDS.map(b => `<tr><td>${esc(b.label)}</td><td><b>${gbp(b.price)}</b></td><td style="text-align:right"><button class="btn sm" data-act="ps-buy" data-band="${b.k}">Choose</button></td></tr>`).join('')}</table>
        <p class="lead" style="font-size:13px;margin:10px 0 0">Prices exclude VAT (20%). Runs for 12 months. 5% off if it isn’t your club’s most expensive NGL licence.</p></div>`;
    const pack = k => { const [n, d, price] = PACKS[k];
      return `<div class="card"><h2>${esc(n)}</h2><p class="lead">${esc(d)}</p><p style="font:900 26px var(--cond);color:var(--navy);margin:0 0 8px">${gbp(price)} <small style="font:400 13px var(--body);color:var(--muted)">+ VAT</small></p>
        ${L[k] ? pill('Added', 'ok') : L.active ? `<button class="btn sm" data-act="ps-pack" data-pack="${k}">Add the pack</button>` : '<span class="pill">Available once your licence is live</span>'}</div>`; };
    return status + `<div class="grid g2">${Object.keys(PACKS).map(pack).join('')}</div>`;
  }
};

export default {
  async render(p, tab, sub){ await ready(); return (tabs[tab] || tabs.overview)(p, sub); },
  helpers: () => ({P, S, cfg, captionFor, familyLink, IMG, BANDS, PACKS, defaultCfg})
};
