import { linkifyCitationRefs } from './citationRefs'
import { preprocessLaTeX } from './latex'

export const prepareMarkdown = (content: string, options?: { isReasoning?: boolean }): string => {
  if (!content) {
    return ''
  }
  const source = options?.isReasoning ? content : linkifyCitationRefs(content)
  return preprocessLaTeX(source)
}
