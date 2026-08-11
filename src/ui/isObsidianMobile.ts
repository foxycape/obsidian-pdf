/** True when Obsidian adds `is-mobile` on `body` (phone + tablet). */
export const isObsidianMobile = () =>
  typeof document !== 'undefined' &&
  document.body.classList.contains('is-mobile')
