"""NGL Admin · NGL P&L (sample data). Same sums as GYMNASTICS-RESULTS/NGL_Finance.html, worked out by hand
from the sample data in js/admin/finance.js (season 2027, default settings):

Forecast (reserved + bought + pending places)        Actual (JustGo)
  GL East (SAADI, girls £40)   90 -> +£3,611           72 sold -> +£2,819
  Rec Ruby (Redbourn, 2 piece) 30 -> -£300             24 sold -> -£441
  Performance (Stevenage)      16 -> -£193             unmatched -> -£1,025 (fixed costs only)
  Rec Teal (Redbourn, 4 piece) 20 -> -£325             nothing sold -> -£765
Competition income £7,004 / £4,260, licences £1,200 + shop £787 actual (ex VAT), merchandise £1,000 both,
competition costs £4,211 / £3,672, Ops Manager salary £6,000 + merchandise stock £500 both.
Profit: forecast -£2,707, actual -£2,925, difference -£218.
Sample data keeps every change in memory only, so nothing here touches a database."""


def open_fin(page, hash_="#/admin/finance"):
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#fnRoot", timeout=20000)


def cells(page, table, label):
    row = page.p.locator(f"#{table} tbody tr", has=page.p.locator("td.fn-l b", has_text=label)).first
    return [c.strip() for c in row.locator("td.fn-n").all_inner_texts()]


def test_opens_with_no_errors(page):
    open_fin(page)
    assert "NGL P&L" in page.p.inner_text("#page h1").upper()
    assert page.p.input_value("#fnSeason") == "2027"
    assert "last synced from JustGo" in page.p.inner_text("#fnSync")
    assert page.p.locator("#fnComps tbody tr").count() == 4


def test_season_figures(page):
    open_fin(page)
    assert page.p.inner_text("#fnProfitF") == "-£2,707"
    assert page.p.inner_text("#fnProfitA") == "-£2,925"
    assert cells(page, "fnPnl", "Entry fees") == ["£5,600", "£3,360", "-£2,240"]
    assert cells(page, "fnPnl", "Spectator tickets") == ["£1,404", "£780", "-£624"]
    assert cells(page, "fnPnl", "Other JustGo sales") == ["£0", "£120", "+£120"]
    assert cells(page, "fnPnl", "Licences: Schools")[1:] == ["£950", "+£950"]
    assert cells(page, "fnPnl", "Licences: Pre-School")[1:] == ["£250", "+£250"]
    assert cells(page, "fnPnl", "Shop: Recreational")[1:] == ["£619", "+£619"]
    assert cells(page, "fnPnl", "Shop: General League")[1:] == ["£168", "+£168"]
    assert cells(page, "fnPnl", "Medals") == ["£450", "£216", "-£234"]
    assert cells(page, "fnPnl", "Host club payments") == ["£425", "£180", "-£245"]
    assert cells(page, "fnPnl", "National Ops Manager salary") == ["£6,000", "£6,000", "–"]
    assert cells(page, "fnPnl", "Total income") == ["£8,004", "£7,247", "-£757"]
    assert cells(page, "fnPnl", "Total costs") == ["£10,711", "£10,172", "-£539"]
    assert cells(page, "fnPnl", "Profit") == ["-£2,707", "-£2,925", "-£218"]
    # each competition: forecast profit, actual profit
    profits = {r.get_attribute("data-comp"): [c.strip() for c in r.locator("td.fn-n").all_inner_texts()][2:4]
               for r in page.p.locator("#fnComps tbody tr").all()}
    assert profits == {"f-gl-east": ["£3,611", "£2,819"], "f-rec-ruby": ["-£300", "-£441"],
                       "f-perf": ["-£193", "-£1,025"], "f-rec-teal": ["-£325", "-£765"]}


def test_income_target_counts_in_forecast(page):
    open_fin(page)
    page.p.fill("input[data-ft='2027_lic_schools']", "1000")
    page.p.press("input[data-ft='2027_lic_schools']", "Tab")
    page.p.wait_for_function("document.querySelector('#fnProfitF').textContent === '-£1,707'", timeout=10000)
    assert cells(page, "fnPnl", "Licences: Schools")[1:] == ["£950", "-£50"]


def test_competition_mini_pnl(page):
    open_fin(page)
    page.p.click("#fnComps a[href='#/admin/finance/f-gl-east']")
    page.p.wait_for_selector("#fnComp", timeout=10000)
    assert page.p.inner_text("#fnRes") == "90" and page.p.inner_text("#fnSold") == "72" and page.p.inner_text("#fnLeft") == "48"
    assert cells(page, "fnComp", "Entry fees") == ["£3,600", "£2,880", "-£720"]
    assert cells(page, "fnComp", "Total costs") == ["£799", "£781", "-£18"]
    assert cells(page, "fnComp", "Profit") == ["£3,611", "£2,819", "-£792"]
    assert "NGL GENERAL LEAGUE EAST REGION" in page.p.inner_text("#page")


