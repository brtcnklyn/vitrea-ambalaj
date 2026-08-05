/* ============================================================
   VITREA — statik site sunucusu + admin API
   Bagimliligi yok: node server.js
   ============================================================ */
'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT      = __dirname;
const DATA_DIR  = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'products.json');
const CFG_FILE  = path.join(DATA_DIR, 'config.json');
const SEED_FILE = path.join(ROOT, 'assets', 'js', 'products.js');
const PORT      = process.env.PORT || 8161;

const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp4':'video/mp4', '.webm':'video/webm', '.ico':'image/x-icon',
  '.woff2':'font/woff2', '.md':'text/markdown; charset=utf-8'
};

/* ---------------- veri katmani ---------------- */
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

let db  = readJSON(DATA_FILE, null);
let cfg = readJSON(CFG_FILE, null);

if (!cfg) {
  cfg = { password: 'vitrea2026' };
  writeJSON(CFG_FILE, cfg);
  console.log('  · data/config.json olusturuldu — admin sifresi: vitrea2026');
}
if (!db) {
  console.error('HATA: data/products.json bulunamadi.');
  process.exit(1);
}

/* kullanicilar ve yorumlar */
const USERS_FILE   = path.join(DATA_DIR, 'users.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const REVIEWS_SEED = path.join(ROOT, 'assets', 'js', 'reviews.js');
let users   = readJSON(USERS_FILE,   { users: [] });
let reviews = readJSON(REVIEWS_FILE, { reviews: [] });

/* products.json degistiginde statik yedegi de tazele:
   boylece sunucu kapaliyken index.html yine calisir  */
function syncSeed() {
  const active = db.products.filter(p => p.active !== false);
  const out =
    '/* VITREAPLAS — otomatik uretilir, elle duzenlemeyin.\n' +
    '   Kaynak: data/products.json  ·  Duzenleme: /admin\n' +
    '   Uretim: ' + new Date().toISOString() + ' */\n' +
    'window.VITREA_PRODUCTS = ' + JSON.stringify(active, null, 2) + ';\n\n' +
    'window.VITREA_USES = ' + JSON.stringify(db.uses, null, 2) + ';\n';
  fs.writeFileSync(SEED_FILE, out, 'utf8');
  syncReviewsSeed();
}
/* onayli yorumlar statik siteye de yazilir */
function syncReviewsSeed() {
  const grouped = {};
  reviews.reviews.filter(r => r.approved).forEach(r => {
    (grouped[r.productId] = grouped[r.productId] || []).push({
      ad: r.ad, rating: r.rating, text: r.text, date: r.date
    });
  });
  fs.writeFileSync(REVIEWS_SEED,
    '/* VITREAPLAS — onayli musteri yorumlari (otomatik uretilir) */\n' +
    'window.VITREAPLAS_REVIEWS = ' + JSON.stringify(grouped, null, 1) + ';\n', 'utf8');
}
function save() {
  writeJSON(DATA_FILE, db);
  syncSeed();
}
function saveUsers()   { writeJSON(USERS_FILE, users); }
function saveReviews() { writeJSON(REVIEWS_FILE, reviews); syncReviewsSeed(); }

/* ---------------- oturum ---------------- */
const tokens = new Map();                       // token -> son kullanim zamani
const TTL = 1000 * 60 * 60 * 12;                // 12 saat

function newToken() {
  const t = crypto.randomBytes(24).toString('hex');
  tokens.set(t, Date.now());
  return t;
}
function authed(req) {
  const h = req.headers.authorization || '';
  const t = h.replace(/^Bearer\s+/i, '');
  if (!t || !tokens.has(t)) return false;
  if (Date.now() - tokens.get(t) > TTL) { tokens.delete(t); return false; }
  tokens.set(t, Date.now());
  return true;
}

/* musteri oturumlari (admin'den ayri) */
const utokens = new Map();                      // token -> { userId, ts }
function newUserToken(userId) {
  const t = crypto.randomBytes(24).toString('hex');
  utokens.set(t, { userId, ts: Date.now() });
  return t;
}
function userAuthed(req) {
  const h = req.headers.authorization || '';
  const t = h.replace(/^Bearer\s+/i, '');
  const s = utokens.get(t);
  if (!s) return null;
  if (Date.now() - s.ts > TTL * 14) { utokens.delete(t); return null; }   // 7 gun
  s.ts = Date.now();
  return users.users.find(u => u.id === s.userId) || null;
}
function hashPw(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 64).toString('hex');
}

