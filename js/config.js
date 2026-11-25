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
export const CONTACT_EMAIL = 'admin@nationalgymnasticsleague.co.uk';
export const RULES_BASE = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/ngl-rules-2027-numbered-update/';
export const BRAND = 'https://davidcbrooke.github.io/GYMNASTICS-RESULTS/brand/';

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
