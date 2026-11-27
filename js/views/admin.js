// NGL Admin: for Dave and Christine. Clubs, licences, orders to post, the competition
// calendar and reservations, and floor music entries. Shown only to verified NGL admins.
import adm, { nameKey } from '../admin-data.js';
import { GROUPS, APPS, SCREENS, can, canApp } from '../admin-apps.js';
import { APPACTS } from '../admin-registry.js';
import { PATHWAYS } from '../config.js';
import { esc, gbp, date, dot, pill, tabs, head, path } from '../ui.js';

const SUB = [['', 'Overview'], ['clubs', 'Clubs'], ['orders', 'Orders'], ['competitions', 'Competitions'], ['music', 'Floor music'], ['team', 'Team']];
const allowed = (me, k) => k === '' || (k === 'team' ? !!me.owner : can(me, SCREENS[k]));
const NO_ACCESS = '<div class="card empty">You don’t have access to this area. Ask Dave to tick it for you in NGL Admin → Team.</div>';
const on = L => L && ['live', 'waived'].includes(L.status);
const statusPill = o => o.status === 'sent' ? pill('Posted', 'ok') : o.status === 'paid' ? pill('Paid · to post', 'warn') : o.status === 'on-hold' ? pill('On hold · price check failed', 'red') : pill('Not paid', 'red');

export default async function admin(parts = [], ctx = {}){
  const [sub = '', id] = parts;
  const me = ctx.admin;
  if (!me) return head('NGL Admin') + (ctx.needsVerify && ctx.staffOnly   // an invited NGL team login that hasn't confirmed its email yet
    ? `<div class="card attn"><div class="row" style="border:0"><div class="grow"><b>Confirm your email to open NGL Admin</b><small>We’ll email you a link. Click it, then log out and in again.</small></div><button class="btn sm" data-act="verify">Send link</button></div></div>`
    : `<div class="card adm-gate"><h2 style="margin:0 0 6px">This is for NGL admin staff only</h2>
      <p class="lead" style="margin:0 0 12px">Log in with your own NGL admin email and password. ${ctx.staffOnly ? '' : 'This logs your club out on this device; log back in as your club afterwards.'}</p>
      <form id="admGate" autocomplete="on"><label class="field"><span>NGL admin email</span><input id="agEmail" type="email" autocomplete="username" required></label>
      <label class="field"><span>Password</span><input id="agPw" type="password" autocomplete="current-password" required></label>
      <p class="err" id="agErr"></p><div class="btn-row"><button class="btn">Log in to NGL Admin</button><a class="btn ghost" href="#/home">Back to the Club Hub</a></div></form>
      <p style="font-size:13px;color:var(--muted);margin:12px 0 0">Not NGL staff? This area is for admins only. Your club’s own tools are all in the menu.</p></div>`);
  if (sub === 'app') return appFrame(id, me);
  if (MODS[sub] !== undefined) return appModule(sub, me, parts.slice(1));
  const known = SUB.some(s => s[0] === sub) ? sub : '';
  const body = !allowed(me, known) ? NO_ACCESS : known === '' ? await overview(me) : await ({clubs, orders, competitions, music, team}[known])(id);
  return head('NGL Admin', me.owner ? 'Run the league: every NGL admin app in one place.' : `Hello${me.name ? ' ' + esc(me.name) : ''}. These are the apps Dave has given you.`)
    + tabs(SUB.filter(s => allowed(me, s[0])), known, '#/admin') + body;
}

// All admin apps on one board: same groups, colours and icons as the original Admin Hub; each person sees the apps ticked for them
function board(me){
  return GROUPS.map(g => { const list = APPS.filter(a => a.group === g.id && canApp(me, a)); if (!list.length) return '';
    return `<section class="appgrp" style="--c:${g.colour}"><h3><i></i>${esc(g.name)}</h3><div class="appgrid">${list.map(a => `<a class="card appt" href="${a.to || '#/admin/app/' + a.id}">
      <span class="ic" style="background:${a.colour || g.colour}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${a.icon}</svg></span>
      <span class="grow"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${a.to ? '' : '<em class="livetag">Live tool</em>'}</span></a>`).join('')}</div></section>`; }).join('')
    || '<div class="card empty">No apps ticked for you yet. Ask Dave to give you access in NGL Admin → Team.</div>';
}

