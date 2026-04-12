// ── app.js — Entry point, routing, glue ──

import { initAuth, signIn, signOut, reconnect, isSignedIn, getUserId } from './auth.js';
import { getSpreadsheetId, getSettings, setSetting } from './sheets.js';
import { getState, setState, retryPending, syncAndMerge, setSyncStatus, getCurrentConfigVersion } from './store.js';
import { loadConfig, getCachedMeds, resolveScheduleForDate } from './schedule.js';
import { initTracker, renderDay, renderAll as trackerRenderAll } from './tracker.js';
import { openEditor, render as editorRender, save as editorSave } from './editor.js';
import { initLabs, renderLabs } from './labs.js';
import { initCharts, openCharts, setRange } from './charts.js';
import { initReports, generate as generateReport, print as printReport } from './reports.js';
import { t, tArr, setLang, getLang, applyStaticTranslations } from './i18n.js';
import { initAnalytics, track, trackPageview, showConsentBanner, setConsent } from './analytics.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _settings    = { water_target: 3000, day_start_hour: 5, first_day: null, bp_times: 2 };
let _viewingDate = null;
let _isToday     = false;
let _tipTimer    = null;
let _errTimer    = null;

// ── Boot ──────────────────────────────────────────────────────────────────────

applyStaticTranslations();
showConsentBanner();
const consentText = document.getElementById('consentText');
const consentAcceptBtn = document.getElementById('consentAccept');
const consentDeclineBtn = document.getElementById('consentDecline');
if (consentText) consentText.textContent = t('consent_text');
if (consentAcceptBtn) consentAcceptBtn.textContent = t('consent_accept');
if (consentDeclineBtn) consentDeclineBtn.textContent = t('consent_decline');
initAnalytics();

// ── Static element bindings ──────────────────────────────────────────────────

// Consent
document.getElementById('consentAccept')?.addEventListener('click', () => setConsent(true));
document.getElementById('consentDecline')?.addEventListener('click', () => setConsent(false));

// Auth
document.getElementById('signinBtn')?.addEventListener('click', signIn);
document.getElementById('reconnectBtn')?.addEventListener('click', reconnect);

// Sign-in triggers (landing page CTA buttons)
document.addEventListener('click', e => {
  if (e.target.closest('.js-signin')) {
    document.getElementById('signinBtn')?.click();
  }
});

// Day navigation
document.getElementById('prevBtn')?.addEventListener('click', prevDay);
document.getElementById('nextBtn')?.addEventListener('click', nextDay);

// Toolbar buttons
document.getElementById('editorBtn')?.addEventListener('click', openEditorView);
document.getElementById('chartsBtn')?.addEventListener('click', openChartsView);
document.getElementById('reportsBtn')?.addEventListener('click', openReportsView);
document.getElementById('signoutBtn')?.addEventListener('click', () => {
  track('auth_signout'); signOut(); showView('viewSignin'); trackPageview('/app/signin');
});

// Editor bar
document.getElementById('editorBackBtn')?.addEventListener('click', closeEditorView);
document.getElementById('editorSaveBtn')?.addEventListener('click', () => editorSave());

// Charts overlay
document.getElementById('chartsBackBtn')?.addEventListener('click', closeChartsView);
document.getElementById('chartsRangeBar')?.addEventListener('click', e => {
  const btn = e.target.closest('.range-btn');
  if (btn) setRange(parseInt(btn.dataset.days));
});

// Reports overlay
document.getElementById('reportsBackBtn')?.addEventListener('click', closeReportsView);
document.getElementById('reportGenerateBtn')?.addEventListener('click', () => generateReport());
document.getElementById('reportPrintBtn')?.addEventListener('click', () => printReport());

// Language selects
['langSelect', 'langSelectSignin', 'langSelectEditor'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', e => appSetLang(e.target.value));
});

// ── Auth flow ─────────────────────────────────────────────────────────────────

initAuth(async (signedIn) => {
  if (signedIn) {
    await onSignedIn();
  } else {
    showView('viewSignin');
    trackPageview('/app/signin');
  }
});

async function onSignedIn() {
  showView('viewTracker');
  trackPageview('/app/tracker');
  setSyncStatus('saving');

  try {
    const sheetId = await getSpreadsheetId();
    const [settings] = await Promise.all([
      getSettings(sheetId),
      loadConfig(),
    ]);
    _settings = { ...settings };

    if (_settings.lang) {
      setLang(_settings.lang);
      applyStaticTranslations();
    }

    localStorage.setItem('mt_water_target', String(_settings.water_target));
    localStorage.setItem('mt_day_start',    String(_settings.day_start_hour));
    localStorage.setItem('mt_bp_times',     String(_settings.bp_times ?? 2));
    if (_settings.patient_name) localStorage.setItem('mt_patient_name', _settings.patient_name);

    initTracker({ settings: _settings, onOpenEditor: openEditorView, onNewDay: newDay });
    initCharts(_settings);
    initReports();
    initLabs();

    const medCount = getCachedMeds().length;
    const firstDay = _settings.first_day;
    const daysSinceFirst = firstDay
      ? Math.floor((Date.now() - new Date(firstDay + 'T00:00:00').getTime()) / 86400000)
      : 0;
    track('session_start', { has_meds: medCount > 0, med_count: medCount, days_since_first: daysSinceFirst });

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

    const _localSnapshot = JSON.stringify(getState(_viewingDate));
    syncAndMerge(_viewingDate).then(merged => {
      if (JSON.stringify(merged) !== _localSnapshot) {
        renderDay(_viewingDate, _isToday);
      }
      setSyncStatus('ok');
    });

    retryPending();

  } catch (e) {
    console.error('onSignedIn error:', e);
    setSyncStatus('fail');
    hideLoading();
    showError(t('offline_banner'));
  }
}

