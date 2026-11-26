// NGL Admin · Staffing. Copied from GYMNASTICS-RESULTS/NGL_Staffing_Admin.html (same wording, templates, Judging Pathway
// sync, judge requests, exports); only the look and the data layer change.
// Data: competitions (name, date, where, path), staffing/{competition id} (same document as ngl_staffing had),
// and, from the judging apps, ngl_judge_signups, ngl_judging_assignments and ngl_judges (same names as before).
// Routes: #/admin/staffing (all competitions), #/admin/staffing/<id>[/requests|/settings].
import { MODE, CALENDAR } from '../data.js';
import { fb } from '../firebase.js';
import { esc, pill, modal, toast as appToast } from '../ui.js';

const COLL = {
  competitions: "competitions",
  staffing: "staffing",                       // one doc per competition id
  judgeSignups: "ngl_judge_signups",          // the judging app's sign-up collection
  judgingAssignments: "ngl_judging_assignments",  // Judging Pathway bookings (confirmed ones fill the Judge slots)
  judges: "ngl_judges"                        // Judging Pathway profiles (for mobile, email, club)
};
// Standalone competitions that aren't in competitions. Staffing for these
// still saves to staffing under the id given here, so keep ids unchanged.
const STANDALONE = [
  {id:"ngl-2026-recreational",   name:"NGL Recreational Competition",         date:"2026-10-25", venue:"", discipline:"WAG"},
  {id:"ngl-2026-finals-a",       name:"NGL National Finals: Level A",          date:"2026-11-22", venue:"", discipline:"WAG", order:1},
  {id:"ngl-2026-finals-bc",      name:"NGL National Finals: Levels B and C",   date:"2026-11-22", venue:"", discipline:"WAG", order:2}
];
// Which seasons of competitions to show (standalone competitions above always show)
const SEASONS = ["2027"];
// Field names the judging app uses on each sign-up document
const SF = {competitionId:"competitionId", name:"name", email:"email", phone:"phone", club:"club", tier:"tier", apparatus:"apparatus", status:"status", notes:"notes"};

const APPARATUS = {
  WAG: ["Vault","Bars","Beam","Floor"],
  MAG: ["Floor","Pommel","Rings","Vault","Parallel Bars","High Bar"]
};
const GROUP_ORDER = {control:0, station:1, floor:2, other:3};
const GROUP_NAME = {control:"Control desk", station:"Stations", floor:"Floor team", other:"Additional staff"};
// How roles are grouped on the all-competitions overview
const CATS = [
  ["run",    "Running the competition"],
  ["judge",  "Judges"],
  ["camera", "Camera operators"],
  ["app",    "Apparatus staff"],
  ["floor",  "Awards and runners"],
  ["other",  "Additional staff"]
];
function catOf(s){
  if(s.group==="control") return "run";
  if(s.group==="station") return isJudge(s) ? "judge" : /camera/i.test(s.role) ? "camera" : "app";
  if(s.group==="floor") return "floor";
  return "other";
}
// Inside the Judges and Camera groups the apparatus is the useful label
function ovLabel(s){
  const k = catOf(s);
  if(k==="judge")  return s.role==="Judge" ? s.apparatus : `${s.apparatus} (${s.role})`;
  if(k==="camera") return s.role==="Camera Operator" ? s.apparatus : `${s.apparatus} (${s.role})`;
  return slotLabel(s);
}
const STAFF_PRESETS = ["First Aider","Floor Manager","Music Operator","Photographer","Warm-up Steward","Reception / Door","Results Runner","Volunteer"];

const LIVE = MODE !== 'demo';
const S = { comps:[], compId:null, staffing:null, signups:[], filter:"all", rfilter:"open", unsub:null, all:{}, ovFilter:"all", pendingByComp:{},
  loaded:false, loading:null, stale:false, subs:[], loadErrs:[], saveText:"", tab:"board", detailId:null, draft:null };

const uid = () => Math.random().toString(36).slice(2,10);
const toast = (msg, ok = true) => appToast(msg, ok);
const onScreen = () => !!document.getElementById('stfRoot');
const rerender = () => { if (onScreen()) window.NGL_RENDER && window.NGL_RENDER(); };
const render = rerender;
const dlgOpen = () => !!document.querySelector('.stf-modal');

/* ---------- Demo data (sample data only: nothing is saved) ---------- */
const DEMO_STAFF = {};
const DEMO_SIGNUPS = [
  {id:"s1", competitionId:"c1", name:"Priya Shah", email:"priya@example.com", phone:"07700 900111", club:"Luton Gym Club", tier:"Senior Judge", apparatus:["Beam","Floor"], status:"pending", notes:"Can stay all day"},
  {id:"s2", competitionId:"c1", name:"Tom Ellis", email:"tom@example.com", phone:"07700 900222", club:"Watford GC", tier:"Junior Judge", apparatus:["Vault"], status:"pending", notes:""},
  {id:"s3", competitionId:"c1", name:"Megan Hart", email:"megan@example.com", phone:"07700 900333", club:"SAADI", tier:"Apprentice Judge", apparatus:["Bars","Beam"], status:"pending", notes:"Shadowing only"},
  {id:"s4", competitionId:"c2", name:"Chloe Grant", email:"chloe@example.com", phone:"07700 900444", club:"Herts Academy", tier:"Senior Judge", apparatus:["Floor"], status:"pending", notes:""}
];
function demoFill(st, role, apparatus, who){
  const s = st.slots.find(x=>x.role===role && (x.apparatus||"")===apparatus); if(s) Object.assign(s, who);
}
function demoStaffing(c){
  const st = defaultStaffing(c);
  if(c.id==="c1"){
    delete st.unsaved;
    demoFill(st,"Competition Manager","",{name:"Dave Brooke", club:"SAADI Gymnastics", phone:"07700 900501", email:"dave@example.com", status:"confirmed"});
    demoFill(st,"Competition Scorer","",{name:"Christine Lowe", club:"NGL", phone:"07700 900502", email:"christine@example.com", status:"confirmed"});
    demoFill(st,"Announcer","",{name:"Mel Carter", club:"SAADI Gymnastics", phone:"07700 900503", status:"pending"});
    demoFill(st,"Judge","Vault",{name:"Sarah Collins", club:"Hitchin GC", phone:"07700 900504", email:"sarah@example.com", status:"confirmed", source:"pathway", signupId:"pw:demo-a1", pwName:"Sarah Collins", notes:"Judging Pathway · 09:00"});
    demoFill(st,"Camera Operator","Floor",{name:"Josh Reed", club:"NGL", phone:"07700 900505", status:"confirmed"});
    demoFill(st,"Awards Presenter 2","",{status:"na"});
  }
  if(c.id==="c2") demoFill(st,"Competition Manager","",{name:"Dave Brooke", club:"SAADI Gymnastics", phone:"07700 900501", status:"confirmed"});
  return st;
}

