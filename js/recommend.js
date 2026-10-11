// Food recommendations: rank foods by how well they fill the macros you have left
// without going over your calories, nudged toward healthier choices.

// Rough share of the day's calories for each meal, used to size a meal's budget.
const MEAL_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snacks: 0.1 };
const ORDER = ['breakfast', 'lunch', 'dinner', 'snacks'];

// Add-ons that aren't a meal on their own.
const ADDON = /\b(sauce|dressing|syrup|ketchup|mustard|mayo|mayonnaise|creamer|sweetener|salt|pepper|gravy|salsa|relish|jelly|jam|honey|vinaigrette|condiment|aioli|hot sauce|sprinkles)\b/i;

export function remaining(plan, eaten) {
  return {
    kcal: plan.calories - eaten.kcal,
    protein: plan.protein.g - eaten.protein,
    carbs: plan.carbs.g - eaten.carbs,
    fat: plan.fat.g - eaten.fat
  };
}

// What's left today, scaled down to a sensible amount for this meal.
// Later meals get the rest, so dinner gets most of what's left and snacks get all of it.
export function mealBudget(left, meal) {
  const i = Math.max(0, ORDER.indexOf(meal));
  const later = ORDER.slice(i).reduce((s, m) => s + MEAL_SHARE[m], 0);
  const f = MEAL_SHARE[ORDER[i]] / later;
  const pos = (v) => Math.max(0, v);
  return {
    kcal: Math.min(pos(left.kcal), Math.max(150, pos(left.kcal) * f)),
    protein: pos(left.protein) * f,
    carbs: pos(left.carbs) * f,
    fat: pos(left.fat) * f,
    dayKcal: pos(left.kcal)
  };
}

// Score one food (per serving) against a budget. Returns null if it doesn't fit.
export function scoreFood(per, budget) {
  const kcal = per.kcal;
  if (!(kcal >= 30) || kcal > budget.dayKcal) return null;
  const has = { protein: (per.protein || 0) * 4, carbs: (per.carbs || 0) * 4, fat: (per.fat || 0) * 9 };
  const need = { protein: budget.protein * 4, carbs: budget.carbs * 4, fat: budget.fat * 9 };
  const weight = { protein: 1.6, carbs: 0.8, fat: 0.8 };
  let useful = 0;
  let over = 0;
  for (const k of ['protein', 'carbs', 'fat']) {
    useful += weight[k] * Math.min(has[k], need[k]);
    over += Math.max(0, has[k] - need[k]) * (k === 'protein' ? 0.3 : 1);
  }
  // Calories past this meal's budget count against it (still within the day's total).
  over += Math.max(0, kcal - budget.kcal) * 0.5;
  const fit = (useful - over) / kcal;

  // Healthier choices: more fiber, less sodium, added sugar and saturated fat per calorie.
  const per100 = (v) => ((v || 0) / kcal) * 100;
  let health = Math.min(0.3, per100(per.fiber) * 0.1);
  if (per.sodium != null) health -= Math.min(0.4, Math.max(0, per100(per.sodium) - 300) / 1000);
  if (per.sugar != null) health -= Math.min(0.3, Math.max(0, (per.sugar * 4) / kcal - 0.25));
  if (per.satFat != null) health -= Math.min(0.3, Math.max(0, (per.satFat * 9) / kcal - 0.1) * 2);

  // Very small portions barely move the needle.
  const size = Math.sqrt(Math.min(1, kcal / Math.max(120, budget.kcal * 0.4)));
  return (fit + health) * size;
}

export function tags(per) {
  const out = [];
  const kcal = per.kcal || 1;
  if (per.protein >= 12 && (per.protein * 4) / kcal >= 0.3) out.push({ text: 'High protein', good: true });
  if (per.fiber >= 4) out.push({ text: 'High fiber', good: true });
  if (kcal >= 100 && (per.fat * 9) / kcal <= 0.25 && per.protein >= 10) out.push({ text: 'Lean', good: true });
  if (per.sodium >= 900) out.push({ text: 'High sodium', good: false });
  if (per.sugar >= 20) out.push({ text: 'Sugary', good: false });
  return out;
}

/**
 * Rank candidates: [{ key, name, per, ...anything }]. Returns the top `limit`,
 * best first, each with `score` and `tags`. Duplicate names keep the best one.
 */
export function rank(candidates, budget, limit = 6) {
  const best = new Map();
  for (const c of candidates) {
    if (!c.per || ADDON.test(c.name)) continue;
    const score = scoreFood(c.per, budget);
    if (score == null || score <= 0) continue;
    const name = c.name.toLowerCase();
    if (!best.has(name) || best.get(name).score < score) best.set(name, { ...c, score, tags: tags(c.per) });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// Greedily build a plate of up to 4 different items that fits the meal budget.
export function buildPlate(candidates, budget) {
  const plate = [];
  let left = { ...budget };
  const used = new Set();
  for (let n = 0; n < 4; n++) {
    if (left.kcal < 80) break;
    const pool = candidates.filter((c) => !used.has(c.name.toLowerCase()) && c.per && c.per.kcal <= left.kcal);
    const top = rank(pool, { ...left, dayKcal: Math.min(left.dayKcal, left.kcal) }, 1)[0];
    if (!top || top.score < 0.1) break;
    plate.push(top);
    used.add(top.name.toLowerCase());
    left = {
      kcal: left.kcal - top.per.kcal,
      protein: Math.max(0, left.protein - (top.per.protein || 0)),
      carbs: Math.max(0, left.carbs - (top.per.carbs || 0)),
      fat: Math.max(0, left.fat - (top.per.fat || 0)),
      dayKcal: left.dayKcal - top.per.kcal
    };
  }
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const p of plate) for (const k in total) total[k] += p.per[k] || 0;
  return { items: plate, total };
}
