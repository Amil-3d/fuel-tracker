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
