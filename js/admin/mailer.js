// NGL Admin · Booking emails. Copied word for word from the mailer in GYMNASTICS-RESULTS/ngl-booking-system.html
// (admin mode, ?admin=1&mail=<competition id>&tpl=open|remind|waitlist|hub): the same four templates, subjects, wording,
// email layout, "Private MyBG links", "Places available", club ticks, preview, "Copy this email", "Send me a test" and Send.
// Only the shell, look and data layer change:
// - Recipients come from the app's own data (clubs must register to reserve): reservations (+ the club's email from clubs)
//   and pendingPlaces (places booked before the club registered, with the booking email). "Club Hub clubs" = the clubs collection.
// - Places available = maxPlaces minus gymnasts bought on JustGo (justgoSales/summary, the "Sync NGL sales" bookmark).
// - Sending: EmailJS, the same service and template as receipts (js/invoice.js), not the old NGL Mailer Apps Script.
//   ?demo: nothing is sent and nothing is recorded. Sandbox: every email goes ONLY to the signed-in admin, subject
//   "[SANDBOX TEST] …"; made-up test addresses (example.com etc.) are skipped. Live: each club gets its own email.
// - After a real send: competitions/{id}.mailLog.<tpl> = {at, by, n} for every competition that day, and the MyBG links
//   are saved to competitions/{id}.justgoUrl (as before). Screen: #/admin/mailer/<competition id>/<open|remind|waitlist|hub>.
import { ENV, EMAILJS } from '../config.js';
import { MODE } from '../data.js';
import adm from '../admin-data.js';
import { fb } from '../firebase.js';
import { esc } from '../ui.js';

const DEMO = MODE === 'demo';
const SEND_MODE = DEMO ? 'demo' : ENV === 'live' ? 'live' : 'sandbox';
const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const CALL_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1pa5emRK483nT6yVVO9pG6v13zlrOaVoitoINi0GNLdXv6FkVn97TjfmYGduvNPOcocQLt6F8B';
const NGL_LOGO = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/brand/ngl-logo-full.png';
// Pathway names and email accent colours (same as the booking system)
const PATHWAYS = {
  preschool: {label: 'NGL Pre-School', accent: '#E84187'}, schools: {label: 'NGL Schools', accent: '#F8D438'},
  recreational: {label: 'NGL Recreational', accent: '#E88230'}, general: {label: 'NGL General League', accent: '#0071B3'},
  performance: {label: 'NGL Performance League', accent: '#01AFB8'}, university: {label: 'NGL University League', accent: '#6AA525'},
  masters: {label: 'NGL Masters', accent: '#90276A'}
};
const TPL_NAME = { open:'Booking now open', remind:'One week to go', waitlist:'Places for the waiting list', hub:'Places for every Club Hub club' };
const TPL_WHEN = { open:'4 months before the competition (1 month before the deadline)', remind:'Reminder 1 week before the deadline',
  waitlist:'After the deadline: clubs on the waiting list', hub:'If places are left: every club with an NGL Club Hub account' };

const S = {key: null, data: null, comp: null, group: [], tpl: 'open', clubs: [], noEmail: [], links: {}, avail: {}, skip: {}, sel: 0, hubErr: '', status: {msg: '', cls: ''}, me: {email: '', name: ''}, busy: false};

/* ---------- copied helpers (booking system) ---------- */
const mEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const titleCase = s => String(s||'').toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase());
const levelOf = c => { const level = String(c.level||'').split('|').map(x => x.trim().toLowerCase()).filter(Boolean).join(', '); return level ? level.charAt(0).toUpperCase() + level.slice(1) : ''; };
function compPathway(c) {
  const p = c.path || c.pathway;
  if (p && PATHWAYS[p]) return p;
  const looksRec = ((c.name||'') + ' ' + (c.level||'')).toLowerCase().includes('rec');
  return looksRec ? 'recreational' : 'general';
}
function compParts(c){
  const name = String(c.name||'');
  // The app's calendar names ("General League · East Region", who = "Girls Levels 1–4"); the old booking-system
  // names ("EAST REGION, 6-8 YRS, …") still go through the original rules below.
  if (!name.includes(',')) {
    const after = name.includes('·') ? name.split('·').slice(1).join('·').trim() : '';
    if (compPathway(c) === 'recreational') return { age: after || c.who || name, region: 'Recreational', level: levelOf(c), rec: true };
    const region = c.region ? titleCase(c.region) : after ? after.replace(/ Region$/i,'') + (/region$/i.test(after) ? ' Region' : '') : name.replace(/^NGL\s+/i, '');
    return { age: c.who || name, region, level: levelOf(c) };
  }
  const bits = name.split(',').map(x => x.trim()).filter(Boolean);
  const ageBit = bits.find(b => /\d/.test(b) && /yrs?|years|ages?/i.test(b));
  const age = ageBit ? ageBit.replace(/YRS?/i,' yrs').replace(/(\d)-(\d)/g,'$1–$2').replace(/\s+/g,' ').replace(/AGES/i,'Ages').trim() : (c.name||'');
  const region = c.region ? titleCase(c.region) : (bits[0] ? titleCase(bits[0]) : '');
  const level = levelOf(c);
  const rec = name.match(/RECREATIONAL COMPETITION\s*[-–]\s*([^,]+)/i);
  if (rec) return { age: titleCase(rec[1]).replace(/\((\d[^)]*)\)/, (m, t) => '(' + t.toLowerCase() + ')'), region: 'Recreational', level, rec: true };
  return { age, region: region.replace(/ Region$/i,'') + (region ? ' Region' : ''), level };
}
const longDate = d => d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
const dayDate  = d => d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'});
const shortDate= d => d.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
const venueOf = c => String(c.where || c.venue || '');
const compMax = c => typeof c.maxPlaces === 'number' && !isNaN(c.maxPlaces) ? c.maxPlaces : 20;
function mailGroup(c){
  const v = venueOf(c).trim().toLowerCase();
  return S.data.cal.filter(x => x.date === c.date && venueOf(x).trim().toLowerCase() === v)
    .sort((a,b) => (a.name||'').localeCompare(b.name||'', undefined, {numeric:true}));
}

