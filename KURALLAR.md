# Futbol Draft – Oyun ve Gol Kuralları

## Çark ve kadrolar
- Çark 24 dilimlidir: kulüp/kadro dilimleri, PAS, KORUMA, TAKAS ve Trabzonspor ile Inter arasındaki FUTBOLCU KAYBET dilimi bulunur.
- Karma Takım, Chelsea ve Napoli'nin her biri 20 geçici oyuncudan oluşur. Oyuncular Oyuncu 1–20 olarak adlandırılmış, mevkileri ve puanları rastgele atanmıştır; daha sonra `players.json` üzerinden düzenlenebilir.
- Sırası gelen oyuncuya çarkı çevirmesi için 15 saniye verilir. Süre dolarsa sistem otomatik çevirir.
- Çarkta takım geldiğinde oyuncu seçimi için 20 saniye verilir. Süre dolarsa sistem o takımdan uygun ve boş mevkiye rastgele futbolcu seçer.
- Herhangi bir oyuncu ilk 11'ini tamamladıktan sonra diğer oyuncular drafta devam ederken gelen TAKAS ve KORUMA dilimleri PAS sayılır; yeni hak verilmez. FUTBOLCU KAYBET diliminde sistem oyuncunun kadrosundan rastgele bir futbolcu çıkarır; futbolcu kendi orijinal takımının oyuncu havuzuna döner ve sıra tamamlanır.

## İlk 11
Kaleci, sağ bek, iki stoper, sol bek, iki merkez orta saha, ofansif orta saha, sağ kanat, sol kanat ve santrfor olmak üzere 11 mevki doldurulur. İlk 11'ini tamamlayan oyuncu çark çevirmeyi bırakır. Yedek seçimi yoktur.

## Koruma ve takas aşamaları
1. Draft tamamlandığında koruma ekranı açılır. Tüm oyuncular için aynı anda başlayan 60 saniyelik süre bulunur. Süre içinde koruma işlemi yapmayan oyuncunun koruma hakları yanar.
2. Koruma aşamasından sonra takas ekranı açılır. Tüm oyuncular için aynı anda başlayan 60 saniyelik süre bulunur. Süre içinde takas yapmayan oyuncunun takas hakları yanar.
3. Takaslar aynı mevkideki oyuncular arasında yapılır. Korunan rakip oyuncuya yapılan takas başarısız olur.
4. Koruma ve takas işlemlerinin sonuç penceresi korunur. Kalıcı rapor ayrıca **Koruma ve Takas Raporu** sekmesinde bulunur; ana ekranda otomatik rapor gösterimi yapılmaz.

## Taktik seçimi
- Takas aşamasından sonra taktik, pas tercihi ve pres tarzı seçimi açılır.
- Tüm oyuncular için ortak 60 saniyelik süre bulunur. Süre içinde seçim yapmayan oyuncu için sistem her üç kategoriden rastgele seçim yapar.

## Gol kuralları
Her kural bağımsızdır. Şartı sağlayan takım ilgili kuraldan +1 gol kazanır.

1. **Omurga Üstünlüğü:** Kaleci (GK), Overall değeri en yüksek stoper (CB), Overall değeri en yüksek merkez orta saha (CM), ofansif orta saha (CAM) ve santrfor (ST) oyuncularının Overall puanları toplanır. İki takımın toplamı karşılaştırılır. Fark en az 9 Overall ise üstün takım +1 gol kazanır. Taktik, pas ve pres bonusu uygulanmaz.
2. **Takım Overall Üstünlüğü:** Ev sahibi takımın ilk 11 toplam Overall puanına +18 Overall eklenir. Bonus sonrası fark en az 12 Overall ise üstün takım +1 gol kazanır. Taktik, pas ve pres bonusu uygulanmaz.
3. **Savunma Üstünlüğü:** Kaleci + iki stoper + sağ bek + sol bek oyuncularının DEF puanları karşılaştırılır. Savunma taktiği +15 DEF, Uzun Top +12 DEF ve rakibin Önde Pres cezası -10 DEF uygulandıktan sonra fark en az 15 DEF ise üstün takım +1 gol kazanır.
4. **Orta Saha Üstünlüğü:** Ofansif orta saha + iki merkez orta saha oyuncularının Overall puanları karşılaştırılır. Dengeli taktik +15 Overall, Kısa Pas +12 Overall ve rakibin Orta Alanda Karşıla cezası -10 Overall uygulandıktan sonra fark en az 9 Overall ise üstün takım +1 gol kazanır.
5. **Hücum Üçlüsü Üstünlüğü:** Santrfor + sağ kanat + sol kanat oyuncularının ATT puanları karşılaştırılır. Hücum taktiği +15 ATT, Kanat Oyunu +12 ATT ve rakibin Geride Karşıla cezası -10 ATT uygulandıktan sonra fark en az 12 ATT ise üstün takım +1 gol kazanır.
6. **Toplam Hücum Gücü:** İlk 11 toplam ATT puanına ev sahibi için +15 ATT eklenir. Bonus sonrası fark en az 9 ATT ise üstün takım +1 gol kazanır. Taktik, pas ve pres bonusu uygulanmaz.

## Taktik bonusları
- **Savunma:** +15 DEF.
- **Dengeli:** +15 Overall.
- **Hücum:** +15 ATT.

## Pas tercihleri
- **Uzun Top:** +12 DEF.
- **Kısa Pas:** +12 Overall.
- **Kanat Oyunu:** +12 ATT.

## Pres tarzları
- **Önde Pres:** Rakibin savunma hesabından -10 DEF.
- **Orta Alanda Karşıla:** Rakibin orta saha hesabından -10 Overall.
- **Geride Karşıla:** Rakibin hücum hesabından -10 ATT.

## Lig maç raporları
Fikstürdeki her maçın altında **Maç Özeti** düğmesi bulunur. Tıklandığında tüm kayıtlı maç detayları açılır pencere olmadan ilgili maçın altında genişler.
