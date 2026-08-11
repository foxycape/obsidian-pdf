import { addIcon, type MenuItem } from 'obsidian'
import { FOXYCAPE_LOGO_DATA_URL } from '@/ui/foxycapeLogoData'

/** Custom Obsidian icon id for the Foxycape brand logo. */
export const FOXYCAPE_ICON_ID = 'foxycape-logo'

/**
 * Register the Foxycape logo for setIcon / command icons.
 * Menu items use {@link applyFoxycapeMenuIcon} so the PNG renders reliably.
 */
export const registerFoxycapeIcon = () => {
  addIcon(
    FOXYCAPE_ICON_ID,
    `<image width="100" height="100" href="${FOXYCAPE_LOGO_DATA_URL}" />`,
  )
}

/**
 * Put the Foxycape PNG logo on a context-menu item.
 * Uses an <img> in iconEl — more reliable for brand PNGs than SVG path icons.
 */
export const applyFoxycapeMenuIcon = (item: MenuItem) => {
  item.setIcon(FOXYCAPE_ICON_ID)
  const iconEl = (item as unknown as { iconEl?: HTMLElement }).iconEl
  if (!iconEl) {
    return
  }
  iconEl.empty()
  iconEl.createEl('img', {
    cls: 'foxycape-menu-logo',
    attr: {
      src: FOXYCAPE_LOGO_DATA_URL,
      alt: '',
      width: '18',
      height: '18',
    },
  })
}
