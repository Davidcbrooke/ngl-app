// Data layer. Every screen asks this file for data, never Firebase directly,
// so the sandbox (sample data) and live (Firebase) run exactly the same screens.
import { DATA, RULES_BASE } from './config.js';

const demo = {
  club: {name:'SAADI Gymnastics', contact:'Dave Brooke', email:'demo@club.example', bgNumber:'BG123456'},
  licences: {
    preschool:   {status:'explore', label:'Explore free', price:'from £150 a year + VAT'},
    schools:     {status:'live', label:'Licence live', renews:'2027-10-25', band:'250–399 gymnasts', code:'SAADI-7K4P'},
    recreational:{status:'live', label:'Licence live', renews:'2027-04-02', band:'100–249 gymnasts', code:'SAADI-R9TQ'},
    general:     {status:'waived', label:'Fee waived for 2027'},
    performance: {status:'soon', label:'Coming 2027'},
    university:  {status:'soon', label:'Coming soon'},
    masters:     {status:'soon', label:'Coming soon'}
  },
  competitions: [
    {id:'c1', date:'2027-02-07', path:'general', name:'General League · East Region', where:'SAADI Gymnastics, Harpenden', who:'Girls Levels 1–4', reserved:12, ref:'NGL-7Q2K', buyBy:'2026-11-07', musicBy:'2027-01-24'},
    {id:'c2', date:'2027-02-14', path:'general', name:'General League · East Region', where:'SAADI Gymnastics, Harpenden', who:'Boys Levels 1–4', reserved:6, ref:'NGL-8M4D', buyBy:'2026-11-14'},
    {id:'c3', date:'2027-02-21', path:'general', name:'General League · West Midlands', where:'TBC', who:'Girls & Boys'},
    {id:'c4', date:'2027-03-13', path:'recreational', name:'Recreational · Ruby & Pink', where:'Redbourn', who:'Every gymnast medals', reserved:30, ref:'NGL-3RP9', buyBy:'2026-12-13'},
    {id:'c5', date:'2027-04-24', path:'performance', name:'Performance League Grades', where:'TBC', who:'Classic Challenge preparation', waiting:true},
    {id:'c6', date:'2027-10-24', path:'general', name:'NGL National Finals 2027', where:'TBC', who:'By qualification', waiting:true}
  ],
  music: {comp:'c1', gymnasts:[{n:'Amelia R', level:1, file:'amelia-floor.mp3'}, {n:'Isla T', level:1}, {n:'Grace W', level:2}, {n:'Ruby K', level:2}]},
  orders: [
    {id:'ORD-R2M6F', date:'2026-11-24', path:'recreational', details:'40 books, 200 medals', total:800, status:'awaiting-payment'},
    {id:'ORD-G2X9B', date:'2026-11-23', path:'schools', details:'Graduation: 64 graduates', total:320, status:'awaiting-payment'},
    {id:'ORD-P8W2D', date:'2026-11-20', path:'schools', details:'120 books, 300 certificates', total:642, status:'awaiting-payment'},
    {id:'ORD-K3M7Q', date:'2026-10-26', path:'schools', details:'Schools Club Licence 250–399', total:950, status:'paid'},
    {id:'ORD-R7Y3J', date:'2026-09-26', path:'recreational', details:'190 medals, 12 t-shirts', total:619, status:'paid'}
  ],
  products: [
    {k:'gbook', path:'general', n:'General Skills Book', d:'Levels 1–4 · RRP £8', price:4},
    {k:'recbook', path:'recreational', n:'Recreational award books', d:'Ruby, Pink, Teal, Indigo', price:5, needs:'recreational'},
    {k:'recmedal', path:'recreational', n:'Recreational medals', d:'Every gymnast medals', price:2.5, needs:'recreational'},
    {k:'schbook', path:'schools', n:'Schools Awards Books', d:'Bronze, Silver, Gold', price:3, needs:'schools'},
    {k:'schcert', path:'schools', n:'Schools certificates', d:'All six levels', price:0.5, needs:'schools'},
    {k:'pspass', path:'preschool', n:'Pre-School passports', d:'Book 1 and Book 2', price:4, needs:'preschool'},
    {k:'psmedal', path:'preschool', n:'Pre-School country medals', d:'20 countries', price:2.5, needs:'preschool'},
    {k:'kit', path:null, n:'Group Buying: staff kit', d:'Your logo, ordered every quarter', price:null}
  ]
};

