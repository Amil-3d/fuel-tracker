import { saveProfile, setSetting, getSetting, db, exportAll, importAll } from '../db.js';
import { loadContext } from '../state.js';
import { setTitle, seg, toast, notices, applyTheme } from '../ui.js';
import { computePlan, defaultRate } from '../plan.js';
import { fmtWeight } from '../units.js';
import {
  sexField, birthField, schoolField, heightField, readHeight, weightField, readWeight,
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
      <div class="field"><span>Appearance</span>
        ${seg('theme', [{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], theme)}</div>
    </form>

    <div class="section-title">Profile</div>
    <form class="card" data-profile novalidate>
      ${sexField(profile.sex)}
      ${birthField(profile.birthDate)}
      ${schoolField(profile.school)}
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
      <p class="small muted" style="margin:0">All data stays on this phone. Save a backup now and then (to Files or iCloud Drive) so you can restore it on a new phone, or move between Safari and the home screen app.</p>
      <div class="grid-2">
        <button class="btn" data-export>Export backup</button>
        <label class="btn" style="cursor:pointer">Import backup<input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
      <button class="btn danger block" data-reset>Erase all data</button>
    </div>
    <p class="small muted" style="text-align:center">Fuel · v14 · <button class="link-btn small" data-refresh>Force update</button></p>`;

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
        ...profile, sex: form.sex.value, birthDate: form.birthDate.value, school: form.school.value || profile.school || null, heightCm,
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

  root.querySelector('[data-export]').addEventListener('click', async () => {
    const backup = await exportAll();
    const name = `fuel-backup-${backup.exportedAt.slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    // On iPhone the share sheet lets you Save to Files; elsewhere it downloads.
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Fuel backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  root.querySelector('[data-import]').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    let backup;
    try { backup = JSON.parse(await f.text()); } catch (err) { toast("Couldn't read that file."); return; }
    const count = backup?.data?.entries?.length ?? 0;
    if (!confirm(`Replace everything on this phone with this backup (${count} food entries, from ${backup?.exportedAt?.slice(0, 10) || 'unknown date'})?`)) { e.target.value = ''; return; }
    try { await importAll(backup); } catch (err) { toast(err.message); e.target.value = ''; return; }
    const theme = (await getSetting('theme')) || 'system';
    applyTheme(theme);
    toast('Backup restored');
    location.hash = '#/today';
    location.reload();
  });

  root.querySelector('[data-reset]').addEventListener('click', async () => {
    if (!confirm('Erase all data on this phone? This cannot be undone.')) return;
    if (!confirm('Are you sure? Everything will be deleted.')) return;
    await db.delete();
    location.reload();
  });

  root.querySelector('[data-refresh]').addEventListener('click', async () => {
    // Clears cached app files (not your data) and reloads the latest version.
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map((r) => r.unregister()));
    location.reload();
  });

  if (sub === 'plan') requestAnimationFrame(() => document.getElementById('plan').scrollIntoView({ behavior: 'smooth' }));
}
