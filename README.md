# NGL Club Hub (one app): sandbox

The new NGL Club Hub: one login, one menu, every pathway inside. Built in this sandbox so nothing changes for clubs until Dave switches over.

- **Sandbox:** sample data only (`js/data.js`). Nothing here can reach a real club's account, orders or licences.
- **Live today:** clubs still use club.nationalgymnasticsleague.co.uk and the Rec, Schools, Pre-School and General League hubs, unchanged.
- **Switch-over:** when Dave signs it off, club.nationalgymnasticsleague.co.uk points at this app.

Design rules: `DESIGN.md` (modelled on Shopify admin / Polaris, Stripe for money screens, Linear for polish). Live examples: `styleguide.html`.

## Structure
- `index.html`: the shell (side menu, search, page).
- `css/app.css`: NGL brand styles (navy #28225c, red #c6152e, the 7 pathway colours).
- `js/config.js`: environment, pathways, links. `js/data.js`: the data layer (sample data now; Firebase later, same shapes).
- `js/app.js`: menu and routes (`#/competitions/music`, `#/programmes/recreational/books` …). `js/search.js`: site-wide search (press `/`).
- `js/views/`: one file per menu item: Home, Competitions, Rules & resources, Programmes, Shop & orders, My club, Help.

## Tests
`python -m pytest tests -q` (about 80 seconds). GitHub runs the same suite on every push (Actions → Tests).
- `test_screens.py`: every screen opens with no errors; 7-item menu; search; invoice; phone layout (no sideways scroll, 44px buttons).
- `test_club_journey.py`: a fresh test club on the staging database registers, reserves, changes, adds to calendar, cancels, orders, opens the invoice, logs out and in.
- `test_security.py`: 11 things a club must never be able to do (switch on its own licence, mark an order paid, read other clubs' data…). Each must be refused.
- `test_accessibility.py`: axe-core finds no serious or critical problems (WCAG AA contrast, labels, keyboard).
Test clubs are named AUTOTEST and use example.com addresses, so no emails go out; the test login is deleted at the end.

## Build plan
1. Shell, Home with Getting started, Rules & resources, Help, search. **Done (sample data).**
2. Real sign-in and data against the staging database (ngl-club-hub-staging, London). **Done:** register, log in, log out, reset password; reserve places; one shop basket and orders; edit club details. Security rules tested: a club cannot switch on its own licence, mark its own order paid or read other clubs' data. Add `?demo` to the address for sample data.
3. Competitions: reserve, my places, floor music upload, results. **Done (25 Nov):** change places or cancel a reservation (until NGL moves it on), Add to calendar (.ics, one or all), real results and league-table links, floor music screen with MP3 check (15MB), upload progress and playback; rules published and tested (a club can't mark its own places bought, or upload music without an entry). **Waiting:** music file storage needs the staging Firebase project on the Blaze (pay-as-you-go) plan; NGL admin must add each club's gymnasts (musicEntries) from the start lists: comes with the admin screens.
4. Shop & orders: one basket for every programme, order page with timeline, invoice/receipt PDF, Pay by card. **Done (25 Nov):** card payment runs through the Apps Script "NGL card payments STAGING" (`server/card-payments-staging.gs`, bookingoffice@ account) against the Stripe **sandbox** and the staging database; Dave paid a test order with 4242 4242 4242 4242 and it switched to Paid. The script refuses any non-test Stripe key. Stripe sandbox webhook "Club Hub sandbox card payments" (we_1UflIxRU6LGDpqBGDNGJSRgu: checkout.session.completed + async_payment_succeeded) points at the staging script as a backup. Invoice emails: sent on order and from the order page through the same EmailJS service as the live hubs; subject marked [SANDBOX TEST]; example.com test addresses are skipped.
5. Programmes, one pathway at a time: Pre-School, Recreational, Schools, General League.
6. My club: licences and renewals, family codes, details, password. Admin views.
7. Dave and Christine test everything in the sandbox, then switch over.
