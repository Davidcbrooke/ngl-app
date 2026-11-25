/**
 * NGL card payments: STAGING copy for the new one-app Club Hub sandbox (repos/ngl-app).
 * Apps Script web app "NGL card payments STAGING" in the bookingoffice@ Google account.
 * Same flow as the live script (card-payments.gs), but:
 *   - reads and writes the STAGING database (Firebase project ngl-club-hub-staging), collection "orders" only;
 *   - refuses to run unless STRIPE_SECRET_KEY is a Stripe TEST key (sk_test_ / rk_test_), so no real money moves.
 * Deploy: web app, Execute as Me, access Anyone. Script property STRIPE_SECRET_KEY = Stripe TEST secret key.
 */
const PROJECT = 'ngl-club-hub-staging';
const FS = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/';
const COLLS = ['orders'];

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.object === 'event' && body.type) {                       // Stripe webhook
      if (body.type === 'checkout.session.completed' || body.type === 'checkout.session.async_payment_succeeded') {
        const id = body.data && body.data.object && body.data.object.id;
        if (id) activate_(id);
      }
      return json_({received: true});
    }
    if (body.action === 'checkout') return json_(checkout_(body));
    return json_({ok: false, error: 'unknown action'});
  } catch (err) {
    return json_({ok: false, error: String(err && err.message || err)});
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.session_id) {
    let res;
    try { res = activate_(p.session_id); } catch (err) { res = {ok: false, error: String(err)}; }
    const back = safeReturn_(res.ret);
    const msg = res.ok ? 'Thank you, your payment has been received.' + (res.switched ? ' ' + res.switched : '')
                       : 'We could not confirm the payment yet. If you were charged, it will update shortly; otherwise please try again.';
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;font-family:Roboto,Arial,sans-serif;background:#28225c;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:20px">' +
      '<div style="max-width:460px"><div style="height:6px;display:flex;margin-bottom:22px"><i style="flex:1;background:#e84187"></i><i style="flex:1;background:#fbd43a"></i><i style="flex:1;background:#e8822f"></i><i style="flex:1;background:#0073b3"></i><i style="flex:1;background:#00aeb7"></i><i style="flex:1;background:#6ba526"></i><i style="flex:1;background:#8f286b"></i></div>' +
      '<h1 style="font-size:30px;margin:0 0 12px">' + (res.ok ? 'Payment received' : 'Almost there') + '</h1><p style="font-size:17px;line-height:1.5;color:#d6d4ee">' + esc_(msg) + '</p>' +
      (back ? '<p style="margin-top:24px"><a href="' + esc_(back) + '" target="_top" style="display:inline-block;background:#c6152e;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:999px">Back to your Club Hub (sandbox)</a></p>' : '') +
      '</div></body>').setTitle('NGL payment').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return json_({ok: true, service: 'NGL card payments'});
}

/* ---------- 1. checkout ---------- */
function checkout_(b) {
  const uid = String(b.uid || ''), token = String(b.idToken || ''), coll = String(b.coll || ''), orderId = String(b.orderId || '');
  if (!/^[A-Za-z0-9]{10,64}$/.test(uid) || token.length < 100 || COLLS.indexOf(coll) < 0 || !/^ORD-[A-Z0-9-]{3,20}$/.test(orderId)) return {ok: false, error: 'bad request'};
  const r = UrlFetchApp.fetch(FS + coll + '/' + orderId, {headers: {Authorization: 'Bearer ' + token}, muteHttpExceptions: true});
  if (r.getResponseCode() !== 200) return {ok: false, error: 'order not found'};
  const o = fromDoc_(JSON.parse(r.getContentText()));
  if (o.clubId !== uid) return {ok: false, error: 'not your order'};
  if (o.status && o.status !== 'awaiting-payment') return {ok: false, error: 'This order is already ' + o.status + '.'};
  const pence = Math.round(orderTotal_(o) * 100);
  if (!(pence >= 30)) return {ok: false, error: 'Nothing to pay on this order.'};
  const club = adminGet_('clubs/' + uid) || {};
  const self = ScriptApp.getService().getUrl();
  const label = describe_(o);
  const s = stripe_('post', 'checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'gbp',
    'line_items[0][price_data][unit_amount]': String(pence),
    'line_items[0][price_data][product_data][name]': 'NGL order ' + orderId + ' (TEST)',
    'line_items[0][price_data][product_data][description]': label,
    customer_email: club.email || '',
    client_reference_id: uid,
    'metadata[coll]': coll, 'metadata[orderId]': orderId, 'metadata[clubId]': uid, 'metadata[ret]': safeReturn_(b.ret) || '',
    'payment_intent_data[metadata][orderId]': orderId, 'payment_intent_data[description]': 'NGL ' + orderId + ' · ' + (club.name || ''),
    'invoice_creation[enabled]': 'true',
    'invoice_creation[invoice_data][description]': label + ' (' + orderId + ')',
    'invoice_creation[invoice_data][footer]': 'SAADI Gymnastics Ltd trading as National Gymnastics League · Company no. 10702099 · VAT no. GB 255 4614 03',
    success_url: self + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: safeReturn_(b.ret) || 'https://club.nationalgymnasticsleague.co.uk/'
  });
  return {ok: true, url: s.url};
}

