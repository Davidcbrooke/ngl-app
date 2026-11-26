"""Judging Pathway, judge side (js/views/judge.js): sample data (?demo&judge), then a fresh made-up judge on the STAGING database.
The staging test uses an example.com address (no emails go out), books one piece, then withdraws it and deletes the test login.
The judge's profile stays, named AUTOTEST (a judge can't delete their own profile; NGL Admin > Judging > Delete can)."""
import secrets
import pytest


def open_demo(page, hash_="#/judge", new=False):
    page.p.goto(page.base + ("?demo&judge=new" if new else "?demo&judge") + hash_)
    page.p.wait_for_selector(".jg #jgPage h1", timeout=20000)


def test_judge_shell_opens_with_profile_and_tier(page):
    open_demo(page)
    assert page.p.is_hidden(".app")
    assert page.p.locator(".jg-tabs a").all_inner_texts() == ["My Pathway", "Judge a Competition", "Fun Quiz", "Judging Calendar", "Resources"]
    assert page.p.text_content("#jgPpName") == "Megan Hart"
    assert "BG: None" in page.p.inner_text("#jgPpQual")
    assert "Apprentice Judge" in page.p.text_content("#jgRank")
    assert page.p.inner_text("#jgStatShadow") == "2"           # 1 before NGL + 1 confirmed shadow
    prog = page.p.text_content("#jgProgress")
    assert "Next Tier: Club Judge" in prog and "Shadow 3+ competitions (2/3)" in prog
    assert page.p.inner_text("#jgPbWag") == "72%" and page.p.inner_text("#jgPbMag") == "—"
    assert "Practise on Elevien Academy" in page.p.inner_text("#jgPage")


def test_judge_notifications_and_assignments(page):
    open_demo(page)
    assert "You're booked! You've been confirmed as Shadow for Floor (WAG) at NGL National Finals: Level A." in page.p.inner_text("#jgNotifs")
    mine = page.p.inner_text("#jgMine")
    assert "Awaiting admin confirmation" in mine and "Withdraw" in mine and "+ My Calendar" in mine and "Cancel" in mine
    with page.p.expect_download() as d:
        page.p.click("#jgMine [data-jg=ics]")
    assert d.value.suggested_filename.endswith(".ics")
    page.p.click("#jgMine .jg-comp:has-text('Awaiting admin confirmation') [data-jg=cancel]")
    page.p.click("#jgYes")
    page.p.wait_for_selector(".toast >> text=Removed", timeout=15000)   # the earlier "Application sent" message may still be showing
    assert "Awaiting admin confirmation" not in page.p.inner_text("#jgMine")


def test_judge_books_a_piece_in_demo(page):
    open_demo(page, "#/judge/signup")
    t = page.p.text_content("#jgPage")
    assert "JUDGE A COMPETITION" in t.upper() and "Before you apply" in t
    # Apprentice: shadow only
    assert page.p.locator("#jgRole-c2 option").all_inner_texts() == ["Shadow"]
    assert "Pommel Horse" in page.p.locator("#jgPiece-c2 option").all_inner_texts()      # boys' competition: MAG pieces
    assert page.p.locator("#jgDisc-c3").count() == 1                                      # girls and boys: choose the discipline
    page.p.select_option("#jgPiece-c2", "Rings")
    page.p.click("[data-jg=apply][data-comp=c2]")
    assert "Application sent" in page.toast()
    page.p.wait_for_selector(".jg-comp[data-comp=c2] .jg-mypill:has-text('Shadow · Rings')")
    page.p.select_option("#jgPiece-c2", "Rings")
    page.p.click("[data-jg=apply][data-comp=c2]")
    page.p.wait_for_selector(".toast:has-text(\"You've already applied for that role/piece at this competition.\")")


