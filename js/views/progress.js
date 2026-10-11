import { getWeights, deleteWeight, entriesBetween, activityBetween } from '../db.js';
import { sumTotals } from '../nutrition.js';
import { shiftDate } from './food.js';
import { loadContext, logWeight } from '../state.js';
import { setTitle, fmtDate, today, toast, esc, n0, parseDate } from '../ui.js';
import { fmtWeight, toDisplayWeight, weightUnit } from '../units.js';
import { lineChart, barChart } from '../charts.js';
import { weightField, readWeight } from './profile-form.js';

export async function renderProgress(root) {
  setTitle('Progress');
  const ctx = await loadContext();
  const { units, profile, plan } = ctx;
  const weights = await getWeights();

  // ---- Food trends ----
  const now = today();
  const from = shiftDate(now, -55); // 8 weeks
  const entries = await entriesBetween(from, now);
  const activity = await activityBetween(shiftDate(now, -13), now);
  const byDay = {};
  for (const e of entries) (byDay[e.date] ||= []).push(e);
  const totals = (d) => (byDay[d] ? sumTotals(byDay[d]) : null);
  const days14 = Array.from({ length: 14 }, (_, i) => shiftDate(now, i - 13));
  const days7 = days14.slice(7);
  const logged7 = days7.map(totals).filter(Boolean);
  const avg = (arr, k) => (arr.length ? arr.reduce((a, t) => a + t[k], 0) / arr.length : 0);
  const onTarget = logged7.filter((t) => Math.abs(t.kcal - plan.calories) <= plan.calories * 0.1 && t.protein >= plan.protein.g * 0.9).length;

  // Weekly averages, Sunday to Saturday, newest first.
  const weekStart = shiftDate(now, -parseDate(now).getDay());
  const weeks = Array.from({ length: 8 }, (_, w) => {
    const start = shiftDate(weekStart, -7 * w);
    const days = Array.from({ length: 7 }, (_, i) => shiftDate(start, i)).filter((d) => d <= now);
    const t = days.map(totals).filter(Boolean);
    const inWeek = weights.filter((x) => x.date >= start && x.date <= shiftDate(start, 6));
    return { start, n: t.length, kcal: avg(t, 'kcal'), protein: avg(t, 'protein'), kg: inWeek.length ? inWeek[inWeek.length - 1].kg : null };
  }).filter((w) => w.n || w.kg);
  const steps = days14.map((d) => ({ date: d, value: activity.find((a) => a.date === d)?.steps ?? null }));

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

    <div class="section-title">Last 7 days</div>
    <div class="card">
      ${logged7.length ? `<div class="stat-grid">
        <div><b class="num">${n0(avg(logged7, 'kcal'))}</b><span>avg kcal / day (target ${n0(plan.calories)})</span></div>
        <div><b class="num">${n0(avg(logged7, 'protein'))}g</b><span>avg protein (target ${plan.protein.g}g)</span></div>
        <div><b class="num">${logged7.length} / 7</b><span>days logged</span></div>
        <div><b class="num">${onTarget}</b><span>days on target (calories within 10%, protein hit)</span></div>
      </div>` : '<div class="empty small">Log food for a few days to see your averages.</div>'}
    </div>

    <div class="card">
      <h3>Calories, last 14 days</h3>
      ${barChart(days14.map((d) => ({ date: d, value: totals(d)?.kcal ?? null })), { target: plan.calories, targetLabel: `Target ${n0(plan.calories)}`, unit: ' kcal', flagOver: true, label: 'Calories per day, last 14 days' })}
      <div class="legend-line"><span><i></i>Target</span><span style="color:var(--danger)">Red = more than 10% over</span></div>
    </div>

    <div class="card">
      <h3>Protein, last 14 days</h3>
      ${barChart(days14.map((d) => ({ date: d, value: totals(d)?.protein ?? null })), { target: plan.protein.g, targetLabel: `Target ${plan.protein.g}g`, unit: 'g', color: 'var(--protein)', label: 'Protein per day, last 14 days' })}
    </div>

    ${steps.some((x) => x.value != null) ? `<div class="card">
      <h3>Steps, last 14 days</h3>
      ${barChart(steps, { unit: ' steps', color: 'var(--fat)', label: 'Steps per day, last 14 days' })}
    </div>` : ''}

    ${weeks.length ? `<div class="card">
      <h3>Weekly averages</h3>
      <table class="week-table">
        <tr><th>Week of</th><th>Days</th><th>kcal</th><th>Protein</th><th>Weight</th></tr>
        ${weeks.map((w) => `<tr><td>${esc(fmtDate(w.start, { month: 'short', day: 'numeric' }))}</td><td>${w.n}</td>
          <td>${w.n ? n0(w.kcal) : '–'}</td><td>${w.n ? n0(w.protein) + 'g' : '–'}</td><td>${w.kg ? fmtWeight(w.kg, units) : '–'}</td></tr>`).join('')}
      </table>
    </div>` : ''}

    <div class="card">
      <h3>Weight entries</h3>
      <ul class="list">
        ${weights.slice().reverse().map((w) => `
          <li><div class="grow"><strong class="num">${fmtWeight(w.kg, units)}</strong><div class="small muted">${fmtDate(w.date)}</div></div>
            <button class="icon-btn" data-del="${w.id}" aria-label="Delete ${esc(fmtDate(w.date))}">×</button></li>`).join('')}
      </ul>
    </div>
`;

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
