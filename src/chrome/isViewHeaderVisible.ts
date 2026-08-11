/**
 * Whether Obsidian's tab title bar (`.view-header`) is usable for PDF chrome.
 * Hidden when Appearance → "Show tab title bar" is off (or via CSS/themes).
 */
export const isViewHeaderVisible = (containerEl: HTMLElement): boolean => {
  const header = containerEl.querySelector<HTMLElement>('.view-header')
  if (!header) {
    return false
  }

  const left = header.querySelector('.view-header-left')
  const titleContainer = header.querySelector('.view-header-title-container')
  const actions = header.querySelector('.view-actions')
  if (!left || !titleContainer || !actions) {
    return false
  }

  const style = getComputedStyle(header)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }

  const rect = header.getBoundingClientRect()
  return rect.height >= 1 && rect.width >= 1
}
