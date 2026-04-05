// ── tracker.js — Main tracker UI ──

import { getState, setState, setSyncStatus } from './store.js';
import { resolveScheduleForDate, isConditionalMet, getScheduleForVersion, getCachedMeds } from './schedule.js';
import { t } from './i18n.js';

let _viewingDate  = null;
let _isToday      = false;
let _settings     = { water_target: 3000, day_start_hour: 5, bp_times: 2 };
let _onOpenEditor = null;
let _onOpenLabs   = null;

// ── Init ──────────────────────────────────────────────────────────────────────

export function initTracker({ settings, onOpenEditor }) {
  _settings     = settings;
  _onOpenEditor = onOpenEditor;
  bindMobTabs();
}

export function renderDay(dateKey, isToday) {
  _viewingDate = dateKey;
  _isToday     = isToday;
  renderAll();
}

// ── Mobile tabs ───────────────────────────────────────────────────────────────

function bindMobTabs() {
  document.querySelectorAll('.mob-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = parseInt(tab.dataset.tab, 10);
      switchMobTab(idx);
    });
  });
}

function switchMobTab(idx) {
  document.querySelectorAll('.mob-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  const cols = ['colMeds','colWater','colUrine','colHealth','colLabs'];
  cols.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', i === idx);
    if (i >= 3) el.style.display = i === idx ? 'block' : 'none';
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function state() { return getState(_viewingDate); }

function save(newState) {
  setSyncStatus('saving');
  setState(_viewingDate, newState);
}

function nowTime() {
  const n = new Date();
  return n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
}

function isNight() {
  const h = new Date().getHours();
  return h >= 22 || h < 5;
}

function bpHigh(bp) { return bp && (bp.sys >= 140 || bp.dia >= 90); }

function getCurrentTimeBlock(schedule) {
  if (!_isToday) return -1;
  const now  = new Date();
  const hhmm = now.getHours() * 100 + now.getMinutes();
  let cur = 0;
  schedule.forEach((block, i) => {
    const [h, m] = block.time.split(':').map(Number);
    if (hhmm >= h * 100 + m) cur = i;
  });
  return cur;
}

// ── Render all ────────────────────────────────────────────────────────────────

export function renderAll() {
  if (!_viewingDate) return;
  renderMeds();
  renderFluidCol('water', 'colWater', t('fluids_title'), _settings.water_target);
  renderFluidCol('urine', 'colUrine', t('urine_title'),  null);
  renderHealth();
}

// ── Meds column ───────────────────────────────────────────────────────────────

async function renderMeds() {
  const el = document.getElementById('colMeds');
  if (!el) return;

  const s        = state();
  const allMeds  = getCachedMeds();
  const schedule = (allMeds.length === 0)
    ? []
    : await getScheduleForVersion(s.config_version || 0).then(meds => resolveScheduleForDate(meds, _viewingDate));

  const totalMeds = schedule.reduce((a, b) => a + b.meds.length, 0);
  const doneMeds  = Object.values(s.checked).filter(Boolean).length;

  const cur = getCurrentTimeBlock(schedule);

  let html = `<div class="col-title">${t('meds_title')} <span style="float:right;font-weight:400;color:#999">${doneMeds}/${totalMeds}</span></div>`;

  if (allMeds.length === 0) {
    html += `<div style="padding:24px 0;text-align:center;color:#999;font-size:13px">
      ${t('no_meds_yet')}<br>
      <button onclick="window._app.openEditor()" style="margin-top:12px;background:#000;color:#fff;border:none;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">${t('setup_schedule')}</button>
    </div>`;
    el.innerHTML = html;
    return;
  }

  schedule.forEach((block, bi) => {
    const allDone = block.meds.every(med => s.checked[med.id]);
    html += `<div class="time-group${bi === cur ? ' current' : ''}${allDone ? ' all-done' : ''}">`;
    html += `<div class="time-label">${block.time}</div>`;

    // Which BP applies to this time block?
    const bpArr = s.bp || [];
    const blockHour = parseInt(block.time.split(':')[0], 10);
    const bp = blockHour < 12
      ? (bpArr[0] || null)
      : (bpArr[bpArr.length - 1] || bpArr[0] || null);

    block.meds.forEach(med => {
      const on   = !!s.checked[med.id];
      const cond = med.conditional;
      const condMet = cond ? isConditionalMet(cond, bp) : false;
      let cls = 'med';
      if (on)               cls += ' done';
      if (cond && !condMet) cls += ' conditional';
      if (cond && condMet)  cls += ' conditional-active';

      html += `<div class="${cls}" data-med-id="${med.id}" onclick="window._tracker.toggleMed('${med.id}')">`;
      html += `<span class="box${on ? ' on' : ''}"></span>`;
      html += `<span>${med.name || `<em style="color:#999">${t('unnamed')}</em>`}`;
      if (med.dose) html += ` <span style="color:#666">${med.dose}</span>`;
      if (cond)     html += ` <span class="med-note">${cond}</span>`;
      if (med.notes && !cond) html += ` <span class="med-note">${med.notes}</span>`;
      html += `</span></div>`;
    });

    html += `</div>`;
  });

  if (_isToday) html += `<button class="reset-btn" onclick="window._tracker.resetDay()">${t('reset_today')}</button>`;
  el.innerHTML = html;
}

export function toggleMed(medId) {
  const s = state();
  s.checked[medId] = !s.checked[medId];
  save(s);
  renderMeds();
}

export function resetDay() {
  if (confirm(t('reset_confirm'))) {
    const s = { ...getState(_viewingDate) };
    s.checked = {};
    s.water   = [];
    s.urine   = [];
    s.bp      = [];
    s.weight  = null;
    s.temp    = null;
    s.notes   = '';
    save(s);
    renderAll();
  }
}

// ── Health column (desktop: embedded in meds col via section; mobile: own tab) ──

function renderHealth() {
  const el = document.getElementById('colHealth');
  if (!el) return;

  const s = state();
  let html = `<div class="col-title">${t('health_title')}</div>`;
  html += renderVitals(s);
  html += renderNotes(s);

  el.innerHTML = html;

  // Also update the desktop vitals section in the meds col
  const vitalsEl = document.getElementById('desktopVitals');
  if (vitalsEl) vitalsEl.innerHTML = renderVitals(s) + renderNotes(s);
}

function renderVitals(s) {
  const bpCount = _settings.bp_times || 2;
  const bpArr   = s.bp || [];
  let html = `<div class="vitals-box">`;
  for (let i = 0; i < bpCount; i++) {
    html += vitalsRow(t('vital_bp', { n: i + 1 }), i, bpArr[i] ?? null, 'bp');
  }
  html += vitalsRow(t('vital_wt'), 'weight', s.weight, 'weight');
  html += vitalsRow(t('vital_temp'), 'temp', s.temp,   'temp');
  html += `</div>`;
  return html;
}

function vitalsRow(label, key, value, type) {
  let html = `<div class="vital-row">`;
  html += `<span class="vital-label">${label}</span>`;

  if (value) {
    const display = type === 'bp'
      ? `${value.sys}/${value.dia}${bpHigh(value) ? ` <span style="color:#c00">↑ ${t('take_med')}</span>` : ''}`
      : type === 'temp'
      ? `${value.value}°C`
      : `${value.value} kg`;
    const alertCls = (type === 'bp' && bpHigh(value)) || (type === 'temp' && value.value >= 37.5) ? ' alert' : '';
    html += `<span class="vital-locked${alertCls}">${display} <button class="log-del" onclick="window._tracker.clearVital('${key}','${type}')">×</button></span>`;
  } else if (type === 'bp') {
    html += `<input class="vital-input" id="bp${key}Sys" type="number" inputmode="numeric" placeholder="sys" style="width:40px">`;
    html += `<span class="vital-slash">/</span>`;
    html += `<input class="vital-input" id="bp${key}Dia" type="number" inputmode="numeric" placeholder="dia" style="width:40px">`;
    html += `<button class="vital-ok-btn" onclick="window._tracker.saveVital('${key}','bp')">${t('ok_btn')}</button>`;
  } else {
    const ph    = type === 'weight' ? 'kg'  : '°C';
    const step  = type === 'weight' ? '0.1' : '0.1';
    const width = type === 'weight' ? '56px' : '48px';
    html += `<input class="vital-input wide" id="${key}Val" type="number" inputmode="decimal" step="${step}" placeholder="${ph}" style="width:${width}">`;
    html += `<button class="vital-ok-btn" onclick="window._tracker.saveVital('${key}','${type}')">${t('ok_btn')}</button>`;
  }

  html += `</div>`;
  return html;
}

function renderNotes(s) {
  return `<div class="notes-box">
    <div class="notes-label">${t('notes_label')}</div>
    <textarea class="notes-input" id="dayNotes" placeholder="${t('notes_ph')}"
      oninput="window._tracker.saveNotes(this.value)">${s.notes || ''}</textarea>
  </div>`;
}

export function saveVital(key, type) {
  const s = state();
  if (type === 'bp') {
    const idx = parseInt(key, 10);
    const sys = parseInt(document.getElementById(`bp${idx}Sys`)?.value, 10);
    const dia = parseInt(document.getElementById(`bp${idx}Dia`)?.value, 10);
    if (!sys || !dia) return;
    if (!s.bp) s.bp = [];
    s.bp[idx] = { sys, dia, time: nowTime() };
  } else {
    const val = parseFloat(document.getElementById(key + 'Val')?.value);
    if (!val) return;
    s[key] = { value: val, time: nowTime() };
  }
  save(s);
  renderAll();
}

export function clearVital(key, type) {
  const s = state();
  if (type === 'bp') {
    const idx = parseInt(key, 10);
    if (!s.bp) s.bp = [];
    s.bp[idx] = null;
  } else {
    s[key] = null;
  }
  save(s);
  renderAll();
}

export function saveNotes(value) {
  const s = state();
  s.notes = value;
  setState(_viewingDate, s); // save without triggering extra renders
}

// ── Fluid columns ─────────────────────────────────────────────────────────────

function waterPace(current, target) {
  const remaining = target - current;
  if (remaining <= 0) return `<div class="water-pace done">${t('water_done')}</div>`;

  const now = new Date();
  const hoursLeft = 22 - now.getHours() - (now.getMinutes() / 60);

  if (hoursLeft <= 0) return `<div class="water-pace urgent">${t('water_times_up', { remaining })}</div>`;

  const mlPerHour = Math.ceil(remaining / hoursLeft);
  let cls, key;
  if      (mlPerHour <= 150) { cls = 'relaxed'; key = 'water_easy'; }
  else if (mlPerHour <= 250) { cls = 'normal';  key = 'water_glass'; }
  else if (mlPerHour <= 400) { cls = 'push';    key = 'water_more'; }
  else                       { cls = 'urgent';  key = 'water_now'; }
  const minutes = Math.round(60 * 200 / mlPerHour);
  return `<div class="water-pace ${cls}">${t(key, { remaining, mlPerHour, minutes })}</div>`;
}

function renderFluidCol(type, elId, title, target) {
  const el = document.getElementById(elId);
  if (!el) return;

  const s       = state();
  const entries = s[type] || [];
  const total   = entries.reduce((a, e) => a + e.amount, 0);

  let html = `<div class="col-title">${title}</div>`;
  html += `<div class="fluid-total">${total}<span class="fluid-sub"> ml`;
  if (target) html += ` / ${target}`;
  html += `</span></div>`;

  if (type === 'water' && target && _isToday) html += waterPace(total, target);

  html += `<div class="fluid-btns">`;
  [100, 200, 250, 500].forEach(ml => {
    html += `<button class="fluid-btn" onclick="window._tracker.addFluid('${type}',${ml})">+${ml}</button>`;
  });
  html += `<button class="fluid-btn misc" onclick="window._tracker.addCustomFluid('${type}')">...</button>`;
  html += `</div>`;

  entries.slice().reverse().forEach((entry, ri) => {
    const idx = entries.length - 1 - ri;
    html += `<div class="log-entry">
      <span class="log-time">${entry.time || t('night')}</span>
      <span class="log-amount">${entry.amount} ml</span>
      <button class="log-del" onclick="window._tracker.delFluid('${type}',${idx})">×</button>
    </div>`;
  });

  el.innerHTML = html;
}

export function addFluid(type, ml) {
  const s = state();
  if (!s[type]) s[type] = [];
  s[type].push({ amount: ml, time: isNight() ? null : nowTime() });
  save(s);
  renderFluidCol('water', 'colWater', t('fluids_title'), _settings.water_target);
  renderFluidCol('urine', 'colUrine', t('urine_title'),  null);
}

export function addCustomFluid(type) {
  const val = prompt(t('fluid_ml_prompt'));
  if (val && !isNaN(val) && Number(val) > 0) addFluid(type, Number(val));
}

export function delFluid(type, idx) {
  const s = state();
  s[type].splice(idx, 1);
  save(s);
  renderFluidCol('water', 'colWater', t('fluids_title'), _settings.water_target);
  renderFluidCol('urine', 'colUrine', t('urine_title'),  null);
}
