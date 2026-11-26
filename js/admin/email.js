// NGL Admin · Email assistant. Copied word for word from GYMNASTICS-RESULTS/NGL_Email_Assistant.html:
// the same cards, notes, "Their email", earlier messages, two-tap Send, "Done, no reply", "Leave for Gmail" and wording.
// Only the shell, look and data layer change.
// Where the emails come from (unchanged): a Claude cloud routine reads admin@nationalgymnasticsleague.co.uk at 7am and 1pm,
// writes reply DRAFTS in Gmail and labels the threads Agent/Ready or Agent/Needs Dave. Nothing is in Firestore.
// The page reads and acts on them through the Apps Script web app "NGL Email Assistant" (admin@ account,
// GYMNASTICS-RESULTS/tools/ngl_email_assistant_apps_script.gs): POST {idToken, action: list|send|done|skip, threadId, body}.
// Sandbox: sending is impossible (no request is ever made). ?demo: sample emails in memory, nothing is sent or written.
import { ENV } from '../config.js';
import { MODE } from '../data.js';
import { fb } from '../firebase.js';
import { esc, toast } from '../ui.js';

const CONFIG = {
  // NGL Email Assistant Apps Script web app (admin@ account): GYMNASTICS-RESULTS/tools/ngl_email_assistant_apps_script.gs
  assistantUrl: 'https://script.google.com/macros/s/AKfycbxDq9KmIqo4LeF-WvHmv594VAb0qVeTwooEKE0qQAr243UftThi_hVJmkzAHUZKhqyo/exec'
};
const LIVE_TOOL = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Email_Assistant.html';
const DEMO = MODE === 'demo';
const LIVE = ENV === 'live' && !DEMO;     // the only case where anything reaches Gmail

const addrOf = f => (String(f || '').match(/<([^>]+)>/) || [, f])[1];
const nameOf = f => String(f || '').replace(/<[^>]*>/, '').replace(/"/g, '').trim() || addrOf(f);
const unwrap = t => String(t || '').replace(/ \n(?=\S)/g, ' ');   // Gmail wraps draft lines at ~76 characters with a trailing space
function when(ms){ const m = Math.round((Date.now() - ms) / 60000);
  const ago = m < 60 ? m + ' min ago' : m < 36 * 60 ? Math.round(m / 60) + ' hours ago' : Math.round(m / 1440) + ' days ago';
  return new Date(ms).toLocaleString('en-GB', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) + ' · ' + ago; }

// State lives here so a redraw never loses what you typed: edits are kept per conversation until it's sent or done.
const S = {items: null, err: null, edits: {}, busy: {}};

async function call(action, extra){
  if (DEMO) return demoCall(action, extra);
  if (!LIVE) throw new Error('Sandbox: sending is switched off.');   // belt and braces: the sandbox never calls the script
  if (!CONFIG.assistantUrl) throw new Error('not-connected');
  const {A} = await fb();
  const u = A.currentUser; if (!u) throw new Error('Please sign in to NGL Admin.');
  const r = await fetch(CONFIG.assistantUrl, {method: 'POST', body: JSON.stringify({idToken: await u.getIdToken(), action, ...extra})});
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'The Email assistant refused the request.');
  return j;
}

async function load(){
  S.err = null;
  try { S.items = (await call('list')).items || []; }
  catch (e) { console.error(e); S.items = null; S.err = e.message; }
  const ids = new Set((S.items || []).map(i => i.threadId));
  Object.keys(S.edits).forEach(k => { if (!ids.has(k)) delete S.edits[k]; });
}

const totals = () => { const items = S.items || [], dave = items.filter(i => i.needsDave).length, ready = items.length - dave;
  return `<div class="em-tot" style="--c:var(--red)"><b>${dave}</b><span>need you</span></div><div class="em-tot" style="--c:var(--gen)"><b>${ready}</b><span>replies ready to send</span></div>`; };
const EMPTY = '<div class="card em-msg">All clear: nothing waiting. Claude checks the inbox at 7am and 1pm.</div>';

