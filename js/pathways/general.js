// General League: compete locally, score nationally. Standard pathway model (DESIGN.md 6a).
// Content and links follow today's General League hub (club.nationalgymnasticsleague.co.uk/general/).
// The Skills Book is bought through the Club Hub's own checkout (same as every product), not a separate link.
import { appLink } from '../config.js';
import api from '../data.js';
import { esc, gbp, date, pill, ic, svg } from '../ui.js';

const GR = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/';
const IMG = 'img/pathways/';
export const LINKS = {
  powerLeague: GR + 'ngl-training-league.html', get parents(){ return appLink('#/family/general'); },
  league2027: 'https://www.nationalgymnasticsleague.co.uk/2027-season-results-and-league-table',
  results2026: 'https://www.nationalgymnasticsleague.co.uk/resultsandleaguetable', qualifiers: GR + 'national-qualifier.html',
  coachGuide: GR + 'ngl-training-league-coach-guide.pdf'
};
const RULES = {
  girls: {label: 'Girls', name: 'Women’s Artistic', pdf: GR + 'ngl-rules-2027-numbered-update/NGL_General_League_WAG_Rules_2027.pdf', dir: GR + 'ngl-rules-2027-numbered-update/general-wag/'},
  boys: {label: 'Boys', name: 'Men’s Artistic', pdf: GR + 'ngl-rules-2027-numbered-update/NGL_General_League_MAG_Rules_2027.pdf', dir: GR + 'ngl-rules-2027-numbered-update/general-mag/'}
};
export const BOOK = {price: 4, rrp: 8};
export const postage = q => q <= 20 ? 4 : q <= 100 ? 8 : 12;
export const UI = {gender: 'girls', level: '1', qty: 20};
const S = {club: null, comps: [], music: []};
const forGender = c => /boys|mag/i.test(c.who) ? 'boys' : /girls|wag/i.test(c.who) && !/boys/i.test(c.who) ? 'girls' : 'both';
export const parentMessage = () => { const club = (S.club && S.club.name) || 'our club';
  return `Hi everyone,\n\n${club} competes in the NGL General League. You can follow every result, the National League Table and the Training League here:\n${LINKS.parents}\n\nSave it to your phone’s home screen so it’s always to hand.\n\nThank you,\n${club}`; };

async function ready(){
  const [club, comps, music] = await Promise.all([api.club(), api.competitions(), api.music()]);
  S.club = club; S.comps = comps.filter(c => c.path === 'general'); S.music = music; return S;
}
const compRow = c => `<div class="row"><div style="text-align:center;min-width:54px"><small style="color:var(--muted);font-weight:700">${date(c.date, {month: 'short'}).toUpperCase()}</small><br><b style="font:900 24px var(--cond);color:var(--navy)">${date(c.date, {day: 'numeric'})}</b></div>
  <div class="grow"><b>${esc(c.name)}</b><small>${esc(c.where)} · ${esc(c.who)}</small></div>
  ${c.waiting ? pill('Waiting list', 'warn') : c.reserved ? pill(c.reserved + ' reserved', 'ok') : `<button class="btn sm" data-act="reserve" data-comp="${c.id}">Reserve places</button>`}</div>`;
const benefit = (h, p) => `<div class="card tile">${ic('book', 'var(--gen)')}<div><b>${h}</b><br><small style="color:var(--muted)">${p}</small></div></div>`;
const bookTotal = q => `${q} × ${gbp(BOOK.price)} = ${gbp(q * BOOK.price)} + ${gbp(postage(q))} postage · <b>Total ${gbp(q * BOOK.price + postage(q))}</b>`;
export const totalHTML = bookTotal;

