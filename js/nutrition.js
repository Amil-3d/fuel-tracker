// Nutrition fields, scaling and totals.

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' }
];

// key, label, unit, required
export const NUTRIENTS = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', required: true },
  { key: 'protein', label: 'Protein', unit: 'g', required: true },
  { key: 'carbs', label: 'Carbs', unit: 'g', required: true },
  { key: 'fat', label: 'Fat', unit: 'g', required: true },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' }
];

export const OPTIONAL = NUTRIENTS.filter((n) => !n.required);

// Suggest a meal from the time of day.
export function mealForNow(d = new Date()) {
  const h = d.getHours();
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snacks';
}

export function mealLabel(id) {
  return (MEALS.find((m) => m.id === id) || MEALS[3]).label;
}

// Nutrition of one entry (per-serving values × servings). Missing optional values stay null.
export function entryTotals(entry) {
  const out = {};
  for (const n of NUTRIENTS) {
    const v = entry.per?.[n.key];
    out[n.key] = v == null ? null : v * entry.servings;
  }
  return out;
}

export function sumTotals(entries) {
  const out = Object.fromEntries(NUTRIENTS.map((n) => [n.key, 0]));
  for (const e of entries) {
    const t = entryTotals(e);
    for (const n of NUTRIENTS) out[n.key] += t[n.key] || 0;
  }
  return out;
}

// "1 cup · 2 servings" style label
export function servingText(serving, servings) {
  const s = Math.round(servings * 100) / 100;
  if (serving) return s === 1 ? serving : `${s} × ${serving}`;
  return s === 1 ? '1 serving' : `${s} servings`;
}

export function macroLine(t) {
  const r = (v) => Math.round(v || 0);
  return `P ${r(t.protein)}g · C ${r(t.carbs)}g · F ${r(t.fat)}g`;
}

// ---- Portions: make dining hall serving sizes easy to picture ----

const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.67: '⅔' };

function fracText(v) {
  const whole = Math.floor(v + 1e-9);
  const rest = Math.round((v - whole) * 100) / 100;
  const f = FRACTIONS[rest];
  if (!rest) return String(whole);
  if (f) return whole ? `${whole}${f}` : f;
  return String(Math.round(v * 10) / 10);
}

function parseAmount(text) {
  let m = text.match(/^(\d+)\s+(\d+)\/(\d+)\s*/);
  if (m) return { value: Number(m[1]) + Number(m[2]) / Number(m[3]), rest: text.slice(m[0].length).trim() };
  m = text.match(/^(\d+)\/(\d+)\s*/);
  if (m) return { value: Number(m[1]) / Number(m[2]), rest: text.slice(m[0].length).trim() };
  m = text.match(/^(\d+(?:\.\d+)?)\s*/);
  if (m) return { value: parseFloat(m[1]), rest: text.slice(m[0].length).trim() };
  return null;
}

const PIECE_WORDS = /^(each|ea|piece|pieces|pc|pcs)$/;
const plural = (n, word) => (n <= 1 || word.endsWith('s') ? word : /[^aeiou]y$/.test(word) ? word.slice(0, -1) + 'ies' : word + 's');

/**
 * Describe `servings` of a serving size in plain words, e.g.
 * "5 oz" -> "5 oz (142 g)", "2 each" -> "2 pieces", "6 ozl" -> "6 fl oz (¾ cup)",
 * "1/2 Cup Serving" × 2 -> "1 cup".
 */
export function portionText(serving, servings = 1) {
  let s = String(serving || '').trim().toLowerCase().replace(/\s+serving$/, '').replace(/\s+portion$/, '');
  if (!s || s === 'serving') return servings === 1 ? '1 serving' : `${fracText(servings)} servings`;
  const cut = s.match(/^(\d+)\s*x\s*(\d+)\s*cut$/);
  if (cut || s === 'cut' || /^\d+ cut$/.test(s)) {
    return `${fracText(servings)} ${servings <= 1 ? 'piece' : 'pieces'}${cut ? ` (pan cut ${cut[1]}×${cut[2]})` : ''}`;
  }
  if (/disher|scoop/.test(s)) return `${fracText(servings)} ${servings <= 1 ? 'scoop' : 'scoops'}`;
  let amt = parseAmount(s);
  if (!amt) amt = { value: 1, rest: s.replace(/^(a|an|one)\s+/, '') };
  const n = amt.value * servings;
  let unit = amt.rest.replace(/^#\s*/, '');
  const num = fracText(n);

  if (/^oz(l| ladle)$|^fl oz$/.test(unit) || /^ozl/.test(unit)) {
    return `${num} fl oz (about ${fracText(Math.round((n / 8) * 4) / 4) || '¼'} cup)`;
  }
  if (/^(oz|ounce|ounces)$/.test(unit)) return `${num} oz (${Math.round(n * 28.35)} g)`;
  if (/^(lb|pound|pounds)$/.test(unit)) return `${num} lb (${Math.round(n * 453.6)} g)`;
  if (/^cups?$/.test(unit)) return `${num} ${n > 1 ? 'cups' : 'cup'}`;
  if (/^(slices?|wings?|links?|eggs?|patties|patty)$/.test(unit)) unit = unit.replace(/s$/, '').replace(/ie$/, 'y');
  if (/^(tbsp|tablespoons?)$/.test(unit)) return `${num} tbsp`;
  if (/^(tsp|teaspoons?)$/.test(unit)) return `${num} tsp`;
  if (/^ml$/.test(unit)) return `${Math.round(n)} ml`;
  if (PIECE_WORDS.test(unit)) return `${num} ${n <= 1 ? 'piece' : 'pieces'}`;
  if (unit === 'per') return `${num} ${n <= 1 ? 'piece' : 'pieces'}`;
  if (/^[a-z][a-z ]*$/.test(unit)) return `${num} ${plural(n, unit)}`;
  return servings === 1 ? String(serving) : `${fracText(servings)} × ${serving}`;
}
