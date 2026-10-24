<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Obsidian용 PDF 리더입니다. 하이라이트, 인용, 딥링크로 원문의 그 자리에 돌아갈 수 있고, 노트 작업의 흐름이 이어집니다. 논문이나 학습 자료를 읽을 때 번역, 단어 찾기, 설명, 질문은 지금 연 PDF 안에서 끝납니다.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## 왜 필요한가

Obsidian에서 PDF를 읽으면 노트까지의 고리가 자주 끊깁니다.

- 하이라이트는 PDF에 남고, 보관함의 노트는 다른 곳에 있습니다.
- 그림이 필요하면 스크린샷뿐이고, 흐릿해서 다루기 어렵습니다.
- 붙여 넣은 인용과 이미지가 정확한 페이지나 영역을 가리키지 않습니다.
- 어두운 테마에서 밝은 PDF 페이지는 눈이 부십니다.
- 리더를 바꾸면 이미 써 둔 페이지·선택 영역 링크가 깨질 수 있습니다.

논문이나 학습 자료에서는 모르는 단어, 긴 문장, 낯선 개념에서 읽기가 멈춥니다. 번역, 사전, 질문은 다른 도구로 넘어가고, 페이지 번호는 직접 맞춰야 합니다.

Foxycape PDF는 이 빈자리를 Obsidian 안에서 채웁니다.

## 기능

### 지금 이 페이지에서 논문과 학습 자료를 읽기

#### 외국어 논문, 훑어보기에서 이해하기까지

구간을 선택하면 바로 번역할 수 있어, 먼저 대의를 봅니다. 기본은 Microsoft 번역이며, 훑어볼 때는 AI 사용량이 들지 않습니다. 전문 표현에 더 가깝게 하려면 AI로 바꾸고, **속도 우선**과 **품질 우선** 중에서 고르며 대상 언어도 지정합니다.

그 구간에 아직 뜻이 불분명한 단어가 있으면 **단어 찾기**를 씁니다. 발음은 국제 음성 기호, 병음, 또는 가나로 나오고, 이 구간에서의 뜻도 함께 나옵니다. 문장 전체를 선택하면 먼저 문장 뜻, 그다음 어려운 단어입니다.

아직 이해가 안 되면 **이 부분 설명**으로 그 구간만 풀어, 이어서 읽을 수 있습니다. **간략히**는 한두 문장이면 다음 페이지로 넘어가기에 충분하고, 더 보려면 **자세히**를 고릅니다. 더 묻고 싶으면 **자세히 알아보기**를 눌러, 원문과 이미 나온 설명이 옆 패널의 **AI에게 질문**으로 넘어갑니다.

번역, 설명, 단어 찾기는 이 PDF의 목록에 남습니다. 나중에 거르고 그 페이지로 돌아갈 수 있습니다. 노트에 남기려면 설정에서 종류마다 기록을 켭니다(기본값은 끔). PDF와 같은 이름의 Markdown에 덧붙습니다.

<!-- GIF: docs/gifs/read-in-place.gif — 선택 후 번역, 단어 찾기, 설명 -->

#### 긴 자료를 읽으며 묻기

구간을 선택해 바로 **AI에게 질문**할 수 있습니다. 질문에는 그 원문이 붙습니다. 문서가 길면, 먼저 이 문서를 분석할지 묻습니다. 동의하면 답은 문서 속 문단에 기대고, 인용을 누르면 해당 페이지가 열립니다. 동의하지 않으면 일반 지식으로 답합니다. 나중에 메뉴에서 **이 책 분석**을 고를 수도 있습니다.

인용으로 어떤 페이지에 돌아온 뒤 그 구간이 아직 어려우면, 번역, 단어 찾기, 설명을 이어서 쓸 수 있습니다. 답이 끝나면 이어서 누를 관련 질문이 나옵니다. 대화는 이 PDF에 저장되어, 다음에 열어 검색하거나 새 대화를 시작할 수 있습니다.

<!-- GIF: docs/gifs/ask-while-reading.gif — 연 PDF에 질문하고 인용에서 페이지로 돌아가기 -->

### 모델과 사용량

설명, 단어 찾기, AI 번역, AI 질문은 지금 선택한 모델을 씁니다. 공식 모델의 사용량은 라이선스의 AI 사용량에 기록됩니다. 자신의 **기본 URL**과 **API 키**를 넣을 수도 있습니다. Microsoft 번역은 이 사용량을 쓰지 않습니다. 라이선스는 무료로 받을 수 있고, 사용량은 구매하거나 공유해서 얻을 수 있습니다.

### 하이라이트를 노트로

하이라이트를 PDF 안에만 둘 필요가 없습니다. 새 하이라이트는 PDF와 같은 이름의 Markdown 노트를 만들거나 고치고, 되돌아갈 링크가 있는 발췌를 덧붙입니다. 그 노트를 분할 화면으로 열 수도 있습니다. 필요 없으면 설정에서 끕니다.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — 하이라이트 후 같은 이름 노트에 기록 -->

### 포함된 이미지를 원본으로

흐린 스크린샷에 기대지 않아도 됩니다. 포함된 이미지 위에 커서를 올리거나(모바일은 터치) 미리 보기, 복사, 원본 다운로드를 할 수 있습니다.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — 올려서 미리 보기, 복사, 다운로드 -->

### 글과 그림 인용, 원문으로

인용에는 출처가 붙어, 나중에 노트에서 PDF로 돌아갈 수 있습니다.

