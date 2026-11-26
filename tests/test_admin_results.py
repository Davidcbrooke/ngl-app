"""NGL Admin · Results (sample data): result corrections and data quality, copied from admin-corrections.html.
Sample data keeps every change in memory only, so nothing here touches the GYMNASTICS-RESULTS repo."""


def open_results(page, hash_="#/admin/results"):
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#rsRoot .rs-sec", timeout=20000)


def accept_dialogs(page):
    page.p.on("dialog", lambda d: d.accept())


def test_results_opens(page):
    open_results(page)
    assert "RESULTS" in page.p.inner_text("#page h1").upper()
    root = page.p.inner_text("#rsRoot")
    for t in ["Result corrections and data quality", "BG NUMBER REASSIGNMENTS", "Reassign a BG Number",
              "SEARCH & CORRECT", "Search by Member ID", "ACTIVE CORRECTIONS", "Sample data"]:
        assert t.upper() in root.upper(), t
    assert "Ready · " in page.p.inner_text("#rsStatusText") and "entries loaded" in page.p.inner_text("#rsStatusText")
    # one sample reassignment and one sample correction
    assert page.p.locator("#rsReassignments tr td").count() >= 4
    assert "Leo Turner" in page.p.inner_text("#rsCorrTable")


def test_search_and_save_correction(page):
    open_results(page)
    page.p.fill("#rsSearch", "9100102")
    page.p.click("#rsSearchForm button[type=submit]")
    page.p.wait_for_selector("#rsResults .rs-gym", timeout=10000)
    card = page.p.inner_text("#rsResults .rs-gym")
    assert "MEMBER ID: 9100102" in card.upper() and "Isla Morgan" in card and "Changes apply to all results" in card
    assert page.p.locator("#rsResults .rs-results tr").count() >= 5   # header + 4 results
    # change the first row's age category: the cell turns gold, then Save Corrections adds it to Active Corrections
    page.p.select_option("#rs-row-0-ageCategory select", "9-11")
    page.p.wait_for_selector("#rs-row-0-ageCategory.modified", timeout=5000)
    page.p.click("[data-act=rs-save-gym]")
    assert "Saved" in page.toast()
    page.p.wait_for_selector("#rsCorrTable tr[data-id='9100102']", timeout=10000)
    row = page.p.inner_text("#rsCorrTable tr[data-id='9100102']")
    assert "Isla Morgan" in row and "→" in row and "9-11" in row
    assert "2 corrections" in page.p.inner_text("#rsCorrCount")


def test_unknown_member_id(page):
    open_results(page)
    page.p.fill("#rsSearch", "1234")
    page.p.press("#rsSearch", "Enter")
    page.p.wait_for_selector("#rsResults .empty", timeout=10000)
    assert "No results found for Member ID 1234" in page.p.inner_text("#rsResults")


def test_reassign_and_remove(page):
    accept_dialogs(page)
    open_results(page)
    page.p.fill("#rsFrom", "9100555")
    page.p.fill("#rsTo", "9100101")
    page.p.click("[data-act=rs-reassign]")
    page.p.wait_for_selector("#rsReassignments td:has-text('9100555')", timeout=10000)
    assert "Amelia Hart" in page.p.inner_text("#rsReassignments")
    assert page.p.inner_text("#rsRoot .rs-sec .rs-count") == "2"
    page.p.click("[data-act=rs-unreassign][data-from='9100555']")
    page.p.wait_for_function("!document.querySelector('#rsReassignments').textContent.includes('9100555')", timeout=10000)


def test_data_quality_and_apply_fix(page):
    open_results(page)
    page.p.click("#rsRoot .rs-tabs a:has-text('Data Quality')")
    page.p.wait_for_selector("#rsRoot .rs-flag", timeout=10000)
    assert "Gymnasts with conflicts" in page.p.inner_text("#rsRoot .rs-dq-summary")
    # default filter is Age Category: Isla Morgan has 12-14 and 9-11
    flag = page.p.locator("#rsRoot .rs-flag[data-id='9100102']")
    assert "AGE CATEGORY — 2 DIFFERENT VALUES" in flag.inner_text().upper()
    assert flag.locator(".rs-value.conflict").count() == 2
    flag.locator("select").select_option("12-14")
    flag.locator("[data-act=rs-dq-apply]").click()
    assert "Saved" in page.toast()
    flag = page.p.locator("#rsRoot .rs-flag[data-id='9100102']")
    flag.wait_for(timeout=10000)
    assert flag.locator(".rs-value.conflict").count() == 1   # the chosen value is no longer marked as a conflict
    # All Fields shows the gender clash too
    page.p.select_option("#rsDqFilter", "all")
    page.p.wait_for_selector("#rsRoot .rs-flag[data-id='9100107']", timeout=10000)
    assert "GENDER — 2 DIFFERENT VALUES" in page.p.inner_text("#rsRoot .rs-flag[data-id='9100107']").upper()


def test_fix_in_corrections(page):
    open_results(page, "#/admin/results/quality")
    page.p.wait_for_selector("#rsRoot .rs-flag", timeout=10000)
    page.p.click("#rsRoot .rs-flag[data-id='9100102'] [data-act=rs-fix]")
    page.p.wait_for_selector("#rsResults .rs-gym[data-id='9100102']", timeout=10000)
    assert page.p.input_value("#rsSearch") == "9100102"
    assert "Isla Morgan" in page.p.inner_text("#rsResults")


def test_results_on_phone(phone):
    phone.go("#/admin/results", demo=True)
    phone.p.wait_for_selector("#rsRoot .rs-sec", timeout=20000)
    phone.p.fill("#rsSearch", "9100102")
    phone.p.press("#rsSearch", "Enter")
    phone.p.wait_for_selector("#rsResults .rs-gym", timeout=10000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
