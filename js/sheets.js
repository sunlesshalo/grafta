// ── sheets.js — Google Sheets v4 + Drive v3 via gapi.client ──

import { getToken, requestReconnect, waitForGapi } from './auth.js';

const SHEET_NAME  = 'Med Tracker';
const KEY_SHEET   = 'mt_sheet_id'; // localStorage key for spreadsheet ID

// Sheet names
export const S = {
  CONFIG:  'Config',
  DAILY:   'Daily',
  LABS:    'Labs',
  HISTORY: 'ConfigHistory',
  SETTINGS:'Settings',
};

// Column headers per sheet
const HEADERS = {
  [S.CONFIG]:   ['id','time','name','dose','dose_alt','alt_rule','conditional','notes','active','created_at'],
  [S.DAILY]:    ['date','bp_am_sys','bp_am_dia','bp_pm_sys','bp_pm_dia','weight','temp','meds_done','meds_total','water_ml','urine_ml','checked_json','water_json','urine_json','notes','config_version','last_sync'],
  [S.LABS]:     ['date','creatinine','tacrolimus','notes'],
  [S.HISTORY]:  ['version','date','config_json'],
  [S.SETTINGS]: ['key','value'],
};

// ── gapi error helper ────────────────────────────────────────────────────────
// gapi.client rejects with a response object, not an Error.
// This wraps any gapi call to produce a proper Error with a useful message.

async function gapiCall(label, fn) {
  try {
    return await fn();
  } catch (e) {
    // gapi error structure: { result: { error: { message, code, status } }, status, body }
    const msg = e?.result?.error?.message || e?.body || e?.message || JSON.stringify(e);
    const code = e?.result?.error?.code || e?.status || '?';
    console.error(`[sheets] ${label} failed (${code}):`, msg, e);
    if (code === 401) { requestReconnect(); }
    throw new Error(`${label}: ${code} ${msg}`);
  }
}

// ── Spreadsheet lifecycle ─────────────────────────────────────────────────────

/**
 * Returns spreadsheet ID, creating the spreadsheet on first call.
 * ID is cached in localStorage so we never create duplicates.
 */
let _verified = false; // true once we've confirmed the sheet ID this session

export async function getSpreadsheetId() {
  const cached = localStorage.getItem(KEY_SHEET);

  // First call each session: always verify via Drive (even if cached)
  if (!_verified) {
    _verified = true;
    const correct = await findBestSpreadsheet();
    if (correct) {
      localStorage.setItem(KEY_SHEET, correct);
      return correct;
    }
    // Nothing on Drive — cached ID is stale, clear it and create fresh
    localStorage.removeItem(KEY_SHEET);
    return createSpreadsheet();
  }

  if (cached) return cached;
  return createSpreadsheet();
}

/**
 * Search Drive for "Med Tracker" spreadsheets. If multiple exist,
 * return the one with actual Config data. Never creates anything.
 */
