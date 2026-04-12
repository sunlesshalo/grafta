// @ts-check
import { test, expect } from '@playwright/test';

// ── XSS payloads keyed by surface ───────────────────────────────────────────
const XSS = {
  medName:      `<img src=x onerror=window._xss_med_name=1>`,
  medDose:      `<script>window._xss_med_dose=1;</script>`,
  medNotes:     `<b onmouseover=window._xss_med_notes=1>bold</b>`,
  medCond:      `"><img src=x onerror=window._xss_med_cond=1>`,
  labNotes:     `<img src=x onerror=window._xss_lab_notes=1>`,
  patientName:  `<img src=x onerror=window._xss_patient=1>`,
  dayNotes:     `</textarea><img src=x onerror=window._xss_day_notes=1>`,
};

const TODAY = new Date().toISOString().slice(0, 10);

const FAKE_SHEETS = {
  'Config!A:J': {
    values: [
      ['id','time','name','dose','dose_alt','alt_rule','conditional','notes','active','created_at'],
      ['uuid-1','08:00', XSS.medName, XSS.medDose, '', '', XSS.medCond, XSS.medNotes, 'true', '2026-01-01'],
    ],
  },
  'Daily!A:S': {
    values: [
      ['date','bp_am_sys','bp_am_dia','bp_pm_sys','bp_pm_dia','weight','temp','meds_done','meds_total','water_ml','urine_ml','checked_json','water_json','urine_json','notes','config_version','last_sync','pulse_am','pulse_pm'],
      [TODAY,'120','80','','','70','36.5','0','1','500','300','{}','[]','[]', XSS.dayNotes,'1','','70',''],
    ],
  },
  'Daily!A:A': { values: [['date'],[TODAY]] },
  'Labs!A:D': {
    values: [
      ['date','creatinine','tacrolimus','notes'],
      [TODAY,'1.2','5.0', XSS.labNotes],
    ],
  },
  'Settings!A:B': {
    values: [
      ['key','value'],
      ['water_target','3000'],
      ['day_start_hour','5'],
      ['first_day','2026-01-01'],
      ['bp_times','2'],
      ['patient_name', XSS.patientName],
    ],
  },
  'ConfigHistory!A:C': { values: [['version','date','config_json']] },
  'Daily!1:1': {
    values: [['date','bp_am_sys','bp_am_dia','bp_pm_sys','bp_pm_dia','weight','temp','meds_done','meds_total','water_ml','urine_ml','checked_json','water_json','urine_json','notes','config_version','last_sync','pulse_am','pulse_pm']],
  },
};

const GAPI_MOCK = `
(function() {
  const FAKE_SPREADSHEET_ID = 'FAKE_SHEET_ID_XSS_TEST';
  const FAKE_SHEETS = ${JSON.stringify(FAKE_SHEETS)};
  function fakeGet(range) {
    if (FAKE_SHEETS[range]) return FAKE_SHEETS[range];
    const sheet = range.split('!')[0];
    for (const key of Object.keys(FAKE_SHEETS)) {
      if (key.startsWith(sheet + '!')) return FAKE_SHEETS[key];
    }
    return { values: [] };
  }
  function gapiResult(data) { return Promise.resolve({ result: data }); }
  window.gapi = {
    load: (lib, cb) => { cb(); },
    client: {
      init: () => Promise.resolve(),
      setToken: () => {},
      sheets: { spreadsheets: { values: { get: ({ range }) => gapiResult(fakeGet(range)), update: () => gapiResult({}), append: () => gapiResult({}), batchUpdate: () => gapiResult({}) }, create: () => gapiResult({ spreadsheetId: FAKE_SPREADSHEET_ID }), get: () => gapiResult({ sheets: [{ properties: { title: 'Labs', sheetId: 3 } }] }), batchUpdate: () => gapiResult({}) } },
      drive: { files: { list: () => gapiResult({ files: [{ id: FAKE_SPREADSHEET_ID, name: 'Grafta – Health Tracker' }] }), update: () => gapiResult({}) } },
    },
  };
  window.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: () => {} }) } } };
})();
`;

test.describe('XSS smoke tests', () => {
  let alertFired = false;
  let cspViolation = false;

  test.beforeEach(async ({ page }) => {
    alertFired = false;
    cspViolation = false;

    page.on('dialog', async dialog => { alertFired = true; await dialog.dismiss(); });
    page.on('console', msg => {
      if (msg.text().includes('Content Security Policy')) cspViolation = true;
    });

    await page.addInitScript(GAPI_MOCK);
    await page.addInitScript(() => {
      localStorage.setItem('mt_access_token', 'FAKE_TOKEN_FOR_XSS_TEST');
      localStorage.setItem('mt_token_expiry', String(Date.now() + 3600 * 1000));
      localStorage.setItem('mt_email', 'test@example.com');
      localStorage.setItem('mt_name', 'Test User');
      localStorage.setItem('mt_uid', 'uid-xss-test');
      localStorage.setItem('mt_sheet_id', 'FAKE_SHEET_ID_XSS_TEST');
      localStorage.setItem('mt_analytics_consent', 'false');
    });

    await page.route('https://apis.google.com/**', route => route.abort());
    await page.route('https://accounts.google.com/**', route => route.abort());
    await page.route('https://sheets.googleapis.com/**', route => route.abort());
    await page.route('https://www.googleapis.com/**', route => route.abort());
    await page.route('https://analytics.pinelines.eu/**', route => route.abort());

    try {
      await page.goto('/', { waitUntil: 'networkidle', timeout: 15000 });
    } catch (_) {}

    await page.waitForTimeout(3000);
  });

  test('tracker view renders (mock auth works)', async ({ page }) => {
    await expect(page.locator('#viewTracker')).not.toHaveClass(/hidden/);
  });

  test('no alert() fires from XSS payloads', () => {
    expect(alertFired).toBe(false);
  });

  test('no XSS flag variables set on window', async ({ page }) => {
    const flags = await page.evaluate(() => ({
      med_name:   window._xss_med_name,
      med_dose:   window._xss_med_dose,
      med_notes:  window._xss_med_notes,
      med_cond:   window._xss_med_cond,
      lab_notes:  window._xss_lab_notes,
      patient:    window._xss_patient,
      day_notes:  window._xss_day_notes,
    }));
    for (const [key, val] of Object.entries(flags)) {
      expect(val, `XSS flag ${key} should be undefined`).toBeUndefined();
    }
  });

  test('no unescaped onerror attributes in DOM', async ({ page }) => {
    const count = await page.evaluate(() =>
      document.querySelectorAll('[onerror],[onload]').length
    );
    expect(count).toBe(0);
  });

  test('no injected script tags in DOM', async ({ page }) => {
    const count = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script'))
        .filter(s => !s.src && !s.type).length
    );
    expect(count).toBe(0);
  });

  test('no CSP violations', () => {
    expect(cspViolation).toBe(false);
  });
});
