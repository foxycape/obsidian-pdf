<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Un lecteur PDF pour Obsidian. Surlignages, citations et liens profonds ramènent au passage, et le fil des notes reste en place. Pour un article ou un document de travail, traduction, recherche de mot, explication et questions se font dans le PDF déjà ouvert.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Pourquoi

Lire un PDF dans Obsidian casse souvent la chaîne vers la note :

- Le surlignage reste dans le PDF, la note du coffre est ailleurs.
- Une figure, c’est souvent une capture floue, difficile à tenir.
- Une citation ou une image collée pointe rarement vers la page ou la zone exacte.
- Une page PDF claire agresse dans un coffre sombre.
- Changer de lecteur peut invalider les liens de page et de sélection déjà écrits.

Dans un article ou un document d’étude, un mot inconnu, une phrase longue ou une notion nouvelle arrête la lecture. Traduction, dictionnaire et questions passent dans un autre outil, et il faut retrouver la page soi-même.

Foxycape PDF comble ces manques dans Obsidian.

## Fonctions

### Comprendre un article ou un document sur la page en cours

#### Un article en langue étrangère, du survol à la lecture

Sélectionner un passage le traduit et en donne d’abord le sens. Microsoft est le moteur par défaut ; le survol ne consomme pas d’utilisation d’IA. Pour une formulation plus proche du domaine, passer à l’IA, choisir **Vitesse d’abord** ou **Qualité d’abord**, et la langue cible.

Si un mot du passage reste douteux, **Chercher le mot**. La prononciation est donnée en alphabet phonétique international, en pinyin ou en kana, avec le sens qu’il a dans ce passage. Pour une phrase entière, le sens de la phrase vient d’abord, puis les mots difficiles.

Si le passage reste obscur, **Expliquer ce passage** ne traite que ce passage, pour continuer la lecture. **Bref**, une phrase ou deux, suffit pour tourner la page. Pour aller plus loin, choisir **Détaillé**. **En savoir plus** envoie le passage et l’explication déjà affichée dans **Demander à l’IA**, dans le panneau latéral.

Traductions, explications et recherches de mots restent dans la liste de ce PDF. On peut les filtrer et revenir à la page. Pour les écrire dans la note, activer l’écriture de chaque type dans les réglages (désactivée par défaut). Elles s’ajoutent au fichier Markdown du même nom que le PDF.

<!-- GIF: docs/gifs/read-in-place.gif — sélection, traduction, mot, explication -->

#### Lire un long document en posant des questions

Sélectionner un passage et **Demander à l’IA**. La question emporte ce texte. Si le document est long, Foxycape demande d’abord s’il faut l’analyser. En cas d’accord, la réponse s’appuie sur des passages du document, et une citation ouvre la page. Sinon, elle s’appuie sur des connaissances générales. **Analyser ce livre** reste disponible plus tard dans le menu.

De retour sur une page par une citation, si le passage n’est toujours pas clair, traduction, recherche de mot et explication restent là. Après une réponse, des questions liées permettent de continuer. Les conversations sont gardées avec ce PDF : on peut les chercher, ou en ouvrir une nouvelle.

<!-- GIF: docs/gifs/ask-while-reading.gif — interroger le PDF ouvert et revenir à la page -->

### Modèle et utilisation

Explication, recherche de mot, traduction par IA et questions utilisent le modèle choisi. L’usage du modèle officiel est imputé à l’utilisation d’IA de la licence. On peut aussi indiquer sa propre **URL de base** et sa **clé API**. La traduction Microsoft n’entre pas dans cette utilisation. La licence peut être obtenue gratuitement. L’utilisation peut être achetée, ou reçue en partageant.

### Le surlignage dans la note

Le surlignage n’a pas à rester seul dans le PDF. Un nouveau surlignage peut créer ou mettre à jour une note Markdown du même nom, y ajouter l’extrait avec un lien de retour, et ouvrir cette note en volet partagé. On peut le couper dans les réglages.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — le surlignage écrit la note du même nom -->

### Extraire les images intégrées

Inutile de se contenter d’une capture floue. Survoler une image intégrée (commande tactile sur mobile) pour la prévisualiser, la copier ou télécharger l’original.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — survol : aperçu, copie, téléchargement -->

### Citer un texte ou une image, puis revenir

La citation garde sa source, et la note peut rouvrir le PDF :

