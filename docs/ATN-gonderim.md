# Kristal'i Thunderbird eklenti sitesine gönderme

Kristal, Thunderbird eklenti sitesine (addons.thunderbird.net) **eklenti**
olarak gönderilir. Thunderbird'ün tema bölümü yalnızca renk ve resim
değiştiren dosyaları kabul ettiği için "tema" olarak gönderilemez.

Sitedeki menü adları zamanla değişebilir. Aşağıdaki adımlar genel sırayı
anlatır.

## Adımlar

1. **Son paketi hazırlayın.** `src/manifest.json` içindeki sürümü yükseltin
   (ör. `1.0.2`) ve `python build.py` komutunu çalıştırın. Kendi
   Thunderbird'ünüzde denediğiniz paketi gönderin.
2. **Giriş yapın.** addons.thunderbird.net adresindeki geliştirici bölümüne
   girin. Hesabınız yoksa orada oluşturun.
3. **Yeni eklenti gönderin.** Eklentinin sitede listelenmesini seçin ve
   `dist\kristal-<sürüm>.xpi` dosyasını yükleyin.
4. **Doğrulama sonucunu okuyun.** Deneysel API kullanıldığı için bir uyarı
   beklenir. Bu bir hata değildir; eklenti bu yüzden elle incelenir.
5. **Sayfa bilgilerini doldurun.** Aşağıdaki "Eklenti sayfası metinleri"
   bölümünü kullanın. Lisans olarak **Mozilla Public License 2.0** seçin.
6. **İnceleyiciye not yazın.** Aşağıdaki "İnceleyici notu" metnini yapıştırın.
7. **Ekran görüntüsü ekleyin.** Koyu ve açık modda seçili bir kart, karttaki
   Sil düğmesi ve ayarlar sayfası.

## Eklenti sayfası metinleri

**Ad:** Kristal

**Ana sayfa:** https://github.com/borasavkar/kristal-thunderbird

**Destek:** https://github.com/borasavkar/kristal-thunderbird/issues

**Kısa açıklama (English):**

> A calm, accessible look for Thunderbird: the selected message card turns
> into transparent glass, and every card gets its own Delete button.

**Kısa açıklama (Türkçe):**

> Thunderbird için sade ve erişilebilir görünüm: seçilen posta kartı şeffaf
> cama dönüşür, her kartın içinde kendi Sil düğmesi vardır.

**Uzun açıklama (English):**

> Kristal makes reading, selecting and deleting mail easier.
>
> - The selected message card gets a transparent glass background, an accent
>   ring and a side bar, so you always see which message is open. The
>   selected tab gets the same look.
> - Every card has its own Delete button. It shows on the selected card and on
>   mouse hover, or on every card if you prefer. It uses Thunderbird's own
>   delete command, so the message goes to the Trash as usual. The Delete key
>   keeps working.
> - A calm palette for light and dark mode with five accent colors.
>
> Accessibility: text colors meet WCAG 2.2 AA contrast (4.5:1 for text, 3:1
> for icons and focus rings), selection is shown by shape as well as color,
> the Delete button has a 28×28 px target, and Kristal steps aside when a
> Windows contrast theme is active. Reduced motion and reduced transparency
> settings are respected.
>
> Privacy: Kristal makes no network requests and does not read your messages.
>
> Requires Thunderbird 158 or later. Designed for the Cards view of the
> message list.

**Uzun açıklama (Türkçe):**

> Kristal; okumayı, ileti seçmeyi ve silmeyi kolaylaştırır.
>
> - Seçilen posta kartının arka planı şeffaf cama dönüşür. Vurgu renginde
>   çerçeve ve soldaki çubuk sayesinde hangi iletinin açık olduğu hep
>   görünür. Seçili sekme de aynı görünümü alır.
> - Her kartın kendi Sil düğmesi vardır. Seçili kartta ve fareyle üzerine
>   gelince görünür; isterseniz her kartta her zaman görünür. Thunderbird'ün
>   kendi silme komutunu kullanır, yani ileti her zamanki gibi Çöp kutusuna
>   gider. Delete tuşu da çalışmaya devam eder.
> - Açık ve koyu mod için sade bir palet, beş vurgu rengi.
>
> Erişilebilirlik: yazı renkleri WCAG 2.2 AA kontrast eşiğini geçer (yazıda
> 4.5:1, simge ve odak çerçevesinde 3:1). Seçim yalnızca renkle değil şekille
> de gösterilir. Sil düğmesinin tıklama alanı 28×28 pikseldir. Windows'ta
> Kontrast teması açıkken Kristal renkleri değiştirmez. Hareketi ve
> saydamlığı azaltma ayarlarına uyar.
>
> Gizlilik: Kristal ağa bağlanmaz ve iletilerinizi okumaz.
>
> Thunderbird 158 veya üstü gerekir. Posta listesinin kart görünümü için
> tasarlanmıştır.

## İnceleyici notu (English)

> Kristal uses an Experiment API (`experiment/implementation.js`) because the
> WebExtension APIs cannot style the 3-pane tab or add buttons to message
> cards. What the experiment does:
>
> - Loads the bundled CSS files from `skin/` into `messenger.xhtml`,
>   `messageWindow.xhtml`, `about:3pane` and `about:message` with
>   `windowUtils.loadSheetUsingURIString(..., AUTHOR_SHEET)`. New documents
>   are caught with the `document-element-inserted` observer. All sheets are
>   removed on shutdown.
> - Adds a Delete/Restore button with the class `tree-button-request-delete`
>   to `#threadPaneCardTemplate` and to existing card rows. The click is
>   handled by Thunderbird's own tree view `request-delete` handler
>   (`gDBView.applyCommandToIndices(deleteMsg)`); the add-on never deletes
>   messages itself.
> - Adds 6 px to `ThreadCard.ROW_HEIGHT` after Thunderbird recalculates it
>   (`uidensitychange` / `uifontsizechange` events and observers for
>   `mail.threadpane.cardsview.rowcount` and `mail.threadpane.listview`), then
>   calls `threadTree.reset()`. The original height is restored on shutdown.
> - Keeps the user's options in `storage.local` and mirrors them to the pref
>   `extensions.kristal.options`, so the saved look applies at startup before
>   the lazily started background script runs.
>
> There are no network requests, no remote code and no access to message
> content. Nothing is minified or generated: the XPI is a plain zip of `src/`
> made by `build.py`. Source: https://github.com/borasavkar/kristal-thunderbird