// Rebuilt admin apps, each in its own file (js/admin/<id>.js), loaded the first time it's opened. true = has its own stylesheet.
// value = the app's stylesheet (css/admin-<name>.css), '' = none
const MODS = {sales: '', finance: 'finance', planning: 'planning', staffing: 'staffing', music: 'music', musicplayer: 'music', results: 'results', judging: 'judging', powerleague: 'powerleague', 'gl-hub': 'glhub', rotation: 'rotation', groupbuy: 'groupbuy', email: 'email', projection: 'projection', mailer: 'mailer'};
async function appModule(sub, me, rest){
  // Booking emails has no tile of its own: it opens from Competitions and Competition planning (Competitions or Competition planning ticks)
  const a = sub === 'mailer' ? {id: 'competitions', access: 'planning', name: 'Booking emails'} : APPS.find(x => x.id === sub);
  if (!canApp(me, a)) return head('NGL Admin') + NO_ACCESS;
  const css = MODS[sub];
  if (css && !document.querySelector(`link[data-admin-css="${css}"]`)) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `css/admin-${css}.css`; l.dataset.adminCss = css; document.head.appendChild(l); }
  const bar = `<div class="appbar"><a class="btn sm ghost" href="#/admin">← All apps</a><h1 style="margin:0;font-size:22px" class="grow">NGL Admin · ${esc(a.name)}</h1></div>`;
  let mod; try { mod = await import(`../admin/${sub}.js`); } catch (e) { console.error(e); return bar + '<div class="card empty">This app couldn’t load. Please refresh the page.</div>'; }
  for (const [k, v] of Object.entries(mod)) if (k !== 'default' && v && typeof v === 'object' && !Array.isArray(v)) Object.assign(APPACTS, v);
  return bar + await mod.default(me, rest);
}

// An existing tool, opened inside the app (same as the original Admin Hub viewer)
function appFrame(id, me){
  const a = APPS.find(x => x.id === id);
  if (!a || a.to) return head('NGL Admin') + '<div class="card empty">App not found. <a href="#/admin">All apps</a></div>';
  if (!canApp(me, a)) return head('NGL Admin') + NO_ACCESS;
  const src = a.url + (a.url.includes('?') ? '&' : '?') + 'v=' + Date.now();
  return `<div class="appbar"><a class="btn sm ghost" href="#/admin">← All apps</a><h1 style="margin:0;font-size:22px" class="grow">NGL Admin · ${esc(a.name)}</h1><span class="livetag">Live tool · real data</span><a class="btn sm ghost" href="${esc(a.url)}" target="_blank" rel="noopener">Open in new tab ↗</a></div>
  <iframe class="appframe" title="${esc(a.name)}" src="${esc(src)}" allow="fullscreen; screen-wake-lock; autoplay; clipboard-write" allowfullscreen></iframe>`;
}

