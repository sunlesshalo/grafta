// ── auth.js — Google Identity Services + gapi client ──
// Matches tunetnaplo/googleClient.js pattern: GIS for tokens, gapi for API calls

export const CLIENT_ID = '895613216498-qqks3mo718amhfvjt5uo08gtlocat4l2.apps.googleusercontent.com';
export const API_KEY = 'AIzaSyCrGdsalmXhL-8E30LgEiZ73DxSd3xJw-M';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
].join(' ');

const DISCOVERY_DOCS = [
  'https://sheets.googleapis.com/$discovery/rest?version=v4',
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
];

const KEY_TOKEN = 'mt_access_token';
const KEY_EXPIRY = 'mt_token_expiry';
const KEY_EMAIL = 'mt_email';
const KEY_NAME = 'mt_name';
const KEY_UID = 'mt_uid';

let tokenClient = null;
let refreshTimer = null;
let onAuthChange = null; // callback(isSignedIn)
let gapiReady = false;
let refreshInFlight = false; // prevent concurrent refresh attempts

// ── gapi loading ─────────────────────────────────────────────────────────────

function loadGapiScript() {
  return new Promise((resolve, reject) => {
    if (window.gapi) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function initGapi() {
  await loadGapiScript();
  await new Promise((resolve) => window.gapi.load('client', resolve));
  await window.gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: DISCOVERY_DOCS,
  });
  gapiReady = true;
  console.log('[auth] gapi client initialized');
}

/** Returns a promise that resolves when gapi.client is ready */
export function waitForGapi() {
  if (gapiReady) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => gapiReady ? resolve() : setTimeout(check, 50);
    check();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

let gapiInitStarted = false;

export function initAuth(callback) {
  onAuthChange = callback;

  // Start gapi init once
  if (!gapiInitStarted) {
    gapiInitStarted = true;
    initGapi().catch(e => console.error('[auth] gapi init failed:', e));
  }

  // GIS may still be loading — poll until ready
  if (typeof google === 'undefined' || !google.accounts) {
    setTimeout(() => initAuth(callback), 100);
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse,
  });

  // Restore existing session if token still valid
  const token = getToken();
  if (token) {
    const expiry = parseInt(localStorage.getItem(KEY_EXPIRY) || '0', 10);
    const remaining = Math.floor((expiry - Date.now()) / 1000);
    scheduleRefresh(remaining);
    waitForGapi().then(() => {
      window.gapi.client.setToken({ access_token: token });
      console.log('[auth] restored session, gapi token set');
      onAuthChange && onAuthChange(true);
    });
  } else if (localStorage.getItem(KEY_EMAIL)) {
    // Token expired but user was signed in before — refresh silently (no UI)
    console.log('[auth] token expired, attempting silent refresh');
    waitForGapi().then(() => silentRefresh());
  } else {
    onAuthChange && onAuthChange(false);
  }

  // ── Foreground recovery ──────────────────────────────────────────────────────
  // setTimeout dies when mobile tabs sleep. When the user comes back,
  // check the token immediately and refresh if needed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!localStorage.getItem(KEY_EMAIL)) return; // not signed in
    const t = getToken();
    if (t) {
      // Token still valid — but reschedule refresh in case timer died
      const expiry = parseInt(localStorage.getItem(KEY_EXPIRY) || '0', 10);
      const remaining = Math.floor((expiry - Date.now()) / 1000);
      if (remaining < 660) { // less than 11 min left, refresh now
        console.log('[auth] tab resumed, token expiring soon — refreshing');
        silentRefresh();
      } else {
        scheduleRefresh(remaining);
      }
    } else {
      // Token expired while tab was asleep — refresh immediately
      console.log('[auth] tab resumed, token expired — refreshing');
      silentRefresh();
    }
  });
}

// ── Token handling ────────────────────────────────────────────────────────────

