import { setTitle } from '../ui.js';

export function placeholder(title, phase, text) {
  return async (root) => {
    setTitle(title);
    root.innerHTML = `<div class="card empty"><h2>${title}</h2><p>${text}</p><p class="small">Coming in phase ${phase}.</p></div>`;
  };
}
