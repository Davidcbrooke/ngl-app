// General League for families: open to every NGL family, no code needed.
// Ported word for word from ngl-club-hub/family/general/ (the General League Hub) and the
// "Results & league tables" + "No code yet?" parts of ngl-club-hub/family/ (the NGL Family Hub).
//   #/family/general            home: four tiles and the help box
//   #/family/general/<page>     results | league | qualifiers | training: that page inside the app, filling the screen
// Styles: css/family-general.css
const GH = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/';
const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const SECTIONS = [
  {k: 'results', tag: '2026 season', title: '2026 results', sub: 'Every result and the National League Table from this season.', src: GH + 'RESULTS-VIEWER.HTML',
   icon: I('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 4 4M16 6h3a3 3 0 0 1-4 4"/><path d="M12 13v4M8 21h8M9.5 21l.5-4h4l.5 4"/>')},
  {k: 'league', tag: '2027 season', title: '2027 league table', sub: 'Live scores and the National League Table for the 2027 season.', src: GH + 'ngl-live-league-2027.html?family=1',
   icon: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/>')},
  {k: 'qualifiers', tag: 'General League', title: 'National Finals qualifiers', sub: 'Who has qualified to represent their region at the NGL National Finals.', src: GH + 'national-qualifier.html?family=1',
   icon: I('<circle cx="12" cy="14" r="6"/><path d="M9 3l3 5 3-5M12 11l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 13.3l2-.3z"/>')},
  {k: 'training', tag: 'General League · Boys & Girls', title: 'Training League', sub: '13 challenges filmed in training, for boys and girls, with NGL Profile Cards.', src: GH + 'ngl-training-league.html?site=1', dark: true,
   icon: I('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>')}
];
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const amp = s => s.replace(/&/g, '&amp;');

function css(){
  if (document.querySelector('link[data-fam-css="general"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/family-general.css'; l.dataset.famCss = 'general';
  l.onload = () => size(); document.head.appendChild(l);
}

const help = () => `<div class="fg-help"><p><b>No code yet?</b> Ask your gymnast's club. Clubs find their family codes in their NGL hub. If your club isn't in the NGL yet, tell them about it: registering is free at <a href="https://club.nationalgymnasticsleague.co.uk/#register" target="_top">club.nationalgymnasticsleague.co.uk</a>.</p>
  <p class="fg-add">Got a code for Pre-School, Schools or Recreational? <button type="button" class="btn sm" data-fg="add">Add a code</button></p></div>`;

function home(){
  return `<div class="fg">
    <section class="fg-hero">
      <div class="fg-eyebrow">NGL General League · Families</div>
      <h1>Follow every result</h1>
      <p class="fg-lead">Results, the National League Table, National Finals qualifiers and the Training League, all in one place. Open to every NGL family, no code needed.</p>
    </section>
    <h2 class="fg-h2">Results &amp; league tables</h2>
    <div class="fg-tiles">${SECTIONS.map(s => `<a class="fg-tile" href="#/family/general/${s.k}" data-fg-tile="${s.k}"><span class="fg-ic">${s.icon}</span><span class="fg-tx"><i>${amp(s.tag)}</i><b>${s.title}</b><span>${s.sub}</span></span><span class="fg-go">${CHEV}</span></a>`).join('')}</div>
    <p class="fg-more">Is your gymnast’s club in the NGL? <a href="https://club.nationalgymnasticsleague.co.uk/#register" target="_top">Find out how to join</a></p>
    ${help()}
  </div>`;
}

function section(s){
  return `<div class="fg fg-sec">
    <div class="fg-bar"><a class="fg-back" href="#/family/general">${BACK}General League</a><b>${s.title}</b></div>
    <iframe class="fg-frame${s.dark ? ' dark' : ''}" id="fgFrame" title="${s.title}" src="${s.src}"></iframe>
  </div>`;
}

export default async function render(ctx = {}){
  css();
  const k = (ctx.parts || [])[0], s = SECTIONS.find(x => x.k === k);
  return s ? section(s) : home();
}

/* The page fills the screen below the bar and scrolls inside itself (as in the General League Hub) */
function size(){
  const f = document.getElementById('fgFrame'); if (!f) return;
  const top = f.getBoundingClientRect().top + window.scrollY;
  f.style.height = Math.max(420, window.innerHeight - top - 16) + 'px';
}

let WIRED = false;
export function after(){
  const page = document.getElementById('famPage'); if (page) page.classList.toggle('fg-wide', !!document.getElementById('fgFrame'));
  window.scrollTo(0, 0); size();
  if (WIRED) return; WIRED = true;
  window.addEventListener('resize', size);
  document.addEventListener('click', e => {
    const b = e.target.closest('#famPage [data-fg="add"]'); if (!b) return;
    e.preventDefault(); import('../views/welcome.js').then(w => w.showParent());
  });
}