// ── Language ──────────────────────────────────────────────────────────────────

function appSetLang(lang) {
  const prev = getLang();
  setLang(lang);
  track('lang_change', { from: prev, to: lang });
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
  getSpreadsheetId().then(id => setSetting(id, 'lang', lang)).catch(() => {});
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
  syncAndMerge(dateKey).then(() => {
    renderDay(_viewingDate, _isToday);
  });
}

function prevDay() {
  if (!_viewingDate || _viewingDate <= firstDay()) return;
  const next = shiftDate(_viewingDate, -1);
  const daysBack = Math.floor((Date.now() - new Date(next + 'T12:00:00').getTime()) / 86400000);
  track('day_navigate', { direction: 'prev', days_back: daysBack });
  goToDate(next);
}

function nextDay() {
  if (!_viewingDate || _isToday) return;
  const next = shiftDate(_viewingDate, 1);
  const daysBack = Math.floor((Date.now() - new Date(next + 'T12:00:00').getTime()) / 86400000);
  track('day_navigate', { direction: 'next', days_back: daysBack });
  goToDate(next);
}

function newDay() {
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
  applyStaticTranslations();
  openEditor(async () => {
    if (!_viewingDate) {
      _viewingDate = todayKey();
      _isToday = true;
      updateDayLabel();
    }
    const today = todayKey();
    const s = getState(today);
    s.config_version = getCurrentConfigVersion();
    setState(today, s);
    closeEditorView();
  });
}

function closeEditorView() {
  showView('viewTracker');
  trackPageview('/app/tracker');
  renderDay(_viewingDate, _isToday);
  setSyncStatus('ok');
}

// ── Dialog helpers (role=dialog overlays: Charts, Reports) ───────────────────

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let _lastFocusedBeforeOverlay = null;
let _trapHandler = null;

function openDialog(viewId, titleId) {
  _lastFocusedBeforeOverlay = document.activeElement;
  showView(viewId);
  const dialog = document.getElementById(viewId);
  const title  = document.getElementById(titleId);
  if (title && typeof title.focus === 'function') title.focus();

  _trapHandler = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(el => !el.closest('.hidden') && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };
  document.addEventListener('keydown', _trapHandler);
}

function closeDialog(returnToViewId) {
  if (_trapHandler) {
    document.removeEventListener('keydown', _trapHandler);
    _trapHandler = null;
  }
  showView(returnToViewId);
  if (_lastFocusedBeforeOverlay && document.body.contains(_lastFocusedBeforeOverlay)) {
    try { _lastFocusedBeforeOverlay.focus(); } catch (e) { /* element no longer focusable */ }
  }
  _lastFocusedBeforeOverlay = null;
}

// Global Escape: dismiss the active dialog overlay (Charts or Reports).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (e.isComposing || e.keyCode === 229) return;
  const charts  = document.getElementById('viewCharts');
  const reports = document.getElementById('viewReports');
  if (charts && !charts.classList.contains('hidden')) {
    closeChartsView();
  } else if (reports && !reports.classList.contains('hidden')) {
    closeReportsView();
  }
});

// ── Charts ────────────────────────────────────────────────────────────────────

function openChartsView() {
  openDialog('viewCharts', 'chartsTitleEl');
  trackPageview('/app/charts');
  track('charts_open', { range: 7 });
  openCharts();
}

function closeChartsView() {
  closeDialog('viewTracker');
}

// ── Reports ───────────────────────────────────────────────────────────────────

function openReportsView() {
  openDialog('viewReports', 'reportsTitleEl');
  trackPageview('/app/reports');
  applyReportsTranslations();
}

function closeReportsView() {
  closeDialog('viewTracker');
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
  const langSel = document.getElementById('reportLang');
  if (langSel) langSel.value = getLang();

  const genBtn   = document.getElementById('reportGenerateBtn');
  const printBtn = document.getElementById('reportPrintBtn');
  if (genBtn)   genBtn.textContent   = t('reports_generate');
  if (printBtn) printBtn.textContent = t('reports_print');
}

// ── Labs ──────────────────────────────────────────────────────────────────────

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
    clearTimeout(_tipTimer);
    _tipTimer = setTimeout(() => popup.classList.add('hidden'), 4000);
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
      <button data-action="openEditor"
        style="background:#000;color:#fff;border:none;border-radius:6px;padding:12px 24px;font-size:15px;font-weight:700;cursor:pointer">${t('welcome_btn')}</button>
    </div>`;
}

// ── Views ─────────────────────────────────────────────────────────────────────

function showView(id) {
  ['viewSignin','viewTracker','viewEditor','viewCharts','viewReports'].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hidden', v !== id);
  });
  if (id === 'viewSignin') {
    document.dispatchEvent(new Event('grafta:init-landing'));
  }
}

// ── Error toast ───────────────────────────────────────────────────────────────

function showError(msg) {
  const el = document.getElementById('errorToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(_errTimer);
  _errTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}
document.addEventListener('grafta:error', e => showError(e.detail));
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
  if (!navigator.onLine) setSyncStatus('offline');
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── PWA ───────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
