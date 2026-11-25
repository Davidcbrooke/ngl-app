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
  FB = {auth, fs, A: auth.getAuth(a), D: fs.getFirestore(a)};
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
