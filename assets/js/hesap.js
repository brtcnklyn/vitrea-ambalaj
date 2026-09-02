/* ============================================================
   VITREAPLAS — hesap sayfasi: giris / kayit / siparislerim / takip
   Sunucu yoksa (GitHub Pages) uyelik gizlenir, WhatsApp'a yonlendirir.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  if (!$('#hesapPanel')) return;

  var TOKEN = 'vitrea_user_token';
  /* ?mod=register ile gelinirse dogrudan "Hesap ac" sekmesi acilir */
  var mod = /(\?|&)mod=register/.test(location.search) ? 'register' : 'login';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function tl(x) {
    return (x || 0).toLocaleString('tr-TR',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  }
  function tarih(iso) {
    try { return new Date(iso).toLocaleDateString('tr-TR',
      { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { return iso; }
  }

  var DURUMLAR = ['Alındı', 'Hazırlanıyor', 'Kargoda', 'Teslim edildi'];

  function siparisHTML(s) {
    var i = DURUMLAR.indexOf(s.durum);
    var iptal = s.durum === 'İptal';
    var adim = DURUMLAR.map(function (d, n) {
      return '<li class="' + (iptal ? '' : (n <= i ? 'is-on' : '')) + '"><span></span>' + d + '</li>';
    }).join('');
    return '<article class="sip">' +
      '<header class="sip__ust">' +
        '<div><b>' + esc(s.no) + '</b><time>' + tarih(s.tarih) + '</time></div>' +
        '<span class="sip__durum' + (iptal ? ' is-iptal' : '') + '">' + esc(s.durum) + '</span>' +
      '</header>' +
      (iptal ? '' : '<ol class="sip__adim">' + adim + '</ol>') +
      (s.kargo ? '<p class="sip__kargo">Kargo: <b>' + esc(s.kargo) + '</b></p>' : '') +
      '<ul class="sip__kalem">' + s.kalemler.map(function (k) {
        return '<li><span>' + esc(k.ad) + ' <i>' + esc(k.kod) + ' · ' + k.vol + ' cc</i></span>' +
               '<span>' + k.adet + ' × ' + tl(k.birim) + '</span>' +
               '<b>' + tl(k.tutar) + '</b></li>';
      }).join('') + '</ul>' +
      '<footer class="sip__alt">' +
        '<span>Ara toplam ' + tl(s.araToplam) + ' · KDV ' + tl(s.kdvTutar) + '</span>' +
        '<b>' + tl(s.toplam) + '</b>' +
      '</footer>' +
    '</article>';
  }

  /* ---------------- oturum ---------------- */
  function token() { return localStorage.getItem(TOKEN) || ''; }

  function goster(girisli) {
    $('#hesapGiris').hidden = girisli;
    $('#hesapPanel').hidden = !girisli;
  }

  function yukle() {
    var t = token();
    if (!t) { goster(false); return; }
    fetch('api/me', { headers: { Authorization: 'Bearer ' + t } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) { localStorage.removeItem(TOKEN); goster(false); return; }
        $('#hAd').textContent = j.ad || 'Hesabım';
        $('#hMail').textContent = j.email || '';
        goster(true);
        return fetch('api/siparislerim', { headers: { Authorization: 'Bearer ' + t } })
          .then(function (r) { return r.ok ? r.json() : { siparisler: [] }; })
          .then(function (d) {
            var l = d.siparisler || [];
            $('#hBos').hidden = l.length > 0;
            $('#hSiparisler').innerHTML = l.map(siparisHTML).join('');
            if (location.hash === '#siparisler') {
              $('.hesap__h3').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
      })
      .catch(function () { goster(false); });
  }

  /* acilista sekmeyi ve odagi ayarla */
  function sekmeYaz() {
    $$('#hTabs button').forEach(function (x) {
      x.classList.toggle('is-on', x.dataset.htab === mod);
    });
    $('#hAdAlan').hidden = mod !== 'register';
    $('#hForm').querySelector('button[type=submit]').textContent =
      mod === 'register' ? 'Hesap aç' : 'Giriş yap';
    var b = $('#hesapBaslik');
    if (b && mod === 'register' && !girisliMi()) b.textContent = 'Üye ol';
  }
  function girisliMi() { return !!localStorage.getItem(TOKEN); }

  /* sekmeler */
  $('#hTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-htab]');
    if (!b) return;
    $$('#hTabs button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
    mod = b.dataset.htab;
    $('#hAdAlan').hidden = mod !== 'register';
    $('#hForm').querySelector('button[type=submit]').textContent =
      mod === 'register' ? 'Hesap aç' : 'Giriş yap';
    $('#hNot').textContent = '';
  });

  $('#hForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, not = $('#hNot');
    var govde = {
      email: f.elements.email.value.trim(),
      password: f.elements.password.value
    };
    if (mod === 'register') govde.ad = f.elements.ad.value.trim();
    not.textContent = 'Gönderiliyor…';
    fetch(mod === 'register' ? 'api/register' : 'api/user/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || 'İşlem başarısız.');
        return j;
      });
    }).then(function (j) {
      localStorage.setItem(TOKEN, j.token);
      not.textContent = '';
      document.dispatchEvent(new CustomEvent('oturum:degisti'));
      yukle();
    }).catch(function (err) { not.textContent = err.message; });
  });

  $('#hCikis').addEventListener('click', function () {
    localStorage.removeItem(TOKEN);
    document.dispatchEvent(new CustomEvent('oturum:degisti'));
    goster(false);
  });

  /* ---------------- üyeliksiz sipariş takibi ---------------- */
  $('#takipForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, not = $('#takipNot'), kutu = $('#takipSonuc');
    kutu.innerHTML = '';
    not.textContent = 'Sorgulanıyor…';
    fetch('api/siparis-takip?no=' + encodeURIComponent(f.elements.no.value.trim()) +
          '&tel=' + encodeURIComponent(f.elements.tel.value.trim()))
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.error || 'Sipariş bulunamadı.');
          return j;
        });
      })
      .then(function (j) { not.textContent = ''; kutu.innerHTML = siparisHTML(j.siparis); })
      .catch(function (err) { not.textContent = err.message; });
  });

  /* ---------------- ortam ---------------- */
  document.addEventListener('ortam:belli', function (e) {
    $('#hesapKapali').hidden = e.detail.sunucu;
    if (e.detail.sunucu) { sekmeYaz(); yukle();
      if (location.hash === '#takip') {
        setTimeout(function () {
          var t = $('#takipForm');
          if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
      }
    }
    else { $('#hesapGiris').hidden = true; $('#hesapPanel').hidden = true; }
  });
  if (window.VP_SUNUCU) { $('#hesapKapali').hidden = true; sekmeYaz(); yukle(); }
})();