function card(i){
  const parts = String(i.note || '').split('|').map(s => s.trim()).filter(Boolean);
  const summary = parts.filter(p => !/^needs you/i.test(p)).join(' · '), reason = (parts.find(p => /^needs you/i.test(p)) || '').replace(/^needs you:?\s*/i, '');
  const id = esc(i.threadId), draft = i.threadId in S.edits ? S.edits[i.threadId] : unwrap(i.draft);
  return `<article class="card em-card ${i.needsDave ? 'dave' : ''}" data-t="${id}">
    <div class="em-top"><div class="em-who"><b>${esc(nameOf(i.from))}</b> ${nameOf(i.from) !== addrOf(i.from) ? `<small class="em-addr">${esc(addrOf(i.from))}</small>` : ''}
      <div class="em-sub">${esc(i.subject || '(no subject)')}</div><small>${esc(when(i.date))}${i.count > 1 ? ` · ${i.count} messages in this conversation` : ''}</small></div>
      <span class="em-tag">${i.needsDave ? 'Needs you' : 'Ready to send'}</span></div>
    ${summary || reason ? `<div class="em-note ${i.needsDave ? 'dave' : ''}">${summary ? `<b>Claude:</b> ${esc(summary)}` : ''}${reason ? `${summary ? '<br>' : ''}<b>Why it needs you:</b> ${esc(reason)}` : ''}</div>` : ''}
    <details class="em-det" ${i.needsDave ? 'open' : ''}><summary>Their email</summary><div class="em-orig">${esc(i.text)}</div>
      ${i.attachments && i.attachments.length ? `<div class="em-att">Attached: ${i.attachments.map(esc).join(', ')}</div>` : ''}
      ${i.earlier && i.earlier.length ? `<div class="em-earlier">${i.earlier.map(e => `<div class="em-eh">${esc(nameOf(e.from))} · ${esc(new Date(e.date).toLocaleString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}))}</div><div class="em-orig">${esc(e.text)}</div>`).join('')}</div>` : ''}</details>
    <label class="em-rl" for="r-${id}">Your reply${i.hasDraft ? '' : ' (no draft: write one)'}</label>
    <textarea class="em-reply" id="r-${id}" data-t="${id}">${esc(draft)}</textarea>
    <div class="em-acts">
      <button class="btn em-send" data-act="em-send" data-t="${id}" ${LIVE || DEMO ? '' : 'disabled'}>Send reply</button>
      <button class="btn ghost" data-act="em-done" data-t="${id}" title="No reply needed: archive it" ${LIVE || DEMO ? '' : 'disabled'}>Done, no reply</button>
      <button class="btn ghost" data-act="em-skip" data-t="${id}" title="Take it out of here and deal with it in Gmail" ${LIVE || DEMO ? '' : 'disabled'}>Leave for Gmail</button>
      <a href="${esc(i.link)}" target="_blank" rel="noopener">Open in Gmail ↗</a>
    </div></article>`;
}
const listHTML = () => (S.items || []).length ? S.items.map(card).join('') : EMPTY;

const SANDBOX_NOTE = `<div class="card em-sandbox"><b>Sandbox: sending is switched off.</b> ${DEMO
  ? 'These are sample emails. Send, Done and Leave for Gmail only take them off this list; nothing reaches anyone.'
  : 'The sandbox can’t open or send from admin@’s inbox. Check and send replies in the live tool.'}
  <a href="${LIVE_TOOL}" target="_blank" rel="noopener">Open the live Email assistant ↗</a></div>`;

