/**
 * NGL Club Hub: DATA MOVE REHEARSAL (run from the Apps Script editor, bookingoffice@ account).
 * READS live data (Firebase ngl-schools and saadi-rotation) and WRITES the new one-app layout into the
 * STAGING project (ngl-club-hub-staging). Nothing in the live projects is changed: every call to them is a GET.
 * Run rehearse(). Then read the report: staging Firestore → migration/report, and the execution log.
 * Script properties: none. Scopes: script.external_request, datastore (see appsscript.json).
 */
const LIVE = 'ngl-schools', BOOK = 'saadi-rotation', STAGING = 'ngl-club-hub-staging';
const base = p => 'https://firestore.googleapis.com/v1/projects/' + p + '/databases/(default)/documents';

/* ---------- prices and band names (same as the hubs) ---------- */
const SCHOOLS_BANDS = {xs: '1 to 24 Schools gymnasts', sm: '25 to 49 Schools gymnasts', s: '50 to 99 Schools gymnasts', m: '100 to 249 Schools gymnasts', m2: '250 to 399 Schools gymnasts', l: '400 to 599 Schools gymnasts', xl: '600 or more Schools gymnasts'};
const REC_BANDS = {xs: '1 to 24 recreational gymnasts', sm: '25 to 49 recreational gymnasts', s: '50 to 99 recreational gymnasts', m: '100 to 249 recreational gymnasts', m2: '250 to 399 recreational gymnasts', l: '400 to 599 recreational gymnasts', xl: '600 or more recreational gymnasts'};
const PS_BANDS = {xs: '1–24 Pre-School gymnasts', sm: '25–49 Pre-School gymnasts', s: '50–99 Pre-School gymnasts', m: '100 or more Pre-School gymnasts'};

