import type { Reader } from '../../kernal'
import { HtmlFileParser } from '../../mediaTypes/html/fileParser/HtmlFileParser'
import { HtmlOptions } from '../../mediaTypes/html/HtmlOptions'
import { HtmlRenderer } from '../../mediaTypes/html/renderer/HtmlRenderer'
import { ContentCssVariables } from '../../mediaTypes/html/renderer/style/ContentCssVariables'

export type RegisterHtmlMediaTypeOptions = {
  htmlOptions?: HtmlOptions
  /** Injected default content-area CSS variables; overrides ContentCssVariables defaults */
  defaultContentCssVariables?: Map<string, string> | Record<string, string>
}

/**
 * Register the HTML media type (parser + renderer) for samples.
 */
export const registerHtmlMediaType = (
  reader: Reader,
  options: HtmlOptions | RegisterHtmlMediaTypeOptions = {},
) => {
  const config: RegisterHtmlMediaTypeOptions =
    options instanceof HtmlOptions ? { htmlOptions: options } : options

  const htmlOptions = Object.assign(new HtmlOptions(), config.htmlOptions)

  const extensions = htmlOptions.htmlExtensions?.length
    ? htmlOptions.htmlExtensions
    : ['.html', '.xhtml', '.htm']

  const toVariableMap = (
    vars?: Map<string, string> | Record<string, string>,
  ): Map<string, string> | undefined => {
    if (!vars) {
      return undefined
    }
    if (vars instanceof Map) {
      return vars
    }
    return new Map(Object.entries(vars))
  }

  const defaultContentCssVariables = toVariableMap(config.defaultContentCssVariables)

  reader.mediaTypeRegistry.register(
    extensions,
    async (url, extension) => {
      const crypto = await reader.services.get('crypto', true)
      const fileUrlParser = await reader.services.get('fileUrlParser', true)
      const httpClient = await reader.services.get('httpClient', true)
      const fileDecrypter = await reader.services.get('fileDecrypter', false)
      const fileProvider = await reader.services.get('fileProvider', false)

      return new HtmlFileParser(
        crypto!,
        fileDecrypter as any,
        fileProvider as any,
        fileUrlParser!,
        httpClient!,
        url,
        extension,
        {
          removeHtmlWhitespace: htmlOptions.removeHtmlWhitespace,
          whitespaceRegex: htmlOptions.whitespaceRegex,
          nonWhiteSpaceSymbolTagNames: htmlOptions.nonWhiteSpaceSymbolTagNames,
          forceRemoveHtmlChar32BetweenTags: htmlOptions.forceRemoveHtmlChar32BetweenTags,
          // wrapFullTextNode: true,
        },
      )
    },
    async (owner, fileParser, readerContainer) => {
      const renderer = new HtmlRenderer(owner, fileParser, readerContainer, htmlOptions)
      if (defaultContentCssVariables) {
        renderer.styleProvider.initialize(defaultContentCssVariables)
      }
      return renderer
    },
  )

  return htmlOptions
}

export { ContentCssVariables }
