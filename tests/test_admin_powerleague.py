"""NGL Admin · Training League (sample data): the admin part of ngl-training-league.html?admin=1.
Sample data keeps every change in memory only, so nothing here touches a database."""


def open_tl(page):
    page.go("#/admin/powerleague", demo=True)
    page.p.wait_for_selector("#tlRoot #tlList tr[data-g]", timeout=20000)


def row(page, name):
    return page.p.locator("#tlList tr[data-g]", has_text=name)


def test_opens_with_gymnast_list(page):
    open_tl(page)
    assert "TRAINING LEAGUE" in page.p.inner_text("#page h1").upper()
    t = page.p.inner_text("#tlRoot")
    assert "ADD A GYMNAST" in t.upper() and "ENTER RESULTS" in t.upper()
    assert "The BG number is private" in t
    assert page.p.locator("#tlList tr[data-g]").count() == 10
    # every challenge in, with a BG number on file
    r = row(page, "Oliver H.").inner_text()
    assert "SAADI Gymnastics" in r and "13 / 13" in r and "✓" in r
    # an older entry with no gender shows as a boy
    assert "Boys" in row(page, "Jack D.").inner_text()
    # the public table link opens the live page
    link = page.p.locator("#tlRoot .tl-who a")
    assert link.get_attribute("href") == "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-training-league.html"


def test_find_gymnast(page):
    open_tl(page)
    page.p.fill("#tlFind", "riverside")
    page.p.wait_for_function("document.querySelectorAll('#tlList tr[data-g]').length === 2", timeout=10000)
    page.p.fill("#tlFind", "nobody here")
    page.p.wait_for_selector("#tlList td.empty", timeout=10000)


def test_add_gymnast_and_enter_results(page):
    open_tl(page)
    page.p.fill("#tlFirst", "Maya")
    page.p.fill("#tlInit", "s")
    page.p.select_option("#tlGen", "Girls")
    page.p.fill("#tlClub", "Test Valley Gymnastics")
    page.p.fill("#tlBg", "98-76 543")
    page.p.select_option("#tlAge", "9-11")
    page.p.select_option("#tlHrs", "6-10")
    page.p.click("#tlAddBtn")
    assert "Maya S. added" in page.toast()
    r = row(page, "Maya S.")
    r.wait_for(timeout=10000)
    assert "0 / 13" in r.inner_text() and "✓" in r.inner_text()
    assert page.p.input_value("#tlFirst") == ""

    # open the results dialog and enter two results
    r.locator("[data-act=tl-edit]").click()
    page.p.wait_for_selector("#tlDlg", timeout=10000)
    assert page.p.input_value("#tlEBg") == "9876543"
    page.p.fill("#tlDlg [data-v=sprint]", "2.2")
    page.p.fill("#tlDlg [data-v=hand]", "30")
    page.p.click("#tlSave")
    page.p.wait_for_function("!document.getElementById('tlDlg')", timeout=10000)
    assert "2 results saved" in page.p.locator(".toast").last.inner_text()
    page.p.wait_for_function("[...document.querySelectorAll('#tlList tr[data-g]')].some(r => r.textContent.includes('Maya S.') && r.textContent.includes('2 / 13'))", timeout=10000)


def test_best_result_stays(page):
    open_tl(page)
    row(page, "Oliver H.").locator("[data-act=tl-edit]").click()
    page.p.wait_for_selector("#tlDlg", timeout=10000)
    assert "Best: 2.18 s" in page.p.inner_text("#tlDlg")
    page.p.fill("#tlDlg [data-v=sprint]", "2.5")   # slower: the best stays
    page.p.click("#tlSave")
    page.p.wait_for_function("!document.getElementById('tlDlg')", timeout=10000)
    assert "1 result saved (1 didn’t beat the best, so the best stays)" in page.p.locator(".toast").last.inner_text()
    row(page, "Oliver H.").locator("[data-act=tl-edit]").click()
    page.p.wait_for_selector("#tlDlg", timeout=10000)
    assert "Best: 2.18 s" in page.p.inner_text("#tlDlg")


def test_remove_result_and_gymnast(page):
    open_tl(page)
    row(page, "Leo M.").locator("[data-act=tl-edit]").click()
    page.p.wait_for_selector("#tlDlg", timeout=10000)
    x = page.p.locator("#tlDlg [data-act=tl-clear][data-k=hand]")
    x.click()
    assert x.inner_text() == "Sure?"
    x.click()
    page.p.wait_for_function("!document.querySelector('#tlDlg [data-act=tl-clear][data-k=hand]')", timeout=10000)
    assert "3 / 13" in row(page, "Leo M.").inner_text()
    d = page.p.locator("#tlDlg [data-act=tl-del]")
    d.click()
    assert d.inner_text() == "Tap again to remove"
    d.click()
    page.p.wait_for_function("!document.getElementById('tlDlg')", timeout=10000)
    assert row(page, "Leo M.").count() == 0


def test_phone_has_no_sideways_scroll(phone):
    phone.go("#/admin/powerleague", demo=True)
    phone.p.wait_for_selector("#tlList tr[data-g]", timeout=20000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    phone.p.locator("#tlList [data-act=tl-edit]").first.click()
    phone.p.wait_for_selector("#tlDlg", timeout=10000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    assert phone.p.evaluate("(() => { const m = document.querySelector('.tl-modal'); return m.scrollWidth <= m.clientWidth + 1; })()")
