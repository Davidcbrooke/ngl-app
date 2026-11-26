"""NGL Admin · Projected P&L (sample data). Same maths as GYMNASTICS-RESULTS/NGL_Projection.html: the expected
figures below were read from the original page (?demo) with the default figures ("Base case"), and with
"Most clubs NGL expects to sign up" changed from 300 to 500.
Sample data keeps every scenario in memory only, so nothing here touches a database."""


def open_pj(page):
    page.go("#/admin/projection", demo=True)
    page.p.wait_for_selector("#pjRoot #pjPl tbody tr", timeout=20000)


def row(page, label, band=None):
    """Cells of the first P&L row with this label (after the band row, if given): 10 years then the total."""
    return page.p.evaluate("""([label, band]) => { const rows = [...document.querySelectorAll('#pjPl tbody tr')];
        let i = 0; if (band) i = rows.findIndex(r => r.classList.contains('band') && r.cells[0].innerText.trim() === band);
        const r = rows.slice(i).find(r => r.cells[0].innerText.trim() === label);
        return r ? [...r.cells].slice(1).map(c => c.innerText.trim()) : null; }""", [label, band])


def cards(page):
    return {k: page.p.inner_text(f"#{k}") for k in ["pjInc10", "pjNet10", "pjNet1", "pjNetLast", "pjLic", "pjPayback"]}


def test_opens_with_no_errors(page):
    open_pj(page)
    assert "PROJECTED P&L" in page.p.inner_text("#page h1").upper()
    assert page.p.input_value("#pjScen") == "Base case"
    assert page.p.locator("[data-act=pj-del]").is_disabled()          # only one scenario
    assert page.p.locator("#pjChart svg rect").count() == 20           # income and net profit bars, no default outlines
    assert page.p.get_attribute("a.pj-live", "href") == "#/admin/finance"


def test_default_figures_match_the_original(page):
    open_pj(page)
    assert cards(page) == {"pjInc10": "£10,829,508", "pjNet10": "£5,512,211", "pjNet1": "£15,522",
                           "pjNetLast": "£923,858", "pjLic": "690 licences", "pjPayback": "Year 1"}
    head = [c.strip() for c in page.p.locator("#pjPl thead th").all_inner_texts()]
    assert head == ["£"] + [str(y) for y in range(2027, 2037)] + ["10 years"]
    assert row(page, "Licences", "PRE-SCHOOL") == ["10.0", "20.0", "40.0", "80.0", "160.0", "300.0", "300.0", "300.0", "300.0", "300.0", ""]
    assert row(page, "Licences", "SCHOOLS") == ["10.0", "20.0", "40.0", "80.0", "90.0", "90.0", "90.0", "90.0", "90.0", "90.0", ""]
    assert row(page, "Books sold", "SCHOOLS") == ["1,900", "2,533", "5,067", "10,133", "6,967", "5,700", "5,700", "5,700", "5,700", "5,700", "55,100"]
    assert row(page, "Posters for new clubs", "PRE-SCHOOL") == ["-£150", "-£150", "-£300", "-£600", "-£1,200", "-£2,100", "–", "–", "–", "–", "-£4,500"]
    assert row(page, "Recreational profit")[-1] == "£4,451,469"
    assert row(page, "Group Buying rebate and margin")[0] == "£764" and row(page, "Group Buying rebate and margin")[-1] == "£138,218"
    assert row(page, "Media costs (delivery, storage, kit)")[-1] == "-£9,408"
    assert row(page, "Total income") == ["£81,720", "£152,185", "£300,263", "£596,008", "£1,017,191", "£1,748,251", "£1,732,294", "£1,733,029", "£1,733,838", "£1,734,727", "£10,829,508"]
    assert row(page, "Staff costs (salaries and on-costs)")[-1] == "-£1,034,720"
    assert row(page, "Marketing") == ["-£6,000", "-£6,000", "-£9,008", "-£17,880", "-£30,516", "-£52,448", "-£51,969", "-£51,991", "-£52,015", "-£52,042", "-£329,868"]
    assert row(page, "Total running costs")[-1] == "-£1,523,888"
    assert row(page, "NET PROFIT") == ["£15,522", "£47,369", "£81,156", "£261,491", "£489,004", "£926,771", "£921,660", "£922,324", "£923,055", "£923,858", "£5,512,211"]
    assert row(page, "Net margin") == ["19%", "31.1%", "27%", "43.9%", "48.1%", "53%", "53.2%", "53.2%", "53.2%", "53.3%", "50.9%"]
    assert row(page, "Cumulative net profit")[-2:] == ["£5,512,211", ""]
    assert page.p.inner_text("#pjCapNote").startswith("Licences reach the cap in 2032: 300 clubs × each pathway’s share = 690 licences.")
    assert "growth after that year has no effect" in page.p.inner_text("#pjGrowthNote")


