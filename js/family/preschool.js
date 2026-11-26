// Pre-School family page: "Around the World with Somi & Flic". Ported word for word from the old family app
// (ngl-club-hub/preschool/index.html). The term plan comes from familyCodes/{CODE}.plan (same JSON as the old #p= link).
// Programme data (countries, themes, planner) and images come from the same live files the club side uses
// (js/pathways/preschool.js), so there is one source of truth until switch-over.
import { esc } from '../ui.js';
import { loadScript } from '../pathways/index.js';

if (!document.querySelector('link[data-fam-css=preschool]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/family-preschool.css'; l.dataset.famCss = 'preschool'; document.head.appendChild(l); }

const BASE = 'preschool/', IMG = BASE + 'img/';   // the app's own copy
const pad = n => String(n).padStart(2, '0');
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="currentColor"/></svg>';
const SEVEN = '<div class="seven" aria-hidden="true">' + ['#E84187', '#F8D438', '#E88230', '#0071B3', '#01AFB8', '#6AA525', '#90276A'].map(c => `<i style="background:${c}"></i>`).join('') + '</div>';
const SAMPLE = {club: 'Sample Club', startWeek: 1, seasonal: true, terms: [{name: 'Autumn Term', start: '2026-09-07', weeks: 14, half: 7}, {name: 'Spring Term', start: '2027-01-04', weeks: 12, half: 6}, {name: 'Summer Term', start: '2027-04-19', weeks: 13, half: 6}]};

let P = null;
// UI state: which plan is showing, the week on screen, the book
const S = {key: null, rows: [], idx: 0, brk: null, sample: false, wantSample: false};
let book = 1; try { book = +localStorage.getItem('ngl-ps-book') || 1; } catch (_) {}
const fmt = (s, o) => P.parse(s).toLocaleDateString('en-GB', Object.assign({timeZone: 'UTC'}, o || {day: 'numeric', month: 'short'}));

function planOf(ctx){
  let p = ctx.doc && ctx.doc.plan;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (_) { p = P.decode(p); } }
  if (p && typeof p === 'object') {
    // No Seasonal Pack on the licence: no seasonal weeks (as the club-side planner does)
    if (ctx.doc.packs && ctx.doc.packs.seasonal === false && p.seasonal) p = Object.assign({}, p, {seasonal: false});
    return {cfg: p, sample: false};
  }
  if (ctx.demo || S.wantSample) return {cfg: SAMPLE, sample: true};
  return null;
}

function setup(cfg, key, sample){
  if (S.key === key) return;
  S.key = key; S.sample = sample; S.rows = P.plan(cfg);
  // current week: the last week that has started (or the first upcoming one)
  const today = P.iso(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())));
  S.idx = 0; S.rows.forEach((r, i) => { if (r.date <= today) S.idx = i; });
  // During half term or the holidays, show the week classes restart, with a clear notice
  S.brk = P.breakNow(S.rows, today); if (S.brk) S.idx = S.brk.next;
}

const hero = club => `${SEVEN}<header class="psf-hero"><img src="${IMG}logo.png" alt="NGL Pre-School"><p>Around the World with Somi &amp; Flic</p><h1>${esc(club || 'Families')}</h1></header>`;
const foot = `<footer class="psf-foot">NGL Pre-School · <a href="https://www.nationalgymnasticsleague.co.uk" target="_blank" rel="noopener">nationalgymnasticsleague.co.uk</a><br>No child details are stored in this app.</footer>`;

function empty(club){
  return `<div id="psFam">${hero(club)}<div class="psf-main"><div class="card empty"><img src="${IMG}post_01_Alphabet.jpg" alt="" style="width:100%;border-radius:14px">
    <h2>Welcome to Around the World</h2>
    <p>Your club shares a family link that shows your child's theme of the week, the passport skills they're working on and how far round the world they've travelled.</p>
    <p class="note">Ask your club for their NGL Pre-School family link, or have a look at a sample class.</p>
    <p style="margin-top:16px"><button class="btn" data-ps="sample">See a sample</button></p></div></div>${foot}</div>`;
}

