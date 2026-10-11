import { db, logFood, saveFood, deleteFood, recentFoods, favoriteFoods, customFoods } from '../db.js';
import { setTitle, esc, n0, today, openSheet, stepper, wireSteppers, seg, num, toast } from '../ui.js';
import { MEALS, NUTRIENTS, OPTIONAL, mealForNow, mealLabel, entryTotals, servingText, macroLine } from '../nutrition.js';
import { dayLabel } from './food.js';

const TABS = [
  { id: 'recent', label: 'Recent' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'mine', label: 'My foods' },
  { id: 'dining', label: 'Dining' },
  { id: 'quick', label: 'Quick add' }
];

let lastTab = 'recent';

export async function renderFoodAdd(root, params) {
  const date = params.get('date') || today();
  let meal = params.get('meal') || mealForNow();
  let tab = params.get('tab') || lastTab;
  let query = '';
  const back = `#/food?date=${date}`;

  setTitle('Add food', `<a class="link-btn" href="${back}">Done</a>`);

  root.innerHTML = `
    <p class="small muted" style="margin:0 4px 8px">${esc(dayLabel(date))}</p>
    ${seg('meal', MEALS.map((m) => ({ value: m.id, label: m.label })), meal)}
    <div class="tabs" role="tablist">${TABS.map((t) => `<button type="button" class="chip" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
    <div data-search style="margin-top:8px"><input type="search" placeholder="Search your foods" autocomplete="off" enterkeyhint="search"></div>
    <div data-body></div>`;

  root.querySelectorAll('input[name=meal]').forEach((r) => r.addEventListener('change', () => { meal = r.value; if (tab === 'quick') draw(); }));
  const body = root.querySelector('[data-body]');
  const searchBox = root.querySelector('[data-search]');
  const search = searchBox.querySelector('input');
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); draw(); });
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; lastTab = tab; draw(); }));

  const afterLog = (food) => {
    toast(`Added ${food.name} to ${mealLabel(meal)}`);
    location.hash = back;
  };

  async function draw() {
    root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    searchBox.hidden = tab === 'quick' || tab === 'dining';

    if (tab === 'quick') { drawQuick(); return; }
    if (tab === 'dining') {
      body.innerHTML = `<div class="card empty"><h3>Purdue dining menus</h3><p class="small">Browsing today's dining court menus arrives in phase 4.</p></div>`;
      return;
    }

    let foods;
    if (query) {
      const all = await db.foods.toArray();
      foods = all.filter((f) => f.name.toLowerCase().includes(query)).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    } else if (tab === 'recent') foods = await recentFoods();
    else if (tab === 'favorites') foods = await favoriteFoods();
    else foods = await customFoods();

    const emptyText = query ? 'No saved foods match that search.'
      : tab === 'recent' ? 'Foods you log will show up here for quick re-logging.'
      : tab === 'favorites' ? 'Tap the ☆ next to any food to add it to your favorites.'
      : 'Create foods you eat often, with their nutrition per serving.';

    body.innerHTML = `
      ${tab === 'mine' && !query ? '<button class="btn primary block" data-new style="margin-top:12px">+ New custom food</button>' : ''}
      <div class="card">${foods.length ? foods.map((f) => `
        <div class="row" style="gap:4px">
          <button class="food-row grow" data-food="${f.id}">
            <div class="grow"><div class="name">${esc(f.name)}</div>
              <div class="sub">${esc(f.serving || '1 serving')} · ${macroLine(f.per)}${f.source === 'quick' ? ' · quick add' : ''}</div></div>
            <div class="kcal">${n0(f.per.kcal)}</div>
          </button>
          <button class="star ${f.favorite ? 'on' : ''}" data-fav="${f.id}" aria-label="${f.favorite ? 'Remove from' : 'Add to'} favorites">${f.favorite ? '★' : '☆'}</button>
        </div>`).join('') : `<div class="empty small">${emptyText}</div>`}
      </div>`;

    body.querySelector('[data-new]')?.addEventListener('click', () => foodFormSheet(null, async (food, andLog) => {
      if (andLog) servingsSheet(food, meal, date, afterLog); else draw();
    }));
    body.querySelectorAll('[data-food]').forEach((b) => b.addEventListener('click', async () => {
      const food = foods.find((f) => f.id === Number(b.dataset.food));
      servingsSheet(food, meal, date, afterLog, () => draw());
    }));
    body.querySelectorAll('[data-fav]').forEach((b) => b.addEventListener('click', async () => {
      const food = foods.find((f) => f.id === Number(b.dataset.fav));
      await db.foods.update(food.id, { favorite: food.favorite ? 0 : 1 });
      draw();
    }));
  }

  function drawQuick() {
    body.innerHTML = `
      <form class="card" novalidate>
        <h3>Quick add</h3>
        <p class="small muted" style="margin:4px 0 0">Log calories and macros directly.</p>
        <label class="field"><span>Name (optional)</span><input type="text" name="name" placeholder="Quick add" autocomplete="off"></label>
        ${nutrientFields({}, false)}
        <details><summary>More nutrients</summary>${nutrientFields({}, true)}</details>
        <label class="row" style="min-height:44px"><input type="checkbox" name="save" style="width:22px;height:22px"> Also save to My foods</label>
        <div class="error" data-error></div>
        <button class="btn primary block" type="submit">Add to ${esc(mealLabel(meal))}</button>
      </form>`;
    const form = body.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const per = readNutrients(form, { allowBlankMacros: true });
      if (per.error) { form.querySelector('[data-error]').textContent = per.error; return; }
      const name = form.name.value.trim() || 'Quick add';
      const food = { name, serving: '', per: per.values, source: form.save.checked ? 'custom' : 'quick' };
      food.id = await saveFood(food);
      await logFood(food, { date, meal, servings: 1 });
      afterLog(food);
    });
  }

  draw();
}

