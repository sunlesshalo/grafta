// ── app.js — Entry point, routing, glue ──

import { initAuth, signIn, signOut, reconnect, isSignedIn, getUserId } from './auth.js';
import { getSpreadsheetId, getSettings, setSetting } from './sheets.js';
import { getState, retryPending, syncAndMerge, setSyncStatus, getCurrentConfigVersion } from './store.js';
import { loadConfig, getCachedMeds, resolveScheduleForDate } from './schedule.js';
import { initTracker, renderDay, renderAll as trackerRenderAll } from './tracker.js';
import { openEditor, render as editorRender } from './editor.js';
import { renderLabs } from './labs.js';
import * as tracker from './tracker.js';
import * as editor  from './editor.js';
import * as labs    from './labs.js';
import { t, tArr, setLang, getLang, applyStaticTranslations } from './i18n.js';

// ── Expose globals for inline onclick handlers ────────────────────────────────
window._tracker = tracker;
window._editor  = editor;
window._labs    = labs;
window._app     = {
  prevDay,
  nextDay,
  openEditor: openEditorView,
  closeEditor: closeEditorView,
  signOut: () => { signOut(); showView('viewSignin'); },
  setLang: (lang) => {
    setLang(lang);
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

initAuth(async (signedIn) => {
  if (signedIn) {
    await onSignedIn();
  } else {
    showView('viewSignin');
  }
});

document.getElementById('signinBtn')?.addEventListener('click', signIn);
document.getElementById('reconnectBtn')?.addEventListener('click', reconnect);

// ── Sign-in flow ──────────────────────────────────────────────────────────────

async function onSignedIn() {
  showView('viewTracker');
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

    // Init tracker with settings
    initTracker({ settings: _settings, onOpenEditor: openEditorView });

    // If no meds yet — go straight to editor
    if (getCachedMeds().length === 0) {
      setSyncStatus('ok');
      openEditorView();
      return;
    }

    _viewingDate = todayKey();
    _isToday     = true;
    updateDayLabel();
    renderDay(_viewingDate, _isToday);
    renderLabs(); // load labs on sign-in for desktop; mobile shows on tab activate

    // Background sync from sheet
    syncAndMerge(_viewingDate).then(merged => {
      renderDay(_viewingDate, _isToday);
      setSyncStatus('ok');
    });

    retryPending();

  } catch (e) {
    console.error('onSignedIn error:', e);
    setSyncStatus('fail');
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
  goToDate(shiftDate(_viewingDate, -1));
}

export function nextDay() {
  if (!_viewingDate || _isToday) return;
  goToDate(shiftDate(_viewingDate, 1));
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
  renderDay(_viewingDate, _isToday);
  setSyncStatus('ok');
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

// ── Views ─────────────────────────────────────────────────────────────────────

function showView(id) {
  ['viewSignin','viewTracker','viewEditor'].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hidden', v !== id);
  });
}


// ── PWA ───────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
