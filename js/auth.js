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
    // Token expired but user was signed in before — try silent refresh
    console.log('[auth] token expired, attempting silent refresh');
    waitForGapi().then(() => {
      tokenClient.requestAccessToken({ prompt: '' });
    });
  } else {
    onAuthChange && onAuthChange(false);
  }
}

// ── Token handling ────────────────────────────────────────────────────────────

function handleTokenResponse(response) {
  if (response.error) {
    console.warn('Auth error:', response.error);
    clearToken();
    onAuthChange && onAuthChange(false);
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
  const delay = Math.max(0, (expiresInSeconds - 300) * 1000); // 5 min before expiry
  refreshTimer = setTimeout(silentRefresh, delay);
}

function silentRefresh() {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: '' });
}

function clearToken() {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_EXPIRY);
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function signIn() {
  // If user previously signed in, skip account picker — just refresh silently
  const hadSession = !!localStorage.getItem(KEY_EMAIL);
  tokenClient.requestAccessToken({ prompt: hadSession ? '' : 'select_account' });
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

/** Called when a Sheets API returns 401 — show the reconnect banner */
export function requestReconnect() {
  clearToken();
  document.getElementById('reconnectBanner')?.classList.remove('hidden');
}

export function reconnect() {
  document.getElementById('reconnectBanner')?.classList.add('hidden');
  tokenClient.requestAccessToken({ prompt: '' });
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
