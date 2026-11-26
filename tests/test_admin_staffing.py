"""NGL Admin · Staffing (copied from NGL_Staffing_Admin.html): sample data only, nothing is saved."""


def open_staffing(page, hash_="#/admin/staffing"):
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#stfRoot", timeout=20000)


def test_staffing_overview_opens(page):
    open_staffing(page)
    t = page.p.inner_text("#stfRoot")
    assert "ALL COMPETITIONS" in t.upper()
    assert "RUNNING THE COMPETITION" in t.upper() and "JUDGES" in t.upper() and "CAMERA OPERATORS" in t.upper()
    assert "NGL NATIONAL FINALS: LEVEL A" in t.upper()             # standalone competitions always show
    assert "GENERAL LEAGUE · EAST REGION" in t.upper() and "Dave Brooke" in t
    assert page.p.locator(".ov-comp").count() >= 9
    assert "3 judge requests" in t                                 # pending sign-ups for c1


def test_staffing_gaps_filter(page):
    open_staffing(page)
    before = page.p.locator(".ov-row").count()
    page.p.click("[data-act=st-ov][data-f=gaps]")
    page.p.wait_for_selector("[data-act=st-ov][data-f=gaps].on")
    after = page.p.locator(".ov-row").count()
    assert 0 < after < before
    assert page.p.locator(".ov-row.na").count() == 0                 # not needed isn't a gap


def test_staffing_board_and_edit(page):
    open_staffing(page, "#/admin/staffing/c1")
    t = page.p.inner_text("#stfRoot")
    assert "Staffing board" in t and "CONTROL DESK" in t.upper() and "VAULT" in t.upper()
    assert "Judging Pathway" in t and "Sarah Collins" in t
    # Fill the vacant Beam judge
    page.p.click(".station:has(strong:text-is('Beam')) .slot.st-vacant >> text=Judge")
    page.p.wait_for_selector("#f_name")
    page.p.fill("#f_name", "Jane Test")
    page.p.fill("#f_club", "AUTOTEST Club")
    page.p.click(".stf-dlg-foot button:text-is('Save')")
    page.p.wait_for_selector(".station:has(strong:text-is('Beam')) .slot.st-confirmed:has-text('Jane Test')", timeout=10000)
    assert page.p.inner_text("#stfSave") in ("Saving…", "Saved")
    # The overview shows the same change
    page.route("#/admin/staffing")
    assert "Jane Test" in page.p.inner_text("#stfOvList")


def test_staffing_add_judge_and_staff(page):
    open_staffing(page, "#/admin/staffing/c1")
    page.p.click(".station:has(strong:text-is('Floor')) [data-act=st-addjudge]")
    page.p.wait_for_selector(".station:has(strong:text-is('Floor')) .slot:has-text('Judge 2')")
    assert page.p.locator(".station:has(strong:text-is('Floor')) .slot:has-text('Judge 1')").count() == 1
    page.p.click(".stf-toolbar [data-act=st-addstaff]")
    page.p.fill("#n_role", "First Aider")
    page.p.fill("#n_qty", "2")
    page.p.click(".stf-dlg-foot button:text-is('Add')")
    page.p.wait_for_selector("text=First Aider 2")
    assert "ADDITIONAL STAFF" in page.p.inner_text("#stfBoard").upper()


def test_staffing_judge_requests_assign(page):
    open_staffing(page, "#/admin/staffing/c1/requests")
    t = page.p.inner_text("#stfRoot")
    assert "Priya Shah" in t and "Tom Ellis" in t and "Senior Judge" in t
    page.p.click(".req-card:has-text('Tom Ellis') [data-act=st-assign]")
    page.p.wait_for_selector("#a_slot")
    assert "★" in page.p.inner_text("#a_slot")                    # Vault is starred for Tom
    page.p.click(".stf-dlg-foot button:text-is('Assign')")
    page.p.wait_for_function("() => !document.querySelector('.req-card') || !document.body.innerText.includes('Tom Ellis')", timeout=10000)
    page.p.click("[data-act=st-rfilter][data-f=assigned]")
    page.p.wait_for_selector(".req-card:has-text('Tom Ellis')")
    assert "Assigned: Judge, Vault" in page.p.inner_text(".req-card:has-text('Tom Ellis')") or "Assigned: Judge" in page.p.inner_text(".req-card:has-text('Tom Ellis')")


def test_staffing_setup_and_exports(page):
    open_staffing(page, "#/admin/staffing/c1/settings")
    assert page.p.input_value("#stfDisc") == "WAG"
    page.p.fill("#stfJpp", "2")
    page.p.click("[data-act=st-apply]")
    assert "Added 4 roles" in page.toast()
    page.route("#/admin/staffing/c1")
    assert page.p.locator(".station:has(strong:text-is('Bars')) .slot:has-text('Judge 2')").count() == 1
    page.p.click("#stfExportBtn")
    assert page.p.is_visible("#stfExportMenu")
    with page.p.expect_download() as d:
        page.p.click("[data-export=csv]")
    assert d.value.suggested_filename.endswith(".csv") and "NGL_Staffing_General_League" in d.value.suggested_filename


def test_staffing_boys_competition_is_mag(page):
    open_staffing(page, "#/admin/staffing/c2")
    t = page.p.inner_text("#stfBoard").upper()
    assert "POMMEL" in t and "HIGH BAR" in t and "BEAM" not in t
