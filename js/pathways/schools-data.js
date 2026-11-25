// NGL Schools data and pure logic: copied WORD FOR WORD from today's Schools hub (nglschools/club/index.html):
// licence bands and prices, the Profit planner defaults, the Secondary planner (books, equipment, lesson builder),
// Graduation money, and the programme's routines, skills and videos. Keep in step with the live hub until switch-over.
const SCHOOLS_BANDS = [
  {key:'xs', label:'1 to 24 Schools gymnasts',    short:'1–24',    price:150,  max:24},
  {key:'sm', label:'25 to 49 Schools gymnasts',   short:'25–49',   price:250,  max:49},
  {key:'s',  label:'50 to 99 Schools gymnasts',   short:'50–99',   price:400,  max:99},
  {key:'m',  label:'100 to 249 Schools gymnasts', short:'100–249', price:750,  max:249},
  {key:'m2', label:'250 to 399 Schools gymnasts', short:'250–399', price:1000, max:399},
  {key:'l',  label:'400 to 599 Schools gymnasts', short:'400–599', price:1250, max:599},
  {key:'xl', label:'600 or more Schools gymnasts', short:'600+',   price:1500, max:null}   // null = no top
];
const PRICES = [
  {kind:'book',   name:'NGL Schools Awards Book', price:5,    rrp:'£10',        note:'Six levels; lasts more than a year'},
  {kind:'cert',   name:'Certificate (Bronze, Silver or Gold)', price:0.10, rrp:'', note:'Three per level'},
  {kind:'tshirt', name:'NGL children’s t-shirt',  price:12,   rrp:'£17 to £20', note:''}
];
const CERT_TYPES = [{key:'bronze', name:'Bronze'}, {key:'silver', name:'Silver'}, {key:'gold', name:'Gold'}];
const POSTAGE = [{upTo:20, price:4}, {upTo:100, price:8}, {upTo:Infinity, price:12}];
function postageFor(items){ if(items <= 0) return 0; return POSTAGE.find(p => items <= p.upTo).price; }
const shopItem = k => PRICES.find(x => x.kind === k);

const PLAN_DEFAULTS = {
  bandChildren: 100, vatRegistered: false,
  o1On: true, o1Schools: 2, o1Children: 100, o1FeeA: 600, o1FeeB: 800, o1FeeC: 950, o1FeeD: 1200, o1FeeE: 1500, o1BookPrice: 8, o1Visits: 10, o1VisitHrs: 2, o1TrainHrs: 3,
  o2On: true, o2Children: 30, o2Fee: 6, o2Weeks: 33, o2Group: 15, o2SessHrs: 1.5, o2Overheads: 10, o2Hall: 0, o2BookPrice: 10,
  coachRate: 25, gradRate: 60, extraSpect: 1, newRate: 33, certsPerChild: 3
};
/* Suggested yearly fee to a school, on a sliding scale by the children taking part at that school. */
const SCHOOL_FEE_TIERS = [['o1FeeA', 30, 'Up to 30'], ['o1FeeB', 60, '31–60'], ['o1FeeC', 100, '61–100'], ['o1FeeD', 200, '101–200'], ['o1FeeE', null, '201+']];
const schoolFeeFor = (p, n) => { const t = SCHOOL_FEE_TIERS.find(x => x[1] == null || n <= x[1]); return {fee: p[t[0]], tier: t[2]}; };

