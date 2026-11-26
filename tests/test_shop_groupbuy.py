"""Shop · Group buying (#/shop/groupbuy): the club's quarterly staff-kit order, copied from GYMNASTICS-RESULTS/ngl-group-order.html.
Sample data (?demo): the board starts at 66 t-shirts (3 orders) and 30 quarter zips (2 orders), as in NGL Admin · Group purchasing.
Prices worked out by hand: 10 adult t-shirts, first order = 10 × £8.20 + £25 set-up + £20 delivery = £127.00 + £25.40 VAT = £152.40.
Staging (the `account` fixture): places a real order of one t-shirt with a tiny PNG logo for "AUTOTEST Gymnastics Club". A club can't
delete its own group orders, so the order stays in the open round marked AUTOTEST (and adds 1 to that round's board); NGL Admin can ignore
or delete it. Needs this repo's firestore.rules and storage.rules published to staging (NGL_RULES_PENDING=1 skips it until then)."""
import os
import pytest

# A 1×1 PNG
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                    "1f15c4890000000d49444154789c6360f8cfc0f01f0005000201e2d0b5"
                    "b10000000049454e44ae426082")
LOGO = {"name": "club-logo.png", "mimeType": "image/png", "buffer": PNG}


def open_gbo(pg, demo=True):
    pg.go("#/shop/groupbuy", demo=demo)
    pg.p.wait_for_selector("#gboRoot #gboForm", timeout=20000)


def fill_order(pg, sizes, address=True):
    for z, n in sizes.items():
        pg.p.fill(f"#gboRoot [data-size='{z}']", str(n))
    pg.p.set_input_files("#gboRoot [data-file=front]", LOGO)
    pg.p.wait_for_selector("#gboRoot .gbo-drop.has", timeout=5000)
    if address:
        pg.p.fill("#gboRoot [data-f=a1]", "1 Test Road")
        pg.p.fill("#gboRoot [data-f=town]", "Testtown")
        pg.p.fill("#gboRoot [data-f=pc]", "AB1 2CD")
    pg.p.check("#gboRoot [data-s=agree]")


def test_form_renders_like_the_old_page(page):
    open_gbo(page)
    assert "GROUP BUYING" in page.p.inner_text("#page h1").upper()
    root = page.p.inner_text("#gboRoot")
    assert "THE MORE CLUBS ORDER, THE LESS EVERYONE PAYS" in root.upper()
    assert "LIVE ORDER BOARD" in root.upper() and "THIS ORDER CLOSES IN" in root.upper()
    # Products with the maker's photos, 52 Cool T colours, adult and children's sizes
    assert page.p.locator(".gbo-pc").count() == 2
    assert page.p.locator(".gbo-pc").nth(0).inner_text().upper().startswith("STAFF T-SHIRT")
    assert "£8.20 each, dropping to £5.45. Logo included" in page.p.inner_text(".gbo-pc >> nth=0")
    assert page.p.locator(".gbo-sw").count() == 52
    assert page.p.locator("[data-size]").count() == 14
    assert "Children’s sizes" in root and "no VAT" in root
    assert "THE SLEEVE (OPTIONAL EXTRA)" not in root.upper()
    assert "No payment now. You'll pay by card when the round closes and the final price is known." in root
    # The club's details come from its account
    assert page.p.input_value("[data-f=club]") == "SAADI Gymnastics"
    assert page.p.input_value("[data-f=email]") == "demo@club.example"
    # Quarter zip: 11 colours, 8 sizes with chest sizes, and the sleeve step
    page.p.click(".gbo-pc[data-pid=LV874]")
    page.p.wait_for_selector(".gbo-pc[data-pid=LV874][aria-checked=true]")
    assert page.p.locator(".gbo-sw").count() == 11
    assert page.p.locator("[data-size]").count() == 8
    assert "THE SLEEVE (OPTIONAL EXTRA)" in page.p.inner_text("#gboRoot").upper()
    assert '32/34"' in page.p.inner_text(".gbo-sizes")
    # Colour pick
    page.p.click(".gbo-sw[aria-label='Navy/White']")
    assert page.p.inner_text("#gboColName") == "Navy/White"


