(function initTheme() {
  const storageKey = 'mllycore-theme';

  function apply(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(nextTheme === 'light' ? 'theme-light' : 'theme-dark');
    localStorage.setItem(storageKey, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.querySelectorAll('[data-theme-toggle]').forEach((node) => {
      const nextTitle = nextTheme === 'light' ? 'Dark mode' : 'Light mode';
      node.setAttribute('title', nextTitle);
      node.setAttribute('aria-label', nextTitle);
    });
  }

  window.MllyCoreTheme = {
    apply,
    toggle() {
      const current = localStorage.getItem(storageKey) || 'dark';
      apply(current === 'dark' ? 'light' : 'dark');
    }
  };

  const saved = localStorage.getItem(storageKey) || 'dark';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply(saved), { once: true });
  } else {
    apply(saved);
  }
})();
