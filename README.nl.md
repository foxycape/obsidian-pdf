<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Een PDF-lezer voor Obsidian. Markeringen, citaten en deeplinks brengen je terug naar de plek, en de lijn naar je notities blijft intact. Bij een paper of studietekst gebeuren vertalen, een woord opzoeken, uitleg en vragen in de PDF die al openstaat.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Waarom

Een PDF lezen in Obsidian breekt vaak de keten naar de notitie:

- De markering blijft in de PDF; de notitie in de kluis staat ergens anders.
- Een figuur is meestal een wazige schermafbeelding, lastig bij te houden.
- Een geplakt citaat of een geplakte afbeelding wijst zelden naar de precieze pagina of het gebied.
- In een donker thema doet een lichte PDF-pagina pijn aan de ogen.
- Een andere lezer kan bestaande pagina- en selectielinks onbruikbaar maken.

In een paper of studietekst stopt een onbekend woord, een lange zin of een nieuw begrip het lezen. Vertaling, woordenboek en vragen verhuizen naar een ander hulpmiddel, en de pagina moet je zelf weer vinden.

Foxycape PDF vult die gaten in Obsidian.

## Functies

### Een paper of studietekst begrijpen op de pagina die openstaat

#### Een paper in een andere taal, van een snelle blik naar echt lezen

Een passage selecteren vertaalt haar en geeft eerst de strekking. Microsoft is de standaard; vluchtig lezen kost geen AI-gebruik. Voor een formulering dichter bij het vak, overschakelen naar AI, **Snelheid eerst** of **Kwaliteit eerst** kiezen, en de doeltaal.

Blijft een woord in die passage onduidelijk, dan **Woord opzoeken**. De uitspraak staat in IPA, pinyin of kana, samen met de betekenis op deze plek. Bij een hele zin komt eerst de zinbetekenis, daarna de moeilijke woorden.

Is de passage nog steeds onduidelijk, dan opent **Deze passage uitleggen** alleen dat stuk, zodat je verder kunt lezen. **Kort**, een of twee zinnen, is genoeg om door te bladeren. Voor meer: **Uitgebreid**. **Meer info** stuurt de passage en de uitleg die er al staat naar **Vraag AI** in het zijpaneel.

Vertalingen, uitleg en opgezochte woorden blijven in de lijst van deze PDF. Je kunt ze filteren en naar die pagina terug. Om ze in de notitie te zetten, schrijven per soort aanzetten in de instellingen (standaard uit). Ze worden toegevoegd aan de Markdown met dezelfde naam als de PDF.

<!-- GIF: docs/gifs/read-in-place.gif — selectie vertalen, opzoeken, uitleggen -->

#### Een lange tekst lezen en ondertussen vragen

Selecteer een passage en vraag de AI. De vraag neemt die tekst mee. Bij een lang document vraagt Foxycape eerst of het geanalyseerd moet worden. Bij ja steunt het antwoord op passages uit het document, en een citaat opent de pagina. Bij nee komt het antwoord uit algemene kennis. Later kun je in het menu **Dit boek analyseren** kiezen.

Kom je via een citaat terug op een pagina en is die passage nog onduidelijk, dan blijven vertalen, opzoeken en uitleggen beschikbaar. Na een antwoord staan er vervolgvragen. Gesprekken blijven bij deze PDF: je kunt ze doorzoeken of een nieuw gesprek beginnen.

<!-- GIF: docs/gifs/ask-while-reading.gif — de open PDF bevragen en via een citaat terug naar de pagina -->

### Model en gebruik

Uitleg, opzoeken, AI-vertaling en vragen gebruiken het gekozen model. Gebruik van het officiële model gaat van het AI-gebruik van de licentie af. Een eigen **basis-URL** en **API-sleutel** kunnen ook. De Microsoft-vertaling telt niet mee voor dat gebruik. Een licentie is gratis op te halen. Gebruik kun je kopen of krijgen door te delen.

### Markering naar de notitie

Een markering hoeft niet in de PDF te blijven. Een nieuwe kan een Markdown-notitie met dezelfde naam maken of bijwerken, het fragment met een teruglink toevoegen en die notitie desgewenst in een gesplitst paneel openen. Uitzetten kan in de instellingen.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — markering schrijft de gelijknamige notitie -->

### Ingesloten afbeeldingen eruit halen

Een wazige schermafbeelding is niet nodig. Beweeg over een ingesloten afbeelding (op mobiel de aanraakbediening) om een voorbeeld te zien, te kopiëren of het origineel te downloaden.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — hover: voorbeeld, kopiëren, downloaden -->

### Tekst en afbeeldingen citeren, en terugspringen

De citatie houdt de herkomst, zodat je later vanuit de notitie naar de PDF terug kunt:

