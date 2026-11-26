// NGL Admin · General League Hub: view as gymnast. Copied word for word from GYMNASTICS-RESULTS/ngl-general-league-hub-demo.html
// as the Admin Hub opens it (?admin=1): search any gymnast, then see their General League Hub (Home, Stats, Comps, Card) exactly as
// their family will, read-only. Same wording, sums and card; only the shell, look and data layer changed.
// Data (same as the original):
//  - League results: the Elevien JSON files in the public GYMNASTICS-RESULTS repo (elevien-data-2027/, falling back to elevien-data/
//    for 2026), plus gymnast-names.xlsx, corrections.json and reassignments.json there. Same GitHub API / raw URLs, no token.
//  - Training League (boys' Profile Card): Firestore collections ngl_power_league and ngl_power_league_private, matched by the private
//    BG number. The original read them from saadi-rotation; this app reads the same collection names on its own database (staging in
//    the sandbox) through js/firebase.js.
//  - The NGL Profile Card drawing (ngl-player-card.js) and the Training League ratings (ngl-power-league-core.js) are copied below.
// ?demo: the original's made-up gymnasts and results, in memory; nothing is fetched or saved.
import { MODE } from '../data.js';
import { BRAND } from '../config.js';
import { esc as esc0, toast } from '../ui.js';

const DEMO = MODE === 'demo';
const ADMIN = !DEMO;   // the original's ?admin=1 wording (real results); sample data keeps the original demo wording
const BASE = '#/admin/gl-hub';
const redraw = () => window.NGL_RENDER && window.NGL_RENDER();
const esc = s => esc0(s);

var MAG = ["Floor","Pommel","Rings","Vault","Parallel Bars","High Bar"];
var WAG = ["Vault","Uneven Bars","Balance Beam","Floor"];

/* ═════════════════ Data model ═════════════════
   GYM[id] = {name, gender, discipline, level, club, results:{compId:{apparatus:score}}, videos:{compId:true}}
   COMPS   = [{id, name, date, venue}] oldest first */
var GYM = {}, COMPS = [], UPCOMING = null, competitions = [];
var DATA_LABEL = "";
const S = {loaded: null, error: '', query: '', photo: {}};

/* ── Demo data (all made up) ── */
function loadDemo(){
  DATA_LABEL = "DEMO · made-up gymnasts and results · nothing is saved";
  COMPS = [
    {id:"r1", name:"General League · Round 1", date:"2027-02-07", venue:"Hertfordshire"},
    {id:"r2", name:"General League · Round 2", date:"2027-03-21", venue:"East Midlands"},
    {id:"r3", name:"General League · Round 3", date:"2027-05-09", venue:"Hertfordshire"}
  ];
  UPCOMING = {name:"General League · Round 4", date:"2027-06-13", venue:"Hertfordshire", arrival:"08:15", warmup:"08:45", squad:"Squad 3", start:"Floor"};
  function res(list, rows){ var out = {}; COMPS.forEach(function(c, ci){ var m = {}; list.forEach(function(a, ai){ m[a] = rows[ci][ai]; }); out[c.id] = m; }); return out; }
  GYM["1000001"] = {name:"Oliver Hart", gender:"Boys", discipline:"MAG", level:"2", club:"Demo Gymnastics Club", linked:true,
    results:res(MAG, [[12.1,9.8,9.4,11.6,10.2,9.9],[12.4,10.3,9.7,11.9,10.6,10.1],[12.8,10.1,10.2,12.2,10.9,10.6]]), videos:{r3:true}};
  GYM["1000002"] = {name:"Maisie Hart", gender:"Girls", discipline:"WAG", level:"1", club:"Demo Gymnastics Club", linked:false,
    results:res(WAG, [[11.2,10.1,10.4,11.8],[11.5,10.4,10.9,12.1],[11.4,10.9,11.3,12.4]]), videos:{}};
  function seeded(n){ var x = Math.sin(n) * 10000; return x - Math.floor(x); }
  function peers(prefix, list, level, gender, base, count){
    for(var i = 0; i < count; i++){
      var rows = COMPS.map(function(c, ci){ return list.map(function(a, ai){ return Math.round((base + seeded(i*31 + ai*7 + ci*3 + Number(level)*11) * 3.2 - 0.6 + ci*0.15) * 10) / 10; }); });
      GYM[prefix + i] = {name:"", gender:gender, discipline:gender === "Boys" ? "MAG" : "WAG", level:level, club:"Club " + (i % 6 + 1), peer:true, results:res(list, rows), videos:{}};
    }
  }
  peers("pb", MAG, "2", "Boys", 9.2, 15); peers("pg", WAG, "1", "Girls", 9.6, 22);
  buildCompetitions();
  return Promise.resolve();
}

