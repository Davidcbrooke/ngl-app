"""Recreational family side (js/family/recreational.js), on sample data: chooser, every tab, progress saved on the phone."""
import json, os

URL = "?demo&family#/family/recreational"
TABS = [("rotations", "group rotations"), ("fortnight", "Ruby · Level 1"), ("progress", "Progress"),
        ("programme", "The NGL Recreational programme"), ("levels", "Books and levels"), ("competitions", "Competitions")]


def _t(pg, sel="#famPage"):
    """Text on screen, lower case (headings are shown in capitals)."""
    return pg.p.inner_text(sel).lower()


def _no_youtube(pg):
    pg.ctx.route("**/*", lambda r: r.abort() if any(h in r.request.url for h in ("youtube", "ytimg", "googlevideo")) else r.continue_())


def _open(pg, hash_=URL):
    _no_youtube(pg)
    pg.p.goto(pg.base + hash_)
    pg.p.wait_for_selector("#famPage .fr h1", timeout=30000)


def _tab(pg, slug):
    pg.p.evaluate(f"location.hash = '#/family/recreational/{slug}'")
    pg.p.wait_for_selector(f"#famPage .fr[data-tab]", timeout=20000)
    pg.p.wait_for_timeout(400)


def _choose(pg, book=1, colour=3):
    assert "which book?" in _t(pg, "#famPage h1")
    pg.p.click(f"[data-book='{book}']")
    pg.p.wait_for_selector("[data-colour]")
    pg.p.click(f"[data-colour='{colour}']")
    pg.p.wait_for_selector("#famPage .fr[data-tab=week]", timeout=20000)


def test_chooser_and_every_tab(page):
    _open(page)
    _choose(page)
    txt = _t(page)
    assert "blue group rotations" in txt and "ruby book" in txt
    assert page.p.locator(".rcard").count() >= 5            # warm-up, three pieces, cool-down
    page.p.locator(".rbody summary").first.click()
    assert page.p.locator(".rbody[open] .fstation").count() >= 1
    assert page.p.locator(".rskill").count() >= 1            # "Skill this fortnight"
    assert "at home this fortnight" in txt
    # This fortnight: stations, warm-up, Level assessment, competition routine
    page.p.click("[data-go=fortnight]")
    page.p.wait_for_selector(".fr[data-tab=fortnight]")
    t = _t(page)
    for s in ["Ruby · Level 1", "Forward Floor", "Warm-up", "Level 1 assessment", "Ruby routine", "At home this fortnight"]:
        assert s.lower() in t, s
    assert page.p.locator(".fstation").count() > 10
    assert page.p.locator(".cvid").count() == 4
    page.p.wait_for_function("document.querySelectorAll('#famPage img[data-img][src]').length > 0", timeout=15000)   # station photos load
    page.p.locator(".thumb").first.click()
    page.p.wait_for_selector(".fr-modal img")
    page.p.click(".fr-modal [data-close]")
    for slug, h in TABS[2:]:
        _tab(page, slug)
        assert h.lower() in _t(page), slug
    t = _t(page)
    assert "recreational · ruby & pink" in t                 # sample calendar
    page.p.click("[data-complv=teal]")
    page.p.wait_for_selector("[data-complv=teal].on")
    assert "teal floor" in _t(page, "#famPage .cvids")
    _tab(page, "levels")
    assert page.p.locator("details.lvdet").count() == 20     # 16 levels + 4 routines
    # Tab bar takes you back to the rotations
    page.p.click(".ftab[data-ftab=week]")
    page.p.wait_for_selector(".fr[data-tab=week]")
    assert "group rotations" in _t(page, "#famPage h1")


def test_progress_tick_survives_reload(page):
    _open(page, "?demo&family#/family/recreational/progress")
    assert "progress" in _t(page, "#famPage h1")
    page.p.click("[data-plevel='1']")
    page.p.wait_for_selector(".fr-modal #ldate")
    page.p.fill(".fr-modal #ldate", "2026-10-03")
    page.p.click(".fr-modal [data-pact=setpass]")
    page.p.wait_for_selector(".pcell.done[data-plevel='1']")
    assert "3 oct 2026" in _t(page, ".pcell.done[data-plevel='1']")   # the date chosen in the pop-up is kept
    page.p.fill("#kname", "Ella")
    page.p.press("#kname", "Tab")
    page.p.wait_for_function("document.querySelector('#famPage .kids .chip.on').textContent.includes('Ella')")
    page.p.click("[data-pact=pass]")                          # Level 2 passed today, now on Level 3
    page.p.wait_for_selector(".pcell.done[data-plevel='2']")
    page.p.reload()
    page.p.wait_for_selector("#famPage .fr h1", timeout=30000)
    assert page.p.locator(".pcell.done").count() == 2
    assert "level 3" in _t(page, ".pnow")
    p = json.loads(page.p.evaluate("localStorage.getItem('nglrec-progress')"))
    k = p["kids"][0]
    assert k["name"] == "Ella" and k["current"] == 3 and k["passed"]["1"] == "2026-10-03"


def test_existing_progress_key_is_used(page):
    old = {"kids": [{"id": "k1", "name": "Sam", "current": 6, "passed": {"5": "2026-07-10"}}], "active": "k1"}
    page.ctx.add_init_script(f"try {{ if (!localStorage.getItem('nglrec-progress')) localStorage.setItem('nglrec-progress', {json.dumps(json.dumps(old))}); }} catch (_) {{}}")
    _open(page, "?demo&family#/family/recreational/progress")
    t = _t(page)
    assert "sam" in t and "pink book · level 6" in t
    assert page.p.locator(".pcell.done").count() == 1
    _tab(page, "choose")                                      # the app follows Sam: Pink book already picked
    assert page.p.locator("[data-book='2'].picked").count() == 1


def test_phone_no_sideways_scroll(phone):
    _open(phone)
    _choose(phone, book=2, colour=2)
    for slug, _ in [("rotations", ""), *TABS[1:]]:
        _tab(phone, slug)
        if slug == "rotations":
            phone.p.locator(".rbody summary").first.click()
        w = phone.p.evaluate("[document.documentElement.scrollWidth, document.body.scrollWidth]")
        assert max(w) <= 390, f"{slug}: page is {w} wide"
        if os.environ.get("SHOTS"):                           # SHOTS=<folder> saves phone screenshots to look at
            phone.p.screenshot(path=os.path.join(os.environ["SHOTS"], f"family-rec-{slug}.png"), full_page=True)


AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"


def test_accessible(page):
    _open(page)
    _choose(page)
    for slug in ["rotations", "fortnight", "progress", "programme", "levels", "competitions"]:
        _tab(page, slug)
        page.p.add_script_tag(url=AXE)
        res = page.p.evaluate("""async () => { const r = await axe.run('#famPage', {resultTypes: ['violations']});
            return r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id + ': ' + v.help + ' e.g. ' + v.nodes[0].target.join(' ')); }""")
        assert not res, slug + ": " + "\n".join(res)
