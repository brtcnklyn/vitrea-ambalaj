/* ============================================================
   VITREA — yönetim paneli
   ============================================================ */
(function () {
  'use strict';
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var KEY = 'vitrea_token';
  var token = localStorage.getItem(KEY) || '';
  var products = [];
  var images = { urun: [], sahne: [] };
  var filt = { q: '', cat: 'all', state: 'all' };

  var CAT = { kase:'Kase', bardak:'Bardak', kare:'Kare', dikdortgen:'Dikdörtgen', ozel:'Özel' };

  /* ---------------- ağ ---------------- */
  function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' },
                                 opts.headers || {},
                                 token ? { Authorization: 'Bearer ' + token } : {});
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    return fetch(url, opts).catch(function () {
      throw new Error('Sunucuya ulaşılamıyor. Panel yalnızca kendi bilgisayarınızda ' +
                      '“node server.js” çalışırken kullanılabilir.');
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          if (r.status === 401 && token) logout('Oturum süresi doldu.');
          throw new Error(j.error || ('Sunucu hatası (' + r.status + ')'));
        }
        return j;
      });
    });
  }

  var toastT;
  function toast(msg, bad) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }

  /* ---------------- giriş ---------------- */
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#loginErr');
    err.textContent = '';
    api('/api/login', { method: 'POST', body: { password: $('#pw').value } })
      .then(function (j) {
        token = j.token;
        localStorage.setItem(KEY, token);
        start();
      })
      .catch(function (e) { err.textContent = e.message; });
  });

  function logout(msg) {
    token = '';
    localStorage.removeItem(KEY);
    $('#app').hidden = true;
    $('#gate').style.display = '';
    $('#pw').value = '';
    if (msg) $('#loginErr').textContent = msg;
  }
  $('#btnOut').addEventListener('click', function () { logout(); });

  function start() {
    $('#gate').style.display = 'none';
    $('#app').hidden = false;
    Promise.all([
      api('/api/admin/products'),
      api('/api/admin/images')
    ]).then(function (r) {
      products = r[0].products;
      images = r[1];
      render();
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ---------------- liste ---------------- */
  function match(p) {
    if (filt.cat !== 'all' && p.cat !== filt.cat) return false;
    if (filt.state === 'on'  && p.active === false) return false;
    if (filt.state === 'off' && p.active !== false) return false;
    if (filt.q) {
      var s = (p.name + ' ' + p.code + ' ' + p.vol).toLowerCase();
      if (s.indexOf(filt.q) < 0) return false;
    }
    return true;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function render() {
    var on = products.filter(function (p) { return p.active !== false; }).length;
    $('#stTotal').textContent = products.length;
    $('#stOn').textContent = on;
    $('#stOff').textContent = products.length - on;

    var vis = products.filter(match);
    $('#empty').hidden = vis.length > 0;

    $('#list').innerHTML = vis.map(function (p) {
      var i = products.indexOf(p);
      var lid = p.lid ? 'ayrı kapak' : 'entegre kapak';
      return '<div class="row' + (p.active === false ? ' is-off' : '') + '" data-id="' + esc(p.id) + '">' +
        (p.img
          ? '<div class="row__ph"><img src="assets/img/urun/' + esc(p.img) + '.png" alt="" loading="lazy"></div>'
          : '<div class="row__ph none">görsel yok</div>') +
        '<div><span class="row__code">' + esc(p.code) + '</span>' +
          '<div class="row__name">' + esc(p.name) + '</div>' +
          '<div class="row__sub">' + esc(p.dim) + ' mm · ' + lid + '</div></div>' +
        '<div class="row__cell"><b>' + esc(p.vol) + '</b> cc</div>' +
        '<div class="row__cell"><span class="pill">' + (CAT[p.cat] || p.cat) + '</span></div>' +
        '<div class="row__cell">koli <b>' + esc(p.box) + '</b></div>' +
        '<div class="row__act">' +
          '<button class="sw' + (p.active === false ? '' : ' on') + '" data-a="toggle" ' +
            'title="' + (p.active === false ? 'Yayına al' : 'Yayından kaldır') + '"></button>' +
          '<button class="ico" data-a="up"   title="Yukarı"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="ico" data-a="down" title="Aşağı"' + (i === products.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="ico" data-a="edit" title="Düzenle">✎</button>' +
          '<button class="ico del" data-a="del" title="Sil">🗑</button>' +
        '</div></div>';
    }).join('');
  }

  $('#q').addEventListener('input', function () {
    filt.q = this.value.trim().toLowerCase();
    render();
  });
  [['#fCat','cat'], ['#fState','state']].forEach(function (pair) {
    $(pair[0]).addEventListener('click', function (e) {
      var b = e.target.closest('.seg');
      if (!b) return;
      $$('.seg', this).forEach(function (s) { s.classList.remove('is-on'); });
      b.classList.add('is-on');
      filt[pair[1]] = b.dataset.val;
      render();
    });
  });

  /* ---------------- satır işlemleri ---------------- */
  $('#list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-a]');
    if (!btn) return;
    var id = e.target.closest('.row').dataset.id;
    var p = products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var act = btn.dataset.a;

    if (act === 'toggle') {
      api('/api/admin/toggle/' + encodeURIComponent(id), { method: 'POST' })
        .then(function (j) {
          p.active = j.active;
          render();
          toast(j.active ? p.name + ' yayına alındı' : p.name + ' yayından kaldırıldı');
        }).catch(function (e) { toast(e.message, true); });
      return;
    }

    if (act === 'del') {
      if (!confirm('"' + p.name + '" kalıcı olarak silinsin mi?\n\nGörsel dosyası silinmez.')) return;
      api('/api/admin/product/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () {
          products = products.filter(function (x) { return x.id !== id; });
          render();
          toast(p.name + ' silindi');
        }).catch(function (e) { toast(e.message, true); });
      return;
    }

    if (act === 'up' || act === 'down') {
      var i = products.indexOf(p);
      var j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= products.length) return;
      products.splice(j, 0, products.splice(i, 1)[0]);
      render();
      api('/api/admin/order', {
        method: 'POST',
        body: { ids: products.map(function (x) { return x.id; }) }
      }).catch(function (e) { toast(e.message, true); });
      return;
    }

    if (act === 'edit') openEdit(p);
  });

  /* ---------------- düzenleme ---------------- */
  function fillSelect(sel, list, val, bosMetin) {
    sel.innerHTML = '<option value="">' + bosMetin + '</option>' +
      list.map(function (n) {
        return '<option value="' + esc(n) + '"' + (n === val ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('');
    if (val && list.indexOf(val) < 0) {
      sel.insertAdjacentHTML('beforeend',
        '<option value="' + esc(val) + '" selected>' + esc(val) + ' (dosya yok)</option>');
    }
  }
  function preview(box, folder, name) {
    box.innerHTML = name
      ? '<img src="assets/img/' + folder + '/' + esc(name) + (folder === 'urun' ? '.png' : '.jpg') + '" alt="">'
      : '';
  }

  function openEdit(p) {
    p = p || {};
    $('#mTitle').textContent = p.id ? 'Ürün düzenle' : 'Yeni ürün';
    $('#fId').value      = p.id || '';
    $('#fName').value    = p.name || '';
    $('#fCode').value    = p.code || '';
    $('#fVol').value     = p.vol != null ? p.vol : '';
    $('#fDim').value     = p.dim || '';
    $('#fCatSel').value  = p.cat || 'kase';
    $('#fBox').value     = p.box != null ? p.box : '';
    $('#fBoxDim').value  = p.boxDim || '';
    $('#fTag').value     = p.tag || '';
    $('#fNote').value    = p.note || '';
    $('#fActive').checked = p.active !== false;

    fillSelect($('#fImg'),   images.urun,  p.img   || '', '— görsel seçin —');
    fillSelect($('#fScene'), images.sahne, p.scene || '', '— yok —');
    preview($('#pvImg'),   'urun',  p.img || '');
    preview($('#pvScene'), 'sahne', p.scene || '');

    var has = !!p.lid;
    $('#fHasLid').checked   = has;
    $('#lidBox').hidden     = !has;
    $('#fLidDim').value     = has ? p.lid.dim : '';
    $('#fLidMat').value     = has ? p.lid.mat : 'PET';
    $('#fLidBox').value     = has ? p.lid.box : '';
    $('#fLidBoxDim').value  = has ? p.lid.boxDim : '';

    $('#mErr').textContent = '';
    document.body.classList.add('modal-open');
    $('#modal').setAttribute('aria-hidden', 'false');
    setTimeout(function () { $('#fName').focus(); }, 60);
  }
  function closeEdit() {
    document.body.classList.remove('modal-open');
    $('#modal').setAttribute('aria-hidden', 'true');
  }

  $('#btnNew').addEventListener('click', function () { openEdit(null); });
  $('#modal').addEventListener('click', function (e) { if (e.target.closest('[data-x]')) closeEdit(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('modal-open')) closeEdit();
  });
  $('#fHasLid').addEventListener('change', function () { $('#lidBox').hidden = !this.checked; });
  $('#fImg').addEventListener('change',   function () { preview($('#pvImg'),   'urun',  this.value); });
  $('#fScene').addEventListener('change', function () { preview($('#pvScene'), 'sahne', this.value); });

  /* görsel yükleme */
  function upload(input, folder, sel, box) {
    input.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast('Görsel 8 MB’dan büyük.', true); this.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () {
        var ad = f.name.replace(/\.[^.]+$/, '');
        api('/api/admin/upload', { method: 'POST', body: { klasor: folder, ad: ad, dataUrl: rd.result } })
          .then(function (j) {
            if (images[folder].indexOf(j.ad) < 0) images[folder].push(j.ad);
            images[folder].sort();
            fillSelect(sel, images[folder], j.ad, folder === 'urun' ? '— görsel seçin —' : '— yok —');
            sel.value = j.ad;
            preview(box, folder, j.ad);
            toast('Görsel yüklendi: ' + j.ad);
          })
          .catch(function (e) { toast(e.message, true); });
      };
      rd.readAsDataURL(f);
      this.value = '';
    });
  }
  upload($('#upImg'),   'urun',  $('#fImg'),   $('#pvImg'));
  upload($('#upScene'), 'sahne', $('#fScene'), $('#pvScene'));

  /* kaydet */
  $('#editForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#mErr');
    err.textContent = '';

    var body = {
      id:     $('#fId').value || undefined,
      name:   $('#fName').value.trim(),
      code:   $('#fCode').value.trim(),
      vol:    $('#fVol').value,
      dim:    $('#fDim').value.trim(),
      cat:    $('#fCatSel').value,
      box:    $('#fBox').value,
      boxDim: $('#fBoxDim').value.trim(),
      tag:    $('#fTag').value.trim(),
      note:   $('#fNote').value.trim(),
      img:    $('#fImg').value,
      scene:  $('#fScene').value,
      active: $('#fActive').checked,
      lid:    $('#fHasLid').checked ? {
                dim: $('#fLidDim').value.trim(), mat: $('#fLidMat').value.trim() || 'PET',
                box: $('#fLidBox').value, boxDim: $('#fLidBoxDim').value.trim()
              } : null
    };

    if (!body.name || !body.code || !body.dim) { err.textContent = 'Ad, kod ve ölçü zorunlu.'; return; }
    if (!body.img) { err.textContent = 'Ürün görseli seçin veya yükleyin.'; return; }

    var btn = this.querySelector('button[type=submit]');
    btn.disabled = true;
    api('/api/admin/product', { method: 'POST', body: body })
      .then(function (j) {
        products = j.products;
        render();
        closeEdit();
        toast(body.name + ' kaydedildi');
      })
      .catch(function (e) { err.textContent = e.message; })
      .then(function () { btn.disabled = false; });
  });

  /* ---------------- açılış ---------------- */
  if (token) {
    api('/api/admin/products')
      .then(function () { start(); })
      .catch(function () { logout(); });
  }
})();