/* ── Real league data (admin preview) ── same sources the league table uses */
var GHR = {user:"Davidcbrooke", repo:"GYMNASTICS-RESULTS", branch:"main"};
var ADMIN_DIRS = ["elevien-data-2027", "elevien-data"];   // 2027 season first; falls back to 2026 until 2027 results exist
var API = "https://api.github.com/repos/" + GHR.user + "/" + GHR.repo + "/contents/";
var RAW = "https://raw.githubusercontent.com/" + GHR.user + "/" + GHR.repo + "/" + GHR.branch + "/";
var SITE = "https://davidcbrooke.github.io/GYMNASTICS-RESULTS/";
function cleanClub(c){ return String(c || "").split(",")[0].replace(/\s*\(\d+\)\s*$/, "").trim(); }
let xlsxLoad = null;
function loadXlsx(){
  if (window.XLSX) return Promise.resolve();
  return xlsxLoad = xlsxLoad || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = res; s.onerror = () => { xlsxLoad = null; rej(new Error('Spreadsheet reader didn’t load')); }; document.head.appendChild(s);
  });
}
function loadAdmin(){
  var names = {}, corrections = {}, reassign = {};
  function json(path){ return fetch(RAW + path).then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; }); }
  var side = Promise.all([
    loadXlsx().then(function(){ return fetch(API + "gymnast-names.xlsx?ref=" + GHR.branch); }).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){
      var buf = Uint8Array.from(atob(d.content.replace(/\n/g, "")), function(c){ return c.charCodeAt(0); });
      var wb = XLSX.read(buf, {type:"array"});
      XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:""}).forEach(function(r){
        var id = String(r["Mid"] || r["BG Number"] || r["Member ID"] || "").trim();
        var nm = (String(r["FirstName"] || r["First Name"] || "").trim() + " " + String(r["LastName"] || r["Last Name"] || "").trim()).trim();
        if(id && nm) names[id] = nm;
      });
    }).catch(function(){}),
    json("corrections.json").then(function(d){ corrections = d || {}; }),
    json("reassignments.json").then(function(d){ reassign = d || {}; })
  ]);
  function tryDir(i){
    if(i >= ADMIN_DIRS.length) return Promise.reject(new Error("No league results found yet"));
    var dir = ADMIN_DIRS[i];
    return fetch(API + dir + "?ref=" + GHR.branch).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(files){
      var jf = files.filter(function(f){ return f.type === "file" && /\.json$/i.test(f.name) && !/unavailable/i.test(f.name); });
      if(!jf.length) throw 0;
      return Promise.all(jf.map(function(f){ return fetch(RAW + dir + "/" + f.name).then(function(r){ return r.json(); }).catch(function(){ return null; }); }))
        .then(function(list){ return {dir:dir, comps:list.filter(Boolean)}; });
    }).catch(function(){ return tryDir(i + 1); });
  }
  return Promise.all([tryDir(0), side]).then(function(out){
    var data = out[0];
    GYM = {}; COMPS = [];
    DATA_LABEL = "ADMIN PREVIEW · real results from " + (data.dir === "elevien-data" ? "the 2026 season" : "the 2027 season") + " · read-only";
    data.comps.sort(function(a, b){ return String(a.date).localeCompare(String(b.date)); });
    data.comps.forEach(function(raw, ci){
      var cid = "c" + ci;
      COMPS.push({id:cid, name:raw.name || ("Competition " + (ci + 1)), date:raw.date || "", venue:raw.region || ""});
      (raw.sheets || []).forEach(function(sh){
        (sh.entries || []).forEach(function(e){
          var id = String(e.memberId || "").trim(); if(!id) return;
          if(reassign[id]) id = reassign[id];
          var s = parseFloat(e.score); if(isNaN(s)) return;
          var c = corrections[id] || {};
          var gender = c.gender || e.gender || "", level = String(c.level || e.level || "").toUpperCase();
          var g = GYM[id] || (GYM[id] = {name:names[id] || e.name || "", gender:gender, discipline:/boy/i.test(gender) ? "MAG" : "WAG", level:level, club:cleanClub(e.club), results:{}, videos:{}});
          if(!g.name && names[id]) g.name = names[id];
          (g.results[cid] || (g.results[cid] = {}))[sh.apparatus] = s;
        });
      });
    });
    buildCompetitions();
  });
}

// Shape GYM like the league pages so the Profile Card works unchanged
function buildCompetitions(){
  competitions = COMPS.map(function(c){
    var byApp = {};
    Object.keys(GYM).forEach(function(id){
      var g = GYM[id], r = g.results[c.id]; if(!r) return;
      Object.keys(r).forEach(function(app){ (byApp[app] || (byApp[app] = [])).push({memberId:id, gender:g.gender, level:g.level, club:g.club, score:r[app]}); });
    });
    return {name:c.name, date:c.date, displayDate:c.date, sheets:Object.keys(byApp).map(function(a){ return {apparatus:a, entries:byApp[a]}; })};
  });
}
function getName(id){ return GYM[id] && !GYM[id].peer ? displayName(id) : ""; }