/* ---------- places available: capacity minus gymnasts bought on JustGo ---------- */
function jgMatch(e){
  const same = S.data.cal.filter(c => c.date === e.date); if (!same.length) return '';
  if (same.length === 1) return same[0].id;
  const n = (e.name||'').toUpperCase();
  const score = c => { const m = (c.name||'').toUpperCase(); let k = 0;
    if (/6-8|9-11/.test(n) && /6-8|9-11/.test(m)) k += 3; if (/12-14|15\+/.test(n) && /12-14|15\+/.test(m)) k += 3;
    const lv = n.match(/LEVEL ([ABC])/); if (lv && new RegExp('LEVEL ' + lv[1]).test(m)) k += 3;
    ['EAST','WEST','IRELAND','SOUTH','NORTH','FLOOR','VAULT','BOYS','MEN','WOMEN'].forEach(w => { if (n.includes(w) && m.includes(w)) k++; });
    return k; };
  return same.slice().sort((a,b) => score(b) - score(a))[0].id;
}
function soldFor(c){
  const J = S.data.jg; if (!J) return null;
  const evs = Object.values(J.events).filter(e => ((J.map && e.ref in J.map) ? J.map[e.ref] : jgMatch(e)) === c.id);
  return evs.length ? evs.reduce((s, e) => s + (+e.gymnasts || 0), 0) : null;
}
function availDefaults(group){
  return Object.fromEntries(group.map(c => { const sold = soldFor(c); return [c.id, sold == null ? '' : Math.max(0, compMax(c) - sold)]; }));
}

/* ---------- data ---------- */
const DEMO_JG = {syncedAt: new Date(Date.now() - 5 * 3600e3).toISOString(), map: {}, events: {
  E1: {ref: 'E1', date: '2027-02-07', name: 'NGL GENERAL LEAGUE EAST GIRLS', gymnasts: 14}}};
async function loadJustGoSales(){
  if (DEMO) return DEMO_JG;
  try { const {fs, D} = await fb(); const d = await fs.getDoc(fs.doc(D, 'justgoSales', 'summary')); const x = d.exists() ? d.data() : {};
    return { events: x.events || {}, map: x.map || {}, syncedAt: x.syncedAt || null }; }
  catch (e) { console.warn('JustGo sales not loaded', e); return { events:{}, map:{}, syncedAt:null, err:true }; }
}
async function loadData(){
  const out = {cal: [], res: [], clubs: [], pend: [], jg: null, errs: [], clubsErr: ''};
  const grab = async (k, f, label) => { try { out[k] = await f(); } catch (e) { console.warn(e); const m = `Couldn’t read ${label} (${e.code || e.message}).`; out.errs.push(m); if (k === 'clubs') out.clubsErr = m; } };
  await Promise.all([grab('cal', () => adm.calendar(), 'the competitions'), grab('res', () => adm.reservations(), 'the reservations'),
    grab('clubs', () => adm.clubs(), 'the club emails'), grab('pend', () => adm.pending(), 'the places booked before clubs registered')]);
  out.jg = await loadJustGoSales();
  return out;
}
// Every booking for the mailer: reservations (email from the club's account) and places waiting for a club (booking email)
function bookings(){
  const byId = Object.fromEntries(S.data.clubs.map(c => [c.id, c]));
  const res = S.data.res.filter(r => r.status !== 'cancelled').map(r => { const c = byId[r.clubId] || {};
    return {compId: r.compId, clubId: r.clubId || '', email: String(c.email || '').trim(), club: c.name || r.clubName || '', places: r.places, waitlist: r.status === 'waiting'}; });
  const pend = S.data.pend.filter(p => p.status !== 'cancelled').map(p =>
    ({compId: p.compId, clubId: '', email: String(p.email || '').trim(), club: p.clubName || p.email || '', places: p.places, waitlist: p.status === 'waiting', pending: true}));
  return res.concat(pend);
}
function hubClubs(){
  if (S.data.clubsErr) { S.hubErr = 'Couldn’t read the Club Hub clubs (' + S.data.clubsErr.replace(/^.*\(|\)\.$/g, '') + ').'; return []; }
  S.hubErr = '';
  return S.data.clubs.map(c => ({ id: c.id, email: String(c.email||'').trim(), club: c.name || c.email || '' }))
    .filter(c => /@/.test(c.email) && !/saadigymnastics\.co\.uk$|nationalgym/i.test(c.email));
}
function mailClubs(group, tpl){
  const ids = new Set(group.map(c => c.id)), by = {}, all = bookings(), none = new Set();
  if (tpl === 'waitlist' || tpl === 'hub') {
    const mine = all.filter(b => ids.has(b.compId) && (tpl === 'hub' || !b.waitlist));
    const skip = new Set(mine.map(b => String(b.email||'').trim().toLowerCase()).filter(Boolean)), skipId = new Set(mine.map(b => b.clubId).filter(Boolean));
    const src = tpl === 'waitlist'
      ? all.filter(b => ids.has(b.compId) && b.waitlist).map(b => ({ email: String(b.email||'').trim(), club: b.club || b.email, id: b.clubId }))
      : hubClubs();
    src.forEach(r => { const k = r.email.toLowerCase(); if (!r.email) { if (tpl === 'waitlist' && r.club) none.add(r.club); return; }
      if (skip.has(k) || (tpl === 'hub' && skipId.has(r.id))) return;
      by[k] = by[k] || { email: r.email, club: r.club, places: Object.fromEntries(group.map(c => [c.id, 'Open'])) }; });
  } else {
    all.filter(b => ids.has(b.compId) && !b.waitlist).forEach(b => {
      const e = String(b.email||'').trim(), k = e.toLowerCase(); if (!e) { if (b.club) none.add(b.club); return; }
      const r = by[k] = by[k] || {email:e, club:b.club||e, places:{}};
      r.places[b.compId] = (r.places[b.compId]||0) + (parseInt(b.places)||1);
    });
  }
  S.noEmail = [...none].sort();
  return Object.values(by).sort((a,b) => a.club.localeCompare(b.club));
}

