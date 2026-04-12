// ── charts.js — Charts view ──

import { getSpreadsheetId, getRange, S } from './sheets.js';
import { t } from './i18n.js';
import { track } from './analytics.js';

let _instances  = [];
let _range      = 7;   // days; 0 = all
let _settings   = { water_target: 3000, bp_times: 2 };

export function initCharts(settings) {
  _settings = { ..._settings, ...settings };
}

export async function openCharts() {
  // Sync active range button state
  updateRangeBtns();
  await renderCharts();
}

export function setRange(days) {
  _range = days;
  track('charts_range', { range: days });
  updateRangeBtns();
  renderCharts();
}

function updateRangeBtns() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.days) === _range);
  });
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function fetchAllData() {
  const sheetId = await getSpreadsheetId();
  const [daily, labs] = await Promise.all([
    getRange(sheetId, `${S.DAILY}!A:S`),  // date…pulse_pm
    getRange(sheetId, `${S.LABS}!A:D`),
  ]);

  const allDaily = daily.slice(1)
    .filter(r => r[0])
    .map(r => ({
      date:       r[0],
      bp_am_sys:  parseFloat(r[1]) || null,
      bp_am_dia:  parseFloat(r[2]) || null,
      bp_pm_sys:  parseFloat(r[3]) || null,
      bp_pm_dia:  parseFloat(r[4]) || null,
      weight:     parseFloat(r[5]) || null,
      temp:       parseFloat(r[6]) || null,
      meds_done:  parseInt(r[7])   || null,
      meds_total: parseInt(r[8])   || null,
      water_ml:   parseInt(r[9])   || 0,
      urine_ml:   parseInt(r[10])  || 0,
      pulse_am:   parseInt(r[17])  || null,
      pulse_pm:   parseInt(r[18])  || null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const allLabs = labs.slice(1)
    .filter(r => r[0])
    .map(r => ({
      date:       r[0],
      creatinine: parseFloat(r[1]) || null,
      tacrolimus: parseFloat(r[2]) || null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { allDaily, allLabs };
}

/** Fill every calendar day in the range with data (missing days get empty row). */
function fillDateRange(rows, rangeDays) {
  if (rows.length === 0) return [];

  const byDate = {};
  rows.forEach(r => { byDate[r.date] = r; });

  const end   = new Date();
  const start = rangeDays
    ? new Date(end.getTime() - rangeDays * 86_400_000)
    : new Date(rows[0].date + 'T12:00:00');

  const result = [];
  const d = new Date(start);
  d.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);

  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    result.push(byDate[key] || { date: key });
    d.setDate(d.getDate() + 1);
  }
  return result;
}

function filterByRange(rows, rangeDays) {
  if (!rangeDays) return rows;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter(r => r.date >= cutoffStr);
}

// ── Chart rendering ────────────────────────────────────────────────────────────

async function renderCharts() {
  const body = document.getElementById('chartsBody');
  if (!body) return;

  body.innerHTML = `<div style="text-align:center;padding:48px 0"><div class="loading-spinner" style="margin:0 auto"></div></div>`;

  try {
    const { allDaily, allLabs } = await fetchAllData();
    const labs   = filterByRange(allLabs, _range);
    const filled = fillDateRange(allDaily, _range);

    // Destroy old instances
    _instances.forEach(c => c.destroy());
    _instances = [];
    body.innerHTML = '';

    if (filled.length === 0 && labs.length === 0) {
      body.innerHTML = `<p class="charts-empty">${t('charts_no_data')}</p>`;
      return;
    }

    const labels = filled.map(r => fmtDate(r.date));

    renderBPChart(body, filled, labels);
    renderFluidChart(body, filled, labels);
    renderWeightChart(body, filled, labels);
    renderLabsChart(body, labs);
    renderTempChart(body, filled, labels);
    renderAdherenceChart(body, filled, labels);

  } catch (e) {
    body.innerHTML = `<p class="charts-empty" style="color:#c00">${t('charts_load_error')}</p>`;
    console.error('[charts] error:', e);
  }
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function makeSection(titleKey) {
  const id = `cv_${titleKey}`;
  const section = document.createElement('div');
  section.className = 'chart-section';
  section.innerHTML = `<h3 class="chart-title">${t(titleKey)}</h3><div class="chart-wrap"><canvas id="${id}"></canvas></div>`;
  return { section, canvasId: id };
}

function register(chart) {
  _instances.push(chart);
}

// ── Brand palette ──────────────────────────────────────────────────────────────
const CORAL    = '#E8927C';
const CORAL_F  = 'rgba(232,146,124,0.10)';
const CORAL_R  = 'rgba(232,146,124,0.28)';   // reference lines
const GREEN    = '#1B6B5A';
const GREEN_F  = 'rgba(27,107,90,0.08)';
const GREEN_R  = 'rgba(27,107,90,0.22)';
const GREEN_B  = 'rgba(27,107,90,0.55)';     // bars
const DARK     = '#0F2622';
const MUTED    = '#4A6965';
const AMBER    = '#D97706';
const AMBER_B  = 'rgba(217,119,6,0.55)';     // bars
const INDIGO   = '#6366F1';                   // pulse — distinct from coral/green
const GRID     = 'rgba(212,234,230,0.9)';    // brand-border
const MONO     = "'JetBrains Mono', 'Courier New', monospace";
const FS       = 11;

function baseOpts(yLabel) {
  const tickFont = { family: MONO, size: FS };
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'top',
        labels: { font: { family: MONO, size: FS - 1 }, boxWidth: 10, padding: 8, color: MUTED },
      },
      tooltip: {
        titleFont: { family: MONO, size: FS },
        bodyFont:  { family: MONO, size: FS },
        backgroundColor: '#fff',
        titleColor: DARK,
        bodyColor:  MUTED,
        borderColor: GRID,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        ticks: { font: tickFont, color: MUTED, maxRotation: 45, autoSkip: true, maxTicksLimit: 10 },
        grid:  { color: GRID },
        border: { color: GRID },
      },
      y: {
        ticks: { font: tickFont, color: MUTED },
        grid:  { color: GRID },
        border: { color: GRID },
        ...(yLabel ? { title: { display: true, text: yLabel, font: { family: MONO, size: FS }, color: MUTED } } : {}),
      },
    },
  };
}

function hLine(label, value, color) {
  return {
    label,
    data: null,   // filled at call site
    borderColor: color,
    borderWidth: 1,
    borderDash: [6, 4],
    pointRadius: 0,
    fill: false,
    tension: 0,
    order: 0,
  };
}

// ── Blood Pressure ─────────────────────────────────────────────────────────────

function renderBPChart(body, data, labels) {
  if (!data.some(r => r.bp_am_sys || r.bp_pm_sys)) return;

  const { section, canvasId } = makeSection('charts_bp');
  body.appendChild(section);

  const datasets = [
    { label: t('charts_sys_am'), data: data.map(r => r.bp_am_sys), borderColor: CORAL, backgroundColor: CORAL_F, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: CORAL, tension: 0.35, spanGaps: false, fill: true },
    { label: t('charts_dia_am'), data: data.map(r => r.bp_am_dia), borderColor: GREEN, backgroundColor: GREEN_F, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: GREEN, tension: 0.35, spanGaps: false, fill: true },
  ];

  if (_settings.bp_times > 1 && data.some(r => r.bp_pm_sys)) {
    datasets.push({ label: t('charts_sys_pm'), data: data.map(r => r.bp_pm_sys), borderColor: CORAL, borderWidth: 1.5, borderDash: [4,3], pointRadius: 2, tension: 0.35, spanGaps: false, fill: false });
    datasets.push({ label: t('charts_dia_pm'), data: data.map(r => r.bp_pm_dia), borderColor: GREEN, borderWidth: 1.5, borderDash: [4,3], pointRadius: 2, tension: 0.35, spanGaps: false, fill: false });
  }

  if (data.some(r => r.pulse_am)) {
    datasets.push({ label: t('charts_pulse_am'), data: data.map(r => r.pulse_am), borderColor: INDIGO, backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: INDIGO, tension: 0.35, spanGaps: false, fill: true, yAxisID: 'yPulse' });
  }
  if (_settings.bp_times > 1 && data.some(r => r.pulse_pm)) {
    datasets.push({ label: t('charts_pulse_pm'), data: data.map(r => r.pulse_pm), borderColor: INDIGO, borderWidth: 1.5, borderDash: [4,3], pointRadius: 2, tension: 0.35, spanGaps: false, fill: false, yAxisID: 'yPulse' });
  }

  datasets.push({ label: '140', data: labels.map(() => 140), borderColor: CORAL_R, borderWidth: 1, borderDash: [6,4], pointRadius: 0, fill: false, tension: 0 });
  datasets.push({ label: '90',  data: labels.map(() => 90),  borderColor: GREEN_R, borderWidth: 1, borderDash: [6,4], pointRadius: 0, fill: false, tension: 0 });

  const hasPulse = data.some(r => r.pulse_am || r.pulse_pm);
  const opts = { ...baseOpts('mmHg') };
  opts.scales.y.suggestedMin = 60;
  opts.scales.y.suggestedMax = 180;
  if (hasPulse) {
    opts.scales.yPulse = { position: 'right', ticks: { font: { family: MONO, size: FS }, color: MUTED }, title: { display: true, text: 'bpm', font: { family: MONO, size: FS }, color: MUTED }, suggestedMin: 40, suggestedMax: 120, grid: { drawOnChartArea: false, color: GRID }, border: { color: GRID } };
  }

  const canvas = document.getElementById(canvasId);
  register(new Chart(canvas.getContext('2d'), { type: 'line', data: { labels, datasets }, options: opts }));
}

// ── Fluid Balance ──────────────────────────────────────────────────────────────

function renderFluidChart(body, data, labels) {
  if (!data.some(r => r.water_ml || r.urine_ml)) return;

  const { section, canvasId } = makeSection('charts_fluids');
  body.appendChild(section);

  const net = data.map(r => (r.water_ml || 0) - (r.urine_ml || 0));

  const datasets = [
    { type: 'bar',  label: t('charts_water_in'),    data: data.map(r => r.water_ml || 0), backgroundColor: GREEN_B, borderRadius: 4, order: 2 },
    { type: 'bar',  label: t('charts_urine_out'),   data: data.map(r => r.urine_ml || 0), backgroundColor: AMBER_B, borderRadius: 4, order: 2 },
    { type: 'line', label: t('charts_net_balance'), data: net, borderColor: DARK, borderWidth: 2, pointRadius: 2, pointBackgroundColor: DARK, fill: false, tension: 0.35, order: 1 },
    { type: 'line', label: t('charts_target'),      data: labels.map(() => _settings.water_target || 3000), borderColor: GREEN_R, borderWidth: 1, borderDash: [6,4], pointRadius: 0, fill: false, tension: 0, order: 1 },
  ];

  const opts = { ...baseOpts('ml') };
  opts.scales.y.suggestedMin = 0;

  const canvas = document.getElementById(canvasId);
  register(new Chart(canvas.getContext('2d'), { type: 'bar', data: { labels, datasets }, options: opts }));
}

// ── Weight ─────────────────────────────────────────────────────────────────────

function renderWeightChart(body, data, labels) {
  if (!data.some(r => r.weight)) return;

  const { section, canvasId } = makeSection('charts_weight');
  body.appendChild(section);

  const weights = data.map(r => r.weight);
  const ptColors = weights.map((w, i) => {
    if (i === 0 || !w || !weights[i - 1]) return DARK;
    return Math.abs(w - weights[i - 1]) >= 1 ? CORAL : DARK;
  });

  const canvas = document.getElementById(canvasId);
  register(new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: t('charts_weight_series'), data: weights, borderColor: DARK, backgroundColor: 'rgba(15,38,34,0.06)', borderWidth: 2.5, pointBackgroundColor: ptColors, pointBorderColor: ptColors, pointRadius: 4, tension: 0.35, spanGaps: false, fill: true }] },
    options: baseOpts('kg'),
  }));
}