/* ---------------- yardimcilar ---------------- */
function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || MIME['.json'],
    'Cache-Control': 'no-store'
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('Dosya cok buyuk (en fazla 12 MB).')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('Gecersiz JSON.')); }
    });
    req.on('error', reject);
  });
}
const slugify = s => String(s || '').toLowerCase()
  .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
  .replace(/ö/g,'o').replace(/ç/g,'c')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 48);

/* gelen urunu temizle/dogrula */
function sanitize(p, existing) {
  const num = (v, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };
  const str = (v, d) => (typeof v === 'string' && v.trim()) ? v.trim() : d;
  const cats = ['kase','bardak','kare','dikdortgen','ozel'];
  const base = existing || {};
  const lid = p.lid && (p.lid.dim || p.lid.box) ? {
    dim: str(p.lid.dim, '—'), mat: str(p.lid.mat, 'PET'),
    box: num(p.lid.box, 0), boxDim: str(p.lid.boxDim, '—')
  } : null;
  return {
    id:     str(p.id, base.id) || slugify(p.name) || ('urun-' + Date.now()),
    code:   str(p.code, base.code || '—'),
    name:   str(p.name, base.name || 'İSİMSİZ'),
    vol:    num(p.vol, base.vol || 0),
    cat:    cats.indexOf(p.cat) >= 0 ? p.cat : (base.cat || 'kase'),
    dim:    str(p.dim, base.dim || '—'),
    box:    num(p.box, base.box || 0),
    boxDim: str(p.boxDim, base.boxDim || '—'),
    lid:    lid,
    img:    str(p.img, base.img || ''),
    scene:  str(p.scene, base.scene || ''),
    tag:    str(p.tag, base.tag || ''),
    note:   str(p.note, base.note || ''),
    active: p.active !== false
  };
}

/* ---------------- statik dosya ---------------- */
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' ) rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';

  const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) return send(res, 403, { error: 'Yasak' });

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Bulunamadı', 'text/plain; charset=utf-8');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {                                  // video icin parcali istek
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end   = m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (start >= st.size) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + st.size });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1
      });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': /\.(png|jpg|jpeg|mp4|webp|woff2)$/i.test(file)
        ? 'public, max-age=86400' : 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------- sunucu ---------------- */
