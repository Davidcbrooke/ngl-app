"""Every screen opens, with no errors, on a laptop and a phone (sample data)."""
import pytest

ROUTES = {
    "#/home": "WELCOME",
    "#/competitions": "COMPETITIONS", "#/competitions/places": "COMPETITIONS",
    "#/competitions/music": "COMPETITIONS", "#/competitions/results": "COMPETITIONS",
    "#/rules": "RULES & RESOURCES",
    "#/programmes": "PROGRAMMES", "#/programmes/preschool": "PROGRAMMES", "#/programmes/masters": "PROGRAMMES",
    "#/shop": "SHOP & ORDERS", "#/shop/orders": "SHOP & ORDERS", "#/shop/orders/ORD-R2M6F": "ORD-R2M6F",
    "#/club": "MY CLUB", "#/help": "HELP", "#/help/level": "HELP",
}


@pytest.mark.parametrize("hash_,title", ROUTES.items())
def test_every_screen_opens(page, hash_, title):
    page.go(hash_, demo=True)
    assert title in page.p.inner_text("#page h1").upper()


def test_signed_out_shows_login(page):
    page.go("#/home")
    assert "CLUB HUB" in page.p.inner_text("#authRoot h1").upper()
    assert page.p.is_hidden(".app")


def test_seven_menu_items_in_order(page):
    page.go(demo=True)
    labels = [t.strip() for t in page.p.locator("#nav a span:first-of-type").all_inner_texts()]
    assert labels == ["Home", "Competitions", "Rules & resources", "Programmes", "Shop & orders", "My club", "Help"]


def test_search_finds_rules(page):
    page.go(demo=True)
    page.p.keyboard.press("/")
    page.p.keyboard.type("rules")
    results = page.p.locator("#res a").all_inner_texts()
    assert any("WAG" in r for r in results) and any("MAG" in r for r in results)


def test_invoice_opens(page):
    page.go("#/shop/orders/ORD-R2M6F", demo=True)
    page.p.click("[data-act=invoice]")
    inv = page.p.wait_for_selector(".inv").inner_text()
    assert "INVOICE" in inv.upper() and "60-84-64" in inv and "Company no. 10702099" in inv


@pytest.mark.parametrize("hash_", ["#/home", "#/shop/orders", "#/competitions/music", "#/programmes/recreational"])
def test_phone_layout(phone, hash_):
    phone.go(hash_, demo=True)
    # No sideways scrolling, bottom menu visible, buttons big enough to tap
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    assert phone.p.locator(".side").bounding_box()["y"] > 600
    small = phone.p.evaluate("[...document.querySelectorAll('#page .btn:not(.sm)')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 44).length")
    assert small == 0
