// NGL Admin · Results. Copied word for word from GYMNASTICS-RESULTS/admin-corrections.html ("Result corrections and data quality"):
// the same BG number reassignments, search by Member ID, corrections per gymnast, active corrections list and the Data Quality
// conflicts check with "Apply Fix". Only the shell, look and data layer changed.
// Data (same as the original): the competition spreadsheets (*.xlsx) and gymnast-names.xlsx in the public GYMNASTICS-RESULTS repo,
// plus corrections.json and reassignments.json there (the public league tables and National Qualifiers read those two files).
// Saving (same as the original): a GitHub API PUT of corrections.json / reassignments.json on main, with a GitHub token the admin types in.
// The token stays in this page's memory only (never stored, never in code). In the sandbox saving is switched off: changes stay on
// screen and nothing is written. ?demo uses sample data in memory and never writes.
import { MODE } from '../data.js';
import { ENV } from '../config.js';
import { esc as esc0, toast } from '../ui.js';

var GITHUB_USER = "Davidcbrooke";
var GITHUB_REPO = "GYMNASTICS-RESULTS";
var BRANCH = "main";
var CORRECTIONS_FILE = "corrections.json";
var REASSIGNMENTS_FILE = "reassignments.json";
var NAMES_FILE = "gymnast-names.xlsx";
var RAW = "https://raw.githubusercontent.com/" + GITHUB_USER + "/" + GITHUB_REPO + "/" + BRANCH + "/";
var API = "https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/contents/";

var AGE_OPTIONS = ["6-8", "9-11", "12-14", "15+"];
var LEVEL_OPTIONS = ["A", "B", "C"];
var TRAINING_OPTIONS = ["2-5hrs", "6-10hrs"];
var GENDER_OPTIONS = ["Girls", "Boys"];
var CHECK_FIELDS = ["ageCategory", "level", "trainingHrs", "gender"];
var fieldLabels = {ageCategory: "Age Category", level: "Level", trainingHrs: "Training Hrs", gender: "Gender"};

const DEMO = MODE === 'demo';
const CAN_SAVE = !DEMO && ENV === 'live';        // only the live app (after switch-over) writes to the GYMNASTICS-RESULTS repo
const S = {
  loaded: null, failed: false, token: '', status: {s: 'loading', m: 'Loading...'},
  allData: [], corrections: {}, correctionsSha: null, reassignments: {}, reassignmentsSha: null, namesLookup: {},
  dqFieldFilter: 'ageCategory', searchId: '', shown: ''
};
const redraw = () => window.NGL_RENDER && window.NGL_RENDER();
function esc(s){ return esc0(s || ""); }       // the original shows nothing for 0 / empty

function setStatus(s, m){
  S.status = {s, m};
  const d = document.getElementById('rsDot'), t = document.getElementById('rsStatusText');
  if (d) d.className = 'rs-dot ' + s; if (t) t.textContent = m;
}

// ---------- data (same files and URLs as the original) ----------
let xlsxLoad = null;
function loadXlsx(){
  if (window.XLSX) return Promise.resolve();
  return xlsxLoad = xlsxLoad || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = res; s.onerror = () => { xlsxLoad = null; rej(new Error('Spreadsheet reader didn’t load')); }; document.head.appendChild(s);
  });
}
// Reading needs no token (the repo is public, as the public league tables read it); the token is sent only once typed (live).
const ghHeaders = () => Object.assign({"Accept": "application/vnd.github.v3+json"}, S.token ? {"Authorization": "token " + S.token} : {});