/* ---------- 2. activate after payment ---------- */
function activate_(sessionId) {
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) return {ok: false, error: 'bad session'};
  const s = stripe_('get', 'checkout/sessions/' + sessionId);
  const m = s.metadata || {};
  const ret = m.ret || '';
  if (s.payment_status !== 'paid') return {ok: false, ret: ret, error: 'not paid'};
  const coll = m.coll, id = m.orderId;
  if (COLLS.indexOf(coll) < 0 || !id) return {ok: false, ret: ret, error: 'no order'};
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const o = adminGet_(coll + '/' + id);
    if (!o) return {ok: false, ret: ret, error: 'order missing'};
    if (o.status === 'paid' || o.status === 'sent') return {ok: true, ret: ret, switched: ''};
    if (Math.round(orderTotal_(o) * 100) !== s.amount_total) return {ok: false, ret: ret, error: 'amount mismatch'};
    const now = new Date();
    adminPatch_(coll + '/' + id, {status: 'paid', paidAt: now, paidBy: 'card', stripeSession: sessionId});
    const club = adminGet_('clubs/' + o.clubId) || {};
    let switched = '';
    if (o.kind === 'licence' && o.licPath) {                             // one-app model: club.licences[pathway]
      const lic = club.licences || {}, cur = lic[o.licPath] || {};
      const exp = expiry_({expires: cur.renews}, false);
      lic[o.licPath] = {status: 'live', label: 'Licence live', band: o.band || cur.band || '', renews: Utilities.formatDate(exp, 'Europe/London', 'yyyy-MM-dd')};
      adminPatch_('clubs/' + o.clubId, {licences: lic});
      switched = 'Your licence is now switched on.';
    }
    if (!switched) switched = 'We will post your order shortly.';
    return {ok: true, ret: ret, switched: switched};
  } finally { lock.releaseLock(); }
}

/* ---------- helpers ---------- */
function orderTotal_(o) {
  const L = (o.lines && o.lines.length) ? o.lines : legacyLines_(o);
  return L.reduce(function (a, l) { return a + (Number(l.qty) || 0) * (Number(l.unit) || 0); }, 0);
}
function legacyLines_(o) {                                              // matches NGL Schools orderLines()
  if (o.type === 'graduation') {
    const L = [{qty: o.qty, unit: o.price}];
    if (o.spectators) L.push({qty: o.spectators, unit: o.spectatorPrice || 5});
    if (o.vat) { const net = L.reduce(function (a, l) { return a + l.qty * l.unit; }, 0); L.push({qty: 1, unit: Math.round(net * 0.2 * 100) / 100}); }
    return L;
  }
  return [{qty: o.qty || 0, unit: o.price || 0}];
}
function describe_(o) { return ('NGL order: ' + (o.details || '')).slice(0, 200); }
function expiry_(lic, ignoreTrial) {
  const now = new Date();
  let cur = lic && lic.expires ? new Date(lic.expires) : null;
  if (ignoreTrial && lic && lic.trial) cur = null;
  const d = new Date(cur && cur > now ? cur : now); d.setFullYear(d.getFullYear() + 1); return d;
}
function safeReturn_(u) {
  u = String(u || '');
  return /^https:\/\/(club\.nationalgymnasticsleague\.co\.uk|nglschools\.co\.uk|(www\.)?nglrecreational\.co\.uk|davidcbrooke\.github\.io)\//.test(u) ? u : '';
}
function stripe_(method, path, params) {
  const key = PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY') || '';
  if (!/^(sk|rk)_test_/.test(key)) throw new Error('Staging needs a Stripe TEST key (sk_test_ or rk_test_).');
  const opt = {method: method, headers: {Authorization: 'Bearer ' + key}, muteHttpExceptions: true};
  if (params) opt.payload = params;
  const r = UrlFetchApp.fetch('https://api.stripe.com/v1/' + path, opt);
  const j = JSON.parse(r.getContentText());
  if (r.getResponseCode() >= 300) throw new Error('Stripe: ' + ((j.error && j.error.message) || r.getResponseCode()));
  return j;
}
function adminGet_(path) {
  const r = UrlFetchApp.fetch(FS + path, {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() !== 200) throw new Error('Firestore read ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  return fromDoc_(JSON.parse(r.getContentText()));
}
function adminPatch_(path, obj, mask) {
  const keys = mask || Object.keys(obj);
  const q = keys.map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  const fields = {}; Object.keys(obj).forEach(function (k) { fields[k] = toVal_(obj[k]); });
  const r = UrlFetchApp.fetch(FS + path + '?' + q + '&currentDocument.exists=true', {method: 'patch', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, payload: JSON.stringify({fields: fields}), muteHttpExceptions: true});
  if (r.getResponseCode() !== 200) throw new Error('Firestore write ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
}
function toVal_(v) {
  if (v === null || v === undefined) return {nullValue: null};
  if (v instanceof Date) return {timestampValue: v.toISOString()};
  if (typeof v === 'boolean') return {booleanValue: v};
  if (typeof v === 'number') return Number.isInteger(v) ? {integerValue: String(v)} : {doubleValue: v};
  if (typeof v === 'string') return {stringValue: v};
  if (Array.isArray(v)) return {arrayValue: {values: v.map(toVal_)}};
  const f = {}; Object.keys(v).forEach(function (k) { f[k] = toVal_(v[k]); }); return {mapValue: {fields: f}};
}
function fromVal_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);    // kept as a Date so it is written back as a timestamp
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromVal_);
  if ('mapValue' in v) { const o = {}; const f = v.mapValue.fields || {}; Object.keys(f).forEach(function (k) { o[k] = fromVal_(f[k]); }); return o; }
  return null;
}
function fromDoc_(d) { return fromVal_({mapValue: {fields: d.fields || {}}}); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }

/* Run once from the editor: checks this account can read the NGL database and Stripe. */
function testAccess() {
  const clubs = UrlFetchApp.fetch(FS + 'clubs?pageSize=1', {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
  Logger.log('Firestore: ' + clubs.getResponseCode());
  Logger.log('Stripe: ' + (stripe_('get', 'balance').object || 'ok'));
}
