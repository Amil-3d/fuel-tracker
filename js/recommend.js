// Food recommendations: rank foods by how well they fill the macros you have left
// without going over your calories, nudged toward healthier choices.

// Add-ons that aren't a meal on their own.
const ADDON = /\b(sauce|dressing|syrup|ketchup|mustard|mayo|mayonnaise|creamer|sweetener|salt|pepper|gravy|salsa|relish|jelly|jam|honey|vinaigrette|condiment|aioli|hot sauce|sprinkles|bits|croutons|shredded \w+ cheese|shredded cheese|sliced \w+ cheese)\b/i;

// Parts of a meal that only make sense with something else: buns, bread, tortillas, spreads,
// sandwich and salad toppings. They're never suggested on their own, only next to a main
// from the same station (a bun with the burger patty from the burger bar).
const SIDE = /\b(buns?|(?<!(egg|spring|cinnamon|sushi|california|dragon|spicy tuna|lobster|sweet) )rolls?|bread|breads|tortillas?|pitas?|naan|flatbreads?|wrap shells?|taco shells?|tostada shells?|english muffins?|croutons|crackers|butter|margarine|cream cheese|lettuce|romaine|spring mix|mixed greens|spinach|kale|arugula|tomato(es)?|tomato slices?|bread slices?|onions?|red onion|pickles?|jalapen(o|ñ)os?|olives|cucumbers?|peppers|banana peppers|bean sprouts|alfalfa sprouts|shredded carrots|sour cream|guacamole|hummus|cheese slices?|(american|cheddar|swiss|provolone|pepper jack|mozzarella|parmesan|feta|cotija|colby|monterey jack|shredded|sliced|cheddar jack|blue|bleu|goat|vegan|queso fresco)( \w+)? cheese|parmesan|feta|cotija|bacon bits|sunflower seeds|raisins|granola|whipped cream|cool whip)$/i;
const NOT_SIDE = /\b(with|and|pizza|sushi|salmon|tuna|crab|tofu|egg|sausage|chicken|beef|pork|turkey|eggplant|cake|cinnamon|pepperoni|hokie|takuwan|curry|philly|pickles|cheesy)\b|[,&]/i;
export const isSide = (name) => SIDE.test(name) && !NOT_SIDE.test(name);

// Serving amounts a pick can suggest.
const AMOUNTS = [0.5, 1, 1.5, 2];

// Build-your-own and topping stations hold parts of a meal, not a meal.
const ADDON_STATION = /\b(byo|toppings?|condiments?|sauces?|dressings?|cheese options|bread options|spreads?)\b/i;

// Countable servings ("1 burger", "2 each") only get amounts that make whole pieces (or half of one).
function amountsFor(serving) {
  const s = String(serving || '').toLowerCase().replace(/\s*(per )?(serving|portion)$/, '').trim();
  if (!s || /oz|cup|tbsp|tsp|ml|lb|gram|\bg\b|ladle|serving|portion/.test(s)) return AMOUNTS;
  const m = s.match(/^(\d+)(?:\/(\d+))?/);
  const count = m ? (m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1])) : 1;
  return AMOUNTS.filter((a) => a === 0.5 || Number.isInteger(Math.round(count * a * 100) / 100));
}

export function remaining(plan, eaten) {
  return {
    kcal: plan.calories - eaten.kcal,
    protein: plan.protein.g - eaten.protein,
    carbs: plan.carbs.g - eaten.carbs,
    fat: plan.fat.g - eaten.fat
  };
}

// What's left today, split evenly over the meals you still plan to eat.
// mealsLeft counts this meal, so the last meal of the day gets everything that's left.
export function mealBudget(left, mealsLeft) {
  const f = 1 / Math.max(1, mealsLeft);
  const pos = (v) => Math.max(0, v);
  return {
    kcal: Math.min(pos(left.kcal), Math.max(150, pos(left.kcal) * f)),
    protein: pos(left.protein) * f,
    carbs: pos(left.carbs) * f,
    fat: pos(left.fat) * f,
    dayKcal: pos(left.kcal)
  };
}

// How many meals are still to come today, including the one being picked for.
// Meals that already have food logged (other than this one) count as eaten.
export function mealsLeft(planned, entries, meal) {
  const eaten = new Set(entries.filter((e) => e.meal !== meal).map((e) => e.meal)).size;
  return Math.max(1, planned - eaten);
}

