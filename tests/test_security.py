"""Security rules on the STAGING database: a signed-in club tries things it must never be able to do.
Each attempt must come back 'permission-denied'."""
import os
import pytest

FB = "const m = await import('./js/firebase.js'); const {fs, A, D} = await m.fb(); const me = A.currentUser.uid;"
ATTEMPTS = {
    "switch on its own licence":
        "await fs.updateDoc(fs.doc(D, 'clubs', me), {licences: {recreational: {status: 'live'}}});",
    "make itself an admin":
        "await fs.updateDoc(fs.doc(D, 'clubs', me), {isAdmin: true});",
    "read another club's account":
        "await fs.getDoc(fs.doc(D, 'clubs', 'someone-else'));",
    "list every club's orders":
        "await fs.getDocs(fs.collection(D, 'orders'));",
    "place an order already marked paid":
        "await fs.setDoc(fs.doc(D, 'orders', 'ORD-HACK1'), {clubId: me, status: 'paid', total: 0});",
    "place an order for another club":
        "await fs.setDoc(fs.doc(D, 'orders', 'ORD-HACK2'), {clubId: 'someone-else', status: 'awaiting-payment'});",
    "list every club's reservations":
        "await fs.getDocs(fs.collection(D, 'reservations'));",
    "upload music without an entry":
        "await fs.setDoc(fs.doc(D, 'musicUploads', 'x_g1'), {clubId: me, compId: 'x', gymnastId: 'g1'});",
    "write the competition calendar":
        "await fs.setDoc(fs.doc(D, 'competitions', 'hack'), {name: 'Hack'});",
    "read the full Recreational programme without a licence":
        "await fs.getDoc(fs.doc(D, 'recContent', 'meta'));",
    "read the data move report":
        "await fs.getDoc(fs.doc(D, 'migration', 'report'));",
    "list places waiting for other clubs":
        "await fs.getDocs(fs.collection(D, 'pendingPlaces'));",
    "create a booking already marked bought":
        "await fs.setDoc(fs.doc(D, 'reservations', 'NGL-HACK1'), {clubId: me, compId: 'x', places: 5, status: 'bought', ref: 'NGL-HACK1'});",
    "read the NGL team list":
        "await fs.getDocs(fs.collection(D, 'adminUsers'));",
    "add itself to the NGL team":
        "await fs.setDoc(fs.doc(D, 'adminUsers', A.currentUser.email.toLowerCase()), {name: 'Hack', owner: true, sections: ['clubs']});",
    "publish a Graduation as another club":
        "await fs.setDoc(fs.doc(D, 'familyEvents', 'someone-else_x'), {clubId: 'someone-else', title: 'Hack'});",
    "list every family code":
        "await fs.getDocs(fs.collection(D, 'familyCodes'));",
    "write to an unknown collection":
        "await fs.setDoc(fs.doc(D, 'anything', 'x'), {a: 1});",
}


@pytest.mark.parametrize("what,code", ATTEMPTS.items())
def test_club_cannot(account, what, code):
    r = account["page"].p.evaluate(f"(async () => {{ {FB} try {{ {code} return 'ALLOWED'; }} catch (e) {{ return e.code; }} }})()")
    assert r == "permission-denied", f"A club was able to {what}: {r}"


def test_club_cannot_mark_own_order_paid(account):
    r = account["page"].p.evaluate(f"""(async () => {{ {FB}
        const ref = fs.doc(D, 'orders', 'ORD-T' + Math.random().toString(36).slice(2, 7).toUpperCase());
        await fs.setDoc(ref, {{clubId: me, status: 'awaiting-payment', total: 1, lines: []}});
        try {{ await fs.updateDoc(ref, {{status: 'paid'}}); return 'ALLOWED'; }} catch (e) {{ return e.code; }} }})()""")
    assert r == "permission-denied"


# ---------- File storage (floor music): London bucket, storage.rules ----------
ST = """const m = await import('./js/firebase.js'); const {A} = await m.fb(); const me = A.currentUser.uid;
  const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
  const {getApp} = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const S = st.getStorage(getApp()); const mp3 = new Blob([new Uint8Array([73, 68, 51, 3, 0, 0, 0, 0, 0, 0])], {type: 'audio/mpeg'});
  const put = async (path, blob, type) => { try { await st.uploadBytes(st.ref(S, path), blob, {contentType: type}); return 'ALLOWED'; } catch (e) { return e.code; } };"""


def test_club_can_upload_its_own_music(account):
    r = account["page"].p.evaluate(f"(async () => {{ {ST} return put('music/autotest/' + me + '/g1.mp3', mp3, 'audio/mpeg'); }})()")
    assert r == "ALLOWED", r


