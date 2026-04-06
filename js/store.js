// ── store.js — localStorage + Sheets sync orchestration ──

import { getSpreadsheetId, upsertDailyRow, getDailyRow } from './sheets.js';

const KEY_PREFIX  = 'mt_day_';
const KEY_PENDING = 'mt_pending';
const KEY_CFG_VER = 'mt_config_version';

let syncDebounce = null;
let isSyncing    = false;
let syncQueue    = null; // holds latest { date, state } to write

// ── Day state ─────────────────────────────────────────────────────────────────

export function emptyState(dateKey) {
  return {
    date: dateKey,
    bp: [],             // [{sys, dia, time}] — one entry per configured reading
    weight: null,
    temp: null,
    checked: {},        // { uuid: true/false }
    water: [],          // [{ amount, time }]
    urine: [],          // [{ amount, time }]
    notes: '',
    config_version: 0,
  };
}

export function getState(dateKey) {
  const raw = localStorage.getItem(KEY_PREFIX + dateKey);
  if (!raw) return emptyState(dateKey);
  try {
    const parsed = JSON.parse(raw);
    const s = { ...emptyState(dateKey), ...parsed };
    // Migrate legacy bpAm/bpPm → bp array
    if (!parsed.bp && (parsed.bpAm || parsed.bpPm)) {
      s.bp = [];
      if (parsed.bpAm) s.bp[0] = parsed.bpAm;
      if (parsed.bpPm) s.bp[1] = parsed.bpPm;
    }
    return s;
  } catch {
    return emptyState(dateKey);
  }
}