- 글 인용을 딥링크가 있는 Markdown으로 복사합니다 (`#page=` / `#selection=` / `#markId=`).
- 그림 인용을 복사합니다. Markdown에 붙이면 PNG가 PDF 옆에 저장되고, 누를 수 있는 링크가 들어갑니다.
- 노트의 그림을 오른쪽 클릭 → **Foxycape에서 열기**. 해당 페이지로 돌아가 원래 영역이 강조됩니다.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — 인용 복사 → 붙여넣기 → PDF로 돌아가기 -->

### Obsidian 테마에 맞추기

어두운 보관함에서 밝은 PDF 페이지는 눈이 부십니다. 회색조 벡터 색을 테마의 전경·배경에 맞출 수 있습니다(BETA). 범위는 전체, 다크만, 라이트만 중에서 고릅니다. 컬러 그림과 컬러 벡터는 그대로입니다.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — PDF 페이지가 테마를 따름 -->

### 영역 스크린샷

시스템 스크린샷으로 나가거나, 페이지를 넘겨 직접 이어 붙일 필요가 없습니다. 도구 막대의 **스크린샷**을 누르고 PDF 위에서 영역을 끕니다. 그림을 복사하거나 그림 인용을 복사합니다. 노트에 붙인 뒤 오른쪽 클릭으로 원문 위치로 돌아갑니다.

한 페이지에서 영역을 자릅니다.

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — 한 페이지 영역 캡처 -->

영역이 페이지 경계를 넘으면 한 장의 이어진 그림으로 붙습니다.

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — 여러 페이지를 한 장으로 -->

### 기본 리더의 위치와 링크

리더를 바꿔도 이미 있는 링크가 깨져서는 안 됩니다. Obsidian의 `#page=`, `#selection=`을 이해하고, 기본 PDF 리더로 지정할 수 있습니다. 이미 열린 탭이 있으면 그 탭을 쓰고, `#markId=`로 하이라이트 위치까지 갑니다.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — 기존 페이지·선택 링크 열기 -->

### 하이라이트 스타일과 목록

형광펜, 물결선, 직선 밑줄과 직접 고른 색을 지원합니다. 목록에서 거르고, 정렬하고, 이동하고, 삭제할 수 있습니다.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — 스타일과 하이라이트 목록 -->

### 스마트 복사 — 중간 줄바꿈 제거

PDF 조판은 문장 중간에서 줄을 끊는 일이 많아, 복사하면 불필요한 줄바꿈이 남습니다. 평소처럼 선택해 복사하면 Foxycape가 그 소프트 줄바꿈을 걷어, 이어진 문단으로 붙여 넣습니다. 실제 문단 나눔은 남습니다.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — 선택 → 복사 → 문장 중간 줄바꿈 없이 붙여넣기 -->

### 이동과 검색

목차, 썸네일, 페이지 이동, 문서 안 검색(`Mod+F`). 대소문자, 발음 구별 부호, 단어 전체를 구분할 수 있습니다. 검색은 PDF 텍스트 레이어를 쓰며 OCR은 없습니다.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — 목차, 썸네일, 검색 -->

### 읽기 레이아웃

확대(자동 / 페이지 너비 / 퍼센트), 세로 또는 가로 스크롤, 단일 페이지 / 펼침 / 책, 페이지 회전, 암호 PDF. 데스크톱과 모바일에서 쓸 수 있습니다.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — 레이아웃과 확대 -->

### 기본 PDF 리더로

설정에서 **기본 PDF 뷰어로 사용**을 켜면, Obsidian이 PDF를 Foxycape로 엽니다. 딥링크, 하이라이트, 테마 맞춤까지 이어서 쓸 수 있습니다.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — 설정에서 기본 PDF 뷰어 켜기 -->

## 개발

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # 감시 빌드. OBSIDIAN_PLUGIN_DIR 이 있으면 성공할 때마다 그 플러그인 폴더로 복사
npm test
npm run typecheck
npm run link       # dist/ 를 보관함의 .obsidian/plugins/foxycape-pdf 에 junction
```

`.env`에 `OBSIDIAN_PLUGIN_DIR`을 두면(`.env.example` 참고) `npm run dev`가 빌드에 성공할 때마다 결과물을 그곳으로 복사합니다. `npm run link`도 같은 변수를 읽고, 없으면 기본 보관함 경로를 씁니다. 프로세스 환경 변수가 파일보다 우선합니다.

## 라이선스

이 저장소는 **source available**이며, [Foxycape Plugins License Agreement](LICENSE.md)가 적용됩니다.

- 사용, 수정, 재배포는 가능합니다. 다만 Foxycape 상용 제품과 경쟁하는, 불특정 다수를 위한 Obsidian(또는 비슷한 노트 앱)용 범용 제품으로 만드는 것은 제한됩니다. 체험·라이선스 확인을 뺀 무료 공개 등록도 포함됩니다.
- 개인 사용, 한 조직 안의 사용, 특정 고객을 위한 맞춤 작업은 이 제한을 받지 않습니다.
- 이 계약을 넘는 권리가 필요하면 **company@tiefeiying.com**으로 연락하세요.

PDF.js 같은 제3자 구성 요소와, 따로 공개된 패키지(MIT인 `@foxycape/core` 등)는 각자의 라이선스를 따릅니다.

전문은 [LICENSE.md](LICENSE.md)를 보세요.