@pytest.mark.parametrize("what,code", {
    "upload into another club's folder": "put('music/autotest/someone-else/g1.mp3', mp3, 'audio/mpeg')",
    "upload something that isn't an MP3": "put('music/autotest/' + me + '/g1.mp3', new Blob(['hi'], {type: 'text/html'}), 'text/html')",
    "upload outside the music folder": "put('anything/' + me + '/x.mp3', mp3, 'audio/mpeg')",
}.items())
def test_club_cannot_store(account, what, code):
    r = account["page"].p.evaluate(f"(async () => {{ {ST} return {code}; }})()")
    assert r == "storage/unauthorized", f"A club was able to {what}: {r}"


# ---------- Group buying (Shop → Group buying, firestore.rules + storage.rules) ----------
# These need the firestore.rules / storage.rules in this repo published to staging. Until they are, run with NGL_RULES_PENDING=1
# to skip the checks that only the new rules can pass (the "cannot" checks still run and show what the old rules allow).
# A made-up future round (2099-11) so nothing here touches a real round's board. The helpers build an otherwise valid order.
GB = FB + """
  const order = (id, extra = {}) => ({clubId: me, status: 'placed', round: '2099-11', product: 'JC001', qty: 1, sizes: {M: 1}, setupFee: 0, deliveryFee: 20,
    logoPath: 'groupbuy/2099-11/' + id + '/front-logo.png', back: {type: 'none', line1: '', line2: '', logoPath: ''}, club: 'AUTOTEST Gymnastics Club', ...extra});
  const tot = 'ngl_groupbuy_rounds/2099-11_JC001';
  const place = async (o, inc = {}) => { const ref = fs.doc(fs.collection(D, 'ngl_groupbuy_orders')), b = fs.writeBatch(D), x = o(ref.id);
    b.set(ref, x); b.set(fs.doc(D, tot), {shirts: fs.increment(inc.shirts ?? x.qty), orders: fs.increment(inc.orders ?? 1), lastOrder: inc.lastOrder || ref.id, updatedAt: fs.serverTimestamp()}, {merge: true});
    await b.commit(); };"""
GB_ATTEMPTS = {
    "place a group order for another club":
        "await place(id => order(id, {clubId: 'someone-else'}));",
    "place a group order already invoiced or paid":
        "await place(id => order(id, {status: 'paid'}));",
    "place a group order with a silly quantity":
        "await place(id => order(id, {qty: 100000}));",
    "place a group order without adding it to the round totals":
        "const r = fs.doc(fs.collection(D, 'ngl_groupbuy_orders')); await fs.setDoc(r, order(r.id));",
    "add more to the round totals than its order":
        "await place(id => order(id), {shirts: 500});",
    "count its order twice on the round totals":
        "await place(id => order(id), {orders: 2});",
    "edit the round totals by hand":
        "await fs.setDoc(fs.doc(D, tot), {shirts: 999, orders: 1, lastOrder: 'nothing'}, {merge: true});",
    "read every club's group orders":
        "await fs.getDocs(fs.collection(D, 'ngl_groupbuy_orders'));",
    "create a group-buying pay order":
        "await fs.setDoc(fs.doc(D, 'orders', 'ORD-HACK' + Math.random().toString(36).slice(2, 7).toUpperCase()), {clubId: me, status: 'awaiting-payment', kind: 'groupbuy', lines: [], total: 0});",
    "take a group-buying invoice number":
        "await fs.setDoc(fs.doc(D, 'orders', 'ORD-GB209911-' + String(Math.floor(Math.random() * 900) + 100)), {clubId: me, status: 'awaiting-payment', lines: [], total: 0});",
}


def test_club_can_place_its_own_group_order(account):
    """The rules above aren't just closed: a correct order for the club's own account, added once to the totals, is allowed.
    (Round 2099-11 is made up, so the real board isn't touched; the order stays, marked AUTOTEST.)"""
    r = account["page"].p.evaluate(f"(async () => {{ {GB} try {{ await place(id => order(id)); return 'ALLOWED'; }} catch (e) {{ return e.code; }} }})()")
    if r == "permission-denied" and os.environ.get("NGL_RULES_PENDING"):
        pytest.skip("Staging firestore.rules not published yet (Firebase console). Unset NGL_RULES_PENDING once they are published.")
    assert r == "ALLOWED", r


@pytest.mark.parametrize("what,code", GB_ATTEMPTS.items())
def test_club_cannot_group_buy(account, what, code):
    r = account["page"].p.evaluate(f"(async () => {{ {GB} try {{ {code} return 'ALLOWED'; }} catch (e) {{ return e.code; }} }})()")
    assert r == "permission-denied", f"A club was able to {what}: {r}"


@pytest.mark.parametrize("what,path", {
    "upload a logo to another club's order": "'groupbuy/2099-11/not-my-order/front-logo.png'",
    "upload a logo outside its order's logo paths": "'groupbuy/2099-11/' + me + '/anything.png'",
}.items())
def test_club_cannot_store_group_logos(account, what, path):
    png = "new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {type: 'image/png'})"
    r = account["page"].p.evaluate(f"(async () => {{ {ST} return put({path}, {png}, 'image/png'); }})()")
    assert r == "storage/unauthorized", f"A club was able to {what}: {r}"
