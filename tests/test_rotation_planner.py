"""NGL Rotation Planner (club tool, js/tools/rotation.js) on sample data: build a week, edit a session, Weekly Totals,
Recreational, the full-screen live gym screen following a faked clock, saving in sample data (nothing written), phone width.

Until #/tools/rotation is wired into js/app.js, the HARNESS tests import the module at /?demo, put its screen into
#page and send 'ngl:rendered' (exactly what the app does after drawing a screen). The ROUTE tests use the real address
and switch on by themselves once app.js mentions 'tools/rotation'."""
import datetime, os
import pytest
from conftest import ROOT, Page

ROUTE_WIRED = "tools/rotation" in open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
WIRE = pytest.mark.skipif(not ROUTE_WIRED, reason="#/tools/rotation is not wired into js/app.js yet")
# A Monday in term (sample data: Recreational 16:00 class, WAG Pearl squads from 16:30) and a Saturday (Pre-School at 9:00)
MON_1624 = datetime.datetime(2026, 11, 23, 16, 24, 20)
SAT_0905 = datetime.datetime(2026, 11, 28, 9, 5, 0)


def harness(pg, parts=None):
    """Open the sample app, then draw the planner into #page as the app will once it's wired."""
    pg.go("#/home", demo=True)
    pg.p.evaluate("""async parts => { const m = await import('./js/tools/rotation.js'); window.__rp = m;
        document.getElementById('page').innerHTML = await m.default(parts);
        document.dispatchEvent(new CustomEvent('ngl:rendered')); }""", parts or [])
    pg.p.wait_for_selector("#rpRoot", state="attached", timeout=15000)   # on the live screen the root itself has no size (the screen is fixed over the app)


def clocked(browser, base_url, when, width=1600, height=900):
    """A tab whose clock starts at `when` (UK time) and then runs on in real time."""
    pg = Page.__new__(Page)
    pg.ctx = browser.new_context(viewport={"width": width, "height": height}, timezone_id="Europe/London", locale="en-GB")
    pg.p = pg.ctx.new_page()
    pg.base, pg.errors = base_url, []
    pg.p.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.p.clock.install(time=when)
    return pg


def toast(pg, text=None):
    """The newest toast (or the one saying `text`)."""
    if text:
        return pg.p.wait_for_selector(f".toast:has-text({text!r})", timeout=10000).inner_text()
    pg.p.wait_for_selector(".toast", timeout=10000)
    return pg.p.locator(".toast").last.inner_text()


def confirm(pg):
    pg.p.click(".rp-ask [data-yes]")


def no_sideways(pg):
    return pg.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


# ---------------------------------------------------------------- harness (works before wiring)

def test_planner_opens_with_sample_week(page):
    harness(page)
    assert "NGL ROTATION PLANNER" in page.p.inner_text("#rpRoot h1").upper()
    tabs = page.p.locator("#rpRoot .sub a").all_inner_texts()
    assert tabs == ["Weekly Planner", "Groups & Locations", "Weekly Totals", "Recreational", "NGL Admin"]
    t = page.p.inner_text("#weekTable")
    for g in ["WAG Pearl 1", "WAG Pearl 2", "MAG Development", "Tumbling Squad", "Pre-School Tots", "Orange", "Purple"]:
        assert g in t
    assert "RECREATIONAL — ROTATION WEEK A" in t.upper() and "+ Add Recreational group" in t
    # Recreational rows are built from the classes: Orange on Monday = 2 classes x (warm-up, 3 rotations, cool-down)
    assert page.p.locator("#weekTable tr:has(td.group-cell:text-is('Orange')) td.day-cell").first.locator(".session-chip").count() == 10
    # the sponsor band shows the sample sponsor
    assert page.p.locator("#sponsorBand img[alt=JustGo]").count() >= 1


