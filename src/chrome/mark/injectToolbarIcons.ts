import { sanitizeHTMLToDom } from 'obsidian'
import toolbarIconsSvg from './toolbar-icons.svg?raw'

const SPRITE_ID = 'foxycape-pdf-mark-toolbar-icons'

export const injectToolbarIcons = (doc: Document = document): void => {
  if (doc.getElementById(SPRITE_ID)) {
    return
  }
  const holder = doc.createElement('div')
  holder.id = SPRITE_ID
  holder.setAttribute('aria-hidden', 'true')
  holder.classList.add('foxycape-pdf-visually-hidden')
  holder.appendChild(sanitizeHTMLToDom(toolbarIconsSvg))
  doc.body.appendChild(holder)
}
