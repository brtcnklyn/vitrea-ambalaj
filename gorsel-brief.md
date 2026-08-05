# Eksik sahne fotoğrafları — üretim brief'i

Dört üründe kabın kendi "kullanım fotoğrafı" yok. Bu fotoğraflar iki yerde görünüyor:
kart üzerine gelince (hover) ve ürün detay panelinin altında.

| Ürün | Kod | Form | Kaynak görsel (Gemini'ye referans olarak yükleyin) | Kaydedilecek ad |
|---|---|---|---|---|
| LUNA | VT-W31 | Oval, dar-uzun · 63,5 × 121 × 60 mm | `assets/img/urun/luna.png` | `luna` |
| FACETA | VT-K26 | Elmas kesitli kare, kapaklı · 78 × 78 × 84 mm | `assets/img/urun/faceta.png` | `faceta` |
| KUBIK | VT-K25 | Küp · 73 × 73 × 78 mm | `assets/img/urun/kubik.png` | `kubik` |
| LARGA | VT-G33 | Geniş ve alçak kase, kapaklı · 125 × 55 mm | `assets/img/urun/larga.png` | `larga` |

## Nasıl üretilir

1. Gemini'ye **önce referans görseli yükleyin** (yukarıdaki `assets/img/urun/...png` dosyası).
   Şeklin birebir doğru çıkması için bu şart — sadece metinle tarif ederseniz kabın
   formu tutmaz.
2. Aşağıdaki ortak stil metnini + ürüne özel cümleyi birlikte yapıştırın.
3. Çıkan görseli indirin, **yatay (4:3)** olacak şekilde kırpın.
4. `/admin` → ilgili ürün → **Düzenle** → "Sahne fotoğrafı" → **Yükle** → dosyayı seçin.
   Dosya adını tablodaki adla kaydedin.
5. Yayına almak için: `git add -A && git commit -m "sahne fotograflari" && git push`

## Ortak stil metni

```
Yüklediğim şeffaf plastik kabın formunu, oranlarını ve kalınlığını birebir koruyarak
profesyonel bir yemek fotoğrafı üret.

Sahne: koyu gri, dokulu arduvaz zemin. Yandan gelen yumuşak doğal pencere ışığı,
sert gölge yok. Kamera 35–45 derece açıda, hafif yukarıdan. Sığ alan derinliği:
kap net, arka plan yumuşak bulanık.

Aksesuarlar sade ve az: jüt/hasır runner veya ahşap kesme tahtası, beyaz porselen
Türk kahvesi fincanı, metal çay kaşığı, birkaç taze çilek veya frenk üzümü,
küçük bir kuru dal. Aksesuarlar kabı gölgede bırakmasın.

Kabın üzerinde hiçbir etiket, banderol, logo veya yazı olmasın. Tamamen şeffaf,
temiz kristal görünüm.

Yatay kadraj, 4:3. Reklam/katalog kalitesinde, gerçekçi fotoğraf.
```

## Ürüne özel cümleler

**LUNA** — dar ve uzun oval kap, katmanlar yandan görünmeli:
```
Kabın içinde katmanlı bir sütlü tatlı olsun: en altta ince bisküvi kırıntısı,
üstünde beyaz muhallebi/krema katmanı, en üstte koyu çikolata sosu ve birkaç
antep fıstığı kırığı. Katmanlar kabın uzun yan yüzeyinden net ve düzgün çizgiler
hâlinde görünsün.
```

**FACETA** — elmas yüzeyli kapaklı kare kutu, ışık oyunu öne çıkmalı:
```
Kabın içinde katmanlı bir trileçe olsun: sünger kek, karamel sos, üstte krema ve
toz tarçın. Kapağı kapalı. Elmas yüzeylerin ışığı farklı açılarda kırdığı,
parlamaların belirgin olduğu bir açı seç.
```

**KUBIK** — küp form, dört yüzü de vitrin:
```
Kabın içinde katmanlı bir magnolia olsun: alttan üste bisküvi kırıntısı, beyaz
muhallebi, kırmızı orman meyvesi sosu, tekrar muhallebi ve üstte bisküvi tozu.
Katmanlar küpün ön yüzünden yatay bantlar hâlinde net görünsün. Üstte bir tam çilek.
```

**LARGA** — geniş ve alçak kase, sos yüzeye yayılıyor:
```
Kabın içinde supangle olsun: koyu çikolatalı puding, yüzeyi pürüzsüz ve parlak,
üzerine serpilmiş hindistan cevizi veya rendelenmiş çikolata. Geniş ağız sayesinde
yüzeyin tamamı yukarıdan görünsün. Şeffaf kapağı kabın yanına yaslanmış dursun.
```

## Not

Diğer 34 ürünün sahne fotoğrafı tedarikçi kataloğundan geliyor. Zamanla kendi
çekimlerinizi yaptırırsanız aynı yöntemle (admin → Düzenle → Yükle) hepsini
değiştirebilirsiniz; ürün kartının beyaz zeminli ana görseli için şeffaf PNG,
sahne fotoğrafı için yatay JPG kullanın.
