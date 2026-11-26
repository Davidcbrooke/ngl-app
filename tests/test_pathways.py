"""Every pathway uses the same model (DESIGN.md 6a): six tabs, same names, same order. Pre-School works in full."""
import pytest

PATHWAYS = ["preschool", "schools", "recreational", "general", "performance", "university", "masters"]
TABS = ["Overview", "Teach", "Awards", "Compete", "Families", "Licence"]


@pytest.mark.parametrize("k", PATHWAYS)
def test_same_six_tabs_for_every_pathway(page, k):
    page.go(f"#/programmes/{k}", demo=True)
    assert page.p.locator("#page .sub a").all_inner_texts() == TABS


@pytest.mark.parametrize("tab", ["", "/teach", "/teach/plans", "/awards", "/compete", "/families", "/licence"])
def test_preschool_tabs_open(page, tab):
    page.go(f"#/programmes/preschool{tab}", demo=True)
    page.p.wait_for_timeout(800)
    assert "couldn’t load" not in page.p.inner_text("#page")


def test_preschool_this_week_shows_both_books(page):
    page.go("#/programmes/preschool", demo=True)
    t = page.p.wait_for_selector(".ps-week", timeout=15000).inner_text().upper()
    assert "BOOK 1" in t and "BOOK 2" in t


def test_preschool_plans_lock_by_pack(page):
    """Sample club has the licence and Pack 11–20: plans 1–20 open, 21–40 and Seasonal locked."""
    page.go("#/programmes/preschool/teach/plans", demo=True)
    page.p.wait_for_selector(".ps-plan", timeout=15000)
    cards = page.p.locator(".ps-plan")
    assert cards.count() == 46
    assert "lock" not in (cards.nth(19).get_attribute("class") or "")
    assert "lock" in (cards.nth(20).get_attribute("class") or "")


def test_preschool_planner_and_twenty_medals(page):
    page.go("#/programmes/preschool/teach", demo=True)
    page.p.wait_for_selector(".ps-det", timeout=15000)
    assert page.p.locator(".ps-term").count() == 3
    page.route("#/programmes/preschool/awards")
    page.p.wait_for_selector(".ps-m", timeout=15000)
    assert page.p.locator(".ps-m").count() == 20


def test_preschool_family_link_holds_plan(page):
    page.go("#/programmes/preschool/families", demo=True)
    link = page.p.wait_for_selector("#psLink", timeout=15000).input_value()
    # the one NGL app: the club's Pre-School code when it has one, otherwise the term plan travels in the link
    assert link.startswith(page.base) and ("?code=" in link or "?p=" in link)


def test_preschool_licence_for_new_club(account):
    """A new club sees the four bands and can't add packs before the licence."""
    pg = account["page"]
    pg.route("#/programmes/preschool/licence")
    pg.p.wait_for_selector("[data-act=ps-buy]", timeout=15000)
    assert pg.p.locator("[data-act=ps-buy]").count() == 4
    assert pg.p.locator("[data-act=ps-pack]").count() == 0
    assert "Available once your licence is live" in pg.p.inner_text("#page")


# ---------- Recreational ----------
@pytest.mark.parametrize("tab", ["", "/teach", "/teach/plan", "/teach/warmups", "/teach/club", "/awards", "/compete", "/families", "/licence"])
def test_recreational_tabs_open(page, tab):
    page.go(f"#/programmes/recreational{tab}", demo=True)
    page.p.wait_for_timeout(1500)
    t = page.p.inner_text("#page")
    assert "couldn’t load" not in t and "PROGRAMMES" in page.p.inner_text("#page h1").upper()


def test_recreational_lesson_plan_ladder(page):
    """Fortnight → apparatus → set-up photos → skill ladder, with the four rungs."""
    page.go("#/programmes/recreational/teach/plan", demo=True)
    page.p.click("[data-act=rec-block] >> nth=0", timeout=20000)
    page.p.click("[data-act=rec-piece] >> nth=0")
    page.p.wait_for_selector(".setgrid img[src]", timeout=15000)          # set-up photos load
    page.p.click("[data-act=rec-pstep][data-v=ladder]")
    page.p.wait_for_function("document.querySelector('#page').innerText.toUpperCase().includes('BEGINNER')", timeout=15000)
    t = page.p.inner_text("#page").upper()
    assert "BEGINNER" in t and "ADVANCED" in t and "STATION 1" in t


