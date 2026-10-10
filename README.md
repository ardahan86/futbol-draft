# Futbol Draft

## Paket içeriği
- `index.html`: Site arayüzü
- `styles.css`: Koyu tema, responsive görünüm ve CSS taktik sahası
- `app.js`: Firebase Authentication, oda/lobi ve draft istemcisi
- `players.json`: 110 futbolcunun listesi
- `firestore.rules`: Başlangıç Firestore güvenlik kuralları

## GitHub Pages kurulumu
1. GitHub'da `futbol-draft` adında **Public** depo oluştur.
2. Depoda **Add file → Upload files** seçeneğini kullan.
3. ZIP'i bilgisayarına çıkarıp içindeki dosyaları (klasörün kendisini değil) deponun kök dizinine yükle; Commit changes yap.
4. **Settings → Pages → Deploy from a branch → main → /(root) → Save** seç.
5. GitHub Pages URL'si aynı ekranda görünür.

## Firebase kurulumu
1. Firebase Console'da proje `futbol-draft-f596c` seç.
2. **Authentication → Sign-in method → Anonymous → Enable** yap.
3. Firestore Database oluşturulmuş olmalı.
4. **Firestore Database → Rules** içine `firestore.rules` dosyasını yapıştırıp Publish et.
5. **Authentication → Settings → Authorized domains** içinde GitHub Pages alan adının bulunduğunu kontrol et.

`app.js` içindeki Firebase web config, mevcut proje için doldurulmuştur. Web apiKey istemci tarafında görünür olması normal olan bir proje tanımlayıcısıdır; service-account/private key kesinlikle ekleme.

## Oyuncu listesi notu
İsimler kullanıcının önceki 110 kişilik oyuncu havuzundan alınmıştır. Ülke ve puan değerleri bu sürümde oyun amaçlı başlangıç değerleridir, canlı/resmî oyuncu istatistikleri değildir. Bonservis: `(puan - 69) * 5 M€`, en fazla 150 M€. Kaptan bonusları daha önce kararlaştırılan isimlere eklenmiştir.

## Güvenlik uyarısı
Bu, statik hosting kullanan ilk oynanabilir prototiptir. Firestore kuralları basit test için hazırlanmıştır ve oda üyelerinin belge güncellemesine izin verir. Bu nedenle hileye dayanıklı değildir. Herkese açık/rekabetçi kullanımda draft seçimleri, sıra, bütçe ve puan hesapları güvenilir sunucu tarafında (ör. Cloud Functions) doğrulanmalıdır. GitHub Pages sunucu kodu çalıştırmaz.
