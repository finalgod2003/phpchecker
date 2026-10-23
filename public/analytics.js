window.plausible = window.plausible || function () {
  (window.plausible.q = window.plausible.q || []).push(arguments);
};
window.plausible.init = window.plausible.init || function (options) {
  window.plausible.o = options || {};
};
window.plausible.init();

window.dataLayer = window.dataLayer || [];
window.gtag = function () { window.dataLayer.push(arguments); };
window.gtag('js', new Date());
window.gtag('config', 'G-GTGG5Y7VCL', {
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
});
