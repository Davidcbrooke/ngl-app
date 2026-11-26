// Judging Pathway: the judge's data. Same collections and fields as the live judging app
// (GYMNASTICS-RESULTS/ngl-judging-pathway.html), so NGL Admin > Judging and Staffing keep working:
//   ngl_judges/{judge uid}                = {name, club, email, phone, qualifications:[{discipline, level}], qualification, photoUrl,
//                                            priorShadowed, priorSecondJudged, createdAt, quizBestWag?, quizBestMag?}
//   ngl_judging_assignments/{auto id}     = {judgeUid, judgeName, compId, compName, compDate, compVenue, discipline, piece, role,
//                                            status:'pending', assignedAt, judgingMode?, quotedFee?}  (NGL confirms or declines)
//   ngl_judge_notifications/{auto id}     = {judgeUid, type, message, createdAt}  (written by NGL Admin > Judging)
//   ngl_resources/{auto id}               = {title, description, category, type:'file'|'link', url, createdAt}
//   Storage judge-photos/{uid}            = the judge's photo
// Competitions: the app's own calendar (competitions/{id}, the same list clubs book from) instead of the old ngl_competitions.
// Judges log in with Firebase Auth in the app's own project. A judge has NO clubs/{uid} document.
// ?demo keeps everything in memory and never writes. ?demo&judge=new starts signed out.
import { fb } from '../firebase.js';
import api, { MODE, CALENDAR } from '../data.js';
import { RULES_BASE } from '../config.js';

export const LIVE = MODE !== 'demo';
const C = { judges: 'ngl_judges', assigns: 'ngl_judging_assignments', notifs: 'ngl_judge_notifications', res: 'ngl_resources' };
const now = () => new Date().toISOString();

// The app's competitions have where/who; the judging pages use venue/level/gender (girls · boys · both)
function genderOf(c){
  if (['girls', 'boys', 'both'].includes(c.gender)) return c.gender;
  const t = `${c.who || ''} ${c.name || ''} ${c.level || ''}`;
  const g = /girl|wag/i.test(t), b = /boy|mag/i.test(t);
  return g && b ? 'both' : b ? 'boys' : 'girls';
}
const toComp = c => ({ id: c.id, name: c.name || '', date: c.date || '', venue: c.where || c.venue || '', level: c.level || c.who || '', gender: genderOf(c) });

/* ---------- sample data (?demo&judge): Megan Hart, an Apprentice Judge with one shadow before NGL and one at the Finals ---------- */
const iso = (d, h = 10) => new Date(Date.now() - d * 864e5 + h * 36e5).toISOString();
const DEMO_ME = { uid: 'demo-j4', email: 'megan@example.com' };
const DEMO = {
  profile: { name: 'Megan Hart', club: 'SAADI Gymnastics', email: 'megan@example.com', phone: '07700 900333', qualifications: [], qualification: 'None',
    photoUrl: '', priorShadowed: 1, priorSecondJudged: 0, createdAt: iso(20), quizBestWag: 72 },
  assigns: [
    { id: 'demo-a4', judgeUid: 'demo-j4', judgeName: 'Megan Hart', compId: 'c1', compName: 'General League · East Region', compDate: '2027-02-07', compVenue: 'SAADI Gymnastics, Harpenden', discipline: 'WAG', piece: 'Beam', role: 'shadow', status: 'pending', assignedAt: iso(1) },
    { id: 'demo-a6', judgeUid: 'demo-j4', judgeName: 'Megan Hart', compId: 'ngl-2026-finals-a', compName: 'NGL National Finals: Level A', compDate: '2026-11-22', compVenue: '', discipline: 'WAG', piece: 'Floor', role: 'shadow', status: 'confirmed', confirmedTime: '08:30', payment: 0, assignedAt: iso(40), confirmedAt: iso(38) },
    // other judges' confirmed bookings (the Judging Calendar shows these)
    { id: 'demo-a1', judgeUid: 'demo-j1', judgeName: 'Sarah Collins', compId: 'c1', compName: 'General League · East Region', compDate: '2027-02-07', compVenue: 'SAADI Gymnastics, Harpenden', discipline: 'WAG', piece: 'Vault', role: 'judge', status: 'confirmed', judgingMode: 'in person', quotedFee: 75, confirmedTime: '09:00', payment: 75, assignedAt: iso(25), confirmedAt: iso(24) },
    { id: 'demo-a7', judgeUid: 'demo-j3', judgeName: 'Tom Ellis', compId: 'c1', compName: 'General League · East Region', compDate: '2027-02-07', compVenue: 'SAADI Gymnastics, Harpenden', discipline: 'WAG', piece: 'Uneven Bars', role: 'second_judge', status: 'confirmed', confirmedTime: '09:00', payment: 50, assignedAt: iso(22), confirmedAt: iso(21) }
  ],
  notifs: [
    { id: 'demo-n1', judgeUid: 'demo-j4', type: 'confirmed', message: "You're booked! You've been confirmed as Shadow for Floor (WAG) at NGL National Finals: Level A. Time: 08:30. Payment: £0.", createdAt: iso(38) }
  ],
  resources: [
    { id: 'demo-r1', title: 'NGL 2027 WAG Rules', description: 'General League Levels 1 to 4', category: 'Rules & Handbooks', type: 'file', url: RULES_BASE + 'NGL_General_League_WAG_Rules_2027.pdf', createdAt: iso(30) },
    { id: 'demo-r2', title: 'WAG Element Book 2027', description: 'Uncoded and common coded elements', category: 'Rules & Handbooks', type: 'file', url: RULES_BASE + 'NGL_General_League_WAG_Element_Guide_2027.pdf', createdAt: iso(28) },
    { id: 'demo-r3', title: 'British Gymnastics judging courses', description: 'Club, Regional and National judge courses', category: 'BG Courses & Links', type: 'link', url: 'https://www.british-gymnastics.org/', createdAt: iso(20) }
  ]
};
let demoUser = new URLSearchParams(location.search).get('judge') === 'new' ? null : DEMO_ME;
let demoProfile = demoUser ? { ...DEMO.profile } : null;

