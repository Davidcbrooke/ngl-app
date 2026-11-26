// NGL's price list for the app: an EXACT copy of /prices.json (the file the card-payments script checks every order against).
// Change a price in prices.json, then paste the whole file in below "export default" (tests/test_prices.py fails until they match).
// Kept as a module, not fetched, so every screen has its prices straight away, offline too.
const PRICES = {
  "about": "NGL's price list to clubs: the ONE source of truth. The app (js/prices.js, an exact copy) shows these prices and builds orders from them; the card-payments script fetches this file and refuses any order that doesn't match it to the penny. Change a price here AND in js/prices.js (tests/test_prices.py checks they are identical). Prices in pounds, excluding VAT.",
  "version": "2026-11-26",
  "currency": "gbp",
  "vatRate": 0.2,
  "maxQty": 10000,
  "licences": {
    "preschool": {
      "n": "Pre-School Club Licence", "vat": true, "includes": ["poster"],
      "bands": [
        {"k": "xs", "label": "1–24 Pre-School gymnasts", "price": 150},
        {"k": "sm", "label": "25–49 Pre-School gymnasts", "price": 250},
        {"k": "s", "label": "50–99 Pre-School gymnasts", "price": 400},
        {"k": "m", "label": "100 or more Pre-School gymnasts", "price": 750}
      ]
    },
    "recreational": {
      "n": "Recreational Club Licence", "vat": true, "includes": [],
      "bands": [
        {"k": "xs", "label": "1 to 24 recreational gymnasts", "price": 200},
        {"k": "sm", "label": "25 to 49 recreational gymnasts", "price": 300},
        {"k": "s", "label": "50 to 99 recreational gymnasts", "price": 500},
        {"k": "m", "label": "100 to 249 recreational gymnasts", "price": 1000},
        {"k": "m2", "label": "250 to 399 recreational gymnasts", "price": 1250},
        {"k": "l", "label": "400 to 599 recreational gymnasts", "price": 1500},
        {"k": "xl", "label": "600 or more recreational gymnasts", "price": 2000}
      ]
    },
    "schools": {
      "n": "NGL Schools Club Licence", "vat": true, "includes": [],
      "bands": [
        {"k": "xs", "label": "1 to 24 Schools gymnasts", "short": "1–24", "price": 150, "max": 24},
        {"k": "sm", "label": "25 to 49 Schools gymnasts", "short": "25–49", "price": 250, "max": 49},
        {"k": "s", "label": "50 to 99 Schools gymnasts", "short": "50–99", "price": 400, "max": 99},
        {"k": "m", "label": "100 to 249 Schools gymnasts", "short": "100–249", "price": 750, "max": 249},
        {"k": "m2", "label": "250 to 399 Schools gymnasts", "short": "250–399", "price": 1000, "max": 399},
        {"k": "l", "label": "400 to 599 Schools gymnasts", "short": "400–599", "price": 1250, "max": 599},
        {"k": "xl", "label": "600 or more Schools gymnasts", "short": "600+", "price": 1500, "max": null}
      ]
    }
  },
  "included": {
    "poster": {"n": "A1 Around the World poster (free with the licence)", "price": 0}
  },
  "packs": {
    "preschool": {"vat": true, "items": {
      "pack2": {"n": "Lesson Plan Pack 11–20", "d": "Weeks 11–20: Egypt to Brazil in Book 1, the Bahamas to Italy in Book 2.", "price": 100},
      "pack3": {"n": "Lesson Plan Pack 21–30", "d": "Weeks 21–30: Australia to Japan in Book 1, India to Ireland in Book 2.", "price": 100},
      "pack4": {"n": "Lesson Plan Pack 31–40", "d": "Weeks 31–40: Japan to Iceland in Book 1, Ireland to Spain in Book 2.", "price": 100},
      "seasonal": {"n": "Seasonal Pack", "d": "Christmas, Easter, Summer, Halloween, Bonfire Night and Harvest, dropped into the right weeks by the planner.", "price": 50}
    }}
  },
  "products": [
    {"k": "gbook", "path": "general", "n": "General Skills Book", "d": "Levels 1–4 · RRP £8", "price": 4, "rrp": 8, "vat": false},
    {"k": "recbook", "path": "recreational", "n": "Recreational award books", "d": "Ruby, Pink, Teal, Indigo · RRP £10", "price": 5, "needs": "recreational", "vat": false},
    {"k": "recmedal", "path": "recreational", "n": "Recreational medals", "d": "Every gymnast medals · RRP £5", "price": 3, "needs": "recreational", "vat": false},
    {"k": "schbook", "path": "schools", "n": "Schools Awards Books", "d": "One book for the whole programme · RRP £10", "price": 5, "needs": "schools", "vat": false},
    {"k": "schcert", "path": "schools", "n": "Schools certificates", "d": "Bronze, Silver and Gold", "price": 0.1, "needs": "schools", "vat": false},
    {"k": "pspass", "path": "preschool", "n": "Pre-School passports", "d": "Book 1 and Book 2 · RRP £10", "price": 5, "needs": "preschool", "vat": false},
    {"k": "psmedal", "path": "preschool", "n": "Pre-School country medals", "d": "20 countries · RRP £4", "price": 2, "needs": "preschool", "vat": false},
    {"k": "tshirt", "path": "recreational", "n": "Children’s NGL t-shirt", "d": "RRP £17–20", "price": 12, "needs": "recreational", "vat": false}
  ],
  "postage": {
    "note": "One postage line per order of products, by the total number of items: up to 20, up to 100, then any more. No VAT.",
    "bands": [{"upTo": 20, "price": 4}, {"upTo": 100, "price": 8}, {"upTo": null, "price": 12}]
  },
  "graduation": {
    "vat": true, "maxGraduates": 2000, "maxSpectators": 10000,
    "graduate": {"n": "Graduation medals and places", "price": 5},
    "spectator": {"n": "Extra spectator tickets", "price": 5}
  }
};
export default PRICES;

// Helpers every screen uses, so the sums match the card-payments script (server/validate-order.js) exactly
export const r2 = n => Math.round(n * 100) / 100;
export const vatOn = net => Math.round(net * PRICES.vatRate * 100) / 100;      // VAT to the penny, as one line
export const postageFor = qty => qty <= 0 ? 0 : PRICES.postage.bands.find(b => b.upTo == null || qty <= b.upTo).price;
export const product = k => PRICES.products.find(p => p.k === k);
