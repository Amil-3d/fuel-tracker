// Small DOM and formatting helpers shared by views.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const n0 = (v) => Math.round(v).toLocaleString('en-US');

export function n1(v) {
  return (Math.round(v * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Local date as 'YYYY-MM-DD'
export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const today = () => isoDate(new Date());

export function parseDate(iso) {
  return new Date(iso + 'T00:00:00');
}

export function fmtDate(isoOrDate, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const d = typeof isoOrDate === 'string' ? parseDate(isoOrDate) : isoOrDate;
  return d.toLocaleDateString('en-US', opts);
}

export function setTitle(text, actionHtml = '') {
  document.getElementById('page-title').textContent = text;
  document.getElementById('topbar-action').innerHTML = actionHtml;
}

let toastTimer;
export function toast(msg, ms = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Parse a number from an input, accepting commas as decimal separators.
export function num(value) {
  if (value === '' || value == null) return NaN;
  return parseFloat(String(value).replace(',', '.'));
}

// Segmented control markup. options: [{ value, label }]
export function seg(name, options, selected) {
  return `<div class="seg" role="radiogroup">${options.map((o) => `
    <label><input type="radio" name="${name}" value="${esc(o.value)}" ${o.value === selected ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}
  </div>`;
}

export function notices(warnings) {
  return warnings.map((w) => `<div class="notice ${w.level}">${esc(w.text)}</div>`).join('');
}

export function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem('fuel-theme', theme); } catch (e) { /* ignore */ }
}