export default async function email(){
  const intro = `<div class="em-head"><p class="lead">Replies drafted by Claude for admin@nationalgymnasticsleague.co.uk. Nothing is sent until you press Send.</p>
    ${LIVE || DEMO ? '<button class="btn ghost sm" data-act="em-refresh" id="emRefresh">Refresh</button>' : ''}</div>`;
  if (!LIVE && !DEMO) return `<div class="em-root" id="emRoot">${intro}${SANDBOX_NOTE}</div>`;
  if (S.items === null && !S.err) await load();
  const body = S.err
    ? (S.err === 'not-connected'
      ? '<div class="card em-msg"><b>Not connected yet.</b> The Email assistant script hasn’t been deployed. Once it is, its web app address goes in <code>assistantUrl</code> at the top of js/admin/email.js.</div>'
      : `<div class="card em-msg err"><b>Couldn’t load the emails.</b> ${esc(S.err)}</div>`)
    : `<div class="em-tots" id="emTot">${totals()}</div><div id="emList">${listHTML()}</div>`;
  return `<div class="em-root" id="emRoot">${intro}${LIVE ? '' : SANDBOX_NOTE}${body}</div>`;
}

// Redraw the whole screen, but never while a reply is being typed (it would steal the cursor).
const editing = () => { const a = document.activeElement; return !!(a && a.matches && a.matches('#emRoot textarea')); };
function redraw(){ if (editing()) return; window.NGL_RENDER && window.NGL_RENDER(); }
// After Send / Done / Leave: take just that card out and update the totals, so other drafts are untouched.
function removeCard(id){
  S.items = (S.items || []).filter(i => i.threadId !== id); delete S.edits[id];
  const root = document.getElementById('emRoot'); if (!root) return;
  const c = [...root.querySelectorAll('.em-card')].find(x => x.dataset.t === id); if (c) c.remove();
  const t = document.getElementById('emTot'); if (t) t.innerHTML = totals();
  const l = document.getElementById('emList'); if (l && !S.items.length) l.innerHTML = EMPTY;
}