/* ═════════════════ Helpers ═════════════════ */
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dateBits(d){ return {d:Number(String(d).slice(8, 10)) || "", m:MONTHS[Number(String(d).slice(5, 7)) - 1] || ""}; }
function compsOf(g){ return COMPS.filter(function(c){ return g.results[c.id]; }); }
function apps(g){
  var seen = {}; compsOf(g).forEach(function(c){ Object.keys(g.results[c.id]).forEach(function(a){ seen[a] = 1; }); });
  var order = g.discipline === "MAG" ? MAG : WAG;
  return order.filter(function(a){ return seen[a]; }).concat(Object.keys(seen).filter(function(a){ return order.indexOf(a) < 0; }));
}
function best(g){ var out = {}; apps(g).forEach(function(a){ compsOf(g).forEach(function(c){ var v = g.results[c.id][a]; if(v != null && (out[a] == null || v > out[a])) out[a] = v; }); }); return out; }
function total(b){ return Object.keys(b).reduce(function(t, k){ return t + b[k]; }, 0); }
function compTotal(g, cid){ var r = g.results[cid] || {}; return Object.keys(r).reduce(function(t, k){ return t + r[k]; }, 0); }
function field(g){ return Object.keys(GYM).map(function(k){ return GYM[k]; }).filter(function(p){ return p.gender === g.gender && p.level === g.level; }); }
function leaguePos(id){ var me = GYM[id], f = field(me), mine = total(best(me)); return {pos:f.filter(function(p){ return total(best(p)) > mine; }).length + 1, of:f.length}; }
function compPlace(id, cid){ var me = GYM[id], f = field(me).filter(function(p){ return p.results[cid]; }), mine = compTotal(me, cid); return {pos:f.filter(function(p){ return compTotal(p, cid) > mine; }).length + 1, of:f.length}; }
function ord(n){ var s = ["th","st","nd","rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function displayName(id){ return GYM[id].name || (/^\d+$/.test(id) ? "BG " + id : String(id).replace(/^\d+\s+/, "")); }
function bgLabel(id){ return /^\d+$/.test(id) ? "BG " + id : "no BG number"; }
function firstName(id){ return GYM[id].name ? GYM[id].name.split(" ")[0] : displayName(id); }
function levelLabel(g){ return g.discipline + " Level " + g.level; }
const hubLink = (id, tab) => BASE + '/' + encodeURIComponent(id) + (tab ? '/' + tab : '');

/* ═════════════════ Screens ═════════════════ */
/* ── Admin: search any gymnast, then view their hub ── */
function searchScreen(){
  return '<div class="gh-col"><div class="gh-eyebrow">NGL Admin</div><h2 class="gh-title">View as gymnast</h2>'
  + '<p class="lead">Search by name, BG number or club, then open their hub exactly as their family will see it. Read-only: no emails are sent and nothing is changed.</p>'
  + '<div class="card gh-card"><label class="field" style="margin:0"><span>Search gymnasts</span><input id="ghQ" type="text" autocomplete="off" placeholder="Name, BG number or club" value="' + esc(S.query) + '"></label></div>'
  + '<div id="ghResults">' + searchResults() + '</div></div>';
}
function searchResults(){
  var t = S.query.trim().toLowerCase();
  var ids = Object.keys(GYM).filter(function(id){ var g = GYM[id]; if(g.peer) return false; return !t || id.indexOf(t) >= 0 || (g.name || "").toLowerCase().indexOf(t) >= 0 || (g.club || "").toLowerCase().indexOf(t) >= 0; });
  ids.sort(function(a, b){ return displayName(a).localeCompare(displayName(b)); });
  var shown = ids.slice(0, 60);
  return '<div class="gh-sec" style="margin-top:4px"><h2>' + ids.length + ' gymnast' + (ids.length === 1 ? "" : "s") + '</h2>' + (ids.length > 60 ? '<span class="gh-muted" style="font-size:13px">showing 60, refine the search</span>' : "") + '</div>'
    + shown.map(function(id){ var g = GYM[id]; return '<a class="card gh-pick" href="' + esc(hubLink(id)) + '" data-view="' + esc(id) + '"><b>' + esc(displayName(id)) + '</b><small>' + esc(g.club) + ' · ' + esc(levelLabel(g)) + ' · ' + esc(bgLabel(id)) + '</small></a>'; }).join("");
}

function upcomingCard(compact){
  if(!UPCOMING) return '<div class="card gh-card"><p class="gh-muted" style="margin:0">No upcoming competition yet. It will appear here as soon as their club enters them.</p></div>';
  var bd = dateBits(UPCOMING.date);
  if(compact) return '<div class="card gh-card"><div class="gh-comp"><div class="gh-date"><div class="d">' + bd.d + '</div><div class="m">' + bd.m + '</div></div><div>'
    + '<h3>' + esc(UPCOMING.name) + '</h3><div class="gh-muted" style="font-size:14px">' + esc(UPCOMING.venue) + ' · arrive ' + esc(UPCOMING.arrival) + '</div>'
    + '<div style="margin-top:8px"><span class="gh-pill gl">' + esc(UPCOMING.squad) + '</span><span class="gh-pill">Starts on ' + esc(UPCOMING.start) + '</span></div></div></div></div>';
  return '<div class="card gh-card gh-accent"><div class="gh-comp"><div class="gh-date"><div class="d">' + bd.d + '</div><div class="m">' + bd.m + '</div></div><div>'
    + '<h3>' + esc(UPCOMING.name) + '</h3><p style="margin:0;font-size:14px">' + esc(UPCOMING.venue) + '<br>Arrive ' + esc(UPCOMING.arrival) + ' · warm-up ' + esc(UPCOMING.warmup) + '<br>' + esc(UPCOMING.squad) + ', starts on ' + esc(UPCOMING.start) + '</p></div></div></div>';
}

function homeScreen(id){
  var g = GYM[id], b = best(g), lp = leaguePos(id);
  var top = Object.keys(b).sort(function(x, y){ return b[y] - b[x]; }).slice(0, 4);
  return '<div class="card gh-card"><div class="gh-eyebrow">' + (ADMIN ? "General League" : "2027 General League") + '</div><h2 class="gh-name">' + esc(displayName(id)) + '</h2>'
  +   '<div><span class="gh-pill gl">' + esc(levelLabel(g)) + '</span><span class="gh-pill">' + esc(g.club) + '</span></div></div>'
  + '<div class="card gh-card gh-accent"><div class="gh-eyebrow">League position · ' + esc(levelLabel(g)) + '</div>'
  +   '<div class="gh-bigpos"><span class="n">' + ord(lp.pos) + '</span><span>of ' + lp.of + ' gymnasts</span></div>'
  +   '<p style="margin:8px 0 0">All-around total ' + total(b).toFixed(3) + ' from best scores on each apparatus.</p></div>'
  + '<div class="gh-sec"><h2>Best scores</h2><a href="' + esc(hubLink(id, 'stats')) + '">See progress</a></div>'
  + '<div class="gh-stats">' + top.map(function(app){ return '<div class="gh-stat"><div class="k">' + esc(app) + '</div><div class="v">' + b[app].toFixed(3) + '</div></div>'; }).join("") + '</div>'
  + '<div class="gh-sec"><h2>Next competition</h2></div>' + upcomingCard(true);
}

var COLOURS = ["#0073b3","#c98a00","#00968f","#d6336c","#7c5cd6","#4c9a2a"];   // the original's six line colours, darkened for a white card
function graph(g){
  var a = apps(g), cs = compsOf(g), W = 520, H = 240, L = 44, R = 44, T = 14, B = 40;
  var all = []; cs.forEach(function(c){ a.forEach(function(app){ var v = g.results[c.id][app]; if(v != null) all.push(v); }); });
  if(!all.length) return '<p class="gh-muted">No scores yet.</p>';
  var lo = Math.floor(Math.min.apply(null, all) - 0.5), hi = Math.ceil(Math.max.apply(null, all) + 0.5);
  var X = function(i){ return cs.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (cs.length - 1); }, Y = function(v){ return T + (hi - v) / (hi - lo) * (H - T - B); };
  var s = '<svg class="gh-graph" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Scores across the season">';
  for(var v = lo; v <= hi; v++){ s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e4e3ee"/><text x="' + (L - 8) + '" y="' + (Y(v) + 5) + '" fill="#5f5b80" font-size="15" text-anchor="end">' + v + '</text>'; }
  cs.forEach(function(c, i){ var d = dateBits(c.date); s += '<text x="' + X(i) + '" y="' + (H - 10) + '" fill="#5f5b80" font-size="15" text-anchor="middle">' + (ADMIN ? (d.d + " " + d.m) : ("Round " + (i + 1))) + '</text>'; });
  a.forEach(function(app, ai){
    var pts = []; cs.forEach(function(c, i){ var v = g.results[c.id][app]; if(v != null) pts.push([X(i), Y(v)]); });
    if(pts.length > 1) s += '<polyline points="' + pts.map(function(p){ return p.join(","); }).join(" ") + '" fill="none" stroke="' + COLOURS[ai % 6] + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    pts.forEach(function(p){ s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + COLOURS[ai % 6] + '"/>'; });
  });
  return s + '</svg><div class="gh-legend">' + a.map(function(app, ai){ return '<span><i style="background:' + COLOURS[ai % 6] + '"></i>' + esc(app) + '</span>'; }).join("") + '</div>';
}

function statsScreen(id){
  var g = GYM[id], b = best(g), lp = leaguePos(id), cs = compsOf(g), latest = cs.length ? g.results[cs[cs.length - 1].id] : {};
  return '<div class="card gh-card"><div class="gh-eyebrow">Progress this season</div>' + graph(g) + '</div>'
  + '<div class="gh-stats" style="margin-bottom:14px">'
  +   '<div class="gh-stat"><div class="k">All-around</div><div class="v">' + total(b).toFixed(3) + '</div></div>'
  +   '<div class="gh-stat"><div class="k">League position</div><div class="v">' + ord(lp.pos) + ' <span class="gh-muted" style="font-size:14px">of ' + lp.of + '</span></div></div>'
  + '</div>'
  + (isBoy(id) ? plStats(id) : '')
  + '<div class="card gh-card"><div class="gh-eyebrow">Best per apparatus</div><table class="gh-best">'
  + Object.keys(b).map(function(app){ var pb = cs.length > 1 && latest[app] === b[app]; return '<tr><td>' + esc(app) + (pb ? ' <span class="gh-pill gh-pb">PB last comp</span>' : '') + '</td><td>' + b[app].toFixed(3) + '</td></tr>'; }).join("")
  + '</table></div>';
}

function compsScreen(id){
  var g = GYM[id], cs = compsOf(g);
  var done = cs.slice().reverse().map(function(c){
    var d = dateBits(c.date), place = compPlace(id, c.id), r = g.results[c.id];
    return '<div class="card gh-card"><div class="gh-comp"><div class="gh-date"><div class="d">' + d.d + '</div><div class="m">' + d.m + '</div></div><div style="flex:1;min-width:0">'
      + '<h3>' + esc(c.name) + '</h3><div class="gh-muted" style="font-size:14px">' + (c.venue ? esc(c.venue) + ' · ' : '') + esc(levelLabel(g)) + '</div>'
      + '<div style="margin-top:8px"><span class="gh-pill gl">' + ord(place.pos) + ' of ' + place.of + '</span><span class="gh-pill">' + compTotal(g, c.id).toFixed(3) + '</span>' + (g.videos[c.id] ? '<button class="gh-pill gh-vid" data-act="gh-video">▶ Videos</button>' : '') + '</div>'
      + '<div class="gh-scores">' + apps(g).filter(function(a){ return r[a] != null; }).map(function(app){ return '<div>' + esc(app) + '<b>' + r[app].toFixed(3) + '</b></div>'; }).join("") + '</div>'
      + '</div></div></div>';
  }).join("");
  return '<div class="gh-sec" style="margin-top:0"><h2>Coming up</h2></div>' + upcomingCard(false)
  + '<div class="gh-sec"><h2>Competitions entered</h2><span class="gh-muted" style="font-size:13px">' + cs.length + '</span></div>' + done;
}

const cardTools = '<canvas class="gh-canvas" id="ghCanvas" width="1200" height="1720" aria-label="NGL Profile Card"></canvas>'
  + '<div class="gh-cardbtns"><button class="btn ghost sm" data-act="gh-photo">Add photo</button><button class="btn sm" data-act="gh-save">Save card</button></div>'
  + '<input type="file" accept="image/*" id="ghPhotoIn" hidden aria-label="Photo for the card">';
function cardScreen(id){
  if(isBoy(id)) return cardBoy(id);
  var c = buildCard(id);
  return cardTools
  + '<div class="card gh-card"><div class="gh-eyebrow">How the ratings work</div>'
  +   '<p class="gh-muted" style="font-size:14px">Each apparatus gets a rating from where ' + esc(firstName(id)) + '\'s best score sits among ' + esc(levelLabel(GYM[id])) + ' gymnasts this season. Those feed the six skills below. The card updates after every competition.</p>'
  +   '<div class="gh-stats">' + ATTRS.map(function(at){ return '<div class="gh-stat"><div class="k">' + at.key + ' · ' + at.label + '</div><div class="v">' + (c && c.attrs[at.key] != null ? c.attrs[at.key] : "–") + '</div></div>'; }).join("") + '</div>'
  + '</div>'
  + '<div class="gh-foot">Photos stay on this device. They are never uploaded or saved by NGL.</div>';
}
function cardBoy(id){
  var e = plFor(id);
  return cardTools
  + '<div class="card gh-card"><div class="gh-eyebrow">Training League</div>'
  + (e ? '<p class="gh-muted" style="font-size:14px">' + esc(firstName(id)) + '\'s card is built from the Training League: 13 strength, speed and power challenges filmed in training. Each stat is rated out of 99 against gymnasts of the same gender, age group and training hours.</p>'
       + '<p style="font-weight:800;margin-bottom:10px">' + plPosLine(e) + '</p>' + plTable(e, id)
       : '<p class="gh-muted" style="font-size:14px">' + esc(firstName(id)) + '\'s NGL Profile Card is built from the Training League: 13 strength, speed and power challenges their coach films in training. It fills in as soon as his first results are checked.' + (PL.note ? ' ' + esc(PL.note) : '') + '</p>')
  + '<a class="btn ghost sm" href="' + PL_URL + '" target="_blank" rel="noopener" style="margin-top:12px">See the Training League table</a></div>'
  + '<div class="gh-foot">Photos stay on this device. They are never uploaded or saved by NGL.</div>';
}
function currentCard(id){ var card = isBoy(id) ? plCard(id) : buildCard(id); if(card && !isBoy(id)) card.season = ADMIN ? "" : 2027; return card; }
function drawCard(){
  const cv = document.getElementById('ghCanvas'), id = cv && cv.dataset.id; if(!cv || !GYM[id]) return;
  var card = currentCard(id); if(!card) return;
  draw(cv, card, S.photo[id] || null);
}

/* ── Training League (boys) ──
   For boys the NGL Profile Card comes from the Training League challenges, not from competition scores.
   Demo: made-up results. Admin preview: real Training League results, matched by the private BG number
   (only readable when signed in to NGL Admin with Training League or Results access). */
var PL = {ready:false, loading:null, byGym:{}, list:[], note:""};
function isBoy(id){ return GYM[id] && GYM[id].discipline === "MAG"; }
function plFor(id){ return PL.byGym[id] || null; }
function demoPL(){
  function seeded(n){ var x = Math.sin(n * 9.17) * 10000; return x - Math.floor(x); }
  var base = {sprint:2.3, jump:175, tuck:22, push:20, pull:8, chin:10, dips:9, muscle:4, rope:14, splits:20, mush:12, vsit:25, hand:9};
  var list = [];
  for(var i = 0; i < 12; i++){
    var r = {};
    Object.keys(base).forEach(function(k, j){
      var f = i ? 0.7 + seeded(i * 13 + j) * 0.6 : 1.12 + seeded(j) * 0.12, v = (k === "sprint" || k === "rope") ? base[k] / f : Math.round(base[k] * f);
      r[k] = {best: (k === "sprint" || k === "rope") ? Math.round(v * 100) / 100 : v, date: "2027-0" + (2 + i % 4) + "-1" + (i % 9)};
    });
    list.push({id:"d" + i, first: i ? "Boy" : "Oliver", init: i ? String.fromCharCode(65 + i) : "H", club: i ? "Club " + (i % 6 + 1) : "Demo Gymnastics Club", level:"2", age:"9-11", hrs:"2-5", results:r});
  }
  PLK.rate(list); PL.list = list; PL.byGym["1000001"] = list[0];
}
async function loadPLAdmin(){
  try {
    const { fb } = await import('../firebase.js');
    const { fs, D } = await fb();
    const snaps = await Promise.all([fs.getDocs(fs.collection(D, "ngl_power_league")), fs.getDocs(fs.collection(D, "ngl_power_league_private"))]);
    PL.list = snaps[0].docs.map(function(d){ var o = d.data(); o.id = d.id; return o; }); PLK.rate(PL.list);
    var byId = {}; PL.list.forEach(function(e){ byId[e.id] = e; });
    snaps[1].docs.forEach(function(d){ var bg = String(d.data().bg || ""); if(bg && byId[d.id]) PL.byGym[bg] = byId[d.id]; });
  } catch (e) { console.warn("Training League not loaded", e); PL.note = "Training League results couldn't be loaded here."; }
}
function plTable(e, id){
  return '<table class="gh-best gh-pl">' + PLK.CH.map(function(c){ var r = e.results && e.results[c.k];
    return '<tr><td>' + esc(PLK.chName(c, e.age)) + '</td><td>' + (r && r.best != null ? PLK.fmt(r.best, c) + ' <span class="gh-muted" style="font-size:13px">' + PLK.chUnit(c, e.age) + '</span>' : '<span class="gh-muted">–</span>') + '</td><td style="width:56px;text-align:right">' + (e.ch[c.k] || '<span class="gh-muted">–</span>') + '</td></tr>'; }).join("") + '</table>';
}
function plStats(id){
  var e = plFor(id);
  return '<div class="card gh-card"><div class="gh-eyebrow">Training League</div>'
    + (e ? '<div class="gh-stats" style="margin-bottom:12px"><div class="gh-stat"><div class="k">OVR</div><div class="v">' + e.ovr + '</div></div><div class="gh-stat"><div class="k">League position</div><div class="v" style="font-size:16px">' + plPosLine(e) + '</div></div></div>'
         + '<div class="gh-stats gh-stats3" style="margin-bottom:12px">' + PLK.STATS.map(function(k){ return '<div class="gh-stat"><div class="k">' + k + '</div><div class="v">' + e.stats[k] + '</div></div>'; }).join("") + '</div>' + plTable(e, id)
         : '<p class="gh-muted" style="font-size:14px;margin:0">No Training League results yet.' + (PL.note ? ' ' + esc(PL.note) : '') + '</p>')
    + '</div>';
}
function plPosLine(e){ var lp = PLK.leaguePos(PL.list, e); return lp.pos ? ord(lp.pos) + ' of ' + lp.of + ' · ' + esc(e.age) + ' · ' + esc(e.hrs) + ' hrs' : 'Not ranked yet'; }
var PL_URL = SITE + "ngl-training-league.html";
function plCard(id){
  var e = plFor(id), g = GYM[id];
  if(e){ var c = PLK.cardFor(e); c.name = displayName(id); c.club = g.club || c.club; c.season = "TRAINING LEAGUE"; return c; }
  var blank = {}; PLK.STATS.forEach(function(k){ blank[k] = null; });
  return {name:displayName(id), club:g.club, level:g.level, discipline:"MAG", overall:"–", attrs:blank, tier:"bronze", season:"TRAINING LEAGUE"};
}

/* ═════════════════ Training League ratings (copied from ngl-power-league-core.js: the parts this screen uses) ═════════════════ */
const PLK = (function(){
  /* Challenges. dir: 1 = higher is better, -1 = lower is better. off: added before rating (pike reach can be below the toes). */
  const CH = [
    {k:'sprint', n:'10m Sprint', stat:'SPD', unit:'s', dir:-1, step:0.01},
    {k:'jump', n:'Standing Long Jump', stat:'POW', unit:'cm', dir:1, step:1},
    {k:'tuck', n:'Tuck Jumps in 30s', stat:'POW', unit:'reps', dir:1, step:1},
    {k:'push', n:'Push-ups in 30s', stat:'STR', unit:'reps', dir:1, step:1},
    {k:'pull', n:'Pull-ups', stat:'STR', unit:'reps', dir:1, step:1},
    {k:'chin', n:'Chin-ups', stat:'STR', unit:'reps', dir:1, step:1},
    {k:'dips', n:'Max Dips', stat:'STR', unit:'reps', dir:1, step:1},
    {k:'muscle', n:'Muscle-ups on Rings in 1 min', stat:'STR', unit:'reps', dir:1, step:1},
    {k:'rope', n:'5m Straddle Rope Climb', stat:'STR', unit:'s', dir:-1, step:0.01},
    {k:'splits', n:'Oversplit Blocks', stat:'FLX', unit:'cm', dir:1, step:1},
    {k:'mush', n:'Mushroom Circles in 30s', stat:'CTL', unit:'reps', dir:1, step:1},
    {k:'vsit', n:'V-Sit Hold on Beam', stat:'BAL', unit:'s', dir:1, step:1},
    {k:'hand', n:'Handstand Hold', stat:'CTL', unit:'s', dir:1, step:1}
  ];
  const STATS = ['SPD','POW','STR','FLX','BAL','CTL'];
  /* One set of rules for every age. nLow/unitLow (an easier version for ages 6–11) are not used at present. */
  const young = age => age === '6-8' || age === '9-11';
  const chName = (c, age) => (c.nLow && young(age)) ? c.nLow : c.n;
  const chUnit = (c, age) => (c.unitLow && young(age)) ? c.unitLow : c.unit;
  const fmt = (v, c) => v == null ? '—' : (c.step < 1 ? (+v).toFixed(2) : String(+v));
  /* Boys and girls have separate leagues. Older entries with no gender are boys. */
  const genOf = g => g.gender === 'Girls' ? 'Girls' : 'Boys';
  const group = g => `${genOf(g)}|${g.age}|${g.hrs}`;
  /* Per challenge, the best valid result in the gymnast's group (same gender, age group and training hours) rates 99;
     everyone else is rated in proportion to it. A missing challenge rates 0. A stat is the average of its
     challenges; OVR is the average of the six stats. */
  function rate(list){
    const best = {};
    list.forEach(g => CH.forEach(c => {
      const r = g.results && g.results[c.k]; if(!r || r.best == null) return;
      const key = group(g) + '|' + c.k, v = +r.best + (c.off || 0);
      if(c.dir < 0 ? v <= 0 : v < 0) return;
      if(best[key] == null || (c.dir > 0 ? v > best[key] : v < best[key])) best[key] = v;
    }));
    list.forEach(g => {
      g.ch = {}; g.stats = {};
      CH.forEach(c => {
        const r = g.results && g.results[c.k], b = best[group(g) + '|' + c.k];
        if(!r || r.best == null || !b){ g.ch[c.k] = 0; return; }
        const v = +r.best + (c.off || 0);
        g.ch[c.k] = Math.max(1, Math.min(99, Math.round(c.dir > 0 ? 99 * v / b : 99 * b / v)));
      });
      STATS.forEach(s => { const cs = CH.filter(c => c.stat === s); g.stats[s] = Math.round(cs.reduce((a, c) => a + g.ch[c.k], 0) / cs.length); });
      g.ovr = Math.round(STATS.reduce((a, s) => a + g.stats[s], 0) / STATS.length);
      g.done = CH.filter(c => g.results && g.results[c.k] && g.results[c.k].best != null).length;
    });
  }
  const nameOf = g => `${g.first} ${g.init}.`;
  const tierOf = ovr => ovr >= 80 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze';
  function cardFor(g){
    return {name: nameOf(g), club: g.club || '', level: '', discipline: genOf(g) === 'Girls' ? 'WAG' : 'MAG', overall: g.ovr || 0,
      attrs: Object.assign({}, g.stats), tier: tierOf(g.ovr || 0), season: 'TRAINING LEAGUE'};
  }
  function leaguePos(list, g){
    const peers = list.filter(x => x.done && group(x) === group(g)).sort((a, b) => b.ovr - a.ovr);
    return {pos: peers.indexOf(g) + 1, of: peers.length};
  }
  return {CH, STATS, chName, chUnit, fmt, rate, cardFor, leaguePos};
})();

/* ═════════════════ NGL Profile Card (copied from ngl-player-card.js: build and draw) ═════════════════
   - Each piece gets a rating (50–99) from where the gymnast's BEST score on that piece sits among gymnasts of the same
     gender and level in the loaded competitions (falls back to same gender, then to the raw score, when there are too few).
   - Each piece feeds the six attributes in fixed proportions (PIECE_WEIGHTS). Overall = average of the piece ratings.
   Photos chosen on the card stay in the browser; nothing is uploaded or saved. */
var ATTRS = [
  {key:"SPD", label:"Speed"}, {key:"POW", label:"Power"}, {key:"STR", label:"Strength"},
  {key:"FLX", label:"Flexibility"}, {key:"BAL", label:"Balance"}, {key:"CTL", label:"Control"}
];
var PIECE_WEIGHTS = [
  {match:/vault/i,              short:"VT",  w:{SPD:.5, POW:.4, CTL:.1}},
  {match:/floor/i,              short:"FX",  w:{POW:.35, FLX:.35, CTL:.15, BAL:.15}},
  {match:/beam/i,               short:"BB",  w:{BAL:.55, CTL:.25, FLX:.2}},
  {match:/uneven|^bars$/i,      short:"UB",  w:{STR:.45, CTL:.3, FLX:.1, SPD:.15}},
  {match:/pommel/i,             short:"PH",  w:{CTL:.45, STR:.3, BAL:.25}},
  {match:/rings/i,              short:"SR",  w:{STR:.7, CTL:.3}},
  {match:/parallel/i,           short:"PB",  w:{STR:.45, BAL:.3, CTL:.25}},
  {match:/high bar/i,           short:"HB",  w:{STR:.4, POW:.3, SPD:.15, CTL:.15}}
];
var PATHWAY = ["#E8559A","#F8D438","#E88230","#0071B3","#01AFB8","#3BAA4A","#7A4C9E"];
var MIN_PEERS = 4;
function pieceFor(apparatus){
  for(var i=0;i<PIECE_WEIGHTS.length;i++) if(PIECE_WEIGHTS[i].match.test(apparatus)) return PIECE_WEIGHTS[i];
  return null;
}
function bestScoresByGymnast(){
  var out = {};
  (competitions||[]).forEach(function(comp){
    (comp.sheets||[]).forEach(function(sh){
      (sh.entries||[]).forEach(function(e){
        var s = parseFloat(e.score); if(isNaN(s) || !e.memberId) return;
        var g = out[e.memberId] || (out[e.memberId] = {gender:"", level:"", club:"", best:{}});
        if(e.gender) g.gender = e.gender; if(e.level) g.level = e.level; if(e.club) g.club = e.club;
        if(!(sh.apparatus in g.best) || s > g.best[sh.apparatus]) g.best[sh.apparatus] = s;
      });
    });
  });
  return out;
}
function percentile(value, list){
  var below = 0, equal = 0;
  list.forEach(function(v){ if(v < value) below++; else if(v === value) equal++; });
  return (below + 0.5*equal) / list.length;
}
function buildCard(memberId){
  var all = bestScoresByGymnast(), me = all[memberId];
  if(!me) return null;
  var pieces = [];
  Object.keys(me.best).forEach(function(app){
    var p = pieceFor(app); if(!p) return;
    var score = me.best[app];
    var same = [], gender = [];
    Object.keys(all).forEach(function(id){
      var o = all[id]; if(!(app in o.best) || o.gender !== me.gender) return;
      gender.push(o.best[app]);
      if(o.level === me.level) same.push(o.best[app]);
    });
    var pct, basis;
    if(same.length >= MIN_PEERS){ pct = percentile(score, same); basis = "level"; }
    else if(gender.length >= MIN_PEERS){ pct = percentile(score, gender); basis = "gender"; }
    else { pct = Math.max(0, Math.min(1, (score - 6) / 8)); basis = "score"; }
    pieces.push({apparatus:app, short:p.short, score:score, rating:Math.round(50 + 49*pct), weights:p.w, basis:basis});
  });
  if(!pieces.length) return null;
  var attrs = {};
  ATTRS.forEach(function(a){
    var sum = 0, wt = 0;
    pieces.forEach(function(p){ var w = p.weights[a.key] || 0; sum += w*p.rating; wt += w; });
    attrs[a.key] = wt ? Math.round(sum/wt) : null;
  });
  var overall = Math.round(pieces.reduce(function(t,p){return t+p.rating;},0) / pieces.length);
  var discipline = /boy|male|^m/i.test(me.gender) ? "MAG" : (/girl|female|^w|^f/i.test(me.gender) ? "WAG" : "");
  var name = getName(memberId) || "";
  return {
    memberId:memberId, name:name, club:cardClub(me.club), level:me.level, discipline:discipline,
    overall:overall, attrs:attrs, pieces:pieces,
    tier: overall >= 80 ? "gold" : overall >= 65 ? "silver" : "bronze",
    basis: pieces.some(function(p){return p.basis==="level";}) ? "level" : pieces[0].basis
  };
}
function cardClub(c){ return String(c||"").split(",")[0].replace(/\s*\(\d+\)\s*$/,"").replace(/\s+(Ltd|Limited)$/i,"").trim(); }

var W = 600, H = 860;
var TIERS = {
  gold:   {a:"#fff4c9", b:"#e9c25a", c:"#b88a1d", ink:"#3b2a05", edge:["#fff1b8","#c9971f","#f7da7c","#9c7413"]},
  silver: {a:"#f6f8fb", b:"#c9d0da", c:"#8d97a6", ink:"#1f2733", edge:["#ffffff","#9aa4b2","#e3e8ef","#6f7a8a"]},
  bronze: {a:"#f7dcc6", b:"#d39a6a", c:"#9a5f34", ink:"#3a1f0c", edge:["#f9d9bd","#a8693b","#e5b48b","#7c4a24"]}
};
var logoImg = null, logoLoad = null;
function loadLogo(){
  if(logoImg) return Promise.resolve(logoImg);
  return logoLoad = logoLoad || new Promise(function(res){
    var i = new Image(); i.crossOrigin = "anonymous";
    i.onload = function(){ logoImg = i; res(i); };
    i.onerror = function(){ res(null); };
    i.src = BRAND + "ngl-logo-full.png";
  });
}
function fontsReady(){
  if(!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load("800 40px 'Roboto Condensed'"),
    document.fonts.load("700 30px 'Roboto Condensed'"),
    document.fonts.load("700 30px Roboto"),
    document.fonts.load("500 30px Roboto")
  ]).catch(function(){});
}
function cardPath(ctx){
  // Shield shape: rounded top corners, pointed curved bottom.
  var r = 40;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(W-r, 0); ctx.quadraticCurveTo(W, 0, W, r);
  ctx.lineTo(W, H-170);
  ctx.quadraticCurveTo(W, H-90, W/2, H);
  ctx.quadraticCurveTo(0, H-90, 0, H-170);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
}
function fitText(ctx, text, maxW, size, weightFamily){
  var s = size;
  do { ctx.font = weightFamily.replace("{s}", s); s -= 2; } while(ctx.measureText(text).width > maxW && s > 16);
}
function draw(canvas, card, photo){
  var t = TIERS[card.tier];
  var ctx = canvas.getContext("2d");
  ctx.setTransform(canvas.width/W, 0, 0, canvas.height/H, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // Metallic edge
  ctx.save(); cardPath(ctx);
  var eg = ctx.createLinearGradient(0, 0, W, H);
  eg.addColorStop(0, t.edge[0]); eg.addColorStop(.35, t.edge[1]); eg.addColorStop(.6, t.edge[2]); eg.addColorStop(1, t.edge[3]);
  ctx.fillStyle = eg; ctx.fill(); ctx.restore();
  // Inner face
  ctx.save(); ctx.translate(12, 12); ctx.scale((W-24)/W, (H-24)/H); cardPath(ctx); ctx.restore();
  ctx.save();
  var fg = ctx.createLinearGradient(0, 0, 0, H);
  fg.addColorStop(0, t.a); fg.addColorStop(.55, t.b); fg.addColorStop(1, t.c);
  ctx.fillStyle = fg; ctx.fill();
  ctx.clip();
  // diagonal sheen
  ctx.globalAlpha = .18; ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(W*.55, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H*.35); ctx.lineTo(W*.2, H); ctx.lineTo(0, H); ctx.lineTo(0, H*.8); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // Pathway colour strip
  var sw = (W-24)/7;
  PATHWAY.forEach(function(c, i){ ctx.fillStyle = c; ctx.fillRect(12 + i*sw, 12, sw+1, 12); });
  // Photo (or blank silhouette)
  var px = 220, py = 50, pw = 330, ph = 360;
  ctx.save();
  ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  if(photo){
    var s = Math.max(pw/photo.width, ph/photo.height);
    var dw = photo.width*s, dh = photo.height*s;
    ctx.drawImage(photo, px + (pw-dw)/2, py + (ph-dh)/2, dw, dh);
    var fade = ctx.createLinearGradient(0, py+ph-90, 0, py+ph);
    fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, t.b);
    ctx.fillStyle = fade; ctx.fillRect(px, py+ph-90, pw, 90);
  } else {
    ctx.fillStyle = "rgba(0,0,0,.07)"; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath(); ctx.arc(px+pw/2, py+135, 72, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px+pw/2, py+ph+40, 150, 170, 0, Math.PI, 0); ctx.fill();
  }
  ctx.restore();
  // Overall + discipline + level
  ctx.fillStyle = t.ink; ctx.textAlign = "center";
  ctx.font = "800 128px 'Roboto Condensed'"; ctx.fillText(String(card.overall), 120, 175);
  ctx.font = "700 44px 'Roboto Condensed'"; ctx.fillText(card.discipline || "NGL", 120, 230);
  ctx.fillRect(80, 248, 80, 4);
  if(card.level){ ctx.font = "700 30px 'Roboto Condensed'"; ctx.fillText("LEVEL", 120, 290); ctx.font = "800 46px 'Roboto Condensed'"; ctx.fillText(card.level, 120, 340); }
  if(logoImg){ var lw = 150, lh = lw*logoImg.height/logoImg.width; ctx.drawImage(logoImg, 120-lw/2, 365, lw, lh); }
  // Name
  var name = (card.name || "Gymnast").toUpperCase();
  ctx.fillStyle = t.ink;
  fitText(ctx, name, W-110, 62, "800 {s}px 'Roboto Condensed'");
  ctx.fillText(name, W/2, 480);
  ctx.font = "500 26px Roboto"; ctx.globalAlpha = .8;
  fitText(ctx, card.club, W-140, 28, "500 {s}px Roboto");
  ctx.fillText(card.club, W/2, 515); ctx.globalAlpha = 1;
  ctx.globalAlpha = .35; ctx.fillRect(80, 535, W-160, 2); ctx.globalAlpha = 1;
  // Attributes: two columns of three
  var colX = [120, 345], rowY = [600, 660, 720];
  ATTRS.forEach(function(a, i){
    var x = colX[i < 3 ? 0 : 1], y = rowY[i % 3], v = card.attrs[a.key];
    ctx.textAlign = "right"; ctx.font = "800 50px 'Roboto Condensed'"; ctx.fillText(v == null ? "–" : String(v), x + 60, y);
    ctx.textAlign = "left"; ctx.font = "700 40px 'Roboto Condensed'"; ctx.fillText(a.key, x + 78, y - 2);
  });
  ctx.globalAlpha = .35; ctx.fillRect(W/2 - 1, 560, 2, 180); ctx.globalAlpha = 1;
  // Footer
  ctx.textAlign = "center"; ctx.font = "700 24px 'Roboto Condensed'"; ctx.globalAlpha = .75;
  var season = String(card.season || new Date().getFullYear());
  ctx.fillText(/^\d+$/.test(season) ? "NGL PROFILE CARD · " + season : "NGL · " + season, W/2, 790);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ═════════════════ Load and screen ═════════════════ */
function load(){
  return (DEMO ? loadDemo() : loadAdmin()).then(function(){
    if(!PL.loading) PL.loading = (DEMO ? Promise.resolve(demoPL()) : loadPLAdmin()).then(function(){
      PL.ready = true;
      if(location.hash.indexOf(BASE + '/') === 0) redraw();   // the boys' Training League parts fill in when they arrive
    });
  });
}

const TABS = [['', 'Home', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'], ['stats', 'Stats', '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'],
  ['comps', 'Comps', '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'], ['card', 'Card', '<path d="M6 3h12v12c0 3-3 5-6 6-3-1-6-3-6-6z"/><path d="M9 9h6M9 12h6"/>']];
const ico = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export default async function glhub(me = {}, parts = []){
  if (!S.loaded) S.loaded = load().catch(function(e){ S.error = (e && e.message) || "Please try again."; });
  await S.loaded;
  if (S.error) return `<div id="ghRoot" class="gh-root"><div class="gh-col"><div class="card gh-card"><h2>Couldn't load results</h2><p class="gh-muted">${esc(S.error)}</p><button class="btn" data-act="gh-retry">Try again</button></div></div></div>`;
  let id = parts[0] ? decodeURIComponent(parts[0]) : '';
  if (id && (!GYM[id] || GYM[id].peer)) id = '';
  const label = `<div class="note gh-label">${esc(DATA_LABEL)}${id ? ' · <a href="' + BASE + '">Back to search</a>' : ''}</div>`;
  if (!id) return `<div id="ghRoot" class="gh-root">${label}${searchScreen()}</div>`;
  const tab = ['stats', 'comps', 'card'].includes(parts[1]) ? parts[1] : '';
  const nav = `<nav class="sub gh-tabs" aria-label="Hub sections">${TABS.map(([k, l, d]) => `<a class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''} href="${esc(hubLink(id, k))}">${ico(d)}${l}</a>`).join('')}</nav>`;
  const body = tab === 'stats' ? statsScreen(id) : tab === 'comps' ? compsScreen(id) : tab === 'card' ? cardScreen(id) : homeScreen(id);
  return `<div id="ghRoot" class="gh-root" data-gym="${esc(id)}">${label}<div class="gh-col">${nav}<div class="gh-screen" data-tab="${tab || 'home'}">${body}</div></div></div>`;
}

// After each draw: the card canvas and the search box focus (the original's AFTER hooks)
document.addEventListener('ngl:rendered', () => {
  const root = document.getElementById('ghRoot'); if (!root) return;
  const cv = document.getElementById('ghCanvas');
  if (cv) { cv.dataset.id = root.dataset.gym; drawCard(); Promise.all([fontsReady(), loadLogo()]).then(drawCard); }
  const q = document.getElementById('ghQ'); if (q && document.activeElement !== q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
});

// ---------- buttons (data-act; the shell calls these with preventDefault) ----------
export const GH = {
  'gh-retry'(){ S.loaded = null; S.error = ''; redraw(); },
  'gh-photo'(){ const i = document.getElementById('ghPhotoIn'); if (i) i.click(); },
  'gh-save'(){
    const cv = document.getElementById('ghCanvas'), id = cv && cv.dataset.id; if (!cv) return;
    try { var a = document.createElement("a"); a.download = "NGL_Player_" + displayName(id).replace(/\s+/g, "_") + ".png"; a.href = cv.toDataURL("image/png"); document.body.appendChild(a); a.click(); a.remove(); }
    catch (err) { toast("Couldn't save here. Try a screenshot instead.", false); }
  },
  'gh-video'(){ toast("Demo: this would open the routine videos for this competition."); }
};

const mine = e => e.target.closest && e.target.closest('#ghRoot');
document.addEventListener('input', e => {
  if (!mine(e) || e.target.id !== 'ghQ') return;
  S.query = e.target.value;
  const box = document.getElementById('ghResults'); if (box) box.innerHTML = searchResults();
});
document.addEventListener('change', e => {
  if (!mine(e) || e.target.id !== 'ghPhotoIn') return;
  const f = e.target.files && e.target.files[0], cv = document.getElementById('ghCanvas'); if (!f || !cv) return;
  const id = cv.dataset.id, img = new Image();
  img.onload = () => { S.photo[id] = img; drawCard(); };
  img.src = URL.createObjectURL(f);
});
