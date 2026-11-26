"""NGL Admin · Email assistant (sample data): copied from NGL_Email_Assistant.html.
Sample emails live in memory only; any request to the Apps Script or Gmail fails the test, so nothing can be sent."""


def open_email(page):
    page.sent = []
    page.p.route("**/script.google.com/**", lambda r: (page.sent.append(r.request.url), r.abort()))
    page.p.route("**/mail.google.com/**", lambda r: (page.sent.append(r.request.url), r.abort()))
    page.go("#/admin/email", demo=True)
    page.p.wait_for_selector("#emRoot .em-card", timeout=20000)


def card(page, t):
    return page.p.locator(f"#emRoot .em-card[data-t={t}]")


def test_email_opens(page):
    open_email(page)
    assert "EMAIL ASSISTANT" in page.p.inner_text("#page h1").upper()
    root = page.p.inner_text("#emRoot")
    assert "Nothing is sent until you press Send" in root
    assert "Sandbox: sending is switched off" in root
    link = page.p.locator("#emRoot .em-sandbox a")
    assert link.get_attribute("href") == "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/NGL_Email_Assistant.html"


def test_drafts_list(page):
    open_email(page)
    tots = page.p.inner_text("#emTot")
    assert "2\nneed you" in tots and "2\nreplies ready to send" in tots, tots
    # "Needs you" first, then oldest first (same order as the script)
    assert page.p.locator("#emRoot .em-card").evaluate_all("cs => cs.map(c => c.dataset.t)") == ["d4", "d1", "d3", "d2"]
    d1 = card(page, "d1")
    assert "dave" in d1.get_attribute("class")
    t = d1.inner_text()
    assert "Sam Parent" in t and "sam.parent@example.com" in t and "Refund for Finals spectator tickets" in t
    assert "Claude: Parent asking for a refund" in t and "Why it needs you: refund decision" in t
    assert d1.locator("details").get_attribute("open") is not None      # their email open for "Needs you"
    assert card(page, "d2").locator("details").get_attribute("open") is None
    assert "READY TO SEND" in card(page, "d2").locator(".em-tag").inner_text().upper()
    d3 = card(page, "d3").text_content()
    assert "3 messages in this conversation" in d3 and "Attached: Northgate class list.pdf" in d3
    # Gmail's line wrapping is undone in the draft
    assert "straight away." in card(page, "d3").locator("textarea").input_value()
    assert "(no draft: write one)" in card(page, "d4").text_content()


def test_edit_a_draft_survives_redraw(page):
    open_email(page)
    ta = card(page, "d2").locator("textarea")
    ta.fill("Hello,\n\nEdited by Dave.")
    page.p.click("#emRefresh")
    page.p.wait_for_timeout(800)
    assert card(page, "d2").locator("textarea").input_value() == "Hello,\n\nEdited by Dave."


def test_send_needs_two_taps_and_sends_nothing(page):
    open_email(page)
    c = card(page, "d2")
    c.locator("textarea").fill("Hello,\n\nSee you in February.\n\nDave")
    send = c.locator("[data-act=em-send]")
    send.click()
    assert "Tap again to send to Club Coach" in send.inner_text()
    assert c.count() == 1
    send.click()
    assert "Reply sent to Club Coach." in page.toast()
    page.p.wait_for_selector("#emRoot .em-card[data-t=d2]", state="detached", timeout=10000)
    assert "1\nreplies ready to send" in page.p.inner_text("#emTot")
    # it stays gone after Refresh, and nothing went to the network
    page.p.click("#emRefresh")
    page.p.wait_for_timeout(800)
    assert card(page, "d2").count() == 0
    assert page.sent == []


def test_send_checks(page):
    open_email(page)
    c = card(page, "d4")
    c.locator("[data-act=em-send]").click()
    assert "Write a reply first." in page.toast()
    page.p.wait_for_selector(".toast", state="detached", timeout=10000)
    c.locator("textarea").fill("[NOTE FOR DAVE: check]\n\nHello")
    c.locator("[data-act=em-send]").click()
    assert "Take Claude’s note out of the reply first." in page.toast()
    assert c.count() == 1


def test_done_and_leave_for_gmail(page):
    open_email(page)
    card(page, "d1").locator("[data-act=em-done]").click()
    assert "Marked done and archived." in page.toast()
    page.p.wait_for_selector("#emRoot .em-card[data-t=d1]", state="detached", timeout=10000)
    page.p.wait_for_selector(".toast", state="detached", timeout=10000)
    card(page, "d3").locator("[data-act=em-skip]").click()
    assert "Left in the Gmail inbox." in page.toast()
    page.p.wait_for_selector("#emRoot .em-card[data-t=d3]", state="detached", timeout=10000)
    tots = page.p.inner_text("#emTot")
    assert "1\nneed you" in tots and "1\nreplies ready to send" in tots, tots
    assert page.sent == []


def test_all_clear(page):
    open_email(page)
    for t in ["d1", "d4", "d3", "d2"]:
        card(page, t).locator("[data-act=em-done]").click()
        page.p.wait_for_selector(f"#emRoot .em-card[data-t={t}]", state="detached", timeout=10000)
    assert "All clear: nothing waiting. Claude checks the inbox at 7am and 1pm." in page.p.inner_text("#emList")


def test_phone_no_sideways_scroll(phone):
    open_email(phone)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    assert phone.p.locator("#emRoot .em-card").count() == 4