function page(cfg){
  const rows = S.rows, idx = S.idx, BRK = S.brk, demo = S.sample;
  const r = rows[idx], t = r.theme;
  const end = P.iso(new Date(P.parse(r.date).getTime() + 6 * 864e5));
  const termRows = rows.filter(x => x.termIndex === r.termIndex);
  const bk = r.seasonal ? null : (book === 2 ? r.b2 : r.b1), c = bk && bk.country;
  // last non-seasonal week at or before this one, for the journey
  let ref = r; for (let i = idx; i >= 0 && ref.seasonal; i--) ref = rows[i];
  const rc = ref.seasonal ? null : (book === 2 ? ref.b2 : ref.b1).country;
  const levelsDone = rc ? ((rc.n - 1) % 10) + (ref.seasonal ? 0 : (ref.levelWeek - 1) / 4) : 0;
  const range = book === 2 ? P.COUNTRIES.slice(10) : P.COUNTRIES.slice(0, 10);
  const skillsCard = r.seasonal ? `<div class="card psf-seas"><div class="country"><img src="${IMG}post_${t.file}.jpg" alt="" style="border-radius:12px;width:92px;height:auto">
      <div><div class="lv">Seasonal week</div><div class="nm">${esc(t.name)} week!</div><div class="sub">No new passport skills this week – just lots of ${esc(t.name.toLowerCase())} fun. The journey carries on next week.</div></div></div></div>`
    : `<div class="card psf-skills">
      <div class="bk"><button class="${book === 1 ? 'on' : ''}" data-ps="book" data-b="1">Book 1</button><button class="${book === 2 ? 'on' : ''}" data-ps="book" data-b="2">Book 2</button></div>
      <div class="country"><img src="${IMG}medal${pad(c.n)}.png" alt="${esc(c.name)} medal">
        <div><div class="lv">Book ${book} · Country ${((c.n - 1) % 10) + 1} of 10 · Week ${r.levelWeek} of 4</div><div class="nm">Welcome to ${esc(c.name)}!</div>
        <div class="sub">${r.levelWeek === 4 ? `Last week in ${esc(c.name)}: the ${esc(c.name)} medal is next!` : `While we’re in ${esc(c.city)}, let’s learn some new skills.`}</div></div></div>
      <p class="note" style="margin:12px 0 0;font-weight:700;color:var(--pink-d)">Today’s sticker skills</p>
      <ul class="skills">${bk.skills.map((s, i) => `<li><span class="star">${STAR}${bk.nos[i]}</span>${esc(s)}</li>`).join('')}</ul>
      <p class="note">Two passport stickers to earn this week. Choose the book your child has: Book 1 (countries 1–10) or Book 2 (countries 11–20).</p>
    </div>`;
  return `<div id="psFam">${hero(cfg.club)}<div class="psf-main">
    ${demo ? '<div class="demo">Sample class: your club’s link will show your child’s own class.</div>' : ''}
    ${BRK && idx === BRK.next ? `<div class="halfterm"><b>${BRK.half ? 'Half term' : 'Holidays'}</b><span>No classes this week. Classes restart ${fmt(BRK.back, {weekday: 'long', day: 'numeric', month: 'long'})}.</span></div>` : ''}
    <div class="card psf-week">
      <div class="nav"><button data-ps="prev" aria-label="Previous week" ${idx ? '' : 'disabled'}>‹</button>
        <div class="when"><b>${esc(r.term)} · Week ${r.week}</b><span>${fmt(r.date)} – ${fmt(end, {day: 'numeric', month: 'short', year: 'numeric'})}</span></div>
        <button data-ps="next" aria-label="Next week" ${idx < rows.length - 1 ? '' : 'disabled'}>›</button></div>
      <div class="tt"><span class="chip">${BRK && idx === BRK.next ? 'Next week’s theme' : 'This week’s theme'}</span><h2>${esc(t.name)}</h2></div><div class="theme" role="img" aria-label="${esc(t.name)}" style="background-image:url(${IMG}post_${t.file}.jpg)"></div>
    </div>
    ${skillsCard}
    <div class="card psf-home"><h3>Try at home</h3><ul class="home">${t.home.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
      <p class="note">Ask them to show you their favourite ${esc(t.name.toLowerCase())} move from class!</p></div>
    <div class="card psf-journey"><h3>The journey so far · Book ${book}</h3>
      <div class="bar"><i style="width:${Math.round(levelsDone / 10 * 100)}%"></i></div>
      <div class="journey">${range.map(x => `<div class="${rc && x.n < rc.n ? 'done' : rc && x.n === rc.n ? 'now' : 'todo'}"><img src="${IMG}medal${pad(x.n)}.png" alt="">${esc(x.name)}</div>`).join('')}</div>
      <p class="note">Shows where the class is if your child comes every week.</p></div>
    <div class="card psf-term"><h3>${esc(r.term)}</h3><ul class="term">${termRows.map(x => { const i = rows.indexOf(x); const xb = x.seasonal ? null : (book === 2 ? x.b2 : x.b1); return `<li data-ps="week" data-i="${i}" class="${i === idx ? 'cur' : ''}" tabindex="0" role="button">
        <span class="d">${fmt(x.date, {day: 'numeric'})}<small>${fmt(x.date, {month: 'short'})}</small></span>
        <span class="t"><b>${esc(x.theme.name)}</b><span>${xb ? `${esc(xb.country.name)} · skills ${xb.nos.join(' & ')}` : 'Seasonal week'}</span></span>
        ${xb ? `<img src="${IMG}medal${pad(xb.country.n)}.png" alt="">` : '<span></span>'}</li>`; }).join('')}</ul></div>
  </div>${foot}</div>`;
}

