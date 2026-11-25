// Sign in, register and reset password: the only screens a signed-out club sees.
import api from '../data.js';
import { authMessage } from '../firebase.js';
import { esc } from '../ui.js';
import { BRAND } from '../config.js';

const shell = (inner) => `<div class="auth"><div><div class="box">
  <img class="logo" src="${BRAND}ngl-logo-full.png" alt="National Gymnastics League">${inner}</div>
  <p class="foot">Exclusively for British Gymnastics Clubs · <a style="color:#fff" href="?demo#/home">Look around with sample data</a></p></div></div>`;
const field = (id, label, type = 'text', extra = '') => `<label class="field"><span>${label}</span><input id="${id}" type="${type}" ${extra}></label>`;

export function showAuth(mode = 'login', msg = ''){
  const root = document.getElementById('authRoot');
  if (mode === 'register') root.innerHTML = shell(`<h1>Register your club</h1><p class="lead">Free for British Gymnastics clubs. One login for every NGL programme.</p>
    <form id="f">${field('name', 'Club name', 'text', 'required autocomplete="organization"')}${field('contact', 'Your name', 'text', 'required autocomplete="name"')}
    ${field('bg', 'BG club number (optional)')}${field('email', 'Club email (this is your login)', 'email', 'required autocomplete="email"')}
    ${field('pw', 'Password (8 characters or more)', 'password', 'required minlength="8" autocomplete="new-password"')}
    <p class="err" id="err">${esc(msg)}</p><button class="btn" style="width:100%;justify-content:center">Create club account</button></form>
    <p class="alt">Already registered? <a href="#" data-mode="login">Log in</a></p>`);
  else if (mode === 'reset') root.innerHTML = shell(`<h1>Reset password</h1><p class="lead">We’ll email you a link to set a new password.</p>
    <form id="f">${field('email', 'Club email', 'email', 'required autocomplete="email"')}<p class="err" id="err">${esc(msg)}</p>
    <button class="btn" style="width:100%;justify-content:center">Email me a link</button></form><p class="alt"><a href="#" data-mode="login">Back to log in</a></p>`);
  else root.innerHTML = shell(`<h1>Club Hub</h1><p class="lead">Your competitions, programmes, orders and rules in one place.</p>
    <form id="f">${field('email', 'Club email', 'email', 'required autocomplete="email"')}${field('pw', 'Password', 'password', 'required autocomplete="current-password"')}
    <p class="err" id="err">${esc(msg)}</p><button class="btn" style="width:100%;justify-content:center">Log in</button></form>
    <p class="alt"><a href="#" data-mode="reset">Forgotten password?</a> · New to NGL? <a href="#" data-mode="register">Register your club</a></p>`);
  root.hidden = false; document.querySelector('.app').hidden = true;
  root.querySelectorAll('[data-mode]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); showAuth(a.dataset.mode); }));
  const f = root.querySelector('#f'), err = root.querySelector('#err'), v = id => (root.querySelector('#' + id) || {}).value?.trim();
  root.querySelector('input').focus();
  f.addEventListener('submit', async e => {
    e.preventDefault(); const b = f.querySelector('button'); b.disabled = true; err.textContent = '';
    try {
      if (mode === 'register') await api.register({name: v('name'), contact: v('contact'), bgNumber: v('bg'), email: v('email'), password: root.querySelector('#pw').value});
      else if (mode === 'reset') { await api.reset(v('email')); err.style.color = 'var(--ok)'; err.textContent = 'Sent. Check your inbox (and junk folder).'; b.disabled = false; return; }
      else await api.signIn(v('email'), root.querySelector('#pw').value);
      location.reload();
    } catch (x) { console.error(x); err.style.color = ''; err.textContent = authMessage(x); b.disabled = false; }
  });
}