- Een tekstcitatie kopiëren als Markdown met een deeplink (`#page=` / `#selection=` / `#markId=`).
- Een afbeeldingscitatie kopiëren. Plakken in Markdown slaat een PNG naast de PDF op en zet er een klikbare link in.
- Rechtsklik op de afbeelding in de notitie → **Openen in Foxycape**, terug naar de pagina en de oorspronkelijke zone gemarkeerd.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — citaat kopiëren → plakken → terug naar de PDF -->

### Meelopen met het Obsidian-thema

In een donkere kluis doen lichte PDF-pagina’s pijn aan de ogen. Grijswaarden in vectoren kun je op de voor- en achtergrond van het thema zetten (BETA): voor alle thema’s, alleen donker of alleen licht. Kleurige afbeeldingen en kleurige vectoren blijven zoals ze zijn.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — de PDF-pagina volgt het thema -->

### Een gebied vastleggen

Niet meer naar de schermafbeelding van het systeem, en pagina’s niet meer zelf aan elkaar plakken. **Schermafbeelding** in de werkbalk, en een gebied op de PDF slepen. De afbeelding kopiëren, of een afbeeldingscitatie: na het plakken in de notitie brengt een rechtsklik je terug naar de plek.

Een gebied op één pagina:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — gebied op één pagina -->

Loopt het gebied over de paginarand, dan wordt het één doorlopende afbeelding:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — meerdere pagina’s tot één afbeelding -->

### Geschikt voor de links van de ingebouwde lezer

Van lezer wisselen mag bestaande links niet breken. Foxycape begrijpt `#page=` en `#selection=` van Obsidian, kan de standaard PDF-lezer worden, hergebruikt een open tabblad en springt met `#markId=` precies naar de markering.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — een bestaande pagina- of selectielink openen -->

### Stijlen en lijst van markeringen

Markeerstift, golvende lijn en rechte onderstreping, met eigen kleuren. De lijst filtert, sorteert, springt en verwijdert.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — stijlen en markeringslijst -->

### Slim kopiëren — zachte regeleinden weghalen

De PDF-opmaak breekt zinnen vaak halverwege. Na het kopiëren staan er te veel regeleinden in. Gewoon selecteren en kopiëren: Foxycape haalt die zachte einden weg, en de plaktekst wordt een doorlopende alinea. Echte alinea-einden blijven staan.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — selecteren → kopiëren → plakken zonder einde midden in de zin -->

### Navigatie en zoeken

Inhoudsopgave, miniaturen, paginasprong en zoeken in het document (`Mod+F`), met hoofdletters, diakritische tekens en hele woorden. Zoeken gebruikt de tekstlaag van de PDF, zonder OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — inhoud, miniaturen en zoeken -->

### Leesindeling

Zoom (automatisch / paginabreedte / percentage), verticaal of horizontaal scrollen, enkele pagina / twee pagina’s / boek, rotatie en PDF’s met wachtwoord. Op desktop en op mobiel.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — indeling en zoom -->

### Standaard PDF-lezer

Zet in de instellingen **Gebruiken als standaard PDF-viewer** aan, zodat Obsidian PDF’s met Foxycape opent. Deeplinks, markeringen en thema-aanpassing werken dan door.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — standaard PDF-viewer in de instellingen -->

## Ontwikkeling

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # watch-build; kopieert na succes naar OBSIDIAN_PLUGIN_DIR
npm test
npm run typecheck
npm run link       # junction van dist/ naar .obsidian/plugins/foxycape-pdf in de kluis
```

Zet `OBSIDIAN_PLUGIN_DIR` in `.env` (zie `.env.example`). `npm run dev` kopieert het resultaat daarheen na elke geslaagde watch-build; `npm run link` leest dezelfde variabele en valt anders terug op het standaard kluispad. Een omgevingsvariabele van het proces gaat voor op het bestand.

## Licentie

Deze repository is **source available** en valt onder de [Foxycape Plugins License Agreement](LICENSE.md).

- Gebruiken, wijzigen en herdistribueren mag, met een grens: er een algemeen Obsidian-aanbod van maken (of voor een vergelijkbare notitie-app) dat concurreert met de commerciële producten van Foxycape — ook een gratis openbare plaatsing waarbij proef- of licentiecontroles zijn verwijderd.
- Privégebruik, gebruik binnen één organisatie en maatwerk voor een specifieke klant blijven toegestaan.
- Voor rechten buiten die overeenkomst: **company@tiefeiying.com**.

Onderdelen van derden (bijvoorbeeld PDF.js) en apart gepubliceerde pakketten (bijvoorbeeld `@foxycape/core` onder MIT) houden hun eigen licentie.

De volledige tekst staat in [LICENSE.md](LICENSE.md).
