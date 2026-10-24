<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Un lector de PDF para Obsidian. Los subrayados, las citas y los enlaces profundos vuelven al pasaje, y el hilo con las notas se mantiene. Al leer un artículo o un material de estudio, la traducción, la búsqueda de una palabra, la explicación y las preguntas ocurren en el PDF que ya está abierto.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Por qué

Leer un PDF en Obsidian suele cortar el camino hasta la nota:

- El subrayado se queda en el PDF; la nota de la bóveda, en otro sitio.
- Conseguir una figura suele ser una captura borrosa y difícil de ordenar.
- Una cita o una imagen pegada rara vez señala la página o la zona exacta.
- En un tema oscuro, una página PDF clara deslumbra.
- Cambiar de lector puede invalidar los enlaces de página y de selección que ya existen.

En un artículo o un material de estudio, una palabra desconocida, una frase larga o un concepto nuevo detienen la lectura. La traducción, el diccionario y las preguntas pasan a otra herramienta, y la página hay que casarla a mano.

Foxycape PDF cubre esos huecos dentro de Obsidian.

## Funciones

### Entender un artículo o un material de estudio en la página actual

#### Un artículo en otro idioma, de un vistazo a una lectura de verdad

Al seleccionar un pasaje se traduce y aparece primero el sentido. Microsoft es el motor predeterminado; el vistazo no gasta uso de IA. Para una redacción más cercana al campo, cambiar a IA, elegir **Priorizar velocidad** o **Priorizar calidad**, y la lengua de destino.

Si en ese pasaje queda una palabra dudosa, **Buscar palabra**. La pronunciación se muestra en AFI, pinyin o kana, junto con el sentido que tiene en este pasaje. Si la selección es una frase entera, primero va el sentido de la frase y después las palabras difíciles.

Si el pasaje sigue sin entenderse, **Explicar este pasaje** abre solo ese tramo para poder seguir leyendo. **Breve**, una o dos frases, basta para pasar de página. Para más, **Detallada**. **Más información** envía el pasaje y la explicación ya mostrada al panel lateral de **Preguntar a la IA**.

Traducciones, explicaciones y búsquedas de palabras quedan en la lista de este PDF. Se pueden filtrar y volver a esa página. Para guardarlas en la nota, hay que activar la escritura de cada tipo en los ajustes (desactivada por defecto). Se añaden al Markdown con el mismo nombre que el PDF.

<!-- GIF: docs/gifs/read-in-place.gif — seleccionar, traducir, buscar palabra, explicar -->

#### Leer un texto largo y preguntar

Selecciona un pasaje y pregunta a la IA. La pregunta lleva ese texto. Si el documento es largo, Foxycape pregunta antes si hay que analizarlo. Si se acepta, la respuesta se apoya en pasajes del documento y una cita abre la página. Si no, responde con conocimiento general. Más tarde se puede elegir **Analizar este libro** en el menú.

Al volver a una página desde una cita, si ese pasaje aún no se entiende, traducción, búsqueda y explicación siguen disponibles. Tras una respuesta aparecen preguntas relacionadas para continuar. Las conversaciones se guardan con este PDF: se pueden buscar o empezar una nueva.

<!-- GIF: docs/gifs/ask-while-reading.gif — preguntar al PDF abierto y volver a la página -->

### Modelo y uso

La explicación, la búsqueda, la traducción con IA y las preguntas usan el modelo seleccionado. El uso del modelo oficial se anota en el uso de IA de la licencia. También se puede indicar una **URL base** y una **clave de API** propias. La traducción de Microsoft no consume ese uso. La licencia se puede obtener gratis. El uso se puede comprar o recibir al compartir.

### El subrayado en la nota

El subrayado no tiene por qué quedarse solo en el PDF. Uno nuevo puede crear o actualizar una nota Markdown con el mismo nombre, añadir el extracto con un enlace de vuelta y, si se quiere, abrir esa nota en un panel dividido. Se puede desactivar en los ajustes.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — el subrayado escribe la nota del mismo nombre -->

### Extraer imágenes incrustadas

No hace falta conformarse con una captura borrosa. Al pasar el cursor por una imagen incrustada (en el móvil, el control táctil) se puede previsualizar, copiar o descargar el original.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — al pasar el cursor: vista previa, copiar, descargar -->

### Citar texto e imágenes, y volver al origen

