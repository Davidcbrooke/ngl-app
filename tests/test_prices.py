"""NGL's price list (prices.json) and the order check the card-payments script runs before charging (server/validate-order.js).
Sample data only (?demo): nothing is written to the database and nothing is charged.
The orders checked here are made by the app's own buttons (Shop basket, Skills Book, licences, packs, Graduation medals),
with api.placeOrder swapped for a recorder that keeps the exact document the app would save (data.js orderDoc).
"""
import json, os
import pytest
from conftest import ROOT, Page

PRICES = json.load(open(os.path.join(ROOT, "prices.json"), encoding="utf-8"))
VALIDATOR = open(os.path.join(ROOT, "server", "validate-order.js"), encoding="utf-8").read()


# ---------- today's prices (these must not change without Dave agreeing) ----------
def test_price_list_holds_todays_prices():
    P = PRICES
    assert P["vatRate"] == 0.2
    assert [b["price"] for b in P["licences"]["preschool"]["bands"]] == [150, 250, 400, 750]
    assert [b["price"] for b in P["licences"]["recreational"]["bands"]] == [200, 300, 500, 1000, 1250, 1500, 2000]
    assert [b["price"] for b in P["licences"]["schools"]["bands"]] == [150, 250, 400, 750, 1000, 1250, 1500]
    assert all(P["licences"][k]["vat"] for k in ("preschool", "recreational", "schools"))
    assert {k: v["price"] for k, v in P["packs"]["preschool"]["items"].items()} == {"pack2": 100, "pack3": 100, "pack4": 100, "seasonal": 50}
    assert P["packs"]["preschool"]["vat"] is True
    assert {p["k"]: p["price"] for p in P["products"]} == {"gbook": 4, "recbook": 5, "recmedal": 3, "schbook": 5, "schcert": 0.1, "pspass": 5, "psmedal": 2, "tshirt": 12}
    assert not any(p["vat"] for p in P["products"])
    assert [(b["upTo"], b["price"]) for b in P["postage"]["bands"]] == [(20, 4), (100, 8), (None, 12)]
    assert P["graduation"]["graduate"]["price"] == 5 and P["graduation"]["spectator"]["price"] == 5 and P["graduation"]["vat"] is True
    assert P["included"]["poster"]["price"] == 0


@pytest.fixture(scope="module")
def lab(browser, base_url):
    """A sample-data tab with the order check loaded and api.placeOrder recording each order the app makes."""
    pg = Page(browser, base_url)
    pg.go("#/home", demo=True)
    pg.p.add_script_tag(content=VALIDATOR)
    pg.p.evaluate("""async () => {
      const d = await import('./js/data.js');
      window.PRICES = await (await fetch('prices.json', {cache: 'no-store'})).json();
      window.DEMO = d.demo; window.ORDERS = [];
      d.default.placeOrder = async (lines, delivery, extra) => {
        const doc = {clubId: 'demo', clubName: 'SAADI Gymnastics', ...d.orderDoc(lines, delivery, extra)};
        doc.id = 'ORD-T' + (100 + window.ORDERS.length); window.ORDERS.push(JSON.parse(JSON.stringify(doc))); return {id: doc.id, total: doc.total}; };
      d.default.payByCard = async () => {};
      window.LIVE_CLUB = () => ({licences: JSON.parse(JSON.stringify(d.demo.licences))});
    }""")
    yield pg
    pg.close()


def made(pg, n_before):
    pg.p.wait_for_function("n => window.ORDERS.length > n", arg=n_before, timeout=10000)
    return pg.p.evaluate("window.ORDERS[window.ORDERS.length - 1]")


def count(pg):
    return pg.p.evaluate("window.ORDERS.length")


def submit_modal(pg, fill=None):
    pg.p.wait_for_selector(".modal form")
    for sel, val in (fill or {}).items():
        pg.p.fill(".modal " + sel, val)
    if pg.p.locator(".modal input[type=checkbox]").count():
        pg.p.check(".modal input[type=checkbox]")
    pg.p.click(".modal form button.btn >> nth=0")


