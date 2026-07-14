(function initTheme() {
  var storageKey = 'mllycore-theme';

  function apply(theme) {
    var nextTheme = theme === 'light' ? 'light' : 'dark';
    var nextClass = nextTheme === 'light' ? 'theme-light' : 'theme-dark';

    // Current classni body dan real vaqtda o'qish (prevTheme ni nextTheme dan chiqarmaymiz!)
    var prevClass = document.body.classList.contains('theme-light') ? 'theme-light' : 'theme-dark';

    // Butun body dagi barcha CSS transition va animationlarni vaqtincha o'chirish
    document.body.classList.add('disable-transitions');

    // Bir atomik operatsiyada class almashtirish — hech qachon classsiz qolmaydi
    if (document.body.classList.contains(prevClass)) {
      document.body.classList.replace(prevClass, nextClass);
    } else {
      // Agar hech qanday theme class bo'lmasa (birinchi yuklanish)
      document.body.classList.add(nextClass);
    }

    // localStorage va dataset
    try { localStorage.setItem(storageKey, nextTheme); } catch (_) {}
    document.documentElement.dataset.theme = nextTheme;

    // Toggle tugmalarini yangilash
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      var nextTitle = nextTheme === 'light' ? 'Dark mode' : 'Light mode';
      toggles[i].setAttribute('title', nextTitle);
      toggles[i].setAttribute('aria-label', nextTitle);
    }

    // Transition'larni qayta yoqish (keyingi frame'da)
    requestAnimationFrame(function () {
      document.body.classList.remove('disable-transitions');
    });
  }

  window.MllyCoreTheme = {
    apply: apply,
    toggle: function () {
      var current = 'dark';
      try { current = localStorage.getItem(storageKey) || 'dark'; } catch (_) {}
      apply(current === 'dark' ? 'light' : 'dark');
    }
  };

  var saved = 'dark';
  try { saved = localStorage.getItem(storageKey) || 'dark'; } catch (_) {}
  apply(saved);
})();