La cita conserva la procedencia, y desde la nota se puede volver al PDF:

- Copiar una cita de texto como Markdown con enlace profundo (`#page=` / `#selection=` / `#markId=`).
- Copiar una cita de imagen. Al pegarla en Markdown se guarda un PNG junto al PDF y se inserta un enlace.
- Clic derecho en la imagen de la nota → **Abrir en Foxycape**, vuelta a la página y resalte de la zona original.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — copiar la cita → pegar → volver al PDF -->

### Adaptarse al tema de Obsidian

En una bóveda oscura, una página PDF clara molesta. Se pueden reasignar los grises de los vectores al primer plano y al fondo del tema (BETA): en todos los temas, solo en oscuro o solo en claro. Las figuras en color y los vectores en color se quedan como están.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — la página PDF sigue el tema -->

### Captura de una zona

Ya no hace falta el recorte del sistema ni unir páginas a mano. **Captura** en la barra de herramientas y arrastrar una zona sobre el PDF. Se puede copiar la imagen o una cita de imagen: tras pegarla en la nota, el clic derecho vuelve al lugar original.

Una zona en una sola página:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — zona de una página -->

Si la zona cruza el borde de página, se une en una imagen continua:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — varias páginas en una imagen -->

### Compatible con los enlaces del lector integrado

Cambiar de lector no debería romper los enlaces ya escritos. Foxycape entiende `#page=` y `#selection=` de Obsidian, puede ser el visor PDF predeterminado, reutiliza una pestaña abierta y con `#markId=` salta al subrayado exacto.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — abrir un enlace de página o de selección ya existente -->

### Estilos y lista de subrayados

Resaltador, subrayado ondulado y subrayado recto, con colores propios. La lista filtra, ordena, salta y borra.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — estilos y lista de subrayados -->

### Copia inteligente: quitar los saltos de línea blandos

La maquetación del PDF parte muchas frases por la mitad. Al copiar, sobran saltos de línea. Basta seleccionar y copiar como siempre: Foxycape quita esos saltos blandos y el pegado queda en un párrafo seguido. Los cortes de párrafo reales se conservan.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — seleccionar → copiar → pegar sin salto en mitad de la frase -->

### Navegación y búsqueda

Índice, miniaturas, salto de página y búsqueda en el documento (`Mod+F`), con mayúsculas, signos diacríticos y palabra completa. La búsqueda usa la capa de texto del PDF, sin OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — índice, miniaturas y búsqueda -->

### Disposición de lectura

Zoom (automático / ancho de página / porcentaje), desplazamiento vertical u horizontal, una página / dos páginas / libro, rotación y PDF con contraseña. En escritorio y en el móvil.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — disposición y zoom -->

### Visor PDF predeterminado

En los ajustes, activa **Usar como visor PDF predeterminado** para que Obsidian abra los PDF con Foxycape. Así los enlaces profundos, los subrayados y la adaptación al tema quedan completos.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — activar el visor PDF predeterminado -->

## Desarrollo

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # compilación en observación; copia a OBSIDIAN_PLUGIN_DIR tras cada éxito
npm test
npm run typecheck
npm run link       # junction de dist/ a .obsidian/plugins/foxycape-pdf de la bóveda
```

Define `OBSIDIAN_PLUGIN_DIR` en `.env` (mira `.env.example`). `npm run dev` copia el resultado allí tras cada compilación correcta; `npm run link` lee la misma variable y, si no está, usa la ruta de bóveda predeterminada. Una variable de entorno del proceso prevalece sobre el archivo.

## Licencia

Este repositorio es **source available** y se rige por el [Foxycape Plugins License Agreement](LICENSE.md).

- Se permite usar, modificar y redistribuir el código, con un límite: convertirlo en una oferta de propósito general para Obsidian (o una aplicación de notas parecida) que compita con los productos comerciales de Foxycape, incluidas las publicaciones públicas gratuitas que quiten los controles de prueba o de licencia.
- El uso privado, el uso interno de una sola organización y el trabajo a medida para un cliente siguen permitidos.
- Para derechos más allá de ese acuerdo, escribe a **company@tiefeiying.com**.

Los componentes de terceros (por ejemplo PDF.js) y los paquetes publicados aparte (por ejemplo `@foxycape/core` bajo MIT) conservan su propia licencia.

El texto completo está en [LICENSE.md](LICENSE.md).