function rehearse(){
  const t0 = Date.now(), report = {startedAt: new Date(), clubs: [], unmatched: {reservations: [], music: [], orders: []}, counts: {}};
  // 1. READ live (GET only)
  const clubs = listAll(LIVE, 'clubs'), schoolsOrders = listAll(LIVE, 'orders'), recOrders = listAll(LIVE, 'recOrders');
  const events = listAll(LIVE, 'events'), musicEvents = listAll(LIVE, 'musicEvents'), musicUploads = listAll(LIVE, 'musicUploads');
  const comps = listAll(BOOK, 'ngl_competitions'), bookings = listAll(BOOK, 'ngl_bookings'), contacts = listAll(BOOK, 'ngl_booking_contacts');
  const team = listAll(BOOK, 'ngl_admin_users');   // the original Admin Hub's team list (same app ids)
  const contactEmail = {}; contacts.forEach(c => { if (c.data.email) contactEmail[c.id] = String(c.data.email).trim().toLowerCase(); });
  clubs.forEach(c => { c.data.schoolsSub = listAll(LIVE, 'clubs/' + c.id + '/schools').map(s => ({id: s.id, name: s.data.name || '', children: Number(s.data.children) || 0})); });
  report.counts.live = {clubs: clubs.length, schoolsOrders: schoolsOrders.length, recOrders: recOrders.length, events: events.length, musicEvents: musicEvents.length, musicUploads: musicUploads.length, competitions: comps.length, bookings: bookings.length};

  // 2. CONVERT
  const now = new Date(), writes = [];
  const emailIndex = {};   // email or sha256(email) -> club id
  clubs.forEach(c => { [c.data.email].concat(c.data.bookingEmails || []).filter(Boolean).forEach(e => { const k = String(e).trim().toLowerCase(); emailIndex[k] = c.id; emailIndex[sha256(k)] = c.id; }); });
  // Fallback: the club name on the booking, when exactly one Club Hub account has that name
  const norm = n => String(n || '').toLowerCase().replace(/&/g, 'and').replace(/\b(gymnastics?|gym|club|academy|ltd|limited|c\.?i\.?c\.?|and|tumbling|trampoline|the)\b/g, '').replace(/[^a-z0-9]/g, '');
  const nameIndex = {}; clubs.forEach(c => { const k = norm(c.data.name); if (k) (nameIndex[k] = nameIndex[k] || []).push(c.id); });
  // One account per club (Dave, 25 Nov): duplicate accounts fold into the one on this email; their licences, schools, orders and places move with them
  const KEEP = {saadi: {email: 'reception@saadigymnastics.co.uk'}, elite: {name: 'elite gymnastics academy'}};
  // Booking names that mean a registered club with a longer name, e.g. {short: 'longer'} (none confirmed yet; "Salto" stays separate until Dave checks)
  const ALIAS = {};
  const mergedInto = {}; report.merged = [];
  Object.keys(KEEP).forEach(k => { const ids = nameIndex[k] || [], keeper = clubs.find(c => ids.includes(c.id) && (KEEP[k].email ? String(c.data.email || '').trim().toLowerCase() === KEEP[k].email : String(c.data.name || '').trim().toLowerCase() === KEEP[k].name));
    if (!keeper) { if (ids.length) report.merged.push('NOT MERGED ' + k + ': no account on ' + (KEEP[k].email || KEEP[k].name)); return; }
    ids.filter(id => id !== keeper.id).forEach(id => { mergedInto[id] = keeper.id; report.merged.push((clubs.find(c => c.id === id).data.name || '') + ' (' + mask(clubs.find(c => c.id === id).data.email || '') + ') -> ' + (keeper.data.name || '') + ' (' + mask(keeper.data.email || '') + ')'); });
    nameIndex[k] = [keeper.id]; });
  const home = id => mergedInto[id] || id;
  Object.keys(emailIndex).forEach(e => { emailIndex[e] = home(emailIndex[e]); });
  const byName = n => { const k = norm(n), ids = nameIndex[ALIAS[k] || k] || []; return ids.length === 1 ? ids[0] : null; };
  const dupNames = Object.keys(nameIndex).filter(k => nameIndex[k].length > 1).map(k => nameIndex[k].map(id => clubs.find(c => c.id === id).data.name + ' (' + mask(clubs.find(c => c.id === id).data.email || '') + ')'));
  report.duplicateClubs = dupNames;

  // Competitions
  const compOut = comps.map(c => { const d = c.data, name = d.name || d.title || c.id, date = isoDate(d.date);
    const path = /recreational/i.test(name + ' ' + (d.pathway || '')) ? 'recreational' : /performance|grades|classic/i.test(name) ? 'performance' : /schools/i.test(name) ? 'schools' : 'general';
    return {id: c.id, name, path, date, time: d.time || '', apparatus: d.apparatus || '', gender: d.gender || '', maxPlaces: typeof d.maxPlaces === 'number' ? d.maxPlaces : null, level: d.level || '', where: d.venue || d.location || 'TBC', who: [d.level, d.gender && d.gender !== 'both' ? (d.gender === 'boys' ? 'Boys' : 'Girls') : ''].filter(Boolean).join(' · ') || 'All levels', status: 'open'}; })
    .filter(c => c.date);
  compOut.forEach(c => writes.push(doc('competitions/' + c.id, c)));

  // Reservations, linked to clubs by email
  const resByClub = {};
  bookings.forEach(b => { const d = b.data, key = d.email ? String(d.email).trim().toLowerCase() : d.emailHash, byEmail = emailIndex[key] || emailIndex[d.emailHash], club = byEmail || byName(d.club || d.clubName);
    if (!club) { report.unmatched.reservations.push({id: b.id, club: d.club || d.clubName || '', compName: d.compName || d.compId, places: Number(d.spaces) || 0});
      // Waits in pendingPlaces: joins the club automatically when it registers and confirms this email, or NGL attaches it in NGL Admin
      const pref = d.reference || b.id, em = (d.email ? String(d.email).trim().toLowerCase() : '') || contactEmail[b.id] || '';
      writes.push(doc('pendingPlaces/' + safeId(pref), {clubName: d.club || d.clubName || '', nameKey: norm(d.club || d.clubName), email: em, compId: d.compId || '', compName: d.compName || '',
        places: Number(d.spaces) || 0, status: d.waitlist ? 'waiting' : (d.bought || d.purchased ? 'bought' : 'reserved'), ref: pref, createdAt: d.createdAt || now, movedFrom: 'saadi-rotation/ngl_bookings/' + b.id}));
      report.pendingWithEmail = (report.pendingWithEmail || 0) + (em ? 1 : 0); return; }
    if (!byEmail) report.matchedByName = (report.matchedByName || 0) + 1;
    const ref = d.reference || b.id, rec = {clubId: club, clubName: (clubs.find(x => x.id === club).data.name || ''), compId: d.compId || '', places: Number(d.spaces) || 0,
      status: d.waitlist ? 'waiting' : (d.bought || d.purchased ? 'bought' : 'reserved'), ref, createdAt: d.createdAt || now, movedFrom: 'saadi-rotation/ngl_bookings/' + b.id};
    writes.push(doc('reservations/' + safeId(ref), rec)); (resByClub[club] = resByClub[club] || []).push(rec); });

  // Orders (Schools + Recreational/Pre-School/General) in one list
  const ordByClub = {};
  const psCodes = [];   // Pre-School family codes made in the clubs loop
  const pushOrder = (o, coll) => { const d = o.data, lines = orderLines(d, coll), total = round2(lines.reduce((a, l) => a + l.qty * l.unit, 0));
    if (!d.clubId) { report.unmatched.orders.push(o.id); return; }
    d.clubId = home(d.clubId);
    const path = coll === 'orders' ? 'schools' : d.pathway === 'preschool' ? 'preschool' : d.pathway === 'general' ? 'general' : 'recreational';
    const rec = {clubId: d.clubId, clubName: d.clubName || '', path, lines, total, details: lines.filter(l => l.k !== 'vat').map(l => l.qty + ' × ' + l.n).join(', '),
      status: d.status || 'awaiting-payment', delivery: d.delivery || '', createdAt: d.createdAt || now, kind: d.kind || d.type || 'supplies', movedFrom: LIVE + '/' + coll + '/' + o.id};
    if (d.paidAt) rec.paidAt = d.paidAt; if (d.sentAt) rec.sentAt = d.sentAt; if (d.paidBy) rec.paidBy = d.paidBy;
    writes.push(doc('orders/' + o.id, rec)); (ordByClub[d.clubId] = ordByClub[d.clubId] || []).push(rec); };
  schoolsOrders.forEach(o => pushOrder(o, 'orders')); recOrders.forEach(o => pushOrder(o, 'recOrders'));

  // Floor music: entries per club, uploads copied with the same ids
  musicEvents.forEach(ev => { const d = ev.data, links = d.links || {};
    Object.keys(d.clubs || {}).forEach(key => { const cl = d.clubs[key]; let uid = links[key] || (cl.bg && (clubs.find(c => String(c.data.bgNumber || '').trim() === String(cl.bg).trim()) || {}).id);
      const gymnasts = []; (d.levels || []).forEach(L => (L.gymnasts || []).forEach(g => { if (g.club === key) gymnasts.push({id: g.id, n: g.name, level: L.name || L.id}); }));
      if (!gymnasts.length) return;
      if (uid) uid = home(uid);
      if (!uid) { report.unmatched.music.push({event: d.title || ev.id, club: cl.name || key, gymnasts: gymnasts.length}); return; }
      writes.push(doc('musicEntries/' + ev.id + '_' + uid, {compId: ev.id, clubId: uid, clubName: cl.name || '', title: d.title || '', date: isoDate(d.date), deadline: isoDate(d.deadline) || d.deadline || '', gymnasts, status: d.status === 'open' ? 'open' : 'closed'})); }); });
  musicUploads.forEach(u => writes.push(doc('musicUploads/' + u.id, Object.assign({}, u.data, {compId: u.data.compKey || u.data.compId || '', movedFrom: LIVE + '/musicUploads/' + u.id}))));

  // Clubs: one licence list, schools and Graduations on the club, plans carried over
  const licOf = c => { const d = c.data, lic = {};
    const live = r => r && r.status === 'active' && (!r.expires || toDate(r.expires) > now);
    const seasonEnd = season => new Date(Number(String(season).slice(0, 4)) + 1, 7, 31);   // 2026/27 -> 31 Aug 2027
    const codeLive = d.codeActive && (!d.codeTrialUntil || toDate(d.codeTrialUntil) > now);
    const legacySeason = Object.keys(d.bands || {}).filter(k => seasonEnd(k) > now).sort().pop();
    if (!live(d.schools) && legacySeason && codeLive) d.schools = {status: 'active', band: '', expires: seasonEnd(legacySeason), legacy: true, gymnasts: d.bands[legacySeason]};
    lic.schools = live(d.schools) ? {status: 'live', label: d.schools.trial ? 'Free trial' : 'Licence live', band: d.schools.legacy ? d.schools.gymnasts + ' gymnasts (' + legacySeason + ' season)' : (SCHOOLS_BANDS[d.schools.band] || d.schools.band || ''), renews: isoDate(d.schools.expires), code: codeLive ? (d.accessCode || '') : ''} : {status: 'explore', label: 'Explore free'};
    lic.recreational = live(d.rec) ? {status: 'live', label: 'Licence live', band: REC_BANDS[d.rec.band] || d.rec.band || '', renews: isoDate(d.rec.expires), code: d.recCode || ''} : {status: 'explore', label: 'Explore free'};
    const p = d.preschool || {};
    lic.preschool = p.status === 'active' ? {status: 'live', label: 'Licence live', band: PS_BANDS[p.band] || p.band || '', renews: p.since ? isoDate(addYear(p.since)) : '', packs: {pack2: !!p.pack2, pack3: !!p.pack3, pack4: !!p.pack4, seasonal: !!p.seasonal}} : {status: 'explore', label: 'Explore free'};
    lic.general = {status: 'waived', label: 'Fee waived for 2027'};
    lic.performance = {status: 'soon', label: 'Coming 2027'}; lic.university = {status: 'soon', label: 'Coming soon'}; lic.masters = {status: 'soon', label: 'Coming soon'};
    return lic; };
  clubs.forEach(c => { if (mergedInto[c.id]) return;
    const d = c.data, lic = licOf(c), dups = clubs.filter(x => mergedInto[x.id] === c.id);
    dups.forEach(x => { const l = licOf(x); Object.keys(l).forEach(k => { if (l[k].status === 'live' && lic[k].status !== 'live') lic[k] = l[k]; });
      const have = new Set(d.schoolsSub.map(s => String(s.name).trim().toLowerCase()));
      x.data.schoolsSub.forEach(s => { if (!have.has(String(s.name).trim().toLowerCase())) d.schoolsSub.push(s); });
      ['recTerm', 'rotaJson', 'rotaUpdatedAt', 'projection', 'secPlan', 'preschoolPlan', 'deliveryAddress', 'bgNumber', 'phone'].forEach(k => { if (d[k] == null && x.data[k] != null) d[k] = x.data[k]; }); });
    const evs = events.filter(e => home(e.data.clubId) === c.id).map(e => ({id: e.id, title: e.data.title || '', schoolId: e.data.schoolId || '', schoolName: e.data.schoolName || '', date: e.data.date || '', time: e.data.time || '', venue: e.data.venue || '', bookingUrl: e.data.bookingUrl || ''}));
    const out = {name: d.name || '', contact: d.contact || '', email: d.email || '', bgNumber: d.bgNumber || '', phone: d.phone || '', deliveryAddress: d.deliveryAddress || '',
      licences: lic, schoolsList: d.schoolsSub, schoolEvents: evs, createdAt: d.createdAt || now, movedFrom: LIVE + '/clubs/' + c.id};
    if (dups.length) out.mergedFrom = dups.map(x => LIVE + '/clubs/' + x.id);
    ['recTerm', 'rotaJson', 'rotaUpdatedAt', 'projection', 'secPlan', 'interest', 'bookingEmails'].forEach(k => { if (d[k] != null) out[k] = d[k]; });
    if (d.preschoolPlan) out.plans = {preschool: d.preschoolPlan};
    // Pre-School family code: a short code like the others (stable per club), holding the term plan. Old #p= links still work in the app.
    if (lic.preschool.status === 'live') { const pc = psCode(d.name, c.id); lic.preschool.code = pc; out.licences = lic;
      psCodes.push({code: pc, clubId: c.id, clubName: d.name || '', plan: d.preschoolPlan ? (typeof d.preschoolPlan === 'string' ? JSON.parse(d.preschoolPlan) : d.preschoolPlan) : null, packs: lic.preschool.packs}); }
    writes.push(doc('clubs/' + c.id, out));
    report.clubs.push({id: c.id, name: d.name || '', email: mask(d.email || ''), licences: Object.keys(lic).filter(k => lic[k].status === 'live').join(', ') || 'none',
      schools: d.schoolsSub.length, graduations: evs.length, orders: (ordByClub[c.id] || []).length, unpaid: (ordByClub[c.id] || []).filter(o => o.status === 'awaiting-payment').length,
      reservations: (resByClub[c.id] || []).length}); });

  // NGL Admin apps: Ticket sales (JustGo summary) and Competition planning (from ngl_staffing plan__*)
  // NGL P&L: the agreed assumptions (entry fees, costs, medals, annual lines)
  const finRaw = getDoc(BOOK, 'ngl_finance/settings'); if (finRaw) writes.push(doc('finance/settings', fromVal_({mapValue: {fields: finRaw.fields || {}}})));
  const jgRaw = getDoc(BOOK, 'ngl_finance/justgo'), jg = jgRaw ? fromVal_({mapValue: {fields: jgRaw.fields || {}}}) : null;
  if (jg) writes.push(doc('justgoSales/summary', Object.assign({}, jg, {clubNames: [...new Set(bookings.map(b => String(b.data.club || '').trim()).filter(Boolean))], movedFrom: 'saadi-rotation/ngl_finance/justgo'})));
  const staffDocs = listAll(BOOK, 'ngl_staffing');
  staffDocs.forEach(s => { const id = s.id;
    if (id === 'summary__planning') writes.push(doc('compPlans/_summary', s.data));
    else if (id === 'plan__template') writes.push(doc('compPlans/_template', s.data));
    else if (id.indexOf('plan__') === 0) writes.push(doc('compPlans/' + id.slice(6), s.data));
    else writes.push(doc('staffing/' + id, s.data)); });   // Staffing: same doc id (= competition id), same document
  // Judging Pathway lists Staffing reads: same names and doc ids (pw:<assignmentId> links and signupId depend on them)
  const judging = {}; ['ngl_judge_signups', 'ngl_judging_assignments', 'ngl_judges', 'ngl_judge_notifications', 'ngl_resources', 'ngl_power_league', 'ngl_power_league_private', 'ngl_groupbuy_orders', 'ngl_groupbuy_rounds'].forEach(c => { const list = listAll(BOOK, c); judging[c] = list.length; list.forEach(x => writes.push(doc(c + '/' + x.id, x.data))); });
  report.apps = {justgoEvents: jg ? Object.keys(jg.events || {}).length : 0, plans: staffDocs.filter(s => s.id.indexOf('plan__') === 0).length, staffing: staffDocs.filter(s => s.id.indexOf('plan__') !== 0 && s.id !== 'summary__planning').length, judging};

  // Floor music: musicEvents (running order, absences, intros, announcements) and _builtin, same ids, from the live Club Hub project
  musicEvents.forEach(m => writes.push(doc('musicEvents/' + m.id, m.data)));
  // Music staff (old music tool's own list) become Team ticks: full = Floor music, otherwise the music player
  const musicStaff = listAll(LIVE, 'musicStaff'), teamIds = team.map(t => String(t.id).toLowerCase());
  musicStaff.forEach(m => { const email = String(m.id).toLowerCase(), tick = m.data.level === 'full' ? 'music' : 'musicplayer';
    const t = team.find(x => String(x.id).toLowerCase() === email);
    if (t) { t.data.sections = [...new Set((t.data.sections || []).concat([tick]))]; }
    else if (!teamIds.includes(email)) team.push({id: email, data: {name: m.data.name || '', owner: false, sections: [tick]}}); });
  report.music = {events: musicEvents.length, staff: musicStaff.length};

  // NGL team: same ticks as the original Admin Hub
  team.forEach(t => writes.push(doc('adminUsers/' + String(t.id).toLowerCase(), {name: t.data.name || '', owner: !!t.data.owner, sections: t.data.sections || [], movedFrom: 'saadi-rotation/ngl_admin_users/' + t.id})));
  report.team = team.map(t => (t.data.name || '') + ' (' + mask(t.id) + ')' + (t.data.owner ? ' owner' : ': ' + (t.data.sections || []).length + ' apps'));

  // ONE list of family codes for the one app (familyCodes/{CODE}): Schools (accessCodes) and Recreational (recCodes) keep
  // their codes unchanged; Pre-School codes are new. A code found in both old lists is a clash: reported, Schools kept.
  const fam = {}, clashes = [];
  const homeOf = id => home(id);
  listAll(LIVE, 'accessCodes').forEach(x => { const d = x.data; fam[x.id] = {programme: 'schools', clubId: homeOf(d.clubId || ''), clubName: d.clubName || '', status: d.status || 'inactive', expires: d.expires || null, season: d.season || ''}; });
  listAll(LIVE, 'recCodes').forEach(x => { const d = x.data;
    if (fam[x.id]) { clashes.push(x.id); if (fam[x.id].status === 'active' || d.status !== 'active') return; }
    fam[x.id] = {programme: 'recreational', clubId: homeOf(d.clubId || ''), clubName: d.clubName || '', status: d.status || 'inactive', expires: d.expires || null, key: d.key || '', term: d.term || null}; });
  psCodes.forEach(p => { if (fam[p.code]) clashes.push(p.code); else fam[p.code] = {programme: 'preschool', clubId: p.clubId, clubName: p.clubName, status: 'active', plan: p.plan, packs: p.packs}; });
  Object.keys(fam).forEach(k => { const f = fam[k]; Object.keys(f).forEach(j => { if (f[j] === null) delete f[j]; }); writes.push(doc('familyCodes/' + k, f)); });
  // Parents' data: the clubs' live timetables (Recreational Rotations) and Graduations (Schools)
  const rota = listAll(LIVE, 'rotaLive'); rota.forEach(x => writes.push(doc('rotaLive/' + home(x.id), x.data)));
  events.forEach(e => writes.push(doc('familyEvents/' + e.id, Object.assign({}, e.data, {clubId: home(e.data.clubId || '')}))));
  // Projected P&L scenarios
  const projRaw = getDoc(BOOK, 'ngl_finance/projection'); if (projRaw) writes.push(doc('finance/projection', fromVal_({mapValue: {fields: projRaw.fields || {}}})));
  report.family = {codes: Object.keys(fam).length, active: Object.values(fam).filter(f => f.status === 'active').length, preschool: psCodes.length, clashes, rotaLive: rota.length, events: events.length};

  // 3. WRITE to staging (batches of 400)
  Object.keys(mergedInto).forEach(id => writes.push({delete: base(STAGING).replace('https://firestore.googleapis.com/v1/', '') + '/clubs/' + id}));   // staging only: remove accounts folded into another
  for (let i = 0; i < writes.length; i += 400) commit(STAGING, writes.slice(i, i + 400));
  const content = copyRecContent();
  report.counts.written = {docs: writes.length, recContentDocs: content};
  report.seconds = Math.round((Date.now() - t0) / 1000);
  commit(STAGING, [doc('migration/report', {json: JSON.stringify(report), at: new Date(), clubs: report.clubs.length, docs: writes.length})]);
  Logger.log(JSON.stringify(report.counts));
  const um = {}; report.unmatched.reservations.forEach(r => { const k = norm(r.club) || '(no name)'; um[k] = um[k] || {names: [], places: 0}; um[k].places += r.places; if (!um[k].names.includes(r.club)) um[k].names.push(r.club); });
  Logger.log('Reservations matched by club name: ' + (report.matchedByName || 0) + ' · still unmatched (places by club): ' + JSON.stringify(um));
  Logger.log('Waiting places with a booking email (join automatically): ' + (report.pendingWithEmail || 0) + ' of ' + report.unmatched.reservations.length);
  Logger.log('Family codes: ' + JSON.stringify(report.family));
  Logger.log('Admin apps: ' + JSON.stringify(report.apps) + ' · music: ' + JSON.stringify(report.music));
  Logger.log('NGL team: ' + JSON.stringify(report.team));
  Logger.log('Merged accounts: ' + JSON.stringify(report.merged));
  Logger.log('Club names with more than one account: ' + JSON.stringify(report.duplicateClubs));
  Logger.log('Clubs: ' + report.clubs.length + ' · unmatched reservations: ' + report.unmatched.reservations.length + ' · unmatched music: ' + report.unmatched.music.length + ' · orders with no club: ' + report.unmatched.orders.length);
  report.clubs.forEach(c => Logger.log([c.name, c.licences, 'schools ' + c.schools, 'orders ' + c.orders + ' (' + c.unpaid + ' unpaid)', 'places ' + c.reservations, 'grads ' + c.graduations].join(' | ')));
  return report;
}

