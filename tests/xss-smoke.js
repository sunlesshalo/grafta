/**
 * XSS smoke test for med-tracker-v2
 *
 * Strategy: inject mock window.gapi + window.google before page load,
 * set localStorage auth state to simulate a signed-in session,
 * return fake Sheets data containing XSS payloads from the gapi mock,
 * then assert the rendered DOM shows literal text (not executed HTML).
 *
 * Run: node xss-smoke.js  (from /tmp/xss-smoke/)
 */
const { chromium } = require('playwright');

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

// ── Fake Sheets data ─────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);

const FAKE_SHEETS = {
  // Config sheet  [id,time,name,dose,dose_alt,alt_rule,conditional,notes,active,created_at]
  'Config!A:J': {
    values: [
      ['id','time','name','dose','dose_alt','alt_rule','conditional','notes','active','created_at'],
      ['uuid-1','08:00', XSS.medName, XSS.medDose, '', '', XSS.medCond, XSS.medNotes, 'true', '2026-01-01'],
    ],
  },
  // Daily sheet — one row for today with xss in notes
  'Daily!A:S': {
    values: [
      ['date','bp_am_sys','bp_am_dia','bp_pm_sys','bp_pm_dia','weight','temp','meds_done','meds_total','water_ml','urine_ml','checked_json','water_json','urine_json','notes','config_version','last_sync','pulse_am','pulse_pm'],
      [TODAY,'120','80','','','70','36.5','0','1','500','300','{}','[]','[]', XSS.dayNotes,'1','','70',''],
    ],
  },
  'Daily!A:A': {
    values: [['date'],[TODAY]],
  },
  // Labs sheet
  'Labs!A:D': {
    values: [
      ['date','creatinine','tacrolimus','notes'],
      [TODAY,'1.2','5.0', XSS.labNotes],
    ],
  },
  // Settings
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
  // ConfigHistory
  'ConfigHistory!A:C': {
    values: [['version','date','config_json']],
  },
  // Header migration check
  'Daily!1:1': {
    values: [['date','bp_am_sys','bp_am_dia','bp_pm_sys','bp_pm_dia','weight','temp','meds_done','meds_total','water_ml','urine_ml','checked_json','water_json','urine_json','notes','config_version','last_sync','pulse_am','pulse_pm']],
  },
};

// Return matching fake sheet data or empty
function fakeGet(range) {
  // Try exact match, then prefix match
  if (FAKE_SHEETS[range]) return FAKE_SHEETS[range];
  for (const key of Object.keys(FAKE_SHEETS)) {
    if (range.startsWith(key.split('!')[0])) {
      // same sheet, unknown range — return empty
      return { values: [] };
    }
  }
  return { values: [] };
}

