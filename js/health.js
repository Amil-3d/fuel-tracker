// Parse what the "Send to Fuel" Shortcut produces. It's forgiving about format:
// "fuel: steps=8,432; active=412 kcal; weight=180.4 lb; date=2026-10-11", URL query
// parameters, or JSON all work. Numbers can include commas and units.
export function parseHealth(input) {
  let pairs = {};
  const text = String(input || '').trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try { pairs = JSON.parse(text); } catch (e) { return null; }
  } else {
    const body = text.replace(/^fuel:\s*/i, '').replace(/^.*\?/, '');
    for (const part of body.split(/[;&\n]+/)) {
      const m = part.match(/^\s*([a-z_]+)\s*[=:]\s*(.+?)\s*$/i);
      if (m) pairs[m[1].toLowerCase()] = decodeURIComponent(m[2].replace(/\+/g, ' '));
    }
  }
  const num = (v) => {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const out = {};
  const steps = num(pairs.steps);
  const active = num(pairs.active ?? pairs.activekcal ?? pairs.active_energy ?? pairs.energy);
  const weight = num(pairs.weight);
  if (steps != null && steps >= 0) out.steps = Math.round(steps);
  if (active != null && active >= 0) out.activeKcal = Math.round(active);
  if (weight != null && weight > 0) {
    const raw = `${pairs.weight} ${pairs.unit || ''}`.toLowerCase();
    out.weightUnit = /kg/.test(raw) ? 'kg' : /lb|pound/.test(raw) ? 'lb' : null;
    out.weight = weight;
  }
  if (pairs.date && /^\d{4}-\d{2}-\d{2}/.test(pairs.date)) out.date = pairs.date.slice(0, 10);
  return Object.keys(out).length ? out : null;
}
