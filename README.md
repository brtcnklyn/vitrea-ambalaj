# VITREA — Sütlü Tatlı Ambalajları

Ürün tanıtım sitesi + yönetim paneli. Node.js dışında hiçbir kurulum gerekmez.

## Çalıştırma

```bash
node C:\Users\user\vitrea\server.js
```

| Adres | Ne |
|---|---|
| http://localhost:8161 | Site |
| http://localhost:8161/admin | Yönetim paneli |

Şifre `data/config.json` içinde (ilk çalıştırmada otomatik oluşur, varsayılan `vitrea2026`).
**Değiştirin** — dosyayı açıp `password` alanını düzenleyin, sunucuyu yeniden başlatın.

Farklı port isterseniz: `set PORT=9000 && node server.js`

## Yönetim paneli

- **Aktif / pasif** — satırın sonundaki anahtar. Pasif ürün sitede görünmez, veriler durur.
- **Düzenle** — kalem simgesi. Ad, kod, hacim, ölçü, kategori, koli bilgileri, rozet,
  açıklama, görseller ve ayrı kapak bilgileri.
- **Yeni ürün** — sağ üstteki buton.
- **Sıralama** — ↑ ↓ okları. Sitedeki kart sırası bu sırayı izler.
- **Sil** — çöp kutusu. Onay ister; görsel dosyası diskte kalır.
- **Görsel yükleme** — düzenleme kutusundaki "Yükle" ile PNG/JPG/WEBP eklenir
  (en fazla 8 MB). Ürün görsellerinin arka planı şeffaf PNG olmalı; kartlar beyaz zeminli.
- **Arama ve filtre** — üst çubuktan ada/koda göre arama, kategori ve durum filtresi.

## Veri nerede duruyor

Kaynak: `data/products.json`. Panelde her değişiklikte bu dosya yazılır ve
`assets/js/products.js` yedeği otomatik yenilenir.

Bu yedek sayesinde site sunucu kapalıyken de (dosyayı doğrudan açarak veya statik
hosting'e atarak) çalışır — yalnızca yönetim paneli sunucu ister.

## Değiştirmeniz gerekenler

Aşağıdakiler yer tutucu:

**1. İletişim bilgileri** — `assets/js/main.js` başında:

```js
var WA_TEL = '905000000000';        // WhatsApp numaranız (başında 90, boşluksuz)
var MAIL   = 'info@vitrea.com.tr';  // teklif e-postanız
```

**2. Aynı bilgiler `index.html` içinde de geçiyor** (iletişim bölümü + footer):
`info@vitrea.com.tr` ve `+90 (000) 000 00 00` ifadelerini arayıp değiştirin.

**3. Admin şifresi** — `data/config.json`.

**4. Marka adı** — "VITREA" uydurma bir isimdir. Değiştirecekseniz `index.html`
içindeki geçtiği yerleri ve ürün kodlarındaki `VT-` önekini güncelleyin.

## Dosyalar

| Yol | Açıklama |
|---|---|
| `server.js` | Sunucu + admin API (bağımlılık yok) |
| `index.html` | Site |
| `admin.html` | Yönetim paneli |
| `data/products.json` | **Ürün verisi — asıl kaynak** |
| `data/config.json` | Admin şifresi |
| `assets/js/products.js` | Otomatik üretilen statik yedek (elle düzenlemeyin) |
| `assets/js/main.js` | Site etkileşimi |
| `assets/js/admin.js` | Panel etkileşimi |
| `assets/css/style.css` · `admin.css` | Tasarım |
| `assets/img/urun/` | Şeffaf ürün görselleri (PNG) |
| `assets/img/sahne/` | Kullanım/sunum fotoğrafları (JPG) |
| `assets/video/` | Hero videosu ve poster kareleri |

## Notlar

- Ölçü, hacim ve koli bilgileri tedarikçi kataloğundaki teknik verilerden alınmıştır;
  siteye fiyat konulmamıştır.
- Ürün ve sunum fotoğrafları tedarikçi kaynaklıdır. Kendi çekimlerinizi yaptırana kadar
  kullanmak isterseniz tedarikçiden yazılı onay almanız yerinde olur.
- Panel yerel ağ içinde kullanılmak üzere tasarlandı: şifre düz metin tutulur ve trafik
  şifresiz akar. Sunucuyu internete açacaksanız önüne HTTPS koyun (Caddy, Nginx vb.)
  ve şifreyi mutlaka değiştirin.
- Form gönderimi arka uç gerektirmez; kullanıcının e-posta uygulamasını açar. Gerçek
  form gönderimi için Formspree / Netlify Forms gibi bir servis eklenebilir.
