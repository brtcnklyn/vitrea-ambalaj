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

/* products.json degistiginde statik yedegi de tazele:
   boylece sunucu kapaliyken index.html yine calisir  */
function syncSeed() {
  const active = db.products.filter(p => p.active !== false);
  const out =
    '/* VITREA — otomatik uretilir, elle duzenlemeyin.\n' +
    '   Kaynak: data/products.json  ·  Duzenleme: /admin\n' +
    '   Uretim: ' + new Date().toISOString() + ' */\n' +
    'window.VITREA_PRODUCTS = ' + JSON.stringify(active, null, 2) + ';\n\n' +
    'window.VITREA_USES = ' + JSON.stringify(db.uses, null, 2) + ';\n';
  fs.writeFileSync(SEED_FILE, out, 'utf8');
}
function save() {
  writeJSON(DATA_FILE, db);
  syncSeed();
}

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
  console.log('\n  VITREA');
  console.log('  ─────────────────────────────────────');
  console.log('  Site   : http://localhost:' + PORT);
  console.log('  Admin  : http://localhost:' + PORT + '/admin');
  console.log('  Ürün   : ' + aktif + ' aktif / ' + db.products.length + ' toplam');
  console.log('  Şifre  : data/config.json içinde\n');
});
