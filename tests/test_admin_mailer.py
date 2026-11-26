"""NGL Admin · Booking emails (sample data): the mailer copied from ngl-booking-system.html (admin mode).
Sample data: Send and "Send me a test" send nothing and record nothing. Any request to EmailJS, the old NGL Mailer
or the database is caught, so nothing can leave. The sandbox rules (only the signed-in admin, "[SANDBOX TEST] ",
example.com skipped) are checked by calling the mailer's plan()/deliver() with EmailJS mocked."""
import json


def watch(page):
    page.sent = []
    for pat in ["**/api.emailjs.com/**", "**/script.google.com/**", "**/firestore.googleapis.com/**"]:
        page.p.route(pat, lambda r: (page.sent.append(r.request.url), r.abort()))


def open_mailer(page, hash_):
    watch(page)
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#mlRoot #mlFrame", timeout=20000)


def preview(page):
    return page.p.frame_locator("#mlFrame").locator("body").inner_text()


def clubs(page):
    return page.p.locator("#mlClubs table tr").all_inner_texts()[1:]


def test_open_email(page):
    open_mailer(page, "#/admin/mailer/c1/open")
    assert "BOOKING EMAILS" in page.p.inner_text("#page h1").upper()
    root = page.p.inner_text("#mlRoot")
    assert "Sample data: nothing is sent." in root
    assert "Private MyBG links" in root and "It's saved, so you only do this once." in root
    assert "Each club gets its own email showing only its places." in root
    assert page.p.locator("#mlRoot .ml-tpls a.on").get_attribute("data-tpl") == "open"
    # only the club with reserved places, with its places; the booking with no email is named, not emailed
    rows = clubs(page)
    assert len(rows) == 1 and "SAADI Gymnastics" in rows[0] and "demo@club.example" in rows[0] and "12" in rows[0], rows
    assert "Not emailed (no email on record): SEGC" in page.p.inner_text("#mlClubs")
    assert "Booking deadline:" in page.p.inner_text("#mlInfo")
    t = preview(page)
    assert "To: demo@club.example" in t
    assert "Subject: Booking now open: NGL East Region, 7 Feb 2027" in t
    assert "Your places are ready to book" in t and "Hello SAADI Gymnastics," in t
    assert "Thank you for reserving places at our East Region competition on" in t
    assert "Booking is now open on the British Gymnastics MyBG (JustGo) site, exclusively for clubs with reservations." in t
    assert "YOUR RESERVED PLACES" in t and "Girls Levels 1–4" in t and "Book on MyBG" in t
    assert "3 months before the competition." in t
    assert "There's absolutely no obligation to take the places you've reserved." in t
    assert "Exclusively for British Gymnastics Clubs" in t
    assert "You're receiving this because your club reserved places at an NGL competition." in t
    assert page.p.inner_text("#mlSend") == "Send to 1 club"


def test_reminder_email(page):
    open_mailer(page, "#/admin/mailer/c1/remind")
    t = preview(page)
    assert "Subject: 1 week to go: confirm your places by" in t and "(NGL East Region, 7 Feb 2027)" in t
    assert "There's one week left to confirm and pay for your places on the MyBG (JustGo) site." in t
    assert "If you've already booked, thank you: there's nothing more to do." in t
    assert "Confirm on MyBG" in t and "If you'd like to enter, please confirm your places on MyBG before then." in t


def test_default_template_and_switching(page):
    open_mailer(page, "#/admin/mailer/c1")
    # the booking deadline (3 months before) has passed, so it opens on the reminder (as before)
    assert page.p.locator("#mlRoot .ml-tpls a.on").get_attribute("data-tpl") == "remind"
    page.p.click("#mlRoot .ml-tpls a[data-tpl=hub]")
    page.p.wait_for_function("location.hash === '#/admin/mailer/c1/hub' && document.querySelector('#mlRoot .ml-tpls a.on[data-tpl=hub]')", timeout=10000)


def test_waiting_list_email(page):
    open_mailer(page, "#/admin/mailer/c5/waitlist")
    rows = clubs(page)
    assert len(rows) == 1 and "SAADI Gymnastics" in rows[0] and "Open" in rows[0], rows
    assert "Places available = capacity minus places bought on JustGo" in page.p.inner_text("#mlLinks")
    t = preview(page)
    assert "(you're on the waiting list)" in t and "Good news: places are available" in t
    assert "You're on the waiting list for our Performance League Grades competition on" in t
    assert "First come, first served." in t
    assert "your club joined the waiting list for an NGL competition" in t


