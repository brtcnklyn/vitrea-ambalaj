/* ============================================================
   VITREAPLAS — sepet
   Tarayicida saklanir (localStorage). Sunucu gerekmez, GitHub
   Pages'te de calisir. Siparis verilirken sunucu varsa kaydedilir,
   yoksa WhatsApp mesajina donusur.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'vitreaplas_sepet_v1';

  function oku() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(d) ? d.filter(function (s) { return s && s.id && s.adet > 0; }) : [];
    } catch (e) { return []; }
  }
  function yaz(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    duyur();
  }
  function duyur() {
    document.dispatchEvent(new CustomEvent('sepet:degisti', { detail: { sepet: oku() } }));
  }

  function urun(id) {
    return (window.VITREA_PRODUCTS || []).filter(function (p) { return p.id === id; })[0] || null;
  }

  /* koli adedi bilinen üründe varsayılan miktar 1 kolidir */
  function ekle(id, adet) {
    var p = urun(id);
    if (!p) return null;
    var s = oku();
    var v = s.filter(function (x) { return x.id === id; })[0];
    var n = parseInt(adet, 10) || p.box || 1;
    if (v) v.adet += n; else s.push({ id: id, adet: n });
    yaz(s);
    return oku();
  }
  function ayarla(id, adet) {
    var s = oku(), n = parseInt(adet, 10) || 0;
    if (n <= 0) return cikar(id);
    var v = s.filter(function (x) { return x.id === id; })[0];
    if (v) v.adet = Math.min(n, 1000000);
    yaz(s);
    return oku();
  }
  function cikar(id) {
    yaz(oku().filter(function (x) { return x.id !== id; }));
    return oku();
  }
  function temizle() { yaz([]); }

  /* satirlari urun verisiyle birlestir ve tutarlari hesapla */
  function dokum() {
    var kdv = window.VITREA_KDV || 20;
    var satir = oku().map(function (x) {
      var p = urun(x.id);
      if (!p) return null;
      var birim = typeof p.fiyat === 'number' ? p.fiyat : 0;
      return {
        id: p.id, kod: p.code, ad: p.name, vol: p.vol, img: p.img,
        box: p.box, adet: x.adet, birim: birim,
        fiyatsiz: !birim,
        tutar: Math.round(birim * x.adet * 100) / 100
      };
    }).filter(Boolean);

    var ara = satir.reduce(function (t, s) { return t + s.tutar; }, 0);
    return {
      satir: satir,
      adet: satir.reduce(function (t, s) { return t + s.adet; }, 0),
      kalem: satir.length,
      araToplam: Math.round(ara * 100) / 100,
      kdvOran: kdv,
      kdvTutar: Math.round(ara * kdv / 100 * 100) / 100,
      toplam: Math.round(ara * (1 + kdv / 100) * 100) / 100,
      fiyatsizVar: satir.some(function (s) { return s.fiyatsiz; })
    };
  }

  function tl(x) {
    return (x || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
  }

  /* siparisi WhatsApp mesajina cevir */
  function waMetni(d, bilgi) {
    var l = ['Merhaba, VITREAPLAS sipariş vermek istiyorum.', ''];
    d.satir.forEach(function (s) {
      l.push('• ' + s.ad + ' (' + s.kod + ', ' + s.vol + ' cc) — ' + s.adet + ' adet' +
             (s.fiyatsiz ? '' : ' × ' + tl(s.birim) + ' = ' + tl(s.tutar)));
    });
    l.push('');
    if (!d.fiyatsizVar) {
      l.push('Ara toplam: ' + tl(d.araToplam));
      l.push('KDV (%' + d.kdvOran + '): ' + tl(d.kdvTutar));
      l.push('Genel toplam: ' + tl(d.toplam));
      l.push('');
    }
    if (bilgi) {
      if (bilgi.no)    l.push('Sipariş no: ' + bilgi.no);
      if (bilgi.ad)    l.push('Ad Soyad: ' + bilgi.ad);
      if (bilgi.firma) l.push('Firma: ' + bilgi.firma);
      if (bilgi.tel)   l.push('Telefon: ' + bilgi.tel);
      if (bilgi.email) l.push('E-posta: ' + bilgi.email);
      if (bilgi.adres) l.push('Adres: ' + bilgi.adres);
      if (bilgi.not)   l.push('Not: ' + bilgi.not);
    }
    return l.join('\n');
  }

  window.SEPET = {
    oku: oku, ekle: ekle, ayarla: ayarla, cikar: cikar, temizle: temizle,
    dokum: dokum, tl: tl, waMetni: waMetni, duyur: duyur, WA: '905348433188'
  };
})();
