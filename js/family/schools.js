// NGL Schools family app, inside the one NGL app. Copied WORD FOR WORD from nglschools/index.html (the parent screens):
// Home, Routines, Level N (Floor / Bench / Vault), Graduation, and the footer with the club code.
// Code entry and the install card now live in the app shell (js/views/family.js, js/views/welcome.js).
// The routines, skills and videos come from js/pathways/schools-data.js (the same data the club side uses).
// Graduations: parents read the PUBLIC collection familyEvents where clubId == the code's clubId
//   familyEvents/{id} = {clubId, programme:'schools', title, schoolName, date:'YYYY-MM-DD', time:'HH:MM', venue, bookingUrl, notes?}
// Hash: #/family/schools, #/family/schools/routines, #/family/schools/level/3/floor, #/family/schools/graduation
import { esc } from '../ui.js';
import * as D from '../pathways/schools-data.js';

const BASE = '#/family/schools';
const IMG = 'img/family/schools/';
const medal = l => `${IMG}medal-level-${l}.jpg`;
const APPARATUS = [
  {id:'floor', name:'Floor'},
  {id:'bench', name:'Bench'},
  {id:'vault', name:'Vault'}
];
const JOURNEY = [['Pre-School', '#E84187'], ['Schools', '#F8D438'], ['Recreational', '#E88230'], ['General', '#0071B3'], ['Performance', '#01AFB8'], ['University', '#6AA525'], ['Masters', '#90276A']];

