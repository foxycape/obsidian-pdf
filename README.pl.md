<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Czytnik PDF dla Obsidian. Zakreślenia, cytaty i głębokie linki prowadzą z powrotem do miejsca w tekście, a wątek notatek się nie urywa. Przy artykule albo materiale do nauki tłumaczenie, sprawdzenie słowa, wyjaśnienie i pytania dzieją się w już otwartym PDF-ie.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Po co

Czytanie PDF-a w Obsidian często przerywa drogę do notatki:

- Zakreślenie zostaje w PDF-ie, notatka w skarbcu jest gdzie indziej.
- Rysunek to zwykle rozmyty zrzut, którym trudno zarządzać.
- Wklejony cytat albo obraz rzadko wskazuje dokładną stronę lub obszar.
- W ciemnym motywie jasna strona PDF-a razi.
- Zmiana czytnika może unieważnić już zapisane linki do strony i zaznaczenia.

W artykule albo materiale do nauki nieznane słowo, długie zdanie albo nowe pojęcie zatrzymuje czytanie. Tłumaczenie, słownik i pytania przechodzą do innego narzędzia, a stronę trzeba dopasować samemu.

Foxycape PDF uzupełnia te braki w Obsidian.

## Funkcje

### Zrozumieć artykuł albo materiał do nauki na bieżącej stronie

#### Obcojęzyczny artykuł, od przebiegnięcia wzrokiem do czytania

Zaznaczenie fragmentu od razu go tłumaczy i najpierw podaje sens. Domyślnie działa Microsoft; pobieżne czytanie nie zużywa użycia AI. Gdy sformułowanie ma być bliższe dziedzinie, przełącz na AI, wybierz **Najpierw szybkość** albo **Najpierw jakość** i język docelowy.

Jeśli w tym fragmencie słowo nadal jest niepewne, użyj **Sprawdź słowo**. Wymowa jest w IPA, pinyin albo kana, razem ze znaczeniem w tym fragmencie. Przy całym zdaniu najpierw jest sens zdania, potem trudne słowa.

Jeśli fragment nadal nie jest jasny, **Wyjaśnij ten fragment** rozkłada tylko ten kawałek, żeby czytać dalej. **Krótko**, jedno albo dwa zdania, wystarcza, by przewrócić stronę. Gdy trzeba więcej, wybierz **Szczegółowo**. **Dowiedz się więcej** przenosi fragment i już pokazane wyjaśnienie do bocznego panelu **Zapytaj AI**.

Tłumaczenia, wyjaśnienia i sprawdzone słowa zostają na liście tego PDF-a. Można je filtrować i wrócić na stronę. Żeby trafiły do notatki, włącz zapis każdego rodzaju w ustawieniach (domyślnie wyłączony). Dopisują się do Markdown o tej samej nazwie co PDF.

<!-- GIF: docs/gifs/read-in-place.gif — zaznaczenie, tłumaczenie, słowo, wyjaśnienie -->

#### Długi tekst czytać i przy okazji pytać

Zaznacz fragment i zapytaj AI. Pytanie niesie ten tekst. Przy długim dokumencie Foxycape najpierw pyta, czy go analizować. Po zgodzie odpowiedź opiera się na fragmentach dokumentu, a cytat otwiera stronę. Bez zgody odpowiedź idzie z wiedzy ogólnej. Później w menu można wybrać **Analizuj tę książkę**.

Gdy cytat sprowadza z powrotem na stronę, a fragment nadal jest niejasny, tłumaczenie, sprawdzenie słowa i wyjaśnienie są dalej pod ręką. Po odpowiedzi pojawiają się pytania, które można kliknąć dalej. Rozmowy zostają przy tym PDF-ie: da się je przeszukać albo zacząć nową.

<!-- GIF: docs/gifs/ask-while-reading.gif — pytanie do otwartego PDF-a i powrót na stronę -->

### Model i użycie

Wyjaśnienie, sprawdzenie słowa, tłumaczenie AI i pytania korzystają z wybranego modelu. Zużycie modelu oficjalnego liczy się do użycia AI na licencji. Można też podać własny **bazowy URL** i **klucz API**. Tłumaczenie Microsoft tego użycia nie zabiera. Licencję można odebrać za darmo. Użycie da się kupić albo dostać przez udostępnienie.

### Zakreślenie do notatki

Zakreślenie nie musi zostać tylko w PDF-ie. Nowe może utworzyć albo zaktualizować notatkę Markdown o tej samej nazwie, dopisać fragment z linkiem zwrotnym i opcjonalnie otworzyć tę notatkę w podzielonym panelu. Wyłącza się to w ustawieniach.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — zakreślenie zapisuje notatkę o tej samej nazwie -->

### Wyjąć osadzone obrazy

Nie trzeba zadowalać się rozmytym zrzutem. Najechanie na osadzony obraz (na telefonie sterowanie dotykiem) pozwala podejrzeć go, skopiować albo pobrać oryginał.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — najechanie: podgląd, kopia, pobranie -->

### Cytować tekst i obrazy, i wracać do źródła

