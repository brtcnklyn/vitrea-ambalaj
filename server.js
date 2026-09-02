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

/* ---- fiyat katmani (GIZLI: yalnizca admin, statik siteye ASLA yazilmaz) ---- */
const MAYER_FILE  = path.join(DATA_DIR, 'mayer-fiyat.json');
const AYAR_FILE   = path.join(DATA_DIR, 'fiyat-ayar.json');
const LISTE_FILE  = path.join(DATA_DIR, 'fiyat-listeleri.json');

/* satis fiyatlari + populer secimi -> BUNLAR SITEDE YAYINLANIR (perakende fiyat) */
const SATIS_FILE   = path.join(DATA_DIR, 'satis-fiyat.json');
const SIPARIS_FILE = path.join(DATA_DIR, 'siparisler.json');

let mayer  = readJSON(MAYER_FILE,  { guncelleme: '', kaynak: '', kalemler: [] });
let ayar   = readJSON(AYAR_FILE,   null);
let liste  = readJSON(LISTE_FILE,  { listeler: [] });
let satis    = readJSON(SATIS_FILE,   { urunler: {} });   // id -> {fiyat, elle, populer}
let siparis  = readJSON(SIPARIS_FILE, { siparisler: [] });

if (!ayar) {
  ayar = { kdv: 20, iskonto: 35, kar: 50, yuvarla: true };   // varsayilan hesap ayarlari
  writeJSON(AYAR_FILE, ayar);
}
function saveMayer()  { writeJSON(MAYER_FILE, mayer); }
function saveAyar()   { writeJSON(AYAR_FILE, ayar); }
function saveListe()  { writeJSON(LISTE_FILE, liste); }
function saveSatis()   { writeJSON(SATIS_FILE, satis); syncSeed(); }
function saveSiparis() { writeJSON(SIPARIS_FILE, siparis); }

/* ---- Mayer katalogunu canli cekip ayristir ----
   Kaynak: kategori listesi. Kart yapisi:
   <div class="name"><a ...product_id=N>BASLIK</a></div> ... <div class="price">FIYAT</div> */
/* Mayer kategorileri: 81 sütlü tatlı · 82 kurabiye · 83 bal · 84 lokum & draje.
   Bir ürün birden fazla kategoride olabilir; site filtreleri bu ayrımı kullanır. */
const MAYER_KAT = { '81': 'sutlu', '82': 'kurabiye', '83': 'bal', '84': 'lokum' };
const MAYER_PATHS = Object.keys(MAYER_KAT);
const MAYER_URL = MAYER_PATHS
  .map(p => 'https://mayerplastik.com.tr/index.php?route=product/category&path=' + p + '&limit=200')
  .join(' + ');
const MAYER_UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                  '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const HARF_TR = 'A-Za-zÇĞİÖŞÜçğıöşü';

function metinTemizle(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ').trim();
}
function fiyatOku(s) {
  const m = /([\d.]+,\d{2})\s*TL/.exec(s);
  return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null;
}

const bekle = ms => new Promise(r => setTimeout(r, ms));

