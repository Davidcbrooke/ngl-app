"""Pre-School family page (js/family/preschool.js): the sample class in ?demo&family."""
import os

SHOTS = os.environ.get("NGL_SHOTS")   # set to a folder to save phone screenshots


def open_ps(pg):
    pg.p.goto(pg.base + "?demo&family#/family/preschool")
    pg.p.wait_for_selector("#famPage #psFam .psf-week", timeout=20000)


def week_label(pg):
    return pg.p.inner_text("#psFam .when b")


def jump(pg, i):
    pg.p.click(f"#psFam .term li[data-i='{i}']")
    pg.p.wait_for_function("i => document.querySelector('#psFam .term li.cur') && document.querySelector('#psFam .term li.cur').dataset.i === String(i)", arg=i, timeout=10000)


def test_week_card_book_switch_and_navigation(page):
    open_ps(page)
    t = page.p.inner_text("#psFam")
    assert "AROUND THE WORLD WITH SOMI & FLIC" in t.upper() and "SAMPLE CLUB" in t.upper()
    assert "Sample class: your club’s link will show your child’s own class." in t
    assert "TRY AT HOME" in t.upper() and "THE JOURNEY SO FAR" in t.upper()
    # The current term's week list: jump to Autumn week 1 (Alphabet, France / America)
    while not page.p.is_disabled("#psFam [data-ps=prev]"):   # back to the first week of the plan
        page.p.click("#psFam [data-ps=prev]")
    jump(page, 0)
    assert week_label(page).upper() == "AUTUMN TERM · WEEK 1"
    assert "7 Sept – 13 Sept 2026" in page.p.inner_text("#psFam .when span")
    assert page.p.inner_text("#psFam .tt h2").upper() == "ALPHABET"
    assert "img/post_01_Alphabet.jpg" in page.p.get_attribute("#psFam .theme", "style")
    assert page.p.is_disabled("#psFam [data-ps=prev]")
    # Book 1 / Book 2
    page.p.click("#psFam [data-ps=book][data-b='1']")
    assert "Welcome to France!" in page.p.inner_text("#psFam .psf-skills")
    assert "Book 1 · Country 1 of 10 · Week 1 of 4" in page.p.inner_text("#psFam .psf-skills .lv").title() or \
        page.p.inner_text("#psFam .psf-skills .lv").upper() == "BOOK 1 · COUNTRY 1 OF 10 · WEEK 1 OF 4"
    assert page.p.locator("#psFam .skills li").count() == 2
    assert "Show a landing shape" in page.p.inner_text("#psFam .skills")
    page.p.click("#psFam [data-ps=book][data-b='2']")
    page.p.wait_for_selector("#psFam .bk button.on[data-b='2']")
    assert "Welcome to America!" in page.p.inner_text("#psFam .psf-skills")
    assert page.p.evaluate("localStorage.getItem('ngl-ps-book')") == "2"
    assert "BOOK 2" in page.p.inner_text("#psFam .psf-journey h3").upper()
    # Journey: 10 medals, the current country ringed
    assert page.p.locator("#psFam .journey > div").count() == 10
    assert page.p.inner_text("#psFam .journey .now").strip() == "America"
    assert page.p.locator("#psFam .journey .todo").count() == 9
    page.p.click("#psFam [data-ps=book][data-b='1']")
    page.p.wait_for_selector("#psFam .bk button.on[data-b='1']")
    assert page.p.inner_text("#psFam .journey .now").strip() == "France"
    # Week navigation
    page.p.click("#psFam [data-ps=next]")
    page.p.wait_for_function("() => /WEEK 2$/i.test((document.querySelector('#psFam .when b') || {}).textContent || '')")
    assert page.p.inner_text("#psFam .tt h2").upper() == "SPACE"
    assert "WEEK 2 OF 4" in page.p.inner_text("#psFam .psf-skills .lv").upper()
    page.p.click("#psFam [data-ps=prev]")
    page.p.wait_for_function("() => /WEEK 1$/i.test((document.querySelector('#psFam .when b') || {}).textContent || '')")
    # The first England week (country 2, week 1 of 4; seasonal weeks pause the journey), so France shows as done
    jump(page, int(page.p.locator("#psFam .term li", has_text="England").first.get_attribute("data-i")))
    assert "Welcome to England!" in page.p.inner_text("#psFam .psf-skills")
    assert page.p.locator("#psFam .journey .done").count() == 1
    assert page.p.evaluate("parseFloat(document.querySelector('#psFam .bar i').style.width)") == 10


def test_seasonal_week_and_half_term(page):
    open_ps(page)
    while not page.p.is_disabled("#psFam [data-ps=prev]"):
        page.p.click("#psFam [data-ps=prev]")
    # Autumn term: 14 weeks, the last is the Christmas seasonal week
    last = page.p.locator("#psFam .term li").count() - 1
    jump(page, last)
    t = page.p.inner_text("#psFam .psf-seas")
    assert "Christmas week!" in t and "No new passport skills this week" in t
    assert page.p.locator("#psFam .bk").count() == 0
    assert "Seasonal week" in page.p.inner_text("#psFam .term li.cur")
    # Half term: week 8 is two weeks after week 7 (dates skip the break)
    jump(page, 6); d7 = page.p.inner_text("#psFam .when span")
    jump(page, 7); d8 = page.p.inner_text("#psFam .when span")
    assert d7.startswith("19 Oct") and d8.startswith("2 Nov"), (d7, d8)


def test_phone_no_sideways_scroll(phone):
    open_ps(phone)
    phone.p.wait_for_function("() => { const s = document.getElementById('nglSplash'); return !s || getComputedStyle(s).opacity === '0' || s.hidden; }", timeout=15000)
    phone.p.wait_for_timeout(1500)   # images
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    if SHOTS:
        phone.p.screenshot(path=os.path.join(SHOTS, "ps-family-phone.png"), full_page=True)
    phone.p.click("#psFam [data-ps=book][data-b='2']")
    phone.p.wait_for_selector("#psFam .bk button.on[data-b='2']")
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    if SHOTS:
        phone.p.screenshot(path=os.path.join(SHOTS, "ps-family-phone-book2.png"))
