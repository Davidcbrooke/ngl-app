// The front of the one NGL app: the download page (phones must install the app first, as the ND Fitness app does),
// then "Club or Parent". Club = the club login; Parent = the club's family code, which opens that programme.
import { esc } from '../ui.js';
import { BRAND } from '../config.js';
import { MODE } from '../data.js';
import { showAuth } from './auth.js';

const UA = navigator.userAgent;
export const isIOS = /iphone|ipad|ipod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isMobile = isIOS || /Android/i.test(UA);
const inAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|Snapchat|WhatsApp/i.test(UA);
const iosNotSafari = isIOS && /CriOS|FxiOS|EdgiOS|GSA\//.test(UA);
const isMac = /Macintosh/i.test(UA) && !isIOS;
let deferredPrompt = null, installed = false, landOS = isIOS ? 'ios' : /Android/i.test(UA) ? 'android' : 'pc';
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (document.querySelector('.land')) showGate(); });
window.addEventListener('appinstalled', () => { installed = true; deferredPrompt = null; if (document.querySelector('.land')) showGate(); });

// Phones and tablets must install the app before using it. Computers see the download page too (install and pin it to
// the taskbar or Dock), with "Continue in the browser" for clubs and the NGL team at a desk (remembered on that computer).
// ?gate always shows it; ?demo and automated tests skip it.
export function needGate(){
  const q = new URLSearchParams(location.search);
  if (q.has('gate')) return true;
  if (isStandalone || MODE === 'demo' || navigator.webdriver) return false;
  if (isMobile) return true;
  let ok = false; try { ok = localStorage.getItem('ngl.browser') === '1'; } catch (_) {}
  return !ok;
}

const SHARE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px" aria-label="Share"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const APPLE = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8s2.3-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>';
const PC = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>';
const DROID = '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M17.6 9.5l1.7-3a.4.4 0 0 0-.7-.4l-1.8 3A10.8 10.8 0 0 0 12 8.2c-1.7 0-3.3.3-4.8.9l-1.8-3a.4.4 0 1 0-.7.4l1.7 3A9.6 9.6 0 0 0 1.5 17h21a9.6 9.6 0 0 0-4.9-7.5zM7 14.4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>';
const ico = (d, c) => `<span class="ic" style="background:${c}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg></span>`;

function installSteps(os){
  if (os === 'ios') {
    if (inAppBrowser || iosNotSafari) return `<div class="land-note"><b>Open this page in Safari first</b>Tap the <b>⋯</b> menu and choose <b>Open in Safari</b> (or copy the link into Safari). iPhone apps can only be added from Safari.</div>`;
    return `<ol class="land-steps"><li>Tap the Share button ${SHARE} at the bottom of Safari</li><li>Scroll down and tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b>. The NGL icon appears on your home screen</li><li>Open NGL from your home screen</li></ol>`;
  }
  if (os === 'pc') {
    if (installed) return `<div class="land-note ok"><b>Installed</b>NGL now opens in its own window. Right-click its icon in the taskbar and choose <b>Pin to taskbar</b>.</div>`;
    return (deferredPrompt ? `<button class="btn land-install" data-land="install">Install NGL on this computer</button><p class="land-small">Then right-click NGL in the taskbar and choose <b>Pin to taskbar</b>.</p><p class="land-small" style="text-align:left;margin-top:14px">No install button? Do it by hand:</p>` : '') +
      (isMac ? `<ol class="land-steps"><li><b>Safari:</b> click <b>File</b>, then <b>Add to Dock</b></li><li><b>Chrome:</b> click the install icon at the right of the address bar, then <b>Install</b></li><li>NGL is now in your Dock and Launchpad</li></ol>`
        : `<ol class="land-steps"><li>Open this page in <b>Chrome</b> or <b>Edge</b></li><li>Click the install icon at the right of the address bar (or the <b>⋮</b> / <b>⋯</b> menu, then <b>Install NGL</b> or <b>Apps › Install this site as an app</b>)</li><li>Click <b>Install</b>. NGL opens in its own window</li><li>Right-click the NGL icon in the taskbar and choose <b>Pin to taskbar</b></li></ol>`);
  }
  if (installed) return `<div class="land-note ok"><b>Installed</b>Open NGL from your home screen.</div>`;
  if (inAppBrowser) return `<div class="land-note"><b>Open this page in Chrome first</b>Tap the <b>⋮</b> menu and choose <b>Open in Chrome</b> (or "Open in browser").</div>`;
  return (deferredPrompt ? `<button class="btn land-install" data-land="install">Install NGL</button><p class="land-small">Then open it from your home screen.</p><p class="land-small" style="text-align:left;margin-top:14px">No install button? Do it by hand:</p>` : '') +
    `<ol class="land-steps"><li>Open this page in <b>Chrome</b></li><li>Tap the <b>⋮</b> menu at the top right</li><li>Tap <b>Install app</b> (or <b>Add to Home screen</b>)</li><li>Open NGL from your home screen</li></ol>`;
}