@pytest.fixture(scope="module")
def real_orders(lab):
    """Every kind of order the app makes today, made by its own buttons."""
    pg, out = lab, {}
    # Shop basket: one product; every product (80 items); every product with 30 more books (110 items)
    for name, adds in [("shop: 10 books", ["gbook"]), ("shop: everything", [p["k"] for p in PRICES["products"]]),
                       ("shop: over 100 items", [p["k"] for p in PRICES["products"]] + ["gbook"] * 3)]:
        pg.route("#/shop")
        for k in adds:
            pg.p.click(f'[data-act=add][data-prod="{k}"]')
            pg.p.wait_for_timeout(150)
        n = count(pg)
        pg.p.click("[data-act=checkout]")
        submit_modal(pg, {"#addr": "SAADI Gymnastics, Redbourn, AL3 7PP"})
        out[name] = made(pg, n)
    # General Skills Book, either side of each postage band
    for q in (1, 20, 21, 100, 150):
        pg.route("#/home"); pg.route("#/programmes/general/awards")      # a fresh screen: after paying, the Buy button stays disabled
        pg.p.fill("#glQty", str(q))
        n = count(pg); pg.p.click("[data-act=gl-buy]")
        out[f"Skills Book × {q}"] = made(pg, n)
    # Pre-School packs (licence live in the sample data)
    for k in ("pack3", "pack4", "seasonal"):
        pg.route("#/programmes/preschool/licence")
        n = count(pg); pg.p.click(f'[data-act=ps-pack][data-pack="{k}"]')
        out[f"Pre-School {k}"] = made(pg, n)
    # Graduation medals, with and without extra spectators
    for g, s in ((64, 0), (20, 7), (2000, 10000)):
        pg.route("#/programmes/schools/compete")
        n = count(pg); pg.p.click('[data-act=sch-medals] >> nth=0')
        submit_modal(pg, {"#mq": str(g), "#ms": str(s)})
        out[f"Graduation {g} + {s}"] = made(pg, n)
    # Licences: every band of every pathway (the sample club is set to 'exploring' so the band tables show)
    pg.p.evaluate("for (const k of ['preschool', 'recreational', 'schools']) DEMO.licences[k] = {status: 'explore', label: 'Explore free'}")
    for path, act in (("preschool", "ps-buy"), ("recreational", "rec-buy"), ("schools", "sch-buy")):
        for b in PRICES["licences"][path]["bands"]:
            pg.route(f"#/programmes/{path}/licence")
            n = count(pg); pg.p.click(f'[data-act={act}][data-band="{b["k"]}"]')
            submit_modal(pg, {"#addr": "SAADI Gymnastics, Redbourn"} if path == "preschool" else None)
            out[f"{path} licence {b['k']}"] = made(pg, n)
    pg.p.evaluate("""() => { DEMO.licences.preschool = {status:'live', label:'Licence live', renews:'2027-09-01', band:'25–49 Pre-School gymnasts', packs:{pack2:true}};
      DEMO.licences.schools = {status:'live', label:'Licence live', renews:'2027-10-25', band:'250–399 gymnasts'};
      DEMO.licences.recreational = {status:'live', label:'Licence live', renews:'2027-04-02', band:'100–249 gymnasts'}; }""")
    # Group buying pay orders, as NGL Admin makes them (sample round)
    for o in pg.p.evaluate("async () => JSON.parse(JSON.stringify((await import('./js/admin/groupbuy.js')).demoPayOrders()))"):
        out[f"group buying {o['id']}"] = o
    return out


def check(pg, order, club="live"):
    return pg.p.evaluate("([o, c]) => validateOrder_(o, PRICES, c === 'live' ? LIVE_CLUB() : c)", [order, club])


def test_every_real_order_validates(lab, real_orders):
    assert len(real_orders) >= 30
    kinds = {o.get("kind") for o in real_orders.values()}
    assert {None, "supplies", "pack", "graduation", "licence", "groupbuy"} <= kinds
    for name, o in real_orders.items():
        r = check(lab, o)
        assert r["ok"], f"{name}: {r['error']}\n{o}"
        assert round(r["expectedTotal"] * 100) == round(o["total"] * 100), name
        assert all(isinstance(l["qty"], int) and l.get("k") for l in o["lines"]), name