/* ---------- Templates ---------- */
function mk(role, group, apparatus, owner){
  return {id:uid(), role, group, apparatus:apparatus||"", owner, name:"", email:"", phone:"", club:"", status:"vacant", source:"", signupId:"", notes:""};
}
function apparatusFor(disc, custom){
  if(disc==="WAG") return APPARATUS.WAG.slice();
  if(disc==="MAG") return APPARATUS.MAG.slice();
  if(disc==="Both") return [...APPARATUS.WAG.map(a=>"WAG "+a), ...APPARATUS.MAG.map(a=>"MAG "+a)];
  return (custom||"").split(",").map(s=>s.trim()).filter(Boolean);
}
function templateSlots(st){
  const out = [
    mk("Competition Manager","control","","NGL"),
    mk("Competition Scorer","control","","NGL"),
    mk("Announcer","control","","Host")
  ];
  st.apparatus.forEach(a=>{
    for(let i=1;i<=st.judgesPerPiece;i++) out.push(mk(st.judgesPerPiece>1?`Judge ${i}`:"Judge","station",a,"Host"));
    out.push(mk("Camera Operator","station",a,"NGL"));
  });
  out.push(mk("Awards Presenter 1","floor","","Host"), mk("Awards Presenter 2","floor","","Host"),
           mk("Event Runner 1","floor","","Host"), mk("Event Runner 2","floor","","Host"));
  return out;
}
const slotKey = s => s.role+"|"+(s.apparatus||"");
const slotLabel = s => s.apparatus ? `${s.role}, ${s.apparatus}` : s.role;
const isJudge = s => /^judge/i.test(s.role);

/* ---------- Signup normalising (judging app → panel) ---------- */
function normSignup(id, d){
  const F = SF;
  let app = d[F.apparatus] ?? d.pieces ?? d.specialisms ?? [];
  if(typeof app==="string") app = app.split(/\s*,\s*/).filter(Boolean);
  const name = d[F.name] || d.judgeName || d.fullName || [d.firstName,d.lastName].filter(Boolean).join(" ") || "Name missing";
  return {
    id, name,
    email: d[F.email] || "", phone: d[F.phone] || d.mobile || "",
    club: d[F.club] || d.clubName || "", tier: d[F.tier] || d.level || "",
    apparatus: app, status: (d[F.status] || "pending").toLowerCase(),
    notes: d[F.notes] || d.message || "", adminNotes: d.adminNotes || "",
    assignedRole: d.assignedRole || ""
  };
}
async function updateSignup(id, patch){
  const F = SF, out = {};
  for(const [k,v] of Object.entries(patch)) out[F[k]||k] = v;
  if(LIVE){ const {fs, D} = await fb(); await fs.updateDoc(fs.doc(D, COLL.judgeSignups, id), out); }
  else { const d = DEMO_SIGNUPS.find(x=>x.id===id); Object.assign(d,out); loadSignups(); }
}

