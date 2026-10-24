<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Um leitor de PDF para o Obsidian. Os realces, as citações e os links profundos voltam ao trecho, e o fio com as notas continua. Ao ler um artigo ou um material de estudo, a tradução, a busca de uma palavra, a explicação e as perguntas acontecem no PDF que já está aberto.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Por que existe

Ler um PDF no Obsidian costuma cortar o caminho até a nota:

- O realce fica no PDF; a nota do cofre fica em outro lugar.
- Uma figura vira, quase sempre, uma captura borrada e difícil de organizar.
- Uma citação ou uma imagem colada raramente aponta a página ou a região exata.
- Num tema escuro, uma página clara de PDF ofusca.
- Trocar de leitor pode invalidar links de página e de seleção que você já tem.

Num artigo ou num material de estudo, uma palavra desconhecida, uma frase longa ou um conceito novo interrompem a leitura. Tradução, dicionário e perguntas vão para outra ferramenta, e a página precisa ser encontrada na mão.

O Foxycape PDF cobre essas lacunas dentro do Obsidian.

## Recursos

### Entender um artigo ou um material de estudo na página atual

#### Um artigo em outro idioma, de uma passada de olho a uma leitura de verdade

Selecionar um trecho traduz na hora e mostra primeiro o sentido. A Microsoft é o padrão; a leitura rápida não gasta uso de IA. Para uma redação mais próxima da área, mude para IA, escolha **Velocidade primeiro** ou **Qualidade primeiro** e o idioma de destino.

Se nesse trecho uma palavra ainda estiver incerta, use **Buscar palavra**. A pronúncia aparece em AFI, pinyin ou kana, junto com o sentido que ela tem nesse trecho. Se a seleção for uma frase inteira, vem primeiro o sentido da frase e depois as palavras difíceis.

Se o trecho continuar opaco, **Explicar esta passagem** abre só esse pedaço, para a leitura seguir. **Breve**, uma ou duas frases, basta para virar a página. Para ir além, escolha **Detalhada**. **Saiba mais** manda o trecho e a explicação já exibida para o painel lateral de **Pergunte à IA**.

Traduções, explicações e buscas de palavra ficam na lista deste PDF. Dá para filtrar e voltar à página. Para gravá-las na nota, ative a escrita de cada tipo nas configurações (desligada por padrão). Elas são acrescentadas ao Markdown com o mesmo nome do PDF.

<!-- GIF: docs/gifs/read-in-place.gif — selecionar, traduzir, buscar palavra, explicar -->

#### Ler um texto longo e perguntar no meio

Selecione um trecho e pergunte à IA. A pergunta leva esse texto. Se o documento for longo, o Foxycape pergunta antes se deve analisá-lo. Se você concordar, a resposta se apoia em trechos do documento e uma citação abre a página. Se não, ela usa conhecimento geral. Depois ainda dá para escolher **Analisar este livro** no menu.

Ao voltar a uma página por uma citação, se aquele trecho ainda não ficou claro, tradução, busca e explicação continuam à mão. Depois de uma resposta aparecem perguntas relacionadas para seguir. As conversas ficam com este PDF: dá para pesquisá-las ou abrir uma nova.

<!-- GIF: docs/gifs/ask-while-reading.gif — perguntar ao PDF aberto e voltar à página -->

### Modelo e uso

Explicação, busca, tradução por IA e perguntas usam o modelo selecionado. O uso do modelo oficial entra no uso de IA da licença. Também dá para informar uma **URL base** e uma **chave de API** suas. A tradução da Microsoft não consome esse uso. A licença pode ser obtida de graça. O uso pode ser comprado ou recebido ao compartilhar.

### O realce na nota

O realce não precisa ficar só no PDF. Um novo pode criar ou atualizar uma nota Markdown com o mesmo nome, acrescentar o trecho com um link de volta e, se quiser, abrir essa nota num painel dividido. Dá para desligar isso nas configurações.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — o realce grava a nota de mesmo nome -->

### Extrair imagens incorporadas

Não precisa se contentar com uma captura borrada. Ao passar o cursor sobre uma imagem incorporada (no celular, o controle de toque), dá para visualizar, copiar ou baixar o original.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — passar o cursor: visualizar, copiar, baixar -->

### Citar texto e imagens, e voltar à origem

