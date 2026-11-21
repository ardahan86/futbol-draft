# Futbol Draft – Bütünleşik Yönetici Paneli

## Panelde bulunan bölümler
- **Metinler:** Yönetici panelinde tanımlı site metinlerini düzenleme.
- **Genel Renkler:** Ana arka plan, paneller, metin ve vurgu renkleri.
- **Çark Tasarımı:** 24 çark diliminin her birini ayrı ayrı seçerek dolgu rengi, yazı rengi, kenarlık rengi/kalınlığı, yazı tipi, yazı boyutu ve kalınlığını düzenleme. Tekrarlanan PAS/KORUMA gibi dilimler de konumlarına göre ayrı düzenlenebilir.
- **Yazı Tipi ve Boyut:** Genel metin ve başlık fontu; temel metin, başlık, buton ve menü boyutları.
- **Test Merkezi:** Gerçek oyun verisine yazmayan örnek ekran önizlemeleri.
- **Yayın Yönetimi:** Firebase taslağı, Firebase yayını ve GitHub senkronizasyonu.

## Yayın akışı
1. Yönetici panelinde düzenleme yapılır. Taslaklar Firestore `siteConfig/draft` belgesine otomatik kaydedilir.
2. **Firebase + GitHub'a Yayınla** seçildiğinde önce `siteConfig/published` güncellenir.
3. Ardından yönetici Firebase oturum belirteci, ayrı Cloudflare Worker'a gönderilir.
4. Worker, Firebase ID token'ını doğrular ve UID'nin `ADMIN_UID` olduğunu kontrol eder.
5. Worker, GitHub'daki `site-config.json` dosyasını günceller. GitHub `main` dalına commit atıldığı için GitHub Pages Actions dağıtımı başlar.
6. Site önce Firestore'daki yayınlanmış ayarları okur. Firestore erişilemezse GitHub Pages üzerinde bulunan `site-config.json` yedeğini kullanır.

**Önemli:** Yönetici panelinin GitHub senkronizasyonu, tasarım/icerik ayarlarını `site-config.json` dosyasına gönderir; `app.js` gibi uygulama kaynak kodunu değiştirmez. Oyun kodu güncellemeleri yine dosyaların GitHub deposuna yüklenmesiyle yapılır.

## 1. Firebase Rules
1. Firebase Console'da `futbol-draft-82904` projesini aç.
2. Build → Firestore Database → Rules bölümüne gir.
3. Bu paketteki `firestore.rules` içeriğini inceleyip yayımla.
4. `siteConfig/published` herkese okunabilir; `draft` ve tüm yazma işlemleri admin UID ile sınırlıdır.

Mevcut Firestore veritabanını silme veya yeniden oluşturma.

## 2. GitHub Pages
1. Paket içeriğini `ardahan86/futbol-draft` deposunun `main` dalına yükle.
2. `.github/workflows/deploy-pages.yml` dosyasının depoda bulunduğunu doğrula.
3. GitHub → Settings → Pages → Build and deployment → Source değerini **GitHub Actions** yap.
4. Actions sekmesinde dağıtım iş akışının tamamlandığını kontrol et.

## 3. GitHub senkronizasyon Worker'ı
Bu Worker mevcut `futbol-draft-auth` giriş Worker'ından ayrıdır. **Mevcut giriş Worker'ını değiştirme veya üzerine yazma.** Yeni ve ayrı bir Worker olarak dağıtılır.

### GitHub erişim anahtarı
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens bölümünden yeni token oluştur.
2. Resource owner olarak `ardahan86`, repository access olarak yalnızca `futbol-draft` deposunu seç.
3. Repository permissions altında **Contents: Read and write** izni ver. Başka izin verme.
4. Token'ı yalnızca Cloudflare Worker secret olarak kaydet; site dosyalarına, `app.js` veya `firebase-config.js` içine token'ı yazma.

### Worker'ı dağıtma
Bilgisayarında bu paketteki `github-sync-worker` klasörünü aç. Node.js ve Wrangler CLI kurulu olmalı. Terminalde:

```bash
npm install
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

`secret put` komutu token'ı sorunca GitHub fine-grained token'ını yapıştır. Worker URL'si dağıtım sonunda verilir; biçimi genellikle `https://futbol-draft-github-sync.<hesap>.workers.dev` olur.

`wrangler.toml` içindeki proje, admin UID, GitHub sahibi/depo ve `main` dalı bu proje için önceden ayarlanmıştır. Değiştirmeden önce kontrol et.

### Worker URL'sini siteye tanıtma
`firebase-config.js` dosyasının sonundaki şu satıra Worker URL'sini yaz:

```js
export const GITHUB_SYNC_WORKER_URL = 'https://futbol-draft-github-sync.<hesap>.workers.dev';
```

Bu URL gizli değildir. GitHub token'ı değildir. Değişiklikten sonra `firebase-config.js` dosyasını GitHub `main` dalına yükle ve Pages dağıtımını bekle.

## 4. Son test
1. Sitede admin hesabıyla oturum aç.
2. Yönetici Paneli → Çark Tasarımı bölümünde bir dilimin rengini değiştir. Ana çark ve küçük önizleme birlikte güncellenmeli.
3. Yazı Tipi ve Boyut bölümünde bir değer değiştir.
4. Yayın Yönetimi bölümünden **Taslağı Firebase'e Kaydet** ile taslağı kontrol et.
5. **Firebase + GitHub'a Yayınla** düğmesine bas.
6. Durum metninde Firebase ve GitHub başarısını ayrı ayrı doğrula.
7. GitHub deposunda `site-config.json` commit'ini ve Actions dağıtımını kontrol et.

Worker URL'si henüz ayarlanmamışsa Firebase yayını çalışır; GitHub eşitlemesi hata verir ve durum panelinde açıkça belirtilir. Worker kurulumundan sonra **GitHub Eşitlemesini Yeniden Dene** kullanılabilir.

## Güvenlik
- GitHub token'ı tarayıcıya gönderilmez; Cloudflare Worker secret olarak saklanır.
- Worker, Firebase ID token'ını Google Secure Token JWKS ile doğrular ve yalnızca tanımlı admin UID'ye izin verir.
- Worker yalnızca `site-config.json` dosyasına yazar.
- Firebase taslak ve yayın kayıtları Firestore Rules ile korunur.
- İlk yayından önce GitHub deposunun ve mevcut Firestore Rules'un yedeğini al.