def test_build_a_week_and_edit_a_session(page):
    harness(page, ["groups"])
    # a new location and a new squad group
    page.p.click("#settingsView [data-act=rp-loc]")
    page.p.fill("#lm_name", "air track")
    page.p.select_option("#lm_cat", "Tumble / Track")
    page.p.click("[data-act=rp-loc-save]")
    assert "AIR TRACK" in page.p.inner_text("#locationsList")
    page.p.click("#settingsView .rp-panel-hdr [data-act=rp-group]")
    page.p.click("[data-act=rp-group-save]")
    assert page.p.inner_text("#gm_err") == "Please enter a group name."
    page.p.fill("#gm_name", "Test Squad")
    for d in ["Tuesday", "Thursday", "Friday", "Saturday", "Sunday"]:
        page.p.uncheck(f"#gm_days input[value={d}]")
    page.p.click("#gm_swatches [data-c='#1abc9c']")
    page.p.click("[data-act=rp-group-save]")
    assert "Test Squad" in page.p.inner_text("#groupsList") and "squad · Mon, Wed" in page.p.inner_text("#groupsList")
    # back to the Weekly Planner: add three sessions on Monday, the first also on Wednesday
    page.p.click("#rpRoot .sub a[data-tab=planner]")
    row = page.p.locator("#weekTable tr:has(td.group-cell:text-is('Test Squad'))")
    assert row.locator("td.inactive-day").count() == 5
    mon = row.locator("td.day-cell").nth(0)
    mon.locator("button:text-is('+ Add session')").click()
    assert page.p.text_content("#smTitle") == "Add Session — Test Squad (Monday)"
    page.p.select_option("#sm_loc", "AIR TRACK")
    page.p.select_option("#sm_start", str(16 * 60))
    page.p.click("[data-act=rp-dur][data-v='45']")
    page.p.check("#sm_days input[value=Wednesday]")
    assert page.p.is_disabled("#sm_days input[value=Tuesday]")
    page.p.click("[data-act=rp-sess-save]")
    assert "Session saved + 1 day(s)" in toast(page, "Session saved + 1 day(s)")
    for loc, dur in [("MAIN FLOOR", "30"), ("BEAM ROW", "30")]:
        mon.locator("button:text-is('+ Add session')").click()
        page.p.select_option("#sm_loc", loc)            # start defaults to straight after the last session
        page.p.click(f"[data-act=rp-dur][data-v='{dur}']")
        page.p.click("[data-act=rp-sess-save]")
    chips = mon.locator(".session-chip")
    assert chips.count() == 3
    assert chips.all_inner_texts()[1].startswith("4:45pm")
    assert row.locator("td.day-cell").nth(1).locator(".session-chip").count() == 1
    # edit the first session: 15 minutes longer, and the two after it move on 15 minutes
    chips.nth(0).locator(".chip-loc").click()
    assert page.p.text_content("#smTitle") == "Edit Session — Test Squad (Monday)"
    page.p.click("[data-act=rp-dur][data-v='60']")
    page.p.fill("#sm_title", "Tumbling")
    page.p.click("[data-act=rp-sess-save]")
    assert toast(page, "2 later session(s) shifted") == "Session saved · 2 later session(s) shifted"
    texts = mon.locator(".session-chip").all_inner_texts()
    assert "AIR TRACK · Tumbling" in texts[0] and texts[1].startswith("5:00pm") and texts[2].startswith("5:30pm")
    # copy the block to a later time, then clear Wednesday
    mon.locator("[data-act=rp-cblock]").click()
    page.p.click("[data-act=rp-cb-do]")
    assert page.p.inner_text("#cb_err") == "Please add at least one time to copy to."
    page.p.select_option("#cb_start", str(18 * 60))
    page.p.click("[data-act=rp-cb-add]")
    assert "6:00pm AIR TRACK → 7:00pm MAIN FLOOR → 7:30pm BEAM ROW" in page.p.inner_text("#cb_preview")
    page.p.click("[data-act=rp-cb-do]")
    assert mon.locator(".session-chip").count() == 6
    row.locator("td.day-cell").nth(1).locator("[data-act=rp-clear]").click()
    assert "Clear all 1 session(s) for this group on Wednesday?" in page.p.inner_text(".rp-ask")
    confirm(page)
    assert row.locator("td.day-cell").nth(1).locator(".session-chip").count() == 0
    # delete one session from its chip
    mon.locator(".session-chip").nth(5).locator(".chip-del").click()
    confirm(page)
    assert mon.locator(".session-chip").count() == 5