export function setState(dateKey, state) {
  localStorage.setItem(KEY_PREFIX + dateKey, JSON.stringify(state));
  queueSync(dateKey, state);
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export function setSyncStatus(status) {
  const dot = document.getElementById('syncDot');
  if (dot) dot.className = 'sync-dot ' + status;
}

function queueSync(dateKey, state) {
  syncQueue = { date: dateKey, state };
  clearTimeout(syncDebounce);
  syncDebounce = setTimeout(flushSync, 500);
}

async function flushSync() {
  if (isSyncing || !syncQueue) return;
  isSyncing = true;

  while (syncQueue) {
    const { date, state } = syncQueue;
    syncQueue = null;
    setSyncStatus('saving');

    let ok = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sheetId = await getSpreadsheetId();
        await upsertDailyRow(sheetId, date, buildRow(state));
        ok = true;
        break;
      } catch (e) {
        if (e.message === 'no_token' || e.message === 'unauthorized') break; // don't retry auth errors
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    if (ok) {
      setSyncStatus('ok');
    } else {
      setSyncStatus('fail');
      addToPending(date, state);
      if (window._showError) window._showError('Sync failed — saved locally, will retry');
    }
  }

  isSyncing = false;
}

function buildRow(state) {
  const meds_done  = Object.values(state.checked || {}).filter(Boolean).length;
  const meds_total = Object.keys(state.checked || {}).length;
  const bp = state.bp || [];
  return [
    state.date,
    bp[0]?.sys  ?? '',
    bp[0]?.dia  ?? '',
    bp[1]?.sys  ?? '',
    bp[1]?.dia  ?? '',
    state.weight?.value ?? '',
    state.temp?.value   ?? '',
    meds_done,
    meds_total,
    (state.water  || []).reduce((a, e) => a + e.amount, 0),
    (state.urine  || []).reduce((a, e) => a + e.amount, 0),
    JSON.stringify(state.checked || {}),
    JSON.stringify(state.water   || []),
    JSON.stringify(state.urine   || []),
    state.notes || '',
    state.config_version ?? 0,
    new Date().toISOString(),
    bp[0]?.pulse ?? '',
    bp[1]?.pulse ?? '',
  ];
}

// ── Parse sheet row → state ───────────────────────────────────────────────────

export function parseSheetRow(row) {
  // row is an array matching DAILY headers
  const safe = (i, fallback = null) => row[i] !== undefined && row[i] !== '' ? row[i] : fallback;
  const num  = (i) => { const v = row[i]; return v !== '' && v !== undefined ? Number(v) : null; };

  const bp0 = num(1) ? { sys: num(1), dia: num(2), ...(num(17) ? { pulse: num(17) } : {}) } : null;
  const bp1 = num(3) ? { sys: num(3), dia: num(4), ...(num(18) ? { pulse: num(18) } : {}) } : null;
  return {
    date:    safe(0),
    bp:      [bp0, bp1].filter(Boolean),
    weight:  num(5) ? { value: num(5) }               : null,
    temp:    num(6) ? { value: num(6) }               : null,
    checked: tryParse(safe(11), {}),
    water:   tryParse(safe(12), []),
    urine:   tryParse(safe(13), []),
    notes:   safe(14, ''),
    config_version: num(15) ?? 0,
  };
}

function tryParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── Load from sheet + merge ───────────────────────────────────────────────────

export async function loadDayFromSheet(dateKey) {
  try {
    const sheetId = await getSpreadsheetId();
    const result  = await getDailyRow(sheetId, dateKey);
    if (!result) return null;
    return parseSheetRow(result.data);
  } catch (e) {
    if (e.message !== 'no_token' && e.message !== 'unauthorized') {
      console.warn('loadDayFromSheet failed:', e);
    }
    return null;
  }
}

export async function syncAndMerge(dateKey) {
  const remote = await loadDayFromSheet(dateKey);
  if (!remote) return getState(dateKey);

  const local = getState(dateKey);
  const merged = mergeStates(local, remote);
  localStorage.setItem(KEY_PREFIX + dateKey, JSON.stringify(merged));
  return merged;
}

function mergeStates(local, remote) {
  const m = emptyState(local.date);

  // Scalars: remote wins if present, else local
  m.weight = remote.weight || local.weight;
  m.temp   = remote.temp   || local.temp;
  m.notes  = remote.notes  || local.notes;
  m.config_version = Math.max(local.config_version || 0, remote.config_version || 0);

  // BP: per-index merge (each slot is a specific reading)
  const lBp = local.bp || [], rBp = remote.bp || [];
  m.bp = [];
  for (let i = 0; i < Math.max(lBp.length, rBp.length); i++) {
    m.bp[i] = rBp[i] || lBp[i] || null;
  }

  // Checked: union — true wins
  m.checked = { ...(local.checked || {}), ...(remote.checked || {}) };

  // Fluid arrays: longer wins (append-only, longer = more complete)
  m.water = (remote.water || []).length >= (local.water || []).length
    ? (remote.water || []) : (local.water || []);
  m.urine = (remote.urine || []).length >= (local.urine || []).length
    ? (remote.urine || []) : (local.urine || []);

  return m;
}

// ── Pending queue (offline retry) ────────────────────────────────────────────

function addToPending(date, state) {
  const pending = getPending();
  const idx = pending.findIndex(p => p.date === date);
  if (idx >= 0) pending[idx] = { date, state };
  else pending.push({ date, state });
  localStorage.setItem(KEY_PENDING, JSON.stringify(pending));
}

function getPending() {
  try { return JSON.parse(localStorage.getItem(KEY_PENDING) || '[]'); } catch { return []; }
}

export async function retryPending() {
  const pending = getPending();
  if (!pending.length) return;

  const remaining = [];
  for (const { date, state } of pending) {
    try {
      const sheetId = await getSpreadsheetId();
      await upsertDailyRow(sheetId, date, buildRow(state));
    } catch {
      remaining.push({ date, state });
    }
  }
  localStorage.setItem(KEY_PENDING, JSON.stringify(remaining));
  if (!remaining.length) setSyncStatus('ok');
}

window.addEventListener('online', () => { retryPending(); });

// ── Config version ────────────────────────────────────────────────────────────

export function getCurrentConfigVersion() {
  return parseInt(localStorage.getItem(KEY_CFG_VER) || '0', 10);
}

export function syncConfigVersion(v) {
  localStorage.setItem(KEY_CFG_VER, String(v));
}

export function bumpConfigVersion() {
  const v = getCurrentConfigVersion() + 1;
  localStorage.setItem(KEY_CFG_VER, String(v));
  return v;
}
