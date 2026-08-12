import { PdfOptions } from '@foxycape/core/mediaTypes/pdf/PdfOptions'
import type { PdfImageLinkSource } from '@/obsidian/pdfImageRef'

/** When theme color remap is enabled, which color modes it applies to. */
export type PdfThemeColorRemapMode = 'dark' | 'light' | 'both'

export type { PdfImageLinkSource }

/** Fields that the view settings panel can change at runtime. */
export type PdfViewPreferenceKey =
  | 'enableViewPdfImages'
  | 'enablePdfThemeColorRemap'
  | 'pdfThemeColorRemapMode'
  | 'enableAutoCreateHighlightNotes'

export type PdfViewPreferences = Pick<CustomPdfOptions, PdfViewPreferenceKey>
export type PdfViewPreferencePatch = Partial<PdfViewPreferences>

/**
 * Obsidian PDF plugin options — extends core PdfOptions without modifying it.
 */
export class CustomPdfOptions extends PdfOptions {
  /** Enable hover/tap preview for embedded PDF images. */
  enableViewPdfImages = true

  /**
   * Remap PDF page canvas colors to the reader theme (CIELAB greyscale mapping).
   * Color images stay original; grayscale images invert in dark theme.
   */
  enablePdfThemeColorRemap = false

  /**
   * When to apply theme color remap.
   * - `dark`: only when reader theme is dark
   * - `light`: only when reader theme is light
   * - `both`: always
   */
  pdfThemeColorRemapMode: PdfThemeColorRemapMode = 'both'

  /**
   * When true, creating a highlight appends a linked excerpt to a Markdown note
   * with the same name as the PDF (created if missing).
   */
  enableAutoCreateHighlightNotes = true

  /** Minimum original image width (px) to treat as previewable. */
  imageMinWidth = 100

  /** Minimum original image height (px) to treat as previewable. */
  imageMinHeight = 100
  contentWrapperBorderRadius: number = 3;
  enableContentWrapperBorderRadius: boolean;

  /**
   * Runtime-only: resolve Obsidian app + PDF file for "copy image reference".
   * Not persisted in settings.
   */
  getLinkSource?: () => PdfImageLinkSource | null

  /**
   * Runtime-only: gate premium image actions (browse / copy / download / reference).
   * Return false to block (caller may show a notice). Not persisted in settings.
   */
  ensureEntitled?: () => boolean

  /**
   * Runtime-only: install disk-backed CMap / standard-font factories on getDocument.
   * Not persisted in settings.
   */
  documentInitParametersCallback?: (documentInitParameters: Record<string, unknown>) => void
}

/** Shared defaults for plugin persistence and reader construction. */
export const DEFAULT_PDF_VIEW_PREFERENCES: PdfViewPreferences = (() => {
  const defaults = new CustomPdfOptions()
  return {
    enableViewPdfImages: defaults.enableViewPdfImages,
    enablePdfThemeColorRemap: defaults.enablePdfThemeColorRemap,
    pdfThemeColorRemapMode: defaults.pdfThemeColorRemapMode,
    enableAutoCreateHighlightNotes: defaults.enableAutoCreateHighlightNotes,
  }
})()