/* Mayer ara sira baglantiyi dusuruyor: her sayfa 3 kez denenir. */
async function mayerSayfa(path, deneme = 0) {
  const u = 'https://mayerplastik.com.tr/index.php?route=product/category&path=' + path + '&limit=200';
  try {
    const r = await fetch(u, {
      headers: { 'User-Agent': MAYER_UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } catch (e) {
    if (deneme < 2) { await bekle(1200 * (deneme + 1)); return mayerSayfa(path, deneme + 1); }
    throw new Error('path=' + path + ': ' + e.message);
  }
}

async function mayerCek() {
  /* Sirayla cekilir (es zamanli istek Mayer'i zorluyor). Bir kategori
     alinamazsa digerleri yine islenir; hicbiri gelmezse hata verilir. */
  const sayfalar = [];
  const hatalar = [];
  for (const p of MAYER_PATHS) {
    try { sayfalar.push(await mayerSayfa(p)); }
    catch (e) { hatalar.push(e.message); }
    await bekle(400);
  }
  if (!sayfalar.length) throw new Error(hatalar.join(' · '));
  const html = sayfalar.join('\n');

  const kartRe = /<div class="name"><a href="[^"]*product_id=(\d+)[^"]*">([\s\S]*?)<\/a><\/div>[\s\S]*?<div class="price">([\s\S]*?)<\/div>/g;
  const kapakRe = new RegExp('(DÜZ|BOMBE)?\\s*KAPAK(?![' + HARF_TR + '])', 'i');
  const bulunan = new Map();
  let m;

  while ((m = kartRe.exec(html)) !== null) {
    const baslik = metinTemizle(m[2]);
    const fiyat  = fiyatOku(metinTemizle(m[3]));
    const kk = /^MAY\s*(\d+)\s*([\s\S]*)$/i.exec(baslik);
    if (!kk || fiyat == null) continue;

    const kod = 'MAY ' + kk[1];
    const kalan = kk[2];
    const adet = /KOL[İI]\s*İ?I?Ç[İI]\s*(\d+)\s*ADET/i.exec(kalan);
    const cc   = /(\d+)\s*CC/i.exec(kalan);
    const kap  = kapakRe.exec(kalan);

    let ad = kalan;
    [/\(YEN[İI]\)/ig, /\d+\s*CC/ig, new RegExp(kapakRe.source, 'ig'),
     /KAPAKLI KUTU/ig, /KOL[İI][\s\S]*$/i, /^[-\s]+/]
      .forEach(p => { ad = ad.replace(p, ' '); });
    ad = ad.replace(/\s+/g, ' ').replace(/^[-\s]+|[-\s]+$/g, '');

    const tip = kap ? 'kapak' : 'govde';
    const varyant = (kap && kap[1]) ? kap[1].toUpperCase() : '';
    const anahtar = kod + '|' + tip + '|' + varyant;
    if (bulunan.has(anahtar)) continue;
    bulunan.set(anahtar, {
      pid: parseInt(m[1], 10), kod, ad: ad || '—', tip, varyant,
      cc: cc ? parseInt(cc[1], 10) : null,
      koliAdet: adet ? parseInt(adet[1], 10) : null,
      koliFiyat: fiyat, baslik
    });
  }
  if (!bulunan.size) throw new Error('Sayfa okundu ama ürün bulunamadı — site yapısı değişmiş olabilir.');
  return bulunan;
}

/* mevcut veri ile karsilastir: yeni / degisen / listeden dusen */
function mayerFark(bulunan) {
  const key = k => k.kod + '|' + k.tip + '|' + (k.varyant || '');
  const eski = new Map(mayer.kalemler.map(k => [key(k), k]));
  const yeni = [], degisen = [], dusen = [];

  bulunan.forEach((y, a) => {
    const e = eski.get(a);
    if (!e) { yeni.push(y); return; }
    if (e.koliFiyat !== y.koliFiyat || e.koliAdet !== y.koliAdet) {
      degisen.push({
        kod: y.kod, ad: y.ad, tip: y.tip, varyant: y.varyant,
        eskiFiyat: e.koliFiyat, yeniFiyat: y.koliFiyat,
        eskiAdet: e.koliAdet, yeniAdet: y.koliAdet
      });
    }
  });
  eski.forEach((e, a) => { if (!bulunan.has(a)) dusen.push(e); });
  return { yeni, degisen, dusen };
}

/* Mayer koli fiyatindan bizim satis fiyatimiz:
   mayerAdet (KDV dahil) -> KDV cikar -> iskonto uygula -> kar marji ekle -> yuvarla */
function hesapla(koliFiyat, koliAdet, a) {
  if (!koliFiyat || !koliAdet) return null;
  const mayerAdet = koliFiyat / koliAdet;                 // Mayer adet, KDV dahil
  const alisHaric = mayerAdet / (1 + a.kdv / 100);        // KDV haric alis
  const iskontolu = alisHaric * (1 - a.iskonto / 100);    // iskonto sonrasi maliyet
  let satisHaric  = iskontolu * (1 + a.kar / 100);        // kar marji eklenmis
  if (a.yuvarla) satisHaric = Math.ceil(satisHaric);
  const satisDahil = satisHaric * (1 + a.kdv / 100);
  return {
    mayerAdet, alisHaric, maliyet: iskontolu,
    satisHaric, satisDahil, koliDahil: satisDahil * koliAdet
  };
}

/* products.json degistiginde statik yedegi de tazele:
   boylece sunucu kapaliyken index.html yine calisir  */
/* Bir urunun SATIS fiyati (adet, KDV haric).
   Once elle girilen fiyat, yoksa Mayer alisindan iskonto+kar ile hesaplanan. */
function satisFiyat(p) {
  const s = satis.urunler[p.id] || {};
  if (s.elle && typeof s.fiyat === 'number' && s.fiyat > 0) {
    return { haric: s.fiyat, elle: true };
  }
  const kod = p.mayerKod || p.code;
  const k = mayer.kalemler.find(x => x.kod === kod && x.tip === 'govde');
  const c = k && hesapla(k.koliFiyat, k.koliAdet, ayar);
  return c ? { haric: c.satisHaric, elle: false } : { haric: 0, elle: false };
}

/* Siteye gidecek urun listesi: yalnizca PERAKENDE satis fiyati eklenir;
   alis fiyati / iskonto / kar ASLA disari cikmaz.
   Hem statik yedek (products.js) hem /api/products bunu kullanir ki
   sunucu acikken ve kapaliyken site ayni veriyi gorsun. */
function yayinUrunleri() {
  return db.products.filter(p => p.active !== false).map(p => {
    const f = satisFiyat(p);
    const s = satis.urunler[p.id] || {};
    return {
      ...p,
      fiyat: Math.round(f.haric * 100) / 100,                          // adet, KDV haric
      fiyatKdv: Math.round(f.haric * (1 + ayar.kdv / 100) * 100) / 100, // adet, KDV dahil
      populer: s.populer === true
    };
  });
}

function syncSeed() {
  const active = yayinUrunleri();
  const out =
    '/* VITREAPLAS — otomatik uretilir, elle duzenlemeyin.\n' +
    '   Kaynak: data/products.json  ·  Duzenleme: /admin\n' +
    '   Fiyatlar perakende satis fiyatidir; alis fiyati bu dosyada YOKTUR.\n' +
    '   Uretim: ' + new Date().toISOString() + ' */\n' +
    'window.VITREA_PRODUCTS = ' + JSON.stringify(active, null, 2) + ';\n\n' +
    'window.VITREA_USES = ' + JSON.stringify(db.uses, null, 2) + ';\n\n' +
    'window.VITREA_KDV = ' + (ayar.kdv || 20) + ';\n';
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
    id:       str(p.id, base.id) || slugify(p.name) || ('urun-' + Date.now()),
    code:     str(p.code, base.code || '—'),
    mayerKod: str(p.mayerKod, base.mayerKod || str(p.code, base.code || '')),
    kategoriler: Array.isArray(p.kategoriler) && p.kategoriler.length
                 ? p.kategoriler : (base.kategoriler || ['sutlu']),
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

  /* data/ klasörü ASLA statik servis edilmez: admin şifresi, müşteri kayıtları,
     tedarikçi alış fiyatları burada. Yalnızca /api/admin/* üzerinden, token ile. */
  if (file === DATA_DIR || file.startsWith(DATA_DIR + path.sep)) {
    return send(res, 403, { error: 'Yasak' });
  }

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

  /* Site "sunucu var mi" diye buraya bakar. GitHub Pages'te 404 doner,
     uyelik / siparis bolumleri gizlenir; burada 200 doner, acilir. */
  if (url === '/api/durum') {
    return send(res, 200, { ok: true, uyelik: true, siparis: true, kdv: ayar.kdv });
  }

  if (url === '/api/products') {
    return send(res, 200, {
      products: yayinUrunleri(),
      uses: db.uses,
      kdv: ayar.kdv
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

  /* --- SIPARIS: musteri tarafi --- */

  /* sipariş oluştur — üyelik zorunlu degil (misafir siparisi serbest) */
  if (url === '/api/siparis' && req.method === 'POST') {
    try {
      const b = await readBody(req, 256 * 1024);
      const u = userAuthed(req);                       // varsa uye, yoksa misafir
      const kalemler = (Array.isArray(b.kalemler) ? b.kalemler : []).slice(0, 100)
        .map(k => {
          const p = db.products.find(x => x.id === k.id);
          if (!p) return null;
          const adet = Math.max(1, Math.min(100000, parseInt(k.adet, 10) || 0));
          const birim = satisFiyat(p).haric;
          return { id: p.id, kod: p.code, ad: p.name, vol: p.vol,
                   adet, birim: Math.round(birim * 100) / 100,
                   tutar: Math.round(birim * adet * 100) / 100 };
        }).filter(Boolean);

      if (!kalemler.length) return send(res, 400, { error: 'Sepetiniz boş.' });

      const ad   = String(b.ad || '').trim();
      const tel  = String(b.tel || '').trim();
      if (ad.length < 2)  return send(res, 400, { error: 'Ad Soyad girin.' });
      if (tel.length < 7) return send(res, 400, { error: 'Telefon girin.' });

      const araToplam = kalemler.reduce((t, k) => t + k.tutar, 0);
      const kdvTutar  = araToplam * (ayar.kdv / 100);
      const no = 'VP' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' +
                 crypto.randomBytes(2).toString('hex').toUpperCase();

      const kayit = {
        no,
        userId: u ? u.id : null,
        ad, tel,
        email: String(b.email || '').trim().slice(0, 120),
        firma: String(b.firma || '').trim().slice(0, 120),
        adres: String(b.adres || '').trim().slice(0, 600),
        not:   String(b.not || '').trim().slice(0, 600),
        kalemler,
        araToplam: Math.round(araToplam * 100) / 100,
        kdv: ayar.kdv,
        kdvTutar: Math.round(kdvTutar * 100) / 100,
        toplam: Math.round((araToplam + kdvTutar) * 100) / 100,
        durum: 'Alındı',
        odeme: 'WhatsApp ile mutabakat',
        tarih: new Date().toISOString(),
        gecmis: [{ durum: 'Alındı', tarih: new Date().toISOString() }]
      };
      siparis.siparisler.unshift(kayit);
      saveSiparis();
      return send(res, 200, { ok: true, siparis: kayit });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  /* uyenin kendi siparisleri */
  if (url === '/api/siparislerim') {
    const u = userAuthed(req);
    if (!u) return send(res, 401, { error: 'Siparişlerinizi görmek için giriş yapın.' });
    return send(res, 200, {
      siparisler: siparis.siparisler.filter(s => s.userId === u.id)
    });
  }

  /* siparis no + telefon ile takip (uyelik gerekmez) */
  if (url.startsWith('/api/siparis-takip')) {
    const q = new URL(url, 'http://x').searchParams;
    const no  = String(q.get('no') || '').trim().toUpperCase();
    const tel = String(q.get('tel') || '').replace(/\D/g, '');
    const s = siparis.siparisler.find(x => x.no === no);
    if (!s || !tel || s.tel.replace(/\D/g, '').slice(-7) !== tel.slice(-7)) {
      return send(res, 404, { error: 'Sipariş bulunamadı. Numara ve telefonu kontrol edin.' });
    }
    return send(res, 200, { siparis: s });
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

      /* --- FIYAT: Mayer alis fiyatlari (gizli) --- */
      if (url === '/api/admin/fiyat' && req.method === 'GET') {
        const kalemler = mayer.kalemler.map(k => ({
          ...k, hesap: hesapla(k.koliFiyat, k.koliAdet, ayar)
        }));
        /* site urunlerini mayerKod uzerinden esle */
        const urunler = db.products.map(p => ({
          id: p.id, code: p.code, name: p.name, vol: p.vol, cat: p.cat,
          box: p.box, img: p.img, active: p.active !== false,
          mayerKod: p.mayerKod || p.code
        }));
        return send(res, 200, {
          guncelleme: mayer.guncelleme, kaynak: mayer.kaynak,
          ayar, kalemler, urunler
        });
      }

      /* hesap ayarlarini guncelle */
      if (url === '/api/admin/fiyat-ayar' && req.method === 'POST') {
        const b = await readBody(req, 4096);
        const s = (v, d, min, max) => {
          const n = parseFloat(v);
          return isNaN(n) ? d : Math.min(max, Math.max(min, n));
        };
        ayar = {
          kdv:     s(b.kdv,     ayar.kdv,     0, 100),
          iskonto: s(b.iskonto, ayar.iskonto, 0, 95),
          kar:     s(b.kar,     ayar.kar,   -50, 500),
          yuvarla: b.yuvarla !== false
        };
        saveAyar();
        syncSeed();                     // satis fiyatlari degisti -> statik yedegi tazele
        return send(res, 200, { ok: true, ayar });
      }

      /* tek kalemin Mayer fiyatini/koli adedini elle duzelt */
      if (url === '/api/admin/fiyat-kalem' && req.method === 'POST') {
        const b = await readBody(req, 8192);
        const k = mayer.kalemler.find(x =>
          x.kod === b.kod && x.tip === (b.tip || 'govde') && (x.varyant || '') === (b.varyant || ''));
        if (!k) return send(res, 404, { error: 'Kalem bulunamadı.' });
        const f = parseFloat(b.koliFiyat), a = parseInt(b.koliAdet, 10);
        if (!isNaN(f) && f >= 0) k.koliFiyat = f;
        if (!isNaN(a) && a > 0)  k.koliAdet  = a;
        mayer.guncelleme = new Date().toISOString().slice(0, 10);
        saveMayer();
        syncSeed();
        return send(res, 200, { ok: true, kalem: { ...k, hesap: hesapla(k.koliFiyat, k.koliAdet, ayar) } });
      }

      /* Mayer'den canli fiyat cek.
         {uygula:false} -> yalnizca farki dondurur (onizleme)
         {uygula:true}  -> farki uygular ve kaydeder */
      if (url === '/api/admin/fiyat-cek' && req.method === 'POST') {
        const b = await readBody(req, 4096);
        let bulunan;
        try {
          bulunan = await mayerCek();
        } catch (e) {
          return send(res, 502, { error: 'Mayer sitesine ulaşılamadı: ' + e.message });
        }
        const fark = mayerFark(bulunan);

        if (!b.uygula) {
          return send(res, 200, { onizleme: true, bulunanSayi: bulunan.size, ...fark });
        }

        /* uygula: fiyat ve koli adedini guncelle, yeni kalemleri ekle.
           Listeden dusenler SILINMEZ — elle satilan/eski urunler kaybolmasin. */
        const key = k => k.kod + '|' + k.tip + '|' + (k.varyant || '');
        const idx = new Map(mayer.kalemler.map((k, i) => [key(k), i]));
        bulunan.forEach((y, a) => {
          if (idx.has(a)) {
            const k = mayer.kalemler[idx.get(a)];
            k.koliFiyat = y.koliFiyat;
            k.koliAdet  = y.koliAdet;
            k.ad = y.ad; k.cc = y.cc; k.baslik = y.baslik; k.pid = y.pid;
          } else {
            mayer.kalemler.push(y);
          }
        });
        mayer.kalemler.sort((a, c) =>
          (parseInt(a.kod.split(' ')[1], 10) - parseInt(c.kod.split(' ')[1], 10)) ||
          a.tip.localeCompare(c.tip) || (a.varyant || '').localeCompare(c.varyant || ''));
        mayer.guncelleme = new Date().toISOString().slice(0, 10);
        mayer.kaynak = MAYER_URL;
        saveMayer();
        syncSeed();
        return send(res, 200, {
          ok: true, guncelleme: mayer.guncelleme, bulunanSayi: bulunan.size, ...fark
        });
      }

      /* --- SATIS FIYATLARI (sitede gorunen) + populer secimi --- */
      if (url === '/api/admin/satis' && req.method === 'GET') {
        return send(res, 200, {
          kdv: ayar.kdv,
          urunler: db.products.map(p => {
            const f = satisFiyat(p);
            const s = satis.urunler[p.id] || {};
            const kod = p.mayerKod || p.code;
            const k = mayer.kalemler.find(x => x.kod === kod && x.tip === 'govde');
            const c = k && hesapla(k.koliFiyat, k.koliAdet, ayar);
            return {
              id: p.id, code: p.code, name: p.name, vol: p.vol, cat: p.cat,
              img: p.img, box: p.box, active: p.active !== false,
              hesaplanan: c ? Math.round(c.satisHaric * 100) / 100 : null,
              fiyat: Math.round(f.haric * 100) / 100,
              elle: f.elle, populer: s.populer === true
            };
          })
        });
      }

      /* tek urunun satis fiyatini / populer isaretini degistir */
      if (url === '/api/admin/satis-urun' && req.method === 'POST') {
        const b = await readBody(req, 8192);
        const p = db.products.find(x => x.id === b.id);
        if (!p) return send(res, 404, { error: 'Ürün bulunamadı.' });
        const s = satis.urunler[p.id] || {};
        if ('populer' in b) s.populer = b.populer === true;
        if ('elle' in b && b.elle === false) { delete s.fiyat; s.elle = false; }
        else if ('fiyat' in b) {
          const f = parseFloat(b.fiyat);
          if (isNaN(f) || f < 0) return send(res, 400, { error: 'Geçersiz fiyat.' });
          s.fiyat = Math.round(f * 100) / 100;
          s.elle = true;
        }
        satis.urunler[p.id] = s;
        saveSatis();
        const y = satisFiyat(p);
        return send(res, 200, {
          ok: true,
          urun: { id: p.id, fiyat: Math.round(y.haric * 100) / 100,
                  elle: y.elle, populer: s.populer === true }
        });
      }

      /* --- SIPARISLER --- */
      if (url === '/api/admin/siparisler' && req.method === 'GET') {
        return send(res, 200, { siparisler: siparis.siparisler });
      }
      if (url.startsWith('/api/admin/siparis-durum/') && req.method === 'POST') {
        const no = decodeURIComponent(url.split('/').pop());
        const b = await readBody(req, 4096);
        const s = siparis.siparisler.find(x => x.no === no);
        if (!s) return send(res, 404, { error: 'Sipariş bulunamadı.' });
        const gecerli = ['Alındı', 'Hazırlanıyor', 'Kargoda', 'Teslim edildi', 'İptal'];
        if (gecerli.indexOf(b.durum) < 0) return send(res, 400, { error: 'Geçersiz durum.' });
        s.durum = b.durum;
        s.gecmis = s.gecmis || [];
        s.gecmis.push({ durum: b.durum, tarih: new Date().toISOString() });
        if (b.kargo) s.kargo = String(b.kargo).slice(0, 120);
        saveSiparis();
        return send(res, 200, { ok: true, siparis: s });
      }

      /* --- FIYAT: kaydedilmis musteri listeleri --- */
      if (url === '/api/admin/listeler' && req.method === 'GET') {
        return send(res, 200, { listeler: liste.listeler });
      }

      if (url === '/api/admin/liste' && req.method === 'POST') {
        const b = await readBody(req, 512 * 1024);
        const kayit = {
          id: String(b.id || '') || crypto.randomBytes(8).toString('hex'),
          baslik: String(b.baslik || 'Fiyat listesi').trim().slice(0, 120),
          musteri: String(b.musteri || '').trim().slice(0, 120),
          not: String(b.not || '').trim().slice(0, 600),
          ayar: b.ayar || ayar,
          satirlar: (Array.isArray(b.satirlar) ? b.satirlar : []).slice(0, 300).map(s => ({
            kod: String(s.kod || '').slice(0, 40),
            ad: String(s.ad || '').slice(0, 80),
            aciklama: String(s.aciklama || '').slice(0, 120),
            koliAdet: parseInt(s.koliAdet, 10) || 0,
            fiyat: parseFloat(s.fiyat) || 0,          // adet, KDV haric
            elle: s.elle === true                     // fiyat elle girildi mi
          })),
          tarih: new Date().toISOString().slice(0, 10)
        };
        const i = liste.listeler.findIndex(x => x.id === kayit.id);
        if (i >= 0) liste.listeler[i] = kayit; else liste.listeler.unshift(kayit);
        saveListe();
        return send(res, 200, { ok: true, liste: kayit, listeler: liste.listeler });
      }

      if (url.startsWith('/api/admin/liste/') && req.method === 'DELETE') {
        const id = decodeURIComponent(url.split('/').pop());
        const n = liste.listeler.length;
        liste.listeler = liste.listeler.filter(x => x.id !== id);
        if (liste.listeler.length === n) return send(res, 404, { error: 'Liste bulunamadı.' });
        saveListe();
        return send(res, 200, { ok: true, listeler: liste.listeler });
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