const scale = (per, s) => {
  const out = {};
  for (const k in per) out[k] = typeof per[k] === 'number' ? per[k] * s : per[k];
  return out;
};

const DESSERT = /\b(cake|cookies?|brownies?|pie|tart|cobbler|donuts?|doughnuts?|cupcakes?|pudding|ice cream|muffins?|cinnamon bun|danish|churros?|fudge|candy|pastry|pastries|chocolatine|scones?|croissants?|turnovers?|eclairs?)\b/i;
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
  let score = 0.4 * match + Math.min(0.45, has.protein / kcal) * (proteinShare > 0.15 ? 1.6 : 0.4);

  const per100 = (v) => ((v || 0) / kcal) * 100;
  score += Math.min(0.2, per100(per.fiber) * 0.06);
  if (per.sodium != null) score -= Math.min(0.4, Math.max(0, per100(per.sodium) - 200) / 400);
  if (per.sugar != null) score -= Math.min(0.4, Math.max(0, (per.sugar * 4) / kcal - 0.15) * 1.5);
  if (per.satFat != null) score -= Math.min(0.3, Math.max(0, (per.satFat * 9) / kcal - 0.1) * 2);
  if (DESSERT.test(name)) score *= 0.6;
  else if (PLAIN_STARCH.test(name)) score *= 0.7;

  // Going past what's left of a macro, or past this meal's calories, counts against it.
  for (const k of ['carbs', 'fat']) if (has[k] > need[k] && has[k] > 0) score -= Math.min(0.3, (has[k] - need[k]) / kcal);
  if (has.protein > need.protein * 1.25) score -= Math.min(0.2, (has.protein - need.protein * 1.25) / kcal);
  if (kcal > budget.kcal) score *= budget.kcal / kcal;

  // One food is usually part of a plate, so aim for roughly 40% of the meal's calories.
  const ideal = Math.max(150, budget.kcal * 0.4);
  return score * Math.max(0.2, 1 - 0.3 * Math.abs(Math.log2(kcal / ideal)));
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
 * best first, each with `score`, `tags` and `servings` (the suggested amount;
 * `per` is the nutrition for one serving). Duplicate names keep the best one.
 * Sides (buns, toppings) are left out unless their station is in `sidesFor`.
 */
export function rank(candidates, budget, limit = 6, sidesFor = null) {
  const best = new Map();
  for (const c of candidates) {
    if (!c.per || c.per.drink || ADDON.test(c.name) || (c.station && ADDON_STATION.test(c.station))) continue;
    // Sides only go with a main from their own station (see buildPlate).
    if (isSide(c.name) && !(sidesFor && c.station && sidesFor.has(c.station))) continue;
    for (const servings of amountsFor(c.per.serving ?? c.serving)) {
      const amount = scale(c.per, servings);
      let score = scoreFood(amount, budget, c.name);
      if (score == null) continue;
      score -= 0.03 * Math.abs(servings - 1); // a standard serving is simpler, so prefer it on a near tie
      if (score <= 0) continue;
      const name = c.name.toLowerCase();
      if (!best.has(name) || best.get(name).score < score) best.set(name, { ...c, servings, amount, score, tags: tags(amount) });
    }
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
    // Skip near-duplicates like "Spaghetti" and "Spaghetti, Small Plate".
    const base = (n) => n.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\b(small|large|plate|side|bowl|cup)\b/g, '').trim().split(/\s+/).slice(0, 2).join(' ');
    const pool = candidates.filter((c) => c.per && ![...used].some((u) => base(u) === base(c.name) || u.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(u)));
    const mains = new Set(plate.filter((p) => !isSide(p.name)).map((p) => p.station).filter(Boolean));
    const top = rank(pool, { ...left, dayKcal: Math.min(left.dayKcal, left.kcal) }, 1, mains)[0];
    if (!top || top.score < 0.25) break;
    plate.push(top);
    used.add(top.name.toLowerCase());
    left = {
      kcal: left.kcal - top.amount.kcal,
      protein: Math.max(0, left.protein - (top.amount.protein || 0)),
      carbs: Math.max(0, left.carbs - (top.amount.carbs || 0)),
      fat: Math.max(0, left.fat - (top.amount.fat || 0)),
      dayKcal: left.dayKcal - top.amount.kcal
    };
  }
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const p of plate) for (const k in total) total[k] += p.amount[k] || 0;
  return { items: plate, total };
}
