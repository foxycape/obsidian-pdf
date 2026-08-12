import {
  parseLinktext,
  type App,
  type Menu,
  type OpenViewState,
  type PaneType,
  type Plugin,
  type TFile,
  type WorkspaceLeaf,
} from 'obsidian'
import { OBSIDIAN_PDF_VIEW_TYPE, PDF_READER_VIEW_TYPE } from '@/settings/types'

type LeafWithActiveTime = WorkspaceLeaf & {
  activeTime?: number
}

type FileBearingView = {
  file?: TFile | null
}

type PendingPdfLink = {
  linktext: string
  sourcePath: string
}

type HandleLinkContextMenuFn = (
  menu: Menu,
  linktext: string,
  sourcePath: string,
  leaf?: WorkspaceLeaf,
) => boolean

type OpenLinkTextFn = (
  linktext: string,
  sourcePath: string,
  newLeaf?: boolean | PaneType,
  openViewState?: OpenViewState,
) => Promise<void>

const PDF_VIEW_TYPES = [PDF_READER_VIEW_TYPE, OBSIDIAN_PDF_VIEW_TYPE] as const

const getLeafActiveTime = (leaf: WorkspaceLeaf): number =>
  (leaf as LeafWithActiveTime).activeTime ?? 0

const getLeafFilePath = (leaf: WorkspaceLeaf): string | null => {
  const view = leaf.view as FileBearingView | null
  if (view?.file?.path) {
    return view.file.path
  }
  // Deferred / unloaded tabs keep the path on view state instead of view.file.
  try {
    const stateFile = leaf.getViewState()?.state?.file
    if (typeof stateFile === 'string' && stateFile) {
      return stateFile
    }
  } catch {
    // ignore unavailable view state
  }
  return null
}

/** Normalize Obsidian PDF deep-link fragments to always include a leading `#`. */
export const normalizePdfSubpath = (subpath?: string | null): string | undefined => {
  if (!subpath) {
    return undefined
  }
  return subpath.startsWith('#') ? subpath : `#${subpath}`
}

/**
 * If `linktext` resolves to `file`, return its subpath (e.g. `#page=3&markId=...`).
 * Used when right-clicking an internal PDF link — `file-menu` alone has no subpath.
 */
export const resolvePdfLinkSubpath = (
  app: App,
  file: TFile,
  linktext: string,
  sourcePath: string,
): string | undefined => {
  const { path, subpath } = parseLinktext(linktext)
  if (!subpath) {
    return undefined
  }
  const dest = app.metadataCache.getFirstLinkpathDest(path, sourcePath)
  if (!dest || dest.path !== file.path) {
    return undefined
  }
  return normalizePdfSubpath(subpath)
}

/** Find an already-open PDF tab for `file`, preferring the most recently active one. */
export const findExistingPdfLeaf = (
  app: App,
  file: TFile,
  viewTypes: readonly string[] = PDF_VIEW_TYPES,
): WorkspaceLeaf | null => {
  const allowed = new Set(viewTypes)
  const candidates: WorkspaceLeaf[] = []
  const seen = new Set<WorkspaceLeaf>()

  const consider = (leaf: WorkspaceLeaf) => {
    if (seen.has(leaf)) {
      return
    }
    const type = leaf.getViewState()?.type
    if (typeof type !== 'string' || !allowed.has(type)) {
      return
    }
    if (getLeafFilePath(leaf) !== file.path) {
      return
    }
    seen.add(leaf)
    candidates.push(leaf)
  }

  for (const viewType of viewTypes) {
    for (const leaf of app.workspace.getLeavesOfType(viewType)) {
      consider(leaf)
    }
  }
  // Cover popout windows / edge cases where getLeavesOfType misses a leaf.
  app.workspace.iterateAllLeaves(consider)

  if (candidates.length === 0) {
    return null
  }
  candidates.sort((a, b) => getLeafActiveTime(b) - getLeafActiveTime(a))
  return candidates[0] ?? null
}

/** Focus an existing PDF leaf and apply deep-link / ephemeral state when present. */
export const revealExistingPdfLeaf = async (
  app: App,
  leaf: WorkspaceLeaf,
  openViewState?: OpenViewState,
  subpath?: string,
): Promise<void> => {
  void app.workspace.revealLeaf(leaf)
  app.workspace.setActiveLeaf(leaf, { focus: true })

  const normalizedSubpath = normalizePdfSubpath(subpath)
  const eState =
    openViewState?.eState ??
    (normalizedSubpath
      ? {
          subpath: normalizedSubpath,
        }
      : undefined)

  if (eState) {
    leaf.setEphemeralState(eState)
  }
}

type PdfLinkOpenPlugin = Plugin & {
  pendingPdfLink: PendingPdfLink | null
}

/**
 * Capture full linktext (incl. `#page=...`) before Obsidian builds the link
 * context menu, so "Open with Foxycape PDF" can restore deep-link position.
 */
export const installPdfLinkContextCapture = (plugin: PdfLinkOpenPlugin): void => {
  const { workspace } = plugin.app
  const originalHandleLinkContextMenu = workspace.handleLinkContextMenu.bind(
    workspace,
  ) as HandleLinkContextMenuFn

  workspace.handleLinkContextMenu = (
    menu: Menu,
    linktext: string,
    sourcePath: string,
    leaf?: WorkspaceLeaf,
  ): boolean => {
    plugin.pendingPdfLink = { linktext, sourcePath }
    return originalHandleLinkContextMenu(menu, linktext, sourcePath, leaf)
  }

  plugin.register(() => {
    workspace.handleLinkContextMenu = originalHandleLinkContextMenu
  })
}

/** Consume a pending right-clicked PDF link subpath when it targets `file`. */
export const consumePendingPdfLinkSubpath = (
  plugin: PdfLinkOpenPlugin,
  file: TFile,
): string | undefined => {
  const pending = plugin.pendingPdfLink
  plugin.pendingPdfLink = null
  if (!pending) {
    return undefined
  }
  return resolvePdfLinkSubpath(plugin.app, file, pending.linktext, pending.sourcePath)
}

/**
 * When a markdown PDF link is opened without a "new leaf" modifier (Ctrl/Cmd),
 * reuse an existing tab for that file instead of opening another copy.
 */
export const installPdfLinkReuse = (plugin: Plugin): void => {
  const { workspace } = plugin.app
  const originalOpenLinkText = workspace.openLinkText.bind(
    workspace,
  ) as OpenLinkTextFn

  workspace.openLinkText = async (
    linktext: string,
    sourcePath: string,
    newLeaf?: boolean | PaneType,
    openViewState?: OpenViewState,
  ): Promise<void> => {
    // Respect Ctrl/Cmd/middle-click / explicit new-pane requests.
    if (newLeaf) {
      await originalOpenLinkText(linktext, sourcePath, newLeaf, openViewState)
      return
    }

    const { path, subpath } = parseLinktext(linktext)
    const file = plugin.app.metadataCache.getFirstLinkpathDest(path, sourcePath)
    if (!file || file.extension.toLowerCase() !== 'pdf') {
      await originalOpenLinkText(linktext, sourcePath, newLeaf, openViewState)
      return
    }

    const existing = findExistingPdfLeaf(plugin.app, file)
    if (!existing) {
      await originalOpenLinkText(linktext, sourcePath, newLeaf, openViewState)
      return
    }

    await revealExistingPdfLeaf(plugin.app, existing, openViewState, subpath)
  }

  plugin.register(() => {
    workspace.openLinkText = originalOpenLinkText
  })
}
