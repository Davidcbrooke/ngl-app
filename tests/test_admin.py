"""NGL Admin: every admin screen opens (sample data); clubs never see or reach it."""
import pytest

ADMIN = ["#/admin", "#/admin/clubs", "#/admin/clubs/demo", "#/admin/orders", "#/admin/orders/unpaid", "#/admin/orders/all",
         "#/admin/competitions", "#/admin/competitions/c1", "#/admin/music", "#/admin/music/c1"]


@pytest.mark.parametrize("hash_", ADMIN)
def test_admin_screens_open(page, hash_):
    page.go(hash_, demo=True)
    assert "NGL ADMIN" in page.p.inner_text("#page h1").upper()
    assert "admins only" not in page.p.inner_text("#page")


def test_admin_club_search(page):
    page.go("#/admin/clubs", demo=True)
    page.p.fill("#admFind", "northgate")
    visible = [r for r in page.p.locator("#admClubs tr.c").all() if r.is_visible()]
    assert len(visible) == 1 and "Northgate" in visible[0].inner_text()


def test_admin_music_shows_uploads(page):
    page.go("#/admin/music/c1", demo=True)
    t = page.p.inner_text("#page")
    assert "1 / 4" in t and "Amelia R" in t and "Download" in t


def test_club_has_no_admin(account):
    pg = account["page"]
    pg.route("#/home")
    assert pg.p.locator(".admin-link").count() == 0
    pg.route("#/admin")
    assert "admins only" in pg.p.inner_text("#page")



def test_admin_places_waiting_for_a_club(page):
    page.go("#/admin/competitions/waiting", demo=True)
    page.p.wait_for_selector("[data-act=adm-attach]", timeout=15000)
    t = page.p.inner_text("#page").upper()
    assert "SEGC" in t and "RAANS" in t


def test_admin_has_every_app(page):
    page.go("#/admin", demo=True)
    page.p.wait_for_selector(".appt", timeout=15000)
    assert page.p.locator(".appt").count() == 20          # the 19 original Admin Hub apps + Orders
    page.p.click("text=Ticket sales")
    page.p.wait_for_selector("iframe.appframe", timeout=15000)
    assert "NGL_Ticket_Sales.html" in page.p.get_attribute("iframe.appframe", "src")
