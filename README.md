# Kristal — Thunderbird görünümü

Okumayı, ileti seçmeyi ve silmeyi kolaylaştıran sade, erişilebilir bir
Thunderbird görünümü.

- Seçtiğiniz ileti kartının arka planı tamamen şeffaf olur; arkasındaki
  listenin hafif ışığı görünür. Seçim; vurgu renginde çerçeve, parlak üst
  kenar ve solda ince bir vurgu çubuğuyla belli olur. Firefox'taki seçili
  sekme etkisine benzer.
- Her kartın içinde **Sil** düğmesi vardır. Seçili kartta ve fareyle
  üzerine gelince görünür (ayarlardan "her zaman" da yapılabilir).
- Seçili sekme de aynı cam görünümündedir.
- Koyu ve açık mod Windows ayarını kendiliğinden izler.

Denenen sürüm: **Thunderbird 158.0.1, Windows 11**, kart görünümü.
Başka sürümlerde denenmedi.

## Bu neden "tema" değil de "eklenti"?

Thunderbird'ün resmî tema biçimi yalnızca renk ve arka plan resmi
değiştirebilir. Karta düğme eklemek ve cam efekti vermek bunun dışında
kalıyor. Bu yüzden Kristal bir **eklenti** olarak yapıldı.

Kurarken Thunderbird, eklentinin "Thunderbird'e ve bilgisayarınıza tam,
kısıtlamasız erişim" istediğini söyler. Bunun sebebi şu: Kristal,
Thunderbird'ün kendi pencerelerine stil dosyası yükleyip kartlara düğme
ekliyor ve bu ancak "deneysel API" (Experiment; eklentinin Thunderbird'ün iç
yapısına erişmesine izin veren bölüm) ile yapılabiliyor. Kristal ağa
bağlanmaz, postalarınızı okumaz, hiçbir yere veri göndermez. Kodun
tamamı `src` klasöründedir.

## Kurulum (deneme)

1. Thunderbird'de sağ üstteki **☰** menüsünden **Eklentiler ve temalar**'ı açın.
2. **Uzantılar** sayfasında dişli (⚙) simgesine, sonra **Dosyadan eklenti yükle…**'ye tıklayın.
3. `dist\kristal-1.0.1.xpi` dosyasını seçin ve **Ekle** deyin. (Daha önce
   1.0.0'ı kurduysanız aynı yoldan 1.0.1'i kurmanız yeterli; üzerine güncellenir.)

En iyi sonuç için:

- **Eklentiler ve temalar → Temalar** bölümünde Thunderbird'ün varsayılan
  sistem teması (otomatik) etkin olsun. Başka bir tema seçiliyse bazı
  renkler o temadan gelebilir.
- Posta listesi **kart görünümünde** olsun (Thunderbird'ün varsayılanı budur;
  liste başlığının sağındaki görünüm düğmesinden değiştirilir). Tablo
  görünümünde Thunderbird'ün kendi "Sil" sütunu kullanılabilir (sütun
  seçiciden açılır).

## Ayarlar

**Eklentiler ve temalar → Kristal → anahtar (🔧) simgesi**. Değişiklikler hemen
uygulanır.

- **Vurgu rengi:** Çivit (varsayılan), Zümrüt, Gül, Kehribar, Grafit.
- **Karttaki Sil düğmesi:** seçili kartta ve fareyle üzerine gelince / her zaman.
- **Cam efekti ve arka plan ışığı:** açık / kapalı (kapalıyken düz renk).
- **Kartlar arasında rahat boşluk:** açık / kapalı.

## Silme nasıl çalışıyor?

Karttaki düğme Thunderbird'ün kendi silme yolunu kullanır (tablo
görünümündeki Sil sütunuyla aynı). İleti, hesabınızın ayarına göre Çöp
kutusuna taşınır ve **Ctrl+Z** ile geri alınabilir. Klavyede **Delete** tuşu
aynı işi yapar. Seçili olmayan bir kartın düğmesine basarsanız yalnızca o
kart silinir; açık olan iletiniz değişmez.

## Erişilebilirlik

- Yazı renkleri WCAG 2.2 AA'ya göre hesaplandı: normal yazı en az 4.5:1,
  simge ve çerçeveler en az 3:1. Seçili cam kartta bile, arka plan ışığının
  en güçlü olduğu durum hesaba katıldı.
- Seçim yalnızca renkle değil, çerçeve ve sol vurgu çubuğuyla da gösterilir.
- Klavye odağı 2 piksellik çerçeveyle görünür.
- Sil düğmesinin tıklama alanı 28×28 pikseldir (WCAG 2.5.8 en az 24×24 ister).
- Windows'ta **Kontrast teması** açıksa Kristal hiçbir rengi değiştirmez;
  Thunderbird'ün erişilebilir sistem renkleri kalır.
- **Animasyonları azalt** açıksa geçiş efektleri kapanır; **Saydamlık
  efektleri** kapalıysa cam yerine düz renk kullanılır.

## Kaldırma

**Eklentiler ve temalar → Uzantılar → Kristal → ••• → Kaldır** (ya da yalnızca
anahtarı kapatın). Kapatınca bütün değişiklikler anında geri alınır.

## Geliştirme

```
python build.py
```

`dist\kristal-<sürüm>.xpi` dosyasını üretir. Dosyalar:

| Dosya | Görevi |
|---|---|
| `src/manifest.json` | Eklenti tanımı |
| `src/experiment/implementation.js` | Stil dosyalarını yükler, kartlara Sil düğmesini ekler, kart aralığını ayarlar |
| `src/skin/tokens.css` | Renk paleti ve Thunderbird renk değişkenlerinin bağlanması |
| `src/skin/three-pane.css` | Kartlar, cam efekti, Sil düğmesi, klasör listesi |
| `src/skin/main-window.css` | Sekmeler ve araç çubukları |
| `src/skin/message.css` | İleti başlığı |
| `src/options/` | Ayarlar sayfası |
| `src/_locales/` | Türkçe ve İngilizce metinler |

## Mozilla'ya (addons.thunderbird.net) gönderme

- Gönderim "tema" olarak değil **eklenti** olarak yapılır; Thunderbird'ün tema
  bölümü yalnızca renk ve resim değiştiren dosyaları kabul eder.
- Thunderbird eklenti sitesinde (addons.thunderbird.net) bir geliştirici
  hesabı gerekir.
- Lisans: **MPL-2.0** (gönderim formunda da bu seçilmelidir).
- Deneysel API kullanan eklentiler elle incelenir.
- `strict_min_version` şu an `158.0`. Uzun süreli destek sürümünü (ESR)
  kullananlara da açmak için önce o sürümde denenmesi gerekir.
- Liste sayfası için ekran görüntüleri hazırlanmalıdır.

Adım adım gönderim sırası ve forma yapıştırılacak hazır metinler (eklenti
sayfası açıklaması ve inceleyici notu): [docs/ATN-gonderim.md](docs/ATN-gonderim.md)

## Lisans

Kristal, [Mozilla Public License 2.0](LICENSE) ile yayınlanır.
© 2026 Bora Şavkar
