# Futbol Draft – Oyun ve Gol Kuralları

## Çark ve kadrolar
- Çark 21 dilimlidir: 17 kulüp/kadro dilimi, 2 PAS ve 2 TAKAS dilimi bulunur. KORUMA ve Karma Takım dilimleri çarktan çıkarılmıştır.
- Karma Takım kadrosu, takas aşamasında kullanılmak üzere 20 futbolcudan oluşur. Chelsea ve Napoli kadroları da 20’şer oyuncudan oluşur.
- Sırası gelen oyuncuya çarkı çevirmesi için 25 saniye verilir. Süre dolarsa sistem otomatik çevirir.
- Çarkta takım geldiğinde oyuncu seçimi için 30 saniye verilir. Süre dolarsa sistem o takımdan uygun ve boş mevkiye rastgele futbolcu seçer.
- Herhangi bir oyuncu ilk 11’ini tamamladıktan sonra diğer oyuncular drafta devam ederken gelen TAKAS dilimleri PAS sayılır; yeni hak verilmez.

## İlk 11
Kaleci, sağ bek, iki stoper, sol bek, iki merkez orta saha, ofansif orta saha, sağ kanat, sol kanat ve santrfor olmak üzere 11 mevki doldurulur. İlk 11'ini tamamlayan oyuncu çark çevirmeyi bırakır. Yedek seçimi yoktur.

## Takas aşaması
1. Draft tamamlanır tamamlanmaz tüm oyuncular için aynı anda başlayan 60 saniyelik takas süresi açılır.
2. Oyuncular birbirlerinin kadrolarından takas yapamaz. Yalnızca Karma Takım kadrosundan futbolcu seçebilir.
3. Oyuncu kendi kadrosundaki istediği futbolcuyu, Karma Takım kadrosundaki aynı mevkideki istediği futbolcuyla değiştirir. Aynı mevkiye sahip iki oyuncu arasında kutu numarası eşleşmesi aranmaz.
4. Aynı Karma Takım futbolcusuna birden fazla oyuncu talepte bulunursa futbolcu Karma Takım kadrosunda kalır. O futbolcuyu isteyen tüm oyuncuların ilgili takas hakları yanar.
5. Süre içinde kullanılmayan takas hakları yanar. Takas raporu **Takas Raporu** sekmesinde saklanır.

## Taktik seçimi
- Takas aşamasından sonra taktik, pas tercihi ve pres tarzı seçimi açılır.
- Tüm oyuncular için ortak 60 saniyelik süre bulunur. Süre içinde seçim yapmayan oyuncu için sistem her üç kategoriden rastgele seçim yapar.

## Gol kuralları
Her kural bağımsızdır. Şartı sağlayan takım ilgili kuraldan +1 gol kazanır.

1. **Omurga Üstünlüğü:** Kaleci (GK), Overall değeri en yüksek stoper (CB), Overall değeri en yüksek merkez orta saha (CM), ofansif orta saha (CAM) ve santrfor (ST) oyuncularının Overall puanları toplanır. Fark en az **9 Overall** ise üstün takım +1 gol kazanır. Taktik, pas ve pres bonusları uygulanmaz.
2. **Takım Overall Üstünlüğü:** İki takımın 11 oyuncusunun toplam Overall puanı hesaplanır. Tüm ev sahibi takımlara **+18 Overall** bonus verilir. Bonus sonrası toplam Overall farkı en az **12 Overall** ise üstün takım +1 gol kazanır. Taktik, pas ve pres bonusları uygulanmaz.
3. **Savunma Üstünlüğü:** Kaleci + iki stoper + sağ bek + sol bek oyuncularının DEF puanları karşılaştırılır. İlgili taktik/pas bonusları ve rakip pres etkisi uygulandıktan sonra fark en az **15 DEF** ise üstün takım +1 gol kazanır.
4. **Orta Saha Üstünlüğü:** Ofansif orta saha + iki merkez orta saha oyuncularının Overall puanları karşılaştırılır. İlgili taktik/pas bonusları ve rakip pres etkisi uygulandıktan sonra fark en az **9 Overall** ise üstün takım +1 gol kazanır.
5. **Hücum Üçlüsü Üstünlüğü:** Santrfor + sağ kanat + sol kanat oyuncularının ATT puanları karşılaştırılır. İlgili taktik/pas bonusları ve rakip pres etkisi uygulandıktan sonra fark en az **12 ATT** ise üstün takım +1 gol kazanır.
6. **Toplam Hücum Gücü:** İki takımın 11 oyuncusunun toplam ATT puanı hesaplanır. Tüm ev sahibi takımlara **+15 ATT** bonus verilir. Bonus sonrası toplam ATT farkı en az **9 ATT** ise üstün takım +1 gol kazanır. Taktik, pas ve pres bonusları uygulanmaz.

## Taktik bonusları
- **Defansif:** +15 DEF; yalnızca 3. Savunma Üstünlüğü kuralında kullanılır.
- **Dengeli:** +15 Overall; yalnızca 4. Orta Saha Üstünlüğü kuralında kullanılır.
- **Hücum:** +15 ATT; yalnızca 5. Hücum Üçlüsü Üstünlüğü kuralında kullanılır.

## Pas tercihleri
- **Uzun Top:** +12 DEF; yalnızca 3. Savunma Üstünlüğü kuralında kullanılır.
- **Kısa Pas:** +12 Overall; yalnızca 4. Orta Saha Üstünlüğü kuralında kullanılır.
- **Kanat Oyunu:** +12 ATT; yalnızca 5. Hücum Üçlüsü Üstünlüğü kuralında kullanılır.

## Pres tarzları
- **Geride Karşıla:** Rakibin 5. Hücum Üçlüsü hesabından -10 ATT.
- **Orta Alanda Karşıla:** Rakibin 4. Orta Saha hesabından -10 Overall.
- **Önde Pres:** Rakibin 3. Savunma hesabından -10 DEF.

## Lig maç raporları
Fikstürdeki her maçın altında **Maç Özeti** düğmesi bulunur. Tıklandığında yalnızca gol dakikaları ve gol atan futbolcuların adları görüntülenir.
