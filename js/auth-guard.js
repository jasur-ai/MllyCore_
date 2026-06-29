(async () => {
  try {
    await window.MllyCore.requireAuth();
  } catch (error) {
    console.error(error);
    location.href = 'login.html';
  }
})();