def test_rec_groups_are_built_from_classes(page):
    harness(page)
    page.p.locator("#weekTable tr:has(td.group-cell:text-is('Orange')) .session-chip").first.click()
    assert toast(page, "This group is built from your Recreational classes")
    page.p.wait_for_selector("#recView .rc-slot")
    assert page.p.locator("#recView .rc-slot").count() == 3
    assert "✓ Every group does every piece" in page.p.inner_text("#recView")
    # one more group in the 4pm class: a 4th colour row (Red, Rotation B) appears on the planner
    page.p.select_option("#recView .rc-slot[data-id=rc1] [data-rc=groups]", "4")
    page.p.click("#rpRoot .sub a[data-tab=planner]")
    red_mon = page.p.locator("#weekTable tr:has(td.group-cell:text-is('Red')) td.day-cell").first
    assert red_mon.locator(".session-chip").count() == 10      # 4pm (now) + 5pm


def test_weekly_totals(page):
    harness(page, ["totals"])
    t = page.p.text_content("#totalsContent")
    assert "Rotation Week A — Apparatus Time" in t and "Minutes per squad group per apparatus category" in t
    assert page.p.locator("#totals_tableA .rp-tcard").count() == 4
    # Pearl 1: 4 days x 30 min vault in Week A, tumble track in Week B
    p1 = page.p.locator("#totals_tableA .rp-tcard[data-group=g_p1]").inner_text()
    assert "Vault" in p1 and "120m" in p1
    page.p.click("[data-act=rp-totwk][data-w=B]")
    assert page.p.is_visible("#totals_tableB") and not page.p.is_visible("#totals_tableA")
    assert "Tumble / Track" in page.p.locator("#totals_tableB .rp-tcard[data-group=g_p1]").inner_text()
    page.p.click("[data-act=rp-totwk][data-w=A]")
    page.p.click("#totals_tableA [data-act=rp-sort][data-col=total]")
    assert "Total ▼" in page.p.inner_text("#totals_tableA .rp-sortchips")


def test_save_in_demo_writes_nothing(page):
    sent = []
    page.p.on("request", lambda r: sent.append(r.url) if any(h in r.url for h in ("firestore.googleapis.com", "firebasedatabase.app")) else None)
    harness(page)
    page.p.click("[data-act=rp-save]")
    page.p.wait_for_function("document.getElementById('rpSaveStatus').textContent.startsWith('Saved')", timeout=10000)
    assert "sample data: nothing is stored" in page.p.inner_text("#rpSaveStatus")
    # profile and ideas also stay in memory
    page.p.click("[data-act=rp-feedback]")
    page.p.click("[data-act=rp-fb-send]")
    assert page.p.inner_text("#fb_err") == "Please enter your idea or suggestion."
    page.p.fill("#fb_message", "A test idea")
    page.p.click("[data-act=rp-fb-send]")
    page.p.wait_for_selector("#feedbackSuccess:not([hidden])")
    assert not sent, sent


def test_ngl_admin_sponsors_and_ideas(page):
    harness(page, ["admin"])
    page.p.wait_for_selector("#feedbackInbox .rp-fb")
    assert "Riverside Gym Academy" in page.p.inner_text("#feedbackInbox")
    page.p.click("#feedbackInbox [data-act=rp-fb-read]")
    page.p.wait_for_function("!document.querySelector('#feedbackInbox [data-act=rp-fb-read]')", timeout=5000)
    assert page.p.locator("#sponsorsListWrap .rp-spon").count() == 1
    page.p.click("#sponsorsListWrap [data-act=rp-spon-del]")
    confirm(page)
    page.p.wait_for_selector("#sponsorsListWrap .s-empty")
    assert page.p.locator("#sponsorBand").count() == 0


