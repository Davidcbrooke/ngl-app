"""NGL Admin · Competition planning (sample data): the jobs list copied from NGL_Comp_Planning.html.
Sample data keeps every change in memory only, so nothing here touches a database."""

PHASES = ["3 MONTHS OR MORE BEFORE", "2 TO 3 MONTHS BEFORE", "1 TO 2 MONTHS BEFORE", "1 TO 4 WEEKS BEFORE",
          "THE WEEK BEFORE", "COMPETITION DAY", "AFTER THE COMPETITION"]


def open_planning(page, hash_="#/admin/planning/demo-gl-east"):
    page.go(hash_, demo=True)
    page.p.wait_for_selector("#plRoot .pl-task", timeout=20000)


def test_planning_opens(page):
    open_planning(page)
    assert "COMPETITION PLANNING" in page.p.inner_text("#page h1").upper()
    assert page.p.locator("#plRoot .pl-cbtn").count() >= 3
    # #/admin/planning/<id> opens that competition
    assert "EAST REGION" in page.p.inner_text("#plRoot .pl-head h2").upper()


def test_first_screen_picks_a_competition(page):
    page.go("#/admin/planning", demo=True)
    page.p.wait_for_selector("#plRoot .pl-head h2", timeout=20000)
    assert page.p.locator("#plRoot .pl-cbtn[aria-pressed=true]").count() == 1


def test_jobs_grouped_by_phase(page):
    open_planning(page)
    heads = [h.upper() for h in page.p.locator("#plRoot .pl-phase h3").all_inner_texts()]
    assert heads == [p for p in PHASES if p in heads] and len(heads) >= 5, heads
    first = page.p.locator("#plRoot .pl-phase").first.inner_text()
    assert "Confirm the date, venue and session times" in first and "Set up the competition in Elevien" in first


def test_tick_a_job_in_demo(page):
    open_planning(page)
    row = page.p.locator("#plRoot .pl-task[data-t=medals]")
    assert "done" not in row.get_attribute("class")
    row.locator("input[data-done]").check()
    page.p.wait_for_selector("#plRoot .pl-task.done[data-t=medals]", timeout=10000)
    row = page.p.locator("#plRoot .pl-task[data-t=medals]")
    assert "Done by Dave Brooke" in row.inner_text()
    # untick again
    row.locator("input[data-done]").uncheck()
    page.p.wait_for_selector("#plRoot .pl-task[data-t=medals]:not(.done)", timeout=10000)


def test_due_this_week_box(page):
    open_planning(page)
    week = page.p.inner_text("#plWeek")
    assert "Due this week and overdue".upper() in week.upper()
    assert page.p.locator("#plWeek .pl-wrow").count() >= 1


def test_waiting_list_step(page):
    open_planning(page)
    t = page.p.inner_text("#plRoot .pl-task[data-t=release]")
    assert "Waiting list: 1 club" in t and "Northgate" in t
    link = page.p.locator("#plRoot .pl-task[data-t=staff] a.pl-step")
    assert link.get_attribute("href") == "#/admin/staffing" and link.get_attribute("target") is None
    judge = page.p.locator("#plRoot .pl-task[data-t=judges] a.pl-step")
    assert judge.get_attribute("href").startswith("https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-judging-pathway.html")
    assert judge.get_attribute("target") == "_blank"


def test_no_music_jobs_for_recreational(page):
    open_planning(page)
    page.p.click("#plRoot .pl-cbtn[data-c=demo-rec]")
    page.p.wait_for_function("document.querySelector('#plRoot .pl-head h2').textContent.includes('Recreational')", timeout=10000)
    assert page.p.locator("#plRoot .pl-task[data-t=musicopen]").count() == 0
    assert "No floor music jobs (Recreational)" in page.p.inner_text("#plRoot .pl-head")


def test_edit_mode_toggles(page):
    open_planning(page)
    page.p.click("#plEditMode")
    page.p.wait_for_selector("#plRoot .pl-task[draggable=true]", timeout=10000)
    assert "Finish editing" in page.p.inner_text("#plEditMode")
    assert page.p.locator("#plRoot input[data-done]").count() == 0
    page.p.click("#plRoot .pl-task[data-t=medals] [data-act=pl-edit]")
    page.p.wait_for_selector("#plEfT", timeout=10000)
    page.p.fill("#plEfT", "Order medals and trophies")
    page.p.click("[data-act=pl-ef-save]")
    page.p.wait_for_function("document.querySelector('#plRoot .pl-task[data-t=medals]') && document.querySelector('#plRoot .pl-task[data-t=medals]').textContent.includes('trophies')", timeout=10000)
    page.p.click("#plEditMode")
    page.p.wait_for_selector("#plRoot input[data-done]", timeout=10000)
    assert page.p.locator("#plRoot .pl-task[draggable=true]").count() == 0


def test_add_job_for_this_competition(page):
    open_planning(page)
    page.p.fill("#plNewT", "Book the photographer")
    page.p.fill("#plNewD", "14")
    page.p.click("[data-act=pl-add]")
    page.p.wait_for_selector("#plRoot .pl-task:has-text('Book the photographer')", timeout=10000)
    assert "This competition only" in page.p.inner_text("#plRoot .pl-task:has-text('Book the photographer')")


def test_planning_on_phone(phone):
    phone.go("#/admin/planning", demo=True)
    phone.p.wait_for_selector("#plRoot .pl-task", timeout=20000)
    assert phone.p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
