(function initTheme() {
  const storageKey = 'mllycore-theme';

  function apply(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(nextTheme === 'light' ? 'theme-light' : 'theme-dark');
    localStorage.setItem(storageKey, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.querySelectorAll('[data-theme-label]').forEach((node) => {
      node.textContent = nextTheme === 'light' ? 'Dark mode' : 'Light mode';
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
