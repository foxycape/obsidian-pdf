import type { EventRef, Menu, Plugin } from 'obsidian'
import { applyFoxycapeMenuIcon } from '@/ui/foxycapeIcon'
import { parseRemoteContextMenuHref, parseRemotePdfHref } from './remotePdfLink'

type RemotePdfOpenPlugin = Omit<Plugin, 'settings'> & {
  settings: { useAsDefaultPdfViewer: boolean }
  t: (key: string, fallback: string) => string
  openUrlWithFoxycape: (url: string, subpath?: string) => Promise<void>
}

type WorkspaceWithUrlMenu = {
  on: (name: 'url-menu', callback: (menu: Menu, url: string) => unknown) => EventRef
}

const resolveClickedHref = (event: MouseEvent): string | null => {
  const target = event.target
  if (!(target instanceof Element)) {
    return null
  }
  const anchor = target.closest('a')
  if (!anchor) {
    return null
  }
  return anchor.getAttribute('href') ?? anchor.getAttribute('data-href')
}

/**
 * Right-click a remote `.pdf` URL or Google Drive share link (`usp=sharing`)
 * to open in Foxycape. When Foxycape is the default PDF viewer, a plain click
 * on a `.pdf` URL also opens it (Drive share links stay menu-only).
 */
export const installRemotePdfLinkOpen = (plugin: RemotePdfOpenPlugin): void => {
  const workspace = plugin.app.workspace as unknown as WorkspaceWithUrlMenu
  plugin.registerEvent(
    workspace.on('url-menu', (menu, url) => {
      const parsed = parseRemoteContextMenuHref(url)
      if (!parsed) {
        return
      }
      menu.addItem((item) => {
        item.setTitle(plugin.t('plugin_menu_open_with', 'Open with Foxycape PDF'))
        applyFoxycapeMenuIcon(item)
        item.onClick(() => {
          void plugin.openUrlWithFoxycape(parsed.url, parsed.subpath)
        })
      })
    }),
  )

  plugin.registerDomEvent(
    document,
    'click',
    (event: MouseEvent) => {
      if (!plugin.settings.useAsDefaultPdfViewer) {
        return
      }
      if (event.defaultPrevented || event.button !== 0) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const parsed = parseRemotePdfHref(resolveClickedHref(event))
      if (!parsed) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      void plugin.openUrlWithFoxycape(parsed.url, parsed.subpath)
    },
    { capture: true },
  )
}
