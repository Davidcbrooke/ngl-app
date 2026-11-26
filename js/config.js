// Which environment this copy runs in. The sandbox uses sample data only;
// nothing it does can reach a real club's account, orders or licences.
export const ENV = location.hostname === 'club.nationalgymnasticsleague.co.uk' ? 'live' : 'sandbox';
export const DATA = 'demo';            // switch to 'firebase' when sign-in is wired up (next stage)

// Staging database: a separate Firebase project with test data only (London, europe-west2).
// Web config is public by design; access is controlled by firestore.rules.
export const FIREBASE_STAGING = {
  apiKey: 'AIzaSyCLsxitgoWUWjDwcQhSK6nThUQuPi7mKxM',
  authDomain: 'ngl-club-hub-staging.firebaseapp.com',
  projectId: 'ngl-club-hub-staging',
  storageBucket: 'ngl-club-hub-staging.firebasestorage.app',
  messagingSenderId: '45192519828',
  appId: '1:45192519828:web:b0233b4e1e0dbe7b0c5481'
};
// Receipts. Orders are paid at checkout (card or Pay by bank through Stripe), so there are no invoices to chase.
// Licence fees + VAT; books, medals and t-shirts carry no VAT.
export const INVOICE = {name: 'SAADI Gymnastics Ltd trading as National Gymnastics League', address: ['66 Waveney Road', 'Harpenden', 'Hertfordshire', 'AL5 4QZ'],
  company: '10702099', vat: 'GB 255 4614 03', email: 'admin@nationalgymnasticsleague.co.uk'};
// Receipt emails ("Email it to me"): same EmailJS service and template as today's hubs (sends from admin@nationalgymnasticsleague.co.uk).
export const EMAILJS = {serviceId: 'service_3qlufgh', templateId: 'template_8i40iia', publicKey: 'ZSjEpECoOMHkWNB1D'};
// Card payments: the STAGING copy of the "NGL card payments" Apps Script (Stripe TEST mode, staging database).
export const CARD_PAY_URL = 'https://script.google.com/macros/s/AKfycbzhIP9CZydepNQ05-rwfN4RqcURJIi-00qVZAJJBe9C-r7Mdu7r_-eamCZFYjzImRH-vw/exec';
// NGL admins: must match isAdmin() in firestore.rules, and the email must be verified.
export const ADMIN_EMAILS = ['admin@nationalgymnasticsleague.co.uk', 'bookingoffice@saadigymnastics.co.uk'];
export const CONTACT_EMAIL = 'admin@nationalgymnasticsleague.co.uk';
export const RULES_BASE = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-rules-2027-numbered-update/';
export const BRAND = 'img/brand/';   // NGL and JustGo logos (copied from GYMNASTICS-RESULTS/brand)

// The seven pathways, always in this order (NGL brand rule).
export const PATHWAYS = [
  {k:'preschool',   n:'Pre-School',         c:'var(--pre)'},
  {k:'schools',     n:'Schools',            c:'var(--sch)', yellow:true},
  {k:'recreational',n:'Recreational',       c:'var(--rec)'},
  {k:'general',     n:'General League',     c:'var(--gen)'},
  {k:'performance', n:'Performance League', c:'var(--perf)'},
  {k:'university',  n:'University League',  c:'var(--uni)'},
  {k:'masters',     n:'Masters',            c:'var(--mas)'}
];

// The one app's own address: parent links and QR codes point here (?code=…), wherever the app is served from
export const appLink = (q = '') => location.origin + location.pathname + q;