def test_live_screen_follows_the_clock(browser, base_url):
    pg = clocked(browser, base_url, MON_1624)
    try:
        harness(pg, ["screen"])
        pg.p.wait_for_selector("#tlContainer .tl-row")
        assert pg.p.inner_text("#liveClockBig").startswith("16:24")
        assert pg.p.inner_text("#liveDayLabel") == "Monday — Week 5 and 6, Rotation Week A"
        rows = pg.p.locator("#tlContainer .tl-lbl").evaluate_all("els => els.map(e => e.dataset.name)")
        assert rows == ["WAG Pearl 1", "WAG Pearl 2", "Orange", "Yellow", "Blue"]   # squads start within 15 minutes; Rec is on
        # 1 minute before the rotation: Final goes, with where each group goes next
        pg.p.wait_for_selector("#lsFinal.show", timeout=5000)
        fin = pg.p.inner_text("#lsFinal")
        assert "FINAL GOES" in fin.upper() and "Orange" in fin and "VAULT" in fin.upper()
        # the red now line sits just before the 4:25 blocks, then just after them
        line_vs_425 = "(() => { const b = [...document.querySelectorAll('#tlContainer .tl-block')].find(x => x.dataset.startMin === '985');"             " return parseFloat(document.getElementById('tlNowLine').style.left) - parseFloat(document.getElementById('tlContainer').dataset.lblW) - parseFloat(b.style.left); })()"
        assert pg.p.evaluate(line_vs_425) < 0
        # the rotation: ROTATE NOW takes over, the new blocks flash
        pg.p.clock.fast_forward("00:45")
        pg.p.wait_for_selector("#lsAlert.show", timeout=5000)
        al = pg.p.inner_text("#lsAlert")
        assert "ROTATE NOW" in al.upper() and "Orange" in al and "Yellow" in al and "Blue" in al
        assert not pg.p.is_visible("#lsFinal")
        assert pg.p.inner_text("#liveClockBig").startswith("16:25")
        pg.p.wait_for_function("document.querySelectorAll('#tlContainer .tl-block.flash').length >= 3", timeout=5000)
        assert pg.p.evaluate(line_vs_425) > 0
        # 5 minutes on, the alert settles back to the clock; the squads' 4:30 rotation is next
        pg.p.clock.fast_forward("05:10")
        pg.p.wait_for_function("document.querySelector('#lsAlert').classList.contains('show') && /4:30pm|Rotate now/i.test(document.querySelector('#lsAlertHead').textContent)", timeout=5000)
        assert pg.p.is_visible("#lsAlert")
        assert "WAG Pearl 1" in pg.p.inner_text("#lsAlert")
        pg.p.screenshot(path=os.path.join(os.environ.get("RP_SHOTS", ROOT), "_rp_live.png")) if os.environ.get("RP_SHOTS") else None
    finally:
        pg.close()


def test_live_screen_preschool_box(browser, base_url):
    pg = clocked(browser, base_url, SAT_0905)
    try:
        harness(pg, ["screen"])
        pg.p.wait_for_selector("#lsPre.show", timeout=10000)
        t = pg.p.inner_text("#lsPre")
        assert "PRE-SCHOOL · THIS WEEK" in t.upper() and "BOOK 1" in t.upper() and "BOOK 2" in t.upper()
        assert pg.p.locator("#lsPre.narrow").count() == 1            # Pearl 1 is training too, so it sits in the side panel
    finally:
        pg.close()


