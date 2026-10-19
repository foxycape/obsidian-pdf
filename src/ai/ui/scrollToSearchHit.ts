const HIGHLIGHT_NAME = 'ai-search-hit'
const HIGHLIGHT_MS = 2500

type TextSlice = {
  node: Text
  start: number
}

let clearTimer = 0

const locate = (slices: TextSlice[], index: number) => {
  for (let i = 0; i < slices.length; i += 1) {
    const slice = slices[i]
    if (!slice) {
      continue
    }
    const nodeEnd = slice.start + slice.node.data.length
    const isLast = i === slices.length - 1
    if (index < nodeEnd || (isLast && index === nodeEnd)) {
      return { node: slice.node, offset: index - slice.start }
    }
  }
  return null
}

export const findKeywordRange = (
  root: HTMLElement,
  keyword: string,
  occurrence: number,
): Range | null => {
  const needle = keyword.trim().toLowerCase()
  if (!needle || occurrence < 0 || typeof document === 'undefined') {
    return null
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.textContent) {
        return NodeFilter.FILTER_REJECT
      }
      const parent = node.parentElement
      if (parent?.closest('script, style')) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const slices: TextSlice[] = []
  let combined = ''
  let current = walker.nextNode()
  while (current) {
    const text = current as Text
    slices.push({ node: text, start: combined.length })
    combined += text.data
    current = walker.nextNode()
  }
  const lower = combined.toLowerCase()
  let from = 0
  let index = -1
  for (let i = 0; i <= occurrence; i += 1) {
    index = lower.indexOf(needle, from)
    if (index < 0) {
      return null
    }
    from = index + needle.length
  }
  const start = locate(slices, index)
  const end = locate(slices, index + needle.length)
  if (!start || !end) {
    return null
  }
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  return range
}

export const highlightRange = (range: Range) => {
  window.clearTimeout(clearTimer)
  const registry = CSS.highlights
  if (!registry || typeof Highlight === 'undefined') {
    return
  }
  registry.set(HIGHLIGHT_NAME, new Highlight(range))
  clearTimer = window.setTimeout(() => {
    registry.delete(HIGHLIGHT_NAME)
  }, HIGHLIGHT_MS)
}

export const scrollRangeIntoView = (scroller: HTMLElement, range: Range) => {
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return false
  }
  const host = scroller.getBoundingClientRect()
  const top = rect.top - host.top + scroller.scrollTop - 32
  scroller.scrollTo({ top: Math.max(0, top) })
  return true
}