/* ---------- the emails (word for word) ---------- */
function mailCtx(){
  const c0 = S.group[0], d = new Date(c0.date + 'T00:00:00');
  const due = new Date(d.getFullYear(), d.getMonth() - 3, d.getDate());
  const p = compParts(c0), path = PATHWAYS[compPathway(c0)] || {};
  return { d, due, region:p.region, pathway:(path.label||'NGL').toUpperCase(), accent:path.accent||'#0071B3', venue:venueOf(c0) ? titleCase(venueOf(c0)).replace(/\bSaadi\b/,'SAADI').replace(/\bNbc\b/,'NBC') : '' };
}
const BAR = `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${['#E8559A','#F8D438','#E88230','#0071B3','#01AFB8','#3BAA4A','#7A4C9E'].map(c=>`<td height="8" style="background:${c};font-size:0">&nbsp;</td>`).join('')}</tr></table></td></tr>`;
const FOOT = `<tr><td style="background:#c6152e;padding:18px 30px;font-family:Roboto,Arial,sans-serif;color:#ffffff;font-size:13px;line-height:1.5" align="center"><b style="font-size:15px">Exclusively for British Gymnastics Clubs</b><br>Official sponsor: JustGo · #ItsAllConnected<br><a href="https://www.nationalgymnasticsleague.co.uk" style="color:#ffffff">nationalgymnasticsleague.co.uk</a> · <a href="mailto:admin@nationalgymnasticsleague.co.uk" style="color:#ffffff">admin@nationalgymnasticsleague.co.uk</a></td></tr>`;
function mailBuildOpen(tpl, club){
  const x = mailCtx(), wl = tpl === 'waitlist', anyReg = x.region !== 'Recreational';
  const av = S.avail || {}, shown = S.group.filter(c => av[c.id] !== 0);
  const rows = shown.map((c,i) => { const p = compParts(c), col = i % 2 ? '#29235c' : x.accent, link = S.links[c.id] || '#', n = av[c.id];
    return `<tr><td style="padding:14px 16px;border-bottom:1px solid #e6e8f0;font:15px/1.4 Roboto,Arial,sans-serif;color:#2b3555"><b style="color:#29235c">${mEsc(p.age)}</b>${p.level?`<br><span style="color:#5d6782;font-size:14px">${mEsc(p.level)}</span>`:''}</td>
<td align="center" style="padding:14px 10px;border-bottom:1px solid #e6e8f0;font:15px/1.2 Roboto,Arial,sans-serif;color:#5d6782;white-space:nowrap">${n === '' || n == null ? '' : `<b style="display:block;font:900 24px Roboto,Arial,sans-serif;color:${col}">${n}</b>place${n===1?'':'s'} left`}</td>
<td align="right" style="padding:14px 16px;border-bottom:1px solid #e6e8f0"><a href="${mEsc(link)}" target="_blank" style="display:inline-block;background:${col};color:#ffffff;text-decoration:none;font:bold 14px Roboto,Arial,sans-serif;padding:10px 16px;border-radius:999px;white-space:nowrap">Book on MyBG</a></td></tr>`; }).join('');
  const subject = wl ? `Places available: NGL ${x.region}, ${shortDate(x.d)} (you're on the waiting list)` : anyReg ? `Places available: NGL competition, ${shortDate(x.d)} · open to clubs from every region` : `Places available: NGL ${x.region} competition, ${shortDate(x.d)}`;
  const h1 = wl ? 'Good news: places are available' : 'Places available to book now';
  const intro = wl
    ? `You're on the waiting list for our ${mEsc(x.region)} competition on ${dayDate(x.d)}, and places have now become available. You're among the first to hear: book on the British Gymnastics MyBG (JustGo) site using the links below.`
    : anyReg
      ? `We have places available at our competition on ${dayDate(x.d)}${x.venue?` at ${mEsc(x.venue)}`:''} (${mEsc(x.region)}), and as a club with an NGL Club Hub account you're hearing about them first. Book on the British Gymnastics MyBG (JustGo) site using the links below.`
      : `We have places available at our ${mEsc(x.region)} competition on ${dayDate(x.d)}, and as a club with an NGL Club Hub account you're hearing about them first. Book on the British Gymnastics MyBG (JustGo) site using the links below.`;
  const regionBox = anyReg ? `<div style="background:#fff6e0;border-left:5px solid #F8D438;border-radius:6px;padding:14px 16px;margin:0 0 18px"><b style="color:#29235c">Open to clubs from every region.</b> "${mEsc(x.region)}" is just where the competition is held. Any British Gymnastics club can enter any NGL competition, wherever you're based, and every score counts towards the same national league tables.</div>` : '';
  const box = `<b style="color:#29235c">First come, first served.</b> Places go to the clubs that book first, so book as soon as you can.`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${mEsc(h1)}</title></head>
<body style="margin:0;padding:0;background:#e9ebf2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9ebf2"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
${BAR}
<tr><td style="padding:30px 36px 6px;font-family:Roboto,Arial,Helvetica,sans-serif;color:#2b3555;font-size:16px;line-height:1.6">
<img src="${NGL_LOGO}" width="150" alt="NGL" style="display:block;width:150px;height:auto;border:0;margin:0 0 18px">
<div style="font-size:12px;font-weight:bold;letter-spacing:3px;color:${x.accent}">${mEsc(x.pathway)}${x.region === 'Recreational' ? '' : ' · ' + mEsc(x.region.toUpperCase())}</div>
<h1 style="margin:8px 0 6px;font-size:27px;line-height:1.15;font-weight:900;color:#29235c">${mEsc(h1)}</h1>
<p style="margin:0 0 18px;font-size:15px;color:#5d6782">Competition: ${longDate(x.d)}${x.venue?` at ${mEsc(x.venue)}`:''}</p>
<p style="margin:0 0 14px">Hello ${mEsc(club.club)},</p>
<p style="margin:0 0 18px">${intro}</p>
${regionBox}
<div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#29235c;margin:0 0 6px">PLACES AVAILABLE</div>
</td></tr>
<tr><td style="padding:0 36px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e8f0;border-radius:10px;border-collapse:separate;overflow:hidden">${rows}</table></td></tr>
<tr><td style="padding:22px 36px 8px;font-family:Roboto,Arial,Helvetica,sans-serif;color:#2b3555;font-size:16px;line-height:1.6">
<div style="background:#eaf4fb;border-left:5px solid ${x.accent};border-radius:6px;padding:14px 16px;margin:0 0 14px">${box}</div>
<p style="margin:0 0 22px">Any questions, just reply to this email or <a href="${CALL_URL}" style="color:#c6152e;font-weight:bold">book a quick call with Dave</a> on a Tuesday morning.</p>
<p style="margin:0">Best wishes,</p>
<p style="margin:2px 0 26px"><b style="color:#29235c">The National Gymnastics League</b></p>
</td></tr>
${FOOT}
<tr><td style="padding:14px 30px 18px;font:11px/1.5 Roboto,Arial,sans-serif;color:#8a91ad" align="center">You're receiving this because ${wl ? 'your club joined the waiting list for an NGL competition' : 'your club has an NGL Club Hub account'}.<br>SAADI Gymnastics trading as National Gymnastics League, 66 Waveney Road, Harpenden, Herts AL5 4QZ.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Hello ${club.club},\n\n${intro.replace(/<[^>]+>/g,'')}\n\n` + (anyReg ? `Open to clubs from every region: ${x.region} is just where the competition is held. Any British Gymnastics club can enter any NGL competition, wherever you're based.\n\n` : '') + shown.map(c => `- ${compParts(c).age}${av[c.id]===''||av[c.id]==null?'':`: ${av[c.id]} place${av[c.id]===1?'':'s'} left`}. Book here: ${S.links[c.id]||''}`).join('\n') +
    `\n\nFirst come, first served: places go to the clubs that book first.\n\nBest wishes,\nThe National Gymnastics League`;
  return { subject, html, text };
}
function mailBuild(tpl, club){
  if (tpl === 'waitlist' || tpl === 'hub') return mailBuildOpen(tpl, club);
  const x = mailCtx(), open = tpl === 'open';
  const recDay = S.group.some(c => compParts(c).rec);
  const rows = S.group.filter(c => recDay || club.places[c.id]).map((c,i) => { const p = compParts(c), col = i % 2 ? '#29235c' : x.accent, link = S.links[c.id] || '#';
    return `<tr><td style="padding:14px 16px;border-bottom:1px solid #e6e8f0;font:15px/1.4 Roboto,Arial,sans-serif;color:#2b3555"><b style="color:#29235c">${mEsc(p.age)}</b>${p.level?`<br><span style="color:#5d6782;font-size:14px">${mEsc(p.level)}</span>`:''}</td>
<td align="center" style="padding:14px 10px;border-bottom:1px solid #e6e8f0;font:900 24px Roboto,Arial,sans-serif;color:${col}">${recDay ? '' : club.places[c.id]}</td>
<td align="right" style="padding:14px 16px;border-bottom:1px solid #e6e8f0"><a href="${mEsc(link)}" target="_blank" style="display:inline-block;background:${col};color:#ffffff;text-decoration:none;font:bold 14px Roboto,Arial,sans-serif;padding:10px 16px;border-radius:999px;white-space:nowrap">${open?'Book on MyBG':'Confirm on MyBG'}</a></td></tr>`; }).join('');
  const subject = open ? `Booking now open: NGL ${x.region}, ${shortDate(x.d)}` : `1 week to go: confirm your places by ${dayDate(x.due)} (NGL ${x.region}, ${shortDate(x.d)})`;
  const h1 = open ? 'Your places are ready to book' : `Confirm your places by ${dayDate(x.due)}`;
  const intro = open
    ? `Thank you for reserving places at our ${mEsc(x.region)} competition on ${dayDate(x.d)}. Booking is now open on the British Gymnastics MyBG (JustGo) site, exclusively for clubs with reservations.`
    : `Thank you for reserving places at our ${mEsc(x.region)} competition on ${dayDate(x.d)}. There's one week left to confirm and pay for your places on the MyBG (JustGo) site. If you've already booked, thank you: there's nothing more to do.`;
  const box = open
    ? `<b style="color:#29235c">Please book by ${longDate(x.due)},</b> 3 months before the competition.`
    : `<b style="color:#29235c">Deadline: ${longDate(x.due)}.</b> If you'd like to enter, please confirm your places on MyBG before then.`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${mEsc(h1)}</title></head>
<body style="margin:0;padding:0;background:#e9ebf2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9ebf2"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:10px;overflow:hidden">
${BAR}
<tr><td style="padding:30px 36px 6px;font-family:Roboto,Arial,Helvetica,sans-serif;color:#2b3555;font-size:16px;line-height:1.6">
<img src="${NGL_LOGO}" width="150" alt="NGL" style="display:block;width:150px;height:auto;border:0;margin:0 0 18px">
<div style="font-size:12px;font-weight:bold;letter-spacing:3px;color:${x.accent}">${mEsc(x.pathway)}${x.region === 'Recreational' ? '' : ' · ' + mEsc(x.region.toUpperCase())}</div>
<h1 style="margin:8px 0 6px;font-size:27px;line-height:1.15;font-weight:900;color:#29235c">${mEsc(h1)}</h1>
<p style="margin:0 0 18px;font-size:15px;color:#5d6782">Competition: ${longDate(x.d)}${x.venue?` at ${mEsc(x.venue)}`:''}</p>
<p style="margin:0 0 14px">Hello ${mEsc(club.club)},</p>
<p style="margin:0 0 18px">${intro}</p>
${recDay ? (() => { const tot = S.group.reduce((a, c) => a + (club.places[c.id]||0), 0); return `<p style="margin:0 0 14px">You reserved <b style="color:#29235c">${tot} place${tot===1?'':'s'}</b> for the day. Book each gymnast into the session for their level:</p><div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#29235c;margin:0 0 6px">THE TWO SESSIONS</div>`; })() : '<div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#29235c;margin:0 0 6px">YOUR RESERVED PLACES</div>'}
</td></tr>
<tr><td style="padding:0 36px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e8f0;border-radius:10px;border-collapse:separate;overflow:hidden">${rows}</table></td></tr>
<tr><td style="padding:22px 36px 8px;font-family:Roboto,Arial,Helvetica,sans-serif;color:#2b3555;font-size:16px;line-height:1.6">
<div style="background:#eaf4fb;border-left:5px solid ${x.accent};border-radius:6px;padding:14px 16px;margin:0 0 14px">${box}</div>
<p style="margin:0 0 14px"><b style="color:#29235c">There's absolutely no obligation</b> to take the places you've reserved. If your numbers have changed, you can book fewer places, or simply leave them.</p>
<p style="margin:0 0 14px">After the deadline, any places that haven't been booked will be offered to clubs on the waiting list and then go on general sale.</p>
<p style="margin:0 0 22px">Any questions, just reply to this email or <a href="${CALL_URL}" style="color:#c6152e;font-weight:bold">book a quick call with Dave</a> on a Tuesday morning.</p>
<p style="margin:0">Best wishes,</p>
<p style="margin:2px 0 26px"><b style="color:#29235c">The National Gymnastics League</b></p>
</td></tr>
${FOOT}
<tr><td style="padding:14px 30px 18px;font:11px/1.5 Roboto,Arial,sans-serif;color:#8a91ad" align="center">You're receiving this because your club reserved places at an NGL competition.<br>SAADI Gymnastics trading as National Gymnastics League, 66 Waveney Road, Harpenden, Herts AL5 4QZ.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `Hello ${club.club},\n\n${intro.replace(/<[^>]+>/g,'')}\n\nYour reserved places:\n` +
    (recDay ? `You reserved ${S.group.reduce((a, c) => a + (club.places[c.id]||0), 0)} places for the day. Book each gymnast into the session for their level:\n` : '') +
    S.group.filter(c => recDay || club.places[c.id]).map(c => recDay ? `- ${compParts(c).age}. Book here: ${S.links[c.id]||''}` : `- ${compParts(c).age}: ${club.places[c.id]} places. Book here: ${S.links[c.id]||''}`).join('\n') +
    `\n\n${box.replace(/<[^>]+>/g,'')}\n\nThere's absolutely no obligation to take the places you've reserved. After the deadline, any places that haven't been booked will be offered to clubs on the waiting list and then go on general sale.\n\nBest wishes,\nThe National Gymnastics League`;
  return { subject, html, text };
}
function mailDefaultTpl(){
  const d = new Date(S.group[0].date + 'T00:00:00'), due = new Date(d.getFullYear(), d.getMonth() - 3, d.getDate());
  return (due - new Date()) / 864e5 <= 14 ? 'remind' : 'open';
}

