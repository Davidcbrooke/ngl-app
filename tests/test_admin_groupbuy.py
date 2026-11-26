"""NGL Admin · Group purchasing (sample data). Same sums as GYMNASTICS-RESULTS/ngl-group-order.html (?admin=1),
worked out by hand from the sample orders in js/admin/groupbuy.js:

Open round (5 orders)
  Staff T-shirt: SAADI French Navy 18 (back text), Riverside French Navy 18 adult + 10 children's, Northgate Royal Blue 20 (back logo)
    = 66 shirts, minimum reached, £8.20 band. French Navy 46, Royal Blue 20; 38 with a back print.
  Quarter Zip: SAADI Navy/White 12 (sleeve text), Hillside Black 18 (back text) = 30, below the minimum of 50.
  Invoices if it closed now (t-shirts only): Northgate £314.40, Riverside £309.91 (£274.60 + £35.31 VAT, part VAT), SAADI £244.32.
Last closed round: 120 t-shirts (£7.36 band), 55 quarter zips (£19.20)
  GB-01 Hillside £600.00 Overdue · GB-02 Northgate £339.40 Paid (children's sizes, no VAT) · GB-03 Oakwood £840.60 Sent to printer
  GB-04 Riverside £318.96 Not invoiced · GB-05 SAADI £585.60 Invoiced, awaiting payment.
Sample data keeps every change in memory only and never emails anyone."""
import csv, io


def open_gb(page):
    page.go("#/admin/groupbuy", demo=True)
    page.p.wait_for_selector("#gbRoot", timeout=20000)


def closed_round(page):
    page.p.select_option("#gbRound", index=2)
    page.p.wait_for_selector("#gbBills tr[data-bill$='-04']", timeout=10000)
    return page.p.input_value("#gbRound")


def row_cells(page, sel):
    return [c.strip() for c in page.p.locator(sel).locator("td").all_inner_texts()]


def bill(page, n):
    return page.p.locator(f"#gbBills tr[data-bill$='-{n:02d}']")


def test_opens_with_no_errors(page):
    open_gb(page)
    assert "GROUP PURCHASING" in page.p.inner_text("#page h1").upper()
    assert "(open now)" in page.p.locator("#gbRound option:checked").inner_text()
    assert page.p.locator("#gbOrderList tbody tr").count() == 5
    assert "Sample data" in page.p.inner_text(".gb-sandbox")
    # the countdown ticks
    page.p.wait_for_function("document.getElementById('gbCdS').textContent !== '–'", timeout=5000)


def test_live_board(page):
    open_gb(page)
    tee, zip_ = page.p.locator(".gb-brow[data-pid=JC001]"), page.p.locator(".gb-brow[data-pid=LV874]")
    assert tee.locator("[data-b=qty]").inner_text() == "66"
    assert tee.locator("[data-b=now]").inner_text() == "£8.20"
    assert tee.locator("[data-b=next]").inner_text() == "£7.36"
    assert tee.locator("[data-b=nexts]").inner_text() == "at 100 · 34 to go"
    assert zip_.locator("[data-b=qty]").inner_text() == "30"
    assert zip_.locator("[data-b=now]").inner_text() == "£19.20"
    mins = page.p.locator(".gb-minline").all_inner_texts()
    assert "Minimum of 50 reached" in mins[0]
    assert "20 more quarter zips needed" in mins[1]


def test_supplier_totals(page):
    open_gb(page)
    # Staff T-shirt columns: XS S M L XL 2XL 3XL 4XL 5XL 3/4 5/6 7/8 9/11 12/13 Total
    assert row_cells(page, "table[data-totals=JC001] tr[data-colour='French Navy']")[1:] == ["", "4", "16", "13", "3", "", "", "", "", "", "", "", "6", "4", "46"]
    assert row_cells(page, "table[data-totals=JC001] tr[data-colour='Royal Blue']")[-1] == "20"
    assert row_cells(page, "table[data-totals=JC001] tr.gb-all")[1:] == ["2", "9", "23", "17", "3", "2", "", "", "", "", "", "", "6", "4", "66"]
    assert page.p.inner_text("[data-sum=JC001]") == "3 orders · 66 shirts · 38 with a back print · price band: £8.20 each"
    # Quarter Zip columns: XXS XS S M L XL XXL 3XL Total
    assert row_cells(page, "table[data-totals=LV874] tr.gb-all")[1:] == ["", "", "3", "10", "9", "6", "2", "", "30"]
    assert page.p.inner_text("[data-sum=LV874]") == "2 orders · 30 quarter zips · 18 with a back print · 12 with sleeve text · price band: £19.20 each"


def test_open_round_invoices_preview(page):
    open_gb(page)
    assert "Invoicing opens then" in page.p.inner_text("#gbClose")
    assert page.p.inner_text("[data-final=JC001]") == "Staff T-shirt: 66 ordered · final price £8.20"
    assert page.p.inner_text("[data-final=LV874]") == "Quarter Zip: 30 ordered · below the minimum of 50: not going ahead"
    assert "left out of the invoices" in page.p.inner_text("#gbClose")
    assert page.p.locator("#gbBills tbody tr").all_inner_texts().__len__() == 3
    assert bill(page, 1).locator(".gb-tot").inner_text() == "£314.40"   # Northgate
    assert bill(page, 2).locator(".gb-tot").inner_text() == "£309.91"   # Riverside, children's sizes VAT free
    assert "£274.60 + £35.31 VAT" in bill(page, 2).inner_text()
    assert bill(page, 3).locator(".gb-tot").inner_text() == "£244.32"   # SAADI, quarter zip left out
    assert page.p.is_disabled("#gbInvAll")
    assert page.p.is_disabled("#gbBills [data-cl=inv]")


