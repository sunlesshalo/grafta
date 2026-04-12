// ── analytics.js — Umami analytics with offline queue + consent ──

import { getLang } from './i18n.js';

// ── Config ───────────────────────────────────────────────────────────────────
// Replace these after setting up your Umami instance on Hetzner
const UMAMI_URL   = 'https://analytics.pinelines.eu';
const WEBSITE_ID  = '77f73aa2-ab3f-45f2-bd02-dd8303393985';
const SCRIPT_PATH = '/script.js';

const KEY_CONSENT = 'mt_analytics_consent'; // 'granted' | 'denied' | null
const KEY_QUEUE   = 'mt_analytics_queue';
const MAX_QUEUE   = 500;
const MAX_AGE_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

let _loaded = false;
let _adherenceTimer = null;

// ── Consent ──────────────────────────────────────────────────────────────────

export function hasConsent()  { return localStorage.getItem(KEY_CONSENT) === 'granted'; }
export function consentAsked() { return localStorage.getItem(KEY_CONSENT) !== null; }

export function setConsent(granted) {
  localStorage.setItem(KEY_CONSENT, granted ? 'granted' : 'denied');
  const banner = document.getElementById('consentBanner');
  if (banner) banner.classList.add('hidden');
  if (granted) loadScript();
}

export function showConsentBanner() {
  if (consentAsked()) return;
  const banner = document.getElementById('consentBanner');
  if (!banner) return;
  banner.classList.remove('hidden');
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function initAnalytics() {
  if (hasConsent()) loadScript();

  window.addEventListener('online', () => {
    track('app_online', { pending_events: getQueue().length });
    flushQueue();
  });
  window.addEventListener('offline', () => {
    track('app_offline');
  });
}

function loadScript() {
  if (_loaded) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = UMAMI_URL + SCRIPT_PATH;
  script.dataset.websiteId = WEBSITE_ID;
  script.dataset.autoTrack = 'false'; // we handle pageviews manually for SPA
  script.onload = () => {
    _loaded = true;
    flushQueue();
  };
  script.onerror = () => {
    // Umami unreachable — events stay queued, no impact on app
  };
  document.head.appendChild(script);
}

// ── Track ────────────────────────────────────────────────────────────────────

export function track(name, properties = {}) {
  try {
    const consent = localStorage.getItem(KEY_CONSENT);
    if (consent !== 'granted') return;          // opt-in: no tracking without explicit consent

    const enriched = { ...properties, lang: getLang() };
    const event = { name, properties: enriched, timestamp: new Date().toISOString() };

    if (_loaded && navigator.onLine && typeof umami !== 'undefined') {
      umami.track(name, enriched);
    } else {
      enqueue(event);
    }
  } catch {
    // Analytics must never break the app
  }
}

export function trackPageview(url) {
  try {
    const consent = localStorage.getItem(KEY_CONSENT);
    if (consent !== 'granted') return;          // opt-in: no tracking without explicit consent

    if (_loaded && typeof umami !== 'undefined') {
      umami.track(props => ({ ...props, url }));
    }
    // Pageviews are not queued — stale pageviews have no value
  } catch {
    // silent
  }
}

// ── Adherence snapshot (debounced) ───────────────────────────────────────────

export function trackAdherenceSnapshot(checkedObj, totalMeds, isToday) {
  clearTimeout(_adherenceTimer);
  _adherenceTimer = setTimeout(() => {
    const done  = Object.values(checkedObj).filter(Boolean).length;
    const ratio = totalMeds > 0 ? done / totalMeds : 0;
    let bucket;
    if      (ratio <= 0.25) bucket = '0-25';
    else if (ratio <= 0.50) bucket = '25-50';
    else if (ratio <= 0.75) bucket = '50-75';
    else                    bucket = '75-100';

    track('adherence_snapshot', {
      ratio_bucket: bucket,
      done,
      total: totalMeds,
      is_today: isToday,
    });
  }, 5000);
}

// ── Offline queue ────────────────────────────────────────────────────────────

function getQueue() {
  try { return JSON.parse(localStorage.getItem(KEY_QUEUE) || '[]'); } catch { return []; }
}

function saveQueue(queue) {
  localStorage.setItem(KEY_QUEUE, JSON.stringify(queue));
}

function enqueue(event) {
  const queue = getQueue();
  queue.push(event);
  // FIFO cap
  while (queue.length > MAX_QUEUE) queue.shift();
  saveQueue(queue);
}

function flushQueue() {
  if (!_loaded || typeof umami === 'undefined') return;
  const queue = getQueue();
  if (!queue.length) return;

  const now = Date.now();
  const remaining = [];

  for (const event of queue) {
    // Discard stale events
    if (now - new Date(event.timestamp).getTime() > MAX_AGE_MS) continue;
    try {
      umami.track(event.name, event.properties);
    } catch {
      remaining.push(event);
    }
  }

  saveQueue(remaining);
}
