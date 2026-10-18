/** `[n]`, `[n-n]`, or comma lists like `[445,401,494,542]`. */
export const CITE_HREF_PREFIX = 'cite:'

const LINKIFY_CITATION_REF_PATTERN = /\[(\d+(?:\s*[-–—－‑,，]\s*\d+)*)\](?!\()/g

const idsFromCitationMatch = (inner: string | undefined) => {
  if (!inner) {
    return []
  }
  return inner.split(/\s*[-–—－‑,，]\s*/).filter(Boolean)
}

const toCiteMarkdown = (id: string, displayById: Map<string, string>) => {
  let display = displayById.get(id)
  if (!display) {
    display = String(displayById.size + 1)
    displayById.set(id, display)
  }
  return `[${display}](${CITE_HREF_PREFIX}${id})`
}

/** Visible numbers restart at 1 in this string. The href keeps the original id. */
export const linkifyCitationRefs = (content: string): string => {
  if (!content) {
    return ''
  }
  const displayById = new Map<string, string>()
  return content.replace(LINKIFY_CITATION_REF_PATTERN, (_match, inner: string) =>
    idsFromCitationMatch(inner)
      .map((id) => toCiteMarkdown(id, displayById))
      .join(''),
  )
}

export const parseCiteHref = (href: string | null | undefined): string | undefined => {
  if (!href) {
    return undefined
  }
  try {
    const decoded = decodeURIComponent(href)
    if (!decoded.startsWith(CITE_HREF_PREFIX)) {
      return undefined
    }
    const id = decoded.slice(CITE_HREF_PREFIX.length)
    return id || undefined
  } catch {
    return undefined
  }
}
