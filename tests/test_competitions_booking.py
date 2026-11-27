"""Competitions for clubs: the four stages (coming up, reserve free, book and pay, floor music),
and the booking switch in NGL Admin (not open / reserved clubs first / open to all)."""


def test_four_stages_and_booking_states(page):
    page.go("#/competitions", demo=True)
    txt = page.p.inner_text("#page")
    for s in ["coming up", "reserve places, free", "buy now", "upload floor music", "your reserved competitions"]:
        assert s in txt.lower()
    low = txt.lower()
    # the competition as a whole, then this club
    assert "fully reserved" in low and "places left" in low and "your club" in low
    assert "12 reserved · open now" in low          # c1: reserved, link saved
    assert "booked · 6 places" in low               # c2: bought on JustGo
    assert "on the waiting list" in low
    assert page.p.locator("[data-act=book]").count() >= 2
    assert page.p.locator("[data-wait]").count() >= 1   # full competitions: join the waiting list
    page.p.click("[data-act=book] >> nth=0")
    assert "JustGo Events" in page.toast()


def test_my_places_shows_book_button(page):
    page.go("#/competitions/places", demo=True)
    assert page.p.locator("[data-act=book]").count() == 1
    assert "BOOK BY" in page.p.inner_text("#page table").upper()


def test_home_says_booking_is_open(page):
    page.go("#/home", demo=True)
    assert "Open now: buy your reserved places" in page.p.inner_text("#page")


def test_admin_booking_switch(page):
    page.go("#/admin/competitions", demo=True)
    assert "General sale" in page.p.inner_text("#page table") or "Reserved clubs" in page.p.inner_text("#page table")
    page.p.click("[data-act=adm-booking] >> nth=0")
    page.p.wait_for_selector(".modal [name=bk]")
    assert page.p.locator(".modal [name=bk]").count() == 3
    # opening booking needs the JustGo link
    page.p.fill(".modal #url", "")
    page.p.check(".modal [name=bk][value=open]")
    page.p.click(".modal form .btn")
    assert "JustGo Events link" in page.toast()


def test_join_waiting_list_when_full(page):
    page.go("#/competitions", demo=True)
    assert "Fully reserved" in page.p.inner_text("#page")
    page.p.click("[data-wait][data-comp=c7]")
    page.p.wait_for_selector(".modal >> text=fully reserved")
    assert "Join waiting list" in page.p.inner_text(".modal")
