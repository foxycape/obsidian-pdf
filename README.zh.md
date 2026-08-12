<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

面向 Obsidian 的 PDF 阅读器：划线、引用与深度链接都能回到原文，和笔记工作流连在一起。

[English](README.md) | [中文](README.zh.md)

## 为什么需要它

在 Obsidian 里读 PDF，笔记链路经常断掉：

- 划线留在 PDF 里，vault 笔记在另一边。
- 要图时只能截图，糊且难管理。
- 粘贴的摘录和图片很少能指回具体页或区域。
- 深色主题下，浅色 PDF 页很刺眼。
- 换阅读器后，已有的页码/选区链接可能失效。

Foxycape PDF 在 Obsidian 内补上这些缺口。

## 功能特点

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
git submodule update --init --recursive   # 若 vendor/core 以 submodule 检出
npm install
npm run build      # → dist/main.js、styles.css、manifest.json + foxycape-pdf-assets.zip
npm run dev        # 监听构建（会把 pdfjs/static sidecar 拷到 dist/）
npm test
npm run typecheck
npm run link       # 将 dist/ junction 到 vault 的 .obsidian/plugins/foxycape-pdf
```

可用环境变量 `OBSIDIAN_PLUGIN_DIR` 覆盖 `npm run link` 的目标路径。

社区安装只会拿到 Obsidian 标准三文件。**首次打开 PDF** 时，插件会一次性下载约 3MB 的 `foxycape-pdf-assets.zip`（含 pdf.worker、cmaps、标准字体）到插件目录并缓存。本地 `npm run link` 已带 sidecar，无需下载。

## 发布（Obsidian 社区插件）

1. 在 `package.json` 中提升 `version`（semver `x.y.z`）。构建会同步到 `manifest.json` / `versions.json`。
2. 提交后创建 GitHub Release，**tag 必须与该 version 完全一致**（如 `3.3.6`，不要加 `v` 前缀）。
3. 上传 `dist/main.js`、`dist/manifest.json`、`dist/styles.css`，以及 `dist/foxycape-pdf-assets.zip`。

推送版本 tag 会触发 [`.github/workflows/release.yml`](.github/workflows/release.yml) 自动构建并上传上述资产。

## 许可证

本仓库为 **源码可见（source available）**，适用 [Foxycape Plugins License Agreement](LICENSE.md)。

- 允许使用、修改与再分发，但限制将其做成面向多人的、与 Foxycape 商业产品构成竞争的 Obsidian（或同类笔记应用）通用产品——包括去掉试用/授权校验后的免费公开上架。
- 私人使用、单一组织内部使用，以及非通用分发的定制/客户项目不受该限制。
- 若需要超出该协议的权利，见 [定价页](https://www.foxycape.com/obsidian/pricing)，或联系 **company@tiefeiying.com**。

第三方组件（如 PDF.js）以及单独发布的包（如 MIT 许可的 `@foxycape/core`）仍遵循各自许可证。

全文见 [LICENSE.md](LICENSE.md)。