/* ---------- sending (EmailJS) ----------
   plan(): who each email really goes to. demo = nobody; sandbox = only the signed-in admin, "[SANDBOX TEST] " in front;
   live = each club. A test goes to the signed-in admin with "[TEST] " (as before). deliver(): one EmailJS request per email,
   skipping made-up test addresses so nothing bounces. */
const TEST_ADDR = /@example\.(com|org|net)$/i;
export function plan(mode, me, msgs, test = false){
  if (mode === 'demo') return [];
  if ((test || mode === 'sandbox') && !me) throw new Error('Please sign in to NGL Admin again.');
  const pre = mode === 'sandbox' ? '[SANDBOX TEST] ' : '';
  return msgs.map(m => ({to: test || mode === 'sandbox' ? me : m.to, forClub: m.to, toName: m.club || '', subject: pre + (test ? '[TEST] ' : '') + m.subject, html: m.html}));
}
export async function deliver(list){
  const out = [];
  for (const m of list) {
    if (!m.to || TEST_ADDR.test(m.to)) { out.push({to: m.forClub || m.to, ok: false, skipped: true}); continue; }
    try {
      const r = await fetch(EMAILJS_URL, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({service_id: EMAILJS.serviceId, template_id: EMAILJS.templateId, user_id: EMAILJS.publicKey,
          template_params: {to_email: m.to, to_name: m.toName, subject: m.subject, invoice_html: m.html}})});
      out.push({to: m.forClub || m.to, ok: r.ok, error: r.ok ? '' : 'Email failed (' + r.status + ')'});
    } catch (e) { out.push({to: m.forClub || m.to, ok: false, error: e.message}); }
  }
  return out;
}
// Saved on the competition (as before): the MyBG links, and which email went when, by whom, to how many clubs
async function saveComp(c, patch){
  if (DEMO) { Object.assign(c, patch); return; }
  try { const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, 'competitions', c.id), patch); }
  catch (e) { console.warn('Not saved on the competition', e); }
}
async function mailSaveLinks(){
  for (const c of S.group) { const l = S.links[c.id] || '';
    if (l && l !== (c.justgoUrl || '')) { await saveComp(c, {justgoUrl: l}); c.justgoUrl = l; } }
}

