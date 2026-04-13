/**
 * Chart.js shared configuration helpers.
 */

/**
 * Default grid/axis options for financial charts.
 */
export function getDefaultScaleOptions() {
  return {
    x: {
      grid: {
        color: 'var(--chart-grid)',
        drawBorder: false,
      },
      ticks: {
        color: 'var(--chart-text)',
        font: { size: 10 },
        maxRotation: 0,
      },
    },
    y: {
      grid: {
        color: 'var(--chart-grid)',
        drawBorder: false,
      },
      ticks: {
        color: 'var(--chart-text)',
        font: { size: 10 },
      },
    },
  };
}

/**
 * Default tooltip configuration.
 */
export function getDefaultTooltipOptions() {
  return {
    backgroundColor: 'var(--bg2)',
    titleColor: 'var(--text)',
    bodyColor: 'var(--text2)',
    borderColor: 'var(--border)',
    borderWidth: 1,
    cornerRadius: 6,
    padding: 8,
    titleFont: { size: 11, weight: '600' },
    bodyFont: { size: 11 },
    displayColors: true,
    boxPadding: 4,
  };
}

/**
 * Equity curve chart configuration.
 */
export function getEquityCurveConfig(labels, data) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Equity',
          data,
          borderColor: 'var(--chart-line1)',
          backgroundColor: 'var(--chart-fill1)',
          borderWidth: 1.5,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: getDefaultTooltipOptions(),
      },
      scales: getDefaultScaleOptions(),
      interaction: {
        intersect: false,
        mode: 'index',
      },
    },
  };
}

/**
 * P&L bar chart configuration.
 */
export function getPnlBarConfig(labels, profits, losses) {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Profit',
          data: profits,
          backgroundColor: 'var(--green)',
          borderRadius: 2,
        },
        {
          label: 'Loss',
          data: losses,
          backgroundColor: 'var(--red)',
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: getDefaultTooltipOptions(),
      },
      scales: {
        ...getDefaultScaleOptions(),
        x: {
          ...getDefaultScaleOptions().x,
          stacked: true,
        },
        y: {
          ...getDefaultScaleOptions().y,
          stacked: true,
        },
      },
    },
  };
}

/**
 * Create annotation lines for support/resistance on a chart.
 */
export function createAnnotationLines(levels) {
  if (!levels || !levels.length) return {};

  const annotations = {};
  levels.forEach((level, i) => {
    annotations[`line${i}`] = {
      type: 'line',
      yMin: level.value,
      yMax: level.value,
      borderColor: level.type === 'support' ? 'var(--green)' : 'var(--red)',
      borderWidth: 1,
      borderDash: [4, 4],
      label: {
        display: true,
        content: `${level.type === 'support' ? 'S' : 'R'}: ${level.value}`,
        position: 'end',
        backgroundColor: level.type === 'support' ? 'var(--green-bg)' : 'var(--red-bg)',
        color: level.type === 'support' ? 'var(--green-text)' : 'var(--red-text)',
        font: { size: 9, weight: '600' },
        padding: { x: 4, y: 2 },
      },
    };
  });

  return { annotation: { annotations } };
}

/**
 * Analyzer chart config (line chart with S&R annotations).
 */
export function getAnalyzerChartConfig(labels, data, annotations) {
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Price',
          data,
          borderColor: 'var(--chart-line1)',
          backgroundColor: 'var(--chart-fill1)',
          borderWidth: 1.5,
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: getDefaultTooltipOptions(),
        ...(annotations || {}),
      },
      scales: getDefaultScaleOptions(),
      interaction: {
        intersect: false,
        mode: 'index',
      },
    },
  };
}
