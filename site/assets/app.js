// Fair Mitigation Finance Explorer — frontend logic.
// Static port of the 2022 R Shiny app (Pachauri et al. 2022, Science, 10.1126/science.adf0067).
// All arithmetic happens client-side on the three small tables in data.js.

const D = window.FIE_DATA;
const REGIONS = D.regions.map((r) => r.code);
const REGION_NAME = Object.fromEntries(D.regions.map((r) => [r.code, r.name]));
const IND = Object.fromEntries(D.indicators.map((i) => [i.key, i]));

const STATE = {
  pick: { R: '1850 CO2FFI', C: 'GDP per Capita (2019)', N: 'DLS deprivation (2015)' },
  weight: { R: 30, C: 30, N: 30 },
  bound: 'CE_low',
};

// ------------------ helpers ------------------

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const fmt = {
  b: (v) => v.toLocaleString('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
  b0: (v) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 }),
  t: (v) => (v / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 }),
  pct: (v, d = 2) => (100 * v).toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d }) + '%',
  raw: (v) => (v < 10 ? v.toLocaleString('en-GB', { maximumFractionDigits: 3 }) : v.toLocaleString('en-GB', { maximumFractionDigits: 0 })),
};

// ------------------ model ------------------

function normalisedWeights() {
  const w = STATE.weight;
  const sum = w.R + w.C + w.N;
  if (sum === 0) return { R: 1 / 3, C: 1 / 3, N: 1 / 3 };
  return { R: w.R / sum, C: w.C / sum, N: w.N / sum };
}

function compute() {
  const w = normalisedWeights();
  const rows = REGIONS.map((code) => {
    const s = D.shares[code];
    const CE = s[STATE.bound];
    const recent = s.Recent;
    const parts = {
      R: s[STATE.pick.R] * w.R,
      C: s[STATE.pick.C] * w.C,
      N: s[STATE.pick.N] * w.N,
    };
    const finalweight = parts.R + parts.C + parts.N;
    return { code, CE, recent, parts, finalweight, gdp: D.popgdp[code].gdp2017ppp / 1e9 };
  });
  const totalCE = rows.reduce((a, r) => a + r.CE, 0);
  rows.forEach((r) => {
    r.FS = totalCE * r.finalweight;
    const diff = r.FS - r.CE;
    r.inflow = diff < 0 ? -diff : 0; // needs met by inter-regional contributions
    r.outflow = diff > 0 ? diff : 0; // contributions to needs outside the region
    r.within = r.CE - r.inflow; // within-region contribution (incl. recent)
  });
  const totalGDP = rows.reduce((a, r) => a + r.gdp, 0);
  const totalOut = rows.reduce((a, r) => a + r.outflow, 0);
  return { rows, totalCE, totalGDP, totalOut, w };
}

// ------------------ charts ------------------

function baseConfig() {
  const text = cssVar('--text');
  const dim = cssVar('--text-dim');
  const border = cssVar('--border');
  return {
    credits: { enabled: false },
    accessibility: { enabled: false },
    exporting: { enabled: false },
    chart: { backgroundColor: 'transparent', style: { fontFamily: "'Source Sans 3', system-ui, sans-serif" } },
    title: { text: null },
    xAxis: {
      gridLineColor: border, lineColor: border, tickColor: border,
      labels: { style: { color: dim, fontSize: '12px' } },
      title: { style: { color: dim, fontSize: '12px' } },
    },
    yAxis: {
      gridLineColor: border, lineColor: border, tickColor: border,
      labels: { style: { color: dim, fontSize: '12px' } },
      title: { style: { color: dim, fontSize: '12px' } },
    },
    legend: {
      itemStyle: { color: text, fontWeight: '500', fontSize: '12px' },
      itemHoverStyle: { color: cssVar('--primary') },
    },
    tooltip: { backgroundColor: cssVar('--surface'), borderColor: border, style: { color: text, fontSize: '12px' } },
    plotOptions: { series: { animation: { duration: 200 } } },
  };
}