def test_judge_edits_profile_then_main_judges_remote(page):
    open_demo(page)
    page.p.click("[data-jg=edit-profile]")
    page.p.select_option("#jgQual-editProfile select[data-f=level]", "Club Judge")
    page.p.click("#jgBtnSaveProfile")
    assert "Profile saved" in page.toast()
    assert "Club Judge" in page.p.text_content("#jgRank") and "Next Tier: Senior Judge" in page.p.text_content("#jgProgress")
    page.p.click(".jg-tabs a[href='#/judge/signup']")
    page.p.wait_for_selector("#jgRole-c1")
    assert page.p.locator("#jgRole-c1 option").all_inner_texts() == ["Shadow", "Second Judge", "Main Judge"]
    page.p.select_option("#jgRole-c1", "judge")
    page.p.select_option("#jgPiece-c1", "Beam")
    assert page.p.inner_text("#jgInfo-c1") == "Remote judging — £50 per competition (2 competitions in the day)."
    page.p.select_option("#jgPiece-c1", "Vault")
    assert "In-person judging — £75 per competition (£150 for the whole event)." in page.p.inner_text("#jgInfo-c1")
    page.p.click("[data-jg=apply][data-comp=c1]")
    assert "You are applying to judge Vault at General League · East Region." in page.p.inner_text(".jg-dlg")
    page.p.click("#jgYes")
    page.p.wait_for_selector(".jg-comp[data-comp=c1] .jg-mypill:has-text('Main Judge · Vault')")


def test_judge_quiz(page):
    open_demo(page, "#/judge/quiz")
    assert page.p.inner_text("#jgMenuQuiz-wag") == "72%"
    page.p.click("[data-jg=quiz-start][data-t=mag]")
    assert page.p.inner_text("#jgQuizProgress") == "Question 1 of 49"
    page.p.click("[data-jg=quiz-pick][data-i='2']")                     # Level 1 Floor: 6 elements count (correct)
    assert page.p.inner_text("#jgQuizFb") == "Correct!"
    page.p.click("#jgQuizNext")
    page.p.click("[data-jg=quiz-pick][data-i='0']")                     # wrong
    assert page.p.inner_text("#jgQuizFb") == "Not quite — on to the next one."
    # Every question in both banks is a real question (the live MAG list had an empty slot)
    counts = page.p.evaluate("""async () => { const m = await import('./js/judge/quiz-bank.js');
        return ['wag','mag'].map(k => m.QUIZ_BANKS[k].filter(q => q && q.q && q.options.length === 4 && q.correct >= 0 && q.correct < 4).length); }""")
    assert counts == [50, 49]


def test_judge_quiz_saves_personal_best(page):
    open_demo(page, "#/judge/quiz")
    page.p.click("[data-jg=quiz-start][data-t=mag]")
    for _ in range(49):
        page.p.click("[data-jg=quiz-pick][data-i='1']")
        page.p.click("#jgQuizNext")
    page.p.wait_for_selector("#jgQuizResult")
    assert "New Personal Best!" in page.p.text_content("#jgQuizResult")
    pct = page.p.inner_text("#jgQuizPct")
    page.p.click("[data-jg=quiz-menu]")
    assert page.p.inner_text("#jgMenuQuiz-mag") == pct


def test_judge_calendar_and_resources(page):
    open_demo(page, "#/judge/calendar")
    head = page.p.locator("#jgCal-c1 .jg-calbtn")
    assert "2 confirmed judges" in head.inner_text()
    assert page.p.is_hidden("#jgCal-c1 .jg-reveal")
    head.click()
    r = page.p.inner_text("#jgCal-c1 .jg-reveal")
    assert "Sarah Collins" in r and "Main Judge" in r and "Tom Ellis" in r
    page.p.click(".jg-tabs a[href='#/judge/resources']")
    page.p.wait_for_selector("#jgResList")
    t = page.p.text_content("#jgPage")
    assert "Elevien Academy — Judge Training" in t and "NGL 2027 WAG Rules" in t and "BG Courses & Links".upper() in t.upper()


