// NGL Recreational planning engine: copied WORD FOR WORD from today's Recreational hub
// (nglrecreational-site/index.html, "club plan generator"), so plans come out exactly the same.
// Input: NGL content + the club's term settings. Output: the club's fortnights, stations and a coverage report.
// If the engine changes in the live hub, copy it here again (and vice versa) until switch-over.
const PLAN_WEEK_A = ['FF','VT','BM'], PLAN_WEEK_B = ['BF','BA','FT'];
const CLASS_RULES = {
  45: {warm:8, cool:4, rot:11, cap:4, stretch:1},
  60: {warm:10, cool:5, rot:15, cap:6, stretch:0},
  75: {warm:10, cool:5, rot:20, cap:8, stretch:0}
};
const PIECE_OPTS = {
  VT: [['table','Vault table'],['block','Block only'],['none','No vault']],
  BM: [['beam','High, medium or low beam'],['floor','Floor beam or bench'],['none','No beam']],
  BA: [['bars','Bars'],['none','No bars']],
  FT: [['fasttrack','Fast track and trampette'],['tramp','Trampette only']]
};
function planDefaults(t){
  t = t || {};
  return {start: t.start || '', weeks: +t.weeks || 14, halfTerm: t.halfTerm || '', classLen: +t.classLen || 60,
    pieces: Object.assign({VT:'table', BM:'beam', BA:'bars', FT:'fasttrack'}, t.pieces || {}), startBlock: 1, custom: !!t.custom};
}
function stationCps(s){
  const out = [];
  Object.keys(s.assess || {}).forEach(c => (s.assess[c] || []).forEach(y => out.push(y.p + '|' + y.L + '|' + y.s)));
  return out;
}
function buildClubPlan(content, term){
  const t = planDefaults(term), rule = CLASS_RULES[t.classLen] || CLASS_RULES[60];
  const src = content.plan.blocks, teach = src.filter(b => !b.assessment), assessB = src.find(b => b.assessment);
  const removed = Object.keys(t.pieces).filter(k => t.pieces[k] === 'none');
  const has = c => !removed.includes(c);
  const noBars = !has('BA');
  // Week B with no bars: two longer rotations
  const capFor = code => {
    if(noBars && PLAN_WEEK_B.includes(code)){ const len = (t.classLen - rule.warm - rule.cool) / 2; return Math.max(4, Math.min(8, Math.round(len / 3))); }
    return rule.cap;
  };
  const T = t.weeks - 2, F = Math.floor(T / 2), odd = T % 2 === 1;
  // fortnight slots per piece; Week A pieces get the odd week too
  const slotsFor = code => F + (odd && PLAN_WEEK_A.includes(code) ? 1 : 0);
  // map NGL teaching blocks (1..6) onto this club's slots
  const mapBlock = (bn, nSlots) => Math.min(nSlots - 1, Math.floor((bn - 1) * nSlots / teach.length));
  const codes = [...PLAN_WEEK_A, ...PLAN_WEEK_B].filter(has);
  // candidates per piece, each with a home slot
  const cand = {};
  codes.forEach(code => {
    const n = slotsFor(code); cand[code] = [];
    teach.forEach(b => { const p = b.pieces.find(x => x.code === code); if(!p) return;
      p.stations.forEach(s => cand[code].push({b, p, s, home: mapBlock(b.n, n), cps: stationCps(s)})); });
  });
  // checkpoints the full NGL plan teaches on the apparatus this club has
  const required = new Set();
  codes.forEach(code => cand[code].forEach(x => x.cps.forEach(c => { if(!(noBars && c.startsWith('Bars|'))) required.add(c); })));
  // greedy cover: a station goes in its home fortnight, or the one either side if that is full
  const chosen = {}, used = {}, covered = new Set();
  codes.forEach(code => { chosen[code] = Array.from({length: slotsFor(code)}, () => []); used[code] = new Set(); });
  const room = (code, k, extra) => k >= 0 && k < slotsFor(code) && chosen[code][k].length < capFor(code) + extra;
  for(;;){
    let best = null, gain = 0;
    codes.forEach(code => cand[code].forEach((x, i) => {
      if(used[code].has(i)) return;
      const g = x.cps.filter(c => required.has(c) && !covered.has(c)).length;
      if(g <= gain) return;
      const k = [x.home, x.home + 1, x.home - 1, x.home + 2, x.home - 2].find(k => room(code, k, rule.stretch));
      if(k === undefined) return;
      gain = g; best = [code, i, k];
    }));
    if(!best) break;
    const [code, i, k] = best; used[code].add(i); chosen[code][k].push(i); cand[code][i].cps.forEach(c => covered.add(c));
  }
  // fill with progressions from each fortnight's own themes, in authored order
  codes.forEach(code => chosen[code].forEach((list, k) => {
    cand[code].forEach((x, i) => { if(x.home === k && !used[code].has(i) && list.length < capFor(code)){ used[code].add(i); list.push(i); } });
  }));
  // assemble fortnights
  const blocks = [];
  const nSlots = Math.max(F + (odd ? 1 : 0), 1);
  for(let k = 0; k < nSlots; k++){
    const isOdd = odd && k === F;
    const w1 = 2 * k + 1;
    const pieces = [];
    codes.forEach(code => {
      if(isOdd && !PLAN_WEEK_A.includes(code)) return;
      const pick = (chosen[code][k] || []).slice().sort((a, b) => a - b).map(i => cand[code][i]);
      if(!pick.length) return;
      const own = pick.filter(x => x.home === k), themes = [...new Set((own.length ? own : pick).map(x => x.p.theme))];
      const first = pick[0].p;
      pieces.push({code, piece: first.piece, theme: themes.join(' + '), setup: first.setup, intro: first.intro,
        stations: pick.map((x, j) => Object.assign({}, x.s, {n: j + 1, from: x.b.n}))});
    });
    const srcBlocks = [...new Set(teach.filter(b => codes.some(c => mapBlock(b.n, slotsFor(c)) === k)).map(b => b.n))];
    blocks.push({n: k + 1, label: isOdd ? 'Week ' + w1 : 'Fortnight ' + (k + 1), weeks: isOdd ? 'Week ' + w1 : `Weeks ${w1} & ${w1 + 1}`,
      assessment: false, odd: isOdd, warm: Math.max(0, (srcBlocks[0] || 1) - 1), pieces});
  }
  blocks.push({n: nSlots + 1, label: 'Assessment', weeks: `Weeks ${t.weeks - 1} & ${t.weeks}`, assessment: true, odd: false,
    warm: content.warmups.length - 1,
    pieces: assessB.pieces.filter(p => has(p.code)).map(p => Object.assign({}, p, {stations: p.stations.slice(0, capFor(p.code)).map((s, j) => Object.assign({}, s, {n: j + 1}))}))});
  // coverage report by book
  const byBook = [0,1,2,3].map(() => ({need:0, got:0, missing:[]}));
  required.forEach(c => { const [p, L, s] = c.split('|'); const b = byBook[Math.ceil(+L / 4) - 1]; if(!b) return;
    b.need++; if(covered.has(c)) b.got++; else b.missing.push({p, L:+L, s}); });
  const adapted = [];
  if(t.pieces.BM === 'floor') adapted.push('Beam skills are taught and assessed on a floor beam or bench, and marked adapted.');
  if(t.pieces.VT === 'block') adapted.push('Vault skills are taught on a block instead of a vault table.');
  if(t.pieces.FT === 'tramp') adapted.push('Fast Track stations run on the trampette with a run of panel mats.');
  const key4 = ['VT','BM','BA'].filter(c => removed.includes(c));
  return {settings: t, rule, blocks, coverage: byBook, removed, adapted,
    twoPiece: key4.length > 0, noBars, F, odd};
}
const _mon = x => { const d = new Date(x); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; };  // weeks run Monday to Sunday
// Which club week is it? Half-term week is skipped.
function clubWeekNow(term, plan, today){
  const t = planDefaults(term);
  if(!t.start) return null;
  const day = 86400000, start = _mon(t.start + 'T00:00:00'), now = today || new Date();
  let wk = Math.floor((now - start) / (7 * day)) + 1;
  let half = false;
  if(t.halfTerm){
    const hw = Math.floor((new Date(t.halfTerm + 'T00:00:00') - start) / (7 * day)) + 1;
    if(wk === hw) half = true; else if(wk > hw) wk -= 1;
  }
  if(wk < 1 || wk > t.weeks) return {wk, W:t.weeks, outside:true};
  const blocks = plan.blocks;
  const at = w => {
    if(w > t.weeks - 2) return {block: blocks[blocks.length - 1].n, week: w === t.weeks - 1 ? 'A' : 'B'};
    const b = blocks[Math.min(Math.floor((w - 1) / 2), blocks.length - 2)];
    return {block: b.n, week: b.odd ? 'A' : ((w - 1) % 2 === 0 ? 'A' : 'B')};
  };
  // Half term: no classes; point at the first teaching week after the break
  if(half){ const back = new Date(_mon(t.halfTerm + 'T00:00:00').getTime() + 7 * day); return Object.assign({wk, W:t.weeks, half:true, back}, at(Math.min(wk, t.weeks))); }
  return Object.assign({wk, W:t.weeks}, at(wk));
}

export { PLAN_WEEK_A, PLAN_WEEK_B, CLASS_RULES, PIECE_OPTS, planDefaults, stationCps, buildClubPlan, clubWeekNow };
