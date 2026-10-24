<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

面向 Obsidian 的 PDF 阅读器：划线、引用与深度链接都能回到原文，和笔记工作流连在一起。读论文或学习资料时，翻译、查词、解释和提问都在当前 PDF 里完成，不用另开网页或别的应用。

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## 为什么需要它

在 Obsidian 里读 PDF，笔记链路经常断掉：

- 划线留在 PDF 里，vault 笔记在另一边。
- 要图时只能截图，糊且难管理。
- 粘贴的摘录和图片很少能指回具体页或区域。
- 深色主题下，浅色 PDF 页很刺眼。
- 换阅读器后，已有的页码/选区链接可能失效。

读论文或学习资料时，生词、长句和陌生概念会卡住，翻译、词典和提问却要换到别的工具，页码还得自己对。

Foxycape PDF 在 Obsidian 内补上这些缺口。

## 功能特点

### 在当前页读懂论文和学习资料

#### 一篇外文论文，从扫读到读懂

选中一段即可翻译，先看懂大意。默认用微软翻译，扫读不占 AI 流量；要更贴近专业表述时，换成 AI，并可在速度优先和质量优先之间切换，目标语言自选。

这段里若还有一个词拿不准，就查这个词：读音用国际音标、拼音或假名标出，并给出它在这一段里的意思。选中的是整句时，先给句意，再点出难词。

这段还是没读懂，用「解释这段」把这一段讲开，方便接着往下读。简要一两句就够时继续翻页；要展开再选详细。还想追问，点「了解更多」，这段原文和已有解释会进入侧栏的问 AI。

译文、解释和查词都留在这份 PDF 的侧边列表里，之后可以筛选并跳回那一页。需要记到笔记时，在设置里分别打开写入（默认关闭），追加到与 PDF 同名的 Markdown。

<!-- GIF: docs/gifs/read-in-place.gif — 选中后翻译、查词、解释 -->

#### 一份长资料，边读边问

选中一段即可问 AI，问题会带上这段原文。文档较长时，会先问要不要分析这份文档：同意后，回答结合文档里的段落，引用可以点回对应页；不同意就按一般知识回答，之后仍可在菜单里选「分析此书」。

从引用回到某一页后，那一段若还没读懂，翻译、查词和解释仍可接着用。答完后会给出可继续点的相关问题。对话按这份 PDF 保存，下次打开还能搜历史、开新对话。

<!-- GIF: docs/gifs/ask-while-reading.gif — 问当前 PDF，引用跳回对应页 -->

### 模型与额度

解释、查词、AI 翻译和问 AI 用当前模型。官方模型的用量记在许可证的 AI 流量上，也可以填写自己的接口地址和 API Key。微软翻译不占这份额度。许可证可以免费领取，流量也可以购买，或通过分享获取。

### 划线同步笔记

不必让划线只留在 PDF 里。新建划线时，可自动创建或更新与 PDF 同名的 Markdown 笔记，追加带回链的摘录，并可选分屏打开；不需要时可在设置中关闭。

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — 划线后自动写入同名笔记 -->

### 提取内嵌高清图

不用靠模糊截图凑合。悬停内嵌图片（移动端用触控控件）即可预览、复制或下载原图。

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — 悬停镜头：预览 / 复制 / 下载 -->

### 文本与图片引用，一键回源

引用带着出处，之后还能从笔记跳回 PDF：

- 复制文本引用为带深度链接的 Markdown（`#page=` / `#selection=` / `#markId=`）。
- 复制图片引用；粘贴到 Markdown 时自动保存 PNG 到 PDF 旁，并插入可点击链接。
- 右键笔记中的图片 → **在 Foxycape 中打开**，回到对应页并高亮原始区域。

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — 复制引用 → 粘贴 → 回 PDF -->

### 适配 Obsidian 主题

深色 vault 里浅色 PDF 页往往刺眼。可选将灰度矢量色映射到主题前景/背景（BETA），范围可选全部 / 仅深色 / 仅浅色；彩色图与彩色矢量保持原色。

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — PDF 页面随主题变化 -->

### 框选截图

不必再切到系统截图、跨页还得自己拼。点工具栏「截图」，在 PDF 上拖出选区即可。可复制图片，或复制图片引用——粘贴到笔记后，右键即可跳回原文位置。

单页框选，裁出当前页上的一块：

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — 单页框选截图 -->

选区跨过页缝时，自动拼接成一张连续图：

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — 多页连续截图并拼接 -->

### 兼容内置阅读器的位置与链接

换阅读器不该弄坏已有链接。兼容 Obsidian 的 `#page=`、`#selection=`，可设为默认 PDF 阅读器，已打开时复用标签，并支持 `#markId=` 精确定位划线。

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — 打开已有页码/选区链接 -->

### 划线样式与划线列表

支持荧光笔、波浪线、直线下划线及自定义颜色。划线列表可筛选、排序、跳转与删除。

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — 标注样式与划线列表 -->

### 智能拷贝 — 自动去掉软换行

PDF 排版常把句子拦腰截断，复制后满是多余换行。照常选中并复制即可：Foxycape 会去掉这些软换行，粘贴成连贯段落，真正的段落分隔仍会保留。

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — 选中文本 → 复制 → 粘贴无句中换行 -->

### 导航与搜索

目录、缩略图、页码跳转，以及文档内搜索（`Mod+F`），支持区分大小写 / 变音符号 / 全字匹配。搜索基于 PDF 文本层（无 OCR）。

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — 目录、缩略图与搜索 -->

### 阅读布局

缩放（自动 / 适合页宽 / 百分比）、纵向或横向滚动、单页 / 双页 / 书籍布局、页面旋转、密码 PDF。支持桌面与移动端。

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — 布局与缩放 -->

### 设为默认 PDF 阅读器

建议在设置中开启 **用作默认 PDF 查看器**，让 Obsidian 默认用 Foxycape 打开 PDF，深度链接、划线与主题适配等能力体验更完整。

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — 在设置中开启默认 PDF 阅读器 -->

## 开发

```bash
npm install
npm run build      # → dist/main.js、styles.css、manifest.json、versions.json、markdown.js、pdfjs.zip、reader-bundle.zip、locales.zip、pdfjs-assets.zip
npm run dev        # 监听构建；若设置了 OBSIDIAN_PLUGIN_DIR，成功后拷到该插件目录
npm test
npm run typecheck
npm run link       # 将 dist/ junction 到 vault 的 .obsidian/plugins/foxycape-pdf
```

在 `.env` 中设置 `OBSIDIAN_PLUGIN_DIR`（见 `.env.example`）后，`npm run dev` 会在每次构建成功时把产物拷到该目录；`npm run link` 也读取同一变量，未设置时仍使用默认 vault 路径。进程环境变量优先于文件。

## 许可证

本仓库为 **源码可见（source available）**，适用 [Foxycape Plugins License Agreement](LICENSE.md)。

- 允许使用、修改与再分发，但限制将其做成面向多人的、与 Foxycape 商业产品构成竞争的 Obsidian（或同类笔记应用）通用产品——包括去掉试用/授权校验后的免费公开上架。
- 私人使用、单一组织内部使用，以及非通用分发的定制/客户项目不受该限制。
- 若需要超出该协议的权利，联系 **company@tiefeiying.com**。

第三方组件（如 PDF.js）以及单独发布的包（如 MIT 许可的 `@foxycape/core`）仍遵循各自许可证。

全文见 [LICENSE.md](LICENSE.md)。
