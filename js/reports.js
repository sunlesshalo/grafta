// ── reports.js — Medical Reports ──

import { getSpreadsheetId, getRange, S } from './sheets.js';
import { getUserEmail } from './auth.js';
import { t, tIn, getLang } from './i18n.js';
import { track } from './analytics.js';

// Report-local translation: uses the report language selector, not the app language
let _reportLang = null;
function rt(key, params) {
  return tIn(_reportLang || getLang(), key, params);
}

export function initReports() {
  const sel = document.getElementById('reportPeriod');
  if (sel) sel.addEventListener('change', syncCustomRange);
  syncCustomRange();
}

function syncCustomRange() {
  const val = document.getElementById('reportPeriod')?.value;
  document.getElementById('reportCustomRange')?.classList.toggle('hidden', val !== 'custom');
}

// ── Public ─────────────────────────────────────────────────────────────────────

export async function generate() {
  const btn = document.getElementById('reportGenerateBtn');
  if (btn) { btn.disabled = true; btn.textContent = t('saving'); }

  const body = document.getElementById('reportBody');
  if (body) body.innerHTML = `<div style="text-align:center;padding:48px 0"><div class="loading-spinner" style="margin:0 auto"></div></div>`;

  try {
    _reportLang = document.getElementById('reportLang')?.value || getLang();
    const { from, to } = getDateRange();
    const period = document.getElementById('reportPeriod')?.value || '30';
    track('report_generate', { period, report_lang: _reportLang });
    const { dailyData, labsData } = await fetchData(from, to);
    if (body) body.innerHTML = buildReport(dailyData, labsData, from, to);

    document.getElementById('reportPrintBtn')?.classList.remove('hidden');
  } catch (e) {
    console.error('[reports] error:', e);
    if (window._showError) window._showError(t('charts_load_error'));
    if (body) body.innerHTML = '';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('reports_generate'); }
  }
}

export function print() {
  track('report_print');
  window.print();
}

// ── Date range ─────────────────────────────────────────────────────────────────

