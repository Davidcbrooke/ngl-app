"""General League for families (js/family/general.js): home tiles, each page in an iframe, help box, phone layout.
The GitHub pages are route-blocked with a stub so the tests stay fast and offline-safe."""
import pytest

GH = "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/"
PAGES = {
    "results": GH + "RESULTS-VIEWER.HTML",
    "league": GH + "ngl-live-league-2027.html?family=1",
    "qualifiers": GH + "national-qualifier.html?family=1",
    "training": GH + "ngl-training-league.html?site=1",
}


def stub(pg):
    pg.p.route("https://davidcbrooke.github.io/**", lambda r: r.fulfill(status=200, content_type="text/html", body="<!doctype html><title>stub</title><p>stub</p>"))


def open_home(pg):
    stub(pg)
    pg.p.goto(pg.base + "?demo&family#/family/general")
    pg.p.wait_for_selector("#famPage .fg-tile", timeout=20000)


def test_home(page):
    open_home(page)
    txt = page.p.text_content("#famPage")
    assert "Follow every result" in txt
    assert "Open to every NGL family, no code needed." in txt
    assert "No code yet?" in txt and "Clubs find their family codes in their NGL hub." in txt
    for k in PAGES:
        assert page.p.locator(f'[data-fg-tile="{k}"]').count() == 1
    assert page.p.locator('link[data-fam-css="general"]').count() == 1
    assert page.p.locator(".fam-tabs a.on").inner_text() == "General League"


@pytest.mark.parametrize("k", list(PAGES))
def test_page_iframe(page, k):
    open_home(page)
    page.p.click(f'[data-fg-tile="{k}"]')
    page.p.wait_for_selector("#fgFrame", timeout=10000)
    assert page.p.evaluate("location.hash") == f"#/family/general/{k}"
    assert page.p.get_attribute("#fgFrame", "src") == PAGES[k]
    h = page.p.evaluate("document.getElementById('fgFrame').getBoundingClientRect().height")
    assert h >= 420
    page.p.click(".fg-back")
    page.p.wait_for_selector("#famPage .fg-tile", timeout=10000)
    assert page.p.locator("#fgFrame").count() == 0
    assert page.p.locator('link[data-fam-css="general"]').count() == 1


def test_add_code_opens_parent_screen(page):
    open_home(page)
    page.p.click('#famPage [data-fg="add"]')
    page.p.wait_for_selector("#pcode", timeout=10000)


def test_phone(phone):
    open_home(phone)
    no_scroll = "document.documentElement.scrollWidth <= window.innerWidth"
    assert phone.p.evaluate(no_scroll)
    phone.p.click('[data-fg-tile="league"]')
    phone.p.wait_for_selector("#fgFrame", timeout=10000)
    phone.p.wait_for_timeout(300)
    assert phone.p.evaluate(no_scroll)
    # fills the screen below the bar (as the original does)
    r = phone.p.evaluate("(() => { const b = document.getElementById('fgFrame').getBoundingClientRect(); return [b.top, b.height, innerHeight]; })()")
    assert abs(r[0] + r[1] + 16 - r[2]) <= 2 or r[1] == 420