const SEC_APP = {
  vault:  {name:'Vault', col:'#28225c'},
  bars:   {name:'Bars', col:'#e3474a'},
  beam:   {name:'Beam', col:'#1960ab'},
  floor:  {name:'Floor', col:'#00b5b8'},
  prep:   {name:'Physical prep', col:'#62a83e'},
  rebound:{name:'Rebound (tramp)', col:'#e8822f'}
};
const SEC_BOOKS = {
  teal: {name:'Book 3 · Teal', levels:{
    9:{vault:['Tuck handstand shoulder shrugs (5 reps) against wall','Straddle on, immediate stretch jump off (1m vault) using springboard','Leapfrog over mushroom or low box to stand','Handstand flat back onto 60cm mats using springboard'],
       bars:['Forward roll to hang (no coach assist)','5 swings in mixed grip (both ways)','Cast towards horizontal with assistance','Chin-up held (3 seconds in overgrasp)'],
       beam:['Walk backwards for 1 length (high beam)','3 caterpillar walks (high beam)','Stretch jump (high beam)','Cartwheel (red foam beam)'],
       floor:['Backward roll to straddle or tuck stand','1-handed cartwheel','Run or hurdle jump into handstand flat back (30cm mats)','Scissor leap'],
       prep:['Dish hold with straight legs, 5s','5 tucked leg lifts','Rebound/penguin jumps across floor','5 front support rocks'],
       rebound:['Wolf jump','Run and front somersault to sitting on mats (60cm)','Handstand to bridge on floor','Two consecutive high straddle jumps']},
    10:{vault:['Front support slide to back support with tucked knees','Handstand flat back onto 90cm mats using springboard','Squat through on 60cm trapezoid box using springboard','Handstand shrugs against wall x10'],
       bars:['Arch/dish in hang x3 (fish swings)','Circle up with no coach assistance','Cast back hip circle with support','Cast and dismount above horizontal'],
       beam:['Kick towards handstand (medium beam)','Tuck jump (medium beam)','Y balance 5s (medium beam)','Cat leap (high beam)'],
       floor:['Handstand bridge with light support','Full spin','Handstand forward roll','Hurdle step into round-off rebound'],
       prep:['5 dish rocks','Rock backwards, stand up, stretch jump x5','Bridge with legs together','Lie on belly, raise arms from floor 5s'],
       rebound:['Sissone jump','Split jump, 1/2 turn jump','Front somersault with coach support','Handspring over barrel']},
    11:{vault:['Handstand flat back showing second flight (60cm mats)','From 30cm block, step rebound on springboard, star jump to mat','12 consecutive tucked jumps on floor area','Front tucked somersault to land seated on 60cm mats using springboard'],
       bars:['Cast back hip circle without support','3 aided chin-ups','Cast into straddle on, jump off with assistance','5 fish swings'],
       beam:['Half spin (floor beam)','Tuck jump (high beam)','Squat on mount (high beam)','Walk backwards halfway, half turn, walk forwards to end (high beam)'],
       floor:['Front-to-back cartwheel, backward roll to optional exit','Full jump turn','Straight legs lift to headstand 3s','Bridge kickover'],
       prep:['5 single-leg glute bridges','Extended front support 3s (return to pike stand)','Dominant leg splits','5 sit-ups'],
       rebound:['Change leg split jump','Tucked jump, 1/2 turn jump','Seat drop 1/2 turn','Supported falling log']},
    12:{vault:['Squat through on 100cm vaulting table using springboard','Half jump turn from 1m vault with a good landing','Handstand flat back showing second flight (90cm mats) using springboard','One handstand pop (under-arm action)'],
       bars:['Back hip circle with straight arms','Float swing from board without slider','Cast into tuck on, jump off with assistance','3 leg lifts to 45 degrees above horizontal'],
       beam:['Handstand (high beam)','Cartwheel (floor beam)','Wolf jump (red foam beam)','Round-off dismount (high beam)'],
       floor:['Backbend to bridge','Handstand (must hit vertical)','Hurdle jump into cartwheel','Straddle jump'],
       prep:['8 kicks forwards, backwards and sideways on each leg','10 dish rocks','Box splits','5 tricep dips on parallel bars or a single low bar'],
       rebound:['Tucked jump 1/1 turn jump','1/2 turn to seat drop','Back flick over barrel','Handspring supported']}},
    routines:{floor:'Handstand forward roll, tuck jump, full turn spin, cartwheel, backward roll, cat leap, round-off',
              vault:'Handstand flat back',
              beam:'Any mount, cat leap, half spin, tuck jump, handstand, round-off dismount'}},
  pink:  {name:'Book 2 · Pink', soon:true},
  indigo:{name:'Book 4 · Indigo', soon:true}
};
const SEC_LEVELS = [9, 10, 11, 12];
const SEC_LVL_COL = {9:'#00b5b8', 10:'#1960ab', 11:'#e3474a', 12:'#28225c'};
const SEC_EQUIP = {
  floor:  {label:'Floor', opts:[['mats','Gym mats on the hall floor'],['sprung','Sprung floor or gymnastics area'],['none','Leave out']]},
  vault:  {label:'Vault', opts:[['full','Vault table + springboard'],['box','Box or stacked mats + springboard'],['none','No vault']]},
  beam:   {label:'Beam', opts:[['beam','Beam (low or high)'],['bench','Bench instead of beam'],['line','Floor line or floor beam'],['none','Leave out']]},
  bars:   {label:'Bars', opts:[['bars','Low bar or parallel bars'],['wall','Wall bars only'],['none','Leave out']]},
  rebound:{label:'Rebound', opts:[['tramp','Trampette or mini-tramp'],['none','Leave out']]}
};
const SEC_ADAPT = {
  'floor:mats':'Floor on gym mats: lay the mats in a strip for rolls, handstands and cartwheels. Do bridges, round-offs and kickovers on mats only.',
  'vault:box':'No vault table: use a box top or stacked mats (60cm) with the springboard, and mark table skills as adapted.',
  'beam:bench':'Beam skills on a bench (flat or upturned). Mark the skill as adapted in the Awards Book.',
  'beam:line':'Beam skills along a taped line or floor beam. Mark the skill as adapted in the Awards Book.',
  'bars:wall':'Wall bars: hangs, swings, chin-ups and leg lifts. Replace cast and circle skills with front support holds on a bench, and mark them as adapted.'
};
const SEC_DEFAULTS = {termStart:'', book:'teal', level:'all', floor:'mats', lessons:6, mins:50, warm:8, cool:5, classSize:30, vault:'box', beam:'bench', bars:'none', rebound:'none'};

