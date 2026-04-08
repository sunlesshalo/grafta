// ── app.js — Entry point, routing, glue ──

import { initAuth, signIn, signOut, reconnect, isSignedIn, getUserId } from './auth.js';
import { getSpreadsheetId, getSettings, setSetting } from './sheets.js';
import { getState, retryPending, syncAndMerge, setSyncStatus, getCurrentConfigVersion } from './store.js';
import { loadConfig, getCachedMeds, resolveScheduleForDate } from './schedule.js';
import { initTracker, renderDay, renderAll as trackerRenderAll } from './tracker.js';
import { openEditor, render as editorRender } from './editor.js';
import { renderLabs } from './labs.js';
import { initCharts, openCharts, setRange } from './charts.js';
import { initReports, generate as generateReport, print as printReport } from './reports.js';
import * as tracker from './tracker.js';
import * as editor  from './editor.js';
import * as labs    from './labs.js';
import * as reports from './reports.js';
import { t, tArr, setLang, getLang, applyStaticTranslations } from './i18n.js';
import { initAnalytics, track, trackPageview, showConsentBanner, setConsent } from './analytics.js';

// ── Expose globals for inline onclick handlers ────────────────────────────────
window._tracker = tracker;
window._editor  = editor;
window._labs    = labs;
window._reports = reports;
window._app     = {
  prevDay,
  nextDay,
  newDay,
  openEditor: openEditorView,
  closeEditor: closeEditorView,
  openCharts:  openChartsView,
  closeCharts: closeChartsView,
  openReports: openReportsView,
  closeReports: closeReportsView,
  signOut: () => { track('auth_signout'); signOut(); showView('viewSignin'); trackPageview('/app/signin'); },
  setLang: (lang) => {
    const prev = getLang();
    setLang(lang);
    track('lang_change', { from: prev, to: lang });
    // Update consent banner text if visible
    const ct = document.getElementById('consentText');
    if (ct) ct.textContent = t('consent_text');
    const ca = document.getElementById('consentAccept');
    if (ca) ca.textContent = t('consent_accept');
    const cd = document.getElementById('consentDecline');
    if (cd) cd.textContent = t('consent_decline');
    updateDayLabel();
    if (!document.getElementById('viewTracker').classList.contains('hidden')) {
      trackerRenderAll();
    }
    if (!document.getElementById('viewEditor').classList.contains('hidden')) {
      editorRender();
    }
    // Persist to Google Sheets in the background
    getSpreadsheetId().then(id => setSetting(id, 'lang', lang)).catch(() => {});
  },
};

// ── State ─────────────────────────────────────────────────────────────────────
let _settings    = { water_target: 3000, day_start_hour: 5, first_day: null, bp_times: 2 };
let _viewingDate = null;
let _isToday     = false;

// ── Boot ──────────────────────────────────────────────────────────────────────

applyStaticTranslations();
showConsentBanner();
// Apply consent banner translations
const consentText = document.getElementById('consentText');
const consentAcceptBtn = document.getElementById('consentAccept');
const consentDeclineBtn = document.getElementById('consentDecline');
if (consentText) consentText.textContent = t('consent_text');
if (consentAcceptBtn) consentAcceptBtn.textContent = t('consent_accept');
if (consentDeclineBtn) consentDeclineBtn.textContent = t('consent_decline');
initAnalytics();

// Consent banner buttons
document.getElementById('consentAccept')?.addEventListener('click', () => setConsent(true));
document.getElementById('consentDecline')?.addEventListener('click', () => setConsent(false));

initAuth(async (signedIn) => {
  if (signedIn) {
    await onSignedIn();
  } else {
    showView('viewSignin');
    trackPageview('/app/signin');
  }
});

document.getElementById('signinBtn')?.addEventListener('click', signIn);
document.getElementById('reconnectBtn')?.addEventListener('click', reconnect);

// Range buttons in Charts view
document.getElementById('chartsRangeBar')?.addEventListener('click', e => {
  const btn = e.target.closest('.range-btn');
  if (btn) setRange(parseInt(btn.dataset.days));
});

// ── Sign-in flow ──────────────────────────────────────────────────────────────