/* ---------- Loading ---------- */
function showLoadErr(msg){ S.loadErrs.push(msg); rerender(); }
function loadErrHTML(){
  if(!S.loadErrs.length) return "";
  return `<div class="stf-loaderr" role="alert">${S.loadErrs.map(esc).join("<br>")}${S.loadErrs.join(" ").includes("permission")
    ? `<br><strong>The Firestore rules are blocking this.</strong> Add the ${esc(COLL.staffing)} rule, then refresh.` : ""}</div>`;
}
// Competitions in the new database: name, date, where (venue), path (pathway), status
function mapComp(id, x){
  return {id, name:x.name||x.title||"Untitled competition", date:x.date||x.compDate||"", venue:x.where||x.venue||x.location||"",
    discipline:x.discipline||x.gender||(/\bboys\b|\bmag\b|\bmen'?s\b/i.test(x.who||"") ? "MAG" : ""), pathway:x.path||x.pathway||"", level:x.level||""};
}
function stopSubs(){ S.subs.forEach(u=>{ try{ u(); }catch(_){} }); S.subs = []; if(S.unsub){ S.unsub(); S.unsub = null; } }

async function load(){
  stopSubs();
  Object.assign(S, {comps:[], all:{}, pendingByComp:{}, loadErrs:[], compId:null, staffing:null, signups:[], detailId:null, stale:false});
  Object.assign(PW, {assigns:[], judges:{}, issues:[], ready:{a:false,j:false}, busy:false, again:false});
  try{ await loadComps(); }
  catch(err){ console.error(err); showLoadErr("Couldn't load competitions ("+(err.code||err.message)+")."); }
  S.loaded = true;
}

async function loadComps(){
  if(LIVE){
    const {fs, D} = await fb();
    try{
      const snap = await fs.getDocs(fs.collection(D, COLL.competitions));
      S.comps = snap.docs.map(d=>mapComp(d.id, d.data()))
        .filter(c=>SEASONS.some(y=>String(c.date?.toDate ? c.date.toDate().getFullYear() : c.date).startsWith(y)));
    }catch(err){ console.error(err); S.comps = []; showLoadErr("Couldn't read the 2027 competitions from "+COLL.competitions+" ("+(err.code||err.message)+")."); }
  } else S.comps = CALENDAR.map(c=>mapComp(c.id, c)).filter(c=>SEASONS.some(y=>String(c.date).startsWith(y)));
  S.comps = [...STANDALONE.map(c=>({...c})), ...S.comps]
    .sort((a,b)=>(dateVal(a.date)-dateVal(b.date)) || ((a.order||0)-(b.order||0)));
  // load every competition's staffing in one go
  if(LIVE){
    const {fs, D} = await fb();
    try{
      const snap = await fs.getDocs(fs.collection(D, COLL.staffing));
      snap.docs.forEach(d=>{ if(!d.id.startsWith("plan__") && d.id!=="summary__planning") S.all[d.id] = d.data(); });
    }catch(err){ console.error(err); showLoadErr("Couldn't read saved staffing from "+COLL.staffing+" ("+(err.code||err.message)+"). Changes won't save until this is fixed."); }
    S.subs.push(fs.onSnapshot(fs.collection(D, COLL.judgeSignups), sn=>{
      const F = SF; S.pendingByComp = {};
      sn.docs.forEach(d=>{ const x=d.data(); if(String(x[F.status]||"pending").toLowerCase()==="pending"){ const k=x[F.competitionId]; S.pendingByComp[k]=(S.pendingByComp[k]||0)+1; } });
      rerender();
    }, err=>console.error(err)));
  } else {
    S.comps.forEach(c=>{ if(!DEMO_STAFF[c.id]) DEMO_STAFF[c.id] = demoStaffing(c); });
    Object.assign(S.all, DEMO_STAFF);
    S.pendingByComp = {}; DEMO_SIGNUPS.forEach(d=>{ if(d.status==="pending") S.pendingByComp[d.competitionId]=(S.pendingByComp[d.competitionId]||0)+1; });
  }
  S.comps.forEach(c=>{ if(!S.all[c.id]) S.all[c.id] = defaultStaffing(c); });
  if(LIVE) subscribePathway();
}

function defaultStaffing(c){
  const d = ((c.discipline||"")+" "+(c.name||"")).toLowerCase();
  const disc = /\bboth\b/.test(c.discipline||"") ? "Both" : /mag|boys|\bmen/.test(d) ? "MAG" : "WAG";
  const st = {compId:c.id, compName:c.name, discipline:disc, customApparatus:"", judgesPerPiece:1, apparatus:apparatusFor(disc), unsaved:true};
  st.slots = templateSlots(st); return st;
}

/* ---------- Judging Pathway sync ----------
   Confirmed main-judge bookings in ngl_judging_assignments fill the matching Judge slot here.
   Slots filled this way carry source:"pathway". Cancelling or declining the booking empties the slot again.
   Anything an admin clears or overwrites by hand is remembered in staffing.pwIgnored and not refilled. */
const PW = { assigns:[], judges:{}, issues:[], ready:{a:false,j:false}, busy:false, again:false };
const PW_PIECE = {"uneven bars":"Bars","pommel horse":"Pommel"};
function pwApparatus(piece, disc){
  const p = String(piece||"").trim(), base = PW_PIECE[p.toLowerCase()] || p, d = String(disc||"").toUpperCase();
  return [d+" "+base, base, p].filter(Boolean).map(x=>x.toLowerCase());
}
function pwApply(st, compId){
  const issues = []; let changed = false;
  const ign = st.pwIgnored || [], slots = st.slots || [];
  const mine = PW.assigns.filter(a=>a.compId===compId && a.status==="confirmed" && (a.role||"judge")==="judge" && !ign.includes(a.id));
  const wanted = new Set(mine.map(a=>"pw:"+a.id));
  // booking cancelled, declined or deleted: free the slot
  slots.forEach(s=>{
    if(s.source==="pathway" && !wanted.has(s.signupId)){
      Object.assign(s,{name:"",email:"",phone:"",club:"",status:"vacant",source:"",signupId:"",pwName:""});
      if(String(s.notes||"").startsWith("Judging Pathway")) s.notes = "";
      changed = true;
    }
  });
  mine.forEach(a=>{
    const prof = PW.judges[a.judgeUid] || {};
    const name = a.judgeName || prof.name || "Judge";
    const note = "Judging Pathway" + (a.confirmedTime ? " · "+a.confirmedTime : "");
    let s = slots.find(x=>x.signupId==="pw:"+a.id);
    if(!s){
      const cands = pwApparatus(a.piece, a.discipline);
      const js = slots.filter(x=>isJudge(x) && x.group==="station" && cands.includes(String(x.apparatus||"").toLowerCase()));
      s = js.find(x=>x.status==="vacant");
      if(!s){
        const held = js.map(x=>x.status==="na" ? "marked not needed" : x.name).filter(Boolean).join(", ");
        issues.push({compId, judge:name, piece:a.piece,
          reason: js.length ? `No free judge slot on ${js[0].apparatus} (${held}). Free one up or add another judge.` : `This competition has no judge slot for ${a.piece}.`});
        return;
      }
      Object.assign(s,{name, email:prof.email||"", phone:prof.phone||"", club:prof.club||"", status:"confirmed", source:"pathway", signupId:"pw:"+a.id, pwName:name});
      if(!s.notes) s.notes = note;
      changed = true; return;
    }
    // already linked: keep in step with the booking, without trampling manual edits
    if(s.name===s.pwName && s.name!==name){ s.name = name; s.pwName = name; changed = true; }
    [["email",prof.email],["phone",prof.phone],["club",prof.club]].forEach(([k,v])=>{ if(!s[k] && v){ s[k] = v; changed = true; } });
    if(!s.notes || String(s.notes).startsWith("Judging Pathway")){ if(s.notes!==note){ s.notes = note; changed = true; } }
  });
  return {changed, issues};
}
async function pwSyncComp(id){
  const {fs, D} = await fb();
  const ref = fs.doc(D, COLL.staffing, id);
  const out = await fs.runTransaction(D, async t=>{
    const snap = await t.get(ref);
    const data = snap.exists() ? snap.data() : JSON.parse(JSON.stringify(S.all[id]));
    delete data.unsaved;
    const r = pwApply(data, id);
    if(r.changed){ data.updatedAt = new Date().toISOString(); t.set(ref, data); }
    return {data, r};
  });
  S.all[id] = out.data; if(S.compId===id) S.staffing = out.data;
  PW.issues.push(...out.r.issues);
}
async function pwReconcile(){
  if(!PW.ready.a || !PW.ready.j) return;
  if(dlgOpen()){ setTimeout(pwReconcile, 3000); return; }   // don't swap data under an open dialog
  if(PW.busy){ PW.again = true; return; }
  PW.busy = true; PW.issues = [];
  try{
    const ids = new Set(PW.assigns.map(a=>a.compId));
    Object.keys(S.all).forEach(id=>{ if((S.all[id].slots||[]).some(s=>s.source==="pathway")) ids.add(id); });
    for(const id of ids){
      if(!S.all[id]) continue;
      const dry = JSON.parse(JSON.stringify(S.all[id])), r = pwApply(dry, id);
      if(r.changed){ try{ await pwSyncComp(id); }catch(err){ console.error(err); S.loadErrs.push("Couldn't update staffing from the Judging Pathway ("+(err.code||err.message)+")."); } }
      else PW.issues.push(...r.issues);
    }
  } finally { PW.busy = false; }
  rerender();
  if(PW.again){ PW.again = false; pwReconcile(); }
}
function pwIssuesHTML(){
  const list = PW.issues;
  if(!list.length) return "";
  return `<div class="stf-pwissues" role="status"><strong>Judging Pathway: ${list.length} confirmed judge${list.length>1?"s":""} couldn't be placed automatically</strong>` +
    list.map(i=>{ const c = S.comps.find(x=>x.id===i.compId) || {};
      return `<div style="margin-top:8px">${esc(i.judge)} (${esc(i.piece)}) for ${esc(c.name||"")}: ${esc(i.reason)} <a class="btn sm ghost" href="${compHref(i.compId)}">Open</a></div>`; }).join("") + `</div>`;
}
function subscribePathway(){
  fb().then(({fs, D})=>{
    S.subs.push(fs.onSnapshot(fs.collection(D, COLL.judgingAssignments), sn=>{
      PW.assigns = sn.docs.map(d=>({id:d.id, ...d.data()})); PW.ready.a = true; pwReconcile();
    }, err=>{ console.error(err); showLoadErr("Couldn't read Judging Pathway bookings ("+(err.code||err.message)+")."); }));
    S.subs.push(fs.onSnapshot(fs.collection(D, COLL.judges), sn=>{
      PW.judges = {}; sn.docs.forEach(d=>{ PW.judges[d.id] = d.data(); }); PW.ready.j = true; pwReconcile();
    }, err=>{ console.error(err); PW.ready.j = true; pwReconcile(); }));
  }).catch(err=>console.error(err));
}
// an admin clearing or overwriting a pathway-filled slot by hand: remember it so the sync doesn't refill it
function pwDetach(s){
  if(s.source==="pathway" && String(s.signupId).startsWith("pw:")){
    S.staffing.pwIgnored = S.staffing.pwIgnored || [];
    S.staffing.pwIgnored.push(s.signupId.slice(3));
  }
}

/* ---------- Overview ---------- */
const flagOf = s => s.status==="vacant" ? "red" : s.status==="pending" ? "amber" : "green";
const compHref = id => "#/admin/staffing/" + encodeURIComponent(id);
const chip = (act, k, label, cur) => `<button type="button" class="chip ${cur===k?"on":""}" aria-pressed="${cur===k}" data-act="${act}" data-f="${esc(k)}">${label}</button>`;
function overviewHTML(){
  const head = `<div class="stf-ovhead"><h2>All competitions</h2><div class="chips">${chip("st-ov","all","All roles",S.ovFilter)}${chip("st-ov","gaps","Gaps only",S.ovFilter)}${chip("st-ov","NGL","NGL roles",S.ovFilter)}${chip("st-ov","Host","Host club roles",S.ovFilter)}</div></div>
    <div class="stf-key"><span><i class="fl red"></i>Vacant</span><span><i class="fl amber"></i>Awaiting confirmation</span><span><i class="fl green"></i>Confirmed or not needed</span><span>Tap any role to fill or edit it</span></div>`;
  if(!S.comps.length) return head + `<div class="card empty">No competitions found in ${esc(COLL.competitions)}. Add one in the competition admin first.</div>`;
  const f = S.ovFilter;
  return head + `<div id="stfOvList">` + S.comps.map(c=>{
    const st = S.all[c.id], slots = sortedSlots(st);
    const vac = slots.filter(s=>s.status==="vacant").length, pend = slots.filter(s=>s.status==="pending").length, na = slots.filter(s=>s.status==="na").length, conf = slots.length-vac-pend-na;
    const req = S.pendingByComp[c.id]||0;
    const show = slots.filter(s => f==="all" ? true : f==="gaps" ? (s.status==="vacant"||s.status==="pending") : s.owner===f);
    const rowHTML = s=>`<button type="button" class="ov-row ${s.status==="vacant"?"vac":s.status==="na"?"na":""}" data-act="st-slot" data-comp="${esc(c.id)}" data-slot="${s.id}">
        <i class="fl ${flagOf(s)}" aria-label="${s.status}"></i>
        <span><span class="r">${esc(ovLabel(s))}</span><span class="n">${s.status==="vacant"?"Vacant":s.status==="na"?"Not needed":esc(s.name)}</span></span>
        <span class="o ${s.owner==="Host"?"h":""}">${s.owner==="NGL"?"NGL":"Host"}</span></button>`;
    const rows = CATS.map(([k,title])=>{
      const inCat = slots.filter(s=>catOf(s)===k), vis = show.filter(s=>catOf(s)===k);
      if(!vis.length) return "";
      const open = inCat.filter(s=>s.status==="vacant"||s.status==="pending").length;
      const done = inCat.length - open;
      return `<div class="ov-group"><h4>${title} <small class="${open?"gap":""}">${done}/${inCat.length} sorted</small></h4><div class="ov-roles">${vis.map(rowHTML).join("")}</div></div>`;
    }).join("");
    return `<section class="ov-comp ${vac?"gaps":"all-clear"}">
      <header><div><h3>${esc(c.name)}</h3><div class="when">${esc([c.date&&fmtDate(c.date), c.venue].filter(Boolean).join(", "))}</div></div>
        <div class="counts">${vac?`<span class="flag red">${vac} vacant</span>`:""}${pend?`<span class="flag amber">${pend} awaiting</span>`:""}<span class="flag green">${conf} confirmed</span>${na?`<span class="flag green">${na} not needed</span>`:""}${req?`<span class="flag red">${req} judge request${req>1?"s":""}</span>`:""}</div>
        <a class="btn sm" href="${compHref(c.id)}">Open</a></header>
      <div class="ov-body">
        ${rows || `<div class="ov-empty">${f==="gaps"?"Fully staffed":"No roles match this filter"}</div>`}
        <div class="ov-add"><button type="button" class="btn sm ghost" data-act="st-addstaff" data-comp="${esc(c.id)}">Add staff</button></div>
      </div>
    </section>`;
  }).join("") + `</div>`;
}

function dateVal(d){
  const dt = d?.toDate ? d.toDate() : new Date(d);
  return isNaN(dt) ? 9e15 : dt.getTime();
}
function fmtDate(d){
  const dt = d?.toDate ? d.toDate() : new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
}
const comp = () => S.comps.find(c=>c.id===S.compId) || {};

function useComp(id, quiet){
  if(S.compId===id) return;
  S.compId = id; S.staffing = S.all[id]; loadSignups(quiet);
}

function loadSignups(quiet){
  if(S.unsub){ S.unsub(); S.unsub=null; }
  const F = SF, id = S.compId;
  if(LIVE){
    S.signups = [];
    fb().then(({fs, D})=>{
      if(S.compId!==id) return;
      S.unsub = fs.onSnapshot(fs.query(fs.collection(D, COLL.judgeSignups), fs.where(F.competitionId,"==",id)),
        snap=>{ S.signups = snap.docs.map(d=>normSignup(d.id,d.data())); render(); },
        err=>{ console.error(err); toast("Couldn't load judge requests. Check the collection name in CONFIG.", false); });
    }).catch(err=>console.error(err));
  } else {
    S.signups = DEMO_SIGNUPS.filter(d=>d.competitionId===S.compId).map(d=>normSignup(d.id,d));
    if(!quiet) render();
  }
}

let saveTimer = null;
function setSave(t){ S.saveText = t; const el = document.getElementById("stfSave"); if(el) el.textContent = t; }
function save(now){
  delete S.staffing.unsaved;
  S.staffing.updatedAt = new Date().toISOString();
  const target = S.staffing, targetId = S.compId;
  setSave("Saving…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    try{
      if(LIVE){ const {fs, D} = await fb(); await fs.setDoc(fs.doc(D, COLL.staffing, targetId), target); }
      else DEMO_STAFF[targetId] = target;
      setSave("Saved");
    }catch(err){ console.error(err); setSave("Not saved"); toast("Save failed. Check your connection and try again.", false); }
  }, now?0:400);
}

