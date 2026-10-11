// Purdue dining menu data (data/menu.json, refreshed daily by a GitHub Action).
import { db, saveFood } from './db.js';

let cache = null;

export async function loadMenu() {
  if (cache) return cache;
  const res = await fetch('data/menu.json');
  if (!res.ok) throw new Error(`Menu data unavailable (${res.status}).`);
  cache = await res.json();
  return cache;
}

// Pick the menu meal that best matches a log meal (breakfast/lunch/dinner/snacks).
export function matchMeal(meals, logMeal) {
  if (!meals.length) return null;
  const want = logMeal === 'snacks' ? 'late' : logMeal;
  return meals.find((m) => m.name.toLowerCase().includes(want))?.name
    || (logMeal === 'breakfast' ? meals.find((m) => /brunch/i.test(m.name))?.name : null)
    || meals[0].name;
}

export function hasNutrition(item) {
  return item && item.kcal != null;
}

// Save (or reuse) a dining item as a food so it shows in Recent and Favorites.
export async function foodFromMenuItem(id, item) {
  const existing = await db.foods.filter((f) => f.menuId === id).first();
  const per = {
    kcal: item.kcal ?? 0, protein: item.protein ?? 0, carbs: item.carbs ?? 0, fat: item.fat ?? 0,
    fiber: item.fiber ?? null, sugar: item.sugar ?? null, sodium: item.sodium ?? null
  };
  if (existing) {
    // Refresh in case Purdue updated the nutrition.
    const updated = { ...existing, name: item.name, serving: item.serving || '1 serving', per };
    await db.foods.put(updated);
    return updated;
  }
  const food = { name: item.name, serving: item.serving || '1 serving', per, source: 'menu', menuId: id };
  food.id = await saveFood(food);
  return { favorite: 0, uses: 0, lastUsed: 0, ...food };
}

export const menuCached = () => Boolean(cache);