/* Recreational programme: recContent/meta and recShared/{key}/docs/* copied as they are */
function copyRecContent(){
  const meta = getDoc(LIVE, 'recContent/meta'); if (!meta) { Logger.log('No Recreational content published in live'); return 0; }
  const key = fromVal_({mapValue: {fields: meta.fields}}).key, docs = listAll(LIVE, 'recShared/' + key + '/docs');
  const w = [{update: {name: base(STAGING).replace('https://firestore.googleapis.com/v1/', '') + '/recContent/meta', fields: meta.fields}}]
    .concat(docs.map(d => ({update: {name: base(STAGING).replace('https://firestore.googleapis.com/v1/', '') + '/recShared/' + key + '/docs/' + d.id, fields: d.raw}})));
  for (let i = 0; i < w.length; i += 20) commitRaw(STAGING, w.slice(i, i + 20));   // small batches: image chunks are large
  return w.length;
}

/* ---------- order lines in the new shape ---------- */
function orderLines(d, coll){
  if (d.lines && d.lines.length) return d.lines.map(l => ({k: l.kind || l.k || '', n: l.desc || l.n || l.name || 'Item', qty: Number(l.qty) || 0, unit: Number(l.unit) || 0}));
  const L = [];
  if (d.type === 'graduation') { L.push({k: 'graduation', n: 'Graduation medals and places', qty: Number(d.qty) || 0, unit: Number(d.price) || 0});
    if (d.spectators) L.push({k: 'spectator', n: 'Extra spectator tickets', qty: Number(d.spectators), unit: Number(d.spectatorPrice) || 5}); }
  else L.push({k: d.type || 'item', n: d.type === 'club-licence' ? 'NGL Schools Club Licence' + (d.band ? ' (' + (SCHOOLS_BANDS[d.band] || d.band) + ')' : '') : 'NGL Schools order', qty: Number(d.qty) || 1, unit: Number(d.price) || Number(d.total) || 0});
  if (d.vat) { const net = L.reduce((a, l) => a + l.qty * l.unit, 0); L.push({k: 'vat', n: 'VAT (20%)', qty: 1, unit: round2(net * 0.2)}); }
  return L;
}

