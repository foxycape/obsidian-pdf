import type { Editor, MarkdownFileInfo, MarkdownView, Plugin } from 'obsidian'
import { Notice, TFile } from 'obsidian'
import {
  buildPasteMarkdownForImageRef,
  buildPdfImageAssetFileName,
  consumePendingPdfImageRef,
  matchesPendingImageRefSentinel,
  peekPendingPdfImageRef,
  savePdfImageAsset,
} from './pdfImageRef'

type PdfImageRefPastePlugin = Plugin & {
  t: (key: string, defaultText: string, named?: object) => string
}

const resolveNoteFile = (
  info: MarkdownView | MarkdownFileInfo | undefined,
): TFile | null => {
  const file = info?.file
  return file instanceof TFile ? file : null
}

const shouldHandlePaste = (evt: ClipboardEvent): boolean => {
  const pending = peekPendingPdfImageRef()
  if (!pending) {
    return false
  }
  const text = evt.clipboardData?.getData('text/plain') ?? ''
  // If the clipboard carries unrelated text, the user copied something else.
  if (text && !matchesPendingImageRefSentinel(text, pending)) {
    return false
  }
  return true
}

/**
 * On Markdown paste, materialize a staged PDF image reference into the PDF
 * sibling folder and insert a clickable image link back to the page.
 */
export const installPdfImageRefPaste = (plugin: PdfImageRefPastePlugin): void => {
  plugin.registerEvent(
    plugin.app.workspace.on(
      'editor-paste',
      (evt: ClipboardEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
        if (!shouldHandlePaste(evt)) {
          return
        }
        const noteFile = resolveNoteFile(info)
        if (!noteFile) {
          return
        }

        evt.preventDefault()

        void (async () => {
          const pending = consumePendingPdfImageRef()
          if (!pending) {
            return
          }
          try {
            const fileName = buildPdfImageAssetFileName({
              kind: pending.kind,
              pageNumber: pending.pageNumber,
              nameHint: pending.nameHint,
            })
            const imageFile = await savePdfImageAsset(
              plugin.app,
              pending.pdfFile,
              pending.pngBlob,
              fileName,
            )
            const markdown = buildPasteMarkdownForImageRef(
              noteFile.path,
              imageFile,
              pending.pdfFile,
              pending.pageNumber,
              pending.rect,
            )
            editor.replaceSelection(markdown)
            new Notice(
              plugin.t(
                'pdf_image_ref_pasted',
                'Image saved with location link — right-click the image to open its PDF location in Foxycape',
              ),
            )
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            new Notice(
              plugin
                .t(
                  'pdf_image_ref_paste_failed',
                  'Failed to paste image reference: {message}',
                )
                .replace('{message}', message),
            )
          }
        })()
      },
    ),
  )
}
