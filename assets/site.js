/*
 * Kampus Demo — fake sign-in for automation tests.
 * Everything runs in the browser: there is no server and no real account.
 * The session lives in localStorage so it is shared by every tab of one browser profile.
 */
(function () {
  'use strict';

  var SESSION = 'demo.session';
  var FAILS = 'demo.fails';
  var DEFAULT_TTL_S = 600; // session length; override with login.html?ttl=<seconds>
  var LOCK_AFTER = 3; // wrong attempts before the form locks
  var LOCK_S = 60;
  var ACCOUNTS = {
    'mahasiswa': 'demo-2026',
    'mahasiswa@demo.kampus.test': 'demo-2026'
  };

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }
  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) { /* storage blocked */ }
  }

  function params() {
    var out = {};
    new URLSearchParams(location.search).forEach(function (v, k) { out[k] = v; });
    return out;
  }

  // Only plain page names, so the service parameter cannot send anyone elsewhere.
  function safeService(value) {
    return /^[a-z0-9_-]+\.html$/i.test(value || '') ? value : 'dashboard.html';
  }

  function currentPage() {
    var name = location.pathname.split('/').pop();
    return name || 'index.html';
  }

  function liveSession() {
    var s = read(SESSION);
    return s && s.exp > Date.now() ? s : null;
  }

  function requireAuth() {
    var raw = read(SESSION);
    var live = raw && raw.exp > Date.now();
    if (live) {
      document.querySelectorAll('[data-user]').forEach(function (el) { el.textContent = raw.name; });
      return;
    }
    var expired = !!raw;
    drop(SESSION);
    var target = 'login.html?service=' + encodeURIComponent(currentPage()) + (expired ? '&expired=1' : '');
    location.replace(target);
  }

  function initLogin() {
    var p = params();
    var form = document.getElementById('login-form');
    var errorBox = document.getElementById('error');
    var infoBox = document.getElementById('info');
    var service = safeService(p.service);

    if (liveSession() && !p.expired) {
      location.replace(service);
      return;
    }
    if (p.expired) {
      infoBox.textContent = 'Sesi Anda berakhir. Silakan masuk kembali.';
      infoBox.hidden = false;
    }

    function fail(message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      errorBox.hidden = true;

      var fails = read(FAILS) || { count: 0, lockedUntil: 0 };
      if (fails.lockedUntil > Date.now()) {
        var wait = Math.ceil((fails.lockedUntil - Date.now()) / 1000);
        fail('Terlalu banyak percobaan. Coba lagi dalam ' + wait + ' detik.');
        return;
      }

      var user = form.elements.username.value.trim();
      var pass = form.elements.password.value;
      var valid = Object.prototype.hasOwnProperty.call(ACCOUNTS, user.toLowerCase()) &&
        ACCOUNTS[user.toLowerCase()] === pass;

      if (!valid) {
        fails.count += 1;
        if (fails.count >= LOCK_AFTER) {
          fails.lockedUntil = Date.now() + LOCK_S * 1000;
          fails.count = 0;
          fail('NetID atau kata sandi salah. Form dikunci selama ' + LOCK_S + ' detik.');
        } else {
          fail('NetID atau kata sandi salah. (' + fails.count + ' dari ' + LOCK_AFTER + ' percobaan)');
        }
        write(FAILS, fails);
        form.elements.password.value = '';
        return;
      }

      drop(FAILS);
      var ttl = parseInt(p.ttl, 10);
      if (!(ttl >= 5 && ttl <= 3600)) ttl = DEFAULT_TTL_S;
      write(SESSION, { user: user, name: 'Mahasiswa Demo', exp: Date.now() + ttl * 1000 });
      location.replace(service);
    });
  }

  function initLogout() {
    drop(SESSION);
  }

  function initIndex() {
    location.replace(liveSession() ? 'dashboard.html' : 'login.html?service=dashboard.html');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var body = document.body;
    if (body.hasAttribute('data-auth')) requireAuth();
    else if (body.hasAttribute('data-login')) initLogin();
    else if (body.hasAttribute('data-logout')) initLogout();
    else if (body.hasAttribute('data-index')) initIndex();
  });
})();
