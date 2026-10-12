// Dining menu data, refreshed daily by a GitHub Action (scripts/fetch_menus*.py).
import { db, saveFood } from './db.js';
import { addDrinks } from './drinks.js';

export const SCHOOLS = [
  { id: 'purdue', name: 'Purdue', dining: 'Purdue Dining', places: 'dining courts', file: 'data/menu.json' },
  { id: 'vt', name: 'Virginia Tech', dining: 'Virginia Tech Dining', places: 'dining halls', file: 'data/menu-vt.json' }
];

export const schoolInfo = (id) => SCHOOLS.find((s) => s.id === id) || null;

const cache = {};

export async function loadMenu(school) {
  const info = schoolInfo(school);
  if (!info) throw new Error('Choose your school first.');
  if (cache[school]) return cache[school];
  const res = await fetch(info.file);
  if (!res.ok) throw new Error(`Menu data unavailable (${res.status}).`);
  cache[school] = addDrinks(await res.json());
  return cache[school];
}

// Pick the menu meal that best matches a log meal (breakfast/lunch/dinner/snacks).
export function matchMeal(meals, logMeal) {
  if (!meals.length) return null;
  const want = logMeal === 'snacks' ? 'late' : logMeal;
  return meals.find((m) => m.name.toLowerCase().includes(want))?.name
    || (logMeal === 'breakfast' ? meals.find((m) => /brunch/i.test(m.name))?.name : null)
    || (logMeal === 'snacks' ? meals[meals.length - 1].name : meals[0].name);
}

// Like matchMeal, but only returns a meal that really is that meal (for recommendations
// across locations, so a lunch-only spot isn't suggested for breakfast).
export function strictMeal(meals, logMeal) {
  const want = logMeal === 'snacks' ? 'late' : logMeal;
  const named = (m) => /breakfast|brunch|lunch|dinner|late/i.test(m.name);
  return meals.find((m) => m.name.toLowerCase().includes(want))?.name
    || (logMeal !== 'dinner' ? meals.find((m) => /brunch/i.test(m.name))?.name : null)
    || (logMeal === 'snacks' && meals.length ? meals[meals.length - 1].name : null)
    || (meals.length === 1 && !named(meals[0]) ? meals[0].name : null);
}

export function hasNutrition(item) {
  return item && item.kcal != null;
}

// Save (or reuse) a dining item as a food so it shows in Recent and Favorites.
export async function foodFromMenuItem(id, item, school) {
  const existing = await db.foods.filter((f) => f.menuId === id && (f.school || 'purdue') === school).first();
  const per = {
    kcal: item.kcal ?? 0, protein: item.protein ?? 0, carbs: item.carbs ?? 0, fat: item.fat ?? 0,
    fiber: item.fiber ?? null, sugar: item.sugar ?? null, sodium: item.sodium ?? null
  };
  if (existing) {
    // Refresh in case the dining hall updated the nutrition.
    const updated = { ...existing, name: item.name, serving: item.serving || '1 serving', per, school };
    await db.foods.put(updated);
    return updated;
  }
  const food = { name: item.name, serving: item.serving || '1 serving', per, source: 'menu', menuId: id, school };
  food.id = await saveFood(food);
  return { favorite: 0, uses: 0, lastUsed: 0, ...food };
}

export const menuCached = (school) => Boolean(cache[school]);

// Every item on a day's menus as recommendation candidates, optionally for one meal name.
export function menuCandidates(menu, date, mealFor) {
  const out = [];
  for (const court of menu.courts) {
    const meals = menu.menus[court]?.[date] || [];
    const name = mealFor(meals);
    const m = meals.find((x) => x.name === name);
    if (!m) continue;
    for (const st of m.stations) for (const id of st.items) {
      const it = menu.items[id];
      if (hasNutrition(it)) out.push({ key: id, name: it.name, per: it, court, meal: m.name, station: st.name, veg: it.veg, vegan: it.vegan });
    }
  }
  return out;
}
