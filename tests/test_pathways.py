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
    assert link.startswith("https://club.nationalgymnasticsleague.co.uk/preschool/#p=")


def test_preschool_licence_for_new_club(account):
    """A new club sees the four bands and can't add packs before the licence."""
    pg = account["page"]
    pg.route("#/programmes/preschool/licence")
    pg.p.wait_for_selector("[data-act=ps-buy]", timeout=15000)
    assert pg.p.locator("[data-act=ps-buy]").count() == 4
    assert pg.p.locator("[data-act=ps-pack]").count() == 0
    assert "Available once your licence is live" in pg.p.inner_text("#page")
