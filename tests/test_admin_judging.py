"""NGL Admin · Judging (the admin part of ngl-judging-pathway.html): sample data only, nothing is saved."""


def open_judging(page, hash_="#/admin/judging"):
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#jdRoot", timeout=20000)


def stat(page, label):
    return page.p.inner_text(f"#jdStats .stat:has(span:text-is('{label}')) b")


def test_judging_opens_with_stats(page):
    open_judging(page)
    t = page.p.inner_text("#jdRoot")
    assert "JUDGING APPLICATIONS" in t.upper()
    assert "Review, accept, and confirm judges for each competition" in t
    assert stat(page, "Pending") == "5" and stat(page, "Confirmed") == "3"
    assert stat(page, "Registered Judges") == "7" and stat(page, "Total Applications") == "9"
    assert page.p.input_value("#jdFilter") == "pending"
    assert page.p.locator("#jdAppList .jd-row").count() == 5


def test_judging_tiers_on_applications(page):
    open_judging(page)
    row = lambda n: page.p.inner_text(f"#jdAppList .jd-row:has(b:text-is('{n}'))")
    assert "Senior Judge" in row("Priya Shah")             # National Judge
    assert "Club Judge" in row("Tom Ellis")                 # BG Club Judge
    assert "Apprentice Judge" in row("Megan Hart")          # 1 prior + 1 confirmed shadow: 2 of the 3 needed
    assert "Club Judge" in row("Ben Okafor")                # older account with the single qualification field
    assert "remote" in row("Priya Shah") and "Main Judge · Beam" in row("Priya Shah")


def test_judging_search_and_filter(page):
    open_judging(page)
    page.p.fill("#jdSearch", "priya")
    page.p.wait_for_function("() => document.querySelectorAll('#jdAppList .jd-row').length === 1")
    page.p.fill("#jdSearch", "")
    page.p.select_option("#jdFilter", "confirmed")
    page.p.wait_for_function("() => document.querySelectorAll('#jdAppList .jd-row').length === 3")
    assert "Edit" in page.p.inner_text("#jdAppList") and "£75 · 09:00" in page.p.inner_text("#jdAppList")
    page.p.select_option("#jdFilter", "")
    page.p.wait_for_function("() => document.querySelectorAll('#jdAppList .jd-row').length === 9")


def test_judging_accept_in_demo(page):
    open_judging(page)
    page.p.click("#jdAppList .jd-row:has(b:text-is('Priya Shah')) [data-act=jd-accept]")
    page.p.wait_for_selector("#jdAcceptForm")
    assert "CONFIRM JUDGE BOOKING" in page.p.inner_text(".jd-dlg").upper()
    assert page.p.input_value("#jdPay") == "50"                     # quoted remote fee
    page.p.click("#jdAcceptBtn")
    assert "Please enter a confirmed time." in page.p.inner_text("#jdAcceptErr")
    page.p.fill("#jdTime", "09:00 – 10:30")
    page.p.click("#jdAcceptBtn")
    assert "Booking confirmed" in page.toast()
    page.p.wait_for_selector("#jdAcceptForm", state="detached")
    assert stat(page, "Pending") == "4" and stat(page, "Confirmed") == "4"
    assert page.p.locator("#jdAppList .jd-row:has(b:text-is('Priya Shah'))").count() == 0
    page.p.select_option("#jdFilter", "confirmed")
    page.p.wait_for_selector("#jdAppList .jd-row:has(b:text-is('Priya Shah')):has-text('09:00 – 10:30')")


def test_judging_decline_in_demo(page):
    open_judging(page)
    page.p.click("#jdAppList .jd-row:has(b:text-is('Tom Ellis')) [data-act=jd-decline]")
    page.p.wait_for_selector("#jdYes")
    assert "Decline Tom Ellis's application to judge Uneven Bars at General League · East Region?" in page.p.inner_text(".jd-dlg")
    page.p.click("#jdYes")
    assert "Application declined" in page.toast()
    assert stat(page, "Pending") == "4"
    page.p.select_option("#jdFilter", "declined")
    page.p.wait_for_selector("#jdAppList .jd-row:has(b:text-is('Tom Ellis'))")


def test_judging_judges_and_qualification(page):
    open_judging(page, "#/admin/judging/judges")
    t = page.p.inner_text("#jdJudgeList")
    assert "Lily Moss" in t and "BG: None" in t and "BG: National Judge (WAG), Club Judge (MAG)" in t
    row = "#jdJudgeList .jd-row:has(b:text-is('Lily Moss'))"
    assert "Apprentice Judge" in page.p.inner_text(row)
    page.p.click(row + " [data-act=jd-qual]")
    page.p.wait_for_selector("#jdQualRows select")
    page.p.select_option("#jdQualRows select[data-f=level]", "Regional Judge")
    page.p.click("[data-act=jd-qsave]")
    assert "Qualification updated" in page.toast()
    page.p.wait_for_selector(row + ":has-text('Senior Judge')")
    assert "BG: Regional Judge" in page.p.inner_text(row)


def test_judging_delete_judge_in_demo(page):
    open_judging(page, "#/admin/judging/judges")
    page.p.click("#jdJudgeList .jd-row:has(b:text-is('Ben Okafor')) [data-act=jd-del-judge]")
    page.p.wait_for_selector("#jdYes")
    assert "does NOT delete their login" in page.p.inner_text(".jd-dlg")
    page.p.click("#jdYes")
    page.p.wait_for_selector("#jdJudgeList .jd-row:has(b:text-is('Ben Okafor'))", state="detached")
    assert stat(page, "Registered Judges") == "6" and stat(page, "Total Applications") == "8"


def test_judging_resources_in_demo(page):
    open_judging(page, "#/admin/judging/resources")
    assert page.p.locator("#jdResList .jd-res").count() == 3
    page.p.click("[data-act=jd-restype][data-t=link]")
    assert page.p.is_visible("#jdResLink") and not page.p.is_visible("#jdResFile")
    page.p.fill("#jdResTitle", "AUTOTEST link")
    page.p.click("#jdResAdd")
    assert "Please enter a URL." in page.toast()
    page.p.fill("#jdResLink", "https://example.com/rules")
    page.p.click("#jdResAdd")
    page.p.wait_for_selector("#jdResList .jd-res:has-text('AUTOTEST link')")
    page.p.click("#jdResList .jd-res:has-text('AUTOTEST link') [data-act=jd-del-res]")
    page.p.click("#jdYes")
    page.p.wait_for_selector("#jdResList .jd-res:has-text('AUTOTEST link')", state="detached")


def test_judging_phone_layout(phone):
    phone.go("#/admin/judging", demo=True)
    phone.p.wait_for_selector("#jdRoot", timeout=20000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
