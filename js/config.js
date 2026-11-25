// Which environment this copy runs in. The sandbox uses sample data only;
// nothing it does can reach a real club's account, orders or licences.
export const ENV = location.hostname === 'club.nationalgymnasticsleague.co.uk' ? 'live' : 'sandbox';
export const DATA = 'demo';            // 'demo' now; 'firebase' once the staging database exists
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
