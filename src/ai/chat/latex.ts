import { checkRegexAssertionsSupport } from '@foxycape/core/kernal/common/regex'

type LatexReplace = (
  match: string,
  code: string | undefined,
  display: string | undefined,
  inline: string | undefined,
) => string

/** Compiled only when the engine supports lookbehind. A literal would fail to parse before iOS 16.4. */
const unescapedPipePattern = (): RegExp => new RegExp('(?<' + '!\\\\)\\|', 'g')

const replaceUnescapedPipes = (formula: string): string => {
  if (checkRegexAssertionsSupport().negativeLookbehind) {
    return formula.replace(unescapedPipePattern(), '\\vert{}')
  }
  return formula.replace(/(^|[^\\])\|/g, '$1\\vert{}')
}

export const convertLatexDelimiters = (text: string): string => {
  const pattern = /(```[\S\s]*?```|`.*?`)|\\\[([\S\s]*?[^\\])\\]|\\\((.*?)\\\)/g
  return text.replace(
    pattern,
    (
      match: string,
      codeBlock: string | undefined,
      squareBracket: string | undefined,
      roundBracket: string | undefined,
    ): string => {
      if (codeBlock !== undefined) {
        return codeBlock
      }
      if (squareBracket !== undefined) {
        return `$$${squareBracket}$$`
      }
      if (roundBracket !== undefined) {
        return `$${roundBracket}$`
      }
      return match
    },
  )
}

export const escapeMhchemCommands = (text: string): string => {
  return text.replace(/\$\\ce\{/g, '$\\\\ce{').replace(/\$\\pu\{/g, '$\\\\pu{')
}

const escapePipesInMatch: LatexReplace = (match, code, display, inline) => {
  if (code !== undefined) {
    return code
  }
  if (display !== undefined) {
    return `$$${replaceUnescapedPipes(display)}$$`
  }
  if (inline !== undefined) {
    return `$${replaceUnescapedPipes(inline)}$`
  }
  return match
}

const escapeLatexPipesWithLookbehind = (text: string): string => {
  const pattern = new RegExp(
    '(```[\\S\\s]*?```|`[^\\n`]*`)|\\$\\$([\\S\\s]*?)\\$\\$|' +
      '(?<' +
      '!\\$)\\$(?!\\$)([\\S\\s]*?)' +
      '(?<' +
      '!\\$)\\$(?!\\$)',
    'g',
  )
  return text.replace(pattern, escapePipesInMatch)
}

const escapeLatexPipesWithoutLookbehind = (text: string): string =>
  text.replace(
    /(```[\s\S]*?```|`[^\n`]*`)|\$\$([\s\S]*?)\$\$|\$([^\n$]*)\$/g,
    escapePipesInMatch,
  )

export const escapeLatexPipes = (text: string): string => {
  if (checkRegexAssertionsSupport().negativeLookbehind) {
    return escapeLatexPipesWithLookbehind(text)
  }
  return escapeLatexPipesWithoutLookbehind(text)
}

const escapeUnderscoresWithLookbehind = (textContent: string): string =>
  textContent.replace(unescapedUnderscorePattern(), '\\_')

const unescapedUnderscorePattern = (): RegExp => new RegExp('(?<' + '!\\\\)_', 'g')

export const escapeTextUnderscores = (text: string): string => {
  return text.replace(/\\text{([^}]*)}/g, (_match: string, textContent: string) => {
    if (checkRegexAssertionsSupport().negativeLookbehind) {
      return `\\text{${escapeUnderscoresWithLookbehind(textContent)}}`
    }
    return `\\text{${textContent.replace(/(^|[^\\])_/g, '$1\\_')}}`
  })
}

export const preprocessLaTeX = (str: string): string => {
  let content = str
  content = convertLatexDelimiters(content)
  content = escapeMhchemCommands(content)
  content = escapeLatexPipes(content)
  content = escapeTextUnderscores(content)
  return content
}
