import { loadContext } from '../state.js';
import { getEntries, getMealCount } from '../db.js';
import { macroRings } from '../charts.js';
import { mealCountHtml, wireMealCount } from './meal-count.js';
import { sumTotals } from '../nutrition.js';
import { setTitle, fmtDate, today, n0 } from '../ui.js';
import { fmtWeight } from '../units.js';
import { timelineText } from './plan-card.js';

export async function renderToday(root) {
  setTitle('Today');
  const ctx = await loadContext();
  const { plan, profile, units } = ctx;
  const stale = ctx.weightDate !== today();
  const eaten = sumTotals(await getEntries(today()));
  const meals = await getMealCount(today());
  root.innerHTML = `
    <p class="muted small" style="margin:0 4px">${fmtDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    <div class="card">${macroRings(eaten, plan)}
      <p class="small muted" style="text-align:center;margin:14px 0 0">${timelineText(plan, profile, units)}</p>
    </div>
    <div class="card stack">
      ${mealCountHtml(meals)}
      <a class="btn primary block" href="#/food">Log food</a>
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
  wireMealCount(root, today(), () => renderToday(root));
}