def test_board_and_totals(page):
    open_gbo(page)
    tee = page.p.locator(".gb-brow[data-pid=JC001]")
    assert tee.locator("[data-b=qty]").inner_text() == "66"
    assert tee.locator("[data-b=now]").inner_text() == "£8.20"
    assert tee.locator("[data-b=nexts]").inner_text() == "at 100 · 34 to go"
    assert "20 more quarter zips needed" in page.p.locator(".gb-minline").nth(1).inner_text()
    page.p.wait_for_function("document.getElementById('gboCdS').textContent !== '–'", timeout=5000)
    page.p.fill("[data-size=M]", "10")
    assert page.p.inner_text("#gboQty") == "10 shirts"
    s = page.p.inner_text("#gboSummary")
    assert "10 × French Navy staff t-shirt, adult sizes, front logo" in s and "Logo set-up (first order only)" in s
    assert page.p.inner_text("#gboMost") == "£152.40"
    # Repeat order (no set-up) and children's sizes (no VAT): 10 × £8.20 + 4 × £8.20 + £20 = £134.80;
    # VAT = 20% × (£82 + £20 × 82/114.80) = £19.26 → £154.06
    page.p.click("label:has(input[name=gbo-setup][value=repeat])")
    page.p.wait_for_selector("input[name=gbo-setup][value=repeat]:checked")
    page.p.fill("[data-size='7/8']", "4")
    assert page.p.inner_text("#gboQty") == "14 shirts"
    assert "4 × French Navy staff t-shirt, children’s sizes (no VAT)" in page.p.inner_text("#gboSummary")
    assert page.p.inner_text("#gboMost") == "£154.06"
    # Back text adds £2.00 each and shows on the drawing
    page.p.click("label:has(input[name=gbo-back][value=text])")
    page.p.wait_for_selector("[data-s=line1]")
    page.p.fill("[data-s=line1]", "COACH")
    assert "COACH" in page.p.inner_html("svg[data-side=back]")
    assert "Back print: two lines of text" in page.p.inner_text("#gboSummary")


def test_missing_details_are_listed(page):
    open_gbo(page)
    page.p.fill("[data-f=a1]", "")
    page.p.click("[data-act=gbo-place]")
    err = page.p.inner_text("#gboErr")
    assert err.startswith("Please add at least one shirt, your club logo, the delivery address and a tick to agree")


def test_place_order_with_sample_data(page):
    open_gbo(page)
    fill_order(page, {"S": 4, "M": 6})
    page.p.click("[data-act=gbo-place]")
    page.p.wait_for_selector("#gboDone", timeout=10000)
    done = page.p.inner_text("#gboDone")
    assert "ORDER PLACED. THANK YOU!" in done.upper() and "NGL-" in done
    assert "10 × French Navy shirts for SAADI Gymnastics" in done
    assert "pay by card" in done and "Sample data: nothing was saved." in done
    # The board counts it, and it shows under Your orders this round
    assert page.p.locator(".gb-brow[data-pid=JC001] [data-b=qty]").inner_text() == "76"
    assert "from 4 orders" in page.p.inner_text(".gb-brow[data-pid=JC001] [data-b=orders]")
    mine = page.p.inner_text("#gboMine")
    assert "Your orders this round".upper() in mine.upper() and "Placed" in mine
    page.p.click("[data-act=gbo-again]")
    page.p.wait_for_selector("#gboForm")
    assert page.p.input_value("[data-size=M]") == "0"


def test_shop_home_links_to_group_buying(page):
    page.go("#/shop", demo=True)
    page.p.click("a[href='#/groupbuy'] >> text=Order staff kit")
    page.p.wait_for_selector("#gboRoot", timeout=15000)
    assert "GROUP BUYING" in page.p.inner_text("#page h1").upper()
    assert page.p.locator("#nav a.on[href='#/groupbuy']").count() == 1     # its own place on the menu


def test_group_buying_invoice_is_paid_in_shop_orders(page):
    """The sample club's last-round invoice (GB…-05, £585.60) waits in Shop & orders as Not paid · Finish payment."""
    page.go("#/shop/orders", demo=True)
    row = page.p.locator("#page tr", has_text="ORD-GB")
    assert row.count() == 1
    t = row.inner_text()
    assert "£585.60" in t and "Not paid" in t and "Group buying" in t
    assert row.locator("[data-act=pay]").count() == 1
    row.locator("a").first.click()
    page.p.wait_for_selector("#page h1 >> text=ORD-GB", timeout=10000)
    txt = page.p.inner_text("#page")
    assert "VAT at 20%" in txt and "Finish payment: £585.60" in txt and "Sent to print" in txt


