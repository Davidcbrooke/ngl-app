"""Accessibility (DESIGN.md section 10): axe-core finds no serious or critical problems on the main screens."""
import pytest

AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"
SCREENS = ["#/home", "#/competitions", "#/rules", "#/programmes/recreational", "#/shop", "#/shop/orders", "#/club", "#/help"]


@pytest.mark.parametrize("hash_", SCREENS)
def test_no_serious_accessibility_problems(page, hash_):
    page.go(hash_, demo=True)
    page.p.add_script_tag(url=AXE)
    res = page.p.evaluate("""async () => { const r = await axe.run(document, {resultTypes: ['violations']});
        return r.violations.filter(v => ['serious', 'critical'].includes(v.impact))
          .map(v => v.id + ': ' + v.help + ' (' + v.nodes.length + ') e.g. ' + v.nodes[0].target.join(' ')); }""")
    assert not res, "\n".join(res)


def test_login_screen_accessible(page):
    page.go()
    page.p.add_script_tag(url=AXE)
    res = page.p.evaluate("""async () => (await axe.run(document)).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id + ': ' + v.help)""")
    assert not res, "\n".join(res)
