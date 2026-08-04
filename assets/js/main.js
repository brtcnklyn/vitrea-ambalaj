/* ============================================================
   VITREA — etkileşim
   ============================================================ */
(function () {
  'use strict';
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var P  = window.VITREA_PRODUCTS || [];
  var U  = window.VITREA_USES || [];
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var WA_TEL = '905348433188';                       // WhatsApp numarası
  var MAIL   = 'info@vitrea.com.tr';                 // teklif e-postası (düzenleyin)

  /* ---------------- ticker ---------------- */
  function buildTicker() {
    var row = $('#ticker');
    if (!row) return;
    var vols = P.map(function (p) { return p.vol; }).filter(function (v) { return v > 0; });
    var lo = vols.length ? Math.min.apply(null, vols) : 60;
    var hi = vols.length ? Math.max.apply(null, vols) : 1130;
    var items = ['PS kristal gövde', 'PET şeffaf kapak', 'Gıdaya uygun', 'Sızdırmaz kapanma',
                 'İstiflenebilir form', P.length + ' model', lo + ' – ' + hi + ' cc',
                 '48 saatte sevkiyat', '%100 geri dönüştürülebilir'];
    var html = items.map(function (t) { return '<b>' + t + '</b>'; }).join('');
    row.innerHTML = html + html;                     // kesintisiz döngü için iki tur
  }

  /* ---------------- reveal ---------------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }) : null;

  function watch(el) { if (io) { io.observe(el); } else { el.classList.add('is-in'); } }
  function watchAll(sel, ctx) { $$(sel, ctx).forEach(watch); }

  /* kelime kelime açılan başlık */
  $$('.words').forEach(function (h) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (w) {
            if (!w.trim()) { frag.appendChild(document.createTextNode(w)); return; }
            var s = document.createElement('span');
            s.textContent = w;
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { walk(n); }
      });
    };
    walk(h);
    $$('span', h).forEach(function (s, i) { s.style.transitionDelay = (i * 0.032) + 's'; });
  });

  watchAll('.reveal, .words, .diagram, .steps__list li, .split');

  /* ---------------- hero ---------------- */
  var hero = $('.hero');
  if (hero) { requestAnimationFrame(function () { hero.classList.add('is-in'); }); }

  /* sayaçlar */
  function countUp(el) {
    var target = parseInt(el.dataset.count, 10) || 0;
    if (reduced) { el.textContent = target; return; }
    var t0 = null, dur = 1400;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counted = false;
  setTimeout(function () { counted = true; $$('[data-count]').forEach(countUp); }, 900);

  /* ---------------- nav ---------------- */
  var nav = $('#nav'), last = 0;
  function onScroll() {
    var y = window.scrollY || 0;
    nav.classList.toggle('is-solid', y > 40);
    nav.classList.toggle('is-hidden', y > 460 && y > last && !document.body.classList.contains('menu-open'));
    last = y;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    $('#scrollbarFill').style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* mobil menü */
  var burger = $('#burger');
  function closeMenu() {
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    $('#menu').setAttribute('aria-hidden', 'true');
  }
  burger.addEventListener('click', function () {
    var open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
    $('#menu').setAttribute('aria-hidden', String(!open));
  });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  /* ---------------- koleksiyon ---------------- */
  var grid = $('#grid'), empty = $('#gridEmpty');
  var filt = { cat: 'all', vol: 'all' };

  function volBand(v) { return v < 200 ? 's' : (v < 300 ? 'm' : 'l'); }

  function cardHTML(p) {
    return '<button class="card" data-id="' + p.id + '" aria-label="' + p.name + ' detayları">' +
      '<span class="card__ph">' +
        (p.scene ? '<img class="card__scene" src="assets/img/sahne/' + p.scene + '.jpg" alt="" loading="lazy" aria-hidden="true">' : '') +
        '<img class="card__img" src="assets/img/urun/' + p.img + '.png" alt="' + p.name + ' ' + p.vol + ' cc ambalaj" loading="lazy">' +
        (p.tag ? '<span class="card__tag">' + p.tag + '</span>' : '') +
      '</span>' +
      '<span class="card__body">' +
        '<span class="card__code">' + p.code + '</span>' +
        '<span class="card__name">' + p.name + '</span>' +
        '<span class="card__meta"><span><b>' + p.vol + '</b> cc</span><span>' + p.dim + ' mm</span></span>' +
      '</span></button>';
  }

  function render() {
    var list = P.filter(function (p) {
      return (filt.cat === 'all' || p.cat === filt.cat) &&
             (filt.vol === 'all' || volBand(p.vol) === filt.vol);
    });
    grid.innerHTML = list.map(cardHTML).join('');
    empty.hidden = list.length > 0;
    $$('.card', grid).forEach(function (c, i) {
      c.style.transitionDelay = Math.min(i, 12) * 0.035 + 's';
      watch(c);
    });
  }

  $$('#filters .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var group = chip.parentElement.dataset.group;
      $$('.chip', chip.parentElement).forEach(function (c) { c.classList.remove('is-on'); });
      chip.classList.add('is-on');
      filt[group] = chip.dataset.val;
      render();
    });
  });

  /* ---------------- ürün paneli ---------------- */
  var panel = $('#panel'), pbody = $('#panelBody'), lastFocus = null;

  function panelHTML(p) {
    var rows =
      '<tr><th>Ürün kodu</th><td>' + p.code + '</td></tr>' +
      '<tr><th>Ürün ölçüsü</th><td>' + p.dim + ' mm</td></tr>' +
      '<tr><th>Hacim</th><td>' + p.vol + ' cc</td></tr>' +
      '<tr><th>Materyal</th><td>PS — kristal polistiren</td></tr>' +
      '<tr><th>Renk</th><td>Şeffaf</td></tr>' +
      '<tr><th>Koli içi adet</th><td>' + p.box + ' adet</td></tr>' +
      '<tr><th>Koli ölçüsü</th><td>' + p.boxDim + ' mm</td></tr>';
    var lid = p.lid ?
      '<table class="tbl"><caption>Kapak</caption>' +
      '<tr><th>Kapak ölçüsü</th><td>' + p.lid.dim + ' mm</td></tr>' +
      '<tr><th>Materyal</th><td>' + p.lid.mat + ' — şeffaf</td></tr>' +
      '<tr><th>Koli içi adet</th><td>' + p.lid.box + ' adet</td></tr>' +
      '<tr><th>Koli ölçüsü</th><td>' + p.lid.boxDim + ' mm</td></tr></table>'
      : '<p class="panel__note"><em>Kapak gövdeye entegredir; ayrıca sipariş edilmesi gerekmez.</em></p>';

    var subject = encodeURIComponent('Teklif talebi — ' + p.name + ' (' + p.code + ')');
    var body = encodeURIComponent('Merhaba,\n\n' + p.name + ' (' + p.code + ', ' + p.vol +
      ' cc) için fiyat teklifi almak istiyorum.\n\nAylık tahmini adet: \nFirma: \nTelefon: \n');

    return '<div class="panel__ph"><img src="assets/img/urun/' + p.img + '.png" alt="' + p.name + '"></div>' +
      '<span class="panel__code">' + p.code + '</span>' +
      '<h2 class="panel__name">' + p.name + '</h2>' +
      '<p class="panel__vol">' + p.vol + ' cc · ' + p.dim + ' mm</p>' +
      '<p class="panel__note">' + p.note + '</p>' +
      '<table class="tbl"><caption>Teknik bilgi</caption>' + rows + '</table>' +
      lid +
      (p.scene ? '<div class="panel__scene"><img src="assets/img/sahne/' + p.scene +
                 '.jpg" alt="' + p.name + ' kullanım örneği" loading="lazy"></div>' : '') +
      '<div class="panel__cta">' +
        '<a class="btn btn--light" href="mailto:' + MAIL + '?subject=' + subject + '&body=' + body + '">Bu ürün için teklif al</a>' +
        '<a class="btn btn--ghost" href="#iletisim" data-close>Numune iste</a>' +
      '</div>';
  }

  function openPanel(id) {
    var p = P.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    lastFocus = document.activeElement;
    pbody.innerHTML = panelHTML(p);
    document.body.classList.add('panel-open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('.panel__x').focus();
    var sel = $('#formUrun');
    if (sel) sel.value = p.id;
  }
  function closePanel() {
    document.body.classList.remove('panel-open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  grid.addEventListener('click', function (e) {
    var c = e.target.closest('.card');
    if (c) openPanel(c.dataset.id);
  });
  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closePanel();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('panel-open')) closePanel();
    else if (document.body.classList.contains('menu-open')) closeMenu();
  });

  /* ---------------- kullanım şeridi ---------------- */
  var rail = $('#rail');
  function buildRail() {
    if (!rail) return;
    rail.innerHTML = U.map(function (u) {
      return '<figure class="rail__item"><img src="assets/img/sahne/' + u.img + '.jpg" alt="' +
        u.t + ' sunumu" loading="lazy">' +
        '<figcaption class="rail__cap"><h3>' + u.t + '</h3><p>' + u.d + '</p></figcaption></figure>';
    }).join('');
  }
  /* fare tekerleğiyle yatay kaydırma */
  if (rail) {
    rail.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      var max = rail.scrollWidth - rail.clientWidth;
      if ((rail.scrollLeft <= 0 && e.deltaY < 0) || (rail.scrollLeft >= max - 1 && e.deltaY > 0)) return;
      e.preventDefault();
      rail.scrollLeft += e.deltaY;
    }, { passive: false });
  }

  /* ---------------- film ---------------- */
  var fbox = $('.film__box'), fv = $('#filmVideo'), fbtn = $('#filmBtn');
  if (fbtn) {
    fbtn.addEventListener('click', function () {
      if (fv.paused) { fv.play(); fbox.classList.add('is-playing'); }
      else { fv.pause(); fbox.classList.remove('is-playing'); }
    });
  }

  /* ---------------- form ---------------- */
  var sel = $('#formUrun');
  function buildSelect() {
    if (!sel) return;
    sel.innerHTML = '<option value="">Seçiniz (opsiyonel)</option>';
    P.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name + ' — ' + p.vol + ' cc (' + p.code + ')';
      sel.appendChild(o);
    });
  }

  var form = $('#form'), note = $('#formNote');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(form), ok = true;
    ['ad', 'mail'].forEach(function (k) {
      var el = form.elements[k];
      var bad = !String(d.get(k) || '').trim() || (k === 'mail' && !/^\S+@\S+\.\S+$/.test(d.get(k)));
      el.parentElement.classList.toggle('is-bad', bad);
      if (bad) ok = false;
    });
    if (!ok) { note.textContent = 'Lütfen ad ve geçerli bir e-posta girin.'; return; }

    var urun = d.get('urun');
    var pr = P.filter(function (x) { return x.id === urun; })[0];
    var lines = [
      'Ad Soyad: ' + d.get('ad'),
      'Firma: ' + (d.get('firma') || '-'),
      'Telefon: ' + (d.get('tel') || '-'),
      'E-posta: ' + d.get('mail'),
      'Ürün: ' + (pr ? pr.name + ' (' + pr.code + ', ' + pr.vol + ' cc)' : '-'),
      'Aylık tahmini adet: ' + (d.get('adet') || '-'),
      '',
      d.get('mesaj') || ''
    ].join('\n');

    note.textContent = 'E-posta uygulamanız açılıyor…';
    window.location.href = 'mailto:' + MAIL +
      '?subject=' + encodeURIComponent('Teklif talebi — ' + d.get('ad')) +
      '&body=' + encodeURIComponent(lines);
  });

  form.addEventListener('input', function (e) {
    var f = e.target.closest('.field');
    if (f) f.classList.remove('is-bad');
    note.textContent = '';
  });

  /* WhatsApp bağlantısı */
  var wa = $('#wa');
  if (wa) {
    wa.href = 'https://wa.me/' + WA_TEL + '?text=' +
      encodeURIComponent('Merhaba, VITREA sütlü tatlı ambalajları için fiyat teklifi almak istiyorum.');
  }

  /* yıl */
  $('#yil').textContent = new Date().getFullYear();

  /* iç bağlantılarda menüyü kapat + panel açıksa kapat */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (document.body.classList.contains('panel-open')) closePanel();
    });
  });

  /* ---------------- veri ----------------
     Önce statik yedekle (assets/js/products.js) anında çizilir; sunucu
     çalışıyorsa /api/products ile güncel liste alınıp yeniden çizilir.
     Sunucu kapalıyken site yedekle çalışmaya devam eder.            */
  /* ürün sayısı ve hacim aralığı listeye göre güncellenir */
  function buildStats() {
    var vols = P.map(function (p) { return p.vol; }).filter(function (v) { return v > 0; });
    var lo = vols.length ? Math.min.apply(null, vols) : 0;
    var hi = vols.length ? Math.max.apply(null, vols) : 0;
    var c = $('#collCount'); if (c) c.textContent = P.length;
    var m = $('#stModel');   if (m) { m.dataset.count = P.length; if (counted) countUp(m); }
    var s = $('#stMin');     if (s) { s.dataset.count = lo; if (counted) countUp(s); }
    var x = $('#stMax');     if (x) x.textContent = '–' + hi + ' cc';
  }

  function boot() { render(); buildRail(); buildSelect(); buildTicker(); buildStats(); }
  boot();

  fetch('api/products', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !Array.isArray(j.products) || !j.products.length) return;
      P = j.products;
      if (Array.isArray(j.uses) && j.uses.length) U = j.uses;
      boot();
    })
    .catch(function () { /* sunucu yok — statik yedek geçerli */ });
})();