def test_judge_register_in_demo(page):
    open_demo(page, new=True)
    t = page.p.text_content("#jgPage")
    assert "From First Shadow to" in t and "Join the NGL Judging Pathway" in t and "Register once, judge forever" in t
    page.p.click("[data-jg=mode][data-m=register]")
    page.p.click("#jgBtnRegister")
    assert page.p.inner_text("#jgRegErr") == "Please enter your name."
    assert page.p.is_visible("#jgPrior")                                   # no qualification: ask about experience
    page.p.select_option("#jgQual-register select[data-f=level]", "Regional Judge")
    assert page.p.is_hidden("#jgPrior")
    page.p.fill("#jgRgName", "Sam Taylor")
    page.p.fill("#jgRgEmail", "sam@example.com")
    page.p.fill("#jgRgPhone", "07700 900000")
    page.p.fill("#jgRgPassword", "secret1")
    page.p.click("#jgBtnRegister")
    page.p.wait_for_selector("#jgPassport")
    assert page.p.text_content("#jgPpName") == "Sam Taylor" and "Senior Judge" in page.p.text_content("#jgRank")
    assert "Top of the Pathway" in page.p.text_content("#jgProgress")


def test_signed_out_judge_tabs_ask_to_sign_in(page):
    open_demo(page, "#/judge/signup", new=True)
    assert "Sign in to sign up" in page.p.inner_text("#jgPage")
    page.p.click(".jg-tabs a[href='#/judge/quiz']")
    page.p.wait_for_selector(".jg-gate:has-text('Sign in to play')")


def test_welcome_has_judge_option(page):
    page.go("#/home")
    page.p.click("[data-who=judge]")
    page.p.wait_for_selector(".jg #jgLogin", timeout=20000)
    assert page.p.evaluate("localStorage.getItem('ngl.who')") == "judge"
    page.p.click("[data-jg=switch-club]")
    page.p.wait_for_selector("#authRoot h1:has-text('Club Hub')", timeout=20000)


@pytest.mark.parametrize("hash_", ["#/judge", "#/judge/signup", "#/judge/quiz", "#/judge/calendar", "#/judge/resources"])
def test_judge_phone_layout(phone, hash_):
    open_demo(phone, hash_)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    small = phone.p.evaluate("[...document.querySelectorAll('#jgPage .btn:not(.sm)')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 44).length")
    assert small == 0


# ---------- staging: a fresh made-up judge ----------
JUDGE_FIELDS = {"name", "club", "email", "phone", "qualifications", "qualification", "photoUrl", "priorShadowed", "priorSecondJudged", "createdAt"}


