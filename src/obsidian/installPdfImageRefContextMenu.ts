import { TFile, type Menu, type Plugin } from 'obsidian'
import { applyFoxycapeMenuIcon } from '@/ui/foxycapeIcon'
import {
  imageFileNameFromPath,
  imageNamesMatch,
  isVaultImageFile,
  resolveFoxycapeImageRefFromImageElement,
  type FoxycapeImageRefLinkTarget,
} from './resolveFoxycapeImageRefLink'

type PendingImageRefOpen = {
  target: FoxycapeImageRefLinkTarget
  imageFileName: string
}

type PdfImageRefContextMenuPlugin = Plugin & {
  pendingPdfImageRefTarget: PendingImageRefOpen | null
  t: (key: string, defaultText: string, named?: object) => string
  openFileWithFoxycape: (file: TFile, subpath?: string) => Promise<void>
}

const resolveSourcePath = (plugin: PdfImageRefContextMenuPlugin): string =>
  plugin.app.workspace.getActiveFile()?.path ?? ''

/**
 * Capture PDF deep-link from the first ancestor with `src` when right-clicking
 * a note image (`[![](img#…)](pdf#…&name=…)`), then expose "Open in Foxycape".
 */
export const installPdfImageRefContextMenu = (
  plugin: PdfImageRefContextMenuPlugin,
): void => {
  plugin.registerDomEvent(
    document,
    'contextmenu',
    (evt) => {
      plugin.pendingPdfImageRefTarget = null
      const target = evt.target
      if (!(target instanceof Element)) {
        return
      }
      const img = target.closest('img')
      if (!img) {
        return
      }
      const imageFileName = imageFileNameFromPath(img.getAttribute('src') || '')
      const resolved = resolveFoxycapeImageRefFromImageElement(
        plugin.app,
        img,
        resolveSourcePath(plugin),
        imageFileName || undefined,
      )
      if (!resolved) {
        return
      }
      plugin.pendingPdfImageRefTarget = {
        target: resolved,
        imageFileName,
      }
    },
    { capture: true },
  )

  plugin.registerEvent(
    plugin.app.workspace.on('file-menu', (menu: Menu, file) => {
      if (!(file instanceof TFile) || !isVaultImageFile(file)) {
        return
      }
      const pending = plugin.pendingPdfImageRefTarget
      plugin.pendingPdfImageRefTarget = null
      if (!pending) {
        return
      }
      if (
        pending.imageFileName &&
        !imageNamesMatch(pending.imageFileName, file.name)
      ) {
        return
      }

      menu.addItem((item) => {
        item.setTitle(
          plugin.t('plugin_menu_open_image_in_foxycape', 'Open in Foxycape'),
        )
        applyFoxycapeMenuIcon(item)
        item.onClick(() => {
          void plugin.openFileWithFoxycape(
            pending.target.pdfFile,
            pending.target.subpath,
          )
        })
      })
    }),
  )
}