function secStations(p){
  const st = [];
  if(p.floor !== 'none') st.push('floor');
  if(p.vault !== 'none') st.push('vault');
  if(p.beam !== 'none') st.push('beam');
  if(p.bars !== 'none') st.push('bars');
  if(p.rebound !== 'none') st.push('rebound');
  st.push('prep');
  return st;
}
function secCalc(p){
  const all = p.level === 'all', book = SEC_BOOKS[all ? 'teal' : p.book] || SEC_BOOKS.teal, st = secStations(p);
  const L = all ? null : book.levels[p.level];
  const N = Math.max(3, Math.min(15, Math.round(p.lessons) || 6));
  const T = N - 2, rot = Math.max(3, Math.floor((p.mins - p.warm - p.cool) / st.length));
  const group = Math.ceil((p.classSize || 0) / st.length);
  const lessons = [];
  for(let k = 1; k <= T; k++){
    const a = Math.floor((k - 1) * 4 / T), b = Math.max(a + 1, Math.floor(k * 4 / T));
    lessons.push({n:k, title: k === 1 ? (all ? 'Introduce each level' : 'Introduce the level') : (k === T ? 'Secure every skill' : 'Develop the skills'),
      st: st.map(ap => all
        ? {ap, levels: SEC_LEVELS.map(lv => ({lv, focus: book.levels[lv][ap].slice(a, b), recap: book.levels[lv][ap].slice(0, a)}))}
        : {ap, focus: L[ap].slice(a, b), recap: L[ap].slice(0, a)})});
  }
  lessons.push({n:T + 1, title:'Performance routines', perf:true});
  lessons.push({n:T + 2, title:'Assessment', assess:true});
  const notes = ['floor','vault','beam','bars'].map(k => SEC_ADAPT[k + ':' + p[k]]).filter(Boolean);
  if(all) notes.unshift('All Levels: each pupil works on the skills for their own level (9 to 12) at every station, so one plan runs the whole mixed class.');
  return {all, book, L, st, rot, group, lessons, notes};
}
const secLvlTag = lv => `<span style="display:inline-block;min-width:30px;text-align:center;padding:1px 6px;border-radius:6px;background:${SEC_LVL_COL[lv]};color:#fff;font-size:11px;font-weight:800;margin-right:6px">L${lv}</span>`;
const secRoutineAps = p => ['floor','vault','beam'].filter(ap => p[ap] !== 'none');
const secLevelName = p => p.level === 'all' ? 'All Levels' : 'Level ' + p.level;
/* Today's lesson: one lesson a week from the term start date (week 1 = lesson 1). */
function secToday(p, now = new Date()){
  if(!p.termStart) return {key:'nodate'};
  const start = new Date(p.termStart + 'T00:00:00'); if(isNaN(start)) return {key:'nodate'};
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - start) / 86400000);
  const total = secCalc(p).lessons.length;
  if(days < 0) return {key:'before', start, total};
  const n = Math.floor(days / 7) + 1;
  return n > total ? {key:'after', start, total} : {key:'on', n, total, start};
}

const GRAD_FAMILY_PRICE = 12;   // what families pay the club per gymnast, including one spectator (VAT included)
const GRAD_EXTRA_SPECTATOR = 6; // what families pay for each extra spectator (VAT included); all of it goes to NGL
const GRAD_NGL_FEE = 5;         // what NGL invoices the club per graduate, + VAT (medal included)
const GRAD_NGL_SPECTATOR = 5;   // what NGL invoices the club per extra spectator, + VAT
const GRAD_CLUB_KEEPS = 5;      // the club's share of each £12 ticket, after VAT and NGL's fee