def test_recreational_run_your_class(page):
    page.go("#/programmes/recreational/teach", demo=True)
    page.p.click("[data-act=rec-run-set][data-k=startCode] >> nth=0", timeout=20000)
    page.p.click("[data-act=rec-run-start]")
    page.p.wait_for_selector(".stephead >> text=Warm-up", timeout=10000)
    page.p.click("[data-act=rec-run-next]")
    page.p.wait_for_function("(document.querySelector('.stephead') || {innerText: ''}).innerText.toUpperCase().includes('ROTATE TO')", timeout=15000)


def test_recreational_competition_routines(page):
    page.go("#/programmes/recreational/compete", demo=True)
    page.p.wait_for_selector("text=Routines by level", timeout=20000)
    assert page.p.locator(".kick").count() == 4          # Ruby, Pink, Teal, Indigo


def test_recreational_new_club_sees_seven_bands(account):
    pg = account["page"]
    pg.route("#/programmes/recreational/licence")
    pg.p.wait_for_selector("[data-act=rec-buy]", timeout=20000)
    assert pg.p.locator("[data-act=rec-buy]").count() == 7


# ---------- Schools ----------
@pytest.mark.parametrize("tab", ["", "/teach", "/teach/secondary", "/teach/profit", "/awards", "/compete", "/families", "/licence"])
def test_schools_tabs_open(page, tab):
    page.go(f"#/programmes/schools{tab}", demo=True)
    page.p.wait_for_timeout(1200)
    assert "couldn’t load" not in page.p.inner_text("#page")


def test_schools_profit_planner_updates(page):
    page.go("#/programmes/schools/teach/profit", demo=True)
    page.p.wait_for_selector("#pl_out .stat", timeout=15000)
    before = page.p.inner_text("#pl_out .stat >> nth=0")
    page.p.fill("#pl_form [data-k=o2Fee]", "12")
    page.p.wait_for_timeout(300)
    assert page.p.inner_text("#pl_out .stat >> nth=0") != before


def test_schools_secondary_planner_builds_lessons(page):
    page.go("#/programmes/schools/teach/secondary", demo=True)
    t = page.p.wait_for_selector("#sec_out", timeout=15000).inner_text()
    assert "Lesson 1" in t and "Assessment" in t


def test_schools_overview_lists_schools(page):
    page.go("#/programmes/schools", demo=True)
    t = page.p.wait_for_selector("text=Redbourn Primary School", timeout=15000)
    assert "305" in page.p.inner_text("#page")          # 140 + 165 children


def test_schools_new_club_sees_seven_bands(account):
    pg = account["page"]
    pg.route("#/programmes/schools/licence")
    pg.p.wait_for_selector("[data-act=sch-buy]", timeout=20000)
    assert pg.p.locator("[data-act=sch-buy]").count() == 7


# ---------- General League ----------
@pytest.mark.parametrize("tab", ["", "/teach", "/awards", "/compete", "/families", "/licence"])
def test_general_tabs_open(page, tab):
    page.go(f"#/programmes/general{tab}", demo=True)
    page.p.wait_for_timeout(1200)
    assert "couldn’t load" not in page.p.inner_text("#page")


def test_general_rules_switch_gender_and_level(page):
    page.go("#/programmes/general/compete", demo=True)
    page.p.click("[data-act=gl-gender][data-v=boys]", timeout=15000)
    page.p.click("[data-act=gl-level][data-v='3']")
    page.p.wait_for_function("(() => { const i = document.querySelector('figure img'); return i && /general-mag\/page-05\.jpg$/.test(i.getAttribute('src') || ''); })()", timeout=15000)
    imgs = page.p.locator("figure img").evaluate_all("els => els.map(e => e.getAttribute('src'))")
    assert all("general-mag/page-0" in s for s in imgs) and imgs[0].endswith("page-05.jpg")


def test_general_skills_book_total(page):
    page.go("#/programmes/general/awards", demo=True)
    page.p.fill("#glQty", "25", timeout=15000)
    page.p.wait_for_timeout(200)
    assert "Total £108" in page.p.inner_text("#glTotal")       # 25 x £4 + £8 postage


def test_general_family_qr(page):
    page.go("#/programmes/general/families", demo=True)
    page.p.wait_for_selector("#glQR svg", timeout=15000)
