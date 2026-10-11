// "Meals today" picker, stored per day. Recommendations split what's left across these meals.
import { setMealCount } from '../db.js';

export function mealCountHtml(n, label = 'Meals today') {
  return `<div class="meal-count"><span class="small"><b>${label}</b></span>
    <div class="chips">${[1, 2, 3, 4, 5, 6].map((v) => `<button type="button" class="chip ${v === n ? 'on' : ''}" data-meals="${v}" aria-label="${v} meals">${v}</button>`).join('')}</div></div>`;
}

export function wireMealCount(root, date, onChange) {
  root.querySelectorAll('[data-meals]').forEach((b) => b.addEventListener('click', async () => {
    const n = Number(b.dataset.meals);
    await setMealCount(date, n);
    onChange(n);
  }));
}