function renderContributions(containerId, M, perGDP) {
  const scale = (r, v) => (perGDP ? v / r.gdp : v);
  const unit = perGDP ? 'share of regional GDP (2019)' : 'billion USD PPP 2015 / year';
  const f = perGDP ? (v) => fmt.pct(v) : (v) => fmt.b(v);
  const cats = M.rows.map((r) => r.code);
  const mk = (name, key, color, id) => ({
    id, name, color, type: 'column',
    data: M.rows.map((r) => ({ y: scale(r, r[key]), region: r.code })),
    stack: 'fs',
  });
  const series = [
    mk('Within-region contributions to mitigation needs', 'within', cssVar('--c-within'), 'within'),
    mk('Mitigation needs met by inter-regional contributions', 'inflow', cssVar('--c-inflow'), 'inflow'),
    mk('Inter-regional contributions to needs outside the region', 'outflow', cssVar('--c-outflow'), 'outflow'),
    {
      name: 'Recent average within-region mitigation investment',
      type: 'column', color: cssVar('--c-recent'), stack: 'recent', pointWidth: 14, zIndex: 2,
      data: M.rows.map((r) => ({ y: scale(r, r.recent), region: r.code })),
      grouping: false, pointPlacement: 0,
    },
    {
      name: 'AR6 WGIII cost-effective investment needs',
      type: 'scatter', color: cssVar('--text'), zIndex: 3,
      marker: { symbol: 'circle', radius: 5, lineWidth: 1.5, lineColor: cssVar('--surface') },
      data: M.rows.map((r) => ({ y: scale(r, r.CE), region: r.code })),
    },
  ];
  Highcharts.chart(containerId, Highcharts.merge(baseConfig(), {
    chart: { type: 'column' },
    xAxis: { categories: cats, crosshair: true },
    yAxis: {
      title: { text: unit.charAt(0).toUpperCase() + unit.slice(1) },
      min: 0,
      labels: perGDP ? { formatter() { return fmt.pct(this.value, 1); } } : {},
      reversedStacks: false,
    },
    legend: { align: 'center', verticalAlign: 'bottom', layout: 'horizontal', itemMarginBottom: 4, symbolRadius: 2 },
    tooltip: {
      shared: true, useHTML: true,
      formatter() {
        const code = this.points[0].point.region;
        const r = M.rows.find((x) => x.code === code);
        const row = (label, v, color) => `<span style="color:${color}">■</span> ${label}: <b>${f(scale(r, v))}</b><br/>`;
        return `<strong>${code} — ${REGION_NAME[code]}</strong><br/>` +
          row('AR6 cost-effective needs', r.CE, cssVar('--text')) +
          row("'Fair-share' contribution", r.FS, cssVar('--primary')) +
          row('Within-region', r.within, cssVar('--c-within')) +
          row('Needs met by inter-regional inflows', r.inflow, cssVar('--c-inflow')) +
          row('Inter-regional outflows', r.outflow, cssVar('--c-outflow')) +
          row('Recent average investment', r.recent, cssVar('--c-recent'));
      },
    },
    plotOptions: {
      column: { stacking: 'normal', borderWidth: 0, pointPadding: 0.08, groupPadding: 0.12 },
      series: { states: { inactive: { opacity: 1 } } },
    },
    series,
  }));
}

function renderTable(tableId, M, perGDP) {
  const f = perGDP ? (r, v) => fmt.pct(v / r.gdp) : (r, v) => fmt.b(v);
  const head = ['Region', 'Recent avg. investment', 'AR6 investment needs', "'Fair' contribution", '… within-region', '… inter-regional'];
  const body = M.rows.map((r) => [
    `<td title="${REGION_NAME[r.code]}">${r.code}</td>`,
    f(r, r.recent), f(r, r.CE), f(r, r.FS), f(r, r.within), f(r, r.outflow),
  ]);
  const tot = (k) => M.rows.reduce((a, r) => a + r[k], 0);
  const totalRow = perGDP
    ? ['Global', fmt.pct(tot('recent') / M.totalGDP), fmt.pct(tot('CE') / M.totalGDP), fmt.pct(tot('FS') / M.totalGDP), fmt.pct(tot('within') / M.totalGDP), fmt.pct(tot('outflow') / M.totalGDP)]
    : ['Global', fmt.b(tot('recent')), fmt.b(tot('CE')), fmt.b(tot('FS')), fmt.b(tot('within')), fmt.b(tot('outflow'))];
  const unitNote = perGDP ? 'share of 2019 regional GDP' : 'billion USD PPP 2015 per year';
  document.getElementById(tableId).innerHTML =
    `<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>` +
    `<tbody>${body.map((cells) => `<tr>${cells.map((c, i) => (i === 0 ? c : `<td>${c}</td>`)).join('')}</tr>`).join('')}` +
    `<tr class="total">${totalRow.map((c) => `<td>${c}</td>`).join('')}</tr></tbody>` +
    `<caption style="caption-side:bottom;text-align:left;font-size:0.78rem;color:var(--text-dim);padding:8px 10px 0">Units: ${unitNote}.</caption>`;
}

