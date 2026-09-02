/* ============================================================
   VITREAPLAS — sepet sayfasi ve siparis akisi
   Sunucu varsa siparis kaydedilir ve takip edilebilir; yoksa
   dogrudan WhatsApp mesajina donusur.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var S = window.SEPET;
  if (!S || !$('#sepetListe')) return;

  var TOKEN = 'vitrea_user_token';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  /* ---------------- liste ---------------- */
  function ciz() {
    var d = S.dokum();
    $('#sepetBos').hidden = d.kalem > 0;
    $('#sepetSag').hidden = d.kalem === 0;

    $('#sepetListe').innerHTML = d.satir.map(function (s) {
      return '<article class="skalem" data-id="' + esc(s.id) + '">' +
        '<a class="skalem__ph" href="urunler.html">' +
          '<img src="assets/img/urun/' + esc(s.img) + '.png" alt="' + esc(s.ad) + '" loading="lazy">' +
        '</a>' +
        '<div class="skalem__bilgi">' +
          '<span class="skalem__kod">' + esc(s.kod) + '</span>' +
          '<h3>' + esc(s.ad) + '</h3>' +
          '<p>' + s.vol + ' cc' + (s.box ? ' · koli ' + s.box + ' adet' : '') + '</p>' +
          (s.fiyatsiz
            ? '<p class="skalem__yok">Bu ürün için fiyat sorun</p>'
            : '<p class="skalem__birim">' + S.tl(s.birim) + ' <i>/ adet, KDV hariç</i></p>') +
        '</div>' +
        '<div class="skalem__adet">' +
          '<button data-ac="eksi" aria-label="Azalt">−</button>' +
          '<input type="number" min="1" value="' + s.adet + '" data-ac="adet" aria-label="Adet">' +
          '<button data-ac="arti" aria-label="Artır">+</button>' +
        '</div>' +
        '<div class="skalem__tutar">' +
          (s.fiyatsiz ? '—' : S.tl(s.tutar)) +
          '<button class="skalem__sil" data-ac="sil" aria-label="Kaldır">Kaldır</button>' +
        '</div>' +
      '</article>';
    }).join('');

    $('#ozAra').textContent = S.tl(d.araToplam);
    $('#ozKdv').textContent = S.tl(d.kdvTutar);
    $('#ozTop').textContent = S.tl(d.toplam);
    $('#ozKdvOran').textContent = d.kdvOran;
  }

  $('#sepetListe').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ac]');
    if (!b) return;
    var id = b.closest('.skalem').dataset.id;
    var mevcut = S.oku().filter(function (x) { return x.id === id; })[0];
    var adet = mevcut ? mevcut.adet : 0;
    var p = (window.VITREA_PRODUCTS || []).filter(function (x) { return x.id === id; })[0];
    var kademe = (p && p.box) ? p.box : 1;
    if (b.dataset.ac === 'arti') S.ayarla(id, adet + kademe);
    if (b.dataset.ac === 'eksi') S.ayarla(id, Math.max(0, adet - kademe));
    if (b.dataset.ac === 'sil')  S.cikar(id);
  });
  $('#sepetListe').addEventListener('change', function (e) {
    var i = e.target.closest('[data-ac="adet"]');
    if (!i) return;
    S.ayarla(i.closest('.skalem').dataset.id, i.value);
  });
  document.addEventListener('sepet:degisti', ciz);

  /* ---------------- adımlar ---------------- */
  function adim(n) {
    $('#adim1').hidden = n !== 1;
    $('#adim2').hidden = n !== 2;
    $('#adim3').hidden = n !== 3;
  }

  /* Uye girisliyse "uye ol / uye olmadan devam et" adimini hic gostermeyiz;
     dogrudan teslimat bilgilerine gecer ve alanlar hesaptan dolar. */
  function baslangicAdimi() {
    if (window.VP_SUNUCU && localStorage.getItem(TOKEN)) {
      adim(2); dolduranUye();
      var g = $('#geri');
      if (g) g.hidden = true;                 // geri donecek adim yok
    } else {
      adim(1);
    }
  }

  $('#secMisafir').addEventListener('click', function () { adim(2); });
  $('#geri').addEventListener('click', function () { adim(1); });

  var uyeBtn = $('#secUye');
  if (uyeBtn) {
    uyeBtn.addEventListener('click', function () {
      if (localStorage.getItem(TOKEN)) { adim(2); dolduranUye(); return; }
      /* main.js'teki hesap kutusunu ac; giris sonrasi form doldurulur */
      document.body.classList.add('acct-open');
      var a = $('#acct');
      if (a) a.setAttribute('aria-hidden', 'false');
    });
  }

  /* giris yapilmissa ad/e-posta alanlarini doldur */
  function dolduranUye() {
    var t = localStorage.getItem(TOKEN);
    if (!t) return;
    fetch('api/me', { headers: { Authorization: 'Bearer ' + t } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        var f = $('#adim2');
        if (j.ad && !f.elements.ad.value) f.elements.ad.value = j.ad;
        if (j.email && !f.elements.email.value) f.elements.email.value = j.email;
      }).catch(function () {});
  }
  document.addEventListener('ortam:belli', function () { baslangicAdimi(); });
  document.addEventListener('oturum:degisti', function () { baslangicAdimi(); });

  /* ---------------- sipariş gönder ---------------- */
  $('#adim2').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, not = $('#odemeNot');
    var bilgi = {
      ad: f.elements.ad.value.trim(),
      tel: f.elements.tel.value.trim(),
      firma: f.elements.firma.value.trim(),
      email: f.elements.email.value.trim(),
      adres: f.elements.adres.value.trim(),
      not: f.elements['not'].value.trim()
    };
    if (bilgi.ad.length < 2) { not.textContent = 'Ad Soyad girin.'; return; }
    if (bilgi.tel.replace(/\D/g, '').length < 10) { not.textContent = 'Geçerli bir telefon girin.'; return; }

    var d = S.dokum();
    if (!d.kalem) { not.textContent = 'Sepetiniz boş.'; return; }

    var btn = f.querySelector('.odeme__gonder');
    btn.disabled = true; btn.textContent = 'Gönderiliyor…';

    function bitir(no, sunucuya) {
      var metin = S.waMetni(d, Object.assign({ no: no }, bilgi));
      $('#sipNo').textContent = no || '—';
      $('#sipWa').href = 'https://wa.me/' + S.WA + '?text=' + encodeURIComponent(metin);
      $('#sipMesaj').textContent = sunucuya
        ? 'Siparişiniz kaydedildi. Ödeme ve teslimat için WhatsApp\'tan devam edelim.'
        : 'Siparişinizi WhatsApp üzerinden iletiyoruz; mesaj penceresinde “gönder”e basmanız yeterli.';
      S.temizle();
      adim(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try { window.open($('#sipWa').href, '_blank', 'noopener'); } catch (x) {}
    }

    if (!window.VP_SUNUCU) { bitir('', false); return; }

    var basliklar = { 'Content-Type': 'application/json' };
    var t = localStorage.getItem(TOKEN);
    if (t) basliklar.Authorization = 'Bearer ' + t;

    fetch('api/siparis', {
      method: 'POST', headers: basliklar,
      body: JSON.stringify(Object.assign({
        kalemler: S.oku().map(function (x) { return { id: x.id, adet: x.adet }; })
      }, bilgi))
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || 'Sipariş kaydedilemedi.');
        return j;
      });
    }).then(function (j) {
      bitir(j.siparis.no, true);
    }).catch(function (err) {
      not.textContent = err.message + ' WhatsApp üzerinden gönderiliyor.';
      bitir('', false);
    }).then(function () {
      btn.disabled = false; btn.textContent = 'Siparişi gönder';
    });
  });

  ciz();
  baslangicAdimi();
})();
