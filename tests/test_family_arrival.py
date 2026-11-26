"""Parents arriving from an old family site (or a QR code): the code opens the right programme, and what the
old site saved on the phone (Recreational progress) comes with them without overwriting anything newer."""
import base64, json


def carry(d):
    return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")


def test_code_and_progress_arrive(page):
    prog = {"kids": [{"name": "Amelia", "levels": {"1": "2026-10-01"}}]}
    page.p.goto(page.base + "?demo&code=SAADI-R9TQ&carry=" + carry({"nglrec-progress": json.dumps(prog), "nglrec-book": "teal", "other-key": "x"}))
    page.p.wait_for_selector("#famPage", timeout=20000)
    page.p.wait_for_function("location.hash.startsWith('#/family/recreational')", timeout=15000)
    got = page.p.evaluate("[localStorage.getItem('nglrec-progress'), localStorage.getItem('nglrec-book'), localStorage.getItem('other-key'), location.search]")
    assert json.loads(got[0]) == prog and got[1] == "teal"
    assert got[2] is None                     # only the known keys are copied
    assert "carry" not in got[3]              # the link is tidied away once used


def test_newer_data_on_the_phone_is_kept(page):
    page.p.goto(page.base + "?demo#/home")
    page.p.evaluate("localStorage.setItem('nglrec-book', 'ruby')")
    page.p.goto(page.base + "?demo&code=SAADI-R9TQ&carry=" + carry({"nglrec-book": "teal"}))
    page.p.wait_for_selector("#famPage", timeout=20000)
    assert page.p.evaluate("localStorage.getItem('nglrec-book')") == "ruby"


def test_two_codes_two_programmes(page):
    page.p.goto(page.base + "?demo&codes=SAADI-7K4P,SAADI-R9TQ")
    page.p.wait_for_selector(".fam-tabs a", timeout=20000)
    tabs = page.p.inner_text(".fam-tabs").upper()
    assert "SCHOOLS" in tabs and "RECREATIONAL" in tabs and "GENERAL LEAGUE" in tabs


def test_unknown_code_says_so(page):
    page.p.goto(page.base + "?demo&code=NOPE-2222")
    page.p.wait_for_selector(".toast", timeout=20000)
    assert "couldn’t find that code" in page.p.inner_text(".toast")
