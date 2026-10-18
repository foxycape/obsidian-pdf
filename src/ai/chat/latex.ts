import { checkRegexAssertionsSupport } from '@foxycape/core/kernal/common/regex'

const replaceUnescapedPipes = (formula: string): string => {
  if (checkRegexAssertionsSupport().negativeLookbehind) {
    return formula.replace(/(?<!\\)\|/g, '\\vert{}')
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

export const escapeLatexPipes = (text: string): string => {
  const pattern = checkRegexAssertionsSupport().negativeLookbehind
    ? /(```[\S\s]*?```|`[^\n`]*`)|\$\$([\S\s]*?)\$\$|(?<!\$)\$(?!\$)([\S\s]*?)(?<!\$)\$(?!\$)/g
    : /(```[\s\S]*?```|`[^\n`]*`)|\$\$([\s\S]*?)\$\$|\$([^\n$]*)\$/g

  return text.replace(pattern, (match, code, display, inline) => {
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
  })
}

export const escapeTextUnderscores = (text: string): string => {
  return text.replace(/\\text{([^}]*)}/g, (_match, textContent: string) => {
    if (checkRegexAssertionsSupport().negativeLookbehind) {
      return `\\text{${textContent.replace(/(?<!\\)_/g, '\\_')}}`
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
