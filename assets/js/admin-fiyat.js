/* ============================================================
   VITREAPLAS — panel: alış fiyatları + fiyat listesi üretici
   GİZLİ: veriyi yalnızca yerel sunucudan (node server.js) çeker.
   ============================================================ */
(function () {
  'use strict';
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var KEY = 'vitrea_token';
  var D = {                                  // sunucudan gelen veri
    ayar: { kdv: 20, iskonto: 35, kar: 50, yuvarla: true },
    kalemler: [], urunler: [], guncelleme: ''
  };
  var siteKod = {};                          // Mayer kodu -> site ürünü
  var sepet = [];                            // { kod, ad, aciklama, koliAdet, fiyat, elle }
  var listeler = [], aktifListeId = '';
  var fFiyat = { q: '', tip: 'all' };
  var fListe = { q: '', tip: 'site' };
  var yuklendi = false;

  function api(url, opts) {
    opts = opts || {};
    var token = localStorage.getItem(KEY) || '';
    opts.headers = Object.assign({ 'Content-Type': 'application/json' },
                                 opts.headers || {},
                                 token ? { Authorization: 'Bearer ' + token } : {});
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    return fetch(url, opts).catch(function () {
      throw new Error('Sunucuya ulaşılamıyor. Fiyat sayfaları yalnızca kendi bilgisayarınızda ' +
                      '“node server.js” çalışırken açılır.');
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || ('Sunucu hatası (' + r.status + ')'));
        return j;
      });
    });
  }

  var toastT;
  function toast(msg, bad) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function tl(x, nd) {
    if (x == null || isNaN(x)) return '—';
    nd = nd == null ? 2 : nd;
    return x.toLocaleString('tr-TR', { minimumFractionDigits: nd, maximumFractionDigits: nd }) + ' ₺';
  }
  /* sunucudaki hesapla() ile birebir aynı zincir */
  function hesap(koliFiyat, koliAdet, a) {
    if (!koliFiyat || !koliAdet) return null;
    var mayerAdet = koliFiyat / koliAdet;
    var alisHaric = mayerAdet / (1 + a.kdv / 100);
    var maliyet   = alisHaric * (1 - a.iskonto / 100);
    var satisHaric = maliyet * (1 + a.kar / 100);
    if (a.yuvarla) satisHaric = Math.ceil(satisHaric);
    var satisDahil = satisHaric * (1 + a.kdv / 100);
    return { mayerAdet: mayerAdet, alisHaric: alisHaric, maliyet: maliyet,
             satisHaric: satisHaric, satisDahil: satisDahil,
             koliDahil: satisDahil * koliAdet };
  }
  function anahtar(k) { return k.kod + '|' + k.tip + '|' + (k.varyant || ''); }
  function etiket(k) {
    return k.kod + ' ' + k.ad +
      (k.tip === 'kapak' ? ' — ' + (k.varyant ? k.varyant + ' ' : '') + 'KAPAK'
                         : (k.cc ? ' ' + k.cc + ' cc' : ''));
  }

  /* ---------------- veri ---------------- */
  function yukle() {
    return Promise.all([api('/api/admin/fiyat'), api('/api/admin/listeler')])
      .then(function (r) {
        D = r[0];
        listeler = r[1].listeler || [];
        siteKod = {};
        D.urunler.forEach(function (u) { siteKod[u.mayerKod] = u; });
        yuklendi = true;
        ayarYaz();
        cizFiyat();
        cizListeSecenek();
        cizKayitlar();
      });
  }

  /* ---------------- görünüm 1: alış fiyatları ---------------- */
  function ayarYaz() {
    $('#ayKdv').value = D.ayar.kdv;
    $('#ayIsk').value = D.ayar.iskonto;
    $('#ayKar').value = D.ayar.kar;
    $('#ayYuv').checked = D.ayar.yuvarla !== false;
    $('#fyMeta').textContent = D.kalemler.length + ' kalem · Mayer fiyatları ' +
      (D.guncelleme || '—') + ' tarihli';
  }

  function suz(list, f) {
    var q = f.q.toLowerCase().trim();
    return list.filter(function (k) {
      if (f.tip === 'govde' && k.tip !== 'govde') return false;
      if (f.tip === 'kapak' && k.tip !== 'kapak') return false;
      if (f.tip === 'site'  && !siteKod[k.kod])   return false;
      if (!q) return true;
      return (k.kod + ' ' + k.ad + ' ' + (k.cc || '')).toLowerCase().indexOf(q) >= 0;
    });
  }

  function cizFiyat() {
    var rows = suz(D.kalemler, fFiyat);
    if (!rows.length) {
      $('#fyTbl').innerHTML = '<p class="empty">Bu filtreye uyan kalem yok.</p>';
      return;
    }
    var h = '<table class="fyt"><thead><tr>' +
      '<th>Kod</th><th>Ürün</th><th class="r">Koli adet</th><th class="r">Mayer koli ₺</th>' +
      '<th class="r">Mayer adet</th><th class="r">Maliyet<i>iskontolu</i></th>' +
      '<th class="r">Satış adet<i>KDV hariç</i></th><th class="r">Satış adet<i>KDV dahil</i></th>' +
      '<th class="r">Koli satış</th></tr></thead><tbody>';

    rows.forEach(function (k) {
      var c = hesap(k.koliFiyat, k.koliAdet, D.ayar);
      var s = siteKod[k.kod];
      h += '<tr data-k="' + esc(anahtar(k)) + '">' +
        '<td class="kod">' + esc(k.kod) + (s ? '<i class="dot" title="Sitede satılıyor"></i>' : '') + '</td>' +
        '<td>' + esc(k.ad) +
          (k.tip === 'kapak' ? ' <em class="tipk">' + esc((k.varyant ? k.varyant + ' ' : '') + 'kapak') + '</em>'
                             : (k.cc ? ' <em class="cc">' + k.cc + ' cc</em>' : '')) + '</td>' +
        '<td class="r"><input class="mini" data-f="koliAdet" type="number" min="1" value="' + (k.koliAdet || '') + '"></td>' +
        '<td class="r"><input class="mini mini--w" data-f="koliFiyat" type="number" min="0" step="0.01" value="' + (k.koliFiyat || '') + '"></td>' +
        '<td class="r dim">' + tl(c && c.mayerAdet) + '</td>' +
        '<td class="r dim">' + tl(c && c.maliyet) + '</td>' +
        '<td class="r big">' + tl(c && c.satisHaric) + '</td>' +
        '<td class="r">' + tl(c && c.satisDahil) + '</td>' +
        '<td class="r">' + tl(c && c.koliDahil, 0) + '</td>' +
      '</tr>';
    });
    $('#fyTbl').innerHTML = h + '</tbody></table>';
  }

  function ayarKaydet() {
    api('/api/admin/fiyat-ayar', { method: 'POST', body: {
      kdv: $('#ayKdv').value, iskonto: $('#ayIsk').value,
      kar: $('#ayKar').value, yuvarla: $('#ayYuv').checked
    }}).then(function (r) {
      D.ayar = r.ayar;
      ayarYaz(); cizFiyat(); cizListeSecenek(); sepetTazele();
      toast('Ayarlar kaydedildi.');
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ---------------- görünüm 2: liste üretici ---------------- */
  function cizListeSecenek() {
    var rows = suz(D.kalemler, fListe);
    var secili = {};
    sepet.forEach(function (s) { secili[s.k] = true; });
    $('#liSecenek').innerHTML = rows.length
      ? rows.map(function (k) {
          var c = hesap(k.koliFiyat, k.koliAdet, D.ayar);
          var a = anahtar(k);
          return '<label class="fyo' + (secili[a] ? ' is-on' : '') + '">' +
            '<input type="checkbox" data-k="' + esc(a) + '"' + (secili[a] ? ' checked' : '') + '>' +
            '<b>' + esc(k.kod) + '</b><span>' + esc(k.ad) +
              (k.tip === 'kapak' ? ' · ' + esc((k.varyant ? k.varyant + ' ' : '') + 'kapak')
                                 : (k.cc ? ' · ' + k.cc + ' cc' : '')) + '</span>' +
            '<i>' + tl(c && c.satisHaric) + '</i></label>';
        }).join('')
      : '<p class="empty">Eşleşen ürün yok.</p>';
  }

  function sepetTazele() {                    // ayar değişince elle girilmemiş fiyatları güncelle
    sepet.forEach(function (s) {
      if (s.elle) return;
      var k = D.kalemler.filter(function (x) { return anahtar(x) === s.k; })[0];
      var c = k && hesap(k.koliFiyat, k.koliAdet, D.ayar);
      if (c) s.fiyat = c.satisHaric;
    });
    cizSepet();
  }

  function cizSepet() {
    $('#liSay').textContent = sepet.length + ' ürün seçili';
    if (!sepet.length) {
      $('#liSepet').innerHTML = '<p class="empty">Soldan ürün seçin. Fiyatlar ayarlardaki ' +
        'iskonto ve kâr marjına göre hesaplanır; her satırda elle değiştirebilirsiniz.</p>';
      return;
    }
    var h = '<table class="fyt fyt--sepet"><thead><tr><th>Kod</th><th>Ürün</th>' +
      '<th class="r">Koli adet</th><th class="r">Adet ₺ <i>KDV hariç</i></th>' +
      '<th class="r">KDV dahil</th><th class="r">Koli ₺</th><th></th></tr></thead><tbody>';
    sepet.forEach(function (s, i) {
      var dahil = s.fiyat * (1 + D.ayar.kdv / 100);
      h += '<tr data-i="' + i + '">' +
        '<td class="kod">' + esc(s.kod) + '</td>' +
        '<td><input class="mini mini--ad" data-f="ad" value="' + esc(s.ad) + '">' +
            '<input class="mini mini--ad mini--not" data-f="aciklama" placeholder="satır altı not (opsiyonel)" value="' + esc(s.aciklama || '') + '"></td>' +
        '<td class="r"><input class="mini" data-f="koliAdet" type="number" min="0" value="' + (s.koliAdet || '') + '"></td>' +
        '<td class="r"><input class="mini mini--w' + (s.elle ? ' is-elle' : '') + '" data-f="fiyat" type="number" min="0" step="0.01" value="' + s.fiyat + '"></td>' +
        '<td class="r dim">' + tl(dahil) + '</td>' +
        '<td class="r dim">' + tl(dahil * (s.koliAdet || 0), 0) + '</td>' +
        '<td class="r"><button class="x" data-cikar="' + i + '" title="Listeden çıkar">&times;</button></td>' +
      '</tr>';
    });
    $('#liSepet').innerHTML = h + '</tbody></table>';
  }

  function ekle(a) {
    if (sepet.some(function (s) { return s.k === a; })) return;
    var k = D.kalemler.filter(function (x) { return anahtar(x) === a; })[0];
    if (!k) return;
    var c = hesap(k.koliFiyat, k.koliAdet, D.ayar);
    sepet.push({
      k: a, kod: k.kod, ad: etiket(k).replace(k.kod + ' ', ''),
      aciklama: '', koliAdet: k.koliAdet || 0,
      fiyat: c ? c.satisHaric : 0, elle: false
    });
    cizSepet();
  }
  function cikar(a) {
    sepet = sepet.filter(function (s) { return s.k !== a; });
    cizSepet(); cizListeSecenek();
  }

  /* ---------------- kayıtlı listeler ---------------- */
  function cizKayitlar() {
    $('#liKayit').innerHTML = '<option value="">— yeni liste —</option>' +
      listeler.map(function (l) {
        return '<option value="' + esc(l.id) + '">' + esc(l.baslik) +
               (l.musteri ? ' — ' + esc(l.musteri) : '') + ' (' + esc(l.tarih) + ')</option>';
      }).join('');
    $('#liKayit').value = aktifListeId;
  }

  function listeYukle(id) {
    var l = listeler.filter(function (x) { return x.id === id; })[0];
    aktifListeId = id;
    if (!l) { sepet = []; $('#liBaslik').value = ''; $('#liMusteri').value = ''; $('#liNot').value = ''; }
    else {
      $('#liBaslik').value = l.baslik; $('#liMusteri').value = l.musteri || ''; $('#liNot').value = l.not || '';
      sepet = l.satirlar.map(function (s) {
        var k = D.kalemler.filter(function (x) { return x.kod === s.kod; })[0];
        return { k: k ? anahtar(k) : s.kod, kod: s.kod, ad: s.ad, aciklama: s.aciklama,
                 koliAdet: s.koliAdet, fiyat: s.fiyat, elle: s.elle };
      });
    }
    cizSepet(); cizListeSecenek();
  }

  function listeKaydet() {
    if (!sepet.length) return toast('Önce listeye ürün ekleyin.', true);
    api('/api/admin/liste', { method: 'POST', body: {
      id: aktifListeId, baslik: $('#liBaslik').value || 'VITREAPLAS Fiyat Listesi',
      musteri: $('#liMusteri').value, not: $('#liNot').value, ayar: D.ayar,
      satirlar: sepet
    }}).then(function (r) {
      listeler = r.listeler; aktifListeId = r.liste.id;
      cizKayitlar();
      toast('Liste kaydedildi.');
    }).catch(function (e) { toast(e.message, true); });
  }

  function listeSil() {
    if (!aktifListeId) return toast('Silinecek kayıtlı liste seçili değil.', true);
    var l = listeler.filter(function (x) { return x.id === aktifListeId; })[0];
    if (!confirm('“' + (l ? l.baslik : '') + '” listesi silinsin mi?')) return;
    api('/api/admin/liste/' + encodeURIComponent(aktifListeId), { method: 'DELETE' })
      .then(function (r) {
        listeler = r.listeler; aktifListeId = ''; cizKayitlar(); listeYukle('');
        toast('Liste silindi.');
      }).catch(function (e) { toast(e.message, true); });
  }

  /* ---------------- PDF (tarayıcının yazdır → PDF'e kaydet) ---------------- */
  function pdf() {
    if (!sepet.length) return toast('Önce listeye ürün ekleyin.', true);
    var kdv = D.ayar.kdv;
    var bugun = new Date().toLocaleDateString('tr-TR');
    var baslik = $('#liBaslik').value || 'VITREAPLAS Fiyat Listesi';
    var musteri = $('#liMusteri').value;
    var not = $('#liNot').value;

    var satirlar = sepet.map(function (s) {
      var dahil = s.fiyat * (1 + kdv / 100);
      return '<tr><td class="k">' + esc(s.kod) + '</td>' +
        '<td>' + esc(s.ad) + (s.aciklama ? '<em>' + esc(s.aciklama) + '</em>' : '') + '</td>' +
        '<td class="r">' + (s.koliAdet || '—') + '</td>' +
        '<td class="r">' + tl(s.fiyat) + '</td>' +
        '<td class="r">' + tl(dahil) + '</td>' +
        '<td class="r b">' + tl(dahil * (s.koliAdet || 0), 0) + '</td></tr>';
    }).join('');

    var doc = '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>' + esc(baslik) + '</title><style>' +
      '@page{size:A4;margin:14mm 12mm}' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{font:12px/1.5 "Inter Tight","Segoe UI",sans-serif;color:#0C0C0E}' +
      '.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0C0C0E;padding-bottom:5mm;margin-bottom:6mm}' +
      '.hd h1{font-size:22px;font-weight:600;letter-spacing:-.01em}' +
      '.hd .mk{font-size:13px;letter-spacing:.28em;color:#8E5027;font-weight:600}' +
      '.hd .mt{font-size:10.5px;color:#6b675f;text-align:right;line-height:1.6}' +
      'table{width:100%;border-collapse:collapse;font-size:11px}' +
      'th{text-align:left;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#8b867c;' +
        'border-bottom:1px solid #0C0C0E;padding:0 2mm 2mm}' +
      'td{padding:2.2mm 2mm;border-bottom:1px solid #EEEAE3;vertical-align:top}' +
      'td.k{font-size:10px;letter-spacing:.06em;color:#8E5027;white-space:nowrap}' +
      'td em{display:block;font-style:normal;font-size:9.5px;color:#8b867c;margin-top:.6mm}' +
      '.r{text-align:right;white-space:nowrap}.b{font-weight:600}' +
      'tbody tr:nth-child(even){background:#FAF8F5}' +
      '.ft{margin-top:7mm;padding-top:4mm;border-top:1px solid #DDD8CF;font-size:10px;color:#4a463f;line-height:1.7}' +
      '.ft b{color:#0C0C0E}' +
      'body{background:#fff;padding:8mm}' +
      '@media print{body{padding:0}}' +
      '</style></head><body>' +
      '<div class="hd"><div><div class="mk">VITREAPLAS</div><h1>' + esc(baslik) + '</h1></div>' +
      '<div class="mt">' + (musteri ? '<b>' + esc(musteri) + '</b><br>' : '') +
        bugun + '<br>+90 534 843 31 88 · vitreaplas.com</div></div>' +
      '<table><thead><tr><th>Kod</th><th>Ürün</th><th class="r">Koli adet</th>' +
      '<th class="r">Adet (KDV hariç)</th><th class="r">Adet (KDV dahil)</th><th class="r">Koli (KDV dahil)</th>' +
      '</tr></thead><tbody>' + satirlar + '</tbody></table>' +
      '<div class="ft">' +
      (not ? '<p>' + esc(not).replace(/\n/g, '<br>') + '</p>' : '') +
      '<p>· Fiyatlar <b>' + bugun + '</b> tarihinde günceldir; kur ve hammadde hareketlerine bağlı ' +
        'olarak bildirimsiz değişebilir. Sipariş anındaki teyitli fiyat geçerlidir.</p>' +
      '<p>· KDV oranı <b>%' + kdv + '</b>. Satış birimi kolidir; koli içi adetler tabloda belirtilmiştir.</p>' +
      '</div></body></html>';

    /* Açılır pencere engellenebiliyor; önizlemeyi sayfa içi iframe'de gösteriyoruz.
       Yazdır düğmesi yalnızca iframe'i basar, panel arayüzü çıktıya karışmaz. */
    onizle(doc, baslik);
  }

  function onizle(doc, baslik) {
    var eski = $('#pvWrap');
    if (eski) eski.remove();

    var wrap = document.createElement('div');
    wrap.id = 'pvWrap';
    wrap.className = 'pv';
    wrap.innerHTML =
      '<div class="pv__bg" data-kapat></div>' +
      '<div class="pv__box">' +
        '<header class="pv__top"><b>' + esc(baslik) + '</b>' +
          '<span>Yazdır penceresinde <em>Hedef: PDF olarak kaydet</em> seçin.</span>' +
          '<button class="btn btn--sm" id="pvYaz">Yazdır / PDF kaydet</button>' +
          '<button class="btn btn--ghost btn--sm" data-kapat>Kapat</button>' +
        '</header>' +
        '<iframe id="pvFrame" title="Fiyat listesi önizleme"></iframe>' +
      '</div>';
    document.body.appendChild(wrap);

    var f = $('#pvFrame');
    var d = f.contentDocument || f.contentWindow.document;
    d.open(); d.write(doc); d.close();

    $('#pvYaz').addEventListener('click', function () {
      f.contentWindow.focus();
      f.contentWindow.print();
    });
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-kapat]')) wrap.remove();
    });
    document.addEventListener('keydown', function esc2(e) {
      if (e.key === 'Escape') { wrap.remove(); document.removeEventListener('keydown', esc2); }
    });
  }

  /* ---------------- olaylar ---------------- */
  function segBagla(sel, filtre, ciz) {
    var el = $(sel);
    if (!el) return;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.seg');
      if (!b) return;
      $$('.seg', el).forEach(function (x) { x.classList.toggle('is-on', x === b); });
      filtre.tip = b.dataset.val;
      ciz();
    });
  }
  segBagla('#fyTip', fFiyat, cizFiyat);
  segBagla('#liTip', fListe, cizListeSecenek);

  $('#fyQ').addEventListener('input', function () { fFiyat.q = this.value; cizFiyat(); });
  $('#liQ').addEventListener('input', function () { fListe.q = this.value; cizListeSecenek(); });
  $('#ayKaydet').addEventListener('click', ayarKaydet);

  /* alış tablosunda koli fiyatı / adedi düzenleme */
  $('#fyTbl').addEventListener('change', function (e) {
    var inp = e.target.closest('input[data-f]');
    if (!inp) return;
    var tr = inp.closest('tr'), a = tr.dataset.k;
    var k = D.kalemler.filter(function (x) { return anahtar(x) === a; })[0];
    if (!k) return;
    var body = { kod: k.kod, tip: k.tip, varyant: k.varyant,
                 koliFiyat: k.koliFiyat, koliAdet: k.koliAdet };
    body[inp.dataset.f] = inp.value;
    api('/api/admin/fiyat-kalem', { method: 'POST', body: body }).then(function (r) {
      k.koliFiyat = r.kalem.koliFiyat; k.koliAdet = r.kalem.koliAdet;
      D.guncelleme = new Date().toISOString().slice(0, 10);
      ayarYaz(); cizFiyat(); cizListeSecenek(); sepetTazele();
      toast(k.kod + ' güncellendi.');
    }).catch(function (err) { toast(err.message, true); });
  });

  /* liste: ürün seçme */
  $('#liSecenek').addEventListener('change', function (e) {
    var cb = e.target.closest('input[type=checkbox]');
    if (!cb) return;
    if (cb.checked) ekle(cb.dataset.k); else cikar(cb.dataset.k);
    cb.closest('.fyo').classList.toggle('is-on', cb.checked);
  });

  /* liste: satır düzenleme ve çıkarma */
  $('#liSepet').addEventListener('input', function (e) {
    var inp = e.target.closest('input[data-f]');
    if (!inp) return;
    var s = sepet[+inp.closest('tr').dataset.i];
    if (!s) return;
    var f = inp.dataset.f;
    if (f === 'fiyat')         { s.fiyat = parseFloat(inp.value) || 0; s.elle = true; inp.classList.add('is-elle'); }
    else if (f === 'koliAdet') { s.koliAdet = parseInt(inp.value, 10) || 0; }
    else                       { s[f] = inp.value; }
    var tr = inp.closest('tr');
    var dahil = s.fiyat * (1 + D.ayar.kdv / 100);
    tr.children[4].textContent = tl(dahil);
    tr.children[5].textContent = tl(dahil * (s.koliAdet || 0), 0);
  });
  $('#liSepet').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cikar]');
    if (!b) return;
    var s = sepet[+b.dataset.cikar];
    if (s) cikar(s.k);
  });

  $('#liKayit').addEventListener('change', function () { listeYukle(this.value); });
  $('#liKaydet').addEventListener('click', listeKaydet);
  $('#liSil').addEventListener('click', listeSil);
  $('#liPdf').addEventListener('click', pdf);

  /* sekmeye ilk girişte veriyi çek */
  $('#views').addEventListener('click', function (e) {
    var b = e.target.closest('.vw');
    if (!b) return;
    var v = b.dataset.view;
    if (v !== 'fiyat' && v !== 'liste') return;
    if (yuklendi) return;
    yukle().catch(function (err) {
      toast(err.message, true);
      $('#fyTbl').innerHTML = '<p class="empty">' + esc(err.message) + '</p>';
    });
  });
})();