async function overview(me){
  const cC = can(me, SCREENS.clubs), cO = can(me, SCREENS.orders), cR = can(me, SCREENS.competitions);
  const [cl, ord, res] = await Promise.all([cC ? adm.clubs() : [], cO ? adm.orders() : [], cR ? adm.reservations() : []]);
  const week = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const toPost = ord.filter(o => o.status === 'paid'), paid = ord.filter(o => ['paid', 'sent'].includes(o.status));
  const yearStart = new Date().getFullYear() + '-01-01';
  const stats = [
    cC && `<a class="card stat" href="#/admin/clubs"><b>${cl.length}</b><span>Clubs · ${cl.filter(c => c.createdAt >= week).length} new this week</span></a>`,
    cO && `<a class="card stat" href="#/admin/orders"><b>${toPost.length}</b><span>Orders to post</span></a>`,
    cO && `<a class="card stat" href="#/admin/orders"><b>${gbp(paid.filter(o => o.date >= yearStart).reduce((a, o) => a + o.total, 0))}</b><span>Taken this year (paid orders)</span></a>`,
    cR && `<a class="card stat" href="#/admin/competitions"><b>${res.filter(r => r.status === 'reserved').reduce((a, r) => a + r.places, 0)}</b><span>Places reserved</span></a>`
  ].filter(Boolean);
  const lower = [
    cO && `<div class="card attn"><h2>To do</h2>
    ${toPost.length ? toPost.slice(0, 6).map(o => `<div class="row"><div class="grow"><b>Post ${esc(o.id)}</b><small>${esc(o.clubName)} · ${esc(o.details)}</small></div><button class="btn sm" data-act="adm-sent" data-order="${esc(o.id)}">Mark posted</button></div>`).join('')
      : '<p class="empty">Nothing to post. Paid orders appear here automatically.</p>'}</div>`,
    cC && `<div class="card"><h2>Newest clubs</h2>${cl.slice(0, 6).map(c => `<a class="row" href="#/admin/clubs/${esc(c.id)}"><div class="grow"><b>${esc(c.name)}</b><small>${esc(c.contact || '')} · joined ${c.createdAt ? date(c.createdAt) : '–'}</small></div><span style="color:var(--muted)">›</span></a>`).join('')}</div>`
  ].filter(Boolean);
  return (stats.length ? `<div class="grid g4" style="margin-bottom:16px">${stats.join('')}</div>` : '') + board(me)
    + (lower.length ? `<div class="grid g2">${lower.join('')}</div>` : '');
}

