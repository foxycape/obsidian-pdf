import type { Reader } from '@core/kernal'
import { PdfFileParser } from '@core/mediaTypes/pdf/fileParser/PdfFileParser'
import { PdfOptions } from '@core/mediaTypes/pdf/PdfOptions'
import { CustomPdfOptions } from './CustomPdfOptions'
import { CustomPdfRenderer } from './CustomPdfRenderer'

export type RegisterPdfMediaTypeOptions = {
  pdfOptions?: CustomPdfOptions | PdfOptions
}

const toCustomPdfOptions = (options?: CustomPdfOptions | PdfOptions): CustomPdfOptions => {
  if (options instanceof CustomPdfOptions) {
    return options
  }
  const custom = new CustomPdfOptions()
  if (options) {
    Object.assign(custom, options)
  }
  return custom
}

/**
 * Register the PDF media type (parser + CustomPdfRenderer) for Obsidian.
 */
export const registerPdfMediaType = (
  reader: Reader,
  options: CustomPdfOptions | PdfOptions | RegisterPdfMediaTypeOptions = {},
) => {
  const config: RegisterPdfMediaTypeOptions =
    options instanceof PdfOptions || options instanceof CustomPdfOptions
      ? { pdfOptions: options }
      : options

  const pdfOptions = toCustomPdfOptions(config.pdfOptions)
  if (pdfOptions.showPasswordPrompt == null) {
    pdfOptions.showPasswordPrompt = true
  }

  reader.mediaTypeRegistry.register(
    ['.pdf'],
    async (url, extension) => {
      const crypto = await reader.services.get('crypto', true)
      const fileUrlParser = await reader.services.get('fileUrlParser', true)
      const httpClient = await reader.services.get('httpClient', true)
      const fileDecrypter = await reader.services.get('fileDecrypter', false)
      const fileProvider = await reader.services.get('fileProvider', false)
      const storage = await reader.services.get('storage', true)

      return new PdfFileParser(
        crypto!,
        fileDecrypter as never,
        fileProvider as never,
        fileUrlParser!,
        httpClient!,
        reader.events,
        reader.locale,
        reader.context!,
        storage ?? null,
        url,
        extension,
        {
          cMapUrl: pdfOptions.cMapUrl,
          standardFontDataUrl: pdfOptions.standardFontDataUrl,
          showPasswordPrompt: pdfOptions.showPasswordPrompt,
        },
      )
    },
    async (owner, fileParser, readerContainer) => {
      return new CustomPdfRenderer(owner, fileParser, readerContainer, pdfOptions)
    },
  )

  return pdfOptions
}

export {
  CustomPdfOptions,
  DEFAULT_PDF_VIEW_PREFERENCES,
  type PdfImageLinkSource,
  type PdfThemeColorRemapMode,
  type PdfViewPreferenceKey,
  type PdfViewPreferencePatch,
  type PdfViewPreferences,
} from './CustomPdfOptions'
export { CustomPdfRenderer } from './CustomPdfRenderer'