def test_no_waiting_list(page):
    open_mailer(page, "#/admin/mailer/c1/waitlist")
    assert "There is no waiting list for these competitions. Go to email 4 to offer the places to every Club Hub club." in page.p.inner_text("#mlClubs")
    assert page.p.locator("#mlSend").is_disabled()


def test_club_hub_email(page):
    open_mailer(page, "#/admin/mailer/c1/hub")
    rows = clubs(page)
    names = " | ".join(rows)
    # every Club Hub club except the one that already booked
    assert len(rows) == 2 and "Northgate Gymnastics Club" in names and "Riverside Gym Academy" in names and "SAADI" not in names, rows
    # places available = 20 (no maximum set) minus 14 bought on JustGo
    assert page.p.input_value("#mlLinks input[data-av=c1]") == "6"
    t = preview(page)
    assert "Subject: Places available: NGL competition, 7 Feb 2027 · open to clubs from every region" in t
    assert "Places available to book now" in t and "Hello Northgate Gymnastics Club," in t
    assert "as a club with an NGL Club Hub account you're hearing about them first." in t
    assert "Open to clubs from every region." in t and "6\nplaces left" in t
    # changing the number updates the preview; 0 everywhere = nothing to offer
    page.p.fill("#mlLinks input[data-av=c1]", "3")
    page.p.wait_for_function("document.querySelector('#mlFrame').srcdoc.includes('>3</b>place')", timeout=5000)
    page.p.fill("#mlLinks input[data-av=c1]", "0")
    page.p.click("[data-act=ml-test]")
    assert "Every competition shows 0 places available, so there is nothing to offer." in page.p.inner_text("#mlStatus")


def test_recreational_day(page):
    open_mailer(page, "#/admin/mailer/c4/open")
    t = preview(page)
    assert "Subject: Booking now open: NGL Recreational, 13 Mar 2027" in t
    assert "You reserved 30 places for the day. Book each gymnast into the session for their level:" in t
    assert "THE TWO SESSIONS" in t and "Ruby & Pink" in t


def test_mybg_link_needed_then_demo_sends_nothing(page):
    open_mailer(page, "#/admin/mailer/c1/open")
    dialogs = []
    page.p.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    page.p.click("[data-act=ml-test]")
    assert page.p.inner_text("#mlStatus") == "Paste the MyBG link for: Girls Levels 1–4"
    page.p.click("[data-act=ml-send]")
    assert page.p.inner_text("#mlStatus") == "Paste the MyBG link for: Girls Levels 1–4"
    assert dialogs == []
    link = "https://mybg.british-gymnastics.org/events/test-link"
    page.p.fill("#mml-c1", link)
    page.p.wait_for_function("u => document.querySelector('#mlFrame').srcdoc.includes(u)", arg=link, timeout=5000)
    assert page.p.frame_locator("#mlFrame").locator("a", has_text="Book on MyBG").get_attribute("href") == link
    page.p.click("[data-act=ml-test]")
    assert "Sample data: no test was sent." in page.p.inner_text("#mlStatus")
    page.p.click("[data-act=ml-send]")
    assert dialogs == ['Send the "Booking now open" email to 1 club now?']
    assert "Sample data: nothing was sent and nothing was recorded." in page.p.inner_text("#mlStatus")
    assert "already sent" not in page.p.inner_text("#mlInfo")
    # the link is kept when switching email
    page.p.click("#mlRoot .ml-tpls a[data-tpl=remind]")
    page.p.wait_for_selector("#mlRoot .ml-tpls a.on[data-tpl=remind]", timeout=10000)
    assert page.p.input_value("#mml-c1") == link
    assert page.sent == []


def test_untick_a_club(page):
    open_mailer(page, "#/admin/mailer/c1/hub")
    assert page.p.inner_text("#mlSend") == "Send to 2 clubs"
    page.p.locator("#mlClubs input[type=checkbox]").first.uncheck()
    assert page.p.inner_text("#mlSend") == "Send to 1 club"
    page.p.locator("#mlClubs input[type=checkbox]").nth(1).uncheck()
    assert page.p.inner_text("#mlSend") == "Send to 0 clubs" and page.p.locator("#mlSend").is_disabled()