function loadNames(){
  return fetch(API + NAMES_FILE + "?ref=" + BRANCH, {headers: {"Accept": "application/vnd.github.v3+json"}})
    .then(function(r){ if (!r.ok) throw new Error(); return r.json(); })
    .then(function(d){
      var buf = Uint8Array.from(atob(d.content.replace(/\n/g, "")), function(c){ return c.charCodeAt(0); });
      var wb = XLSX.read(buf, {type: "array"});
      XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval: ""}).forEach(function(r){
        var id = String(r["Mid"] || r["BG Number"] || r["Member ID"] || "").trim();
        var fn = String(r["FirstName"] || r["First Name"] || "").trim();
        var ln = String(r["LastName"] || r["Last Name"] || "").trim();
        if (id) S.namesLookup[id] = (fn + " " + ln).trim();
      });
    })
    .catch(function(){});
}
function loadCompetitions(){
  return fetch(API + "?ref=" + BRANCH, {headers: {"Accept": "application/vnd.github.v3+json"}})
    .then(function(r){ return r.json(); })
    .then(function(files){
      var xl = files.filter(function(f){ return f.type === "file" && f.name.toLowerCase().endsWith(".xlsx") && f.name.toLowerCase() !== NAMES_FILE; });
      return Promise.all(xl.map(function(f){ return loadFile(f.name); }));
    })
    .then(function(results){
      S.allData = [];
      results.forEach(function(entries){ if (entries) S.allData = S.allData.concat(entries); });
    });
}
function loadFile(filename){
  return fetch(RAW + filename)
    .then(function(r){ return r.arrayBuffer(); })
    .then(function(buf){
      var wb = XLSX.read(new Uint8Array(buf), {type: "array"});
      var out = [];
      wb.SheetNames.forEach(function(sn){
        XLSX.utils.sheet_to_json(wb.Sheets[sn], {defval: ""}).forEach(function(r){
          var id = String(r["Member ID"] || r["BG Number"] || "").trim();
          if (!id) return;
          out.push({
            memberId: id,
            club: String(r["Club"] || "").trim(),
            ageCategory: String(r["Age Category"] || r["AgeCategory"] || "").trim(),
            level: String(r["Level"] || "").trim().toUpperCase(),
            score: r["Final Score"] !== undefined ? r["Final Score"] : (r["FinalScore"] !== undefined ? r["FinalScore"] : (r["Score"] || "")),
            region: String(r["Region"] || "").trim(),
            trainingHrs: String(r["Training Hrs"] || r["TrainingHrs"] || r["Training Hours"] || "").trim(),
            gender: String(r["Gender"] || "").trim(),
            apparatus: sn,
            competition: filename.replace(/\.[^.]+$/, "").replace(/_/g, " ")
          });
        });
      });
      return out;
    })
    .catch(function(){ return []; });
}
function loadJson(file, key, shaKey){
  return fetch(API + file + "?ref=" + BRANCH, {headers: ghHeaders()})
    .then(function(r){ if (r.status === 404) return null; return r.json(); })
    .then(function(d){
      if (!d) return;
      S[shaKey] = d.sha;
      try { S[key] = JSON.parse(atob(d.content.replace(/\n/g, ""))); } catch (e) {}
    })
    .catch(function(){ S[key] = {}; });
}

