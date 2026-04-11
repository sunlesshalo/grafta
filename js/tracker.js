// ── tracker.js — Main tracker UI ──

import { getState, setState, setSyncStatus } from './store.js';
import { resolveScheduleForDate, isConditionalMet, getScheduleForVersion, getCachedMeds } from './schedule.js';
import { t } from './i18n.js';
import { track, trackAdherenceSnapshot } from './analytics.js';
import { escapeHtml } from './util.js';

let _viewingDate  = null;
let _isToday      = false;
let _settings     = { water_target: 3000, day_start_hour: 5, bp_times: 2 };
let _onOpenEditor = null;
let _onOpenLabs   = null;
let _waterLabel   = 'drink_water'; // i18n key for selected drink type

const DRINK_TYPES = ['drink_water','drink_coffee','drink_tea','drink_juice','drink_soup','drink_other'];

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
  const tabs = ['meds','fluids','urine','notes','labs'];
  track('tab_switch', { tab: tabs[idx] || 'unknown' });
  document.querySelectorAll('.mob-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  const cols = ['colMeds','colWater','colUrine','colNotes','colLabs'];
  cols.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', i === idx);
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
  renderNotesCol(state());
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

  // Build a set of conditional meds whose condition is NOT met (inactive)
  const inactiveConditional = new Set();
  schedule.forEach(block => {
    const bpArr = s.bp || [];
    const blockHour = parseInt(block.time.split(':')[0], 10);
    const bp = blockHour < 12
      ? (bpArr[0] || null)
      : (bpArr[bpArr.length - 1] || bpArr[0] || null);
    block.meds.forEach(med => {
      if (med.conditional && !isConditionalMet(med.conditional, bp)) {
        inactiveConditional.add(med.id);
      }
    });
  });

  const totalMeds = schedule.reduce((a, b) => a + b.meds.filter(m => !inactiveConditional.has(m.id)).length, 0);
  const doneMeds  = Object.entries(s.checked).filter(([id, v]) => v && !inactiveConditional.has(id)).length;

  const cur = getCurrentTimeBlock(schedule);

  let html = `<div class="col-title">${t('vitals_title')}</div>`;
  html += renderVitals(s);
  html += `<div class="col-title col-title-meds">${t('meds_title')} <span style="float:right;display:flex;align-items:center;gap:8px"><button class="expand-all-btn" onclick="window._tracker.expandAll()">${t('expand_all')}</button><span style="font-weight:400;color:#999">${doneMeds}/${totalMeds}</span></span></div>`;

  if (allMeds.length === 0) {
    html += `<div style="padding:24px 0;text-align:center;color:#999;font-size:13px">
      ${t('no_meds_yet')}<br>
      <button onclick="window._app.openEditor()" style="margin-top:12px;background:#000;color:#fff;border:none;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer">${t('setup_schedule')}</button>
    </div>`;
    el.innerHTML = html;
    return;
  }

  schedule.forEach((block, bi) => {
    const activeMeds = block.meds.filter(med => !inactiveConditional.has(med.id));
    const allDone = activeMeds.length > 0 && activeMeds.every(med => s.checked[med.id]);
    const doneCnt = activeMeds.filter(med => s.checked[med.id]).length;
    const isCurrent = bi === cur;

    // Which BP applies to this time block?
    const bpArr = s.bp || [];
    const blockHour = parseInt(block.time.split(':')[0], 10);
    const bp = blockHour < 12
      ? (bpArr[0] || null)
      : (bpArr[bpArr.length - 1] || bpArr[0] || null);

    // Time-of-day color class
    let timeColorClass = '';
    if (blockHour >= 5 && blockHour < 10)       timeColorClass = ' time-morning';
    else if (blockHour >= 16 && blockHour < 20) timeColorClass = ' time-afternoon';
    else if (blockHour >= 20)                   timeColorClass = ' time-evening';

    // Auto-collapse completed blocks (except current)
    const collapsed = (allDone && !isCurrent) ? ' collapsed' : '';

    html += `<div class="time-group${isCurrent ? ' current' : ''}${allDone ? ' all-done' : ''}${timeColorClass}${collapsed}" id="tg-${bi}">`;
    html += `<div class="time-label" onclick="window._tracker.toggleTimeGroup('${bi}')">
      <span>${block.time}</span>
      <span class="time-progress${allDone ? ' done' : ''}">${doneCnt}/${activeMeds.length}${allDone ? ' ✓' : ''}</span>
    </div>`;
    html += `<div class="time-group-body">`;

    block.meds.forEach(med => {
      const on   = !!s.checked[med.id];
      const cond = med.conditional;
      const condMet = cond ? isConditionalMet(cond, bp) : false;
      const inactive = cond && !condMet;
      let cls = 'med';
      if (inactive)         cls += ' conditional-inactive';
      else if (on)          cls += ' done';
      if (cond && condMet)  cls += ' conditional-active';

      const safeId = escapeHtml(med.id);
      const clickHandler = inactive ? '' : `onclick="window._tracker.toggleMed('${safeId}')"`;
      html += `<div class="${cls}" data-med-id="${safeId}" ${clickHandler}>`;
      html += `<span class="box${on && !inactive ? ' on' : ''}"></span>`;
      html += `<span>${med.name ? escapeHtml(med.name) : `<em style="color:#999">${t('unnamed')}</em>`}`;
      if (med.dose) html += ` <span style="color:#666">${escapeHtml(med.dose)}</span>`;
      if (cond)     html += ` <span class="med-note">${escapeHtml(cond)}</span>`;
      if (med.notes && !cond) html += ` <span class="med-note">${escapeHtml(med.notes)}</span>`;
      html += `</span></div>`;
    });

    html += `</div></div>`;
  });

  html += `<div class="day-actions">`;
  if (_isToday) html += `<button class="reset-btn" onclick="window._tracker.resetDay()" title="${t('tip_reset')}">${t('reset_today')}</button>`;
  html += `<button class="new-day-btn" onclick="window._app.newDay()" title="${t('tip_new_day')}">${t('new_day')}</button>`;
  html += `</div>`;
  el.innerHTML = html;
}

