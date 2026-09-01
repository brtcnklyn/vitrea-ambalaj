# VITREAPLAS — Sütlü Tatlı Ambalajları

**Canlı site: https://brtcnklyn.github.io/vitrea-ambalaj/** · Alan adı: **vitreaplas.com** (bağlanacak, aşağıya bakın)

Ürün tanıtım sitesi + yönetim paneli. Node.js dışında hiçbir kurulum gerekmez.

## Yayın (GitHub Pages)

Yayındaki site `main` dalının kökünden servis edilir. Değişikliği yayına almak için:

```bash
cd D:\claud\vitrea
git add -A
git commit -m "urun guncellemesi"
git push
```

Push'tan ~1 dakika sonra site güncellenir.

> Yönetim paneli yayındaki adreste **çalışmaz** — sunucu ister. Panelde yaptığınız
> değişiklikler `data/products.json` ve `assets/js/products.js` dosyalarına yazılır;
> yayına almak için yukarıdaki üç komutu çalıştırmanız yeterli.

## Çalıştırma (kendi bilgisayarınızda)

```bash
node D:\claud\vitrea\server.js
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

## İletişim bilgileri

Telefon / WhatsApp **+90 534 843 31 88** olarak ayarlı. Geçtiği yerler:

| Bilgi | Dosya |
|---|---|
| WhatsApp numarası (tüm bağlantılar) | `assets/js/main.js` → `WA_TEL` |
| Telefon (iletişim bölümü + footer) | `index.html` |

**Sitede e-posta yok.** İletişimin tamamı WhatsApp'a gider: iletişim formu doldurulup
gönderildiğinde alanlar mesaj metnine dizilip `wa.me` üzerinden WhatsApp'ta açılır, ürün
panelindeki "teklif al" düğmesi de o ürünün adı ve koduyla WhatsApp'ı açar. Numarayı
değiştirmek için tek yer `WA_TEL`.

## vitreaplas.com'u siteye bağlama

1. Alan adı sağlayıcınızın DNS panelinde şu kayıtları ekleyin:
   - `A` kaydı, host `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (4 ayrı A kaydı)
   - `CNAME` kaydı, host `www` → `brtcnklyn.github.io`
2. DNS yayıldıktan sonra (birkaç saat sürebilir) GitHub'da:
   github.com/brtcnklyn/vitrea-ambalaj → Settings → Pages → Custom domain →
   `vitreaplas.com` yazıp Save; "Enforce HTTPS" işaretleyin.
3. Bu işlem depoya bir `CNAME` dosyası ekler; ondan sonra site hem
   vitreaplas.com hem www.vitreaplas.com adresinden açılır.

> DNS kayıtlarını ekledikten sonra bana "domaini bağla" demeniz yeterli; 2. adımı ben yaparım.

## Diğer değiştirebilecekleriniz

**Admin şifresi** — `data/config.json`.

**Logo** — `assets/img/logo-mark.svg` (koyu zemin) ve `logo-mark-dark.svg` (açık zemin).
PNG kopyaları `assets/img/logo-*.png`.

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
- Form gönderimi arka uç gerektirmez; alanları mesaja dizip WhatsApp'ı açar. Bu yüzden
  GitHub Pages'teki statik sitede de sorunsuz çalışır.

## Fiyat sayfaları (yalnızca yerelde)

Panelde iki sekme var ve **ikisi de yalnızca kendi bilgisayarınızda**, `node server.js`
çalışırken açılır. Yayınlanan sitede yoktur.

| Sekme | Ne yapar |
|---|---|
| **Alış Fiyatları** | Mayer'in tüm kataloğu (gövde + kapak) koli fiyatı ve koli adediyle. KDV, iskonto ve kâr marjını girersiniz; satış fiyatı anında hesaplanır. Koli fiyatı/adedi değişirse satırda elle düzeltirsiniz. |
| **Fiyat Listesi Yap** | İstediğiniz ürünleri seçip müşteriye özel liste kurarsınız. Fiyatlar ayarlardan hesaplanır, istediğiniz satırda elle değiştirebilirsiniz. Liste kaydedilir; "PDF / Yazdır" ile önizleme açılır, yazdır penceresinde **Hedef: PDF olarak kaydet** seçersiniz. |

Hesap zinciri: `Mayer koli ÷ koli adedi` → KDV çıkar → iskonto uygula → kâr marjı ekle →
(isteğe bağlı) tam liraya yukarı yuvarla.

**Gizlilik.** Alış fiyatları `data/mayer-fiyat.json`, ayarlar `data/fiyat-ayar.json`,
listeler `data/fiyat-listeleri.json` dosyasında tutulur; üçü de `.gitignore` içindedir ve
depoya girmez. Sunucu `data/` klasörünü statik olarak servis etmez — bu dosyalara yalnızca
giriş yapılmış panelden, token ile erişilir.

Mayer fiyatlarını sıfırdan yenilemek için kataloğu tekrar çekmek gerekir; tek tek
güncellemeler için panelden satırı düzeltmek yeterlidir.
