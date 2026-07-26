/* ============================================================
   loginScript.js — Firebase Auth gate for the Marketing Engine.

   Exposes:
     window.checkSignedInGeneral(onSignedIn)
   which:
     - Initializes Firebase if not already
     - If signed in, calls onSignedIn(user)
     - If not, renders an auth card (email/password + Google) in
       <body> and calls onSignedIn after a successful sign-in.
   ============================================================ */

(function () {
  // Firebase v8 web SDK config — same project as compAI.
  // apiKey is safe to ship to the client; the security boundary is rules + auth.
  var FB_CONFIG = {
    apiKey: 'AIzaSyA8e8dtdrV1eG1XfQo3IvbtT-YK47y8Snk',
    authDomain: 'compai-57d55.firebaseapp.com',
    databaseURL: 'https://compai-57d55-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'compai-57d55',
    storageBucket: 'compai-57d55.firebasestorage.app',
    messagingSenderId: '510729543987',
    appId: '1:510729543987:web:a6f04b45e6a1af2de7de46'
  };

  function initFirebase() {
    if (!window.firebase || !firebase.apps) return;
    if (firebase.apps.length === 0) firebase.initializeApp(FB_CONFIG);
  }

  function renderAuthCard(onSignedIn) {
    // Wipe page, render auth card.
    document.body.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'mkt-auth-wrap';
    wrap.innerHTML = ''
      + '<div class="mkt-auth-card">'
      +   '<div class="mkt-logo"><span class="mkt-logo-dot"></span> Marketing Engine</div>'
      +   '<h1>Sign in to continue</h1>'
      +   '<p class="lede">Your workshop session lives behind sign-in so you can come back to it any time.</p>'
      +   '<button class="mkt-btn mkt-btn-ghost mkt-btn-lg" id="btn-google" style="width:100%; justify-content:center;">'
      +     '<svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5c-7.3 0-13.7 4-17.1 9.9-.2.1-.4.2-.6.3z"/><path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13.1-5l-6.1-5c-1.9 1.3-4.3 2.1-7 2.1-5.3 0-9.8-3.1-11.4-7.5l-6.5 5C9.5 38.9 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-3.9 5.3l6.1 5c-.4.4 6.5-4.7 6.5-14.3 0-1.2-.1-2.3-.4-3.5z"/></svg>'
      +     'Continue with Google'
      +   '</button>'
      +   '<div class="mkt-auth-or">or with email</div>'
      +   '<div class="mkt-field"><input class="mkt-input" id="auth-email" type="email" placeholder="you@company.com" autocomplete="email" /></div>'
      +   '<div class="mkt-field"><input class="mkt-input" id="auth-pass"  type="password" placeholder="Password (min 6 chars)" autocomplete="current-password" /></div>'
      +   '<div class="mkt-row">'
      +     '<button class="mkt-btn mkt-btn-primary" id="btn-signin" style="flex:1; justify-content:center;">Sign in</button>'
      +     '<button class="mkt-btn mkt-btn-soft"    id="btn-create" style="flex:1; justify-content:center;">Create account</button>'
      +   '</div>'
      +   '<p id="auth-err" class="mkt-hint" style="color:var(--danger); margin-top:12px; min-height:18px;"></p>'
      + '</div>';
    document.body.appendChild(wrap);

    var emailEl = document.getElementById('auth-email');
    var passEl  = document.getElementById('auth-pass');
    var errEl   = document.getElementById('auth-err');

    function showErr(e) {
      var msg = (e && e.message) ? e.message : String(e);
      errEl.textContent = msg.replace(/^Firebase:\s*/, '');
    }

    document.getElementById('btn-google').onclick = function () {
      var provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider).catch(showErr);
    };
    document.getElementById('btn-signin').onclick = function () {
      errEl.textContent = '';
      firebase.auth().signInWithEmailAndPassword(emailEl.value.trim(), passEl.value).catch(showErr);
    };
    document.getElementById('btn-create').onclick = function () {
      errEl.textContent = '';
      firebase.auth().createUserWithEmailAndPassword(emailEl.value.trim(), passEl.value).catch(showErr);
    };
  }

  window.checkSignedInGeneral = function (onSignedIn) {
    initFirebase();
    var settled = false;
    firebase.auth().onAuthStateChanged(function (user) {
      if (user && !settled) {
        settled = true;
        onSignedIn(user);
      } else if (!user) {
        renderAuthCard(onSignedIn);
      }
    });
  };
})();