def test_live_screen_bell_and_stream(browser, base_url):
    pg = clocked(browser, base_url, MON_1624)
    try:
        harness(pg, ["screen"])
        pg.p.click("#bellBtn")
        assert toast(pg, "Bell alerts off")
        assert pg.p.get_attribute("#bellBtn", "aria-pressed") == "false"
        pg.p.click("[data-act=rp-stream]")
        assert pg.p.inner_text("#streamUrl") == "https://club.nationalgymnasticsleague.co.uk/rotation-planner/stream/?c=demo"
        pg.p.click("#streamModal [data-close]")
        # the live screen covers the app's menu and top bar
        assert pg.p.evaluate("document.elementFromPoint(100, 300).closest('#liveView') !== null")
        assert pg.p.evaluate("document.elementFromPoint(700, 30).closest('#liveView') !== null")
        pg.p.click("[data-act=rp-exit]")
        pg.p.wait_for_selector("#weekTable")
        assert not pg.p.evaluate("document.body.classList.contains('rp-live-on')")
    finally:
        pg.close()


@pytest.mark.parametrize("parts", [[], ["groups"], ["totals"], ["recreational"], ["admin"], ["screen"]])
def test_phone_width_no_sideways_scroll(phone, parts):
    harness(phone, parts)
    phone.p.wait_for_timeout(600)
    assert no_sideways(phone)
    if not parts:
        # phones get one day at a time instead of the table
        assert phone.p.is_visible("#mobileDayView") and not phone.p.is_visible("#weekTable")
        phone.p.click("[data-act=rp-mobday][data-by='1']")
        assert no_sideways(phone)


# ---------------------------------------------------------------- the real address (once wired into js/app.js)

@WIRE
def test_route_tabs_have_their_own_address(page):
    page.go("#/tools/rotation", demo=True)
    page.p.wait_for_selector("#weekTable")
    for tab, slug, sel in [("settings", "groups", "#settingsView"), ("totals", "totals", "#totalsContent"), ("rec", "recreational", "#recView"), ("admin", "admin", "#adminContent")]:
        page.p.click(f"#rpRoot .sub a[data-tab={tab}]")
        page.p.wait_for_function("h => location.hash === h", arg="#/tools/rotation/" + slug, timeout=5000)
        page.p.wait_for_selector(sel)
    page.p.click("#rpRoot .sub a[data-tab=planner]")
    page.p.wait_for_selector("#weekTable")


@WIRE
def test_route_go_live_and_exit(page):
    page.go("#/tools/rotation", demo=True)
    page.p.wait_for_selector("#weekTable")
    page.p.click("[data-act=rp-golive]")
    page.p.wait_for_function("location.hash === '#/tools/rotation/screen'", timeout=5000)
    page.p.wait_for_selector("#liveView #tlContainer .tl-ruler", timeout=10000)
    assert page.p.evaluate("document.body.classList.contains('rp-live-on')")
    assert page.p.evaluate("document.elementFromPoint(100, 300).closest('#liveView') !== null")   # side menu covered
    page.p.click("[data-act=rp-exit]")
    page.p.wait_for_function("location.hash === '#/tools/rotation'", timeout=5000)
    page.p.wait_for_selector("#weekTable")
    assert not page.p.evaluate("document.body.classList.contains('rp-live-on')")


@WIRE
def test_route_screen_bookmark_on_phone(phone):
    phone.go("#/tools/rotation/screen", demo=True)
    phone.p.wait_for_selector("#liveView #tlContainer .tl-ruler", timeout=10000)
    assert no_sideways(phone)
    # leaving the screen another way (browser back) puts the app's menu back
    phone.p.evaluate("location.hash = '#/home'")
    phone.p.wait_for_function("!document.getElementById('liveView')", timeout=10000)
    phone.p.wait_for_timeout(300)
    assert not phone.p.evaluate("document.body.classList.contains('rp-live-on')")


@WIRE
def test_route_rec_guard_goes_to_recreational(page):
    page.go("#/tools/rotation", demo=True)
    page.p.wait_for_selector("#weekTable")
    page.p.locator("#weekTable tr:has(td.group-cell:text-is('Orange')) .session-chip").first.click()
    page.p.wait_for_function("location.hash === '#/tools/rotation/recreational'", timeout=5000)
    page.p.wait_for_selector("#recView .rc-slot")
