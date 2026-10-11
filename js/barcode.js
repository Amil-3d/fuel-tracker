// Barcode scanning (ZXing, loaded on demand) and nutrition lookup (Open Food Facts, free, no key).
import { db } from './db.js';

export const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const OFF_FIELDS = 'product_name,brands,nutriments,serving_size,serving_quantity';

let zxingPromise;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxingPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = ZXING_URL;
    s.onload = () => resolve(window.ZXing);
    s.onerror = () => { zxingPromise = null; reject(new Error('Could not load the scanner. Check your connection.')); };
    document.head.appendChild(s);
  });
  return zxingPromise;
}

/**
 * Start the camera and call onCode(text) once a barcode is read.
 * Returns a stop() function.
 */
export async function startScanner(video, onCode) {
  const ZXing = await loadZXing();
  const hints = new Map();
  const F = ZXing.BarcodeFormat;
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128]);
  const reader = new ZXing.BrowserMultiFormatReader(hints, 300);
  let done = false;
  const stop = () => { done = true; try { reader.reset(); } catch (e) { /* already stopped */ } };
  await reader.decodeFromConstraints(
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    video,
    (result) => {
      if (result && !done) {
        stop();
        if (navigator.vibrate) navigator.vibrate(60);
        onCode(result.getText());
      }
    }
  );
  return stop;
}

export function cleanCode(code) {
  return String(code || '').replace(/\D/g, '');
}

// UPC-A (12 digits) and EAN-13 with a leading 0 are the same product.
function variants(code) {
  const out = [code];
  if (code.length === 12) out.push('0' + code);
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1));
  return out;
}

const round1 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10) / 10);

// Convert an Open Food Facts product into our food shape. Returns null if there's no calorie data.
export function foodFromOFF(p, code) {
  const n = p.nutriments || {};
  const qty = parseFloat(p.serving_quantity);
  const perServing = qty > 0;
  const get = (key, mult = 1) => {
    let v = null;
    if (perServing) {
      if (n[`${key}_serving`] != null) v = Number(n[`${key}_serving`]);
      else if (n[`${key}_100g`] != null) v = (Number(n[`${key}_100g`]) * qty) / 100;
    } else if (n[`${key}_100g`] != null) {
      v = Number(n[`${key}_100g`]);
    }
    return v == null || Number.isNaN(v) ? null : v * mult;
  };

  let kcal = get('energy-kcal');
  if (kcal == null) {
    const kj = get('energy');
    if (kj != null) kcal = kj / 4.184;
  }
  const name = [p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(' · ').trim();
  const food = {
    name: name || `Barcode ${code}`,
    serving: perServing ? (p.serving_size || `${qty} g`) : '100 g',
    barcode: code,
    source: 'barcode',
    per: {
      kcal: round1(kcal),
      protein: round1(get('proteins')) ?? 0,
      carbs: round1(get('carbohydrates')) ?? 0,
      fat: round1(get('fat')) ?? 0,
      fiber: round1(get('fiber')),
      sugar: round1(get('sugars')),
      sodium: round1(get('sodium', 1000)) // g -> mg
    }
  };
  return food;
}

/**
 * Look up a barcode. Checks foods already saved on this phone first (works offline),
 * then Open Food Facts.
 * Returns { food, saved } | { notFound: true, partial? } | { error }.
 */
export async function lookupBarcode(raw) {
  const code = cleanCode(raw);
  if (code.length < 6) return { error: 'That barcode looks too short.' };

  for (const c of variants(code)) {
    const local = await db.foods.where('barcode').equals(c).first();
    if (local) return { food: local, saved: true };
  }

  for (const c of variants(code)) {
    let res;
    try {
      res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=${OFF_FIELDS}`);
    } catch (e) {
      return { error: "Couldn't reach the food database. Check your connection, or enter it as a custom food." };
    }
    if (res.status === 404) continue;
    if (!res.ok) return { error: `The food database returned an error (${res.status}). Try again in a bit.` };
    const data = await res.json();
    if (data.status !== 1 || !data.product) continue;
    const food = foodFromOFF(data.product, code);
    if (food.per.kcal == null) return { notFound: true, partial: food };
    return { food, saved: false };
  }
  return { notFound: true };
}
