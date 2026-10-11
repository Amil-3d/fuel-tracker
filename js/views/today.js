import { loadContext } from '../state.js';
import { getEntries } from '../db.js';
import { sumTotals } from '../nutrition.js';
import { setTitle, fmtDate, today, n0 } from '../ui.js';
import { fmtWeight } from '../units.js';
import { targetsHtml, timelineText } from './plan-card.js';

export async function renderToday(root) {
  setTitle('Today');
  const ctx = await loadContext();
  const { plan, profile, units } = ctx;
  const stale = ctx.weightDate !== today();
  const eaten = sumTotals(await getEntries(today()));
  const left = plan.calories - eaten.kcal;
  root.innerHTML = `
    <p class="muted small" style="margin:0 4px">${fmtDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    <div class="card">${targetsHtml(plan)}
      <p class="small muted" style="text-align:center;margin:14px 0 0">${timelineText(plan, profile, units)}</p>
    </div>
    <div class="card">
      <div class="row between">
        <div><h3>Food</h3><div class="muted small num">${n0(eaten.kcal)} eaten · <b style="color:${left >= 0 ? 'var(--ok)' : 'var(--danger)'}">${n0(Math.abs(left))} ${left >= 0 ? 'left' : 'over'}</b></div>
          <div class="muted small num">P ${n0(eaten.protein)}/${plan.protein.g}g · C ${n0(eaten.carbs)}/${plan.carbs.g}g · F ${n0(eaten.fat)}/${plan.fat.g}g</div></div>
        <a class="btn small primary" href="#/food">Log food</a>
      </div>
    </div>
    <div class="card">
      <div class="row between">
        <div><h3>What should I eat?</h3><div class="muted small">Foods that fill your macros without going over</div></div>
        <a class="btn small" href="#/food/add?tab=picks">Best picks</a>
      </div>
    </div>
    <div class="card">
      <div class="row between">
        <div><h3>Weight</h3><div class="muted small">${fmtWeight(ctx.kg, units)} · ${ctx.weightDate ? fmtDate(ctx.weightDate) : ''}</div></div>
        <a class="btn small" href="#/progress">${stale ? 'Log today' : 'View'}</a>
      </div>
    </div>
    <div class="card">
      <div class="row between"><h3>How was this calculated?</h3><a class="btn small" href="#/settings/plan">Show math</a></div>
    </div>`;
}
