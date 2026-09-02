/* ============================================================
   VITREAPLAS — ortam tespiti
   Sunucu (node server.js) varsa uyelik ve siparis kaydi acilir.
   GitHub Pages'te sunucu yok: bu bolumler gizli kalir, siparis
   WhatsApp uzerinden ilerler.
   ============================================================ */
(function () {
  'use strict';
  window.VP_SUNUCU = false;

  function isaretle(varMi) {
    window.VP_SUNUCU = varMi;
    document.documentElement.classList.toggle('srv', varMi);
    document.documentElement.classList.add('srv-belli');
    document.dispatchEvent(new CustomEvent('ortam:belli', { detail: { sunucu: varMi } }));
  }

  var t = setTimeout(function () { isaretle(false); }, 2500);   // yanit yoksa statik say
  fetch('api/durum', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { clearTimeout(t); isaretle(!!(j && j.ok)); })
    .catch(function () { clearTimeout(t); isaretle(false); });
})();
