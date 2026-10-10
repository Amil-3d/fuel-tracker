import { esc, n0, n1, fmtDate, notices } from '../ui.js';
import { fmtWeight, fmtRate } from '../units.js';
import { KCAL_PER_KG } from '../plan.js';

// Compact summary: calories + macros.
export function targetsHtml(plan) {
  return `
    <div class="hero">
      <div class="big num">${n0(plan.calories)}</div>
      <div class="label">calories per day</div>
    </div>
    <div class="grid-3">
      <div class="macro protein"><b class="num">${plan.protein.g}g</b><span>Protein</span></div>
      <div class="macro carbs"><b class="num">${plan.carbs.g}g</b><span>Carbs</span></div>
      <div class="macro fat"><b class="num">${plan.fat.g}g</b><span>Fat</span></div>
    </div>`;
}

export function timelineText(plan, profile, units) {
  if (plan.goal === 'maintain') return 'Goal: maintain your current weight.';
  if (!plan.timeline) return '';
  const t = plan.timeline;
  const weeks = Math.max(1, Math.round(t.weeks));
  return `${fmtWeight(t.kgToGo, units)} to go at ${fmtRate(plan.rate, units)}: about ${weeks} week${weeks === 1 ? '' : 's'}, around ${fmtDate(t.date)}.`;
}

// Full step-by-step math so the plan is transparent.
export function planMathHtml(plan, profile, units) {
  const kg = plan.kg;
  const sexTerm = profile.sex === 'male' ? '+ 5' : '− 161';
  const rateDisp = units === 'imperial' ? `${fmtRate(plan.rate, units, 2)} (${plan.rate.toFixed(2)} kg)` : fmtRate(plan.rate, units, 2);
  const sign = plan.goal === 'lose' ? '−' : '+';

  let adjustRow = '';
  if (plan.goal !== 'maintain') {
    adjustRow = `
      <tr><th>Goal adjustment</th></tr>
      <tr><td><code>${esc(rateDisp)}</code> × ${n0(KCAL_PER_KG)} kcal/kg ÷ 7 days = <code>${sign}${n0(plan.delta)} kcal/day</code>
        <br><span class="small">Safety cap: ${fmtRate(plan.maxRate, units, 2)} (${plan.goal === 'lose' ? '1%' : '0.5%'} of body weight per week)</span></td></tr>`;
  }

  const targetFormula = plan.goal === 'maintain'
    ? `TDEE = <code>${n0(plan.calories)} kcal</code>`
    : plan.bmrFloor
      ? `Held at BMR = <code>${n0(plan.calories)} kcal</code>`
      : `${n0(plan.tdee)} ${sign} ${n0(plan.delta)} = <code>${n0(plan.calories)} kcal</code>`;

  const timeline = timelineText(plan, profile, units);

  return `
    ${notices(plan.warnings)}
    <table class="math">
      <tr><th>BMR (Mifflin-St Jeor)</th></tr>
      <tr><td>10 × ${n1(kg)} kg + 6.25 × ${n0(profile.heightCm)} cm − 5 × ${plan.age} yr ${sexTerm} = <code>${n0(plan.bmr)} kcal</code></td></tr>
      <tr><th>TDEE (maintenance)</th></tr>
      <tr><td>${n0(plan.bmr)} × ${plan.level.factor} (${esc(plan.level.label)}) = <code>${n0(plan.tdee)} kcal</code></td></tr>
      ${adjustRow}
      <tr class="total"><th>Daily calorie target</th></tr>
      <tr class="total"><td>${targetFormula}</td></tr>
      <tr><th>Protein</th></tr>
      <tr><td>${plan.protein.perKg} g/kg × ${n1(kg)} kg = <code>${plan.protein.g} g</code> (${n0(plan.protein.kcal)} kcal)</td></tr>
      <tr><th>Fat (minimum ${plan.fat.pct}%)</th></tr>
      <tr><td>${plan.fat.pct}% × ${n0(plan.calories)} = ${n0(plan.fat.kcal)} kcal ÷ 9 = <code>${plan.fat.g} g</code></td></tr>
      <tr><th>Carbs (the rest)</th></tr>
      <tr><td>${n0(plan.calories)} − ${n0(plan.protein.kcal)} − ${n0(plan.fat.kcal)} = ${n0(plan.carbs.kcal)} kcal ÷ 4 = <code>${plan.carbs.g} g</code></td></tr>
      ${timeline ? `<tr><th>Timeline</th></tr><tr><td>${esc(timeline)}</td></tr>` : ''}
    </table>`;
}
