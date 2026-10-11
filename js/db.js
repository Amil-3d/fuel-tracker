import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@4.0.10/dist/dexie.mjs';

// All measurements are stored in metric (kg, cm). Dates are local 'YYYY-MM-DD' strings.
export const db = new Dexie('fuel');

db.version(1).stores({
  settings: 'key',                                 // { key, value } — 'profile' lives here
  weights: '++id, date',                           // { id, date, kg }
  foods: '++id, name, source, favorite, lastUsed', // saved foods (custom + menu items)
  entries: '++id, date, meal',                     // food log rows with a nutrition snapshot
  workouts: '++id, date, source, externalId',      // exercise log
  activity: 'date'                                 // { date, steps, activeKcal } from Shortcuts
});

// v2: foods can carry a scanned barcode.
db.version(2).stores({
  foods: '++id, name, source, favorite, lastUsed, barcode'
});

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  return db.settings.put({ key, value });
}

export function getProfile() {
  return getSetting('profile');
}

export function saveProfile(profile) {
  return setSetting('profile', profile);
}

export async function getWeights() {
  return db.weights.orderBy('date').toArray();
}

// Most recent weight entry (by date, then by insertion order).
export async function latestWeight() {
  const rows = await db.weights.orderBy('date').toArray();
  return rows.length ? rows[rows.length - 1] : null;
}

// One weight per day: logging again on the same date replaces that day's value.
export async function addWeight(date, kg) {
  const existing = await db.weights.where('date').equals(date).first();
  if (existing) return db.weights.update(existing.id, { kg });
  return db.weights.add({ date, kg });
}

export function deleteWeight(id) {
  return db.weights.delete(id);
}

// Ask iOS not to evict our data under storage pressure (best effort).
export async function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch (e) { /* ignore */ }
  }
}

// ---- Foods and food log ----
// Food: { id, name, serving, per: { kcal, protein, carbs, fat, fiber?, sugar?, sodium? },
//         source: 'custom' | 'barcode' | 'quick' | 'menu', barcode?, favorite: 0|1, lastUsed: ms, uses }
// Entry: { id, date, meal, foodId, name, serving, servings, per, createdAt }

export function getEntries(date) {
  return db.entries.where('date').equals(date).sortBy('createdAt');
}

export function getEntry(id) {
  return db.entries.get(id);
}

export function updateEntry(id, changes) {
  return db.entries.update(id, changes);
}

export function deleteEntry(id) {
  return db.entries.delete(id);
}

export async function logFood(food, { date, meal, servings }) {
  const now = Date.now();
  await db.foods.update(food.id, { lastUsed: now, uses: (food.uses || 0) + 1 });
  return db.entries.add({
    date, meal, servings, foodId: food.id, name: food.name, serving: food.serving || '',
    per: { ...food.per }, createdAt: now
  });
}

export function saveFood(food) {
  const row = { favorite: 0, uses: 0, lastUsed: 0, ...food };
  return row.id ? db.foods.put(row).then(() => row.id) : db.foods.add(row);
}

export function getFood(id) {
  return db.foods.get(id);
}

export function deleteFood(id) {
  return db.foods.delete(id);
}

export async function recentFoods(limit = 40) {
  const rows = await db.foods.orderBy('lastUsed').reverse().limit(limit).toArray();
  return rows.filter((f) => f.lastUsed > 0);
}

export function favoriteFoods() {
  return db.foods.where('favorite').equals(1).sortBy('name');
}

// Foods you created or scanned (excludes quick adds and dining menu items).
export function customFoods() {
  return db.foods.where('source').anyOf('custom', 'barcode').sortBy('name');
}

// How many meals you plan to eat on a date. Set day by day; a new day starts
// with the last number you picked.
export async function getMealCount(date) {
  return (await getSetting(`meals:${date}`)) || (await getSetting('mealsDefault')) || 3;
}

export async function setMealCount(date, n) {
  await setSetting(`meals:${date}`, n);
  await setSetting('mealsDefault', n);
}

// Dates (YYYY-MM-DD) that have at least one food logged.
// (Safari can't open the unique-key cursor Dexie uses for uniqueKeys(), so read the rows instead.)
export async function loggedDates(sinceDate) {
  const rows = sinceDate ? await db.entries.where('date').aboveOrEqual(sinceDate).toArray() : await db.entries.toArray();
  return new Set(rows.map((e) => e.date));
}

// ---- Apple Health activity (imported through Shortcuts) ----

export function getActivity(date) {
  return db.activity.get(date);
}

export function activityBetween(from, to) {
  return db.activity.where('date').between(from, to, true, true).toArray();
}

export async function saveActivity(date, values) {
  const prev = (await db.activity.get(date)) || { date };
  await db.activity.put({ ...prev, ...values, date, importedAt: Date.now() });
}

export function entriesBetween(from, to) {
  return db.entries.where('date').between(from, to, true, true).toArray();
}

// ---- Backup ----

const TABLES = ['settings', 'weights', 'foods', 'entries', 'activity'];

export async function exportAll() {
  const data = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return { app: 'fuel', version: 1, exportedAt: new Date().toISOString(), data };
}

// Replace everything on this phone with a backup made by exportAll().
export async function importAll(backup) {
  if (!backup || backup.app !== 'fuel' || !backup.data) throw new Error("That file isn't a Fuel backup.");
  if (!backup.data.settings?.some((s) => s.key === 'profile')) throw new Error('That backup has no profile in it.');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      if (backup.data[t]?.length) await db.table(t).bulkPut(backup.data[t]);
    }
  });
}
