// Plan math: BMR, TDEE, calorie target, macros, safety limits, timeline.
// Pure functions, no DOM. All inputs metric.

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Desk job, little or no exercise', factor: 1.2 },
  { id: 'light', label: 'Lightly active', desc: 'Light exercise 1–3 days a week', factor: 1.375 },
  { id: 'moderate', label: 'Moderately active', desc: 'Exercise 3–5 days a week', factor: 1.55 },
  { id: 'active', label: 'Very active', desc: 'Hard exercise 6–7 days a week', factor: 1.725 },
  { id: 'extra', label: 'Extremely active', desc: 'Physical job plus hard daily training', factor: 1.9 }
];

export const GOALS = [
  { id: 'lose', label: 'Lose' },
  { id: 'maintain', label: 'Maintain' },
  { id: 'gain', label: 'Gain' }
];

export const KCAL_PER_KG = 7700;      // energy in ~1 kg of body weight change
export const MAX_LOSS_PCT = 0.01;     // 1% of body weight per week
export const MAX_GAIN_PCT = 0.005;    // 0.5% of body weight per week
export const DEFAULT_PROTEIN = { lose: 2.0, maintain: 1.6, gain: 1.8 }; // g per kg
export const DEFAULT_FAT_PCT = 25;    // minimum % of calories from fat

export function ageOn(birthDate, on = new Date()) {
  const b = new Date(birthDate + 'T00:00:00');
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

// Mifflin-St Jeor
export function mifflin(sex, kg, cm, age) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function maxRate(goal, kg) {
  if (goal === 'lose') return kg * MAX_LOSS_PCT;
  if (goal === 'gain') return kg * MAX_GAIN_PCT;
  return 0;
}

// A sensible starting rate: half of the safety cap.
export function defaultRate(goal, kg) {
  return maxRate(goal, kg) / 2;
}

export function activityLevel(id) {
  return ACTIVITY_LEVELS.find((a) => a.id === id) || ACTIVITY_LEVELS[0];
}

/**
 * @param p profile { sex, birthDate, heightCm, activity, goal, targetKg, ratePerWeekKg, proteinPerKg?, fatMinPct? }
 * @param kg current body weight
 */
export function computePlan(p, kg, now = new Date()) {
  const warnings = [];
  const age = ageOn(p.birthDate, now);
  const bmr = mifflin(p.sex, kg, p.heightCm, age);
  const level = activityLevel(p.activity);
  const tdee = bmr * level.factor;
  const goal = p.goal;

  if (age < 18) warnings.push({ level: 'info', text: 'These equations and safety limits are designed for adults. Check with a doctor or dietitian before following a deficit.' });

  // Rate of change, capped by the safety limits.
  const requestedRate = goal === 'maintain' ? 0 : Math.abs(p.ratePerWeekKg || 0);
  const cap = maxRate(goal, kg);
  let rate = requestedRate;
  let rateCapped = false;
  if (requestedRate > cap + 1e-6) {
    rateCapped = true;
    rate = cap;
    warnings.push({
      level: 'warn',
      key: 'rate',
      text: goal === 'lose'
        ? 'That rate is faster than 1% of your body weight per week. Your plan uses the 1% maximum instead.'
        : 'That rate is faster than 0.5% of your body weight per week, which mostly adds fat. Your plan uses the 0.5% maximum instead.'
    });
  }

  let delta = (rate * KCAL_PER_KG) / 7;
  let calories = goal === 'lose' ? tdee - delta : goal === 'gain' ? tdee + delta : tdee;

  // Never go below BMR.
  let bmrFloor = false;
  if (calories < bmr) {
    bmrFloor = true;
    calories = bmr;
    delta = tdee - bmr;
    rate = (delta * 7) / KCAL_PER_KG;
    warnings.push({ level: 'warn', key: 'bmr', text: 'That deficit would put you below your BMR, so your target is held at your BMR and your expected rate is slower.' });
  }

  // Timeline to target weight.
  let timeline = null;
  const toGo = p.targetKg - kg;
  if (goal === 'lose' && toGo >= 0) {
    warnings.push({ level: 'info', text: 'You are already at or below your target weight. You may want to switch your goal to maintain.' });
  } else if (goal === 'gain' && toGo <= 0) {
    warnings.push({ level: 'info', text: 'You are already at or above your target weight. You may want to switch your goal to maintain.' });
  } else if (goal !== 'maintain' && rate > 0) {
    const weeks = Math.abs(toGo) / rate;
    timeline = { kgToGo: Math.abs(toGo), weeks, date: new Date(now.getTime() + weeks * 7 * 86400000) };
  }

  // Macros.
  const proteinPerKg = p.proteinPerKg ?? DEFAULT_PROTEIN[goal];
  const fatPct = p.fatMinPct ?? DEFAULT_FAT_PCT;
  const proteinG = proteinPerKg * kg;
  const proteinKcal = proteinG * 4;
  const fatKcal = (calories * fatPct) / 100;
  const fatG = fatKcal / 9;
  let carbKcal = calories - proteinKcal - fatKcal;
  if (carbKcal < 0) {
    warnings.push({ level: 'warn', text: 'Protein and fat already use up all of your calories, so carbs are set to 0. Try lowering protein or the fat minimum.' });
    carbKcal = 0;
  }

  return {
    age, kg, bmr, level, tdee, goal,
    requestedRate, maxRate: cap, rate, rateCapped, delta, bmrFloor,
    calories: Math.round(calories),
    protein: { perKg: proteinPerKg, g: Math.round(proteinG), kcal: proteinKcal },
    fat: { pct: fatPct, g: Math.round(fatG), kcal: fatKcal },
    carbs: { g: Math.round(carbKcal / 4), kcal: carbKcal },
    timeline, warnings
  };
}
