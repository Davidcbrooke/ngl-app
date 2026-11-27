/**
 * NGL one app: MOVE LOGINS (rehearsal into the STAGING project only).
 * Copies every email login from the old Firebase projects into the new one, keeping each person's user id (so their
 * club / judge records still match) and their password exactly as it is: Firebase copies the scrambled password and
 * the old project's scrambling settings, so nobody's password is ever seen, decoded or reset.
 *   ngl-schools     = the Club Hub, Schools and Recreational hubs (clubs, and admin@ / bookingoffice@)
 *   saadi-rotation  = the NGL Admin Hub team and the Judging Pathway judges
 * If an email is already a login in the target (e.g. the same person in both old projects), it is skipped and listed.
 * Run: moveLogins (rehearsal). Then read the log. Nothing in the old projects is changed (GET only).
 * Manifest scopes: script.external_request, cloud-platform.
 */
const SOURCES = ['ngl-schools', 'saadi-rotation'];
const TARGET = 'ngl-club-hub-staging';
const IT = 'https://identitytoolkit.googleapis.com';

function auth_(project){ return {Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': project}; }
function get_(url, project){
  const r = UrlFetchApp.fetch(url, {headers: auth_(project), muteHttpExceptions: true});
  if (r.getResponseCode() !== 200) throw new Error('Read ' + url.split('/projects/')[1] + ' ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText());
}
// The old project's password scrambling settings (needed so Firebase can check the copied passwords)
function hashConfig_(project){ return get_(IT + '/admin/v2/projects/' + project + '/config', project).signIn.hashConfig; }
function users_(project){
  const out = []; let tok = '';
  do { const j = get_(IT + '/v1/projects/' + project + '/accounts:batchGet?maxResults=500' + (tok ? '&nextPageToken=' + encodeURIComponent(tok) : ''), project);
    (j.users || []).forEach(u => out.push(u)); tok = j.nextPageToken || ''; } while (tok);
  return out;
}
const mask = e => String(e).replace(/^(.).*(@.*)$/, '$1•••$2');

function moveLogins(){
  if (TARGET !== 'ngl-club-hub-staging') throw new Error('Rehearsal writes to staging only');
  const have = {}; users_(TARGET).forEach(u => { if (u.email) have[u.email.toLowerCase()] = u.localId; });
  Logger.log('Logins already in ' + TARGET + ': ' + Object.keys(have).length);
  SOURCES.forEach(p => {
    const hc = hashConfig_(p), all = users_(p), todo = [], skipped = [];
    all.forEach(u => { const e = String(u.email || '').toLowerCase(); if (!e) return;
      if (have[e]) { skipped.push(mask(e) + (have[e] === u.localId ? ' (already copied)' : ' (email already a login in the new app: different id)')); return; }
      have[e] = u.localId; todo.push(u); });
    let ok = 0; const errs = [];
    for (let i = 0; i < todo.length; i += 500) {
      const chunk = todo.slice(i, i + 500);
      const body = {users: chunk.map(u => { const x = {localId: u.localId, email: u.email, emailVerified: !!u.emailVerified, disabled: !!u.disabled};
          if (u.passwordHash) { x.passwordHash = u.passwordHash; x.salt = u.salt || ''; }
          if (u.displayName) x.displayName = u.displayName; if (u.createdAt) x.createdAt = u.createdAt; if (u.lastLoginAt) x.lastLoginAt = u.lastLoginAt;
          return x; }),
        hashAlgorithm: hc.algorithm, signerKey: hc.signerKey, saltSeparator: hc.saltSeparator, rounds: hc.rounds, memoryCost: hc.memoryCost};
      const r = UrlFetchApp.fetch(IT + '/v1/projects/' + TARGET + '/accounts:batchCreate', {method: 'post', contentType: 'application/json', headers: auth_(TARGET), payload: JSON.stringify(body), muteHttpExceptions: true});
      if (r.getResponseCode() !== 200) throw new Error('Write ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
      const j = JSON.parse(r.getContentText()); const bad = (j.error || []);
      bad.forEach(e => errs.push(mask(chunk[e.index].email) + ': ' + e.message));
      ok += chunk.length - bad.length;
    }
    Logger.log(p + ': ' + all.length + ' logins · copied ' + ok + ' · skipped ' + skipped.length + ' · errors ' + errs.length +
      ' · scrambling ' + hc.algorithm + ' (rounds ' + hc.rounds + ', memory ' + hc.memoryCost + ')');
    if (skipped.length) Logger.log('  skipped: ' + skipped.join(', '));
    if (errs.length) Logger.log('  errors: ' + errs.join(' | '));
  });
}

// Run first: can the script read both old projects and the new one? (counts only)
function checkAccess(){ SOURCES.concat([TARGET]).forEach(p => Logger.log(p + ': ' + users_(p).length + ' logins')); }

// Sandbox-only logins that share an email with a real login (made in staging before the copy, so a different id):
// remove them from STAGING only, then copy the real ones across with their real passwords. Dave approved 27 Nov 2026.
function replaceSandboxLogins(){
  if (TARGET !== 'ngl-club-hub-staging') throw new Error('Staging only');
  const real = {}; SOURCES.forEach(p => users_(p).forEach(u => { if (u.email) (real[u.email.toLowerCase()] = real[u.email.toLowerCase()] || {})[u.localId] = 1; }));
  const gone = users_(TARGET).filter(u => u.email && real[u.email.toLowerCase()] && !real[u.email.toLowerCase()][u.localId]);
  Logger.log('Sandbox-only logins to replace: ' + gone.length + ' · ' + gone.map(u => mask(u.email)).join(', '));
  if (gone.length) {
    const r = UrlFetchApp.fetch(IT + '/v1/projects/' + TARGET + '/accounts:batchDelete', {method: 'post', contentType: 'application/json', headers: auth_(TARGET),
      payload: JSON.stringify({localIds: gone.map(u => u.localId), force: true}), muteHttpExceptions: true});
    if (r.getResponseCode() !== 200) throw new Error('Delete ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
    Logger.log('Removed from staging: ' + gone.length);
  }
  moveLogins();
}

// Run once: copies new logins into staging every night, 3am to 4am (UK). Needs the script.scriptapp scope.
function setupNightly(){
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'moveLogins').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('moveLogins').timeBased().everyDays(1).atHour(3).inTimezone('Europe/London').create();
  Logger.log('Nightly login copy set: moveLogins, every day 3am to 4am');
}