async function onSignedIn() {
  showView('viewTracker');
  trackPageview('/app/tracker');
  setSyncStatus('saving');

  try {
    // Ensure spreadsheet exists (creates on first login)
    const sheetId = await getSpreadsheetId();

    // Load settings + schedule in parallel
    const [settings] = await Promise.all([
      getSettings(sheetId),
      loadConfig(),
    ]);
    _settings = { ...settings };

    // Apply language from Sheets (overrides any local default)
    if (_settings.lang) {
      setLang(_settings.lang);
      applyStaticTranslations();
    }

    // Sync settings to localStorage for editor quick access
    localStorage.setItem('mt_water_target', String(_settings.water_target));
    localStorage.setItem('mt_day_start',    String(_settings.day_start_hour));
    localStorage.setItem('mt_bp_times',     String(_settings.bp_times ?? 2));
    if (_settings.patient_name) localStorage.setItem('mt_patient_name', _settings.patient_name);

    // Init tracker with settings
    initTracker({ settings: _settings, onOpenEditor: openEditorView });
    initCharts(_settings);
    initReports();

    const medCount = getCachedMeds().length;
    const firstDay = _settings.first_day;
    const daysSinceFirst = firstDay
      ? Math.floor((Date.now() - new Date(firstDay + 'T00:00:00').getTime()) / 86400000)
      : 0;
    track('session_start', { has_meds: medCount > 0, med_count: medCount, days_since_first: daysSinceFirst });

    // If no meds yet — go straight to editor
    if (medCount === 0) {
      setSyncStatus('ok');
      hideLoading();
      showWelcome();
      return;
    }

    _viewingDate = todayKey();
    _isToday     = true;
    updateDayLabel();
    renderDay(_viewingDate, _isToday);
    renderLabs();
    hideLoading();

    // Background sync from sheet
    syncAndMerge(_viewingDate).then(merged => {
      renderDay(_viewingDate, _isToday);
      setSyncStatus('ok');
    });

    retryPending();

  } catch (e) {
    console.error('onSignedIn error:', e);
    setSyncStatus('fail');
    hideLoading();
    if (window._showError) window._showError(t('offline_banner'));
  }
}

// ── Day navigation ────────────────────────────────────────────────────────────

function todayKey() {
  const now = new Date();
  const startHour = _settings.day_start_hour ?? 5;
  if (now.getHours() < startHour) now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0, 10);
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function firstDay() {
  return _settings.first_day || todayKey();
}

function goToDate(dateKey) {
  _viewingDate = dateKey;
  _isToday     = dateKey === todayKey();
  updateDayLabel();
  renderDay(_viewingDate, _isToday);

  // Background sync from sheet
  syncAndMerge(dateKey).then(() => {
    renderDay(_viewingDate, _isToday);
  });
}

export function prevDay() {
  if (!_viewingDate || _viewingDate <= firstDay()) return;
  const next = shiftDate(_viewingDate, -1);
  const daysBack = Math.floor((Date.now() - new Date(next + 'T12:00:00').getTime()) / 86400000);
  track('day_navigate', { direction: 'prev', days_back: daysBack });
  goToDate(next);
}

export function nextDay() {
  if (!_viewingDate || _isToday) return;
  const next = shiftDate(_viewingDate, 1);
  const daysBack = Math.floor((Date.now() - new Date(next + 'T12:00:00').getTime()) / 86400000);
  track('day_navigate', { direction: 'next', days_back: daysBack });
  goToDate(next);
}

export function newDay() {
  // Navigate to the real calendar date (ignoring day_start_hour)
  const realToday = new Date().toISOString().slice(0, 10);
  track('new_day', { from: _viewingDate, to: realToday });
  goToDate(realToday);
}

// ── Day label ─────────────────────────────────────────────────────────────────

function updateDayLabel() {
  const label = document.getElementById('dayLabel');
  if (!label || !_viewingDate) return;

  const d    = new Date(_viewingDate + 'T12:00:00');
  const days = tArr('days');
  const mons = tArr('months');
  let html = `<span class="sync-dot" id="syncDot"></span>`;
  html += `${days[d.getDay()]} ${d.getDate()} ${mons[d.getMonth()]}`;
  if (_isToday) html += ` <span class="sub">${t('today_badge')}</span>`;
  else          html += ` <span class="past-badge">${t('past_badge')}</span>`;
  label.innerHTML = html;

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if (prevBtn) prevBtn.disabled = !_viewingDate || _viewingDate <= firstDay();
  if (nextBtn) nextBtn.disabled = _isToday;
}

// ── Editor ────────────────────────────────────────────────────────────────────

function openEditorView() {
  showView('viewEditor');
  trackPageview('/app/editor');
  track('editor_open', { med_count: getCachedMeds().length });
  applyStaticTranslations(); // sync editor bar + lang select to current language
  openEditor(async () => {
    // Set viewing date if not set (first run — editor opened before tracker)
    if (!_viewingDate) {
      _viewingDate = todayKey();
      _isToday = true;
      updateDayLabel();
    }
    // After save: update config version on current day state
    const s = getState(_viewingDate);
    s.config_version = getCurrentConfigVersion();
    // Re-render tracker
    closeEditorView();
  });
}