// ---- Nutrient form fields ----

function nutrientFields(per, optional) {
  const list = NUTRIENTS.filter((n) => (optional ? !n.required : n.required));
  return `<div class="nutri-grid">${list.map((n) => `
    <label class="field"><span>${n.label}</span><div class="input-unit">
      <input type="number" inputmode="decimal" step="any" min="0" name="n_${n.key}" value="${per[n.key] ?? ''}" ${n.key === 'kcal' ? 'required' : ''}><em>${n.unit}</em></div></label>`).join('')}
  </div>`;
}

function readNutrients(form, { allowBlankMacros = false } = {}) {
  const values = {};
  for (const n of NUTRIENTS) {
    const raw = form[`n_${n.key}`].value;
    const v = num(raw);
    if (raw !== '' && !(v >= 0)) return { error: `${n.label} must be a number.` };
    if (n.key === 'kcal' && !(v >= 0)) return { error: 'Enter calories.' };
    if (n.required && raw === '' && !allowBlankMacros && n.key !== 'kcal') return { error: `Enter ${n.label.toLowerCase()} (use 0 if none).` };
    values[n.key] = raw === '' ? (n.required ? 0 : null) : v;
  }
  return { values };
}

// ---- Sheets ----

function servingsSheet(food, meal, date, onLogged, onChanged) {
  const editable = food.source === 'custom';
  const { el, close } = openSheet(`
    <form novalidate>
      <div class="row between"><h2 class="grow">${esc(food.name)}</h2>${editable ? '<button type="button" class="link-btn" data-edit>Edit</button>' : ''}</div>
      <p class="small muted" style="margin:0 0 8px">${esc(food.serving || '1 serving')} · ${n0(food.per.kcal)} kcal per serving</p>
      <div class="field"><span>Servings</span>${stepper('servings', 1)}
        <div class="chips">${[0.5, 1, 1.5, 2, 3].map((v) => `<button type="button" class="chip" data-chip="${v}">${v}×</button>`).join('')}</div></div>
      <table class="totals-table" data-preview></table>
      <button class="btn primary block" type="submit" style="margin-top:16px">Add to ${esc(mealLabel(meal))}</button>
    </form>`);
  const form = el.querySelector('form');
  const preview = () => {
    const s = num(form.servings.value) || 0;
    const t = entryTotals({ per: food.per, servings: s });
    el.querySelectorAll('[data-chip]').forEach((c) => c.classList.toggle('on', Number(c.dataset.chip) === s));
    el.querySelector('[data-preview]').innerHTML = NUTRIENTS.filter((n) => t[n.key] != null)
      .map((n) => `<tr><td>${n.label}</td><td>${n0(t[n.key])} ${n.unit}</td></tr>`).join('');
  };
  wireSteppers(el, preview);
  el.querySelectorAll('[data-chip]').forEach((c) => c.addEventListener('click', () => { form.servings.value = c.dataset.chip; preview(); }));
  preview();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const servings = num(form.servings.value);
    if (!(servings > 0)) { toast('Enter a number of servings.'); return; }
    await logFood(food, { date, meal, servings });
    close();
    onLogged(food);
  });
  el.querySelector('[data-edit]')?.addEventListener('click', () => {
    close();
    foodFormSheet(food, () => onChanged?.());
  });
}

// Create or edit a custom food. onSaved(food, andLog)
function foodFormSheet(food, onSaved) {
  const f = food || { name: '', serving: '', per: {}, favorite: 0 };
  const { el, close } = openSheet(`
    <form novalidate>
      <h2>${food ? 'Edit food' : 'New custom food'}</h2>
      <label class="field"><span>Name</span><input type="text" name="name" value="${esc(f.name)}" placeholder="Greek yogurt" autocomplete="off"></label>
      <label class="field"><span>Serving size</span><input type="text" name="serving" value="${esc(f.serving)}" placeholder="1 cup (227 g)" autocomplete="off">
        <div class="hint">Enter the nutrition for one serving.</div></label>
      ${nutrientFields(f.per, false)}
      <details ${OPTIONAL.some((n) => f.per[n.key] != null) ? 'open' : ''}><summary>More nutrients</summary>${nutrientFields(f.per, true)}</details>
      <label class="row" style="min-height:44px"><input type="checkbox" name="favorite" style="width:22px;height:22px" ${f.favorite ? 'checked' : ''}> Favorite</label>
      <div class="error" data-error></div>
      <div class="nav-row">
        ${food ? '<button type="button" class="btn danger" data-delete>Delete</button><button class="btn primary" type="submit">Save</button>'
          : '<button type="submit" class="btn" data-save-only>Save</button><button class="btn primary" type="submit" data-and-log>Save &amp; add</button>'}
      </div>
    </form>`);
  const form = el.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    if (!name) { form.querySelector('[data-error]').textContent = 'Enter a name.'; return; }
    const per = readNutrients(form);
    if (per.error) { form.querySelector('[data-error]').textContent = per.error; return; }
    const row = { ...f, name, serving: form.serving.value.trim(), per: per.values, source: 'custom', favorite: form.favorite.checked ? 1 : 0 };
    row.id = await saveFood(row);
    close();
    toast(food ? 'Food updated' : 'Food saved');
    onSaved(row, e.submitter?.hasAttribute('data-and-log'));
  });
  el.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${f.name}? Days you already logged keep their entries.`)) return;
    await deleteFood(f.id);
    close();
    onSaved(null, false);
  });
}