export function toggleTimeGroup(bi) {
  const el = document.getElementById(`tg-${bi}`);
  if (el) el.classList.toggle('collapsed');
}

export function expandAll() {
  document.querySelectorAll('.time-group.collapsed').forEach(el => el.classList.remove('collapsed'));
}

export function toggleMed(medId) {
  const s = state();
  s.checked[medId] = !s.checked[medId];
  save(s);

  const totalMeds = Object.keys(s.checked).length;
  track('dose_toggle', { action: s.checked[medId] ? 'check' : 'uncheck', is_today: _isToday });
  trackAdherenceSnapshot(s.checked, totalMeds, _isToday);

  renderMeds();
}

export function resetDay() {
  if (confirm(t('reset_confirm'))) {
    track('day_reset');
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

// ── Vitals + Notes ────────────────────────────────────────────────────────────

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
  const tipKey = type === 'bp' ? 'tip_bp' : type === 'weight' ? 'tip_weight' : 'tip_temp';
  let html = `<div class="vital-row">`;
  html += `<span class="vital-label">${label} <span class="tip-icon" data-tip-key="${tipKey}">i</span></span>`;

  if (value) {
    const pulseStr = type === 'bp' && value.pulse ? ` <span class="pulse-display">♥${value.pulse}</span>` : '';
    const display = type === 'bp'
      ? `${value.sys}/${value.dia}${pulseStr}${bpHigh(value) ? ` <span style="color:#c00">↑ ${t('take_med')}</span>` : ''}`
      : type === 'temp'
      ? `${value.value}°C`
      : `${value.value} kg`;
    const alertCls = (type === 'bp' && bpHigh(value)) || (type === 'temp' && value.value >= 37.5) ? ' alert' : '';
    html += `<span class="vital-locked${alertCls}" title="${t(tipKey)}">${display} <button class="log-del" title="${t('tip_del')}" onclick="window._tracker.clearVital('${key}','${type}')">×</button></span>`;
  } else if (type === 'bp') {
    html += `<input class="vital-input" id="bp${key}Sys" type="number" inputmode="numeric" placeholder="sys" style="width:40px" title="${t('tip_bp')}">`;
    html += `<span class="vital-slash">/</span>`;
    html += `<input class="vital-input" id="bp${key}Dia" type="number" inputmode="numeric" placeholder="dia" style="width:40px" title="${t('tip_bp')}">`;
    html += `<input class="vital-input" id="bp${key}Pulse" type="number" inputmode="numeric" placeholder="♥" style="width:36px" title="${t('tip_pulse')}">`;
    html += `<button class="vital-ok-btn" onclick="window._tracker.saveVital('${key}','bp')">${t('ok_btn')}</button>`;
  } else {
    const ph    = type === 'weight' ? 'kg'  : '°C';
    const step  = type === 'weight' ? '0.1' : '0.1';
    const width = type === 'weight' ? '56px' : '48px';
    html += `<input class="vital-input wide" id="${key}Val" type="number" inputmode="decimal" step="${step}" placeholder="${ph}" style="width:${width}" title="${t(tipKey)}">`;
    html += `<button class="vital-ok-btn" onclick="window._tracker.saveVital('${key}','${type}')">${t('ok_btn')}</button>`;
  }

  html += `</div>`;
  return html;
}

function renderNotes(s) {
  return `<div class="notes-box">
    <textarea class="notes-input" id="dayNotes" placeholder="${escapeHtml(t('notes_ph'))}"
      oninput="window._tracker.saveNotes(this.value)">${escapeHtml(s.notes || '')}</textarea>
  </div>`;
}

function renderNotesCol(s) {
  const el = document.getElementById('colNotes');
  if (!el) return;
  let html = `<div class="col-title">${t('notes_label')}</div>`;
  html += renderNotes(s);
  el.innerHTML = html;
}

export function saveVital(key, type) {
  const s = state();
  if (type === 'bp') {
    const idx = parseInt(key, 10);
    const sys = parseInt(document.getElementById(`bp${idx}Sys`)?.value, 10);
    const dia = parseInt(document.getElementById(`bp${idx}Dia`)?.value, 10);
    const pulse = parseInt(document.getElementById(`bp${idx}Pulse`)?.value, 10);
    if (!sys || !dia) return;
    if (!s.bp) s.bp = [];
    s.bp[idx] = { sys, dia, time: nowTime(), ...(pulse ? { pulse } : {}) };
  } else {
    const val = parseFloat(document.getElementById(key + 'Val')?.value);
    if (!val) return;
    s[key] = { value: val, time: nowTime() };
  }
  track('vital_logged', { type });
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
  track('vital_cleared', { type });
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
  if (target) {
    const pct = Math.min(100, Math.round((total / target) * 100));
    const ringColor = pct >= 100 ? '#090' : '#000';
    html += `<div class="fluid-ring-wrap">
      <svg viewBox="0 0 36 36" class="fluid-ring">
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f0f0f0" stroke-width="2.5"/>
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="${ringColor}" stroke-width="2.5"
          stroke-dasharray="${pct} 100" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <div class="fluid-ring-label">
        <div class="fluid-ring-num">${total}</div>
        <div class="fluid-ring-sub">ml / ${target}</div>
      </div>
    </div>`;
  } else {
    html += `<div class="fluid-ring-wrap">
      <svg viewBox="0 0 36 36" class="fluid-ring">
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f0f0f0" stroke-width="2.5"/>
      </svg>
      <div class="fluid-ring-label">
        <div class="fluid-ring-num">${total}</div>
        <div class="fluid-ring-sub">ml</div>
      </div>
    </div>`;
  }

  if (type === 'water' && target && _isToday) html += waterPace(total, target);

  if (type === 'water') {
    html += `<div class="fluid-type-row">`;
    DRINK_TYPES.forEach(key => {
      const active = _waterLabel === key ? ' active' : '';
      html += `<button class="fluid-type-btn${active}" onclick="window._tracker.setFluidLabel('${key}')">${t(key)}</button>`;
    });
    html += `</div>`;
  }

  html += `<div class="fluid-btns">`;
  [100, 150, 200, 250, 500].forEach(ml => {
    html += `<button class="fluid-btn" onclick="window._tracker.addFluid('${type}',${ml})">+${ml}</button>`;
  });
  html += `<button class="fluid-btn misc" title="${t('tip_custom_fluid')}" onclick="window._tracker.addCustomFluid('${type}')">+ ml</button>`;
  html += `</div>`;

  html += `<div class="log-scroll">`;
  entries.slice().reverse().forEach((entry, ri) => {
    const idx = entries.length - 1 - ri;
    html += `<div class="log-entry" onclick="window._tracker.editFluid('${type}',${idx})" title="${escapeHtml(t('tip_edit_fluid'))}">
      <span class="log-time">${escapeHtml(entry.time || t('night'))}</span>
      ${entry.label ? `<span class="log-label">${escapeHtml(entry.label)}</span>` : ''}
      <span class="log-amount">${Number(entry.amount) || 0} ml</span>
      <button class="log-del" title="${escapeHtml(t('tip_del'))}" onclick="event.stopPropagation();window._tracker.delFluid('${type}',${idx})">×</button>
    </div>`;
  });
  html += `</div>`;

  el.innerHTML = html;
}

export function setFluidLabel(key) {
  _waterLabel = key;
  renderFluidCol('water', 'colWater', t('fluids_title'), _settings.water_target);
}

export function addFluid(type, ml, method = 'quick') {
  const s = state();
  if (!s[type]) s[type] = [];
  const entry = { amount: ml, time: isNight() ? null : nowTime() };
  if (type === 'water') entry.label = t(_waterLabel);
  s[type].push(entry);
  track('fluid_add', { type, method });
  save(s);

  // Check if water target reached
  if (type === 'water') {
    const total = s.water.reduce((a, e) => a + e.amount, 0);
    if (total >= _settings.water_target) {
      track('water_target_reached', { target_ml: _settings.water_target });
    }
  }

  renderFluidCol('water', 'colWater', t('fluids_title'), _settings.water_target);
  renderFluidCol('urine', 'colUrine', t('urine_title'),  null);
}

export function addCustomFluid(type) {
  const val = prompt(t('fluid_ml_prompt'));
  if (val && !isNaN(val) && Number(val) > 0) addFluid(type, Number(val), 'custom');
}

export function delFluid(type, idx) {
  const s = state();
  s[type].splice(idx, 1);
  track('fluid_delete', { type });
  save(s);
  renderFluidCol('water', 'colWater', t('fluids_title'), _settings.water_target);
  renderFluidCol('urine', 'colUrine', t('urine_title'),  null);
}

export function editFluid(type, idx) {
  const s = state();
  const entry = s[type]?.[idx];
  if (!entry) return;

  // Build edit dialog
  const overlay = document.createElement('div');
  overlay.className = 'edit-fluid-overlay';

  let labelHtml = '';
  if (type === 'water') {
    labelHtml = `<div class="edit-fluid-types">`;
    DRINK_TYPES.forEach(key => {
      const active = t(key) === entry.label ? ' active' : '';
      labelHtml += `<button class="fluid-type-btn${active}" data-drink="${key}">${t(key)}</button>`;
    });
    labelHtml += `</div>`;
  }

  overlay.innerHTML = `
    <div class="edit-fluid-dialog">
      <div class="edit-fluid-header">${escapeHtml(t('edit_fluid_title'))}</div>
      ${labelHtml}
      <div class="edit-fluid-amount-row">
        <input type="number" class="edit-fluid-input" value="${Number(entry.amount) || 0}" min="1" inputmode="numeric">
        <span>ml</span>
      </div>
      <div class="edit-fluid-actions">
        <button class="edit-fluid-cancel">${escapeHtml(t('cancel_btn'))}</button>
        <button class="edit-fluid-save">${escapeHtml(t('ok_btn'))}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('.edit-fluid-input');
  input.select();

  // Label selection
  let selectedLabel = entry.label || null;
  overlay.querySelectorAll('[data-drink]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('[data-drink]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLabel = t(btn.dataset.drink);
    });
  });

  // Cancel
  const close = () => overlay.remove();
  overlay.querySelector('.edit-fluid-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Save
  overlay.querySelector('.edit-fluid-save').addEventListener('click', () => {
    const newAmount = parseInt(input.value, 10);
    if (!newAmount || newAmount < 1) return;
    const fresh = state();
    if (!fresh[type]?.[idx]) { close(); return; }
    fresh[type][idx].amount = newAmount;
    if (type === 'water' && selectedLabel) fresh[type][idx].label = selectedLabel;
    save(fresh);
    renderFluidCol('water', 'colWater', t('fluids_title'), _settings.water_target);
    renderFluidCol('urine', 'colUrine', t('urine_title'),  null);
    close();
  });
}
