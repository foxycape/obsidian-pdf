import type { Reader } from '../../kernal'
import { PdfFileParser } from '../../mediaTypes/pdf/fileParser/PdfFileParser'
import { PdfOptions } from '../../mediaTypes/pdf/PdfOptions'
import { PdfRenderer } from '../../mediaTypes/pdf/renderer/PdfRenderer'

export type RegisterPdfMediaTypeOptions = {
  pdfOptions?: PdfOptions
}

/**
 * Register the PDF media type (parser + renderer) for samples.
 * Password UI: set showPasswordPrompt and listen to EventNames.RequirePdfPassword.
 */
export const registerPdfMediaType = (
  reader: Reader,
  options: PdfOptions | RegisterPdfMediaTypeOptions = {},
) => {
  const config: RegisterPdfMediaTypeOptions =
    options instanceof PdfOptions ? { pdfOptions: options } : options

  const pdfOptions = config.pdfOptions ?? new PdfOptions()
  if (pdfOptions.showPasswordPrompt == null) {
    pdfOptions.showPasswordPrompt = true
  }
  const extensions = ['.pdf']

  reader.mediaTypeRegistry.register(
    extensions,
    async (url, extension) => {
      const crypto = await reader.services.get('crypto', true)
      const fileUrlParser = await reader.services.get('fileUrlParser', true)
      const httpClient = await reader.services.get('httpClient', true)
      const fileDecrypter = await reader.services.get('fileDecrypter', false)
      const fileProvider = await reader.services.get('fileProvider', false)
      const storage = await reader.services.get('storage', true)

      return new PdfFileParser(
        crypto!,
        fileDecrypter as any,
        fileProvider as any,
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
      return new PdfRenderer(owner, fileParser, readerContainer, pdfOptions)
    },
  )

  return pdfOptions
}
