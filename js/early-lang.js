// First-paint <html lang> — runtime updates still come from js/i18n.js setLang().
(function () {
  try {
    var supported = ['en', 'ro', 'hu'];
    var stored = localStorage.getItem('mt_lang');
    if (supported.indexOf(stored) !== -1) {
      document.documentElement.lang = stored;
      return;
    }
    var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    if (supported.indexOf(nav) !== -1) {
      document.documentElement.lang = nav;
    }
  } catch (e) { /* localStorage disabled — leave default lang="en" */ }
})();
