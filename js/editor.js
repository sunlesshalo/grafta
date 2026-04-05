// ── editor.js — Med schedule editor with config versioning ──

import { getCachedMeds, setCachedMeds, saveSchedule, generateId } from './schedule.js';

let _meds         = [];   // working copy
let _openMedId    = null; // id of med with inline edit open
let _onSaved      = null; // callback after save

const ALT_RULES = [
  { value: '',           label: 'Every day' },
  { value: 'odd_days',   label: 'Odd days' },
  { value: 'even_days',  label: 'Even days' },
  { value: 'mon,wed,fri', label: 'Mon/Wed/Fri' },
  { value: 'tue,thu,sat', label: 'Tue/Thu/Sat' },
  { value: 'mon,tue,wed,thu,fri', label: 'Weekdays' },
];

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
    html += `<p style="color:#999;font-size:13px;padding:16px 0">No meds yet. Add a time slot to get started.</p>`;
  }

  timeSlots.forEach(time => {
    html += `<div class="editor-time-group">`;
    html += `<div class="editor-time-header">
      <span class="editor-time-label">${time}</span>
      <button class="editor-add-med-btn" onclick="window._editor.addMed('${time}')">+ Med</button>
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
  html += `<button class="editor-add-slot-btn" onclick="window._editor.addTimeSlot()">+ Add time slot</button>`;
  html += renderSettings();

  body.innerHTML = html;
}

function renderMedRow(med) {
  const altLabel = med.alt_rule
    ? ALT_RULES.find(r => r.value === med.alt_rule)?.label || med.alt_rule
    : '';
  return `
    <div class="editor-med-row">
      <div style="flex:1">
        <span class="editor-med-name">${med.name || '<em style="color:#999">unnamed</em>'}</span>
        ${med.dose ? `<span class="editor-med-dose"> ${med.dose}</span>` : ''}
        ${altLabel && med.dose_alt ? `<span class="editor-med-alt"> / ${med.dose_alt} (${altLabel})</span>` : ''}
        ${med.conditional ? `<span class="editor-med-cond"> — if ${med.conditional}</span>` : ''}
      </div>
      <button class="editor-med-menu-btn" onclick="window._editor.toggleInline('${med.id}')">⋮</button>
    </div>`;
}

function renderInlineEdit(med) {
  const altOptions = ALT_RULES.map(r =>
    `<option value="${r.value}"${r.value === med.alt_rule ? ' selected' : ''}>${r.label}</option>`
  ).join('');

  return `
    <div class="editor-inline" id="inline-${med.id}">
      <div class="editor-field">
        <label>Name</label>
        <input type="text" value="${esc(med.name)}" oninput="window._editor.update('${med.id}','name',this.value)">
      </div>
      <div class="editor-field">
        <label>Dose</label>
        <input type="text" value="${esc(med.dose)}" placeholder="e.g. 10mg" oninput="window._editor.update('${med.id}','dose',this.value)">
      </div>
      <div class="editor-field">
        <label>Schedule</label>
        <select onchange="window._editor.update('${med.id}','alt_rule',this.value)">${altOptions}</select>
      </div>
      <div class="editor-field">
        <label>Alt dose</label>
        <input type="text" value="${esc(med.dose_alt)}" placeholder="dose on alternate days" oninput="window._editor.update('${med.id}','dose_alt',this.value)">
      </div>
      <div class="editor-field">
        <label>Time</label>
        <input type="time" value="${esc(med.time)}" oninput="window._editor.update('${med.id}','time',this.value)">
      </div>
      <div class="editor-field">
        <label>Condition</label>
        <input type="text" value="${esc(med.conditional)}" placeholder="e.g. bp>140/90" oninput="window._editor.update('${med.id}','conditional',this.value)">
      </div>
      <div class="editor-field">
        <label>Notes</label>
        <input type="text" value="${esc(med.notes)}" oninput="window._editor.update('${med.id}','notes',this.value)">
      </div>
      <button class="editor-delete-btn" onclick="window._editor.deleteMed('${med.id}')">Remove med</button>
    </div>`;
}

function renderSettings() {
  const wt = localStorage.getItem('mt_water_target') || '3000';
  const ds = localStorage.getItem('mt_day_start')    || '5';
  return `
    <div class="editor-settings">
      <h3>Settings</h3>
      <div class="editor-field">
        <label>Water target</label>
        <input type="number" value="${wt}" placeholder="ml" id="settingWaterTarget"
          oninput="localStorage.setItem('mt_water_target', this.value)">
      </div>
      <div class="editor-field">
        <label>Day starts</label>
        <input type="number" value="${ds}" min="0" max="6" id="settingDayStart"
          oninput="localStorage.setItem('mt_day_start', this.value)">
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
  const time = prompt('Time slot (HH:MM):', '08:00');
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return;
  addMed(time);
}

export function deleteMed(id) {
  const med = _meds.find(m => m.id === id);
  if (!med) return;
  if (!confirm(`Remove "${med.name || 'this med'}" from schedule?\n(Past days will still show it.)`)) return;
  med.active = false;
  _openMedId = null;
  render();
}

export async function save() {
  const btn = document.getElementById('editorSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

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
    alert('Save failed: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}
