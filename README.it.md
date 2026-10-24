<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Un lettore PDF per Obsidian. Evidenziazioni, citazioni e link profondi riportano al passo, e il filo con le note resta intero. Leggendo un articolo o un materiale di studio, traduzione, ricerca di una parola, spiegazione e domande restano nel PDF già aperto.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Perché

Leggere un PDF in Obsidian spezza spesso la catena verso la nota:

- L’evidenziazione resta nel PDF; la nota nel vault sta altrove.
- Una figura di solito è uno screenshot sfocato, scomodo da gestire.
- Una citazione o un’immagine incollata raramente indica la pagina o l’area esatta.
- In un tema scuro, una pagina PDF chiara abbaglia.
- Cambiare lettore può rendere inutili i link di pagina e di selezione già scritti.

In un articolo o in un testo di studio, una parola sconosciuta, una frase lunga o un concetto nuovo fermano la lettura. Traduzione, dizionario e domande passano a un altro strumento, e la pagina va ritrovata a mano.

Foxycape PDF colma questi vuoti dentro Obsidian.

## Funzioni

### Capire un articolo o un testo di studio sulla pagina aperta

#### Un articolo in un’altra lingua, da una scorsa a una lettura vera

Selezionare un passaggio lo traduce e ne mostra prima il senso. Microsoft è il motore predefinito; la scorsa non consuma utilizzo IA. Per una formulazione più vicina al campo, passare all’IA, scegliere **Prima la velocità** o **Prima la qualità** e la lingua di arrivo.

Se in quel passaggio una parola resta incerta, **Cerca parola**. La pronuncia è in IPA, pinyin o kana, insieme al senso che ha in questo passaggio. Se la selezione è una frase intera, prima arriva il senso della frase, poi le parole difficili.

Se il passaggio è ancora oscuro, **Spiega questo passaggio** apre solo quel tratto, per continuare a leggere. **Breve**, una o due frasi, basta per voltare pagina. Per andare oltre, **Dettagliata**. **Scopri di più** manda il passaggio e la spiegazione già mostrata nel pannello laterale di **Chiedi all’IA**.

Traduzioni, spiegazioni e ricerche di parole restano nell’elenco di questo PDF. Si possono filtrare e riaprire la pagina. Per scriverle nella nota, attivare la scrittura di ciascun tipo nelle impostazioni (disattivata per impostazione predefinita). Vengono aggiunte al Markdown con lo stesso nome del PDF.

<!-- GIF: docs/gifs/read-in-place.gif — selezione, traduzione, parola, spiegazione -->

#### Leggere un testo lungo e fare domande

Selezionare un passaggio e chiedere all’IA. La domanda include quel testo. Se il documento è lungo, Foxycape chiede prima se analizzarlo. In caso di sì, la risposta si appoggia a passaggi del documento e una citazione apre la pagina. In caso di no, risponde con conoscenze generali. In seguito si può scegliere **Analizza questo libro** dal menu.

Tornati a una pagina da una citazione, se quel passaggio non è ancora chiaro, traduzione, ricerca e spiegazione restano disponibili. Dopo una risposta compaiono domande correlate per continuare. Le conversazioni restano con questo PDF: si possono cercare o aprirne una nuova.

<!-- GIF: docs/gifs/ask-while-reading.gif — chiedere al PDF aperto e tornare alla pagina -->

### Modello e utilizzo

Spiegazione, ricerca, traduzione con IA e domande usano il modello selezionato. L’uso del modello ufficiale è addebitato all’utilizzo IA della licenza. Si possono anche indicare un **URL di base** e una **chiave API** propri. La traduzione Microsoft non consuma questo utilizzo. La licenza si può ottenere gratis. L’utilizzo si può acquistare o ricevere condividendo.

### L’evidenziazione nella nota

L’evidenziazione non deve restare solo nel PDF. Una nuova può creare o aggiornare una nota Markdown con lo stesso nome, aggiungere l’estratto con un link di ritorno e, se si vuole, aprire quella nota in un riquadro diviso. Si può disattivare nelle impostazioni.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — l’evidenziazione scrive la nota omonima -->

### Estrarre le immagini incorporate

Non serve accontentarsi di uno screenshot sfocato. Passando sopra un’immagine incorporata (sul cellulare, il controllo touch) si può vedere l’anteprima, copiarla o scaricare l’originale.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — passaggio del puntatore: anteprima, copia, download -->

### Citare testo e immagini, e tornare alla fonte

