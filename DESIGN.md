# Club Hub design rulebook

How every Club Hub screen looks and behaves. The model is Shopify's admin (its public design system, Polaris), with Stripe's dashboard for money screens and Linear for speed and polish. The NGL brand goes on top. Build every new screen from this file; if something isn't covered, add the rule here first.

Live examples of every component: `styleguide.html` (open it from the sandbox).

---

## 1. Principles
1. **Tasks first.** Every screen answers "what do I need to do?" before "what is there?". Home leads with *Needs your attention*.
2. **One way to do each thing.** One menu, one shop, one orders list, one place for rules. Never two routes to the same job.
3. **Same pattern everywhere.** A list, a form, a status or an empty screen looks and works the same in every section and pathway.
4. **Plain English.** Write for a busy coach on a phone between sessions. No jargon, no internal names.
5. **Never a dead end.** Every empty screen, error and locked item says what to do next, with a button.
6. **Calm, fast, quiet.** White space, few colours, no clutter. Feedback is instant; animation is short and subtle.
7. **Phone first.** Every screen works one-handed on a phone before it is checked on a laptop.

## 2. Brand layer (NGL)
| Token | Value | Use |
|---|---|---|
| `--navy` | #28225c | Side menu, headings, primary text on light backgrounds |
| `--red` | #c6152e | Primary buttons, alerts, "Needs your attention" edge. One red action per area |
| `--ink` | #1b1840 | Body text |
| `--muted` | #5f5b80 | Secondary text, labels |
| `--line` | #e4e3ee | Borders, dividers |
| `--wash` | #f4f4f9 | Page background, input background |
| `--ok` / `--warn` | #1f8a4c / #a65a00 | Success and warning status only |
| Pathways | #e84187 · #fbd43a · #e8822f · #0073b3 · #00aeb7 · #6ba526 · #8f286b | Pre-School · Schools · Recreational · General · Performance · University · Masters, always in this order |

- The 7-colour bar sits across the very top of every screen.
- **Pathway colour = accent only**: the pathway switcher, a dot, an icon tile, the active sub-tab underline. Never a whole page background.
- Text on yellow (Schools) and on orange is **navy**, never white.
- **No BG logo.** The JustGo "Official sponsor" logo is always white, on the navy side menu.

## 3. Type
| Role | Font | Size (laptop / phone) |
|---|---|---|
| Page title | Roboto Condensed Black 900, UPPERCASE | 30 / 24 px |
| Section title | Roboto Condensed 800, UPPERCASE | 19 / 18 px |
| Body | Roboto 400 | 15 px, line height 1.5 |
| Labels, buttons | Roboto 700 | 13–14 px |
| Numbers (stats) | Roboto Condensed 900 | 30 px |
- Arial is the fallback. No other fonts (Rokkitt only inside the logo artwork).
- One page title per screen. Sentence case for everything except titles.

## 4. Layout
- **Desktop:** navy side menu (248 px) + white top bar (search, user, log out) + page (max 1180 px wide, 28 px padding).
- **Phone (under 860 px):** the side menu becomes a bottom bar with 7 icons; the top bar keeps search; page padding 16 px; grids become 1 column (stats 2 columns).
- **Spacing scale:** 4 · 8 · 12 · 16 · 20 · 24 · 32 px. Cards are 16 px apart.
- **Radius:** cards 16 px, inputs 10 px, buttons and pills fully round.
- **Shadows:** none on cards (border only); dialogs, search results and toasts get a soft shadow.

## 5. Navigation
- **Seven menu items, fixed order:** Home, Competitions, Rules & resources, Programmes, Shop & orders, My club, Help. Never add an eighth; new things go inside one of these.
- **Sub-tabs** sit under the page title (underline style). Maximum 5. The active tab uses the pathway colour inside Programmes, red elsewhere.
- **Every screen has its own address** (`#/competitions/music`), so links can be shared, bookmarked and used in emails.
- **Programmes** has the pathway switcher (pills in pathway order), then that pathway's tools as sub-tabs.
- A red **badge** on a menu item means something is waiting (e.g. unpaid orders). Numbers only, no badge for zero.