// ── gapi mock (injected before page scripts run) ─────────────────────────────
const GAPI_MOCK = `
(function() {
  const FAKE_SPREADSHEET_ID = 'FAKE_SHEET_ID_XSS_TEST';
  const FAKE_SHEETS = ${JSON.stringify(FAKE_SHEETS)};

  function fakeGet(range) {
    if (FAKE_SHEETS[range]) return FAKE_SHEETS[range];
    // same-sheet fallback
    const sheet = range.split('!')[0];
    for (const key of Object.keys(FAKE_SHEETS)) {
      if (key.startsWith(sheet + '!')) return FAKE_SHEETS[key];
    }
    return { values: [] };
  }

  function gapiResult(data) {
    return Promise.resolve({ result: data });
  }

  window.gapi = {
    load: (lib, cb) => { cb(); },
    client: {
      init: () => Promise.resolve(),
      setToken: () => {},
      sheets: {
        spreadsheets: {
          values: {
            get: ({ range }) => gapiResult(fakeGet(range)),
            update: () => gapiResult({}),
            append: () => gapiResult({}),
            batchUpdate: () => gapiResult({}),
          },
          create: () => gapiResult({ spreadsheetId: FAKE_SPREADSHEET_ID }),
          get: () => gapiResult({ sheets: [
            { properties: { title: 'Labs', sheetId: 3 } }
          ]}),
          batchUpdate: () => gapiResult({}),
        },
      },
      drive: {
        files: {
          list: () => gapiResult({ files: [{ id: FAKE_SPREADSHEET_ID, name: 'Grafta – Health Tracker' }] }),
          update: () => gapiResult({}),
        },
      },
    },
  };

  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: (cfg) => ({
          requestAccessToken: () => {},
        }),
      },
    },
  };
})();
`;

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();

  const consoleLog = [];
  let alertFired = false;
  let alertMessage = '';

  page.on('console', msg => consoleLog.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLog.push(`[pageerror] ${err.message}`));
  page.on('dialog', async dialog => {
    alertFired = true;
    alertMessage = dialog.message();
    await dialog.dismiss();
  });

  // Inject gapi mock before any page script
  await page.addInitScript(GAPI_MOCK);

  // Inject auth state into localStorage before page loads
  await page.addInitScript(() => {
    const future = Date.now() + 3600 * 1000;
    localStorage.setItem('mt_access_token', 'FAKE_TOKEN_FOR_XSS_TEST');
    localStorage.setItem('mt_token_expiry', String(future));
    localStorage.setItem('mt_email', 'test@example.com');
    localStorage.setItem('mt_name', 'Test User');
    localStorage.setItem('mt_uid', 'uid-xss-test');
    localStorage.setItem('mt_sheet_id', 'FAKE_SHEET_ID_XSS_TEST');
    // Analytics consent — skip banner
    localStorage.setItem('mt_analytics_consent', 'false');
  });

  // Block all real Google API calls — we never want real network in this test
  await page.route('https://apis.google.com/**', route => route.abort());
  await page.route('https://accounts.google.com/**', route => route.abort());
  await page.route('https://sheets.googleapis.com/**', route => route.abort());
  await page.route('https://www.googleapis.com/**', route => route.abort());
  await page.route('https://analytics.pinelines.eu/**', route => route.abort());

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    // networkidle may time out due to aborted requests — that's fine
  }

  // Wait for the tracker view to appear (sign-in should complete via mock)
  let trackerVisible = false;
  try {
    await page.waitForSelector('#viewTracker:not(.hidden)', { timeout: 8000 });
    trackerVisible = true;
  } catch (_) {}

  // Give rendering a moment
  await page.waitForTimeout(2000);

  // ── Assertions ───────────────────────────────────────────────────────────────
  const results = [];

  function pass(name) { results.push({ name, status: 'PASS' }); }
  function fail(name, detail) { results.push({ name, status: 'FAIL', detail }); }

  // 1. alert() must never have fired
  if (alertFired) {
    fail('no-alert-fired', `alert("${alertMessage}") was triggered`);
  } else {
    pass('no-alert-fired');
  }

  // 2. Tracker view must be visible (mock auth worked)
  if (trackerVisible) {
    pass('tracker-view-rendered');
  } else {
    fail('tracker-view-rendered', 'viewTracker stayed hidden — mock auth may have failed');
  }

  // 3. XSS flag vars must not be set on window
  const xssFlags = await page.evaluate(() => ({
    med_name:   window._xss_med_name,
    med_dose:   window._xss_med_dose,
    med_notes:  window._xss_med_notes,
    med_cond:   window._xss_med_cond,
    lab_notes:  window._xss_lab_notes,
    patient:    window._xss_patient,
    day_notes:  window._xss_day_notes,
  }));

  for (const [key, val] of Object.entries(xssFlags)) {
    if (val) {
      fail(`xss-flag-${key}`, `window._xss_${key} was set — payload executed`);
    } else {
      pass(`xss-flag-${key}`);
    }
  }

  // 4. Verify no actual unescaped attack elements exist in the parsed DOM tree.
  //    We check for real DOM nodes / attributes, not innerHTML text which would
  //    also match properly-escaped entity strings like &lt;img onerror=...&gt;.
  const domAttackNodes = await page.evaluate(() => {
    // Any element with an onerror / onload / onclick attribute injected via payload
    const withOnerror = Array.from(document.querySelectorAll('[onerror],[onload]'))
      // exclude elements that are part of the static app UI (none in this app have these)
      .length;
    // Any inline <script> tag injected into body (legitimate ones all have src= attributes)
    const injectedScripts = Array.from(document.body.querySelectorAll('script:not([src])')).length;
    return { withOnerror, injectedScripts };
  });

  if (domAttackNodes.withOnerror > 0) {
    fail('no-unescaped-onerror-in-dom',
      `${domAttackNodes.withOnerror} DOM element(s) have onerror/onload attribute — payload was injected as real HTML`);
  } else {
    pass('no-unescaped-onerror-in-dom');
  }

  if (domAttackNodes.injectedScripts > 0) {
    fail('no-injected-script-tag',
      `${domAttackNodes.injectedScripts} <script> element(s) injected into body`);
  } else {
    pass('no-injected-script-tag');
  }

  // 5. CSP violations
  const cspViolations = consoleLog.filter(l => l.includes('CSP') || l.includes('Content-Security-Policy') || l.includes('violat'));
  if (cspViolations.length > 0) {
    fail('no-csp-violations', cspViolations.join('\n'));
  } else {
    pass('no-csp-violations');
  }

  // ── Report ────────────────────────────────────────────────────────────────────
  console.log('\n=== XSS Smoke Test Results ===\n');
  let anyFail = false;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.name}${r.detail ? '\n       ' + r.detail : ''}`);
    if (r.status === 'FAIL') anyFail = true;
  }

  console.log('\n=== Console Log (errors only) ===');
  consoleLog
    .filter(l => l.includes('[error]') || l.includes('[pageerror]') || l.includes('[warn]'))
    .forEach(l => console.log(l));

  if (consoleLog.some(l => l.includes('[CSP-VIOLATION]'))) {
    console.log('\n=== CSP Violations ===');
    consoleLog.filter(l => l.includes('[CSP-VIOLATION]')).forEach(l => console.log(l));
  }

  await browser.close();

  process.exit(anyFail ? 1 : 0);
})();