/* ---------- screen ---------- */
const avMode = () => S.tpl === 'waitlist' || S.tpl === 'hub';
const onList = () => S.clubs.filter(r => !S.skip[r.email.toLowerCase()]);
const fmtLog = log => `This email was already sent on ${mEsc(new Date(log.at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}))} by ${mEsc(log.by||'')} to ${log.n} club${log.n===1?'':'s'}.`;
function previewDoc(){
  if (!S.clubs.length) return '';
  const r = S.clubs[S.sel] || S.clubs[0], m = mailBuild(S.tpl, r);
  return `<div style="font:13px Arial;padding:8px 12px;background:#fff;border-bottom:1px solid #ddd"><b>To:</b> ${mEsc(r.email)}<br><b>Subject:</b> ${mEsc(m.subject)}</div>` + m.html;
}
const sendLabel = () => { const n = onList().length; return `Send to ${n} club${n===1?'':'s'}`; };
const modeNote = () => SEND_MODE === 'demo'
  ? '<div class="card ml-mode"><b>Sample data: nothing is sent.</b> “Send me a test” and Send check everything as usual, but no email goes out and nothing is recorded.</div>'
  : SEND_MODE === 'sandbox'
    ? `<div class="card ml-mode"><b>Sandbox: every email goes only to you${S.me.email ? ` (${esc(S.me.email)})` : ''}</b>, with “[SANDBOX TEST]” at the start of the subject. No club is emailed.</div>`
    : '';