function renderSankey(M) {
  const palette = ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a'];
  const data = [];
  const nodes = [];
  M.rows.forEach((r, i) => {
    nodes.push({ id: r.code, name: `${r.code}`, color: palette[i], column: 0 });
    if (r.within > 0.5) data.push({ from: r.code, to: 'Within-region', weight: Math.round(r.within), color: palette[i] });
    if (r.outflow > 0.5) data.push({ from: r.code, to: 'Inter-regional fund', weight: Math.round(r.outflow), color: palette[i] });
  });
  nodes.push({ id: 'Within-region', name: 'Within-region needs', color: cssVar('--c-within'), column: 1 });
  nodes.push({ id: 'Inter-regional fund', name: 'Inter-regional fund', color: cssVar('--c-outflow'), column: 1 });
  M.rows.forEach((r, i) => {
    if (r.inflow > 0.5) {
      nodes.push({ id: `to-${r.code}`, name: `Fund → ${r.code}`, color: palette[i], column: 2 });
      data.push({ from: 'Inter-regional fund', to: `to-${r.code}`, weight: Math.round(r.inflow), color: cssVar('--c-inflow') });
    }
  });
  Highcharts.chart('chart-sankey', Highcharts.merge(baseConfig(), {
    chart: { marginLeft: 10, marginRight: 10 },
    tooltip: {
      useHTML: true,
      nodeFormatter() { return `<strong>${this.name}</strong><br/>${fmt.b0(this.sum)} billion USD / year`; },
      pointFormatter() {
        return `${this.fromNode.name} → ${this.toNode.name}: <b>${fmt.b0(this.weight)}</b> billion USD / year`;
      },
    },
    series: [{
      type: 'sankey', keys: ['from', 'to', 'weight'],
      nodes, data,
      nodeWidth: 18, nodePadding: 14, linkOpacity: 0.45,
      dataLabels: {
        allowOverlap: true,
        style: { color: cssVar('--text'), textOutline: 'none', fontSize: '12px', fontWeight: '500' },
        nodeFormatter() { return `${this.point.name} (${fmt.b0(this.point.sum)})`; },
      },
    }],
  }));
}

function facetChart(el, title, values, used, yFormatter, yMax) {
  const wrap = document.createElement('div');
  wrap.className = 'facet' + (used ? '' : ' unused');
  wrap.innerHTML = `<div class="facet-title">${title}</div><div class="facet-chart"></div>`;
  el.appendChild(wrap);
  Highcharts.chart(wrap.querySelector('.facet-chart'), Highcharts.merge(baseConfig(), {
    chart: { type: 'column', spacing: [6, 6, 6, 6] },
    xAxis: { categories: REGIONS, labels: { rotation: -45, style: { fontSize: '10px' } } },
    yAxis: { title: { text: null }, min: 0, max: yMax ?? null, labels: { formatter() { return yFormatter(this.value); } } },
    legend: { enabled: false },
    tooltip: { formatter() { return `<b>${this.x} — ${REGION_NAME[this.x]}</b><br/>${yFormatter(this.y)}`; } },
    plotOptions: { column: { borderWidth: 0, color: used ? cssVar('--c-used') : cssVar('--c-unused') } },
    series: [{ data: values }],
  }));
}

function renderIndicators(M) {
  const rawEl = document.getElementById('facets-raw');
  const shEl = document.getElementById('facets-shares');
  rawEl.innerHTML = ''; shEl.innerHTML = '';
  ['R', 'C', 'N'].forEach((p) => {
    const key = STATE.pick[p];
    const ind = IND[key];
    const used = M.w[p] > 0;
    facetChart(rawEl, `${ind.short} — ${ind.label} <span style="font-weight:400">(${ind.units})</span>`,
      REGIONS.map((c) => D.raw[c][key]), used, fmt.raw);
    facetChart(shEl, `${ind.short} — ${ind.label} <span style="font-weight:400">(weight ${Math.round(100 * M.w[p])})</span>`,
      REGIONS.map((c) => D.shares[c][key]), used, (v) => fmt.pct(v, 0), 0.4);
  });
  Highcharts.chart('chart-agg', Highcharts.merge(baseConfig(), {
    chart: { type: 'column' },
    xAxis: { categories: REGIONS },
    yAxis: { title: { text: 'Share of global cost-effective investment needs' }, min: 0, max: 0.4, labels: { formatter() { return fmt.pct(this.value, 0); } } },
    legend: { enabled: false },
    tooltip: {
      formatter() {
        const r = M.rows.find((x) => x.code === this.x);
        return `<b>${r.code} — ${REGION_NAME[r.code]}</b><br/>Aggregate share: <b>${fmt.pct(r.finalweight)}</b><br/>` +
          `R: ${fmt.pct(r.parts.R)} · C: ${fmt.pct(r.parts.C)} · N: ${fmt.pct(r.parts.N)}`;
      },
    },
    plotOptions: { column: { borderWidth: 0, color: cssVar('--c-used') } },
    series: [{ data: M.rows.map((r) => r.finalweight) }],
  }));
}