def test_changing_a_variable_updates_the_figures(page):
    open_pj(page)
    page.p.fill("input[data-path='maxClubs']", "500")
    page.p.wait_for_function("document.getElementById('pjNet10').innerText === '£8,049,276'", timeout=5000)
    assert cards(page) == {"pjInc10": "£15,001,645", "pjNet10": "£8,049,276", "pjNet1": "£15,522",
                           "pjNetLast": "£1,621,272", "pjLic": "1,150 licences", "pjPayback": "Year 1"}
    assert page.p.evaluate("document.activeElement.dataset.path") == "maxClubs"     # the box you're typing in isn't redrawn
    assert "Dashed outlines show the default figures" in page.p.inner_text("#pjCapNote")
    assert page.p.locator("#pjChart svg rect").count() == 40           # default figures drawn as outlines
    # a percentage box: Pre-School share 100% -> 50% halves its cap (500 clubs x 50% = 250 licences from year 6)
    page.p.fill("input[data-path='paths.preschool.share']", "50")
    page.p.wait_for_timeout(200)
    assert row(page, "Licences", "PRE-SCHOOL")[3:7] == ["80.0", "160.0", "250.0", "250.0"]
    # reset puts the default figures back
    page.p.click("[data-act=pj-reset]")
    page.p.wait_for_function("document.getElementById('pjNet10').innerText === '£5,512,211'", timeout=5000)
    assert page.p.input_value("input[data-path='maxClubs']") == "300"


def test_scenarios_save_switch_and_delete(page):
    open_pj(page)
    page.p.click("[data-act=pj-save-as]")
    assert "Type a name" in page.toast()
    page.p.fill("#pjNewName", "Slow growth")
    page.p.click("[data-act=pj-save-as]")
    page.p.wait_for_function("document.getElementById('pjScen').value === 'Slow growth'", timeout=5000)
    page.p.fill("input[data-path='growth.1']", "50")
    page.p.wait_for_function("document.getElementById('pjNet10').innerText !== '£5,512,211'", timeout=5000)
    slow = page.p.inner_text("#pjNet10")
    page.p.wait_for_function("document.getElementById('pjSaveState').innerText === 'Saved (demo)'", timeout=5000)
    # back to the base case: its figures are untouched
    page.p.select_option("#pjScen", "Base case")
    page.p.wait_for_function("document.getElementById('pjNet10').innerText === '£5,512,211'", timeout=5000)
    assert page.p.input_value("input[data-path='growth.1']") == "100"
    # the saved scenario kept its change, also after leaving the screen and coming back
    page.route("#/admin")
    page.route("#/admin/projection")
    page.p.wait_for_selector("#pjScen")
    assert sorted(page.p.locator("#pjScen option").all_inner_texts()) == ["Base case", "Slow growth"]
    page.p.select_option("#pjScen", "Slow growth")
    page.p.wait_for_function(f"document.getElementById('pjNet10').innerText === {slow!r}", timeout=5000)
    assert page.p.input_value("input[data-path='growth.1']") == "50"
    # delete needs a second tap
    page.p.click("[data-act=pj-del]")
    assert page.p.inner_text("[data-act=pj-del]") == "Tap again to delete"
    page.p.click("[data-act=pj-del]")
    page.p.wait_for_function("document.querySelectorAll('#pjScen option').length === 1", timeout=5000)
    assert page.p.input_value("#pjScen") == "Base case"


def test_roles_and_csv(page):
    open_pj(page)
    page.p.click("[data-act=pj-add-role]")
    page.p.wait_for_selector("input[data-role='3']")
    page.p.fill("input[data-path='roles.3.pay.0']", "10000")
    page.p.wait_for_timeout(200)
    assert row(page, "Salary: New role")[0] == "-£10,000"
    assert row(page, "Staff costs (salaries and on-costs)")[0] == "-£39,440"        # (24,000 + 10,000) x 1.16
    page.p.click("[data-act=pj-del-role][data-i='3']")
    page.p.wait_for_timeout(200)
    assert row(page, "Salary: New role") is None
    with page.p.expect_download() as d:
        page.p.click("[data-act=pj-csv]")
    assert d.value.suggested_filename.startswith("NGL-Projected-PnL-Base-case-")
    text = open(d.value.path(), encoding="utf-8").read().splitlines()
    assert text[0].startswith('"Base case","2027"') and '"NET PROFIT",15522,47369' in "\n".join(text)


def test_phone_no_sideways_scroll(phone):
    phone.go("#/admin/projection", demo=True)
    phone.p.wait_for_selector("#pjRoot #pjPl tbody tr", timeout=20000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    assert phone.p.evaluate("getComputedStyle(document.querySelector('#pjPl tbody tr')).display") == "table-row"   # still a real table
