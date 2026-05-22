/* ==========================================================================
   THETAMAC — ANALYTICS & VISUALIZATION DASHBOARD
   ========================================================================== */

import { state } from './state';
import type { LogItem, Operation } from './types';

interface CategoryStats {
  solved: number;
  totalTime: number;
  avgTime: number;
}

/**
 * Aggregates game log results into category-wise statistics and updates the DOM table.
 */
export function processAnalytics(): void {
  const log = state.game.log;
  const duration = state.settings.duration;

  // Initialize stats dictionary
  const stats: Record<Operation, CategoryStats> = {
    add: { solved: 0, totalTime: 0, avgTime: 0 },
    sub: { solved: 0, totalTime: 0, avgTime: 0 },
    mul: { solved: 0, totalTime: 0, avgTime: 0 },
    div: { solved: 0, totalTime: 0, avgTime: 0 }
  };

  let totalSolved = 0;
  let mistakeCount = state.game.mistakeCount;

  // Aggregate logs
  for (const item of log) {
    stats[item.category].solved++;
    stats[item.category].totalTime += item.duration;
    totalSolved++;
  }

  // Calculate averages
  for (const op of ['add', 'sub', 'mul', 'div'] as Operation[]) {
    const opStat = stats[op];
    if (opStat.solved > 0) {
      opStat.avgTime = opStat.totalTime / opStat.solved;
    }
  }

  // Update Overview Cards
  const scoreEl = document.getElementById('summary-score');
  const ppmEl = document.getElementById('summary-ppm');
  const accuracyEl = document.getElementById('summary-accuracy');

  if (scoreEl) scoreEl.textContent = totalSolved.toString();
  
  if (ppmEl) {
    const secPerAnswer = totalSolved > 0 ? (duration / totalSolved) : 0;
    ppmEl.textContent = secPerAnswer.toFixed(1);
  }

  if (accuracyEl) {
    const totalAttempts = totalSolved + mistakeCount;
    const accuracy = totalAttempts > 0 ? Math.round((totalSolved / totalAttempts) * 100) : 100;
    accuracyEl.textContent = `${accuracy}%`;
  }

  // Render Table Rows
  const tableBody = document.getElementById('analytics-table-body');
  if (tableBody) {
    tableBody.innerHTML = '';

    const labelMap: Record<Operation, string> = {
      add: 'Addition (+)',
      sub: 'Subtraction (−)',
      mul: 'Multiplication (×)',
      div: 'Division (÷)'
    };

    let rowsHtml = '';
    for (const op of ['add', 'sub', 'mul', 'div'] as Operation[]) {
      const opStat = stats[op];
      // Only render categories that were active or solved
      if (state.settings.operations.includes(op) || opStat.solved > 0) {
        const avgStr = opStat.solved > 0 ? `${opStat.avgTime.toFixed(2)}s` : '—';
        rowsHtml += `
          <tr>
            <td class="font-medium">${labelMap[op]}</td>
            <td class="text-right">${opStat.solved}</td>
            <td class="text-right font-mono">${avgStr}</td>
          </tr>
        `;
      }
    }

    if (!rowsHtml) {
      rowsHtml = `<tr><td colspan="3" class="text-center text-muted">No problems solved during this run.</td></tr>`;
    }
    tableBody.innerHTML = rowsHtml;
  }

  // Draw chart
  renderConsistencyChart(log, duration);
}

/**
 * Computes PPM for equal intervals and draws a modern Shadcn-style SVG line graph.
 */
