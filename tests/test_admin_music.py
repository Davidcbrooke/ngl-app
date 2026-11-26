"""NGL Admin · Floor music and Competition music player (sample data), copied from NGL_Music_Admin.html.
Sample data keeps every change in memory and plays generated tones; nothing touches the database or Storage."""


def open_music(page, hash_="#/admin/music"):
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#muRoot .mu-tbl tr[data-id]", timeout=20000)


def open_player(page, hash_="#/admin/musicplayer"):
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#muQueue .mu-qr[data-qid]", timeout=20000)


def test_running_order_shows(page):
    open_music(page)
    assert "FLOOR MUSIC" in page.p.inner_text("#page h1").upper()
    heads = page.p.locator("#muLevels .mu-lv h2").all_inner_texts()
    assert any("MORNING" in h.upper() for h in heads) and any("AFTERNOON" in h.upper() for h in heads)
    # floor order from the Elevien schedule: Rotation 1 starts with Amelia Roberts, bib 11
    first = page.p.locator("#muLevels .mu-rot[data-r='1'] tr[data-id]").first
    assert "Amelia Roberts" in first.inner_text() and "11" in first.inner_text()
    # Millie Shaw isn't in a floor rotation yet, and is new since publishing
    assert "Millie Shaw" in page.p.inner_text("#muLevels .mu-rot[data-r='u']")
    assert "1 new (Millie Shaw)" in page.p.inner_text("#muDiffTop")


def test_uploaded_and_missing_counts(page):
    open_music(page)
    tally = page.p.inner_text("#muTally")
    assert "7/11" in tally and "Music uploaded" in tally and "Open" in tally
    assert page.p.locator("#muLevels tr.mu-ok").count() == 7
    assert page.p.locator("#muLevels tr[data-id]:not(.mu-ok)").count() == 4
    assert "Not uploaded" in page.p.inner_text("#muLevels tr[data-id=d103]")


def test_mark_absent_updates_screen(page):
    open_music(page)
    row = page.p.locator("#muLevels tr[data-id=d101]")
    assert "mu-abs" not in row.get_attribute("class")
    row.locator("input[data-abs]").check()
    page.p.wait_for_selector("#muLevels tr.mu-abs[data-id=d101]", timeout=10000)
    assert "Absent" in page.p.inner_text("#muLevels tr[data-id=d101]")


def test_move_down_changes_order(page):
    open_music(page)
    page.p.click("#muLevels tr[data-id=d101] [data-act=mu-mv][data-mv='d101|1']")
    page.p.wait_for_function("document.querySelector(\"#muLevels .mu-rot[data-r='1'] tr[data-id]\").dataset.id === 'd102'", timeout=10000)


def test_clubs_tab(page):
    open_music(page)
    page.p.click("#muRoot .mu-tabs [data-tab=clubs]")
    clubs = page.p.inner_text("#muClubList")
    assert "NGL Club Hub: SAADI Gymnastics" in clubs
    assert "No matching NGL Club Hub account" in clubs and "office@riverside.example" in clubs
    page.p.click("[data-act=mu-publish]")
    page.p.wait_for_selector(".toast:has-text('Published. Clubs will see')", timeout=10000)


def test_player_view_and_transport(page):
    open_player(page)
    assert page.p.is_visible("#muTab-play") and not page.p.is_visible("#muTab-order")
    for sel in ("#muGo", "#muPause", "#muFade", "#muRestart", "[data-act=mu-prev]", "[data-act=mu-next]"):
        assert page.p.is_visible(sel), sel
    assert page.p.is_disabled("#muPause")
    assert "AMELIA ROBERTS" in page.p.inner_text("#muNow").upper()
    assert page.p.locator("#muDeck .mu-tile").count() == 4
    assert "Welcome and safety" in page.p.inner_text("#muAnnDeck")
    # Next moves the selection without playing
    page.p.click("[data-act=mu-next]")
    page.p.wait_for_function("document.querySelector('#muNow').textContent.includes('Isla Thompson')", timeout=10000)


def test_save_play_pause_stop_offline(page):
    open_player(page)
    page.p.click("#muPrepBtn")
    page.p.wait_for_function("document.querySelector('#muPrepState').textContent.includes('7 of 7')", timeout=30000)
    # the hall Wi-Fi drops: the player keeps going from the copies on this laptop
    page.ctx.set_offline(True)
    page.p.keyboard.press("Space")
    page.p.wait_for_function("document.querySelector('#muNow .lbl').textContent.startsWith('Now playing')", timeout=10000)
    assert "On laptop" in page.p.inner_text("#muNow")
    assert page.p.is_disabled("#muGo") and not page.p.is_disabled("#muPause")
    page.p.wait_for_timeout(500)
    page.p.keyboard.press("k")
    page.p.wait_for_function("document.querySelector('#muPause').textContent.includes('Resume')", timeout=5000)
    page.p.keyboard.press("k")
    page.p.keyboard.press("s")
    # fades out (2.5 seconds), the gymnast is marked played and the next one is selected, not started
    page.p.wait_for_function("document.querySelector('#muNow .lbl').textContent.startsWith('Ready') && document.querySelector('#muNow').textContent.includes('Isla Thompson')", timeout=10000)
    assert "played" in page.p.inner_text("#muQueue .mu-qr[data-qid=d101]")
    page.ctx.set_offline(False)


def test_music_tab_switch_to_play(page):
    open_music(page)
    page.p.click("#muRoot .mu-tabs [data-tab=play]")
    page.p.wait_for_selector("#muQueue .mu-qr[data-qid]", timeout=10000)
    assert page.p.evaluate("location.hash").startswith("#/admin/music/play/")


def test_music_on_phone(phone):
    phone.go("#/admin/musicplayer", demo=True)
    phone.p.wait_for_selector("#muQueue .mu-qr[data-qid]", timeout=20000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
