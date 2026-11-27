"""Shared test set-up: serves the app locally, opens a browser, and makes one fresh
test club on the STAGING database for the whole run (deleted again at the end).
Run:  python -m pytest tests -q          (add --headed to watch)
"""
import functools, http.server, os, secrets, threading
import pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="session")
def base_url():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".webmanifest": "application/manifest+json"}
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=ROOT)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}/"
    httpd.shutdown()


@pytest.fixture(scope="session")
def browser(pytestconfig):
    with sync_playwright() as p:
        # Locally use installed Chrome; on GitHub Actions use Playwright's own Chromium.
        kw = {} if os.environ.get("CI") else {"channel": "chrome"}
        b = p.chromium.launch(headless=not pytestconfig.getoption("--headed", default=False), args=["--mute-audio"], **kw)   # never play sounds (the rotation screen's bell and voice) through the speakers
        yield b
        b.close()


def pytest_addoption(parser):
    parser.addoption("--headed", action="store_true", default=False)


class Page:
    """A browser tab that fails the test if the app throws a JavaScript error."""
    def __init__(self, browser, base_url, width=1280, height=900):
        self.ctx = browser.new_context(viewport={"width": width, "height": height}, accept_downloads=True)
        self.p = self.ctx.new_page()
        self.base = base_url
        self.errors = []
        self.p.on("pageerror", lambda e: self.errors.append(str(e)))

    def go(self, hash_="#/home", demo=False):
        # Not sample data: ?db=test connects to the separate TEST database (ngl-club-hub-test), never the live one.
        self.p.goto(self.base + ("?demo" if demo else "?db=test") + hash_)
        self.p.wait_for_selector("#page h1, #authRoot h1", timeout=20000)

    def route(self, hash_):
        self.p.evaluate(f"location.hash = {hash_!r}")
        self.p.wait_for_function("h => location.hash === h && !document.querySelector('#page').dataset.loading", arg=hash_, timeout=15000)
        self.p.wait_for_timeout(700)
        self.p.wait_for_selector("#page h1", timeout=15000)

    def toast(self):
        t = self.p.wait_for_selector(".toast", timeout=15000)
        return t.inner_text()

    def close(self):
        self.ctx.close()
        assert not self.errors, f"JavaScript errors: {self.errors}"


@pytest.fixture
def page(browser, base_url):
    pg = Page(browser, base_url)
    yield pg
    pg.close()


@pytest.fixture
def phone(browser, base_url):
    pg = Page(browser, base_url, 390, 844)
    yield pg
    pg.close()


@pytest.fixture(scope="session")
def account(browser, base_url):
    """One fresh test club on the TEST database (ngl-club-hub-test). Made-up example.com email, so no emails are sent."""
    email = f"autotest-{secrets.token_hex(4)}@example.com"
    pw = "Test-" + secrets.token_hex(8)
    pg = Page(browser, base_url)
    pg.go()
    if pg.p.locator("[data-who=club]").count():      # first screen: Club or Parent
        pg.p.click("[data-who=club]")
    pg.p.click("[data-mode=register]")
    pg.p.fill("#name", "AUTOTEST Gymnastics Club")
    pg.p.fill("#contact", "Auto Test")
    pg.p.fill("#email", email)
    pg.p.fill("#pw", pw)
    pg.p.click("#f button")
    pg.p.wait_for_selector("#page h1", timeout=20000)
    yield {"email": email, "pw": pw, "page": pg}
    # Clean up: delete the test login (club data stays, marked AUTOTEST).
    try:
        # Sign in again first: deleting a login needs a recent sign-in, and the whole suite takes several minutes
        pg.p.evaluate("""async ([e, p]) => { const m = await import('./js/firebase.js'); const {auth, A} = await m.fb();
                         try { await auth.signInWithEmailAndPassword(A, e, p); } catch (_) {}
                         if (A.currentUser) await A.currentUser.delete(); }""", [email, pw])
    finally:
        pg.ctx.close()


NEEDS_STORAGE = ("test_club_can_upload_its_own_music", "test_club_cannot_store", "test_club_places_a_real_order")
NEEDS_LIVE_CARD = ("test_basket_order_goes_straight_to_payment",)


def pytest_collection_modifyitems(items):
    # Tests that write to the database use the separate TEST project (ngl-club-hub-test) through ?db=test.
    # Two things the test project doesn't have (27 Nov 2026):
    #  - file storage: new Firebase projects only get Storage on the paid (Blaze) plan, so upload tests are skipped;
    #  - its own card-payment script: the "NGL card payments STAGING" script reads the live database.
    for it in items:
        if it.name.startswith(NEEDS_STORAGE):
            it.add_marker(pytest.mark.skip(reason="Needs file storage: the test Firebase project has none (Blaze plan)"))
        elif it.name.startswith(NEEDS_LIVE_CARD):
            it.add_marker(pytest.mark.skip(reason="Card checkout script is wired to the live database, not the test one"))
