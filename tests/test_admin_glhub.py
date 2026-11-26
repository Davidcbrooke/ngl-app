"""NGL Admin · General League Hub: view as gymnast (sample data), copied from ngl-general-league-hub-demo.html?admin=1.
Sample data is the original demo's made-up gymnasts, in memory; nothing is fetched or saved."""


def open_hub(page, hash_="#/admin/gl-hub"):
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#ghRoot .gh-label", timeout=20000)


def test_glhub_opens(page):
    open_hub(page)
    assert "GENERAL LEAGUE HUB" in page.p.inner_text("#page h1").upper()
    root = page.p.inner_text("#ghRoot")
    for t in ["DEMO · made-up gymnasts and results · nothing is saved", "View as gymnast",
              "Search by name, BG number or club, then open their hub exactly as their family will see it.",
              "Read-only: no emails are sent and nothing is changed.", "Search gymnasts", "2 gymnasts"]:
        assert t.upper() in root.upper(), t
    # made-up comparison gymnasts are not listed, only the two sample gymnasts
    assert page.p.locator("#ghResults .gh-pick").count() == 2


def test_search_finds_gymnast(page):
    open_hub(page)
    page.p.fill("#ghQ", "maisie")
    page.p.wait_for_function("document.querySelectorAll('#ghResults .gh-pick').length === 1", timeout=5000)
    pick = page.p.inner_text("#ghResults .gh-pick")
    assert "Maisie Hart" in pick and "Demo Gymnastics Club · WAG Level 1 · BG 1000002" in pick
    assert "1 GYMNAST" in page.p.inner_text("#ghResults .gh-sec").upper()
    page.p.fill("#ghQ", "1000001")
    page.p.wait_for_selector("#ghResults .gh-pick:has-text('Oliver Hart')", timeout=5000)
    page.p.fill("#ghQ", "nobody here")
    page.p.wait_for_selector("#ghResults .gh-sec:has-text('0 gymnasts')", timeout=5000)


def test_hub_sections_girl(page):
    open_hub(page)
    page.p.fill("#ghQ", "Maisie")
    page.p.click("#ghResults .gh-pick")
    page.p.wait_for_selector("#ghRoot .gh-screen[data-tab=home]", timeout=10000)
    assert "Back to search" in page.p.inner_text("#ghRoot .gh-label")
    home = page.p.inner_text("#ghRoot .gh-screen")
    for t in ["2027 General League", "Maisie Hart", "WAG Level 1", "League position · WAG Level 1", "gymnasts",
              "All-around total", "from best scores on each apparatus.", "Best scores", "See progress",
              "Next competition", "General League · Round 4", "Hertfordshire · arrive 08:15", "Squad 3", "Starts on Floor"]:
        assert t.upper() in home.upper(), t
    assert page.p.locator("#ghRoot .gh-stat").count() == 4
    # Stats
    page.p.click("#ghRoot .gh-tabs a:has-text('Stats')")
    page.p.wait_for_selector("#ghRoot .gh-screen[data-tab=stats]", timeout=10000)
    stats = page.p.inner_text("#ghRoot .gh-screen")
    for t in ["Progress this season", "All-around", "League position", "Best per apparatus", "Balance Beam", "PB last comp"]:
        assert t.upper() in stats.upper(), t
    assert page.p.locator("#ghRoot svg.gh-graph polyline").count() == 4
    assert "Round 3" in page.p.text_content("#ghRoot svg.gh-graph")
    assert "Training League" not in stats   # girls' Training League isn't on the hub
    # Comps
    page.p.click("#ghRoot .gh-tabs a:has-text('Comps')")
    page.p.wait_for_selector("#ghRoot .gh-screen[data-tab=comps]", timeout=10000)
    comps = page.p.inner_text("#ghRoot .gh-screen")
    for t in ["Coming up", "Arrive 08:15 · warm-up 08:45", "Squad 3, starts on Floor", "Competitions entered",
              "General League · Round 1", "General League · Round 3", "East Midlands · WAG Level 1", " of 23"]:
        assert t.upper() in comps.upper(), t
    # Card
    page.p.click("#ghRoot .gh-tabs a:has-text('Card')")
    page.p.wait_for_selector("#ghCanvas", timeout=10000)
    card = page.p.inner_text("#ghRoot .gh-screen")
    for t in ["Add photo", "Save card", "How the ratings work", "Each apparatus gets a rating from where Maisie's best score sits among WAG Level 1 gymnasts this season.",
              "SPD · Speed", "CTL · Control", "Photos stay on this device. They are never uploaded or saved by NGL."]:
        assert t.upper() in card.upper(), t
    assert page.p.evaluate("""() => { const c = document.getElementById('ghCanvas'), d = c.getContext('2d').getImageData(600, 300, 1, 1).data; return d[3] > 0; }""")
    with page.p.expect_download() as dl:
        page.p.click("[data-act=gh-save]")
    assert dl.value.suggested_filename == "NGL_Player_Maisie_Hart.png"


def test_hub_sections_boy_training_league(page):
    open_hub(page, "#/admin/gl-hub/1000001/stats")
    page.p.wait_for_selector("#ghRoot .gh-screen[data-tab=stats] .gh-pl", timeout=10000)
    stats = page.p.inner_text("#ghRoot .gh-screen")
    for t in ["Training League", "OVR", "1st of 12 · 9-11 · 2-5 hrs", "10m Sprint", "Handstand Hold", "Pommel"]:
        assert t.upper() in stats.upper(), t
    page.p.click("#ghRoot .gh-tabs a:has-text('Comps')")
    page.p.wait_for_selector("#ghRoot [data-act=gh-video]", timeout=10000)
    page.p.click("#ghRoot [data-act=gh-video]")
    assert "routine videos" in page.toast()
    page.p.click("#ghRoot .gh-tabs a:has-text('Card')")
    page.p.wait_for_selector("#ghCanvas", timeout=10000)
    card = page.p.inner_text("#ghRoot .gh-screen")
    assert "Oliver's card is built from the Training League" in card and "See the Training League table" in card


def test_glhub_on_phone(phone):
    phone.go("#/admin/gl-hub", demo=True)
    phone.p.wait_for_selector("#ghRoot .gh-pick", timeout=20000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    for tab in ["", "/stats", "/comps", "/card"]:
        phone.route("#/admin/gl-hub/1000001" + tab)
        phone.p.wait_for_selector("#ghRoot .gh-screen", timeout=10000)
        assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), tab
