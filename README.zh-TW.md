<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

面向 Obsidian 的 PDF 閱讀器：劃線、引用與深度連結都能回到原文，和筆記工作流連在一起。讀論文或學習資料時，翻譯、查詞、解釋和提問都在目前開啟的 PDF 裡完成。

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## 為什麼需要它

在 Obsidian 裡讀 PDF，筆記鏈路經常斷掉：

- 劃線留在 PDF 裡，庫裡的筆記在另一邊。
- 要圖時只能截圖，糊且難管理。
- 貼上的摘錄和圖片很少能指回具體頁或區域。
- 深色主題下，淺色 PDF 頁很刺眼。
- 換閱讀器後，已有的頁碼／選區連結可能失效。

讀論文或學習資料時，生詞、長句和不熟的概念會卡住，翻譯、詞典和提問卻要換到別的工具，頁碼還得自己對。

Foxycape PDF 在 Obsidian 內補上這些缺口。

## 功能特點

### 在目前這一頁讀懂論文和學習資料

#### 一篇外文論文，從掃讀到讀懂

選取一段即可翻譯，先看懂大意。預設用 Microsoft 翻譯，掃讀不占 AI 流量；要更貼近專業表述時，改成 AI，並可在**速度優先**和**品質優先**之間切換，目標語言自選。

這段裡若還有一個詞拿不準，就用**查詞**：讀音用國際音標、拼音或假名標出，並給出它在這一段裡的意思。選取的是整句時，先給句意，再點出難詞。

這段還是沒讀懂，用**解釋這段**把這一段講開，方便接著往下讀。**簡要**一兩句就夠時繼續翻頁；要展開再選**詳細**。還想追問，點**了解更多**，這段原文和已有解釋會進入側欄的**問 AI**。

譯文、解釋和查詞都留在這份 PDF 的側邊列表裡，之後可以篩選並跳回那一頁。需要記到筆記時，在設定裡分別打開寫入（預設關閉），追加到與 PDF 同名的 Markdown。

<!-- GIF: docs/gifs/read-in-place.gif — 選取後翻譯、查詞、解釋 -->

#### 一份長資料，邊讀邊問

選取一段即可**問 AI**，問題會帶上這段原文。文件較長時，會先問要不要分析這份文件：同意後，回答結合文件裡的段落，引用可以點回對應頁；不同意就按一般知識回答，之後仍可在選單裡選**分析此書**。

從引用回到某一頁後，那一段若還沒讀懂，翻譯、查詞和解釋仍可接著用。答完後會給出可繼續點的相關問題。對話按這份 PDF 保存，下次打開還能搜尋歷史、開新對話。

<!-- GIF: docs/gifs/ask-while-reading.gif — 問目前的 PDF，引用跳回對應頁 -->

### 模型與額度

解釋、查詞、AI 翻譯和問 AI 用目前所選模型。官方模型的用量記在授權的 AI 流量上，也可以填寫自己的**介面網址**和 **API Key**。Microsoft 翻譯不占這份額度。授權可以免費取得，流量也可以購買，或透過分享取得。

### 劃線同步筆記

不必讓劃線只留在 PDF 裡。新建劃線時，可自動建立或更新與 PDF 同名的 Markdown 筆記，追加帶回鏈的摘錄，並可選分屏打開；不需要時可在設定中關閉。

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — 劃線後自動寫入同名筆記 -->

### 提取內嵌高清圖

不用靠模糊截圖湊合。懸停內嵌圖片（行動版用觸控控制）即可預覽、複製或下載原圖。

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — 懸停：預覽／複製／下載 -->

### 文字與圖片引用，一鍵回源

引用帶著出處，之後還能從筆記跳回 PDF：

- 複製文字引用為帶深度連結的 Markdown（`#page=` / `#selection=` / `#markId=`）。
- 複製圖片引用；貼到 Markdown 時自動保存 PNG 到 PDF 旁，並插入可點擊連結。
- 右鍵筆記中的圖片 → **在 Foxycape 中開啟**，回到對應頁並標出原始區域。

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — 複製引用 → 貼上 → 回到 PDF -->

