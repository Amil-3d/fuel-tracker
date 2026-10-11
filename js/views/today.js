import { loadContext } from '../state.js';
import { getEntries, getMealCount, loggedDates, getActivity } from '../db.js';
import { sumTotals, mealLabel, entryTotals } from '../nutrition.js';
import { setTitle, esc, fmtDate, today, n0, isoDate, parseDate } from '../ui.js';
import { fmtWeight } from '../units.js';
import { iconRing } from '../charts.js';
import { ICONS } from '../icons.js';
import { mealCountHtml, wireMealCount } from './meal-count.js';
import { timelineText } from './plan-card.js';
import { shiftDate } from './food.js';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Consecutive days with food logged, ending today (or yesterday if today is still empty).
function streakFrom(logged) {
  let d = today();
  if (!logged.has(d)) d = shiftDate(d, -1);
  let n = 0;
  while (logged.has(d)) { n++; d = shiftDate(d, -1); }
  return n;
}

export async function renderToday(root, sub, params) {
  setTitle('Fuel');
  const now = today();
  const date = params?.get('date') && params.get('date') <= now ? params.get('date') : now;
  const ctx = await loadContext();
  const { plan, profile, units } = ctx;
  const entries = await getEntries(date);
  const eaten = sumTotals(entries);
  const meals = await getMealCount(date);
  // Enough history for the streak and this week's dots.
  const logged = await loggedDates(shiftDate(now, -400));
  const streak = streakFrom(logged);
  const activity = await getActivity(date);

  // This week, Sunday to Saturday.
  const start = shiftDate(now, -parseDate(now).getDay());
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));

  const kcalLeft = plan.calories - eaten.kcal;
  const macro = (key, label, target, color, icon) => {
    const left = target - eaten[key];
    return `<a class="card macro-card" href="#/food?date=${date}">
      <b class="num">${n0(Math.abs(left))}g</b>
      <span class="${left < 0 ? 'over' : ''}">${label} ${left < 0 ? 'over' : 'left'}</span>
      ${iconRing(eaten[key] / target, color, icon)}
      <small class="num">${n0(eaten[key])} / ${n0(target)}g</small></a>`;
  };

  const recent = [...entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const time = (e) => (e.createdAt ? new Date(e.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');

  root.innerHTML = `
    <div class="card streak-card">
      <div class="grow">
        <div class="streak-title">${streak} day streak</div>
        <div class="week-dots">${week.map((d, i) => `<div><span class="${d === now ? 'cur' : ''}">${DOW[i]}</span>
          <i class="${logged.has(d) ? 'on' : ''}">${logged.has(d) ? ICONS.check : ''}</i></div>`).join('')}</div>
      </div>
      <div class="streak-flame">${ICONS.flame}<b class="num">${streak}</b></div>
    </div>

    <div class="date-strip">${week.map((d, i) => `<a href="#/today?date=${d}" class="day ${d === date ? 'sel' : ''} ${d > now ? 'future' : ''} ${logged.has(d) ? 'logged' : ''}"
      aria-label="${fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}"><small>${DOW[i]}</small><b class="num">${parseDate(d).getDate()}</b></a>`).join('')}</div>

    <a class="card cal-card" href="#/food?date=${date}">
      <div class="grow">
        <div class="cal-big num">${n0(Math.abs(kcalLeft))}</div>
        <div class="cal-label ${kcalLeft < 0 ? 'over' : ''}">Calories ${kcalLeft < 0 ? 'over' : 'left'}</div>
        <div class="small muted num" style="margin-top:6px">${n0(eaten.kcal)} eaten of ${n0(plan.calories)}${date === now ? '' : ` · ${esc(fmtDate(date, { weekday: 'short', month: 'short', day: 'numeric' }))}`}</div>
      </div>
      ${iconRing(eaten.kcal / plan.calories, 'var(--ink)', ICONS.flame, 112, 10)}
    </a>

    <div class="macro-grid">
      ${macro('protein', 'Protein', plan.protein.g, 'var(--protein)', ICONS.protein)}
      ${macro('carbs', 'Carbs', plan.carbs.g, 'var(--carbs)', ICONS.carbs)}
      ${macro('fat', 'Fat', plan.fat.g, 'var(--fat)', ICONS.fat)}
    </div>

    <div class="card stack">
      ${mealCountHtml(meals, date === now ? 'Meals today' : 'Meals that day')}
      <div class="grid-2">
        <a class="btn" href="#/food/add?tab=picks&date=${date}">Best picks</a>
        <a class="btn primary" href="#/food/add?date=${date}">Log food</a>
      </div>
    </div>

    <a class="card row between plain-link" href="#/import">
      <div><h3>Activity</h3><div class="muted small num">${activity
        ? `${activity.steps != null ? `${n0(activity.steps)} steps` : ''}${activity.steps != null && activity.activeKcal != null ? ' · ' : ''}${activity.activeKcal != null ? `${n0(activity.activeKcal)} active kcal` : ''}`
        : 'Steps and active calories from Apple Health'}</div></div>
      <span class="btn small">${activity ? 'Update' : 'Import'}</span>
    </a>

    <h2 class="list-title">${date === now ? 'Recently logged' : 'Logged that day'}</h2>
    ${recent.length ? recent.slice(0, 8).map((e) => {
      const t = entryTotals(e);
      return `<a class="card entry-card" href="#/food?date=${date}">
        <div class="entry-tile ${e.meal}">${ICONS.meal[e.meal] || ICONS.meal.snacks}</div>
        <div class="grow entry-body">
          <div class="row between"><div class="entry-name">${esc(e.name)}</div><small class="muted">${time(e)}</small></div>
          <div class="entry-kcal">${ICONS.flame}<b class="num">${n0(t.kcal)}</b> calories</div>
          <div class="entry-macros num">
            <span style="color:var(--protein)">${ICONS.protein}</span>${n0(t.protein)}g
            <span style="color:var(--carbs)">${ICONS.carbs}</span>${n0(t.carbs)}g
            <span style="color:var(--fat)">${ICONS.fat}</span>${n0(t.fat)}g
            <em class="muted">· ${esc(mealLabel(e.meal))}</em>
          </div>
        </div></a>`;
    }).join('') : `<div class="card empty small">Nothing logged ${date === now ? 'yet today' : 'that day'}. Tap + to add food.</div>`}

    <a class="card row between plain-link" href="#/progress">
      <div><h3>Weight</h3><div class="muted small">${fmtWeight(ctx.kg, units)} · ${ctx.weightDate ? fmtDate(ctx.weightDate) : ''}</div>
        <div class="muted small">${timelineText(plan, profile, units)}</div></div>
      <span class="btn small">${ctx.weightDate !== now ? 'Log today' : 'View'}</span>
    </a>
    <a class="card row between plain-link" href="#/settings/plan">
      <div><h3>Your plan</h3><div class="muted small num">${n0(plan.calories)} kcal · P ${plan.protein.g}g · C ${plan.carbs.g}g · F ${plan.fat.g}g</div></div>
      <span class="btn small">Show math</span>
    </a>`;

  wireMealCount(root, date, () => renderToday(root, sub, params));
}
