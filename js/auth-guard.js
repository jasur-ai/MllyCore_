window.MLLYCORE_AUTH_READY = (async () => {
  try {
    return await window.MllyCore.requireAuth();
  } catch (error) {
    console.error(error);
    location.href = 'login.html';
    return null;
  }
})();