### 適配 Obsidian 主題

深色庫裡淺色 PDF 頁往往刺眼。可選將灰度向量色對應到主題前景／背景（BETA），範圍可選全部／僅深色／僅淺色；彩色圖與彩色向量保持原色。

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — PDF 頁面隨主題變化 -->

### 框選截圖

不必再切到系統截圖、跨頁還得自己拼。點工具列**截圖**，在 PDF 上拖出選區即可。可複製圖片，或複製圖片引用——貼到筆記後，右鍵即可跳回原文位置。

單頁框選，裁出目前頁上的一塊：

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — 單頁框選截圖 -->

選區跨過頁縫時，自動拼成一張連續圖：

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — 多頁連續截圖並拼接 -->

### 相容內建閱讀器的位置與連結

換閱讀器不該弄壞已有連結。相容 Obsidian 的 `#page=`、`#selection=`，可設為預設 PDF 閱讀器，已打開時沿用分頁，並支援 `#markId=` 精確定位劃線。

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — 打開已有的頁碼／選區連結 -->

### 劃線樣式與劃線列表

支援螢光筆、波浪線、直線底線及自訂顏色。劃線列表可篩選、排序、跳轉與刪除。

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — 標註樣式與劃線列表 -->

### 智慧複製 — 自動去掉軟換行

PDF 排版常把句子從中截斷，複製後滿是多餘換行。照常選取並複製即可：Foxycape 會去掉這些軟換行，貼成連貫段落，真正的段落分隔仍會保留。

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — 選取文字 → 複製 → 貼上後句中無換行 -->

### 導覽與搜尋

目錄、縮圖、頁碼跳轉，以及文件內搜尋（`Mod+F`），支援區分大小寫／變音符號／全字符合。搜尋基於 PDF 文字層（無 OCR）。

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — 目錄、縮圖與搜尋 -->

### 閱讀版面

縮放（自動／適合頁寬／百分比）、縱向或橫向捲動、單頁／雙頁／書籍版面、頁面旋轉、有密碼的 PDF。支援桌面與行動版。

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — 版面與縮放 -->

### 設為預設 PDF 閱讀器

建議在設定中開啟**用作預設 PDF 檢視器**，讓 Obsidian 預設用 Foxycape 打開 PDF，深度連結、劃線與主題適配會更完整。

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — 在設定中開啟預設 PDF 閱讀器 -->

## 開發

```bash
npm install
npm run build      # → dist/main.js、styles.css、manifest.json、versions.json、markdown.js、pdfjs.zip、reader-bundle.zip、locales.zip、pdfjs-assets.zip
npm run dev        # 監看建置；若設定了 OBSIDIAN_PLUGIN_DIR，成功後拷到該外掛目錄
npm test
npm run typecheck
npm run link       # 將 dist/ 以 junction 連到庫的 .obsidian/plugins/foxycape-pdf
```

在 `.env` 中設定 `OBSIDIAN_PLUGIN_DIR`（見 `.env.example`）後，`npm run dev` 會在每次建置成功時把產物拷到該目錄；`npm run link` 也讀取同一變數，未設定時仍使用預設庫路徑。行程環境變數優先於檔案。

## 授權

本儲存庫為**原始碼可見（source available）**，適用 [Foxycape Plugins License Agreement](LICENSE.md)。

- 允許使用、修改與再散布，但限制將其做成面向多人的、與 Foxycape 商業產品構成競爭的 Obsidian（或同類筆記應用）通用產品——包括去掉試用／授權檢查後的免費公開上架。
- 私人使用、單一組織內部使用，以及非通用散布的客製／客戶專案不受該限制。
- 若需要超出該協議的權利，聯絡 **company@tiefeiying.com**。

第三方元件（如 PDF.js）以及單獨發布的套件（如 MIT 授權的 `@foxycape/core`）仍遵循各自授權。

全文見 [LICENSE.md](LICENSE.md)。