/* Sample data (?demo): made-up gymnasts and competitions, some with clashing details between competitions */
function demoData(){
  const G = [
    ['9100101', 'Amelia Hart', 'Riverside Gym Academy', ['Girls', '9-11', 'A', '2-5hrs'], ['Girls', '9-11', 'A', '2-5hrs']],
    ['9100102', 'Isla Morgan', 'Riverside Gym Academy', ['Girls', '12-14', 'B', '6-10hrs'], ['Girls', '9-11', 'B', '6-10hrs']],
    ['9100103', 'Freya Collins', 'Northgate Gymnastics Club', ['Girls', '12-14', 'B', '2-5hrs'], ['Girls', '12-14', 'C', '6-10hrs']],
    ['9100104', 'Noah Bennett', 'Northgate Gymnastics Club', ['Boys', '9-11', 'A', '2-5hrs'], ['Boys', '9-11', 'A', '2-5hrs']],
    ['9100105', 'Ruby Shah', 'Hillview Gymnastics', ['Girls', '15+', 'C', '6-10hrs'], ['Girls', '15+', 'C', '6-10hrs']],
    ['9100106', 'Leo Turner', 'Hillview Gymnastics', ['Boys', '12-14', 'B', '6-10hrs'], ['Boys', '12-14', 'B', '2-5hrs']],
    ['9100107', 'Poppy Evans', 'Riverside Gym Academy', ['Girls', '6-8', 'A', '2-5hrs'], ['Boys', '6-8', 'A', '2-5hrs']]
  ];
  const comps = ['RIVERSIDE GYM 2026-03-01 Results', 'NORTHGATE GYMNASTICS 2026-05-10 Results'];
  const app = {Girls: ['Vault', 'Bars', 'Beam', 'Floor'], Boys: ['Floor', 'Pommel', 'Vault']};
  const all = [];
  G.forEach(([id, , club, a, b], gi) => [a, b].forEach((v, ci) => app[v[0]].slice(0, 2).forEach((ap, k) => all.push({
    memberId: id, club, gender: v[0], ageCategory: v[1], level: v[2], trainingHrs: v[3], region: 'East',
    score: (10.4 + ((gi * 7 + ci * 3 + k * 5) % 19) / 10).toFixed(2), apparatus: ap, competition: comps[ci]}))));
  S.allData = all;
  S.namesLookup = Object.fromEntries(G.map(g => [g[0], g[1]]).concat([['9100199', 'Mia Clarke']]));
  S.corrections = {'9100106': {gender: 'Boys', ageCategory: '12-14', level: 'B', trainingHrs: '6-10hrs'}};
  S.reassignments = {'9100991': '9100199'};
}

async function load(){
  setStatus("loading", "Loading data...");
  if (DEMO) { demoData(); setStatus("ok", "Ready · " + S.allData.length + " entries loaded"); return; }
  try {
    await loadXlsx();
    await Promise.all([loadNames(), loadCompetitions(),
      loadJson(CORRECTIONS_FILE, 'corrections', 'correctionsSha'), loadJson(REASSIGNMENTS_FILE, 'reassignments', 'reassignmentsSha')]);
    setStatus("ok", "Ready · " + S.allData.length + " entries loaded");
  } catch (e) { console.error(e); S.failed = true; setStatus("error", "Failed to load"); }
}