/* ---------- Firestore REST helpers (live: GET only; staging: commit) ---------- */
function auth_(){ return {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}; }
function listAll(project, path){
  const out = []; let token = '';
  do { const r = UrlFetchApp.fetch(base(project) + '/' + path + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''), {headers: auth_(), muteHttpExceptions: true});
    if (r.getResponseCode() === 404) return out;
    if (r.getResponseCode() !== 200) throw new Error('Read ' + project + '/' + path + ' ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    const j = JSON.parse(r.getContentText()); (j.documents || []).forEach(d => out.push({id: d.name.split('/').pop(), raw: d.fields || {}, data: fromVal_({mapValue: {fields: d.fields || {}}})}));
    token = j.nextPageToken || ''; } while (token);
  return out;
}
function getDoc(project, path){ const r = UrlFetchApp.fetch(base(project) + '/' + path, {headers: auth_(), muteHttpExceptions: true}); return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null; }
function doc(path, obj){ const f = {}; Object.keys(obj).forEach(k => { if (obj[k] !== undefined) f[k] = toVal_(obj[k]); });
  return {update: {name: base(STAGING).replace('https://firestore.googleapis.com/v1/', '') + '/' + path, fields: f}}; }
function commit(project, writes){ commitRaw(project, writes); }
function commitRaw(project, writes){
  if (project !== STAGING) throw new Error('Refusing to write anywhere but staging');
  const r = UrlFetchApp.fetch(base(project) + ':commit', {method: 'post', contentType: 'application/json', headers: auth_(), payload: JSON.stringify({writes}), muteHttpExceptions: true});
  if (r.getResponseCode() !== 200) throw new Error('Write ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
}
function toVal_(v){
  if (v === null || v === undefined) return {nullValue: null};
  if (v instanceof Date) return {timestampValue: v.toISOString()};
  if (typeof v === 'boolean') return {booleanValue: v};
  if (typeof v === 'number') return Number.isInteger(v) ? {integerValue: String(v)} : {doubleValue: v};
  if (typeof v === 'string') return {stringValue: v};
  if (Array.isArray(v)) return {arrayValue: {values: v.map(toVal_)}};
  const f = {}; Object.keys(v).forEach(k => { f[k] = toVal_(v[k]); }); return {mapValue: {fields: f}};
}
function fromVal_(v){
  if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue; if ('timestampValue' in v) return new Date(v.timestampValue); if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromVal_);
  if ('mapValue' in v) { const o = {}, f = v.mapValue.fields || {}; Object.keys(f).forEach(k => { o[k] = fromVal_(f[k]); }); return o; }
  return null;
}
const toDate = v => v instanceof Date ? v : new Date(v);
const isoDate = v => { if (!v) return ''; const d = toDate(v); return isNaN(d) ? '' : Utilities.formatDate(d, 'Europe/London', 'yyyy-MM-dd'); };
const addYear = v => { const d = toDate(v); d.setFullYear(d.getFullYear() + 1); return d; };
const round2 = x => Math.round(x * 100) / 100;
const safeId = s => String(s).replace(/[\/#?\s]/g, '-');
const mask = e => String(e).replace(/^(.).*(@.*)$/, '$1•••$2');
// A stable Pre-School code per club: club word + 4 characters from the same alphabet as the other codes (no 0/O/1/I/L)
const CODE_ABC = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function psCode(name, id){ const stop = /^(GYMNASTICS?|GYM|CLUB|THE|ACADEMY|LTD|LIMITED|CIC|AND|OF)$/;
  const word = (String(name || 'CLUB').toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(w => w && !stop.test(w))[0] || 'CLUB').slice(0, 10);
  const h = sha256('preschool:' + id); let s = ''; for (let i = 0; i < 4; i++) s += CODE_ABC[parseInt(h.substr(i * 2, 2), 16) % CODE_ABC.length];
  return word + '-' + s; }
const sha256 = s => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');

/* Run first: checks the account can read both live projects and write to staging. */
function checkAccess(){
  Logger.log('live clubs read: ' + (UrlFetchApp.fetch(base(LIVE) + '/clubs?pageSize=1', {headers: auth_(), muteHttpExceptions: true}).getResponseCode()));
  Logger.log('bookings read: ' + (UrlFetchApp.fetch(base(BOOK) + '/ngl_competitions?pageSize=1', {headers: auth_(), muteHttpExceptions: true}).getResponseCode()));
  commit(STAGING, [doc('migration/check', {at: new Date()})]); Logger.log('staging write: ok');
}