// ------------------ summary + notes ------------------

function renderSummary(M) {
  const el = document.querySelector('.summary-strip');
  const w = M.w;
  const maxOut = M.rows.reduce((a, r) => (r.outflow > a.outflow ? r : a), M.rows[0]);
  const maxIn = M.rows.reduce((a, r) => (r.inflow > a.inflow ? r : a), M.rows[0]);
  el.innerHTML = `
    <div class="stat"><div class="stat-label">Global AR6 needs (${STATE.bound === 'CE_low' ? 'lower' : 'upper'} bound)</div>
      <div class="stat-value">${fmt.t(M.totalCE)}<span class="stat-unit">trn USD / yr</span></div></div>
    <div class="stat"><div class="stat-label">'Fair' inter-regional transfers</div>
      <div class="stat-value">${fmt.t(M.totalOut)}<span class="stat-unit">trn USD / yr</span></div></div>
    <div class="stat"><div class="stat-label">… as share of global GDP</div>
      <div class="stat-value">${fmt.pct(M.totalOut / M.totalGDP)}</div></div>
    <div class="stat"><div class="stat-label">Largest contributor</div>
      <div class="stat-value">${maxOut.code}<span class="stat-unit">${fmt.b0(maxOut.outflow)} bn / yr</span></div></div>
    <div class="stat"><div class="stat-label">Largest recipient</div>
      <div class="stat-value">${maxIn.code}<span class="stat-unit">${fmt.b0(maxIn.inflow)} bn / yr</span></div></div>
    <div class="stat"><div class="stat-label">Weights R · C · N</div>
      <div class="stat-value">${Math.round(100 * w.R)} · ${Math.round(100 * w.C)} · ${Math.round(100 * w.N)}</div></div>
  `;
}

function renderWeightsNote(M) {
  const el = document.getElementById('weights-note');
  const line = (p) => `${IND[STATE.pick[p]].short} ${IND[STATE.pick[p]].label} — <strong>${Math.round(100 * M.w[p])}</strong>`;
  el.innerHTML = `<strong>Normalised weights</strong><br/>${line('R')}<br/>${line('C')}<br/>${line('N')}`;
}

// ------------------ wiring ------------------

function refresh() {
  const M = compute();
  renderSummary(M);
  renderWeightsNote(M);
  renderContributions('chart-contrib', M, false);
  renderTable('tbl-contrib', M, false);
  renderContributions('chart-gdp', M, true);
  renderTable('tbl-gdp', M, true);
  renderSankey(M);
  renderIndicators(M);
}

function initInputs() {
  ['R', 'C', 'N'].forEach((p) => {
    const sel = document.getElementById(`sel-${p}`);
    D.indicators.filter((i) => i.principle === p).forEach((i) => {
      const opt = document.createElement('option');
      opt.value = i.key; opt.textContent = `${i.short} — ${i.label}`;
      sel.appendChild(opt);
    });
    sel.value = STATE.pick[p];
    sel.addEventListener('change', (e) => { STATE.pick[p] = e.target.value; refresh(); });
    const slider = document.getElementById(`w-${p}`);
    const out = document.getElementById(`w-${p}-out`);
    slider.value = STATE.weight[p]; out.textContent = STATE.weight[p];
    slider.addEventListener('input', (e) => {
      STATE.weight[p] = Number(e.target.value); out.textContent = STATE.weight[p]; refresh();
    });
  });
  const bound = document.getElementById('sel-bound');
  D.bounds.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.key; opt.textContent = b.label; bound.appendChild(opt);
  });
  bound.value = STATE.bound;
  bound.addEventListener('change', (e) => { STATE.bound = e.target.value; refresh(); });

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tabpane').forEach((p) => p.classList.toggle('active', p.dataset.pane === btn.dataset.tab));
      // Highcharts sizes to a hidden container as 0 — reflow once visible.
      Highcharts.charts.forEach((c) => c && c.reflow());
    });
  });

  document.getElementById('region-key-list').innerHTML =
    D.regions.map((r) => `<code>${r.code}</code> ${r.name}`).join(' · ');
}

document.addEventListener('DOMContentLoaded', () => {
  initInputs();
  refresh();
});

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
}
