"""Judging for clubs: the purpose, the club's judges, invites; the invite link opens the judge sign-up filled in.
Judges keep their own login and never see the club's hub. Plus the phone menu scrolls sideways."""


def test_club_judging_page(page):
    page.go("#/judging", demo=True)
    txt = page.p.inner_text("#page")
    for s in ["Why we’re doing this", "Judge from home", "same piece", "Elevien", "YOUR CLUB’S JUDGES"]:
        assert s.lower() in txt.lower()
    assert "Megan Hart" in txt and "Invited" in txt


def test_invite_a_judge_and_arrive(page):
    page.go("#/judging", demo=True)
    page.p.click("[data-act=judge-invite]")
    page.p.fill("#jn", "Sam Jones")
    page.p.fill("#je", "sam@example.com")
    page.p.click(".modal form .btn")
    page.p.wait_for_selector("text=Invite for Sam Jones")
    link = page.p.inner_text(".modal p[style]")
    assert "judge=invite" in link and "jc=demo" in link
    page.p.goto(link.replace("/?", "/?demo&"))
    page.p.wait_for_selector("#jgRgName", timeout=15000)
    assert page.p.input_value("#jgRgName") == "Sam Jones"
    assert page.p.input_value("#jgRgClub") == "SAADI Gymnastics"


def test_phone_menu_scrolls(phone):
    phone.go("#/help", demo=True)
    nav = phone.p.locator("#nav")
    assert nav.evaluate("n => n.scrollWidth > n.clientWidth + 20")
    assert nav.evaluate("n => getComputedStyle(n).overflowX") == "auto"
    # the current page's button is in view
    assert phone.p.locator("#nav a.on").evaluate("a => { const r = a.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }")