def test_no_bank_details(page):
    open_gbo(page)
    text = page.p.inner_text("body").lower()
    assert "60-84-64" not in text and "93416867" not in text and "bank transfer" not in text


def test_phone_no_sideways_scroll(phone):
    open_gbo(phone)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    phone.p.click(".gbo-pc[data-pid=LV874]")
    phone.p.wait_for_selector(".gbo-pc[data-pid=LV874][aria-checked=true]")
    phone.p.click("label:has(input[name=gbo-sleeve][value=text])")
    phone.p.wait_for_selector("[data-s=sleeveLine]")
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    if os.environ.get("NGL_SHOTS"):
        phone.p.screenshot(path=os.path.join(os.environ["NGL_SHOTS"], "shop-groupbuy-phone.png"), full_page=True)


# ---------- Staging database: a real order ----------
def test_club_places_a_real_order(account):
    pg = account["page"]
    pg.route("#/shop/groupbuy")
    pg.p.wait_for_selector("#gboRoot #gboForm", timeout=20000)
    assert pg.p.input_value("[data-f=club]") == "AUTOTEST Gymnastics Club"
    assert pg.p.input_value("[data-f=email]") == account["email"]
    fill_order(pg, {"S": 1})
    pg.p.click("[data-act=gbo-place]")
    pg.p.wait_for_selector("#gboDone, #gboErr:not(:empty)", timeout=30000)
    err = pg.p.inner_text("#gboErr") if pg.p.locator("#gboErr").count() else ""
    if "permission-denied" in err and os.environ.get("NGL_RULES_PENDING"):
        pytest.skip("Staging firestore.rules / storage.rules not published yet (Firebase console). Unset NGL_RULES_PENDING once they are published.")
    assert pg.p.locator("#gboDone").count(), err
    done = pg.p.inner_text("#gboDone")
    assert "ORDER PLACED" in done.upper() and "logo didn’t upload" not in done
    r = pg.p.evaluate("""(async () => { const m = await import('./js/firebase.js'), {fs, A, D} = await m.fb(), me = A.currentUser.uid;
      const q = await fs.getDocs(fs.query(fs.collection(D, 'ngl_groupbuy_orders'), fs.where('clubId', '==', me)));
      const gb = await import('./js/admin/groupbuy.js'), mine = q.docs.map(d => d.data()).filter(o => o.round === gb.roundFor().id), o = mine[0] || {};
      const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'), {getApp} = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      let logo = 'no'; try { await st.getDownloadURL(st.ref(st.getStorage(getApp()), o.logoPath)); logo = 'yes'; } catch (e) { logo = e.code; }
      return [mine.length, o.clubId === me, o.status, o.qty, o.club, o.product, logo]; })()""")
    assert r[:6] == [1, True, "placed", 1, "AUTOTEST Gymnastics Club", "JC001"], r
    assert r[6] == "yes", r
    mine = pg.p.inner_text("#gboMine")
    assert "Staff T-shirt" in mine and "Placed" in mine     # the club's own order appears in its list (the list doesn't show club names)



def test_be_better_pillars(page):
    page.go("#/better", demo=True)
    t = page.p.inner_text("#page")
    for p in ["Operate Better", "Coach Better", "Care Better", "Grow Better", "Connect Better"]:
        assert p.upper() in t.upper()
    for partner in ["JustGo", "Matt Jackson Gymnastics Consultancy", "Impact HR", "Working With Parents in Sport", "Rebound Therapy"]:
        assert partner in t
    page.p.click("a.bb-chip[href='#/better/care']")
    page.p.wait_for_function("location.hash === '#/better/care'")
    page.p.wait_for_timeout(800)
    t = page.p.inner_text("#page")
    assert "Impact HR" in t and "JustGo" not in t


def test_group_buying_on_the_menu(page):
    page.go("#/home", demo=True)
    page.p.click("#nav a[href='#/groupbuy']")
    page.p.wait_for_function("location.hash === '#/groupbuy'")
    page.p.wait_for_selector("#page h1 >> text=Group Buying", timeout=15000)
