/* ============================================================
   VITREAPLAS — ortak kabuk
   · nav'daki profil ve sepet simgeleri
   · profil menüsü (giriş yapılmışsa Profilim / Siparişlerim / Çıkış,
     yapılmamışsa Üye ol / Giriş yap)
   · sağ altta sabit WhatsApp düğmesi
   ============================================================ */
(function () {
  'use strict';
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var WA_TEL = '905348433188';
  var TOKEN  = 'vitrea_user_token';

  /* ---------------- simgeler ---------------- */
  var IKON = {
    profil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<circle cx="12" cy="8" r="3.6"/><path d="M4.6 20a7.4 7.4 0 0 1 14.8 0"/></svg>',
    sepet:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M4 7h16l-1.3 11.2a2 2 0 0 1-2 1.8H7.3a2 2 0 0 1-2-1.8z"/>' +
            '<path d="M8.6 7V5.6a3.4 3.4 0 0 1 6.8 0V7"/></svg>',
    wa:     '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">' +
            '<path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.9 1 4 1.6 6.2 1.6' +
            ' 7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.6c-2 0-3.9-.5-5.5-1.5l-.4-.2-4 1.1 1.1-3.9-.3-.4' +
            'A10.5 10.5 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0' +
            'a8.6 8.6 0 0 1-2.5-1.6 9.6 9.6 0 0 1-1.8-2.2c-.2-.3 0-.5.1-.7l.5-.6.3-.5v-.5l-1-2.4' +
            'c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8s1.2 3.3 1.4 3.5' +
            'c.2.2 2.4 3.7 5.9 5.1 2.9 1.2 3.5 1 4.1.9.6-.1 1.9-.8 2.2-1.6s.3-1.4.2-1.6z"/></svg>'
  };

  function girisliMi() { return !!localStorage.getItem(TOKEN); }

  /* ---------------- nav sağ taraf ---------------- */
  function navKur() {
    var sag = $('.nav__right');
    if (!sag || $('#navProfil')) return;

    var sepetEski = $('.nav__sepet', sag);
    var simdiSepet = sepetEski && sepetEski.classList.contains('is-now');
    if (sepetEski) sepetEski.remove();
    var hesapEski = $('.nav__lnk', sag);
    var simdiHesap = hesapEski && hesapEski.classList.contains('is-now');
    if (hesapEski) hesapEski.remove();

    var kutu = document.createElement('div');
    kutu.className = 'navik';
    kutu.innerHTML =
      '<div class="navik__sar srv-only">' +
        '<button class="navik__b' + (simdiHesap ? ' is-now' : '') + '" id="navProfil" ' +
          'aria-label="Hesap" aria-haspopup="true" aria-expanded="false">' + IKON.profil +
          '<b class="navik__nokta" id="navGirisNokta" hidden></b></button>' +
        '<div class="navmen" id="navMenu" hidden role="menu"></div>' +
      '</div>' +
      '<a class="navik__b' + (simdiSepet ? ' is-now' : '') + '" href="sepet.html" aria-label="Sepet">' +
        IKON.sepet + '<b class="navik__say" data-sepet-say hidden>0</b></a>';
    sag.insertBefore(kutu, sag.firstChild);

    menuYaz();
    $('#navProfil').addEventListener('click', function (e) {
      e.stopPropagation();
      var m = $('#navMenu');
      var acik = !m.hidden;
      m.hidden = acik;
      this.setAttribute('aria-expanded', String(!acik));
      if (!acik) menuYaz();
    });
    document.addEventListener('click', function (e) {
      var m = $('#navMenu');
      if (m && !m.hidden && !e.target.closest('.navik__sar')) {
        m.hidden = true;
        $('#navProfil').setAttribute('aria-expanded', 'false');
      }
    });
  }

  function menuYaz() {
    var m = $('#navMenu');
    if (!m) return;
    if (girisliMi()) {
      m.innerHTML =
        '<span class="navmen__ad" id="navMenuAd">Hesabım</span>' +
        '<a href="hesap.html" role="menuitem">Profilim</a>' +
        '<a href="hesap.html#siparisler" role="menuitem">Siparişlerim</a>' +
        '<a href="sepet.html" role="menuitem">Sepetim</a>' +
        '<button type="button" id="navCikis" role="menuitem">Çıkış yap</button>';
      $('#navCikis').addEventListener('click', function () {
        localStorage.removeItem(TOKEN);
        menuYaz(); noktaTazele();
        location.href = 'hesap.html';
      });
      adTazele();
    } else {
      m.innerHTML =
        '<span class="navmen__ad">Hesabınız yok mu?</span>' +
        '<a href="hesap.html?mod=register" role="menuitem" class="navmen__vur">Üye ol</a>' +
        '<a href="hesap.html" role="menuitem">Giriş yap</a>' +
        '<a href="hesap.html#takip" role="menuitem">Sipariş takibi</a>';
    }
    noktaTazele();
  }

  function noktaTazele() {
    var n = $('#navGirisNokta');
    if (n) n.hidden = !girisliMi();
  }

  function adTazele() {
    if (!girisliMi() || !window.VP_SUNUCU) return;
    fetch('api/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem(TOKEN) } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var el = $('#navMenuAd');
        if (j && j.ad && el) el.textContent = j.ad;
        if (!j) { localStorage.removeItem(TOKEN); menuYaz(); }
      }).catch(function () {});
  }

  /* ---------------- sabit WhatsApp düğmesi ---------------- */
  function waKur() {
    if ($('#waFab')) return;
    var a = document.createElement('a');
    a.id = 'waFab';
    a.className = 'wafab';
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', "WhatsApp'tan yazın");
    a.href = 'https://wa.me/' + WA_TEL + '?text=' + encodeURIComponent(
      'Merhaba, VITREAPLAS ambalajları hakkında bilgi almak istiyorum.');
    a.innerHTML = IKON.wa + '<span>WhatsApp</span>';
    document.body.appendChild(a);
  }

  document.addEventListener('ortam:belli', function () { menuYaz(); });
  document.addEventListener('oturum:degisti', function () { menuYaz(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { navKur(); waKur(); });
  } else { navKur(); waKur(); }
})();
