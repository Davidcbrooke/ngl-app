"""Competitions for clubs: the four stages (coming up, reserve free, book and pay, floor music),
and the booking switch in NGL Admin (not open / reserved clubs first / open to all)."""


def test_four_stages_and_booking_states(page):
    page.go("#/competitions", demo=True)
    txt = page.p.inner_text("#page")
    for s in ["Coming up", "Reserve places, free", "Book and pay", "Upload floor music"]:
        assert s in txt
    # c1: this club reserved and NGL opened booking to reserved clubs -> Book and pay
    assert "Your priority booking" in txt
    # c3: open to all -> Book and pay for anyone
    assert "Open for booking" in txt
    # c4: reserved, booking not open yet
    assert "not open for booking yet" in txt
    assert page.p.locator("[data-act=book]").count() == 2
    page.p.click("[data-act=book] >> nth=0")
    assert "JustGo Events" in page.toast()


def test_my_places_shows_book_button(page):
    page.go("#/competitions/places", demo=True)
    assert page.p.locator("[data-act=book]").count() == 1
    assert "BOOK BY" in page.p.inner_text("#page table").upper()


def test_home_says_booking_is_open(page):
    page.go("#/home", demo=True)
    assert "Booking is open" in page.p.inner_text("#page")


def test_admin_booking_switch(page):
    page.go("#/admin/competitions", demo=True)
    assert "Reserved clubs" in page.p.inner_text("#page table")
    page.p.click("[data-act=adm-booking] >> nth=0")
    page.p.wait_for_selector(".modal [name=bk]")
    assert page.p.locator(".modal [name=bk]").count() == 3
    # opening booking needs the JustGo link
    page.p.fill(".modal #url", "")
    page.p.check(".modal [name=bk][value=open]")
    page.p.click(".modal form .btn")
    assert "JustGo Events link" in page.toast()
