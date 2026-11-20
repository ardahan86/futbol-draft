# Çark Futbol – yenilenmiş hesap sistemi

## İçerik
- Mevcut `app.js`, `index.html`, `styles.css` ve `players.json` korunarak hesap akışı yenilendi.
- E-posta veya kullanıcı adıyla giriş Cloud Function üzerinden yapılır.
- E-posta doğrulanmamış hesaplar giriş yapamaz.
- Kullanıcı adı çözümlemesi sunucuda yapılır; istemciye e-posta adresi ifşa edilmez.
- Firestore kuralları oda ve oyun verilerini yalnızca e-postası doğrulanmış hesaplara açar; kayıt işleminin kullanıcı adı/profil oluşturma adımı doğrulama öncesi çalışabilir.

## Önemli yapılandırma
`firebase-config.example.js` örnek dosyadır. Bunu körlemesine gerçek `firebase-config.js` olarak kullanma. Firebase Console > Project settings > Your apps içindeki web uygulamasının gerçek yapılandırmasını `firebase-config.js` adıyla proje köküne koy. `ADMIN_UID` mevcut yönetici UID'siyle aynı kalmalı.

## Cloud Functions kurulumu
1. Firebase projesinde Blaze planı ve Cloud Functions gereksinimlerini kontrol et.
2. Proje kökünde `firebase-config.js` dosyası bulunmalı.
3. `cd functions && npm install`
4. Proje köküne dön: `firebase functions:params:set FIREBASE_WEB_API_KEY` komutuyla Firebase web API anahtarını parametre olarak gir. İstendiğinde Firebase Console'daki Web API Key değerini kullan.
5. `firebase deploy --only functions`
6. Hosting için `firebase deploy --only hosting` komutundan önce yerel test yap.
7. Firestore kurallarını ayrıca inceleyip onayladıktan sonra `firebase deploy --only firestore:rules`

## Kritik notlar
- Bu paket canlı Firebase projesine deploy edilmedi.
- Functions ve Firestore kuralları henüz gerçek projede entegrasyon testinden geçirilmedi.
- Mevcut Firestore kullanıcı/oda verileri silinmez; kuralların uygulanması erişimi etkileyebilir. Özellikle yönetici UID'si ve mevcut kullanıcıların `emailVerified` durumu kontrol edilmeli.
- Eski anonim/ doğrulanmamış hesaplar e-posta doğrulaması yapana kadar oda verilerine erişemez.
- `firebase-config.js` dosyanı ve service-account private key dosyalarını paylaşma.
