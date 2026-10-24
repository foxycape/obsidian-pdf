<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Ein PDF-Leser für Obsidian. Markierungen, Zitate und Deep Links führen zurück zur Stelle, und der Weg in die Notiz bleibt erhalten. Beim Lesen einer Arbeit oder eines Lerntexts bleiben Übersetzung, Nachschlagen, Erklärung und Fragen in der geöffneten PDF.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Warum

Wer PDFs in Obsidian liest, verliert oft die Verbindung zur Notiz:

- Markierungen bleiben in der PDF, die Notizen im Vault liegen woanders.
- Eine Abbildung heißt meist ein unscharfer Screenshot.
- Eingefügte Zitate und Bilder zeigen selten auf die genaue Seite oder den Bereich.
- Helle PDF-Seiten blenden in einem dunklen Vault.
- Ein anderer Leser kann vorhandene Seiten- und Auswahllinks unbrauchbar machen.

In einer Arbeit oder einem Lerntext stoppt ein unbekanntes Wort, ein langer Satz oder ein neuer Begriff das Lesen. Übersetzung, Wörterbuch und Fragen wandern in ein anderes Werkzeug, und die Seite muss man selbst wiederfinden.

Foxycape PDF schließt diese Lücken in Obsidian.

## Funktionen

### Eine Arbeit oder einen Lerntext auf der aktuellen Seite verstehen

#### Eine fremdsprachige Arbeit, vom Überfliegen zum Verstehen

Eine Passage auswählen, und sie wird übersetzt — zuerst der Sinn. Standard ist die Übersetzung von Microsoft; das Überfliegen verbraucht kein KI-Kontingent. Für eine fachnähere Formulierung auf KI wechseln, dann **Tempo zuerst** oder **Qualität zuerst** wählen und die Zielsprache festlegen.

Ist in der Passage noch ein Wort unklar, **Wort nachschlagen**. Die Aussprache steht in IPA, Pinyin oder Kana, zusammen mit der Bedeutung an dieser Stelle. Bei einem ganzen Satz kommt zuerst der Satzsinn, dann die schwierigen Wörter.

Ist die Passage immer noch unklar, öffnet **Stelle erklären** genau diesen Abschnitt, damit das Lesen weitergeht. **Kurz** — ein, zwei Sätze — reicht zum Weiterblättern. Für mehr **Ausführlich** wählen. **Mehr erfahren** schickt die Passage und die vorhandene Erklärung in die Seitenleiste **KI fragen**.

Übersetzungen, Erklärungen und Nachschlagen bleiben in der Liste dieser PDF. Dort lassen sie sich filtern, und die Seite lässt sich wieder öffnen. Sollen sie in die Notiz, das Schreiben für jede Art in den Einstellungen einschalten (standardmäßig aus). Sie werden an die Markdown-Datei mit demselben Namen wie die PDF angehängt.

<!-- GIF: docs/gifs/read-in-place.gif — Auswahl übersetzen, nachschlagen, erklären -->

#### Einen langen Text lesen und dabei fragen

Eine Passage auswählen und die KI fragen. Die Frage enthält diesen Text. Bei einem langen Dokument fragt Foxycape zuerst, ob das Dokument analysiert werden soll. Bei Ja stützt sich die Antwort auf Stellen im Dokument, und ein Zitat öffnet die Seite. Bei Nein antwortet sie aus allgemeinem Wissen. Später lässt sich im Menü **Dieses Buch analysieren** wählen.

Führt ein Zitat auf eine Seite zurück und die Passage ist noch unklar, bleiben Übersetzung, Nachschlagen und Erklärung verfügbar. Nach einer Antwort gibt es Anschlussfragen. Gespräche bleiben bei dieser PDF, lassen sich durchsuchen, und ein neues lässt sich beginnen.

<!-- GIF: docs/gifs/ask-while-reading.gif — die offene PDF fragen und über ein Zitat zur Seite zurück -->

### Modell und Kontingent

Erklärung, Nachschlagen, KI-Übersetzung und **KI fragen** nutzen das gewählte Modell. Der Verbrauch des offiziellen Modells geht vom KI-Kontingent der Lizenz ab. Eine eigene **Basis-URL** und ein eigener **API-Schlüssel** sind möglich. Die Übersetzung von Microsoft verbraucht dieses Kontingent nicht. Eine Lizenz lässt sich kostenlos holen. Kontingent kann gekauft oder durch Teilen erhalten werden.

### Markierung in die Notiz

Markierungen müssen nicht in der PDF liegen bleiben. Eine neue Markierung kann eine Markdown-Notiz mit demselben Namen anlegen oder aktualisieren, den Auszug mit Rücklink anhängen und die Notiz optional geteilt öffnen. In den Einstellungen lässt sich das abschalten.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — Markierung schreibt in die gleichnamige Notiz -->

### Eingebettete Bilder in Originalqualität

Unscharfe Screenshots sind nicht nötig. Über einem eingebetteten Bild verweilen (auf dem Handy die Touch-Steuerung) und es in der Vorschau ansehen, kopieren oder als Original herunterladen.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — Hover: Vorschau, Kopieren, Download -->

### Text und Bilder zitieren und zurückspringen

Zitate behalten ihre Herkunft, sodass man später aus der Notiz in die PDF zurückspringt:

- Textzitat als Markdown mit Deep Link kopieren (`#page=` / `#selection=` / `#markId=`).
- Bildzitat kopieren. Beim Einfügen in Markdown wird ein PNG neben der PDF gespeichert und ein klickbarer Link eingesetzt.
- Bild in der Notiz rechtsklicken → **In Foxycape öffnen**, zur Seite zurück und den ursprünglichen Bereich hervorheben.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — Zitat kopieren → einfügen → zurück zur PDF -->

### An das Obsidian-Design anpassen

In einem dunklen Vault blenden helle PDF-Seiten. Graustufen in Vektoren lassen sich auf Vorder- und Hintergrundfarbe des Designs abbilden (BETA) — für alle Designs, nur dunkel oder nur hell. Farbige Abbildungen und farbige Vektoren bleiben unverändert.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — die PDF-Seite folgt dem Design -->

### Bereich aufnehmen

Nicht mehr zum System-Screenshot wechseln und Seiten nicht mehr von Hand zusammenfügen. In der Werkzeugleiste **Screenshot** wählen und einen Bereich auf der PDF ziehen. Das Bild kopieren oder ein Bildzitat kopieren — nach dem Einfügen in die Notiz führt ein Rechtsklick zurück zur Stelle.

Ein Bereich auf einer einzelnen Seite:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — Bereich auf einer Seite -->

Geht der Bereich über den Seitenumbruch, entsteht automatisch ein zusammenhängendes Bild:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — mehrere Seiten zu einem Bild -->

### Mit den Links des eingebauten Lesers

Ein Leserwechsel sollte vorhandene Links nicht zerstören. Foxycape versteht `#page=` und `#selection=` von Obsidian, kann der Standard-PDF-Leser werden, nutzt einen offenen Tab weiter und springt mit `#markId=` genau zur Markierung.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — vorhandenen Seiten- oder Auswahllink öffnen -->

### Stile und Liste der Markierungen

Textmarker, Wellenlinie und gerade Unterstreichung, dazu eigene Farben. In der Liste filtern, sortieren, springen und löschen.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — Stile und Markierungsliste -->

### Intelligentes Kopieren — weiche Umbrüche entfernen

Der PDF-Satz bricht Sätze oft mitten im Wortlaut. Nach dem Kopieren stehen überzählige Zeilenumbrüche im Text. Einfach wie gewohnt markieren und kopieren: Foxycape entfernt diese weichen Umbrüche, der Text wird ein zusammenhängender Absatz. Echte Absatzgrenzen bleiben.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — auswählen → kopieren → ohne Umbruch mitten im Satz einfügen -->

### Navigation und Suche

Inhaltsverzeichnis, Miniaturen, Seitensprung und Suche im Dokument (`Mod+F`), mit Groß-/Kleinschreibung, diakritischen Zeichen und ganzen Wörtern. Die Suche nutzt die Textebene der PDF, ohne OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — Inhalt, Miniaturen und Suche -->

### Leselayout

Zoom (automatisch / Seitenbreite / Prozent), vertikales oder horizontales Scrollen, Einzelseite / Doppelseite / Buch, Seitendrehung, passwortgeschützte PDFs. Auf Desktop und Mobilgerät.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — Layout und Zoom -->

### Als Standard-PDF-Leser

In den Einstellungen **Als Standard-PDF-Viewer verwenden** einschalten, damit Obsidian PDFs mit Foxycape öffnet. Deep Links, Markierungen und die Design-Anpassung greifen dann durchgängig.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — Standard-PDF-Viewer in den Einstellungen -->

## Entwicklung

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # Build im Watch-Modus; kopiert nach Erfolg nach OBSIDIAN_PLUGIN_DIR
npm test
npm run typecheck
npm run link       # verknüpft dist/ per Junction mit .obsidian/plugins/foxycape-pdf im Vault
```

`OBSIDIAN_PLUGIN_DIR` in `.env` setzen (siehe `.env.example`). `npm run dev` kopiert nach jedem erfolgreichen Watch-Build dorthin; `npm run link` liest dieselbe Variable und fällt sonst auf den Standard-Vault-Pfad zurück. Eine Prozessumgebungsvariable hat Vorrang vor der Datei.

## Lizenz

Dieses Repository ist **source available** und unterliegt der [Foxycape Plugins License Agreement](LICENSE.md).

- Nutzen, Ändern und Weitergeben sind erlaubt, mit einer Einschränkung für allgemein angebotene, mit den kommerziellen Produkten von Foxycape konkurrierende Obsidian-Angebote (oder vergleichbare Notiz-Apps) — einschließlich kostenloser öffentlicher Einträge, bei denen Test- oder Lizenzprüfungen entfernt wurden.
- Private Nutzung, Nutzung innerhalb einer einzelnen Organisation und kundenspezifische Einzelprojekte bleiben erlaubt.
- Für Rechte über diese Vereinbarung hinaus: **company@tiefeiying.com**.

Komponenten Dritter (zum Beispiel PDF.js) und getrennt veröffentlichte Pakete (zum Beispiel `@foxycape/core` unter MIT) behalten ihre eigenen Lizenzen.

Der volle Text steht in [LICENSE.md](LICENSE.md).