async function findBestSpreadsheet() {
  await waitForGapi();
  try {
    const res = await gapiCall('drive.files.list', () =>
      window.gapi.client.drive.files.list({
        q: `name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
        fields: 'files(id,name)',
        orderBy: 'createdTime',   // oldest first
        spaces: 'drive',
      })
    );
    const files = res.result.files || [];
    if (files.length === 0) return null;

    // Prefer the one with actual med config data
    for (const file of files) {
      try {
        const config = await getRange(file.id, `${S.CONFIG}!A:A`);
        if (config.length > 1) { // has rows beyond header
          console.log('[sheets] using spreadsheet with data:', file.id);
          return file.id;
        }
      } catch { /* skip inaccessible */ }
    }

    // All empty — return the oldest
    console.log('[sheets] using oldest spreadsheet:', files[0].id);
    return files[0].id;
  } catch (e) {
    console.warn('[sheets] Drive search failed:', e);
  }
  return null;
}

async function createSpreadsheet() {
  await waitForGapi();

  // 1. Create spreadsheet with all sheet tabs
  const created = await gapiCall('spreadsheets.create', () =>
    window.gapi.client.sheets.spreadsheets.create({
      properties: { title: SHEET_NAME },
      sheets: Object.keys(HEADERS).map(name => ({
        properties: { title: name, gridProperties: { frozenRowCount: 1 } },
      })),
    })
  );
  const id = created.result.spreadsheetId;
  console.log('[sheets] spreadsheet created:', id);

  // 2. Write headers to each sheet
  const data = Object.entries(HEADERS).map(([sheet, headers]) => ({
    range: `${sheet}!A1`,
    values: [headers],
  }));
  await gapiCall('values.batchUpdate (headers)', () =>
    window.gapi.client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: id,
      resource: { valueInputOption: 'RAW', data },
    })
  );

  // 3. Write default Settings
  await appendRows(id, S.SETTINGS, [
    ['water_target', '3000'],
    ['day_start_hour', '5'],
    ['first_day', new Date().toISOString().slice(0, 10)],
    ['bp_times', '2'],
  ]);

  localStorage.setItem(KEY_SHEET, id);
  return id;
}

// ── Generic read/write ────────────────────────────────────────────────────────

export async function getRange(spreadsheetId, range) {
  await waitForGapi();
  const res = await gapiCall(`values.get(${range})`, () =>
    window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId, range })
  );
  return res.result.values || [];
}

export async function updateRange(spreadsheetId, range, values) {
  await waitForGapi();
  await gapiCall(`values.update(${range})`, () =>
    window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId, range, valueInputOption: 'RAW',
      resource: { values },
    })
  );
}

export async function appendRows(spreadsheetId, sheet, rows) {
  await waitForGapi();
  await gapiCall(`values.append(${sheet})`, () =>
    window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheet}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: rows },
    })
  );
}

export async function batchUpdate(spreadsheetId, requests) {
  await waitForGapi();
  return gapiCall('spreadsheets.batchUpdate', () =>
    window.gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests },
    })
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(spreadsheetId) {
  const rows = await getRange(spreadsheetId, `${S.SETTINGS}!A:B`);
  const settings = { water_target: 3000, day_start_hour: 5, lang: null, bp_times: 2 };
  for (const row of rows.slice(1)) { // skip header
    if (row[0] === 'water_target')   settings.water_target   = parseInt(row[1], 10);
    if (row[0] === 'day_start_hour') settings.day_start_hour = parseInt(row[1], 10);
    if (row[0] === 'first_day')      settings.first_day       = row[1];
    if (row[0] === 'lang')           settings.lang            = row[1];
    if (row[0] === 'bp_times')       settings.bp_times        = parseInt(row[1], 10) || 2;
  }
  return settings;
}

export async function setSetting(spreadsheetId, key, value) {
  const rows = await getRange(spreadsheetId, `${S.SETTINGS}!A:B`);
  const rowIdx = rows.findIndex(r => r[0] === key);
  if (rowIdx >= 0) {
    const range = `${S.SETTINGS}!B${rowIdx + 1}`;
    await updateRange(spreadsheetId, range, [[String(value)]]);
  } else {
    await appendRows(spreadsheetId, S.SETTINGS, [[key, String(value)]]);
  }
}

// ── Config (med schedule) ─────────────────────────────────────────────────────

export async function getConfig(spreadsheetId) {
  return getRange(spreadsheetId, `${S.CONFIG}!A:J`);
}

export async function saveConfig(spreadsheetId, rows) {
  const values = [HEADERS[S.CONFIG], ...rows];
  await updateRange(spreadsheetId, `${S.CONFIG}!A:J`, values);
}

export async function appendConfigHistory(spreadsheetId, version, configJson) {
  await appendRows(spreadsheetId, S.HISTORY, [[
    String(version),
    new Date().toISOString().slice(0, 10),
    configJson,
  ]]);
}

export async function getConfigHistory(spreadsheetId) {
  return getRange(spreadsheetId, `${S.HISTORY}!A:C`);
}

// ── Daily rows ────────────────────────────────────────────────────────────────

export async function getDailyRow(spreadsheetId, date) {
  const rows = await getRange(spreadsheetId, `${S.DAILY}!A:Q`);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === date);
  if (idx < 0) return null;
  return { rowIndex: idx + 1, data: rows[idx] }; // 1-based sheet row
}

export async function upsertDailyRow(spreadsheetId, date, rowValues) {
  const rows = await getRange(spreadsheetId, `${S.DAILY}!A:A`);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === date);
  if (idx >= 0) {
    const range = `${S.DAILY}!A${idx + 1}:Q${idx + 1}`;
    await updateRange(spreadsheetId, range, [rowValues]);
  } else {
    await appendRows(spreadsheetId, S.DAILY, [rowValues]);
  }
}

// ── Labs ──────────────────────────────────────────────────────────────────────

export async function getLabs(spreadsheetId) {
  return getRange(spreadsheetId, `${S.LABS}!A:D`);
}

export async function appendLab(spreadsheetId, date, creatinine, tacrolimus, notes) {
  await appendRows(spreadsheetId, S.LABS, [[date, String(creatinine), String(tacrolimus), notes || '']]);
}

export async function deleteLabRow(spreadsheetId, date) {
  const rows = await getRange(spreadsheetId, `${S.LABS}!A:A`);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === date);
  if (idx < 0) return;

  await waitForGapi();
  const sheetsRes = await window.gapi.client.sheets.spreadsheets.get({
    spreadsheetId: await getSpreadsheetId(),
    fields: 'sheets.properties',
  });
  const labSheet = sheetsRes.result.sheets?.find(s => s.properties.title === S.LABS);
  if (!labSheet) return;

  await batchUpdate(await getSpreadsheetId(), [{
    deleteDimension: {
      range: {
        sheetId: labSheet.properties.sheetId,
        dimension: 'ROWS',
        startIndex: idx,
        endIndex: idx + 1,
      },
    },
  }]);
}
