(function initTheme() {
  const storageKey = 'mllycore-theme';

  function apply(theme) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    const nextClass = nextTheme === 'light' ? 'theme-light' : 'theme-dark';

    // Current classni body dan real vaqtda o'qish (prevTheme ni nextTheme dan chiqarmaymiz!)
    const prevClass = document.body.classList.contains('theme-light') ? 'theme-light' : 'theme-dark';

    // CSS transition-larni vaqtincha o'chirish (chaqmoq/flash effektini oldini olish)
    document.documentElement.style.setProperty('transition', 'none');
    document.documentElement.style.setProperty('animation', 'none');

    // Bir atomik operatsiyada class almashtirish — hech qachon classsiz qolmaydi
    if (document.body.classList.contains(prevClass)) {
      document.body.classList.replace(prevClass, nextClass);
    } else {
      // Agar hech qanday theme class bo'lmasa (birinchi yuklanish)
      document.body.classList.add(nextClass);
    }

    // localStorage va dataset
    localStorage.setItem(storageKey, nextTheme);
    document.documentElement.dataset.theme = nextTheme;

    // Toggle tugmalarini yangilash
    document.querySelectorAll('[data-theme-toggle]').forEach((node) => {
      const nextTitle = nextTheme === 'light' ? 'Dark mode' : 'Light mode';
      node.setAttribute('title', nextTitle);
      node.setAttribute('aria-label', nextTitle);
    });

    // Transition'larni qayta yoqish (keyingi frame'da)
    requestAnimationFrame(() => {
      document.documentElement.style.removeProperty('transition');
      document.documentElement.style.removeProperty('animation');
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
  apply(saved);
})();