def test_real_orders_have_todays_totals(real_orders):
    t = {k: round(o["total"], 2) for k, o in real_orders.items()}
    assert t["shop: 10 books"] == 44                     # 10 × £4 + £4 postage
    assert t["shop: everything"] == 10 * (4 + 5 + 3 + 5 + 0.1 + 5 + 2 + 12) + 8
    assert t["shop: over 100 items"] == 10 * (4 + 5 + 3 + 5 + 0.1 + 5 + 2 + 12) + 120 + 12
    assert [t[f"Skills Book × {q}"] for q in (1, 20, 21, 100, 150)] == [8, 84, 92, 408, 612]
    assert t["Pre-School seasonal"] == 60 and t["Pre-School pack3"] == 120
    assert t["Graduation 64 + 0"] == 384 and t["Graduation 20 + 7"] == 162
    assert t["preschool licence xs"] == 180 and t["preschool licence m"] == 900
    assert t["recreational licence xl"] == 2400 and t["schools licence m2"] == 1200


# ---------- tampered orders are refused ----------
TAMPER = {
    "a unit price changed to 1p": ("shop: everything", "o.lines.find(l => l.k === 'tshirt').unit = 0.01; fix(o)"),
    "the Skills Book at 1p": ("Skills Book × 150", "o.lines[0].unit = 0.01; fix(o)"),
    "the VAT line removed": ("recreational licence xl", "o.lines = o.lines.filter(l => l.k !== 'vat'); fix(o)"),
    "the VAT altered": ("schools licence l", "o.lines.find(l => l.k === 'vat').unit = 1; fix(o)"),
    "the VAT a penny short": ("Graduation 20 + 7", "o.lines.find(l => l.k === 'vat').unit -= 0.01; fix(o)"),
    "postage removed": ("shop: over 100 items", "o.lines = o.lines.filter(l => l.k !== 'postage'); fix(o)"),
    "postage from a smaller band": ("shop: over 100 items", "o.lines.find(l => l.k === 'postage').unit = 4; fix(o)"),
    "a made-up item key": ("shop: 10 books", "o.lines[0].k = 'goldbar'; fix(o)"),
    "an extra made-up line": ("shop: 10 books", "o.lines.push({k: 'freebie', n: 'Free', qty: 1, unit: 0}); fix(o)"),
    "a negative quantity": ("shop: everything", "o.lines[0].qty = -10; fix(o)"),
    "a huge quantity": ("Skills Book × 20", "o.lines[0].qty = 1000000; fix(o)"),
    "a part quantity": ("Skills Book × 20", "o.lines[0].qty = 2.5; fix(o)"),
    "a total that doesn't match its lines": ("shop: 10 books", "o.total = 0.5"),
    "a cheaper band's price on a dearer band": ("recreational licence xl", "o.lines[0].unit = 200; o.lines.find(l => l.k === 'vat').unit = 40; fix(o)"),
    "a band that doesn't exist": ("schools licence xs", "o.band = '1 to 5 Schools gymnasts'"),
    "two licences on one order": ("preschool licence m", "o.lines[0].qty = 2; o.lines.find(l => l.k === 'vat').unit = 300; fix(o)"),
    "a licence for a pathway with no licence": ("preschool licence xs", "o.licPath = 'general'"),
    "the free poster priced": ("preschool licence xs", "o.lines.find(l => l.k === 'poster').unit = -5; fix(o)"),
    "a pack at 1p": ("Pre-School pack4", "o.lines[0].unit = 0.01; o.lines[1].unit = 0; fix(o)"),
    "a pack that doesn't exist": ("Pre-School pack4", "o.pack = 'pack9'"),
    "Graduation medals at 1p": ("Graduation 64 + 0", "o.lines[0].unit = 0.01; o.lines[1].unit = 0; fix(o)"),
    "an unknown order type": ("shop: 10 books", "o.kind = 'gift'"),
    "a licence line on a shop order": ("shop: 10 books", "o.lines.unshift({k: 'licence', n: 'x', qty: 1, unit: 1}); fix(o)"),
    "no lines at all": ("shop: 10 books", "o.lines = []; o.total = 0"),
    "group buying made by a club": ("group buying", "delete o.createdBy"),
    "group buying without an ORD-GB reference": ("group buying", "o.id = 'ORD-ABCDE'"),
    "group buying with another invoice's reference": ("group buying", "o.invoiceNo = 'GB209911-99'"),
    "group buying not adding up": ("group buying", "o.total = Math.round((o.total - 10) * 100) / 100"),
    "group buying with a made-up line": ("group buying", "o.lines.push({k: 'gift', n: 'x', qty: 1, unit: 5}); fix(o)"),
    "an ORD-GB reference on a club order": ("shop: 10 books", "o.id = 'ORD-GB202611-01'"),
}