Cytat niesie pochodzenie, więc z notatki da się wrócić do PDF-a:

- Skopiuj cytat tekstowy jako Markdown z głębokim linkiem (`#page=` / `#selection=` / `#markId=`).
- Skopiuj cytat obrazu. Wklejenie do Markdown zapisuje PNG obok PDF-a i wstawia link.
- Prawy przycisk na obrazie w notatce → **Otwórz w Foxycape**, powrót na stronę i podświetlenie pierwotnego obszaru.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — skopiuj cytat → wklej → wróć do PDF-a -->

### Dopasowanie do motywu Obsidian

W ciemnym skarbcu jasna strona PDF-a razi. Szarości wektorów można przypisać do koloru pierwszego planu i tła motywu (BETA): dla wszystkich motywów, tylko ciemnego albo tylko jasnego. Kolorowe rysunki i kolorowe wektory zostają bez zmian.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — strona PDF podąża za motywem -->

### Zrzut zaznaczonego obszaru

Nie trzeba już przechodzić do systemowego zrzutu ani sklejać stron ręcznie. **Zrzut ekranu** na pasku narzędzi i przeciągnięcie obszaru na PDF-ie. Można skopiować obraz albo cytat obrazu — po wklejeniu do notatki prawy przycisk wraca do miejsca w tekście.

Obszar na jednej stronie:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — obszar na jednej stronie -->

Gdy obszar przechodzi przez krawędź strony, składa się w jeden ciągły obraz:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — kilka stron w jeden obraz -->

### Zgodność z linkami wbudowanego czytnika

Zmiana czytnika nie powinna psuć już zapisanych linków. Foxycape rozumie `#page=` i `#selection=` z Obsidian, może być domyślnym czytnikiem PDF, używa już otwartej karty i przez `#markId=` trafia dokładnie w zakreślenie.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — otwarcie istniejącego linku do strony lub zaznaczenia -->

### Style i lista zakreśleń

Zakreślacz, linia falista i podkreślenie proste, plus własne kolory. Lista filtruje, sortuje, przeskakuje i usuwa.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — style i lista zakreśleń -->

### Inteligentne kopiowanie — miękkie łamanie wiersza

Skład PDF często tnie zdanie w połowie. Po skopiowaniu zostają zbędne końce wiersza. Wystarczy zaznaczyć i skopiować jak zwykle: Foxycape zdejmuje te miękkie łamania, a wklejony tekst jest ciągłym akapitem. Prawdziwe podziały akapitów zostają.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — zaznacz → kopiuj → wklej bez łamania w środku zdania -->

### Nawigacja i wyszukiwanie

Spis treści, miniatury, skok do strony i wyszukiwanie w dokumencie (`Mod+F`), z wielkością liter, znakami diakrytycznymi i całym słowem. Wyszukiwanie korzysta z warstwy tekstu PDF, bez OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — spis, miniatury i wyszukiwanie -->

### Układ czytania

Powiększenie (auto / szerokość strony / procent), przewijanie pionowe albo poziome, jedna strona / dwie / książka, obrót i PDF z hasłem. Na komputerze i na telefonie.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — układ i powiększenie -->

### Domyślny czytnik PDF

W ustawieniach włącz **Używaj jako domyślnej przeglądarki PDF**, żeby Obsidian otwierał PDF-y w Foxycape. Głębokie linki, zakreślenia i dopasowanie motywu działają wtedy w całości.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — włączenie domyślnego czytnika PDF -->

## Rozwój

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # budowanie z podglądem; po sukcesie kopiuje do OBSIDIAN_PLUGIN_DIR
npm test
npm run typecheck
npm run link       # junction dist/ do .obsidian/plugins/foxycape-pdf w skarbcu
```

Ustaw `OBSIDIAN_PLUGIN_DIR` w `.env` (zobacz `.env.example`). `npm run dev` kopiuje wynik po każdym udanym budowaniu; `npm run link` czyta tę samą zmienną, a gdy jej brak, używa domyślnej ścieżki skarbca. Zmienna środowiska procesu ma pierwszeństwo przed plikiem.

## Licencja

To repozytorium jest **source available** i podlega [Foxycape Plugins License Agreement](LICENSE.md).

- Wolno używać, zmieniać i rozpowszechniać kod, z ograniczeniem: nie wolno zrobić z niego ogólnej oferty dla Obsidian (albo podobnej aplikacji do notatek), konkurującej z komercyjnymi produktami Foxycape — w tym bezpłatnej publicznej publikacji, z której usunięto kontrolę wersji próbnej albo licencji.
- Użytek prywatny, użytek wewnątrz jednej organizacji oraz praca na zamówienie dla konkretnego klienta pozostają dozwolone.
- Prawa wykraczające poza tę umowę: **company@tiefeiying.com**.

Składniki stron trzecich (na przykład PDF.js) i osobno wydane pakiety (na przykład `@foxycape/core` na MIT) zachowują własne licencje.

Pełny tekst jest w [LICENSE.md](LICENSE.md).
