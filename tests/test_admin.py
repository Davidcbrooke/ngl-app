"""NGL Admin: every admin screen opens (sample data); clubs never see or reach it."""
import pytest

ADMIN = ["#/admin", "#/admin/clubs", "#/admin/clubs/demo", "#/admin/orders", "#/admin/orders/unpaid", "#/admin/orders/all",
         "#/admin/competitions", "#/admin/competitions/c1", "#/admin/music", "#/admin/music/c1", "#/admin/team", "#/admin/sales"]


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


def test_club_has_no_admin(account):
    pg = account["page"]
    pg.route("#/home")
    assert pg.p.locator(".admin-link").count() == 1      # always at the bottom of the menu
    pg.route("#/admin")
    assert "admin staff only" in pg.p.inner_text("#page").lower() and pg.p.locator("#admGate").count() == 1



def test_admin_places_waiting_for_a_club(page):
    page.go("#/admin/competitions/waiting", demo=True)
    page.p.wait_for_selector("[data-act=adm-attach]", timeout=15000)
    t = page.p.inner_text("#page").upper()
    assert "SEGC" in t and "RAANS" in t


def test_admin_has_every_app(page):
    page.go("#/admin", demo=True)
    page.p.wait_for_selector(".appt", timeout=15000)
    assert page.p.locator(".appt").count() == 20          # the 19 original Admin Hub apps + Orders
    hrefs = page.p.eval_on_selector_all(".appt", "els => els.map(e => e.getAttribute('href'))")
    assert all(h.startswith("#/admin/") and not h.startswith("#/admin/app/") for h in hrefs), hrefs   # every app is rebuilt inside the app now
    assert page.p.locator(".appt .livetag").count() == 0


def test_admin_team_grid(page):
    page.go("#/admin/team", demo=True)
    page.p.wait_for_selector("input[data-team]", timeout=15000)
    assert page.p.locator("input[data-team]").count() == 3 * 20          # 3 people x 20 apps
    assert page.p.locator("input[data-team='christine@example.com']:checked").count() == 4
    assert "CHRISTINE" in page.p.inner_text("#page").upper()


def test_team_member_sees_only_their_apps(page):
    page.p.goto(page.base + "?demo&staff#/admin")
    page.p.wait_for_selector(".appt", timeout=20000)
    names = [n.upper() for n in page.p.locator(".appt b").all_inner_texts()]
    assert names == ["COMPETITIONS", "TICKET SALES", "FLOOR MUSIC", "COMPETITION MUSIC PLAYER"], names
    tabs = page.p.inner_text(".sub").upper()
    assert "COMPETITIONS" in tabs and "CLUBS" not in tabs and "TEAM" not in tabs
    page.p.evaluate("location.hash = '#/admin/clubs'")
    page.p.wait_for_timeout(1500)
    assert "don’t have access" in page.p.inner_text("#page")


def test_ticket_sales(page):
    page.go("#/admin/sales", demo=True)
    page.p.wait_for_selector(".ts-comp", timeout=15000)
    t = page.p.inner_text("#page")
    assert "187" in t                                    # 104 + 61 + 22 gymnasts sold (the 4th JustGo event matches no competition)
    assert "SAADI Gymnastics" in t and "not matched" in t   # bookers turned into clubs; an unmatched JustGo event listed
    assert page.p.locator(".ts-comp").count() == 3


def test_club_sees_staff_only_admin_login(page):
    page.p.goto(page.base + "?demo&notadmin#/home")
    page.p.wait_for_selector("#page h1")
    assert page.p.locator("#nav .admin-link").count() == 1
    page.route("#/admin")
    txt = page.p.inner_text("#page")
    assert "this is for ngl admin staff only" in txt.lower()
    assert page.p.locator("#admGate #agEmail").count() == 1 and page.p.locator("#admGate #agPw").count() == 1