function css(){
  if (document.querySelector('link[data-fam-css="schools"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/family-schools.css'; l.dataset.famCss = 'schools';
  document.head.appendChild(l);
}

const chevron = '<svg class="fs-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
const ICO = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  routines: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
  grad: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>'
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;

function videoHTML(id, label){
  return `<div class="fs-video" data-yt="${esc(id)}" role="button" tabindex="0" aria-label="Play ${esc(label)} video">
    <img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
    <div class="fs-play"><span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg></span></div>
  </div>`;
}
const skillsHTML = list => '<ol class="fs-skills">' + list.map(s => `<li>${esc(s)}</li>`).join('') + '</ol>';

// The old app's bottom bar (Home / Routines / Graduation), now a bar at the top of the Schools page
function navHTML(active){
  return `<nav class="fs-nav" aria-label="Schools">${[['home', 'Home', BASE], ['routines', 'Routines', BASE + '/routines'], ['graduation', 'Graduation', BASE + '/graduation']]
    .map(([k, n, h]) => `<a href="${h}" class="${k === active ? 'on' : ''}">${icon(k === 'graduation' ? 'grad' : k)}${n}</a>`).join('')}</nav>`;
}

function levelGridHTML(){
  let h = '<div class="fs-level-grid">';
  for (let l = 1; l <= 6; l++){
    h += `<div class="fs-level-card" data-go="${BASE}/level/${l}/floor" role="button" tabindex="0">
      <img src="${medal(l)}" alt="">
      <span class="fs-lname">Level ${l}</span>
      <span class="fs-lmeta">Floor · Bench · Vault</span>
    </div>`;
  }
  return h + '</div>';
}

function footHTML(ctx){
  const season = ctx.doc && ctx.doc.season;
  return `<div class="fs-foot">Club code ${esc(ctx.code || '')}${season ? ' · ' + esc(season) : ''}<br>
    <button type="button" data-fs="signout">Use a different code</button></div>`;
}

function screenHome(ctx){
  return `${navHTML('home')}
    <div class="fs-welcome">
      <img class="fs-logo" src="${IMG}ngl-schools-logo.png" alt="NGL Schools">
      <p class="fs-eyebrow">Welcome to NGL Schools</p>
      <div class="fs-club-name">${esc(ctx.clubName || (ctx.doc && ctx.doc.clubName) || 'Your club')}</div>
      <div class="fs-club">Learn the routines, practise at home, and see what’s coming up.</div>
      <div class="fs-journey" aria-label="NGL pathways">
        ${JOURNEY.map(([n, c]) => `<span class="fs-jstep${n === 'Schools' ? ' on' : ''}" style="--jc:${c}">${n}</span>`).join('')}
      </div>
    </div>

    <div class="fs-section-title"><h2>Learn the routines</h2><span class="fs-muted" style="font-size:13px">Levels 1–6</span></div>
    ${levelGridHTML()}

    <div class="fs-section-title"><h2>Celebrate</h2></div>
    <div class="fs-card fs-link-card" data-go="${BASE}/graduation" role="button" tabindex="0">
      <div class="fs-ico">${icon('grad')}</div>
      <div class="fs-txt"><h3>NGL Graduation</h3><p>Bronze, Silver, Gold, then perform for your family</p></div>
      ${chevron}
    </div>
    <div class="fs-card fs-link-card" style="cursor:default">
      <div class="fs-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 20V10M12 20V4M18 20v-7"/></svg></div>
      <div class="fs-txt"><h3>Core Skills &amp; Strength</h3><p>Master classes and conditioning videos</p></div>
      <span class="fs-coming">Soon</span>
    </div>
    ${footHTML(ctx)}`;
}

function screenRoutines(ctx){
  return `${navHTML('routines')}
    <p class="fs-eyebrow">Learn the routines</p>
    <h1 class="fs-h1">Pick your level</h1>
    <p class="fs-muted">Each level has a Floor, Bench and Vault routine, just like in your Awards Book.</p>
    <div style="height:8px"></div>
    ${levelGridHTML()}
    ${footHTML(ctx)}`;
}

function screenLevel(ctx, level, app){
  const i = level - 1;
  let body = '';
  if (app === 'floor'){
    body = `<div class="fs-card">${videoHTML(D.SCH_LEVEL_VIDEOS.floor[i], 'Floor')}<h3>Floor routine</h3><p class="fs-muted" style="font-size:14px">Skills in routine order</p>${skillsHTML(D.SCH_FLOOR_SKILLS[i])}</div>`;
  } else if (app === 'bench'){
    body = `<div class="fs-card">${videoHTML(D.SCH_LEVEL_VIDEOS.bench[i], 'Bench')}<h3>Bench routine</h3><p class="fs-muted" style="font-size:14px">Skills in routine order. Also works on a low beam.</p>${skillsHTML(D.SCH_BENCH_SKILLS[i])}</div>`;
  } else {
    body = `
      <div class="fs-card fs-vault-part">${videoHTML(D.SCH_LEVEL_VIDEOS.block[i], 'Block routine')}<h3>Block routine</h3><p>${esc(D.SCH_BLOCK_CAPTIONS[i])}</p></div>
      <div class="fs-card fs-vault-part">${videoHTML(D.SCH_LEVEL_VIDEOS.spring[i], 'Block and springboard')}<h3>Block &amp; springboard</h3><p>${esc(D.SCH_SPRING_CAPTIONS[i])}</p></div>`;
  }
  const prev = level > 1 ? `<button type="button" class="fs-btn ghost" data-go="${BASE}/level/${level - 1}/${app}">‹ Level ${level - 1}</button>` : '<span></span>';
  const next = level < 6 ? `<button type="button" class="fs-btn ghost" data-go="${BASE}/level/${level + 1}/${app}">Level ${level + 1} ›</button>` : '<span></span>';
  return `${navHTML('routines')}
    <button type="button" class="fs-back" data-fs="back" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Back</button>
    <div class="fs-level-head">
      <img src="${medal(level)}" alt="Level ${level} medal">
      <div><p class="fs-eyebrow" style="margin:0 0 2px">NGL Schools</p><h1 class="fs-h1" style="margin:0">Level ${level}</h1></div>
    </div>
    <div class="fs-seg" role="tablist">
      ${APPARATUS.map(a => `<button type="button" role="tab" data-go="${BASE}/level/${level}/${a.id}" class="${a.id === app ? 'active' : ''}" aria-selected="${a.id === app}">${a.name}</button>`).join('')}
    </div>
    ${body}
    <div class="fs-level-nav">${prev}${next}</div>
    ${footHTML(ctx)}`;
}

function screenGraduation(ctx){
  return `${navHTML('graduation')}
    <p class="fs-eyebrow">Finish the year with something special</p>
    <h1 class="fs-h1">NGL Graduation</h1>
    <p class="fs-muted">Work through your level, collect all three certificates, then perform your routines live for your family.</p>

    <div class="fs-card">
      <h3>Your certificates</h3>
      <p class="fs-muted" style="font-size:14px">Awarded by your coach and recorded in your Awards Book.</p>
      <div class="fs-awards-row">
        <div class="fs-award"><div class="fs-dot" style="background:var(--fs-bronze)"></div><b>Bronze</b></div>
        <div class="fs-award"><div class="fs-dot" style="background:var(--fs-silver)"></div><b>Silver</b></div>
        <div class="fs-award"><div class="fs-dot" style="background:var(--fs-gold)"></div><b>Gold</b></div>
      </div>
    </div>

    <div class="fs-card">
      <h3>The Graduation Performance</h3>
      <ul class="fs-facts">
        <li>Perform your routines in front of your family</li>
        <li>Held at your local British Gymnastics club where available, or at your school</li>
        <li>£${D.GRAD_FAMILY_PRICE} per gymnast, including one spectator; extra spectators £${D.GRAD_EXTRA_SPECTATOR}</li>
        <li>Every graduate receives an exclusive NGL Schools Medal</li>
      </ul>
      <div class="fs-medal-strip">${[1, 2, 3, 4, 5, 6].map(l => `<img src="${medal(l)}" alt="Level ${l} medal">`).join('')}</div>
    </div>

    <div class="fs-section-title"><h2>Upcoming Graduations</h2></div>
    <div id="fsEvents">${eventsHTML([])}</div>
    ${footHTML(ctx)}`;
}

function evDateText(ev){
  if (!ev.date) return '';
  const d = new Date(ev.date + 'T12:00:00');
  let s = d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  if (ev.time){ const [h, m] = ev.time.split(':').map(Number); s += ' · ' + ((h % 12) || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm'); }
  return s;
}
const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? u : '';
function eventsHTML(list){
  if (!list.length){
    return `<div class="fs-card fs-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
      <h3>No dates published yet</h3>
      <p class="fs-muted" style="margin:0">When your club announces a Graduation, the details will appear here.</p>
    </div>`;
  }
  return list.map(ev => {
    const url = safeUrl(ev.bookingUrl);
    return `<div class="fs-card fs-event">
    <h3>${esc(ev.title || 'NGL Schools Graduation')}</h3>
    <div class="fs-when">${esc(evDateText(ev))}${ev.venue ? '<br>' + esc(ev.venue) : ''}</div>
    ${ev.schoolName ? `<div class="fs-note" style="margin-bottom:6px">For ${esc(ev.schoolName)} gymnasts</div>` : ''}
    <ul class="fs-facts">
      <li>£${D.GRAD_FAMILY_PRICE} per gymnast, including one spectator</li>
      <li>Extra spectators £${D.GRAD_EXTRA_SPECTATOR} each</li>
      <li>NGL Graduation Medal included</li>
    </ul>
    ${ev.notes ? `<p class="fs-muted" style="font-size:14px;margin:10px 0 0">${esc(ev.notes)}</p>` : ''}
    ${url ? `<a class="fs-btn" style="margin-top:12px" href="${esc(url)}" target="_blank" rel="noopener">Book a place</a>` : '<p class="fs-note" style="margin:10px 0 0">Ask your club or school how to book a place.</p>'}
  </div>`; }).join('');
}

const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function demoEvents(ctx){
  const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  return [
    {title:'NGL Schools Graduation', date:iso(60), time:'10:00', venue:ctx.clubName || 'SAADI Gymnastics', notes:'Arrive 30 minutes early.'},
    {title:'Summer Graduation', schoolName:'Redbourn Primary School', date:iso(95), time:'13:30', venue:'Redbourn Primary School hall', bookingUrl:'https://example.com/book'}
  ];
}
async function loadEvents(ctx){
  const box = () => document.getElementById('fsEvents');
  if (ctx.demo){ if (box()) box().innerHTML = eventsHTML(demoEvents(ctx)); return; }
  const clubId = ctx.doc && ctx.doc.clubId;
  if (!clubId) return;
  try {
    const { fb } = await import('../firebase.js'); const {fs, D: db} = await fb();
    const res = await fs.getDocs(fs.query(fs.collection(db, 'familyEvents'), fs.where('clubId', '==', clubId)));
    const today = todayISO();
    const list = res.docs.map(d => d.data()).filter(e => (!e.programme || e.programme === 'schools') && (e.date || '') >= today)
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    if (box()) box().innerHTML = eventsHTML(list);
  } catch (e) { console.error(e); }
}

export default async function render(ctx){
  css();
  const [view, a, b] = ctx.parts || [];
  let html;
  if (view === 'level' && /^[1-6]$/.test(a || '') && ['floor', 'bench', 'vault'].includes(b || 'floor')) html = screenLevel(ctx, +a, b || 'floor');
  else if (view === 'routines') html = screenRoutines(ctx);
  else if (view === 'graduation') html = screenGraduation(ctx);
  else html = screenHome(ctx);
  return `<div class="fs">${html}</div>`;
}

export function after(ctx){
  window.scrollTo(0, 0);
  if ((ctx.parts || [])[0] === 'graduation') loadEvents(ctx);
}

// Events: one set of document listeners, guarded to #famPage
if (!window.__nglFamSchools){
  window.__nglFamSchools = true;
  document.addEventListener('click', async e => {
    if (!e.target.closest || !e.target.closest('#famPage .fs')) return;
    const go = e.target.closest('[data-go]');
    if (go){ location.hash = go.dataset.go; return; }
    const v = e.target.closest('.fs-video[data-yt]');
    if (v && !v.querySelector('iframe')){
      const id = encodeURIComponent(v.dataset.yt);
      v.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1"
        title="Routine video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      return;
    }
    const f = e.target.closest('[data-fs]');
    if (!f) return;
    if (f.dataset.fs === 'back'){ if (history.length > 1) history.back(); else location.hash = BASE + '/routines'; }
    if (f.dataset.fs === 'signout'){ const w = await import('../views/welcome.js'); w.showParent(); }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('#famPage .fs [role="button"]')){ e.preventDefault(); e.target.click(); }
  });
}
