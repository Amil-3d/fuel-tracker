import { loadContext } from '../state.js';
import { setTitle, fmtDate, today } from '../ui.js';
import { fmtWeight } from '../units.js';
import { targetsHtml, timelineText } from './plan-card.js';

export async function renderToday(root) {
  setTitle('Today');
  const ctx = await loadContext();
  const { plan, profile, units } = ctx;
  const stale = ctx.weightDate !== today();
  root.innerHTML = `
    <p class="muted small" style="margin:0 4px">${fmtDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    <div class="card">${targetsHtml(plan)}
      <p class="small muted" style="text-align:center;margin:14px 0 0">${timelineText(plan, profile, units)}</p>
    </div>
    <div class="card">
      <div class="row between">
        <div><h3>Weight</h3><div class="muted small">${fmtWeight(ctx.kg, units)} · ${ctx.weightDate ? fmtDate(ctx.weightDate) : ''}</div></div>
        <a class="btn small ${stale ? 'primary' : ''}" href="#/progress">${stale ? 'Log today' : 'View'}</a>
      </div>
    </div>
    <div class="card">
      <div class="row between"><h3>How was this calculated?</h3><a class="btn small" href="#/settings/plan">Show math</a></div>
    </div>
    <p class="muted small" style="text-align:center">Food and exercise logging arrive in the next phases.</p>`;
}
