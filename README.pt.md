<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Um leitor de PDF para o Obsidian. Os realces, as citações e as ligações profundas voltam ao sítio no texto, e o fio das notas mantém-se. Ao ler um artigo ou um texto de estudo, a tradução, a procura de uma palavra, a explicação e as perguntas ficam no PDF que já está aberto.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Para quê

Ler um PDF no Obsidian parte muitas vezes a cadeia até à nota:

- O realce fica no PDF; a nota do cofre fica noutro sítio.
- Uma figura costuma ser uma captura desfocada, difícil de arrumar.
- Uma citação ou uma imagem colada raramente aponta para a página ou a zona exacta.
- Num tema escuro, uma página PDF clara encandeia.
- Mudar de leitor pode invalidar ligações de página e de selecção que já existem.

Num artigo ou num texto de estudo, uma palavra desconhecida, uma frase longa ou um conceito novo param a leitura. A tradução, o dicionário e as perguntas passam para outra ferramenta, e a página tem de se acertar à mão.

O Foxycape PDF tapa estas falhas dentro do Obsidian.

## Funções

### Perceber um artigo ou um texto de estudo na página actual

#### Um artigo noutra língua, de uma passagem de olhos a uma leitura a sério

Seleccionar uma passagem traduz-a e mostra primeiro o sentido. A Microsoft é o motor predefinido; a leitura em diagonal não gasta utilização de IA. Para uma redacção mais próxima da área, mudar para IA, escolher **Velocidade primeiro** ou **Qualidade primeiro**, e a língua de destino.

Se nessa passagem uma palavra continua duvidosa, **Procurar palavra**. A pronúncia aparece em AFI, pinyin ou kana, com o sentido que tem nesta passagem. Se a selecção for uma frase inteira, vem primeiro o sentido da frase e depois as palavras difíceis.

Se a passagem continuar pouco clara, **Explicar esta passagem** abre só esse trecho, para se poder continuar a ler. **Breve**, uma ou duas frases, chega para virar a página. Para mais, **Detalhada**. **Saber mais** envia a passagem e a explicação já mostrada para o painel lateral de **Perguntar à IA**.

Traduções, explicações e palavras procuradas ficam na lista deste PDF. Dá para as filtrar e voltar à página. Para as guardar na nota, ligar a escrita de cada tipo nas definições (desligada por predefinição). São acrescentadas ao Markdown com o mesmo nome do PDF.

<!-- GIF: docs/gifs/read-in-place.gif — seleccionar, traduzir, procurar palavra, explicar -->

#### Ler um texto longo e ir perguntando

Seleccionar uma passagem e perguntar à IA. A pergunta leva esse texto. Se o documento for longo, o Foxycape pergunta primeiro se deve analisá-lo. Em caso afirmativo, a resposta apoia-se em passagens do documento e uma citação abre a página. Em caso negativo, responde com conhecimento geral. Mais tarde pode escolher-se **Analisar este livro** no menu.

Ao voltar a uma página por uma citação, se essa passagem ainda não estiver clara, a tradução, a procura e a explicação continuam à mão. Depois de uma resposta surgem perguntas relacionadas para continuar. As conversas ficam com este PDF: podem procurar-se ou começar uma nova.

<!-- GIF: docs/gifs/ask-while-reading.gif — perguntar ao PDF aberto e voltar à página -->

### Modelo e utilização

A explicação, a procura, a tradução por IA e as perguntas usam o modelo escolhido. O uso do modelo oficial conta para a utilização de IA da licença. Também se pode indicar um **URL de base** e uma **chave de API** próprios. A tradução da Microsoft não entra nessa utilização. A licença pode obter-se de graça. A utilização pode comprar-se ou receber-se ao partilhar.

### O realce na nota

O realce não tem de ficar só no PDF. Um novo pode criar ou actualizar uma nota Markdown com o mesmo nome, acrescentar o excerto com uma ligação de regresso e, se se quiser, abrir essa nota num painel dividido. Desliga-se nas definições.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — o realce escreve a nota com o mesmo nome -->

### Extrair imagens incorporadas

Não é preciso contentar-se com uma captura desfocada. Ao pairar sobre uma imagem incorporada (no telemóvel, o controlo táctil) pode pré-visualizar-se, copiar-se ou descarregar o original.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — pairar: pré-visualizar, copiar, descarregar -->

### Citar texto e imagens, e voltar à origem

