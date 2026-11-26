"""Schools family app (js/family/schools.js) on sample data: Home, Level 3 Floor/Bench/Vault, Graduation."""
import os, tempfile

# Phone screenshots to look at (outside the repo)
SHOTS = os.environ.get("NGL_SHOTS") or os.path.join(tempfile.gettempdir(), "ngl-family-schools")


def _open(pg, view=""):
    # Never load YouTube in tests: block the thumbnails and the player
    pg.p.route("**/*youtube*/**", lambda r: r.abort())
    pg.p.route("**/*ytimg*/**", lambda r: r.abort())
    pg.p.goto(pg.base + "?demo&family#/family/schools" + view)
    pg.p.wait_for_selector("#famPage .fs", timeout=20000)


def _no_sideways(pg):
    return pg.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


def _shot(pg, name):
    os.makedirs(SHOTS, exist_ok=True)
    pg.p.wait_for_selector("#nglSplash", state="detached", timeout=10000)   # the opening animation, so it isn't in the picture
    pg.p.screenshot(path=os.path.join(SHOTS, name), full_page=True)


def test_home(page):
    _open(page)
    t = page.p.text_content("#famPage")
    assert "Welcome to NGL Schools" in t and "SAADI Gymnastics" in t
    assert "Learn the routines" in t and "Levels 1–6" in t
    assert page.p.locator(".fs-level-card").count() == 6
    for chip in ["Pre-School", "Schools", "Recreational", "General", "Performance", "University", "Masters"]:
        assert chip in t
    assert page.p.inner_text(".fs-jstep.on") == "Schools"
    assert "NGL Graduation" in t and "Core Skills & Strength" in t and "Soon" in t
    assert "Club code SAADI-7K4P · 2026/27" in t and "Use a different code" in t
    # The medals are files now, not inline images
    assert page.p.eval_on_selector(".fs-level-card img", "i => i.complete && i.naturalWidth > 0 && !i.src.startsWith('data:')")


def test_level_tabs(page):
    _open(page)
    page.p.click(".fs-level-card:nth-child(3)")
    page.p.wait_for_function("location.hash === '#/family/schools/level/3/floor'")
    page.p.wait_for_selector(".fs-seg button.active")
    assert page.p.text_content("#famPage h1") == "Level 3"
    assert [b.inner_text() for b in page.p.query_selector_all(".fs-seg button")] == ["Floor", "Bench", "Vault"]
    # Floor: video + skills in order
    assert "Floor routine" in page.p.inner_text("#famPage")
    assert page.p.locator(".fs-skills li").count() == 14 and page.p.inner_text(".fs-skills li >> nth=0") == "Tuck jump"
    page.p.click(".fs-video")
    src = page.p.get_attribute(".fs-video iframe", "src")
    assert src.startswith("https://www.youtube-nocookie.com/embed/h16vKU5tP4U")
    # Bench
    page.p.click(".fs-seg button:has-text('Bench')")
    page.p.wait_for_function("location.hash.endsWith('/level/3/bench')")
    page.p.wait_for_selector("text=Also works on a low beam")
    assert page.p.locator(".fs-video[data-yt=xitDvlyhDuk]").count() == 1
    page.p.click(".fs-video")
    assert "xitDvlyhDuk" in page.p.get_attribute(".fs-video iframe", "src")
    # Vault: Block and Block + springboard
    page.p.click(".fs-seg button:has-text('Vault')")
    page.p.wait_for_function("location.hash.endsWith('/level/3/vault')")
    page.p.wait_for_selector("text=Block & springboard")
    t = page.p.inner_text("#famPage")
    assert "Run, squat on, tuck jump off" in t and "Run, tuck jump off springboard to land" in t
    assert page.p.locator(".fs-video").count() == 2
    for v in page.p.query_selector_all(".fs-video"):
        v.click()
    assert page.p.locator(".fs-video iframe").count() == 2
    # Next level keeps the apparatus
    page.p.click("text=Level 4 ›")
    page.p.wait_for_function("location.hash.endsWith('/level/4/vault')")


def test_graduation(page):
    _open(page, "/graduation")
    page.p.wait_for_selector(".fs-event")
    t = page.p.text_content("#famPage")
    assert "Your certificates" in t and "Bronze" in t and "Silver" in t and "Gold" in t
    assert "£12 per gymnast, including one spectator; extra spectators £6" in t
    assert page.p.locator(".fs-medal-strip img").count() == 6
    assert page.p.locator(".fs-event").count() == 2
    assert "For Redbourn Primary School gymnasts" in t and "Arrive 30 minutes early." in t
    assert page.p.locator(".fs-event a:has-text('Book a place')").count() == 1
    assert "Ask your club or school how to book a place." in t


def test_phone_no_sideways_scroll(phone):
    _open(phone)
    assert _no_sideways(phone); _shot(phone, "family-schools-home.png")
    for view, name in [("/routines", "routines"), ("/level/6/floor", "level6-floor"), ("/level/1/vault", "level1-vault"), ("/graduation", "graduation")]:
        phone.p.evaluate(f"location.hash = '#/family/schools{view}'")
        phone.p.wait_for_function("h => location.hash === h", arg="#/family/schools" + view)
        phone.p.wait_for_timeout(600)
        if view == "/graduation":
            phone.p.wait_for_selector(".fs-event")
        assert _no_sideways(phone), view
        _shot(phone, f"family-schools-{name}.png")
