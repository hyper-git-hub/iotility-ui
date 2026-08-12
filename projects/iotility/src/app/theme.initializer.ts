export function themeInitializer() {
  return () => {
    // Apply saved theme preference on startup
    // This runs after Angular bootstrap but before the first navigation
    const saved = localStorage.getItem('iotility-theme');
    const html = document.documentElement;
    if (saved === 'dark') {
      html.classList.add('dark');
    } else if (saved === 'light') {
      html.classList.remove('dark');
    } else {
      // Default to dark if no preference saved (matching PlatformHeader logic)
      html.classList.add('dark');
    }
  };
}