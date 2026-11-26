"""NGL Admin · Rotation Planner clubs (sample data): copied from GYMNASTICS-RESULTS/NGL_Admin.html.
Sample data keeps every change in memory only, so nothing here touches a database."""
import json

ROTA = {"groups": [{"name": "Tumble Tots"}, {"name": "Squad C"}], "locations": [{"name": "Main floor"}], "sessions": {}}


def open_rotation(page):
    page.go("#/admin/rotation", demo=True)
    page.p.wait_for_selector("#roRoot .ro-table tbody tr", timeout=20000)


def row(page, uid):
    return page.p.locator(f"#roRoot tr[data-club={uid}]")


def test_rotation_opens(page):
    open_rotation(page)
    assert "ROTATION PLANNER CLUBS" in page.p.inner_text("#page h1").upper()
    assert page.p.text_content("#roRoot .ro-hdr h2") == "Registered Clubs"
    heads = page.p.locator("#roRoot .ro-table th").all_inner_texts()
    assert [h.upper() for h in heads] == ["CLUB NAME", "CONTACT", "EMAIL", "JOINED", "GROUPS", "SESSIONS", "ACTIONS"]


def test_clubs_list_and_counts(page):
    open_rotation(page)
    # Planner clubs only by default: 3 Club Hub planner clubs + 1 old planner club; Oakfield (Club Hub only) hidden
    assert page.p.locator("#roRoot .ro-table tbody tr").count() == 4
    assert page.p.inner_text("#roStatTotal") == "4"
    assert page.p.inner_text("#roStatActive") == "3"
    saadi = row(page, "demo-saadi").inner_text()
    assert "SAADI Gymnastics" in saadi and "NEW" in saadi
    assert "Old planner" in row(page, "demo-old-1").inner_text()
    # old planner clubs can be viewed but not imported into
    assert row(page, "demo-old-1").locator("[data-act=ro-import]").count() == 0
    assert row(page, "demo-saadi").locator(".ro-sessions").inner_text().strip().endswith("19")


def test_show_every_club_hub_club(page):
    open_rotation(page)
    assert "Show every Club Hub club (5)" in page.p.inner_text("#roRoot .ro-showall")
    page.p.check("#roShowAll")
    page.p.wait_for_selector("#roRoot tr[data-club=demo-oakfield]", timeout=10000)
    assert "Club Hub only" in row(page, "demo-oakfield").inner_text()
    page.p.uncheck("#roShowAll")
    page.p.wait_for_selector("#roRoot tr[data-club=demo-oakfield]", state="detached", timeout=10000)


def test_view_data(page):
    open_rotation(page)
    row(page, "demo-riverside").locator("[data-act=ro-view]").click()
    t = page.p.inner_text("#roView")
    assert "Groups: Development, Competitive" in t and "Locations: Sports hall, Annexe" in t
    page.p.click("#roView [data-close]")
    page.p.wait_for_selector("#roView", state="detached", timeout=5000)


def test_import_checks_and_saves_in_demo(page):
    open_rotation(page)
    r = row(page, "demo-northgate")
    assert r.locator(".ro-groups").inner_text().strip().endswith("0")
    r.locator("[data-act=ro-import]").click()
    assert page.p.text_content("#roImportTitle") == "Import Data for Northgate Gymnastics Club"
    page.p.click("#roImportDo")
    assert page.p.inner_text("#roImportErr") == "Please paste JSON data."
    page.p.fill("#roImportData", "{not json")
    page.p.click("#roImportDo")
    assert "Invalid JSON" in page.p.inner_text("#roImportErr")
    page.p.fill("#roImportData", '{"groups":[]}')
    page.p.click("#roImportDo")
    assert page.p.inner_text("#roImportErr") == "Data missing groups or locations fields."
    page.p.fill("#roImportData", json.dumps(ROTA))
    page.p.click("#roImportDo")
    assert "overwrite all existing data" in page.p.inner_text("#roImportErr")
    page.p.click("#roImportDo")
    assert "Data imported successfully!" in page.toast()
    page.p.wait_for_selector("#roImport", state="detached", timeout=5000)
    page.p.wait_for_function("document.querySelector('#roRoot tr[data-club=demo-northgate] .ro-groups').textContent.trim().endsWith('2')", timeout=10000)
    assert page.p.inner_text("#roStatActive") == "4"


def test_import_cancel(page):
    open_rotation(page)
    row(page, "demo-saadi").locator("[data-act=ro-import]").click()
    page.p.click("[data-act=ro-import-cancel]")
    page.p.wait_for_selector("#roImport", state="detached", timeout=5000)


def test_refresh(page):
    open_rotation(page)
    page.p.click("[data-act=ro-refresh]")
    page.p.wait_for_selector("#roRoot .ro-table tbody tr", timeout=10000)
    assert page.p.locator("#roRoot .ro-table tbody tr").count() == 4


def test_rotation_on_phone(phone):
    phone.go("#/admin/rotation", demo=True)
    phone.p.wait_for_selector("#roRoot .ro-table tbody tr", timeout=20000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
