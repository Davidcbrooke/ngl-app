"""Security rules on the STAGING database: a signed-in club tries things it must never be able to do.
Each attempt must come back 'permission-denied'."""
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
