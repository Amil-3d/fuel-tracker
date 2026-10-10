// Tiny SVG charts, no library.
import { esc, parseDate } from './ui.js';

/**
 * Line chart over dates.
 * @param points [{ date: 'YYYY-MM-DD', value }]
 * @param opts { goal?: number, goalLabel?: string, unit?: string, height?: number }
 */
export function lineChart(points, opts = {}) {
  const W = 340, H = opts.height || 200;
  const pad = { l: 40, r: 12, t: 14, b: 26 };
  if (!points.length) return '';

  const xs = points.map((p) => parseDate(p.date).getTime());
  const ys = points.map((p) => p.value);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 3 * 86400000; x1 += 3 * 86400000; }
  const allY = opts.goal != null ? [...ys, opts.goal] : ys;
  let y0 = Math.min(...allY), y1 = Math.max(...allY);
  const span = Math.max(y1 - y0, 2);
  y0 = Math.floor(y0 - span * 0.1);
  y1 = Math.ceil(y1 + span * 0.1);

  const sx = (x) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);

  // Y ticks: 4 evenly spaced
  const yTicks = [];
  for (let k = 0; k <= 3; k++) yTicks.push(y0 + ((y1 - y0) * k) / 3);
  // X ticks: first, middle, last
  const xTicks = [x0, (x0 + x1) / 2, x1];
  const fmtX = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const path = points.map((p, k) => `${k ? 'L' : 'M'}${sx(xs[k]).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${sx(xs[xs.length - 1]).toFixed(1)},${H - pad.b} L${sx(xs[0]).toFixed(1)},${H - pad.b} Z`;
  const showDots = points.length <= 40;

  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Chart')}">
    ${yTicks.map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${sy(t)}" y2="${sy(t)}"/>
      <text class="tick" x="${pad.l - 6}" y="${sy(t) + 4}" text-anchor="end">${Math.round(t)}</text>`).join('')}
    ${xTicks.map((t, k) => `<text class="tick" x="${sx(t)}" y="${H - 8}" text-anchor="${['start', 'middle', 'end'][k]}">${fmtX(t)}</text>`).join('')}
    ${opts.goal != null ? `<line class="goal" x1="${pad.l}" x2="${W - pad.r}" y1="${sy(opts.goal)}" y2="${sy(opts.goal)}"/>
      <text class="goal-label" x="${W - pad.r}" y="${sy(opts.goal) - 5}" text-anchor="end">${esc(opts.goalLabel || 'Goal')}</text>` : ''}
    ${points.length > 1 ? `<path class="area" d="${area}"/><path class="line" d="${path}"/>` : ''}
    ${showDots ? points.map((p, k) => `<circle class="dot" cx="${sx(xs[k])}" cy="${sy(p.value)}" r="3.5"/>`).join('') : ''}
  </svg></div>`;
}
