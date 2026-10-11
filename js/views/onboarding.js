import { saveProfile, addWeight, setSetting } from '../db.js';
import { seg, today, notices, setTitle } from '../ui.js';
import { computePlan, defaultRate } from '../plan.js';
import {
  sexField, birthField, heightField, readHeight, weightField, readWeight,
  activityField, goalField, rateField, readRate, wireGoalControls
} from './profile-form.js';
import { targetsHtml, planMathHtml } from './plan-card.js';

export function renderOnboarding(root, onDone) {
  setTitle('');
  const s = {
    units: 'imperial', sex: null, birthDate: '', heightCm: null, kg: null,
    activity: 'light', goal: 'lose', targetKg: null, ratePerWeekKg: null,
    proteinPerKg: null, fatMinPct: null
  };

  const steps = [
    {
      html: () => `
        <img class="welcome-art" src="icons/icon-512.png" alt="">
        <h2 style="text-align:center">Welcome to Fuel</h2>
        <p class="lead" style="text-align:center">A quick setup builds your calorie and macro plan. You can change any of this later in Settings.</p>
        <div class="field"><span>Units</span>${seg('units', [{ value: 'imperial', label: 'lb · ft/in' }, { value: 'metric', label: 'kg · cm' }], s.units)}</div>`,
      read: (f) => { s.units = f.units.value; }
    },
    {
      html: () => `<h2>About you</h2><p class="lead">Used to estimate your resting metabolism.</p>${sexField(s.sex)}${birthField(s.birthDate)}`,
      read: (f) => {
        if (!f.sex.value) return 'Choose a sex.';
        if (!f.birthDate.value) return 'Enter your birth date.';
        s.sex = f.sex.value;
        s.birthDate = f.birthDate.value;
      }
    },
    {
      html: () => `<h2>Your body</h2><p class="lead">Your weight will be the first entry in your weight log.</p>
        ${heightField(s.units, s.heightCm)}${weightField('kg', 'Current weight', s.units, s.kg)}`,
      read: (f) => {
        const cm = readHeight(f, s.units);
        const kg = readWeight(f, 'kg', s.units);
        if (!cm) return 'Enter a valid height.';
        if (!kg) return 'Enter a valid weight.';
        s.heightCm = cm;
        s.kg = kg;
      }
    },
    {
      html: () => `<h2>Activity</h2>${activityField(s.activity)}`,
      read: (f) => { s.activity = f.activity.value; }
    },
    {
      html: () => `<h2>Your goal</h2>${goalField(s.goal)}
        <div data-goal-only>${weightField('targetKg', 'Target weight', s.units, s.targetKg)}${rateField(s.units, s.ratePerWeekKg)}</div>
        <div data-live></div>`,
      after: (f) => {
        const live = f.querySelector('[data-live]');
        wireGoalControls(f, s.units, () => s.kg);
        const preview = () => {
          const goal = f.goal.value;
          const draft = { ...s, goal, targetKg: readWeight(f, 'targetKg', s.units) || s.kg, ratePerWeekKg: readRate(f, s.units) || 0 };
          const plan = computePlan(draft, s.kg);
          live.innerHTML = notices(plan.warnings.filter((w) => w.key === 'rate' || w.key === 'bmr'));
        };
        f.addEventListener('input', preview);
        f.addEventListener('change', preview);
        preview();
      },
      read: (f) => {
        s.goal = f.goal.value;
        if (s.goal === 'maintain') {
          s.targetKg = s.kg;
          s.ratePerWeekKg = 0;
          return;
        }
        const target = readWeight(f, 'targetKg', s.units);
        const rate = readRate(f, s.units);
        if (!target) return 'Enter a target weight.';
        if (s.goal === 'lose' && target >= s.kg) return 'For weight loss, your target should be below your current weight.';
        if (s.goal === 'gain' && target <= s.kg) return 'For weight gain, your target should be above your current weight.';
        s.targetKg = target;
        s.ratePerWeekKg = rate || defaultRate(s.goal, s.kg);
      }
    },
    {
      html: () => {
        const plan = computePlan(s, s.kg);
        return `<h2>Your plan</h2><p class="lead">Here is how your targets were calculated.</p>
          <div class="card">${targetsHtml(plan)}</div>
          <div class="card">${planMathHtml(plan, s, s.units)}</div>`;
      },
      next: 'Start tracking',
      read: () => {}
    }
  ];

  let i = 0;

  function show() {
    const step = steps[i];
    root.innerHTML = `
      <form class="onboard" novalidate>
        <div class="dots">${steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        ${step.html()}
        <div class="error" data-error></div>
        <div class="nav-row">
          ${i > 0 ? '<button type="button" class="btn" data-back>Back</button>' : ''}
          <button type="submit" class="btn primary">${step.next || 'Next'}</button>
        </div>
      </form>`;
    const form = root.querySelector('form');
    if (step.after) step.after(form);
    form.querySelector('[data-back]')?.addEventListener('click', () => { i--; show(); window.scrollTo(0, 0); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = step.read(form);
      if (err) { form.querySelector('[data-error]').textContent = err; return; }
      if (i < steps.length - 1) { i++; show(); window.scrollTo(0, 0); return; }
      const { kg, ...profile } = s;
      profile.createdAt = new Date().toISOString();
      await saveProfile(profile);
      await addWeight(today(), kg);
      await setSetting('theme', 'system');
      onDone();
    });
  }

  show();
}