La citazione conserva la provenienza, e dalla nota si può riaprire il PDF:

- Copiare una citazione di testo come Markdown con link profondo (`#page=` / `#selection=` / `#markId=`).
- Copiare una citazione di immagine. Incollata in Markdown, salva un PNG accanto al PDF e inserisce un link.
- Clic destro sull’immagine nella nota → **Apri in Foxycape**, ritorno alla pagina e evidenziazione dell’area originale.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — copia la citazione → incolla → torna al PDF -->

### Adattarsi al tema di Obsidian

In un vault scuro, una pagina PDF chiara disturba. I grigi dei vettori si possono riassegnare al primo piano e allo sfondo del tema (BETA): per tutti i temi, solo scuro o solo chiaro. Figure a colori e vettori a colori restano com’erano.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — la pagina PDF segue il tema -->

### Cattura di un’area

Non serve più lo strumento di cattura del sistema, né unire le pagine a mano. **Schermata** nella barra degli strumenti, poi trascinare un’area sul PDF. Si può copiare l’immagine o una citazione di immagine: dopo averla incollata nella nota, il clic destro torna al punto originale.

Un’area su una sola pagina:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — area su una pagina -->

Se l’area attraversa il bordo di pagina, viene unita in un’immagine continua:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — più pagine in un’immagine -->

### Compatibile con i link del lettore integrato

Cambiare lettore non dovrebbe rompere i link già scritti. Foxycape capisce `#page=` e `#selection=` di Obsidian, può diventare il visualizzatore PDF predefinito, riusa una scheda già aperta e con `#markId=` salta all’evidenziazione precisa.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — aprire un link di pagina o di selezione già esistente -->

### Stili ed elenco delle evidenziazioni

Evidenziatore, sottolineatura ondulata e sottolineatura dritta, con colori propri. L’elenco filtra, ordina, salta ed elimina.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — stili ed elenco delle evidenziazioni -->

### Copia intelligente: togliere gli a capo morbidi

L’impaginazione PDF spezza spesso una frase a metà. Copiando, restano a capo di troppo. Basta selezionare e copiare come al solito: Foxycape toglie quegli a capo morbidi e l’incolla diventa un paragrafo continuo. Le vere interruzioni di paragrafo restano.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — seleziona → copia → incolla senza a capo a metà frase -->

### Navigazione e ricerca

Indice, miniature, salto di pagina e ricerca nel documento (`Mod+F`), con maiuscole, segni diacritici e parola intera. La ricerca usa il livello di testo del PDF, senza OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — indice, miniature e ricerca -->

### Impaginazione di lettura

Zoom (automatico / larghezza pagina / percentuale), scorrimento verticale o orizzontale, pagina singola / doppia / libro, rotazione e PDF con password. Su desktop e su mobile.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — impaginazione e zoom -->

### Lettore PDF predefinito

Nelle impostazioni, attiva **Usa come visualizzatore PDF predefinito** perché Obsidian apra i PDF con Foxycape. Link profondi, evidenziazioni e adattamento al tema risultano così completi.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — attivare il visualizzatore PDF predefinito -->

## Sviluppo

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # build in osservazione; copia in OBSIDIAN_PLUGIN_DIR dopo ogni successo
npm test
npm run typecheck
npm run link       # junction di dist/ verso .obsidian/plugins/foxycape-pdf del vault
```

Imposta `OBSIDIAN_PLUGIN_DIR` in `.env` (vedi `.env.example`). `npm run dev` copia lì il risultato dopo ogni build riuscita; `npm run link` legge la stessa variabile e, se manca, usa il percorso di vault predefinito. Una variabile d’ambiente del processo prevale sul file.

## Licenza

Questo repository è **source available** e segue il [Foxycape Plugins License Agreement](LICENSE.md).

- Usare, modificare e ridistribuire il codice è consentito, con un limite: farne un’offerta generica per Obsidian (o un’app di note simile) in concorrenza con i prodotti commerciali di Foxycape, comprese le pubblicazioni pubbliche gratuite da cui siano stati tolti i controlli di prova o di licenza.
- L’uso privato, l’uso interno a una sola organizzazione e il lavoro su misura per un cliente restano consentiti.
- Per diritti oltre quell’accordo, scrivere a **company@tiefeiying.com**.

I componenti di terze parti (per esempio PDF.js) e i pacchetti pubblicati a parte (per esempio `@foxycape/core` sotto MIT) mantengono la propria licenza.

Il testo completo è in [LICENSE.md](LICENSE.md).