const tabs = {
  async overview(p){
    const mine = S.comps.filter(c => c.reserved || c.waiting), places = mine.reduce((a, c) => a + (c.reserved || 0), 0), next = mine.find(c => c.reserved);
    const miss = S.music.reduce((a, m) => a + m.gymnasts.filter(g => !g.file).length, 0);
    return `<div class="grid g4" style="margin-bottom:16px">
      <a class="card stat" href="#/competitions/places"><b>${places}</b><span>Places reserved · ${mine.length} competition${mine.length === 1 ? '' : 's'}</span></a>
      <a class="card stat" href="#/competitions/places"><b>${next ? date(next.date, {day: 'numeric', month: 'short'}) : '–'}</b><span>${next ? 'Next: ' + esc(next.name) : 'Nothing reserved yet'}</span></a>
      <a class="card stat" href="#/competitions/music"><b>${miss}</b><span>Floor music to upload</span></a>
      <a class="card stat" href="#/programmes/general/teach"><b>13</b><span>Training League challenges</span></a></div>
      <h2>Coming up</h2><div class="card">${S.comps.slice(0, 4).map(compRow).join('') || '<p class="empty">The 2027 General League dates will appear here.</p>'}</div>
      <div class="grid g3" style="margin-top:16px">
        <a class="card tile" href="#/programmes/general/compete">${ic('rules', p.c)}<div><b>Rules by level</b><br><small style="color:var(--muted)">Girls and boys, Levels 1–4</small></div></a>
        <a class="card tile" href="${LINKS.league2027}" target="_blank" rel="noopener">${ic('table', p.c)}<div><b>2027 league table ↗</b><br><small style="color:var(--muted)">Live results and the National League Table</small></div></a>
        <a class="card tile" href="#/programmes/general/awards">${ic('book', p.c)}<div><b>General Skills Book</b><br><small style="color:var(--muted)">£4 a book, out now</small></div></a></div>`;
  },
  async teach(p){
    const club = S.club.name || '';
    const mail = 'mailto:admin@nationalgymnasticsleague.co.uk?subject=' + encodeURIComponent('Training League videos: ' + club) + '&body=' + encodeURIComponent('Hi NGL,\n\nHere are our Training League videos.\n\nFor each video: gymnast first name and surname initial, boy or girl, BG number, age group, training hours and the challenge.\n\nWe confirm parent consent has been given for every gymnast in these videos.\n\nClub: ' + club + '\n');
    return `<h2 class="flow-h">Training League</h2><p class="lead">13 conditioning challenges for boys and girls, filmed in training and open all season. Every result goes into the live table and onto the gymnast’s NGL Profile Card.</p>
      <div class="grid g3">
        <div class="card"><h3>1 · Film in training</h3><p class="lead" style="font-size:14px">Phone side-on, whole body in shot, one take. Say the gymnast’s name and the challenge at the start.</p><a class="btn sm ghost" href="${LINKS.coachGuide}" target="_blank" rel="noopener">Print the coach guide</a></div>
        <div class="card"><h3>2 · Send it to NGL</h3><p class="lead" style="font-size:14px">First name, surname initial, boy or girl, BG number, age group and training hours. Confirm parent consent has been given.</p><a class="btn sm" href="${mail}">Email your videos</a></div>
        <div class="card"><h3>3 · Watch the table</h3><p class="lead" style="font-size:14px">Your gymnasts appear once their first result is in. Their cards build with every challenge.</p></div></div>
      <div class="card" style="margin-top:16px;padding:0;overflow:hidden"><iframe title="Training League table" src="${LINKS.powerLeague}?embed=1" style="width:100%;height:720px;border:0;display:block" loading="lazy"></iframe></div>`;
  },
  async awards(p){
    const q = Math.max(1, UI.qty);
    return `<div class="grid" style="grid-template-columns:minmax(220px,340px) 1fr;align-items:start;gap:24px">
      <img src="${IMG}general-cover.jpg" alt="NGL General Skills Book cover" style="width:100%;border-radius:14px;box-shadow:0 18px 40px rgba(6,10,40,.2)">
      <div><p class="kick">Available to buy now</p><h2 style="font:900 30px var(--cond);text-transform:uppercase;color:var(--navy);margin:0">NGL General Skills Book</h2>
        <p class="lead">Support your gymnasts’ progression in alignment with the NGL competitions. One book covers Levels 1–4, for girls and boys.</p>
        <p><b style="font:900 34px var(--cond);color:var(--navy)">${gbp(BOOK.price)}</b> per book · RRP ${gbp(BOOK.rrp)} if you sell them on · printed and ready to post</p>
        <div class="card" style="border-left:4px solid var(--gen);margin:10px 0">Your <b>2027 General League licence fee is waived</b> because your club is on the NGL Club Hub.</div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="qty"><button data-act="gl-qty" data-d="-1" aria-label="One fewer">−</button><input id="glQty" type="number" min="1" value="${q}" aria-label="Number of books" style="width:70px;text-align:center;border:1.5px solid var(--line);border-radius:10px;padding:8px"><button data-act="gl-qty" data-d="1" aria-label="One more">+</button></div>
          <button class="btn" data-act="gl-buy">Buy now</button></div>
        <p class="lead" id="glTotal" style="margin-top:10px">${bookTotal(q)}</p><p class="lead" style="font-size:13px">Secure checkout: card, Apple Pay, Google Pay or Pay by bank. Stripe emails your receipt.</p></div></div>
      <h2 style="margin-top:22px">Why clubs use it</h2><div class="grid g3">
        ${benefit('Aligned to NGL competitions', 'The skills in each level match what gymnasts compete at that level.')}${benefit('The right level to enter', 'Gymnasts can see which level to compete in from the skills they can already do.')}
        ${benefit('Clear for parents', 'Parents can see the level their child is at and how they are progressing.')}${benefit('Focus for coaches', 'Development areas set out openly, so gymnast, parent and coach all see the same picture.')}
        ${benefit('Bronze, Silver and Gold', 'Doing a skill is different from doing it 10 out of 10. Know when a gymnast is ready to compete.')}${benefit('Working With Parents In Sport', 'A section from our key partner: competitive sport centred on the gymnast and the parent.')}</div>
      <h2 style="margin-top:22px">Inside the book</h2><div class="ps-books">${['general-cover', 'general-book-1', 'general-book-2'].map(f => `<img src="${IMG}${f}.jpg" alt="" loading="lazy" style="height:240px">`).join('')}</div>`;
  },
  async compete(p){
    const g = UI.gender, R = RULES[g], lv = UI.level, a = (+lv - 1) * 2 + 1, P2 = n => String(n).padStart(2, '0');
    const dates = S.comps.filter(c => forGender(c) === 'both' || forGender(c) === g);
    return `<p class="lead">Compete locally, score nationally. Every result goes into the National League Table, leading to regional qualification and the NGL National Finals.</p>
      <div class="chips" style="margin-bottom:12px">${['girls', 'boys'].map(k => `<button class="chip ${g === k ? 'on' : ''}" data-act="gl-gender" data-v="${k}">${RULES[k].label}</button>`).join('')}</div>
      <h2>2027 dates · ${R.label}</h2><div class="card">${dates.map(compRow).join('') || '<p class="empty">The 2027 dates will appear here.</p>'}</div>
      <h2 style="margin-top:20px">League tables & results</h2><div class="grid g3">
        <a class="card tile" href="${LINKS.league2027}" target="_blank" rel="noopener">${ic('table', p.c)}<div><b>2027 league table ↗</b><br><small style="color:var(--muted)">Live results and the National League Table</small></div></a>
        <a class="card tile" href="${LINKS.results2026}" target="_blank" rel="noopener">${ic('comp', p.c)}<div><b>2026 results ↗</b><br><small style="color:var(--muted)">Last season’s results and league table</small></div></a>
        <a class="card tile" href="${LINKS.qualifiers}" target="_blank" rel="noopener">${ic('comp', p.c)}<div><b>National Qualifiers ↗</b><br><small style="color:var(--muted)">Regional qualification</small></div></a></div>
      <div class="flow-hrow" style="margin-top:20px"><h2 style="margin:0">Rules 2027 · ${R.label} (${R.name})</h2><a class="btn sm ghost" href="${R.pdf}" target="_blank" rel="noopener">Download all levels (PDF)</a></div>
      <div class="chips" style="margin:10px 0">${['1', '2', '3', '4'].map(k => `<button class="chip ${lv === k ? 'on' : ''}" data-act="gl-level" data-v="${k}">Level ${k}</button>`).join('')}</div>
      <div class="grid g2">${[[a, 'Competition rules'], [a + 1, 'Common deductions']].map(([n, t]) => `<figure class="card" style="margin:0"><a href="${R.dir}page-${P2(n)}.jpg" target="_blank" rel="noopener" title="Open full size"><img loading="lazy" src="${R.dir}page-${P2(n)}.jpg" alt="${R.label} Level ${lv} ${t.toLowerCase()}" style="width:100%;border-radius:8px"></a><figcaption class="lead" style="margin:8px 0 0">Level ${lv} · ${t} · tap to enlarge</figcaption></figure>`).join('')}</div>
      <p class="lead" style="font-size:13px;margin-top:10px">Based on the FIG Code of Points except where NGL changes are noted.</p>`;
  },
  async families(p){
    return `<div class="card"><h2>Family Hub</h2><p class="lead">Share one link with your parents and gymnasts. It takes them to the NGL results, the National League Table and the Training League, and soon to each gymnast’s own General League Hub.</p>
      <div class="grid" style="grid-template-columns:200px 1fr;gap:20px;align-items:start"><div id="glQR" style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px;min-height:180px"></div>
      <div><div style="display:flex;gap:10px;flex-wrap:wrap"><input readonly value="${esc(LINKS.parents)}" aria-label="Parents’ link" style="flex:1;min-width:220px;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit"><button class="btn" data-act="rec-copy" data-v="${esc(LINKS.parents)}">Copy link</button></div>
        <label class="field"><span>A message you can send</span><textarea id="glMsg" rows="8">${esc(parentMessage())}</textarea></label><button class="btn ghost" data-act="gl-copy-msg">Copy message</button></div></div></div>
      <div class="grid g3" style="margin-top:16px">${benefit('Results & league tables', 'Live results from every competition and the National League Table.')}${benefit('Training League', 'The table and every gymnast’s NGL Profile Card ratings, updated all season.')}${benefit('Their gymnast’s hub (coming soon)', 'Each gymnast’s own General League Hub: profile card, scores, stats and competitions.')}</div>`;
  },
  async licence(p){
    return `<div class="card" style="border-left:4px solid var(--gen)"><h2>Licence fee waived for 2027 ${pill('Fee waived', 'ok')}</h2>
      <p class="lead">Every club registered on the NGL Club Hub has its 2027 General League Club Licence fee waived. You buy the General Skills Book at ${gbp(BOOK.price)} a book (RRP ${gbp(BOOK.rrp)}), and enter competitions on JustGo as usual.</p>
      <div class="btn-row"><a class="btn" href="#/programmes/general/awards">Buy Skills Books</a><a class="btn ghost" href="#/competitions">Reserve competition places</a></div></div>`;
  }
};

export default { async render(p, tab){ await ready(); return (tabs[tab] || tabs.overview)(p); } };
