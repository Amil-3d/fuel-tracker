// Small inline icons used on the Today screen. They inherit currentColor.
const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  flame: svg('<path d="M12 2.5c.6 3-1.2 4.6-2.6 6.2C8 10.3 7 11.9 7 14.2A5 5 0 0 0 17 14.3c0-2.2-1-3.7-2-5 .1 1.5-.5 2.6-1.6 3 .6-3.4-.4-6.9-1.4-9.8z" fill="currentColor"/>'),
  protein: svg('<path d="M15.6 3.2a5 5 0 0 1 3.3 8.5l-4.2 4.2-2.3.2-2.6 2.6a1.9 1.9 0 1 1-2.7-2.7l2.6-2.6.2-2.3 4.2-4.2a5 5 0 0 1 1.5-1.7z" fill="currentColor"/><circle cx="5.3" cy="18.7" r="1.6" fill="currentColor"/>'),
  carbs: svg('<path d="M12 21V8M12 12c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4zm0 0c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4zm0 4c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4zm0 0c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4zm0-8.5c-1.3-1-1.3-3.4 0-4.5 1.3 1.1 1.3 3.5 0 4.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
  fat: svg('<path d="M12 3c3 3.6 6 7.2 6 10.6A6 6 0 0 1 6 13.6C6 10.2 9 6.6 12 3z" fill="currentColor"/><circle cx="12" cy="14" r="2.2" fill="var(--surface)"/>'),
  check: svg('<path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  meal: {
    breakfast: svg('<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    lunch: svg('<path d="M4 11h16a8 8 0 0 1-16 0zM8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    dinner: svg('<path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z" fill="currentColor"/>'),
    snacks: svg('<path d="M12 7c-1-2.5-3.5-3-5-2M12 7c4.5-2 8 1.5 7 6.5S14.5 21 12 20c-2.5 1-6-1.5-7-6.5S7.5 5 12 7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
  }
};