/* Save one file. Live: GitHub API PUT exactly as the original. Sandbox: switched off. Sample data: in memory only. */
function saveFile(file, data, shaKey, message){
  if (DEMO) { setStatus("ok", "Saved"); toast('Saved (sample data: nothing is written)'); setTimeout(function(){ setStatus("ok", "Ready"); }, 2000); return Promise.resolve(); }
  if (!CAN_SAVE) { setStatus("error", "Sandbox: not saved"); toast('Sandbox: saving is switched off. Nothing was written to the live results.', false); return Promise.resolve(); }
  var body = {message: message, content: btoa(JSON.stringify(data, null, 2)), branch: BRANCH};
  if (S[shaKey]) body.sha = S[shaKey];
  setStatus("loading", "Saving...");
  return fetch(API + file, {
    method: "PUT",
    headers: {"Authorization": "token " + S.token, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json"},
    body: JSON.stringify(body)
  })
  .then(function(r){ if (!r.ok) return r.json().then(function(e){ throw new Error(e.message); }); return r.json(); })
  .then(function(d){ S[shaKey] = d.content.sha; setStatus("ok", "Saved"); toast('Saved'); setTimeout(function(){ setStatus("ok", "Ready"); }, 2000); })
  .catch(function(e){ setStatus("error", "Save failed: " + e.message); toast("Could not save: " + e.message, false); });
}
const saveCorrections = () => saveFile(CORRECTIONS_FILE, S.corrections, 'correctionsSha', "Update corrections");
const saveReassignments = () => saveFile(REASSIGNMENTS_FILE, S.reassignments, 'reassignmentsSha', "Update reassignments");

// ---------- Corrections tab ----------
function correctionsTab(){
  const reassignments = S.reassignments, namesLookup = S.namesLookup;
  var html = '';
  // BG Number Reassignment
  html += '<h2 class="rs-sec">BG Number Reassignments <span class="rs-count">' + Object.keys(reassignments).length + '</span></h2>';
  html += '<div class="card rs-box">';
  html += '<h3 class="rs-box-title">Reassign a BG Number</h3>';
  html += '<p class="rs-note">Use this to correct a BG number that was entered incorrectly. All results for the wrong number will automatically show under the correct number.</p>';
  html += '<div class="rs-reassign">';
  html += '<label class="field"><span>Wrong BG Number</span><input id="rsFrom" type="text" inputmode="numeric" placeholder="e.g. 1234567"/></label>';
  html += '<label class="field"><span>Correct BG Number</span><input id="rsTo" type="text" inputmode="numeric" placeholder="e.g. 7654321"/></label>';
  html += '<button class="btn" data-act="rs-reassign">Save</button>';
  html += '</div></div>';

  var rids = Object.keys(reassignments);
  if (rids.length) {
    html += '<div class="card rs-tablecard"><table class="rs-tbl" id="rsReassignments"><tr><th>Wrong BG Number</th><th>Correct BG Number</th><th>Name (Correct)</th><th></th></tr>';
    rids.forEach(function(from){
      var to = reassignments[from];
      html += '<tr><td class="rs-mono rs-old">' + esc(from) + '</td>';
      html += '<td class="rs-mono rs-new">' + esc(to) + '</td>';
      html += '<td><b>' + esc(namesLookup[to] || "—") + '</b></td>';
      html += '<td class="rs-act"><button class="btn sm ghost rs-del" data-act="rs-unreassign" data-from="' + esc(from) + '">Remove</button></td></tr>';
    });
    html += '</table></div>';
  } else {
    html += '<div class="card empty rs-gap">No BG number reassignments saved yet.</div>';
  }

  // Search
  html += '<h2 class="rs-sec">Search &amp; Correct <span class="rs-count" id="rsCorrCount">' + Object.keys(S.corrections).length + ' corrections</span></h2>';
  html += '<form class="card rs-box" id="rsSearchForm"><h3 class="rs-box-title">Search by Member ID</h3>';
  html += '<div class="rs-search"><label class="field"><span class="rs-sr">Member ID</span><input id="rsSearch" type="text" inputmode="numeric" placeholder="Enter Member ID e.g. 4936998" value="' + esc(S.searchId) + '"/></label>';
  html += '<button class="btn" type="submit">Search</button></div></form>';
  html += '<div id="rsResults">' + (S.shown ? searchResults(S.shown) : '') + '</div>';

  // Active corrections
  html += '<h2 class="rs-sec">Active Corrections</h2>';
  html += '<div id="rsCorrList">' + correctionsList() + '</div>';
  return html;
}

function searchResults(id){
  var entries = S.allData.filter(function(e){ return e.memberId === id; });
  if (!entries.length) return '<div class="card empty">No results found for Member ID <strong>' + esc(id) + '</strong></div>';
  var name = S.namesLookup[id] || "";
  var corr = S.corrections[id] || {}, first = entries[0];
  var html = '<div class="card rs-gym" data-id="' + esc(id) + '">';
  html += '<div class="rs-gym-head"><div class="rs-gym-id">Member ID: ' + esc(id) + '</div><div class="rs-gym-name">' + (name ? esc(name) + ' · ' : '') + esc(corr.club || first.club || "Unknown Club") + '</div></div>';
  // One correction per gymnast (that's how corrections.json works): it applies to every result below
  html += '<div class="rs-fix"><b>Correct this gymnast</b><small>Applies to all ' + entries.length + ' result' + (entries.length === 1 ? '' : 's') + ' below. Values left as they are keep what the spreadsheet says.</small><div class="rs-fix-grid">';
  html += editBox("gender", first.gender, corr.gender, GENDER_OPTIONS, "Gender");
  html += editBox("ageCategory", first.ageCategory, corr.ageCategory, AGE_OPTIONS, "Age Cat.");
  html += editBox("level", first.level, corr.level, LEVEL_OPTIONS, "Level");
  html += editBox("trainingHrs", first.trainingHrs, corr.trainingHrs, TRAINING_OPTIONS, "Training Hrs");
  html += '<label class="rs-edit' + (corr.club && corr.club !== first.club ? ' modified' : '') + '"><span>Club</span><input id="rs-club-override" type="text" value="' + esc(corr.club || "") + '" placeholder="' + esc(first.club || "Club name") + '" data-orig=""></label>';
  html += '</div></div>';
  html += '<table class="rs-tbl rs-results"><tr><th>Competition</th><th>Apparatus</th><th>Score</th><th>Gender</th><th>Age Cat.</th><th>Level</th><th>Training Hrs</th></tr>';
  var cell = function(orig, c){ return c && c !== orig ? '<td class="rs-val modified" title="Spreadsheet: ' + esc(orig || "blank") + '">' + esc(c) + '</td>' : '<td class="rs-val">' + esc(orig || "—") + '</td>'; };
  entries.forEach(function(e){
    html += '<tr><td class="rs-comp">' + esc(e.competition) + '</td><td><b>' + esc(e.apparatus) + '</b></td><td class="rs-score">' + esc(parseFloat(e.score) || e.score || "—") + '</td>';
    html += cell(e.gender, corr.gender) + cell(e.ageCategory, corr.ageCategory) + cell(e.level, corr.level) + cell(e.trainingHrs, corr.trainingHrs) + '</tr>';
  });
  html += '</table>';
  html += '<div class="rs-gym-foot"><div>Changes apply to <strong>all results</strong> for this gymnast.</div>';
  html += '<button class="btn sm" data-act="rs-save-gym" data-id="' + esc(id) + '">Save Corrections</button>';
  html += '</div></div>';
  return html;
}

function editBox(field, original, corrected, options, label){
  var current = corrected || original;
  var isModified = corrected && corrected !== original;
  var s = '<label class="rs-edit' + (isModified ? ' modified' : '') + '" id="rs-gym-' + field + '"><span>' + esc(label) + '</span><select data-orig="' + esc(original) + '">';
  if (options.indexOf(current) < 0) s += '<option value="' + esc(current || "") + '" selected>' + esc(current || "—") + '</option>';
  options.forEach(function(o){ s += '<option value="' + esc(o) + '"' + (current === o ? ' selected' : '') + '>' + esc(o) + '</option>'; });
  s += '</select></label>';
  return s;
}

function correctionsList(){
  var ids = Object.keys(S.corrections);
  if (!ids.length) return '<div class="card empty">No corrections saved yet.</div>';
  var html = '<div class="card rs-tablecard"><table class="rs-tbl" id="rsCorrTable"><tr><th>Member ID</th><th>Name</th><th>Club</th><th>Gender</th><th>Age Cat.</th><th>Level</th><th>Training Hrs</th><th></th></tr>';
  ids.forEach(function(id){
    var c = S.corrections[id];
    var orig = S.allData.find(function(e){ return e.memberId === id; }) || {};
    html += '<tr data-id="' + esc(id) + '"><td class="rs-mono">' + esc(id) + '</td><td><b>' + esc(S.namesLookup[id] || "—") + '</b></td>';
    html += corrCell(orig.club, c.club) + corrCell(orig.gender, c.gender) + corrCell(orig.ageCategory, c.ageCategory) + corrCell(orig.level, c.level) + corrCell(orig.trainingHrs, c.trainingHrs);
    html += '<td class="rs-act"><button class="btn sm ghost rs-del" data-act="rs-uncorrect" data-id="' + esc(id) + '">Remove</button></td></tr>';
  });
  html += '</table></div>';
  return html;
}

function corrCell(original, corrected){
  if (corrected && corrected !== original) {
    return '<td><span class="rs-was">' + esc(original || "—") + '</span><span class="rs-arrow">→</span><span class="rs-changed">' + esc(corrected) + '</span></td>';
  }
  return '<td>' + esc(corrected || original || "—") + '</td>';
}

// ---------- Data Quality tab ----------
function qualityTab(){
  var gymnasts = {};
  S.allData.forEach(function(e){
    if (!e.memberId) return;
    if (!gymnasts[e.memberId]) gymnasts[e.memberId] = {memberId: e.memberId, values: {}};
    CHECK_FIELDS.forEach(function(f){
      if (!gymnasts[e.memberId].values[f]) gymnasts[e.memberId].values[f] = [];
      var val = e[f] || "";
      if (val && !gymnasts[e.memberId].values[f].some(function(v){ return v.value === val; })) {
        gymnasts[e.memberId].values[f].push({value: val, competition: e.competition});
      }
    });
  });
  var conflicts = [];
  Object.values(gymnasts).forEach(function(g){
    var hasConflict = CHECK_FIELDS.some(function(f){ return g.values[f] && g.values[f].length > 1; });
    if (hasConflict) conflicts.push(g);
  });
  var totalGymnasts = Object.keys(gymnasts).length;
  var html = '<div class="grid g3 rs-dq-summary">';
  html += '<div class="card stat rs-dq-card" id="rsDqConflicts"><b class="' + (conflicts.length === 0 ? "rs-okn" : "rs-warnn") + '">' + conflicts.length + '</b><span>Gymnasts with conflicts</span></div>';
  html += '<div class="card stat rs-dq-card"><b>' + totalGymnasts + '</b><span>Total gymnasts</span></div>';
  html += '<div class="card stat rs-dq-card"><b class="rs-okn">' + (totalGymnasts - conflicts.length) + '</b><span>Clean records</span></div>';
  html += '</div>';
  if (!conflicts.length) return html + '<div class="card rs-allok"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg><b>All gymnast records are consistent!</b></div>';
  html += '<h2 class="rs-sec">Conflicts Found <span class="rs-count">' + conflicts.length + '</span></h2>';
  html += '<div class="card rs-filter"><label for="rsDqFilter">Show conflicts in:</label>';
  html += '<select id="rsDqFilter">';
  html += '<option value="all">All Fields</option>';
  Object.keys(fieldLabels).forEach(function(f){ html += '<option value="' + f + '"' + (S.dqFieldFilter === f ? ' selected' : '') + '>' + fieldLabels[f] + '</option>'; });
  html += '</select></div>';
  conflicts.forEach(function(g){
    var fieldsToShow = S.dqFieldFilter === "all" ? CHECK_FIELDS : [S.dqFieldFilter];
    var hasConflictInFilter = fieldsToShow.some(function(f){ return g.values[f] && g.values[f].length > 1; });
    if (!hasConflictInFilter) return;
    var name = S.namesLookup[g.memberId] || "";
    var corrAlready = S.corrections[g.memberId] || {};
    html += '<div class="card rs-flag" data-id="' + esc(g.memberId) + '"><div class="rs-flag-head"><div><span class="rs-mono rs-flag-id">' + esc(g.memberId) + '</span>' + (name ? '<span class="rs-flag-name">· ' + esc(name) + '</span>' : '') + '</div><button class="btn sm ghost rs-fix" data-act="rs-fix" data-id="' + esc(g.memberId) + '">Fix in Corrections →</button></div>';
    html += '<div class="rs-flag-body">';
    CHECK_FIELDS.forEach(function(f){
      if (S.dqFieldFilter !== "all" && f !== S.dqFieldFilter) return;
      if (!g.values[f] || g.values[f].length <= 1) return;
      var options = f === "ageCategory" ? AGE_OPTIONS : f === "level" ? LEVEL_OPTIONS : f === "trainingHrs" ? TRAINING_OPTIONS : GENDER_OPTIONS;
      html += '<div class="rs-field"><div class="rs-field-label">' + fieldLabels[f] + ' — ' + g.values[f].length + ' different values</div>';
      html += '<div class="rs-values">';
      g.values[f].forEach(function(v){ var isCorrected = corrAlready[f] && corrAlready[f] === v.value; html += '<div class="rs-value' + (isCorrected ? "" : " conflict") + '"><span>' + esc(v.value) + '</span><span class="rs-value-comp">' + esc(v.competition) + '</span></div>'; });
      html += '</div><div class="rs-dq-actions"><label class="rs-fix-label" for="rs-dq-' + esc(g.memberId) + '-' + f + '">Set correct value:</label><select id="rs-dq-' + esc(g.memberId) + '-' + f + '">';
      options.forEach(function(o){ html += '<option value="' + esc(o) + '"' + (corrAlready[f] === o ? ' selected' : '') + '>' + esc(o) + '</option>'; });
      html += '</select><button class="btn sm" data-act="rs-dq-apply" data-id="' + esc(g.memberId) + '" data-f="' + f + '">Apply Fix</button></div></div>';
    });
    html += '</div></div>';
  });
  return html;
}

// ---------- screen ----------
function tokenCard(){
  return `<form class="card rs-login" id="rsTokenForm"><h2>NGL Admin</h2><p class="rs-note">Result Corrections</p>
    <label class="field"><span>GitHub token</span><input id="rsToken" type="password" autocomplete="off" placeholder="Enter GitHub token"/></label>
    <button class="btn" type="submit">Access Admin</button><p class="rs-login-err" id="rsTokenErr" hidden>Enter your GitHub token to make corrections.</p></form>`;
}
function banner(){
  if (DEMO) return '<div class="card rs-banner"><b>Sample data</b><small>Made-up gymnasts. Changes stay on this screen and nothing is saved.</small></div>';
  if (!CAN_SAVE) return `<div class="card attn rs-banner" id="rsSandbox"><b>Sandbox: saving is switched off</b><small>This screen reads the live results (the competition spreadsheets, corrections.json and reassignments.json in the GYMNASTICS-RESULTS repo). Changes you make here stay on this screen until you refresh; nothing is written. To make a real correction, use the live tool for now: <a href="https://davidcbrooke.github.io/GYMNASTICS-RESULTS/admin-corrections.html" target="_blank" rel="noopener">Result corrections (live)</a>.</small></div>`;
  return '';
}

export default async function results(me = {}, parts = []){
  const tab = parts && parts[0] === 'quality' ? 'quality' : 'corrections';
  if (CAN_SAVE && !S.token) return `<div id="rsRoot" class="rs-root">${tokenCard()}</div>`;
  if (!S.loaded) S.loaded = load();
  await S.loaded;
  const status = `<div class="rs-status" role="status"><i class="rs-dot ${S.status.s}" id="rsDot"></i><span id="rsStatusText">${esc(S.status.m)}</span></div>`;
  const tabsHtml = `<div class="sub rs-tabs">${[['', 'Corrections', 'corrections'], ['quality', 'Data Quality', 'quality']].map(([k, l, t]) =>
    `<a class="${t === tab ? 'on' : ''}" ${t === tab ? 'aria-current="page"' : ''} href="#/admin/results${k ? '/' + k : ''}">${l}</a>`).join('')}</div>`;
  const body = S.failed ? '<div class="card empty">The results couldn’t load. Check the connection and refresh the page.</div>'
    : tab === 'quality' ? qualityTab() : correctionsTab();
  return `<div id="rsRoot" class="rs-root"><div class="rs-top"><p class="lead">Result corrections and data quality</p>${status}</div>
    ${banner()}${tabsHtml}${body}</div>`;
}

// ---------- buttons (data-act; the shell calls these with preventDefault) ----------
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
export const RS = {
  'rs-reassign'(){
    var from = val('rsFrom'), to = val('rsTo');
    if (!from || !to) { toast("Please enter both BG numbers.", false); return; }
    if (from === to) { toast("The two BG numbers are the same.", false); return; }
    if (!confirm("Reassign all results from BG number " + from + " to " + to + "?\nThis will affect all competitions and tables.")) return;
    S.reassignments[from] = to;
    saveReassignments().then(redraw);
  },
  'rs-unreassign'(b){
    var from = b.dataset.from;
    if (!confirm("Remove reassignment for " + from + "? Results will revert to the original BG number.")) return;
    delete S.reassignments[from];
    saveReassignments().then(redraw);
  },
  'rs-save-gym'(b){
    var memberId = b.dataset.id;
    var fields = ["gender", "ageCategory", "level", "trainingHrs"];
    var corr = {};
    fields.forEach(function(f){   // one value per gymnast; only values that differ from the spreadsheet are saved
      var sel = document.querySelector("#rs-gym-" + f + " select");
      if (sel && sel.value && sel.value !== sel.dataset.orig) corr[f] = sel.value;
    });
    var clubOverride = document.getElementById("rs-club-override");
    if (clubOverride && clubOverride.value.trim()) corr.club = clubOverride.value.trim();
    if (!Object.keys(corr).length) { if (S.corrections[memberId]) { delete S.corrections[memberId]; S.searchId = S.shown = memberId; saveCorrections().then(redraw); } else toast("Nothing changed: every value matches the spreadsheet.", false); return; }
    S.corrections[memberId] = corr;
    S.searchId = S.shown = memberId;
    saveCorrections().then(redraw);
  },
  'rs-uncorrect'(b){
    var memberId = b.dataset.id;
    if (!confirm("Remove all corrections for Member ID " + memberId + "?")) return;
    delete S.corrections[memberId];
    S.searchId = S.shown = '';
    saveCorrections().then(redraw);
  },
  'rs-dq-apply'(b){
    var memberId = b.dataset.id, field = b.dataset.f;
    var sel = document.getElementById("rs-dq-" + memberId + "-" + field);
    if (!sel) return;
    if (!S.corrections[memberId]) S.corrections[memberId] = {};
    S.corrections[memberId][field] = sel.value;
    saveCorrections().then(redraw);
  },
  'rs-fix'(b){   // Fix in Corrections →: open the Corrections tab with this gymnast's results
    S.searchId = S.shown = b.dataset.id;
    if (location.hash === '#/admin/results') redraw(); else location.hash = '#/admin/results';
  }
};

const mine = e => e.target.closest && e.target.closest('#rsRoot');
document.addEventListener('submit', e => {
  if (!mine(e)) return;
  if (e.target.id === 'rsSearchForm') {
    e.preventDefault();
    var id = val('rsSearch');
    if (!id) { toast("Please enter a Member ID", false); return; }
    S.searchId = S.shown = id;
    const el = document.getElementById('rsResults'); if (el) el.innerHTML = searchResults(id);
  } else if (e.target.id === 'rsTokenForm') {
    e.preventDefault();
    var tk = val('rsToken');
    if (tk.length > 0) { S.token = tk; redraw(); }
    else { const er = document.getElementById('rsTokenErr'); if (er) er.hidden = false; document.getElementById('rsToken').value = ''; }
  }
});
document.addEventListener('change', e => {
  if (!mine(e)) return;
  if (e.target.id === 'rsDqFilter') { S.dqFieldFilter = e.target.value; redraw(); return; }
  const cell = e.target.closest('.rs-edit');   // markModified: gold edge when the value differs from the spreadsheet
  if (cell && e.target.tagName === 'SELECT') cell.classList.toggle('modified', e.target.value !== e.target.dataset.orig);
  if (cell && e.target.id === 'rs-club-override') cell.classList.toggle('modified', !!e.target.value.trim());
});
document.addEventListener('input', e => { if (mine(e) && e.target.id === 'rsSearch') S.searchId = e.target.value.trim(); });