// Team access (owners only): tick the apps each person can open. The database rules check the same ticks.
async function team(){
  const list = await adm.team();
  const tick = (u, a) => `<td class="c"><input type="checkbox" data-team="${esc(u.email)}" data-app="${esc(a.id)}" aria-label="${esc((u.name || u.email) + ': ' + a.name)}" ${u.owner || u.sections.includes(a.id) ? 'checked' : ''} ${u.owner ? 'disabled' : ''}></td>`;
  return `<div class="card"><p class="lead" style="margin-top:0">Tick the apps each person can open. Owners see everything. Changes apply the next time they open NGL Admin.</p>
  <div class="teamwrap"><table class="teamt"><thead><tr><th>Person</th>${APPS.map(a => `<th class="c"><span>${esc(a.name)}</span></th>`).join('')}<th></th></tr></thead><tbody>
  ${list.map(u => `<tr><td class="who"><b>${esc(u.name || u.email)}</b>${u.owner ? ' ' + pill('Owner', 'ok') : ''}<br><small style="color:var(--muted)">${esc(u.email)}</small></td>${APPS.map(a => tick(u, a)).join('')}
    <td>${u.owner ? '' : `<button class="btn sm ghost" data-act="adm-team-remove" data-email="${esc(u.email)}" data-name="${esc(u.name || u.email)}">Remove</button>`}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card" style="margin-top:16px"><h2>Add someone</h2><form id="teamAdd">
    <div class="grid g2"><label class="field"><span>Name</span><input id="tName" required autocomplete="off"></label><label class="field"><span>Email</span><input id="tEmail" type="email" required autocomplete="off"></label></div>
    <p style="margin:14px 0 6px;font-weight:700">What they can open</p>
    <div class="teampick">${GROUPS.map(g => `<div><b style="color:${g.colour}">${esc(g.name)}</b>${APPS.filter(a => a.group === g.id).map(a => `<label><input type="checkbox" name="tApp" value="${esc(a.id)}"> ${esc(a.name)}</label>`).join('')}</div>`).join('')}</div>
    <div class="btn-row"><button class="btn">Send invite</button></div></form>
    <p class="lead" style="font-size:13px;margin:10px 0 0">They get an email to set their own password, then see only the apps you ticked.</p></div>`;
}

async function clubs(id){
  const cl = await adm.clubs();
  if (id) return clubPage(cl.find(c => c.id === id));
  return `<div class="card"><label class="field" style="margin-top:0"><span>Find a club</span><input id="admFind" placeholder="Club name, contact, email or BG number" data-filter="#admClubs tr.c"></label>
    <table id="admClubs"><tr><th>Club</th><th>Joined</th>${PATHWAYS.slice(0, 4).map(p => `<th title="${esc(p.n)}">${dot(p.k)}</th>`).join('')}<th></th></tr>
    ${cl.map(c => `<tr class="c" data-text="${esc([c.name, c.contact, c.email, c.bgNumber].join(' ').toLowerCase())}"><td><b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.contact || '')} · ${esc(c.email || '')}</small></td>
      <td>${c.createdAt ? date(c.createdAt, {day: 'numeric', month: 'short'}) : '–'}</td>${PATHWAYS.slice(0, 4).map(p => `<td>${on(c.licences[p.k]) ? '✓' : ''}</td>`).join('')}
      <td><a class="btn sm ghost" href="#/admin/clubs/${esc(c.id)}">Open</a></td></tr>`).join('')}</table></div>`;
}

async function clubPage(c){
  if (!c) return '<div class="card empty">Club not found. <a href="#/admin/clubs">All clubs</a></div>';
  const [ord, res, cal] = await Promise.all([adm.orders(), adm.reservations(), adm.calendar()]);
  const mine = ord.filter(o => o.clubId === c.id), places = res.filter(r => r.clubId === c.id);
  return `<p style="margin:0 0 6px"><a href="#/admin/clubs">← All clubs</a></p><h2 style="font-size:24px">${esc(c.name)}</h2>
  <p class="lead">${esc(c.contact || '')} · ${esc(c.email || '')}${c.phone ? ' · ' + esc(c.phone) : ''}${c.bgNumber ? ' · BG ' + esc(c.bgNumber) : ''}</p>
  <div class="grid g2"><div class="card"><h2>Licences</h2>${PATHWAYS.map(p => { const L = c.licences[p.k] || {};
    return `<div class="row"><span class="dot" style="background:${p.c}"></span><div class="grow"><b>${esc(p.n)}</b><small>${esc(L.label || '')}${L.band ? ' · ' + esc(L.band) : ''}${L.renews ? ' · renews ' + date(L.renews) : ''}</small></div>
      ${['soon'].includes(L.status) ? '' : on(L) && p.k !== 'general' ? `<button class="btn sm ghost" data-act="adm-lic" data-club="${esc(c.id)}" data-path="${p.k}" data-to="off">Switch off</button>` : p.k === 'general' ? pill(L.label || '', 'ok') : `<button class="btn sm" data-act="adm-lic" data-club="${esc(c.id)}" data-path="${p.k}" data-to="on">Switch on</button>`}</div>`; }).join('')}
    <p class="lead" style="font-size:13px;margin:10px 0 0">Licences paid at checkout switch on automatically. Use this for trials, corrections or a licence paid another way.</p></div>
  <div><div class="card" style="margin-bottom:16px"><h2>Orders</h2>${mine.length ? mine.map(o => `<div class="row"><div class="grow"><b>${esc(o.id)}</b><small>${date(o.date)} · ${esc(o.details)} · ${gbp(o.total)}</small></div>${statusPill(o)}</div>`).join('') : '<p class="empty">No orders.</p>'}</div>
  <div class="card"><h2>Competition places</h2>${places.length ? places.map(r => { const k = cal.find(x => x.id === r.compId) || {name: r.compId};
    return `<div class="row"><div class="grow"><b>${esc(k.name)}</b><small>${r.places} places · ${esc(r.ref || '')}</small></div>${pill(r.status, r.status === 'waiting' ? 'warn' : 'ok')}</div>`; }).join('') : '<p class="empty">No reservations.</p>'}</div></div></div>`;
}

async function orders(filter = 'post'){
  const ord = await adm.orders();
  const F = {post: ['To post', o => o.status === 'paid'], unpaid: ['Not paid', o => o.status === 'awaiting-payment'], all: ['All', () => true]};
  const list = ord.filter(F[filter] ? F[filter][1] : F.post[1]);
  return `<div class="paths">${Object.entries(F).map(([k, [l, f]]) => `<a class="${k === filter ? 'on' : ''}" style="--c:var(--navy)" href="#/admin/orders/${k}">${l} (${ord.filter(f).length})</a>`).join('')}</div>
  <div class="card">${list.length ? `<table><tr><th>Date</th><th>Order</th><th>Club</th><th>Details</th><th>Total</th><th>Status</th><th></th></tr>
    ${list.map(o => `<tr><td>${date(o.date, {day: 'numeric', month: 'short'})}</td><td><b>${esc(o.id)}</b></td><td><a href="#/admin/clubs/${esc(o.clubId)}">${esc(o.clubName)}</a></td><td>${esc(o.details)}${o.delivery ? `<br><small style="color:var(--muted)">→ ${esc(o.delivery)}</small>` : ''}</td><td>${gbp(o.total)}</td><td>${statusPill(o)}</td>
      <td>${o.status === 'paid' ? `<button class="btn sm" data-act="adm-sent" data-order="${esc(o.id)}">Mark posted</button>` : ''}</td></tr>`).join('')}</table>`
    : `<p class="empty">${filter === 'post' ? 'Nothing to post. Paid orders appear here automatically.' : 'No orders.'}</p>`}</div>
  ${filter === 'unpaid' ? '<p class="lead" style="margin-top:12px">Not paid = the club started checkout but didn’t finish. Nothing to chase by hand: they finish payment from their Club Hub.</p>' : ''}`;
}

const BOOKING_PILL = c => { const link = /^(https:\/\/|demo:)/.test(c.justgoUrl || ''), b = c.booking || (link ? 'reserved' : 'closed');
  if (b === 'closed') return pill('Not open', ''); if (!link) return pill('No JustGo link', 'red');
  const gs = (d => (d.setMonth(d.getMonth() - 3), d.toISOString().slice(0, 10)))(new Date(c.date + 'T12:00'));
  return b === 'open' || new Date().toISOString().slice(0, 10) >= gs ? pill('General sale', 'ok') : pill('Reserved clubs · all from ' + date(gs), 'warn'); };
async function competitions(compId){
  if (compId === 'waiting') return waiting();
  const [cal, res, saved, pend] = await Promise.all([adm.calendar(), adm.reservations(), adm.calendarIsSaved ? adm.calendarIsSaved() : true, adm.pending()]);
  adm.syncPlaces(res, pend).catch(e => console.warn('places count not updated', e));   // clubs see places left / fully reserved
  if (compId) { const c = cal.find(x => x.id === compId); const rs = res.filter(r => r.compId === compId);
    return `<p style="margin:0 0 6px"><a href="#/admin/competitions">← All competitions</a></p><h2 style="font-size:24px">${esc(c.name)}</h2><p class="lead">${date(c.date)} · ${esc(c.where)} · ${esc(c.who)}</p>
    <div class="card">${rs.length ? `<table><tr><th>Club</th><th>Places</th><th>Ref</th><th>Status</th><th></th></tr>${rs.map(r => `<tr><td><a href="#/admin/clubs/${esc(r.clubId)}">${esc(r.clubName)}</a></td><td>${r.places}</td><td>${esc(r.ref || '')}</td><td>${pill(r.status, r.status === 'waiting' ? 'warn' : 'ok')}</td>
      <td style="white-space:nowrap">${r.status !== 'bought' ? `<button class="btn sm" data-act="adm-res" data-ref="${esc(r.ref)}" data-to="bought">Bought on JustGo</button> ` : ''}${r.status === 'reserved' ? `<button class="btn sm ghost" data-act="adm-res" data-ref="${esc(r.ref)}" data-to="waiting">To waiting list</button>` : r.status === 'waiting' ? `<button class="btn sm ghost" data-act="adm-res" data-ref="${esc(r.ref)}" data-to="reserved">Give places</button>` : ''}</td></tr>`).join('')}</table>`
      : '<p class="empty">No reservations yet.</p>'}</div>`; }
  return `${saved ? '' : `<div class="card attn" style="margin-bottom:16px"><div class="row" style="border:0"><div class="grow"><b>The calendar isn’t in the database yet</b><small>Clubs see the built-in 2027 list. Save it to the database to edit dates and add competitions.</small></div><button class="btn sm" data-act="adm-import-cal">Save calendar</button></div></div>`}
  ${pend.length ? `<div class="card attn" style="margin-bottom:16px"><div class="row" style="border:0"><div class="grow"><b>${pend.reduce((a, p) => a + p.places, 0)} places waiting for a club</b><small>Booked before the club had a Club Hub account. They join automatically when the club confirms the same email; attach the rest here.</small></div><a class="btn sm" href="#/admin/competitions/waiting">Review</a></div></div>` : ''}
  <div class="btn-row" style="margin:0 0 12px"><button class="btn" data-act="adm-comp">Add a competition</button></div>
  <div class="card"><table><tr><th>Date</th><th>Competition</th><th>Places</th><th>Clubs</th><th>Booking</th><th></th></tr>${cal.map(c => { const rs = res.filter(r => r.compId === c.id);
    return `<tr><td><b>${date(c.date)}</b></td><td>${dot(c.path)} <b>${esc(c.name)}</b><br><small style="color:var(--muted)">${esc(c.where)} · ${esc(c.who)}</small></td>
      <td>${rs.filter(r => r.status !== 'waiting').reduce((a, r) => a + r.places, 0)}${rs.some(r => r.status === 'waiting') ? ' + waiting' : ''}</td><td>${rs.length}</td><td>${BOOKING_PILL(c)}</td>
      <td style="white-space:nowrap"><button class="btn sm" data-act="adm-booking" data-comp="${esc(c.id)}">Booking</button> <a class="btn sm ghost" href="#/admin/competitions/${esc(c.id)}">Reservations</a> <a class="btn sm ghost" href="#/admin/mailer/${esc(c.id)}">Booking emails</a> <button class="btn sm ghost" data-act="adm-comp" data-comp="${esc(c.id)}">Edit</button></td></tr>`; }).join('')}</table></div>`;
}

// Places booked before the club registered, grouped by the club name on the booking, with the likely club suggested
async function waiting(){
  const [pend, cl, cal] = await Promise.all([adm.pending(), adm.clubs(), adm.calendar()]);
  const groups = {}; pend.forEach(p => { const k = p.nameKey || nameKey(p.clubName) || p.id; (groups[k] = groups[k] || []).push(p); });
  return `<p style="margin:0 0 6px"><a href="#/admin/competitions">← All competitions</a></p><h2 style="font-size:24px">Places waiting for a club</h2>
  <p class="lead">Booked before the club had a Club Hub account. When a club registers and confirms the email it booked with, its places join automatically. If it registered with a different email, choose the club and attach them here.</p>
  ${Object.keys(groups).length ? Object.entries(groups).map(([k, ps]) => { const sug = cl.filter(c => nameKey(c.name) === k), names = [...new Set(ps.map(p => p.clubName))].join(' / ');
    return `<div class="card" style="margin-bottom:12px"><div class="row" style="border:0;padding-top:0"><div class="grow"><h2 style="margin:0">${esc(names || 'No club name')}</h2><small style="color:var(--muted)">${ps.reduce((a, p) => a + p.places, 0)} places · ${ps.length} booking${ps.length === 1 ? '' : 's'}${ps.some(p => p.email) ? ' · joins automatically when they confirm their booking email' : ' · no booking email on record'}</small></div></div>
      ${ps.map(p => { const c = cal.find(x => x.id === p.compId) || {name: p.compName || p.compId}; return `<div class="row"><div class="grow"><b>${esc(c.name)}</b><small>${p.places} places · ${esc(p.ref || p.id)}</small></div>${pill(p.status, p.status === 'waiting' ? 'warn' : 'ok')}</div>`; }).join('')}
      <div class="row" style="border:0"><label class="field grow" style="margin:0"><span>Attach to</span><select id="att-${esc(k)}"><option value="">Choose a registered club…</option>${sug.map(c => `<option value="${esc(c.id)}" selected>${esc(c.name)} (suggested)</option>`).join('')}${cl.filter(c => !sug.includes(c)).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
      <button class="btn sm" data-act="adm-attach" data-key="${esc(k)}" data-ids="${esc(ps.map(p => p.id).join(','))}">Attach</button></div></div>`; }).join('')
    : '<div class="card empty">No places waiting. Every booking belongs to a registered club.</div>'}`;
}

async function music(compId){
  const cal = await adm.calendar(); const c = cal.find(x => x.id === compId) || cal[0];
  const [ents, ups, cl] = await Promise.all([adm.musicEntries(c.id), adm.musicUploads(c.id), adm.clubs()]);
  const got = new Set(ups.map(u => u.gymnastId)), total = ents.reduce((a, e) => a + (e.gymnasts || []).length, 0);
  return `<label class="field" style="max-width:520px;margin-top:0"><span>Competition</span><select data-go="#/admin/music/">${cal.map(x => `<option value="${esc(x.id)}" ${x.id === c.id ? 'selected' : ''}>${date(x.date)} · ${esc(x.name)}</option>`).join('')}</select></label>
  <div class="grid g4" style="margin:12px 0 16px"><div class="card stat"><b>${ups.length} / ${total}</b><span>Music uploaded</span></div><div class="card stat"><b>${ents.length}</b><span>Clubs with gymnasts entered</span></div></div>
  <div class="btn-row" style="margin:0 0 12px"><button class="btn" data-act="adm-entry" data-comp="${esc(c.id)}">Add a club’s gymnasts</button></div>
  ${ents.length ? ents.map(e => `<div class="card" style="margin-bottom:12px"><div class="row" style="border:0;padding-top:0"><div class="grow"><h2 style="margin:0">${esc(e.clubName)}</h2></div>${pill((e.gymnasts || []).filter(g => got.has(g.id)).length + ' of ' + (e.gymnasts || []).length, (e.gymnasts || []).every(g => got.has(g.id)) ? 'ok' : 'red')}<button class="btn sm ghost" data-act="adm-entry" data-comp="${esc(c.id)}" data-club="${esc(e.clubId)}">Edit list</button></div>
    ${(e.gymnasts || []).map(g => { const u = ups.find(x => x.gymnastId === g.id); return `<div class="row"><div class="grow"><b>${esc(g.n)}</b><small>Level ${esc(g.level)}${u ? ' · ' + esc(u.fileName) : ' · not uploaded'}</small></div>${u ? `<a class="btn sm ghost" href="${esc(u.url)}" target="_blank" rel="noopener" download>Download</a>` : pill('Waiting', 'red')}</div>`; }).join('')}</div>`).join('')
    : '<div class="card empty">No gymnasts entered for this competition yet. Add each club’s list from the JustGo start list.</div>'}
  <datalist id="admClubList">${cl.map(x => `<option value="${esc(x.name)}" data-id="${esc(x.id)}">`).join('')}</datalist>`;
}
