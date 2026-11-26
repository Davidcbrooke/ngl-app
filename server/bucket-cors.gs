/**
 * NGL Club Hub: let the two NGL websites download files from the STAGING file store (CORS).
 * Needed by the music player's "Save all music to this laptop", the zips and the backup.
 * Run setStagingCors once. It changes nothing else. At switch-over, run it again with the live bucket.
 * Manifest (appsscript.json) scopes: script.external_request, devstorage.full_control.
 */
const BUCKET = 'ngl-club-hub-staging.firebasestorage.app';
const ORIGINS = ['https://davidcbrooke.github.io', 'https://club.nationalgymnasticsleague.co.uk'];

function setStagingCors(){
  const r = UrlFetchApp.fetch('https://storage.googleapis.com/storage/v1/b/' + BUCKET + '?fields=cors', {
    method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    payload: JSON.stringify({cors: [{origin: ORIGINS, method: ['GET', 'HEAD'], responseHeader: ['Content-Type', 'Content-Length'], maxAgeSeconds: 3600}]})
  });
  Logger.log(r.getResponseCode() + ' ' + r.getContentText());
}

function showCors(){
  const r = UrlFetchApp.fetch('https://storage.googleapis.com/storage/v1/b/' + BUCKET + '?fields=cors', {headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
  Logger.log(r.getResponseCode() + ' ' + r.getContentText());
}
