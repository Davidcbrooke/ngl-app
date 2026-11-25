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
    "write to an unknown collection":
        "await fs.setDoc(fs.doc(D, 'anything', 'x'), {a: 1});",
}


@pytest.mark.parametrize("what,code", ATTEMPTS.items())
def test_club_cannot(account, what, code):
    r = account["page"].p.evaluate(f"(async () => {{ {FB} try {{ {code} return 'ALLOWED'; }} catch (e) {{ return e.code; }} }})()")
    assert r == "permission-denied", f"A club was able to {what}: {r}"


def test_club_cannot_mark_own_order_paid(account):
    r = account["page"].p.evaluate(f"""(async () => {{ {FB}
        const q = await fs.getDocs(fs.query(fs.collection(D, 'orders'), fs.where('clubId', '==', me)));
        if (!q.docs.length) return 'no order';
        try {{ await fs.updateDoc(q.docs[0].ref, {{status: 'paid'}}); return 'ALLOWED'; }} catch (e) {{ return e.code; }} }})()""")
    assert r == "permission-denied"
