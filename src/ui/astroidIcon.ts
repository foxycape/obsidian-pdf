import { addIcon } from 'obsidian'

/** Same Lucide Astroid mark as the selection-toolbar Ask AI button. */
export const ASTROID_ICON_ID = 'foxycape-astroid'

const ASTROID_PATH =
  'M12.983 21.186a1 1 0 0 1-1.966 0 10 10 0 0 0-8.203-8.203 1 1 0 0 1 0-1.966 10 10 0 0 0 8.203-8.203 1 1 0 0 1 1.966 0 10 10 0 0 0 8.203 8.203 1 1 0 0 1 0 1.966 10 10 0 0 0-8.203 8.203'

/**
 * Register the toolbar AI icon for Obsidian menus.
 * Nested svg keeps the 24px Lucide viewBox inside Obsidian's icon svg.
 */
export const registerAstroidIcon = () => {
  addIcon(
    ASTROID_ICON_ID,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="${ASTROID_PATH}"/></svg>`,
  )
}