/* ---------- Detail ---------- */
function pass(s){
  if(S.filter==="all") return true;
  if(S.filter==="vacant") return s.status==="vacant";
  return s.owner===S.filter;
}
function slotHTML(s){
  const who = s.status==="vacant" ? "Vacant" : s.status==="na" ? "Not needed" : esc(s.name);
  const sub = (s.status==="vacant"||s.status==="na") ? "" : [s.club, s.status==="pending"?"Awaiting confirmation":""].filter(Boolean).map(esc).join(", ");
  return `<button type="button" class="slot owner-${s.owner} st-${s.status}" data-act="st-slot" data-slot="${s.id}">
    <span class="role">${esc(s.role)} <span class="own">${s.owner==="NGL"?"NGL":"Host"}</span>${s.source==="judging-app"?'<span class="src">Judging app</span>':s.source==="pathway"?'<span class="src">Judging Pathway</span>':""}<span class="sdot"></span></span>
    <span class="who">${who}</span>${sub?`<span class="ssub">${sub}</span>`:""}
  </button>`;
}
function boardHTML(){
  const slots = S.staffing.slots, vis = slots.filter(pass);
  let html = "";
  const simple = g => {
    const a = vis.filter(s=>s.group===g);
    if(!a.length) return "";
    return `<div class="group"><h3>${GROUP_NAME[g]}</h3><div class="sgrid">${a.map(slotHTML).join("")}</div></div>`;
  };
  html += simple("control");
  const apps = [...new Set([...S.staffing.apparatus, ...slots.filter(s=>s.group==="station").map(s=>s.apparatus)])];
  const stations = apps.map(a=>{
    const all = slots.filter(s=>s.group==="station"&&s.apparatus===a);
    const v = all.filter(pass).sort((x,y)=>(isJudge(y)-isJudge(x))||x.role.localeCompare(y.role));
    if(!v.length && S.filter!=="all") return "";
    const filled = all.filter(s=>s.status!=="vacant").length;
    return `<div class="station"><header><strong>${esc(a)}</strong><span>${filled}/${all.length} filled</span></header>
      <div class="list">${v.map(slotHTML).join("")}<button type="button" class="addj" data-act="st-addjudge" data-app="${esc(a)}">Add another judge</button></div></div>`;
  }).join("");
  if(stations) html += `<div class="group"><h3>${GROUP_NAME.station}</h3><div class="stations">${stations}</div></div>`;
  html += simple("floor") + simple("other");
  return html || `<div class="card empty">Nothing matches this filter.</div>`;
}
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
const REQ_PILL = {pending:"warn", assigned:"ok", declined:"red"};
function requestsHTML(){
  const f = S.rfilter;
  const list = S.signups.filter(s => f==="all" || (f==="open" ? s.status==="pending" : s.status===f));
  if(!S.signups.length) return `<div class="card empty">No judges have applied for this competition through the judging app yet.</div>`;
  if(!list.length) return `<div class="card empty">Nothing in this list.</div>`;
  return list.map(s=>`
    <div class="req-card">
      <div class="rtop"><span class="name">${esc(s.name)}</span>${s.tier?`<span class="tier">${esc(s.tier)}</span>`:""}<span class="rpill">${pill(cap(s.status), REQ_PILL[s.status]||"")}</span></div>
      <div class="rsub">${[s.club,s.email,s.phone].filter(Boolean).map(esc).join(", ")}</div>
      ${s.apparatus.length?`<div class="apps">${s.apparatus.map(a=>`<span>${esc(a)}</span>`).join("")}</div>`:""}
      ${s.notes?`<div style="font-size:14px">${esc(s.notes)}</div>`:""}
      ${s.assignedRole?`<div class="assigned">Assigned: ${esc(s.assignedRole)}</div>`:""}
      <div class="actions">
        ${s.status!=="assigned"?`<button type="button" class="btn sm" data-act="st-assign" data-id="${esc(s.id)}">Assign to a role</button>`:""}
        <button type="button" class="btn sm ghost" data-act="st-editreq" data-id="${esc(s.id)}">Edit</button>
        ${s.status==="pending"?`<button type="button" class="btn sm ghost stf-danger" data-act="st-decline" data-id="${esc(s.id)}">Decline</button>`:""}
        ${s.status==="declined"?`<button type="button" class="btn sm ghost" data-act="st-reopen" data-id="${esc(s.id)}">Move back to waiting</button>`:""}
      </div>
    </div>`).join("");
}
function settingsHTML(){
  const st = S.staffing, d = (S.draft && S.draft.compId===S.compId) ? S.draft : {disc:st.discipline, jpp:st.judgesPerPiece, custom:st.customApparatus||""};
  const opt = (v, l) => `<option value="${v}" ${d.disc===v?"selected":""}>${l}</option>`;
  return `<div id="stfSettings">
    <div class="card panel">
      <h3>Apparatus for this competition</h3>
      <p>Sets which judge and camera stations appear on the board.</p>
      <div class="two">
        <label class="field"><span>Discipline</span><select id="stfDisc">
          ${opt("WAG","Women's (Vault, Bars, Beam, Floor)")}${opt("MAG","Men's (six pieces)")}${opt("Both","Women's and men's")}${opt("Custom","Custom list")}</select></label>
        <label class="field"><span>Judges per piece</span><input id="stfJpp" type="number" min="1" max="6" value="${esc(d.jpp)}"></label>
      </div>
      <div id="stfCustomWrap" ${d.disc==="Custom"?"":"hidden"}>
        <label class="field"><span>Custom apparatus (comma separated)</span><input id="stfCustom" placeholder="Floor, Vault, Tumble, Trampette" value="${esc(d.custom)}"></label>
      </div>
      <div class="btn-row"><button type="button" class="btn" data-act="st-apply">Apply and add missing roles</button></div>
      <p style="margin-top:10px">Applying never removes anyone already assigned. Remove unwanted stations from the board one role at a time.</p>
    </div>
    <div class="card panel">
      <h3>Start again</h3>
      <p>Clears every role and assignment for this competition and rebuilds the standard template. Judge requests stay in the judging app, and confirmed Judging Pathway judges are filled in again.</p>
      <button type="button" class="btn ghost stf-danger" data-act="st-reset">Reset this competition's staffing</button>
    </div></div>`;
}
function detailHTML(){
  const c = comp(), slots = S.staffing.slots;
  const count = o => { const a=slots.filter(s=>s.owner===o); return `${a.filter(s=>s.status!=="vacant").length}/${a.length}`; };
  const waiting = S.signups.filter(s=>s.status==="pending").length;
  const base = compHref(c.id);
  const tab = (k, label) => `<a role="tab" aria-selected="${S.tab===k}" class="${S.tab===k?"on":""}" href="${base}${k==="board"?"":"/"+k}">${label}</a>`;
  const body = S.tab==="requests"
    ? `<div class="stf-toolbar chips">${chip("st-rfilter","open","Waiting",S.rfilter)}${chip("st-rfilter","assigned","Assigned",S.rfilter)}${chip("st-rfilter","declined","Declined",S.rfilter)}${chip("st-rfilter","all","All",S.rfilter)}</div><div id="stfRequests">${requestsHTML()}</div>`
    : S.tab==="settings" ? settingsHTML()
    : `<div class="stf-toolbar">${chip("st-filter","all","All",S.filter)}${chip("st-filter","NGL","NGL",S.filter)}${chip("st-filter","Host","Host club",S.filter)}${chip("st-filter","vacant","Vacant",S.filter)}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-act="st-addstaff">Add staff</button>
        <div class="stf-menu">
          <button type="button" class="btn" id="stfExportBtn" data-act="st-export" aria-haspopup="true" aria-expanded="false">Export</button>
          <div class="stf-menu-list" id="stfExportMenu" hidden>
            <button type="button" data-act="st-exp" data-export="xlsx">Excel staffing sheet<small>.xlsx with contacts</small></button>
            <button type="button" data-act="st-exp" data-export="csv">CSV<small>For Sheets or mail merge</small></button>
            <button type="button" data-act="st-exp" data-export="print">Print or save as PDF<small>A4 sign-in sheet for the day</small></button>
            <button type="button" data-act="st-exp" data-export="hostEmail">Copy host club request<small>Lists the roles they still need to fill</small></button>
          </div>
        </div></div><div id="stfBoard">${boardHTML()}</div>`;
  return `<a class="btn ghost sm stf-back" href="#/admin/staffing">All competitions</a>
    <div class="comp-strip">
      <div><h2 id="stfCompName">${esc(c.name)}</h2><div class="meta">${esc([c.date&&fmtDate(c.date), c.venue].filter(Boolean).join(", "))}</div></div>
      <div class="tally">
        <div class="ngl"><b id="stfNgl">${count("NGL")}</b><span>NGL roles filled</span></div>
        <div class="host"><b id="stfHost">${count("Host")}</b><span>Host club roles filled</span></div>
        <div class="req"><b id="stfReq">${waiting}</b><span>Judge requests waiting</span></div>
      </div>
    </div>
    <nav class="sub" role="tablist">${tab("board","Staffing board")}${tab("requests",`Judge requests ${waiting?`<span class="stf-badge">${waiting}</span>`:""}`)}${tab("settings","Set-up")}</nav>
    ${body}`;
}