function closeEditorView() {
  showView('viewTracker');
  trackPageview('/app/tracker');
  renderDay(_viewingDate, _isToday);
  setSyncStatus('ok');
}

// ── Charts ────────────────────────────────────────────────────────────────────

function openChartsView() {
  showView('viewCharts');
  trackPageview('/app/charts');
  track('charts_open', { range: 7 });
  openCharts();
}

function closeChartsView() {
  showView('viewTracker');
}

// ── Reports ───────────────────────────────────────────────────────────────────

function openReportsView() {
  showView('viewReports');
  trackPageview('/app/reports');
  applyReportsTranslations();
}

function closeReportsView() {
  showView('viewTracker');
}

function applyReportsTranslations() {
  const periodSel = document.getElementById('reportPeriod');
  if (periodSel) {
    const opts = [
      { value: '7',      label: t('reports_7d') },
      { value: '30',     label: t('reports_30d') },
      { value: '90',     label: t('reports_90d') },
      { value: 'custom', label: t('reports_custom') },
    ];
    const current = periodSel.value;
    periodSel.innerHTML = opts.map(o => `<option value="${o.value}"${o.value === current ? ' selected' : ''}>${o.label}</option>`).join('');
  }
  // Report language selector — default to app language
  const langSel = document.getElementById('reportLang');
  if (langSel) langSel.value = getLang();

  const genBtn   = document.getElementById('reportGenerateBtn');
  const printBtn = document.getElementById('reportPrintBtn');
  if (genBtn)   genBtn.textContent   = t('reports_generate');
  if (printBtn) printBtn.textContent = t('reports_print');
}

// ── Labs ──────────────────────────────────────────────────────────────────────

// Labs tab click triggers renderLabs lazily
document.addEventListener('click', e => {
  const tab = e.target.closest('.mob-tab');
  if (tab && tab.dataset.tab === '3') renderLabs();
});

// ── Tooltip popup ─────────────────────────────────────────────────────────────

document.addEventListener('click', e => {
  const icon = e.target.closest('.tip-icon');
  const popup = document.getElementById('tipPopup');
  if (!popup) return;
  if (icon) {
    e.stopPropagation();
    popup.textContent = t(icon.dataset.tipKey);
    popup.classList.remove('hidden');
    clearTimeout(window._tipTimer);
    window._tipTimer = setTimeout(() => popup.classList.add('hidden'), 4000);
  } else {
    popup.classList.add('hidden');
  }
});

// ── Loading ───────────────────────────────────────────────────────────────────

function hideLoading() {
  document.getElementById('loadingOverlay')?.classList.add('hidden');
}

// ── Welcome ───────────────────────────────────────────────────────────────────

function showWelcome() {
  const col = document.getElementById('colMeds');
  if (!col) return;
  col.innerHTML = `
    <div style="text-align:center;padding:32px 16px">
      <h2 style="font-size:20px;margin-bottom:12px">${t('welcome_title')}</h2>
      <p style="color:#555;font-size:14px;line-height:1.5;margin-bottom:24px">${t('welcome_text')}</p>
      <button onclick="window._app.openEditor()"
        style="background:#000;color:#fff;border:none;border-radius:6px;padding:12px 24px;font-size:15px;font-weight:700;cursor:pointer">${t('welcome_btn')}</button>
    </div>`;
}

// ── Views ─────────────────────────────────────────────────────────────────────

function showView(id) {
  ['viewSignin','viewTracker','viewEditor','viewCharts','viewReports'].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hidden', v !== id);
  });
}


// ── Error toast ───────────────────────────────────────────────────────────────

window._showError = function(msg) {
  const el = document.getElementById('errorToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window._errTimer);
  window._errTimer = setTimeout(() => el.classList.add('hidden'), 5000);
};
document.addEventListener('click', e => {
  if (e.target.id === 'errorToast') e.target.classList.add('hidden');
});

// ── Offline detection ─────────────────────────────────────────────────────────

function updateOnlineStatus() {
  const banner = document.getElementById('offlineBanner');
  const text   = document.getElementById('offlineText');
  if (!banner) return;
  if (navigator.onLine) {
    banner.classList.add('hidden');
  } else {
    if (text) text.textContent = t('offline_banner');
    banner.classList.remove('hidden');
  }
  // Update sync dot
  if (!navigator.onLine) setSyncStatus('offline');
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── PWA ───────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
