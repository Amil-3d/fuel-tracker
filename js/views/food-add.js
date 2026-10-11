import { db, logFood, saveFood, deleteFood, recentFoods, favoriteFoods, customFoods, getEntries, getProfile, saveProfile } from '../db.js';
import { setTitle, esc, n0, today, openSheet, stepper, wireSteppers, seg, num, toast } from '../ui.js';
import { MEALS, NUTRIENTS, OPTIONAL, mealForNow, mealLabel, entryTotals, sumTotals, macroLine } from '../nutrition.js';
import { dayLabel } from './food.js';
import { startScanner, lookupBarcode, cleanCode } from '../barcode.js';
import { loadMenu, menuCached, matchMeal, hasNutrition, foodFromMenuItem, menuCandidates, strictMeal, SCHOOLS, schoolInfo } from '../menu.js';
import { loadContext } from '../state.js';
import { remaining, mealBudget, rank, buildPlate } from '../recommend.js';

const TABS = [
  { id: 'picks', label: 'Best picks' },
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
    <button type="button" class="btn block" data-scan style="margin-top:12px">${CAMERA_ICON} Scan barcode</button>
    <div class="tabs" role="tablist">${TABS.map((t) => `<button type="button" class="chip" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
    <div data-search style="margin-top:8px"><input type="search" placeholder="Search your foods" autocomplete="off" enterkeyhint="search"></div>
    <div data-body></div>`;

  const ctx = await loadContext();
  let school = ctx.profile.school;
  const eaten = sumTotals(await getEntries(date));
  const left = remaining(ctx.plan, eaten);

  root.querySelectorAll('input[name=meal]').forEach((r) => r.addEventListener('change', () => { meal = r.value; if (tab === 'quick' || tab === 'picks') draw(); }));
  const body = root.querySelector('[data-body]');
  const searchBox = root.querySelector('[data-search]');
  const search = searchBox.querySelector('input');
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); draw(); });
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; lastTab = tab; draw(); }));

  const afterLog = (food) => {
    toast(`Added ${food.name} to ${mealLabel(meal)}`);
    location.hash = back;
  };

  root.querySelector('[data-scan]').addEventListener('click', () => scanSheet({
    onFood: (food) => servingsSheet(food, meal, date, afterLog, () => draw()),
    onMissing: (code, partial) => foodFormSheet(
      { name: '', serving: '', per: {}, ...(partial || {}), barcode: code, source: 'barcode', id: undefined },
      (food, andLog) => { if (food && andLog) servingsSheet(food, meal, date, afterLog); else draw(); },
      { isNew: true, note: partial ? 'Found this product, but it has no calorie info. Fill it in from the label.' : "This barcode isn't in the free database yet. Add it from the label and it'll be saved for next time." }
    )
  }));

  async function draw() {
    root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    searchBox.hidden = tab === 'quick' || tab === 'dining' || tab === 'picks';

    if (tab === 'quick') { drawQuick(); return; }
    if (tab === 'picks') { drawPicks(); return; }
    if (tab === 'dining') { drawDining(); return; }

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
              <div class="sub">${esc(f.serving || '1 serving')} · ${macroLine(f.per)}${f.source === 'quick' ? ' · quick add' : f.source === 'menu' ? ` · ${esc(schoolInfo(f.school || 'purdue')?.name || '')} dining` : ''}</div></div>
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

  // ---- Campus dining ----
  const dining = { court: null, date: null, meal: null, query: '', school: null };
  const courtKey = () => (school === 'purdue' ? 'fuel-court' : `fuel-court-${school}`);

  // Ask for a school when none is set. Saved to the profile, same as height and weight.
  function schoolPicker(onPicked) {
    body.innerHTML = `<div class="card"><h3>Which school's dining menus?</h3>
      <p class="small muted" style="margin:4px 0 0">Saved to your profile. You can change it in Settings.</p>
      <div class="school-pick">${SCHOOLS.map((x) => `<button class="btn block" data-school="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>`;
    body.querySelectorAll('[data-school]').forEach((b) => b.addEventListener('click', async () => {
      school = b.dataset.school;
      const profile = await getProfile();
      await saveProfile({ ...profile, school });
      onPicked();
    }));
  }

  async function drawDining() {
    const info = schoolInfo(school);
    if (!info) {
      if (school === 'none') {
        body.innerHTML = `<div class="card empty"><h3>No campus menus</h3><p class="small">Dining menus are available for ${SCHOOLS.map((x) => esc(x.name)).join(' and ')}. Change your school in <a href="#/settings">Settings</a> to see them.</p></div>`;
      } else schoolPicker(drawDining);
      return;
    }
    if (dining.school !== school) {
      dining.school = school;
      dining.court = null;
      try { dining.court = localStorage.getItem(courtKey()); } catch (e) { /* ignore */ }
    }
    if (!menuCached(school)) body.innerHTML = '<div class="empty small">Loading menus…</div>';
    let menu;
    try { menu = await loadMenu(school); } catch (e) {
      body.innerHTML = `<div class="card empty"><h3>Menus unavailable</h3><p class="small">${esc(e.message)} Menus load once you've been online after the morning update.</p></div>`;
      return;
    }
    if (tab !== 'dining') return;
    // Hide past days unless you're logging for that day.
    const dates = menu.dates.filter((d) => (d >= today() || d === date) && menu.courts.some((c) => menu.menus[c]?.[d]));
    if (!dates.length) { body.innerHTML = '<div class="card empty"><h3>No menus posted</h3><p class="small">Check back after tomorrow morning\'s update.</p></div>'; return; }
    if (!dining.date || !dates.includes(dining.date)) dining.date = dates.includes(date) ? date : dates[0];
    const courts = menu.courts.filter((c) => menu.menus[c]?.[dining.date]);
    if (!courts.includes(dining.court)) dining.court = courts[0];
    const meals = menu.menus[dining.court]?.[dining.date] || [];
    if (!meals.some((m) => m.name === dining.meal)) dining.meal = matchMeal(meals, meal);

    const q = dining.query.toLowerCase();
    const row = (id, court, where) => {
      const it = menu.items[id];
      if (!it) return '';
      const ok = hasNutrition(it);
      return `<button class="food-row" data-menu-item="${esc(id)}" ${ok ? '' : 'disabled'}>
        <div class="grow"><div class="name">${esc(it.name)}${it.vegan ? ' <span class="tag">VG</span>' : it.veg ? ' <span class="tag">V</span>' : ''}</div>
          <div class="sub">${where ? esc(where) + ' · ' : ''}${ok ? `${esc(it.serving || '1 serving')} · ${macroLine(it)}` : 'No nutrition info posted'}</div></div>
        <div class="kcal">${ok ? n0(it.kcal) : '–'}</div></button>`;
    };

    let list;
    if (q) {
      // Search every court and meal on the selected day.
      const hits = [];
      const seen = new Set();
      for (const c of courts) for (const m of menu.menus[c][dining.date]) for (const st of m.stations) for (const id of st.items) {
        const it = menu.items[id];
        const key = c + id;
        if (it && !seen.has(key) && (it.name.toLowerCase().includes(q) || st.name.toLowerCase().includes(q))) {
          seen.add(key);
          hits.push(row(id, c, `${c} · ${m.name} · ${st.name}`));
        }
      }
      list = hits.length ? `<div class="card">${hits.join('')}</div>` : '<div class="card empty small">Nothing matches on this day.</div>';
    } else {
      const m = meals.find((x) => x.name === dining.meal);
      const picks = m ? diningPicks(menu, dining.court, m) : '';
      list = picks + (m ? m.stations.map((st) => `<div class="card"><h3>${esc(st.name)}</h3>${st.items.map((id) => row(id)).join('')}</div>`).join('')
        : '<div class="card empty small">No meals posted here.</div>');
    }

    const dayChip = (d) => `<button type="button" class="chip ${d === dining.date ? 'on' : ''}" data-ddate="${d}">${esc(dayLabel(d))}</button>`;
    body.innerHTML = `
      <div class="chips" style="margin-top:8px">${dates.map(dayChip).join('')}</div>
      <div class="chips">${courts.map((c) => `<button type="button" class="chip ${c === dining.court ? 'on' : ''}" data-dcourt="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div style="margin-top:10px"><input type="search" data-dsearch placeholder="Search all ${esc(info.places)}" value="${esc(dining.query)}" autocomplete="off" enterkeyhint="search"></div>
      ${q ? '' : `<div class="chips">${meals.map((m) => `<button type="button" class="chip ${m.name === dining.meal ? 'on' : ''}" data-dmeal="${esc(m.name)}">${esc(m.name)}${m.start ? ` <span class="muted small">${fmtTime(m.start)}–${fmtTime(m.end)}</span>` : ''}</button>`).join('')}</div>`}
      ${list}
      <p class="small muted" style="text-align:center">Menus from ${esc(info.dining)}, updated ${esc(new Date(menu.generated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}.</p>`;

    body.querySelectorAll('[data-ddate]').forEach((b) => b.addEventListener('click', () => { dining.date = b.dataset.ddate; drawDining(); }));
    body.querySelectorAll('[data-dcourt]').forEach((b) => b.addEventListener('click', () => {
      dining.court = b.dataset.dcourt;
      try { localStorage.setItem(courtKey(), dining.court); } catch (e) { /* ignore */ }
      drawDining();
    }));
    body.querySelectorAll('[data-dmeal]').forEach((b) => b.addEventListener('click', () => { dining.meal = b.dataset.dmeal; drawDining(); }));
    const ds = body.querySelector('[data-dsearch]');
    ds.addEventListener('input', () => {
      dining.query = ds.value.trim();
      const pos = ds.selectionStart;
      drawDining().then(() => { const n = body.querySelector('[data-dsearch]'); n?.focus(); n?.setSelectionRange(pos, pos); });
    });
    body.querySelectorAll('[data-menu-item]').forEach((b) => b.addEventListener('click', async () => {
      const food = await foodFromMenuItem(b.dataset.menuItem, menu.items[b.dataset.menuItem], school);
      servingsSheet(food, meal, date, afterLog, () => drawDining());
    }));
    wirePlate(body, menu);
  }

  // Top picks and a suggested plate for one dining location's meal.
  function diningPicks(menu, court, m) {
    const budget = mealBudget(left, meal);
    if (budget.dayKcal < 30) return '';
    const cands = [];
    for (const st of m.stations) for (const id of st.items) {
      const it = menu.items[id];
      if (hasNutrition(it)) cands.push({ key: id, name: it.name, per: it, court, station: st.name, veg: it.veg, vegan: it.vegan });
    }
    const top = rank(cands, budget, 3);
    if (!top.length) return '';
    const plate = buildPlate(cands, budget);
    return `<div class="card"><h3>Best picks here</h3>
      <p class="small muted" style="margin:2px 0 0">For about ${n0(budget.kcal)} kcal of the ${n0(budget.dayKcal)} you have left.</p>
      ${top.map((p) => pickRow(p, p.station)).join('')}
      ${plate.items.length > 1 ? `<details><summary>Build a plate</summary>${plateHtml(plate)}</details>` : ''}</div>`;
  }

  // ---- Best picks: what fills your remaining macros without going over ----
  async function drawPicks() {
    const budget = mealBudget(left, meal);
    const need = (v) => n0(Math.max(0, v));
    const head = `<div class="card"><h3>Best picks for ${esc(mealLabel(meal))}</h3>
      <p class="small muted" style="margin:4px 0 0">${n0(Math.max(0, left.kcal))} kcal left ${date === today() ? 'today' : 'that day'}. Still to go: protein ${need(left.protein)}g · carbs ${need(left.carbs)}g · fat ${need(left.fat)}g.</p>
      ${budget.dayKcal >= 30 ? `<p class="small muted" style="margin:4px 0 0">Ranked for about ${n0(budget.kcal)} kcal at this meal, favoring protein, fiber and less sodium and sugar. Nothing here puts you over.</p>` : ''}</div>`;
    if (budget.dayKcal < 30) {
      body.innerHTML = head + '<div class="card empty"><h3>You\'ve hit your calories</h3><p class="small">Anything more goes over your target. Water, black coffee, tea or plain veggies are the safest bets.</p></div>';
      return;
    }
    body.innerHTML = head + '<div class="empty small">Finding picks…</div>';

    let diningHtml = '';
    let menu = null;
    const info = schoolInfo(school);
    if (info) {
      try { menu = await loadMenu(school); } catch (e) { menu = null; }
    }
    if (tab !== 'picks') return;
    if (menu && menu.dates.includes(date)) {
      const cands = menuCandidates(menu, date, (meals) => strictMeal(meals, meal));
      const top = rank(cands, budget, 6);
      // Suggest a plate from the location with the best combination.
      let plate = null;
      for (const court of new Set(cands.map((c) => c.court))) {
        const p = buildPlate(cands.filter((c) => c.court === court), budget);
        const score = p.items.reduce((sum, x) => sum + x.score, 0);
        if (p.items.length > 1 && (!plate || score > plate.score)) plate = { ...p, score, court };
      }
      diningHtml = top.length ? `<div class="section-title">${esc(info.name)} dining</div>
        <div class="card">${top.map((p) => pickRow(p, `${p.court} · ${p.station}`)).join('')}</div>
        ${plate ? `<div class="card"><h3>Suggested plate at ${esc(plate.court)}</h3>${plateHtml(plate)}</div>` : ''}`
        : `<div class="card empty small">Nothing on today's ${esc(info.name)} menus fits what you have left.</div>`;
    } else if (!info && school !== 'none') {
      diningHtml = '<div class="card empty small">Pick your school on the Dining tab to include campus menus.</div>';
    }

    const saved = (await db.foods.toArray()).filter((f) => f.source !== 'quick' && f.source !== 'menu');
    const mine = rank(saved.map((f) => ({ key: `f${f.id}`, name: f.name, per: f.per, food: f })), budget, 5);
    const mineHtml = `<div class="section-title">Your foods</div>${mine.length
      ? `<div class="card">${mine.map((p) => pickRow(p, p.food.serving || '1 serving')).join('')}</div>`
      : '<div class="card empty small">Save or scan foods and the ones that fit will show up here.</div>'}`;

    body.innerHTML = head + diningHtml + mineHtml;
    body.querySelectorAll('[data-pick-food]').forEach((b) => b.addEventListener('click', () => {
      const p = mine.find((x) => x.key === b.dataset.pickFood);
      servingsSheet(p.food, meal, date, afterLog, () => drawPicks());
    }));
    body.querySelectorAll('[data-menu-item]').forEach((b) => b.addEventListener('click', async () => {
      const food = await foodFromMenuItem(b.dataset.menuItem, menu.items[b.dataset.menuItem], school);
      servingsSheet(food, meal, date, afterLog, () => drawPicks());
    }));
    if (menu) wirePlate(body, menu);
  }

  function pickRow(p, where) {
    const attr = p.food ? `data-pick-food="${esc(p.key)}"` : `data-menu-item="${esc(p.key)}"`;
    const t = [...p.tags.map((x) => `<span class="tag ${x.good ? '' : 'warn'}">${esc(x.text)}</span>`),
      p.vegan ? '<span class="tag">VG</span>' : p.veg ? '<span class="tag">V</span>' : ''].join('');
    return `<button class="food-row" ${attr}>
      <div class="grow"><div class="name">${esc(p.name)}</div>
        <div class="sub">${where ? esc(where) + ' · ' : ''}${macroLine(p.per)}</div>
        ${t ? `<div class="tags">${t}</div>` : ''}</div>
      <div class="kcal">${n0(p.per.kcal)}</div></button>`;
  }

  function plateHtml(plate) {
    const t = plate.total;
    return `${plate.items.map((p) => `<div class="row between small" style="padding:6px 0"><span>${esc(p.name)}</span><span class="num muted">${n0(p.per.kcal)}</span></div>`).join('')}
      <div class="plate-total small"><span>${n0(t.kcal)} kcal</span><span class="num">${macroLine(t)}</span></div>
      <button class="btn primary block" data-log-plate="${esc(plate.items.map((p) => p.key).join('|'))}" style="margin-top:8px">Add all to ${esc(mealLabel(meal))}</button>`;
  }

  function wirePlate(el, menu) {
    el.querySelectorAll('[data-log-plate]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const ids = b.dataset.logPlate.split('|');
      for (const id of ids) {
        const food = await foodFromMenuItem(id, menu.items[id], school);
        await logFood(food, { date, meal, servings: 1 });
      }
      toast(`Added ${ids.length} items to ${mealLabel(meal)}`);
      location.hash = back;
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
  const editable = food.source === 'custom' || food.source === 'barcode';
  const { el, close } = openSheet(`
    <form novalidate>
      <div class="row between"><h2 class="grow">${esc(food.name)}</h2>${editable ? '<button type="button" class="link-btn" data-edit>Edit</button>' : ''}</div>
      <p class="small muted" style="margin:0 0 8px">${esc(food.serving || '1 serving')} · ${n0(food.per.kcal)} kcal per serving</p>
      ${food.source === 'menu' ? `<p class="small muted" style="margin:0 0 8px">Nutrition from ${esc(schoolInfo(food.school || 'purdue')?.dining || 'the dining hall')}.</p>` : ''}
      ${food.source === 'barcode' ? '<p class="small muted" style="margin:0 0 8px">Scanned food. Nutrition comes from Open Food Facts, so give it a quick check against the label (tap Edit to fix).</p>' : ''}
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
// opts.isNew: treat a prefilled food (e.g. from a barcode) as a new one.
function foodFormSheet(food, onSaved, opts = {}) {
  const f = food || { name: '', serving: '', per: {}, favorite: 0 };
  const isEdit = Boolean(food && food.id) && !opts.isNew;
  const { el, close } = openSheet(`
    <form novalidate>
      <h2>${isEdit ? 'Edit food' : 'New custom food'}</h2>
      ${opts.note ? `<div class="notice info">${esc(opts.note)}</div>` : ''}
      ${f.barcode ? `<p class="small muted" style="margin:4px 0 0">Barcode ${esc(f.barcode)}</p>` : ''}
      <label class="field"><span>Name</span><input type="text" name="name" value="${esc(f.name)}" placeholder="Greek yogurt" autocomplete="off"></label>
      <label class="field"><span>Serving size</span><input type="text" name="serving" value="${esc(f.serving)}" placeholder="1 cup (227 g)" autocomplete="off">
        <div class="hint">Enter the nutrition for one serving.</div></label>
      ${nutrientFields(f.per, false)}
      <details ${OPTIONAL.some((n) => f.per[n.key] != null) ? 'open' : ''}><summary>More nutrients</summary>${nutrientFields(f.per, true)}</details>
      <label class="row" style="min-height:44px"><input type="checkbox" name="favorite" style="width:22px;height:22px" ${f.favorite ? 'checked' : ''}> Favorite</label>
      <div class="error" data-error></div>
      <div class="nav-row">
        ${isEdit ? '<button type="button" class="btn danger" data-delete>Delete</button><button class="btn primary" type="submit">Save</button>'
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
    const row = { ...f, name, serving: form.serving.value.trim(), per: per.values, source: f.barcode ? 'barcode' : 'custom', favorite: form.favorite.checked ? 1 : 0 };
    if (!row.id) delete row.id;
    row.id = await saveFood(row);
    close();
    toast(isEdit ? 'Food updated' : 'Food saved');
    onSaved(row, e.submitter?.hasAttribute('data-and-log'));
  });
  el.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${f.name}? Days you already logged keep their entries.`)) return;
    await deleteFood(f.id);
    close();
    onSaved(null, false);
  });
}

// ---- Barcode scanning ----

const CAMERA_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8"/></svg>';

function scanSheet({ onFood, onMissing }) {
  let stop = () => {};
  const { el, close } = openSheet(`
    <h2>Scan barcode</h2>
    <div class="scan-view"><video playsinline muted autoplay></video><div class="scan-frame"></div></div>
    <p class="small muted" data-status style="margin:10px 0 0">Starting camera…</p>
    <form class="row" data-manual style="margin-top:12px" novalidate>
      <input type="text" inputmode="numeric" name="code" placeholder="Or type the barcode number" autocomplete="off" class="grow">
      <button class="btn" type="submit">Look up</button>
    </form>
    <button type="button" class="btn block" data-close style="margin-top:12px">Cancel</button>`, { onClose: () => stop() });

  const status = el.querySelector('[data-status]');
  const setStatus = (text) => { status.textContent = text; };
  let busy = false;

  const handle = async (code) => {
    if (busy) return;
    busy = true;
    stop();
    setStatus(`Looking up ${cleanCode(code)}…`);
    const r = await lookupBarcode(code);
    busy = false;
    if (r.error) { setStatus(r.error); return; }
    close();
    if (r.notFound) { onMissing(cleanCode(code), r.partial); return; }
    let food = r.food;
    if (!r.saved) {
      // Save scanned products so re-scanning works offline and they show up in My foods.
      food = { ...food, favorite: 0, uses: 0, lastUsed: 0 };
      food.id = await saveFood(food);
    }
    onFood(food);
  };

  el.querySelector('[data-manual]').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = e.target.code.value;
    if (cleanCode(code).length < 6) { setStatus('Enter the numbers under the barcode.'); return; }
    handle(code);
  });

  const video = el.querySelector('video');
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("This browser can't open the camera. Type the barcode number instead.");
    return;
  }
  startScanner(video, handle)
    .then((s) => {
      stop = s;
      if (!busy) setStatus('Point the camera at the barcode.');
      if (!document.body.contains(el)) s();
    })
    .catch((err) => {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setStatus(denied
        ? 'Camera access was blocked. Allow it when asked, or type the barcode number below.'
        : (err && err.message) || 'Could not start the camera. Type the barcode number below.');
    });
}

function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const hr = ((h + 11) % 12) + 1;
  return `${hr}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'a' : 'p'}`;
}
