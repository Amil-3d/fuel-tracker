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