export function showGate(){
  const root = document.getElementById('authRoot'), os = (k, label, logo) => `<button class="osbtn ${landOS === k ? 'on' : ''}" data-land="os" data-v="${k}">${logo}<span><small>Download for</small>${label}</span></button>`;
  root.innerHTML = `<div class="land">
    <section class="land-hero"><div class="land-bar">${['#E84187', '#F8D438', '#E88230', '#0071B3', '#01AFB8', '#6AA525', '#90276A'].map(c => `<i style="background:${c}"></i>`).join('')}</div>
      <img class="land-icon" src="img/icon-512.png" alt="NGL app icon">
      <h1>The NGL app</h1>
      <p>Competitions, programmes, awards and results in one place, for British Gymnastics clubs and their families.</p></section>
    <div class="land-wrap">
      <div class="card land-card"><h2>Download the app</h2><p class="land-small">Choose your device</p>
        <div class="osbtns">${os('ios', 'iPhone', APPLE)}${os('android', 'Android', DROID)}${os('pc', 'Computer', PC)}</div>
        <div class="land-stepsbox">${installSteps(landOS)}</div>
        ${isMobile ? '' : `<p class="land-small" style="margin-top:16px"><a href="#" data-land="browser">Continue in the browser</a></p>`}
      </div>
      <div class="card land-card"><h2>What's inside</h2>
        ${[[ico('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4"/>', '#0073b3'), 'Families', 'Your gymnast’s awards, progress and results: enter your club’s code'],
           [ico('<path d="M3 21h18M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/>', '#28225c'), 'Clubs', 'Competitions, floor music, programmes, lesson plans and orders'],
           [ico('<path d="M12 2l3 6.5 7 1-5 5 1.2 7L12 18l-6.2 3.5L7 14.5l-5-5 7-1z"/>', '#c6152e'), 'Seven pathways', 'Pre-School, Schools, Recreational, General League, Performance, University and Masters']]
          .map(([i, t, s]) => `<div class="land-li">${i}<div><b>${t}</b><small>${s}</small></div></div>`).join('')}
      </div>
      <p class="land-foot">Exclusively for British Gymnastics Clubs</p>
    </div></div>`;
  root.hidden = false; document.querySelector('.app').hidden = true;
  root.querySelectorAll('[data-land]').forEach(b => b.addEventListener('click', e => { e.preventDefault();
    if (b.dataset.land === 'os') { landOS = b.dataset.v; showGate(); }
    if (b.dataset.land === 'browser') { try { localStorage.setItem('ngl.browser', '1'); } catch (_) {} location.reload(); return; }
    if (b.dataset.land === 'install' && deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(r => { if (r.outcome === 'accepted') installed = true; deferredPrompt = null; showGate(); }); }
  }));
}

// Club or Parent: the first screen of the installed app
export function showWelcome(){
  const root = document.getElementById('authRoot');
  root.innerHTML = `<div class="auth"><div><div class="box welcome">
    <img class="logo" src="${BRAND}ngl-logo-full.png" alt="National Gymnastics League">
    <h1>Welcome</h1><p class="lead">Are you a club or a parent?</p>
    <button class="who-btn" data-who="club">${ico('<path d="M3 21h18M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/>', '#28225c')}<span><b>Club</b><small>Log in with your club email</small></span></button>
    <button class="who-btn" data-who="parent">${ico('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.2c3 .2 5.5 2.3 5.5 5.8"/>', '#0073b3')}<span><b>Parent</b><small>Enter the code your club gave you</small></span></button>
    </div><p class="foot">Exclusively for British Gymnastics Clubs</p></div></div>`;
  root.hidden = false; document.querySelector('.app').hidden = true;
  root.querySelector('[data-who=club]').addEventListener('click', () => { try { localStorage.setItem('ngl.who', 'club'); } catch (_) {} showAuth('login'); });
  root.querySelector('[data-who=parent]').addEventListener('click', () => showParent());
}

// Parent: the family code (each programme has its own code, as today); the code decides which programme opens
export function showParent(msg = ''){
  const root = document.getElementById('authRoot');
  root.innerHTML = `<div class="auth"><div><div class="box welcome">
    <img class="logo" src="${BRAND}ngl-logo-full.png" alt="National Gymnastics League">
    <h1>Parent</h1><p class="lead">Enter the code your club gave you. It opens your gymnast’s programme: Pre-School, Schools, Recreational or General League.</p>
    <form id="pf"><label class="field"><span>Club code</span><input id="pcode" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>
    <p class="err" id="perr">${esc(msg)}</p><button class="btn" style="width:100%;justify-content:center">Continue</button></form>
    <p class="alt"><a href="#" data-back>Back</a></p></div><p class="foot">Exclusively for British Gymnastics Clubs</p></div></div>`;
  root.hidden = false; document.querySelector('.app').hidden = true;
  root.querySelector('[data-back]').addEventListener('click', e => { e.preventDefault(); showWelcome(); });
  root.querySelector('#pcode').focus();
  root.querySelector('#pf').addEventListener('submit', async e => {
    e.preventDefault(); const code = root.querySelector('#pcode').value.trim().toUpperCase(), err = root.querySelector('#perr'), b = e.target.querySelector('button');
    b.disabled = true; err.textContent = '';
    try { const { openFamily } = await import('./family.js'); await openFamily(code); }
    catch (x) { console.error(x); err.textContent = x.message || 'That code didn’t work. Check it with your club.'; b.disabled = false; }
  });
}
