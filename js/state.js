// Loads the profile, latest weight and the plan derived from them.
import { getProfile, latestWeight, addWeight } from './db.js';
import { computePlan } from './plan.js';
import { n0 } from './ui.js';

export async function loadContext() {
  const profile = await getProfile();
  if (!profile) return null;
  const w = await latestWeight();
  const kg = w ? w.kg : profile.targetKg;
  return { profile, units: profile.units, kg, weightDate: w?.date, plan: computePlan(profile, kg) };
}

// Log a weight and report how the calorie target changed (targets are always derived
// from the latest weight, so recalculation is automatic).
export async function logWeight(date, kg) {
  const before = await loadContext();
  await addWeight(date, kg);
  const after = await loadContext();
  const a = before.plan.calories, b = after.plan.calories;
  const msg = a === b ? `Weight saved. Target stays ${n0(b)} kcal.` : `Weight saved. Target updated: ${n0(a)} → ${n0(b)} kcal.`;
  return { before, after, msg };
}
