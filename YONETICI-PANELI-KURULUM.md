# Futbol Draft – Yönetici Paneli ve Yayınlama Kurulumu

## Bu sürümde eklenenler
- Yalnızca `ADMIN_UID` ile eşleşen kullanıcıda görünen ayrı Yönetici Paneli menüsü.
- Firestore tabanlı site metni ve tema rengi düzenleyicisi.
- Taslak kaydetme, anlık yerel önizleme ve yönetici onaylı içerik yayınlama.
- Gerçek oyun verilerine yazmayan örnek ekran Test Merkezi.
- `siteConfig/published` belgesi için herkese okuma; taslak ve yazma işlemleri için admin yetkisi.
- GitHub Actions ile GitHub Pages dağıtım iş akışı.
- Firebase CLI varsayılan projesi `futbol-draft-82904` olarak eşitlendi.

## Firebase adımları
1. Projeyi aç: `futbol-draft-82904`.
2. Mevcut Firestore veritabanını silme veya yeniden oluşturma.
3. Bu paketteki `firestore.rules` dosyasını mevcut kuralların yerine, değişiklikleri gözden geçirerek yayımla.
4. `siteConfig` koleksiyonu elle oluşturulmak zorunda değil; yönetici ilk taslak kaydını yaptığında oluşur.
5. Yönetici hesabı `firebase-config.js` içindeki mevcut `ADMIN_UID` ile eşleşmelidir.

## GitHub Pages adımları
1. Dosyaları `ardahan86/futbol-draft` deposunun `main` dalına gönder.
2. GitHub deposunda **Settings → Pages → Build and deployment → Source** bölümünü **GitHub Actions** olarak değiştir.
3. Actions sekmesinde `Deploy Futbol Draft to GitHub Pages` iş akışının tamamlanmasını bekle.
4. `CNAME` dosyasını ve `futboldraft.com.tr` DNS ayarlarını değiştirme.
5. Sonraki `main` dalı push işlemleri otomatik dağıtım başlatır.

## Güvenlik ve sınırlar
- GitHub erişim anahtarı tarayıcıya veya JavaScript'e eklenmez. GitHub Actions kendi `GITHUB_TOKEN` yetkisini kullanır.
- Metin ve renk yayınları GitHub'a kod göndermeden Firestore'daki `published` belgesini günceller.
- Test Merkezi şu an örnek ekran önizlemeleri sunar; gerçek oda/maç akışını simüle etmez ve oyun verilerine yazmaz.
- Kod yayınlama işlemi `main` dalına push ve GitHub Actions ile yapılır. Yönetici panelinden rastgele kod dosyası düzenleme/yükleme özelliği bu sürümde yoktur.
- İlk yayın öncesi mevcut depo ve Firebase kurallarının yedeğini al.