def test_sandbox_sends_only_to_the_admin(page):
    """plan() + deliver() as the sandbox and live screens use them; EmailJS is mocked, so nothing leaves."""
    page.go("#/admin/mailer/c1/open", demo=True)
    page.p.wait_for_selector("#mlRoot", timeout=20000)
    got = []
    def emailjs(r):
        got.append(json.loads(r.request.post_data))
        r.fulfill(status=200, body="OK")
    page.p.route("**/api.emailjs.com/**", emailjs)
    run = """async ([mode, me, test]) => { const m = await import('./js/admin/mailer.js');
      const msgs = [{to: 'info@northgate.example', club: 'Northgate Gymnastics Club', subject: 'Booking now open: NGL East Region, 7 Feb 2027', html: '<p>Hello</p>'},
                    {to: 'coach@example.com', club: 'AUTOTEST Club', subject: 'Booking now open: NGL East Region, 7 Feb 2027', html: '<p>Hello</p>'}];
      return await m.deliver(m.plan(mode, me, test ? msgs.slice(0, 1) : msgs, test)); }"""
    # sandbox Send: both emails go to the signed-in admin only, marked [SANDBOX TEST]
    out = page.p.evaluate(run, ["sandbox", "dave@ngl-admin.test", False])
    assert [o["ok"] for o in out] == [True, True]
    assert [g["template_params"]["to_email"] for g in got] == ["dave@ngl-admin.test", "dave@ngl-admin.test"]
    assert all(g["template_params"]["subject"] == "[SANDBOX TEST] Booking now open: NGL East Region, 7 Feb 2027" for g in got)
    assert got[0]["service_id"] == "service_3qlufgh" and got[0]["template_id"] == "template_8i40iia"
    assert got[0]["template_params"]["invoice_html"] == "<p>Hello</p>"
    # sandbox test
    got.clear()
    page.p.evaluate(run, ["sandbox", "dave@ngl-admin.test", True])
    assert len(got) == 1 and got[0]["template_params"]["subject"] == "[SANDBOX TEST] [TEST] Booking now open: NGL East Region, 7 Feb 2027"
    # a made-up admin address is skipped: nothing sent
    got.clear()
    out = page.p.evaluate(run, ["sandbox", "christine@example.com", False])
    assert got == [] and all(o["skipped"] for o in out)
    # sample data: nothing at all
    out = page.p.evaluate(run, ["demo", "dave@ngl-admin.test", False])
    assert out == [] and got == []
    # live: each club its own email, test addresses skipped, no prefix
    out = page.p.evaluate(run, ["live", "dave@ngl-admin.test", False])
    assert [g["template_params"]["to_email"] for g in got] == ["info@northgate.example"]
    assert got[0]["template_params"]["subject"] == "Booking now open: NGL East Region, 7 Feb 2027"
    assert out[1]["skipped"] and out[1]["to"] == "coach@example.com"


def test_competitions_button_opens_it(page):
    watch(page)
    page.go("#/admin/competitions", demo=True)
    btn = page.p.locator('#page a[href="#/admin/mailer/c1"]')
    assert btn.inner_text() == "Booking emails"
    btn.click()
    page.p.wait_for_selector("#mlRoot #mlFrame", timeout=20000)
    assert "Booking emails".upper() in page.p.inner_text("#page h1").upper()
    assert page.sent == []


def test_planning_steps_open_it(page):
    page.go("#/admin/planning/demo-gl-east", demo=True)
    page.p.wait_for_selector("#plRoot .pl-task", timeout=20000)
    a = page.p.locator("#plRoot .pl-task[data-t=mlink] a.pl-step")
    assert a.get_attribute("href") == "#/admin/mailer/demo-gl-east/open" and a.get_attribute("target") is None
    assert page.p.locator("#plRoot .pl-task[data-t=mremind] a.pl-step").get_attribute("href") == "#/admin/mailer/demo-gl-east/remind"
    rel = page.p.locator("#plRoot .pl-task[data-t=release] a.pl-step")
    assert rel.nth(0).get_attribute("href") == "#/admin/mailer/demo-gl-east/waitlist"
    assert rel.nth(1).get_attribute("href") == "#/admin/mailer/demo-gl-east/hub"


def test_unknown_competition(page):
    watch(page)
    page.go("#/admin/mailer/nope/open", demo=True)
    page.p.wait_for_selector("#mlRoot select[data-go]", timeout=20000)
    assert "Competition not found. Choose one:" in page.p.inner_text("#mlRoot")


def test_phone_no_sideways_scroll(phone):
    open_mailer(phone, "#/admin/mailer/c1/hub")
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