function renderConsistencyChart(log: LogItem[], duration: number): void {
  const chartParent = document.getElementById('chart-parent');
  if (!chartParent) return;

  // Clear container
  chartParent.innerHTML = '';

  // Determine interval duration (seconds) dynamically to keep data points between 6 and 30
  let intervalSec = 10;
  if (duration <= 30) {
    intervalSec = 5;
  } else if (duration <= 60) {
    intervalSec = 5;
  } else if (duration <= 120) {
    intervalSec = 10;
  } else if (duration <= 300) {
    intervalSec = 20;
  } else {
    intervalSec = 60;
  }

  const numIntervals = Math.ceil(duration / intervalSec);
  const ppmData: { label: string; ppm: number; timeSec: number }[] = [];

  // Group logged answers into intervals and compute PPM
  for (let i = 0; i < numIntervals; i++) {
    const startSec = i * intervalSec;
    const endSec = (i + 1) * intervalSec;
    
    // Count problems solved in this exact block
    const countInInterval = log.filter(item => 
      item.secondResolved >= startSec && item.secondResolved < endSec
    ).length;

    // Convert count to a Problems-Per-Minute rate
    const ppmValue = (countInInterval * 60) / intervalSec;
    ppmData.push({
      label: `${startSec}s–${endSec}s`,
      ppm: parseFloat(ppmValue.toFixed(1)),
      timeSec: endSec
    });
  }

  // Setup dimensions
  const width = 600;
  const height = 240;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Max value calculation
  const maxPpmVal = Math.max(...ppmData.map(d => d.ppm), 0);
  const yMax = Math.max(Math.ceil(maxPpmVal / 5) * 5, 15); // Ensure a minimum scale height of 15 PPM

  // SVG boilerplate
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.overflow = 'visible';



  // Y-axis gridlines & labels
  const gridLinesCount = 3;
  for (let i = 0; i <= gridLinesCount; i++) {
    const ratio = i / gridLinesCount;
    const yVal = Math.round(yMax * ratio);
    const yCoord = paddingTop + plotHeight - (ratio * plotHeight);

    // Gridline path
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', paddingLeft.toString());
    line.setAttribute('y1', yCoord.toString());
    line.setAttribute('x2', (width - paddingRight).toString());
    line.setAttribute('y2', yCoord.toString());
    line.setAttribute('stroke', 'var(--border)');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4 4');
    line.setAttribute('opacity', '0.4');
    svg.appendChild(line);

    // Grid Label text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', (paddingLeft - 8).toString());
    text.setAttribute('y', (yCoord + 4).toString());
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('fill', 'var(--text-secondary)');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-family', 'var(--font-sans)');
    text.setAttribute('opacity', '0.7');
    text.textContent = yVal.toString();
    svg.appendChild(text);
  }

  // Calculate coordinates for points
  const points: { x: number; y: number; label: string; ppm: number }[] = [];
  ppmData.forEach((d, i) => {
    const xRatio = numIntervals > 1 ? (i / (numIntervals - 1)) : 0.5;
    const xCoord = paddingLeft + (xRatio * plotWidth);
    const yCoord = paddingTop + plotHeight - ((d.ppm / yMax) * plotHeight);
    points.push({ x: xCoord, y: yCoord, label: d.label, ppm: d.ppm });
  });

  // Draw X-axis timeline labels (draw every 2nd or 3rd to avoid overlap on high durations)
  const step = numIntervals > 12 ? Math.ceil(numIntervals / 6) : 1;
  points.forEach((pt, i) => {
    if (i % step === 0 || i === points.length - 1) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', pt.x.toString());
      text.setAttribute('y', (paddingTop + plotHeight + 18).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', 'var(--text-secondary)');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'var(--font-sans)');
      text.setAttribute('opacity', '0.7');
      text.textContent = pt.label.split('–')[0]; // show just start time e.g. "30s"
      svg.appendChild(text);
    }
  });

  // Render Line
  if (points.length > 0) {
    let linePathData = '';

    points.forEach((pt, i) => {
      const command = i === 0 ? 'M' : 'L';
      linePathData += `${command} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
    });

    // Draw Top stroke line (purity raw thin coordinate line)
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', linePathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);
  }

  // Draw hover interactive trigger dots & hover listeners
  const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // Create relative tooltip element
  const tooltip = document.createElement('div');
  tooltip.id = 'graph-tooltip';
  tooltip.className = 'graph-tooltip';
  tooltip.style.position = 'absolute';
  tooltip.style.display = 'none';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '100';
  chartParent.appendChild(tooltip);

  points.forEach((pt) => {
    // Outer white hover trigger circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pt.x.toFixed(1));
    circle.setAttribute('cy', pt.y.toFixed(1));
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', 'var(--bg)');
    circle.setAttribute('stroke', 'var(--accent)');
    circle.setAttribute('stroke-width', '2');
    circle.style.transition = 'r 0.15s ease, stroke-width 0.15s ease';
    circle.style.cursor = 'pointer';

    // Hover mouse binds to trigger gorgeous shadcn absolute floating tooltips
    circle.addEventListener('mouseenter', () => {
      circle.setAttribute('r', '7');
      circle.setAttribute('stroke-width', '3');
      
      // Calculate tooltip absolute position relative to parent container
      const containerRect = chartParent.getBoundingClientRect();
      const parentWidth = containerRect.width;
      const svgWidthPercent = pt.x / width;
      const tooltipX = svgWidthPercent * parentWidth;
      const tooltipY = (pt.y / height) * containerRect.height;

      tooltip.innerHTML = `
        <div class="tooltip-time">${pt.label}</div>
        <div class="tooltip-ppm">
          <span class="tooltip-num">${pt.ppm}</span>
          <span class="tooltip-unit">PPM</span>
        </div>
      `;
      tooltip.style.display = 'block';
      tooltip.style.left = `${tooltipX}px`;
      tooltip.style.top = `${tooltipY - 50}px`; // Offset above the circle dot
    });

    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('r', '4');
      circle.setAttribute('stroke-width', '2');
      tooltip.style.display = 'none';
    });

    dotsGroup.appendChild(circle);
  });
  
  svg.appendChild(dotsGroup);
  chartParent.appendChild(svg);
}