// ── Lab Results ────────────────────────────────────────────────────────────────

function renderLabsChart(body, labs) {
  if (labs.length === 0) return;

  const { section, canvasId } = makeSection('charts_labs');
  body.appendChild(section);

  const labLabels = labs.map(r => r.date);

  const datasets = [
    { label: t('charts_creatinine'), data: labs.map(r => r.creatinine), borderColor: CORAL, backgroundColor: CORAL_F, borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: CORAL, tension: 0.35, spanGaps: false, fill: true, yAxisID: 'y' },
    { label: '≤1.2 mg/dL',           data: labLabels.map(() => 1.2),   borderColor: CORAL_R, borderWidth: 1, borderDash: [6,4], pointRadius: 0, fill: false, tension: 0, yAxisID: 'y' },
    { label: t('charts_tacrolimus'), data: labs.map(r => r.tacrolimus), borderColor: GREEN, backgroundColor: GREEN_F, borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: GREEN, tension: 0.35, spanGaps: false, fill: true, yAxisID: 'y2' },
  ];

  const opts = {
    ...baseOpts(),
    scales: {
      x: baseOpts().scales.x,
      y:  { ...baseOpts().scales.y, position: 'left',  suggestedMin: 0, suggestedMax: 3,  title: { display: true, text: 'Creatinine (mg/dL)', font: { family: MONO, size: FS }, color: MUTED } },
      y2: { ...baseOpts().scales.y, position: 'right', suggestedMin: 0, suggestedMax: 20, title: { display: true, text: 'Tacrolimus (ng/mL)', font: { family: MONO, size: FS }, color: MUTED }, grid: { drawOnChartArea: false, color: GRID } },
    },
  };

  const canvas = document.getElementById(canvasId);
  register(new Chart(canvas.getContext('2d'), { type: 'line', data: { labels: labLabels, datasets }, options: opts }));
}

