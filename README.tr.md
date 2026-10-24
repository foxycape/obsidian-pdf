<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Obsidian için bir PDF okuyucu. Vurgular, alıntılar ve derin bağlantılar metindeki yere döner; notlarla kurulan bağ kopmaz. Bir makaleyi ya da çalışma metnini okurken çeviri, sözcük arama, açıklama ve sorular açık olan PDF’in içinde kalır.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Neden

Obsidian’da PDF okumak, notaya giden bağı sık sık koparır:

- Vurgu PDF’te kalır, kasanın notu başka yerdedir.
- Bir şekil çoğu zaman bulanık bir ekran görüntüsüdür, düzenlemesi zordur.
- Yapıştırılan alıntı ya da görsel, tam sayfayı veya bölgeyi nadiren gösterir.
- Koyu bir temada açık PDF sayfası göz alır.
- Okuyucuyu değiştirmek, yazılmış sayfa ve seçim bağlantılarını bozabilir.

Bir makalede ya da çalışma metninde bilinmeyen bir sözcük, uzun bir cümle ya da yeni bir kavram okumayı durdurur. Çeviri, sözlük ve sorular başka bir araca geçer; sayfayı kendin eşleştirmen gerekir.

Foxycape PDF bu boşlukları Obsidian’ın içinde kapatır.

## Özellikler

### Açık sayfada bir makaleyi ya da çalışma metnini anlamak

#### Yabancı dilde bir makale: göz gezdirmekten okumaya

Bir pasaj seçmek onu çevirir ve önce anlamı gösterir. Varsayılan Microsoft’tur; göz gezdirmek yapay zeka kullanımından düşmez. Alana daha yakın bir anlatım için yapay zekâya geç, **Önce hız** ya da **Önce kalite** seç ve hedef dili belirle.

O pasajda bir sözcük hâlâ belirsizse **Sözcük ara**. Sesletim IPA, pinyin ya da kana ile, bu pasajdaki anlamıyla birlikte verilir. Seçim bütün bir cümleyse önce cümlenin anlamı, sonra zor sözcükler gelir.

Pasaj hâlâ anlaşılmıyorsa **Bu bölümü açıkla** yalnız o parçayı açar, okumaya devam edesin diye. **Kısa**, bir iki cümle, sayfayı çevirmeye yeter. Daha fazlası için **Ayrıntılı**. **Daha fazla bilgi**, pasajı ve gösterilmiş açıklamayı yan paneldeki **Yapay zekâya sor** bölümüne yollar.

Çeviriler, açıklamalar ve aranan sözcükler bu PDF’in listesinde kalır. Süzülebilir ve o sayfaya dönülebilir. Nota yazmak için ayarlarda her türün yazılmasını aç (varsayılan kapalıdır). PDF ile aynı adlı Markdown dosyasına eklenirler.

<!-- GIF: docs/gifs/read-in-place.gif — seç, çevir, sözcük ara, açıkla -->

#### Uzun bir metni okurken sormak

Bir pasaj seç ve yapay zekâya sor. Soru o metni birlikte götürür. Belge uzunsa Foxycape önce onu çözümleyip çözümlemeyeceğini sorar. Evet dersen yanıt belgedeki pasajlara dayanır ve bir alıntı sayfayı açar. Hayır dersen yanıt genel bilgiden gelir. Sonra menüden **Bu kitabı analiz et** de seçilebilir.

Bir alıntı seni bir sayfaya geri getirdiğinde o pasaj hâlâ açık değilse çeviri, sözcük arama ve açıklama durur. Yanıttan sonra sürdürmek için ilgili sorular çıkar. Sohbetler bu PDF ile saklanır; aranabilir ya da yenisi açılabilir.

<!-- GIF: docs/gifs/ask-while-reading.gif — açık PDF’e sor ve alıntıdan sayfaya dön -->

### Model ve kullanım

Açıklama, sözcük arama, yapay zeka çevirisi ve sorular seçili modeli kullanır. Resmi modelin kullanımı, lisansın yapay zeka kullanımına yazılır. Kendi **temel URL** adresini ve **API anahtarını** da girebilirsin. Microsoft çevirisi bu kullanıma girmez. Lisans ücretsiz alınabilir. Kullanım satın alınabilir ya da paylaşarak edinilebilir.

### Vurguyu nota

Vurgunun yalnızca PDF’te kalması gerekmez. Yenisi, aynı adlı bir Markdown notu oluşturabilir ya da güncelleyebilir, geri bağlantılı alıntıyı ekleyebilir ve isterse o notu bölünmüş bir panoda açabilir. Ayarlardan kapatılır.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — vurgu aynı adlı nota yazılır -->

### Gömülü görselleri çıkarmak

Bulanık bir ekran görüntüsüyle yetinmek gerekmez. Gömülü bir görselin üzerine gel (telefonda dokunmatik denetim) önizle, kopyala ya da aslını indir.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — üzerine gel: önizleme, kopya, indirme -->

### Metin ve görsel alıntıla, kaynağa dön

Alıntı kaynağını taşır; nottan PDF’e dönülebilir:

- Metin alıntısını derin bağlantılı Markdown olarak kopyala (`#page=` / `#selection=` / `#markId=`).
- Görsel alıntısını kopyala. Markdown’a yapıştırınca PDF’in yanında bir PNG kaydeder ve bir bağlantı koyar.
- Nottaki görsele sağ tık → **Foxycape’de aç**: sayfaya dönüş ve özgün bölgenin vurgulanması.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — alıntıyı kopyala → yapıştır → PDF’e dön -->

### Obsidian temasına uymak

Koyu bir kasada açık bir PDF sayfası yorar. Vektörlerdeki griler, temanın ön planına ve arka planına eşlenebilir (BETA): tüm temalar, yalnız koyu ya da yalnız açık. Renkli şekiller ve renkli vektörler olduğu gibi kalır.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — PDF sayfası temayı izler -->

### Bir bölgenin görüntüsü

Sistemin ekran görüntüsüne geçmeye ve sayfaları elle birleştirmeye gerek kalmaz. Araç çubuğunda **Ekran görüntüsü**’ne bas ve PDF üzerinde bir bölge sürükle. Görseli ya da görsel alıntısını kopyala; nota yapıştırdıktan sonra sağ tık özgün yere döner.

Tek sayfada bir bölge:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — tek sayfada bölge -->

Bölge sayfa kenarını aşarsa tek bir sürekli görsele birleşir:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — birkaç sayfa tek görsel -->

### Yerleşik okuyucunun bağlantılarıyla uyum

Okuyucu değiştirmek, yazılmış bağlantıları bozmamalı. Foxycape, Obsidian’ın `#page=` ve `#selection=` değerlerini anlar, varsayılan PDF görüntüleyici olabilir, açık bir sekmeyi yeniden kullanır ve `#markId=` ile vurguya tam olarak gider.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — var olan bir sayfa ya da seçim bağlantısını aç -->

### Vurgu biçimleri ve liste

Fosforlu kalem, dalgalı çizgi ve düz alt çizgi, kendi renklerinle. Liste süzer, sıralar, atlar ve siler.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — biçimler ve vurgu listesi -->

### Akıllı kopya — yumuşak satır sonlarını kaldırma

PDF dizgisi cümleyi sık sık ortadan böler. Kopyalayınca fazla satır sonu kalır. Her zamanki gibi seç ve kopyala: Foxycape bu yumuşak sonları kaldırır, yapıştırılan metin kesintisiz bir paragraf olur. Gerçek paragraf ayrımları durur.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — seç → kopyala → cümlenin ortasında satır sonu olmadan yapıştır -->

### Gezinti ve arama

İçindekiler, küçük resimler, sayfaya atlama ve belge içi arama (`Mod+F`); büyük-küçük harf, aksan ve tam sözcük seçenekleriyle. Arama, PDF’in metin katmanını kullanır; OCR yoktur.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — içindekiler, küçük resimler ve arama -->

### Okuma düzeni

Yakınlaştırma (otomatik / sayfa genişliği / yüzde), dikey ya da yatay kaydırma, tek sayfa / çift sayfa / kitap, döndürme ve parolalı PDF. Masaüstünde ve telefonda.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — düzen ve yakınlaştırma -->

### Varsayılan PDF okuyucu

Ayarlarda **Varsayılan PDF görüntüleyici olarak kullan** seçeneğini aç; Obsidian PDF’leri Foxycape ile açsın. Derin bağlantılar, vurgular ve temaya uyum o zaman tam olur.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — varsayılan PDF görüntüleyiciyi aç -->

## Geliştirme

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # izlemeli derleme; her başarıdan sonra OBSIDIAN_PLUGIN_DIR içine kopyalar
npm test
npm run typecheck
npm run link       # dist/ için kasadaki .obsidian/plugins/foxycape-pdf yoluna junction
```

`.env` içinde `OBSIDIAN_PLUGIN_DIR` tanımla (`.env.example` dosyasına bak). `npm run dev` her başarılı derlemeden sonra çıktıyı oraya kopyalar; `npm run link` aynı değişkeni okur, yoksa varsayılan kasa yoluna döner. Sürecin ortam değişkeni dosyadan önce gelir.

## Lisans

Bu depo **source available** durumundadır ve [Foxycape Plugins License Agreement](LICENSE.md) kapsamındadır.

- Kodu kullanmak, değiştirmek ve yeniden dağıtmak serbesttir; şu sınırla: Foxycape’in ticari ürünleriyle yarışan, Obsidian (ya da benzer bir not uygulaması) için genel bir ürüne dönüştürülemez. Deneme ya da lisans denetimi çıkarılmış ücretsiz herkese açık bir listeleme de buna girer.
- Kişisel kullanım, tek bir kuruluş içindeki kullanım ve belirli bir müşteriye özel iş serbest kalır.
- Bu sözleşmenin ötesindeki haklar için: **company@tiefeiying.com**.

Üçüncü taraf bileşenler (örneğin PDF.js) ve ayrı yayımlanmış paketler (örneğin MIT kapsamındaki `@foxycape/core`) kendi lisanslarını korur.

Tam metin [LICENSE.md](LICENSE.md) içindedir.