A citação guarda a proveniência, e da nota volta-se ao PDF:

- Copiar uma citação de texto como Markdown com ligação profunda (`#page=` / `#selection=` / `#markId=`).
- Copiar uma citação de imagem. Colada num Markdown, guarda um PNG ao lado do PDF e insere uma ligação.
- Botão direito na imagem da nota → **Abrir no Foxycape**, regresso à página e realce da zona original.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — copiar a citação → colar → voltar ao PDF -->

### Acompanhar o tema do Obsidian

Num cofre escuro, uma página PDF clara cansa. Os cinzentos dos vectores podem passar para o primeiro plano e o fundo do tema (BETA): em todos os temas, só no escuro ou só no claro. Figuras a cores e vectores a cores ficam como estão.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — a página PDF segue o tema -->

### Captura de uma zona

Já não é preciso a captura do sistema nem juntar páginas à mão. **Captura** na barra de ferramentas e arrastar uma zona sobre o PDF. Pode copiar-se a imagem ou uma citação de imagem: depois de a colar na nota, o botão direito volta ao sítio original.

Uma zona numa só página:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — zona numa página -->

Se a zona atravessa a margem da página, junta-se numa imagem contínua:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — várias páginas numa imagem -->

### Compatível com as ligações do leitor integrado

Mudar de leitor não devia partir as ligações já escritas. O Foxycape entende `#page=` e `#selection=` do Obsidian, pode ser o visualizador PDF predefinido, reutiliza um separador aberto e com `#markId=` salta para o realce exacto.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — abrir uma ligação de página ou de selecção já existente -->

### Estilos e lista de realces

Marcador, sublinhado ondulado e sublinhado recto, com cores à escolha. A lista filtra, ordena, salta e apaga.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — estilos e lista de realces -->

### Cópia inteligente — tirar as quebras de linha suaves

A paginação do PDF parte muitas frases a meio. Ao copiar, sobram mudanças de linha. Basta seleccionar e copiar como de costume: o Foxycape tira essas quebras suaves e a colagem fica um parágrafo seguido. As verdadeiras mudanças de parágrafo mantêm-se.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — seleccionar → copiar → colar sem quebra a meio da frase -->

### Navegação e pesquisa

Índice, miniaturas, salto de página e pesquisa no documento (`Mod+F`), com maiúsculas, sinais diacríticos e palavra inteira. A pesquisa usa a camada de texto do PDF, sem OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — índice, miniaturas e pesquisa -->

### Disposição de leitura

Zoom (automático / largura da página / percentagem), deslocação vertical ou horizontal, página simples / dupla / livro, rotação e PDF com palavra-passe. No computador e no telemóvel.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — disposição e zoom -->

### Leitor de PDF predefinido

Nas definições, activar **Usar como visualizador PDF predefinido** para o Obsidian abrir os PDF com o Foxycape. As ligações profundas, os realces e a adaptação ao tema ficam então completos.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — activar o visualizador PDF predefinido -->

## Desenvolvimento

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # compilação vigiada; copia para OBSIDIAN_PLUGIN_DIR após cada sucesso
npm test
npm run typecheck
npm run link       # junction de dist/ para .obsidian/plugins/foxycape-pdf do cofre
```

Definir `OBSIDIAN_PLUGIN_DIR` em `.env` (ver `.env.example`). O `npm run dev` copia o resultado para lá após cada compilação bem sucedida; o `npm run link` lê a mesma variável e, se não estiver definida, usa o caminho predefinido do cofre. Uma variável de ambiente do processo prevalece sobre o ficheiro.

## Licença

Este repositório é **source available** e rege-se pelo [Foxycape Plugins License Agreement](LICENSE.md).

- É permitido usar, modificar e redistribuir o código, com um limite: transformá-lo numa oferta de uso geral para o Obsidian (ou uma aplicação de notas semelhante) que concorra com os produtos comerciais da Foxycape — incluindo uma publicação pública gratuita da qual se tenham retirado os controlos de avaliação ou de licença.
- O uso privado, o uso interno de uma só organização e o trabalho à medida para um cliente continuam permitidos.
- Para direitos além desse acordo, escrever para **company@tiefeiying.com**.

Os componentes de terceiros (por exemplo o PDF.js) e os pacotes publicados à parte (por exemplo `@foxycape/core` sob MIT) mantêm a sua licença.

O texto completo está em [LICENSE.md](LICENSE.md).
