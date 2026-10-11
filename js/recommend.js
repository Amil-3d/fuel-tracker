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

const DESSERT = /\b(cake|cookies?|brownies?|pie|tart|cobbler|donuts?|doughnuts?|cupcakes?|pudding|ice cream|muffins?|cinnamon bun|danish|churros?|fudge|candy)\b/i;
const PLAIN_STARCH = /\b(buns?|rolls?|tortillas?|bread|breadsticks?|bagels?|biscuits?|croissants?|english muffin)$/i;

// Score one food (per serving) against a budget. Returns null if it doesn't fit.
// Higher is better: macros that match what you still need, plenty of protein,
// more fiber, and less sodium, sugar and saturated fat.
export function scoreFood(per, budget, name = '') {
  const kcal = per.kcal;
  if (!(kcal >= 30) || kcal > budget.dayKcal) return null;
  const has = { protein: (per.protein || 0) * 4, carbs: (per.carbs || 0) * 4, fat: (per.fat || 0) * 9 };
  const need = { protein: budget.protein * 4, carbs: budget.carbs * 4, fat: budget.fat * 9 };
  const hasSum = has.protein + has.carbs + has.fat || 1;
  const needSum = need.protein + need.carbs + need.fat;

  // How closely the food's macro split matches the split you still need (0 to 1).
  let match = 0.5;
  if (needSum > 0) {
    let diff = 0;
    for (const k of ['protein', 'carbs', 'fat']) diff += Math.abs(has[k] / hasSum - need[k] / needSum);
    match = 1 - diff / 2;
  }

  // Protein is the hardest macro to hit, so protein-dense foods get a boost while you still need it.
  const proteinShare = needSum > 0 ? need.protein / needSum : 0;
  let score = 0.5 * match + Math.min(0.45, has.protein / kcal) * (proteinShare > 0.15 ? 1.2 : 0.4);

  const per100 = (v) => ((v || 0) / kcal) * 100;
  score += Math.min(0.2, per100(per.fiber) * 0.06);
  if (per.sodium != null) score -= Math.min(0.4, Math.max(0, per100(per.sodium) - 200) / 400);
  if (per.sugar != null) score -= Math.min(0.4, Math.max(0, (per.sugar * 4) / kcal - 0.15) * 1.5);
  if (per.satFat != null) score -= Math.min(0.3, Math.max(0, (per.satFat * 9) / kcal - 0.1) * 2);
  if (DESSERT.test(name)) score *= 0.6;
  else if (PLAIN_STARCH.test(name)) score *= 0.7;

  // Going past what's left of a macro, or past this meal's calories, counts against it.
  for (const k of ['carbs', 'fat']) if (has[k] > need[k] && has[k] > 0) score -= Math.min(0.3, (has[k] - need[k]) / kcal);
  if (kcal > budget.kcal) score *= budget.kcal / kcal;

  // Very small portions barely move the needle.
  return score * Math.sqrt(Math.min(1, kcal / 150));
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
    const score = scoreFood(c.per, budget, c.name);
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
    if (!top || top.score < 0.25) break;
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