/* ---------- The screen ---------- */
export default async function staffing(me, parts = []){
  if(!S.loaded || S.stale){ S.loading = S.loading || load().finally(()=>{ S.loading = null; }); await S.loading; }
  const id = parts[0] ? decodeURIComponent(parts[0]) : null;
  let view, missing = false;
  if(id && S.all[id] && S.comps.some(c=>c.id===id)){
    if(S.detailId!==id){ S.detailId = id; S.draft = null; }   // opening a competition: Set-up shows its saved values
    useComp(id, true); S.staffing = S.all[id];
    S.tab = ["requests","settings"].includes(parts[1]) ? parts[1] : "board";
    view = detailHTML();
  } else {
    missing = !!id; S.detailId = null;
    view = overviewHTML();
  }
  return `<div class="stf" id="stfRoot">
    <div class="stf-status"><span class="pill ${LIVE?"ok":"amber"}">${LIVE?"Live":"Demo"}</span><span id="stfSave" aria-live="polite">${esc(S.saveText)}</span></div>
    ${pwIssuesHTML()}${loadErrHTML()}
    ${missing?`<div class="card empty" style="margin-bottom:14px">That competition isn't in the staffing list. Choose one below.</div>`:""}
    ${view}</div>`;
}
// Leaving the screen: stop listening, and read everything fresh next time it opens
document.addEventListener("ngl:rendered", ()=>{ if(S.loaded && !onScreen()){ stopSubs(); S.stale = true; } });

/* ---------- Dialog helper ---------- */
const BTN = {primary:"", ghost:"ghost", danger:"ghost stf-danger", green:"stf-green"};
function openDlg(title, body, buttons){
  const m = modal(`<div class="stf-dlg"><h2>${esc(title)}</h2><div class="stf-dlg-body">${body}</div><div class="stf-dlg-foot"><div class="left"></div></div></div>`);
  m.classList.add("stf-modal");
  const foot = m.querySelector(".stf-dlg-foot"), left = foot.querySelector(".left");
  buttons.forEach(b=>{
    const el = document.createElement("button"); el.type="button"; el.className="btn sm "+BTN[b.cls||"ghost"]; el.textContent=b.label;
    el.onclick = async ()=>{ const r = b.onClick ? await b.onClick() : true; if(r!==false) m.remove(); };
    (b.left?left:foot).appendChild(el);
  });
  m.addEventListener("keydown", e=>{ if(e.key==="Escape") m.remove(); });
  return m;
}
const val = id => document.getElementById(id)?.value.trim() ?? "";
const $ = s => document.querySelector(s);

/* ---------- Slot editing ---------- */
function addJudge(a){
  const n = S.staffing.slots.filter(s=>s.group==="station"&&s.apparatus===a&&isJudge(s)).length;
  S.staffing.slots.filter(s=>s.group==="station"&&s.apparatus===a&&s.role==="Judge").forEach(s=>s.role="Judge 1");
  S.staffing.slots.push(mk(`Judge ${n+1}`,"station",a,"Host")); save(); render();
}

function editSlot(id){
  const s = S.staffing.slots.find(x=>x.id===id); if(!s) return;
  openDlg(slotLabel(s), `
    <div class="two">
      <label class="field"><span>Role</span><input id="f_role" value="${esc(s.role)}"></label>
      <label class="field"><span>Responsibility</span><select id="f_owner"><option value="NGL">NGL</option><option value="Host">Host club</option></select></label>
    </div>
    <label class="field"><span>Name</span><input id="f_name" value="${esc(s.name)}" placeholder="Leave blank if vacant"></label>
    <div class="two">
      <label class="field"><span>Mobile</span><input id="f_phone" type="tel" value="${esc(s.phone)}"></label>
      <label class="field"><span>Email</span><input id="f_email" type="email" value="${esc(s.email)}"></label>
    </div>
    <div class="two">
      <label class="field"><span>Club</span><input id="f_club" value="${esc(s.club)}"></label>
      <label class="field"><span>Status</span><select id="f_status"><option value="pending">Awaiting confirmation</option><option value="confirmed">Confirmed</option></select></label>
    </div>
    <label class="field"><span>Notes</span><textarea id="f_notes">${esc(s.notes)}</textarea></label>
    ${s.source==="judging-app"?`<p class="stf-hint">Filled from the judging app. Clearing this role sends the judge back to waiting.</p>`:""}
    ${s.source==="pathway"?`<p class="stf-hint">Filled automatically from a confirmed Judging Pathway booking. Change the time or fee there and it updates here. If you clear or replace this person by hand, it won't be filled again.</p>`:""}`,
  [
    {label:"Remove role", cls:"danger", left:true, onClick:()=>{ if(!confirm(`Remove ${slotLabel(s)} from this competition?`)) return false; pwDetach(s); releaseSignup(s); S.staffing.slots = S.staffing.slots.filter(x=>x!==s); save(); render(); }},
    s.status==="na"
      ? {label:"Mark as needed", left:true, onClick:()=>{ s.status="vacant"; save(); render(); toast("Marked as needed"); }}
      : {label:"Not needed", cls:"green", left:true, onClick:()=>{ pwDetach(s); releaseSignup(s); Object.assign(s,{name:"",email:"",phone:"",club:"",status:"na",source:"",signupId:"",pwName:""}); save(); render(); toast("Marked not needed"); }},
    {label:"Clear person", left:true, onClick:()=>{ pwDetach(s); releaseSignup(s); Object.assign(s,{name:"",email:"",phone:"",club:"",status:"vacant",source:"",signupId:"",pwName:""}); save(); render(); }},
    {label:"Cancel"},
    {label:"Save", cls:"primary", onClick:()=>{
      const name = val("f_name");
      if(s.source==="pathway" && name!==s.pwName){ pwDetach(s); s.source=""; s.signupId=""; s.pwName=""; }
      Object.assign(s,{role:val("f_role")||s.role, owner:$("#f_owner").value, name, phone:val("f_phone"), email:val("f_email"), club:val("f_club"), notes:val("f_notes"),
        status: name ? $("#f_status").value : (s.status==="na" ? "na" : "vacant")});
      if(!name){ releaseSignup(s); s.source=""; s.signupId=""; }
      save(); render(); toast("Saved");
    }}
  ]);
  $("#f_owner").value = s.owner; $("#f_status").value = (s.status==="vacant"||s.status==="na")?"confirmed":s.status;
}
function releaseSignup(s){
  if(s.signupId && S.signups.some(x=>x.id===s.signupId)) updateSignup(s.signupId,{status:"pending",assignedRole:""}).catch(console.error);
}

function addStaffDlg(){
  const apps = S.staffing.apparatus;
  const m = openDlg(`Add staff: ${comp().name||""}`, `
    <label class="field"><span>Role</span><input id="n_role" list="n_presets" placeholder="Pick or type, e.g. First Aider"></label>
    <datalist id="n_presets">${STAFF_PRESETS.map(p=>`<option value="${esc(p)}">`).join("")}</datalist>
    <label class="field"><span>Name (optional)</span><input id="n_person" placeholder="Leave blank to add as vacant"></label>
    <div class="two">
      <label class="field"><span>Where it sits</span><select id="n_group">
        <option value="other">Additional staff</option><option value="control">Running the competition</option><option value="floor">Awards and runners</option><option value="station">At an apparatus</option></select></label>
      <label class="field"><span>Responsibility</span><select id="n_owner"><option value="Host">Host club</option><option value="NGL">NGL</option></select></label>
    </div>
    <div id="n_appWrap" hidden><label class="field"><span>Apparatus</span><select id="n_app">${apps.map(a=>`<option>${esc(a)}</option>`).join("")}</select></label></div>
    <label class="field"><span>How many</span><input id="n_qty" type="number" min="1" max="10" value="1"></label>`,
  [{label:"Cancel"},{label:"Add", cls:"primary", onClick:()=>{
    const role = val("n_role"); if(!role){ toast("Choose or type a role first.", false); return false; }
    const g = $("#n_group").value, q = Math.max(1, +$("#n_qty").value||1), person = val("n_person");
    for(let i=1;i<=q;i++){
      const s = mk(q>1?`${role} ${i}`:role, g, g==="station"?$("#n_app").value:"", $("#n_owner").value);
      if(person && i===1) Object.assign(s,{name:person, status:"confirmed"});
      S.staffing.slots.push(s);
    }
    save(); render(); toast(q>1?`Added ${q} ${role} roles`:`${role} added`);
  }}]);
  m.querySelector("#n_group").addEventListener("change", e=>{ m.querySelector("#n_appWrap").hidden = e.target.value!=="station"; });
}

/* ---------- Judge requests ---------- */
function assignReq(r){
  const judges = S.staffing.slots.filter(s=>isJudge(s));
  const pref = s => r.apparatus.some(a=>s.apparatus.toLowerCase().includes(a.toLowerCase()));
  judges.sort((a,b)=>((a.status!=="vacant")-(b.status!=="vacant")) || (pref(b)-pref(a)) || a.apparatus.localeCompare(b.apparatus));
  const others = S.staffing.slots.filter(s=>!isJudge(s) && (s.status==="vacant"||s.status==="na"));
  const opt = s => `<option value="${s.id}">${esc(slotLabel(s))}${s.status==="na"?" (marked not needed)":s.status!=="vacant"?" (currently "+esc(s.name)+")":""}${pref(s)?" ★":""}</option>`;
  openDlg(`Assign ${r.name}`, `
    <p class="stf-hint" style="margin:10px 0 0">${r.apparatus.length?"Asked for "+esc(r.apparatus.join(", "))+". Matching pieces are starred.":""}</p>
    <label class="field"><span>Role</span>
    <select id="a_slot"><optgroup label="Judging">${judges.map(opt).join("")}</optgroup>${others.length?`<optgroup label="Other vacant roles">${others.map(opt).join("")}</optgroup>`:""}</select></label>
    <label class="field"><span>Status</span><select id="a_status"><option value="confirmed">Confirmed</option><option value="pending">Awaiting confirmation</option></select></label>`,
  [{label:"Cancel"},{label:"Assign", cls:"primary", onClick:async ()=>{
    const s = S.staffing.slots.find(x=>x.id===$("#a_slot").value);
    if(s.status!=="vacant" && s.status!=="na" && !confirm(`${s.name} is already in ${slotLabel(s)}. Replace them?`)) return false;
    releaseSignup(s);
    Object.assign(s,{name:r.name,email:r.email,phone:r.phone,club:r.club,status:$("#a_status").value,source:"judging-app",signupId:r.id});
    save(); await updateSignup(r.id,{status:"assigned",assignedRole:slotLabel(s)}).catch(err=>{console.error(err);toast("Role saved, but the judging app wasn't updated.", false);});
    render(); toast(`${r.name} assigned`);
  }}]);
}

function editReq(r){
  openDlg(`Edit request`, `
    <label class="field"><span>Name</span><input id="r_name" value="${esc(r.name)}"></label>
    <div class="two">
      <label class="field"><span>Mobile</span><input id="r_phone" value="${esc(r.phone)}"></label>
      <label class="field"><span>Email</span><input id="r_email" value="${esc(r.email)}"></label>
    </div>
    <div class="two">
      <label class="field"><span>Club</span><input id="r_club" value="${esc(r.club)}"></label>
      <label class="field"><span>Status</span><select id="r_status"><option value="pending">Waiting</option><option value="assigned">Assigned</option><option value="declined">Declined</option></select></label>
    </div>
    <label class="field"><span>Apparatus (comma separated)</span><input id="r_app" value="${esc(r.apparatus.join(", "))}"></label>
    <label class="field"><span>Admin notes</span><textarea id="r_admin" placeholder="Only seen by the NGL team">${esc(r.adminNotes)}</textarea></label>
    <p class="stf-hint">Changes save back to the judging app. Tier${r.tier?" ("+esc(r.tier)+")":""} is managed there.</p>`,
  [{label:"Cancel"},{label:"Save changes", cls:"primary", onClick:async ()=>{
    const patch = {name:val("r_name"), phone:val("r_phone"), email:val("r_email"), club:val("r_club"), status:$("#r_status").value,
      apparatus: val("r_app").split(",").map(x=>x.trim()).filter(Boolean), adminNotes: val("r_admin")};
    try{ await updateSignup(r.id, patch); }catch(err){ console.error(err); toast("Couldn't save to the judging app.", false); return false; }
    const s = S.staffing.slots.find(x=>x.signupId===r.id);
    if(s){ Object.assign(s,{name:patch.name,phone:patch.phone,email:patch.email,club:patch.club}); save(); render(); }
    toast("Saved");
  }}]);
  $("#r_status").value = ["pending","assigned","declined"].includes(r.status) ? r.status : "pending";
}

/* ---------- Set-up ---------- */
// Keep what's typed in Set-up across redraws until Apply (the original page never redrew these fields)
document.addEventListener("input", e=>keepDraft(e));
document.addEventListener("change", e=>keepDraft(e));
function keepDraft(e){
  if(!e.target.closest || !e.target.closest("#stfSettings")) return;
  S.draft = {compId:S.compId, disc:$("#stfDisc").value, jpp:$("#stfJpp").value, custom:$("#stfCustom").value};
  if(e.target.id==="stfDisc") $("#stfCustomWrap").hidden = e.target.value!=="Custom";
}
function applyTpl(){
  const st = S.staffing;
  st.discipline = $("#stfDisc").value; st.customApparatus = val("stfCustom");
  st.judgesPerPiece = Math.min(6, Math.max(1, +$("#stfJpp").value||1));
  st.apparatus = apparatusFor(st.discipline, st.customApparatus);
  if(!st.apparatus.length){ toast("Add at least one apparatus.", false); return; }
  S.draft = null;
  const have = new Set(st.slots.map(slotKey)); let added = 0;
  templateSlots(st).forEach(s=>{
    if(s.role==="Judge 1" && have.has("Judge|"+s.apparatus)) return;
    if(!have.has(slotKey(s))){ st.slots.push(s); added++; }
  });
  save(); render(); toast(added ? `Added ${added} role${added>1?"s":""}` : "Nothing missing");
}
function resetStaffing(){
  if(!confirm("Clear every role and assignment for this competition?")) return;
  S.staffing.slots.forEach(releaseSignup);
  S.staffing.pwIgnored = [];
  S.staffing.apparatus = apparatusFor(S.staffing.discipline, S.staffing.customApparatus);
  S.staffing.slots = templateSlots(S.staffing); save(true); render(); toast("Staffing reset");
  setTimeout(pwReconcile, 800);
}

/* ---------- Export ---------- */
document.addEventListener("click", e=>{
  if(e.target.closest && e.target.closest("#stfExportBtn")) return;
  const m = document.getElementById("stfExportMenu"); if(!m) return;
  m.hidden = true; const b = document.getElementById("stfExportBtn"); if(b) b.setAttribute("aria-expanded","false");
});

const ROLE_RANK = {"Competition Manager":0,"Competition Scorer":1,"Announcer":2};
const roleRank = s => ROLE_RANK[s.role] ?? 9;
function sortedSlots(st){
  st = st || S.staffing;
  const ord = st.apparatus;
  return st.slots.slice().sort((a,b)=>
    (GROUP_ORDER[a.group]-GROUP_ORDER[b.group]) ||
    ((ord.indexOf(a.apparatus)+99)%(99+ord.length) - (ord.indexOf(b.apparatus)+99)%(99+ord.length)) ||
    (isJudge(b)-isJudge(a)) || (roleRank(a)-roleRank(b)) || a.role.localeCompare(b.role, undefined, {numeric:true}));
}
const HEAD = ["Area","Apparatus","Role","Responsibility","Name","Club","Mobile","Email","Status","Source","Notes"];
function rows(){
  return sortedSlots().map(s=>[GROUP_NAME[s.group], s.apparatus, s.role, s.owner==="NGL"?"NGL":"Host club", s.name, s.club, s.phone, s.email,
    s.status==="vacant"?"Vacant":s.status==="na"?"Not needed":s.status==="pending"?"Awaiting confirmation":"Confirmed", s.source==="judging-app"?"Judging app":s.source==="pathway"?"Judging Pathway":"", s.notes]);
}
const fileBase = () => `NGL_Staffing_${(comp().name||"Competition").replace(/[^\w]+/g,"_")}`;

function download(blob, name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function exportCsv(){
  const q = v => `"${String(v??"").replace(/"/g,'""')}"`;
  const csv = [HEAD, ...rows()].map(r=>r.map(q).join(",")).join("\r\n");
  download(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}), fileBase()+".csv"); toast("CSV downloaded");
}
// Same SheetJS build and CDN as the original page, loaded the first time it's needed
let xlsxLoad = null;
function loadXlsx(){
  if(window.XLSX) return Promise.resolve();
  return xlsxLoad = xlsxLoad || new Promise(res=>{
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = res; s.onerror = ()=>{ xlsxLoad = null; res(); }; document.head.appendChild(s);
  });
}
async function exportXlsx(){
  await loadXlsx();
  if(!window.XLSX){ toast("Excel export didn't load. Use CSV instead.", false); return; }
  const XLSX = window.XLSX, c = comp();
  const aoa = [[c.name],[[c.date&&fmtDate(c.date), c.venue].filter(Boolean).join(", ")],[`Exported ${new Date().toLocaleString("en-GB")}`],[],HEAD,...rows()];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [14,14,22,13,22,20,15,28,20,12,30].map(w=>({wch:w}));
  ws["!autofilter"] = {ref:`A5:K${aoa.length}`};
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Staffing");
  XLSX.writeFile(wb, fileBase()+".xlsx"); toast("Excel sheet downloaded");
}
function exportPrint(){
  const c = comp(); let last = "";
  const body = sortedSlots().map(s=>{
    const area = s.group==="station" ? s.apparatus : GROUP_NAME[s.group];
    const head = area!==last ? `<tr class="grp"><td colspan="7">${esc(area)}</td></tr>` : ""; last = area;
    return head+`<tr><td>${esc(s.role)}</td><td>${s.owner==="NGL"?"NGL":"Host"}</td><td>${s.status==="na"?"<em>Not needed</em>":(esc(s.name)||"<em>Vacant</em>")}</td><td>${esc(s.club)}</td><td>${esc(s.phone)}</td><td>${esc(s.notes)}</td><td class="sig"></td></tr>`;
  }).join("");
  // Same as the app's other print-outs: the sheet goes in #printArea and the rest of the app is hidden while printing
  let pa = document.getElementById("printArea");
  if(!pa){ pa = document.createElement("div"); pa.id = "printArea"; document.body.appendChild(pa); }
  pa.innerHTML = `<div class="stf-print"><h1>${esc(c.name)} staffing sheet</h1><div class="pmeta">${esc([c.date&&fmtDate(c.date), c.venue].filter(Boolean).join(", "))}</div>
    <table><thead><tr><th>Role</th><th>By</th><th>Name</th><th>Club</th><th>Mobile</th><th>Notes</th><th>Signed in</th></tr></thead><tbody>${body}</tbody></table></div>`;
  // A4 landscape for this sheet only (the invoice and calendars set their own)
  const pg = document.createElement("style"); pg.textContent = "@page{size:A4 landscape;margin:12mm}"; document.head.appendChild(pg);
  document.body.classList.add("printing");
  window.print();
  document.body.classList.remove("printing"); pg.remove();
}
async function copyHostRequest(){
  const c = comp(), need = sortedSlots().filter(s=>s.owner==="Host" && s.status==="vacant");
  if(!need.length){ toast("Every host club role is filled."); return; }
  const text = `Hi,\n\nFor ${c.name}${c.date?" on "+fmtDate(c.date):""}${c.venue?" at "+c.venue:""}, could you send us names and mobile numbers for the following roles:\n\n` +
    need.map(s=>"- "+slotLabel(s)).join("\n") + `\n\nThe NGL will provide the Competition Manager, Scorer and Camera Operators.\n\nThanks,\nNational Gymnastics League`;
  try{ await navigator.clipboard.writeText(text); toast("Request copied. Paste it into an email."); }
  catch(_){ openDlg("Host club request", `<label class="field"><span>Copy this into an email</span><textarea style="min-height:240px">${esc(text)}</textarea></label>`, [{label:"Close", cls:"primary"}]); }
}