function infoHTML(){
  const x = mailCtx(), log = (S.group[0].mailLog || {})[S.tpl];
  return `<b>${mEsc(longDate(x.d))}</b>${x.venue?` at ${mEsc(x.venue)}`:''} · ${S.group.length} competition${S.group.length===1?'':'s'} that day<br>Booking deadline: <b>${mEsc(longDate(x.due))}</b> (3 months before)` +
    (log ? `<br><span class="warn">${fmtLog(log)}</span>` : '');
}
function linksHTML(){
  const J = S.data.jg, av = avMode();
  const syncTxt = J && J.syncedAt ? 'JustGo sales last synced ' + new Date(J.syncedAt).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : 'JustGo sales haven’t been synced';
  return (av ? `<p class="ml-avnote"><b>Places available</b> = capacity minus places bought on JustGo (${mEsc(syncTxt)}). Sync in NGL Finance first for up-to-date numbers, or type the number. A competition with 0 places is left out of the email.</p>` : '') +
    S.group.map(c => `<div class="ml-link${av?' ml-av':''}"><label for="mml-${esc(c.id)}"><b>${mEsc(compParts(c).age)}</b></label><input type="url" id="mml-${esc(c.id)}" data-lk="${esc(c.id)}" class="${S.links[c.id]?'':'miss'}" placeholder="https://mybg.british-gymnastics.org/..." value="${mEsc(S.links[c.id])}">` +
    (av ? `<span class="ml-avn"><input type="number" min="0" data-av="${esc(c.id)}" class="${S.avail[c.id]===''?'miss':''}" value="${S.avail[c.id]}" title="Places available (capacity ${compMax(c)})" aria-label="Places available: ${mEsc(compParts(c).age)}"> places</span>` : '') + `</div>`).join('');
}
function clubsHTML(){
  const none = S.noEmail.length ? `<p class="ml-none">Not emailed (no email on record): ${S.noEmail.map(mEsc).join(', ')}. Attach them to a registered club in Competitions → Places waiting for a club.</p>` : '';
  return (S.clubs.length ? `<div class="ml-tablewrap"><table class="ml-clubs"><tr><th></th><th>Club</th><th>Email</th>${S.group.map(c => `<th class="n">${mEsc(compParts(c).age)}</th>`).join('')}</tr>` +
    S.clubs.map(r => `<tr><td><input type="checkbox" data-cl="${mEsc(r.email.toLowerCase())}" aria-label="Email ${mEsc(r.club)}" ${S.skip[r.email.toLowerCase()]?'':'checked'}></td><td>${mEsc(r.club)}</td><td>${mEsc(r.email)}</td>${S.group.map(c => `<td class="n">${r.places[c.id]||'–'}</td>`).join('')}</tr>`).join('') + '</table></div>'
    : '<p class="ml-empty">' + (S.tpl === 'waitlist' ? 'There is no waiting list for these competitions. Go to email 4 to offer the places to every Club Hub club.' : S.tpl === 'hub' ? (S.hubErr || 'No Club Hub clubs to email (every club has already booked).') : 'No clubs have reserved places at these competitions yet.') + '</p>') + none;
}
function view(){
  const base = '#/admin/mailer/' + encodeURIComponent(S.comp.id) + '/';
  return `<div class="ml-root" id="mlRoot">
  <p class="lead">Email clubs: booking on MyBG</p>
  ${modeNote()}${S.data.errs.length ? `<div class="card attn ml-err">${S.data.errs.map(esc).join('<br>')}</div>` : ''}
  <label class="field ml-pick"><span>Competition</span><select data-go="#/admin/mailer/">${S.data.cal.map(x => `<option value="${esc(x.id)}" ${x.id === S.comp.id ? 'selected' : ''}>${esc(shortDate(new Date(x.date + 'T00:00:00')))} · ${esc(x.name)}${x.who ? ' · ' + esc(x.who) : ''}</option>`).join('')}</select></label>
  <div class="card">
    <nav class="ml-tpls" aria-label="Which email">${Object.keys(TPL_NAME).map((k, i) => `<a href="${base}${k}" data-tpl="${k}" class="${k === S.tpl ? 'on' : ''}" ${k === S.tpl ? 'aria-current="page"' : ''}><b>${i + 1}. ${TPL_NAME[k]}</b><span>${TPL_WHEN[k]}</span></a>`).join('')}</nav>
    <div id="mlInfo" class="ml-info">${infoHTML()}</div>
    <div class="ml-sec">Private MyBG links <small>Paste the link for each competition from MyBG. It's saved, so you only do this once.</small></div>
    <div id="mlLinks">${linksHTML()}</div>
    <div class="ml-sec">Clubs <small>Each club gets its own email showing only its places. Untick any club you don't want to email.</small></div>
    <div id="mlClubs">${clubsHTML()}</div>
    <div class="ml-sec"><label for="mlPrev">Preview</label> <select id="mlPrev">${S.clubs.map((r,i) => `<option value="${i}" ${i === S.sel ? 'selected' : ''}>${mEsc(r.club)}</option>`).join('')}</select></div>
    <iframe id="mlFrame" class="ml-frame" title="Email preview" srcdoc="${esc(previewDoc())}"></iframe>
    <p id="mlStatus" class="ml-status ${S.status.cls}" role="status">${esc(S.status.msg)}</p>
    <div class="btn-row ml-acts">
      <button class="btn ghost" data-act="ml-copy" title="Copies the club shown in the preview, ready to paste into a new Gmail message">Copy this email</button>
      <button class="btn ghost" data-act="ml-test">Send me a test</button>
      <button class="btn" data-act="ml-send" id="mlSend" ${onList().length && !S.busy ? '' : 'disabled'}>${sendLabel()}</button>
    </div>
  </div></div>`;
}