const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  /* --- herkese acik --- */
  if (url === '/api/products') {
    return send(res, 200, {
      products: db.products.filter(p => p.active !== false),
      uses: db.uses
    });
  }

  if (url === '/api/login' && req.method === 'POST') {
    try {
      const b = await readBody(req, 4096);
      if (String(b.password || '') !== String(cfg.password)) {
        return send(res, 401, { error: 'Şifre hatalı.' });
      }
      return send(res, 200, { token: newToken() });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  /* --- musteri hesaplari --- */
  if (url === '/api/register' && req.method === 'POST') {
    try {
      const b = await readBody(req, 8192);
      const ad = String(b.ad || '').trim();
      const email = String(b.email || '').trim().toLowerCase();
      const pw = String(b.password || '');
      if (ad.length < 2)  return send(res, 400, { error: 'Ad Soyad girin.' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Geçerli bir e-posta girin.' });
      if (pw.length < 6)  return send(res, 400, { error: 'Şifre en az 6 karakter olmalı.' });
      if (users.users.some(u => u.email === email)) {
        return send(res, 409, { error: 'Bu e-posta ile zaten bir hesap var. Giriş yapın.' });
      }
      const salt = crypto.randomBytes(16).toString('hex');
      const u = { id: crypto.randomBytes(10).toString('hex'), ad, email,
                  salt, hash: hashPw(pw, salt),
                  purchased: [], created: new Date().toISOString() };
      users.users.push(u);
      saveUsers();
      return send(res, 200, { token: newUserToken(u.id), ad: u.ad, purchased: u.purchased });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  if (url === '/api/user/login' && req.method === 'POST') {
    try {
      const b = await readBody(req, 8192);
      const email = String(b.email || '').trim().toLowerCase();
      const u = users.users.find(x => x.email === email);
      if (!u || hashPw(String(b.password || ''), u.salt) !== u.hash) {
        return send(res, 401, { error: 'E-posta veya şifre hatalı.' });
      }
      return send(res, 200, { token: newUserToken(u.id), ad: u.ad, purchased: u.purchased });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  if (url === '/api/me') {
    const u = userAuthed(req);
    if (!u) return send(res, 401, { error: 'Oturum yok.' });
    return send(res, 200, { ad: u.ad, email: u.email, purchased: u.purchased });
  }

  /* yorum gonder — yalnizca o urunu satin almis musteriler */
  if (url === '/api/review' && req.method === 'POST') {
    const u = userAuthed(req);
    if (!u) return send(res, 401, { error: 'Yorum yazmak için giriş yapın.' });
    try {
      const b = await readBody(req, 16384);
      const pid = String(b.productId || '');
      if (!db.products.some(p => p.id === pid)) {
        return send(res, 404, { error: 'Ürün bulunamadı.' });
      }
      if ((u.purchased || []).indexOf(pid) < 0) {
        return send(res, 403, { error: 'Bu ürüne yalnızca satın almış müşteriler yorum yapabilir. ' +
          'Siparişiniz varsa hesabınızın tanımlanması için bize WhatsApp\'tan yazın.' });
      }
      const rating = Math.min(5, Math.max(1, parseInt(b.rating, 10) || 0));
      const text = String(b.text || '').trim().slice(0, 600);
      if (!rating) return send(res, 400, { error: 'Puan seçin (1–5).' });
      if (text.length < 3) return send(res, 400, { error: 'Kısa da olsa bir yorum yazın.' });
      if (reviews.reviews.some(r => r.userId === u.id && r.productId === pid)) {
        return send(res, 409, { error: 'Bu ürüne zaten yorum yaptınız.' });
      }
      reviews.reviews.push({
        id: crypto.randomBytes(8).toString('hex'), productId: pid, userId: u.id,
        ad: u.ad, rating, text, date: new Date().toISOString().slice(0, 10),
        approved: false
      });
      saveReviews();
      return send(res, 200, { ok: true, pending: true });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  /* --- admin (yetki gerekli) --- */
  if (url.startsWith('/api/admin/')) {
    if (!authed(req)) return send(res, 401, { error: 'Oturum geçersiz. Yeniden giriş yapın.' });

    try {
      /* tum urunler (pasifler dahil) */
      if (url === '/api/admin/products' && req.method === 'GET') {
        return send(res, 200, { products: db.products });
      }

      /* ekle / guncelle */
      if (url === '/api/admin/product' && req.method === 'POST') {
        const b = await readBody(req);
        const i = db.products.findIndex(p => p.id === b.id);
        if (i >= 0) {
          db.products[i] = sanitize(b, db.products[i]);
        } else {
          const p = sanitize(b, null);
          if (db.products.some(x => x.id === p.id)) p.id = p.id + '-' + Date.now().toString(36);
          db.products.unshift(p);
        }
        save();
        return send(res, 200, { ok: true, products: db.products });
      }

      /* aktif / pasif */
      if (url.startsWith('/api/admin/toggle/') && req.method === 'POST') {
        const id = decodeURIComponent(url.split('/').pop());
        const p = db.products.find(x => x.id === id);
        if (!p) return send(res, 404, { error: 'Ürün bulunamadı.' });
        p.active = p.active === false;
        save();
        return send(res, 200, { ok: true, active: p.active });
      }

      /* sil */
      if (url.startsWith('/api/admin/product/') && req.method === 'DELETE') {
        const id = decodeURIComponent(url.split('/').pop());
        const n = db.products.length;
        db.products = db.products.filter(x => x.id !== id);
        if (db.products.length === n) return send(res, 404, { error: 'Ürün bulunamadı.' });
        save();
        return send(res, 200, { ok: true });
      }

      /* sirala */
      if (url === '/api/admin/order' && req.method === 'POST') {
        const b = await readBody(req);
        const map = new Map(db.products.map(p => [p.id, p]));
        const next = [];
        (b.ids || []).forEach(id => { if (map.has(id)) { next.push(map.get(id)); map.delete(id); } });
        map.forEach(p => next.push(p));
        db.products = next;
        save();
        return send(res, 200, { ok: true });
      }

      /* mevcut gorseller */
      if (url === '/api/admin/images' && req.method === 'GET') {
        const ls = d => { try { return fs.readdirSync(path.join(ROOT, 'assets', 'img', d))
          .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
          .map(f => f.replace(/\.[^.]+$/, '')).sort(); } catch (e) { return []; } };
        return send(res, 200, { urun: ls('urun'), sahne: ls('sahne') });
      }

      /* gorsel yukle  {klasor:'urun'|'sahne', ad, dataUrl} */
      if (url === '/api/admin/upload' && req.method === 'POST') {
        const b = await readBody(req);
        const folder = b.klasor === 'sahne' ? 'sahne' : 'urun';
        const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(b.dataUrl || '');
        if (!m) return send(res, 400, { error: 'Yalnızca PNG, JPG veya WEBP yükleyebilirsiniz.' });
        const ext = m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase();
        const name = slugify(b.ad) || ('gorsel-' + Date.now().toString(36));
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length > 8 * 1024 * 1024) return send(res, 400, { error: 'Görsel 8 MB’dan büyük.' });
        const dir = path.join(ROOT, 'assets', 'img', folder);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, name + '.' + (ext === 'jpeg' ? 'jpg' : ext)), buf);
        return send(res, 200, { ok: true, ad: name, klasor: folder });
      }

      /* --- musteriler --- */
      if (url === '/api/admin/users' && req.method === 'GET') {
        return send(res, 200, { users: users.users.map(u => ({
          id: u.id, ad: u.ad, email: u.email, purchased: u.purchased, created: u.created
        })) });
      }
      if (url === '/api/admin/purchase' && req.method === 'POST') {
        const b = await readBody(req, 32768);
        const u = users.users.find(x => x.id === b.userId);
        if (!u) return send(res, 404, { error: 'Müşteri bulunamadı.' });
        u.purchased = (Array.isArray(b.productIds) ? b.productIds : [])
          .filter(id => db.products.some(p => p.id === id));
        saveUsers();
        return send(res, 200, { ok: true, purchased: u.purchased });
      }

      /* --- yorumlar --- */
      if (url === '/api/admin/reviews' && req.method === 'GET') {
        return send(res, 200, { reviews: reviews.reviews });
      }
      if (url.startsWith('/api/admin/review-approve/') && req.method === 'POST') {
        const id = url.split('/').pop();
        const r = reviews.reviews.find(x => x.id === id);
        if (!r) return send(res, 404, { error: 'Yorum bulunamadı.' });
        r.approved = !r.approved;
        saveReviews();
        return send(res, 200, { ok: true, approved: r.approved });
      }
      if (url.startsWith('/api/admin/review/') && req.method === 'DELETE') {
        const id = url.split('/').pop();
        const n = reviews.reviews.length;
        reviews.reviews = reviews.reviews.filter(x => x.id !== id);
        if (reviews.reviews.length === n) return send(res, 404, { error: 'Yorum bulunamadı.' });
        saveReviews();
        return send(res, 200, { ok: true });
      }

      return send(res, 404, { error: 'Bilinmeyen istek.' });
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }

  if (url.startsWith('/api/')) return send(res, 404, { error: 'Bilinmeyen istek.' });

  /* --- statik --- */
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  syncSeed();
  const aktif = db.products.filter(p => p.active !== false).length;
  console.log('\n  VITREAPLAS');
  console.log('  ─────────────────────────────────────');
  console.log('  Site   : http://localhost:' + PORT);
  console.log('  Admin  : http://localhost:' + PORT + '/admin');
  console.log('  Ürün   : ' + aktif + ' aktif / ' + db.products.length + ' toplam');
  console.log('  Şifre  : data/config.json içinde\n');
});