export const RULES = [
  {group:'General League', path:'general', items:[
    {t:'Girls (WAG) rules 2027', d:'Levels 1–4: competition rules and common deductions', url:RULES_BASE + 'NGL_General_League_WAG_Rules_2027.pdf'},
    {t:'Boys (MAG) rules 2027', d:'Levels 1–4', url:RULES_BASE + 'NGL_General_League_MAG_Rules_2027.pdf'},
    {t:'WAG Element Book 2027', d:'Uncoded and common coded Bars, Beam and Floor elements', url:RULES_BASE + 'NGL_General_League_WAG_Element_Guide_2027.pdf'},
    {t:'FIG Code of Points 2025–2028', d:'The base for NGL rules, except where NGL changes are noted', url:RULES_BASE + 'FIG_WAG_Code_of_Points_2025-2028.pdf'}]},
  {group:'Recreational', path:'recreational', items:[
    {t:'Recreational competition rules', d:'Ruby, Pink, Teal and Indigo: the same four levels as the award books', url:null},
    {t:'Competition routines', d:'Video and written routines for every level', url:null}]},
  {group:'Schools', path:'schools', items:[
    {t:'Graduation guide', d:'How a Graduation runs and what gymnasts perform', url:null},
    {t:'Schools prospectus', d:'The 9-page prospectus to share with schools', url:null}]},
  {group:'Every competition', path:null, items:[
    {t:'Floor music rules', d:'MP3, up to 15MB, no voice-over or lyrics', route:'#/help/music'},
    {t:'Which level should we enter?', d:'Recreational 1–2 hrs a week, General League 2–10 hrs, Performance League 11+', route:'#/help/level'},
    {t:'Booking and the waiting list', d:'Reserve, buy on JustGo, the 3-month rule', route:'#/help/booking'}]}
];

export const FAQ = [
  {id:'rules', q:'Where are the competition rules?', a:'Rules & resources in the menu: every rule book, the element book and the Code of Points. Or type "rules" in the search bar.', go:'#/rules'},
  {id:'level', q:'Which level should my gymnast enter?', a:'Go by weekly training: Recreational 1–2 hours, General League 2–10 hours (girls’ Level 1 is for 2–5 hours), Performance League over 10 hours. The General Skills Book shows the right level from the skills a gymnast can already do.', go:'#/rules'},
  {id:'booking', q:'How do I enter a competition?', a:'Reserve places in Competitions (no payment). We email a private JustGo link up to 5 months before; buy by 3 months before or the places go to the waiting list.', go:'#/competitions'},
  {id:'music', q:'How do I upload floor music?', a:'Competitions → Floor music. One MP3 per gymnast, up to 15MB, no voice-over or lyrics.', go:'#/competitions/music'},
  {id:'results', q:'Where are the results and league tables?', a:'Competitions → Results & league tables. Share the Family Hub link so parents can follow them too.', go:'#/competitions/results'},
  {id:'licence', q:'What does a licence cost, and what do I get?', a:'My club → Licences shows every programme. Explore any programme before you buy; a licence unlocks the lesson plans, ordering at club prices and the family app.', go:'#/club'},
  {id:'pay', q:'How do I pay an invoice?', a:'Shop & orders → Orders & invoices → Pay by card, or by bank transfer using the order reference.', go:'#/shop/orders'},
  {id:'parents', q:'What do I give parents?', a:'My club → Family codes: one link and QR code per programme.', go:'#/club'},
  {id:'judges', q:'How do my coaches become judges?', a:'Share the NGL Judging Pathway link; each judge registers themselves.', go:'#/help'},
  {id:'contact', q:'Who do I talk to?', a:'Chat with us, email admin@nationalgymnasticsleague.co.uk, or book a call with Dave.', go:'#/help'}
];

// Async API: the live version will read the same shapes from Firestore.
const api = {
  async club(){ return demo.club; },
  async licences(){ return demo.licences; },
  async competitions(){ return demo.competitions; },
  async music(){ return demo.music; },
  async orders(){ return demo.orders; },
  async products(){ return demo.products; }
};
if (DATA !== 'demo') console.warn('Only sample data is wired up so far.');
export default api;