/* ---------- state the screens read ---------- */
export const S = { user: null, profile: null, comps: [], assigns: [], notifs: [], resources: [], errs: [], ready: false };
let onChange = () => {};
export function watch(fn){ onChange = fn; }
let unsubs = [];
const stop = () => { unsubs.forEach(u => { try { u(); } catch (_) {} }); unsubs = []; };
const err = (what, e) => { console.error(e); const m = `Couldn't read ${what} (${e.code || e.message}).`; if (!S.errs.includes(m)) S.errs.push(m); };

async function loadComps(){
  if (!LIVE) return CALENDAR.map(toComp);
  try { return (await api.calendar()).map(toComp); } catch (e) { err('the competition calendar', e); return []; }
}

// Live lists for a signed-in judge: their own applications and bookings, everyone's confirmed bookings (the Judging Calendar),
// their notifications, and the resources library. Same as the live app, which listens to all of these.
async function listen(){
  stop();
  const { fs, D } = await fb(), uid = S.user.uid, col = n => fs.collection(D, n);
  const mine = new Map(), confirmed = new Map();
  const merge = () => { const all = new Map([...confirmed, ...mine]); S.assigns = [...all.values()]; };
  const sub = (q, label, fn) => new Promise(res => { let first = true;
    unsubs.push(fs.onSnapshot(q, snap => { fn(snap); if (first) { first = false; res(); } else onChange(); },
      e => { err(label, e); if (first) { first = false; res(); } })); });
  await Promise.all([
    sub(fs.query(col(C.assigns), fs.where('judgeUid', '==', uid)), 'your applications', snap => { mine.clear(); snap.docs.forEach(d => mine.set(d.id, { id: d.id, ...d.data() })); merge(); }),
    sub(fs.query(col(C.assigns), fs.where('status', '==', 'confirmed')), 'the judging calendar', snap => { confirmed.clear(); snap.docs.forEach(d => confirmed.set(d.id, { id: d.id, ...d.data() })); merge(); }),
    sub(fs.query(col(C.notifs), fs.where('judgeUid', '==', uid)), 'your notifications', snap => { S.notifs = snap.docs.map(d => ({ id: d.id, ...d.data() })); }),
    sub(col(C.res), 'the resources', snap => { S.resources = snap.docs.map(d => ({ id: d.id, ...d.data() })); })
  ]);
}

