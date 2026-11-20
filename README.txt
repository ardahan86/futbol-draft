FUTBOL DRAFT - GUNCELLEME PAKETI

Bu paket yalnizca degistirilen 4 dosyayi icerir:
- index.html
- app.js
- styles.css
- firestore.rules

Yukleme:
1. Mevcut GitHub projenin yedegini sakla.
2. Bu paketteki ilk 3 dosyayi projenin ana dizinindeki ayni isimli dosyalarla degistir.
3. firestore.rules dosyasinin icerigini Firebase Console > Firestore Database > Rules bolumune aktar ve Publish yap.
4. firebase-config.js, players.js / players.json ve assets klasorunu degistirme; mevcut dosyalar korunacak.
5. Once GitHub uzerinde test et; her sey dogruysa yayinla.

Degisiklikler:
- E-posta adresi dogrulanmis tum kullanicilar oda olusturabilir. Odayi olusturan kisi oda sahibi olur.
- Odaya katilim icin 6 haneli oda kodu girilmesi gerekir. Oda listesindeki dogrudan Katil butonlari kaldirildi.
- Yeni odanin lig adi otomatik olarak oda adi ile ayni baslar.
- Cark cevrilirken yaklasik 3.2 saniyelik ses efekti calar.
- Cark sonucu ekranda 3 saniye gorunur. Cark animasyonu (3.3 sn) + sonuc penceresi (3 sn) boyunca tum istemcilerde ortak hamle kilidi uygulanir.
- Futbolcu secildiginde oyuncu penceresi 3 saniye gorunur ve bu sure boyunca siradaki oyuncu cark ceviremez.
- Kulup sonucu geldiginde secim paneli, cark sonucu penceresi kapandiktan sonra acilir.

Notlar:
- Canli siteye herhangi bir dosya yuklenmedi.
- JavaScript dosyasi node --check ile sozdizimi kontrolunden gecti.
- HTML icinde tekrar eden ID bulunmadigi ve gerekli form/alan ID'leri kontrol edildi.
- Firebase Rules degisikligi emulatorde test edilmedi; yayinlamadan once Firestore Rules Playground veya test projesinde denemen onerilir.
- Ses tarayicinin kullanici etkilesimi sonrasi ses iznine baglidir; tarayici sesi engellerse diger oyun ozellikleri calismaya devam eder.