async function act(b, a){
  const id = b.dataset.t, cardEl = b.closest('.em-card'); if (!cardEl || S.busy[id]) return;
  const item = (S.items || []).find(i => i.threadId === id); if (!item) return;
  const body = cardEl.querySelector('textarea').value;
  if (a === 'send'){
    if (!body.trim()) return toast('Write a reply first.', false);
    if (/\[NOTE FOR DAVE/i.test(body)) return toast('Take Claude’s note out of the reply first.', false);
    if (!b.classList.contains('sure')){ b.classList.add('sure'); b.textContent = `Tap again to send to ${nameOf(item.from)}`;
      setTimeout(() => { if (b.isConnected && !S.busy[id]){ b.classList.remove('sure'); b.textContent = 'Send reply'; } }, 5000); return; }
  }
  S.busy[id] = true; cardEl.querySelectorAll('button').forEach(x => x.disabled = true);
  const was = b.textContent; b.textContent = a === 'send' ? 'Sending…' : 'Saving…';
  try {
    await call(a, a === 'send' ? {threadId: id, body} : {threadId: id});
    removeCard(id);
    toast(a === 'send' ? `Reply sent to ${nameOf(item.from)}.` : a === 'done' ? 'Marked done and archived.' : 'Left in the Gmail inbox.');
  } catch (err) { toast(err.message, false); b.textContent = a === 'send' ? 'Send reply' : was; b.classList.remove('sure'); cardEl.querySelectorAll('button').forEach(x => x.disabled = false); }
  delete S.busy[id];
}

/* Buttons (data-act="em-…"): the app shell sends clicks here */
export const EM = {
  'em-send'(b){ act(b, 'send'); },
  'em-done'(b){ act(b, 'done'); },
  'em-skip'(b){ act(b, 'skip'); },
  async 'em-refresh'(b){ if (editing() || Object.values(S.busy).some(Boolean)) return; b.disabled = true; await load(); redraw(); }
};

// Keep what's typed, so a refresh or another card being sent never loses it.
document.addEventListener('input', e => {
  const t = e.target; if (!(t.matches && t.matches('#emRoot textarea.em-reply'))) return;
  S.edits[t.dataset.t] = t.value;
});

/* ?demo: sample emails, nothing is sent (for checking the layout) */
const DEMO_ITEMS = [
  {threadId: 'd1', needsDave: true, subject: 'Refund for Finals spectator tickets', from: 'Sam Parent <sam.parent@example.com>', date: Date.now() - 3 * 3600e3, count: 1,
   text: 'Hi,\n\nMy daughter is now unwell and can\'t compete on Sunday. Can I have a refund for the two spectator tickets?\n\nThanks,\nSam', attachments: [], earlier: [],
   note: 'Parent asking for a refund on 2 Finals spectator tickets (gymnast ill) | Needs you: refund decision', hasDraft: true,
   draft: 'Hi Sam,\n\nI\'m so sorry to hear she\'s unwell. I\'ll look into the tickets for you today and come back to you.\n\nBest wishes,\nDave Brooke\nNational Gymnastics League', link: '#'},
  {threadId: 'd2', needsDave: false, subject: 'Floor & Vault competition: how do we book?', from: 'Club Coach <coach@exampleclub.co.uk>', date: Date.now() - 26 * 3600e3, count: 1,
   text: 'Hello,\n\nWe\'d like to bring 8 gymnasts to the Floor & Vault competition in February. How do we book?\n\nKind regards', attachments: [], earlier: [],
   note: 'Club wants to book 8 gymnasts for Floor & Vault (14 Feb)', hasDraft: true,
   draft: 'Hello,\n\nThank you, it would be great to have you there. You can reserve your places in the NGL Club Hub, then buy them on JustGo Events.\n\nBest wishes,\nDave Brooke\nNational Gymnastics League', link: '#'},
  {threadId: 'd3', needsDave: false, subject: 'Re: Recreational licence and award books', from: '"Helen Ward" <helen@northgategym.example>', date: Date.now() - 50 * 3600e3, count: 3,
   text: 'Thanks Dave, that helps.\n\nOne more thing: if we take the 100–249 band, can we order the Ruby and Pink books straight away, or do we have to wait for the licence to go live?\n\nHelen\nNorthgate Gymnastics Club', attachments: ['Northgate class list.pdf'],
   earlier: [{from: 'Helen Ward <helen@northgategym.example>', date: Date.now() - 74 * 3600e3, text: 'Hi, we\'re thinking about the NGL Recreational programme for our 120 recreational gymnasts. What do we get with the licence?'},
     {from: 'National Gymnastics League <admin@nationalgymnasticsleague.co.uk>', date: Date.now() - 70 * 3600e3, text: 'Hi Helen, the licence unlocks the lesson plans, the award books and medals at club prices, and the family app. You can explore it in the Club Hub before you buy.'}],
   note: 'Club asking whether they can order award books as soon as they buy the Recreational licence', hasDraft: true,
   draft: 'Hi Helen,\n\nYes: as soon as the licence is paid it switches on, and you can order the Ruby and Pink books in Shop & orders straight \naway.\n\nBest wishes,\nDave Brooke\nNational Gymnastics League', link: '#'},
  {threadId: 'd4', needsDave: true, subject: 'Judging course for two of our coaches', from: 'Priya Shah <priya.shah@riversidegym.example>', date: Date.now() - 6 * 3600e3, count: 1,
   text: 'Hello,\n\nTwo of our coaches would like to judge at the General League next season. Is there a course coming up, and what does it cost?\n\nPriya', attachments: [], earlier: [],
   note: 'Club wants two coaches on a judging course | Needs you: course dates and price not set yet', hasDraft: false, draft: '', link: '#'}
];
// Same order as the script: "Needs you" first, then oldest first. Ones you've dealt with stay gone until the page reloads.
const DEMO_GONE = new Set();
async function demoCall(action, extra = {}){
  if (action === 'list') return {ok: true, items: DEMO_ITEMS.filter(i => !DEMO_GONE.has(i.threadId)).map(i => ({...i})).sort((a, b) => (b.needsDave - a.needsDave) || (a.date - b.date))};
  await new Promise(r => setTimeout(r, 500)); DEMO_GONE.add(extra.threadId); return {ok: true}; }
