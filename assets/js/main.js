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
  /* İletişim yalnızca WhatsApp üzerinden — e-posta kullanılmıyor. */

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

    var waMsg = encodeURIComponent(
      'Merhaba, ' + p.name + ' (' + p.code + ', ' + p.vol +
      ' cc) için fiyat teklifi almak istiyorum.\n\nAylık tahmini adet: \nFirma: ');

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
        '<a class="btn btn--light" target="_blank" rel="noopener" href="https://wa.me/' + WA_TEL +
          '?text=' + waMsg + '">Bu ürün için WhatsApp\'tan teklif al</a>' +
        '<a class="btn btn--ghost" href="#iletisim" data-close>Numune iste</a>' +
      '</div>' +
      '<div class="panel__rv" id="panelRv"></div>';
  }

  function openPanel(id) {
    var p = P.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    lastFocus = document.activeElement;
    pbody.innerHTML = panelHTML(p);
    renderReviews(p);
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

  /* ---------------- yorumlar & hesap ---------------- */
  var RV = window.VITREAPLAS_REVIEWS || {};
  var UT = null;
  try { UT = JSON.parse(localStorage.getItem('vp_user') || 'null'); } catch (e) {}

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function stars(n, cls) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += '<i class="st' + (i <= n ? ' on' : '') + '"' +
      (cls ? ' data-star="' + i + '"' : '') + '>★</i>';
    return '<span class="stars' + (cls ? ' ' + cls : '') + '">' + s + '</span>';
  }

  function renderReviews(p) {
    var box = $('#panelRv');
    if (!box) return;
    var list = RV[p.id] || [];
    var avg = list.length ? list.reduce(function (a, r) { return a + r.rating; }, 0) / list.length : 0;

    var html = '<h3 class="rv__h">Değerlendirmeler' +
      (list.length ? ' <span>' + stars(Math.round(avg)) + ' ' + avg.toFixed(1) +
        ' · ' + list.length + ' yorum</span>' : '') + '</h3>';

    html += list.length
      ? list.map(function (r) {
          return '<div class="rv"><div class="rv__top">' + stars(r.rating) +
            '<b>' + esc(r.ad) + '</b><time>' + esc(r.date) + '</time></div>' +
            '<p>' + esc(r.text) + '</p></div>';
        }).join('')
      : '<p class="rv__empty">Bu ürüne henüz yorum yapılmadı.</p>';

    /* etkileşim alani */
    if (!UT) {
      html += '<button class="btn btn--ghost rv__login" id="rvLogin">Yorum yazmak için giriş yapın</button>';
    } else if ((UT.purchased || []).indexOf(p.id) >= 0) {
      html += '<form class="rv__form" id="rvForm" data-pid="' + p.id + '">' +
        '<div class="rv__rate">' + stars(0, 'pick') + '<span>Puanınız</span></div>' +
        '<label class="field"><span>Yorumunuz</span><textarea name="text" rows="3" maxlength="600"></textarea></label>' +
        '<button type="submit" class="btn btn--light btn--sm">Gönder</button>' +
        '<p class="form__note" id="rvNote"></p></form>';
    } else {
      html += '<p class="rv__gate">Merhaba <b>' + esc(UT.ad) + '</b> — bu ürüne yalnızca satın almış ' +
        'müşteriler yorum yapabilir. Siparişiniz varsa <a href="https://wa.me/' + WA_TEL +
        '" target="_blank" rel="noopener">WhatsApp\'tan yazın</a>, hesabınızı eşleştirelim. ' +
        '<button type="button" class="rv__out" id="rvOut">Çıkış</button></p>';
    }
    box.innerHTML = html;

    var lg = $('#rvLogin');
    if (lg) lg.addEventListener('click', function () { openAcct(p); });
    var out = $('#rvOut');
    if (out) out.addEventListener('click', function () {
      UT = null; localStorage.removeItem('vp_user'); renderReviews(p);
    });

    var form = $('#rvForm');
    if (form) {
      var picked = 0;
      $$('.stars.pick .st', form).forEach(function (st) {
        st.addEventListener('click', function () {
          picked = +st.dataset.star;
          $$('.stars.pick .st', form).forEach(function (x) {
            x.classList.toggle('on', +x.dataset.star <= picked);
          });
        });
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var note = $('#rvNote');
        fetch('api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + UT.token },
          body: JSON.stringify({ productId: form.dataset.pid, rating: picked,
                                 text: form.elements.text.value })
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (r) {
            note.textContent = r.ok ? 'Teşekkürler! Yorumunuz onaydan sonra yayınlanacak.'
                                    : (r.j.error || 'Bir sorun oluştu.');
            if (r.ok) form.querySelector('button[type=submit]').disabled = true;
          })
          .catch(function () { note.textContent = 'Sunucuya ulaşılamadı; lütfen daha sonra deneyin.'; });
      });
    }
  }

  /* hesap kutusu */
  var acct = $('#acct'), acctPanelProduct = null, acctMode = 'login';
  function openAcct(p) {
    acctPanelProduct = p || null;
    document.body.classList.add('acct-open');
    acct.setAttribute('aria-hidden', 'false');
  }
  function closeAcct() {
    document.body.classList.remove('acct-open');
    acct.setAttribute('aria-hidden', 'true');
  }
  if (acct) {
    acct.addEventListener('click', function (e) {
      if (e.target.closest('[data-aclose]')) closeAcct();
      var tab = e.target.closest('[data-atab]');
      if (tab) {
        acctMode = tab.dataset.atab;
        $$('[data-atab]', acct).forEach(function (b) {
          b.classList.toggle('is-on', b === tab);
        });
        $('.acct__adfield', acct).hidden = acctMode !== 'register';
        $('#acctForm button[type=submit]').textContent =
          acctMode === 'register' ? 'Hesap aç' : 'Giriş yap';
        $('#acctNote').textContent = '';
      }
    });
    $('#acctForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, note = $('#acctNote');
      var body = { email: f.elements.email.value.trim(), password: f.elements.password.value };
      if (acctMode === 'register') body.ad = f.elements.ad.value.trim();
      fetch(acctMode === 'register' ? 'api/register' : 'api/user/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok) { note.textContent = r.j.error || 'Bir sorun oluştu.'; return; }
          UT = { token: r.j.token, ad: r.j.ad, purchased: r.j.purchased || [] };
          localStorage.setItem('vp_user', JSON.stringify(UT));
          closeAcct();
          if (acctPanelProduct) renderReviews(acctPanelProduct);
        })
        .catch(function () {
          note.textContent = 'Sunucuya ulaşılamadı. Hesap işlemleri kısa süreliğine kapalı olabilir.';
        });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('acct-open')) closeAcct();
    });
  }

  /* oturum tazele: purchased listesi admin tarafindan degismis olabilir */
  if (UT) {
    fetch('api/me', { headers: { Authorization: 'Bearer ' + UT.token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j) { UT.ad = j.ad; UT.purchased = j.purchased || [];
                 localStorage.setItem('vp_user', JSON.stringify(UT)); }
        else { UT = null; localStorage.removeItem('vp_user'); }
      }).catch(function () {});
  }

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
    /* WhatsApp'a gidiyor: yalnizca ad zorunlu, e-posta girildiyse gecerli olmali */
    ['ad', 'mail'].forEach(function (k) {
      var el = form.elements[k];
      var v = String(d.get(k) || '').trim();
      var bad = k === 'ad' ? !v : (v && !/^\S+@\S+\.\S+$/.test(v));
      el.parentElement.classList.toggle('is-bad', bad);
      if (bad) ok = false;
    });
    if (!ok) { note.textContent = 'Lütfen adınızı girin (e-posta yazacaksanız geçerli olsun).'; return; }

    var urun = d.get('urun');
    var pr = P.filter(function (x) { return x.id === urun; })[0];
    var lines = [
      'Merhaba, VITREAPLAS için teklif almak istiyorum.',
      '',
      'Ad Soyad: ' + d.get('ad'),
      'Firma: ' + (d.get('firma') || '-'),
      'Telefon: ' + (d.get('tel') || '-'),
      'E-posta: ' + (d.get('mail') || '-'),
      'Ürün: ' + (pr ? pr.name + ' (' + pr.code + ', ' + pr.vol + ' cc)' : '-'),
      'Aylık tahmini adet: ' + (d.get('adet') || '-')
    ];
    if (String(d.get('mesaj') || '').trim()) lines.push('', d.get('mesaj'));

    note.textContent = 'WhatsApp açılıyor…';
    window.open('https://wa.me/' + WA_TEL + '?text=' + encodeURIComponent(lines.join('\n')),
                '_blank', 'noopener');
  });

  form.addEventListener('input', function (e) {
    var f = e.target.closest('.field');
    if (f) f.classList.remove('is-bad');
    note.textContent = '';
  });

  /* WhatsApp bağlantıları — sitedeki tüm iletişim buraya gider, e-posta yok */
  var waLink = 'https://wa.me/' + WA_TEL + '?text=' +
    encodeURIComponent('Merhaba, VITREAPLAS sütlü tatlı ambalajları için fiyat teklifi almak istiyorum.');
  ['#wa', '#waMeta', '#waFoot', '#waColl'].forEach(function (sel) {
    var el = $(sel);
    if (el) { el.href = waLink; el.target = '_blank'; el.rel = 'noopener'; }
  });

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
