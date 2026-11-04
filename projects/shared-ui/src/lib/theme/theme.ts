/**
 * Light/dark theme: a `.dark` class on <html>, the user's choice saved under THEME_KEY.
 * With no saved choice the OS setting decides. Each app's index.html applies the same rule
 * in a small inline script before first paint (it can't import this file), so keep them in step.
 */
export const THEME_KEY = 'iotility-theme';

/** The saved choice, or null when the user hasn't picked one. */
export function savedTheme(): 'dark' | 'light' | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

/** Whether the app should be dark right now: the saved choice, otherwise the OS setting. */
export function prefersDarkTheme(): boolean {
  const saved = savedTheme();
  if (saved) return saved === 'dark';
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Applies a theme and, when `save` is set, remembers it as the user's choice. */
export function applyTheme(dark: boolean, save = false, root: HTMLElement = document.documentElement): void {
  root.classList.toggle('dark', dark);
  if (!save) return;
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}
