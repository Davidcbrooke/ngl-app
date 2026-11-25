"""A new club's journey on the STAGING database: reserve, change, calendar, cancel,
shop, order, invoice, log out and back in. Runs in order, sharing one test club."""


def test_new_club_lands_on_home(account):
    pg = account["page"]
    assert "AUTOTEST GYMNASTICS CLUB" in pg.p.inner_text("#page h1").upper()
    assert "Reserve places for 2027" in pg.p.inner_text("#page")


def test_reserve_change_and_calendar(account):
    pg = account["page"]
    pg.route("#/competitions")
    pg.p.click("[data-act=reserve] >> nth=0")
    pg.p.fill("#n", "8")
    pg.p.click(".modal form .btn")
    assert "Your reference is NGL-" in pg.toast()
    pg.route("#/competitions/places")
    assert "8" in pg.p.inner_text("#page table")
    pg.p.click("[data-act=change-res] >> nth=0")
    pg.p.fill("#n", "12")
    pg.p.click(".modal form .btn")
    pg.p.wait_for_timeout(2500)
    assert "12" in pg.p.inner_text("#page table")
    with pg.p.expect_download() as d:
        pg.p.click("[data-act=ics][data-comp=all]")
    ics = open(d.value.path(), encoding="utf-8").read()
    assert ics.startswith("BEGIN:VCALENDAR") and "12 places reserved" in ics


def test_cancel_reservation(account):
    pg = account["page"]
    pg.route("#/competitions/places")
    pg.p.click("[data-act=change-res] >> nth=0")
    pg.p.click("[data-cancel]")
    pg.p.click("[data-cancel]")
    pg.p.wait_for_selector("text=No places reserved yet", timeout=15000)


def test_basket_order_and_invoice(account):
    pg = account["page"]
    pg.route("#/shop")
    pg.p.click("[data-act=add][data-prod=gbook]")
    pg.p.wait_for_selector(".basket >> text=£44")          # 10 × £4 + £4 postage
    pg.p.click("[data-act=checkout]")
    pg.p.fill("#addr", "AUTOTEST club, 1 Test Road, AB1 2CD")
    pg.p.click(".modal form .btn")
    placed = pg.p.wait_for_selector(".modal >> text=placed", timeout=20000)
    ref = placed.inner_text().split()[1]
    assert ref.startswith("ORD-")
    pg.p.wait_for_selector("text=Test address: no email sent.", timeout=15000)
    pg.p.click(".modal a[data-close]")
    pg.p.wait_for_selector("#page h1 >> text=" + ref, timeout=15000)
    assert "Awaiting payment" in pg.p.inner_text("#page")
    pg.p.click("[data-act=invoice]")
    inv = pg.p.wait_for_selector(".inv").inner_text()
    assert ref in inv and "£44" in inv and "AUTOTEST" in inv
    pg.p.click("[data-shut]")


def test_log_out_and_back_in(account):
    pg = account["page"]
    pg.route("#/club")
    pg.p.click("#page [data-act=signout]")
    pg.p.wait_for_selector("#authRoot h1", timeout=15000)
    pg.p.fill("#email", account["email"])
    pg.p.fill("#pw", account["pw"])
    pg.p.click("#f button")
    pg.p.wait_for_selector("#page h1", timeout=20000)
    pg.route("#/shop/orders")
    assert "ORD-" in pg.p.inner_text("#page")