function say(msg, cls){ S.status = {msg, cls: cls || ''}; const s = document.getElementById('mlStatus'); if (s) { s.textContent = msg; s.className = 'ml-status ' + (cls||''); } }
function refreshPreview(){ const f = document.getElementById('mlFrame'); if (f) f.srcdoc = previewDoc(); }
function refreshButtons(){ const b = document.getElementById('mlSend'); if (b) { b.textContent = sendLabel(); b.disabled = !onList().length || S.busy; } }

async function send(test){
  if (!S.comp || S.busy) return;
  const list = onList();
  if (!list.length) return say('No clubs selected.', 'err');
  const av = avMode();
  if (av && S.group.every(c => S.avail[c.id] === 0)) return say('Every competition shows 0 places available, so there is nothing to offer.', 'err');
  if (av && !test && S.group.some(c => S.avail[c.id] === '') && !confirm('Some competitions have no "places available" number, so the email won’t show one for them. Send anyway?')) return;
  const recDay = S.group.some(c => compParts(c).rec);
  const missing = S.group.filter(c => (recDay || av || list.some(r => r.places[c.id])) && !S.links[c.id] && (!av || S.avail[c.id] !== 0));
  if (missing.length) return say('Paste the MyBG link for: ' + missing.map(c => compParts(c).age).join(', '), 'err');
  await mailSaveLinks();
  const me = S.me.email || '';
  if (test) {
    const r = S.clubs[S.sel] || S.clubs[0], m = mailBuild(S.tpl, r);
    if (SEND_MODE === 'demo') return say(`Sample data: no test was sent. For real, it goes to ${me}.`, 'ok');
    say('Sending a test to ' + me + '…');
    try { const [res] = await deliver(plan(SEND_MODE, me, [{to: r.email, club: r.club, ...m}], true));
      if (res.skipped) say(`Not sent: ${me} is a test address.`, 'err');
      else if (!res.ok) say(res.error, 'err');
      else say('Test sent to ' + me + '. Check the inbox, then press Send.', 'ok'); }
    catch (e) { say(e.message, 'err'); }
    return;
  }
  const log = (S.group[0].mailLog || {})[S.tpl];
  if (!confirm((log ? 'This email was already sent once. ' : '') + 'Send the "' + TPL_NAME[S.tpl] + '" email to ' + list.length + ' club' + (list.length===1?'':'s') + ' now?')) return;
  if (SEND_MODE === 'demo') return say(`Sample data: nothing was sent and nothing was recorded. For real, each of the ${list.length} club${list.length===1?'':'s'} gets its own email.`, 'ok');
  S.busy = true; refreshButtons(); say('Sending…');
  try {
    const sent = await deliver(plan(SEND_MODE, me, list.map(r => ({to: r.email, club: r.club, ...mailBuild(S.tpl, r)})), false));
    const ok = sent.filter(s => s.ok).length, bad = sent.filter(s => !s.ok && !s.skipped), skipped = sent.filter(s => s.skipped);
    const entry = Object.assign({ at: Date.now(), by: S.me.name || me, n: ok }, SEND_MODE === 'sandbox' ? {sandbox: true} : {});
    for (const c of S.group) { await saveComp(c, { ['mailLog.' + S.tpl]: entry }); c.mailLog = Object.assign({}, c.mailLog, { [S.tpl]: entry }); }
    const info = document.getElementById('mlInfo'); if (info) info.innerHTML = infoHTML();
    const tail = (bad.length ? ' Not sent: ' + bad.map(b => b.to).join(', ') : '') + (skipped.length ? ' Skipped (test addresses): ' + skipped.map(b => b.to).join(', ') : '');
    say((SEND_MODE === 'sandbox' ? `Sandbox: sent ${ok} email${ok===1?'':'s'} to you (${me}) only. No club was emailed.` : 'Sent to ' + ok + ' club' + (ok===1?'':'s') + ' from admin@nationalgymnasticsleague.co.uk.') + tail, bad.length ? 'err' : 'ok');
  } catch (e) { say(e.message, 'err'); }
  S.busy = false; refreshButtons();
}