@pytest.mark.parametrize("what", list(TAMPER))
def test_tampered_order_is_refused(lab, real_orders, what):
    base, js = TAMPER[what]
    o = next(v for k, v in real_orders.items() if k.startswith(base))
    r = lab.p.evaluate("""([o, js]) => { const fix = x => { x.total = Math.round(x.lines.reduce((a, l) => a + l.qty * l.unit, 0) * 100) / 100; };
      o = JSON.parse(JSON.stringify(o)); eval(js); return validateOrder_(o, PRICES, LIVE_CLUB()); }""", [o, js])
    assert not r["ok"] and r["error"], f"{what} was allowed"


def test_licensed_items_need_a_live_licence(lab, real_orders):
    exploring = {"licences": {"preschool": {"status": "explore"}, "recreational": {"status": "explore"}, "schools": {"status": "explore"}}}
    assert not check(lab, real_orders["shop: everything"], exploring)["ok"]          # Rec medals etc. need a live licence
    assert check(lab, real_orders["shop: 10 books"], exploring)["ok"]                # the Skills Book doesn't
    assert not check(lab, real_orders["Pre-School pack3"], exploring)["ok"]          # packs sit on a live licence
    assert check(lab, real_orders["preschool licence s"], exploring)["ok"]           # and anyone can buy the licence itself


def test_no_price_list_no_payment(lab, real_orders):
    r = lab.p.evaluate("o => validateOrder_(o, null)", real_orders["shop: 10 books"])
    assert not r["ok"]


# ---------- one source of truth ----------
def test_app_copy_matches_prices_json(lab):
    app = lab.p.evaluate("async () => (await import('./js/prices.js')).default")
    assert app == PRICES, "js/prices.js no longer matches prices.json: paste prices.json into js/prices.js"


def test_prices_on_screen_come_from_the_price_list(lab):
    pg = lab
    pg.route("#/shop")
    shop = pg.p.inner_text("#page")
    for p in PRICES["products"]:
        assert p["n"] in shop
    assert "£4 each" in shop and "£0.10 each" in shop and "£12 each" in shop
    pg.route("#/programmes/preschool/licence")
    t = pg.p.inner_text("#page")
    assert "£100" in t and "£50" in t                                               # the packs
    pg.route("#/programmes/general/awards")
    assert "£4 per book" in pg.p.inner_text("#page")
    pg.p.evaluate("for (const k of ['preschool', 'recreational', 'schools']) DEMO.licences[k] = {status: 'explore', label: 'Explore free'}")
    try:
        for path, want in (("preschool", ["£150", "£250", "£400", "£750"]), ("recreational", ["£200", "£1,000", "£1,250", "£2,000"]), ("schools", ["£150", "£1,000", "£1,500"])):
            pg.route(f"#/programmes/{path}/licence")
            t = pg.p.inner_text("#page")
            for w in want:
                assert w in t, f"{path}: {w} not shown"
        dl = pg.p.evaluate("async () => (await import('./js/data.js')).DEFAULT_LICENCES")   # the "exploring" banner for clubs without a licence
        assert [dl[k]["price"] for k in ("preschool", "schools", "recreational")] == ["from £150 a year + VAT"] * 2 + ["from £200 a year + VAT"]
    finally:
        pg.p.evaluate("""() => { DEMO.licences.preschool = {status:'live', label:'Licence live', renews:'2027-09-01', band:'25–49 Pre-School gymnasts', packs:{pack2:true}};
          DEMO.licences.schools = {status:'live', label:'Licence live', renews:'2027-10-25', band:'250–399 gymnasts'};
          DEMO.licences.recreational = {status:'live', label:'Licence live', renews:'2027-04-02', band:'100–249 gymnasts'}; }""")
    pg.route("#/programmes/schools/compete")
    assert "£5 + VAT" in pg.p.inner_text("#page")
