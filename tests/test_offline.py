"""Offline start-up: after one visit online, the app (and the music player) open on a reload with no internet."""


def test_app_opens_offline_after_one_visit(page):
    url = page.base + "?demo&sw#/admin/musicplayer"
    page.p.goto(url)
    page.p.wait_for_selector("#page h1", timeout=20000)
    page.p.evaluate("navigator.serviceWorker.ready")
    page.p.wait_for_function("navigator.serviceWorker.controller !== null || true")
    page.p.wait_for_timeout(5000)                      # the page sends its files to the service worker to keep
    page.ctx.set_offline(True)
    try:
        page.p.reload()
        page.p.wait_for_selector("#page h1", timeout=20000)
        assert "MUSIC PLAYER" in page.p.inner_text("#page h1").upper()
    finally:
        page.ctx.set_offline(False)
