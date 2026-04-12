// ── i18n.js — Internationalization logic ──
// Translation data lives in translations.js to keep this file focused on API + DOM updates.

import { LANGS } from './translations.js';

let _lang = localStorage.getItem('mt_lang') || 'en';

export const SUPPORTED_LANGS = ['en', 'ro', 'hu'];

/** Translate a string key, replacing {param} placeholders. */
export function t(key, params = {}) {
  const str = LANGS[_lang]?.[key] ?? LANGS.en[key] ?? key;
  if (typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
}

/** Get an array value (e.g. days, months). */
export function tArr(key) {
  return LANGS[_lang]?.[key] ?? LANGS.en[key] ?? [];
}

export function getLang() { return _lang; }

/** Translate a key in a specific language (for reports). */
export function tIn(lang, key, params = {}) {
  const str = LANGS[lang]?.[key] ?? LANGS.en[key] ?? key;
  if (typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
}

export function setLang(lang) {
  if (!LANGS[lang]) return;
  _lang = lang;
  localStorage.setItem('mt_lang', lang);
  document.documentElement.lang = lang;
  applyStaticTranslations();
}

/** Update all static HTML elements (sign-in, tabs, editor bar). */
export function applyStaticTranslations() {
  // Generic data-i18n / data-i18n-html attributes (landing page + any future elements)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val !== undefined) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const val = t(el.dataset.i18nHtml);
    if (val !== undefined) el.innerHTML = val;
  });

  // Sign-in view (primary button — not covered by data-i18n)
  const signinBtn = document.getElementById('signinBtn');
  if (signinBtn) signinBtn.textContent = t('signin_btn');

  // Reconnect banner
  const reconnectText = document.getElementById('reconnectText');
  const reconnectBtn  = document.getElementById('reconnectBtn');
  if (reconnectText) reconnectText.textContent = t('reconnect_text') + ' ';
  if (reconnectBtn)  reconnectBtn.textContent  = t('reconnect_btn');

  // Mobile tabs
  const tabKeys = ['tab_meds','tab_fluids','tab_urine','tab_notes','tab_labs'];
  document.querySelectorAll('.mob-tab').forEach((tab, i) => {
    if (tabKeys[i]) tab.textContent = t(tabKeys[i]);
  });

  // Editor bar
  const editorBack  = document.querySelector('.editor-back');
  const editorTitle = document.querySelector('.editor-title');
  const editorSave  = document.getElementById('editorSaveBtn');
  if (editorBack)  editorBack.textContent  = t('editor_back');
  if (editorTitle) editorTitle.textContent = t('editor_title');
  if (editorSave && !editorSave.disabled)  editorSave.textContent = t('btn_save');

  // Charts overlay
  const chartsBack  = document.querySelector('#viewCharts .overlay-back');
  const chartsTitle = document.getElementById('chartsTitleEl');
  const rangeAll    = document.getElementById('rangeAllBtn');
  if (chartsBack)  chartsBack.textContent  = t('editor_back');
  if (chartsTitle) chartsTitle.textContent = t('charts_title');
  if (rangeAll)    rangeAll.textContent    = t('range_all');

  // Reports overlay
  const reportsBack  = document.querySelector('#viewReports .overlay-back');
  const reportsTitle = document.getElementById('reportsTitleEl');
  const reportPrint  = document.getElementById('reportPrintBtn');
  if (reportsBack)  reportsBack.textContent  = t('editor_back');
  if (reportsTitle) reportsTitle.textContent = t('reports_title');
  if (reportPrint && !reportPrint.classList.contains('hidden')) reportPrint.textContent = t('reports_print');

  // Sign out button
  const signoutBtn = document.getElementById('signoutBtn');
  if (signoutBtn) signoutBtn.textContent = t('signout');

  // Sync language selects to current lang (+ localize their aria-label)
  ['langSelect', 'langSelectSignin', 'langSelectEditor'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.value = _lang;
    sel.setAttribute('aria-label', t('a11y_language'));
  });

  // Accessible names for tracker icon-only buttons
  const iconBtnLabels = {
    prevBtn:    'a11y_prev_day',
    nextBtn:    'a11y_next_day',
    editorBtn:  'a11y_edit_schedule',
    chartsBtn:  'a11y_open_charts',
    reportsBtn: 'a11y_open_reports',
  };
  Object.entries(iconBtnLabels).forEach(([id, key]) => {
    const btn = document.getElementById(id);
    if (btn) btn.setAttribute('aria-label', t(key));
  });

  // Localize "Back" accessible name on overlay/editor back buttons
  const backLabel = t('editor_back').replace(/^←\s*/, '');
  document.querySelectorAll('.overlay-back, .editor-back').forEach(btn => {
    btn.setAttribute('aria-label', backLabel);
  });
}
