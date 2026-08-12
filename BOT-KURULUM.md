# VITREA Asistan — Kurulum Rehberi

Siteye eklenen yapay zeka sohbet botunu canliya almak icin iki ucretsiz hesap islemi gerekiyor.
Toplam sure: ~10 dakika. Kredi karti gerekmez.

## 1. Gemini API anahtari al (2 dk)

1. https://aistudio.google.com/apikey adresine git (Google hesabinla giris yap)
2. **Create API key** butonuna bas
3. Cikan `AIza...` ile baslayan anahtari kopyala — bunu kimseyle paylasma

## 2. Cloudflare Worker kur (5 dk)

Anahtari dogrudan siteye koyamayiz (herkes gorur ve calar). Worker, anahtari
bulutta gizli tutan ucretsiz bir araci sunucudur (gunde 100.000 istek ucretsiz).

1. https://dash.cloudflare.com adresinde ucretsiz hesap ac / giris yap
2. Sol menu: **Workers & Pages** > **Create** > **Create Worker** > **Deploy**
3. **Edit code** de; acilan editordeki her seyi sil, bu klasordeki
   `cloudflare-worker.js` dosyasinin icerigini yapistir > **Deploy**
4. Worker sayfasina don: **Settings** > **Variables and Secrets** > **Add**
   - Type: **Secret**, Name: `GEMINI_API_KEY`, Value: 1. adimdaki anahtar > **Deploy**
5. Worker adresini kopyala: `https://<isim>.<hesap>.workers.dev`

## 3. Adresi siteye yaz (1 dk)

`index.html` dosyasinin sonunda su satiri bul:

    <script>window.VITREA_BOT_ENDPOINT = '';</script>

Tirnaklarin arasina worker adresini yapistir:

    <script>window.VITREA_BOT_ENDPOINT = 'https://vitrea-bot.hesabin.workers.dev';</script>

## 4. Yayinla

Degisiklikleri GitHub'a gonder (commit + push). Site vitreaplas.com'da
guncellendiginde sag altta sohbet balonu belirir.

## Notlar

- Bot, urun bilgilerini `assets/js/products.js`ten otomatik okur — urun
  ekleyip cikardiginda botun bilgisi kendiliginden guncellenir.
- Bot fiyat vermez, teklif formuna yonlendirir (kurallar `chatbot.js` icinde).
- Ucretsiz kota asilirsa bot kibarca "su an cevap veremiyorum" der; site calismaya devam eder.
