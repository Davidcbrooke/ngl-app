/**
 * NGL order check: is this order priced exactly as NGL's price list (prices.json) says?
 * ONE copy of this file runs in two places, unchanged:
 *   - the card-payments Apps Script: paste it in as a second script file called "validate-order" (Apps Script shares
 *     every file's functions, so card-payments-staging.gs can call validateOrder_ directly);
 *   - the browser, for tests/test_prices.py (loaded as a plain script).
 * Plain functions only: no import/export, no Apps Script services, no browser objects.
 *
 * validateOrder_(order, prices, club) -> {ok, error, expectedTotal}
 *   order  the order document as stored (orders/{id}), with order.id set to its document id
 *   prices the parsed prices.json
 *   club   optional: the club's document. When given, products that need a licence and Pre-School packs
 *          are only allowed while that licence is live.
 * It rebuilds the lines the order should have from the order's own keys (k), quantities and band/pack, using
 * NGL's prices, and refuses unless every line, the VAT, the postage and the total match to the penny.
 * Group-buying orders (kind 'groupbuy', id ORD-GB…) are made by NGL Admin only (firestore.rules), so their
 * prices are trusted; they still have to add up exactly, and carry the fields NGL Admin writes.
 */
function validateOrder_(order, prices, club) {
  function no(msg) { return {ok: false, error: msg, expectedTotal: null}; }
  function pence(n) { return Math.round(Number(n) * 100); }
  function isPence(n) { return typeof n === 'number' && isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6; }
  function vatOn(netPence) { return Math.round(netPence * prices.vatRate); }       // VAT to the penny on a net amount in pence
  if (!prices || typeof prices.vatRate !== 'number' || !prices.licences || !prices.products) return no('The price list could not be read.');
  if (!order || typeof order !== 'object') return no('Order not found.');
  const lines = order.lines, maxQty = prices.maxQty || 10000;
  if (!Array.isArray(lines) || !lines.length || lines.length > 60) return no('This order has no lines to charge.');
  const byKey = {};
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] || {};
    if (typeof l.k !== 'string' || !l.k) return no('Line ' + (i + 1) + ' has no item key.');
    if (!(typeof l.qty === 'number' && Math.floor(l.qty) === l.qty && l.qty >= 1 && l.qty <= maxQty)) return no('Line ' + (i + 1) + ' (' + l.k + ') has a quantity that is not a whole number from 1 to ' + maxQty + '.');
    if (!isPence(l.unit)) return no('Line ' + (i + 1) + ' (' + l.k + ') has an invalid price.');
    if (order.kind !== 'groupbuy') {
      if (byKey[l.k]) return no('The item "' + l.k + '" appears twice.');
      byKey[l.k] = l;
    }
  }
  const linesPence = lines.reduce(function (a, l) { return a + l.qty * pence(l.unit); }, 0);
  if (pence(order.total) !== linesPence) return no('The order total does not match its lines.');
  const lic = (club && club.licences) || {};
  const live = function (path) { return !!(lic[path] && (lic[path].status === 'live' || lic[path].status === 'waived')); };

  // ---- Group buying: built by NGL Admin from the round's final prices ----
  if (order.kind === 'groupbuy') {
    if (!/^ORD-GB[0-9]{6}-[0-9]{2,3}$/.test(String(order.id || ''))) return no('A group-buying order must have an ORD-GB… reference.');
    if (order.createdBy !== 'ngl-admin' || order.id !== 'ORD-' + order.invoiceNo || !/^20[0-9]{2}-(02|05|08|11)$/.test(String(order.groupbuyRound || '')))
      return no('This group-buying order was not made by NGL Admin.');
    let vats = 0;
    for (let i = 0; i < lines.length; i++) {
      const k = lines[i].k;
      if (['groupbuy', 'setup', 'delivery', 'vat'].indexOf(k) < 0) return no('Unknown item "' + k + '" on a group-buying order.');
      if (k === 'vat' && (++vats > 1 || lines[i].qty !== 1)) return no('A group-buying order has one VAT line.');
    }
    if (!lines.some(function (l) { return l.k === 'groupbuy'; })) return no('A group-buying order has no garments.');
    return {ok: true, error: '', expectedTotal: linesPence / 100};
  }
  if (order.id && /^ORD-GB/.test(String(order.id))) return no('ORD-GB… references are for group buying only.');

  // ---- Everything else: rebuild the lines from the price list ----
  const want = [];            // [{k, qty, unitPence}]
  let vatable = 0;            // net pence that carries VAT
  const add = function (k, qty, unitPence, vat) { want.push({k: k, qty: qty, unit: unitPence}); if (vat) vatable += qty * unitPence; };
  const kind = order.kind || 'supplies';

  if (kind === 'licence') {
    const L = prices.licences[order.licPath];
    if (!L) return no('There is no licence for "' + order.licPath + '".');
    const band = (L.bands || []).filter(function (b) { return b.label === order.band; })[0];
    if (!band) return no('Unknown licence band "' + order.band + '".');
    add('licence', 1, pence(band.price), L.vat);
    (L.includes || []).forEach(function (k) { const x = (prices.included || {})[k]; if (x) add(k, 1, pence(x.price), L.vat); });
  } else if (kind === 'pack') {
    const P = (prices.packs || {})[order.licPath], pack = P && P.items && P.items[order.pack];
    if (!pack) return no('Unknown pack "' + order.pack + '".');
    if (club && !(lic[order.licPath] && lic[order.licPath].status === 'live')) return no('Packs can be added once your licence is live.');
    add('pack', 1, pence(pack.price), P.vat);
  } else if (kind === 'graduation') {
    const G = prices.graduation, g = byKey.graduation, s = byKey.spectator;
    if (!g) return no('A Graduation order needs a number of graduates.');
    if (g.qty > G.maxGraduates) return no('Too many graduates on one order.');
    add('graduation', g.qty, pence(G.graduate.price), G.vat);
    if (s) { if (s.qty > G.maxSpectators) return no('Too many spectators on one order.'); add('spectator', s.qty, pence(G.spectator.price), G.vat); }
  } else if (kind === 'supplies') {
    let items = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]; if (l.k === 'postage' || l.k === 'vat') continue;
      const p = prices.products.filter(function (x) { return x.k === l.k; })[0];
      if (!p || typeof p.price !== 'number') return no('Unknown item "' + l.k + '".');
      if (club && p.needs && !live(p.needs)) return no(p.n + ' needs a live ' + p.needs + ' licence.');
      add(p.k, l.qty, pence(p.price), p.vat);
      items += l.qty;
    }
    if (!items) return no('This order has no items.');
    const band = prices.postage.bands.filter(function (b) { return b.upTo == null || items <= b.upTo; })[0];
    add('postage', 1, pence(band.price), false);
  } else {
    return no('Unknown order type "' + kind + '".');
  }
  if (vatable > 0) add('vat', 1, vatOn(vatable), false);

  // ---- Compare, line by line, to the penny ----
  if (want.length !== lines.length) {
    for (let i = 0; i < lines.length; i++) if (!want.some(function (w) { return w.k === lines[i].k; })) return no('Unexpected item "' + lines[i].k + '" on this order.');
    for (let i = 0; i < want.length; i++) if (!byKey[want[i].k]) return no(want[i].k === 'vat' ? 'The VAT line is missing.' : want[i].k === 'postage' ? 'The postage line is missing.' : 'The line "' + want[i].k + '" is missing.');
  }
  let expected = 0;
  for (let i = 0; i < want.length; i++) {
    const w = want[i], l = byKey[w.k];
    if (!l) return no(w.k === 'vat' ? 'The VAT line is missing.' : w.k === 'postage' ? 'The postage line is missing.' : 'The line "' + w.k + '" is missing.');
    if (l.qty !== w.qty) return no('The quantity of "' + w.k + '" is wrong.');
    if (pence(l.unit) !== w.unit) return no((w.k === 'vat' ? 'The VAT' : w.k === 'postage' ? 'The postage' : 'The price of "' + w.k + '"') + ' does not match NGL’s price list (expected £' + (w.unit / 100).toFixed(2) + ').');
    expected += w.qty * w.unit;
  }
  if (expected !== linesPence) return no('The order total does not match NGL’s price list.');
  return {ok: true, error: '', expectedTotal: expected / 100};
}