/* Buttons (data-act="ml-…"): the app shell sends clicks here */
export const ML = {
  'ml-send'(){ send(false); },
  'ml-test'(){ send(true); },
  async 'ml-copy'(){
    if (!S.comp || !S.clubs.length) return;
    await mailSaveLinks();
    const r = S.clubs[S.sel] || S.clubs[0], m = mailBuild(S.tpl, r);
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([m.html], {type:'text/html'}), 'text/plain': new Blob([m.text], {type:'text/plain'}) })]);
      say('Copied the email for ' + r.club + '. Open a new Gmail message to ' + r.email + ', subject "' + m.subject + '", and paste.', 'ok'); }
    catch (e) { say('Your browser blocked copying. Use Send instead.', 'err'); }
  }
};

// Typing a MyBG link or a places number updates the preview straight away (no redraw, so the cursor stays put)
document.addEventListener('input', e => {
  const i = e.target; if (!(i.closest && i.closest('#mlRoot'))) return;
  if (i.dataset.lk) { S.links[i.dataset.lk] = i.value.trim(); i.classList.toggle('miss', !i.value.trim()); refreshPreview(); }
  else if (i.dataset.av) { S.avail[i.dataset.av] = i.value === '' ? '' : Math.max(0, parseInt(i.value) || 0); i.classList.toggle('miss', i.value === ''); refreshPreview(); }
});
document.addEventListener('change', e => {
  const i = e.target; if (!(i.closest && i.closest('#mlRoot'))) return;
  if (i.dataset.cl) { S.skip[i.dataset.cl] = !i.checked; refreshButtons(); }
  else if (i.id === 'mlPrev') { S.sel = +i.value || 0; refreshPreview(); }
});

/* The screen: #/admin/mailer/<competition id>/<open|remind|waitlist|hub> (from Competitions and Competition planning) */
export default async function mailer(me = {}, parts = []){
  S.me = {email: (me && me.email) || '', name: (me && me.name) || ''};
  const [compId = '', tpl = ''] = (parts || []).map(p => decodeURIComponent(p || ''));
  const key = compId + '|' + tpl;
  if (!S.data || key !== S.key) {
    if (!S.data || compId !== (S.comp && S.comp.id)) S.data = await loadData();
    const c = S.data.cal.find(x => x.id === compId) || null;
    if (!c) {
      S.key = null;
      return `<div class="ml-root" id="mlRoot"><p class="lead">Email clubs: booking on MyBG</p>${S.data.errs.length ? `<div class="card attn ml-err">${S.data.errs.map(esc).join('<br>')}</div>` : ''}
        <div class="card">${compId ? '<p class="empty" style="margin-top:0">Competition not found. Choose one:</p>' : ''}<label class="field ml-pick" style="margin-top:0"><span>Competition</span><select data-go="#/admin/mailer/"><option value="">Choose a competition…</option>${S.data.cal.map(x => `<option value="${esc(x.id)}">${esc(shortDate(new Date(x.date + 'T00:00:00')))} · ${esc(x.name)}${x.who ? ' · ' + esc(x.who) : ''}</option>`).join('')}</select></label></div></div>`;
    }
    const sameComp = S.comp && S.comp.id === c.id;
    S.comp = c; S.group = mailGroup(c);
    if (!sameComp) { S.links = Object.fromEntries(S.group.map(g => [g.id, /^https:\/\//.test(g.justgoUrl || '') ? g.justgoUrl : ''])); S.avail = availDefaults(S.group); }
    S.tpl = TPL_NAME[tpl] ? tpl : mailDefaultTpl();
    S.clubs = mailClubs(S.group, S.tpl); S.skip = {}; S.sel = 0; S.status = {msg: '', cls: ''};
    S.key = key;
  }
  return view();
}
