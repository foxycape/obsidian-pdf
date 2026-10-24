<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

A PDF reader for Obsidian that stays connected to your notes — highlights, citations, and deep links that take you back to the source. When you read a paper or study material, translation, word lookup, explanations, and questions all happen in the PDF you already have open.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Why

Reading PDFs inside Obsidian often breaks the note-taking loop:

- Highlights stay in the PDF; your vault notes stay elsewhere.
- Grabbing a figure usually means a blurry screenshot.
- Pasted quotes and images rarely point back to the exact page or region.
- Light PDF pages feel harsh in a dark vault theme.
- Switching readers can break page/selection links you already use.

In a paper or a study text, an unfamiliar word, a long sentence, or a new concept brings reading to a stop. Translation, a dictionary, and questions belong to another tool, and the page still has to be matched by hand.

Foxycape PDF fills these gaps inside Obsidian.

## Features

### Understand a paper or study text on this page

#### A paper in another language, from a skim to a close reading

Select a passage to translate it and catch the sense first. Microsoft translation is the default and does not use AI traffic. For wording closer to the field, switch to AI, then choose Speed first or Quality first and pick the target language.

If a word in that passage is still unclear, use Look up. Pronunciation is shown in IPA, pinyin, or kana, together with the meaning it has in this passage. When the selection is a whole sentence, the sentence meaning comes first, then the difficult words.

If the passage is still unclear, use Explain to open it up so you can keep reading. Brief — a sentence or two — is enough to turn the page. Choose Detailed when you want more. Learn more sends the passage and the explanation you already have into Ask AI in the side panel.

Translations, explanations, and lookups stay in the list for this PDF. You can filter them and jump back to the page. To keep them in a note, turn writing on for each one in settings (off by default). They are appended to the Markdown file with the same name as the PDF.

<!-- GIF: docs/gifs/read-in-place.gif — select text, then translate, look up, or explain -->

#### Ask while you read a long text

Select a passage and ask AI. The question includes that passage. On a long document, Foxycape first asks whether to analyze it. If you agree, the answer draws on passages in the document, and a citation opens the page. If you decline, the answer uses general knowledge. You can choose **Analyze this book** from the menu later.

When a citation brings you back to a page and that passage is still unclear, translate it, look it up, or explain it, then keep reading. After an answer, related questions are there to continue. Chats are saved with this PDF, so next time you can search them or start a new one.

<!-- GIF: docs/gifs/ask-while-reading.gif — ask about the open PDF and jump back from a citation -->

### Model and traffic

Explain, lookup, AI translation, and Ask AI use the model you have selected. Usage of the official model is counted against the AI traffic on your license. You can also enter your own Base URL and API key. Microsoft translation does not use that traffic. A license can be claimed for free. Traffic can be purchased, or received by sharing.

### Highlight → note sync

Instead of leaving highlights stranded in the PDF, each new highlight can create or update a Markdown note with the same name, append the excerpt with a back-link, and optionally open that note in a split pane. Turn it off anytime in settings.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — highlight creates/updates a sidecar note -->

### Extract embedded images

Skip blurry screenshots. Hover an embedded image (or use the touch control on mobile) to preview, copy, or download the original asset.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — hover lens: preview / copy / download -->

### Cite text and images, then jump back

Citations stay tied to the source, so you can jump back from the note later:

- Copy a text citation as Markdown with a deep link (`#page=` / `#selection=` / `#markId=`).
- Copy an image citation; paste into Markdown to save a PNG next to the PDF and insert a clickable link.
- Right-click the note image → **Open in Foxycape** to return to the page and highlight the original region.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — copy cite → paste → open back in PDF -->

### Theme-aware PDF pages

Bright PDF pages can fight a dark vault. Optionally remap grayscale vector colors to your theme foreground/background (BETA) — for all themes, dark only, or light only. Color artwork stays as-is.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — PDF page follows Obsidian theme -->

### Region screenshot

Skip the OS snipping tool, and skip stitching pages by hand. Click **Screenshot** in the toolbar and drag a region on the PDF. Copy the image, or copy an image citation so you can jump back from the note later.

Crop a region on a single page:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — single-page region screenshot -->

Span the page gap and Foxycape stitches it into one continuous image:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — multi-page continuous screenshot -->

### Compatible with Obsidian’s built-in PDF links

Switching readers shouldn’t break the links you already have. Foxycape understands Obsidian-style `#page=` and `#selection=`, can become the default PDF viewer, reuses an open tab when possible, and adds `#markId=` for precise highlight jumps.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — open an existing page/selection link -->

### Highlights and highlight list

Highlighter, wavy underline, and straight underline with custom colors. Browse highlights in a list — filter, sort, jump, or delete.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — apply styles and browse the highlight list -->

### Smart copy — unwrap soft line breaks

PDF lines often insert hard breaks mid-sentence. Select text and copy as usual: Foxycape strips those soft wraps so the paste reads as continuous prose, while keeping real paragraph breaks.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — select text → copy → paste without mid-sentence newlines -->

### Navigation and search

Outline (TOC), page thumbnails, page picker, and in-document search (`Mod+F`) with case / diacritic / whole-word options. Search uses the PDF text layer (no OCR).

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — TOC, thumbnails, and search -->

### Reading layout

Zoom (auto / page width / percentages), vertical or horizontal scroll, single / facing / book layout, page rotation, password-protected PDFs. Works on desktop and mobile.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — layout and zoom controls -->

### Set as the default PDF reader

For the smoothest experience—deep links, highlights, and theme-aware pages—turn on **Use as default PDF viewer** in Foxycape settings so Obsidian opens PDFs with Foxycape by default.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — enable default PDF viewer in settings -->

## Develop

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # watch build; copies into OBSIDIAN_PLUGIN_DIR after each success
npm test
npm run typecheck
npm run link       # junction dist/ into your vault's .obsidian/plugins/foxycape-pdf
```

Set `OBSIDIAN_PLUGIN_DIR` in `.env` (see `.env.example`). `npm run dev` copies the build there after each successful watch rebuild; `npm run link` reads the same variable and still falls back to the default vault path when it is unset. A process environment variable wins over the file.

## License

This repository is **source available** under the [Foxycape Plugins License Agreement](LICENSE.md).

- You may use, modify, and redistribute the code, with a restriction on general-purpose competing Obsidian (or similar) offerings — including free public listings that strip trial/license controls.
- Private use, internal use within a single organization, and bespoke client-specific work remain allowed.
- For rights beyond that Agreement, contact **company@tiefeiying.com**.

Third-party components (for example PDF.js) and separately published packages (for example `@foxycape/core` under MIT) keep their own licenses.

See [LICENSE.md](LICENSE.md) for the full text.
