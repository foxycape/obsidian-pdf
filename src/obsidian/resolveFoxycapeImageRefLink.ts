import { parseLinktext, type App, type TFile } from 'obsidian'
import { normalizePdfSubpath } from './reusePdfLeaf'
import {
  parsePdfDeepLink,
  toNavigablePdfSubpath,
} from './selectionLink'

export type FoxycapeImageRefLinkTarget = {
  pdfFile: TFile
  /** Navigable `#page=&foxycape-rect=` / `#page=&rect=` subpath (no `name=`). */
  subpath: string
}

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
])

export const isVaultImageFile = (file: TFile): boolean =>
  IMAGE_EXTENSIONS.has(file.extension.toLowerCase())

const decodePathSegment = (raw: string): string => {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Basename from a vault / markdown / DOM image path (strips `#…` / `|…` extras). */
export const imageFileNameFromPath = (raw: string): string => {
  let value = (raw || '').trim().replace(/\\/g, '/')
  value = value.split('|')[0] ?? value
  value = value.split('#')[0] ?? value
  value = value.split('?')[0] ?? value
  const segment = value.split('/').pop() || value
  return decodePathSegment(segment)
}

export const imageNamesMatch = (
  expected: string | undefined,
  actual: string | undefined,
): boolean => {
  if (!expected || !actual) {
    return false
  }
  return (
    decodePathSegment(expected).toLowerCase() ===
    decodePathSegment(actual).toLowerCase()
  )
}

export type ResolveFoxycapeImageRefLinkOptions = {
  /**
   * When set, require fragment `name=` to match this image file name.
   * Links without `name=` are rejected in this mode.
   */
  imageFileName?: string
}

/**
 * Resolve a markdown / internal linktext to a Foxycape image-location PDF target.
 * Requires a vault PDF plus `page` and a valid `foxycape-rect` / `rect` fragment.
 */
export const resolveFoxycapeImageRefLink = (
  app: App,
  linktext: string,
  sourcePath: string,
  options?: ResolveFoxycapeImageRefLinkOptions,
): FoxycapeImageRefLinkTarget | null => {
  const raw = (linktext || '').trim()
  if (!raw) {
    return null
  }
  const { path, subpath } = parseLinktext(raw)
  if (!path || !subpath) {
    return null
  }
  const file = app.metadataCache.getFirstLinkpathDest(path, sourcePath || '')
  if (!file || file.extension.toLowerCase() !== 'pdf') {
    return null
  }
  const deep = parsePdfDeepLink(subpath)
  if (deep.page == null || !deep.rect) {
    return null
  }
  if (options?.imageFileName) {
    if (!deep.name || !imageNamesMatch(deep.name, options.imageFileName)) {
      return null
    }
  }
  const navigable = toNavigablePdfSubpath(subpath)
  if (!navigable) {
    return null
  }
  return {
    pdfFile: file,
    subpath: normalizePdfSubpath(navigable) ?? navigable,
  }
}

/**
 * Walk image ancestors and return the first node that has a `src` attribute.
 * Obsidian may put the outer PDF deep link on a parent `div` or `a` as `src`.
 */
export const findFirstAncestorWithSrc = (img: Element): Element | null => {
  let el: Element | null = img.parentElement
  while (el) {
    if (el.hasAttribute('src')) {
      return el
    }
    el = el.parentElement
  }
  return null
}

/** Read linktext from an ancestor that carries the PDF target in `src`. */
export const readAncestorPdfLinktext = (ancestor: Element): string => {
  return (ancestor.getAttribute('src') || '').trim()
}

/**
 * From a note `<img>`, take the first ancestor with `src` and resolve it as a
 * Foxycape image-location PDF link bound to this image (`name=`).
 * Stops after the first `src` ancestor — no further search if it does not match.
 */
export const resolveFoxycapeImageRefFromImageElement = (
  app: App,
  img: Element,
  sourcePath: string,
  imageFileName?: string,
): FoxycapeImageRefLinkTarget | null => {
  const ancestor = findFirstAncestorWithSrc(img)
  if (!ancestor) {
    return null
  }
  const linktext = readAncestorPdfLinktext(ancestor)
  const fileName =
    imageFileName || imageFileNameFromPath(img.getAttribute('src') || '')
  return resolveFoxycapeImageRefLink(app, linktext, sourcePath, {
    imageFileName: fileName || undefined,
  })
}

/** @deprecated Prefer ancestor `src` walk; kept for simple `<a>` fallbacks. */
export const readAnchorLinktext = (anchor: Element): string => {
  return (
    anchor.getAttribute('src') ||
    anchor.getAttribute('data-href') ||
    anchor.getAttribute('href') ||
    ''
  ).trim()
}