def test_typed_actual_cost_changes_profit(page):
    open_fin(page, "#/admin/finance/f-gl-east")
    page.p.wait_for_selector("#fnComp", timeout=10000)
    inp = "input[data-fo='f-gl-east|elev']"
    page.p.fill(inp, "300")
    page.p.press(inp, "Enter")
    page.p.wait_for_selector("#fnComp tr.fn-typed[data-line=elev]", timeout=10000)
    assert cells(page, "fnComp", "Elevien")[0] == "£185" and cells(page, "fnComp", "Elevien")[-1] == "+£115"
    assert cells(page, "fnComp", "Profit") == ["£3,611", "£2,704", "-£907"]
    # the season P&L picks it up, and shows it was typed
    page.p.click("text=← Season P&L")
    page.p.wait_for_selector("#fnPnl", timeout=10000)
    assert page.p.inner_text("#fnProfitA") == "-£3,040"
    assert "1 typed" in page.p.locator("#fnPnl tr", has_text="Elevien").inner_text()
    # and back to the calculated figure
    page.p.click("#fnComps a[href='#/admin/finance/f-gl-east']")
    page.p.wait_for_selector("#fnComp tr.fn-typed[data-line=elev]", timeout=10000)
    page.p.click("[data-act=fn-clear][data-k=elev]")
    page.p.wait_for_selector("#fnComp tr[data-line=elev]:not(.fn-typed)", timeout=10000)
    assert cells(page, "fnComp", "Profit") == ["£3,611", "£2,819", "-£792"]


def test_match_unmatched_justgo_event(page):
    open_fin(page)
    unm = page.p.inner_text("#fnUnmatched")
    assert "NGL PERFORMANCE GRADES (MOVED)" in unm and "£572 gross" in unm
    page.p.select_option("select[data-fm=EV000103]", "f-perf")
    page.p.wait_for_function("!document.querySelector('#fnUnmatched') && document.querySelector('#fnProfitA').textContent === '-£2,423'", timeout=10000)
    assert cells(page, "fnPnl", "Entry fees")[1] == "£3,860"
    perf = page.p.locator("#fnComps tr[data-comp=f-perf] td.fn-n").all_inner_texts()
    assert perf[1].strip() == "10" and perf[3].strip() == "-£523"


def test_settings_change_a_price(page):
    open_fin(page)
    page.p.click("#fnSettings summary")
    page.p.select_option("#fnSetPath", "general")
    inp = "#fnSettings input[data-fs=genGirls]"
    assert page.p.input_value(inp) == "40"
    page.p.fill(inp, "45")
    page.p.press(inp, "Enter")
    # 90 reserved GL girls x £5 more = +£450 forecast
    page.p.wait_for_function("document.querySelector('#fnProfitF').textContent === '-£2,257'", timeout=10000)
    assert page.p.locator("#fnSettings .fn-f.ov").count() == 1
    assert page.p.locator("#fnSettings").get_attribute("open") is not None


def test_league_wide_line(page):
    open_fin(page)
    page.p.click("[data-act=fn-lw-add][data-type=income]")
    page.p.wait_for_selector("#fnLeague .fn-lw >> nth=3", timeout=10000)
    last = page.p.locator("#fnLeague .fn-lw").last
    last.locator("input[type=text]").fill("Sponsorship")
    last.locator("input[type=text]").press("Tab")
    page.p.wait_for_function("document.activeElement && document.activeElement.type === 'number'", timeout=10000)
    page.p.wait_for_timeout(400)
    amt = page.p.locator("#fnLeague .fn-lw").last.locator("input[type=number]")
    amt.fill("100")
    amt.press("Tab")
    # £100 a month = £1,200 in both columns
    page.p.wait_for_function("document.querySelector('#fnProfitA').textContent === '-£1,725'", timeout=10000)
    assert page.p.inner_text("#fnProfitF") == "-£1,507"


def test_phone_no_sideways_scroll(phone):
    for h in ["#/admin/finance", "#/admin/finance/f-rec-ruby"]:
        phone.go(h, demo=True)
        phone.p.wait_for_selector("#fnRoot .fn-t", timeout=20000)
        phone.p.evaluate("document.getElementById('fnSettings') && (document.getElementById('fnSettings').open = true)")
        assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), h
