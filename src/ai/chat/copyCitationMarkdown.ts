import type { DocumentCitation } from './types'
import { linkifyCitationRefs } from './citationRefs'

const CITE_LINK = /\[\d+\]\(cite:([^)]+)\)/g

/**
 * Assistant copy text. A citation that can open the PDF becomes `[↗](…)`.
 * A number that cannot be located is removed.
 */
export const toCopyableAssistantMarkdown = (
  content: string,
  citations: DocumentCitation[] | undefined,
  linkFor: (citation: DocumentCitation) => string,
): string => {
  const linked = linkifyCitationRefs(content)
  return linked.replace(CITE_LINK, (_full, rawId: string) => {
    let id = rawId
    try {
      id = decodeURIComponent(rawId)
    } catch {
      id = rawId
    }
    const citation = citations?.find((item) => item.id === id)
    if (!citation) {
      return ''
    }
    return linkFor(citation)
  })
}