def test_closed_round_stages(page):
    open_gb(page)
    closed_round(page)
    assert "This order round has closed." in page.p.inner_text("#gbClose")
    assert page.p.inner_text("[data-final=JC001]") == "Staff T-shirt: 120 ordered · final price £7.36"
    assert page.p.inner_text("[data-final=LV874]") == "Quarter Zip: 55 ordered · final price £19.20"
    want = {1: ("£600.00", "Overdue"), 2: ("£339.40", "Paid"), 3: ("£840.60", "Sent to printer"),
            4: ("£318.96", "Not invoiced"), 5: ("£585.60", "Invoiced, awaiting payment")}
    for n, (tot, st) in want.items():
        assert bill(page, n).locator(".gb-tot").inner_text() == tot, n
        assert bill(page, n).locator(".gb-st").inner_text() == st, n
    assert "VAT" not in bill(page, 2).locator("td.n").nth(1).inner_text()   # children's sizes only: no VAT


def test_admin_actions_update_the_screen(page):
    open_gb(page)
    closed_round(page)
    # Mark paid
    bill(page, 5).locator("[data-cl=paid]").click()
    page.p.wait_for_function("document.querySelector(\"#gbBills tr[data-bill$='-05'] .gb-st\").textContent === 'Paid'", timeout=10000)
    assert page.p.inner_text("#gbMsg") == "SAADI Gymnastics marked as paid."
    # Email one invoice (sample data: marked as emailed, nothing sent)
    bill(page, 4).locator("[data-cl=inv]").click()
    page.p.wait_for_function("document.querySelector(\"#gbBills tr[data-bill$='-04'] .gb-st\").textContent === 'Invoiced, awaiting payment'", timeout=10000)
    assert "nothing was sent" in page.p.inner_text("#gbMsg")
    assert page.p.is_disabled("#gbInvAll")
    # Send all paid orders (Northgate and SAADI) to the printer
    page.p.once("dialog", lambda d: (d.message == "Send 2 paid orders to printedclothingltd@outlook.com?") and d.accept())
    page.p.click("#gbPrintAll")
    page.p.wait_for_function("document.querySelector(\"#gbBills tr[data-bill$='-02'] .gb-st\").textContent === 'Sent to printer'", timeout=10000)
    assert bill(page, 5).locator(".gb-st").inner_text() == "Sent to printer"
    assert page.p.inner_text("#gbMsg").startswith("2 orders sent to the printer.")
    assert page.p.is_disabled("#gbPrintAll")
    # Undo paid isn't offered once sent; the changes survive switching rounds
    page.p.select_option("#gbRound", index=1)
    page.p.wait_for_function("!document.querySelector(\"#gbBills tr[data-bill$='-04']\")", timeout=10000)
    closed_round(page)
    assert bill(page, 4).locator(".gb-st").inner_text() == "Invoiced, awaiting payment"


def test_view_invoice(page):
    open_gb(page)
    closed_round(page)
    with page.p.expect_popup() as pop:
        bill(page, 5).locator("[data-cl=view]").click()
    w = pop.value
    w.wait_for_load_state()
    txt = w.inner_text("body")
    assert "Invoice GB" in txt and "-05" in txt
    assert "50 × Staff T-shirt (JC001), Jet Black, adult sizes, club logo left chest" in txt
    assert "Back print: two lines of text" in txt and "£100.00" in txt
    assert "Total due" in txt and "£585.60" in txt
    assert "Sort code 60-84-64" in txt
    w.close()


def test_csv_exports(page):
    open_gb(page)
    rid = page.p.input_value("#gbRound")
    with page.p.expect_download() as d:
        page.p.click("[data-act=gb-csv]")
    assert d.value.suggested_filename == f"ngl-group-orders-{rid}.csv"
    rows = list(csv.reader(io.StringIO(open(d.value.path(), encoding="utf-8-sig").read())))
    assert rows[0][:8] == ["Ref", "Placed", "Product", "Club", "Contact", "Email", "Phone", "Colour"] and rows[0][-1] == "Status"
    assert len(rows) == 6
    assert {r[3] for r in rows[1:]} == {"SAADI Gymnastics", "Riverside Gym Academy", "Northgate Gymnastics Club", "Hillside Gymnastics"}
    with page.p.expect_download() as d:
        page.p.click("[data-act=gb-supplier]")
    assert d.value.suggested_filename == f"ngl-supplier-{rid}.csv"
    rows = list(csv.reader(io.StringIO(open(d.value.path(), encoding="utf-8-sig").read())))
    head = rows[0]
    assert head[:2] == ["Product", "Colour"] and head[-1] == "Total"
    sup = {(r[0], r[1]): r for r in rows[1:]}
    assert set(sup) == {("Staff T-shirt", "French Navy"), ("Staff T-shirt", "Royal Blue"), ("Quarter Zip", "Navy/White"), ("Quarter Zip", "Black")}
    fn = dict(zip(head, sup[("Staff T-shirt", "French Navy")]))
    assert (fn["M"], fn["9/11"], fn["Total"]) == ("16", "6", "46")
    assert dict(zip(head, sup[("Quarter Zip", "Black")]))["XXL"] == "2"


def test_phone_no_sideways_scroll(phone):
    phone.go("#/admin/groupbuy", demo=True)
    phone.p.wait_for_selector("#gbRoot #gbBills", timeout=20000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    phone.p.select_option("#gbRound", index=2)
    phone.p.wait_for_selector("#gbBills tr[data-bill$='-04']", timeout=10000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
