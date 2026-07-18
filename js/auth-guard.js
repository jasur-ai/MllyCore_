// FIX (file:// protocol): file:// da Firebase import qilib bo'lmaydi (CORS/module).
// Shuning uchun auth-required sahifalar login.html ga redirect qilinadi.
// Ammo index.html (landing) va login/register sahifalarida auth-required emas.
(async function authGuard() {
  const isFileProtocol = location.protocol === 'file:';
  if (isFileProtocol && !document.documentElement.classList.contains('auth-required')) {
    // Landing page yoki auth page → SW bo'lmasa ham ishlaydi
    window.MLLYCORE_FIREBASE_ENABLED = false;
    window.MLLYCORE_AUTH_READY = Promise.resolve(null);
    document.documentElement.classList.add('auth-ready');
    return;
  }
  if (isFileProtocol && document.documentElement.classList.contains('auth-required')) {
    // Auth talab qiladigan sahifa file:// da → Firebase import qilib bo'lmaydi
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#080b12;color:#e6edf3;font-family:sans-serif;text-align:center;padding:20px"><div><h1 style="font-size:24px;margin-bottom:12px">&#9888; Local mode</h1><p style="color:#8b949e">Bu sahifa ishlashi uchun HTTP server kerak.<br><code style="background:#1c2128;padding:8px 12px;border-radius:8px;display:inline-block;margin-top:12px">cd MllyCore && python3 -m http.server 8080</code></p></div></div>';
    window.MLLYCORE_AUTH_READY = Promise.resolve(null);
    return;
  }
  window.MLLYCORE_AUTH_READY = (async () => {
    try {
      // FIX (safety hang protection): 15 soniya ichida auth javob bermasa, 
      // yuklanmoqda holatini majburan tugatamiz va login'ga qaytaramiz.
      const authResult = await Promise.race([
        window.MllyCore.requireAuth(),
        new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 15000))
      ]);
      
      if (authResult === 'TIMEOUT') {
        console.warn('Auth guard timeout: login sahifasiga yo\'naltirilmoqda.');
        const currentPage = location.pathname.split('/').pop() || 'index.html';
        if (currentPage !== 'login.html' && currentPage !== 'register.html') {
          location.href = 'login.html';
        }
        return null;
      }
      return authResult;
    } catch (error) {
      console.error(error);
      // FIX (redirect loop): Agar allaqachon login.html da bo'lsak, yana redirect
      // qilish loopga olib keladi. Faqat boshqa sahifalarda redirect qilamiz.
      const currentPage = location.pathname.split('/').pop() || 'index.html';
      if (currentPage !== 'login.html' && currentPage !== 'register.html') {
        location.href = 'login.html';
      }
      return null;
    }
  })();
})();
