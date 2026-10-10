# Futbol Draft — yeni sürüm

Bu paket, kullanıcının en son paylaştığı `Draft Oyuncu Listesi(1).xlsx` dosyasından hazırlanan 130 futbolculuk havuzu temel alır. Futbolcu adları, ülke, mevki, güç puanı, bonservis, Özel Bağlantı ve ÖBB değerleri Excel'den alınmıştır.

## Dosyalar
- `index.html` — uygulama ekranları
- `styles.css` — duyarlı koyu tema
- `app.js` — oda, draft, bütçe ve puan hesapları
- `players.json` — Excel'den çıkarılan 130 futbolcu
- `firestore.rules` — başlangıç Firestore güvenlik kuralları
- `build_data.py` — Excel'den `players.json` üretme betiği

## GitHub Pages'e yükleme
1. ZIP'i bilgisayarına indir ve klasöre çıkar.
2. GitHub'da sitenin deposunu aç.
3. Dosyaların kendisini deponun ana dizinine yükle (`index.html` ana dizinde görünmeli).
4. **Settings → Pages → Deploy from a branch → main → /(root) → Save** seç.
5. Firebase Console'da `futbol-draft-f596c` projesini aç.
6. **Authentication → Sign-in method → Anonymous** girişini etkinleştir.
7. **Firestore Database** oluştur.
8. `firestore.rules` içeriğini Firebase Console → Firestore Database → Rules bölümüne kopyalayıp **Publish** et.
9. Firebase Authentication → Settings → Authorized domains bölümünde sitenin GitHub Pages alan adının (`KULLANICI.github.io`) bulunduğunu kontrol et.

## Oyun kuralları uygulamada
- 2–6 menajer; oda sahibi draftı başlatır.
- Yılan draft sırası.
- 11 kişilik kadro: 1 KL, 1 SĞB, 2 STP, 1 SLB, 1 ÖNL, 1 OS, 1 OOS, 1 SĞA, 1 SLA, 1 ST.
- Takım başına 1.100 M€ bütçe; seçilecek oyuncu ve kalan mevki doldurma maliyeti birlikte kontrol edilir.
- Bir futbolcu global olarak yalnızca bir kez seçilebilir.
- Excel'deki Özel Bağlantı ve ÖBB değerleri, ülke bonusları ve kaptan bonusları toplam güce eklenir.
- Oda kodu ve anonim Firebase kimliği sayesinde aynı tarayıcıdan yenileyince odaya geri bağlanılır.

## Güvenlik notu
Bu statik istemci sürümünde bütçe ve draft doğrulamaları uygulama tarafında da yapılır; ancak Firestore kuralları oda üyeliği ve temel oda sahipliği sınırlarını koruyan başlangıç kurallarıdır, her hamlenin oyun kurallarına uygunluğunu sunucu tarafında tam doğrulamaz. Rekabetçi/halka açık kullanım için draft hamlelerini doğrulayan güvenilir sunucu (Cloud Functions veya benzeri) gerekir. Ayrıca bu projede daha önce kullanılan Firebase web yapılandırması korunmuştur; bu ayar bir sunucu gizli anahtarı değildir. Firebase güvenliğini kurallar ve yetkiler belirler.