const SCH_LEVEL_VIDEOS = {
  floor:  ["RNUwhMXiYis","eADe1GviPLM","h16vKU5tP4U","FpKpFKOUYyU","iOsuHJGkO1c","YAgIG_0C6uw"],
  bench:  ["svkVbP3FZ3g","7jVy-1UzC3A","xitDvlyhDuk","pkv5WK6rjM4","1PnEO8Uvz5s","NJSKCnuaan4"],
  block:  ["Tk9rSyeja-4","lZ-UoxomKzw","sLOY2MHdAXk","W5be9WitaYE","HJTE-yp1MWY","EdxpJ7TUja0"],
  spring: ["DYYRmbEa50s","M70tbYs7Ld8","5pyvEyEWVW0","Oh_UWsoI0NM","L6_0UBX5dj8","CRlrSVHQGi0"]
};
const SCH_BLOCK_CAPTIONS = [
  "Squat on low table from stand, straight jump off",
  "Squat on low table from stand, star jump off",
  "Run, squat on, tuck jump off",
  "Run, squat on, star jump off",
  "Run side vault over, tucked legs",
  "Run side vault over, straight legs"
];
const SCH_SPRING_CAPTIONS = [
  "Run, straight jump off springboard to land",
  "Run, star jump off springboard to land",
  "Run, tuck jump off springboard to land",
  "Run, straddle jump off springboard to land",
  "Run, star jump off springboard, over low table",
  "Run, tuck jump off springboard, over low table"
];
const SCH_FLOOR_SKILLS = [
  ["Straight jump","Star jump","Forward roll to ball","Straddle","Pike","Back support","Side support","Front support","Tuck","Bent leg balance"],
  ["Straight jump","Star jump","Tuck jump","Forward roll to ball","Straddle","Pike","Back support","Side support","Front support","Tuck","Sideways bunny jump x3","Straight leg balance"],
  ["Tuck jump","1/2 jump x2","Forward roll to ball","Shoulder stand","Bridge","Straddle","Pike","Back support","Side support","Front support","Press up x3","Burpee","Arabesque","Cartwheel"],
  ["1/1 jump","Forward roll to stand","Tuck","Shoulder stand no hands","Japana 45 degrees","Bridge","Back support","Leg lift each leg","Side support","Front support","Press up x3","Burpee","Arabesque","Cartwheel","Handstand"],
  ["Straight jump","1/1 jump","Forward roll to straddle stand","Straight","Tuck","Headstand tucked","Tuck","Bridge","Back support","Front support","Press up x5","Burpee","Arabesque leg horizontal","Cartwheel","Handstand","One free move"],
  ["Straight jump","1/1 jump","Forward roll to straddle stand","Straight","Tuck","Headstand straight","Tuck","Bridge leg raise","Back support","Front support","Press up x5","Burpee","Arabesque leg horizontal","One handed Cartwheel","Handstand","One free move"]
];
const SCH_BENCH_SKILLS = [
  ["Step up","Walk to middle","Straight jump","Walk to end","Half turn","Single leg balance","High kicks to middle","Dip steps to end","Straight jump off"],
  ["Step up","Walk on toes to middle","Straight jump","Tuck jump","Walk on toes to the end","Half spin on toes","Single leg balance","Bunny jumps to middle","Rebound jumps to end","Star jump off"],
  ["Travelling bunny jumps side to side into middle","Bunny jump on","Straight jump","Star jump","Tuck jump","Tuck shape","Shoulder stand","Roll to stand","Dip steps to end","Walk backwards to middle","Half turn on toes","High knee single leg balance","Cat leaps to end","Half turn jump off"],
  ["Squat on in the middle","Straddle stand or side splits","Tuck shape","Quarter turn in tuck","Tuck walk to end","Half spin on toes","Forward roll to stand (mat can be slid in)","Dip steps to end","Half spin","Arabesque","Cat leaps to middle","Cartwheel off the end"],
  ["Jump to wide straddle or side splits","Push to stand","Star jump","Tuck jump","Half turn jump","Side chasse to end","Cartwheel (mat can be slid in)","Forward roll (mat)","Arabesque","Kick turn","Step or skip step into round off"],
  ["Jump into forward roll (mat)","Straddle lever","Swing legs behind push to stand","Split leap to end","Half spin","Half handstand","Cartwheel (mat)","Tuck headstand (mat)","Arabesque to horizontal","Skip step round off"]
];

export { SCHOOLS_BANDS, PRICES, CERT_TYPES, POSTAGE, postageFor, shopItem, PLAN_DEFAULTS, SCHOOL_FEE_TIERS, schoolFeeFor, SEC_APP, SEC_BOOKS, SEC_LEVELS, SEC_LVL_COL, SEC_EQUIP, SEC_ADAPT, SEC_DEFAULTS, secStations, secCalc, secLvlTag, secRoutineAps, secLevelName, secToday, GRAD_FAMILY_PRICE, GRAD_EXTRA_SPECTATOR, GRAD_NGL_FEE, GRAD_NGL_SPECTATOR, GRAD_CLUB_KEEPS, SCH_LEVEL_VIDEOS, SCH_BLOCK_CAPTIONS, SCH_SPRING_CAPTIONS, SCH_FLOOR_SKILLS, SCH_BENCH_SKILLS };