## 6. Components
**Buttons**
- *Primary* (red, white text): the one main action in an area. Never two primaries side by side.
- *Secondary* (white, navy text, grey border): everything else.
- *Small* versions inside lists and tables.
- Labels are verbs that say what happens: "Reserve places", "Place order", "Email me a reset link". Never "Submit" or "OK".
- While working, the button is disabled and its label says so ("Placing order…").

**Cards**: white, 1 px border, 16 px radius. A card holds one topic with a section title. Clickable cards lift their border colour on hover.

**Lists and tables**: one row per item; the key fact in bold, detail underneath in muted text; the action on the right. Tables become stacked rows on a phone. Same columns, same order, everywhere (date, reference, what, total, status, action).

**Status pills**: one status per item, always one of these:
| Status | Pill |
|---|---|
| Not paid | red |
| Paid · Live · Sent · Reserved | green |
| Waiting list · Renew soon · Coming soon | amber |
| Explore free · Not started | grey |

**Forms**
- Label above the field, always visible (no placeholder-only labels).
- One column. Required fields only; optional ones say "(optional)".
- Errors in red under the form, in plain English, saying how to fix it.
- Remember what the club typed before (e.g. delivery address).

**Dialogs**: for short, focused tasks (reserve places, place an order, edit details). Title, short explanation, form, then primary + Cancel. Close with Cancel, the background or Esc.

**Toasts**: a short green confirmation at the bottom after something is saved ("Reserved. Your reference is NGL-7Q2K"). Red only for failures. They disappear on their own.

**Empty states**: one friendly sentence plus the next step: "No orders yet. Go to the shop." Never a blank card.

**Locked items** (no licence yet): shown faded, with what unlocks them and an "Explore" link. Clubs can always see what they would get.

**Search**: always in the top bar; `/` focuses it; results grouped by section with the section name on the right; rules PDFs open directly.

**Icons**: simple line icons in rounded coloured squares, like the NGL apps. Never emoji or clip art.

## 7. Money screens (Stripe model)
- Every order has one reference (ORD-XXXXX), one total and one status.
- Prices to clubs exclude VAT; licence fees show "+ VAT". Books, medals and t-shirts carry no VAT.
- Show postage as its own line, then a bold total.
- **Pay at checkout only** (agreed 25 Nov 2026): card, Apple Pay, Google Pay or Stripe Pay by bank. No invoices with bank details, so nobody marks orders paid by hand.
- An unpaid order (checkout not finished) shows "Not paid" and one action: "Finish payment".
- After payment the status changes immediately and Stripe emails the receipt; the club can download or re-send it.

## 8. Words
- UK English. "Club Licence", never "membership". "Licence fee waived", never "free".
- Address the club as "you" and "your club". Short sentences.
- Dates as "7 Feb 2027"; money as "£1,762" (pence only when needed: "£2.50").
- Name things the same everywhere: Reserve places → My places → Buy on JustGo by.

## 9. Speed and motion
- Screens show instantly; data fills in without the layout jumping.
- Animations under 200 ms, only to show something opened, closed or changed. None for decoration.
- Respect "reduce motion" settings.

## 10. Accessibility
- Text contrast at least 4.5:1 (navy on yellow, never white).
- Everything works with a keyboard; visible focus rings.
- Tap targets at least 44 px on a phone.
- Every icon-only button has a label for screen readers.

## 11. Checklist for every new screen
- [ ] Fits the 7-item menu; has its own address
- [ ] One page title; sub-tabs only if needed (max 5)
- [ ] One primary button per area, with a verb label
- [ ] Status pills from the table above; nothing invented
- [ ] Empty, loading, error and locked states all designed
- [ ] Works on a phone (390 px wide) and with a keyboard
- [ ] Wording checked against section 8
- [ ] Added to search if clubs will look for it