/* ---------- Buttons (data-act="st-…") ---------- */
const sig = id => S.signups.find(x=>x.id===id);
export const ST = {
  'st-ov'(b){ S.ovFilter = b.dataset.f; render(); },
  'st-filter'(b){ S.filter = b.dataset.f; render(); },
  'st-rfilter'(b){ S.rfilter = b.dataset.f; render(); },
  'st-slot'(b){ if(b.dataset.comp) useComp(b.dataset.comp); editSlot(b.dataset.slot); },
  'st-addstaff'(b){ if(b.dataset.comp) useComp(b.dataset.comp); addStaffDlg(); },
  'st-addjudge'(b){ addJudge(b.dataset.app); },
  'st-assign'(b){ const r = sig(b.dataset.id); if(r) assignReq(r); },
  'st-editreq'(b){ const r = sig(b.dataset.id); if(r) editReq(r); },
  async 'st-decline'(b){ const r = sig(b.dataset.id); if(r && confirm(`Decline ${r.name} for this competition?`)){ await updateSignup(r.id,{status:"declined"}); toast("Declined"); } },
  async 'st-reopen'(b){ const r = sig(b.dataset.id); if(r){ await updateSignup(r.id,{status:"pending"}); toast("Moved back to waiting"); } },
  'st-apply'(){ applyTpl(); },
  'st-reset'(){ resetStaffing(); },
  'st-export'(){ const m = $("#stfExportMenu"); m.hidden = !m.hidden; $("#stfExportBtn").setAttribute("aria-expanded", String(!m.hidden)); },
  'st-exp'(b){ $("#stfExportMenu").hidden = true; ({xlsx:exportXlsx, csv:exportCsv, print:exportPrint, hostEmail:copyHostRequest})[b.dataset.export](); }
};