def test_staging_judge_registers_and_books(page):
    email = f"autotest-judge-{secrets.token_hex(4)}@example.com"
    pw = "Test-" + secrets.token_hex(8)
    page.p.goto(page.base + "#/judge")
    page.p.wait_for_selector(".jg #jgLogin", timeout=20000)
    page.p.click("[data-jg=mode][data-m=register]")
    page.p.fill("#jgRgName", "AUTOTEST Judge")
    page.p.fill("#jgRgClub", "AUTOTEST Gymnastics Club")
    page.p.fill("#jgRgEmail", email)
    page.p.fill("#jgRgPhone", "07700 900999")
    page.p.fill("#jgRgPassword", pw)
    page.p.fill("#jgRgPriorShadow", "1")
    try:
        page.p.click("#jgBtnRegister")
        page.p.wait_for_selector("#jgPassport, #jgComplete", timeout=20000)
        if page.p.locator("#jgComplete").count():
            err = page.p.evaluate("window.NGL_JUDGE_LASTERR || ''")
            if "permission" in err:
                page.errors.clear()
                pytest.skip("Staging refused the judge profile: publish the judge rules in firestore.rules to ngl-club-hub-staging first")
            pytest.fail(f"Profile not saved: {err}")
        uid = page.p.evaluate("async () => { const m = await import('./js/firebase.js'); const {A} = await m.fb(); return A.currentUser.uid; }")
        got = page.p.evaluate("""async (uid) => { const m = await import('./js/firebase.js'); const {fs, D} = await m.fb();
            const j = await fs.getDoc(fs.doc(D, 'ngl_judges', uid)), c = await fs.getDoc(fs.doc(D, 'clubs', uid));
            return {judge: j.exists() ? j.data() : null, club: c.exists()}; }""", uid)
        j = got["judge"]
        assert j is not None and set(j) == JUDGE_FIELDS
        assert j["name"] == "AUTOTEST Judge" and j["email"] == email and j["qualification"] == "None" and j["qualifications"] == []
        assert j["priorShadowed"] == 1 and j["priorSecondJudged"] == 0 and j["photoUrl"] == ""
        assert got["club"] is False                                  # a judge has no club account
        assert "Apprentice Judge" in page.p.text_content("#jgRank")

        # Book a piece: the first upcoming competition, as a shadow
        page.p.click(".jg-tabs a[href='#/judge/signup']")
        btn = page.p.wait_for_selector("[data-jg=apply]", timeout=20000)
        comp = btn.get_attribute("data-comp")
        btn.click()
        assert "Application sent" in page.toast()
        page.p.wait_for_selector(f".jg-comp[data-comp='{comp}'] .jg-mypill", timeout=15000)
        mine = page.p.evaluate("""async (uid) => { const m = await import('./js/firebase.js'); const {fs, D} = await m.fb();
            const q = await fs.getDocs(fs.query(fs.collection(D, 'ngl_judging_assignments'), fs.where('judgeUid', '==', uid)));
            return q.docs.map(d => d.data()); }""", uid)
        assert len(mine) == 1 and mine[0]["status"] == "pending" and mine[0]["role"] == "shadow" and mine[0]["compId"] == comp

        # The rules refuse what only NGL may do
        refused = page.p.evaluate("""async (uid) => { const m = await import('./js/firebase.js'); const {fs, D} = await m.fb(); const out = {};
            const tryit = async (k, fn) => { try { await fn(); out[k] = 'allowed'; } catch (e) { out[k] = e.code; } };
            await tryit('confirmOwn', () => fs.addDoc(fs.collection(D, 'ngl_judging_assignments'), {judgeUid: uid, judgeName: 'AUTOTEST Judge', compId: 'x', compName: 'x',
              compDate: '2027-01-01', compVenue: '', discipline: 'WAG', piece: 'Beam', role: 'judge', status: 'confirmed', assignedAt: new Date().toISOString()}));
            await tryit('changeExperience', () => fs.updateDoc(fs.doc(D, 'ngl_judges', uid), {priorShadowed: 99}));
            await tryit('readAllJudges', () => fs.getDocs(fs.collection(D, 'ngl_judges')));
            return out; }""", uid)
        assert refused == {"confirmOwn": "permission-denied", "changeExperience": "permission-denied", "readAllJudges": "permission-denied"}

        # Withdraw it again
        page.p.click(f".jg-comp[data-comp='{comp}'] .jg-mypill button")
        page.p.click("#jgYes")
        page.p.wait_for_selector(".toast >> text=Removed", timeout=15000)   # the earlier "Application sent" message may still be showing
        page.p.wait_for_selector(f".jg-comp[data-comp='{comp}'] .jg-mypill", state="detached", timeout=15000)
    finally:
        # Delete the test login (the profile stays, named AUTOTEST)
        page.p.evaluate("""async ([e, p]) => { const m = await import('./js/firebase.js'); const {auth, A} = await m.fb();
                         try { await auth.signInWithEmailAndPassword(A, e, p); } catch (_) {}
                         if (A.currentUser) await A.currentUser.delete(); }""", [email, pw])