// ── Temperature ────────────────────────────────────────────────────────────────

function renderTempChart(body, data, labels) {
  if (!data.some(r => r.temp)) return;

  const { section, canvasId } = makeSection('charts_temp');
  body.appendChild(section);

  const temps = data.map(r => r.temp);
  const ptColors = temps.map(v => (v && v >= 37.5) ? CORAL : DARK);

  const datasets = [
    { label: t('charts_temp_series'), data: temps, borderColor: DARK, backgroundColor: 'rgba(15,38,34,0.06)', borderWidth: 2.5, pointBackgroundColor: ptColors, pointBorderColor: ptColors, pointRadius: 4, tension: 0.35, spanGaps: false, fill: true },
    { label: '37.5°C',                data: labels.map(() => 37.5),    borderColor: CORAL_R, borderWidth: 1, borderDash: [6,4], pointRadius: 0, fill: false, tension: 0 },
  ];

  const opts = { ...baseOpts('°C') };
  opts.scales.y.suggestedMin = 36;
  opts.scales.y.suggestedMax = 38.5;

  const canvas = document.getElementById(canvasId);
  register(new Chart(canvas.getContext('2d'), { type: 'line', data: { labels, datasets }, options: opts }));
}

// ── Medication Adherence ───────────────────────────────────────────────────────

function renderAdherenceChart(body, data, labels) {
  if (!data.some(r => r.meds_total)) return;

  const { section, canvasId } = makeSection('charts_adherence');
  body.appendChild(section);

  const pct = data.map(r => r.meds_total ? Math.round(100 * r.meds_done / r.meds_total) : null);
  const colors = pct.map(p => {
    if (p === null)  return 'rgba(212,234,230,0.5)';
    if (p === 100)   return GREEN_B;
    if (p >= 80)     return AMBER_B;
    return 'rgba(185,28,28,0.65)';
  });

  const opts = { ...baseOpts('%') };
  opts.scales.y.suggestedMin = 0;
  opts.scales.y.max = 100;

  const canvas = document.getElementById(canvasId);
  register(new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: t('charts_adherence_series'), data: pct, backgroundColor: colors, borderRadius: 2 }] },
    options: opts,
  }));
}