- Copier une citation de texte en Markdown avec un lien profond (`#page=` / `#selection=` / `#markId=`).
- Copier une citation d’image. Collée dans un Markdown, elle enregistre un PNG à côté du PDF et insère un lien cliquable.
- Clic droit sur l’image dans la note → **Ouvrir dans Foxycape**, retour à la page et surbrillance de la zone d’origine.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — copier la citation → coller → revenir au PDF -->

### Suivre le thème d’Obsidian

Dans un coffre sombre, une page PDF claire fatigue. On peut reporter les gris des vecteurs sur le premier plan et l’arrière-plan du thème (BÊTA), pour tous les thèmes, seulement le sombre, ou seulement le clair. Les images en couleur et les vecteurs en couleur restent tels quels.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — la page PDF suit le thème -->

### Capture d’une zone

Plus besoin de l’outil de capture du système, ni d’assembler les pages à la main. **Capture** dans la barre d’outils, puis glisser une zone sur le PDF. Copier l’image, ou copier une citation d’image : après collage dans la note, un clic droit ramène à l’endroit d’origine.

Une zone sur une seule page :

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — zone sur une page -->

Si la zone franchit le bord de page, elle est assemblée en une image continue :

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — plusieurs pages en une image -->

### Compatible avec les liens du lecteur intégré

Changer de lecteur ne devrait pas casser les liens déjà écrits. Foxycape comprend `#page=` et `#selection=` d’Obsidian, peut devenir le lecteur PDF par défaut, réutilise un onglet déjà ouvert, et `#markId=` mène précisément au surlignage.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — ouvrir un lien de page ou de sélection déjà écrit -->

### Styles et liste des surlignages

Surligneur, soulignement ondulé, soulignement droit, et couleurs au choix. La liste filtre, trie, saute à l’endroit et supprime.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — styles et liste des surlignages -->

### Copie intelligente — retirer les retours à la ligne mous

La mise en page PDF coupe souvent une phrase au milieu. La copie est alors pleine de retours inutiles. Sélectionner et copier comme d’habitude : Foxycape retire ces coupures, et le collage forme un paragraphe continu. Les vrais changements de paragraphe restent.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — sélection → copie → collage sans retour au milieu de la phrase -->

### Navigation et recherche

Table des matières, miniatures, saut de page, et recherche dans le document (`Mod+F`), avec casse, signes diacritiques et mot entier. La recherche utilise la couche de texte du PDF, sans OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — sommaire, miniatures et recherche -->

### Mise en page de lecture

Zoom (auto / largeur de page / pourcentage), défilement vertical ou horizontal, page simple / double / livre, rotation, PDF avec mot de passe. Sur ordinateur et sur mobile.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — mise en page et zoom -->

### Lecteur PDF par défaut

Dans les réglages, activer **Utiliser comme lecteur PDF par défaut** pour qu’Obsidian ouvre les PDF avec Foxycape. Liens profonds, surlignages et adaptation au thème sont alors au complet.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — activer le lecteur PDF par défaut -->

## Développement

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # build surveillé ; copie dans OBSIDIAN_PLUGIN_DIR après chaque succès
npm test
npm run typecheck
npm run link       # junction de dist/ vers .obsidian/plugins/foxycape-pdf du coffre
```

Régler `OBSIDIAN_PLUGIN_DIR` dans `.env` (voir `.env.example`). `npm run dev` y copie le résultat après chaque build réussi ; `npm run link` lit la même variable et retombe sur le coffre par défaut si elle est absente. Une variable d’environnement du processus l’emporte sur le fichier.

## Licence

Ce dépôt est **source available** et relève du [Foxycape Plugins License Agreement](LICENSE.md).

- L’usage, la modification et la redistribution sont permis, avec une limite : en faire une offre généraliste pour Obsidian (ou une application de notes comparable), en concurrence avec les produits commerciaux de Foxycape — y compris une mise en ligne publique gratuite dont les contrôles d’essai ou de licence ont été retirés.
- L’usage privé, l’usage interne à une seule organisation, et le travail sur mesure pour un client restent permis.
- Pour des droits au-delà de cet accord, écrire à **company@tiefeiying.com**.

Les composants tiers (par exemple PDF.js) et les paquets publiés à part (par exemple `@foxycape/core` sous MIT) gardent leur propre licence.

Le texte complet est dans [LICENSE.md](LICENSE.md).