A citação guarda a procedência, e da nota dá para voltar ao PDF:

- Copie uma citação de texto como Markdown com link profundo (`#page=` / `#selection=` / `#markId=`).
- Copie uma citação de imagem. Colada num Markdown, ela salva um PNG ao lado do PDF e insere um link.
- Clique com o botão direito na imagem da nota → **Abrir no Foxycape**, volta à página e destaca a região original.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — copiar a citação → colar → voltar ao PDF -->

### Acompanhar o tema do Obsidian

Num cofre escuro, uma página clara de PDF incomoda. Os cinzas dos vetores podem ir para o primeiro plano e o fundo do tema (BETA): em todos os temas, só no escuro ou só no claro. Figuras coloridas e vetores coloridos ficam como estão.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — a página do PDF segue o tema -->

### Captura de uma região

Não precisa mais da captura do sistema nem de emendar páginas na mão. **Captura** na barra de ferramentas e arraste uma região sobre o PDF. Dá para copiar a imagem ou uma citação de imagem: depois de colar na nota, o clique direito volta ao lugar original.

Uma região numa única página:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — região de uma página -->

Se a região atravessa a borda da página, ela vira uma imagem contínua:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — várias páginas numa imagem -->

### Compatível com os links do leitor integrado

Trocar de leitor não deveria quebrar os links que você já escreveu. O Foxycape entende `#page=` e `#selection=` do Obsidian, pode ser o visualizador de PDF padrão, reaproveita uma aba aberta e, com `#markId=`, salta até o realce exato.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — abrir um link de página ou de seleção que já existe -->

### Estilos e lista de realces

Marca-texto, sublinhado ondulado e sublinhado reto, com cores à escolha. A lista filtra, ordena, salta e apaga.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — estilos e lista de realces -->

### Cópia inteligente — tirar as quebras de linha suaves

A diagramação do PDF parte muitas frases no meio. Ao copiar, sobram quebras de linha. Basta selecionar e copiar como sempre: o Foxycape remove essas quebras suaves e a colagem vira um parágrafo contínuo. As quebras reais de parágrafo ficam.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — selecionar → copiar → colar sem quebra no meio da frase -->

### Navegação e busca

Sumário, miniaturas, salto de página e busca no documento (`Mod+F`), com maiúsculas, sinais diacríticos e palavra inteira. A busca usa a camada de texto do PDF, sem OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — sumário, miniaturas e busca -->

### Disposição de leitura

Zoom (automático / largura da página / porcentagem), rolagem vertical ou horizontal, página única / dupla / livro, rotação e PDF com senha. No computador e no celular.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — disposição e zoom -->

### Leitor de PDF padrão

Nas configurações, ative **Usar como visualizador PDF padrão** para o Obsidian abrir os PDFs com o Foxycape. Links profundos, realces e adaptação ao tema ficam completos.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — ativar o visualizador de PDF padrão -->

## Desenvolvimento

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # build em observação; copia para OBSIDIAN_PLUGIN_DIR após cada sucesso
npm test
npm run typecheck
npm run link       # junction de dist/ para .obsidian/plugins/foxycape-pdf do cofre
```

Defina `OBSIDIAN_PLUGIN_DIR` no `.env` (veja `.env.example`). O `npm run dev` copia o resultado para lá depois de cada build bem-sucedido; o `npm run link` lê a mesma variável e, se ela não existir, usa o caminho padrão do cofre. Uma variável de ambiente do processo prevalece sobre o arquivo.

## Licença

Este repositório é **source available** e segue o [Foxycape Plugins License Agreement](LICENSE.md).

- É permitido usar, modificar e redistribuir o código, com um limite: transformá-lo numa oferta de uso geral para o Obsidian (ou um aplicativo de notas parecido) que concorra com os produtos comerciais da Foxycape — inclusive uma publicação pública gratuita da qual se tenham removido os controles de avaliação ou de licença.
- O uso privado, o uso interno de uma única organização e o trabalho sob medida para um cliente continuam permitidos.
- Para direitos além desse acordo, escreva para **company@tiefeiying.com**.

Componentes de terceiros (por exemplo o PDF.js) e pacotes publicados à parte (por exemplo `@foxycape/core` sob MIT) mantêm a própria licença.

O texto completo está em [LICENSE.md](LICENSE.md).
