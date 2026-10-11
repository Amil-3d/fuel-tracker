import { saveProfile, setSetting, getSetting, db } from '../db.js';
import { loadContext } from '../state.js';
import { setTitle, seg, toast, notices, applyTheme } from '../ui.js';
import { computePlan, defaultRate } from '../plan.js';
import { fmtWeight } from '../units.js';
import {
  sexField, birthField, heightField, readHeight, weightField, readWeight,
  activityField, goalField, rateField, readRate, macroFields, readMacros, wireGoalControls
} from './profile-form.js';
import { targetsHtml, planMathHtml } from './plan-card.js';

export async function renderSettings(root, sub) {
  setTitle('Settings');
  const ctx = await loadContext();
  const { profile, units, kg, plan } = ctx;
  const theme = (await getSetting('theme')) || 'system';

  root.innerHTML = `
    <div class="section-title">Preferences</div>
    <form class="card" data-prefs>
      <div class="field"><span>Units</span>${seg('units', [{ value: 'imperial', label: 'lb · ft/in' }, { value: 'metric', label: 'kg · cm' }], units)}</div>
      <div class="field"><span>Exercise calories added to your budget</span>
        ${seg('exerciseCredit', [{ value: 'full', label: 'Full' }, { value: 'half', label: 'Half' }, { value: 'none', label: 'None' }], profile.exerciseCredit || 'half')}
        <div class="hint">Half is a common choice because calorie burn estimates tend to run high.</div></div>
      <div class="field"><span>Appearance</span>
        ${seg('theme', [{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], theme)}</div>
    </form>

    <div class="section-title">Profile</div>
    <form class="card" data-profile novalidate>
      ${sexField(profile.sex)}
      ${birthField(profile.birthDate)}
      ${heightField(units, profile.heightCm)}
      <div class="field"><span>Current weight</span><div class="row between"><strong>${fmtWeight(kg, units)}</strong><a href="#/progress" class="btn small">Log new weight</a></div></div>
      ${activityField(profile.activity)}
      ${goalField(profile.goal)}
      <div data-goal-only>
        ${weightField('targetKg', 'Target weight', units, profile.targetKg)}
        ${rateField(units, profile.ratePerWeekKg)}
      </div>
      ${macroFields(profile)}
      <div data-live></div>
      <div class="error" data-error></div>
      <button class="btn primary block" type="submit">Save profile</button>
    </form>

    <div class="section-title" id="plan">Your plan</div>
    <div class="card">${targetsHtml(plan)}</div>
    <div class="card">${planMathHtml(plan, profile, units)}</div>

    <div class="section-title">Data</div>
    <div class="card stack">
      <p class="small muted" style="margin:0">All data stays on this phone. Export and import backups arrive in phase 6.</p>
      <button class="btn danger block" data-reset>Erase all data</button>
    </div>
    <p class="small muted" style="text-align:center">Fuel · phase 2</p>`;

  // Preferences save instantly.
  const prefs = root.querySelector('[data-prefs]');
  prefs.addEventListener('change', async (e) => {
    const { name, value } = e.target;
    if (name === 'theme') {
      await setSetting('theme', value);
      applyTheme(value);
      return;
    }
    await saveProfile({ ...profile, [name]: value });
    toast('Saved');
    if (name === 'units') renderSettings(root);
  });

  // Profile form.
  const form = root.querySelector('[data-profile]');
  const live = form.querySelector('[data-live]');
  wireGoalControls(form, units, () => kg);

  const readForm = () => {
    const goal = form.goal.value;
    const heightCm = readHeight(form, units);
    if (!form.birthDate.value) return { error: 'Enter your birth date.' };
    if (!heightCm) return { error: 'Enter a valid height.' };
    let targetKg = kg, ratePerWeekKg = 0;
    if (goal !== 'maintain') {
      targetKg = readWeight(form, 'targetKg', units);
      if (!targetKg) return { error: 'Enter a valid target weight.' };
      ratePerWeekKg = readRate(form, units) || defaultRate(goal, kg);
    }
    return {
      profile: {
        ...profile, sex: form.sex.value, birthDate: form.birthDate.value, heightCm,
        activity: form.activity.value, goal, targetKg, ratePerWeekKg, ...readMacros(form)
      }
    };
  };

  const preview = () => {
    const r = readForm();
    live.innerHTML = r.profile ? notices(computePlan(r.profile, kg).warnings.filter((w) => w.key)) : '';
  };
  form.addEventListener('input', preview);
  form.addEventListener('change', preview);
  preview();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = readForm();
    if (r.error) { form.querySelector('[data-error]').textContent = r.error; return; }
    await saveProfile(r.profile);
    const next = computePlan(r.profile, kg);
    toast(`Saved. Daily target: ${next.calories.toLocaleString('en-US')} kcal`);
    renderSettings(root, 'plan');
  });

  root.querySelector('[data-reset]').addEventListener('click', async () => {
    if (!confirm('Erase all data on this phone? This cannot be undone.')) return;
    if (!confirm('Are you sure? Everything will be deleted.')) return;
    await db.delete();
    location.reload();
  });

  if (sub === 'plan') requestAnimationFrame(() => document.getElementById('plan').scrollIntoView({ behavior: 'smooth' }));
}
