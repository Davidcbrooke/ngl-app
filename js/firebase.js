// Firebase loader: same SDK version as today's hubs. Points at the staging
// project in the sandbox; the live project is only used after switch-over.
import { ENV, FIREBASE_STAGING } from './config.js';

const V = '10.12.2';
let FB = null;
export async function fb(){
  if (FB) return FB;
  if (ENV === 'live') throw new Error('Live database not connected yet (switch-over step).');
  const [app, auth, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  const a = app.initializeApp(FIREBASE_STAGING);
  // Offline storage on (as the old music tool had): reads work and changes are kept while offline, then sent when the connection returns
  let D; try { D = fs.initializeFirestore(a, {localCache: fs.persistentLocalCache({tabManager: fs.persistentMultipleTabManager()})}); } catch (e) { console.warn('Offline storage not available', e); D = fs.getFirestore(a); }
  FB = {auth, fs, A: auth.getAuth(a), D};
  return FB;
}

// Friendly messages for the sign-in errors clubs actually hit.
export function authMessage(e){
  const c = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'That email and password don’t match. Check them, or reset your password.';
  if (/email-already-in-use/.test(c)) return 'There’s already a club account with that email. Log in instead.';
  if (/weak-password/.test(c)) return 'Use a password of at least 8 characters.';
  if (/invalid-email/.test(c)) return 'That doesn’t look like an email address.';
  if (/too-many-requests/.test(c)) return 'Too many tries. Wait a minute and try again.';
  if (/network/.test(c)) return 'No connection. Check your internet and try again.';
  return 'Something went wrong. Please try again, or email admin@nationalgymnasticsleague.co.uk.';
}

// NGL team invite: make their login on a second app instance (so the owner stays signed in),
// then email them a link to set their own password. Made-up example.com addresses get no email.
export async function inviteLogin(email){
  const {auth, A} = await fb();
  const app = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const a2 = app.getApps().find(x => x.name === 'invite') || app.initializeApp(FIREBASE_STAGING, 'invite');
  const A2 = auth.getAuth(a2);
  try { await auth.createUserWithEmailAndPassword(A2, email, crypto.randomUUID() + 'Aa1!'); }
  catch (e) { if (e.code !== 'auth/email-already-in-use') throw e; }
  await auth.signOut(A2);
  if (!/@example\.com$/i.test(email)) await auth.sendPasswordResetEmail(A, email);
}
