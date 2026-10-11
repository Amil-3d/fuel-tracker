import { getEntries, updateEntry, deleteEntry } from '../db.js';
import { loadContext } from '../state.js';
import { setTitle, esc, n0, today, isoDate, parseDate, fmtDate, openSheet, stepper, wireSteppers, seg, num, toast } from '../ui.js';
import { MEALS, entryTotals, sumTotals, servingText, macroLine } from '../nutrition.js';

export function shiftDate(iso, days) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function dayLabel(iso) {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === shiftDate(t, -1)) return 'Yesterday';
  if (iso === shiftDate(t, 1)) return 'Tomorrow';
  return fmtDate(iso, { weekday: 'short', month: 'short', day: 'numeric' });
}

function bar(cls, value, target) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return `<div class="bar ${cls} ${value > target * 1.05 ? 'over' : ''}"><i style="width:${pct}%"></i></div>`;
}

export async function renderFood(root, params) {
  setTitle('Food');
  const date = params?.get('date') || today();
  const ctx = await loadContext();
  const { plan } = ctx;
  const entries = await getEntries(date);
  const t = sumTotals(entries);
  const remaining = plan.calories - t.kcal;
  const optParts = [['fiber', 'Fiber', 'g'], ['sugar', 'Sugar', 'g'], ['sodium', 'Sodium', 'mg']]
    .filter(([k]) => entries.some((e) => e.per[k] != null))
    .map(([k, label, unit]) => `${label} ${n0(t[k])}${unit}`);

  root.innerHTML = `
    <div class="date-nav">
      <a class="icon-btn" href="#/food?date=${shiftDate(date, -1)}" aria-label="Previous day">‹</a>
      <strong>${esc(dayLabel(date))}</strong>
      <a class="icon-btn" href="#/food?date=${shiftDate(date, 1)}" aria-label="Next day" ${date >= today() ? 'style="visibility:hidden"' : ''}>›</a>
    </div>

    <div class="card">
      <div class="row between">
        <div><div class="small muted">Eaten</div><b class="num" style="font-size:24px">${n0(t.kcal)}</b></div>
        <div style="text-align:center"><div class="small muted">Target</div><b class="num" style="font-size:24px">${n0(plan.calories)}</b></div>
        <div style="text-align:right"><div class="small muted">${remaining >= 0 ? 'Remaining' : 'Over'}</div>
          <b class="num" style="font-size:24px;color:${remaining >= 0 ? 'var(--ok)' : 'var(--danger)'}">${n0(Math.abs(remaining))}</b></div>
      </div>
      ${bar('', t.kcal, plan.calories)}
      <div class="macro-bars">
        <div><b class="num">${n0(t.protein)}</b><span class="muted"> / ${plan.protein.g}g P</span>${bar('protein', t.protein, plan.protein.g)}</div>
        <div><b class="num">${n0(t.carbs)}</b><span class="muted"> / ${plan.carbs.g}g C</span>${bar('carbs', t.carbs, plan.carbs.g)}</div>
        <div><b class="num">${n0(t.fat)}</b><span class="muted"> / ${plan.fat.g}g F</span>${bar('fat', t.fat, plan.fat.g)}</div>
      </div>
      ${optParts.length ? `<p class="small muted" style="margin:12px 0 0">${optParts.join(' · ')}</p>` : ''}
      <p class="small muted" style="margin:10px 0 0">Exercise calories are added to your budget in phase 3.</p>
    </div>

    ${MEALS.map((m) => {
      const list = entries.filter((e) => e.meal === m.id);
      const kcal = sumTotals(list).kcal;
      return `<div class="card">
        <div class="meal-head">
          <div><h3>${m.label}</h3>${list.length ? `<div class="small muted num">${n0(kcal)} kcal</div>` : ''}</div>
          <a class="btn small" href="#/food/add?meal=${m.id}&date=${date}">+ Add</a>
        </div>
        ${list.length ? `<div>${list.map((e) => {
          const et = entryTotals(e);
          return `<button class="food-row" data-entry="${e.id}">
            <div class="grow"><div class="name">${esc(e.name)}</div><div class="sub">${esc(servingText(e.serving, e.servings))} · ${macroLine(et)}</div></div>
            <div class="kcal">${n0(et.kcal)}</div></button>`;
        }).join('')}</div>` : ''}
      </div>`;
    }).join('')}`;

  root.querySelectorAll('[data-entry]').forEach((b) => b.addEventListener('click', async () => {
    const entry = entries.find((e) => e.id === Number(b.dataset.entry));
    editEntrySheet(entry, () => renderFood(root, params));
  }));
}

function editEntrySheet(entry, onDone) {
  const { el, close } = openSheet(`
    <form novalidate>
      <h2>${esc(entry.name)}</h2>
      <p class="small muted" style="margin:0 0 8px">${esc(entry.serving || '1 serving')} per serving</p>
      <div class="field"><span>Servings</span>${stepper('servings', entry.servings)}</div>
      <div class="field"><span>Meal</span>${seg('meal', MEALS.map((m) => ({ value: m.id, label: m.label })), entry.meal)}</div>
      <div data-preview></div>
      <div class="nav-row"><button type="button" class="btn danger" data-delete>Delete</button><button class="btn primary" type="submit">Save</button></div>
    </form>`);
  const form = el.querySelector('form');
  const preview = () => {
    const s = num(form.servings.value) || 0;
    const t = entryTotals({ ...entry, servings: s });
    el.querySelector('[data-preview]').innerHTML = `<p class="num" style="margin:4px 0"><b>${n0(t.kcal)} kcal</b> · ${macroLine(t)}</p>`;
  };
  wireSteppers(el, preview);
  preview();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const servings = num(form.servings.value);
    if (!(servings > 0)) { toast('Enter a number of servings.'); return; }
    await updateEntry(entry.id, { servings, meal: form.meal.value });
    close();
    onDone();
  });
  el.querySelector('[data-delete]').addEventListener('click', async () => {
    await deleteEntry(entry.id);
    close();
    toast('Removed');
    onDone();
  });
}

