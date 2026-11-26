// Be Better: "Helping Clubs be BETTER". The five pillars (Operate, Coach, Care, Grow, Connect Better) with NGL's
// trusted partners and their offers. Copied word for word from the live Club Hub's Club Support tab (ngl-club-hub/index.html).
import api from '../data.js';
import { esc } from '../ui.js';
import { CONTACT_EMAIL } from '../config.js';

const IMPACT_HR_PACK = 'https://www.nationalgymnasticsleague.co.uk/s/National-Gymnastics-League-ImpactHR.pdf';
const SUPPORT = [
  {id:'operate', name:'Operate Better', c:'#223a70', tag:'Strong foundations that reduce pressure and risk',
   intro:'Running a club is complex, and most clubs build their systems alone. Operate Better is about shared systems, common approaches and proven best practice, so you spend less time on admin and more on gymnastics.',
   areas:['Finance and pricing','Club management systems','Governance templates','Admin processes'],
   offers:[
     {name:'JustGo', kind:'NGL sponsor', headline:'The class management system that links to British Gymnastics membership',
      text:'JustGo is the club management system British Gymnastics uses, and the official sponsor of the NGL. Set up recurring classes, track attendance, take payments and subscriptions, manage waiting lists and send automatic reminders.',
      actions:[{l:'Book a JustGo demo', href:'https://justgo.com/book-a-demo/'}]},
     {name:'NGL Rotation Planner', kind:'Free NGL tool', headline:'Free for every NGL club',
      text:'Build your weekly session plan once, then show it live on any screen in your gym. It follows the clock, so coaches and gymnasts always know which apparatus they should be on.',
      actions:[{l:'Open the planner', href:'https://club.nationalgymnasticsleague.co.uk/rotation-planner/'},{l:'How to use it', href:'https://club.nationalgymnasticsleague.co.uk/rotation-planner/guide/', ghost:true}]}
   ]},
  {id:'coach', name:'Coach Better', c:'#c8202f', tag:'Our coaches are our business',
   intro:'Great clubs are built by great coaches. Coach Better makes development more accessible and more connected, from young leaders and club CPD to high-performance expertise, so knowledge stays in your club and coaches stay in the sport.',
   areas:['Club CPD and mentoring','British Gymnastics qualifications','Young leaders and volunteers','Coach recruitment','Coach consultancy pool','Technique, judging and the Code of Points'],
   offers:[
     {name:'Matt Jackson Gymnastics Consultancy', kind:'Partner', headline:'High-performance coaching support for your club',
      text:'Matt is a Level 5 High Performance Coach with 27 years’ experience, who has coached multiple British champions and at the 2018 Commonwealth Games. He helps clubs develop more confident coaches, stronger technical programmes and clearer gymnast pathways.',
      actions:[{l:'Contact Matt', mail:'infoatjgc@gmail.com', subject:'NGL referral'}]},
     {name:'Elevate Volunteering', kind:'Partner offer', headline:'£50 off a course for 15 people',
      text:'Founded by Gemma Wright, coach since 2008 and former National Judge. Introductory courses in health, safety and wellbeing, Recreational gymnastics and judging, followed by a mentored Young Leaders programme with termly reviews.',
      actions:[{l:'Ask NGL for your £50 code', mail:CONTACT_EMAIL, subject:'Elevate £50 discount code', body:'Please send our Elevate Volunteering £50 discount code.'}]},
     {name:'FB Curves 3D Gym', kind:'New partner offer', headline:'10% off the 3D Gym apps and Deduction Videos',
      text:'Every skill in the Code of Points as a 3D animation you can rotate, slow down and view from any angle, for Women’s and Men’s Artistic and Trampoline, on phone, tablet and computer. The Deduction Video library explains each execution fault and its penalty. Built with international judges and coaches, and kept up to date with the Code of Points. For coaches, gymnasts and judges at every level.',
      actions:[{l:'Ask NGL for your 10% code', mail:CONTACT_EMAIL, subject:'FB Curves 10% discount code', body:'Please send our FB Curves 3D Gym 10% discount code.'},{l:'Visit FB Curves', href:'https://www.fb-curves.com/en/', ghost:true}]},
     {name:'Growth Club', kind:'Partner', headline:'Mentoring for athletes, current and retired',
      text:'Founded by Reiss Beckford after 23 years competing internationally for Great Britain and Jamaica. Helps athletes and coaches build a personal brand and business that lasts beyond their competitive career.',
      actions:[{l:'Visit Growth Club', href:'https://www.growth-club.org/'}]},
     {name:'Rebound Therapy', kind:'New partner', headline:'Every coach equipped to coach every person, regardless of ability',
      text:'ReboundTherapy.org is the official UK body for Rebound Therapy, training coaches since 1979. Its accredited Rebound Therapy Practitioner course runs in-house at your club (up to 12 candidates, or 16 with two trampolines) or online, and gives coaches the skills and confidence to welcome people with additional needs and disabilities. It’s also a real opportunity for your club: use quieter periods, extend your hours and reach new participants. Sport England has funded clubs to take the training. Clubs can also use Rebound Therapy’s free framework for running their own SEN trampoline competitions and Celebration of Participation events.',
      actions:[{l:'NGL clubs: book Rebound Therapy training', href:'https://www.reboundtherapy.org/courses/reboundtherapy/rt-national-gymnastics-league'},{l:'Watch the introduction', href:'https://vimeo.com/292383728', ghost:true},{l:'SEN trampoline events', href:'https://www.reboundtherapy.org/more/sen-trampoline-events', ghost:true}]}
   ]},
  {id:'care', name:'Care Better', c:'#1a7a43', tag:'People first. Always.',
   intro:'Gymnasts, parents, coaches and volunteers all need to feel safe, supported and listened to. Care Better is about safeguarding-led cultures and clear people practices, built into everyday club life rather than treated as paperwork.',
   areas:['HR for small and medium clubs','Safeguarding','Parent and gymnast support','Culture and environment'],
   offers:[
     {name:'Impact HR', kind:'Partner offer', headline:'Free HR benchmark assessment for NGL clubs',
      text:'Working with British Gymnastics clubs for over 5 years. Retained HR support for a fixed monthly fee, on-demand advice with no contract, contracts and handbooks, and specialist projects such as restructures and investigations.',
      actions:[{l:'Claim your free assessment', mail:CONTACT_EMAIL, subject:'Impact HR free benchmark assessment', body:'We would like our free Impact HR benchmark assessment.'},{l:'NGL offer pack (PDF)', href:IMPACT_HR_PACK, ghost:true}]},
     {name:'Working With Parents in Sport', kind:'Partner offer', headline:'12 months’ free membership for your families',
      text:'WWPIS works with British Gymnastics, Premier League academies and many other sports to help organisations, coaches and parents work together. Members get blogs, videos, podcasts, webinars and expert guidance for parents of children in competitive sport.',
      actions:[{l:'Ask NGL for your WWPIS code', mail:CONTACT_EMAIL, subject:'WWPIS free membership code', body:'Please send our Working With Parents in Sport code for 12 months’ free membership.'}]}
   ]},
  {id:'grow', name:'Grow Better', c:'#b8860b', tag:'Building sustainable, future-ready clubs',
   intro:'Growth works best when it’s planned and based on real information. Grow Better helps clubs with sales, marketing and programme decisions, using shared data and national visibility instead of guesswork.',
   areas:['Enquiries, trials and conversion','Inclusive programmes and new participants','Data and benchmarking','Social media','National campaigns'],
   offers:[
     {name:'Rebound Therapy', kind:'New partner', headline:'Every coach equipped to coach every person, regardless of ability',
      text:'ReboundTherapy.org is the official UK body for Rebound Therapy, training coaches since 1979. Its accredited Rebound Therapy Practitioner course runs in-house at your club (up to 12 candidates, or 16 with two trampolines) or online, and gives coaches the skills and confidence to welcome people with additional needs and disabilities. It’s also a real opportunity for your club: use quieter periods, extend your hours and reach new participants. Sport England has funded clubs to take the training. Clubs can also use Rebound Therapy’s free framework for running their own SEN trampoline competitions and Celebration of Participation events.',
      actions:[{l:'NGL clubs: book Rebound Therapy training', href:'https://www.reboundtherapy.org/courses/reboundtherapy/rt-national-gymnastics-league'},{l:'Watch the introduction', href:'https://vimeo.com/292383728', ghost:true},{l:'SEN trampoline events', href:'https://www.reboundtherapy.org/more/sen-trampoline-events', ghost:true}]}
   ],
   soon:'More Grow Better partners are on their way. If there’s a marketing or social media business you trust, tell us.'},
  {id:'connect', name:'Connect Better', c:'#01808a', tag:'Stronger clubs through collaboration',
   intro:'Clubs often solve the same problems on their own. Connect Better brings clubs, people and trusted partners together, so you can learn from each other and reach opportunities you couldn’t on your own.',
   areas:['Club-to-club collaboration','Shared learning and templates','Trusted partners','Community'],
   offers:[
     {name:'Talk to the NGL team', kind:'NGL', headline:'Stuck on something? Another club has probably solved it',
      text:'Tell us what you’re working on and we’ll put you in touch with clubs and partners who can help.',
      actions:[{l:'Email the NGL team', mail:CONTACT_EMAIL, subject:'Club support request'}]}
   ]}
];
const PARTNERS_WANTED = ['Legal support','Accounting advice','Social media support','Branded clothing'];


