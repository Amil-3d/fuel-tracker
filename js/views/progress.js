import { getWeights, deleteWeight } from '../db.js';
import { loadContext, logWeight } from '../state.js';
import { setTitle, fmtDate, today, toast, esc } from '../ui.js';
import { fmtWeight, toDisplayWeight, weightUnit } from '../units.js';
import { lineChart } from '../charts.js';
import { weightField, readWeight } from './profile-form.js';

export async function renderProgress(root) {
  setTitle('Progress');
  const ctx = await loadContext();
  const { units, profile } = ctx;
  const weights = await getWeights();

  const first = weights[0];
  const change = first ? ctx.kg - first.kg : 0;
  const chart = lineChart(
    weights.map((w) => ({ date: w.date, value: toDisplayWeight(w.kg, units) })),
    profile.goal !== 'maintain'
      ? { goal: toDisplayWeight(profile.targetKg, units), goalLabel: `Goal ${fmtWeight(profile.targetKg, units)}`, label: 'Weight history' }
      : { label: 'Weight history' }
  );

  root.innerHTML = `
    <form class="card" data-log novalidate>
      <h2>Log weight</h2>
      <div class="grid-2">
        <label class="field"><span>Date</span><input type="date" name="date" value="${today()}" max="${today()}"></label>
        ${weightField('kg', `Weight (${weightUnit(units)})`, units, null)}
      </div>
      <div class="error" data-error></div>
      <button class="btn primary block" type="submit">Save weight</button>
    </form>

    <div class="card">
      <div class="row between"><h2>Weight history</h2>
        ${first ? `<span class="small muted num">${change <= 0 ? '' : '+'}${fmtWeight(change, units)} since ${fmtDate(first.date, { month: 'short', day: 'numeric' })}</span>` : ''}</div>
      ${weights.length > 1 ? chart : `<div class="empty small">Log a few weigh-ins to see your trend.${weights.length ? chart : ''}</div>`}
    </div>

    <div class="card">
      <h3>Entries</h3>
      <ul class="list">
        ${weights.slice().reverse().map((w) => `
          <li><div class="grow"><strong class="num">${fmtWeight(w.kg, units)}</strong><div class="small muted">${fmtDate(w.date)}</div></div>
            <button class="icon-btn" data-del="${w.id}" aria-label="Delete ${esc(fmtDate(w.date))}">×</button></li>`).join('')}
      </ul>
    </div>
    <p class="small muted" style="text-align:center">Weekly calorie and protein trends arrive in phase 6.</p>`;

  const form = root.querySelector('[data-log]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kg = readWeight(form, 'kg', units);
    if (!kg) { form.querySelector('[data-error]').textContent = 'Enter a valid weight.'; return; }
    const { msg } = await logWeight(form.date.value || today(), kg);
    toast(msg);
    renderProgress(root);
  });

  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (weights.length <= 1) { toast('Keep at least one weight entry.'); return; }
    if (!confirm('Delete this weight entry?')) return;
    await deleteWeight(Number(b.dataset.del));
    renderProgress(root);
  }));
}