// Load everything for whoever is signed in (or nobody)
export async function load(){
  S.errs = []; S.ready = false;
  if (!LIVE) {
    S.user = demoUser; S.profile = demoProfile;
    S.comps = CALENDAR.map(toComp);
    S.assigns = demoUser ? DEMO.assigns.map(a => ({ ...a })) : [];
    S.notifs = demoUser ? DEMO.notifs.filter(n => n.judgeUid === demoUser.uid).map(n => ({ ...n })) : [];
    S.resources = demoUser ? DEMO.resources.map(r => ({ ...r })) : [];
    S.ready = true; return S;
  }
  stop();
  const { auth, fs, A, D } = await fb();
  S.user = await new Promise(res => { const off = auth.onAuthStateChanged(A, u => { off(); res(u); }); });
  S.profile = null; S.assigns = []; S.notifs = []; S.resources = []; S.comps = [];
  if (S.user) {
    try { const snap = await fs.getDoc(fs.doc(D, C.judges, S.user.uid)); S.profile = snap.exists() ? snap.data() : null; }
    catch (e) { err('your pathway profile', e); }
    // The lists open once the judge has a profile (a login still finishing its profile only sees that form)
    const [comps] = await Promise.all([loadComps(), S.profile ? listen().catch(e => err('the judging lists', e)) : null]);
    S.comps = comps;
  }
  S.ready = true; return S;
}

// Does the signed-in login have a judge profile? (app.js uses this for a login with no club)
export async function hasProfile(){
  if (!LIVE) return !!demoProfile;
  try { const { fs, A, D } = await fb(); if (!A.currentUser) return false; return (await fs.getDoc(fs.doc(D, C.judges, A.currentUser.uid))).exists(); }
  catch (_) { return false; }
}

/* ---------- account ---------- */
export async function signIn(email, pw){
  if (!LIVE) { demoUser = { uid: 'demo-new', email }; demoProfile = null; return; }
  const { auth, A } = await fb(); await auth.signInWithEmailAndPassword(A, email, pw);
}
export async function signOut(){
  if (!LIVE) { demoUser = null; demoProfile = null; return; }
  stop(); const { auth, A } = await fb(); await auth.signOut(A);
}
export async function resetPassword(email){
  if (!LIVE) return;
  const { auth, A } = await fb(); await auth.sendPasswordResetEmail(A, email);
}
// The login only (no profile yet): the register screen writes the profile straight after, and the
// "Finish setting up" screen writes it for this same login if that write didn't finish.
export async function createLogin(email, pw){
  if (!LIVE) { demoUser = { uid: 'demo-new', email }; demoProfile = null; return demoUser; }
  const { auth, A } = await fb(); const cred = await auth.createUserWithEmailAndPassword(A, email, pw); return cred.user;
}
export async function currentLogin(){
  if (!LIVE) return demoUser;
  const { A } = await fb(); return A.currentUser;
}
export async function uploadPhoto(uid, file){
  if (!LIVE) return URL.createObjectURL(file);
  const st = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
  const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const photoRef = st.ref(st.getStorage(getApp()), 'judge-photos/' + uid);
  await st.uploadBytes(photoRef, file);
  return st.getDownloadURL(photoRef);
}
// setDoc: create the profile (register, finish setting up)
export async function saveProfile(uid, profile){
  if (!LIVE) { demoProfile = { ...profile }; return; }
  const { fs, D } = await fb(); await fs.setDoc(fs.doc(D, C.judges, uid), profile);
}
// updateDoc: edit my profile, photo, quiz personal bests
export async function updateProfile(uid, patch){
  if (!LIVE) { Object.assign(demoProfile, patch); return; }
  const { fs, D } = await fb(); await fs.updateDoc(fs.doc(D, C.judges, uid), patch);
}

/* ---------- applications ---------- */
export async function addAssignment(rec){
  if (!LIVE) { S.assigns.push({ id: 'demo-a' + Date.now(), ...rec }); DEMO.assigns = S.assigns.map(a => ({ ...a })); return; }
  const { fs, D } = await fb(); await fs.addDoc(fs.collection(D, C.assigns), rec);
}
export async function deleteAssignment(id){
  if (!LIVE) { S.assigns = S.assigns.filter(a => a.id !== id); DEMO.assigns = S.assigns.map(a => ({ ...a })); return; }
  const { fs, D } = await fb(); await fs.deleteDoc(fs.doc(D, C.assigns, id));
}
export { now };
