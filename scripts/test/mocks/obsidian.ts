export class Plugin {
  app = {
    workspace: {
      getLeavesOfType: () => [],
      getLeaf: () => ({
        setViewState: async () => undefined,
      }),
      revealLeaf: () => undefined,
      setActiveLeaf: () => undefined,
      detachLeavesOfType: () => undefined,
      openLinkText: async () => undefined,
      handleLinkContextMenu: () => false,
    },
    metadataCache: {
      getFirstLinkpathDest: () => null,
    },
  }

  registerView = () => undefined
  addCommand = () => undefined
  register = () => undefined
}

export class ItemView {
  contentEl = {
    empty: () => undefined,
    addClass: () => undefined,
    createDiv: () => document.createElement('div'),
  }

  constructor(_leaf: unknown) {}
}

export class FileView extends ItemView {
  file: { path: string } | null = null
}

export type WorkspaceLeaf = {
  view?: unknown
  activeTime?: number
  setEphemeralState?: (state: unknown) => void
  getViewState?: () => { type?: string; state?: Record<string, unknown> }
}

export type App = {
  workspace: Plugin['app']['workspace']
  metadataCache: Plugin['app']['metadataCache']
}

export type TFile = {
  path: string
  extension: string
}

export type OpenViewState = {
  state?: Record<string, unknown>
  eState?: Record<string, unknown>
  active?: boolean
}

export type PaneType = 'tab' | 'split' | 'window'

export const parseLinktext = (linktext: string): { path: string; subpath: string } => {
  const hashIndex = linktext.indexOf('#')
  if (hashIndex < 0) {
    return { path: linktext, subpath: '' }
  }
  return {
    path: linktext.slice(0, hashIndex),
    subpath: linktext.slice(hashIndex),
  }
}
