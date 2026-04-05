// ── labs.js — Lab results CRUD + trend ──

import { getSpreadsheetId, getLabs, appendLab, deleteLabRow } from './sheets.js';
import { t, tArr } from './i18n.js';

let _labs = []; // [{ date, creatinine, tacrolimus, notes }]
let _loaded = false;

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadLabs() {
  try {
    const sheetId = await getSpreadsheetId();
    const rows    = await getLabs(sheetId);
    _labs = rows.slice(1) // skip header
      .filter(r => r[0])
      .map(r => ({
        date:       r[0],
        creatinine: r[1] || '',
        tacrolimus: r[2] || '',
        notes:      r[3] || '',
      }))
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first
    _loaded = true;
  } catch (e) {
    console.warn('loadLabs failed:', e);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

export async function renderLabs() {
  const el = document.getElementById('colLabs');
  if (!el) return;

  if (!_loaded) await loadLabs();

  let html = `<div class="col-title">${t('labs_title')}</div>`;

  // Entry form
  const today = todayKey();
  html += `
    <div class="labs-form">
      <div class="labs-form-row">
        <div class="labs-input-group">
          <span class="labs-label">${t('labs_date')}</span>
          <input class="labs-input date-input" type="date" id="labDate" value="${today}">
        </div>
      </div>
      <div class="labs-form-row">
        <div class="labs-input-group">
          <span class="labs-label" title="${t('tip_creatinine')}">${t('labs_creatinine')}</span>
          <input class="labs-input" type="number" step="0.01" inputmode="decimal" id="labCreatinine" placeholder="mg/dL" title="${t('tip_creatinine')}">
        </div>
        <div class="labs-input-group">
          <span class="labs-label" title="${t('tip_tacrolimus')}">${t('labs_tacrolimus')}</span>
          <input class="labs-input" type="number" step="0.1" inputmode="decimal" id="labTacrolimus" placeholder="ng/mL" title="${t('tip_tacrolimus')}">
        </div>
      </div>
      <div class="labs-form-row">
        <input class="labs-input date-input" type="text" id="labNotes" placeholder="${t('labs_notes_ph')}" style="width:100%">
      </div>
      <div class="labs-form-row">
        <button class="labs-add-btn" onclick="window._labs.addLab()">${t('labs_add')}</button>
      </div>
    </div>`;

  // Trend sparkline
  if (_labs.length >= 2) html += renderTrend();

  // Entry list
  if (_labs.length === 0) {
    html += `<p style="color:#999;font-size:12px;padding:8px 0">${t('labs_no_results')}</p>`;
  } else {
    _labs.forEach(lab => {
      html += `
        <div class="labs-entry">
          <span class="labs-entry-date">${formatDate(lab.date)}</span>
          <span class="labs-entry-vals">
            ${lab.creatinine ? `Cr: <strong>${lab.creatinine}</strong>` : ''}
            ${lab.creatinine && lab.tacrolimus ? ' · ' : ''}
            ${lab.tacrolimus ? `FK: <strong>${lab.tacrolimus}</strong>` : ''}
          </span>
          <span class="labs-entry-notes">${lab.notes}</span>
          <button class="log-del" title="${t('tip_del')}" onclick="window._labs.deleteLab('${lab.date}')">×</button>
        </div>`;
    });
  }

  el.innerHTML = html;
}

// ── Trend ─────────────────────────────────────────────────────────────────────

function renderTrend() {
  const creatVals = _labs.filter(l => l.creatinine).slice(0, 8).reverse()
    .map(l => ({ date: l.date, val: parseFloat(l.creatinine) }))
    .filter(v => !isNaN(v.val));

  const tachVals = _labs.filter(l => l.tacrolimus).slice(0, 8).reverse()
    .map(l => ({ date: l.date, val: parseFloat(l.tacrolimus) }))
    .filter(v => !isNaN(v.val));

  if (creatVals.length < 2 && tachVals.length < 2) return '';

  let html = `<div class="labs-trend">`;

  if (creatVals.length >= 2) {
    html += `<div style="margin-bottom:6px"><strong>${t('labs_creatinine')}</strong> (${t('labs_last_n', { n: creatVals.length })})`;
    html += renderSparkline(creatVals.map(v => v.val));
    html += `</div>`;
  }
  if (tachVals.length >= 2) {
    html += `<div style="margin-bottom:6px"><strong>${t('labs_tacrolimus')}</strong> (${t('labs_last_n', { n: tachVals.length })})`;
    html += renderSparkline(tachVals.map(v => v.val));
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function renderSparkline(values) {
  const W = 120, H = 28, PAD = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;

  const pts = values.map((v, i) => {
    const x = PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const last  = values[values.length - 1];
  const prev  = values[values.length - 2];
  const trend = last > prev ? '↑' : last < prev ? '↓' : '→';
  const color = trend === '↑' ? '#c00' : trend === '↓' ? '#090' : '#999';

  return `<span style="display:inline-flex;align-items:center;gap:6px;margin-left:8px">
    <svg width="${W}" height="${H}" style="overflow:visible">
      <polyline points="${pts}" fill="none" stroke="#999" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}" r="2.5" fill="#000"/>
    </svg>
    <strong style="font-size:14px;color:${color}">${last} ${trend}</strong>
  </span>`;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function addLab() {
  const date        = document.getElementById('labDate')?.value;
  const creatinine  = document.getElementById('labCreatinine')?.value;
  const tacrolimus  = document.getElementById('labTacrolimus')?.value;
  const notes       = document.getElementById('labNotes')?.value || '';

  if (!date)                       { alert(t('val_enter_date'));  return; }
  if (!creatinine && !tacrolimus)  { alert(t('val_enter_value')); return; }

  const btn = document.querySelector('.labs-add-btn');
  if (btn) { btn.disabled = true; btn.textContent = t('saving'); }

  try {
    const sheetId = await getSpreadsheetId();
    await appendLab(sheetId, date, creatinine, tacrolimus, notes);

    // Update local cache
    const idx = _labs.findIndex(l => l.date === date);
    const entry = { date, creatinine, tacrolimus, notes };
    if (idx >= 0) _labs[idx] = entry;
    else _labs.unshift(entry);
    _labs.sort((a, b) => b.date.localeCompare(a.date));

    // Clear form
    if (document.getElementById('labCreatinine')) document.getElementById('labCreatinine').value = '';
    if (document.getElementById('labTacrolimus')) document.getElementById('labTacrolimus').value = '';
    if (document.getElementById('labNotes'))      document.getElementById('labNotes').value      = '';

    renderLabs();
  } catch (e) {
    alert(t('labs_failed_save') + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('labs_add'); }
  }
}

export async function deleteLab(date) {
  if (!confirm(t('labs_delete_confirm', { date }))) return;
  try {
    const sheetId = await getSpreadsheetId();
    await deleteLabRow(sheetId, date);
    _labs = _labs.filter(l => l.date !== date);
    renderLabs();
  } catch (e) {
    alert(t('labs_failed_delete') + e.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayKey() {
  const now = new Date();
  if (now.getHours() < 5) now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const d    = new Date(dateStr + 'T12:00:00');
  const days = tArr('days');
  const mons = tArr('months');
  return `${days[d.getDay()]} ${d.getDate()} ${mons[d.getMonth()]} ${d.getFullYear()}`;
}