export default async function render(ctx){
  try { if (!P) { await loadScript(BASE + 'data.js'); P = window.NGLPS; } }
  catch (e) { return `<div class="card empty">The Pre-School app couldn’t load. Check your internet connection and try again.</div>`; }
  const pl = planOf(ctx);
  if (!pl) return empty(ctx.clubName);
  setup(pl.cfg, (ctx.code || '') + '|' + JSON.stringify(pl.cfg), pl.sample);
  if (!S.rows.length) return empty(pl.cfg.club || ctx.clubName);
  return page(pl.cfg);
}

export function after(){
  const cfgClub = document.querySelector('#psFam .psf-hero h1');
  if (cfgClub) document.title = (cfgClub.textContent !== 'Families' ? cfgClub.textContent + ' · ' : '') + 'NGL Pre-School Families';
}

// Events: one set of document listeners, only acting inside the Pre-School family page
function act(el){
  const a = el.dataset.ps;
  if (a === 'book') { book = +el.dataset.b; try { localStorage.setItem('ngl-ps-book', book); } catch (_) {} }
  else if (a === 'prev') { if (S.idx > 0) S.idx--; }
  else if (a === 'next') { if (S.idx < S.rows.length - 1) S.idx++; }
  else if (a === 'week') S.idx = +el.dataset.i;
  else if (a === 'sample') S.wantSample = true;
  else return;
  window.NGL_FAMILY_RENDER();
  if (a !== 'book') scrollTo(0, 0);
}
if (!window.__nglPsFam) {
  window.__nglPsFam = true;
  document.addEventListener('click', e => {
    if (!document.querySelector('.fam')) return;
    const el = e.target.closest('#famPage #psFam [data-ps]'); if (!el || el.disabled) return;
    e.preventDefault(); act(el);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!document.querySelector('.fam')) return;
    const el = e.target.closest && e.target.closest('#famPage #psFam li[data-ps=week]'); if (!el) return;
    e.preventDefault(); act(el);
  });
}