const TI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const PI = {operate:TI('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  coach:TI('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10l2 2 4-4M8.5 16h7"/>'),
  care:TI('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  grow:TI('<path d="M4 19h16"/><path d="M6 15l4-4 3 3 6-7"/><path d="M15 7h4v4"/>'),
  connect:TI('<circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2.5 19c.8-3 2.4-4.5 4.5-4.5s3.7 1.5 4.5 4.5M12.5 19c.8-3 2.4-4.5 4.5-4.5s3.7 1.5 4.5 4.5"/>')};

function supportAction(a, club){
  if (a.mail) {
    const name = club ? club.name : '';
    const subject = a.subject + (name ? ' – ' + name : '');
    const body = (a.body ? a.body + '\n\n' : '') + (name ? 'Club: ' + name + '\n' : '') + (club && club.email ? 'Email: ' + club.email + '\n' : '');
    const href = `mailto:${a.mail}?subject=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;
    return `<a class="btn sm${a.ghost ? ' ghost' : ''}" href="${esc(href)}">${esc(a.l)}</a>`;
  }
  return `<a class="btn sm${a.ghost ? ' ghost' : ''}" href="${esc(a.href)}" target="_blank" rel="noopener">${esc(a.l)} ↗</a>`;
}

export default async function better(parts = []){
  const club = await api.club().catch(() => null);
  const pick = SUPPORT.find(p => p.id === parts[0]);
  const nav = SUPPORT.map(p => `<a class="bb-chip ${pick && pick.id === p.id ? 'on' : ''}" href="#/better/${p.id}" style="--c:${p.c}"><span class="bb-pi">${PI[p.id] || ''}</span><b>${esc(p.name.replace(' Better', ''))}</b><small>${p.offers.length ? p.offers.length + (p.offers.length === 1 ? ' offer' : ' offers') : 'Coming soon'}</small></a>`).join('');
  const section = (p, i) => `
    <section class="bb-pillar" id="sp-${p.id}" style="--c:${p.c}">
      <div class="bb-head"><span class="bb-n">${i + 1}</span><div><h2>${esc(p.name)}</h2><p class="bb-tag">${esc(p.tag)}</p></div></div>
      <p class="bb-intro">${esc(p.intro)}</p>
      <ul class="bb-areas">${p.areas.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      ${p.offers.length ? `<div class="grid g2">${p.offers.map(o => `
        <div class="card bb-offer">
          <div class="bb-kind">${esc(o.kind)}</div>
          <h3>${esc(o.name)}</h3>
          <p class="bb-headline">${esc(o.headline)}</p>
          <details class="bb-more"><summary>More about ${esc(o.name)}</summary><p>${esc(o.text)}</p></details>
          <div class="btn-row">${o.actions.map(a => supportAction(a, club)).join('')}</div>
        </div>`).join('')}</div>` : ''}
      ${p.soon ? `<div class="card bb-soon">${esc(p.soon)} <a href="${esc(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Partner suggestion for ' + p.name)}`)}">Suggest a partner</a></div>` : ''}
    </section>`;
  return `<h1>Be Better</h1>
    <p class="lead"><b>Helping Clubs be BETTER.</b> Five pillars to make clubs better. NGL pools the experience and scale of the whole network, so every club gets trusted partners, tools and offers without sourcing them alone.</p>
    <nav class="bb-nav" aria-label="Pillars">${nav}</nav>
    ${(pick ? [pick] : SUPPORT).map(p => section(p, SUPPORT.indexOf(p))).join('')}
    ${pick ? `<p style="margin-top:16px"><a href="#/better">← All five pillars</a></p>` : ''}
    <div class="card" style="margin-top:22px">
      <h3>Know a business that could help NGL clubs?</h3>
      <p class="lead" style="font-size:14px">We're looking for trusted partners in: ${PARTNERS_WANTED.map(esc).join(' · ')}.</p>
      <div class="btn-row"><a class="btn sm ghost" href="${esc(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('NGL partner suggestion')}`)}">Suggest a partner</a></div>
    </div>`;
}
