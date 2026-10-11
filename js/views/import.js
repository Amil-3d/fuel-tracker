// Import steps, active calories and weight from Apple Health (sent by the "Send to Fuel" Shortcut).
import { saveActivity } from '../db.js';
import { loadContext, logWeight } from '../state.js';
import { setTitle, esc, n0, today, toast, fmtDate } from '../ui.js';
import { fmtWeight } from '../units.js';
import { parseHealth } from '../health.js';

const LB = 0.45359237;

export async function renderImport(root, sub, params) {
  setTitle('Apple Health', '<a class="link-btn" href="#/today">Done</a>');
  const ctx = await loadContext();
  const units = ctx.units;
  // Opened from Safari with the data in the link?
  const fromLink = params && [...params.keys()].length ? parseHealth(params.toString()) : null;

  const draw = (data, note = '') => {
    if (!data) {
      root.innerHTML = `
        <div class="card stack">
          <h3>Bring in today's Apple Health numbers</h3>
          <p class="small muted" style="margin:0">Run your <b>Send to Fuel</b> Shortcut first. It copies your steps, active calories and latest weight. Then come back and tap Paste.</p>
          ${note ? `<div class="notice warn">${esc(note)}</div>` : ''}
          <button class="btn primary block" data-paste>Paste from Shortcut</button>
          <details><summary class="small">Paste it yourself instead</summary>
            <textarea rows="3" data-text placeholder="fuel: steps=8432; active=412; weight=180.4 lb" style="margin-top:8px"></textarea>
            <button class="btn block" data-use style="margin-top:8px">Use this text</button></details>
        </div>
        <p class="small muted" style="margin:0 4px">Don't have the Shortcut yet? <a href="https://github.com/Amil-3d/fuel-tracker/blob/main/SHORTCUT.md" target="_blank" rel="noopener">See the setup steps</a>.</p>`;
      root.querySelector('[data-paste]').addEventListener('click', async () => {
        let text = '';
        try { text = await navigator.clipboard.readText(); } catch (e) {
          draw(null, "Couldn't read the clipboard. Paste the text into the box below instead.");
          root.querySelector('details').open = true;
          return;
        }
        const parsed = parseHealth(text);
        if (parsed) draw(parsed); else draw(null, "The clipboard doesn't have Fuel data in it. Run the Shortcut again, then tap Paste.");
      });
      root.querySelector('[data-use]').addEventListener('click', () => {
        const parsed = parseHealth(root.querySelector('[data-text]').value);
        if (parsed) draw(parsed); else draw(null, "That text doesn't look like Fuel data.");
      });
      return;
    }

    const date = data.date && data.date <= today() ? data.date : today();
    const unit = data.weightUnit || (units === 'imperial' ? 'lb' : 'kg');
    const kg = data.weight ? (unit === 'lb' ? data.weight * LB : data.weight) : null;
    const weightOk = kg && kg >= 25 && kg <= 350;
    root.innerHTML = `
      <div class="card stack">
        <h3>Import for ${esc(date === today() ? 'today' : fmtDate(date))}</h3>
        <table class="totals-table">
          ${data.steps != null ? `<tr><td>Steps</td><td class="num">${n0(data.steps)}</td></tr>` : ''}
          ${data.activeKcal != null ? `<tr><td>Active calories</td><td class="num">${n0(data.activeKcal)} kcal</td></tr>` : ''}
          ${weightOk ? `<tr><td>Weight</td><td class="num">${fmtWeight(kg, units)}</td></tr>` : ''}
        </table>
        ${data.weight && !weightOk ? '<div class="notice warn">The weight looks off, so it will be skipped.</div>' : ''}
        ${weightOk ? `<label class="row small" style="min-height:44px"><input type="checkbox" data-w checked style="width:22px;height:22px"> Also log this weight (updates your targets)</label>` : ''}
        <p class="small muted" style="margin:0">Active calories are shown for reference. Your calorie target already includes your usual activity, so they aren't added to it.</p>
        <button class="btn primary block" data-save>Save</button>
      </div>`;
    root.querySelector('[data-save]').addEventListener('click', async () => {
      const values = {};
      if (data.steps != null) values.steps = data.steps;
      if (data.activeKcal != null) values.activeKcal = data.activeKcal;
      if (Object.keys(values).length) await saveActivity(date, values);
      let msg = 'Saved from Apple Health';
      if (weightOk && root.querySelector('[data-w]')?.checked) msg = (await logWeight(date, kg)).msg;
      toast(msg);
      location.hash = '#/today';
    });
  };

  draw(fromLink);
}
