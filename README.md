# NGL Club Hub (one app): sandbox

The new NGL Club Hub: one login, one menu, every pathway inside. Built in this sandbox so nothing changes for clubs until Dave switches over.

- **Sandbox:** sample data only (`js/data.js`). Nothing here can reach a real club's account, orders or licences.
- **Live today:** clubs still use club.nationalgymnasticsleague.co.uk and the Rec, Schools, Pre-School and General League hubs, unchanged.
- **Switch-over:** when Dave signs it off, club.nationalgymnasticsleague.co.uk points at this app.

## Structure
- `index.html`: the shell (side menu, search, page).
- `css/app.css`: NGL brand styles (navy #28225c, red #c6152e, the 7 pathway colours).
- `js/config.js`: environment, pathways, links. `js/data.js`: the data layer (sample data now; Firebase later, same shapes).
- `js/app.js`: menu and routes (`#/competitions/music`, `#/programmes/recreational/books` …). `js/search.js`: site-wide search (press `/`).
- `js/views/`: one file per menu item: Home, Competitions, Rules & resources, Programmes, Shop & orders, My club, Help.

## Build plan
1. Shell, Home with Getting started, Rules & resources, Help, search. **Done (sample data).**
2. Real sign-in and data against a staging copy of the database (needs a staging Firebase project).
3. Competitions: reserve, my places, floor music upload, results (from the Club Hub and General League hub).
4. Shop & orders: one basket for every programme, invoices, Pay by card (card-pay Apps Script).
5. Programmes, one pathway at a time: Pre-School, Recreational, Schools, General League.
6. My club: licences and renewals, family codes, details, password. Admin views.
7. Dave and Christine test everything in the sandbox, then switch over.
