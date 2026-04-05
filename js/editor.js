// ── editor.js — Med schedule editor with config versioning ──

import { getCachedMeds, setCachedMeds, saveSchedule, generateId } from './schedule.js';
import { t } from './i18n.js';

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
      <span class="editor-time-label">${time}</span>
      <button class="editor-add-med-btn" onclick="window._editor.addMed('${time}')">${t('add_med')}</button>
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
  const altLabel = med.alt_rule
    ? altRules.find(r => r.value === med.alt_rule)?.label || med.alt_rule
    : '';
  return `
    <div class="editor-med-row">
      <div style="flex:1">
        <span class="editor-med-name">${med.name || `<em style="color:#999">${t('unnamed')}</em>`}</span>
        ${med.dose ? `<span class="editor-med-dose"> ${med.dose}</span>` : ''}
        ${altLabel && med.dose_alt ? `<span class="editor-med-alt"> / ${med.dose_alt} (${altLabel})</span>` : ''}
        ${med.conditional ? `<span class="editor-med-cond"> — if ${med.conditional}</span>` : ''}
      </div>
      <button class="editor-med-menu-btn" onclick="window._editor.toggleInline('${med.id}')">⋮</button>
    </div>`;
}

function renderInlineEdit(med) {
  const altRules   = getAltRules();
  const altOptions = altRules.map(r =>
    `<option value="${r.value}"${r.value === med.alt_rule ? ' selected' : ''}>${r.label}</option>`
  ).join('');

  return `
    <div class="editor-inline" id="inline-${med.id}">
      <div class="editor-field">
        <label>${t('field_name')}</label>
        <input type="text" value="${esc(med.name)}" oninput="window._editor.update('${med.id}','name',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_dose')}</label>
        <input type="text" value="${esc(med.dose)}" placeholder="${t('field_dose_ph')}" oninput="window._editor.update('${med.id}','dose',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_schedule')}</label>
        <select onchange="window._editor.update('${med.id}','alt_rule',this.value)">${altOptions}</select>
      </div>
      <div class="editor-field">
        <label>${t('field_alt_dose')}</label>
        <input type="text" value="${esc(med.dose_alt)}" placeholder="${t('field_dose_alt_ph')}" oninput="window._editor.update('${med.id}','dose_alt',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_time')}</label>
        <input type="time" value="${esc(med.time)}" oninput="window._editor.update('${med.id}','time',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_condition')}</label>
        <input type="text" value="${esc(med.conditional)}" placeholder="${t('field_cond_ph')}" oninput="window._editor.update('${med.id}','conditional',this.value)">
      </div>
      <div class="editor-field">
        <label>${t('field_notes')}</label>
        <input type="text" value="${esc(med.notes)}" oninput="window._editor.update('${med.id}','notes',this.value)">
      </div>
      <button class="editor-delete-btn" onclick="window._editor.deleteMed('${med.id}')">${t('editor_remove_med')}</button>
    </div>`;
}

function renderSettings() {
  const wt = localStorage.getItem('mt_water_target') || '3000';
  const ds = localStorage.getItem('mt_day_start')    || '5';
  const bt = localStorage.getItem('mt_bp_times')     || '2';
  return `
    <div class="editor-settings">
      <h3>${t('settings_title')}</h3>
      <div class="editor-field">
        <label title="${t('tip_water_target')}">${t('water_target')}</label>
        <input type="number" value="${wt}" placeholder="${t('ml')}" id="settingWaterTarget"
          title="${t('tip_water_target')}" oninput="localStorage.setItem('mt_water_target', this.value)">
      </div>
      <div class="editor-field">
        <label title="${t('tip_day_start')}">${t('day_starts')}</label>
        <input type="number" value="${ds}" min="0" max="6" id="settingDayStart"
          title="${t('tip_day_start')}" oninput="localStorage.setItem('mt_day_start', this.value)">
      </div>
      <div class="editor-field">
        <label title="${t('tip_bp_times')}">${t('bp_readings_label')}</label>
        <input type="number" value="${bt}" min="1" max="4" id="settingBpTimes"
          title="${t('tip_bp_times')}" oninput="localStorage.setItem('mt_bp_times', this.value)">
      </div>
    </div>`;
}

function esc(str) { return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

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
  render();
}

export function addTimeSlot() {
  const time = prompt(t('editor_time_prompt'), t('editor_time_default'));
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return;
  addMed(time);
}

export function deleteMed(id) {
  const med = _meds.find(m => m.id === id);
  if (!med) return;
  if (!confirm(t('editor_delete_confirm', { name: med.name || t('unnamed') }))) return;
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
    await saveSchedule(_meds.filter(m => m.active !== false));
    setCachedMeds(_meds.filter(m => m.active !== false));
    _onSaved && _onSaved();
  } catch (e) {
    alert(t('save_failed') + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('btn_save'); }
  }
}