function handleTokenResponse(response) {
  refreshInFlight = false;
  if (response.error) {
    console.warn('[auth] token error:', response.error);
    clearToken();
    // If we still have the user's email, this was a background refresh failure.
    // Show the reconnect banner instead of dropping back to sign-in screen.
    if (localStorage.getItem(KEY_EMAIL)) {
      document.getElementById('reconnectBanner')?.classList.remove('hidden');
    } else {
      onAuthChange && onAuthChange(false);
    }
    return;
  }
  console.log('[auth] token received, scopes granted:', response.scope);
  storeToken(response.access_token, response.expires_in);

  // Set token on gapi client
  waitForGapi().then(() => {
    window.gapi.client.setToken({ access_token: response.access_token });
    console.log('[auth] gapi token set');
  });

  fetchUserInfo(response.access_token).then(() => {
    onAuthChange && onAuthChange(true);
  });
}

function storeToken(token, expiresIn) {
  const expiresAt = Date.now() + expiresIn * 1000;
  localStorage.setItem(KEY_TOKEN, token);
  localStorage.setItem(KEY_EXPIRY, String(expiresAt));
  scheduleRefresh(expiresIn);
}

function scheduleRefresh(expiresInSeconds) {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(0, (expiresInSeconds - 600) * 1000); // 10 min before expiry
  refreshTimer = setTimeout(silentRefresh, delay);
}

function silentRefresh() {
  if (!tokenClient || refreshInFlight) return;
  refreshInFlight = true;
  const hint = localStorage.getItem(KEY_EMAIL);
  // prompt:'' lets Google pick the least-intrusive flow (often a hidden iframe
  // or redirect). Unlike prompt:'none', this works even when third-party cookies
  // are blocked — the worst case is a brief flash, not a hard failure.
  // With login_hint set, the user is never shown an account picker.
  tokenClient.requestAccessToken({
    prompt: '',
    ...(hint ? { login_hint: hint } : {}),
  });
}

function clearToken() {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_EXPIRY);
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function signIn() {
  const hint = localStorage.getItem(KEY_EMAIL);
  if (hint) {
    // Returning user — silent refresh, no UI at all
    tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
  } else {
    // First time — let them pick their account
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  }
}

export function signOut() {
  const token = getToken();
  clearToken();
  [KEY_EMAIL, KEY_NAME, KEY_UID].forEach(k => localStorage.removeItem(k));
  if (token && google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(token, () => { });
  }
  if (window.gapi?.client) {
    window.gapi.client.setToken(null);
  }
  onAuthChange && onAuthChange(false);
}

export function getToken() {
  const token = localStorage.getItem(KEY_TOKEN);
  const expiry = parseInt(localStorage.getItem(KEY_EXPIRY) || '0', 10);
  if (!token || Date.now() > expiry - 60_000) return null; // 1-min buffer
  return token;
}

export function isSignedIn() { return !!getToken(); }

export function getUserEmail() { return localStorage.getItem(KEY_EMAIL) || ''; }
export function getUserName() { return localStorage.getItem(KEY_NAME) || ''; }
export function getUserId() { return localStorage.getItem(KEY_UID) || ''; }

/**
 * Ensures we have a valid token before making an API call.
 * If the token expired (e.g. tab was sleeping), triggers a refresh and waits
 * a moment for it to complete. Returns true if token is (now) valid.
 */
export async function ensureToken() {
  if (getToken()) return true;
  if (!localStorage.getItem(KEY_EMAIL)) return false; // not signed in
  // Token expired — kick off a refresh and wait briefly
  silentRefresh();
  // Wait up to 5s for the refresh to complete
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (getToken()) return true;
  }
  return false; // refresh didn't complete in time
}

/** Called when a Sheets API returns 401 — show the reconnect banner */
export function requestReconnect() {
  clearToken();
  document.getElementById('reconnectBanner')?.classList.remove('hidden');
}

export function reconnect() {
  document.getElementById('reconnectBanner')?.classList.add('hidden');
  const hint = localStorage.getItem(KEY_EMAIL);
  tokenClient.requestAccessToken({
    prompt: '',
    ...(hint ? { login_hint: hint } : {}),
  });
}

// ── User info ─────────────────────────────────────────────────────────────────

async function fetchUserInfo(token) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const info = await res.json();
    if (info.sub) localStorage.setItem(KEY_UID, info.sub);
    if (info.email) localStorage.setItem(KEY_EMAIL, info.email);
    if (info.name) localStorage.setItem(KEY_NAME, info.name);
  } catch (e) {
    // non-fatal — user info is display-only
  }
}
