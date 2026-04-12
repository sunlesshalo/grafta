// ── editor.js — Med schedule editor with config versioning ──

import { getCachedMeds, setCachedMeds, saveSchedule, generateId } from './schedule.js';
import { getSpreadsheetId, setSetting } from './sheets.js';
import { t } from './i18n.js';
import { track } from './analytics.js';
import { escapeHtml } from './util.js';

let _meds         = [];   // working copy
let _openMedId    = null; // id of med with inline edit open
let _onSaved      = null; // callback after save

function getAltRules() {
  return [
    { value: '',                    label: t('rule_every_day') },
    { value: 'odd_days',            label: t('rule_odd_days') },
    { value: 'even_days',           label: t('rule_even_days') },
    { value: 'mon,wed,fri',         label: t('rule_mon_wed_fri') },
    { value: 'tue,thu,sat',         label: t('rule_tue_thu_sat') },
    { value: 'mon,tue,wed,thu,fri', label: t('rule_weekdays') },
  ];
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function openEditor(onSaved) {
  _onSaved = onSaved;
  _meds    = deepCopy(getCachedMeds());
  _openMedId = null;
  render();
}

function deepCopy(meds) {
  return meds.map(m => ({ ...m }));
}

// ── Render ────────────────────────────────────────────────────────────────────

export function render() {
  const body = document.getElementById('editorBody');
  if (!body) return;

  const activeMeds = _meds.filter(m => m.active !== false);
  const byTime = {};
  activeMeds.forEach(m => {
    if (!byTime[m.time]) byTime[m.time] = [];
    byTime[m.time].push(m);
  });
  const timeSlots = Object.keys(byTime).sort();

  let html = `<div class="editor-section">`;

  if (timeSlots.length === 0) {
    html += `<p style="color:#999;font-size:13px;padding:16px 0">${t('editor_no_meds')}</p>`;
  }

  timeSlots.forEach(time => {
    html += `<div class="editor-time-group">`;
    html += `<div class="editor-time-header">
      <span class="editor-time-label">${escapeHtml(time)}</span>
      <button class="editor-add-med-btn" onclick="window._editor.addMed('${escapeHtml(time)}')">${t('add_med')}</button>
    </div>`;

    byTime[time].forEach(med => {
      html += renderMedRow(med);
      if (_openMedId === med.id) {
        html += renderInlineEdit(med);
      }
    });

    html += `</div>`;
  });

  html += `</div>`;
  html += `<button class="editor-add-slot-btn" onclick="window._editor.addTimeSlot()">${t('add_time_slot')}</button>`;
  html += renderSettings();

  body.innerHTML = html;
}

function renderMedRow(med) {
  const altRules = getAltRules();
  const altLabelRaw = med.alt_rule
    ? altRules.find(r => r.value === med.alt_rule)?.label || med.alt_rule
    : '';
  return `
    <div class="editor-med-row">
      <div style="flex:1">
        <span class="editor-med-name">${med.name ? escapeHtml(med.name) : `<em style="color:#999">${t('unnamed')}</em>`}</span>
        ${med.dose ? `<span class="editor-med-dose"> ${escapeHtml(med.dose)}</span>` : ''}
        ${altLabelRaw && med.dose_alt ? `<span class="editor-med-alt"> / ${escapeHtml(med.dose_alt)} (${escapeHtml(altLabelRaw)})</span>` : ''}
        ${med.conditional ? `<span class="editor-med-cond"> — if ${escapeHtml(med.conditional)}</span>` : ''}
      </div>
      <button class="editor-med-menu-btn" aria-label="${escapeHtml(t('a11y_med_options'))}" onclick="window._editor.toggleInline('${escapeHtml(med.id)}')"><span aria-hidden="true">⋮</span></button>
    </div>`;
}

function renderInlineEdit(med) {
  const altRules   = getAltRules();
  const altOptions = altRules.map(r =>
    `<option value="${escapeHtml(r.value)}"${r.value === med.alt_rule ? ' selected' : ''}>${escapeHtml(r.label)}</option>`
  ).join('');
  const safeId = escapeHtml(med.id);

  const aName  = escapeHtml(t('a11y_med_name'));
  const aDose  = escapeHtml(t('a11y_med_dose'));
  const aTimes = escapeHtml(t('a11y_med_times'));
  const aAlt   = escapeHtml(t('a11y_med_dose_alt'));
  const aCond  = escapeHtml(t('a11y_med_conditional'));
  const aNotes = escapeHtml(t('a11y_med_notes'));

  return `
    <div class="editor-inline" id="inline-${safeId}">
      <div class="editor-field">
        <label>${t('field_name')}</label>
        <input type="text" value="${escapeHtml(med.name)}" aria-label="${aName}" oninput="window._editor.update('${safeId}','name',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_dose')}</label>
        <input type="text" value="${escapeHtml(med.dose)}" placeholder="${escapeHtml(t('field_dose_ph'))}" aria-label="${aDose}" oninput="window._editor.update('${safeId}','dose',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_schedule')}</label>
        <select aria-label="${escapeHtml(t('field_schedule'))}" onchange="window._editor.update('${safeId}','alt_rule',this.value)">${altOptions}</select>
      </div>
      <div class="editor-field">
        <label>${t('field_alt_dose')}</label>
        <input type="text" value="${escapeHtml(med.dose_alt)}" placeholder="${escapeHtml(t('field_dose_alt_ph'))}" aria-label="${aAlt}" oninput="window._editor.update('${safeId}','dose_alt',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_time')}</label>
        <input type="time" value="${escapeHtml(med.time)}" aria-label="${aTimes}" oninput="window._editor.update('${safeId}','time',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_condition')}</label>
        <input type="text" value="${escapeHtml(med.conditional)}" placeholder="${escapeHtml(t('field_cond_ph'))}" aria-label="${aCond}" oninput="window._editor.update('${safeId}','conditional',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_notes')}</label>
        <input type="text" value="${escapeHtml(med.notes)}" aria-label="${aNotes}" oninput="window._editor.update('${safeId}','notes',this.value)">
      </div>
      <button class="editor-delete-btn" onclick="window._editor.deleteMed('${safeId}')">${t('editor_remove_med')}</button>
    </div>`;
}

function renderSettings() {
  const pn = localStorage.getItem('mt_patient_name') || '';
  const wt = localStorage.getItem('mt_water_target') || '3000';
  const ds = localStorage.getItem('mt_day_start')    || '5';
  const bt = localStorage.getItem('mt_bp_times')     || '2';
  const aPatient = escapeHtml(t('a11y_setting_patient_name'));
  const aWater   = escapeHtml(t('a11y_setting_water_target'));
  const aStart   = escapeHtml(t('a11y_setting_day_start'));
  const aBpAm    = escapeHtml(t('a11y_setting_bp_am_time'));
  return `
    <div class="editor-settings">
      <h3>${t('settings_title')}</h3>
      <div class="editor-field">
        <label>${t('patient_name')}</label>
        <input type="text" value="${escapeHtml(pn)}" placeholder="${escapeHtml(t('patient_name_ph'))}" id="settingPatientName" aria-label="${aPatient}"
          oninput="localStorage.setItem('mt_patient_name', this.value)">
      </div>
      <div class="editor-field">
        <label>${t('water_target')} <span class="tip-icon" data-tip-key="tip_water_target">i</span></label>
        <input type="number" value="${Number(wt) || 3000}" placeholder="${escapeHtml(t('ml'))}" id="settingWaterTarget" aria-label="${aWater}"
          oninput="localStorage.setItem('mt_water_target', this.value)">
      </div>
      <div class="editor-field">
        <label>${t('day_starts')} <span class="tip-icon" data-tip-key="tip_day_start">i</span></label>
        <input type="number" value="${Number(ds) || 5}" min="0" max="6" id="settingDayStart" aria-label="${aStart}"
          oninput="localStorage.setItem('mt_day_start', this.value)">
      </div>
      <div class="editor-field">
        <label>${t('bp_readings_label')} <span class="tip-icon" data-tip-key="tip_bp_times">i</span></label>
        <input type="number" value="${Number(bt) || 2}" min="1" max="4" id="settingBpTimes" aria-label="${aBpAm}"
          oninput="localStorage.setItem('mt_bp_times', this.value)">
      </div>
    </div>`;
}

// ── Editor actions ─────────────────────────────────────────────────────────────

export function toggleInline(id) {
  _openMedId = _openMedId === id ? null : id;
  render();
}

export function update(id, field, value) {
  const med = _meds.find(m => m.id === id);
  if (!med) return;
  med[field] = value;
  // Don't re-render inline (user is typing) — let oninput handle it
}

export function addMed(time) {
  const med = {
    id:          generateId(),
    time,
    name:        '',
    dose:        '',
    dose_alt:    '',
    alt_rule:    '',
    conditional: '',
    notes:       '',
    active:      true,
    created_at:  new Date().toISOString().slice(0, 10),
  };
  _meds.push(med);
  _openMedId = med.id;
  track('editor_add_med');
  render();
}

export function addTimeSlot() {
  const time = prompt(t('editor_time_prompt'), t('editor_time_default'));
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return;
  track('editor_add_time_slot');
  addMed(time);
}

export function deleteMed(id) {
  const med = _meds.find(m => m.id === id);
  if (!med) return;
  if (!confirm(t('editor_delete_confirm', { name: med.name || t('unnamed') }))) return;
  track('editor_delete_med');
  med.active = false;
  _openMedId = null;
  render();
}

export async function save() {
  const btn = document.getElementById('editorSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = t('saving'); }

  // Commit any open inline edits (values are updated live via oninput)
  // Re-read values from DOM for the open inline form
  if (_openMedId) {
    const inlineEl = document.getElementById(`inline-${_openMedId}`);
    if (inlineEl) {
      const inputs = inlineEl.querySelectorAll('input, select');
      const med = _meds.find(m => m.id === _openMedId);
      if (med) {
        const fields = ['name','dose','alt_rule','dose_alt','time','conditional','notes'];
        inputs.forEach((el, i) => { if (fields[i] !== undefined) med[fields[i]] = el.value; });
      }
    }
  }

  try {
    const activeMeds = _meds.filter(m => m.active !== false);
    await saveSchedule(activeMeds);
    setCachedMeds(activeMeds);
    const uniqueSlots = new Set(activeMeds.map(m => m.time)).size;
    track('editor_save', { med_count: activeMeds.length, time_slots: uniqueSlots });

    // Push settings to Sheets so they sync across devices
    const sheetId = await getSpreadsheetId();
    const pn = localStorage.getItem('mt_patient_name');
    const wt = localStorage.getItem('mt_water_target');
    const ds = localStorage.getItem('mt_day_start');
    const bt = localStorage.getItem('mt_bp_times');
    await Promise.all([
      pn ? setSetting(sheetId, 'patient_name', pn) : null,
      wt ? setSetting(sheetId, 'water_target', wt) : null,
      ds ? setSetting(sheetId, 'day_start_hour', ds) : null,
      bt ? setSetting(sheetId, 'bp_times', bt) : null,
    ]);

    _onSaved && _onSaved();
  } catch (e) {
    alert(t('save_failed') + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('btn_save'); }
  }
}