function getDateRange() {
  const period = document.getElementById('reportPeriod')?.value || '30';
  const today  = new Date().toISOString().slice(0, 10);

  if (period === 'custom') {
    const from = document.getElementById('reportFrom')?.value || today;
    const to   = document.getElementById('reportTo')?.value   || today;
    return { from, to };
  }

  const days = parseInt(period) || 30;
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  return { from: from.toISOString().slice(0, 10), to: today };
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function fetchData(from, to) {
  const sheetId = await getSpreadsheetId();
  const [daily, labs] = await Promise.all([
    getRange(sheetId, `${S.DAILY}!A:K`),
    getRange(sheetId, `${S.LABS}!A:D`),
  ]);

  const dailyData = daily.slice(1)
    .filter(r => r[0] && r[0] >= from && r[0] <= to)
    .map(r => ({
      date:       r[0],
      bp_am_sys:  parseFloat(r[1]) || null,
      bp_am_dia:  parseFloat(r[2]) || null,
      bp_pm_sys:  parseFloat(r[3]) || null,
      bp_pm_dia:  parseFloat(r[4]) || null,
      weight:     parseFloat(r[5]) || null,
      temp:       parseFloat(r[6]) || null,
      meds_done:  parseInt(r[7])   || 0,
      meds_total: parseInt(r[8])   || 0,
      water_ml:   parseInt(r[9])   || 0,
      urine_ml:   parseInt(r[10])  || 0,
      pulse_am:   parseInt(r[17])  || null,
      pulse_pm:   parseInt(r[18])  || null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const labsData = labs.slice(1)
    .filter(r => r[0] && r[0] >= from && r[0] <= to)
    .map(r => ({
      date:       r[0],
      creatinine: parseFloat(r[1]) || null,
      tacrolimus: parseFloat(r[2]) || null,
      notes:      r[3] || '',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { dailyData, labsData };
}

// ── Stats ──────────────────────────────────────────────────────────────────────

function calcStats(daily, labs) {
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const min = arr => arr.length ? Math.min(...arr) : null;
  const max = arr => arr.length ? Math.max(...arr) : null;
  const fmt = (n, d = 1) => n !== null && n !== undefined ? (+n).toFixed(d) : '—';

  const bpRows  = daily.filter(r => r.bp_am_sys);
  const sysList = bpRows.map(r => r.bp_am_sys);
  const diaList = bpRows.map(r => r.bp_am_dia);
  const pulseList = daily.filter(r => r.pulse_am).map(r => r.pulse_am);

  const wtList  = daily.filter(r => r.weight).map(r => r.weight);
  const tmpList = daily.filter(r => r.temp).map(r => r.temp);

  const waterDays = daily.filter(r => r.water_ml > 0);
  const urineDays = daily.filter(r => r.urine_ml > 0);

  const totalDone = daily.reduce((s, r) => s + r.meds_done, 0);
  const totalPoss = daily.reduce((s, r) => s + r.meds_total, 0);

  // Trend: first vs last
  const trend = arr => {
    if (arr.length < 2) return null;
    const delta = arr[arr.length - 1] - arr[0];
    if (Math.abs(delta) < 0.05) return 'stable';
    return delta > 0 ? 'rising' : 'falling';
  };

  const creatVals = labs.filter(r => r.creatinine).map(r => r.creatinine);
  const tacrVals  = labs.filter(r => r.tacrolimus).map(r => r.tacrolimus);

  // Alerts
  const highBP      = daily.filter(r => (r.bp_am_sys >= 140 || r.bp_am_dia >= 90 || r.bp_pm_sys >= 140 || r.bp_pm_dia >= 90));
  const weightJumps = [];
  for (let i = 1; i < daily.length; i++) {
    if (daily[i].weight && daily[i - 1].weight) {
      const delta = daily[i].weight - daily[i - 1].weight;
      if (Math.abs(delta) >= 1) weightJumps.push({ date: daily[i].date, from: daily[i-1].weight, to: daily[i].weight, delta });
    }
  }
  const feverDays    = daily.filter(r => r.temp && r.temp >= 37.5);
  const incompleteMedsDays = daily.filter(r => r.meds_total > 0 && r.meds_done < r.meds_total);

  return {
    bp: { avgSys: avg(sysList), avgDia: avg(diaList), minSys: min(sysList), maxSys: max(sysList), minDia: min(diaList), maxDia: max(diaList), readings: bpRows.length, avgPulse: avg(pulseList), minPulse: min(pulseList), maxPulse: max(pulseList) },
    weight: { avg: avg(wtList), min: min(wtList), max: max(wtList), first: wtList[0] ?? null, last: wtList[wtList.length-1] ?? null, delta: wtList.length >= 2 ? wtList[wtList.length-1] - wtList[0] : null },
    temp: { avg: avg(tmpList), max: max(tmpList), feverCount: feverDays.length },
    fluids: { avgWater: avg(waterDays.map(r => r.water_ml)), avgUrine: avg(urineDays.map(r => r.urine_ml)), daysTracked: waterDays.length },
    meds: { totalDone, totalPoss, pct: totalPoss > 0 ? Math.round(100 * totalDone / totalPoss) : null },
    labs: {
      creatinine: { values: creatVals, trend: trend(creatVals), last: creatVals[creatVals.length-1] ?? null },
      tacrolimus: { values: tacrVals,  trend: trend(tacrVals),  last: tacrVals[tacrVals.length-1]   ?? null },
    },
    alerts: { highBP, weightJumps, feverDays, incompleteMedsDays },
    fmt,
  };
}

// ── HTML assembly ──────────────────────────────────────────────────────────────

function buildReport(dailyData, labsData, from, to) {
  const patient = localStorage.getItem('mt_patient_name') || getUserEmail() || 'Patient';
  const stats   = calcStats(dailyData, labsData);
  return `
    <div class="report">
      ${sectionHeader(patient, from, to)}
      ${sectionVitals(stats)}
      ${sectionFluids(stats)}
      ${sectionAdherence(stats)}
      ${sectionAlerts(stats)}
      ${sectionDailyTable(dailyData)}
    </div>`;
}

function sectionHeader(patient, from, to) {
  const now = new Date().toLocaleDateString();
  return `
    <div class="report-header">
      <h1 class="report-title">${rt('reports_header_title')}</h1>
      <div class="report-meta">
        <span><strong>${rt('reports_patient')}:</strong> ${patient}</span>
        <span><strong>${rt('reports_period_label')}:</strong> ${from} — ${to}</span>
        <span><strong>${rt('reports_generated')}:</strong> ${now}</span>
      </div>
    </div>`;
}

function sectionVitals({ bp, weight, temp, fmt }) {
  if (!bp.readings && !weight.avg && !temp.avg) return '';

  let rows = '';
  if (bp.readings > 0) {
    rows += row(rt('reports_stat_bp_avg'),      `${fmt(bp.avgSys, 0)} / ${fmt(bp.avgDia, 0)} mmHg`);
    rows += row(rt('reports_stat_bp_range'),    `${fmt(bp.minSys, 0)}–${fmt(bp.maxSys, 0)} / ${fmt(bp.minDia, 0)}–${fmt(bp.maxDia, 0)} mmHg`);
    if (bp.avgPulse) rows += row(rt('reports_stat_pulse_avg'), `${fmt(bp.avgPulse, 0)} bpm (${fmt(bp.minPulse, 0)}–${fmt(bp.maxPulse, 0)})`);
    rows += row(rt('reports_stat_bp_readings'), String(bp.readings));
  }
  if (weight.avg) {
    rows += row(rt('reports_stat_weight_avg'),   `${fmt(weight.avg)} kg`);
    rows += row(rt('reports_stat_weight_range'), `${fmt(weight.min)} – ${fmt(weight.max)} kg`);
    if (weight.delta !== null) {
      const sign = weight.delta >= 0 ? '+' : '';
      rows += row(rt('reports_stat_weight_delta'), `${sign}${fmt(weight.delta)} kg`);
    }
  }
  if (temp.avg) {
    rows += row(rt('reports_stat_temp_avg'), `${fmt(temp.avg)} °C`);
    rows += row(rt('reports_stat_temp_max'), `${fmt(temp.max)} °C`);
    if (temp.feverCount > 0) rows += row(rt('reports_stat_fever_days'), `${temp.feverCount} ${rt('reports_days')}`, true);
  }

  return section(rt('reports_vitals_title'), `<table class="report-table"><tbody>${rows}</tbody></table>`);
}

function sectionFluids({ fluids, fmt }) {
  if (!fluids.daysTracked) return '';
  const rows =
    row(rt('reports_stat_avg_water'),   `${fmt(fluids.avgWater, 0)} ml / ${rt('reports_days').replace(/s$/, '')}`) +
    row(rt('reports_stat_avg_urine'),   `${fmt(fluids.avgUrine, 0)} ml / ${rt('reports_days').replace(/s$/, '')}`) +
    row(rt('reports_stat_fluid_days'),  `${fluids.daysTracked} ${rt('reports_days')}`);
  return section(rt('reports_fluids_title'), `<table class="report-table"><tbody>${rows}</tbody></table>`);
}

function sectionLabs(labsData, { labs, fmt }) {
  if (labsData.length === 0) return '';

  const icon = tr => tr === 'rising' ? ' ↑' : tr === 'falling' ? ' ↓' : ' →';

  let summaryRows = '';
  if (labs.creatinine.last !== null) {
    const flag = labs.creatinine.last > 1.2;
    summaryRows += row(`${rt('labs_creatinine')} (mg/dL)`, `${fmt(labs.creatinine.last)}${labs.creatinine.trend ? icon(labs.creatinine.trend) : ''}`, flag);
  }
  if (labs.tacrolimus.last !== null) {
    summaryRows += row(`${rt('labs_tacrolimus')} (ng/mL)`, `${fmt(labs.tacrolimus.last)}${labs.tacrolimus.trend ? icon(labs.tacrolimus.trend) : ''}`);
  }

  const histRows = labsData.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.creatinine !== null ? fmt(r.creatinine) : '—'}</td>
      <td>${r.tacrolimus !== null ? fmt(r.tacrolimus) : '—'}</td>
      <td>${r.notes || ''}</td>
    </tr>`).join('');

  const inner = `
    ${summaryRows ? `<table class="report-table"><tbody>${summaryRows}</tbody></table>` : ''}
    <h3 class="report-sub-title">${rt('reports_history')}</h3>
    <table class="report-table report-table-full"><thead>
      <tr><th>${rt('labs_date')}</th><th>${rt('labs_creatinine')} (mg/dL)</th><th>${rt('labs_tacrolimus')} (ng/mL)</th><th>${rt('field_notes')}</th></tr>
    </thead><tbody>${histRows}</tbody></table>`;

  return section(rt('reports_labs_title'), inner);
}

function sectionAdherence({ meds }) {
  if (!meds.totalPoss) return '';
  const flag = meds.pct !== null && meds.pct < 90;
  const rows =
    row(rt('reports_stat_meds_taken'), `${meds.totalDone} / ${meds.totalPoss}`) +
    row(rt('reports_stat_adherence'),  `${meds.pct}%`, flag);
  return section(rt('reports_meds_title'), `<table class="report-table"><tbody>${rows}</tbody></table>`);
}

function sectionAlerts({ alerts, fmt }) {
  const items = [];

  if (alerts.highBP.length > 0) {
    const sample = alerts.highBP.slice(0, 3).map(r => r.date).join(', ');
    items.push(`<li>⚠ ${rt('reports_alert_high_bp')}: ${alerts.highBP.length} ${rt('reports_days')} (${sample}${alerts.highBP.length > 3 ? '…' : ''})</li>`);
  }
  alerts.weightJumps.forEach(j => {
    const sign = j.to > j.from ? '+' : '';
    items.push(`<li>⚠ ${rt('reports_alert_weight_jump')}: ${j.date} (${j.from} → ${j.to} kg, ${sign}${fmt(j.delta)} kg)</li>`);
  });
  if (alerts.feverDays.length > 0) {
    items.push(`<li>⚠ ${rt('reports_alert_fever')}: ${alerts.feverDays.map(r => r.date).join(', ')}</li>`);
  }
  if (alerts.incompleteMedsDays.length > 0) {
    items.push(`<li>⚠ ${rt('reports_alert_missed_meds')}: ${alerts.incompleteMedsDays.length} ${rt('reports_days')}</li>`);
  }

  const content = items.length
    ? `<ul class="report-alerts">${items.join('')}</ul>`
    : `<p class="report-ok">✓ ${rt('reports_no_alerts')}</p>`;

  return section(rt('reports_alerts_title'), content);
}

function sectionDailyTable(daily) {
  if (daily.length === 0) return '';

  const rows = daily.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.bp_am_sys ? `${r.bp_am_sys}/${r.bp_am_dia}` : '—'}${r.pulse_am ? ` <small>♥${r.pulse_am}</small>` : ''}</td>
      <td>${r.bp_pm_sys ? `${r.bp_pm_sys}/${r.bp_pm_dia}` : '—'}${r.pulse_pm ? ` <small>♥${r.pulse_pm}</small>` : ''}</td>
      <td>${r.weight    ? `${r.weight} kg`  : '—'}</td>
      <td>${r.temp      ? `${r.temp}°C`     : '—'}</td>
      <td>${r.water_ml  ? `${r.water_ml} ml`: '—'}</td>
      <td>${r.urine_ml  ? `${r.urine_ml} ml`: '—'}</td>
      <td>${r.meds_total ? `${r.meds_done}/${r.meds_total}` : '—'}</td>
    </tr>`).join('');

  const inner = `
    <table class="report-table report-table-full">
      <thead><tr>
        <th>${rt('labs_date')}</th>
        <th>BP AM</th><th>BP PM</th>
        <th>${rt('vital_wt')}</th>
        <th>${rt('vital_temp')}</th>
        <th>${rt('fluids_title')}</th>
        <th>${rt('urine_title')}</th>
        <th>${rt('meds_title')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return section(rt('reports_daily_table'), inner);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function section(title, content) {
  return `<div class="report-section"><h2>${title}</h2>${content}</div>`;
}

function row(label, value, flag = false) {
  return `<tr${flag ? ' class="report-flag-row"' : ''}><td>${label}</td><td>${value}</td></tr>`;
}
