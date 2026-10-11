// Shared profile form fields used by onboarding and Settings.
import { esc, seg, num } from '../ui.js';
import { ACTIVITY_LEVELS, GOALS, DEFAULT_PROTEIN, DEFAULT_FAT_PCT, maxRate, defaultRate } from '../plan.js';
import { SCHOOLS } from '../menu.js';
import { cmToFtIn, ftInToCm, toDisplayWeight, fromDisplayWeight, weightUnit, fmtRate } from '../units.js';

export function sexField(sex) {
  return `<div class="field"><span>Sex (used by the BMR equation)</span>
    ${seg('sex', [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }], sex)}</div>`;
}

export function schoolField(school) {
  const opts = [...SCHOOLS.map((x) => ({ value: x.id, label: x.name })), { value: 'none', label: 'Other' }];
  return `<div class="field"><span>School</span>${seg('school', opts, school || '')}
    <div class="hint">Shows your campus dining menus in Add food. Pick Other if neither applies.</div></div>`;
}

export function birthField(birthDate) {
  return `<label class="field"><span>Birth date</span>
    <input type="date" name="birthDate" value="${esc(birthDate || '')}" max="${new Date().toISOString().slice(0, 10)}" required></label>`;
}

export function heightField(units, cm) {
  if (units === 'imperial') {
    const v = cm ? cmToFtIn(cm) : { ft: '', inch: '' };
    return `<div class="field"><span>Height</span><div class="grid-2">
      <div class="input-unit"><input type="number" inputmode="numeric" name="heightFt" min="3" max="8" value="${v.ft}" placeholder="5"><em>ft</em></div>
      <div class="input-unit"><input type="number" inputmode="numeric" name="heightIn" min="0" max="11" value="${v.inch}" placeholder="10"><em>in</em></div>
    </div></div>`;
  }
  return `<label class="field"><span>Height</span><div class="input-unit">
    <input type="number" inputmode="decimal" name="heightCm" min="100" max="250" value="${cm ? Math.round(cm) : ''}" placeholder="178"><em>cm</em></div></label>`;
}

export function readHeight(form, units) {
  if (units === 'imperial') {
    const ft = num(form.heightFt.value);
    const inch = num(form.heightIn.value) || 0;
    if (!(ft >= 3 && ft <= 8) || inch < 0 || inch >= 12) return NaN;
    return ftInToCm(ft, inch);
  }
  const cm = num(form.heightCm.value);
  return cm >= 100 && cm <= 250 ? cm : NaN;
}

export function weightField(name, label, units, kg, hint = '') {
  return `<label class="field"><span>${esc(label)}</span><div class="input-unit">
    <input type="number" inputmode="decimal" step="0.1" name="${name}" value="${kg ? toDisplayWeight(kg, units) : ''}" placeholder="${units === 'imperial' ? '180' : '82'}"><em>${weightUnit(units)}</em></div>
    ${hint ? `<div class="hint">${hint}</div>` : ''}</label>`;
}

export function readWeight(form, name, units) {
  const v = num(form[name].value);
  const kg = fromDisplayWeight(v, units);
  return kg >= 25 && kg <= 350 ? kg : NaN;
}

export function activityField(activity) {
  return `<div class="field"><span>Activity level</span><div class="options">
    ${ACTIVITY_LEVELS.map((a) => `<label class="option"><input type="radio" name="activity" value="${a.id}" ${a.id === activity ? 'checked' : ''}>
      <div><strong>${esc(a.label)}</strong><small>${esc(a.desc)} · ×${a.factor}</small></div></label>`).join('')}
  </div><div class="hint">Include your usual workouts when you pick, since exercise isn't logged separately.</div></div>`;
}

export function goalField(goal) {
  return `<div class="field"><span>Goal</span>${seg('goal', GOALS.map((g) => ({ value: g.id, label: g.label })), goal)}</div>`;
}

export function rateField(units, rateKg) {
  const step = units === 'imperial' ? '0.1' : '0.05';
  return `<label class="field" data-rate-field><span>Desired rate</span><div class="input-unit">
    <input type="number" inputmode="decimal" step="${step}" name="rate" value="${rateKg ? toDisplayWeight(rateKg, units) : ''}"><em>${weightUnit(units)}/wk</em></div>
    <div class="hint" data-rate-hint></div></label>`;
}

export function readRate(form, units) {
  const v = num(form.rate.value);
  return v > 0 ? fromDisplayWeight(v, units) : NaN;
}

export function macroFields(profile) {
  const goal = profile.goal || 'lose';
  return `<div class="grid-2">
    <label class="field"><span>Protein</span><div class="input-unit">
      <input type="number" inputmode="decimal" step="0.1" min="0.8" max="3.3" name="proteinPerKg" value="${profile.proteinPerKg ?? ''}" placeholder="${DEFAULT_PROTEIN[goal]}"><em>g/kg</em></div>
      <div class="hint">Blank = default for your goal (${DEFAULT_PROTEIN.lose} lose, ${DEFAULT_PROTEIN.maintain} maintain, ${DEFAULT_PROTEIN.gain} gain)</div></label>
    <label class="field"><span>Fat minimum</span><div class="input-unit">
      <input type="number" inputmode="numeric" step="1" min="15" max="50" name="fatMinPct" value="${profile.fatMinPct ?? ''}" placeholder="${DEFAULT_FAT_PCT}"><em>%</em></div>
      <div class="hint">Share of calories. Blank = ${DEFAULT_FAT_PCT}%</div></label>
  </div>`;
}

export function readMacros(form) {
  const p = num(form.proteinPerKg.value);
  const f = num(form.fatMinPct.value);
  return {
    proteinPerKg: Number.isFinite(p) ? Math.min(3.3, Math.max(0.8, p)) : null,
    fatMinPct: Number.isFinite(f) ? Math.min(50, Math.max(15, Math.round(f))) : null
  };
}

// Show/hide target + rate depending on goal, and fill in the max-safe hint.
export function wireGoalControls(form, units, getKg) {
  const update = () => {
    const goal = form.goal.value;
    const kg = getKg();
    form.querySelectorAll('[data-goal-only]').forEach((el) => { el.hidden = goal === 'maintain'; });
    const hint = form.querySelector('[data-rate-hint]');
    if (hint && kg) {
      hint.textContent = goal === 'maintain' ? '' : `Safe maximum: ${fmtRate(maxRate(goal, kg), units)} (${goal === 'lose' ? '1%' : '0.5%'} of body weight)`;
    }
    if (form.rate && !form.rate.value && kg && goal !== 'maintain') {
      form.rate.value = toDisplayWeight(defaultRate(goal, kg), units);
    }
  };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'goal' && form.rate && getKg()) {
      // Switching between lose and gain changes the safe range, so reset to the default.
      form.rate.value = e.target.value === 'maintain' ? form.rate.value : toDisplayWeight(defaultRate(e.target.value, getKg()), units);
    }
    update();
  });
  update();
  return update;
}
