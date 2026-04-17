// ── schedule.js — Parse config rows, resolve meds for a given date ──

import { getConfig, saveConfig, appendConfigHistory, getConfigHistory, getSpreadsheetId } from './sheets.js';
import { getCurrentConfigVersion, bumpConfigVersion, syncConfigVersion } from './store.js';

// Cached in-memory config (loaded once, updated on save)
let _meds = null;  // array of med objects

// ── Parse ──────────────────────────────────────────────────────────────────────

/**
 * Parse raw sheet rows (skipping header) into med objects.
 * Row format: [id, time, name, dose, dose_alt, alt_rule, conditional, notes, active, created_at]
 */
export function parseConfigRows(rows) {
  const seen = new Set();
  return rows.slice(1) // skip header
    .filter(row => row[0]) // skip empty rows
    .filter(row => { // deduplicate by id (ghost rows from stale sheet data)
      if (seen.has(row[0])) return false;
      seen.add(row[0]);
      return true;
    })
    .map(row => ({
      id:          row[0] || '',
      time:        row[1] || '08:00',
      name:        row[2] || '',
      dose:        row[3] || '',
      dose_alt:    row[4] || '',
      alt_rule:    row[5] || '',   // 'odd_days' | 'even_days' | 'mon,wed,fri' | ''
      conditional: row[6] || '',   // 'bp>140/90' | ''
      notes:       row[7] || '',
      active:      row[8] !== 'false' && row[8] !== false, // default true
      created_at:  row[9] || '',
    }));
}

/**
 * Serialize med objects back to sheet rows (no header).
 */
export function serializeConfigRows(meds) {
  return meds.map(m => [
    m.id,
    m.time,
    m.name,
    m.dose,
    m.dose_alt,
    m.alt_rule,
    m.conditional,
    m.notes,
    String(m.active),
    m.created_at,
  ]);
}

// ── Resolve schedule for a date ────────────────────────────────────────────────

/**
 * Returns active meds grouped by time slot, with dose resolved for the date.
 * [{ time, meds: [{ id, name, dose, conditional, notes }] }]
 */
export function resolveScheduleForDate(meds, dateStr) {
  const active = meds.filter(m => m.active !== false);
  const byTime = {};

  for (const med of active) {
    const t = med.time;
    if (!byTime[t]) byTime[t] = [];
    byTime[t].push({
      id:          med.id,
      name:        med.name,
      dose:        resolveDose(med, dateStr),
      conditional: med.conditional || '',
      notes:       med.notes || '',
    });
  }

  // Sort time slots chronologically
  return Object.keys(byTime)
    .sort()
    .map(time => ({ time, meds: byTime[time] }));
}

function resolveDose(med, dateStr) {
  if (!med.alt_rule || !med.dose_alt) return med.dose;

  const d = new Date(dateStr + 'T12:00:00');
  const dayOfMonth   = d.getDate();
  const dayOfWeek    = d.getDay(); // 0=Sun

  const rule = med.alt_rule.toLowerCase();

  if (rule === 'odd_days')  return dayOfMonth % 2 === 1 ? med.dose : med.dose_alt;
  if (rule === 'even_days') return dayOfMonth % 2 === 0 ? med.dose : med.dose_alt;

  // Weekday list e.g. "mon,wed,fri"
  const weekdays = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
  const days = rule.split(',').map(s => weekdays[s.trim()]).filter(n => n !== undefined);
  if (days.length > 0) return days.includes(dayOfWeek) ? med.dose : med.dose_alt;

  return med.dose;
}

/**
 * Is a conditional med's condition currently met?
 * @param {string} conditional - e.g. 'bp>140/90'
 * @param {{ sys, dia } | null} bp - current BP reading
 */
export function isConditionalMet(conditional, bp) {
  if (!conditional || !bp) return false;
  const m = conditional.match(/bp\s*>\s*(\d+)\/(\d+)/i);
  if (!m) return false;
  return bp.sys >= parseInt(m[1], 10) || bp.dia >= parseInt(m[2], 10);
}

// ── Load + cache config ────────────────────────────────────────────────────────

export async function loadConfig() {
  const sheetId = await getSpreadsheetId();
  const rows    = await getConfig(sheetId);
  const rawCount = rows.slice(1).filter(r => r[0]).length;
  _meds = parseConfigRows(rows);

  // Auto-clean ghost rows: if dedup removed any, rewrite the sheet immediately
  if (_meds.length < rawCount) {
    console.warn(`[schedule] Cleaned ${rawCount - _meds.length} duplicate config rows`);
    const cleanRows = serializeConfigRows(_meds);
    await saveConfig(sheetId, cleanRows);
  }

  // Sync config version from sheet history (handles new device / cross-device)
  if (getCurrentConfigVersion() === 0 && _meds.length > 0) {
    const history = await getConfigHistory(sheetId);
    if (history.length > 1) {
      const maxVersion = Math.max(...history.slice(1).map(r => parseInt(r[0], 10) || 0));
      if (maxVersion > 0) syncConfigVersion(maxVersion);
    }
  }

  return _meds;
}

export function getCachedMeds() { return _meds || []; }

export function setCachedMeds(meds) { _meds = meds; }

// ── Save config with versioning ────────────────────────────────────────────────

export async function saveSchedule(meds) {
  const sheetId = await getSpreadsheetId();
  const version = bumpConfigVersion();

  // Save current config to history snapshot first
  await appendConfigHistory(sheetId, version, JSON.stringify(meds));

  // Overwrite Config sheet
  const rows = serializeConfigRows(meds);
  await saveConfig(sheetId, rows);

  _meds = meds;
  return version;
}

// ── Config history for past days ───────────────────────────────────────────────

let _historyCache = null;

export async function getScheduleForVersion(version) {
  if (version === 0 || version === getCurrentConfigVersion()) {
    return _meds;
  }

  if (!_historyCache) {
    const sheetId = await getSpreadsheetId();
    const rows    = await getConfigHistory(sheetId);
    _historyCache = rows.slice(1).map(r => ({
      version: parseInt(r[0], 10),
      date:    r[1],
      meds:    tryParse(r[2], []),
    }));
  }

  const entry = _historyCache.find(e => e.version === version);
  return entry ? entry.meds : _meds;
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ── UUID helper ────────────────────────────────────────────────────────────────

export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
